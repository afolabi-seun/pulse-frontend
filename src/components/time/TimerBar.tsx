import { useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Coffee, Play, Square } from 'lucide-react';
import { useActiveTimer, useStartTimer, useStopTimer } from '../../api/timeEntries';
import { useTaskList, useSubtasks } from '../../api/tasks';
import { useAuth } from '../../hooks/useAuth';
import { useSessionState } from '../../hooks/useSessionState';
import Button from '../ui/Button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ApiError } from '../../lib/errors';
import { cn } from '@/lib/utils';
import { useTimerElapsed } from './useTimerElapsed';
import { useIdleDetection } from './useIdleDetection';
import type { MyProjectDto, TaskDto } from '../../types/api';

const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes with no mouse/keyboard/scroll activity

// What the engineer has picked but not yet started. Kept in sessionStorage so leaving My Time for
// another module and coming back doesn't throw the selection away (the page unmounts on navigation).
interface TimerDraft {
  category: 'meeting' | 'task';
  taskSource: 'mine' | 'unclaimed';
  taskId: string;
  subtaskId: string;
  unclaimedProjectId: string;
}
const EMPTY_DRAFT: TimerDraft = { category: 'meeting', taskSource: 'mine', taskId: '', subtaskId: '', unclaimedProjectId: '' };

