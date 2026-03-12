/**
 * test/helpers/factories.ts — Test data factories.
 *
 * Returns minimal valid objects that match the Firestore schema and TypeScript
 * types. Pass an override object to customise specific fields.
 *
 * These factories are the single source of truth for test data across all
 * test blocks (rules, schemas, components, e2e).
 */

import type {
  Staff,
  Patient,
  Request,
  Communication,
  UserInvitation,
  AuditLogEntry,
  AppNotification,
  DMERequestDetails,
  MedicationRequestDetails,
} from '../../types';

// ─── Timestamps ───────────────────────────────────────────────────────────────

const NOW = Date.now();

// ─── Staff ────────────────────────────────────────────────────────────────────

export function makeAdmin(overrides: Partial<Staff> = {}): Staff {
  return {
    uid: 'admin-uid-1',
    email: 'admin@parrish.health',
    displayName: 'Admin User',
    role: 'admin',
    createdAt: NOW,
    updatedAt: NOW,
    hasCompletedOnboarding: true,
    status: 'active',
    department: 'Administration',
    ...overrides,
  };
}

export function makeNurse(overrides: Partial<Staff> = {}): Staff {
  return {
    uid: 'nurse-uid-1',
    email: 'nurse@parrish.health',
    displayName: 'Nurse User',
    role: 'nurse',
    createdAt: NOW,
    updatedAt: NOW,
    hasCompletedOnboarding: true,
    status: 'active',
    department: 'Clinical',
    ...overrides,
  };
}

export function makeHomemaker(overrides: Partial<Staff> = {}): Staff {
  return {
    uid: 'homemaker-uid-1',
    email: 'homemaker@parrish.health',
    displayName: 'Homemaker User',
    role: 'homemaker',
    createdAt: NOW,
    updatedAt: NOW,
    hasCompletedOnboarding: true,
    status: 'active',
    ...overrides,
  };
}

export function makeOfficeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    uid: 'office-uid-1',
    email: 'office@parrish.health',
    displayName: 'Office Staff User',
    role: 'office_staff',
    createdAt: NOW,
    updatedAt: NOW,
    hasCompletedOnboarding: true,
    status: 'active',
    department: 'Office',
    ...overrides,
  };
}

// ─── Patient ──────────────────────────────────────────────────────────────────

export function makePatient(overrides: Partial<Patient> = {}): Patient {
  return {
    id: 'patient-1',
    mrn: 'MRN-001',
    name: 'Jane Doe',
    initials: 'JD',
    color: '#4F46E5',
    dob: '1960-05-15',
    age: 65,
    sex: 'Female',
    phone: '555-0100',
    insurance: 'Medicare Part B',
    insId: 'MCR-001',
    physician: 'Dr. Smith',
    address: '123 Main St, Springfield',
    allergies: 'NKDA',
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    ...overrides,
  };
}

// ─── Request details ──────────────────────────────────────────────────────────

export function makeDMEDetails(
  overrides: Partial<DMERequestDetails> = {}
): DMERequestDetails {
  return {
    kind: 'dme',
    equipment: {
      category: 'Mobility',
      item: 'Standard Wheelchair',
      reqType: 'New',
      delivery: 'Home Delivery',
      specialFeatures: '',
    },
    clinical: {
      icd10: 'M62.81',
      secondaryIcd10: '',
      justification: 'Patient requires mobility assistance following hip replacement surgery.',
      prescriptionDate: '2026-03-01',
      lengthOfNeed: '13+ months',
      priorAuth: '',
      urgency: 'Routine',
    },
    consents: [true, true, true],
    ...overrides,
  };
}

export function makeMedDetails(
  overrides: Partial<MedicationRequestDetails> = {}
): MedicationRequestDetails {
  return {
    kind: 'medication',
    medication: {
      name: 'Metformin',
      strength: '500mg',
      form: 'Tablet',
      rxcui: '860975',
      quantity: 60,
      refills: 3,
      sig: 'Take 1 tablet twice daily with meals',
    },
    clinical: {
      icd10: 'E11.9',
      diagnosis: 'Type 2 diabetes without complications',
    },
    ...overrides,
  };
}

// ─── Request ──────────────────────────────────────────────────────────────────

export function makeDMERequest(overrides: Partial<Request> = {}): Request {
  return {
    id: 'request-1',
    type: 'dme',
    submitterId: 'nurse-uid-1',
    submitterName: 'Nurse User',
    patientName: 'Jane Doe',
    patientId: 'patient-1',
    details: makeDMEDetails(),
    status: 'pending',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

export function makeApprovedRequest(overrides: Partial<Request> = {}): Request {
  return makeDMERequest({
    id: 'request-approved-1',
    status: 'approved',
    adminNotes: 'Approved — medical necessity confirmed.',
    processedBy: 'admin-uid-1',
    processedAt: NOW,
    ...overrides,
  });
}

// ─── Communication ────────────────────────────────────────────────────────────

export function makeMessage(overrides: Partial<Communication> = {}): Communication {
  return {
    id: 'msg-1',
    senderId: 'nurse-uid-1',
    senderName: 'Nurse User',
    recipientId: 'admin-uid-1',
    recipientName: 'Admin User',
    messageType: 'clinical',
    messageBody: 'U2FsdGVkX1+fakeciphertext==', // simulated ciphertext
    iv: 'aGVsbG8=',
    read: false,
    createdAt: NOW,
    ...overrides,
  };
}

// ─── Invitation ───────────────────────────────────────────────────────────────

export function makeInvitation(
  overrides: Partial<UserInvitation> = {}
): UserInvitation {
  return {
    id: 'invite-1',
    email: 'newstaff@parrish.health',
    role: 'nurse',
    invitedBy: 'admin-uid-1',
    invitedByName: 'Admin User',
    createdAt: NOW,
    status: 'pending',
    ...overrides,
  };
}

// ─── Audit log entry ──────────────────────────────────────────────────────────

export function makeAuditEntry(
  overrides: Partial<AuditLogEntry> = {}
): AuditLogEntry {
  return {
    id: 'audit-1',
    timestamp: NOW,
    actorId: 'admin-uid-1',
    actorRole: 'admin',
    action: 'request.approve',
    resourceType: 'request',
    resourceId: 'request-1',
    before: { status: 'pending' },
    after: { status: 'approved' },
    ...overrides,
  };
}

// ─── Notification ─────────────────────────────────────────────────────────────

export function makeNotification(
  overrides: Partial<AppNotification> = {}
): AppNotification {
  return {
    id: 'notif-1',
    recipientId: 'nurse-uid-1',
    type: 'request.status_change',
    title: 'Request Approved',
    body: 'Your DME request has been approved.',
    resourceId: 'request-1',
    read: false,
    createdAt: NOW,
    ...overrides,
  };
}
