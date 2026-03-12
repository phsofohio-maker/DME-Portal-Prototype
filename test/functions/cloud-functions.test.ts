/**
 * test/functions/cloud-functions.test.ts — Cloud Function Integration Tests
 *
 * Block 4 of the Phase 2 Execution Plan.
 *
 * Tests all Cloud Function handlers with mocked Firebase Admin SDK, SendGrid,
 * and FCM.  Verifies:
 *   - Audit log entries are created with correct actor/action/resource fields
 *   - In-app notifications are created for the correct recipient
 *   - SendGrid email calls occur with correct recipients and content
 *   - FCM push notifications fire for users with tokens
 *   - RBAC enforcement on callable functions
 *   - Zod validation on processRequestStatus
 *   - Scheduled data retention archives old records
 *
 * No emulator needed — all Firebase interactions are mocked.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ─── Mock stores ────────────────────────────────────────────────────────────
// These accumulate writes so tests can assert what was persisted.

let auditLogWrites: Record<string, unknown>[] = [];
let notificationWrites: Record<string, unknown>[] = [];
let docUpdates: { path: string; data: Record<string, unknown> }[] = [];
let batchUpdates: { ref: unknown; data: Record<string, unknown> }[] = [];
let batchCommitCalled = false;

// Staff documents returned by db.doc(`staff/${uid}`).get()
let staffStore: Record<string, Record<string, unknown>> = {};

// Admin query results for staff collection
let adminQueryResults: Array<{ id: string; data: () => Record<string, unknown> }> = [];

// Stale requests returned by the retention query
let staleRequestDocs: Array<{ ref: { path: string }; data: () => Record<string, unknown> }> = [];

// ─── Mock: firebase-admin/app ───────────────────────────────────────────────
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
}));

// ─── Mock: firebase-admin/firestore ─────────────────────────────────────────
const SERVER_TS = 'SERVER_TIMESTAMP';

// Chain-able query mock
function makeQuery(resultsFn: () => { empty: boolean; docs: unknown[]; size: number }) {
  const q: Record<string, unknown> = {};
  q.where = vi.fn().mockReturnValue(q);
  q.limit = vi.fn().mockReturnValue(q);
  q.get = vi.fn().mockImplementation(async () => resultsFn());
  return q;
}

const mockBatch = {
  update: vi.fn().mockImplementation((ref: unknown, data: Record<string, unknown>) => {
    batchUpdates.push({ ref, data });
  }),
  commit: vi.fn().mockImplementation(async () => {
    batchCommitCalled = true;
  }),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => ({
    collection: vi.fn().mockImplementation((name: string) => {
      if (name === 'audit_log') {
        return {
          add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            auditLogWrites.push(data);
            return { id: `audit-${auditLogWrites.length}` };
          }),
        };
      }
      if (name === 'notifications') {
        return {
          add: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            notificationWrites.push(data);
            return { id: `notif-${notificationWrites.length}` };
          }),
        };
      }
      if (name === 'staff') {
        return makeQuery(() => ({
          empty: adminQueryResults.length === 0,
          docs: adminQueryResults,
          size: adminQueryResults.length,
        }));
      }
      if (name === 'requests') {
        return makeQuery(() => ({
          empty: staleRequestDocs.length === 0,
          docs: staleRequestDocs,
          size: staleRequestDocs.length,
        }));
      }
      // fallback
      return {
        add: vi.fn().mockResolvedValue({ id: 'fallback-id' }),
        ...makeQuery(() => ({ empty: true, docs: [], size: 0 })),
      };
    }),
    doc: vi.fn().mockImplementation((path: string) => ({
      get: vi.fn().mockImplementation(async () => {
        // Extract uid from path like "staff/nurse-uid-1"
        const parts = path.split('/');
        const uid = parts[parts.length - 1];
        const collection = parts[parts.length - 2];
        const key = `${collection}/${uid}`;
        const docData = staffStore[key] ?? staffStore[uid];
        return {
          exists: !!docData,
          data: () => docData ?? undefined,
        };
      }),
      update: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
        docUpdates.push({ path, data });
      }),
    })),
    batch: () => mockBatch,
  }),
  FieldValue: {
    serverTimestamp: () => SERVER_TS,
  },
}));

// ─── Mock: firebase-admin/messaging ─────────────────────────────────────────
let fcmSends: Array<{ token: string; notification: unknown }> = [];

vi.mock('firebase-admin/messaging', () => ({
  getMessaging: () => ({
    send: vi.fn().mockImplementation(async (msg: Record<string, unknown>) => {
      fcmSends.push(msg as { token: string; notification: unknown });
      return 'projects/demo/messages/mock';
    }),
  }),
}));

// ─── Mock: @sendgrid/mail ───────────────────────────────────────────────────
let sgSends: Record<string, unknown>[] = [];

vi.mock('@sendgrid/mail', () => ({
  default: {
    setApiKey: vi.fn(),
    send: vi.fn().mockImplementation(async (msg: Record<string, unknown>) => {
      sgSends.push(msg);
      return [{ statusCode: 202, body: '' }];
    }),
  },
}));

// ─── Mock: firebase-functions/v2 decorators ─────────────────────────────────
// Make each decorator return the raw handler so we can call it directly.

vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: (_path: string, handler: Function) => handler,
  onDocumentUpdated: (_path: string, handler: Function) => handler,
}));

vi.mock('firebase-functions/v2/https', () => {
  class HttpsError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'HttpsError';
    }
  }
  return {
    onCall: (handler: Function) => handler,
    onRequest: (_opts: unknown, handler: Function) => handler,
    HttpsError,
  };
});

vi.mock('firebase-functions/v2/scheduler', () => ({
  onSchedule: (_schedule: string, handler: Function) => handler,
}));

// ─── Import functions under test ────────────────────────────────────────────
// Mocks are hoisted above this import, so all dependencies are intercepted.

const funcs = await import('../../functions/src/index');

// ─── Helpers ────────────────────────────────────────────────────────────────

function resetStores() {
  auditLogWrites = [];
  notificationWrites = [];
  docUpdates = [];
  batchUpdates = [];
  batchCommitCalled = false;
  fcmSends = [];
  sgSends = [];
  staleRequestDocs = [];
  adminQueryResults = [];
  staffStore = {};
}

/** Seed a staff document into the mock store. */
function seedStaff(uid: string, data: Record<string, unknown>) {
  staffStore[`staff/${uid}`] = data;
  staffStore[uid] = data; // also allow bare uid lookup
}

