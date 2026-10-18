import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useSetTaskProgress } from '../../api/tasks';
import type { TaskDto } from '../../types/api';

const STEPS = [0, 25, 50, 75] as const;

/** How many points a task has earned so far, as a percentage you can see and, for the assignee or a lead, move in steps of 25. */
export default function ProgressControl({ task, canSet }: { task: TaskDto; canSet: boolean }) {
  const setProgress = useSetTaskProgress(task.id);
  const percent = task.effectiveProgress ?? 0;
  const earned = task.earnedPoints ?? 0;
  const inFlight = task.status === 'active' || task.status === 'blocked';
  const fromChecklist = !!task.progressFromChecklist;
  const editable = canSet && inFlight && !fromChecklist;

  // Nothing to show for work that has not started or has no estimate.
  if (task.status === 'backlog' || !(task.points > 0)) return null;

  const note =
    task.status === 'done' ? 'Finished'
    : task.status === 'inQa' ? 'In QA — counted as 90% until it passes'
    : fromChecklist ? 'Follows the checklist'
    : null;

  const choose = (step: number) =>
    setProgress.mutate(step, { onError: () => toast.error('Could not update progress.') });

  return (
    <div className="mt-3 rounded-lg border border-border p-3" data-testid="progress-control">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <p className="font-medium text-foreground">Progress <span className="tabular-nums">{percent}%</span></p>
        <p className="text-xs tabular-nums text-muted-foreground">{earned} of {task.points} pts earned</p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar" aria-label="Task progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
      >
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      {note && <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>}
      {editable && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Set progress">
          {STEPS.map((step) => (
            <button
              key={step}
              type="button"
              disabled={setProgress.isPending}
              aria-pressed={(task.progressPercent ?? 0) === step}
              onClick={() => choose(step)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums transition-colors',
                (task.progressPercent ?? 0) === step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-foreground hover:border-primary hover:bg-primary/10',
              )}
            >
              {step}%
            </button>
          ))}
          <span className="text-xs text-muted-foreground">Finishing the task takes it to 100%.</span>
        </div>
      )}
    </div>
  );
}
