/**
 * seed.mjs — Parrish Health DME Portal seed script
 *
 * Creates Firebase Auth accounts + seeds all Firestore collections from
 * the Phase 1 mock data. Safe to run multiple times (idempotent).
 *
 * Prerequisites: firebase login  (run `firebase login:list` to verify)
 *
 * Run:  npm run seed
 *
 * Test credentials (all share the same password):
 *   kobe@parrish.health      / Parrish2024!   (admin)
 *   maria@parrish.health     / Parrish2024!   (nurse)
 *   deshawn@parrish.health   / Parrish2024!   (homemaker)
 *   angela@parrish.health    / Parrish2024!   (office_staff)
 *   james@parrish.health     / Parrish2024!   (nurse)
 */

import { readFileSync } from 'fs';
import { homedir }      from 'os';
import { join }         from 'path';

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY    = 'AIzaSyB5K9Qx6qblzj1W7pPztCxgncMK9TIaOz0';
const PROJECT_ID = 'dme-portal-prototype';
const PASSWORD   = 'Parrish2024!';

// ─── Staff (matches src/data/staff.ts exactly) ────────────────────────────────
// mockId maps to the s1/s2 etc. used in patients.primaryNurse and requests.submittedBy

const TEST_STAFF = [
  { mockId: 's1', email: 'kobe@parrish.health',    displayName: 'Kobe Reynolds',  role: 'admin',        department: 'Operations',              phoneNumber: '(614) 555-0100' },
  { mockId: 's2', email: 'maria@parrish.health',   displayName: 'Maria Santos',   role: 'nurse',        department: 'Clinical — Home Health',  phoneNumber: '(614) 555-0192' },
  { mockId: 's3', email: 'deshawn@parrish.health', displayName: 'DeShawn Carter', role: 'homemaker',    department: 'Home Care Services',      phoneNumber: '(614) 555-0248' },
  { mockId: 's4', email: 'angela@parrish.health',  displayName: 'Angela Watts',   role: 'office_staff', department: 'Patient Services',        phoneNumber: '(614) 555-0377' },
  { mockId: 's5', email: 'james@parrish.health',   displayName: 'James Okonkwo',  role: 'nurse',        department: 'Clinical — Home Health',  phoneNumber: '(614) 555-0514' },
];

// ─── Patients (matches src/data/patients.ts) ─────────────────────────────────