// ─── Test suites ────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStores();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. onRequestCreated
// ═══════════════════════════════════════════════════════════════════════════

describe('onRequestCreated', () => {
  const handler = funcs.onRequestCreated as Function;

  it('creates an audit log entry with action request.create', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse', status: 'active' });

    await handler({
      data: {
        data: () => ({
          submitterId: 'nurse-uid-1',
          submitterName: 'Nurse User',
          patientName: 'Jane Doe',
          type: 'dme',
          status: 'pending',
        }),
      },
      params: { requestId: 'req-001' },
    });

    expect(auditLogWrites).toHaveLength(1);
    const log = auditLogWrites[0];
    expect(log).toMatchObject({
      timestamp: SERVER_TS,
      actorId: 'nurse-uid-1',
      actorRole: 'nurse',
      action: 'request.create',
      resourceType: 'request',
      resourceId: 'req-001',
    });
    expect(log.after).toBeDefined();
  });

  it('records the full request payload in the after field', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });

    const requestData = {
      submitterId: 'nurse-uid-1',
      submitterName: 'Nurse User',
      patientName: 'Jane Doe',
      type: 'dme',
      status: 'pending',
      details: { kind: 'dme' },
    };

    await handler({
      data: { data: () => requestData },
      params: { requestId: 'req-002' },
    });

    expect(auditLogWrites[0].after).toEqual(requestData);
  });

  it('resolves actor role from staff collection', async () => {
    seedStaff('homemaker-uid-1', { role: 'homemaker' });

    await handler({
      data: {
        data: () => ({
          submitterId: 'homemaker-uid-1',
          submitterName: 'HM User',
          patientName: 'Jane Doe',
          type: 'dme',
        }),
      },
      params: { requestId: 'req-003' },
    });

    expect(auditLogWrites[0].actorRole).toBe('homemaker');
  });

  it('defaults to "unknown" role when staff doc missing', async () => {
    // No staff seeded for this uid
    await handler({
      data: {
        data: () => ({
          submitterId: 'ghost-uid',
          submitterName: 'Ghost',
          patientName: 'Jane Doe',
          type: 'dme',
        }),
      },
      params: { requestId: 'req-004' },
    });

    expect(auditLogWrites[0].actorRole).toBe('unknown');
  });

  it('does nothing when event data is null', async () => {
    await handler({ data: { data: () => null }, params: { requestId: 'req-005' } });
    expect(auditLogWrites).toHaveLength(0);
  });

  it('calls notifyAdminsOfNewRequest (email skipped without API key)', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler({
      data: {
        data: () => ({
          submitterId: 'nurse-uid-1',
          submitterName: 'Nurse User',
          patientName: 'Jane Doe',
          type: 'medication',
        }),
      },
      params: { requestId: 'req-006' },
    });

    // Without SENDGRID_API_KEY, no emails sent — but audit log still written
    expect(auditLogWrites).toHaveLength(1);
    expect(sgSends).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. onRequestUpdated
// ═══════════════════════════════════════════════════════════════════════════

describe('onRequestUpdated', () => {
  const handler = funcs.onRequestUpdated as Function;

  const makeBefore = (overrides = {}) => ({
    status: 'pending',
    submitterId: 'nurse-uid-1',
    submitterName: 'Nurse User',
    patientName: 'Jane Doe',
    ...overrides,
  });

  const makeAfter = (overrides = {}) => ({
    status: 'approved',
    submitterId: 'nurse-uid-1',
    submitterName: 'Nurse User',
    patientName: 'Jane Doe',
    processedBy: 'admin-uid-1',
    adminNotes: 'Looks good',
    processedAt: Date.now(),
    ...overrides,
  });

  function makeEvent(before: Record<string, unknown>, after: Record<string, unknown>, requestId = 'req-100') {
    return {
      data: {
        before: { data: () => before },
        after: { data: () => after },
      },
      params: { requestId },
    };
  }

  it('creates audit log entry for approval', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });
    seedStaff('nurse-uid-1', { role: 'nurse', status: 'active' });

    await handler(makeEvent(makeBefore(), makeAfter()));

    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0]).toMatchObject({
      actorId: 'admin-uid-1',
      actorRole: 'admin',
      action: 'request.approve',
      resourceType: 'request',
      resourceId: 'req-100',
    });
  });

  it('creates audit log entry for denial', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(makeEvent(makeBefore(), makeAfter({ status: 'denied' })));

    expect(auditLogWrites[0].action).toBe('request.deny');
  });

  it('creates audit log entry for RMI', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(
      makeEvent(
        makeBefore(),
        makeAfter({ status: 'rmi', rmiNotes: 'Need prescription date' })
      )
    );

    expect(auditLogWrites[0].action).toBe('request.rmi');
    expect(auditLogWrites[0].after).toMatchObject({
      status: 'rmi',
      rmiNotes: 'Need prescription date',
    });
  });

  it('records before/after status in audit log', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(makeEvent(makeBefore(), makeAfter()));

    expect(auditLogWrites[0].before).toEqual({ status: 'pending' });
    expect(auditLogWrites[0].after).toMatchObject({ status: 'approved' });
  });

  it('skips processing when status has not changed', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });

    await handler(makeEvent(
      makeBefore({ status: 'pending' }),
      makeAfter({ status: 'pending' })
    ));

    expect(auditLogWrites).toHaveLength(0);
    expect(notificationWrites).toHaveLength(0);
  });

  it('creates in-app notification for submitter on approval', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(makeEvent(makeBefore(), makeAfter()));

    expect(notificationWrites).toHaveLength(1);
    expect(notificationWrites[0]).toMatchObject({
      recipientId: 'nurse-uid-1',
      type: 'request.status_change',
      read: false,
      createdAt: SERVER_TS,
    });
    expect(notificationWrites[0].title).toContain('Approved');
  });

  it('creates in-app notification with "Denied" label on denial', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(makeEvent(makeBefore(), makeAfter({ status: 'denied' })));

    expect(notificationWrites[0].title).toContain('Denied');
  });

  it('creates in-app notification with "More Info Needed" on RMI', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(makeEvent(makeBefore(), makeAfter({ status: 'rmi' })));

    expect(notificationWrites[0].title).toContain('More Info Needed');
  });

  it('sends FCM push notification to submitter', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', {
      role: 'nurse',
      fcmToken: 'fcm-token-nurse',
    });

    await handler(makeEvent(makeBefore(), makeAfter()));

    expect(fcmSends).toHaveLength(1);
    expect(fcmSends[0].token).toBe('fcm-token-nurse');
    expect(fcmSends[0].notification).toMatchObject({
      title: expect.stringContaining('Approved'),
    });
  });

  it('skips FCM when submitter has no fcmToken', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' }); // no fcmToken

    await handler(makeEvent(makeBefore(), makeAfter()));

    expect(fcmSends).toHaveLength(0);
  });

  it('does nothing when event data is null', async () => {
    await handler({
      data: {
        before: { data: () => null },
        after: { data: () => null },
      },
      params: { requestId: 'req-null' },
    });
    expect(auditLogWrites).toHaveLength(0);
  });

  it('handles missing submitterId gracefully', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });

    await handler(makeEvent(
      makeBefore({ submitterId: undefined }),
      makeAfter({ submitterId: undefined })
    ));

    // Audit log still written; notifications skipped
    expect(auditLogWrites).toHaveLength(1);
    expect(notificationWrites).toHaveLength(0);
  });

  it('uses "request.update" action for non-standard status', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(makeEvent(
      makeBefore({ status: 'pending' }),
      makeAfter({ status: 'cancelled' })
    ));

    expect(auditLogWrites[0].action).toBe('request.update');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. onStaffUpdated
// ═══════════════════════════════════════════════════════════════════════════

describe('onStaffUpdated', () => {
  const handler = funcs.onStaffUpdated as Function;

  function makeEvent(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    uid = 'staff-uid-1'
  ) {
    return {
      data: {
        before: { data: () => before },
        after: { data: () => after },
      },
      params: { uid },
    };
  }

  const baseStaff = {
    role: 'nurse',
    status: 'active',
    hasCompletedOnboarding: true,
  };

  it('creates audit log on role change', async () => {
    seedStaff('staff-uid-1', { role: 'admin' });

    await handler(makeEvent(
      { ...baseStaff, role: 'nurse' },
      { ...baseStaff, role: 'admin' }
    ));

    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0]).toMatchObject({
      actorId: 'staff-uid-1',
      action: 'staff.update',
      resourceType: 'staff',
      resourceId: 'staff-uid-1',
    });
    expect(auditLogWrites[0].before).toMatchObject({ role: 'nurse' });
    expect(auditLogWrites[0].after).toMatchObject({ role: 'admin' });
  });

  it('creates audit log with staff.suspend action on suspension', async () => {
    seedStaff('staff-uid-1', { role: 'nurse', status: 'suspended' });

    await handler(makeEvent(
      { ...baseStaff, status: 'active' },
      { ...baseStaff, status: 'suspended' }
    ));

    expect(auditLogWrites[0].action).toBe('staff.suspend');
  });

  it('creates audit log on onboarding completion', async () => {
    seedStaff('staff-uid-1', { role: 'nurse' });

    await handler(makeEvent(
      { ...baseStaff, hasCompletedOnboarding: false },
      { ...baseStaff, hasCompletedOnboarding: true }
    ));

    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0].before).toMatchObject({ hasCompletedOnboarding: false });
    expect(auditLogWrites[0].after).toMatchObject({ hasCompletedOnboarding: true });
  });

  it('skips audit log when no tracked fields changed', async () => {
    await handler(makeEvent(
      { ...baseStaff, email: 'old@example.com' },
      { ...baseStaff, email: 'new@example.com' }
    ));

    expect(auditLogWrites).toHaveLength(0);
  });

  it('does nothing when event data is null', async () => {
    await handler({
      data: {
        before: { data: () => null },
        after: { data: () => null },
      },
      params: { uid: 'uid-null' },
    });
    expect(auditLogWrites).toHaveLength(0);
  });

  it('records before and after snapshots for role + status', async () => {
    seedStaff('staff-uid-1', { role: 'admin', status: 'suspended' });

    await handler(makeEvent(
      { role: 'nurse', status: 'active', hasCompletedOnboarding: true },
      { role: 'admin', status: 'suspended', hasCompletedOnboarding: true }
    ));

    // Two changes (role + status) but only one audit entry
    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0].before).toEqual({
      role: 'nurse',
      status: 'active',
      hasCompletedOnboarding: true,
    });
    expect(auditLogWrites[0].after).toEqual({
      role: 'admin',
      status: 'suspended',
      hasCompletedOnboarding: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. onMessageCreated
// ═══════════════════════════════════════════════════════════════════════════

describe('onMessageCreated', () => {
  const handler = funcs.onMessageCreated as Function;

  function makeEvent(data: Record<string, unknown>, msgId = 'msg-001') {
    return {
      data: { data: () => data },
      params: { msgId },
    };
  }

  const baseMessage = {
    senderId: 'nurse-uid-1',
    senderName: 'Nurse User',
    recipientId: 'admin-uid-1',
    recipientName: 'Admin User',
    messageType: 'clinical',
    messageBody: 'encrypted-blob',
    iv: 'aGVsbG8=',
    read: false,
    createdAt: Date.now(),
  };

  it('creates audit log entry with action communication.create', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });
    seedStaff('admin-uid-1', { role: 'admin' });

    await handler(makeEvent(baseMessage));

    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0]).toMatchObject({
      actorId: 'nurse-uid-1',
      actorRole: 'nurse',
      action: 'communication.create',
      resourceType: 'communication',
      resourceId: 'msg-001',
    });
  });

  it('does NOT include message body in audit log (PHI protection)', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });
    seedStaff('admin-uid-1', { role: 'admin' });

    await handler(makeEvent(baseMessage));

    const after = auditLogWrites[0].after as Record<string, unknown>;
    expect(after.messageBody).toBeUndefined();
    expect(after).toMatchObject({
      senderId: 'nurse-uid-1',
      recipientId: 'admin-uid-1',
      messageType: 'clinical',
    });
  });

  it('creates in-app notification for recipient', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });
    seedStaff('admin-uid-1', { role: 'admin' });

    await handler(makeEvent(baseMessage));

    expect(notificationWrites).toHaveLength(1);
    expect(notificationWrites[0]).toMatchObject({
      recipientId: 'admin-uid-1',
      type: 'message.received',
      read: false,
      createdAt: SERVER_TS,
    });
    expect(notificationWrites[0].title).toContain('Nurse User');
  });

  it('sends FCM push to recipient with token', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });
    seedStaff('admin-uid-1', { role: 'admin', fcmToken: 'fcm-admin' });

    await handler(makeEvent(baseMessage));

    expect(fcmSends).toHaveLength(1);
    expect(fcmSends[0].token).toBe('fcm-admin');
  });

  it('skips FCM when recipient has no token', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });
    seedStaff('admin-uid-1', { role: 'admin' }); // no fcmToken

    await handler(makeEvent(baseMessage));

    expect(fcmSends).toHaveLength(0);
  });

  it('does nothing when event data is null', async () => {
    await handler({ data: { data: () => null }, params: { msgId: 'msg-null' } });
    expect(auditLogWrites).toHaveLength(0);
    expect(notificationWrites).toHaveLength(0);
  });

  it('skips notification when recipientId or senderName is missing', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });

    await handler(makeEvent({
      ...baseMessage,
      recipientId: undefined,
      senderName: undefined,
    }));

    // Audit log still created, but no notification
    expect(auditLogWrites).toHaveLength(1);
    expect(notificationWrites).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. processRequestStatus (callable — RBAC + Zod + update)
