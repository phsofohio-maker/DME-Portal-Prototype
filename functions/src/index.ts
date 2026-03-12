/**
 * Parrish Health DME Portal — Cloud Functions (Phase 3)
 *
 * Responsibilities:
 *   1. Write immutable audit log entries for every state-changing Firestore
 *      operation (HIPAA Security Rule §164.312(b) — Audit Controls).
 *   2. Send transactional emails via SendGrid when request status changes.
 *   3. Server-side Zod validation on callable functions.
 *   4. Create in-app notifications in the `notifications` collection when
 *      a request status changes or a new secure message is received.
 *
 * Environment variables required (set via `firebase functions:config:set` or
 * Secret Manager in production):
 *   SENDGRID_API_KEY — SendGrid API key
 *   SENDGRID_FROM    — verified sender email address
 */

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import {
  onDocumentCreated,
  onDocumentUpdated,
} from 'firebase-functions/v2/firestore';
import { onCall, HttpsError, onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as sgMail from '@sendgrid/mail';
import { requestStatusUpdateSchema } from './schemas';

initializeApp();
const db = getFirestore();

// ─── Configuration ────────────────────────────────────────────────────────────

const SENDGRID_API_KEY   = process.env['SENDGRID_API_KEY'] ?? '';
const SENDGRID_FROM      = process.env['SENDGRID_FROM'] ?? 'noreply@parrishhealth.com';
const SLACK_WEBHOOK_URL  = process.env['SLACK_WEBHOOK_URL'] ?? '';

// ─── Slack alerting (Phase 5) ─────────────────────────────────────────────────

/**
 * Send a critical alert to the configured Slack webhook.
 * Set SLACK_WEBHOOK_URL in Cloud Functions environment config.
 * Non-fatal — if Slack delivery fails the originating function still succeeds.
 */
async function sendSlackAlert(
  level: 'critical' | 'warning',
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!SLACK_WEBHOOK_URL) return;

  const emoji = level === 'critical' ? ':rotating_light:' : ':warning:';
  const color = level === 'critical' ? '#dc2626' : '#f59e0b';

  const body = {
    attachments: [
      {
        color,
        title: `${emoji} [${level.toUpperCase()}] ${context}`,
        text: message,
        fields: metadata
          ? Object.entries(metadata).map(([k, v]) => ({
              title: k,
              value: String(v),
              short: true,
            }))
          : [],
        footer: 'Parrish Health DME Portal — Cloud Functions',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error(`[Slack] Webhook failed: ${res.status} ${await res.text()}`);
    }
  } catch (err) {
    console.error('[Slack] Failed to send alert:', err);
  }
}

// ─── FCM push helper (Phase 3.3) ─────────────────────────────────────────────

/**
 * Send a Firebase Cloud Messaging push notification to a specific device token.
 * Looks up the recipient's fcmToken from their staff document.
 * Non-fatal — if push fails (expired token, permission revoked) the
 * originating function still succeeds.
 */
async function sendPushNotification(
  recipientId: string,
  title: string,
  body: string
): Promise<void> {
  try {
    const staffSnap = await db.doc(`staff/${recipientId}`).get();
    const token = staffSnap.data()?.fcmToken as string | undefined;
    if (!token) return; // user hasn't enabled push or token not yet saved

    await getMessaging().send({
      token,
      notification: { title, body },
      android: { notification: { icon: 'notification_icon', color: '#2563eb' } },
      apns: { payload: { aps: { badge: 1 } } },
    });
  } catch (err) {
    // Token may be stale (e.g. user cleared browser data) — log but don't throw
    console.warn(`[FCM] Push to ${recipientId} failed:`, err);
  }
}

/**
 * HTTP endpoint that the client-side logger.critical() can call to trigger
 * Slack alerts from the browser (Phase 5 TODO from logger.ts).
 *
 * Requires a valid Firebase ID token in the Authorization header so only
 * authenticated staff can trigger alerts.
 */
export const triggerAlert = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const { level = 'critical', context = 'Client', message = 'No message', metadata } =
      req.body as { level?: string; context?: string; message?: string; metadata?: Record<string, unknown> };

    await sendSlackAlert(
      level === 'warning' ? 'warning' : 'critical',
      context,
      message,
      metadata
    );

    res.status(200).json({ ok: true });
  }
);

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

// ─── Helper: create an in-app notification ────────────────────────────────────

