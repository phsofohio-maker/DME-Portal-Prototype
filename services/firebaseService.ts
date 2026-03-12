/**
 * firebaseService.ts — Phase 1 rewrite
 *
 * Replaces all localStorage operations with Firebase Auth + Firestore SDK calls.
 * The external API surface is intentionally kept close to the prototype so
 * that component changes remain minimal in this phase.
 *
 * Collections:
 *   staff          — user profiles, RBAC roles
 *   requests       — DME / medication requests
 *   communications — HIPAA messaging threads
 *   invitations    — pending staff invitations
 *   audit_log      — append-only, written by Cloud Functions
 *   dme_catalog    — equipment catalog
 *   patients       — interim patient registry (Phase 3 → HL7 FHIR)
 */

import {
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

import { auth, db, functions } from './firebase';
import { messaging as messagingPromise } from './firebase';
import { getToken } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { logger } from './logger';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import {
  generateConversationKey,
  encryptMessage,
  decryptMessage,
} from './cryptoService';
import {
  Staff,
  Request,
  Communication,
  UserInvitation,
  UserRole,
  RequestStatus,
  NotificationPrefs,
  AppNotification,
  NotificationType,
  AuditLogEntry,
  AuditAction,
} from '../types';
import { MOCK_DME, MOCK_PATIENTS } from './mockData';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const toStaff = (id: string, data: DocumentData): Staff =>
  ({ uid: id, ...data } as Staff);

const toRequest = (id: string, data: DocumentData): Request =>
  ({ id, ...data } as Request);

const toComm = (id: string, data: DocumentData): Communication =>
  ({ id, ...data } as Communication);

// ─── Conversation key management (Phase 3 §3.4) ───────────────────────────────

function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

/**
 * Returns the AES-GCM-256 key for a conversation, creating it on first use.
 * Key is stored in `conversationKeys/{conversationId}` and access-controlled
 * by Firestore Security Rules to the two participants only.
 */
async function getOrCreateConversationKey(uid1: string, uid2: string): Promise<string> {
  const convId = getConversationId(uid1, uid2);
  const keyRef = doc(db, 'conversationKeys', convId);
  const snap = await getDoc(keyRef);
  if (snap.exists()) return snap.data().key as string;

  const key = await generateConversationKey();
  await setDoc(keyRef, { participants: [uid1, uid2].sort(), key });
  return key;
}

/** Decrypt a single message; pass through unchanged if it has no IV (legacy plaintext). */
async function decryptComm(key: string, msg: Communication): Promise<Communication> {
  if (!msg.iv) return msg;
  try {
    const plaintext = await decryptMessage(key, msg.iv, msg.messageBody);
    return { ...msg, messageBody: plaintext };
  } catch {
    return { ...msg, messageBody: '[Unable to decrypt message]' };
  }
}

const toInvite = (id: string, data: DocumentData): UserInvitation =>
  ({ id, ...data } as UserInvitation);

// ─── firebaseService ─────────────────────────────────────────────────────────

export const firebaseService = {
  // ── Auth ───────────────────────────────────────────────────────────────────

  /**
   * Sign in with email + password via Firebase Auth.
   * Writes an auth.login audit entry via Cloud Function after successful auth.
   */
  login: async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
    // Fire-and-forget audit log — non-fatal if CF is unavailable during dev
    httpsCallable(functions, 'logAuthEvent')({ action: 'auth.login' }).catch(() => {});
  },

  logout: async (): Promise<void> => {
    // Log before signing out while the ID token is still valid
    try {
      await httpsCallable(functions, 'logAuthEvent')({ action: 'auth.logout' });
    } catch {
      // Non-fatal — still sign out even if audit log fails
    }
    await signOut(auth);
  },

  /**
   * Load a staff profile from Firestore by Firebase Auth UID.
   * Called by the onAuthStateChanged listener after authentication.
   */
  getStaffProfile: async (uid: string): Promise<Staff | null> => {
    const snap = await getDoc(doc(db, 'staff', uid));
    if (!snap.exists()) return null;
    return toStaff(snap.id, snap.data());
  },

  // ── User Management ────────────────────────────────────────────────────────

  getAllStaff: async (): Promise<Staff[]> => {
    const snap = await getDocs(collection(db, 'staff'));
    return snap.docs.map((d) => toStaff(d.id, d.data()));
  },

  updateStaff: async (uid: string, updates: Partial<Staff>): Promise<void> => {
    await retryWithBackoff(
      () => updateDoc(doc(db, 'staff', uid), { ...updates, updatedAt: Date.now() }),
      'updateStaff'
    );
  },

  /**
   * Soft-delete: suspend the account rather than hard-delete.
   * HIPAA requires records to be retained for at least 6 years.
   */
  deleteStaff: async (uid: string): Promise<void> => {
    await updateDoc(doc(db, 'staff', uid), {
      status: 'suspended',
      updatedAt: Date.now(),
    });
  },

  // ── Invitations ────────────────────────────────────────────────────────────

  getInvites: async (): Promise<UserInvitation[]> => {
    const q = query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => toInvite(d.id, d.data()));
  },

  /**
   * Send a staff invitation:
   *   1. Create a Firebase Auth account for the invitee (temp password).
   *   2. Create a Firestore staff profile stub (hasCompletedOnboarding: false).
   *   3. Store the invitation record in Firestore.
   *   4. Trigger a Firebase Auth password-reset email so the invitee can set
   *      their own password before first login.
   */
  sendInvite: async (email: string, role: UserRole, admin: Staff): Promise<void> => {
    // Generate a secure temp password (user will reset via email link)
    const tempPassword = crypto.randomUUID();

    const credential = await createUserWithEmailAndPassword(auth, email, tempPassword);
    const newUid = credential.user.uid;

    const now = Date.now();

    // Create Firestore staff profile stub
    await setDoc(doc(db, 'staff', newUid), {
      email,
      role,
      displayName: email.split('@')[0],
      hasCompletedOnboarding: false,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      notificationPrefs: { emailOnStatusChange: true, emailOnNewMessage: true },
    } satisfies Omit<Staff, 'uid'>);

    // Store the invitation record
    await addDoc(collection(db, 'invitations'), {
      email,
      role,
      invitedBy: admin.uid,
      invitedByName: admin.displayName,
      createdAt: now,
      status: 'pending',
    } satisfies Omit<UserInvitation, 'id'>);

    // Send password-reset email so the invitee can set their own password
    await sendPasswordResetEmail(auth, email);
  },

  revokeInvite: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'invitations', id), {
      status: 'expired',
      updatedAt: Date.now(),
    });
  },

  // ── Requests ───────────────────────────────────────────────────────────────

  submitRequest: async (
    request: Omit<Request, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<string> => {
    const now = Date.now();
    const ref = await retryWithBackoff(
      () => addDoc(collection(db, 'requests'), {
        ...request,
        status: 'pending',
        createdAt: now,
        updatedAt: now,
      }),
      'submitRequest'
    );
    return ref.id;
  },

  /**
   * Escalate a request: assign to a specific admin and/or flag for supervisor review.
   * Escalation is additive — it does not change the request status.
   */
  escalateRequest: async (
    requestId: string,
    escalatedTo?: string,
    escalatedToName?: string,
    flaggedForSupervisor?: boolean,
    escalationNote?: string
  ): Promise<void> => {
    const update: Record<string, unknown> = {
      escalatedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (escalatedTo) {
      update['escalatedTo'] = escalatedTo;
      update['escalatedToName'] = escalatedToName ?? '';
    }
    if (flaggedForSupervisor !== undefined) update['flaggedForSupervisor'] = flaggedForSupervisor;
    if (escalationNote) update['escalationNote'] = escalationNote;
    await retryWithBackoff(
      () => updateDoc(doc(db, 'requests', requestId), update),
      'escalateRequest'
    );
  },

  /**
   * Bulk approve or deny multiple requests in parallel.
   * All updates use retryWithBackoff — partial failures are surfaced via Promise.allSettled.
   */
  bulkUpdateRequestStatus: async (
    requestIds: string[],
    status: 'approved' | 'denied',
    adminNotes: string,
    adminId: string
  ): Promise<{ succeeded: string[]; failed: string[] }> => {
    const now = Date.now();
    const results = await Promise.allSettled(
      requestIds.map((id) =>
        retryWithBackoff(
          () =>
            updateDoc(doc(db, 'requests', id), {
              status,
              adminNotes,
              processedBy: adminId,
              processedAt: now,
              updatedAt: now,
            }),
          `bulkUpdate[${id}]`
        ).then(() => id)
      )
    );
    const succeeded: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') succeeded.push(requestIds[i]);
      else failed.push(requestIds[i]);
    });
    return { succeeded, failed };
  },

  getRequests: async (): Promise<Request[]> => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => toRequest(d.id, d.data()));
  },

  updateRequestStatus: async (
    requestId: string,
    status: RequestStatus,
    adminNotes: string,
    adminId: string,
    rmiNotes?: string
  ): Promise<void> => {
    const update: Record<string, unknown> = {
      status,
      adminNotes,
      processedBy: adminId,
      processedAt: Date.now(),
      updatedAt: Date.now(),
    };
    if (rmiNotes !== undefined) update['rmiNotes'] = rmiNotes;
    await retryWithBackoff(
      () => updateDoc(doc(db, 'requests', requestId), update),
      'updateRequestStatus'
    );
  },

  /**
   * Real-time listener for a specific user's requests (Dashboard).
   * Returns the unsubscribe function — call it in useEffect cleanup.
   */
  subscribeToUserRequests: (
    uid: string,
    callback: (requests: Request[]) => void
  ): Unsubscribe => {
    const q = query(
      collection(db, 'requests'),
      where('submitterId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => toRequest(d.id, d.data())));
    });
  },

  /**
   * Real-time listener for all requests (Admin inbox).
   * Returns the unsubscribe function.
   */
  subscribeToAllRequests: (callback: (requests: Request[]) => void): Unsubscribe => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => toRequest(d.id, d.data())));
    });
  },

  // ── Messaging ──────────────────────────────────────────────────────────────

  getMessagesBetween: async (uid1: string, uid2: string): Promise<Communication[]> => {
    // Firestore doesn't support OR queries on different fields natively.
    // Fetch both directions and merge client-side.
    const [sent, received] = await Promise.all([
      getDocs(
        query(
          collection(db, 'communications'),
          where('senderId', '==', uid1),
          where('recipientId', '==', uid2),
          orderBy('createdAt', 'asc')
        )
      ),
      getDocs(
        query(
          collection(db, 'communications'),
          where('senderId', '==', uid2),
          where('recipientId', '==', uid1),
          orderBy('createdAt', 'asc')
        )
      ),
    ]);

    const all = [
      ...sent.docs.map((d) => toComm(d.id, d.data())),
      ...received.docs.map((d) => toComm(d.id, d.data())),
    ];
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },

  /**
   * Real-time listener for messages between two users (MessagingPortal).
   * Replaces the 1-second setInterval polling from Phase 0.
   * Returns unsubscribe function for useEffect cleanup.
   */
  subscribeToMessagesBetween: (
    uid1: string,
    uid2: string,
    callback: (messages: Communication[]) => void
  ): Unsubscribe => {
    // Track latest encrypted snapshot from each direction.
    let sentEncrypted: Communication[] = [];
    let receivedEncrypted: Communication[] = [];

    // Fetch (or create) the conversation key once — reused for every decrypt.
    const keyPromise = getOrCreateConversationKey(uid1, uid2);

    const emitDecrypted = () => {
      const all = [...sentEncrypted, ...receivedEncrypted];
      keyPromise.then(async (key) => {
        const decrypted = await Promise.all(all.map((m) => decryptComm(key, m)));
        callback(decrypted.sort((a, b) => a.createdAt - b.createdAt));
      });
    };

    const unsubSent = onSnapshot(
      query(
        collection(db, 'communications'),
        where('senderId', '==', uid1),
        where('recipientId', '==', uid2),
        orderBy('createdAt', 'asc')
      ),
      (snap) => {
        sentEncrypted = snap.docs.map((d) => toComm(d.id, d.data()));
        emitDecrypted();
      }
    );

    const unsubReceived = onSnapshot(
      query(
        collection(db, 'communications'),
        where('senderId', '==', uid2),
        where('recipientId', '==', uid1),
        orderBy('createdAt', 'asc')
      ),
      (snap) => {
        receivedEncrypted = snap.docs.map((d) => toComm(d.id, d.data()));
        emitDecrypted();
      }
    );

    return () => {
      unsubSent();
      unsubReceived();
    };
  },

  sendMessage: async (
    message: Omit<Communication, 'id' | 'createdAt' | 'read'>
  ): Promise<void> => {
    const key = await getOrCreateConversationKey(message.senderId, message.recipientId);
    const { iv, ciphertext } = await encryptMessage(key, message.messageBody);
    await retryWithBackoff(
      () => addDoc(collection(db, 'communications'), {
        ...message,
        messageBody: ciphertext,
        iv,
        read: false,
        createdAt: Date.now(),
      }),
      'sendMessage'
    );
  },

  // ── Catalog & Patient Seeding (run once by an admin) ─────────────────────
  // Note: email notifications are handled server-side by Cloud Functions
  // (onRequestUpdated, onRequestCreated, onMessageCreated in functions/src/index.ts).
  // The client does not need to send emails directly.

  /**
   * Seeds the dme_catalog and patients Firestore collections from mock data.
   * Safe to call repeatedly — uses setDoc with the item's existing ID.
   * Call this from an admin-only action or a one-time migration script.
   */
  seedCatalog: async (): Promise<void> => {
    const batch: Promise<void>[] = [];

    for (const item of MOCK_DME) {
      batch.push(
        setDoc(doc(db, 'dme_catalog', item.id), {
          itemName: item.itemName,
          sku: item.sku,
          category: item.category,
        })
      );
    }

    for (const patient of MOCK_PATIENTS) {
      batch.push(setDoc(doc(db, 'patients', patient.id), patient));
    }

    await Promise.all(batch);
    logger.info('firebaseService', 'dme_catalog and patients collections seeded.');
  },

  updateNotificationPrefs: async (uid: string, prefs: NotificationPrefs): Promise<void> => {
    await retryWithBackoff(
      () => updateDoc(doc(db, 'staff', uid), { notificationPrefs: prefs, updatedAt: Date.now() }),
      'updateNotificationPrefs'
    );
  },

  /**
   * Request browser push notification permission and register the FCM service
   * worker. On success, the device token is saved to the staff Firestore
   * document so Cloud Functions can deliver targeted push messages.
   *
   * Safe to call multiple times — exits early if permission is already granted
   * and a token is already stored.  Returns false if unsupported or denied.
   */
  requestPushPermission: async (uid: string): Promise<boolean> => {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;

    const messaging = await messagingPromise;
    if (!messaging) return false;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return false;

    try {
      // Register the service worker and give it the Firebase config
      // (config values are non-secret — they identify the project, not auth keys)
      const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const config = {
        apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
        authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
        storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId:             import.meta.env.VITE_FIREBASE_APP_ID,
      };
      swReg.active?.postMessage({ type: 'FIREBASE_CONFIG', config });

      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swReg,
      });

      if (token) {
        await updateDoc(doc(db, 'staff', uid), { fcmToken: token, updatedAt: Date.now() });
      }

      return !!token;
    } catch (err) {
      logger.warn('firebaseService', 'Failed to register push notifications', err);
      return false;
    }
  },

  // ── In-App Notifications ───────────────────────────────────────────────────

  /**
   * Creates a notification document in the `notifications` collection.
   * Called server-side via Cloud Functions; can also be called client-side
   * as a fallback when Cloud Functions are unavailable in development.
   */
  createNotification: async (
    recipientId: string,
    type: NotificationType,
    title: string,
    body: string,
    resourceId?: string
  ): Promise<void> => {
    await addDoc(collection(db, 'notifications'), {
      recipientId,
      type,
      title,
      body,
      resourceId: resourceId ?? null,
      read: false,
      createdAt: Date.now(),
    } satisfies Omit<AppNotification, 'id'>);
  },

  /**
   * Real-time listener for a user's unread + recent notifications.
   * Returns the unsubscribe function for useEffect cleanup.
   */
  subscribeToNotifications: (
    uid: string,
    callback: (notifications: AppNotification[]) => void
  ): Unsubscribe => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, (snap) => {
      callback(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification))
      );
    });
  },

  /**
   * Mark a single notification as read.
   */
  markNotificationRead: async (notificationId: string): Promise<void> => {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  },

  /**
   * Mark all notifications for a user as read.
   */
  markAllNotificationsRead: async (uid: string): Promise<void> => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', uid),
      where('read', '==', false)
    );
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
  },

  // ── Message read tracking ──────────────────────────────────────────────────

  /**
   * Mark a message as read when the recipient views the conversation.
   */
  markMessageRead: async (messageId: string): Promise<void> => {
    await updateDoc(doc(db, 'communications', messageId), { read: true });
  },

  // ── Audit Log ──────────────────────────────────────────────────────────────

  /**
   * Fetch a page of audit log entries (admin only — enforced by Firestore rules).
   * Returns entries and a cursor for the next page.
   *
   * @param pageSize   Number of entries per page (default 50)
   * @param after      Cursor from a previous call (for pagination)
   * @param filterAction  Optional action type to filter on
   */
  getAuditLog: async (
    pageSize = 50,
    after?: QueryDocumentSnapshot<DocumentData>,
    filterAction?: AuditAction
  ): Promise<{ entries: AuditLogEntry[]; cursor: QueryDocumentSnapshot<DocumentData> | null }> => {
    const constraints = [
      ...(filterAction ? [where('action', '==', filterAction)] : []),
      orderBy('timestamp', 'desc'),
      limit(pageSize),
      ...(after ? [startAfter(after)] : []),
    ];
    const q = query(collection(db, 'audit_log'), ...constraints);
    const snap = await getDocs(q);
    const entries = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      // Firestore serverTimestamp may come back as a Timestamp object
      timestamp: d.data()['timestamp']?.toMillis?.() ?? d.data()['timestamp'] ?? 0,
    } as AuditLogEntry));
    const cursor = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
    return { entries, cursor };
  },

  /**
   * Fetch aggregated request counts for the analytics dashboard.
   * Returns counts by status and a 30-day daily submission series.
   */
  getAnalytics: async (): Promise<{
    totalRequests: number;
    byStatus: Record<string, number>;
    recentRequests: Request[];
    activeStaff: number;
  }> => {
    const [requestsSnap, staffSnap] = await Promise.all([
      getDocs(query(collection(db, 'requests'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'staff'), where('status', '==', 'active'))),
    ]);

    const requests = requestsSnap.docs.map((d) => toRequest(d.id, d.data()));
    const byStatus: Record<string, number> = { pending: 0, approved: 0, denied: 0, rmi: 0 };
    for (const r of requests) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
    }

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentRequests = requests.filter((r) => r.createdAt >= thirtyDaysAgo);

    return {
      totalRequests: requests.length,
      byStatus,
      recentRequests,
      activeStaff: staffSnap.size,
    };
  },

  // ── Timestamp util ─────────────────────────────────────────────────────────
  serverTimestamp,
};