export default function TimerBar({ openTasks, myProjects, tasksLoaded = true }: {
  openTasks: TaskDto[]; myProjects: MyProjectDto[];
  /** False while the task list is still being fetched — a restored selection isn't validated until then. */
  tasksLoaded?: boolean;
}) {
  const { currentUser, allow } = useAuth();
  const { data: timer, isLoading } = useActiveTimer(allow('time-entry-submitter'));
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const [draft, setDraft, resetDraft] = useSessionState<TimerDraft>(
    `pulse_timer_draft_${currentUser?.id ?? 'anon'}`, EMPTY_DRAFT);
  const { category, taskSource, taskId, subtaskId, unclaimedProjectId } = draft;
  const setCategory = (c: TimerDraft['category']) => setDraft((d) => ({ ...d, category: c }));
  const setTaskSource = (s: TimerDraft['taskSource']) => setDraft((d) => ({ ...d, taskSource: s }));
  const setTaskId = (id: string) => setDraft((d) => ({ ...d, taskId: id, subtaskId: '' }));
  const setSubtaskId = (id: string) => setDraft((d) => ({ ...d, subtaskId: id }));
  const setUnclaimedProjectId = (id: string) => setDraft((d) => ({ ...d, unclaimedProjectId: id }));

  const { data: unclaimedTasks, isError: unclaimedTasksError } = useTaskList(
    { projectId: unclaimedProjectId, noAssignee: true, status: 'backlog', excludeDone: true, limit: 50 },
    taskSource === 'unclaimed' && !!unclaimedProjectId,
  );

  // A restored selection may have become unavailable while the engineer was away (task finished,
  // paused, blocked, reassigned, or claimed by someone else) — drop it rather than offer a start
  // that would fail.
  useEffect(() => {
    if (!taskId || category !== 'task') return;
    const available = taskSource === 'mine'
      ? (tasksLoaded ? openTasks.some((t) => t.id === taskId) : true)
      : (unclaimedTasks ? unclaimedTasks.items.some((t) => t.id === taskId) : true);
    if (!available) setDraft((d) => ({ ...d, taskId: '', subtaskId: '' }));
  }, [taskId, category, taskSource, tasksLoaded, openTasks, unclaimedTasks, setDraft]);

  // Loaned checklist items on the selected task that this engineer can time individually — either
  // explicitly loaned to them, or unassigned (implicitly the task's own assignee, i.e. themself,
  // since this list only appears for a task from the "My tasks" tab).
  const { data: taskSubtasks } = useSubtasks(taskSource === 'mine' ? taskId : '');
  const myLoanableSubtasks = (taskSubtasks ?? []).filter(
    (s) => !s.isDone && (s.assigneeId === null || s.assigneeId === currentUser?.id),
  );

  const { label, stale } = useTimerElapsed(timer?.startedAt);
  const { idle, resetIdle } = useIdleDetection(!!timer, IDLE_THRESHOLD_MS);

  if (isLoading) return null;

  const handleStartError = (error: unknown) => {
    const err = error as ApiError;
    if (err.code === 'FORBIDDEN') {
      toast.error(err.message || 'That task is no longer available.');
      setTaskId('');
      return;
    }
    toast.error(err.message || 'Failed to start timer.');
  };

  const handleStart = () => {
    if (category === 'task' && !taskId) return;
    startTimer.mutate(
      {
        category,
        taskId: category === 'task' ? taskId : undefined,
        subtaskId: category === 'task' && subtaskId ? subtaskId : undefined,
      },
      { onSuccess: () => resetDraft(), onError: handleStartError },
    );
  };

  const handleStop = () => {
    stopTimer.mutate(undefined, {
      onSuccess: () => toast.success('Timer stopped and logged.'),
      onError: (error) => toast.error((error as ApiError).message || 'Failed to stop timer.'),
    });
  };

  if (timer) {
    return (
      <>
        <div className={cn(
          'flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-1.5 shadow-sm',
          stale && 'border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
        )}>
          <div className="flex items-center gap-2 text-sm">
            {stale
              ? <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              : <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-primary" />}
            <span className="font-medium text-foreground">
              {timer.category === 'task' ? (timer.taskTitle ?? 'Task') : 'Meeting'}
              {timer.subtaskTitle && <span className="font-normal text-muted-foreground"> — {timer.subtaskTitle}</span>}
            </span>
            <span className={cn('font-mono tabular-nums text-muted-foreground', stale && 'font-semibold text-amber-700 dark:text-amber-400')}>
              {label}
            </span>
            {stale && <span className="text-xs text-amber-700 dark:text-amber-400">Still running — did you forget to stop it?</span>}
          </div>
          <Button size="sm" variant="secondary" onClick={handleStop} loading={stopTimer.isPending}>
            <Square className="mr-1.5 h-3 w-3" /> Stop
          </Button>
        </div>

        <Dialog open={idle} onOpenChange={(v) => { if (!v) resetIdle(); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
                  <Coffee className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <DialogTitle className="text-left">Still working?</DialogTitle>
                  <p className="mt-1.5 text-left text-sm text-muted-foreground">
                    Your {timer.category === 'task' ? 'task' : 'meeting'} timer's been running with no activity in this tab for a while.
                  </p>
                </div>
              </div>
            </DialogHeader>
            <DialogFooter className="mt-2">
              <Button variant="ghost" size="sm" onClick={handleStop} loading={stopTimer.isPending}>
                Stop timer
              </Button>
              <Button size="sm" onClick={resetIdle}>
                Still here — keep going
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border bg-card px-3 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-md border border-input">
          {(['meeting', 'task'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                category === c ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
              )}
            >
              {c}
            </button>
          ))}
        </div>

        {category === 'task' && (
          <>
            <div className="flex overflow-hidden rounded-md border border-input text-xs">
              {(['mine', 'unclaimed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setTaskSource(s); setTaskId(''); }}
                  className={cn(
                    'px-2.5 py-1.5 font-medium transition-colors',
                    taskSource === s ? 'bg-muted text-foreground' : 'bg-background text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {s === 'mine' ? 'My tasks' : 'Unclaimed'}
                </button>
              ))}
            </div>

            {taskSource === 'mine' ? (
              <>
                <SearchableSelect
                  value={taskId}
                  onChange={setTaskId}
                  options={openTasks.map((t) => ({ value: t.id, label: t.taskKey ? `${t.taskKey} — ${t.title}` : t.title }))}
                  placeholder="Search my tasks…"
                  emptyLabel="No open tasks"
                  className="h-8 min-w-[180px] max-w-[16rem] flex-1"
                />
                {myLoanableSubtasks.length > 0 && (
                  <SearchableSelect
                    value={subtaskId}
                    onChange={setSubtaskId}
                    options={[
                      { value: '', label: 'Whole task' },
                      ...myLoanableSubtasks.map((s) => ({ value: s.id, label: s.title })),
                    ]}
                    placeholder="Whole task"
                    emptyLabel="No checklist items"
                    className="h-8 min-w-[160px] max-w-[14rem]"
                  />
                )}
              </>
            ) : (
              <>
                <SearchableSelect
                  value={unclaimedProjectId}
                  onChange={(v) => { setUnclaimedProjectId(v); setTaskId(''); }}
                  options={myProjects.map((p) => ({ value: p.id, label: p.name }))}
                  placeholder="Search projects…"
                  emptyLabel="No projects"
                  className="h-8 min-w-[180px] max-w-[12rem]"
                />
                <SearchableSelect
                  value={taskId}
                  onChange={setTaskId}
                  options={(unclaimedTasks?.items ?? []).map((t) => ({ value: t.id, label: t.taskKey ? `${t.taskKey} — ${t.title}` : t.title }))}
                  disabled={!unclaimedProjectId}
                  placeholder={!unclaimedProjectId ? 'Pick a project first' : 'Search unclaimed tasks…'}
                  emptyLabel={unclaimedTasksError ? 'Failed to load tasks' : 'No unclaimed tasks'}
                  className="h-8 min-w-[180px] max-w-[16rem] flex-1"
                />
              </>
            )}
          </>
        )}
        {taskSource === 'unclaimed' && unclaimedTasksError && (
          <span className="text-xs text-destructive">Couldn't load unclaimed tasks for this project.</span>
        )}

        <Button
          size="sm"
          onClick={handleStart}
          loading={startTimer.isPending}
          disabled={category === 'task' && !taskId}
        >
          <Play className="mr-1.5 h-3 w-3" /> Start
        </Button>
      </div>
    </div>
  );
}
