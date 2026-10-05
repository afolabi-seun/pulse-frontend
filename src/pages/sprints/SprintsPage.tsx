import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Zap } from 'lucide-react';
import { FilterBar } from '../../components/ui/FilterBar';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { useAuth } from '../../hooks/useAuth';
import { useSprintList, useCreateSprint, useDeleteSprint } from '../../api/sprints';
import { useProjectList } from '../../api/projects';
import { applyServerErrors } from '../../lib/formErrors';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { CardListSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useConfirm } from '@/components/ui/confirm-dialog';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn, stripHtml } from '@/lib/utils';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { formatDate, toIsoDate } from '../../lib/dates';
import type { SprintDto, SprintStatus } from '../../types/api';

const COMPLETED_CAP = 6;

const STATUS_VARIANT: Record<SprintStatus, 'green' | 'gray' | 'blue'> = {
  Planning: 'blue', Active: 'green', Completed: 'gray',
};
const STATUS_ICON_BG: Record<SprintStatus, string> = {
  Planning:  'bg-primary/10',
  Active:    'bg-emerald-50 dark:bg-emerald-950/40',
  Completed: 'bg-muted',
};
const STATUS_ICON_COLOR: Record<SprintStatus, string> = {
  Planning:  'text-primary',
  Active:    'text-emerald-600 dark:text-emerald-400',
  Completed: 'text-muted-foreground',
};

// Returns the coming Monday's date as YYYY-MM-DD (today if today is Monday)
function comingMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const toMon = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  d.setDate(d.getDate() + toMon);
  return toIsoDate(d);
}

function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

function sprintDuration(start: string, end: string): string | null {
  if (!start || !end) return null;
  const s = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  if (e <= s) return null;
  const calDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  let wdCount = 0;
  const cur = new Date(s);
  while (cur <= e) { if (cur.getDay() !== 0 && cur.getDay() !== 6) wdCount++; cur.setDate(cur.getDate() + 1); }
  return `${calDays} days · ${wdCount} working days`;
}

interface CreateForm {
  projectId: string; name: string; goal: string; startDate: string; endDate: string;
}

