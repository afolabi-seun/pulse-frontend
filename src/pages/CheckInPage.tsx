import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronDown, History, Pencil, Plus } from 'lucide-react';
import HelpTooltip from '../components/ui/HelpTooltip';
import ExpandableText from '../components/checkins/ExpandableText';
import { useAuth } from '../hooks/useAuth';
import { useSubmitCheckIn, useCheckInHistory } from '../api/checkIns';
import { useMyProjects } from '../api/projects';
import { applyServerErrors } from '../lib/formErrors';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { FormPageSkeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDate, todayIso as getTodayIso } from '../lib/dates';
import type { CheckInDto } from '../types/api';


interface FormValues { projectId: string; completed: string; plannedNext: string; blockers: string; }

/** One line per submitted check-in — project, a preview, any blocker flag and Edit — opening to the full text. */
function TodayCheckInRow({ checkIn, projectName, onEdit }: { checkIn: CheckInDto; projectName?: string; onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${projectName ?? 'General'} check-in — ${open ? 'hide' : 'show'} details`}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="shrink-0 text-sm font-semibold text-foreground">{projectName ?? 'General'}</span>
          {!open && <span className="min-w-0 truncate text-xs text-muted-foreground">{checkIn.completed}</span>}
          {checkIn.blockers && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              <AlertTriangle className="h-3 w-3" /> Blocker
            </span>
          )}
          <ChevronDown className={cn('ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>
      {open && (
        <dl className="space-y-2 bg-muted/20 px-4 py-3 text-sm">
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Completed</dt>
            <dd className="text-foreground"><ExpandableText text={checkIn.completed} /></dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Planned next</dt>
            <dd className="text-foreground"><ExpandableText text={checkIn.plannedNext} /></dd>
          </div>
          {checkIn.blockers && (
            <div>
              <dt className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-300">
                <AlertTriangle className="h-3 w-3" /> Blockers
              </dt>
              <dd className="text-amber-700 dark:text-amber-300"><ExpandableText text={checkIn.blockers} /></dd>
            </div>
          )}
        </dl>
      )}
    </li>
  );
}

function FieldLabel({ htmlFor, children, help, required }: { htmlFor: string; children: React.ReactNode; help?: { title: string; body: string }; required?: boolean }) {
  return (
    <div className="mb-1 flex items-center gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-semibold">{children}</Label>
      {help && <HelpTooltip title={help.title} body={help.body} side="right" />}
      <span className={cn('ml-auto text-[11px]', required ? 'text-destructive' : 'text-muted-foreground')}>
        {required ? 'required' : 'optional'}
      </span>
    </div>
  );
}

export default function CheckInPage() {
  const { currentUser } = useAuth();
  const { mutate, isPending } = useSubmitCheckIn();
  const { data: history, isLoading } = useCheckInHistory(currentUser!.id);
  const { data: myProjects } = useMyProjects();

  const todayIso     = getTodayIso();
  const todayCheckIns = history?.items.filter((c) => c.date === todayIso) ?? [];

  const submittedProjectIds = new Set(todayCheckIns.map((c) => c.projectId).filter(Boolean) as string[]);
  const hasNullCheckIn = todayCheckIns.some((c) => c.projectId === null);

  const availableProjects = (myProjects ?? []).filter((p) => !submittedProjectIds.has(p.id));

  // undefined = composing a new entry; null = editing the project-less "General" entry;
  // a project id = editing that project's entry.
  const [editingProjectId, setEditingProjectId] = useState<string | null | undefined>(undefined);
  const isEditing = editingProjectId !== undefined;
  // Most days have no blocker, so the box stays folded away until it is wanted (or the entry being edited has one).
  const [showBlockers, setShowBlockers] = useState(false);

  const { register, control, handleSubmit, setError, reset, formState: { errors } } = useForm<FormValues>();

  const projectName = (id: string | null) =>
    id ? (myProjects?.find((p) => p.id === id)?.name ?? id) : undefined;

  const startEdit = (ci: CheckInDto) => {
    reset({ completed: ci.completed, plannedNext: ci.plannedNext, blockers: ci.blockers ?? '', projectId: ci.projectId ?? '' });
    setShowBlockers(!!ci.blockers);
    setEditingProjectId(ci.projectId);
  };

  const cancelEdit = () => {
    reset({ completed: '', plannedNext: '', blockers: '', projectId: '' });
    setShowBlockers(false);
    setEditingProjectId(undefined);
  };

  const onSubmit = handleSubmit((values) => {
    mutate(
      {
        date:        todayIso,
        completed:   values.completed,
        plannedNext: values.plannedNext,
        blockers:    showBlockers ? values.blockers || undefined : undefined,
        projectId:   (isEditing ? editingProjectId : values.projectId) || undefined,
      },
      {
        onSuccess: () => {
          toast.success(isEditing ? 'Check-in updated.' : 'Check-in submitted.');
          reset();
          setShowBlockers(false);
          setEditingProjectId(undefined);
        },
        onError: (e) => applyServerErrors(e, setError),
      },
    );
  });

  if (isLoading) return <FormPageSkeleton fields={3} />;

  return (
    <div className="max-w-2xl space-y-3">
      <PageHeader title="Daily check-in" />

      {/* Today's submitted check-ins: one compact line each */}
      {todayCheckIns.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Submitted today — {formatDate(todayIso)}</span>
          </div>
          <ul className="divide-y divide-border">
            {todayCheckIns.map((ci) => (
              <TodayCheckInRow key={ci.id} checkIn={ci} projectName={projectName(ci.projectId)} onEdit={() => startEdit(ci)} />
            ))}
          </ul>
        </Card>
      )}

      {/* Form for a new check-in, an additional one, or editing an existing one */}
      <Card className="overflow-hidden">
        {isEditing ? (
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <Pencil className="h-3.5 w-3.5 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Editing check-in for {projectName(editingProjectId ?? null) ?? 'General'}
            </p>
            <button type="button" onClick={cancelEdit} className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground">
              Cancel
            </button>
          </div>
        ) : todayCheckIns.length > 0 && (
          <div className="flex items-center gap-2 border-b border-border px-4 py-2">
            <Plus className="h-3.5 w-3.5 text-primary" />
            <p className="text-sm font-semibold text-foreground">Submit for another project</p>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-3 px-4 py-4">
          {/* Project picker (hidden while editing — the project is fixed for an existing entry) */}
          {!isEditing && (myProjects?.length ?? 0) > 0 && (
            <div>
              <Label htmlFor="checkin-project" className="mb-1 block text-sm font-semibold">Project</Label>
              <Controller
                name="projectId"
                control={control}
                // A plain <select> with no matching option defaults to its first <option> in the
                // DOM — when "General" is excluded (hasNullCheckIn) that was silently the first
                // available project, not empty. Matched explicitly here since a controlled
                // SearchableSelect has no such implicit fallback.
                defaultValue={!hasNullCheckIn ? '' : (availableProjects[0]?.id ?? '')}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    disabled={hasNullCheckIn && availableProjects.length === 0}
                    placeholder={hasNullCheckIn && availableProjects.length === 0 ? 'All projects submitted' : 'Search projects…'}
                    emptyLabel="No matching projects"
                    options={[
                      ...(!hasNullCheckIn ? [{ value: '', label: 'General (no specific project)' }] : []),
                      ...availableProjects.map((p) => ({ value: p.id, label: p.name })),
                    ]}
                  />
                )}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                One check-in per project — each appears separately in the standup digest.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel
                htmlFor="checkin-completed" required
                help={{ title: 'What did you complete?', body: 'List tasks, PRs, reviews, or any other work you finished since your last check-in. Brief bullet points are fine.' }}
              >
                What did you complete?
              </FieldLabel>
              <Textarea
                id="checkin-completed"
                rows={3}
                {...register('completed', { required: 'Required' })}
                placeholder="Summarise what you finished today or since last check-in."
              />
              {errors.completed && <p className="mt-1 text-xs text-destructive">{errors.completed.message}</p>}
            </div>
            <div>
              <FieldLabel
                htmlFor="checkin-next" required
                help={{ title: 'What are you working on next?', body: "Describe your plan until the next check-in — tasks you'll start or continue. This feeds the standup digest that heads of department see." }}
              >
                What are you working on next?
              </FieldLabel>
              <Textarea
                id="checkin-next"
                rows={3}
                {...register('plannedNext', { required: 'Required' })}
                placeholder="What do you plan to do until your next check-in?"
              />
              {errors.plannedNext && <p className="mt-1 text-xs text-destructive">{errors.plannedNext.message}</p>}
            </div>
          </div>

          {/* Blockers: folded away until wanted */}
          {showBlockers ? (
            <div>
              <FieldLabel
                htmlFor="checkin-blockers"
                help={{ title: 'Blockers', body: 'Anything preventing you from making progress — waiting on a decision, a dependency, access, or unclear requirements. This triggers a flag for your team lead.' }}
              >
                Any blockers?
              </FieldLabel>
              <Textarea
                id="checkin-blockers"
                rows={2}
                {...register('blockers')}
                placeholder="Anything preventing you from making progress?"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowBlockers(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
            >
              <AlertTriangle className="h-3.5 w-3.5" /> Add a blocker
            </button>
          )}

          <div className="flex items-center gap-3 border-t border-border pt-3">
            <Button type="submit" loading={isPending}>{isEditing ? 'Update check-in' : 'Submit check-in'}</Button>
            <span className="text-xs text-muted-foreground">{formatDate(todayIso)}</span>
            <Link
              to="/check-in/history"
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              View history
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
