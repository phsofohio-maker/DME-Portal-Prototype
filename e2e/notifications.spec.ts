import { test, expect } from '@playwright/test';
import { USERS, TEST_PASSWORD } from './fixtures/test-users';

// ── Constants ────────────────────────────────────────────────────────────────

const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';
const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const PROJECT_ID = 'dme-portal-prototype';
const FAKE_API_KEY = 'fake-api-key';

// PHI tokens that must NEVER appear in any outbound email body. Drawn from
// the seed-data fixtures (ICD-10 codes, drug names, diagnosis text). Add to
// this list as new clinical fields are introduced.
const PHI_FORBIDDEN_TOKENS = [
  'I50.9',
  'G47.33',
  'E11.9',
  'I10',
  'COPD',
  'Heart failure',
  'Obstructive Sleep Apnea',
  'Diabetes',
  'Hypertension',
  'Penicillin',
  'Sulfa',
  'Codeine',
];

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

interface MailDoc {
  to: string;
  subject: string;
  html: string;
}

/** List documents in `mail` and project them into a flat shape. */
async function listMailDocs(): Promise<MailDoc[]> {
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/mail`,
    { headers: { Authorization: 'Bearer owner' } }
  );
  if (!res.ok) return [];
  const body = await res.json();
  const docs = (body.documents ?? []) as Array<{
    fields: {
      to?: { stringValue?: string };
      message?: {
        mapValue?: {
          fields?: {
            subject?: { stringValue?: string };
            html?: { stringValue?: string };
          };
        };
      };
    };
  }>;
  return docs.map((d) => ({
    to: d.fields.to?.stringValue ?? '',
    subject: d.fields.message?.mapValue?.fields?.subject?.stringValue ?? '',
    html: d.fields.message?.mapValue?.fields?.html?.stringValue ?? '',
  }));
}

async function patchStaffPrefs(
  uid: string,
  prefs: { emailOnStatusChange?: boolean; emailOnNewMessage?: boolean }
): Promise<void> {
  const fields: Record<string, unknown> = {};
  if (prefs.emailOnStatusChange !== undefined) {
    fields.emailOnStatusChange = { booleanValue: prefs.emailOnStatusChange };
  }
  if (prefs.emailOnNewMessage !== undefined) {
    fields.emailOnNewMessage = { booleanValue: prefs.emailOnNewMessage };
  }
  await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/staff/${uid}?updateMask.fieldPaths=notificationPrefs`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        fields: { notificationPrefs: { mapValue: { fields } } },
      }),
    }
  );
}

/** Wait until predicate(mailDocs) returns true, polling every 500ms. */
async function waitForMail(
  predicate: (mail: MailDoc[]) => boolean,
  timeoutMs = 10_000
): Promise<MailDoc[]> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const docs = await listMailDocs();
    if (predicate(docs)) return docs;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Timed out waiting for mail predicate');
}

function assertNoPhi(html: string): void {
  for (const token of PHI_FORBIDDEN_TOKENS) {
    expect(html, `mail body contains forbidden PHI token: ${token}`).not.toContain(token);
  }
}

/** Submit a request directly via Firestore as the nurse, returning the new request id. */
async function submitRequestAsNurse(marker: string): Promise<string> {
  const nurseToken = await getIdToken(USERS.nurse.email, TEST_PASSWORD);
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/requests`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
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
                icd10Description: { stringValue: 'Heart failure, unspecified' },
                urgency: { stringValue: 'routine' },
                justification: { stringValue: `${marker} — patient with COPD and Diabetes needs walker.` },
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
  if (res.status !== 200) throw new Error(`Failed to create request: ${res.status} ${await res.text()}`);
  const doc = await res.json();
  return (doc.name as string).split('/').pop()!;
}

async function setRequestStatus(
  requestId: string,
  status: 'approved' | 'denied' | 'rmi',
  adminNotes: string
): Promise<void> {
  const adminToken = await getIdToken(USERS.admin.email, TEST_PASSWORD);
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/requests/${requestId}?updateMask.fieldPaths=status&updateMask.fieldPaths=adminNotes&updateMask.fieldPaths=processedBy&updateMask.fieldPaths=processedAt&updateMask.fieldPaths=updatedAt`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        fields: {
          status: { stringValue: status },
          adminNotes: { stringValue: adminNotes },
          processedBy: { stringValue: USERS.admin.uid },
          processedAt: { integerValue: String(Date.now()) },
          updatedAt: { integerValue: String(Date.now()) },
        },
      }),
    }
  );
  if (res.status !== 200) throw new Error(`Failed to update request: ${res.status} ${await res.text()}`);
}

// ── 1. New request → admin emails queued, no PHI ────────────────────────────

test('new request triggers an admin email with zero PHI in the body', async () => {
  const marker = `e2e-newreq-${Date.now()}`;
  await submitRequestAsNurse(marker);

  const mail = await waitForMail(
    (docs) => docs.some((d) => d.to === USERS.admin.email && d.subject.includes('New')),
    15_000
  );
  const adminMail = mail.filter((d) => d.to === USERS.admin.email && d.subject.includes('New'));
  expect(adminMail.length).toBeGreaterThanOrEqual(1);

  // No PHI tokens in any of the admin mail bodies
  for (const m of adminMail) {
    assertNoPhi(m.html);
  }
});

// ── 2. Status change → requester email respects emailOnStatusChange pref ────