function SprintCard({ sprint, canDelete, onDelete }: {
  sprint: SprintDto; canDelete: boolean;
  onDelete: (id: string, name: string) => void;
}) {
  return (
    <Card className="flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md">
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', STATUS_ICON_BG[sprint.status])}>
            <Zap className={cn('h-5 w-5', STATUS_ICON_COLOR[sprint.status])} />
          </div>
          <Badge label={sprint.status} variant={STATUS_VARIANT[sprint.status]} />
        </div>

        <Link
          to={`/sprints/${sprint.id}`}
          className="font-semibold text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {sprint.name}
        </Link>
        {sprint.goal && (
          <p className="mt-1.5 text-sm text-muted-foreground/70 line-clamp-2">{stripHtml(sprint.goal)}</p>
        )}

        <p className="mt-auto pt-4 text-xs text-muted-foreground">
          {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
        </p>
      </div>

      <div className="flex items-center border-t border-border px-4 py-2.5">
        <div className="ml-auto">
          {canDelete && sprint.status === 'Planning' && (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              onClick={() => onDelete(sprint.id, sprint.name)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function SprintsPage() {
  const { allow } = useAuth();
  const [filters, setFilter, , clearFilters] = useUrlFilters({ projectFilter: '' });
  const { projectFilter } = filters;
  const hasFilters = !!projectFilter;
  const [showCreate, setShowCreate] = useState(false);
  const [expandedCompleted, setExpandedCompleted] = useState<Set<string>>(new Set());
  const { confirm, dialog } = useConfirm();

  const { data: sprints, isLoading, error, refetch } = useSprintList(undefined, projectFilter || undefined);
  const { data: allProjects } = useProjectList();
  const createSprint = useCreateSprint();

  // Only projects that have an owner team can host a sprint, and only ones the viewer can open
  const sprintableProjects = (allProjects ?? []).filter((p) => p.isActive && !!p.ownerTeamId && p.canAccess);
  const deleteSprint = useDeleteSprint();

  const handleDelete = async (id: string, name: string) => {
    if (!await confirm({
      title: `Delete "${name}"?`,
      description: 'This sprint will be permanently deleted.',
      confirmLabel: 'Delete',
    })) return;
    deleteSprint.mutate(id, {
      onSuccess: () => toast.success('Sprint deleted.'),
      onError:   (e) => toast.error(e instanceof Error ? e.message : 'Failed to delete sprint.'),
    });
  };

  const defaultStart = comingMonday();
  const { register, handleSubmit, setError, reset, control, setValue, formState: { errors } } = useForm<CreateForm>({
    defaultValues: { startDate: defaultStart, endDate: addDays(defaultStart, 11) },
  });

  const watchedStart = useWatch({ control, name: 'startDate' });
  const watchedEnd   = useWatch({ control, name: 'endDate' });
  const duration     = sprintDuration(watchedStart, watchedEnd);

  useEffect(() => {
    if (watchedStart) setValue('endDate', addDays(watchedStart, 11));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedStart]);

  const onSubmit = handleSubmit((values) => {
    createSprint.mutate(
      { projectId: values.projectId, name: values.name, goal: values.goal || undefined, startDate: values.startDate, endDate: values.endDate },
      {
        onSuccess: () => { toast.success('Sprint created.'); reset({ startDate: comingMonday(), endDate: addDays(comingMonday(), 11) }); setShowCreate(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  // Group sprints by project — sprints predating this field, or created without a project, land in "No project".
  const projectGroups = useMemo(() => {
    const map = new Map<string, { projectId: string | null; projectName: string; sprints: SprintDto[] }>();
    for (const s of sprints ?? []) {
      const key = s.projectId ?? '__none__';
      if (!map.has(key)) map.set(key, { projectId: s.projectId, projectName: s.projectName ?? 'No project', sprints: [] });
      map.get(key)!.sprints.push(s);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.projectId === null) return 1;
      if (b.projectId === null) return -1;
      return a.projectName.localeCompare(b.projectName);
    });
  }, [sprints]);

  if (isLoading) return <CardListSkeleton count={6} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Sprints"
        actions={
          allow('sprint-creator-or-above') ? (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>New sprint</Button>
          ) : undefined
        }
      />

      <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
        <FilterBar.Item label="Project">
          <SearchableSelect
            value={projectFilter}
            onChange={(v) => setFilter('projectFilter', v)}
            placeholder="All"
            emptyLabel="No matching projects"
            options={[
              { value: '', label: 'All' },
              ...sprintableProjects.map((p) => ({ value: p.id, label: p.name })),
            ]}
            className="w-48"
          />
        </FilterBar.Item>
      </FilterBar>

      {showCreate && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">New sprint</p>
          </div>
          <form onSubmit={onSubmit}>
            <div className="space-y-3 px-5 py-4">
              <div className="space-y-1.5">
                <Label>Project <span className="text-destructive">*</span></Label>
                <Controller
                  name="projectId"
                  control={control}
                  rules={{ required: 'Project is required' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search projects…"
                      emptyLabel="No matching projects"
                      options={sprintableProjects.map((p) => ({ value: p.id, label: p.name }))}
                    />
                  )}
                />
                {errors.projectId && <p className="text-xs text-destructive">{errors.projectId.message}</p>}
                {sprintableProjects.length === 0 && (
                  <p className="text-xs text-muted-foreground">No projects with an assigned team found. Assign a team to a project first.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input {...register('name', { required: 'Name is required' })} placeholder="e.g. Sprint 12" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Goal</Label>
                <Controller
                  name="goal"
                  control={control}
                  render={({ field }) => <RichTextEditor value={field.value ?? ''} onChange={field.onChange} />}
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5 border-y border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
                <CalendarDays className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Dates</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Start date <span className="text-destructive">*</span></Label>
                  <Input type="date" {...register('startDate', { required: 'Start date is required' })} />
                  {errors.startDate && <p className="text-xs text-destructive">{errors.startDate.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>End date <span className="text-destructive">*</span></Label>
                  <Input type="date" {...register('endDate', { required: 'End date is required' })} />
                  {errors.endDate && <p className="text-xs text-destructive">{errors.endDate.message}</p>}
                </div>
              </div>
              {duration && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {duration}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-2.5">
              {errors.root && (
                <p className="text-sm text-destructive">{errors.root.message}</p>
              )}
              <div className="flex gap-2">
                <Button size="sm" type="submit" loading={createSprint.isPending}>Create</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => { setShowCreate(false); reset({ startDate: comingMonday(), endDate: addDays(comingMonday(), 11) }); }}>Cancel</Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {sprints?.length === 0 ? (
        <EmptyState icon={Zap} title="No sprints yet" description="Create a sprint to start tracking team velocity." />
      ) : (
        projectGroups.map((group, i) => {
          const active      = group.sprints.filter((s) => s.status !== 'Completed');
          const completed   = group.sprints.filter((s) => s.status === 'Completed');
          const groupKey    = group.projectId ?? '__none__';
          const isExpanded  = expandedCompleted.has(groupKey);
          const visibleCompleted = isExpanded ? completed : completed.slice(0, COMPLETED_CAP);
          return (
            <div key={group.projectId ?? '__none__'} className={i > 0 ? 'mt-10' : undefined}>
              <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                {group.projectId ? (
                  <Link to={`/projects/${group.projectId}`} className="text-base font-semibold text-foreground hover:text-primary">
                    {group.projectName}
                  </Link>
                ) : (
                  <h2 className="text-base font-semibold text-muted-foreground">{group.projectName}</h2>
                )}
              </div>

              {active.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map((s) => (
                    <SprintCard
                      key={s.id} sprint={s}
                      canDelete={allow('any-head')} onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}

              {completed.length > 0 && (
                <div className={active.length > 0 ? 'mt-6' : undefined}>
                  <div className="mb-3 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleCompleted.map((s) => (
                      <SprintCard
                        key={s.id} sprint={s}
                        canDelete={allow('any-head')} onDelete={handleDelete}
                      />
                    ))}
                  </div>
                  {!isExpanded && completed.length > COMPLETED_CAP && (
                    <button
                      type="button"
                      onClick={() => setExpandedCompleted((prev) => new Set(prev).add(groupKey))}
                      className="mt-3 text-xs font-medium text-primary hover:underline"
                    >
                      Show more completed sprints ({completed.length - COMPLETED_CAP} older)
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {dialog}
    </div>
  );
}
