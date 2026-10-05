import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, Title as ChartTitle, Tooltip as ChartTooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../../hooks/useAuth';
import { useSprint, useUpdateSprint, useSprintVelocity, useSprintBurndown, useSprintRetro, useUpsertRetro } from '../../api/sprints';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ChartTitle, ChartTooltip, Legend, Filler);
import { useTaskList } from '../../api/tasks';
import { useEngineerList } from '../../api/engineers';
import TaskBoard from '../../components/tasks/TaskBoard';
import { applyServerErrors } from '../../lib/formErrors';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { DetailPageSkeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import ErrorState from '../../components/ui/ErrorState';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { Bug, CalendarDays, CheckSquare2, Kanban, ListPlus, RotateCcw, TrendingUp, Zap } from 'lucide-react';
import HelpTooltip from '../../components/ui/HelpTooltip';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn, hslVar } from '@/lib/utils';
import { formatDate } from '../../lib/dates';
import type { SprintStatus } from '../../types/api';
import SprintBacklogDrawer from './SprintBacklogDrawer';
import TaskPreviewDrawer from '../../components/tasks/TaskPreviewDrawer';

const STATUS_VARIANT: Record<SprintStatus, 'green' | 'gray' | 'blue'> = {
  Planning: 'blue', Active: 'green', Completed: 'gray',
};

interface EditForm { name: string; goal: string; startDate: string; endDate: string; capacityPoints: string; showAndTellDate: string; showAndTellNotes: string; dueDateChangeReason: string; }

