
export type UserRole = 'admin' | 'nurse' | 'homemaker' | 'office_staff';
export type RequestType = 'dme' | 'medication' | 'clinical' | 'communication';
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'rmi';

export interface NotificationPrefs {
  emailOnStatusChange: boolean;
  emailOnNewMessage: boolean;
}

export interface Staff {
  uid: string;
  email: string;
  pin?: string; // Legacy field — superseded by Firebase Auth in Phase 1
  displayName: string;
  role: UserRole;
  createdAt: number;
  updatedAt: number;
  hasCompletedOnboarding: boolean;
  status: 'active' | 'suspended';
  phoneNumber?: string;
  department?: string;
  notificationPrefs?: NotificationPrefs;
  fcmToken?: string; // Firebase Cloud Messaging device token (Phase 3.3 push)
}

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  initials: string;
  color: string;
  dob: string;
  age: number;
  sex: string;
  phone: string;
  insurance: string;
  insId: string;
  physician: string;
  address: string;
  allergies: string;
  conditions: string[];
}

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  invitedByName: string;
  createdAt: number;
  status: 'pending' | 'accepted' | 'expired';
}

export interface DMEEquipment {
  id: string;
  itemName: string;
  sku: string;
  category: string;
  currentStock?: number;
}

// ─── Request Details — Discriminated Union ────────────────────────────────────

export interface DMERequestDetails {
  kind: 'dme';
  equipment: {
    category: string;
    item: string;
    reqType: string;
    delivery: string;
    specialFeatures: string;
  };
  clinical: {
    icd10: string;
    secondaryIcd10: string;
    justification: string;
    prescriptionDate: string;
    lengthOfNeed: string;
    priorAuth: string;
    urgency: string;
  };
  consents: unknown;
}

export interface MedicationRequestDetails {
  kind: 'medication';
  medication: {
    name: string;
    strength: string;
    form?: string;
    rxcui?: string;
    quantity?: number;
    refills?: number;
    sig?: string;
    [key: string]: unknown;
  };
  clinical: {
    icd10?: string;
    diagnosis?: string;
    allergies?: string;
    pharmacyNotes?: string;
    [key: string]: unknown;
  };
}

export interface MultiMedicationRequestDetails {
  kind: 'multi_medication';
  batchType: 'multi-medication';
  medications: Array<{
    name: string;
    strength?: string;
    form?: string;
    rxcui?: string;
    quantity?: number;
    refills?: number;
    sig?: string;
    [key: string]: unknown;
  }>;
  clinical?: {
    icd10?: string;
    notes?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type RequestDetails =
  | DMERequestDetails
  | MedicationRequestDetails
  | MultiMedicationRequestDetails;

// ─── Request ──────────────────────────────────────────────────────────────────

export interface Request {
  id: string;
  type: RequestType;
  submitterId: string;
  submitterName: string;
  patientName: string;
  patientId: string;
  details: RequestDetails;
  status: RequestStatus;
  adminNotes?: string;
  rmiNotes?: string;
  createdAt: number;
  updatedAt: number;
  processedBy?: string;
  processedAt?: number;
  // Escalation fields (Phase 2 §5.3)
  escalatedTo?: string;
  escalatedToName?: string;
  escalatedAt?: number;
  flaggedForSupervisor?: boolean;
  escalationNote?: string;
}

export interface Communication {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  messageType: 'clinical' | 'general';
  messageBody: string; // plaintext after decryption; ciphertext on the wire
  iv?: string;         // AES-GCM IV (base64); present on encrypted messages only
  read: boolean;
  createdAt: number;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'request.create'
  | 'request.approve'
  | 'request.deny'
  | 'request.rmi'
  | 'request.update'
  | 'request.escalate'
  | 'request.bulk_approve'
  | 'request.bulk_deny'
  | 'staff.create'
  | 'staff.update'
  | 'staff.suspend'
  | 'communication.create'
  | 'invitation.create'
  | 'invitation.revoke'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.timeout'
  | 'auth.mfa_enrollment'
  | 'auth.mfa_challenge';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  actorId: string;
  actorRole: UserRole;
  action: AuditAction;
  resourceType: 'request' | 'staff' | 'communication' | 'invitation' | 'dme_catalog' | 'auth';
  resourceId: string;
  before?: unknown;
  after?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

// ─── In-App Notifications ─────────────────────────────────────────────────────

export type NotificationType =
  | 'request.status_change'
  | 'message.received'
  | 'invitation.accepted'
  | 'admin.action_required';

export interface AppNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceId?: string;
  read: boolean;
  createdAt: number;
}
