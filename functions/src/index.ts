/**
 * functions/src/index.ts — Block 6: Email Notifications via Trigger Email Extension
 *
 * Functions:
 *   logAuthEvent          — callable: writes auth actions to audit_log
 *   onNewRequest          — Firestore trigger: emails admins when a request is created
 *   onRequestStatusChange — Firestore trigger: emails submitter on approved/denied/rmi
 *   onNewMessage          — Firestore trigger: emails recipient on new message
 *   onNewInvitation       — Firestore trigger: emails invitee with branded invite + password link
 *
 * Email delivery: writes to `mail` collection; Firebase "Trigger Email from Firestore"
 * extension handles SMTP delivery via notifications@harmonyhca.org.
 * No clinical data (diagnoses, drug names, ICD codes) is included in any email.
 */

import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {setGlobalOptions} from "firebase-functions";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {onDocumentCreated, onDocumentUpdated} from "firebase-functions/v2/firestore";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {requestCreateSchema, messageCreateSchema} from "./schemas";

initializeApp();
const db = getFirestore();

setGlobalOptions({maxInstances: 10});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  dme: "DME Request",
  medication: "Medication Request",
  multi_medication: "Multi-Medication Batch",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? "Request";
}

const STATUS_SUBJECTS: Record<string, string> = {
  approved: "approved",
  denied: "denied",
  rmi: "needs more information",
  filled: "filled",
};

