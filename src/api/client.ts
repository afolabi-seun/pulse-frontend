import axios from 'axios';
import { ApiError } from '../lib/errors';
import { getAccessToken, getLegacyRefreshToken, clearLegacyRefreshToken, authCookieConfig, setTokens, clearTokens } from '../lib/auth';
import type { AuthDto } from '../types/api';

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

/** Trades the refresh cookie for a new access token (and rotates the cookie). A session that began before the refresh
 *  token moved to a cookie still has it in localStorage: that is sent once so the server can set the cookie, then dropped. */
export function refreshSession(): Promise<AuthDto> {
  // One request at a time: every refresh rotates the token, so two in flight would present the same one twice, and
  // the server treats a reused token as theft and signs the user out everywhere (a double-mounted effect in dev, or
  // a startup refresh racing a 401 retry, would do it).
  inflightRefresh ??= (async () => {
    const legacy = getLegacyRefreshToken();
    const { data } = await client.post<AuthDto>('/auth/refresh', legacy ? { refreshToken: legacy } : {}, authCookieConfig);
    clearLegacyRefreshToken();
    return data;
  })().finally(() => { inflightRefresh = null; });
  return inflightRefresh;
}
let inflightRefresh: Promise<AuthDto> | null = null;

// ── Request: attach access token ─────────────────────────────────────────────
client.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response: unwrap envelope, normalise errors, silent 401 refresh ──────────
let isRefreshing = false;
let refreshWaiters: Array<(token: string) => void> = [];

client.interceptors.response.use(
  (response) => {
    // Blob responses (file downloads) are raw — skip envelope unwrapping
    if (response.config.responseType === 'blob') return response;
    // Every 2xx carries ApiResponse<T> — unwrap to T so hooks receive the data directly
    response.data = (response.data as { data: unknown }).data;
    return response;
  },
  async (error) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const original = error.config as any;
    const envelope = error.response?.data as { error?: { code?: string; message?: string; errors?: Record<string, string[]> } } | undefined;
    const status   = error.response?.status as number | undefined;

    const apiError = new ApiError(
      envelope?.error?.code    ?? 'NETWORK_ERROR',
      envelope?.error?.message ?? 'A network error occurred.',
      status,
      envelope?.error?.errors,
    );

    // Silent refresh on 401 — exclude auth endpoints to prevent infinite loops
    const isAuthEndpoint =
      original.url === '/auth/refresh' ||
      original.url === '/auth/login' ||
      original.url === '/auth/logout';

    if (status === 401 && !original._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshWaiters.push((newToken) => {
            original.headers.Authorization = `Bearer ${newToken}`;
            resolve(client(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const data = await refreshSession();
        setTokens(data.accessToken);
        refreshWaiters.forEach((cb) => cb(data.accessToken));
        refreshWaiters = [];
        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return client(original);
      } catch {
        clearTokens();
        refreshWaiters = [];
        window.location.replace('/login');
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(apiError);
  },
);

export default client;