export default function SprintDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { allow } = useAuth();

  const { data: sprint, isLoading, error, refetch } = useSprint(id!);
  const { data: velocity }  = useSprintVelocity(id!);
  const { data: burndown }  = useSprintBurndown(id!);
  const { data: retro }     = useSprintRetro(id!);
  // The board shows every task in the sprint, unpaginated — 100 is the server's max page size,
  // comfortably above any real sprint's task count.
  const { data: tasks }     = useTaskList({ sprintId: id, limit: 100 });
  const { data: engineers } = useEngineerList();
  const updateSprint = useUpdateSprint(id!);
  const upsertRetro  = useUpsertRetro(id!);

  const [showEdit,      setShowEdit]      = useState(false);
  const [showBacklog,   setShowBacklog]   = useState(false);
  const [showInsights,  setShowInsights]  = useState(true);
  // Open by default now that Retrospective sits in the page's main content row rather than a
  // squeezed sidebar — a collapsed header-only card left a large stretch of dead space next to
  // the taller Insights card. Still collapsible for anyone who wants it out of the way.
  const [showRetro,     setShowRetro]     = useState(true);
  const [retroWentWell, setRetroWentWell] = useState('');
  const [retroNeeds,    setRetroNeeds]    = useState('');
  const [retroActions,  setRetroActions]  = useState('');
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const { register, handleSubmit, setError, reset, control, watch, formState: { errors } } = useForm<EditForm>();
  const watchedEndDate = watch('endDate');

  // Keeps the editable fields in sync with the fetched retro — needed now that the section can be
  // open before `retro` has loaded, not just when a click toggles it open.
  useEffect(() => {
    if (retro) {
      setRetroWentWell(retro.wentWell);
      setRetroNeeds(retro.needsImprovement);
      setRetroActions(retro.actionItems);
    }
  }, [retro]);

  if (isLoading)        return <DetailPageSkeleton maxW="4xl" />;
  if (error || !sprint) return <ErrorState error={error} onRetry={refetch} />;

  const canEdit    = allow('sprint-creator-or-above');
  const isPlanning = sprint.status === 'Planning';
  const isActive   = sprint.status === 'Active';

  // Days remaining (day-granularity, local midnight comparison)
  const todayMs  = new Date(new Date().toDateString()).getTime();
  const endMs    = new Date(sprint.endDate).getTime();
  const startMs  = new Date(sprint.startDate).getTime();
  const daysLeft = sprint.status !== 'Completed'
    ? Math.round((endMs - todayMs) / 86400000)
    : null;
  const totalDays   = Math.max(1, Math.round((endMs - startMs) / 86400000));
  const elapsedDays = Math.max(0, Math.min(totalDays, totalDays - (daysLeft ?? 0)));
  const timeProgress = Math.round((elapsedDays / totalDays) * 100);

  const daysLeftCls =
    daysLeft === null  ? ''
    : daysLeft <= 1    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
    : daysLeft <= 4    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';

  const handleActivate = () =>
    updateSprint.mutate({ activate: true }, {
      onSuccess: () => toast.success('Sprint activated.'),
      onError:   (e) => applyServerErrors(e, setError),
    });

  const handleComplete = async () => {
    // Completing is one-way (Sprint domain forbids reopening), so anything still open here
    // needs to be moved to another sprint by hand afterward — worth surfacing before it
    // silently becomes orphaned work nobody remembers to follow up on.
    const openTasks = (tasks?.items ?? []).filter((t) => t.status !== 'done');
    const description = openTasks.length === 0
      ? 'This cannot be undone.'
      : `This cannot be undone. ${openTasks.length} task${openTasks.length === 1 ? ' is' : 's are'} still open: `
        + openTasks.slice(0, 3).map((t) => t.taskKey ? `${t.taskKey} ${t.title}` : t.title).join(', ')
        + (openTasks.length > 3 ? `, +${openTasks.length - 3} more` : '')
        + '. They will stay in this sprint unless moved.';

    if (!await confirm({ title: 'Complete this sprint?', description, confirmLabel: 'Complete sprint' })) return;
    updateSprint.mutate({ complete: true }, {
      onSuccess: () => toast.success('Sprint completed.'),
      onError:   (e) => applyServerErrors(e, setError),
    });
  };

  // Moving the end date shifts the due date of every not-yet-done task that has one, so it needs a
  // stated reason (the API enforces the same rule).
  const tasksToShift = (tasks?.items ?? []).filter((t) => t.dueDate && t.status !== 'done').length;
  const endDateMoves = !!watchedEndDate && watchedEndDate !== sprint.endDate && tasksToShift > 0;

  const onSubmit = handleSubmit((values) => {
    if (endDateMoves && !values.dueDateChangeReason?.trim()) {
      setError('dueDateChangeReason', { message: 'A reason is required when changing the end date.' });
      return;
    }
    return updateSprint.mutate(
      {
        name: values.name, goal: values.goal || undefined,
        startDate: values.startDate, endDate: values.endDate,
        dueDateChangeReason: values.endDate !== sprint.endDate ? values.dueDateChangeReason?.trim() || undefined : undefined,
        capacityPoints: values.capacityPoints ? Number(values.capacityPoints) : undefined,
        showAndTellDate: values.showAndTellDate || undefined,
        showAndTellNotes: values.showAndTellNotes || undefined,
      },
      {
        onSuccess: () => { toast.success('Sprint updated.'); setShowEdit(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  const deliveryPct =
    velocity && velocity.plannedPoints > 0
      ? Math.round((velocity.deliveredPoints / velocity.plannedPoints) * 100)
      : null;

  // Pace signal: compares the burndown's most recent Remaining against its Ideal — a glanceable
  // "is this trending on schedule" read using data already fetched for the chart, so it costs
  // nothing extra. Held back for a sprint's first 2 days (too little signal yet to be meaningful)
  // and outside Active sprints, and null (not just "on track") means "don't show anything".
  const latestBurndown = burndown && burndown.length > 0 ? burndown[burndown.length - 1] : null;
  const paceTolerance = velocity ? Math.max(1, Math.round(velocity.plannedPoints * 0.1)) : 1;
  const isBehindPace =
    isActive && elapsedDays >= 2 && latestBurndown
      ? latestBurndown.remaining - latestBurndown.ideal > paceTolerance
      : null;

  // Bug ratio for the sprint — a quality signal (firefighting vs. building), derived client-side
  // from the same task list the board already fetches, no separate query needed. Excludes QA
  // sub-tasks (matches the backend's Velocity fix) — a bug that went through QA is one bug, not
  // two rows counted toward the denominator.
  const sprintTaskItems = (tasks?.items ?? []).filter((t) => !t.parentTaskId);
  const bugCount = sprintTaskItems.filter((t) => t.taskType === 'bug').length;
  const bugPct = sprintTaskItems.length > 0 ? Math.round((bugCount / sprintTaskItems.length) * 100) : null;

  return (
    <div>
      {dialog}
      <SprintBacklogDrawer
        open={showBacklog}
        onClose={() => setShowBacklog(false)}
        sprintId={id!}
        teamId={sprint.teamId}
      />
      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
      <PageHeader
        breadcrumbs={[{ label: 'Sprints', href: '/sprints', smart: true }]}
        title={sprint.name}
        actions={
          canEdit ? (
            <div className="flex gap-2">
              {(isPlanning || isActive) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowBacklog(true)}
                >
                  <ListPlus className="mr-1.5 h-3.5 w-3.5" />
                  Add from backlog
                </Button>
              )}
              {isPlanning && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => {
                    reset({
                      name: sprint.name, goal: sprint.goal ?? '',
                      startDate: sprint.startDate, endDate: sprint.endDate,
                      capacityPoints: sprint.capacityPoints?.toString() ?? '',
                      showAndTellDate: sprint.showAndTellDate ?? '',
                      showAndTellNotes: sprint.showAndTellNotes ?? '',
                      dueDateChangeReason: '',
                    });
                    setShowEdit((v) => !v);
                  }}>Edit</Button>
                  <Button size="sm" onClick={handleActivate} loading={updateSprint.isPending}>Activate</Button>
                </>
              )}
              {isActive && (
                <Button variant="secondary" size="sm" onClick={handleComplete} loading={updateSprint.isPending}>Complete</Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div>
        {/* Meta */}
          <Card className={cn(
            'mb-5 overflow-hidden border-l-4',
            sprint.status === 'Active'   ? 'border-l-emerald-400' :
            sprint.status === 'Planning' ? 'border-l-primary'     :
                                           'border-l-gray-300',
          )}>
            <CardContent className="p-4">
              {/* Badges row */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Badge label={sprint.status} variant={STATUS_VARIANT[sprint.status]} />
                {sprint.projectId && sprint.projectName && (
                  <Link
                    to={`/projects/${sprint.projectId}`}
                    className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    {sprint.projectName}
                  </Link>
                )}
                {sprint.teamName && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {sprint.teamName}
                  </span>
                )}
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {formatDate(sprint.startDate)} – {formatDate(sprint.endDate)}
                </span>
                {daysLeft !== null && (
                  <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', daysLeftCls)}>
                    {daysLeft > 0 ? `${daysLeft}d left` : daysLeft === 0 ? 'Last day' : 'Overdue'}
                  </span>
                )}
                {isBehindPace !== null && (
                  <span className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    isBehindPace
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
                  )}>
                    {isBehindPace ? 'Behind pace' : 'On track'}
                  </span>
                )}
              </div>

              {/* Progress + goal beside a compact glance panel — same three headline numbers as
                  the full Insights card below, minus the burndown (that needs real width to be
                  readable, so it stays in the wider card). */}
              {(isActive || sprint.goal || velocity) && (
                <div className={cn('grid gap-5', (isActive || sprint.goal) && velocity && 'lg:grid-cols-[1.6fr_1fr] lg:items-center')}>
                  {(isActive || sprint.goal) && (
                    <div className="space-y-4">
                      {isActive && (
                        <div>
                          <div className="mb-1 flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">Sprint progress</p>
                            <p className="text-xs font-medium text-foreground">{timeProgress}%</p>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-1.5 rounded-full transition-all',
                                daysLeft !== null && daysLeft <= 1 ? 'bg-destructive' : 'bg-emerald-500',
                              )}
                              style={{ width: `${timeProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {sprint.goal && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Goal</p>
                          <RichTextContent html={sprint.goal} className="mt-1" />
                        </div>
                      )}
                    </div>
                  )}

                  {velocity && (
                    <div className={cn((isActive || sprint.goal) && 'lg:border-l lg:border-border lg:pl-5')}>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Velocity</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
                            <CheckSquare2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{velocity.doneTasks}/{velocity.totalTasks}</p>
                          <p className="text-[11px] font-medium text-muted-foreground">Tasks done</p>
                        </div>
                        {deliveryPct !== null && (
                          <div>
                            <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
                              <CalendarDays className="h-3.5 w-3.5 text-amber-500" />
                            </div>
                            <p className="text-base font-bold text-amber-500">{deliveryPct}%</p>
                            <p className="text-[11px] font-medium text-muted-foreground">Delivery</p>
                          </div>
                        )}
                        {bugPct !== null && (
                          <div>
                            <div className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
                              <Bug className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                            </div>
                            <p className="text-base font-bold text-red-600 dark:text-red-400">{bugCount}/{sprintTaskItems.length}</p>
                            <p className="text-[11px] font-medium text-muted-foreground">Bug tasks ({bugPct}%)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(sprint.capacityPoints !== null || sprint.showAndTellDate) && (
                <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  {sprint.capacityPoints !== null && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Capacity budget</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{sprint.capacityPoints} pts</p>
                    </div>
                  )}
                  {sprint.showAndTellDate && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Show &amp; Tell</p>
                      <p className="mt-1 text-sm text-foreground">{sprint.showAndTellDate}</p>
                      {sprint.showAndTellNotes && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{sprint.showAndTellNotes}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit form */}
          {showEdit && (
            <Card className="mb-5 overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">Edit sprint</p>
              </div>
              <form onSubmit={onSubmit}>
                <div className="space-y-4 px-5 py-5">
                  <div className="space-y-1.5">
                    <Label>Name <span className="text-destructive">*</span></Label>
                    <Input {...register('name', { required: 'Name is required' })} />
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Start date</Label>
                      <Input type="date" {...register('startDate')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>End date</Label>
                      <Input type="date" {...register('endDate')} />
                    </div>
                  </div>
                  {endDateMoves && (
                    <div className="space-y-1.5">
                      <Label htmlFor="sprint-end-date-reason">
                        Reason for changing the end date <span className="text-destructive">*</span>
                      </Label>
                      <Textarea id="sprint-end-date-reason" rows={2} maxLength={500}
                        placeholder="e.g. Release moved back a week"
                        {...register('dueDateChangeReason')} />
                      <p className="text-xs text-muted-foreground">
                        This moves the due date of {tasksToShift} open task{tasksToShift === 1 ? '' : 's'}; the reason is recorded on each.
                      </p>
                      {errors.dueDateChangeReason && (
                        <p className="text-xs text-destructive">{errors.dueDateChangeReason.message}</p>
                      )}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label>Capacity (points)</Label>
                      <HelpTooltip
                        title="Sprint capacity"
                        body="The total story points the team can realistically deliver this sprint, based on available hours and individual baselines. Used to detect overcommitment on the capacity bar."
                        side="right"
                      />
                    </div>
                    <Input type="number" min={0} placeholder="e.g. 80" {...register('capacityPoints')} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Show &amp; Tell date</Label>
                      <Input type="date" {...register('showAndTellDate')} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Show &amp; Tell notes</Label>
                      <Input placeholder="e.g. Feature demo with stakeholders" {...register('showAndTellNotes')} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 border-t border-border bg-muted/30 px-4 py-2.5">
                  {errors.root && (
                    <p className="text-sm text-destructive">{errors.root.message}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" type="submit" loading={updateSprint.isPending}>Save</Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setShowEdit(false)}>Cancel</Button>
                  </div>
                </div>
              </form>
            </Card>
          )}

          {/* Task board */}
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Kanban className="h-4 w-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Tasks</h2>
          </div>
          <TaskBoard tasks={tasks?.items ?? []} engineers={engineers} onOpenTask={setPreviewTaskId} />

        {/* Insights + Retrospective sit in their own wide row below the board, instead of a
            permanent sidebar beside it — the board needs the page's full width far more than
            these two need a tall narrow column. */}
        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1.6fr_1fr]">
          {/* Insights: velocity + capacity + burndown in one card */}
          {velocity && (
            <Card className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/40"
                onClick={() => setShowInsights((v) => !v)}
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <p className="flex-1 text-sm font-semibold text-foreground">Insights</p>
                <span className="text-xs text-muted-foreground">{showInsights ? '▼' : '▲'}</span>
              </button>
              {showInsights && (
              <CardContent className="border-t border-border p-5">
                {/* Velocity's own numbers (Tasks done/Delivery/Bugs) already live beside Sprint
                    progress in the meta card above — no need to repeat them here. Burndown gets
                    the card's full width instead of sharing it with a duplicate stat column. */}
                {burndown && burndown.length > 0 ? (
                  <>
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Burndown</p>
                    <div style={{ height: 300 }}>
                      <Line
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'bottom' as const },
                            tooltip: { mode: 'index' as const, intersect: false },
                          },
                          scales: {
                            x: { grid: { display: false }, ticks: { maxTicksLimit: 6 } },
                            y: { beginAtZero: true, ticks: { precision: 0 } },
                          },
                        }}
                        data={{
                          labels: burndown.map((d) => d.date),
                          datasets: [
                            {
                              label: 'Remaining',
                              data: burndown.map((d) => d.remaining),
                              borderColor: hslVar('--primary'),
                              backgroundColor: hslVar('--primary', 0.1),
                              fill: true,
                              tension: 0.3,
                              pointRadius: 3,
                            },
                            {
                              label: 'Ideal',
                              data: burndown.map((d) => d.ideal),
                              borderColor: hslVar('--muted-foreground'),
                              borderDash: [5, 5],
                              fill: false,
                              tension: 0,
                              pointRadius: 0,
                            },
                          ],
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center text-xs text-muted-foreground">
                    No burndown data yet.
                  </div>
                )}

                {/* Capacity */}
                {sprint.capacityPoints && (
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Capacity</p>
                    {(() => {
                      const used = velocity.plannedPoints;
                      const cap  = sprint.capacityPoints!;
                      const pct  = cap > 0 ? Math.min(Math.round((used / cap) * 100), 100) : 0;
                      const over = used > cap;
                      return (
                        <>
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{used} / {cap} pts</span>
                            <span className={cn('font-semibold', over ? 'text-destructive' : 'text-foreground')}>
                              {pct}%{over ? ' over' : ''}
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div className={cn('h-2 rounded-full transition-all', over ? 'bg-destructive' : 'bg-primary')} style={{ width: `${pct}%` }} />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
              )}
            </Card>
          )}

          {/* Retrospective */}
          <Card className="overflow-hidden">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-muted/40"
              onClick={() => setShowRetro((v) => !v)}
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <RotateCcw className="h-4 w-4 text-primary" />
              </div>
              <span className="flex flex-1 items-center gap-2 text-sm font-semibold text-foreground">
                Retrospective
                {retro && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">Saved</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{showRetro ? '▼' : '▲'}</span>
            </button>

            {showRetro && (
              <div className="space-y-4 border-t border-border px-4 py-3">
                {canEdit ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>What went well?</Label>
                      <Textarea rows={3} value={retroWentWell} onChange={(e) => setRetroWentWell(e.target.value)}
                        placeholder="Celebrate successes, good practices…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>What needs improvement?</Label>
                      <Textarea rows={3} value={retroNeeds} onChange={(e) => setRetroNeeds(e.target.value)}
                        placeholder="Pain points, blockers, process gaps…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Action items</Label>
                      <Textarea rows={3} value={retroActions} onChange={(e) => setRetroActions(e.target.value)}
                        placeholder="Concrete next steps and owners…" />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => upsertRetro.mutate(
                        { wentWell: retroWentWell, needsImprovement: retroNeeds, actionItems: retroActions },
                        { onSuccess: () => toast.success('Retrospective saved.'), onError: () => toast.error('Failed to save.') },
                      )}
                      loading={upsertRetro.isPending}
                    >
                      Save retrospective
                    </Button>
                  </>
                ) : retro ? (
                  <div className="space-y-4">
                    {retro.wentWell && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What went well</p>
                        <p className="whitespace-pre-wrap text-sm text-foreground">{retro.wentWell}</p>
                      </div>
                    )}
                    {retro.needsImprovement && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs improvement</p>
                        <p className="whitespace-pre-wrap text-sm text-foreground">{retro.needsImprovement}</p>
                      </div>
                    )}
                    {retro.actionItems && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action items</p>
                        <p className="whitespace-pre-wrap text-sm text-foreground">{retro.actionItems}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No retrospective written yet.</p>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
