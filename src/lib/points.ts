export function formatPtsDays(
  points: number,
  engineer: { baselinePoints: number; baselineCycleDays: number } | undefined | null,
): string | null {
  if (!engineer || engineer.baselinePoints <= 0) return null;
  const days = (points * engineer.baselineCycleDays) / engineer.baselinePoints;
  if (days < 0.5) return '< 1d';
  const rounded = Math.round(days * 2) / 2;
  return `≈ ${rounded}d`;
}

/**
 * Whether changing a task's points to `newPoints` has to be explained. It does once work has begun and there is an
 * estimate to change — not for the first estimate on an unpointed task, not while the task is still in Backlog, and
 * not for a finished or in-QA task (which can't be edited anyway). Mirrors the API's rule.
 */
export function pointsChangeNeedsReason(
  task: { points: number; status: string },
  newPoints: number | '' | null | undefined,
): boolean {
  if (newPoints === '' || newPoints === null || newPoints === undefined) return false;
  if (task.points <= 0 || Number(newPoints) === task.points) return false;
  return !['backlog', 'done', 'inQa'].includes(task.status);
}

/**
 * A baseline is "N points per `cycleDays` days"; this restates it per week so it can sit on weekly bars.
 * Calendar days, like the overwork signal's cycle window.
 */
export function weeklyBaselinePoints(baselinePoints: number, cycleDays: number): number {
  return baselinePoints > 0 && cycleDays > 0 ? (baselinePoints * 7) / cycleDays : 0;
}
