/**
 * firebaseService.ts — Phase 2: Firestore service layer.
 *
 * Collections:
 *   staff          — user profiles, RBAC roles
 *   requests       — DME / medication requests
 *   communications — HIPAA messaging threads (Block 3)
 *   invitations    — pending staff invitations (Block 5)
 *   audit_log      — append-only, written by Cloud Functions
 *   dme_catalog    — equipment catalog
 *   patients       — interim patient registry (Phase 4 → HL7 FHIR)
 *   notifications  — in-app notification feed
 *   conversationKeys — per-conversation AES-GCM-256 keys (Block 3)
 */

import {
  signInWithEmailAndPassword,
  signOut,
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
  arrayUnion,
  Unsubscribe,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';

import { auth, db, functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { logger } from './logger';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import {
  generateConversationKey,
  encryptMessage,
  decryptMessage,
} from './cryptoService';
import type {
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
  HistoryEntry,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toStaff   = (id: string, data: DocumentData): Staff        => ({ uid: id, ...data }   as Staff);
const toRequest = (id: string, data: DocumentData): Request      => ({ id,     ...data }     as Request);
const toComm    = (id: string, data: DocumentData): Communication => ({ id,    ...data }     as Communication);
const toInvite  = (id: string, data: DocumentData): UserInvitation => ({ id,   ...data }     as UserInvitation);

// ─── Conversation key management ──────────────────────────────────────────────

function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

async function getOrCreateConversationKey(uid1: string, uid2: string): Promise<string> {
  const convId = getConversationId(uid1, uid2);
  const keyRef = doc(db, 'conversationKeys', convId);

  // Try to read existing key. Firestore Security Rules deny reads on
  // non-existent docs (resource.data is null → rule evaluates false),
  // so a PERMISSION_DENIED here means the key doesn't exist yet.
  try {
    const snap = await getDoc(keyRef);
    if (snap.exists()) return snap.data().key as string;
  } catch {
    // Key document doesn't exist — fall through to create it
  }

  const key = await generateConversationKey();
  await setDoc(keyRef, { participants: [uid1, uid2].sort(), key });
  return key;
}

async function decryptComm(key: string, msg: Communication): Promise<Communication> {
  if (!msg.iv) return msg;
  try {
    const plaintext = await decryptMessage(key, msg.iv, msg.messageBody);
    return { ...msg, messageBody: plaintext };
  } catch {
    return { ...msg, messageBody: '[Unable to decrypt message]' };
  }
}

// ─── firebaseService ──────────────────────────────────────────────────────────

export const firebaseService = {
  // ── Auth ────────────────────────────────────────────────────────────────────

  login: async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
    httpsCallable(functions, 'logAuthEvent')({ action: 'auth.login' }).catch(() => {});
  },

  logout: async (): Promise<void> => {
    try { await httpsCallable(functions, 'logAuthEvent')({ action: 'auth.logout' }); } catch {}
    await signOut(auth);
  },

  getStaffProfile: async (uid: string): Promise<Staff | null> => {
    const snap = await getDoc(doc(db, 'staff', uid));
    if (!snap.exists()) return null;
    return toStaff(snap.id, snap.data());
  },

  // ── User Management ──────────────────────────────────────────────────────────

  getAllStaff: async (): Promise<Staff[]> => {
    const snap = await getDocs(collection(db, 'staff'));
    return snap.docs.map((d) => toStaff(d.id, d.data()));
  },

  subscribeToStaff: (callback: (staff: Staff[]) => void): Unsubscribe => {
    return onSnapshot(collection(db, 'staff'), (snap) => {
      callback(snap.docs.map((d) => toStaff(d.id, d.data())));
    });
  },

  updateStaff: async (uid: string, updates: Partial<Staff>): Promise<void> => {
    await retryWithBackoff(
      () => updateDoc(doc(db, 'staff', uid), { ...updates, updatedAt: Date.now() }),
      'updateStaff'
    );
  },

  deleteStaff: async (uid: string): Promise<void> => {
    await updateDoc(doc(db, 'staff', uid), { status: 'suspended', updatedAt: Date.now() });
  },

  reactivateStaff: async (uid: string): Promise<void> => {
    await updateDoc(doc(db, 'staff', uid), { status: 'active', updatedAt: Date.now() });
  },

  // ── Invitations ──────────────────────────────────────────────────────────────

  getInvites: async (): Promise<UserInvitation[]> => {
    const q    = query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => toInvite(d.id, d.data()));
  },

  subscribeToInvites: (callback: (invites: UserInvitation[]) => void): Unsubscribe => {
    const q = query(collection(db, 'invitations'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => toInvite(d.id, d.data())));
    });
  },

  sendInvite: async (email: string, role: UserRole, admin: Staff): Promise<void> => {
    await addDoc(collection(db, 'invitations'), {
      email,
      role,
      invitedBy:     admin.uid,
      invitedByName: admin.displayName,
      createdAt:     Date.now(),
      status:        'pending',
    });
  },

  revokeInvite: async (id: string): Promise<void> => {
    await updateDoc(doc(db, 'invitations', id), { status: 'expired', updatedAt: Date.now() });
  },

  // ── Requests ─────────────────────────────────────────────────────────────────

  submitRequest: async (
    request: Omit<Request, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    submitter: Staff
  ): Promise<string> => {
    const now = Date.now();
    const initialEntry: HistoryEntry = {
      action:    'created',
      actorId:   submitter.uid,
      actorName: submitter.displayName,
      actorRole: submitter.role,
      timestamp: now,
    };
    const ref = await retryWithBackoff(
      () => addDoc(collection(db, 'requests'), {
        ...request,
        status:    'pending',
        createdAt: now,
        updatedAt: now,
        history:   [initialEntry],
      }),
      'submitRequest'
    );
    return ref.id;
  },

  getRequests: async (): Promise<Request[]> => {
    const q    = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => toRequest(d.id, d.data()));
  },

  updateRequestStatus: async (
    requestId:      string,
    status:         RequestStatus,
    adminNotes:     string,
    admin:          Staff,
    previousStatus: RequestStatus
  ): Promise<void> => {
    const now = Date.now();
    const entry: HistoryEntry = {
      action:         status as HistoryEntry['action'],
      actorId:        admin.uid,
      actorName:      admin.displayName,
      actorRole:      admin.role,
      timestamp:      now,
      notes:          adminNotes || undefined,
      previousStatus,
      newStatus:      status,
    };
    await retryWithBackoff(
      () => updateDoc(doc(db, 'requests', requestId), {
        status,
        adminNotes,
        processedBy: admin.uid,
        processedAt: now,
        updatedAt:   now,
        history:     arrayUnion(entry),
      }),
      'updateRequestStatus'
    );
  },

  subscribeToUserRequests: (
    uid: string,
    callback: (requests: Request[]) => void
  ): Unsubscribe => {
    const q = query(
      collection(db, 'requests'),
      where('submittedBy', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => toRequest(d.id, d.data())));
    });
  },

  subscribeToAllRequests: (callback: (requests: Request[]) => void): Unsubscribe => {
    const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => toRequest(d.id, d.data())));
    });
  },

  // ── Messaging (Block 3) ────────────────────────────────────────────────────

  /** Subscribe to ALL communications involving uid (encrypted, for thread list + unread count). */
  subscribeToUserCommunications: (
    uid: string,
    callback: (comms: Communication[]) => void
  ): Unsubscribe => {
    let sent: Communication[]     = [];
    let received: Communication[] = [];
    const emit = () => callback([...sent, ...received]);

    const unsubSent = onSnapshot(
      query(collection(db, 'communications'), where('senderId', '==', uid), orderBy('createdAt', 'desc')),
      (snap) => { sent = snap.docs.map((d) => toComm(d.id, d.data())); emit(); }
    );
    const unsubReceived = onSnapshot(
      query(collection(db, 'communications'), where('recipientId', '==', uid), orderBy('createdAt', 'desc')),
      (snap) => { received = snap.docs.map((d) => toComm(d.id, d.data())); emit(); }
    );
    return () => { unsubSent(); unsubReceived(); };
  },

  subscribeToMessagesBetween: (
    uid1: string,
    uid2: string,
    callback: (messages: Communication[]) => void
  ): Unsubscribe => {
    let sentEncrypted: Communication[]     = [];
    let receivedEncrypted: Communication[] = [];
    const keyPromise = getOrCreateConversationKey(uid1, uid2);

    const emitDecrypted = () => {
      const all = [...sentEncrypted, ...receivedEncrypted];
      keyPromise.then(async (key) => {
        const decrypted = await Promise.all(all.map((m) => decryptComm(key, m)));
        callback(decrypted.sort((a, b) => a.createdAt - b.createdAt));
      });
    };

    const unsubSent = onSnapshot(
      query(collection(db, 'communications'), where('senderId', '==', uid1), where('recipientId', '==', uid2), orderBy('createdAt', 'asc')),
      (snap) => { sentEncrypted = snap.docs.map((d) => toComm(d.id, d.data())); emitDecrypted(); }
    );
    const unsubReceived = onSnapshot(
      query(collection(db, 'communications'), where('senderId', '==', uid2), where('recipientId', '==', uid1), orderBy('createdAt', 'asc')),
      (snap) => { receivedEncrypted = snap.docs.map((d) => toComm(d.id, d.data())); emitDecrypted(); }
    );

    return () => { unsubSent(); unsubReceived(); };
  },

  sendMessage: async (message: Omit<Communication, 'id' | 'createdAt' | 'read'>): Promise<void> => {
    const key           = await getOrCreateConversationKey(message.senderId, message.recipientId);
    const { iv, ciphertext } = await encryptMessage(key, message.messageBody);
    await retryWithBackoff(
      () => addDoc(collection(db, 'communications'), {
        ...message, messageBody: ciphertext, iv, read: false, createdAt: Date.now(),
        ephemeral: message.ephemeral ?? false,
      }),
      'sendMessage'
    );
  },

  markMessageRead: async (messageId: string): Promise<void> => {
    await updateDoc(doc(db, 'communications', messageId), { read: true });
  },

  // ── Notifications ──────────────────────────────────────────────────────────

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
      read:       false,
      createdAt:  Date.now(),
    });
  },

  subscribeToNotifications: (
    uid: string,
    callback: (notifications: AppNotification[]) => void
  ): Unsubscribe => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppNotification)));
    });
  },

  markNotificationRead: async (notificationId: string): Promise<void> => {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  },

  markAllNotificationsRead: async (uid: string): Promise<void> => {
    const q    = query(collection(db, 'notifications'), where('recipientId', '==', uid), where('read', '==', false));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })));
  },

  updateNotificationPrefs: async (uid: string, prefs: NotificationPrefs): Promise<void> => {
    await retryWithBackoff(
      () => updateDoc(doc(db, 'staff', uid), { notificationPrefs: prefs, updatedAt: Date.now() }),
      'updateNotificationPrefs'
    );
  },

  // ── Audit Log ──────────────────────────────────────────────────────────────

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
    const q    = query(collection(db, 'audit_log'), ...constraints);
    const snap = await getDocs(q);
    const entries = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
      timestamp: d.data()['timestamp']?.toMillis?.() ?? d.data()['timestamp'] ?? 0,
    } as AuditLogEntry));
    const cursor = snap.docs.length === pageSize ? snap.docs[snap.docs.length - 1] : null;
    return { entries, cursor };
  },

  // ── Analytics ──────────────────────────────────────────────────────────────

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
    for (const r of requests) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;

    const thirtyDaysAgo  = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentRequests = requests.filter((r) => r.createdAt >= thirtyDaysAgo);

    return { totalRequests: requests.length, byStatus, recentRequests, activeStaff: staffSnap.size };
  },

  // ── Login history (Block 5) ────────────────────────────────────────────────

  recordLogin: async (uid: string): Promise<void> => {
    try {
      await addDoc(collection(db, 'staff', uid, 'loginHistory'), {
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
      });
    } catch (err) {
      logger.warn('firebaseService', 'Failed to record login history', err);
    }
  },

  getLoginHistory: async (uid: string, count = 10): Promise<Array<{ id: string; timestamp: number; userAgent: string }>> => {
    const q = query(
      collection(db, 'staff', uid, 'loginHistory'),
      orderBy('timestamp', 'desc'),
      limit(count),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, timestamp: d.data().timestamp, userAgent: d.data().userAgent ?? '' }));
  },
};
