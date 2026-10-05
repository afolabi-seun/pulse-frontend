# E2E access-control regression suite

Playwright tests that drive the real UI as each demo persona and assert the
authorization model end-to-end — locking in the role-drift / access fixes.
Personas and expected behaviour: `../../../docs/demo-personas.md`.

## One-time setup

```bash
cd src/frontend
npm install
npx playwright install chromium
```

## Running

The suite needs the **full stack running with seeded data**: the API (in
`Development` for the reset endpoint), Postgres, and the SPA it points at.

```bash
# 1. Start backend + frontend (e.g. dotnet run + npm run dev), then:

# Reseed demo data and run against the dev server:
E2E_RESET_SEED=1 npm run test:e2e

# Or against an already-seeded environment:
PLAYWRIGHT_BASE_URL=https://your-host npm run test:e2e

# Interactive:
npm run test:e2e:ui
```

## Env vars
- `PLAYWRIGHT_BASE_URL` — app URL (default `http://localhost:5173`).
- `E2E_API_URL` — the API's own URL, when the reset should go there directly instead of through the app's `/api` proxy (default: `PLAYWRIGHT_BASE_URL`). CI sets it. Set `VITE_PROXY_TARGET` too if the API is not on `localhost:5284`, so the dev server's proxy does not point somewhere else.
- `E2E_RESET_SEED=1` — POST `/api/v1/demo/reset` before the suite (dev only; DB owner role).
- `E2E_DEMO_PASSWORD` — override the shared persona password (default `Demo@12345!`).

## What it covers
- Capability-based nav gating (engineer vs PmOrAbove) + route-guard redirects.
- Audit Log = Head of R&D only (HeadOnly).
- Thresholds editing = Head of PMO only; other heads view-only.
- The wiki is open to every signed-in user: pages of projects the user is not on are visible too.
- The session lives in an httpOnly cookie, not in script-readable storage: the cookie's flags, a reload restoring the session through it,
  the refresh response carrying no token, the client-header check, and sign-out revoking the token on the server.

These are stable selectors (roles, link text, the `ErrorPage` copy, wiki titles),
but if a selector drifts, update it here rather than loosening the assertion.
