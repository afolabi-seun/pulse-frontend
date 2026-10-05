import Badge from '../ui/Badge';
import HelpTooltip from '../ui/HelpTooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { EngineerUtilizationEntry } from '../../types/api';

function loadColor(pct: number) {
  if (pct > 100) return 'text-red-600 dark:text-red-400 font-semibold';
  if (pct >= 80) return 'text-amber-600 dark:text-amber-400 font-semibold';
  return 'text-emerald-600 dark:text-emerald-400';
}

const GROUP_CLS = 'border-l border-border text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';
const FIRST_OF_GROUP = 'border-l border-border';

/**
 * One per-engineer utilization table shared by the PMO, Weekly and Leadership reports. Its columns
 * answer two different questions, so they're grouped: "Right now" is a live snapshot (it does not
 * change with the selected week), "This period" follows the report's date range.
 */
export function EngineerUtilizationTable({
  engineers, showRole = false, periodLabel, emptyLabel = 'No delivery engineers.',
}: {
  engineers: EngineerUtilizationEntry[];
  showRole?: boolean;
  periodLabel?: string;
  emptyLabel?: string;
}) {
  const identityCols = showRole ? 2 : 1;
  const totalCols = identityCols + 8 + 3 + 1;

  return (
    <div className="overflow-x-auto">
    <Table className="[&_td]:py-2 [&_th]:py-2 [&_th]:text-xs">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead colSpan={identityCols} />
          <TableHead colSpan={7} className={GROUP_CLS}>
            <span className="inline-flex items-center gap-1">
              Right now
              <HelpTooltip
                title="Right now"
                body="A live snapshot as of today — these columns don't change when you pick a different week. Check-ins are the last 7 days."
              />
            </span>
          </TableHead>
          <TableHead colSpan={3} className={GROUP_CLS}>
            <span className="inline-flex items-center gap-1">
              {periodLabel ? `This period · ${periodLabel}` : 'This period'}
              <HelpTooltip
                title="This period"
                body="Follows the report's selected week or date range."
              />
            </span>
          </TableHead>
          <TableHead />
        </TableRow>
        <TableRow>
          <TableHead>Engineer</TableHead>
          {showRole && <TableHead>Role</TableHead>}
          <TableHead className={cn('text-right', FIRST_OF_GROUP)}>Active tasks</TableHead>
          <TableHead className="text-right">Points</TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center gap-1">
              Due this cycle
              <HelpTooltip
                title="Due this cycle"
                body="The part of the active Points due within the engineer's baseline cycle, plus anything overdue or with no due date. The overworked flag is decided on this number, so it can be set while Load % is under 100%, and not set while it is over."
              />
            </span>
          </TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center gap-1">
              In QA
              <HelpTooltip
                title="In QA"
                body="Tasks awaiting QA review, shown separately from Active tasks/Points — the work already happened, it just isn't counted as current workload while it waits on review."
              />
            </span>
          </TableHead>
          <TableHead className="text-right">Baseline</TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center gap-1">
              Load %
              <HelpTooltip
                title="Load %"
                body="All active points ÷ baseline points. The overworked flag is not decided on this — it uses Due this cycle, the part of the load that is actually due within the baseline cycle."
              />
            </span>
          </TableHead>
          <TableHead className="text-right">Blockers</TableHead>
          <TableHead className="text-right">Check-ins</TableHead>
          <TableHead className={cn('text-right', FIRST_OF_GROUP)}>Completed</TableHead>
          <TableHead className="text-right">Subtasks done</TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center gap-1">
              Hours
              <HelpTooltip
                title="Hours"
                body="Delivery (task) hours only — Meeting, Admin, Leave, and Other time aren't counted here, so a week of approved leave doesn't read as a normal week of logged work."
              />
            </span>
          </TableHead>
          <TableHead>Flag</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {engineers.map((eng) => {
          const loadPct = eng.baselinePoints > 0 ? Math.round((eng.totalPoints / eng.baselinePoints) * 100) : 0;
          return (
            <TableRow key={eng.engineerId}>
              <TableCell className="whitespace-nowrap font-medium text-foreground">{eng.name}</TableCell>
              {showRole && <TableCell className="text-muted-foreground">{eng.role.replace(/_/g, ' ')}</TableCell>}
              <TableCell className={cn('text-right text-muted-foreground', FIRST_OF_GROUP)}>{eng.activeTasks}</TableCell>
              <TableCell className="text-right text-muted-foreground">{eng.totalPoints}</TableCell>
              <TableCell className={cn('text-right', eng.isOverworked ? 'font-medium text-red-500' : 'text-muted-foreground')}>
                {eng.cyclePoints ?? '—'}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                {eng.tasksInQa > 0 ? `${eng.tasksInQa} (${eng.pointsInQa} pts)` : '—'}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">{eng.baselinePoints}</TableCell>
              <TableCell className={cn('text-right', loadColor(loadPct))}>{loadPct}%</TableCell>
              <TableCell className="text-right text-muted-foreground">{eng.blockers}</TableCell>
              <TableCell className="text-right text-muted-foreground">{eng.checkInsThisWeek}</TableCell>
              <TableCell className={cn('text-right text-muted-foreground', FIRST_OF_GROUP)}>{eng.completedTasks}</TableCell>
              <TableCell className="text-right text-muted-foreground">{eng.subtasksCompleted}</TableCell>
              <TableCell className="text-right text-muted-foreground">{eng.hoursLoggedThisWeek}h</TableCell>
              <TableCell>{eng.isOverworked && <Badge label="overworked" variant="red" />}</TableCell>
            </TableRow>
          );
        })}
        {engineers.length === 0 && (
          <TableRow><TableCell colSpan={totalCols} className="text-center text-muted-foreground">{emptyLabel}</TableCell></TableRow>
        )}
      </TableBody>
    </Table>
    </div>
  );
}
