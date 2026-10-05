# Pulse — Frontend

React 18 + TypeScript SPA served by nginx in production.

---

## Stack

| Concern | Tool |
|---|---|
| Framework | React 18 |
| Language | TypeScript 5 |
| Build tool | Vite |
| Server-state | TanStack Query |
| Routing | React Router v6 |
| Forms | React Hook Form |
| Styling | Tailwind CSS + shadcn/ui |
| Charts | Chart.js |
| Real-time | SignalR |
| Tests | Vitest + React Testing Library |

---

## Prerequisites

- Node.js 20 LTS
- pnpm (`npm install -g pnpm`)
- Backend running at `http://localhost:5284` (see `src/backend`)

---

## Local development

```bash
pnpm install
pnpm dev        # dev server at http://localhost:5173
pnpm test       # Vitest
pnpm lint       # ESLint
pnpm build      # production build → dist/
```

The Vite dev server proxies `/api` and `/hubs` to the backend automatically — no `.env` needed for local development.

---

## Environment variables

All variables are prefixed with `VITE_` and baked into the bundle at build time.

> **`VITE_*` is public.** Vite inlines these into the JS bundle, so anyone can read them in DevTools — only put non-secret config here, never a real secret.

| Variable | Description | Default |
|---|---|---|
| `VITE_API_BASE_URL` | Absolute URL of the backend API. Leave empty when the frontend and API are on the same origin (nginx proxy). | `http://localhost:5284` |
| `VITE_SHOW_DEMO_BANNER` | Show the demo credentials banner. Set to `true` on demo deployments. | `false` |
| `VITE_DEMO_PASSWORD` | Shared password shown in the demo banner. Only set on a throwaway demo build — never a real password. | _(unset)_ |
| `VITE_DEMO_PERSONAS` | JSON array of `{email, role}` shown in the demo banner. | _(unset)_ |

The demo banner renders only when `VITE_SHOW_DEMO_BANNER=true` **and** `VITE_DEMO_PASSWORD` is set; with them unset, no credentials are compiled into the bundle.

**Build-time only (not a `VITE_` var):** `BUILD_SOURCEMAP=true` makes `vite build` emit *hidden* sourcemaps (for an error tracker); leave it unset for production so no readable source ships in `dist/`.

### `.env` workflow

`.env.example` is committed and shows the available variables with local-dev defaults. Copy it to `.env` to override values:

```bash
cp .env.example .env
# edit .env with your values
```

**The committed `.env` file** contains the demo server configuration and is tracked in git. Future local changes to it are intentionally ignored by Git using `skip-worktree`:

```bash
# Already applied — no action needed on clone
git update-index --skip-worktree .env
```

This means your local `.env` edits won't show up in `git status` or get staged accidentally.

#### Updating `.env` in the repo

When the `.env` needs to change (e.g. new server URL), temporarily lift the flag, commit, then re-apply:

```bash
git update-index --no-skip-worktree .env
# make your changes
git add .env
git commit -m "chore: update .env for new server"
git update-index --skip-worktree .env
```

---

## Deployment

The pipeline (`bitbucket-pipelines.yml`) runs on the `dev` branch:

1. **SonarQube analysis** — code quality gate
2. **Build** — `pnpm build` produces `dist/`
3. **SCP** — copies `dist/` to the server
4. **nginx restart** — serves the new build

The `.env` file is committed, so no extra pipeline configuration is needed — the build picks it up automatically.

---

## Folder conventions

```
src/
├── api/          TanStack Query hooks + axios calls — one file per domain
├── components/   Shared UI components (layout, ui primitives)
├── hooks/        Custom React hooks
├── lib/          Utilities (dates, auth tokens, errors)
├── pages/        One folder per route group
├── types/        api.ts — TypeScript interfaces mirroring API response shapes
└── main.tsx

e2e/             Playwright end-to-end tests (separate from Vitest)
```

**Rule:** components never call `axios` directly — all HTTP calls go through `src/api/`.

## Testing

- **Unit / component:** `npm test` (Vitest + React Testing Library), scoped to `src/**`.
- **End-to-end:** `npm run test:e2e` (Playwright) — drives the running app as each demo persona and asserts the authorization model. Needs the full stack + seeded data; see [`e2e/README.md`](./e2e/README.md).
