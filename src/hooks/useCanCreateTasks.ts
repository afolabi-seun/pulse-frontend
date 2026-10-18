import { useAuth } from './useAuth';
import { useMeta } from '../api/meta';

/**
 * Who may create tasks. The PMO, team leads, department heads and the product roles always may; HR and Accountant may keep personal to-dos; and
 * engineers and designers may only when the PMO has allowed it (Thresholds), in which case each task is filed for themselves.
 */
export function useCanCreateTasks() {
  const { allow, currentUser } = useAuth();
  const { data: meta } = useMeta();

  const plansWork = allow('team-lead-or-above');
  const personalOnly = allow('personal-task-creator') && !plansWork;
  const mayFileOwn = !!meta?.engineersCanCreateTasks && (currentUser?.role === 'engineer' || currentUser?.role === 'designer');

  return {
    /** Offer "New task" at all. */
    canCreate: plansWork || personalOnly || mayFileOwn,
    /** Tasks in real projects (as opposed to personal to-dos only). */
    canCreateInProjects: plansWork || mayFileOwn,
    /** Allowed because the PMO switched it on: the task is for themselves, unestimated. */
    mayFileOwn: mayFileOwn && !plansWork,
  };
}