test('status change emails requester only when emailOnStatusChange is true', async () => {
  // First test: pref = TRUE → email IS queued
  await patchStaffPrefs(USERS.nurse.uid, { emailOnStatusChange: true, emailOnNewMessage: true });

  const marker1 = `e2e-status-on-${Date.now()}`;
  const id1 = await submitRequestAsNurse(marker1);
  await setRequestStatus(id1, 'approved', 'Approved on review.');

  await waitForMail(
    (docs) => docs.some((d) => d.to === USERS.nurse.email && d.subject.toLowerCase().includes('approved')),
    15_000
  );

  // Second test: pref = FALSE → no new email queued
  await patchStaffPrefs(USERS.nurse.uid, { emailOnStatusChange: false, emailOnNewMessage: true });

  const beforeCount = (await listMailDocs()).filter(
    (d) => d.to === USERS.nurse.email && d.subject.toLowerCase().includes('denied')
  ).length;

  const marker2 = `e2e-status-off-${Date.now()}`;
  const id2 = await submitRequestAsNurse(marker2);
  await setRequestStatus(id2, 'denied', 'Insufficient information.');

  // Wait briefly for the function to (not) fire
  await new Promise((r) => setTimeout(r, 5000));

  const afterCount = (await listMailDocs()).filter(
    (d) => d.to === USERS.nurse.email && d.subject.toLowerCase().includes('denied')
  ).length;
  expect(afterCount).toBe(beforeCount);

  // Reset prefs to default
  await patchStaffPrefs(USERS.nurse.uid, { emailOnStatusChange: true, emailOnNewMessage: true });
});

// ── 3. Status change emails contain zero PHI ────────────────────────────────

test('status change email body contains zero PHI tokens', async () => {
  await patchStaffPrefs(USERS.nurse.uid, { emailOnStatusChange: true, emailOnNewMessage: true });

  const marker = `e2e-statusphi-${Date.now()}`;
  const id = await submitRequestAsNurse(marker);
  await setRequestStatus(id, 'approved', 'Approved without further review.');

  const mail = await waitForMail(
    (docs) => docs.some((d) => d.to === USERS.nurse.email && d.subject.toLowerCase().includes('approved')),
    15_000
  );
  const approvedMail = mail.filter(
    (d) => d.to === USERS.nurse.email && d.subject.toLowerCase().includes('approved')
  );
  expect(approvedMail.length).toBeGreaterThanOrEqual(1);

  for (const m of approvedMail) {
    assertNoPhi(m.html);
  }
});

// ── 4. New message → recipient email respects emailOnNewMessage pref ────────

test('new message emails recipient only when emailOnNewMessage is true', async () => {
  // pref = TRUE → email queued
  await patchStaffPrefs(USERS.admin.uid, { emailOnStatusChange: true, emailOnNewMessage: true });

  // Create a message directly via Firestore (bypasses the encryption layer
  // because we only need to trigger onNewMessage). Use the nurse's token so
  // the rules accept the create.
  const nurseToken = await getIdToken(USERS.nurse.email, TEST_PASSWORD);
  const createMessage = async (markerBody: string) => {
    const res = await fetch(
      `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/communications`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nurseToken}` },
        body: JSON.stringify({
          fields: {
            senderId: { stringValue: USERS.nurse.uid },
            recipientId: { stringValue: USERS.admin.uid },
            messageBody: { stringValue: markerBody },
            iv: { stringValue: 'test-iv' },
            read: { booleanValue: false },
            createdAt: { integerValue: String(Date.now()) },
            ephemeral: { booleanValue: false },
          },
        }),
      }
    );
    if (res.status !== 200) throw new Error(`Failed to create message: ${res.status}`);
  };

  await createMessage(`marker-on-${Date.now()}`);

  await waitForMail(
    (docs) => docs.some((d) => d.to === USERS.admin.email && d.subject.toLowerCase().includes('new message')),
    15_000
  );

  // pref = FALSE → no new email queued
  await patchStaffPrefs(USERS.admin.uid, { emailOnStatusChange: true, emailOnNewMessage: false });

  const beforeCount = (await listMailDocs()).filter(
    (d) => d.to === USERS.admin.email && d.subject.toLowerCase().includes('new message')
  ).length;

  await createMessage(`marker-off-${Date.now()}`);
  await new Promise((r) => setTimeout(r, 5000));

  const afterCount = (await listMailDocs()).filter(
    (d) => d.to === USERS.admin.email && d.subject.toLowerCase().includes('new message')
  ).length;
  expect(afterCount).toBe(beforeCount);

  // Reset
  await patchStaffPrefs(USERS.admin.uid, { emailOnStatusChange: true, emailOnNewMessage: true });
});

// ── 5. Suspended admins do not receive new request emails ───────────────────

test('suspended admins are not emailed when a new request is submitted', async () => {
  // The seeded "suspended" user has role "nurse" but for this test we want a
  // suspended admin. Mark a fresh staff doc as a suspended admin via REST.
  const suspendedAdminUid = 'test-suspended-admin-uid';
  const suspendedAdminEmail = 'suspended-admin@parrish.health';
  await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/staff/${suspendedAdminUid}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: suspendedAdminUid },
          email: { stringValue: suspendedAdminEmail },
          displayName: { stringValue: 'Suspended Admin' },
          role: { stringValue: 'admin' },
          status: { stringValue: 'suspended' },
          hasCompletedOnboarding: { booleanValue: true },
          createdAt: { integerValue: String(Date.now()) },
          updatedAt: { integerValue: String(Date.now()) },
        },
      }),
    }
  );

  const marker = `e2e-suspended-admin-${Date.now()}`;
  await submitRequestAsNurse(marker);

  // Wait for the active admin's mail to arrive (proves the function ran)
  await waitForMail(
    (docs) => docs.some((d) => d.to === USERS.admin.email && d.subject.includes('New')),
    15_000
  );

  // Verify the suspended admin received NO mail
  const allMail = await listMailDocs();
  const suspendedMail = allMail.filter((d) => d.to === suspendedAdminEmail);
  expect(suspendedMail.length).toBe(0);
});
