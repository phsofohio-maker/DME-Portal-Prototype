# Medication Form Enhancement — Implementation Guide

**Date:** March 26, 2026  
**Scope:** Single medication form + Multi-medication batch form  
**Files modified:** 6 files touched, 1 new file created

---

## Approach

The PM's feedback maps to a single root cause: the medication data model was designed as a *refill reference* (just a drug name and quantity) rather than a *prescription record* (which includes dosing details, timing, and clinical justification). This enhancement extends the data contract to capture prescription-grade information while maintaining full backward compatibility with existing Firestore documents.

**Complexity budget justification:** The RxNorm enrichment API call adds one additional network request per drug selection. This is justified because it eliminates manual data entry for three fields (strength, dose form, route) — a net reduction in user effort despite the added code complexity.

---

## Change summary

| # | PM Requirement | Solution | Auto-filled? |
|---|----------------|----------|:------------:|
| 1 | Start date (current date) | Date input, defaults to `today`, editable | Yes |
| 2 | Unit strength + dosage | `strength` field, auto-populated from RxTerms API | Yes |
| 3 | Medication form (tablet, capsule…) | `doseForm` field, auto-populated from RxTerms API | Yes |
| 4 | Route + frequency | `route` auto-populated; `frequency` dropdown (QD, BID, TID…) | Route: yes, Frequency: manual |
| 5 | Indication | ICD-10 search component (reused from DME form) | Search-assisted |
| 6 | Auto-fill medication + quantity | RxNorm RxTerms API enrichment on drug selection | Strength/form/route: yes |

---

## File-by-file changes

### 1. NEW FILE: `src/data/frequencyOptions.ts`

Single source of truth for medication frequency codes. Create this file:

```typescript
export const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "QD",   label: "QD — Once daily" },
  { value: "BID",  label: "BID — Twice daily" },
  { value: "TID",  label: "TID — Three times daily" },
  { value: "QID",  label: "QID — Four times daily" },
  { value: "Q4H",  label: "Q4H — Every 4 hours" },
  { value: "Q6H",  label: "Q6H — Every 6 hours" },
  { value: "Q8H",  label: "Q8H — Every 8 hours" },
  { value: "Q12H", label: "Q12H — Every 12 hours" },
  { value: "QHS",  label: "QHS — At bedtime" },
  { value: "QAM",  label: "QAM — Every morning" },
  { value: "PRN",  label: "PRN — As needed" },
  { value: "STAT", label: "STAT — Immediately" },
  { value: "QOD",  label: "QOD — Every other day" },
  { value: "QW",   label: "QW — Once weekly" },
];

export function frequencyLabel(code: string): string {
  return FREQUENCY_OPTIONS.find((o) => o.value === code)?.label ?? code;
}
```

---

### 2. MODIFY: `src/types.ts`

**Add** the `Indication` interface and **extend** three existing interfaces:

```typescript
// ADD — new sub-type
export interface Indication {
  code: string;
  description: string;
}

// EXTEND — Drug interface (add 3 optional fields)
export interface Drug {
  name: string;
  rxcui: string;
  strength?: string;   // from RxTerms API
  doseForm?: string;   // from RxTerms API
  route?: string;      // from RxTerms API
}

// EXTEND — MedicationDetails (add 6 optional fields)
export interface MedicationDetails {
  type: "medication";
  drugName: string;
  rxcui: string;
  strength?: string;        // NEW
  doseForm?: string;        // NEW
  route?: string;           // NEW
  frequency?: string;       // NEW
  startDate?: string;       // NEW — ISO date
  indication?: Indication;  // NEW
  quantity: number;
  refills: number;
  pharmacy: string;
  justification?: string;
}

// EXTEND — MultiMedicationDetails (add shared + per-drug fields)
export interface MultiMedicationDetails {
  type: "multi_medication";
  startDate?: string;        // NEW — shared
  indication?: Indication;   // NEW — shared
  drugs: Array<{
    drugName: string;
    rxcui: string;
    strength?: string;       // NEW
    doseForm?: string;       // NEW
    route?: string;          // NEW
    frequency?: string;      // NEW
    quantity: number;
    refills: number;
  }>;
  pharmacy: string;
  justification?: string;
}
```

All new fields are **optional** for backward compatibility with existing Firestore documents.

---

### 3. MODIFY: `src/components/DrugSearch.tsx`

**Root cause:** The component hits `approximateTerm` for search but never calls RxTerms for enrichment data. Adding a second API call after selection populates strength, doseForm, and route automatically.

**Changes:**
- Add `enrichDrug()` async function that calls `RxTerms/rxcui/{id}/allinfo.json`
- Add `enriching` loading state (shows spinner during enrichment)
- Modify `pick()` to call `enrichDrug()` before `onSelect()`
- If enrichment fails, drug is returned without those fields (graceful degradation)

**Key addition — the enrichment function:**