async function writeAuditLog(
  action: string,
  actorId: string,
  actorEmail: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  await db.collection("audit_log").add({
    action,
    actorId,
    actorEmail,
    timestamp: FieldValue.serverTimestamp(),
    metadata,
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function portalLink(): string {
  return "https://dme-portal.web.app";
}

function emailFooter(): string {
  return `<p style="color:#999;font-size:11px;margin-top:24px;">
    Do not reply to this email. Use the portal for all communication.<br>
    Parrish Health DME Portal · <a href="${portalLink()}" style="color:#5B7A5E;">Log in to portal</a>
  </p>`;
}

function emailWrapper(body: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#2C2825;">
      <div style="background:#5B7A5E;padding:14px 20px;">
        <span style="color:#fff;font-size:15px;font-weight:bold;">Parrish Health DME Portal</span>
      </div>
      <div style="padding:24px 20px;background:#fff;border:1px solid #E2DDD5;">
        ${body}
      </div>
    </div>`;
}

// ─── logAuthEvent (callable) ──────────────────────────────────────────────────

export const logAuthEvent = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be signed in.");
  }
  await db.collection("audit_log").add({
    action: request.data.action ?? "auth.unknown",
    actorId: request.auth.uid,
    actorEmail: request.auth.token.email ?? "",
    timestamp: FieldValue.serverTimestamp(),
    metadata: {},
  });
});

// ─── onNewRequest ────────────────────────────────────────────────────────────

export const onNewRequest = onDocumentCreated(
  "requests/{requestId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Validate document shape
    const parsed = requestCreateSchema.safeParse(data);
    if (!parsed.success) {
      console.warn(
        `[onNewRequest] Invalid request document ${event.params.requestId}:`,
        parsed.error.issues
      );
    }

    // Fetch submitter name + email
    const submitterSnap = await db.collection("staff").doc(data.submittedBy).get();
    const submitterDoc  = submitterSnap.data();
    const submitterName: string = escapeHtml(submitterDoc?.displayName ?? "A staff member");

    // Audit log — record creation (no PHI, just IDs + type)
    await writeAuditLog(
      "request.created",
      data.submittedBy,
      submitterDoc?.email ?? "",
      {
        requestId: event.params.requestId,
        requestType: data.details?.type ?? "unknown",
        patientId: data.patientId,
      }
    );

    // Fetch all active admin emails
    const adminsSnap = await db.collection("staff")
      .where("role", "==", "admin")
      .where("status", "==", "active")
      .get();
    if (adminsSnap.empty) return;

    const label = typeLabel(data.details?.type ?? "");
    const subject = `New ${label} submitted by ${submitterName}`;
    const html = emailWrapper(`
      <h2 style="font-size:18px;margin-bottom:8px;">New ${label}</h2>
      <p>A new ${label.toLowerCase()} has been submitted by <strong>${submitterName}</strong>
         and is waiting for your review.</p>
      <p style="margin-top:16px;">
        <a href="${portalLink()}" style="background:#5B7A5E;color:#fff;padding:10px 18px;
           border-radius:6px;text-decoration:none;font-weight:bold;">
          Review Request
        </a>
      </p>
      ${emailFooter()}
    `);

    await Promise.all(
      adminsSnap.docs.map((doc) => {
        const email: string = doc.data().email;
        return db.collection("mail").add({to: email, message: {subject, html}});
      })
    );
  }
);

// ─── onRequestStatusChange ────────────────────────────────────────────────────

export const onRequestStatusChange = onDocumentUpdated(
  "requests/{requestId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    const newStatus: string = after.status;
    if (!["approved", "denied", "rmi", "filled"].includes(newStatus)) return;

    // Audit log — record the lifecycle change (no PHI)
    const processorId: string = after.processedBy ?? "";
    let processorEmail = "";
    if (processorId) {
      const procSnap = await db.collection("staff").doc(processorId).get();
      processorEmail = procSnap.data()?.email ?? "";
    }
    await writeAuditLog(
      `request.${newStatus}`,
      processorId,
      processorEmail,
      {
        requestId: event.params.requestId,
        requestType: after.details?.type ?? "unknown",
        patientId: after.patientId,
        previousStatus: before.status,
      }
    );

    // 'filled' is an internal admin-only step — no submitter email
    if (newStatus === "filled") return;

    // Respect submitter's notification prefs
    const submitterSnap = await db.collection("staff").doc(after.submittedBy).get();
    const submitter = submitterSnap.data();
    if (!submitter?.email) return;
    if (submitter.status === "suspended") return;
    if (submitter.notificationPrefs?.emailOnStatusChange === false) return;

    const label = typeLabel(after.details?.type ?? "");
    const statusWord = STATUS_SUBJECTS[newStatus] ?? newStatus;
    const adminNotes: string = after.adminNotes ?? "";

    let subject: string;
    let bodyText: string;

    if (newStatus === "approved") {
      subject = `Your ${label} has been approved`;
      bodyText = `Good news — your ${label.toLowerCase()} has been reviewed and <strong>approved</strong>.`;
    } else if (newStatus === "denied") {
      subject = `Your ${label} has been denied`;
      bodyText = `Your ${label.toLowerCase()} has been reviewed and <strong>denied</strong>.`;
    } else {
      subject = `More information needed on your ${label}`;
      bodyText = `Your ${label.toLowerCase()} requires ` +
        "<strong>additional information</strong> before it can be processed.";
    }

    const notesHtml = adminNotes ?
      `<p style="margin-top:12px;padding:12px;background:#F7F4EF;border-radius:6px;">
           <strong>Note from reviewer:</strong> ${escapeHtml(adminNotes)}
         </p>` :
      "";

    const html = emailWrapper(`
      <h2 style="font-size:18px;margin-bottom:8px;">Request ${
  statusWord.charAt(0).toUpperCase() + statusWord.slice(1)
}</h2>
      <p>${bodyText}</p>
      ${notesHtml}
      <p style="margin-top:16px;">
        <a href="${portalLink()}" style="background:#5B7A5E;color:#fff;padding:10px 18px;
           border-radius:6px;text-decoration:none;font-weight:bold;">
          View Request
        </a>
      </p>
      ${emailFooter()}
    `);

    await db.collection("mail").add({
      to: submitter.email,
      message: {subject, html},
    });
  }
);

// ─── onNewMessage ────────────────────────────────────────────────────────────

export const onNewMessage = onDocumentCreated(
  "communications/{messageId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Validate document shape
    const parsed = messageCreateSchema.safeParse(data);
    if (!parsed.success) {
      console.warn(
        `[onNewMessage] Invalid message document ${event.params.messageId}:`,
        parsed.error.issues
      );
    }

    // Fetch recipient — check notification prefs
    const recipientSnap = await db.collection("staff").doc(data.recipientId).get();
    const recipient = recipientSnap.data();
    if (!recipient?.email) return;
    if (recipient.status === "suspended") return;
    if (recipient.notificationPrefs?.emailOnNewMessage === false) return;

    // Fetch sender name
    const senderSnap = await db.collection("staff").doc(data.senderId).get();
    const senderName: string = escapeHtml(senderSnap.data()?.displayName ?? "A team member");

    const subject = `New message from ${senderName}`;
    const html = emailWrapper(`
      <h2 style="font-size:18px;margin-bottom:8px;">New Message</h2>
      <p>You have a new message from <strong>${senderName}</strong> in the DME Portal.</p>
      <p>Log in to read and reply — message content is end-to-end encrypted and can only
         be viewed in the portal.</p>
      <p style="margin-top:16px;">
        <a href="${portalLink()}" style="background:#5B7A5E;color:#fff;padding:10px 18px;
           border-radius:6px;text-decoration:none;font-weight:bold;">
          Read Message
        </a>
      </p>
      ${emailFooter()}
    `);

    await db.collection("mail").add({
      to: recipient.email,
      message: {subject, html},
    });
  }
);

// ─── onNewInvitation ─────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  nurse: "Nurse",
  homemaker: "Homemaker",
  office_staff: "Office Staff",
};

export const onNewInvitation = onDocumentCreated(
  "invitations/{inviteId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    if (data.status !== "pending") return;

    const email: string = data.email;
    const rawRole: string = data.role;
    const roleLabel: string = ROLE_LABELS[rawRole] ?? rawRole;
    const invitedByName: string = escapeHtml(data.invitedByName ?? "An administrator");

    // 1. Create Firebase Auth account (or find existing one)
    let uid: string;
    try {
      const userRecord = await getAuth().createUser({
        email,
        password: crypto.randomUUID(),
      });
      uid = userRecord.uid;
    } catch (err: unknown) {
      if ((err as {code?: string}).code === "auth/email-already-exists") {
        const existing = await getAuth().getUserByEmail(email);
        uid = existing.uid;
      } else {
        throw err;
      }
    }

    // 2. Create staff document
    const now = Date.now();
    await db.collection("staff").doc(uid).set({
      email,
      role: rawRole,
      displayName: email.split("@")[0],
      hasCompletedOnboarding: false,
      status: "active",
      createdAt: now,
      updatedAt: now,
      notificationPrefs: {emailOnStatusChange: true, emailOnNewMessage: true},
    });

    // 3. Generate password-reset link and send branded invitation email
    const resetLink = await getAuth().generatePasswordResetLink(email);

    const subject = "You've been invited to the Parrish Health DME Portal";
    const html = emailWrapper(`
      <h2 style="font-size:18px;margin-bottom:8px;">You're Invited</h2>
      <p><strong>${invitedByName}</strong> has invited you to join the
         Parrish Health DME Portal as a <strong>${roleLabel}</strong>.</p>
      <p>Click the button below to set your password and get started.</p>
      <p style="margin-top:16px;">
        <a href="${resetLink}" style="background:#5B7A5E;color:#fff;padding:10px 18px;
           border-radius:6px;text-decoration:none;font-weight:bold;">
          Set Your Password
        </a>
      </p>
      <p style="color:#999;font-size:12px;margin-top:16px;">
        This link expires in 1 hour. If it has expired, ask your administrator
        to resend the invitation.
      </p>
      ${emailFooter()}
    `);

    await db.collection("mail").add({to: email, message: {subject, html}});
  }
);

// ─── cleanupEphemeralMessages ────────────────────────────────────────────────

export const cleanupEphemeralMessages = onSchedule(
  {schedule: "every day 00:00", timeZone: "America/New_York"},
  async () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const cutoff = now.getTime();

    const snap = await db.collection("communications")
      .where("ephemeral", "==", true)
      .where("createdAt", "<", cutoff)
      .get();

    if (snap.empty) {
      console.log("No ephemeral messages to clean up.");
      return;
    }

    let batch = db.batch();
    let count = 0;
    for (const doc of snap.docs) {
      batch.delete(doc.ref);
      count++;
      if (count % 500 === 0) {
        await batch.commit();
        batch = db.batch();
      }
    }
    if (count % 500 !== 0) await batch.commit();

    console.log(`Cleaned up ${count} ephemeral messages.`);
  }
);

// ─── onStaffOnboarded ────────────────────────────────────────────────────────

export const onStaffOnboarded = onDocumentUpdated(
  "staff/{staffId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    // Only fire when onboarding transitions false → true
    if (before.hasCompletedOnboarding || !after.hasCompletedOnboarding) return;

    const email: string = after.email;
    if (!email) return;

    // Find matching pending invitation(s) by email
    const invSnap = await db.collection("invitations")
      .where("email", "==", email)
      .where("status", "==", "pending")
      .get();

    if (invSnap.empty) return;

    const batch = db.batch();
    for (const inv of invSnap.docs) {
      batch.update(inv.ref, {
        status: "accepted",
        acceptedAt: Date.now(),
      });
    }
    await batch.commit();

    console.log(
      `Marked ${invSnap.size} invitation(s) as accepted for ${email}`
    );
  }
);
