import { type Page } from '@playwright/test';
import { TEST_PASSWORD } from '../fixtures/test-users';

/**
 * Sign in via the login form UI.
 * Waits for the dashboard to load after successful login.
 */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto('/');

  // Fill the login form
  await page.getByPlaceholder('you@parrish.health').fill(email);
  await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for the authenticated shell to render (sidebar with Dashboard)
  await page.waitForSelector('text=Dashboard', { timeout: 15000 });
}