const PATIENTS = [
  {
    id: 'p1', name: 'Eleanor Voss', dob: '1942-03-14', mrn: 'MRN-00412',
    insurance: 'Medicare Part A & B', phone: '(614) 555-0182',
    address: '2847 Maple Ridge Dr, Columbus, OH 43215',
    primaryNurse: 's2',
    allergies: ['Penicillin', 'Sulfa drugs'],
    conditions: ['Type 2 Diabetes Mellitus (E11.9)', 'Hypertension (I10)', 'Chronic Heart Failure (I50.9)', 'Osteoarthritis of knee (M17.11)'],
    clinicalNotes: 'Patient is an 83-year-old female with multiple comorbidities. Currently stable on oral medications. Requires daily blood glucose monitoring. Ambulation limited due to bilateral knee pain - PT recommended. Fall risk: HIGH.',
    status: 'active', admittedDate: '2026-01-08',
  },
  {
    id: 'p2', name: 'Bernard Okafor', dob: '1958-07-22', mrn: 'MRN-00551',
    insurance: 'Medicaid MCO', phone: '(614) 555-0344',
    address: '119 Sycamore Lane, Westerville, OH 43082',
    primaryNurse: 's2',
    allergies: ['Codeine'],
    conditions: ['COPD (J44.1)', 'Obstructive Sleep Apnea (G47.33)', 'Hypertension (I10)'],
    clinicalNotes: '67-year-old male with moderate COPD and diagnosed OSA. CPAP compliance has been inconsistent. SpO2 resting at 92%. Referral to pulmonology pending.',
    status: 'active', admittedDate: '2026-01-22',
  },
  {
    id: 'p3', name: 'Ruth Delacroix', dob: '1949-11-05', mrn: 'MRN-00618',
    insurance: 'Aetna Better Health', phone: '(740) 555-0279',
    address: '504 Birchwood Ave, Lancaster, OH 43130',
    primaryNurse: 's5',
    allergies: ['Aspirin', 'Latex'],
    conditions: ['Atrial Fibrillation (I48.91)', 'Type 2 Diabetes Mellitus (E11.9)', 'Peripheral Artery Disease (I73.9)', 'Depression (F32.9)'],
    clinicalNotes: '76-year-old female on anticoagulation therapy (warfarin). INR checked weekly - target 2-3. Last INR: 2.6 (2026-03-10). Reports low mood and decreased appetite.',
    status: 'active', admittedDate: '2025-12-14',
  },
  {
    id: 'p4', name: 'Hector Villanueva', dob: '1965-04-30', mrn: 'MRN-00703',
    insurance: 'Paramount Advantage', phone: '(513) 555-0461',
    address: '3310 Elmwood Blvd, Dayton, OH 45402',
    primaryNurse: 's5',
    allergies: [],
    conditions: ['Post-stroke hemiplegia, right side (I69.351)', 'Dysphagia (R13.10)', 'Hypertension (I10)'],
    clinicalNotes: '60-year-old male, 8 months post-CVA with residual right-sided weakness. Speech therapy ongoing for dysphagia. OT evaluating for adaptive ADL equipment.',
    status: 'active', admittedDate: '2026-02-03',
  },
  {
    id: 'p5', name: 'Doris Huang', dob: '1937-09-18', mrn: 'MRN-00822',
    insurance: 'Medicare Advantage (Humana)', phone: '(614) 555-0533',
    address: '78 Cedarwood Ct, Gahanna, OH 43230',
    primaryNurse: 's2',
    allergies: ['NSAIDs'],
    conditions: ['Congestive Heart Failure (I50.32)', 'Chronic Kidney Disease Stage 3 (N18.3)', 'Osteoporosis (M81.0)'],
    clinicalNotes: '88-year-old female with complex cardiac and renal status. Daily weights monitored. High fall and fracture risk.',
    status: 'active', admittedDate: '2025-11-29',
  },
  {
    id: 'p6', name: 'James Whitfield', dob: '1972-01-12', mrn: 'MRN-00947',
    insurance: 'Buckeye Health Plan', phone: '(937) 555-0614',
    address: '622 Oak Street, Springfield, OH 45505',
    primaryNurse: 's5',
    allergies: ['Amoxicillin'],
    conditions: ['Multiple Sclerosis (G35)', 'Neurogenic Bladder (N31.9)', 'Anxiety Disorder (F41.1)'],
    clinicalNotes: '54-year-old male with relapsing-remitting MS. Currently on disease-modifying therapy. Power wheelchair assessment requested by PT.',
    status: 'active', admittedDate: '2026-02-19',
  },
];

// ─── Requests (matches src/data/requests.ts) ─────────────────────────────────

