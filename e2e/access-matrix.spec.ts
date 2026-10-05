import { test, expect } from '@playwright/test';
import { login, nav } from './fixtures/auth';
import { Personas } from './fixtures/personas';

// End-to-end regression for the authorization model. Each assertion maps to a
// fix in the role-drift / access-control work. Requires the demo seed data
// (docs/demo-personas.md) — run with E2E_RESET_SEED=1 to reseed automatically.

test.describe('Navigation gating (capability model)', () => {
  test('engineer sees no management/admin nav and is bounced from /engineers', async ({ page }) => {
    await login(page, Personas.emma.email);
    const sidebar = nav(page);
    await expect(sidebar.getByRole('link', { name: 'Engineers' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Projects' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Audit Log' })).toHaveCount(0);

    // Route guard redirects a forbidden direct-nav back to the dashboard.
    await page.goto('/engineers');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('project manager sees Engineers and Projects (PmOrAbove)', async ({ page }) => {
    await login(page, Personas.bob.email);
    const sidebar = nav(page);
    await expect(sidebar.getByRole('link', { name: 'Engineers' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Projects' })).toBeVisible();
  });
});

test.describe('Audit Log is Head of R&D only (HeadOnly)', () => {
  test('head_of_rd can open the audit log', async ({ page }) => {
    await login(page, Personas.alice.email);
    await expect(nav(page).getByRole('link', { name: 'Audit Log' })).toBeVisible();
    await page.goto('/admin/audit-log');
    await expect(page).toHaveURL(/\/admin\/audit-log$/);
  });

  test('head_of_product cannot (no nav link, direct nav bounced)', async ({ page }) => {
    await login(page, Personas.diana.email);
    await expect(nav(page).getByRole('link', { name: 'Audit Log' })).toHaveCount(0);
    await page.goto('/admin/audit-log');
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe('Thresholds editing is Head of PMO only (HeadOfPmoOnly)', () => {
  test('head_of_pmo can edit', async ({ page }) => {
    await login(page, Personas.nina.email);
    await page.goto('/admin/thresholds');
    await expect(page).toHaveURL(/\/admin\/thresholds$/);
    await expect(page.getByRole('button', { name: 'Save thresholds' })).toBeVisible();
  });

  test('other heads can view but not edit (AnyHead view, no Save)', async ({ page }) => {
    await login(page, Personas.diana.email);
    await page.goto('/admin/thresholds');
    await expect(page).toHaveURL(/\/admin\/thresholds$/);
    await expect(page.getByRole('button', { name: 'Save thresholds' })).toHaveCount(0);
  });
});

// The wiki is open: every signed-in user can read every project's pages, whether or not they are on that project. (A page can be marked
// "members only", which hides it from people outside the project; the demo seed has none, so this checks the open default.)
test.describe('Wiki is open to every signed-in user', () => {
  for (const [who, persona] of [
    ['a CIB-only member (frank)', Personas.frank],
    ['an assignee-only engineer (emma)', Personas.emma],
    ['a cross-team member (grace)', Personas.grace],
  ] as const) {
    test(`${who} sees the pages of both projects`, async ({ page }) => {
      await login(page, persona.email);
      await page.goto('/wiki');
      await expect(page.getByText('CIB Architecture Overview')).toBeVisible();
      await expect(page.getByText('OMS Delivery Pipeline')).toBeVisible();
    });
  }
});