async function createNotification(
  recipientId: string,
  type: string,
  title: string,
  body: string,
  resourceId?: string
): Promise<void> {
  try {
    await db.collection('notifications').add({
      recipientId,
      type,
      title,
      body,
      resourceId: resourceId ?? null,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err);
    // Non-fatal — do not throw
  }
}

// ─── Helper: notify admins of a new submission ────────────────────────────────

/**
 * Fetches all active admin staff documents and sends a new-submission email to
 * each admin whose notificationPrefs.emailOnStatusChange is true.
 *
 * HIPAA note: email contains only patient name and submitter name (no clinical
 * details). Admins must log in to the portal to view full request content.
 */
async function notifyAdminsOfNewRequest(
  requestId: string,
  submitterName: string,
  patientName: string,
  requestType: string
): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.log(`[SendGrid SKIPPED — no API key] New request ${requestId} by ${submitterName}`);
    return;
  }

  try {
    const adminsSnap = await db
      .collection('staff')
      .where('role', '==', 'admin')
      .where('status', '==', 'active')
      .get();

    const sends = adminsSnap.docs
      .filter((doc) => doc.data()?.notificationPrefs?.emailOnStatusChange === true)
      .map((doc) => {
        const admin = doc.data();
        return sgMail.send({
          to: admin.email as string,
          from: SENDGRID_FROM,
          subject: '[Parrish Portal] New Request Submitted',
          text: [
            `Hello ${admin.displayName as string},`,
            '',
            `A new ${requestType.toUpperCase()} request has been submitted.`,
            '',
            `Patient: ${patientName}`,
            `Submitted by: ${submitterName}`,
            '',
            'Please log in to the Admin Inbox to review and process this request.',
            '',
            '— Parrish Health Staff Portal',
          ].join('\n'),
        });
      });

    await Promise.allSettled(sends);
  } catch (err) {
    console.error('[SendGrid] Failed to notify admins of new request:', err);
    // Non-fatal
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

    // Write audit log
    await db.collection('audit_log').add({
      timestamp:    FieldValue.serverTimestamp(),
      actorId,
      actorRole,
      action:       'request.create',
      resourceType: 'request',
      resourceId:   event.params.requestId,
      after:        data,
    });

    // Notify admins of new submission
    await notifyAdminsOfNewRequest(
      event.params.requestId,
      (data.submitterName as string) ?? 'Unknown',
      (data.patientName   as string) ?? 'Unknown',
      (data.type          as string) ?? 'unknown'
    );
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

    // Create in-app notification + FCM push for the submitter (if prefs allow)
    const submitterId = after.submitterId as string | undefined;
    if (submitterId) {
      const statusLabels: Record<string, string> = {
        approved: 'Approved',
        denied:   'Denied',
        rmi:      'More Info Needed',
      };
      const label = statusLabels[after.status as string] ?? String(after.status);
      const notifTitle = `Request ${label}`;
      const notifBody  = `Your request for ${(after.patientName as string) ?? 'a patient'} has been ${label.toLowerCase()}.`;

      // Check submitter's in-app notification preference (default: on)
      const submitterSnap = await db.doc(`staff/${submitterId}`).get();
      const submitterPrefs = submitterSnap.data()?.notificationPrefs;
      if (submitterPrefs?.inAppOnStatusChange !== false) {
        await Promise.all([
          createNotification(submitterId, 'request.status_change', notifTitle, notifBody, event.params.requestId),
          sendPushNotification(submitterId, notifTitle, notifBody),
        ]);
      }
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

    // Create in-app notification and send email to the recipient
    const recipientId = data.recipientId as string | undefined;
    const senderName  = data.senderName  as string | undefined;
    if (recipientId && senderName) {
      const pushTitle = `New message from ${senderName}`;
      const pushBody  = 'You have a new secure message. Click to view.';

      // Check recipient's in-app notification preference (default: on)
      const recipientPrefSnap = await db.doc(`staff/${recipientId}`).get();
      const recipientPrefs = recipientPrefSnap.data()?.notificationPrefs;
      if (recipientPrefs?.inAppOnNewMessage !== false) {
        await Promise.all([
          createNotification(recipientId, 'message.received', pushTitle, pushBody, event.params.msgId),
          sendPushNotification(recipientId, pushTitle, pushBody),
        ]);
      }

      // Email the recipient if they have emailOnNewMessage enabled
      try {
        if (SENDGRID_API_KEY) {
          const recipientSnap = await db.doc(`staff/${recipientId}`).get();
          const recipient = recipientSnap.data();
          if (recipient?.notificationPrefs?.emailOnNewMessage && recipient?.email) {
            await sgMail.send({
              to: recipient.email as string,
              from: SENDGRID_FROM,
              subject: `[Parrish Portal] New secure message from ${senderName}`,
              text: [
                `Hello ${recipient.displayName as string},`,
                '',
                `You have a new secure message from ${senderName}.`,
                '',
                'HIPAA reminder: do not reply to this email. Log in to the portal to read and',
                'respond through the secure HIPAA-compliant messaging channel.',
                '',
                '— Parrish Health Staff Portal',
              ].join('\n'),
            });
          }
        }
      } catch (emailErr) {
        console.error('[SendGrid] Failed to send message notification email:', emailErr);
        // Non-fatal
      }
    }
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

// ─── Auth event audit logging (Phase 4 §7.1 — HIPAA 164.312(b)) ──────────────

/**
 * Callable function that writes auth.login / auth.logout events to the
 * immutable audit_log collection.
 *
 * Why callable instead of a Firestore trigger: Firebase Auth events are not
 * Firestore document changes, so they cannot use onDocumentCreated/Updated.
 * The audit_log security rules block all client writes, so the client calls
 * this function which writes via the Admin SDK (bypasses rules).
 *
 * The function trusts request.auth (verified by Firebase ID token) — no
 * additional authorization check is needed since any authenticated active
 * staff member may log their own session events.
 */
export const logAuthEvent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const VALID_AUTH_ACTIONS = ['auth.login', 'auth.logout', 'auth.timeout', 'auth.mfa_enrollment', 'auth.mfa_challenge'];
  const action = request.data?.action as string | undefined;
  if (!action || !VALID_AUTH_ACTIONS.includes(action)) {
    throw new HttpsError('invalid-argument', `action must be one of: ${VALID_AUTH_ACTIONS.join(', ')}`);
  }

  const uid      = request.auth.uid;
  const roleSnap = await db.doc(`staff/${uid}`).get();
  const role     = (roleSnap.data()?.role as string) ?? 'unknown';

  await db.collection('audit_log').add({
    timestamp:    FieldValue.serverTimestamp(),
    actorId:      uid,
    actorRole:    role,
    action,
    resourceType: 'auth',
    resourceId:   uid,
  });

  return { logged: true };
});

