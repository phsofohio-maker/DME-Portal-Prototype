import type { Request } from "../types";

// Mock request data — mirrors what scripts/seed.mjs writes to Firestore.
// Used as initial state in App.tsx until the Firestore subscription fires.

export const REQUESTS: Request[] = [
  {
    id: "r1", patientId: "p6", submittedBy: "s5",
    createdAt: Date.parse("2026-03-16T09:14:00Z"),
    updatedAt: Date.parse("2026-03-16T09:14:00Z"),
    status: "pending",
    details: {
      type: "dme", equipmentId: "d1", equipmentName: "Standard Wheelchair",
      icd10Code: "G35", icd10Description: "Multiple Sclerosis", urgency: "routine",
      justification: "Patient has progressive lower-extremity weakness secondary to MS. Currently unable to ambulate safely for distances >20 feet. Wheelchair required for community mobility and medical appointments.",
    },
  },
  {
    id: "r2", patientId: "p2", submittedBy: "s2",
    createdAt: Date.parse("2026-03-15T14:30:00Z"),
    updatedAt: Date.parse("2026-03-15T14:30:00Z"),
    status: "pending",
    details: {
      type: "dme", equipmentId: "d5", equipmentName: "CPAP Machine",
      icd10Code: "G47.33", icd10Description: "Obstructive Sleep Apnea (Adult)", urgency: "urgent",
      justification: "Patient diagnosed with moderate-to-severe OSA per sleep study (AHI 28). Cardiologist recommends CPAP initiation due to comorbid hypertension and COPD. Prior unit was lost in a recent move.",
    },
  },
  {
    id: "r3", patientId: "p3", submittedBy: "s5",
    createdAt: Date.parse("2026-03-14T11:00:00Z"),
    updatedAt: Date.parse("2026-03-14T16:45:00Z"),
    status: "rmi",
    details: {
      type: "multi_medication",
      drugs: [
        { drugName: "Warfarin 5mg",    rxcui: "855333", quantity: 30, refills: 3 },
        { drugName: "Metformin 500mg", rxcui: "861007", quantity: 60, refills: 2 },
        { drugName: "Sertraline 50mg", rxcui: "312940", quantity: 30, refills: 5 },
      ],
      pharmacy: "Kroger Pharmacy — Lancaster",
      justification: "Monthly refill for patient's established medication regimen. All medications are active on the current treatment plan.",
    },
    adminNotes: "Please confirm current INR reading before warfarin refill can be approved. Last documented INR was over 2 weeks ago.",
    processedAt: Date.parse("2026-03-14T16:45:00Z"), processedBy: "s1",
  },
  {
    id: "r4", patientId: "p1", submittedBy: "s2",
    createdAt: Date.parse("2026-03-13T10:20:00Z"),
    updatedAt: Date.parse("2026-03-13T15:10:00Z"),
    status: "approved",
    details: {
      type: "dme", equipmentId: "d3", equipmentName: "Hospital Bed (Semi-Electric)",
      icd10Code: "I50.9", icd10Description: "Heart failure, unspecified", urgency: "urgent",
      justification: "Patient's CHF requires head-of-bed elevation for respiratory comfort. Current home bed is non-adjustable. Semi-electric hospital bed will allow patient and caregiver to safely manage positioning.",
    },
    adminNotes: "Approved. Insurance pre-authorization confirmed. Delivery scheduled with supplier.",
    processedAt: Date.parse("2026-03-13T15:10:00Z"), processedBy: "s1",
  },
  {
    id: "r5", patientId: "p5", submittedBy: "s2",
    createdAt: Date.parse("2026-03-12T08:45:00Z"),
    updatedAt: Date.parse("2026-03-12T13:00:00Z"),
    status: "approved",
    details: {
      type: "medication", drugName: "Furosemide 40mg", rxcui: "310430",
      quantity: 30, refills: 2, pharmacy: "CVS Pharmacy — Gahanna",
      justification: "Patient showing signs of fluid retention — +4 lbs over 48 hours. Physician ordered dose increase from 20mg to 40mg. Refill authorization needed.",
    },
    adminNotes: "Approved. Physician order on file.",
    processedAt: Date.parse("2026-03-12T13:00:00Z"), processedBy: "s1",
  },
  {
    id: "r6", patientId: "p4", submittedBy: "s5",
    createdAt: Date.parse("2026-03-11T13:15:00Z"),
    updatedAt: Date.parse("2026-03-11T17:30:00Z"),
    status: "denied",
    details: {
      type: "dme", equipmentId: "d2", equipmentName: "Rollator Walker (4-Wheel)",
      icd10Code: "I69.351", icd10Description: "Hemiplegia and hemiparesis following cerebral infarction", urgency: "routine",
      justification: "Patient has right-sided hemiplegia and requires gait assistance for safe ambulation within the home.",
    },
    adminNotes: "Denied — patient currently has a standard walker on file from prior authorization (2025-09-04). OT assessment required before upgrade can be approved. Please resubmit with updated functional assessment.",
    processedAt: Date.parse("2026-03-11T17:30:00Z"), processedBy: "s1",
  },
  {
    id: "r7", patientId: "p1", submittedBy: "s2",
    createdAt: Date.parse("2026-03-10T09:00:00Z"),
    updatedAt: Date.parse("2026-03-10T14:20:00Z"),
    status: "approved",
    details: {
      type: "multi_medication",
      drugs: [
        { drugName: "Lisinopril 10mg",   rxcui: "314077", quantity: 30, refills: 3 },
        { drugName: "Atorvastatin 40mg", rxcui: "617312", quantity: 30, refills: 3 },
        { drugName: "Metformin 1000mg",  rxcui: "861008", quantity: 60, refills: 2 },
        { drugName: "Furosemide 20mg",   rxcui: "310429", quantity: 30, refills: 1 },
      ],
      pharmacy: "Walgreens — Broad St Columbus",
    },
    adminNotes: "Approved. All medications verified against current care plan.",
    processedAt: Date.parse("2026-03-10T14:20:00Z"), processedBy: "s1",
  },
  {
    id: "r8", patientId: "p6", submittedBy: "s4",
    createdAt: Date.parse("2026-03-09T15:50:00Z"),
    updatedAt: Date.parse("2026-03-09T15:50:00Z"),
    status: "pending",
    details: {
      type: "medication", drugName: "Gabapentin 300mg", rxcui: "310431",
      quantity: 90, refills: 1, pharmacy: "Rite Aid — Springfield",
      justification: "Gabapentin prescribed for neuropathic pain associated with MS. Patient reports significant pain interference with sleep and daily function.",
    },
  },
];
