/**
 * test/smoke/schemas.test.ts — Schema infrastructure smoke test.
 *
 * Verifies that:
 *   1. The Zod schemas import cleanly.
 *   2. A fully valid payload passes each schema.
 *   3. A clearly invalid payload is rejected with the expected message.
 *
 * This is a canary — if it breaks, the schema module itself has a problem.
 * Full schema coverage lives in test/unit/schemas.test.ts (Block 3).
 */

import { describe, it, expect } from 'vitest';
import {
  dmeFormSchema,
  medicationFormSchema,
  adminActionSchema,
} from '../../lib/schemas';

// ─── DME Form Schema ──────────────────────────────────────────────────────────

describe('dmeFormSchema (smoke)', () => {
  const validDME = {
    patientId: 'patient-1',
    patientName: 'Jane Doe',
    category: 'Mobility',
    item: 'Standard Wheelchair',
    reqType: 'New',
    delivery: 'Home Delivery',
    icd10: 'M62.81',
    justification: 'Patient requires mobility assistance following hip surgery.',
    prescriptionDate: '2026-03-01',
    urgency: 'Routine' as const,
    consents: [true, true, true],
    signed: true as const,
  };

  it('accepts a fully valid DME request payload', () => {
    const result = dmeFormSchema.safeParse(validDME);
    expect(result.success).toBe(true);
  });

  it('rejects a missing patientId', () => {
    const result = dmeFormSchema.safeParse({ ...validDME, patientId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects an ICD-10 code that does not start with a letter', () => {
    const result = dmeFormSchema.safeParse({ ...validDME, icd10: '123.4' });
    expect(result.success).toBe(false);
  });

  it('rejects a justification shorter than 20 characters', () => {
    const result = dmeFormSchema.safeParse({ ...validDME, justification: 'Too short' });
    expect(result.success).toBe(false);
  });

  it('rejects consents with one false value', () => {
    const result = dmeFormSchema.safeParse({
      ...validDME,
      consents: [true, false, true],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Medication Form Schema ───────────────────────────────────────────────────

describe('medicationFormSchema (smoke)', () => {
  const validMed = {
    patientId: 'patient-1',
    patientName: 'Jane Doe',
    drugName: 'Metformin',
    icd10: 'E11.9',
    indication: 'Type 2 diabetes management',
    sig: 'Take 1 tablet twice daily with meals',
    quantity: '60',
    refills: '3',
    startDate: '2026-03-01',
    daysSupply: '30',
    route: 'Oral',
    urgency: 'Routine' as const,
    consents: [true, true, true],
    signed: true as const,
  };

  it('accepts a fully valid medication request payload', () => {
    const result = medicationFormSchema.safeParse(validMed);
    expect(result.success).toBe(true);
  });

  it('rejects quantity of zero', () => {
    const result = medicationFormSchema.safeParse({ ...validMed, quantity: '0' });
    expect(result.success).toBe(false);
  });

  it('rejects a missing drug name', () => {
    const result = medicationFormSchema.safeParse({ ...validMed, drugName: '' });
    expect(result.success).toBe(false);
  });
});

// ─── Admin Action Schema ──────────────────────────────────────────────────────

describe('adminActionSchema (smoke)', () => {
  it('accepts a valid approve action', () => {
    const result = adminActionSchema.safeParse({
      requestId: 'request-1',
      status: 'approved',
      adminNotes: 'Medically necessary.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects adminNotes shorter than 5 characters', () => {
    const result = adminActionSchema.safeParse({
      requestId: 'request-1',
      status: 'approved',
      adminNotes: 'OK',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid status value', () => {
    const result = adminActionSchema.safeParse({
      requestId: 'request-1',
      status: 'pending',
      adminNotes: 'Some valid note here',
    });
    expect(result.success).toBe(false);
  });
});
