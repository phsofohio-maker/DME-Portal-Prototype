/**
 * test/rules/firestore.rules.test.ts — Firestore Security Rules test suite.
 *
 * Covers 100% of rule paths across all 9 collections:
 *   staff, requests, communications, invitations, audit_log,
 *   dme_catalog, patients, conversationKeys, notifications
 *
 * Prerequisites:
 *   npx firebase emulators:start --only firestore
 *   (default port 8080; project ID must be demo-*)
 *
 * Run:
 *   npm run test:rules
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
  describe,
  it,
} from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8');
const PROJECT_ID = 'demo-rules-test';

// ─── Staff fixture data ───────────────────────────────────────────────────────

const NOW = Date.now();

const ADMIN_DATA = {
  uid: 'admin-uid-1',
  email: 'admin@parrish.health',
  displayName: 'Admin User',
  role: 'admin',
  status: 'active',
  hasCompletedOnboarding: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const NURSE_DATA = {
  uid: 'nurse-uid-1',
  email: 'nurse@parrish.health',
  displayName: 'Nurse User',
  role: 'nurse',
  status: 'active',
  hasCompletedOnboarding: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const NURSE_2_DATA = {
  uid: 'nurse-uid-2',
  email: 'nurse2@parrish.health',
  displayName: 'Nurse User 2',
  role: 'nurse',
  status: 'active',
  hasCompletedOnboarding: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const SUSPENDED_DATA = {
  uid: 'suspended-uid-1',
  email: 'suspended@parrish.health',
  displayName: 'Suspended User',
  role: 'nurse',
  status: 'suspended',
  hasCompletedOnboarding: true,
  createdAt: NOW,
  updatedAt: NOW,
};

// ─── Valid document payloads ──────────────────────────────────────────────────

const VALID_REQUEST = {
  type: 'dme',
  submitterId: NURSE_DATA.uid,
  submitterName: 'Nurse User',
  patientName: 'Jane Doe',
  patientId: 'patient-1',
  details: { kind: 'dme', equipment: {}, clinical: {} },
  status: 'pending',
  createdAt: NOW,
  updatedAt: NOW,
};

const VALID_MESSAGE = {
  senderId: NURSE_DATA.uid,
  senderName: 'Nurse User',
  recipientId: ADMIN_DATA.uid,
  recipientName: 'Admin User',
  messageType: 'clinical',
  messageBody: 'U2FsdGVkX1+ciphertext==',
  read: false,
  createdAt: NOW,
};

const VALID_CONV_KEY = {
  participants: [NURSE_DATA.uid, ADMIN_DATA.uid],
  key: 'base64encodedAESkey==',
};

// ─── Environment setup ────────────────────────────────────────────────────────

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

/**
 * Seed all four staff docs before every test.
 * Required because rules helper functions call get(/staff/{uid})
 * to resolve roles — without these the role check always fails.
 */
