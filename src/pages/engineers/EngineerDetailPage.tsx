import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import { Activity, CheckSquare, Clock, History, ShieldCheck, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
  useEngineer, useUpdateEngineer,
  useEngineerSignals, useEngineerOverrides, useCreateOverride,
  useBaselineHistory, useEngineerThroughput,
} from '../../api/engineers';
import { useTeamList } from '../../api/teams';
import { useTaskList } from '../../api/tasks';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { WorkloadFigures } from '../../components/workload/WorkloadFigures';
import TaskPreviewDrawer from '../../components/tasks/TaskPreviewDrawer';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Pagination } from '../../components/ui/Pagination';
import { DetailPageSkeleton, Skeleton } from '@/components/ui/skeleton';
import ErrorState from '../../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn, hslVar } from '@/lib/utils';
import { weeklyBaselinePoints } from '../../lib/points';
import { formatDate, formatDateTime, daysLate } from '../../lib/dates';
import { STATUS_VARIANT, STATUS_LABEL } from '../../lib/taskStatus';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

const CHART_OPTIONS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: true, position: 'bottom' as const }, title: { display: false } },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
};

export default function EngineerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { allow } = useAuth();

  const { data: engineer, isLoading, error, refetch } = useEngineer(id!);
  const { data: signals }         = useEngineerSignals(id!);
  const { data: overrides }       = useEngineerOverrides(id!);
  const { data: baselineHistory } = useBaselineHistory(id!, allow('any-head') || allow('pmo-only'));
  const { data: teams }           = useTeamList();
  const [showCompletedTasks, setShowCompletedTasks] = useState(false);
  // Was a flat, unpaginated 50-item fetch — an engineer with more than 50 matching tasks had the
  // rest silently invisible here with no indication more existed, and since Active-status tasks
  // sort first, enough of those alone could push every Done task out of the window even with
  // "Show completed" on. Cursor pagination (same pattern as the Dashboard's "My tasks" widget)
  // fixes both: nothing is ever truly unreachable, just a page turn away.
  const { cursor: tasksCursor, hasPrev: tasksHasPrev, pageNumber: tasksPage, goNext: tasksGoNext, goPrev: tasksGoPrev, reset: tasksCursorReset } = useCursorPagination();
  const { data: activeTasks, isLoading: tasksLoading } = useTaskList({ assigneeId: id, excludeDone: !showCompletedTasks, limit: 50, cursor: tasksCursor });
  const { data: throughput, isLoading: throughputLoading } = useEngineerThroughput(id!);
  const updateEngineer = useUpdateEngineer(id!);
  const createOverride = useCreateOverride(id!);

  const [showBaseline, setShowBaseline] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);

  const baselineForm = useForm<{ baselinePoints: number; baselineCycleDays: number }>();
  const overrideForm = useForm<{ reason: string; expiresAt: string }>();

  if (isLoading)            return <DetailPageSkeleton maxW="3xl" />;
  if (error || !engineer)   return <ErrorState error={error} onRetry={refetch} />;

  const handleBaseline = baselineForm.handleSubmit((values) =>
    updateEngineer.mutate(
      { baselinePoints: Number(values.baselinePoints), baselineCycleDays: Number(values.baselineCycleDays) },
      { onSuccess: () => { toast.success('Baselines updated.'); setShowBaseline(false); } },
    ),
  );

  const handleOverride = overrideForm.handleSubmit((values) =>
    createOverride.mutate(
      { reason: values.reason, expiresAt: values.expiresAt || undefined },
      { onSuccess: () => { toast.success('Override granted.'); setShowOverride(false); overrideForm.reset(); } },
    ),
  );

  const chartLabels = (throughput ?? []).map((w) => {
    const d = new Date(w.weekOf);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  });
  // Baseline is stated per an arbitrary cycle length (e.g. 20 pts / 5 days) — normalize to a
  // weekly rate so it sits on the same per-week bars as delivered throughput.
  const weeklyBaseline = engineer && engineer.baselineCycleDays > 0
    ? weeklyBaselinePoints(engineer.baselinePoints, engineer.baselineCycleDays)
    : null;
  const chartData = {
    labels: chartLabels,
    datasets: [
      {
        type: 'bar' as const,
        label: 'Delivered',
        data: (throughput ?? []).map((w) => w.pointsDelivered),
        backgroundColor: 'rgb(99, 102, 241)',
        borderRadius: 4,
      },
      ...(weeklyBaseline !== null ? [{
        type: 'line' as const,
        label: 'Baseline (weekly)',
        data: chartLabels.map(() => weeklyBaseline),
        borderColor: hslVar('--muted-foreground'),
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0,
      }] : []),
    ],
  };

  const signalRows = signals ? [
    { label: 'Load vs baseline', signal: signals.loadVsBaseline },
    { label: 'Concurrent tasks', signal: signals.concurrent },
    { label: 'Stale in-progress', signal: signals.staleInProgress },
  ] : [];

  return (
    <div className="max-w-3xl">
      <PageHeader
        breadcrumbs={[{ label: 'Engineers', href: '/engineers', smart: true }]}
        title={engineer.name}
        description={engineer.email}
        actions={
          (allow('any-head') || allow('pmo-only')) ? (
            <Button size="sm" variant="secondary" onClick={() => {
              baselineForm.reset({ baselinePoints: engineer.baselinePoints, baselineCycleDays: engineer.baselineCycleDays });
              setShowBaseline((v) => !v);
            }}>
              Edit baselines
            </Button>
          ) : undefined
        }
      />

      {/* Profile */}
      <Card className={cn('mb-5 overflow-hidden border-l-4', engineer.isActive ? 'border-l-emerald-400' : 'border-l-gray-300')}>
        <CardContent className="p-4">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
              {engineer.name.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge label={engineer.isActive ? 'active' : 'inactive'} variant={engineer.isActive ? 'green' : 'gray'} />
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                {engineer.role.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Team</p>
              <p className="mt-1 font-medium text-foreground">{teams?.find((t) => t.id === engineer.teamId)?.name ?? engineer.team ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Baseline points</p>
              <p className="mt-1 font-medium text-foreground">{engineer.baselinePoints}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Baseline cycle days</p>
              <p className="mt-1 font-medium text-foreground">{engineer.baselineCycleDays}</p>
            </div>
            {signals?.workload && (
              <div className="sm:col-span-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current workload</p>
                <p className="mt-1 font-medium text-foreground">
                  <WorkloadFigures
                    activePoints={signals.workload.activePoints}
                    cyclePoints={signals.workload.cyclePoints}
                    baselinePoints={engineer.baselinePoints}
                    cycleDays={signals.workload.cycleDays}
                    overworked={signals.isOverworked && !signals.hasActiveOverride}
                  />
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active tasks */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <CheckSquare className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Active tasks</p>
          <button
            type="button"
            onClick={() => { setShowCompletedTasks((v) => !v); tasksCursorReset(); }}
            className="ml-auto text-xs text-muted-foreground hover:text-primary hover:underline"
          >
            {showCompletedTasks ? 'Hide completed' : 'Show completed'}
          </button>
        </div>
        {tasksLoading ? (
          <div className="space-y-0 divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="px-4 py-2.5"><Skeleton className="h-10 w-full" /></div>
            ))}
          </div>
        ) : (activeTasks?.items.length ?? 0) === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-muted-foreground">
            {showCompletedTasks ? 'No tasks yet.' : 'No active tasks.'}
          </p>
        ) : (
          <ul role="list" className="divide-y divide-border">
            {activeTasks!.items.map((task) => {
              const days = daysLate(task);
              const isDone = task.status === 'done';
              return (
                <li key={task.id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => setPreviewTaskId(task.id)}
                      className={cn(
                        'block w-full truncate text-left text-sm font-medium hover:text-primary',
                        isDone ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}
                    >
                      {task.taskKey && <span className="font-mono text-xs text-muted-foreground">{task.taskKey} </span>}
                      {task.title}
                    </button>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {task.projectName && <span>{task.projectName} · </span>}
                      {isDone && task.actualEndDate ? `Completed ${formatDate(task.actualEndDate)}` : `Due ${formatDate(task.dueDate)}`}
                      {!isDone && days !== null && days <= 1 && (
                        <span className="ml-1.5 font-medium text-red-600">
                          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? '· due today' : '· due tomorrow'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{task.points}pt</span>
                    <Badge label={STATUS_LABEL[task.status]} variant={STATUS_VARIANT[task.status]} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!tasksLoading && (tasksHasPrev || activeTasks?.hasMore) && (
          <div className="px-4 pb-3">
            <Pagination
              page={tasksPage}
              hasPrev={tasksHasPrev}
              hasMore={activeTasks?.hasMore ?? false}
              onPrev={tasksGoPrev}
              onNext={() => { if (activeTasks?.nextCursor) tasksGoNext(activeTasks.nextCursor); }}
            />
          </div>
        )}
      </Card>

      {/* Velocity trend */}
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Delivered points — last 6 weeks</p>
        </div>
        <CardContent className="p-4">
          {throughputLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (throughput?.length ?? 0) === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No completed tasks in this window yet.</p>
          ) : (
            <div className="h-44"><Chart type="bar" data={chartData} options={CHART_OPTIONS} /></div>
          )}
        </CardContent>
      </Card>

      {/* Baselines edit */}
      {showBaseline && (allow('any-head') || allow('pmo-only')) && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Edit baselines</p>
          </div>
          <form onSubmit={handleBaseline}>
            <div className="grid grid-cols-1 gap-4 px-5 py-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Baseline points</Label>
                <Input type="number" min={1} {...baselineForm.register('baselinePoints')} />
              </div>
              <div className="space-y-1.5">
                <Label>Baseline cycle days</Label>
                <Input type="number" min={1} {...baselineForm.register('baselineCycleDays')} />
              </div>
            </div>
            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" type="submit" loading={updateEngineer.isPending}>Save</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setShowBaseline(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Overwork signals */}
      {signals && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md',
              signals.isOverworked && !signals.hasActiveOverride ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted',
            )}>
              <Activity className={cn('h-4 w-4', signals.isOverworked && !signals.hasActiveOverride ? 'text-red-500' : 'text-muted-foreground')} />
            </div>
            <p className="text-sm font-semibold text-foreground">Overwork signals</p>
            <div className="ml-auto flex items-center gap-2">
              {signals.isOverworked && !signals.hasActiveOverride && <Badge label="overworked" variant="red" />}
              {signals.hasActiveOverride && <Badge label="override active" variant="yellow" />}
            </div>
          </div>
          <CardContent className="p-4">
            <div className="space-y-3">
              {signalRows.map(({ label, signal }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{signal.reason}</span>
                    <Badge label={signal.tripped ? 'tripped' : 'ok'} variant={signal.tripped ? 'red' : 'green'} />
                  </div>
                </div>
              ))}
            </div>
            {signals.isOverworked && (
              <div className="mt-4 border-t border-border pt-4">
                <Button size="sm" variant="secondary" onClick={() => setShowOverride((v) => !v)}>Grant override</Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Override form */}
      {showOverride && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
              <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Grant overwork override</p>
          </div>
          <form onSubmit={handleOverride}>
            <div className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <Label>Reason <span className="text-destructive">*</span></Label>
                <Textarea rows={3} {...overrideForm.register('reason', { required: 'Reason is required' })} />
                {overrideForm.formState.errors.reason && (
                  <p className="text-xs text-destructive">{overrideForm.formState.errors.reason.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Expires at <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="datetime-local" {...overrideForm.register('expiresAt')} />
              </div>
            </div>
            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" type="submit" loading={createOverride.isPending}>Grant</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setShowOverride(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Override history */}
      {overrides && overrides.length > 0 && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Override history</p>
          </div>
          <div className="divide-y divide-border">
            {overrides.map((o) => (
              <div key={o.id} className="px-5 py-4 text-sm">
                <p className="font-medium text-foreground">{o.reason}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Granted {formatDate(o.createdAt)}
                  {o.expiresAt && ` · Expires ${formatDateTime(o.expiresAt)}`}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Baseline calibration history */}
      {(allow('any-head') || allow('pmo-only')) && baselineHistory && baselineHistory.length > 0 && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
              <History className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-semibold text-foreground">Baseline calibration history</p>
          </div>
          <div className="divide-y divide-border">
            {baselineHistory.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <span className="text-xs text-muted-foreground">{formatDateTime(h.changedAt)}</span>
                <span className="text-muted-foreground">
                  {h.fromPoints} pts / {h.fromCycleDays}d
                  <span className="mx-1.5 text-muted-foreground/50">→</span>
                  <span className="font-medium text-foreground">{h.toPoints} pts / {h.toCycleDays}d</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}
