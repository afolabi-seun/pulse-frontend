import type { Role } from '../types/api';

// Access token lives in memory only — never touches disk.
let _accessToken: string | null = null;

export const getAccessToken  = () => _accessToken;
export const getRefreshToken = () => localStorage.getItem('pulse_refresh');

export interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  capabilities: string[];
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem('pulse_user');
  return raw ? (JSON.parse(raw) as StoredUser) : null;
}

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  localStorage.setItem('pulse_refresh', refresh);
}

export function setStoredUser(user: StoredUser) {
  localStorage.setItem('pulse_user', JSON.stringify(user));
}

export function clearTokens() {
  _accessToken = null;
  localStorage.removeItem('pulse_refresh');
  localStorage.removeItem('pulse_user');
}

export function parseTokenClaims(token: string): {
  sub: string;
  role: string;
  engineerId: string | null;
  exp: number;
} {
  const payload = JSON.parse(atob(token.split('.')[1]));
  return {
    sub:        payload.sub        as string,
    role:       payload.role       as string,
    engineerId: payload.engineerId as string | null ?? null,
    exp:        payload.exp        as number,
  };
}

// ── Capability model ─────────────────────────────────────────────────────────
// Capability keys are server-resolved: each one is a literal Pulse.Application.Auth
// .CapabilityRegistry key, and `roleAllowed` checks membership in the `capabilities` array the
// backend sends at login/refresh (StoredUser.capabilities, from AuthUserDto.Capabilities) — no
// role-to-capability mapping lives on the frontend any more. Keeping the string values here
// identical to the backend's registry keys means there is nothing to translate or keep in sync
// beyond the literal name; see docs/rbac-consolidation.md (Phase 16c).
export type Capability =
  | 'team-lead-or-above'        // CapabilityRegistry.TeamLeadOrAbove
  | 'product-manager-or-above'  // CapabilityRegistry.ProductManagerOrAbove
  | 'pm-or-above'                // CapabilityRegistry.PmOrAbove — project_manager + heads (NOT product_manager / team_lead)
  | 'any-head'                   // CapabilityRegistry.AnyHead — the department heads
  | 'head-only'                  // CapabilityRegistry.HeadOnly — head_of_rd only
  | 'pmo-only'                   // CapabilityRegistry.PmoOnly — head_of_pmo OR project_manager
  | 'team-lead-or-head-only'     // CapabilityRegistry.TeamLeadOrHeadOnly — team_lead + heads (task loan)
  | 'sprint-creator-or-above'    // CapabilityRegistry.SprintCreatorOrAbove — head_of_pmo/project_manager/head_of_product/head_of_functional/product_manager (sprint create/edit)
  | 'executive-read'             // CapabilityRegistry.ExecutiveRead — executive only, read-only
  | 'hr-read'                    // CapabilityRegistry.HrRead — HR only, read-only, org-wide
  | 'accountant-read'            // CapabilityRegistry.AccountantRead — accountant only, read-only, org-wide, narrower than hr-read
  | 'project-follow'             // CapabilityRegistry.ProjectFollow — team_lead + heads except head_of_pmo
  | 'personal-task-creator'      // CapabilityRegistry.PersonalTaskCreator — hr + accountant: private to-do tasks in a project of their own
  | 'time-entry-submitter';      // CapabilityRegistry.TimeEntrySubmitter — every role except PMO (head_of_pmo/project_manager) and executive

export function roleAllowed(capabilities: readonly string[] | null | undefined, cap: Capability): boolean {
  return !!capabilities?.includes(cap);
}
