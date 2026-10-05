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
- `E2E_RESET_SEED=1` — POST `/api/v1/demo/reset` before the suite (dev only; DB owner role).
- `E2E_DEMO_PASSWORD` — override the shared persona password (default `Demo@12345!`).

## What it covers
- Capability-based nav gating (engineer vs PmOrAbove) + route-guard redirects.
- Audit Log = Head of R&D only (HeadOnly).
- Thresholds editing = Head of PMO only; other heads view-only.
- Wiki index filtered by project access, including the assignee-only and
  cross-team membership cases.

These are stable selectors (roles, link text, the `ErrorPage` copy, wiki titles),
but if a selector drifts, update it here rather than loosening the assertion.
