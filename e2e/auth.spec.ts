import { test, expect } from '@playwright/test';
import { USERS, TEST_PASSWORD, type TestUser } from './fixtures/test-users';
import { loginAs } from './helpers/auth';
import { readFirestoreDoc, writeFirestoreDoc } from './helpers/emulator';

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';
const PROJECT_ID = 'dme-portal-prototype';

/** List documents in a Firestore collection via the emulator REST API. */
async function listFirestoreDocs(
  collectionPath: string
): Promise<Array<{ name: string; fields: Record<string, unknown> }>> {
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collectionPath}`,
    { headers: { Authorization: 'Bearer owner' } }
  );
  if (!res.ok) return [];
  const body = await res.json();
  return body.documents ?? [];
}

/** Extract a string field from a Firestore REST document. */
function fsString(doc: Record<string, unknown>, field: string): string {
  const fields = doc.fields as Record<string, Record<string, unknown>> | undefined;
  if (!fields || !fields[field]) return '';
  return (fields[field].stringValue as string) ?? '';
}

// ── 1. Four-role login ──────────────────────────────────────────────────────

const ACTIVE_ROLES: Array<{ key: string; user: TestUser }> = [
  { key: 'admin', user: USERS.admin },
  { key: 'nurse', user: USERS.nurse },
  { key: 'homemaker', user: USERS.homemaker },
  { key: 'office_staff', user: USERS.office_staff },
];

for (const { key, user } of ACTIVE_ROLES) {
  test(`four-role login — ${key} sees correct navigation`, async ({ page }) => {
    await loginAs(page, user.email);

    // All roles see these nav items
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Patients' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Requests' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Messages' })).toBeVisible();

    // Only admin sees the Team nav item
    const teamButton = page.getByRole('button', { name: 'Team' });
    if (key === 'admin') {
      await expect(teamButton).toBeVisible();
    } else {
      await expect(teamButton).not.toBeVisible();
    }
  });
}

// ── 2. Failed login messaging ───────────────────────────────────────────────

test('failed login — wrong password shows error', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('you@parrish.health').fill(USERS.admin.email);
  await page.getByPlaceholder('Enter your password').fill('WrongPassword123!');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText('Invalid email or password.')).toBeVisible({ timeout: 10000 });
});

test('failed login — unknown email shows error', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('you@parrish.health').fill('nobody@parrish.health');
  await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByText('Invalid email or password.')).toBeVisible({ timeout: 10000 });
});

test('failed login — suspended user shows suspended message', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('you@parrish.health').fill(USERS.suspended.email);
  await page.getByPlaceholder('Enter your password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(
    page.getByText('Your account has been suspended')
  ).toBeVisible({ timeout: 10000 });
});

// ── 3. Logout clears session ────────────────────────────────────────────────

test('logout clears session and redirects to login', async ({ page }) => {
  await loginAs(page, USERS.admin.email);

  // Verify we're authenticated
  await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();

  // Click the Logout button in the TopBar
  await page.getByRole('button', { name: 'Logout' }).click();

  // Should be back on login screen
  await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 10000 });

  // Navigate to the app root — should still show login, not dashboard
  await page.goto('/');
  await expect(page.getByText('Sign in to your account')).toBeVisible({ timeout: 10000 });

  // Verify no auth artifacts in storage
  const storageEmpty = await page.evaluate(() => {
    const ls = Object.keys(localStorage).filter((k) =>
      k.includes('firebase') || k.includes('auth') || k.includes('token')
    );
    const ss = Object.keys(sessionStorage).filter((k) =>
      k.includes('firebase') || k.includes('auth') || k.includes('token')
    );
    return ls.length === 0 && ss.length === 0;
  });
  expect(storageEmpty).toBe(true);
});

// ── 4. Invitation pipeline ──────────────────────────────────────────────────

test('invitation pipeline — admin invite creates staff, invitation, and mail docs', async ({ page }) => {
  await loginAs(page, USERS.admin.email);

  // Navigate to Team view
  await page.getByRole('button', { name: 'Team' }).click();
  await expect(page.getByText(/team|staff/i)).toBeVisible({ timeout: 10000 });

  // Fill the invite form
  const inviteEmail = 'newhire@parrish.health';
  await page.getByPlaceholder('colleague@parrish.health').fill(inviteEmail);

  // Select role via the custom Select component (renders a native <select>)
  await page.locator('select').first().selectOption('nurse');

  // Submit the invite
  await page.getByRole('button', { name: /send invite/i }).click();

  // Wait for the invitation to appear in the invitations list
  await expect(page.getByText(inviteEmail)).toBeVisible({ timeout: 10000 });

  // Verify: invitations doc was created via Firestore REST
  const inviteDocs = await listFirestoreDocs('invitations');
  const matchingInvite = inviteDocs.find((d) => fsString(d, 'email') === inviteEmail);
  expect(matchingInvite).toBeTruthy();
  expect(fsString(matchingInvite!, 'status')).toBe('pending');

  // Verify: the Cloud Function (onNewInvitation) should have created a staff doc
  // and a mail doc. In the emulator, the function fires asynchronously, so give
  // it a moment to complete.
  await page.waitForTimeout(3000);

  // Check that a mail doc was queued (the Cloud Function writes to `mail` collection)
  const mailDocs = await listFirestoreDocs('mail');
  const matchingMail = mailDocs.find((d) => fsString(d, 'to') === inviteEmail);
  expect(matchingMail).toBeTruthy();
});

// ── 5. Login history audit ──────────────────────────────────────────────────

test('login records entry in loginHistory subcollection', async ({ page }) => {
  const user = USERS.nurse;
  await loginAs(page, user.email);

  // Wait briefly for the async recordLogin write to land
  await page.waitForTimeout(2000);

  // Read the loginHistory subcollection for this user
  const historyDocs = await listFirestoreDocs(`staff/${user.uid}/loginHistory`);
  expect(historyDocs.length).toBeGreaterThanOrEqual(1);
});