beforeEach(async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      db.collection('staff').doc(ADMIN_DATA.uid).set(ADMIN_DATA),
      db.collection('staff').doc(NURSE_DATA.uid).set(NURSE_DATA),
      db.collection('staff').doc(NURSE_2_DATA.uid).set(NURSE_2_DATA),
      db.collection('staff').doc(SUSPENDED_DATA.uid).set(SUSPENDED_DATA),
    ]);
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Bypass rules to seed a document for read/update/delete tests. */
async function seed(col: string, id: string, data: object): Promise<void> {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().collection(col).doc(id).set(data);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. STAFF
// ═══════════════════════════════════════════════════════════════════════════════

describe('staff collection', () => {
  // ── Reads ──────────────────────────────────────────────────────────────────

  it('admin can read any staff profile', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(db.collection('staff').doc(NURSE_DATA.uid).get());
  });

  it('staff can read their own profile', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('staff').doc(NURSE_DATA.uid).get());
  });

  it("staff cannot read another user's profile", async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(db.collection('staff').doc(NURSE_2_DATA.uid).get());
  });

  it('unauthenticated user cannot read any profile', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('staff').doc(NURSE_DATA.uid).get());
  });

  // ── Creates ────────────────────────────────────────────────────────────────

  it('admin can create a staff profile', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('staff').doc('new-staff-uid').set({
        uid: 'new-staff-uid',
        email: 'new@parrish.health',
        displayName: 'New Staff',
        role: 'nurse',
        status: 'active',
        hasCompletedOnboarding: false,
        createdAt: NOW,
        updatedAt: NOW,
      })
    );
  });

  it('non-admin cannot create a staff profile', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('staff').doc('new-staff-uid').set({
        uid: 'new-staff-uid',
        role: 'nurse',
        status: 'active',
      })
    );
  });

  // ── Updates ────────────────────────────────────────────────────────────────

  it('owner can update their own profile', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('staff').doc(NURSE_DATA.uid).update({ displayName: 'Updated Name' })
    );
  });

  it('admin can update any profile', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('staff').doc(NURSE_DATA.uid).update({ role: 'homemaker' })
    );
  });

  it('non-owner non-admin cannot update another profile', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('staff').doc(NURSE_2_DATA.uid).update({ displayName: 'Hacked' })
    );
  });

  // ── Deletes ────────────────────────────────────────────────────────────────

  it('nobody can delete a staff profile (even admin)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('staff').doc(NURSE_DATA.uid).delete());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. REQUESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('requests collection', () => {
  const REQUEST_ID = 'request-test-1';

  beforeEach(async () => {
    await seed('requests', REQUEST_ID, VALID_REQUEST);
  });

  // ── Reads ──────────────────────────────────────────────────────────────────

  it('submitter can read their own request', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('requests').doc(REQUEST_ID).get());
  });

  it('admin can read any request', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(db.collection('requests').doc(REQUEST_ID).get());
  });

  it("another staff member cannot read someone else's request", async () => {
    const db = testEnv.authenticatedContext(NURSE_2_DATA.uid).firestore();
    await assertFails(db.collection('requests').doc(REQUEST_ID).get());
  });

  it('unauthenticated user cannot read requests', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('requests').doc(REQUEST_ID).get());
  });

  // ── Creates ────────────────────────────────────────────────────────────────

  it('active staff can create a request with their own submitterId', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('requests').add(VALID_REQUEST));
  });

  it("active staff cannot create a request with another's submitterId", async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('requests').add({ ...VALID_REQUEST, submitterId: NURSE_2_DATA.uid })
    );
  });

  it('active staff cannot create a request with non-pending status', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('requests').add({ ...VALID_REQUEST, status: 'approved' })
    );
  });

  it('active staff cannot create a request missing required fields', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    const { patientId: _removed, ...missingPatientId } = VALID_REQUEST;
    await assertFails(db.collection('requests').add(missingPatientId));
  });

  it('suspended staff cannot create a request', async () => {
    const db = testEnv.authenticatedContext(SUSPENDED_DATA.uid).firestore();
    await assertFails(
      db
        .collection('requests')
        .add({ ...VALID_REQUEST, submitterId: SUSPENDED_DATA.uid })
    );
  });

  // ── Updates ────────────────────────────────────────────────────────────────

  it('admin can update a request (approve/deny/rmi)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(
      db
        .collection('requests')
        .doc(REQUEST_ID)
        .update({ status: 'approved', adminNotes: 'Approved.' })
    );
  });

  it('submitter cannot update their own request (immutable after submit)', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('requests').doc(REQUEST_ID).update({ status: 'approved' })
    );
  });

  // ── Deletes ────────────────────────────────────────────────────────────────

  it('nobody can delete a request', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('requests').doc(REQUEST_ID).delete());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. COMMUNICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('communications collection', () => {
  const MSG_ID = 'msg-test-1';

  beforeEach(async () => {
    await seed('communications', MSG_ID, VALID_MESSAGE);
  });

  // ── Reads ──────────────────────────────────────────────────────────────────

  it('sender can read their own message', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('communications').doc(MSG_ID).get());
  });

  it('recipient can read a message sent to them', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(db.collection('communications').doc(MSG_ID).get());
  });

  it('third party cannot read a message', async () => {
    const db = testEnv.authenticatedContext(NURSE_2_DATA.uid).firestore();
    await assertFails(db.collection('communications').doc(MSG_ID).get());
  });

  it('unauthenticated user cannot read messages', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('communications').doc(MSG_ID).get());
  });

  // ── Creates ────────────────────────────────────────────────────────────────

  it('active staff can send a message with own senderId and required fields', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('communications').add(VALID_MESSAGE));
  });

  it("active staff cannot send a message with another's senderId", async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db
        .collection('communications')
        .add({ ...VALID_MESSAGE, senderId: ADMIN_DATA.uid })
    );
  });

  it('active staff cannot send a message missing required fields', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    const { senderName: _removed, ...missingSenderName } = VALID_MESSAGE;
    await assertFails(db.collection('communications').add(missingSenderName));
  });

  it('suspended staff cannot send messages', async () => {
    const db = testEnv.authenticatedContext(SUSPENDED_DATA.uid).firestore();
    await assertFails(
      db.collection('communications').add({
        ...VALID_MESSAGE,
        senderId: SUSPENDED_DATA.uid,
      })
    );
  });

  // ── Updates ────────────────────────────────────────────────────────────────

  it('recipient can mark a message as read (read field → true)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('communications').doc(MSG_ID).update({ read: true })
    );
  });

  it('recipient cannot update any field other than read', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(
      db.collection('communications').doc(MSG_ID).update({ messageBody: 'tampered' })
    );
  });

  it('sender cannot update the read field (only recipient can)', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('communications').doc(MSG_ID).update({ read: true })
    );
  });

  // ── Deletes ────────────────────────────────────────────────────────────────

  it('nobody can delete a message', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('communications').doc(MSG_ID).delete());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INVITATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('invitations collection', () => {
  const INVITE_ID = 'invite-test-1';
  const VALID_INVITE = {
    email: 'newstaff@parrish.health',
    role: 'nurse',
    invitedBy: ADMIN_DATA.uid,
    invitedByName: 'Admin User',
    createdAt: NOW,
    status: 'pending',
  };

  beforeEach(async () => {
    await seed('invitations', INVITE_ID, VALID_INVITE);
  });

  it('admin can read invitations', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(db.collection('invitations').doc(INVITE_ID).get());
  });

  it('non-admin cannot read invitations', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(db.collection('invitations').doc(INVITE_ID).get());
  });

  it('admin can create an invitation', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(db.collection('invitations').add(VALID_INVITE));
  });

  it('non-admin cannot create an invitation', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(db.collection('invitations').add(VALID_INVITE));
  });

  it('admin can update an invitation', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('invitations').doc(INVITE_ID).update({ status: 'accepted' })
    );
  });

  it('non-admin cannot update an invitation', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('invitations').doc(INVITE_ID).update({ status: 'accepted' })
    );
  });

  it('nobody can delete an invitation', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('invitations').doc(INVITE_ID).delete());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. AUDIT LOG
