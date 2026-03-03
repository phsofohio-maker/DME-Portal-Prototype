/**
 * Parrish Health DME Portal — Cloud Functions (Phase 2)
 *
 * Responsibilities:
 *   1. Write immutable audit log entries for every state-changing Firestore
 *      operation (HIPAA Security Rule §164.312(b) — Audit Controls).
 *   2. Send transactional emails via SendGrid when request status changes.
 *   3. Server-side Zod validation on callable functions.
 *
 * Environment variables required (set via `firebase functions:config:set` or
 * Secret Manager in production):
 *   SENDGRID_API_KEY — SendGrid API key
 *   SENDGRID_FROM    — verified sender email address
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as sgMail from '@sendgrid/mail';
import { requestStatusUpdateSchema } from './schemas';

initializeApp();
const db = getFirestore();

// ─── SendGrid configuration ────────────────────────────────────────────────────

const SENDGRID_API_KEY = process.env['SENDGRID_API_KEY'] ?? '';
const SENDGRID_FROM    = process.env['SENDGRID_FROM'] ?? 'noreply@parrishhealth.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// ─── Helper: resolve actor role from Firestore ────────────────────────────────

async function getActorRole(uid: string): Promise<string> {
  try {
    const snap = await db.doc(`staff/${uid}`).get();
    return snap.exists ? (snap.data()?.role ?? 'unknown') : 'unknown';
  } catch {
    return 'unknown';
  }
}

// ─── Helper: send status-change email via SendGrid ────────────────────────────

async function sendStatusEmail(
  to: string,
  recipientName: string,
  patientName: string,
  status: string,
  adminNotes: string,
  rmiNotes?: string
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log(`[SendGrid SKIPPED — no API key] To: ${to}, status: ${status}`);
    return;
  }

  const statusLabels: Record<string, string> = {
    approved: 'APPROVED',
    denied:   'DENIED',
    rmi:      'MORE INFORMATION NEEDED',
  };
  const label = statusLabels[status] ?? status.toUpperCase();

  const rmiSection = rmiNotes
    ? `\n\nAdditional information requested:\n${rmiNotes}`
    : '';

  const msg = {
    to,
    from: SENDGRID_FROM,
    subject: `[Parrish Portal] Request Update — ${label}`,
    text: [
      `Hello ${recipientName},`,
      '',
      `Your request for patient ${patientName} has been ${label}.`,
      '',
      `Admin notes: ${adminNotes || 'None'}`,
      rmiSection,
      '',
      'Please log in to the portal for full details.',
      '',
      '— Parrish Health Staff Portal',
    ].join('\n'),
  };

  await sgMail.send(msg);
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

// ─── Requests: updated (status change = approve / deny / rmi) ────────────────

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
      after.status === 'rmi'      ? 'request.rmi'     :
      'request.update';

    // Write audit log
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
        rmiNotes:   after.rmiNotes   ?? null,
        processedAt: after.processedAt ?? null,
      },
    });

    // Send notification email to submitter if their prefs allow it
    try {
      const submitterId = after.submitterId as string | undefined;
      if (submitterId) {
        const staffSnap = await db.doc(`staff/${submitterId}`).get();
        const staff = staffSnap.data();
        if (staff?.notificationPrefs?.emailOnStatusChange && staff?.email) {
          await sendStatusEmail(
            staff.email as string,
            staff.displayName as string,
            (after.patientName as string) ?? 'Unknown',
            after.status as string,
            (after.adminNotes as string) ?? '',
            (after.rmiNotes as string | undefined)
          );
        }
      }
    } catch (emailErr) {
      console.error('[SendGrid] Failed to send status email:', emailErr);
      // Non-fatal — do not throw
    }
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

// ─── Callable: admin processes a request (Zod-validated) ─────────────────────

export const processRequestStatus = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  // RBAC: only admins may call this function
  const callerSnap = await db.doc(`staff/${request.auth.uid}`).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }

  // Server-side Zod validation
  const parsed = requestStatusUpdateSchema.safeParse({
    ...request.data,
    adminId: request.auth.uid,
  });
  if (!parsed.success) {
    throw new HttpsError(
      'invalid-argument',
      parsed.error.issues.map((issue) => issue.message).join('; ')
    );
  }

  const { requestId, status, adminNotes, rmiNotes } = parsed.data;

  await db.doc(`requests/${requestId}`).update({
    status,
    adminNotes,
    rmiNotes: rmiNotes ?? null,
    processedBy:  request.auth.uid,
    processedAt:  Date.now(),
    updatedAt:    Date.now(),
  });

  return { success: true };
});

// ─── Catalog seeding — admin-only callable function ──────────────────────────

export const seedCatalog = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const callerSnap = await db.doc(`staff/${request.auth.uid}`).get();
  if (!callerSnap.exists || callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin role required.');
  }

  return { message: 'Seed callable ready. Import from migration script.' };
});
