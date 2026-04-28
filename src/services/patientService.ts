/**
 * patientService.ts — PatientLookupService abstraction.
 *
 * Current implementation: FirestorePatientService — reads from the Firestore
 * `patients` collection seeded by scripts/seed.mjs.
 *
 * Falls back to in-bundle mock data when Firestore is empty (first run, dev).
 *
 * Future (Phase 4+): FHIRPatientService — proxied via Cloud Function against
 * the EHR's FHIR R4 endpoint.
 */

import { addDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import type { Patient } from '../types';
import { PATIENTS as STATIC_PATIENTS } from '../data/patients';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface PatientLookupService {
  /** Return all patients (up to 500). */
  listAll(): Promise<Patient[]>;
  /** Free-text search by name, MRN, or DOB. Returns empty for blank query. */
  search(query: string): Promise<Patient[]>;
  /** Look up a single patient by ID. Returns null if not found. */
  getById(id: string): Promise<Patient | null>;
  /** Create a new patient document. Returns the new id. */
  create(input: Omit<Patient, 'id'>): Promise<string>;
}

// ─── Firestore implementation ─────────────────────────────────────────────────

class FirestorePatientServiceImpl implements PatientLookupService {
  private cache: Patient[] | null = null;

  private async getAll(): Promise<Patient[]> {
    if (this.cache) return this.cache;
    const snap  = await getDocs(query(collection(db, 'patients'), orderBy('name'), limit(500)));
    this.cache  = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Patient));
    return this.cache;
  }

  async listAll(): Promise<Patient[]> {
    return this.getAll();
  }

  async search(q: string): Promise<Patient[]> {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    const all   = await this.getAll();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.mrn.toLowerCase().includes(lower)  ||
        p.dob.toLowerCase().includes(lower)
    );
  }

  async getById(id: string): Promise<Patient | null> {
    const all = await this.getAll();
    return all.find((p) => p.id === id) ?? null;
  }

  async create(input: Omit<Patient, 'id'>): Promise<string> {
    const ref = await addDoc(collection(db, 'patients'), input);
    this.cache = null;
    return ref.id;
  }
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

class MockPatientServiceImpl implements PatientLookupService {
  async listAll(): Promise<Patient[]> {
    return STATIC_PATIENTS;
  }

  async search(q: string): Promise<Patient[]> {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return STATIC_PATIENTS.filter(
      (p: Patient) =>
        p.name.toLowerCase().includes(lower) ||
        p.mrn.toLowerCase().includes(lower)  ||
        p.dob.toLowerCase().includes(lower)
    );
  }

  async getById(id: string): Promise<Patient | null> {
    return STATIC_PATIENTS.find((p: Patient) => p.id === id) ?? null;
  }

  async create(): Promise<string> {
    throw new Error("Mock service cannot persist patients — Firestore unavailable.");
  }
}

// ─── Composite: Firestore with mock fallback ──────────────────────────────────

class CompositePatientService implements PatientLookupService {
  private readonly firestore = new FirestorePatientServiceImpl();
  private readonly mock      = new MockPatientServiceImpl();

  async listAll(): Promise<Patient[]> {
    try {
      const results = await this.firestore.listAll();
      if (results.length > 0) return results;
      return this.mock.listAll();
    } catch {
      return this.mock.listAll();
    }
  }

  async search(q: string): Promise<Patient[]> {
    try {
      const results = await this.firestore.search(q);
      if (results.length > 0) return results;
      return this.mock.search(q);
    } catch {
      return this.mock.search(q);
    }
  }

  async getById(id: string): Promise<Patient | null> {
    try {
      const result = await this.firestore.getById(id);
      if (result) return result;
      return this.mock.getById(id);
    } catch {
      return this.mock.getById(id);
    }
  }

  async create(input: Omit<Patient, 'id'>): Promise<string> {
    return this.firestore.create(input);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const patientService: PatientLookupService = new CompositePatientService();
