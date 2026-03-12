/**
 * test/unit/schemas.test.ts — Full Zod schema test suite (Block 3).
 *
 * Covers all 5 schemas in lib/schemas.ts:
 *   1. dmeFormSchema
 *   2. medicationFormSchema
 *   3. multiMedicationFormSchema
 *   4. adminActionSchema
 *   5. bulkAdminActionSchema
 *
 * Testing strategy:
 *   - One fully valid baseline per schema, confirmed to pass.
 *   - Each required field is tested individually for rejection on
 *     empty string, missing, and/or wrong type.
 *   - Every regex / refine / enum / literal rule is exercised with
 *     at least one passing and one failing value.
 *   - Boundary values (min lengths, array sizes) tested at ±1.
 *   - Whitespace trimming verified: a value of only spaces should
 *     behave the same as an empty string for nonEmpty fields.
 *
 * No Firebase dependencies — pure Zod, runs without an emulator.
 */

import { describe, it, expect } from 'vitest';
import {
  dmeFormSchema,
  medicationFormSchema,
  multiMedicationFormSchema,
  adminActionSchema,
  bulkAdminActionSchema,
} from '../../lib/schemas';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Assert that safeParse succeeds and return the parsed data. */
function pass<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } }, value: unknown): T {
  const result = schema.safeParse(value);
  expect(result.success, `Expected parse to succeed but got: ${JSON.stringify((result as { error?: unknown }).error)}`).toBe(true);
  return (result as { data: T }).data;
}

/** Assert that safeParse fails. */
function fail(schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown): void {
  const result = schema.safeParse(value);
  expect(result.success, 'Expected parse to fail but it succeeded').toBe(false);
}

// ─── Shared valid payloads ────────────────────────────────────────────────────

const VALID_DME = {
  patientId: 'patient-1',
  patientName: 'Jane Doe',
  category: 'Mobility',
  item: 'Standard Wheelchair',
  reqType: 'New',
  delivery: 'Home Delivery',
  icd10: 'M62.81',
  justification: 'Patient requires mobility assistance following hip replacement surgery.',
  prescriptionDate: '2026-03-01',
  urgency: 'Routine' as const,
  consents: [true, true, true],
  signed: true as const,
};

