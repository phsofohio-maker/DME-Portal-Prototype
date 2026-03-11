/**
 * seed.mjs — Parrish Health DME Portal test account seeder
 *
 * Uses Firebase REST APIs + the Firebase CLI's stored OAuth token — no service
 * account key required. Safe to run multiple times (skips existing users).
 *
 * Prerequisites: firebase login  (already done if `firebase login:list` shows an account)
 *
 * Run:  npm run seed
 *
 * Credentials created:
 *   admin@parrish.com       / Parrish2024!   (admin)
 *   nurse@parrish.com       / Parrish2024!   (nurse)
 *   homemaker@parrish.com   / Parrish2024!   (homemaker)
 *   office@parrish.com      / Parrish2024!   (office_staff)
 */

import { readFileSync } from 'fs';
import { homedir }      from 'os';
import { join }         from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY    = 'AIzaSyBEMZoWCqesSpCvB29p9MAAc7KSX_DJq5w';
const PROJECT_ID = 'parrish-dme-portal';
const PASSWORD   = 'Parrish2024!';

// ─── Test accounts ───────────────────────────────────────────────────────────

const TEST_STAFF = [
  {
    email:       'admin@parrish.com',
    displayName: 'Marcus Webb',
    role:        'admin',
    department:  'Operations',
    phoneNumber: '(512) 555-0101',
  },
  {
    email:       'nurse@parrish.com',
    displayName: 'Sarah Delgado RN',
    role:        'nurse',
    department:  'Clinical — Home Health',
    phoneNumber: '(512) 555-0192',
  },
  {
    email:       'homemaker@parrish.com',
    displayName: 'Darnell Foster',
    role:        'homemaker',
    department:  'Home Care Services',
    phoneNumber: '(737) 555-0248',
  },
  {
    email:       'office@parrish.com',
    displayName: 'Patricia Nguyen',
    role:        'office_staff',
    department:  'Patient Services',
    phoneNumber: '(512) 555-0377',
  },
];

// ─── OAuth token helpers ──────────────────────────────────────────────────────

const FIREBASE_TOOLS_CONFIG = join(homedir(), '.config', 'configstore', 'firebase-tools.json');
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

function loadCliTokens() {
  try {
    const config = JSON.parse(readFileSync(FIREBASE_TOOLS_CONFIG, 'utf8'));
    return config.tokens ?? null;
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const tokens = loadCliTokens();
  if (!tokens) throw new Error('No Firebase CLI tokens found. Run: firebase login');

  // Check if access token is still valid (with 60s buffer)
  if (tokens.access_token && tokens.expires_at && Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  // Refresh using the stored refresh token
  if (!tokens.refresh_token) throw new Error('No refresh token in Firebase CLI config.');

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8ywKVtZi1ZP6Ywq9C',
      refresh_token: tokens.refresh_token,
      grant_type:    'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Firebase Auth REST helpers ───────────────────────────────────────────────

const AUTH_BASE = `https://identitytoolkit.googleapis.com/v1`;

async function createAuthUser(email, password, displayName) {
  const res = await fetch(`${AUTH_BASE}/accounts:signUp?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: false }),
  });
  const data = await res.json();

  if (data.error?.message === 'EMAIL_EXISTS') return null; // already exists
  if (data.error) throw new Error(`Auth create failed: ${data.error.message}`);
  return data.localId; // new UID
}

async function signInToGetUid(email, password) {
  const res = await fetch(`${AUTH_BASE}/accounts:signInWithPassword?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Sign-in failed for ${email}: ${data.error.message}`);
  return data.localId;
}

// ─── Firestore REST helper ────────────────────────────────────────────────────

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')          return { booleanValue: val };
  if (typeof val === 'number')           return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string')           return { stringValue: val };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFirestoreValue(v);
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreDoc(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toFirestoreValue(v);
  return { fields };
}

async function firestoreGetDoc(path, accessToken) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return null;
  const data = await res.json();
  if (data.error) throw new Error(`Firestore GET failed: ${data.error.message}`);
  return data;
}

async function firestoreSetDoc(path, docData, accessToken) {
  const res = await fetch(`${FS_BASE}/${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(toFirestoreDoc(docData)),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Firestore PATCH failed: ${data.error.message}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nSeeding test accounts → project: ${PROJECT_ID}`);
console.log(`Password for all accounts: ${PASSWORD}\n`);

const accessToken = await getAccessToken();
const now = Date.now();

for (const account of TEST_STAFF) {
  console.log(`Processing: ${account.displayName} <${account.email}>`);
  try {
    // 1. Create Auth user (returns null if already exists)
    let uid = await createAuthUser(account.email, PASSWORD, account.displayName);
    if (uid) {
      console.log(`  ✓  Created Auth user: ${account.email} (${uid})`);
    } else {
      uid = await signInToGetUid(account.email, PASSWORD);
      console.log(`  ↩  Auth user already exists: ${account.email} (${uid})`);
    }

    // 2. Write Firestore staff document if missing
    const existing = await firestoreGetDoc(`staff/${uid}`, accessToken);
    if (existing) {
      console.log(`  ↩  Firestore profile already exists`);
    } else {
      await firestoreSetDoc(`staff/${uid}`, {
        uid,
        email:                  account.email,
        displayName:            account.displayName,
        role:                   account.role,
        department:             account.department,
        phoneNumber:            account.phoneNumber,
        status:                 'active',
        hasCompletedOnboarding: true,
        notificationPrefs: {
          emailOnStatusChange: true,
          emailOnNewMessage:   true,
        },
        createdAt: now,
        updatedAt: now,
      }, accessToken);
      console.log(`  ✓  Created Firestore profile [${account.role}]`);
    }
  } catch (err) {
    console.error(`  ✗  Failed for ${account.email}:`, err.message);
  }
}

console.log('\nDone.\n');
console.log('Test credentials:');
console.log('─────────────────────────────────────────────────────');
for (const a of TEST_STAFF) {
  console.log(`  [${a.role.padEnd(12)}]  ${a.email.padEnd(28)}  ${PASSWORD}`);
}
console.log('─────────────────────────────────────────────────────\n');
