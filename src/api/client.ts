import axios from 'axios';
import { ApiError } from '../lib/errors';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from '../lib/auth';

const client = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});

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
      original.url === '/auth/login';

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
        const { data } = await client.post<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          { refreshToken: getRefreshToken() },
        );
        setTokens(data.accessToken, data.refreshToken);
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