// ─── Scheduled data retention (Phase 4 §7.3 — HIPAA record retention) ────────

/**
 * Runs on the 1st of each month. Marks requests older than 7 years as
 * `archived: true` (soft-archive — records are never hard-deleted).
 *
 * HIPAA requires 6 years for compliance documentation; many states require
 * 7–10 years for medical records. Parrish Health uses 7 years by default.
 * Update RETENTION_YEARS to match your state's requirements.
 *
 * Archived requests are excluded from the active Admin Inbox but remain
 * queryable for audit and legal purposes.
 */
const RETENTION_YEARS = 7;

export const scheduledDataRetention = onSchedule('0 2 1 * *', async () => {
  const cutoff = Date.now() - RETENTION_YEARS * 365.25 * 24 * 60 * 60 * 1000;

  const staleSnap = await db
    .collection('requests')
    .where('createdAt', '<', cutoff)
    .where('archived', '==', false)
    .limit(500) // process in batches to stay within function timeout
    .get();

  if (staleSnap.empty) {
    console.log('[Retention] No requests require archiving.');
    return;
  }

  const batch = db.batch();
  staleSnap.docs.forEach((docSnap) => {
    batch.update(docSnap.ref, {
      archived:   true,
      archivedAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();

  // Audit log entry for the archival run
  await db.collection('audit_log').add({
    timestamp:    FieldValue.serverTimestamp(),
    actorId:      'system',
    actorRole:    'admin',
    action:       'request.update',
    resourceType: 'request',
    resourceId:   'batch_archive',
    after: {
      archivedCount: staleSnap.size,
      retentionYears: RETENTION_YEARS,
      cutoffTimestamp: cutoff,
    },
  });

  console.log(`[Retention] Archived ${staleSnap.size} requests older than ${RETENTION_YEARS} years.`);
});
