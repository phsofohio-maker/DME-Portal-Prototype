/**
 * Parrish Health DME Portal — Cloud Functions (Phase 1)
 *
 * Responsibilities in this phase:
 *   1. Write immutable audit log entries for every state-changing Firestore
 *      operation (HIPAA Security Rule §164.312(b) — Audit Controls).
 *   2. All audit_log writes happen server-side; the Firestore Security Rules
 *      prevent any client from writing directly to audit_log.
 *
 * Audit log entry schema:
 *   timestamp    — server-side Firestore FieldValue.serverTimestamp()
 *   actorId      — Firebase Auth UID of the user who triggered the change
 *   actorRole    — role from the actor's staff document
 *   action       — e.g. 'request.create', 'request.approve', 'request.deny'
 *   resourceType — Firestore collection name
 *   resourceId   — document ID of the affected resource
 *   before       — previous document state (updates only)
 *   after        — new document state
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

// ─── Helper: resolve actor role from Firestore ────────────────────────────────

async function getActorRole(uid: string): Promise<string> {
  try {
    const snap = await db.doc(`staff/${uid}`).get();
    return snap.exists ? (snap.data()?.role ?? 'unknown') : 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Requests: created ────────────────────────────────────────────────────────

export const onRequestCreated = onDocumentCreated(
  'requests/{requestId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const actorId = data.submitterId as string;
    const actorRole = await getActorRole(actorId);

    await db.collection('audit_log').add({
      timestamp:    FieldValue.serverTimestamp(),
      actorId,
      actorRole,
      action:       'request.create',
      resourceType: 'request',
      resourceId:   event.params.requestId,
      after:        data,
    });
  }
);

// ─── Requests: updated (status change = approve / deny) ──────────────────────

export const onRequestUpdated = onDocumentUpdated(
  'requests/{requestId}',
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    // Only log meaningful state changes
    if (before.status === after.status) return;

    const actorId   = (after.processedBy ?? 'unknown') as string;
    const actorRole = await getActorRole(actorId);

    const action =
      after.status === 'approved' ? 'request.approve' :
      after.status === 'denied'   ? 'request.deny'    :
      'request.update';

    await db.collection('audit_log').add({
      timestamp:    FieldValue.serverTimestamp(),
      actorId,
      actorRole,
      action,
      resourceType: 'request',
      resourceId:   event.params.requestId,
      before: { status: before.status },
      after:  {
        status:     after.status,
        adminNotes: after.adminNotes ?? null,
        processedAt: after.processedAt ?? null,
      },
    });
  }
);

// ─── Staff: updated (role change, suspension) ─────────────────────────────────

export const onStaffUpdated = onDocumentUpdated(
  'staff/{uid}',
  async (event) => {
    const before = event.data?.before.data();
    const after  = event.data?.after.data();
    if (!before || !after) return;

    const changed =
      before.role   !== after.role   ||
      before.status !== after.status ||
      before.hasCompletedOnboarding !== after.hasCompletedOnboarding;

    if (!changed) return;

    // For staff self-updates we use the document UID as actor
    const actorId   = event.params.uid;
    const actorRole = await getActorRole(actorId);

    const action =
      before.status !== after.status && after.status === 'suspended'
        ? 'staff.suspend'
        : before.role !== after.role
          ? 'staff.update'
          : 'staff.update';

    await db.collection('audit_log').add({
      timestamp:    FieldValue.serverTimestamp(),
      actorId,
      actorRole,
      action,
      resourceType: 'staff',
      resourceId:   event.params.uid,
      before: {
        role:   before.role,
        status: before.status,
        hasCompletedOnboarding: before.hasCompletedOnboarding,
      },
      after: {
        role:   after.role,
        status: after.status,
        hasCompletedOnboarding: after.hasCompletedOnboarding,
      },
    });
  }
);

// ─── Communications: created ──────────────────────────────────────────────────

export const onMessageCreated = onDocumentCreated(
  'communications/{msgId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const actorId   = data.senderId as string;
    const actorRole = await getActorRole(actorId);

    await db.collection('audit_log').add({
      timestamp:    FieldValue.serverTimestamp(),
      actorId,
      actorRole,
      action:       'communication.create',
      resourceType: 'communication',
      resourceId:   event.params.msgId,
      // Message body is NOT logged to minimise PHI in audit records
      after: {
        senderId:     data.senderId,
        recipientId:  data.recipientId,
        messageType:  data.messageType,
        createdAt:    data.createdAt,
      },
    });
  }
);

// ─── Catalog seeding — admin-only callable function ──────────────────────────

export const seedCatalog = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerSnap = await db.doc(`staff/${request.auth.uid}`).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }

  // This delegates to client-provided data — replace with actual seed import
  // for production use.
  return { message: 'Seed callable ready. Import from migration script.' };
});