// ═══════════════════════════════════════════════════════════════════════════════

describe('audit_log collection', () => {
  const ENTRY_ID = 'audit-test-1';
  const VALID_ENTRY = {
    timestamp: NOW,
    actorId: ADMIN_DATA.uid,
    actorRole: 'admin',
    action: 'request.approve',
    resourceType: 'request',
    resourceId: 'request-1',
  };

  beforeEach(async () => {
    await seed('audit_log', ENTRY_ID, VALID_ENTRY);
  });

  it('admin can read audit log entries', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(db.collection('audit_log').doc(ENTRY_ID).get());
  });

  it('non-admin cannot read audit log', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(db.collection('audit_log').doc(ENTRY_ID).get());
  });

  it('unauthenticated user cannot read audit log', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('audit_log').doc(ENTRY_ID).get());
  });

  it('admin client cannot write to audit log (Cloud Functions only)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('audit_log').add(VALID_ENTRY));
  });

  it('staff client cannot write to audit log', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(db.collection('audit_log').add(VALID_ENTRY));
  });

  it('nobody can delete an audit log entry', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('audit_log').doc(ENTRY_ID).delete());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. DME CATALOG
// ═══════════════════════════════════════════════════════════════════════════════

describe('dme_catalog collection', () => {
  const ITEM_ID = 'item-test-1';
  const VALID_ITEM = {
    itemName: 'Standard Wheelchair',
    sku: 'WC-STD-001',
    category: 'Mobility',
    currentStock: 5,
  };

  beforeEach(async () => {
    await seed('dme_catalog', ITEM_ID, VALID_ITEM);
  });

  it('active staff can read the DME catalog', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('dme_catalog').doc(ITEM_ID).get());
  });

  it('suspended staff cannot read the DME catalog', async () => {
    const db = testEnv.authenticatedContext(SUSPENDED_DATA.uid).firestore();
    await assertFails(db.collection('dme_catalog').doc(ITEM_ID).get());
  });

  it('unauthenticated user cannot read the catalog', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('dme_catalog').doc(ITEM_ID).get());
  });

  it('admin can write to the DME catalog', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(db.collection('dme_catalog').doc('new-item').set(VALID_ITEM));
  });

  it('non-admin cannot write to the DME catalog', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(db.collection('dme_catalog').doc('new-item').set(VALID_ITEM));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. PATIENTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('patients collection', () => {
  const PATIENT_ID = 'patient-test-1';
  const VALID_PATIENT = {
    mrn: 'MRN-001',
    name: 'Jane Doe',
    dob: '1960-05-15',
    insurance: 'Medicare Part B',
  };

  beforeEach(async () => {
    await seed('patients', PATIENT_ID, VALID_PATIENT);
  });

  it('active staff can read patient records', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('patients').doc(PATIENT_ID).get());
  });

  it('suspended staff cannot read patient records', async () => {
    const db = testEnv.authenticatedContext(SUSPENDED_DATA.uid).firestore();
    await assertFails(db.collection('patients').doc(PATIENT_ID).get());
  });

  it('unauthenticated user cannot read patient records', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('patients').doc(PATIENT_ID).get());
  });

  it('admin can write patient records', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('patients').doc('new-patient').set(VALID_PATIENT)
    );
  });

  it('non-admin cannot write patient records', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('patients').doc('new-patient').set(VALID_PATIENT)
    );
  });

  it('nobody can delete patient records (HIPAA retention)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('patients').doc(PATIENT_ID).delete());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. CONVERSATION KEYS
// ═══════════════════════════════════════════════════════════════════════════════

describe('conversationKeys collection', () => {
  // conversationId = sorted UIDs joined by '_'
  const CONV_ID = [NURSE_DATA.uid, ADMIN_DATA.uid].sort().join('_');
  const OTHER_CONV_ID = [NURSE_DATA.uid, NURSE_2_DATA.uid].sort().join('_');

  beforeEach(async () => {
    await seed('conversationKeys', CONV_ID, VALID_CONV_KEY);
    await seed('conversationKeys', OTHER_CONV_ID, {
      participants: [NURSE_DATA.uid, NURSE_2_DATA.uid],
      key: 'otherkey==',
    });
  });

  // ── Reads ──────────────────────────────────────────────────────────────────

  it('a participant can read their conversation key', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('conversationKeys').doc(CONV_ID).get());
  });

  it("non-participant cannot read another conversation's key", async () => {
    // NURSE_2 is not in the ADMIN↔NURSE conversation
    const db = testEnv.authenticatedContext(NURSE_2_DATA.uid).firestore();
    await assertFails(db.collection('conversationKeys').doc(CONV_ID).get());
  });

  it('unauthenticated user cannot read any conversation key', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('conversationKeys').doc(CONV_ID).get());
  });

  // ── Creates ────────────────────────────────────────────────────────────────

  it('active staff can create a conversation key where they are a participant', async () => {
    const newConvId = [NURSE_2_DATA.uid, ADMIN_DATA.uid].sort().join('_');
    const db = testEnv.authenticatedContext(NURSE_2_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('conversationKeys').doc(newConvId).set({
        participants: [NURSE_2_DATA.uid, ADMIN_DATA.uid],
        key: 'newkey==',
      })
    );
  });

  it('cannot create a conversation key where caller is not a participant', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('conversationKeys').doc('other-a_other-b').set({
        participants: ['other-uid-a', 'other-uid-b'],
        key: 'key==',
      })
    );
  });

  it('cannot create a conversation key with only one participant', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('conversationKeys').doc('solo-conv').set({
        participants: [NURSE_DATA.uid],
        key: 'key==',
      })
    );
  });

  it('cannot create a conversation key missing the key field', async () => {
    const newConvId = [NURSE_2_DATA.uid, ADMIN_DATA.uid].sort().join('_');
    const db = testEnv.authenticatedContext(NURSE_2_DATA.uid).firestore();
    await assertFails(
      db.collection('conversationKeys').doc(newConvId).set({
        participants: [NURSE_2_DATA.uid, ADMIN_DATA.uid],
        // key field intentionally omitted
      })
    );
  });

  // ── Updates & Deletes ──────────────────────────────────────────────────────

  it('nobody can update a conversation key (immutable)', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('conversationKeys').doc(CONV_ID).update({ key: 'rotatedkey==' })
    );
  });

  it('nobody can delete a conversation key', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('conversationKeys').doc(CONV_ID).delete());
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

