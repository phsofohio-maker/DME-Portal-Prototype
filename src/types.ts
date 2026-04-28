// ─── Enums / Unions ──────────────────────────────────────────────────────────

export type UserRole = "admin" | "nurse" | "homemaker" | "office_staff";
export type RequestType = "dme" | "medication" | "multi_medication";
export type RequestStatus = "pending" | "approved" | "denied" | "rmi" | "filled";
export type ViewId =
  | "dashboard"
  | "patients"
  | "patient-detail"
  | "requests"
  | "request-detail"
  | "new-request"
  | "messages"
  | "team"
  | "audit"
  | "help"
  | "settings";

// ─── Entities ────────────────────────────────────────────────────────────────

export interface Staff {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive" | "suspended";
  hasCompletedOnboarding: boolean;
  notificationPrefs: {
    emailOnStatusChange: boolean;
    emailOnNewMessage: boolean;
    soundEnabled?: boolean;
  };
  department?: string;
  phoneNumber?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface Patient {
  id: string;
  name: string;
  dob: string;
  mrn: string;
  insurance: string;
  phone: string;
  address: string;
  primaryNurse: string; // staff id
  allergies: string[];
  conditions: string[];
  clinicalNotes: string;
  status: "active" | "inactive";
  admittedDate: string;
}

export interface DMEItem {
  id: string;
  name: string;
  sku: string;
  category: "Mobility" | "Beds & Mattresses" | "Respiratory" | "Bathroom Safety" | "Seating" | "Lifts & Transfers" | "Accessories";
}

export interface Drug {
  name: string;
  rxcui: string;
  strength?: string;
  doseForm?: string;
  route?: string;
}

export interface Indication {
  code: string;
  description: string;
}

// ─── Request detail shapes ────────────────────────────────────────────────────

export interface DMEDetails {
  type: "dme";
  equipmentId: string;
  equipmentName: string;
  icd10Code?: string;
  icd10Description?: string;
  urgency: "routine" | "urgent" | "emergent";
  justification: string;
}

export interface MedicationDetails {
  type: "medication";
  drugName: string;
  rxcui: string;
  strength?: string;
  doseForm?: string;
  route?: string;
  frequency?: string;
  startDate?: string;
  indication?: Indication;
  quantity: number;
  refills: number;
  pharmacy: string;
  justification?: string;
}

export interface MultiMedicationDetails {
  type: "multi_medication";
  startDate?: string;
  indication?: Indication;
  drugs: Array<{
    drugName: string;
    rxcui: string;
    strength?: string;
    doseForm?: string;
    route?: string;
    frequency?: string;
    quantity: number;
    refills: number;
  }>;
  pharmacy: string;
  justification?: string;
}

export type RequestDetails = DMEDetails | MedicationDetails | MultiMedicationDetails;

// ─── Document history ─────────────────────────────────────────────────────────

export type HistoryAction = "created" | "approved" | "denied" | "rmi" | "filled" | "updated";

export interface HistoryEntry {
  action: HistoryAction;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: number;
  notes?: string;
  previousStatus?: RequestStatus;
  newStatus?: RequestStatus;
}

// ─── Request ─────────────────────────────────────────────────────────────────

export interface Request {
  id: string;
  patientId: string;
  submittedBy: string; // staff uid
  createdAt: number;   // ms timestamp
  updatedAt: number;
  status: RequestStatus;
  details: RequestDetails;
  adminNotes?: string;
  processedAt?: number; // ms timestamp
  processedBy?: string; // staff uid
  history?: HistoryEntry[];
}

// ─── Communication / Messaging ────────────────────────────────────────────────

export interface Communication {
  id: string;
  senderId: string;
  recipientId: string;
  messageBody: string;
  iv?: string;          // present when message is AES-GCM encrypted
  read: boolean;
  createdAt: number;
  ephemeral?: boolean;  // if true, auto-deleted at end of day
}

// ─── Invitations ─────────────────────────────────────────────────────────────

export interface UserInvitation {
  id: string;
  email: string;
  role: UserRole;
  invitedBy: string;     // admin uid
  invitedByName: string;
  createdAt: number;
  status: "pending" | "accepted" | "expired";
}

// ─── Notification prefs ───────────────────────────────────────────────────────

export interface NotificationPrefs {
  emailOnStatusChange: boolean;
  emailOnNewMessage:   boolean;
  soundEnabled?:       boolean;
}

export type NotificationType = "new_request" | "new_message" | "status_change";

// ─── Audit log ────────────────────────────────────────────────────────────────

export type AuditAction =
  | "auth.login" | "auth.logout"
  | "request.created" | "request.updated"
  | "request.approved" | "request.denied" | "request.rmi" | "request.filled"
  | "staff.invited" | "staff.suspended";

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  actorId: string;
  actorEmail: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// ─── Message ─────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  body: string;
  sentAt: string;
  read: boolean;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface AppNotification {
  id: string;
  recipientId: string; // staff uid this belongs to
  title: string;
  body: string;
  createdAt: number;
  read: boolean;
  type: NotificationType;
  resourceId?: string | null;
}