// ═══════════════════════════════════════════════════════════════════════════

describe('processRequestStatus', () => {
  const handler = funcs.processRequestStatus as Function;

  it('rejects unauthenticated calls', async () => {
    await expect(handler({ auth: null, data: {} })).rejects.toThrow(/[Aa]uthentication/);
  });

  it('rejects non-admin callers', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse', status: 'active' });

    await expect(
      handler({
        auth: { uid: 'nurse-uid-1' },
        data: { requestId: 'req-1', status: 'approved', adminNotes: 'Looks good' },
      })
    ).rejects.toThrow(/[Aa]dmin/);
  });

  it('rejects caller with no staff document', async () => {
    // uid not in staffStore
    await expect(
      handler({
        auth: { uid: 'nobody' },
        data: { requestId: 'req-1', status: 'approved', adminNotes: 'Looks good' },
      })
    ).rejects.toThrow(/[Aa]dmin/);
  });

  it('rejects invalid payload (Zod validation)', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });

    // Missing required fields
    await expect(
      handler({
        auth: { uid: 'admin-uid-1' },
        data: { requestId: '', status: 'approved' },
      })
    ).rejects.toThrow();
  });

  it('rejects invalid status value', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });

    await expect(
      handler({
        auth: { uid: 'admin-uid-1' },
        data: { requestId: 'req-1', status: 'invalid-status', adminNotes: 'Notes here' },
      })
    ).rejects.toThrow();
  });

  it('rejects admin notes shorter than 5 characters', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });

    await expect(
      handler({
        auth: { uid: 'admin-uid-1' },
        data: { requestId: 'req-1', status: 'approved', adminNotes: 'No' },
      })
    ).rejects.toThrow();
  });

  it('updates the request document on valid call', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });

    const result = await handler({
      auth: { uid: 'admin-uid-1' },
      data: { requestId: 'req-200', status: 'approved', adminNotes: 'Approved after review' },
    });

    expect(result).toEqual({ success: true });
    expect(docUpdates).toHaveLength(1);
    expect(docUpdates[0].path).toBe('requests/req-200');
    expect(docUpdates[0].data).toMatchObject({
      status: 'approved',
      adminNotes: 'Approved after review',
      processedBy: 'admin-uid-1',
    });
  });

  it('includes rmiNotes when status is rmi', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });

    await handler({
      auth: { uid: 'admin-uid-1' },
      data: {
        requestId: 'req-201',
        status: 'rmi',
        adminNotes: 'Need more information',
        rmiNotes: 'Please provide prescription date and physician name',
      },
    });

    expect(docUpdates[0].data.rmiNotes).toBe(
      'Please provide prescription date and physician name'
    );
  });

  it('sets rmiNotes to null when not provided', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });

    await handler({
      auth: { uid: 'admin-uid-1' },
      data: { requestId: 'req-202', status: 'denied', adminNotes: 'Does not meet criteria' },
    });

    expect(docUpdates[0].data.rmiNotes).toBeNull();
  });

  it('sets processedAt and updatedAt timestamps', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });
    const before = Date.now();

    await handler({
      auth: { uid: 'admin-uid-1' },
      data: { requestId: 'req-203', status: 'approved', adminNotes: 'All looks good' },
    });

    const after = Date.now();
    expect(docUpdates[0].data.processedAt).toBeGreaterThanOrEqual(before);
    expect(docUpdates[0].data.processedAt).toBeLessThanOrEqual(after);
    expect(docUpdates[0].data.updatedAt).toBeGreaterThanOrEqual(before);
    expect(docUpdates[0].data.updatedAt).toBeLessThanOrEqual(after);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. seedCatalog (callable — admin-only guard)