const REQUESTS = [
  {
    id: 'r1', patientId: 'p6', submittedBy: 's5', submittedAt: '2026-03-16T09:14:00Z', status: 'pending',
    details: { type: 'dme', equipmentId: 'd1', equipmentName: 'Standard Wheelchair', icd10Code: 'G35', icd10Description: 'Multiple Sclerosis', urgency: 'routine', justification: 'Patient has progressive lower-extremity weakness secondary to MS. Currently unable to ambulate safely for distances >20 feet. Wheelchair required for community mobility and medical appointments.' },
  },
  {
    id: 'r2', patientId: 'p2', submittedBy: 's2', submittedAt: '2026-03-15T14:30:00Z', status: 'pending',
    details: { type: 'dme', equipmentId: 'd5', equipmentName: 'CPAP Machine', icd10Code: 'G47.33', icd10Description: 'Obstructive Sleep Apnea (Adult)', urgency: 'urgent', justification: 'Patient diagnosed with moderate-to-severe OSA per sleep study (AHI 28). Cardiologist recommends CPAP initiation due to comorbid hypertension and COPD.' },
  },
  {
    id: 'r3', patientId: 'p3', submittedBy: 's5', submittedAt: '2026-03-14T11:00:00Z', status: 'rmi',
    details: { type: 'multi_medication', startDate: '2026-03-14', indication: { code: 'I48.91', description: 'Unspecified atrial fibrillation' }, drugs: [{ drugName: 'Warfarin 5mg', rxcui: '855333', strength: '5 MG', doseForm: 'Tab', route: 'Oral', frequency: 'QD', quantity: 30, refills: 3 }, { drugName: 'Metformin 500mg', rxcui: '861007', strength: '500 MG', doseForm: 'Tab', route: 'Oral', frequency: 'BID', quantity: 60, refills: 2 }, { drugName: 'Sertraline 50mg', rxcui: '312940', strength: '50 MG', doseForm: 'Tab', route: 'Oral', frequency: 'QD', quantity: 30, refills: 5 }], pharmacy: 'Kroger Pharmacy - Lancaster', justification: 'Monthly refill for established medication regimen.' },
    adminNotes: 'Please confirm current INR reading before warfarin refill can be approved.',
    processedAt: '2026-03-14T16:45:00Z', processedBy: 's1',
  },
  {
    id: 'r4', patientId: 'p1', submittedBy: 's2', submittedAt: '2026-03-13T10:20:00Z', status: 'approved',
    details: { type: 'dme', equipmentId: 'd3', equipmentName: 'Hospital Bed (Semi-Electric)', icd10Code: 'I50.9', icd10Description: 'Heart failure, unspecified', urgency: 'urgent', justification: "Patient's CHF requires head-of-bed elevation for respiratory comfort." },
    adminNotes: 'Approved. Insurance pre-authorization confirmed. Delivery scheduled with supplier.',
    processedAt: '2026-03-13T15:10:00Z', processedBy: 's1',
  },
  {
    id: 'r5', patientId: 'p5', submittedBy: 's2', submittedAt: '2026-03-12T08:45:00Z', status: 'approved',
    details: { type: 'medication', drugName: 'Furosemide 40mg', rxcui: '310430', strength: '40 MG', doseForm: 'Tab', route: 'Oral', frequency: 'QD', startDate: '2026-03-12', indication: { code: 'I50.32', description: 'Chronic diastolic (congestive) heart failure' }, quantity: 30, refills: 2, pharmacy: 'CVS Pharmacy - Gahanna', justification: 'Patient showing signs of fluid retention. Physician ordered dose increase.' },
    adminNotes: 'Approved. Physician order on file.',
    processedAt: '2026-03-12T13:00:00Z', processedBy: 's1',
  },
  {
    id: 'r6', patientId: 'p4', submittedBy: 's5', submittedAt: '2026-03-11T13:15:00Z', status: 'denied',
    details: { type: 'dme', equipmentId: 'd2', equipmentName: 'Rollator Walker (4-Wheel)', icd10Code: 'I69.351', icd10Description: 'Hemiplegia and hemiparesis following cerebral infarction', urgency: 'routine', justification: 'Patient has right-sided hemiplegia and requires gait assistance.' },
    adminNotes: 'Denied - patient currently has a standard walker on file from prior authorization (2025-09-04). OT assessment required before upgrade.',
    processedAt: '2026-03-11T17:30:00Z', processedBy: 's1',
  },
  {
    id: 'r7', patientId: 'p1', submittedBy: 's2', submittedAt: '2026-03-10T09:00:00Z', status: 'approved',
    details: { type: 'multi_medication', startDate: '2026-03-10', indication: { code: 'I10', description: 'Essential (primary) hypertension' }, drugs: [{ drugName: 'Lisinopril 10mg', rxcui: '314077', strength: '10 MG', doseForm: 'Tab', route: 'Oral', frequency: 'QD', quantity: 30, refills: 3 }, { drugName: 'Atorvastatin 40mg', rxcui: '617312', strength: '40 MG', doseForm: 'Tab', route: 'Oral', frequency: 'QHS', quantity: 30, refills: 3 }, { drugName: 'Metformin 1000mg', rxcui: '861008', strength: '1000 MG', doseForm: 'Tab', route: 'Oral', frequency: 'BID', quantity: 60, refills: 2 }, { drugName: 'Furosemide 20mg', rxcui: '310429', strength: '20 MG', doseForm: 'Tab', route: 'Oral', frequency: 'QD', quantity: 30, refills: 1 }], pharmacy: 'Walgreens - Broad St Columbus' },
    adminNotes: 'Approved. All medications verified against current care plan.',
    processedAt: '2026-03-10T14:20:00Z', processedBy: 's1',
  },
  {
    id: 'r8', patientId: 'p6', submittedBy: 's4', submittedAt: '2026-03-09T15:50:00Z', status: 'pending',
    details: { type: 'medication', drugName: 'Gabapentin 300mg', rxcui: '310431', strength: '300 MG', doseForm: 'Cap', route: 'Oral', frequency: 'TID', startDate: '2026-03-09', indication: { code: 'G35', description: 'Multiple sclerosis' }, quantity: 90, refills: 1, pharmacy: 'Rite Aid - Springfield', justification: 'Gabapentin prescribed for neuropathic pain associated with MS.' },
  },
];

