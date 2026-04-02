/**
 * schemas.ts — Client-side Zod validation schemas.
 *
 * Every form in the app runs `safeParse` before submission.
 * Schemas mirror the TypeScript types in src/types.ts.
 */

import { z } from "zod";

// ─── DME Request ─────────────────────────────────────────────────────────────

export const dmeFormSchema = z.object({
  patientId:        z.string().min(1, "Patient is required."),
  equipmentId:      z.string().min(1, "Equipment is required."),
  icd10Code:        z.string().min(1, "ICD-10 code is required."),
  icd10Description: z.string(),
  urgency:          z.enum(["routine", "urgent", "emergent"], { message: "Urgency is required." }),
  justification:    z.string().min(10, "Clinical justification must be at least 10 characters."),
});

export type DmeFormData = z.infer<typeof dmeFormSchema>;

// ─── Single Medication Request ───────────────────────────────────────────────

export const medicationFormSchema = z.object({
  patientId:      z.string().min(1, "Patient is required."),
  drugName:       z.string().min(1, "Medication is required."),
  rxcui:          z.string(),
  strength:       z.string().optional(),
  doseForm:       z.string().optional(),
  route:          z.string().optional(),
  frequency:      z.string().min(1, "Frequency is required."),
  startDate:      z.string().min(1, "Start date is required."),
  indicationCode: z.string().optional(),
  indicationDesc: z.string().optional(),
  quantity:       z.coerce.number().int().min(1, "Quantity must be at least 1."),
  refills:        z.coerce.number().int().min(0).max(12),
  pharmacy:       z.string().min(1, "Pharmacy is required."),
  justification:  z.string().optional(),
});

export type MedicationFormData = z.infer<typeof medicationFormSchema>;

// ─── Multi-Medication Drug Row ───────────────────────────────────────────────

export const drugRowSchema = z.object({
  drugName:  z.string().min(1, "Medication is required."),
  rxcui:     z.string(),
  strength:  z.string().optional(),
  doseForm:  z.string().optional(),
  route:     z.string().optional(),
  frequency: z.string().min(1, "Frequency is required."),
  quantity:  z.coerce.number().int().min(1, "Quantity must be at least 1."),
  refills:   z.coerce.number().int().min(0).max(12),
});

export const multiMedicationFormSchema = z.object({
  patientId:      z.string().min(1, "Patient is required."),
  startDate:      z.string().min(1, "Start date is required."),
  indicationCode: z.string().optional(),
  indicationDesc: z.string().optional(),
  drugs:          z.array(drugRowSchema).min(1, "At least one medication is required."),
  pharmacy:       z.string().min(1, "Pharmacy is required."),
});

export type MultiMedicationFormData = z.infer<typeof multiMedicationFormSchema>;

// ─── Admin Action (approve / deny / rmi) ─────────────────────────────────────

export const adminActionSchema = z.object({
  action: z.enum(["approved", "denied", "rmi"]),
  notes:  z.string(),
}).refine(
  (data) => {
    if (data.action === "denied" || data.action === "rmi") {
      return data.notes.trim().length >= 5;
    }
    return true;
  },
  {
    message: "Please provide a reason (at least 5 characters).",
    path: ["notes"],
  }
);

export type AdminActionData = z.infer<typeof adminActionSchema>;

// ─── Message ─────────────────────────────────────────────────────────────────

export const messageSchema = z.object({
  recipientId: z.string().min(1, "Please select a recipient."),
  messageBody: z.string().min(1, "Message cannot be empty.").max(5000, "Message must be under 5,000 characters."),
});

export type MessageData = z.infer<typeof messageSchema>;

// ─── Staff Invitation ────────────────────────────────────────────────────────

export const staffInviteSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  role:  z.enum(["admin", "nurse", "homemaker", "office_staff"], { message: "Please select a role." }),
});

export type StaffInviteData = z.infer<typeof staffInviteSchema>;

// ─── Profile Update ──────────────────────────────────────────────────────────

export const profileUpdateSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters."),
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract per-field error messages from a Zod safeParse result. */
export function fieldErrors(result: { success: boolean; error?: z.ZodError }): Record<string, string> {
  if (result.success || !result.error) return {};
  const errs: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".");
    if (!errs[key]) errs[key] = issue.message;
  }
  return errs;
}