```typescript
interface RxTermsResponse {
  rxtermsProperties?: {
    strength?: string;
    rxtermsDoseForm?: string;
    route?: string;
  };
}

async function enrichDrug(drug: Drug): Promise<Drug> {
  if (!drug.rxcui) return drug;
  try {
    const url = `https://rxnav.nlm.nih.gov/REST/RxTerms/rxcui/${encodeURIComponent(drug.rxcui)}/allinfo.json`;
    const res = await fetch(url);
    const data = (await res.json()) as RxTermsResponse;
    const props = data.rxtermsProperties;
    if (props) {
      return {
        ...drug,
        strength: props.strength || undefined,
        doseForm: props.rxtermsDoseForm || undefined,
        route:    props.route || undefined,
      };
    }
  } catch {
    // Enrichment failed — return without enrichment, user fills manually
  }
  return drug;
}
```

**Modified `pick()` function:**

```typescript
async function pick(drug: Drug) {
  setQuery(drug.name);
  setOpen(false);
  setActiveIdx(-1);
  if (drug.rxcui) {
    setEnriching(true);
    const enriched = await enrichDrug(drug);
    setEnriching(false);
    onSelect(enriched);
  } else {
    onSelect(drug);
  }
}
```

The complete replacement file is in `patches/DrugSearch.tsx`.

---

### 4. MODIFY: `src/views/NewRequestView.tsx`

This is the largest change. Two components are fully replaced.

**Add imports:**
```typescript
import { FREQUENCY_OPTIONS } from "../data/frequencyOptions";
// Icd10Search should already be imported — verify
```

**Add helper:**
```typescript
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}
```

#### MedicationForm — what changed

| Aspect | Before | After |
|--------|--------|-------|
| Form state fields | 7 | 14 (added strength, doseForm, route, frequency, startDate, indicationCode, indicationDesc) |
| Drug selection callback | Sets drugName + rxcui | Sets drugName + rxcui + strength + doseForm + route (from enriched Drug) |
| Validation | 4 required checks | 6 required checks (added frequency, startDate) |
| Submit payload | 7 fields | 13 fields |
| Layout | Single column, 6 inputs | Single column, 10 inputs + auto-filled detail row |

**New UI element — auto-filled drug details row:**
After selecting a medication, a 3-column row appears showing Strength, Dose Form, and Route. These are pre-populated from RxNorm but remain editable for manual override or correction.

#### MultiMedForm — what changed

| Aspect | Before | After |
|--------|--------|-------|
| DrugRow interface | 5 fields | 9 fields (added strength, doseForm, route, frequency) |
| Layout per drug | Table row (grid columns) | Card layout (vertical stack per drug) |
| Shared fields | pharmacy | pharmacy + startDate + indication |
| Validation | drugName required per row | drugName + frequency required per row |

**Layout redesign rationale:** The original table grid (`Medication | Qty | Refills | [x]`) cannot accommodate 7+ fields per drug without horizontal scrolling. Each drug is now a card with:
- Row 1: Drug search (full width)
- Row 2: Auto-filled chips (Strength | Form | Route) in a subtle background row
- Row 3: Frequency dropdown + Qty + Refills

The complete replacement code for both components is in `patches/NewRequestView.forms.tsx`.

---

### 5. MODIFY: `src/views/RequestDetailView.tsx`

**Add import:**
```typescript
import { frequencyLabel } from "../data/frequencyOptions";
```

**Changes:** Replace the medication and multi_medication display sections to render the new fields. All new fields render conditionally — if absent (old data), they're simply not shown.

The medication detail section goes from a 2×2 grid to a responsive layout with rows for: Medication+Pharmacy, Strength+Form+Route, Frequency+Qty+Refills, Start Date, Indication.

The multi-medication table gains 3 new columns: Freq, Strength, Form. The grid template changes from `1fr 70px 70px` to `1fr 100px 70px 70px 60px 60px`.

Complete replacement code in `patches/RequestDetailView.sections.tsx`.

---

### 6. MODIFY: `src/utils/pdfExport.ts`

**Add import:**
```typescript
import { frequencyLabel } from "../data/frequencyOptions";
```

**Changes:** Both the medication and multi_medication PDF sections are updated to render the new fields. The multi-med drug table expands from 3 columns to 6 columns.

Complete replacement code in `patches/pdfExport.sections.ts`.

---

### 7. MODIFY: `scripts/seed.mjs` + `src/data/requests.ts`

Add the new fields to existing medication fixture data (r3, r5, r7, r8) so the detail views render correctly with test data. See `patches/seed.patch.ts` for exact values.

---

## Ripple effect analysis

| Downstream system | Impact | Action needed |
|-------------------|--------|---------------|
| Firestore security rules | No change — new fields are nested inside `details` which is already write-permitted | None |
| Cloud Functions (email notifications) | No impact — emails intentionally exclude clinical data | None |
| `reqTitle()` in statusHelpers | No change — still reads `details.drugName` | None |
| `RequestRows` component | No change — renders title + status, doesn't show medication details | None |
| Dashboard KPI cards | No change — counts by status, not by detail fields | None |
| Firestore indexes | No new queries on the new fields — no index changes needed | None |
| `firebaseService.submitRequest()` | No change — accepts `RequestDetails` union, passes through to Firestore | None |
| Zod validation schemas | **Needs update if implemented** — add the new optional fields to the medication schemas | Update if Phase 2B Block 11 schemas exist |

---

## Verification checklist

After applying all changes, verify:

- [ ] **TypeScript compiles** — `npm run build` passes with zero type errors
- [ ] **Single medication form** — all new fields visible: start date, drug details row (auto-filled), frequency dropdown, indication search
- [ ] **Drug auto-fill works** — select "Lisinopril" → strength shows "10 MG", form shows "Tab", route shows "Oral"
- [ ] **Drug auto-fill fails gracefully** — disconnect network, select a drug → fields show empty but editable
- [ ] **Manual override** — change auto-filled strength from "10 MG" to "20 MG" → submits with overridden value
- [ ] **Multi-med card layout** — each drug renders as a card, not a table row
- [ ] **Multi-med shared fields** — start date and indication appear once at form level
- [ ] **Request detail view** — open an existing medication request → new fields show if present, old requests without new fields render without errors
- [ ] **PDF export** — export a medication request → PDF includes all new fields
- [ ] **Backward compatibility** — open request r5 (old data without new fields) → renders correctly, no crashes
- [ ] **Seed data** — re-seed with updated fixtures → detail views show all enriched data
