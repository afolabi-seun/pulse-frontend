import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import Badge from '../ui/Badge';
import { Card } from '@/components/ui/card';
import type { HealthReasonDto, HealthTaskRef, ProjectHealthDto } from '../../types/api';

const HEALTH_LABEL: Record<ProjectHealthDto['health'], string> = {
  Healthy: 'Healthy', AtRisk: 'At Risk', Critical: 'Critical',
};

const REASON: Record<HealthReasonDto['kind'], { label: string; variant: 'red' | 'yellow' }> = {
  overdue:      { label: 'Overdue',       variant: 'red' },
  blocked_long: { label: 'Blocked long',  variant: 'red' },
  blocked:      { label: 'Blocked',       variant: 'yellow' },
  due_soon:     { label: 'Due soon',      variant: 'yellow' },
};

// How many task rows show before "Show all N" — ProjectHealthCalculator now sends up to 50
// examples per reason (was capped at 3 with no way to see the rest at all), so a long list needs
// the same reveal pattern TimeSummaryPage uses for a long roster, not an unbounded render.
const TASKS_CAP = 10;

/** What a status means, in one place for every table that shows it. */
export function HealthLegend({ className }: { className?: string }) {
  return (
    <p className={cn('mb-2 text-xs text-muted-foreground', className)}>
      <span className="font-medium text-foreground">Critical</span> — something has been late or blocked for too long, or
      several tasks are late. <span className="font-medium text-foreground">At Risk</span> — something is late (but
      recently), blocked, or due soon. Click a status to see why and what to do.
    </p>
  );
}

/** Short inline summary of the reasons, e.g. "2 overdue tasks · 1 blocked". */
export function healthSummary(p: ProjectHealthDto): string {
  return (p.reasons ?? []).map((r) => r.text).join(' · ');
}

/** A status that can be opened to show its reasons — Healthy has nothing to explain, so it isn't clickable. */
export function HealthToggle({ project, open, onToggle, badge }: {
  project: ProjectHealthDto; open: boolean; onToggle: () => void; badge: React.ReactNode;
}) {
  if (!project.reasons || project.reasons.length === 0) return <>{badge}</>;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={`${project.name}: ${HEALTH_LABEL[project.health]} — ${open ? 'hide' : 'show'} why`}
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {badge}
      <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
    </button>
  );
}

function howLong(kind: HealthReasonDto['kind'], days: number): string {
  if (kind === 'overdue') return `${days} working day${days === 1 ? '' : 's'} late`;
  if (kind === 'due_soon') return days === 0 ? 'due today' : `due in ${days}d`;
  return days === 0 ? 'blocked today' : `blocked ${days} working day${days === 1 ? '' : 's'}`;
}

type TaskRow = { reason: HealthReasonDto; task: HealthTaskRef };

/**
 * The expanded view, as two flat stacked-row lists (same pattern as TimeSummaryPage's roster,
 * rather than multi-column tables): what is wrong and what to do about it (one row per reason),
 * then the worst tasks behind each reason. A single column per row means nothing needs its own
 * horizontal scroll on a phone, and a long task list reveals via "Show all" instead of a dead-end
 * "…and N more not shown".
 */
export default function ProjectHealthDetail({ project }: { project: ProjectHealthDto }) {
  const [showAllTasks, setShowAllTasks] = useState(false);
  const reasons = project.reasons ?? [];
  if (reasons.length === 0) return null;

  const taskRows: TaskRow[] = reasons.flatMap((reason) => reason.examples.map((task) => ({ reason, task })));
  const shownTaskRows = showAllTasks ? taskRows : taskRows.slice(0, TASKS_CAP);
  // Still possible even with the examples cap raised well past any realistic project — a note,
  // not a reveal control, since there's nothing left client-side to show.
  const hiddenCount = reasons.reduce((sum, r) => sum + Math.max(0, r.count - r.examples.length), 0);

  return (
    // Sits inside a wide, horizontally scrolling report table: pinned to the left edge and capped to the
    // visible width, so it stays on screen regardless of that table's own scroll position. The
    // --sidebar-rail-width subtraction accounts for the sidebar's reserved width, which only exists
    // from lg: up (Sidebar.tsx is an off-canvas overlay below that) — applying it on mobile left this
    // panel capped to ~150px on a 375px phone. That width is a CSS var, not a fixed value, because
    // Sidebar.tsx's collapse toggle changes how much it actually reserves (see Sidebar.tsx's own
    // comment on the var) — a fixed rem value here was correct for the expanded sidebar but left this
    // panel under-using the extra space the collapsed rail frees up.
    <div
      className="sticky left-0 w-full max-w-[calc(100vw-2rem)] space-y-4 bg-muted/20 px-4 py-4 lg:max-w-[min(56rem,calc(100vw-var(--sidebar-rail-width)))]"
      data-testid="project-health-detail"
    >
      <section>
        <h4 className="mb-1.5 text-xs font-semibold text-foreground">
          Why {project.name} is {HEALTH_LABEL[project.health]}
          {project.teamSliceOnly && <span className="ml-1.5 font-normal text-muted-foreground">· this team's tasks only</span>}
        </h4>
        <Card className="divide-y divide-border overflow-hidden p-0">
          {reasons.map((r) => (
            <div key={r.kind} className="flex items-start gap-3 px-3 py-2.5">
              <Badge label={REASON[r.kind].label} variant={REASON[r.kind].variant} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{r.text}</p>
                {r.action && <p className="mt-0.5 text-xs font-medium text-primary">{r.action}</p>}
              </div>
            </div>
          ))}
        </Card>
      </section>

      {taskRows.length > 0 && (
        <section>
          <h4 className="mb-1.5 text-xs font-semibold text-foreground">Tasks to look at</h4>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {shownTaskRows.map(({ reason, task }) => (
              <div key={`${reason.kind}-${task.taskId}`} className="flex items-start gap-3 px-3 py-2.5">
                <Badge label={REASON[reason.kind].label} variant={REASON[reason.kind].variant} />
                <div className="min-w-0 flex-1">
                  <Link to={`/tasks/${task.taskId}`} className="font-medium text-foreground hover:text-primary hover:underline">
                    {task.key && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{task.key}</span>}
                    {task.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {task.assigneeName ?? 'Unassigned'} · {howLong(reason.kind, task.days)}
                  </p>
                </div>
              </div>
            ))}
            {!showAllTasks && taskRows.length > TASKS_CAP && (
              <button
                type="button"
                onClick={() => setShowAllTasks(true)}
                className="w-full px-3 py-2 text-center text-xs font-medium text-primary hover:underline"
              >
                Show all {taskRows.length}
              </button>
            )}
          </Card>
          {hiddenCount > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">…and {hiddenCount} more not shown</p>
          )}
        </section>
      )}
    </div>
  );
}
