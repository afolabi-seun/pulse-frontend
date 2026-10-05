import { test, expect, type Page } from '@playwright/test';
import { login, nav } from './fixtures/auth';
import { Personas } from './fixtures/personas';

// The refresh token lives in an httpOnly cookie the server sets, not in storage a script on the page can read. This drives the real login,
// reload and sign-out flow end to end, across the SPA and the API, which neither repo's own CI can do alone.
// Needs the full stack (see README.md); API_URL is where the API itself is, for the few checks that talk to it directly.

const REFRESH_COOKIE = 'pulse_refresh';
const CLIENT_HEADER = { 'X-Pulse-Client': 'web' };
const API_URL = process.env.E2E_API_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

/** The first-visit product tour sits over the page and swallows clicks until it is dismissed. */
async function dismissTour(page: Page) {
  const skip = page.getByRole('button', { name: 'Skip tour' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

test.describe('The session lives in an httpOnly cookie', () => {
  test('after login the refresh token is an httpOnly, SameSite=Strict cookie and nothing a script can read', async ({ page, context }) => {
    await login(page, Personas.emma.email);

    const refresh = (await context.cookies()).find((c) => c.name === REFRESH_COOKIE);
    expect(refresh, 'the refresh cookie is set').toBeDefined();
    expect(refresh!.httpOnly).toBe(true);
    expect(refresh!.sameSite).toBe('Strict');
    expect(refresh!.path).toBe('/api/v1/auth');

    const readable = await page.evaluate((name) => ({
      documentCookie: document.cookie,
      storageKeys: [...Object.keys(localStorage), ...Object.keys(sessionStorage)],
      storageHasToken: [...Object.values(localStorage), ...Object.values(sessionStorage)].some((v) => v.includes('refresh')),
      name,
    }), REFRESH_COOKIE);
    expect(readable.documentCookie).not.toContain(REFRESH_COOKIE);
    expect(readable.storageKeys).not.toContain(REFRESH_COOKIE);
    expect(readable.storageHasToken).toBe(false);
  });

  test('a reload restores the session through the cookie, and the refresh response carries no token', async ({ page }) => {
    await login(page, Personas.emma.email);

    const refreshed = page.waitForResponse((r) => r.url().includes('/auth/refresh') && r.request().method() === 'POST');
    await page.reload();
    const response = await refreshed;

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.data.accessToken).toBeTruthy();
    expect(body.data.refreshToken, 'a script that calls refresh must not be able to read the token').toBe('');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(nav(page)).toBeVisible();
  });

  test('a cookie refresh without the client header is refused', async ({ page, context, request }) => {
    await login(page, Personas.emma.email);
    const cookie = (await context.cookies()).find((c) => c.name === REFRESH_COOKIE)!;

    const forged = await request.post(`${API_URL}/api/v1/auth/refresh`, {
      headers: { Cookie: `${REFRESH_COOKIE}=${cookie.value}` },
      data: {},
    });

    expect(forged.status()).toBe(403);
  });

  test('signing out revokes the session on the server and clears the cookie', async ({ page, context, request }) => {
    await login(page, Personas.emma.email);
    const before = (await context.cookies()).find((c) => c.name === REFRESH_COOKIE)!;

    await dismissTour(page);
    const loggedOut = page.waitForResponse((r) => r.url().includes('/auth/logout'));
    await page.getByRole('button', { name: 'Sign out' }).click();
    expect((await loggedOut).status(), 'the logout request is authenticated and accepted').toBe(200);
    await expect(page).toHaveURL(/\/login/);

    expect((await context.cookies()).find((c) => c.name === REFRESH_COOKIE)).toBeUndefined();

    // The token it held must no longer work: signing out has to revoke it, not just forget it.
    const replay = await request.post(`${API_URL}/api/v1/auth/refresh`, {
      headers: { Cookie: `${REFRESH_COOKIE}=${before.value}`, ...CLIENT_HEADER },
      data: {},
    });
    expect(replay.status()).toBe(401);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
