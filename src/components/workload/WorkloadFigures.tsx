import { cn } from '@/lib/utils';

/** What "due this cycle" means, in one place, for every screen that shows load. */
export function dueThisCycleHelp(cycleDays?: number): string {
  return `"Due this cycle" counts points due within the engineer's ${cycleDays ? `${cycleDays}-day ` : ''}baseline cycle, `
    + 'plus anything overdue or with no due date. It is what "overworked" is judged on, so it can differ from the '
    + 'total of everything active.';
}

/**
 * One engineer's load as the product measures it: "25 active · 13 due this cycle / 15 pts" — everything active, the part
 * of it due within the baseline cycle (what the overwork signal tests), and the baseline. Falls back to a plain
 * "x / baseline pts" when the cycle figure isn't available.
 */
export function WorkloadFigures({ activePoints, cyclePoints, baselinePoints, cycleDays, overworked = false, className }: {
  activePoints: number;
  cyclePoints?: number | null;
  baselinePoints: number;
  cycleDays?: number;
  overworked?: boolean;
  className?: string;
}) {
  if (cyclePoints === undefined || cyclePoints === null) {
    return <span className={className}>{activePoints} / {baselinePoints} pts</span>;
  }
  return (
    <span className={className} title={dueThisCycleHelp(cycleDays)}>
      <span>{activePoints} active</span>
      <span aria-hidden="true"> · </span>
      <span className={cn('font-medium', overworked && 'text-red-500')}>{cyclePoints} due this cycle</span>
      <span> / {baselinePoints} pts</span>
    </span>
  );
}
