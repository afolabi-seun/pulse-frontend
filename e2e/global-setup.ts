import { request } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';
// Where the API is, when it is not reachable through the app's own /api proxy. The reset wipes the database, so it goes to exactly this URL.
const apiURL = process.env.E2E_API_URL ?? baseURL;

/**
 * Optionally reseed demo data before the suite so the persona matrix is
 * deterministic. Enable with E2E_RESET_SEED=1. Requires the API to be running in
 * Development (the /demo/reset endpoint is dev-only) connected as the DB owner
 * role (reset uses TRUNCATE). If left off, the suite assumes the data is already
 * seeded (e.g. you ran POST /api/v1/demo/reset by hand).
 */
export default async function globalSetup() {
  if (process.env.E2E_RESET_SEED !== '1') return;

  const ctx = await request.newContext({ baseURL: apiURL });
  const res = await ctx.post('/api/v1/demo/reset');
  if (!res.ok())
    throw new Error(`demo/reset failed (${res.status()}): ${await res.text()}`);
  await ctx.dispose();
}