const VALID_MED = {
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

const VALID_MED_ROW = {
  drugName: 'Lisinopril',
  sig: 'Take 1 tablet once daily',
  quantity: '30',
  refills: '0',
  route: 'Oral',
  daysSupply: '30',
};

const VALID_MULTI = {
  patientId: 'patient-1',
  patientName: 'Jane Doe',
  medications: [VALID_MED_ROW],
  primaryIcd10: 'I10',
  rxDate: '2026-03-01',
  urgency: 'Routine' as const,
  consents: [true, true, true],
  signed: true as const,
};

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SHARED PRIMITIVES
//    icd10Code and dateString are reused across multiple schemas;
//    test them thoroughly once here via dmeFormSchema.
// ═══════════════════════════════════════════════════════════════════════════════

describe('icd10Code primitive', () => {
  it('accepts a 3-character code (minimum valid)', () => {
    pass(dmeFormSchema, { ...VALID_DME, icd10: 'A00' });
  });

  it('accepts a standard code with decimal (e.g. M54.5)', () => {
    pass(dmeFormSchema, { ...VALID_DME, icd10: 'M54.5' });
  });

  it('accepts a code with subcategory (e.g. E11.65)', () => {
    pass(dmeFormSchema, { ...VALID_DME, icd10: 'E11.65' });
  });

  it('accepts a longer alphanumeric code (e.g. F31.81)', () => {
    pass(dmeFormSchema, { ...VALID_DME, icd10: 'F31.81' });
  });

  it('rejects a code shorter than 3 characters', () => {
    fail(dmeFormSchema, { ...VALID_DME, icd10: 'A0' });
  });

  it('rejects a code that starts with a digit', () => {
    fail(dmeFormSchema, { ...VALID_DME, icd10: '123.4' });
  });

  it('rejects a code that starts with a lowercase letter', () => {
    fail(dmeFormSchema, { ...VALID_DME, icd10: 'm54.5' });
  });

  it('rejects a code where second character is not a digit', () => {
    fail(dmeFormSchema, { ...VALID_DME, icd10: 'MAB.5' });
  });

  it('rejects an empty icd10 value', () => {
    fail(dmeFormSchema, { ...VALID_DME, icd10: '' });
  });
});

describe('dateString primitive', () => {
  it('accepts ISO format YYYY-MM-DD', () => {
    pass(dmeFormSchema, { ...VALID_DME, prescriptionDate: '2026-01-01' });
  });

  it('rejects MM/DD/YYYY format', () => {
    fail(dmeFormSchema, { ...VALID_DME, prescriptionDate: '03/01/2026' });
  });

  it('rejects YYYY/MM/DD with slashes', () => {
    fail(dmeFormSchema, { ...VALID_DME, prescriptionDate: '2026/03/01' });
  });

  it('rejects a date missing leading zeros (YYYY-M-D)', () => {
    fail(dmeFormSchema, { ...VALID_DME, prescriptionDate: '2026-3-1' });
  });

  it('rejects a plain text string', () => {
    fail(dmeFormSchema, { ...VALID_DME, prescriptionDate: 'not-a-date' });
  });

  it('rejects empty string', () => {
    fail(dmeFormSchema, { ...VALID_DME, prescriptionDate: '' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DME FORM SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('dmeFormSchema', () => {
  it('passes a fully valid payload', () => {
    pass(dmeFormSchema, VALID_DME);
  });

  it('passes with optional fields included', () => {
    pass(dmeFormSchema, {
      ...VALID_DME,
      specialFeatures: 'Reclining back',
      secondaryIcd10: 'Z87.39',
      lengthOfNeed: '13+ months',
      priorAuth: 'PA-12345',
    });
  });

  // ── Required string fields ────────────────────────────────────────────────

  it.each(['patientId', 'patientName', 'category', 'item', 'reqType', 'delivery'])(
    'rejects empty %s',
    (field) => {
      fail(dmeFormSchema, { ...VALID_DME, [field]: '' });
    }
  );

  it.each(['patientId', 'patientName', 'category', 'item', 'reqType', 'delivery'])(
    'rejects whitespace-only %s (trim → empty)',
    (field) => {
      fail(dmeFormSchema, { ...VALID_DME, [field]: '   ' });
    }
  );

  it.each(['patientId', 'patientName', 'category', 'item', 'reqType', 'delivery'])(
    'trims leading/trailing whitespace and accepts %s',
    (field) => {
      pass(dmeFormSchema, { ...VALID_DME, [field]: '  valid value  ' });
    }
  );

  // ── Optional fields ───────────────────────────────────────────────────────

  it('accepts missing specialFeatures (optional)', () => {
    const { specialFeatures: _removed, ...noOptional } = { ...VALID_DME, specialFeatures: undefined };
    pass(dmeFormSchema, noOptional);
  });

  it('accepts empty string for specialFeatures (optional, no min)', () => {
    pass(dmeFormSchema, { ...VALID_DME, specialFeatures: '' });
  });

  // ── secondaryIcd10 ────────────────────────────────────────────────────────

  it('accepts absent secondaryIcd10', () => {
    pass(dmeFormSchema, { ...VALID_DME, secondaryIcd10: undefined });
  });

  it('accepts empty string secondaryIcd10 (treated as absent)', () => {
    pass(dmeFormSchema, { ...VALID_DME, secondaryIcd10: '' });
  });

  it('accepts a valid secondaryIcd10', () => {
    pass(dmeFormSchema, { ...VALID_DME, secondaryIcd10: 'E11.9' });
  });

  it('rejects a secondaryIcd10 that starts with a digit', () => {
    fail(dmeFormSchema, { ...VALID_DME, secondaryIcd10: '123.4' });
  });

  it('rejects a secondaryIcd10 that starts with lowercase', () => {
    fail(dmeFormSchema, { ...VALID_DME, secondaryIcd10: 'm54.5' });
  });

  // ── Justification ─────────────────────────────────────────────────────────

  it('accepts a justification of exactly 20 characters', () => {
    pass(dmeFormSchema, { ...VALID_DME, justification: '12345678901234567890' });
  });

  it('rejects a justification of 19 characters', () => {
    fail(dmeFormSchema, { ...VALID_DME, justification: '1234567890123456789' });
  });

  it('rejects an empty justification', () => {
    fail(dmeFormSchema, { ...VALID_DME, justification: '' });
  });

  it('trims whitespace before checking justification length', () => {
    // 20 chars surrounded by spaces — after trim still 20, should pass
    pass(dmeFormSchema, { ...VALID_DME, justification: '  12345678901234567890  ' });
    // 19 meaningful chars with surrounding spaces — after trim only 19, fails
    fail(dmeFormSchema, { ...VALID_DME, justification: '  1234567890123456789  ' });
  });

  // ── Urgency ───────────────────────────────────────────────────────────────

  it('accepts all valid urgency values', () => {
    pass(dmeFormSchema, { ...VALID_DME, urgency: 'Routine' });
    pass(dmeFormSchema, { ...VALID_DME, urgency: 'Urgent' });
    pass(dmeFormSchema, { ...VALID_DME, urgency: 'Critical' });
  });

  it('rejects an invalid urgency value', () => {
    fail(dmeFormSchema, { ...VALID_DME, urgency: 'STAT' });
    fail(dmeFormSchema, { ...VALID_DME, urgency: 'routine' });
    fail(dmeFormSchema, { ...VALID_DME, urgency: '' });
  });

  // ── Consents ──────────────────────────────────────────────────────────────

  it('rejects consents with exactly one false value', () => {
    fail(dmeFormSchema, { ...VALID_DME, consents: [false, true, true] });
    fail(dmeFormSchema, { ...VALID_DME, consents: [true, false, true] });
    fail(dmeFormSchema, { ...VALID_DME, consents: [true, true, false] });
  });

  it('rejects consents with fewer than 3 elements', () => {
    fail(dmeFormSchema, { ...VALID_DME, consents: [true, true] });
  });

  it('rejects consents with more than 3 elements', () => {
    fail(dmeFormSchema, { ...VALID_DME, consents: [true, true, true, true] });
  });

  it('rejects all-false consents', () => {
    fail(dmeFormSchema, { ...VALID_DME, consents: [false, false, false] });
  });

  // ── Signed ────────────────────────────────────────────────────────────────

  it('rejects signed: false', () => {
    fail(dmeFormSchema, { ...VALID_DME, signed: false });
  });

  it('rejects missing signed', () => {
    const { signed: _removed, ...noSigned } = VALID_DME;
    fail(dmeFormSchema, noSigned);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. MEDICATION FORM SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('medicationFormSchema', () => {
  it('passes a fully valid payload', () => {
    pass(medicationFormSchema, VALID_MED);
  });

  it('passes with optional fields included', () => {
    pass(medicationFormSchema, {
      ...VALID_MED,
      drugRxcui: '860975',
      selectedStrength: '500mg',
    });
  });

  // ── Required string fields ────────────────────────────────────────────────

  it.each(['patientId', 'patientName', 'drugName', 'indication', 'sig', 'route'])(
    'rejects empty %s',
    (field) => {
      fail(medicationFormSchema, { ...VALID_MED, [field]: '' });
    }
  );

  it.each(['patientId', 'patientName', 'drugName', 'indication', 'sig', 'route'])(
    'rejects whitespace-only %s',
    (field) => {
      fail(medicationFormSchema, { ...VALID_MED, [field]: '   ' });
    }
  );

  // ── Quantity ──────────────────────────────────────────────────────────────

  it('accepts quantity of "1" (minimum positive)', () => {
    pass(medicationFormSchema, { ...VALID_MED, quantity: '1' });
  });

  it('accepts fractional quantities like "0.5"', () => {
    pass(medicationFormSchema, { ...VALID_MED, quantity: '0.5' });
  });

  it('rejects quantity of "0"', () => {
    fail(medicationFormSchema, { ...VALID_MED, quantity: '0' });
  });

  it('rejects negative quantity', () => {
    fail(medicationFormSchema, { ...VALID_MED, quantity: '-1' });
  });

  it('rejects non-numeric quantity', () => {
    fail(medicationFormSchema, { ...VALID_MED, quantity: 'abc' });
  });

  it('rejects empty quantity string', () => {
    fail(medicationFormSchema, { ...VALID_MED, quantity: '' });
  });

  // ── Urgency ───────────────────────────────────────────────────────────────

  it('accepts all valid urgency values (Routine, Urgent, STAT)', () => {
    pass(medicationFormSchema, { ...VALID_MED, urgency: 'Routine' });
    pass(medicationFormSchema, { ...VALID_MED, urgency: 'Urgent' });
    pass(medicationFormSchema, { ...VALID_MED, urgency: 'STAT' });
  });

  it('rejects "Critical" (not valid for medication)', () => {
    fail(medicationFormSchema, { ...VALID_MED, urgency: 'Critical' });
  });

  // ── Optional fields ───────────────────────────────────────────────────────

  it('accepts absent drugRxcui and selectedStrength', () => {
    const { drugRxcui: _a, selectedStrength: _b, ...minimal } = {
      ...VALID_MED,
      drugRxcui: undefined,
      selectedStrength: undefined,
    };
    pass(medicationFormSchema, VALID_MED);
  });

  // ── Date fields ───────────────────────────────────────────────────────────

  it('rejects an invalid startDate format', () => {
    fail(medicationFormSchema, { ...VALID_MED, startDate: '01-03-2026' });
  });

  // ── Consents and signed ───────────────────────────────────────────────────

  it('rejects unsigned (signed: false)', () => {
    fail(medicationFormSchema, { ...VALID_MED, signed: false });
  });

  it('rejects partial consents', () => {
    fail(medicationFormSchema, { ...VALID_MED, consents: [true, false, true] });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. MULTI-MEDICATION FORM SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('multiMedicationFormSchema', () => {
  it('passes with a single medication row', () => {
    pass(multiMedicationFormSchema, VALID_MULTI);
  });

  it('passes with 10 medication rows (maximum)', () => {
    const tenRows = Array.from({ length: 10 }, (_, i) => ({
      ...VALID_MED_ROW,
      drugName: `Drug ${i + 1}`,
    }));
    pass(multiMedicationFormSchema, { ...VALID_MULTI, medications: tenRows });
  });

  it('passes with optional fields filled', () => {
    pass(multiMedicationFormSchema, {
      ...VALID_MULTI,
      secondaryIcd10: 'E11.9',
      startDate: '2026-03-15',
      generalNotes: 'See chart for additional context.',
      medications: [{ ...VALID_MED_ROW, drugRxcui: '123', strength: '10mg', indication: 'HTN' }],
    });
  });

  // ── Patient fields ────────────────────────────────────────────────────────

  it('rejects empty patientId', () => {
    fail(multiMedicationFormSchema, { ...VALID_MULTI, patientId: '' });
  });

  // ── Medications array ─────────────────────────────────────────────────────

  it('rejects an empty medications array', () => {
    fail(multiMedicationFormSchema, { ...VALID_MULTI, medications: [] });
  });

  it('rejects 11 medication rows (exceeds max)', () => {
    const elevenRows = Array.from({ length: 11 }, (_, i) => ({
      ...VALID_MED_ROW,
      drugName: `Drug ${i + 1}`,
    }));
    fail(multiMedicationFormSchema, { ...VALID_MULTI, medications: elevenRows });
  });

  // ── Medication row fields ─────────────────────────────────────────────────

  it('rejects a row with empty drugName', () => {
    fail(multiMedicationFormSchema, {
      ...VALID_MULTI,
      medications: [{ ...VALID_MED_ROW, drugName: '' }],
    });
  });

  it('rejects a row with empty sig', () => {
    fail(multiMedicationFormSchema, {
      ...VALID_MULTI,
      medications: [{ ...VALID_MED_ROW, sig: '' }],
    });
  });

  it('rejects a row with zero quantity', () => {
    fail(multiMedicationFormSchema, {
      ...VALID_MULTI,
      medications: [{ ...VALID_MED_ROW, quantity: '0' }],
    });
  });

  it('rejects a row with non-numeric quantity', () => {
    fail(multiMedicationFormSchema, {
      ...VALID_MULTI,
      medications: [{ ...VALID_MED_ROW, quantity: 'ten' }],
    });
  });

  it('accepts optional row fields (drugRxcui, strength, indication) as absent', () => {
    const minimalRow = {
      drugName: 'Aspirin',
      sig: 'Take 1 daily',
      quantity: '30',
      refills: '0',
      route: 'Oral',
      daysSupply: '30',
    };
    pass(multiMedicationFormSchema, { ...VALID_MULTI, medications: [minimalRow] });
  });

  // ── ICD-10 fields ─────────────────────────────────────────────────────────

  it('rejects invalid primaryIcd10', () => {
    fail(multiMedicationFormSchema, { ...VALID_MULTI, primaryIcd10: '123' });
  });

  it('accepts valid optional secondaryIcd10', () => {
    pass(multiMedicationFormSchema, { ...VALID_MULTI, secondaryIcd10: 'Z87.39' });
  });

  it('rejects invalid optional secondaryIcd10 when provided', () => {
    fail(multiMedicationFormSchema, { ...VALID_MULTI, secondaryIcd10: 'lowercase' });
  });

  it('accepts absent secondaryIcd10', () => {
    pass(multiMedicationFormSchema, { ...VALID_MULTI, secondaryIcd10: undefined });
  });

  // ── Urgency ───────────────────────────────────────────────────────────────

  it('accepts STAT urgency', () => {
    pass(multiMedicationFormSchema, { ...VALID_MULTI, urgency: 'STAT' });
  });

  it('rejects Critical urgency (not valid for medication)', () => {
    fail(multiMedicationFormSchema, { ...VALID_MULTI, urgency: 'Critical' });
  });

  // ── Authorization ─────────────────────────────────────────────────────────

  it('rejects unsigned', () => {
    fail(multiMedicationFormSchema, { ...VALID_MULTI, signed: false });
  });

  it('rejects consents with any false value', () => {
    fail(multiMedicationFormSchema, { ...VALID_MULTI, consents: [true, true, false] });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ADMIN ACTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('adminActionSchema', () => {
  const VALID_ADMIN_ACTION = {
    requestId: 'request-1',
    status: 'approved' as const,
    adminNotes: 'Medically necessary — approved.',
  };

  it('passes a valid approve action', () => {
    pass(adminActionSchema, VALID_ADMIN_ACTION);
  });

  it('passes a valid deny action', () => {
    pass(adminActionSchema, { ...VALID_ADMIN_ACTION, status: 'denied' });
  });

  it('passes a valid RMI action with rmiNotes', () => {
    pass(adminActionSchema, {
      ...VALID_ADMIN_ACTION,
      status: 'rmi',
      rmiNotes: 'Please provide the prescription date.',
    });
  });

  it('passes without rmiNotes (optional)', () => {
    pass(adminActionSchema, { ...VALID_ADMIN_ACTION, status: 'rmi' });
  });

  // ── requestId ─────────────────────────────────────────────────────────────

  it('rejects empty requestId', () => {
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, requestId: '' });
  });

  it('rejects whitespace-only requestId', () => {
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, requestId: '   ' });
  });

  // ── status ────────────────────────────────────────────────────────────────

  it('rejects an invalid status value', () => {
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, status: 'pending' });
  });

  it('rejects "bulk_approved" (not a valid single action status)', () => {
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, status: 'bulk_approved' });
  });

  it('rejects case-sensitive mismatch (Approved vs approved)', () => {
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, status: 'Approved' });
  });

  // ── adminNotes ────────────────────────────────────────────────────────────

  it('accepts adminNotes of exactly 5 characters', () => {
    pass(adminActionSchema, { ...VALID_ADMIN_ACTION, adminNotes: 'OK ok' });
  });

  it('rejects adminNotes of 4 characters', () => {
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, adminNotes: 'Done' });
  });

  it('rejects empty adminNotes', () => {
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, adminNotes: '' });
  });

  it('trims whitespace before checking adminNotes length', () => {
    // Only 4 meaningful chars after trim — should fail
    fail(adminActionSchema, { ...VALID_ADMIN_ACTION, adminNotes: '  OK  ' });
    // 5 meaningful chars after trim — should pass
    pass(adminActionSchema, { ...VALID_ADMIN_ACTION, adminNotes: '  OK ok  ' });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. BULK ADMIN ACTION SCHEMA
// ═══════════════════════════════════════════════════════════════════════════════

describe('bulkAdminActionSchema', () => {
  const VALID_BULK = {
    requestIds: ['request-1', 'request-2'],
    status: 'approved' as const,
    adminNotes: 'Bulk routine approvals.',
  };

  it('passes a valid bulk approve with multiple IDs', () => {
    pass(bulkAdminActionSchema, VALID_BULK);
  });

  it('passes a valid bulk deny', () => {
    pass(bulkAdminActionSchema, { ...VALID_BULK, status: 'denied' });
  });

  it('passes with a single requestId (minimum)', () => {
    pass(bulkAdminActionSchema, { ...VALID_BULK, requestIds: ['request-1'] });
  });

  // ── requestIds array ──────────────────────────────────────────────────────

  it('rejects an empty requestIds array', () => {
    fail(bulkAdminActionSchema, { ...VALID_BULK, requestIds: [] });
  });

  it('rejects requestIds containing an empty string', () => {
    fail(bulkAdminActionSchema, { ...VALID_BULK, requestIds: ['request-1', ''] });
  });

  it('rejects requestIds containing a whitespace-only string', () => {
    fail(bulkAdminActionSchema, { ...VALID_BULK, requestIds: ['   '] });
  });

  // ── status ────────────────────────────────────────────────────────────────

  it('rejects "rmi" status (not valid for bulk action)', () => {
    fail(bulkAdminActionSchema, { ...VALID_BULK, status: 'rmi' });
  });

  it('rejects "pending" status', () => {
    fail(bulkAdminActionSchema, { ...VALID_BULK, status: 'pending' });
  });

  // ── adminNotes ────────────────────────────────────────────────────────────

  it('rejects adminNotes shorter than 5 characters after trim', () => {
    fail(bulkAdminActionSchema, { ...VALID_BULK, adminNotes: 'OK' });
  });

  it('accepts adminNotes of exactly 5 characters', () => {
    pass(bulkAdminActionSchema, { ...VALID_BULK, adminNotes: 'Valid' });
  });

  it('rejects empty adminNotes', () => {
    fail(bulkAdminActionSchema, { ...VALID_BULK, adminNotes: '' });
  });
});
