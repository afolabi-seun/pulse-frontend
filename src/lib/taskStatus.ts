import type { TaskStatus, BugSeverity } from '../types/api';

export const STATUS_VARIANT: Record<TaskStatus, 'green' | 'red' | 'gray' | 'yellow'> = {
  backlog: 'gray', active: 'green', blocked: 'red', inQa: 'gray', done: 'gray', paused: 'yellow',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog', active: 'Active', blocked: 'Blocked', inQa: 'In QA', done: 'Done', paused: 'Paused',
};

export const SEVERITY_COLORS: Record<BugSeverity, string> = {
  Low:      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  Medium:   'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  High:     'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  Critical: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

// 1 (lowest) to 5 (highest) — single shared source for every priority badge, unlike Severity's
// duplicated color maps (taskStatus.ts vs TaskBoard.tsx). Applies to every task type.
export const PRIORITY_LABEL: Record<number, string> = {
  1: 'P1', 2: 'P2', 3: 'P3', 4: 'P4', 5: 'P5',
};

export const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-slate-50 text-slate-600 dark:bg-slate-800/40 dark:text-slate-400',
  2: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  3: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400',
  4: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  5: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

// Mirrors PulseTask.PromoteFromBacklogIfGroomed's exact condition (assignee AND points >= 1) —
// single shared source so the detail page, list, and board all explain the same rule the same way.
export function backlogExitHint(hasAssignee: boolean, points: number): string {
  if (!hasAssignee && points < 1)
    return 'This task needs an assignee and story points — it moves to Active automatically as soon as both are set.';
  if (!hasAssignee)
    return 'This task needs an assignee — it moves to Active automatically as soon as one is set.';
  return "This task needs story points — it moves to Active automatically as soon as it's pointed.";
}
