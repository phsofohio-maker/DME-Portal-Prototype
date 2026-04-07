import { test, expect } from '@playwright/test';

test('sanity - login screen loads', async ({ page }) => {
  page.on('console', (msg) => console.log(`[${msg.type()}] ${msg.text()}`));

  // Log ALL responses
  page.on('response', (res) => {
    console.log(`[response:${res.status()}] ${res.url().substring(0, 120)}`);
  });

  await page.goto('/');
  await expect(page).toHaveTitle('Parrish Health DME Portal');
  await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 20000 });
});
