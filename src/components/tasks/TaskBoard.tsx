import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { Link2 } from 'lucide-react';
import { useBoardStatusChange, useTaskMentionCandidates } from '@/api/tasks';
import { ApiError } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { formatDate, daysLate } from '@/lib/dates';
import { formatPtsDays } from '@/lib/points';
import { backlogExitHint } from '@/lib/taskStatus';
import PriorityBadge from './PriorityBadge';
import Button from '@/components/ui/Button';
import HelpTooltip from '@/components/ui/HelpTooltip';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import MentionTextarea from '@/components/ui/MentionTextarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { TaskDto, EngineerDto } from '@/types/api';

export type TaskColumn = 'todo' | 'active' | 'inQa' | 'blocked' | 'done';
const COLUMNS: TaskColumn[] = ['todo', 'active', 'blocked', 'inQa', 'done'];
const COLUMN_LABEL: Record<TaskColumn, string> = { todo: 'To Do', active: 'Active', inQa: 'In QA', blocked: 'Blocked', done: 'Done' };
// A flat, neutral surface for every column — status used to live in a per-column tint, which read
// as five different backgrounds fighting for attention. It now lives in the header dot below and
// each card's own left-edge accent, so the column shell itself stays quiet.
const COLUMN_SURFACE_CLS = 'bg-muted/30 border-border';
// The header dot carries the status color the tinted background used to.
const COLUMN_DOT_CLS: Record<TaskColumn, string> = {
  todo:    'bg-slate-400 dark:bg-slate-500',
  active:  'bg-blue-500 dark:bg-blue-400',
  blocked: 'bg-red-500 dark:bg-red-400',
  inQa:    'bg-purple-500 dark:bg-purple-400',
  done:    'bg-emerald-500 dark:bg-emerald-400',
};
// To Do is read-only: a sprint-committed Backlog task is there because it's missing points or an
// assignee (a task can't stay Backlog once it has both — PromoteFromBacklogIfGroomed activates it
// automatically), and there's no single drag gesture that fixes either — you set them from the
// task detail page like any other edit, same as before this column existed.
const READ_ONLY_COLUMNS = new Set<TaskColumn>(['todo', 'done']);

// A QA sub-task ("[QA] ...", status Active, ParentTaskId set) represents the same unit of work
// as its parent — showing both as separate cards would double-count it. So it appears in its
// own In QA column while under review, and vanishes from the board entirely once resolved
// (accepted or rejected): the outcome is already reflected by the parent's own status.
const isQaSubtask = (t: TaskDto) => !!t.parentTaskId;

