import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowRight, CheckSquare, ChevronLeft, Layers, Pause, Zap,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useEpic, useUpdateEpic, useDeleteEpic } from '../../api/epics';
import { useAllTasks } from '../../api/tasks';
import { useSprintList } from '../../api/sprints';
import type { EpicStatus, TaskStatus } from '../../types/api';
import { DetailPageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import TaskPreviewDrawer from '../../components/tasks/TaskPreviewDrawer';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { cn } from '@/lib/utils';
import { daysLate } from '../../lib/dates';

const STATUS_VARIANT: Record<TaskStatus, 'green' | 'red' | 'gray' | 'yellow'> = {
  backlog: 'gray', active: 'green', blocked: 'red', inQa: 'gray', done: 'gray', paused: 'yellow',
};

const EPIC_STATUS_OPTIONS: { value: EpicStatus; label: string }[] = [
  { value: 'NotStarted', label: 'Not started' },
  { value: 'InProgress', label: 'In progress' },
  { value: 'Done',       label: 'Done' },
];

const EPIC_STATUS_STYLES: Record<EpicStatus, string> = {
  NotStarted: 'bg-muted text-muted-foreground',
  InProgress:  'bg-primary/10 text-primary',
  Done:        'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
};

interface EditForm { title: string; description: string; acceptanceCriteria: string; }

/** Tasks listed at first on an epic; "Show more" reveals the rest. */
const TASKS_SHOWN = 25;

export default function EpicDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allow } = useAuth();
  const isProductPm = allow('product-manager-or-above');

  const [editing, setEditing] = useState(false);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const { data: epic, isLoading, error, refetch } = useEpic(id!);
  // Every task, not just the first 100 — the totals and the list below are built from it.
  const { items: allTaskItems, isLoading: tasksLoading, truncated: tasksTruncated } = useAllTasks({ epicId: id, limit: 100 });
  const [taskLimit, setTaskLimit] = useState(TASKS_SHOWN);
  const { data: sprints } = useSprintList();
  const updateEpic = useUpdateEpic(id!, epic?.projectId ?? '');
  const deleteEpic = useDeleteEpic(epic?.projectId ?? '');

  const [selectedSprintId, setSelectedSprintId] = useState('');

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<EditForm>();

  const onEdit = handleSubmit((values) => {
    updateEpic.mutate(
      { title: values.title, description: values.description || undefined, acceptanceCriteria: values.acceptanceCriteria || undefined },
      {
        onSuccess: () => { toast.success('Epic updated.'); setEditing(false); },
        onError:   () => toast.error('Failed to update epic.'),
      },
    );
  });

  const onStatusChange = (status: EpicStatus) => {
    updateEpic.mutate({ status }, {
      onSuccess: () => toast.success('Status updated.'),
      onError:   () => toast.error('Failed to update status.'),
    });
  };

  const onAssignSprint = () => {
    if (!selectedSprintId) return;
    updateEpic.mutate({ sprintId: selectedSprintId }, {
      onSuccess: () => { toast.success('Epic added to sprint.'); setSelectedSprintId(''); },
      onError:   () => toast.error('Failed to assign sprint.'),
    });
  };

  const onRemoveSprint = () => {
    updateEpic.mutate({ removeFromSprint: true }, {
      onSuccess: () => toast.success('Epic removed from sprint.'),
      onError:   () => toast.error('Failed to remove from sprint.'),
    });
  };

  const onDelete = async () => {
    if (!await confirm({
      title: `Delete "${epic?.title}"?`,
      description: 'Tasks in this epic will lose their epic association.',
      confirmLabel: 'Delete',
    })) return;
    deleteEpic.mutate(id!, {
      onSuccess: () => { toast.success('Epic deleted.'); navigate(`/projects/${epic?.projectId}`); },
    });
  };

  if (isLoading) return <DetailPageSkeleton maxW="3xl" />;
  if (error || !epic) return <ErrorState error={error} onRetry={refetch} />;

  const taskItems = allTaskItems;
  const taskCounts = {
    total:   taskItems.length,
    done:    taskItems.filter((t) => t.status === 'done').length,
    blocked: taskItems.filter((t) => t.status === 'blocked').length,
  };

  return (
    <div className="max-w-3xl">
      {dialog}
      <Link
        to={`/projects/${epic.projectId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> Back to project
      </Link>

      <PageHeader
        breadcrumbs={[{ label: 'Projects', href: '/projects' }, { label: 'Project', href: `/projects/${epic.projectId}` }]}
        title={epic.title}
        actions={
          isProductPm ? (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost"
                onClick={() => { setEditing((v) => !v); reset({ title: epic.title, description: epic.description ?? '', acceptanceCriteria: epic.acceptanceCriteria ?? '' }); }}>
                {editing ? 'Cancel' : 'Edit'}
              </Button>
              <Button size="sm" variant="ghost" onClick={onDelete} loading={deleteEpic.isPending}>Delete</Button>
            </div>
          ) : undefined
        }
      />

      {/* Meta card */}
      {!editing && (
        <Card className="mb-6 overflow-hidden border-l-4 border-l-violet-400">
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', EPIC_STATUS_STYLES[epic.status])}>
                {EPIC_STATUS_OPTIONS.find((o) => o.value === epic.status)?.label}
              </span>
            </div>
            {taskCounts.total > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {taskCounts.done} of {taskCounts.total} tasks done
                    {taskCounts.blocked > 0 && (
                      <span className="ml-2 text-destructive">· {taskCounts.blocked} blocked</span>
                    )}
                  </span>
                  <span className="text-xs font-medium text-foreground">
                    {Math.round((taskCounts.done / taskCounts.total) * 100)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', taskCounts.done === taskCounts.total ? 'bg-emerald-500' : 'bg-primary')}
                    style={{ width: `${Math.round((taskCounts.done / taskCounts.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
            {epic.description && <RichTextContent html={epic.description} className="text-muted-foreground" />}
            {epic.acceptanceCriteria && (
              <div className="mt-3 rounded-md border border-border bg-muted/30 px-3 py-2">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acceptance criteria</p>
                <RichTextContent html={epic.acceptanceCriteria} />
              </div>
            )}

            {isProductPm && (
              <div className="mt-4 flex flex-wrap gap-2">
                {EPIC_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onStatusChange(opt.value)}
                    disabled={epic.status === opt.value || updateEpic.isPending}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      epic.status === opt.value
                        ? EPIC_STATUS_STYLES[opt.value]
                        : 'bg-muted text-muted-foreground hover:bg-muted/80',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {/* Sprint assignment */}
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <p className="text-xs font-semibold text-foreground">Sprint</p>
              </div>
              {epic.sprintId ? (
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {sprints?.find((s) => s.id === epic.sprintId)?.name ?? 'Sprint'}
                  </span>
                  {isProductPm && (
                    <button
                      onClick={onRemoveSprint}
                      disabled={updateEpic.isPending}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Not assigned to a sprint (backlog)</p>
              )}

              {isProductPm && !epic.sprintId && (
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={selectedSprintId}
                    onChange={(e) => setSelectedSprintId(e.target.value)}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Select a sprint…</option>
                    {(sprints ?? [])
                      .filter((s) => s.status === 'Planning' || s.status === 'Active')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.status})
                        </option>
                      ))}
                  </select>
                  <Button size="sm" onClick={onAssignSprint} disabled={!selectedSprintId} loading={updateEpic.isPending}>
                    Assign
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
              <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Edit epic</p>
          </div>
          <form onSubmit={onEdit}>
            <div className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input {...register('title', { required: 'Title is required' })} />
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
              <div className="space-y-1.5">
                <Label>Acceptance criteria</Label>
                <Controller
                  name="acceptanceCriteria"
                  control={control}
                  render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
                />
              </div>
            </div>
            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" type="submit" loading={updateEpic.isPending}>Save</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tasks */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <CheckSquare className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Tasks</p>
          {taskCounts.total > 0 && (
            <span className="ml-auto text-xs text-muted-foreground">{taskCounts.total} total</span>
          )}
        </div>

        {tasksLoading ? (
          <CardContent className="p-4"><Skeleton className="h-24 w-full" /></CardContent>
        ) : taskItems.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks yet"
            description="Tasks assigned to this epic will appear here." />
        ) : (
          <div className="divide-y divide-border">
            {taskItems.slice(0, taskLimit).map((task) => {
              const days = daysLate(task);
              return (
                <div
                  key={task.id}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                  onClick={() => setPreviewTaskId(task.id)}
                >
                  {task.status === 'blocked' ? (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                  ) : task.status === 'done' ? (
                    <div className="h-4 w-4 shrink-0 rounded-full border-2 border-emerald-500 bg-emerald-100 dark:bg-emerald-900" />
                  ) : task.status === 'paused' ? (
                    <Pause className="h-4 w-4 shrink-0 text-yellow-600" />
                  ) : (
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <p className={cn(
                    'flex-1 text-sm',
                    task.status === 'done' ? 'text-muted-foreground line-through' : 'font-medium text-foreground',
                  )}>
                    {task.taskKey && <span className="font-mono text-xs text-muted-foreground">{task.taskKey} </span>}
                    {task.title}
                  </p>
                  <span className="shrink-0 text-xs text-muted-foreground">{task.points} pts</span>
                  <span className={cn(
                    'shrink-0 text-xs',
                    days === null ? 'text-muted-foreground' : days < 0 ? 'font-medium text-destructive' : days <= 3 ? 'text-yellow-600' : 'text-muted-foreground',
                  )}>
                    {days === null ? 'Unscheduled' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d left`}
                  </span>
                  <Badge label={task.status} variant={STATUS_VARIANT[task.status]} />
                </div>
              );
            })}
            {taskItems.length > taskLimit && (
              <button
                type="button"
                onClick={() => setTaskLimit((n) => n + TASKS_SHOWN)}
                className="block w-full px-5 py-2.5 text-left text-xs font-medium text-primary hover:bg-muted/40"
              >
                Show {Math.min(TASKS_SHOWN, taskItems.length - taskLimit)} more ({taskItems.length - taskLimit} not shown)
              </button>
            )}
            {tasksTruncated && (
              <p className="px-5 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                This epic has more tasks than can be loaded here, so the totals above are incomplete.
              </p>
            )}
          </div>
        )}
      </Card>

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}
