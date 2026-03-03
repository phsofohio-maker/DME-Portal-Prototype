/**
 * lib/schemas.ts — Zod validation schemas (Phase 2)
 *
 * Shared between the client (form validation) and Cloud Functions
 * (server-side re-validation before Firestore writes).
 *
 * All schemas use .trim() on string inputs and reject empty strings
 * where a value is required, so that HTML `required` attributes alone
 * are not the only line of defence.
 */

import { z } from 'zod';

// ─── Shared primitives ────────────────────────────────────────────────────────

const nonEmptyString = z.string().trim().min(1, { message: 'This field is required.' });

const icd10Code = z
  .string()
  .trim()
  .min(3, { message: 'Enter a valid ICD-10 code (e.g. M17.11).' })
  .regex(/^[A-Z][0-9]{2}/, { message: 'ICD-10 codes start with a letter followed by two digits.' });

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Enter a valid date (YYYY-MM-DD).' });

// ─── DME Request Schema ───────────────────────────────────────────────────────

export const dmeFormSchema = z.object({
  patientId: nonEmptyString.describe('Patient must be selected.'),
  patientName: nonEmptyString,

  // Equipment & delivery
  category: nonEmptyString.describe('Select an equipment category.'),
  item: nonEmptyString.describe('Select a specific equipment item.'),
  reqType: nonEmptyString,
  delivery: nonEmptyString,
  specialFeatures: z.string().trim().optional(),

  // Clinical
  icd10: icd10Code,
  secondaryIcd10: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[A-Z][0-9]{2}/.test(val),
      { message: 'ICD-10 codes start with a letter followed by two digits.' }
    ),
  justification: z
    .string()
    .trim()
    .min(20, { message: 'Please provide a clinical justification (at least 20 characters).' }),
  prescriptionDate: dateString,
  lengthOfNeed: z.string().trim().optional(),
  priorAuth: z.string().trim().optional(),
  urgency: z.enum(['Routine', 'Urgent', 'Critical'], {
    errorMap: () => ({ message: 'Select an urgency level.' }),
  }),

  // Authorization
  consents: z
    .array(z.boolean())
    .length(3)
    .refine((c) => c.every(Boolean), {
      message: 'All three authorization statements must be acknowledged.',
    }),
  signed: z.literal(true, { errorMap: () => ({ message: 'Electronic signature is required.' }) }),
});

export type DmeFormValues = z.infer<typeof dmeFormSchema>;

// ─── Medication Request Schema ────────────────────────────────────────────────

export const medicationFormSchema = z.object({
  patientId: nonEmptyString.describe('Patient must be selected.'),
  patientName: nonEmptyString,

  // Medication (from RxNorm)
  drugName: nonEmptyString.describe('Select a medication from the search results.'),
  drugRxcui: z.string().trim().optional(),
  selectedStrength: z.string().trim().optional(),

  // Clinical
  icd10: icd10Code,
  indication: nonEmptyString.describe('Provide the indication for this medication.'),
  sig: nonEmptyString.describe('Provide dosage instructions (Sig).'),
  quantity: z
    .string()
    .trim()
    .min(1, { message: 'Quantity is required.' })
    .refine((v) => Number(v) > 0, { message: 'Quantity must be a positive number.' }),
  refills: z.string().trim(),
  startDate: dateString,
  daysSupply: z.string().trim(),
  route: nonEmptyString,
  urgency: z.enum(['Routine', 'Urgent', 'STAT'], {
    errorMap: () => ({ message: 'Select an urgency level.' }),
  }),

  // Authorization
  consents: z
    .array(z.boolean())
    .length(3)
    .refine((c) => c.every(Boolean), {
      message: 'All three authorization statements must be acknowledged.',
    }),
  signed: z.literal(true, { errorMap: () => ({ message: 'Electronic signature is required.' }) }),
});

export type MedicationFormValues = z.infer<typeof medicationFormSchema>;

// ─── Multi-Medication Request Schema ─────────────────────────────────────────

const medicationRowSchema = z.object({
  drugName: nonEmptyString.describe('Select a drug for this row.'),
  drugRxcui: z.string().trim().optional(),
  strength: z.string().trim().optional(),
  sig: nonEmptyString.describe('Provide dosage instructions (Sig).'),
  quantity: z
    .string()
    .trim()
    .min(1, { message: 'Quantity is required.' })
    .refine((v) => Number(v) > 0, { message: 'Quantity must be a positive number.' }),
  refills: z.string().trim(),
  route: nonEmptyString,
  daysSupply: z.string().trim(),
  indication: z.string().trim().optional(),
});

export const multiMedicationFormSchema = z.object({
  patientId: nonEmptyString.describe('Patient must be selected.'),
  patientName: nonEmptyString,

  medications: z
    .array(medicationRowSchema)
    .min(1, { message: 'Add at least one medication.' })
    .max(10, { message: 'Maximum 10 medications per batch.' }),

  // Shared clinical
  primaryIcd10: icd10Code,
  secondaryIcd10: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[A-Z][0-9]{2}/.test(val),
      { message: 'ICD-10 codes start with a letter followed by two digits.' }
    ),
  rxDate: dateString,
  startDate: z.string().trim().optional(),
  generalNotes: z.string().trim().optional(),
  urgency: z.enum(['Routine', 'Urgent', 'STAT'], {
    errorMap: () => ({ message: 'Select an urgency level.' }),
  }),

  // Authorization
  consents: z
    .array(z.boolean())
    .length(3)
    .refine((c) => c.every(Boolean), {
      message: 'All three authorization statements must be acknowledged.',
    }),
  signed: z.literal(true, { errorMap: () => ({ message: 'Electronic signature is required.' }) }),
});

export type MultiMedicationFormValues = z.infer<typeof multiMedicationFormSchema>;

// ─── Admin action schema (shared with Cloud Functions) ───────────────────────

export const adminActionSchema = z.object({
  requestId: nonEmptyString,
  status: z.enum(['approved', 'denied', 'rmi']),
  adminNotes: z
    .string()
    .trim()
    .min(5, { message: 'Please provide a reason (at least 5 characters).' }),
  rmiNotes: z.string().trim().optional(),
});

export type AdminActionValues = z.infer<typeof adminActionSchema>;