const TYPE_CLS: Record<string, string> = {
  feature: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  bug:     'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  test:    'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400',
  review:  'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  chore:   'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const SEVERITY_CLS: Record<string, string> = {
  Critical: 'bg-red-500 text-white',
  High:     'bg-orange-400 text-white',
  Medium:   'bg-amber-400 text-white',
  Low:      'bg-slate-400 text-white',
};

// Left-edge accent so a card's priority reads at a glance without parsing the badge text.
// Severity (a bug's own risk rating) takes precedence over the coarser type-based color.
const SEVERITY_BORDER_CLS: Record<string, string> = {
  Critical: 'border-l-red-500',
  High:     'border-l-orange-400',
  Medium:   'border-l-amber-400',
  Low:      'border-l-slate-400',
};
const TYPE_BORDER_CLS: Record<string, string> = {
  feature: 'border-l-blue-400',
  bug:     'border-l-red-400',
  test:    'border-l-purple-400',
  review:  'border-l-amber-400',
  chore:   'border-l-gray-300 dark:border-l-gray-600',
};

// 1 (lowest) to 5 (highest), applies to every task type — the deliberate universal urgency
// signal, so it outranks Severity (bug-only) and Type for the card's left-edge accent.
// (Badge coloring itself now lives in PriorityBadge, alongside its shared label + tooltip.)
const PRIORITY_BORDER_CLS: Record<number, string> = {
  5: 'border-l-red-500',
  4: 'border-l-orange-400',
  3: 'border-l-amber-400',
  2: 'border-l-blue-400',
  1: 'border-l-slate-400',
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

// A task's own status doesn't map 1:1 to a column once QA sub-tasks are in play. A sub-task
// sits in Backlog if SendToQa couldn't find a matching QA engineer to auto-assign it (a real,
// already-supported case — the original assignee can still accept their own unassigned QA
// task), or Active once someone is assigned; either way it belongs in In QA, not Active. A
// regular (non-subtask) task in Backlog is sprint-committed work that hasn't started yet — shown
// in To Do rather than left off the board entirely.
function columnOf(t: TaskDto): TaskColumn | null {
  if (isQaSubtask(t)) {
    if (t.status === 'blocked') return 'blocked';
    return t.status === 'active' || t.status === 'backlog' ? 'inQa' : null; // done: off-board
  }
  if (t.status === 'blocked') return 'blocked';
  if (t.status === 'done')    return 'done';
  if (t.status === 'active')  return 'active';
  if (t.status === 'backlog') return 'todo';
  return null; // paused, or a parent task sitting at InQa — not shown on this board
}

interface BlockerForm { reason: string; }

function TaskCard({ task, onDragStart, isDragging, baselineMap, onOpenTask, parentTask }: {
  task: TaskDto;
  onDragStart: (taskId: string) => void;
  isDragging: boolean;
  baselineMap: Map<string, Pick<EngineerDto, 'baselinePoints' | 'baselineCycleDays'>>;
  onOpenTask: (taskId: string) => void;
  // The feature task this QA sub-task was raised against — still its own row in the sprint's
  // task count (see columnOf's "vanishes... represented by its sub-task" note), just not its own
  // card. Folded in here instead, so the sprint's full task count stays visible on the board.
  parentTask?: TaskDto;
}) {
  // Prefer the task's own denormalized assigneeName over engineerMap — engineerMap comes from
  // GET /engineers, which is role-scoped (department, or 403 outright for a plain
  // Engineer/Designer), so it silently dropped the avatar/name for exactly the viewers most
  // likely to be looking at their own board. ListTasksQuery already resolves this reliably for
  // every caller (see its own doc comment on ToDtosAsync).
  const assigneeName = task.assigneeName;
  const daysEst = formatPtsDays(task.points, task.assigneeId ? baselineMap.get(task.assigneeId) : undefined);
  const isDone = task.status === 'done';
  const column = columnOf(task);
  const isReadOnly = column !== null && READ_ONLY_COLUMNS.has(column);

  // daysLate already excludes Backlog (the backend's own escalation pipeline never fires for one
  // regardless of due date) and freezes at sentToQaAt once a task reaches QA, so an In QA card
  // sitting past its due date isn't shown as overdue when the handoff itself was on time.
  const daysLeft = daysLate(task);
  const isOverdue = !isDone && daysLeft !== null && daysLeft < 0;
  const isDueSoon = !isDone && daysLeft !== null && daysLeft >= 0 && daysLeft <= 2;

  const accentCls = task.priority ? PRIORITY_BORDER_CLS[task.priority]
    : task.severity ? SEVERITY_BORDER_CLS[task.severity] : TYPE_BORDER_CLS[task.taskType];

  return (
    <div
      draggable={!isReadOnly}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(task.id); }}
      className={cn(
        'rounded-md border border-l-[3px] border-border bg-card p-2.5 text-sm transition-all',
        accentCls ?? 'border-l-border',
        isReadOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing',
        isDragging ? 'opacity-40 scale-95' : 'hover:shadow-md',
      )}
    >
      <div
        role="button"
        tabIndex={0}
        className="block cursor-pointer"
        onClick={(e) => { e.stopPropagation(); onOpenTask(task.id); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onOpenTask(task.id); } }}
      >
        {/* Type + severity + priority badges */}
        <div className="mb-1 flex flex-wrap items-center gap-1">
          <span className={cn(
            'rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
            TYPE_CLS[task.taskType] ?? 'bg-muted text-muted-foreground',
          )}>
            {task.taskType}
          </span>
          {task.severity && (
            <span className={cn(
              'rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
              SEVERITY_CLS[task.severity] ?? 'bg-muted text-muted-foreground',
            )}>
              {task.severity}
            </span>
          )}
          <PriorityBadge priority={task.priority} size="compact" />
          {task.requiresFrontendHandoff && task.status !== 'done' && (
            <span className="rounded bg-sky-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-950/40 dark:text-sky-400">
              In: {task.currentStage === 'frontend' ? 'Frontend' : 'Backend'}
            </span>
          )}
          {task.pendingPrApprovalRequestedAt && (
            <span className="rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              PR pending
            </span>
          )}
          {task.status === 'backlog' && (
            <span onClick={(e) => e.stopPropagation()}>
              <HelpTooltip title="How to get out of Backlog" body={backlogExitHint(!!task.assigneeId, task.points)} />
            </span>
          )}
        </div>

        {/* Title */}
        {task.taskKey && (
          <p className="font-mono text-[10px] font-medium text-muted-foreground">{task.taskKey}</p>
        )}
        <p className="text-[13px] font-medium text-foreground leading-snug">{task.title}</p>

        {/* Checklist subtask progress */}
        {!!task.subtasksTotal && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {task.subtasksDone}/{task.subtasksTotal} subtasks
          </p>
        )}

        {/* Blocker reason */}
        {task.blockerReason && (
          <p className="mt-0.5 text-[11px] text-destructive line-clamp-1">{task.blockerReason}</p>
        )}

        {/* Returned from QA — task.reactivationReason is only ever set by a rejection, and is
            cleared again on acceptance, so this only shows for a task genuinely sent back. */}
        {task.reactivationReason && (
          <p className="mt-0.5 text-[11px] text-amber-600 dark:text-amber-400 line-clamp-1">
            Returned from QA: {task.reactivationReason}
          </p>
        )}

        {/* Folded-in parent feature task — see parentTask prop note above. Given a distinct
            dashed-border treatment (not just muted text) so it reads as "this card also stands
            in for another linked task", not as incidental metadata. */}
        {parentTask && (
          <div className="mt-1.5 flex items-center gap-1.5 rounded border border-dashed border-blue-200 bg-blue-50/60 px-1.5 py-1 text-[10.5px] text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400">
            <Link2 className="h-3 w-3 shrink-0" />
            <span>Feature task · <strong className="font-semibold">{parentTask.points} pts</strong></span>
            {parentTask.severity && <span className="ml-auto font-medium">{parentTask.severity}</span>}
          </div>
        )}

        {/* Footer: pts + due + assignee — "Review" prefix on a QA sub-task disambiguates its own
            points from the parent feature's points shown just above in the folded-in chip; without
            it, two bare "N pts" on the same card read as if one of them must be a mistake. */}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            {parentTask && 'Review · '}{task.points} pts{daysEst ? ` · ${daysEst}` : ''} ·{' '}
            <span className={cn(
              isOverdue && 'font-medium text-destructive',
              isDueSoon && 'font-medium text-amber-600 dark:text-amber-400',
            )}>
              {formatDate(task.dueDate)}
            </span>
          </span>
          {assigneeName && (
            <Avatar className="h-4 w-4 shrink-0" title={assigneeName}>
              <AvatarFallback className="text-[8px]">{initials(assigneeName)}</AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TaskBoard({ tasks, engineers, onOpenTask }: {
  tasks: TaskDto[];
  engineers: EngineerDto[] | undefined;
  onOpenTask: (id: string) => void;
}) {
  const [dragTaskId,    setDragTaskId]    = useState<string | null>(null);
  const [dragOverCol,   setDragOverCol]   = useState<TaskColumn | null>(null);
  const [blockerTaskId, setBlockerTaskId] = useState<string | null>(null);
  const [rejectTaskId,  setRejectTaskId]  = useState<string | null>(null);

  // Not the `engineers` prop (GET /engineers) — that's role-scoped and 403s outright for a plain
  // Engineer/Designer (see the comment on TaskCard's assigneeName below for the same gotcha hit
  // once already), so it silently left them with no one to @mention here. This is the same
  // task-scoped, access-policy-based endpoint TaskDetailPage's comment box already uses.
  const { data: blockerMentionCandidates } = useTaskMentionCandidates(blockerTaskId ?? '');

  const statusChange = useBoardStatusChange();
  const blockerForm  = useForm<BlockerForm>();
  const rejectForm   = useForm<BlockerForm>();

  const baselineMap = useMemo(
    () => new Map((engineers ?? []).map((e) => [e.id, { baselinePoints: e.baselinePoints, baselineCycleDays: e.baselineCycleDays }])),
    [engineers],
  );

  // Parent tasks are fetched alongside their QA sub-tasks (same sprint), just not rendered as
  // their own card — this is how TaskCard finds the parent to fold in.
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const tasksByStatus = (col: TaskColumn): TaskDto[] =>
    tasks.filter((t) => columnOf(t) === col);

  // The global mutation error handler (queryClient.ts) already toasts 403/404/5xx — this only
  // needs to cover BUSINESS_RULE_VIOLATION (422), which that handler deliberately skips.
  const reportBoardError = (e: unknown) => {
    if (e instanceof ApiError && e.code === 'BUSINESS_RULE_VIOLATION') toast.error(e.message);
  };

  const handleDrop = (col: TaskColumn) => {
    if (!dragTaskId) { setDragOverCol(null); return; }
    const task = tasks.find((t) => t.id === dragTaskId);
    const taskId = dragTaskId;
    setDragTaskId(null);
    setDragOverCol(null);
    if (!task || columnOf(task) === col) return;

    // To Do is read-only — nothing dragged there has a single action that makes sense (see
    // READ_ONLY_COLUMNS), and no card is draggable *from* it either, so this only guards against
    // dropping something else onto it.
    if (col === 'todo') return;

    if (col === 'blocked') {
      blockerForm.reset();
      setBlockerTaskId(taskId);
      return;
    }

    // A QA card dropped back onto Active is a rejection — it needs a reason, same as Blocked.
    if (col === 'active' && columnOf(task) === 'inQa') {
      rejectForm.reset();
      setRejectTaskId(taskId);
      return;
    }

    const action = col === 'done' ? 'mark-done' : col === 'inQa' ? 'send-to-qa' : 'clear-blocker';
    statusChange.mutate({ taskId, action }, { onError: reportBoardError });
  };

  const handleFlagBlocker = blockerForm.handleSubmit((values) => {
    if (!blockerTaskId) return;
    statusChange.mutate(
      { taskId: blockerTaskId, action: 'flag-blocker-with-reason', reason: values.reason },
      {
        onSuccess: () => setBlockerTaskId(null),
        onError: reportBoardError,
      },
    );
  });

  const handleRejectQa = rejectForm.handleSubmit((values) => {
    if (!rejectTaskId) return;
    statusChange.mutate(
      { taskId: rejectTaskId, action: 'reject-qa-with-reason', reason: values.reason },
      {
        onSuccess: () => {
          setRejectTaskId(null);
          toast.info('Rejection proposed — the task stays in QA until confirmed or withdrawn.');
        },
        onError: reportBoardError,
      },
    );
  });

  return (
    <>
      <div
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        onDragEnd={() => { setDragTaskId(null); setDragOverCol(null); }}
      >
        {COLUMNS.map((col) => (
          <div
            key={col}
            className={cn(
              'rounded-lg border p-2.5 transition-colors',
              COLUMN_SURFACE_CLS,
              dragOverCol === col && 'ring-2 ring-primary/40 ring-inset',
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = col === 'todo' ? 'none' : 'move';
              if (col !== 'todo') setDragOverCol(col);
            }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
            onDrop={() => handleDrop(col)}
          >
            <div className="mb-2 flex items-center gap-1.5 px-0.5">
              <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', COLUMN_DOT_CLS[col])} />
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {COLUMN_LABEL[col]}
              </p>
              <span className="ml-auto rounded-full border border-border bg-card px-1.5 py-px text-[10px] font-semibold text-foreground">
                {tasksByStatus(col).length}
              </span>
            </div>
            <div className="min-h-[3rem] max-h-[520px] space-y-1.5 overflow-y-auto pr-0.5">
              {tasksByStatus(col).map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  onDragStart={setDragTaskId}
                  isDragging={dragTaskId === t.id}
                  baselineMap={baselineMap}
                  onOpenTask={onOpenTask}
                  parentTask={t.parentTaskId ? taskMap.get(t.parentTaskId) : undefined}
                />
              ))}
              {tasksByStatus(col).length === 0 && (
                <p className={cn(
                  'py-4 text-center text-xs transition-colors',
                  dragOverCol === col ? 'text-primary/60' : 'text-muted-foreground/60',
                )}>
                  {dragOverCol === col ? 'Drop here' : 'None'}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!blockerTaskId} onOpenChange={(v) => !v && setBlockerTaskId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Flag a blocker</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFlagBlocker} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="board-blocker-reason">Reason</Label>
              <Controller
                name="reason"
                control={blockerForm.control}
                rules={{ required: 'Reason is required' }}
                render={({ field }) => (
                  <MentionTextarea
                    id="board-blocker-reason" rows={3} placeholder="Describe what is blocking progress… (@ to mention someone)"
                    value={field.value ?? ''} onChange={field.onChange} engineers={blockerMentionCandidates}
                  />
                )}
              />
              {blockerForm.formState.errors.reason && (
                <p className="text-xs text-destructive">{blockerForm.formState.errors.reason.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button size="sm" variant="ghost" type="button" onClick={() => setBlockerTaskId(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={statusChange.isPending}>Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTaskId} onOpenChange={(v) => !v && setRejectTaskId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Propose rejection</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRejectQa} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              The task stays in QA and won't move here — the assignee can respond before you confirm or withdraw this from the task page.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="board-reject-reason">Concern</Label>
              <Textarea id="board-reject-reason" rows={3} placeholder="Describe what needs to be fixed…"
                {...rejectForm.register('reason', { required: 'Reason is required' })} />
              {rejectForm.formState.errors.reason && (
                <p className="text-xs text-destructive">{rejectForm.formState.errors.reason.message}</p>
              )}
            </div>
            <DialogFooter>
              <Button size="sm" variant="ghost" type="button" onClick={() => setRejectTaskId(null)}>Cancel</Button>
              <Button size="sm" type="submit" loading={statusChange.isPending}>Submit</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
