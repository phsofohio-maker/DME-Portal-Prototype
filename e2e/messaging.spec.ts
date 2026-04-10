import { test, expect, type Page } from '@playwright/test';
import { USERS, TEST_PASSWORD } from './fixtures/test-users';
import { loginAs } from './helpers/auth';

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

function fsString(doc: Record<string, unknown>, field: string): string {
  const fields = doc.fields as Record<string, Record<string, unknown>> | undefined;
  if (!fields || !fields[field]) return '';
  return (fields[field].stringValue as string) ?? '';
}

/** Open the Messages view, compose a new message, and send it. */
async function composeAndSend(
  page: Page,
  recipientUid: string,
  body: string
): Promise<void> {
  await page.getByRole('button', { name: 'Messages' }).click();
  await expect(page.getByText('Conversations')).toBeVisible({ timeout: 10000 });

  // Click "New" to open compose form
  await page.getByRole('button', { name: /^new$/i }).click();
  await expect(page.getByText('New Message')).toBeVisible({ timeout: 5000 });

  // Pick recipient from the "To" select
  await page.locator('select').first().selectOption(recipientUid);

  // Type body
  await page.getByPlaceholder('Write your message…').fill(body);

  // Click Send
  await page.getByRole('button', { name: /^send$/i }).click();
}

// ── 1. Encrypted at rest ────────────────────────────────────────────────────

test('messages are encrypted at rest in Firestore', async ({ page }) => {
  const plaintext = 'Patient cleared for discharge — please coordinate transport.';

  // Sign in as nurse and send a message to the admin
  await loginAs(page, USERS.nurse.email);
  await composeAndSend(page, USERS.admin.uid, plaintext);

  // Wait for the write to complete
  await page.waitForTimeout(2000);

  // Inspect the raw Firestore communications collection via REST
  const docs = await listFirestoreDocs('communications');

  // Find the doc we just wrote (sender = nurse, recipient = admin, has iv)
  const matching = docs.find(
    (d) =>
      fsString(d, 'senderId') === USERS.nurse.uid &&
      fsString(d, 'recipientId') === USERS.admin.uid &&
      !!fsString(d, 'iv')
  );
  expect(matching).toBeTruthy();

  // The stored body must NOT contain the plaintext or any substring of it
  const storedBody = fsString(matching!, 'messageBody');
  expect(storedBody).not.toBe(plaintext);
  expect(storedBody).not.toContain('discharge');
  expect(storedBody).not.toContain('transport');
  expect(storedBody.length).toBeGreaterThan(0);

  // The IV field must be present (proves AES-GCM encryption was applied)
  expect(fsString(matching!, 'iv').length).toBeGreaterThan(0);
});

// ── 2. Decrypted in UI ──────────────────────────────────────────────────────

test('recipient sees the decrypted message body in the UI', async ({ browser }) => {
  const plaintext = 'Lab results ready for review at your convenience.';

  // Sender context: nurse sends a message
  const senderCtx = await browser.newContext();
  const senderPage = await senderCtx.newPage();
  await loginAs(senderPage, USERS.nurse.email);
  await composeAndSend(senderPage, USERS.admin.uid, plaintext);
  await senderPage.waitForTimeout(1500);
  await senderCtx.close();

  // Recipient context: admin opens the thread
  const recipientCtx = await browser.newContext();
  const recipientPage = await recipientCtx.newPage();
  await loginAs(recipientPage, USERS.admin.email);
  await recipientPage.getByRole('button', { name: 'Messages' }).click();
  await expect(recipientPage.getByText('Conversations')).toBeVisible({ timeout: 10000 });

  // Click the thread for the nurse
  await recipientPage.getByText(USERS.nurse.displayName).first().click();

  // The decrypted plaintext should be visible in the thread
  await expect(recipientPage.getByText(plaintext)).toBeVisible({ timeout: 10000 });
  await recipientCtx.close();
});

// ── 3. Real-time delivery (no reload) ───────────────────────────────────────

test('real-time delivery — recipient sees message without page reload', async ({ browser }) => {
  const plaintext = `Real-time test ${Date.now()}`;

  // Open recipient session first
  const recipientCtx = await browser.newContext();
  const recipientPage = await recipientCtx.newPage();
  await loginAs(recipientPage, USERS.admin.email);
  await recipientPage.getByRole('button', { name: 'Messages' }).click();
  await expect(recipientPage.getByText('Conversations')).toBeVisible({ timeout: 10000 });
  // Open the existing thread with the nurse if it exists; otherwise the message
  // will create a new thread that the recipient must click into.
  const nurseThread = recipientPage.getByText(USERS.nurse.displayName).first();
  if (await nurseThread.isVisible({ timeout: 3000 }).catch(() => false)) {
    await nurseThread.click();
  }

  // Sender: in a separate context, send a new message
  const senderCtx = await browser.newContext();
  const senderPage = await senderCtx.newPage();
  await loginAs(senderPage, USERS.nurse.email);
  await composeAndSend(senderPage, USERS.admin.uid, plaintext);

  // Recipient should see it appear within 5 seconds — without page.reload()
  // (If recipient wasn't already in the thread, click it now.)
  if (!(await recipientPage.getByText(plaintext).isVisible().catch(() => false))) {
    await recipientPage.getByText(USERS.nurse.displayName).first().click();
  }
  await expect(recipientPage.getByText(plaintext)).toBeVisible({ timeout: 5000 });

  await senderCtx.close();
  await recipientCtx.close();
});

// ── 4. Access control — third party cannot read ────────────────────────────

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const FAKE_API_KEY = 'fake-api-key';

/** Sign in via the Auth emulator REST API and return an ID token. */
async function getIdToken(email: string, password: string): Promise<string> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error(`signIn failed for ${email}: ${res.status} ${await res.text()}`);
  const body = await res.json();
  return body.idToken as string;
}

test('homemaker cannot read a nurse↔admin message thread', async ({ page }) => {
  // Sign in as nurse via UI, send a message to admin
  await loginAs(page, USERS.nurse.email);
  await composeAndSend(page, USERS.admin.uid, 'Confidential coordination note.');
  await page.waitForTimeout(2000);

  // Find the doc we just created via the admin REST API
  const docs = await listFirestoreDocs('communications');
  const matching = docs.find(
    (d) =>
      fsString(d, 'senderId') === USERS.nurse.uid &&
      fsString(d, 'recipientId') === USERS.admin.uid
  );
  expect(matching).toBeTruthy();
  const docName = (matching as { name: string }).name;
  const docId = docName.split('/').pop()!;

  // Get a real ID token for the homemaker (not on the thread)
  const homemakerToken = await getIdToken(USERS.homemaker.email, TEST_PASSWORD);

  // Attempt to read the message as the homemaker through the rules-enforced
  // Firestore REST endpoint. This must be rejected with 403.
  const readRes = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/communications/${docId}`,
    { headers: { Authorization: `Bearer ${homemakerToken}` } }
  );
  expect(readRes.status).toBe(403);
});
