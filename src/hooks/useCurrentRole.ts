import { useAuth } from './useAuth';
import { useMeta } from '../api/meta';

export function useCurrentRole() {
  const { currentUser } = useAuth();
  const { data: meta }  = useMeta();

  const role     = currentUser?.role ?? '';
  const roleMeta = meta?.roles.find((r) => r.value === role);

  return {
    role,
    isPmo:            roleMeta?.group === 'PMO',
    isHeadOfPmo:      !!(roleMeta?.isDeptHead && roleMeta?.group === 'PMO'),
    // Head of Product gets the same org-wide visibility as Head of PMO on some views
    // (e.g. the standup digest) — kept separate from isHeadOfPmo since it's role-specific,
    // not a consequence of the "PMO" department group.
    isHeadOfProduct:  role === 'head_of_product',
    isDeptHead:       roleMeta?.isDeptHead ?? false,
    isTeamLead:       role === 'team_lead',
    canCreateProject: roleMeta?.canCreateProjects ?? false,
    canDeleteProject: roleMeta?.canDeleteProjects ?? false,
  };
}
