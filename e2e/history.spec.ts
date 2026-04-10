import { test, expect } from '@playwright/test';
import { USERS, TEST_PASSWORD } from './fixtures/test-users';
import { loginAs } from './helpers/auth';

// ── Constants ────────────────────────────────────────────────────────────────

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';
const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const PROJECT_ID = 'dme-portal-prototype';
const FAKE_API_KEY = 'fake-api-key';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getIdToken(email: string, password: string): Promise<string> {
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FAKE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error(`signIn failed for ${email}: ${res.status}`);
  return (await res.json()).idToken as string;
}

// ── 1. Append-only timeline through full lifecycle ──────────────────────────

test('document history records every status transition in order', async ({ browser }) => {
  // Step 1 — nurse creates a request via REST (faster than UI for setup) using
  // the application's expected schema. We use a unique marker in the
  // justification field so we can find it later.
  const marker = `e2e-history-${Date.now()}`;
  const nurseToken = await getIdToken(USERS.nurse.email, TEST_PASSWORD);

  const createRes = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/requests`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nurseToken}`,
      },
      body: JSON.stringify({
        fields: {
          patientId: { stringValue: 'p1' },
          submittedBy: { stringValue: USERS.nurse.uid },
          status: { stringValue: 'pending' },
          createdAt: { integerValue: String(Date.now()) },
          updatedAt: { integerValue: String(Date.now()) },
          details: {
            mapValue: {
              fields: {
                type: { stringValue: 'dme' },
                equipmentId: { stringValue: 'mob-001' },
                equipmentName: { stringValue: '4 Wheeled Walker' },
                icd10Code: { stringValue: 'I50.9' },
                icd10Description: { stringValue: 'Heart failure' },
                urgency: { stringValue: 'routine' },
                justification: { stringValue: marker },
              },
            },
          },
          history: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      action: { stringValue: 'created' },
                      actorId: { stringValue: USERS.nurse.uid },
                      actorName: { stringValue: USERS.nurse.displayName },
                      actorRole: { stringValue: 'nurse' },
                      timestamp: { integerValue: String(Date.now()) },
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    }
  );
  expect(createRes.status).toBe(200);
  const createdDoc = await createRes.json();
  const requestId = (createdDoc.name as string).split('/').pop()!;

  // Step 2 — admin signs in via UI and transitions the request through rmi → approved
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await loginAs(adminPage, USERS.admin.email);
  await adminPage.getByRole('button', { name: 'Requests' }).click();
  await expect(adminPage.getByText(marker).first()).toBeVisible({ timeout: 10000 });
  await adminPage.getByText(marker).first().click();

  // Wait for the request detail view to load
  await expect(adminPage.getByText('Document History')).toBeVisible({ timeout: 10000 });

  // Add notes and click Request Info (rmi)
  await adminPage
    .getByPlaceholder(/Add a note for the staff member/i)
    .fill('Need additional clinical justification.');
  await adminPage.getByRole('button', { name: /request info/i }).click();

  // Wait for the rmi entry to appear in the timeline
  await expect(adminPage.getByText(/More info requested/i)).toBeVisible({ timeout: 10000 });

  // Now approve the request
  await adminPage
    .getByPlaceholder(/Add a note for the staff member/i)
    .fill('Approved after review.');
  await adminPage.getByRole('button', { name: /^approve$/i }).click();

  // Wait for the approved entry to appear
  await expect(adminPage.getByText(/^Approved$/i).first()).toBeVisible({ timeout: 10000 });

  // Step 3 — verify all three history entries are present in the document
  const adminToken = await getIdToken(USERS.admin.email, TEST_PASSWORD);
  const finalRes = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/requests/${requestId}`,
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );
  expect(finalRes.status).toBe(200);
  const finalDoc = await finalRes.json();
  const historyValues = finalDoc.fields.history.arrayValue.values as Array<{
    mapValue: { fields: Record<string, { stringValue?: string }> };
  }>;
  const actions = historyValues.map((v) => v.mapValue.fields.action.stringValue);
  expect(actions).toEqual(['created', 'rmi', 'approved']);

  await adminCtx.close();
});

// ── 2. Non-admin cannot mutate request history ──────────────────────────────

test('non-admin user cannot update a request (history is rules-protected)', async () => {
  // Get a nurse token (non-admin)
  const nurseToken = await getIdToken(USERS.nurse.email, TEST_PASSWORD);

  // Attempt to PATCH the seeded request r2 (which was approved during seeding)
  // to add a fake history entry. The rule `allow update: if isAdmin();` should
  // reject this with 403.
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/requests/r2`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nurseToken}`,
      },
      body: JSON.stringify({
        fields: {
          history: {
            arrayValue: {
              values: [
                {
                  mapValue: {
                    fields: {
                      action: { stringValue: 'denied' },
                      actorId: { stringValue: USERS.nurse.uid },
                      actorName: { stringValue: 'Forged' },
                      actorRole: { stringValue: 'nurse' },
                      timestamp: { integerValue: String(Date.now()) },
                    },
                  },
                },
              ],
            },
          },
        },
      }),
    }
  );

  expect(res.status).toBe(403);
});

// ── 3. Request documents cannot be deleted ──────────────────────────────────

test('request documents cannot be deleted (audit retention)', async () => {
  // Even an admin should be unable to delete a request document — the rule is
  // `allow delete: if false;` to satisfy HIPAA record retention.
  const adminToken = await getIdToken(USERS.admin.email, TEST_PASSWORD);

  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/requests/r2`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );

  expect(res.status).toBe(403);
});
