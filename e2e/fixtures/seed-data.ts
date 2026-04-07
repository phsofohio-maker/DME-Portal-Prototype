/**
 * Seed data for E2E tests — patients, requests, and messages.
 * Kept minimal: just enough to exercise the core flows.
 */

export const PATIENTS = [
  {
    id: 'p1',
    name: 'Eleanor Voss',
    dob: '1942-03-14',
    mrn: 'MRN-00412',
    insurance: 'Medicare Part A & B',
    phone: '(614) 555-0182',
    address: '2847 Maple Ridge Dr, Columbus, OH 43215',
    primaryNurse: 'test-nurse-uid',
    allergies: ['Penicillin', 'Sulfa drugs'],
    conditions: [
      'Type 2 Diabetes Mellitus (E11.9)',
      'Hypertension (I10)',
      'Chronic Heart Failure (I50.9)',
    ],
    clinicalNotes: 'Patient is an 83-year-old female with multiple comorbidities.',
    status: 'active',
    admittedDate: '2026-01-08',
  },
  {
    id: 'p2',
    name: 'Bernard Okafor',
    dob: '1958-07-22',
    mrn: 'MRN-00551',
    insurance: 'Medicaid MCO',
    phone: '(614) 555-0344',
    address: '119 Sycamore Lane, Westerville, OH 43082',
    primaryNurse: 'test-nurse-uid',
    allergies: ['Codeine'],
    conditions: ['COPD (J44.1)', 'Obstructive Sleep Apnea (G47.33)'],
    clinicalNotes: '67-year-old male with moderate COPD.',
    status: 'active',
    admittedDate: '2026-01-22',
  },
];

export const REQUESTS = [
  {
    id: 'r1',
    patientId: 'p1',
    submittedBy: 'test-nurse-uid',
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
    status: 'pending',
    details: {
      type: 'dme',
      equipmentId: 'mob-001',
      equipmentName: '4 Wheeled Walker',
      icd10Code: 'I50.9',
      icd10Description: 'Heart failure, unspecified',
      urgency: 'routine',
      justification: 'Patient requires mobility assistance.',
    },
  },
  {
    id: 'r2',
    patientId: 'p2',
    submittedBy: 'test-nurse-uid',
    createdAt: Date.now() - 172800000,
    updatedAt: Date.now() - 86400000,
    status: 'approved',
    details: {
      type: 'dme',
      equipmentId: 'res-001',
      equipmentName: 'CPAP',
      icd10Code: 'G47.33',
      icd10Description: 'Obstructive Sleep Apnea (Adult)',
      urgency: 'urgent',
      justification: 'CPAP needed for diagnosed OSA.',
    },
    adminNotes: 'Approved. Insurance confirmed.',
    processedAt: Date.now() - 86400000,
    processedBy: 'test-admin-uid',
    history: [
      {
        action: 'created',
        actorId: 'test-nurse-uid',
        actorName: 'Maria Santos',
        actorRole: 'nurse',
        timestamp: Date.now() - 172800000,
      },
      {
        action: 'approved',
        actorId: 'test-admin-uid',
        actorName: 'Kobe Reynolds',
        actorRole: 'admin',
        timestamp: Date.now() - 86400000,
        previousStatus: 'pending',
        newStatus: 'approved',
      },
    ],
  },
];

export const COMMUNICATIONS = [
  {
    id: 'msg-1',
    senderId: 'test-nurse-uid',
    recipientId: 'test-admin-uid',
    messageBody: 'Test message from nurse to admin',
    read: false,
    createdAt: Date.now() - 3600000,
  },
];
