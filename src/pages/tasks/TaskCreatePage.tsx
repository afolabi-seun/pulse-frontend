import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { CalendarDays, ChevronDown, FileText, Layers, Plus, UserCircle, Workflow } from 'lucide-react';
import { useCreateTask } from '../../api/tasks';
import { useProjectList, useMyProjects } from '../../api/projects';
import { useEngineerList } from '../../api/engineers';
import { useEpicsByProject } from '../../api/epics';
import { useMeta } from '../../api/meta';
import { useAuth } from '../../hooks/useAuth';
import { applyServerErrors } from '../../lib/formErrors';
import PriorityScaleGuide from '../../components/tasks/PriorityScaleGuide';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn } from '@/lib/utils';

const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

const DISCIPLINES = [
  { value: 'frontend',  label: 'Frontend' },
  { value: 'backend',   label: 'Backend' },
  { value: 'design',    label: 'Design' },
  { value: 'fullStack', label: 'Full Stack' },
  { value: 'product',   label: 'Product' },
  { value: 'pmo',       label: 'PMO' },
  { value: 'functional', label: 'Functional' },
  { value: 'database', label: 'Database' },
  { value: 'infraDevSecOps', label: 'Infra/DevSecOps' },
  { value: 'support',   label: 'Support' },
  { value: 'other',     label: 'Other' },
];

interface FormValues {
  title: string; description: string; acceptanceCriteria: string; dueDate: string;
  projectId: string; assigneeId: string; type: string; epicId: string;
  requiresQa: boolean; discipline: string; requiresFrontendHandoff: boolean; priority: string; externalReference: string;
}

