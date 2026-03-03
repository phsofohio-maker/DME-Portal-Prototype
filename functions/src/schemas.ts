/**
 * functions/src/schemas.ts — Server-side Zod schemas (Phase 2)
 *
 * Re-validates request payloads inside Cloud Functions before any Firestore
 * write, providing a second line of defence on top of Security Rules.
 *
 * Keep these in sync with the client schemas in lib/schemas.ts.
 */

import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);

export const requestStatusUpdateSchema = z.object({
  requestId: nonEmptyString,
  status: z.enum(['approved', 'denied', 'rmi']),
  adminNotes: z.string().trim().min(5),
  rmiNotes: z.string().trim().optional(),
  adminId: nonEmptyString,
});

export type RequestStatusUpdate = z.infer<typeof requestStatusUpdateSchema>;

export const newRequestSchema = z.object({
  type: z.enum(['dme', 'medication', 'clinical', 'communication']),
  submitterId: nonEmptyString,
  submitterName: nonEmptyString,
  patientName: nonEmptyString,
  patientId: nonEmptyString,
  details: z.record(z.string(), z.unknown()),
});

export type NewRequest = z.infer<typeof newRequestSchema>;
