import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import client, { refreshSession } from '../client';
import { getAccessToken, setTokens, clearTokens } from '../../lib/auth';

const authDto = {
  accessToken: 'access-2',
  refreshToken: '',
  user: { id: 'u1', name: 'A', email: 'a@x.io', role: 'engineer', permissions: [], capabilities: [] },
};

let sent: InternalAxiosRequestConfig[] = [];
const originalAdapter = client.defaults.adapter;

function stubAdapter(respond: (cfg: InternalAxiosRequestConfig) => { status: number; data: unknown }) {
  const adapter: AxiosAdapter = async (cfg) => {
    sent.push(cfg);
    const { status, data } = respond(cfg);
    const response = { data, status, statusText: '', headers: {}, config: cfg };
    if (status >= 400) throw Object.assign(new Error('failed'), { isAxiosError: true, config: cfg, response });
    return response;
  };
  client.defaults.adapter = adapter;
}

beforeEach(() => { sent = []; localStorage.clear(); clearTokens(); });
afterEach(() => { client.defaults.adapter = originalAdapter; });

describe('refreshSession', () => {
  it('relies on the cookie: an empty body, credentials on, and the client header', async () => {
    stubAdapter(() => ({ status: 200, data: { data: authDto } }));

    await refreshSession();

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe('/auth/refresh');
    expect(JSON.parse(sent[0].data as string)).toEqual({});
    expect(sent[0].withCredentials).toBe(true);
    expect(String(sent[0].headers['X-Pulse-Client'])).toBe('web');
  });

  it('moves a session that began before the cookie existed: sends the stored token once, then forgets it', async () => {
    localStorage.setItem('pulse_refresh', 'old-token');
    stubAdapter(() => ({ status: 200, data: { data: { ...authDto, refreshToken: 'rotated' } } }));

    await refreshSession();

    expect(JSON.parse(sent[0].data as string)).toEqual({ refreshToken: 'old-token' });
    expect(localStorage.getItem('pulse_refresh')).toBeNull();

    await refreshSession();
    expect(JSON.parse(sent[1].data as string)).toEqual({}); // cookie from now on
  });

  it('sends one request however many callers ask at once', async () => {
    stubAdapter(() => ({ status: 200, data: { data: authDto } }));

    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);

    expect(sent.filter((c) => c.url === '/auth/refresh')).toHaveLength(1);
    await refreshSession(); // and a later one is a fresh request
    expect(sent.filter((c) => c.url === '/auth/refresh')).toHaveLength(2);
  });

  it('never stores a refresh token from a response', async () => {
    stubAdapter(() => ({ status: 200, data: { data: { ...authDto, refreshToken: 'would-be-stolen' } } }));

    await refreshSession();

    expect(Object.keys(localStorage).some((k) => (localStorage.getItem(k) ?? '').includes('would-be-stolen'))).toBe(false);
  });
});

describe('silent refresh on a 401', () => {
  it('refreshes once through the cookie, then retries the original request with the new token', async () => {
    setTokens('expired');
    let calls = 0;
    stubAdapter((cfg) => {
      if (cfg.url === '/auth/refresh') return { status: 200, data: { data: authDto } };
      calls += 1;
      return calls === 1
        ? { status: 401, data: { error: { code: 'UNAUTHORIZED', message: 'expired' } } }
        : { status: 200, data: { data: { ok: true } } };
    });

    const response = await client.get('/tasks');

    expect(response.data).toEqual({ ok: true });
    expect(sent.map((c) => c.url)).toEqual(['/tasks', '/auth/refresh', '/tasks']);
    expect(getAccessToken()).toBe('access-2');
    expect(String(sent[2].headers.Authorization)).toBe('Bearer access-2');
  });
});
