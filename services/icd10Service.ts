/**
 * icd10Service.ts — Phase 5: ICD-10-CM code lookup via NIH Clinical Tables API
 *
 * Uses the same NIH NLM infrastructure as the RxNorm drug lookup (Phase 3).
 * Replaces free-text ICD-10 input with a validated, autocomplete-backed field.
 *
 * API reference: https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html
 *
 * HIPAA note: only code + description are transmitted to this federal API — no
 * patient identifiers are ever included in these requests.
 */

export interface ICD10Result {
  code: string;       // e.g. "M54.5"
  description: string; // e.g. "Low back pain"
  display: string;    // "M54.5 — Low back pain" (for rendering)
}

const BASE_URL = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search';

/**
 * Search ICD-10-CM codes by query string (code or description terms).
 * Returns up to `maxResults` matches (default 8).
 *
 * The API returns:
 *   [total, codes[], null, [[code, description], ...]]
 */
export async function searchICD10(
  query: string,
  maxResults = 8
): Promise<ICD10Result[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    sf:    'code,name',   // search fields
    terms: query.trim(),
    maxList: String(maxResults),
  });

  const response = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`ICD-10 API error: ${response.status}`);
  }

  // Shape: [total, ["M54.5", ...], null, [["M54.5", "Low back pain"], ...]]
  const data = await response.json() as [number, string[], null, [string, string][]];
  const rows = data[3] ?? [];

  return rows.map(([code, description]) => ({
    code,
    description,
    display: `${code} — ${description}`,
  }));
}

/**
 * Validate a single ICD-10-CM code by looking it up exactly.
 * Returns the matching result or null if invalid.
 */
export async function validateICD10(code: string): Promise<ICD10Result | null> {
  if (!code.trim()) return null;
  const results = await searchICD10(code, 5);
  const exact = results.find(
    (r) => r.code.toLowerCase() === code.trim().toLowerCase()
  );
  return exact ?? null;
}