describe('notifications collection', () => {
  const NOTIF_ID = 'notif-test-1';
  const VALID_NOTIF = {
    recipientId: NURSE_DATA.uid,
    type: 'request.status_change',
    title: 'Request Approved',
    body: 'Your DME request has been approved.',
    resourceId: 'request-test-1',
    read: false,
    createdAt: NOW,
  };

  beforeEach(async () => {
    await seed('notifications', NOTIF_ID, VALID_NOTIF);
  });

  // ── Reads ──────────────────────────────────────────────────────────────────

  it('recipient can read their own notification', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(db.collection('notifications').doc(NOTIF_ID).get());
  });

  it("non-recipient cannot read another user's notification", async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('notifications').doc(NOTIF_ID).get());
  });

  it('unauthenticated user cannot read notifications', async () => {
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(db.collection('notifications').doc(NOTIF_ID).get());
  });

  // ── Updates ────────────────────────────────────────────────────────────────

  it('recipient can mark their notification as read', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertSucceeds(
      db.collection('notifications').doc(NOTIF_ID).update({ read: true })
    );
  });

  it('recipient cannot update fields other than read', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(
      db.collection('notifications').doc(NOTIF_ID).update({ title: 'Hacked' })
    );
  });

  it('non-recipient cannot update a notification', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(
      db.collection('notifications').doc(NOTIF_ID).update({ read: true })
    );
  });

  // ── Creates & Deletes ──────────────────────────────────────────────────────

  it('client cannot create notifications (Cloud Functions only)', async () => {
    const db = testEnv.authenticatedContext(ADMIN_DATA.uid).firestore();
    await assertFails(db.collection('notifications').add(VALID_NOTIF));
  });

  it('nobody can delete a notification', async () => {
    const db = testEnv.authenticatedContext(NURSE_DATA.uid).firestore();
    await assertFails(db.collection('notifications').doc(NOTIF_ID).delete());
  });
});