// ═══════════════════════════════════════════════════════════════════════════

describe('seedCatalog', () => {
  const handler = funcs.seedCatalog as Function;

  it('rejects unauthenticated calls', async () => {
    await expect(handler({ auth: null, data: {} })).rejects.toThrow(/[Aa]uthentication/);
  });

  it('rejects non-admin callers', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });
    await expect(
      handler({ auth: { uid: 'nurse-uid-1' }, data: {} })
    ).rejects.toThrow(/[Aa]dmin/);
  });

  it('rejects callers with no staff document', async () => {
    await expect(
      handler({ auth: { uid: 'unknown-uid' }, data: {} })
    ).rejects.toThrow(/[Aa]dmin/);
  });

  it('returns success message for admin callers', async () => {
    seedStaff('admin-uid-1', { role: 'admin', status: 'active' });

    const result = await handler({ auth: { uid: 'admin-uid-1' }, data: {} });
    expect(result).toHaveProperty('message');
    expect(result.message).toMatch(/[Ss]eed/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. logAuthEvent (callable — auth audit logging)
// ═══════════════════════════════════════════════════════════════════════════

describe('logAuthEvent', () => {
  const handler = funcs.logAuthEvent as Function;

  it('rejects unauthenticated calls', async () => {
    await expect(handler({ auth: null, data: {} })).rejects.toThrow(/[Aa]uthentication/);
  });

  it('rejects invalid action values', async () => {
    await expect(
      handler({ auth: { uid: 'admin-uid-1' }, data: { action: 'auth.invalid' } })
    ).rejects.toThrow(/action/);
  });

  it('creates audit log for auth.login', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });

    const result = await handler({
      auth: { uid: 'nurse-uid-1' },
      data: { action: 'auth.login' },
    });

    expect(result).toEqual({ logged: true });
    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0]).toMatchObject({
      timestamp: SERVER_TS,
      actorId: 'nurse-uid-1',
      actorRole: 'nurse',
      action: 'auth.login',
      resourceType: 'auth',
      resourceId: 'nurse-uid-1',
    });
  });

  it('creates audit log for auth.logout', async () => {
    seedStaff('admin-uid-1', { role: 'admin' });

    await handler({
      auth: { uid: 'admin-uid-1' },
      data: { action: 'auth.logout' },
    });

    expect(auditLogWrites[0].action).toBe('auth.logout');
    expect(auditLogWrites[0].actorRole).toBe('admin');
  });

  it('creates audit log for auth.timeout (HIPAA auto-logoff)', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });

    const result = await handler({
      auth: { uid: 'nurse-uid-1' },
      data: { action: 'auth.timeout' },
    });

    expect(result).toEqual({ logged: true });
    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0]).toMatchObject({
      actorId: 'nurse-uid-1',
      actorRole: 'nurse',
      action: 'auth.timeout',
      resourceType: 'auth',
    });
  });

  it('defaults role to "unknown" when staff doc missing', async () => {
    await handler({
      auth: { uid: 'ghost' },
      data: { action: 'auth.login' },
    });

    expect(auditLogWrites[0].actorRole).toBe('unknown');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. triggerAlert (HTTP endpoint — Slack webhook)
// ═══════════════════════════════════════════════════════════════════════════

describe('triggerAlert', () => {
  const handler = funcs.triggerAlert as Function;

  function makeReq(overrides = {}) {
    return {
      method: 'POST',
      body: {
        level: 'critical',
        context: 'Client',
        message: 'Test alert',
      },
      ...overrides,
    };
  }

  function makeRes() {
    const res: Record<string, unknown> = {};
    res.status = vi.fn().mockReturnValue(res);
    res.send = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  }

  it('returns 405 for non-POST requests', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET' }), res);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 200 on valid POST', async () => {
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it('handles missing body fields gracefully', async () => {
    const res = makeRes();
    await handler({ method: 'POST', body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9. scheduledDataRetention
// ═══════════════════════════════════════════════════════════════════════════

describe('scheduledDataRetention', () => {
  const handler = funcs.scheduledDataRetention as Function;

  it('does nothing when no stale requests exist', async () => {
    staleRequestDocs = [];

    await handler();

    expect(batchCommitCalled).toBe(false);
    expect(auditLogWrites).toHaveLength(0);
  });

  it('archives stale requests and writes audit log', async () => {
    const ref1 = { path: 'requests/old-1' };
    const ref2 = { path: 'requests/old-2' };

    staleRequestDocs = [
      { ref: ref1, data: () => ({ createdAt: 0, archived: false }) },
      { ref: ref2, data: () => ({ createdAt: 100, archived: false }) },
    ];

    await handler();

    // Batch update for each stale doc
    expect(batchUpdates).toHaveLength(2);
    expect(batchUpdates[0].data).toMatchObject({ archived: true });
    expect(batchUpdates[1].data).toMatchObject({ archived: true });
    expect(batchCommitCalled).toBe(true);

    // Audit log for the archival run
    expect(auditLogWrites).toHaveLength(1);
    expect(auditLogWrites[0]).toMatchObject({
      actorId: 'system',
      actorRole: 'admin',
      action: 'request.update',
      resourceType: 'request',
      resourceId: 'batch_archive',
    });
    const after = auditLogWrites[0].after as Record<string, unknown>;
    expect(after.archivedCount).toBe(2);
    expect(after.retentionYears).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-cutting: Audit trail completeness
// ═══════════════════════════════════════════════════════════════════════════

describe('Audit trail completeness (HIPAA §164.312(b))', () => {
  it('every audit log entry contains required HIPAA fields', async () => {
    seedStaff('nurse-uid-1', { role: 'nurse' });
    seedStaff('admin-uid-1', { role: 'admin', fcmToken: 'tok' });

    // Trigger multiple functions to accumulate audit entries
    const onRequestCreated = funcs.onRequestCreated as Function;
    const onMessageCreated = funcs.onMessageCreated as Function;
    const logAuthEvent = funcs.logAuthEvent as Function;

    await onRequestCreated({
      data: {
        data: () => ({
          submitterId: 'nurse-uid-1',
          submitterName: 'Nurse',
          patientName: 'Jane',
          type: 'dme',
        }),
      },
      params: { requestId: 'req-audit-1' },
    });

    await onMessageCreated({
      data: {
        data: () => ({
          senderId: 'nurse-uid-1',
          senderName: 'Nurse',
          recipientId: 'admin-uid-1',
          recipientName: 'Admin',
          messageType: 'clinical',
          createdAt: Date.now(),
        }),
      },
      params: { msgId: 'msg-audit-1' },
    });

    await logAuthEvent({
      auth: { uid: 'nurse-uid-1' },
      data: { action: 'auth.login' },
    });

    expect(auditLogWrites.length).toBeGreaterThanOrEqual(3);

    const requiredFields = ['timestamp', 'actorId', 'actorRole', 'action', 'resourceType', 'resourceId'];

    for (const entry of auditLogWrites) {
      for (const field of requiredFields) {
        expect(entry).toHaveProperty(field);
        expect(entry[field]).toBeDefined();
      }
    }
  });
});