// ─── DME Catalog (abbreviated — seeds the IDs the requests reference) ─────────

const DME_CATALOG = [
  { id: 'mob-001', name: '4 Wheeled Walker',                  sku: 'MOB-001', category: 'Mobility'          },
  { id: 'mob-002', name: 'Folding Walker With Wheels',         sku: 'MOB-002', category: 'Mobility'          },
  { id: 'mob-003', name: 'Folding Walker W/Out Wheels',        sku: 'MOB-003', category: 'Mobility'          },
  { id: 'mob-004', name: 'Cane - Single Point Straight',       sku: 'MOB-004', category: 'Mobility'          },
  { id: 'mob-005', name: 'Cane Quad',                          sku: 'MOB-005', category: 'Mobility'          },
  { id: 'mob-006', name: 'Gait Belt',                          sku: 'MOB-006', category: 'Mobility'          },
  { id: 'mob-007', name: 'Lateral Support for Wheelchair',     sku: 'MOB-007', category: 'Mobility'          },
  { id: 'mob-008', name: 'Leg Rests',                          sku: 'MOB-008', category: 'Mobility'          },
  { id: 'bed-001', name: 'Bed Full Electric',                  sku: 'BED-001', category: 'Beds & Mattresses' },
  { id: 'bed-002', name: 'Bed High-Low Full Electric',         sku: 'BED-002', category: 'Beds & Mattresses' },
  { id: 'bed-003', name: 'Bed Bariatric',                      sku: 'BED-003', category: 'Beds & Mattresses' },
  { id: 'bed-038', name: 'Bed Wedge',                          sku: 'BED-038', category: 'Beds & Mattresses' },
  { id: 'res-001', name: 'CPAP',                               sku: 'RES-001', category: 'Respiratory'       },
  { id: 'res-002', name: 'BiPAP',                              sku: 'RES-002', category: 'Respiratory'       },
  { id: 'res-004', name: '5L Oxygen Concentrator with Backup', sku: 'RES-004', category: 'Respiratory'       },
  { id: 'bth-001', name: 'Commode',                            sku: 'BTH-001', category: 'Bathroom Safety'   },
  { id: 'bth-005', name: 'Commode Drop Arm',                   sku: 'BTH-005', category: 'Bathroom Safety'   },
  { id: 'sea-001', name: 'BRODA Chair 16"',                    sku: 'SEA-001', category: 'Seating'           },
  { id: 'sea-007', name: 'Geri Chair',                         sku: 'SEA-007', category: 'Seating'           },
  { id: 'lft-001', name: 'Hoyer Lift - Unit',                  sku: 'LFT-001', category: 'Lifts & Transfers' },
  { id: 'lft-002', name: 'HOYER DLX Power Patient Lift',       sku: 'LFT-002', category: 'Lifts & Transfers' },
  { id: 'acc-001', name: 'Fall Pad',                           sku: 'ACC-001', category: 'Accessories'       },
  { id: 'acc-002', name: 'Feeding Pump',                       sku: 'ACC-002', category: 'Accessories'       },
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

  if (tokens.access_token && tokens.expires_at && Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

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
  if (data.error?.message === 'EMAIL_EXISTS') return null;
  if (data.error) throw new Error(`Auth create failed: ${data.error.message}`);
  return data.localId;
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

// ─── Firestore REST helpers ───────────────────────────────────────────────────

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean')          return { booleanValue: val };
  if (typeof val === 'number')           return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (typeof val === 'string')           return { stringValue: val };
  if (Array.isArray(val))                return { arrayValue: { values: val.map(toFirestoreValue) } };
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
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
    body: JSON.stringify(toFirestoreDoc(docData)),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Firestore PATCH failed (${path}): ${data.error.message}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nSeeding → project: ${PROJECT_ID}`);
console.log(`Password for all accounts: ${PASSWORD}\n`);

const accessToken = await getAccessToken();
const now = Date.now();

// Step 1: Create/get all staff Auth accounts and build the UID map
// uidMap: { 's1': '<firebase-uid>', 's2': '<firebase-uid>', ... }
const uidMap = {};

console.log('── Staff accounts ──────────────────────────────');
for (const account of TEST_STAFF) {
  process.stdout.write(`  ${account.displayName} <${account.email}> ... `);
  try {
    let uid = await createAuthUser(account.email, PASSWORD, account.displayName);
    if (uid) {
      console.log(`created (${uid})`);
    } else {
      uid = await signInToGetUid(account.email, PASSWORD);
      console.log(`exists  (${uid})`);
    }
    uidMap[account.mockId] = uid;

    // Write Firestore staff profile
    const existing = await firestoreGetDoc(`staff/${uid}`, accessToken);
    if (!existing) {
      await firestoreSetDoc(`staff/${uid}`, {
        uid,
        email:                  account.email,
        displayName:            account.displayName,
        role:                   account.role,
        department:             account.department,
        phoneNumber:            account.phoneNumber,
        status:                 'active',
        hasCompletedOnboarding: true,
        notificationPrefs: { emailOnStatusChange: true, emailOnNewMessage: true },
        createdAt: now,
        updatedAt: now,
      }, accessToken);
    }
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }
}

// Step 2: Seed patients (remap primaryNurse s1/s2/... → real UIDs)
console.log('\n── Patients ────────────────────────────────────');
for (const patient of PATIENTS) {
  process.stdout.write(`  ${patient.name} (${patient.id}) ... `);
  try {
    const existing = await firestoreGetDoc(`patients/${patient.id}`, accessToken);
    if (existing) { console.log('exists'); continue; }
    await firestoreSetDoc(`patients/${patient.id}`, {
      ...patient,
      primaryNurse: uidMap[patient.primaryNurse] ?? patient.primaryNurse,
    }, accessToken);
    console.log('created');
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }
}

// Step 3: Seed DME catalog
console.log('\n── DME Catalog ─────────────────────────────────');
for (const item of DME_CATALOG) {
  process.stdout.write(`  ${item.name} (${item.id}) ... `);
  try {
    const existing = await firestoreGetDoc(`dme_catalog/${item.id}`, accessToken);
    if (existing) { console.log('exists'); continue; }
    await firestoreSetDoc(`dme_catalog/${item.id}`, item, accessToken);
    console.log('created');
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }
}

// Step 4: Seed requests (remap submittedBy / processedBy → real UIDs)
console.log('\n── Requests ────────────────────────────────────');
for (const req of REQUESTS) {
  process.stdout.write(`  ${req.id} (${req.status}) ... `);
  try {
    const existing = await firestoreGetDoc(`requests/${req.id}`, accessToken);
    if (existing) { console.log('exists'); continue; }
    const doc = {
      ...req,
      submittedBy: uidMap[req.submittedBy] ?? req.submittedBy,
    };
    if (req.processedBy) doc.processedBy = uidMap[req.processedBy] ?? req.processedBy;
    await firestoreSetDoc(`requests/${req.id}`, doc, accessToken);
    console.log('created');
  } catch (err) {
    console.error(`FAILED: ${err.message}`);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log('\n✓ Seed complete.\n');
console.log('Test credentials:');
console.log('─────────────────────────────────────────────────────────');
for (const a of TEST_STAFF) {
  console.log(`  [${a.role.padEnd(12)}]  ${a.email.padEnd(30)}  ${PASSWORD}`);
}
console.log('─────────────────────────────────────────────────────────\n');
