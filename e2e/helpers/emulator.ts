/**
 * Helpers for interacting with the Firebase Emulator REST APIs.
 * Used to seed data, clear state, and verify Firestore documents in tests.
 */

const AUTH_EMULATOR = 'http://127.0.0.1:9099';
const FIRESTORE_EMULATOR = 'http://127.0.0.1:8080';
const PROJECT_ID = 'dme-portal-prototype';
const API_KEY = 'fake-api-key'; // any value works against the Auth Emulator

/**
 * Clear all data in the Auth emulator.
 */
export async function clearAuth(): Promise<void> {
  const res = await fetch(
    `${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE', headers: { 'Authorization': 'Bearer owner' } }
  );
  if (!res.ok) throw new Error(`Failed to clear auth emulator: ${res.status}`);
}

/**
 * Clear all data in the Firestore emulator.
 */
export async function clearFirestore(): Promise<void> {
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(`Failed to clear firestore emulator: ${res.status}`);
}

/**
 * Reset both Auth and Firestore emulators to a clean state.
 */
export async function resetEmulators(): Promise<void> {
  await Promise.all([clearAuth(), clearFirestore()]);
}

/**
 * Create a user in the Auth emulator via the signUp endpoint.
 * Then patch the account to set the desired uid via the admin endpoint.
 */
export async function createAuthUser(
  email: string,
  password: string,
  uid: string,
  displayName: string
): Promise<void> {
  // Use the emulator's admin endpoint to create a user with a specific localId
  const res = await fetch(
    `${AUTH_EMULATOR}/identitytoolkit.googleapis.com/v1/projects/${PROJECT_ID}/accounts`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer owner',
      },
      body: JSON.stringify({
        localId: uid,
        email,
        password,
        displayName,
        emailVerified: true,
      }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to create auth user ${email}: ${res.status} ${body}`);
  }
}

/**
 * Write a document to Firestore via the emulator REST API.
 */
export async function writeFirestoreDoc(
  collection: string,
  docId: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields = toFirestoreFields(data);
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer owner',
      },
      body: JSON.stringify({ fields }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to write ${collection}/${docId}: ${res.status} ${body}`);
  }
}

/**
 * Read a document from Firestore via the emulator REST API.
 */
export async function readFirestoreDoc(
  collection: string,
  docId: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(
    `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}/${docId}`,
    { headers: { 'Authorization': 'Bearer owner' } }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to read ${collection}/${docId}: ${res.status}`);
  const doc = await res.json();
  return doc.fields ? fromFirestoreFields(doc.fields) : null;
}

// ── Firestore value conversion ──────────────────────────────────────────────

function toFirestoreValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number')
    return Number.isInteger(val)
      ? { integerValue: String(val) }
      : { doubleValue: val };
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val))
    return { arrayValue: { values: val.map(toFirestoreValue) } };
  if (typeof val === 'object') {
    return { mapValue: { fields: toFirestoreFields(val as Record<string, unknown>) } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(
  obj: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  const fields: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return fields;
}

function fromFirestoreValue(val: Record<string, unknown>): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    const arr = val.arrayValue as { values?: Record<string, unknown>[] };
    return (arr.values ?? []).map(fromFirestoreValue);
  }
  if ('mapValue' in val) {
    const map = val.mapValue as { fields?: Record<string, Record<string, unknown>> };
    return map.fields ? fromFirestoreFields(map.fields) : {};
  }
  return null;
}

function fromFirestoreFields(
  fields: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    result[k] = fromFirestoreValue(v);
  }
  return result;
}
