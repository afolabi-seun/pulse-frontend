import { Page } from '@playwright/test';
import { DEMO_PASSWORD } from './personas';

/** Logs in through the real login form and waits for the dashboard to load. */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/dashboard');
}

/** The sidebar navigation region (aria-label="Main navigation"). */
export function nav(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}
