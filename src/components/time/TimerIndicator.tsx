import { toast } from 'sonner';
import { AlertTriangle, Square } from 'lucide-react';
import { useActiveTimer, useStopTimer } from '../../api/timeEntries';
import { useAuth } from '../../hooks/useAuth';
import { ApiError } from '../../lib/errors';
import { cn } from '@/lib/utils';
import { useTimerElapsed } from './useTimerElapsed';

/** Compact "still running" pill shown in the sidebar footer on every page — so a timer started
 * from My Time (e.g. the morning stand-up) stays visible and stoppable while navigating away. */
export default function TimerIndicator() {
  const { allow } = useAuth();
  const canSubmit = allow('time-entry-submitter');
  const { data: timer } = useActiveTimer(canSubmit);
  const stopTimer = useStopTimer();
  const { label, stale } = useTimerElapsed(timer?.startedAt);

  if (!canSubmit || !timer) return null;

  const handleStop = () => {
    stopTimer.mutate(undefined, {
      onSuccess: () => toast.success('Timer stopped and logged.'),
      onError: (error) => toast.error((error as ApiError).message || 'Failed to stop timer.'),
    });
  };

  return (
    <div className={cn(
      'mb-2 flex items-center justify-between gap-1.5 rounded-md border border-sidebar-border px-2 py-1.5 text-xs',
      stale ? 'border-amber-500/40 bg-amber-500/10' : 'bg-sidebar-accent/50',
    )}>
      <div className="flex min-w-0 items-center gap-1.5">
        {stale
          ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          : <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
        <span className="truncate font-mono tabular-nums text-sidebar-foreground">{label}</span>
        <span className="truncate text-sidebar-muted-foreground">
          {timer.category === 'task' ? (timer.taskTitle ?? 'Task') : 'Meeting'}
        </span>
      </div>
      <button
        type="button"
        onClick={handleStop}
        disabled={stopTimer.isPending}
        title="Stop timer"
        className="shrink-0 rounded p-1 text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-50"
      >
        <Square className="h-3 w-3" />
      </button>
    </div>
  );
}
