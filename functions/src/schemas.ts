/**
 * schemas.ts — Server-side Zod validation for Cloud Function triggers.
 *
 * These schemas validate Firestore documents when they are created or updated.
 * They are intentionally more permissive than client schemas (allowing optional
 * fields that the client always provides) because documents may be created by
 * admin SDK or seed scripts.
 */

import {z} from "zod";

// ─── Request Details (discriminated union by type) ───────────────────────────

const dmeDetailsSchema = z.object({
  type: z.literal("dme"),
  equipmentId: z.string().min(1),
  equipmentName: z.string().min(1),
  icd10Code: z.string().optional(),
  icd10Description: z.string().optional(),
  urgency: z.enum(["routine", "urgent", "emergent"]),
  justification: z.string().min(1),
});

const medicationDetailsSchema = z.object({
  type: z.literal("medication"),
  drugName: z.string().min(1),
  rxcui: z.string(),
  strength: z.string().optional(),
  doseForm: z.string().optional(),
  route: z.string().optional(),
  frequency: z.string().optional(),
  startDate: z.string().optional(),
  indication: z.object({
    code: z.string(),
    description: z.string(),
  }).optional(),
  quantity: z.number().int().min(1),
  refills: z.number().int().min(0),
  pharmacy: z.string().min(1),
  justification: z.string().optional(),
});

const multiMedicationDetailsSchema = z.object({
  type: z.literal("multi_medication"),
  startDate: z.string().optional(),
  indication: z.object({
    code: z.string(),
    description: z.string(),
  }).optional(),
  drugs: z.array(z.object({
    drugName: z.string().min(1),
    rxcui: z.string(),
    strength: z.string().optional(),
    doseForm: z.string().optional(),
    route: z.string().optional(),
    frequency: z.string().optional(),
    quantity: z.number().int().min(1),
    refills: z.number().int().min(0),
  })).min(1),
  pharmacy: z.string().min(1),
  justification: z.string().optional(),
});

const requestDetailsSchema = z.discriminatedUnion("type", [
  dmeDetailsSchema,
  medicationDetailsSchema,
  multiMedicationDetailsSchema,
]);

// ─── Full Request Document ───────────────────────────────────────────────────

export const requestCreateSchema = z.object({
  patientId: z.string().min(1),
  submittedBy: z.string().min(1),
  status: z.literal("pending"),
  details: requestDetailsSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
  history: z.array(z.object({
    action: z.string(),
    actorId: z.string(),
    actorName: z.string(),
    actorRole: z.string(),
    timestamp: z.number(),
    notes: z.string().optional(),
  })).optional(),
});

// ─── Status Update Validation ────────────────────────────────────────────────

export const requestStatusUpdateSchema = z.object({
  status: z.enum(["approved", "denied", "rmi", "filled"]),
  adminNotes: z.string().optional(),
  processedBy: z.string().min(1),
  processedAt: z.number(),
}).refine(
  (data) => {
    if (data.status === "denied" || data.status === "rmi") {
      return (data.adminNotes ?? "").trim().length > 0;
    }
    return true;
  },
  {message: "Admin notes are required for deny/rmi actions.", path: ["adminNotes"]}
);

// ─── Message Document ────────────────────────────────────────────────────────

export const messageCreateSchema = z.object({
  senderId: z.string().min(1),
  recipientId: z.string().min(1),
  messageBody: z.string().min(1),
  iv: z.string().optional(),
  read: z.literal(false),
  createdAt: z.number(),
  ephemeral: z.boolean().optional(),
});
