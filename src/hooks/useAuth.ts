import { createContext, useContext, useState, useEffect, ReactNode, createElement } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getAccessToken, authCookieConfig, getStoredUser, setTokens, setStoredUser,
  clearTokens, roleAllowed, type StoredUser, type Capability,
} from '../lib/auth';
import type { AuthDto, AuthUserDto } from '../types/api';
import client, { refreshSession } from '../api/client';

// Mirrors the backend's default refresh-token idle window (RefreshTokenIdleTimeoutMinutes).
// A purely client-side nicety — the backend independently enforces the real boundary on
// /auth/refresh, so this just gives the user a clean, immediate logout instead of waiting
// for their next API call to fail.
const IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;

interface AuthContextValue {
  currentUser: StoredUser | null;
  isLoading: boolean;
  login: (dto: AuthDto) => void;
  logout: () => void;
  /** Capability check against the server-resolved set from login/refresh — no local role logic. */
  allow: (cap: Capability) => boolean;
  hasPermission: (code: string) => boolean;
  /** Re-fetches GET /auth/me and updates the stored user — no token rotation. Called after a
   * "role.changed" real-time event so a role change made by an admin takes effect without
   * forcing a re-login. */
  refreshUser: () => Promise<void>;
}

function toStoredUser(dto: AuthUserDto): StoredUser {
  return {
    id: dto.id,
    name: dto.name,
    email: dto.email,
    role: dto.role,
    permissions: dto.permissions ?? [],
    capabilities: dto.capabilities ?? [],
  };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [isLoading, setIsLoading]     = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Nothing is stored to say "there is a session" except the profile; whether the cookie is still good is the server's call.
    if (!getStoredUser()) { setIsLoading(false); return; }

    refreshSession()
      .then((dto) => {
        const user = toStoredUser(dto.user);
        setTokens(dto.accessToken);
        setStoredUser(user);
        setCurrentUser(user);
      })
      .catch(() => clearTokens())
      .finally(() => setIsLoading(false));
  }, []);

  const login = (dto: AuthDto) => {
    // The query client is a single app-wide cache with a 30s staleTime — without clearing it
    // here, logging in as a different user within that window (or before gcTime evicts older
    // entries) would render the *previous* session's cached data under the new user's name,
    // confidential fields (vitals, check-ins, ...) included, until each query happened to refetch.
    queryClient.clear();
    const user = toStoredUser(dto.user);
    setTokens(dto.accessToken);
    setStoredUser(user);
    setCurrentUser(user);
  };

  const logout = () => {
    // The access token is wiped just below, so the logout request has to carry its own copy to be authenticated.
    const access = getAccessToken();
    clearTokens();
    setCurrentUser(null);
    queryClient.clear();
    client.post('/auth/logout', {}, {
      ...authCookieConfig,
      headers: { ...authCookieConfig.headers, ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    }).catch(() => {});
  };

  useEffect(() => {
    if (!currentUser) return;

    const lastActivity = { current: Date.now() };
    const markActive = () => { lastActivity.current = Date.now(); };
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActive, { passive: true }));

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MS) {
        toast.info("You've been logged out due to inactivity.");
        logout();
      }
    }, IDLE_CHECK_INTERVAL_MS);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActive));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const allow = (cap: Capability) => roleAllowed(currentUser?.capabilities, cap);
  const hasPermission = (code: string) => !!currentUser?.permissions.includes(code);

  const refreshUser = async () => {
    if (!currentUser) return;
    const r = await client.get<AuthUserDto>('/auth/me');
    const user = toStoredUser(r.data);
    setStoredUser(user);
    setCurrentUser(user);
  };

  return createElement(AuthContext.Provider, { value: { currentUser, isLoading, login, logout, allow, hasPermission, refreshUser } }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Canonical permission codes — use these instead of string literals in components.
export const Permissions = {
  DashboardView:    'dashboard:view',
  TasksView:        'tasks:view',
  TasksManage:      'tasks:manage',
  ProjectsView:     'projects:view',
  ProjectsManage:   'projects:manage',
  CheckInsSubmit:   'checkins:submit',
  CheckInsView:     'checkins:view',
  EscalationsView:  'escalations:view',
  EngineersView:    'engineers:view',
  OverworkView:     'overwork:view',
  OverworkOverride: 'overwork:override',
  ReportsView:      'reports:view',
  FeedbackSubmit:   'feedback:submit',
  FeedbackView:     'feedback:view',
  VitalsSubmit:     'vitals:submit',
  VitalsView:       'vitals:view',
  NotificationsView:'notifications:view',
  ThresholdsManage: 'thresholds:manage',
  UsersManage:      'users:manage',
  AuditView:        'audit:view',
} as const;