export default function TaskCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetProjectId = searchParams.get('projectId') ?? '';

  const { currentUser, allow } = useAuth();
  const isPmOrAbove = allow('pm-or-above');
  // HR/Accountant can keep private to-dos in a project of their own (to log time against) instead of
  // picking a real project. Defaults on for them unless they arrived here from a specific project.
  const canPersonal = allow('personal-task-creator');
  const [personal, setPersonal] = useState(canPersonal && !presetProjectId);
  const canAssignOthers = allow('team-lead-or-above');
  // Both start collapsed — External reference/Acceptance criteria and the whole Workflow section
  // are the fields least likely to be touched when creating a task (acceptance criteria in
  // particular is more often added later during grooming), so they're one click away rather than
  // always taking up scroll height.
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [showWorkflow, setShowWorkflow] = useState(false);

  const { mutate, isPending } = useCreateTask();
  const { data: allProjects } = useProjectList(isPmOrAbove);
  const { data: myProjects }  = useMyProjects(!isPmOrAbove);
  const { data: engineers }   = useEngineerList(canAssignOthers);
  const { data: meta }        = useMeta();

  // Someone who can't assign to anyone else has exactly one option in the Assignee dropdown
  // anyway ("Assign to me") — default it in rather than making them click it every time.
  const { register, control, handleSubmit, setError, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      projectId: presetProjectId,
      description: '',
      assigneeId: canAssignOthers ? '' : (currentUser?.id ?? ''),
    },
  });

  const selectedProjectId = watch('projectId');
  const { data: epics } = useEpicsByProject(selectedProjectId);

  // A due date is only mandatory once the task has enough shape to be scheduled — an assignee or
  // a priority. Points is set later via grooming (edit/Planning Poker), not on this page, so it
  // no longer factors in here — mirrors the backend rule in CreateTaskCommand, which still
  // considers points too, for tasks created through other paths (e.g. CSV import).
  const watchedAssigneeId = watch('assigneeId');
  const watchedPriority = watch('priority');
  const dueDateRequired = personal || !!watchedAssigneeId || !!watchedPriority;

  useEffect(() => {
    setValue('epicId', '');
  }, [selectedProjectId, setValue]);

  const onSubmit = handleSubmit((values) => {
    mutate(
      personal
      ? {
        // A personal task is just a title, notes and a due date — the server files it in the caller's
        // own personal project, assigned to them.
        title: values.title,
        description: values.description || undefined,
        dueDate: values.dueDate || undefined,
        personal: true,
      }
      : {
        ...values,
        dueDate:     values.dueDate     || undefined,
        description: values.description || undefined,
        acceptanceCriteria: values.acceptanceCriteria || undefined,
        assigneeId:  values.assigneeId  || undefined,
        epicId:      values.epicId      || undefined,
        requiresQa:  values.requiresQa  || undefined,
        discipline:  values.discipline  || undefined,
        requiresFrontendHandoff: values.requiresFrontendHandoff || undefined,
        priority:    values.priority ? Number(values.priority) : undefined,
        externalReference: values.externalReference || undefined,
      },
      {
        onSuccess: (task) => {
          toast.success(
            task.status === 'backlog'
              ? "Task created — it's in Backlog until it has an assignee and points."
              : 'Task created.',
          );
          navigate(`/tasks/${task.id}`);
        },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  return (
    <div className="max-w-xl">
      <PageHeader title={personal ? 'New personal task' : 'New task'} />

      {canPersonal && (
        <div className="mb-4 flex overflow-hidden rounded-md border border-input text-sm" role="group" aria-label="Task kind">
          {([false, true] as const).map((isPersonal) => (
            <button
              key={String(isPersonal)}
              type="button"
              aria-pressed={personal === isPersonal}
              onClick={() => setPersonal(isPersonal)}
              className={cn(
                'flex-1 px-3 py-2 font-medium transition-colors',
                personal === isPersonal ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {isPersonal ? 'Personal task' : 'Project task'}
            </button>
          ))}
        </div>
      )}
      {personal && (
        <p className="mb-4 text-sm text-muted-foreground">
          A private to-do, assigned to you and visible only to you — it's kept out of project lists and reports.
          Use it to log your time against.
        </p>
      )}

      <Card className="overflow-hidden">
        <form onSubmit={onSubmit}>
          {/* Task details */}
          <div className="flex items-center gap-2.5 border-b border-border px-5 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Task details</p>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1.5">
              <Label>Title <span className="text-destructive">*</span></Label>
              <Input {...register('title', { required: 'Title is required' })} placeholder="Task title" />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
              />
            </div>
            {!personal && (!showMoreDetails ? (
              <button
                type="button"
                onClick={() => setShowMoreDetails(true)}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" /> Add external reference or acceptance criteria
              </button>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>External reference</Label>
                  <Input placeholder="e.g. JIRA-482" {...register('externalReference')} />
                  <p className="text-xs text-muted-foreground">Optional — a pre-existing ID for this work in another system.</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Acceptance criteria</Label>
                  <Controller
                    name="acceptanceCriteria"
                    control={control}
                    render={({ field }) => <RichTextEditor value={field.value ?? ''} onChange={field.onChange} />}
                  />
                </div>
              </>
            ))}
          </div>

          {/* A personal task has no project, assignee, epic or type to choose — these stay mounted (so
              form validation is unaffected) but hidden. */}
          <div hidden={personal}>
          {/* Assignment */}
          <div className="flex items-center gap-2.5 border-y border-border px-5 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-50 dark:bg-emerald-950/40">
              <UserCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Assignment</p>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div className="space-y-1.5">
              <Label>Project <span className="text-destructive">*</span></Label>
              <Controller
                name="projectId"
                control={control}
                rules={{ required: personal ? false : 'Project is required' }}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search projects…"
                    emptyLabel="No matching projects"
                    options={(isPmOrAbove ? allProjects?.filter((p) => p.isActive && p.canAccess) : myProjects)?.map((p) => ({ value: p.id, label: p.name })) ?? []}
                  />
                )}
              />
              {errors.projectId && <p className="text-xs text-destructive">{errors.projectId.message}</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select {...register('type')} className={SELECT_CLS} defaultValue={meta?.taskTypes[0]?.value ?? 'feature'}>
                  {(meta?.taskTypes ?? []).map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                {canAssignOthers ? (
                  <Controller
                    name="assigneeId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Search engineers…"
                        emptyLabel="No matching engineers"
                        options={[{ value: '', label: 'Unassigned' }, ...(engineers?.filter((e) => e.isActive).map((e) => ({ value: e.id, label: e.name })) ?? [])]}
                      />
                    )}
                  />
                ) : (
                  // Below Team Lead, a task can only ever be assigned to yourself (enforced
                  // server-side too — see CreateTaskCommand) — showing an interactive dropdown
                  // with exactly one, non-removable option is pointless busywork.
                  <div className={cn(SELECT_CLS, 'flex items-center bg-muted/40 text-muted-foreground')}>
                    Assigned to you
                  </div>
                )}
              </div>
            </div>

            {selectedProjectId && (epics?.length ?? 0) > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-violet-500" />
                  <Label>Epic</Label>
                </div>
                <Controller
                  name="epicId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search epics…"
                      emptyLabel="No matching epics"
                      options={[{ value: '', label: 'No epic' }, ...epics!.map((e) => ({ value: e.id, label: e.title }))]}
                    />
                  )}
                />
              </div>
            )}
          </div>

          </div>

          {/* Scheduling */}
          <div className="flex items-center gap-2.5 border-y border-border px-5 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
              <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Scheduling</p>
          </div>
          <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Due date {dueDateRequired && <span className="text-destructive">*</span>}</Label>
              <Input type="date" {...register('dueDate', {
                required: dueDateRequired ? 'Due date is required once an assignee or priority is set.' : false,
              })} />
              {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
              {!personal && <p className="text-xs text-muted-foreground">Points are set later, once the task is groomed.</p>}
            </div>
            <div className="space-y-1.5" hidden={personal}>
              <Label>
                Priority
                <PriorityScaleGuide scale={meta?.priorityScale ?? []} />
              </Label>
              <select {...register('priority')} className={SELECT_CLS} defaultValue="">
                <option value="">Not set</option>
                {[1, 2, 3, 4, 5].map((v) => {
                  const entry = meta?.priorityScale?.find((e) => e.value === v);
                  return (
                    <option key={v} value={v}>
                      P{v}{entry ? ` — ${entry.label}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div hidden={personal}>
          {/* Workflow — collapsed by default: QA sign-off, discipline and the frontend handoff
              flag are all things a task can get later via grooming/edit, not usually decided at
              creation time. */}
          <button
            type="button"
            aria-expanded={showWorkflow}
            onClick={() => setShowWorkflow((v) => !v)}
            className="flex w-full items-center gap-2.5 border-y border-border px-5 py-3 text-left hover:bg-muted/40"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sky-50 dark:bg-sky-950/40">
              <Workflow className="h-4 w-4 text-sky-600 dark:text-sky-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Workflow</p>
            <span className="text-xs text-muted-foreground">QA sign-off, discipline, handoff</span>
            <ChevronDown className={cn('ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform', showWorkflow && 'rotate-180')} />
          </button>
          {showWorkflow && (
          <div className="space-y-3 px-5 py-4">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                {...register('requiresQa')}
              />
              <span className="text-sm font-medium text-foreground">Requires QA sign-off before done</span>
            </label>
            <p className="text-xs text-muted-foreground">
              When checked, marking this task done will route it to QA instead — a linked QA sub-task is auto-created for review.
            </p>
            <div className="space-y-1.5">
              <Label>Discipline</Label>
              <Controller
                name="discipline"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Search disciplines…"
                    emptyLabel="No matching disciplines"
                    options={[{ value: '', label: 'Not specified' }, ...DISCIPLINES]}
                  />
                )}
              />
              <p className="text-xs text-muted-foreground">Used to route QA tasks to the right QA engineer.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border accent-primary"
                {...register('requiresFrontendHandoff')}
              />
              <span className="text-sm font-medium text-foreground">Needs a Backend → Frontend handoff</span>
            </label>
            <p className="text-xs text-muted-foreground">
              When checked, the backend assignee can hand this task off to a frontend engineer from Task Detail once their part is done — the task stays where it is, just reassigned.
            </p>
          </div>
          )}
          </div>
          <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-5 py-4">
            {errors.root && (
              <p className="text-sm text-destructive">{errors.root.message}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" loading={isPending}>Create task</Button>
              <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Cancel</Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
