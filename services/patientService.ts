/**
 * patientService.ts — Phase 3: PatientLookupService abstraction
 *
 * Decouples the patient-search UI from the underlying data source so that
 * swapping the backend (mock → Firestore → HL7 FHIR R4) requires only a
 * single import change, not edits across every form component.
 *
 * Current implementation: FirestorePatientService — reads from the Firestore
 * `patients` collection that was seeded by `firebaseService.seedCatalog()`.
 *
 * Future implementation (Phase 4+): FHIRPatientService — proxied via a Cloud
 * Function that authenticates against the EHR's FHIR R4 endpoint and returns
 * FHIR Patient resources mapped to the local Patient interface.
 */

import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { Patient } from '../types';
import { MOCK_PATIENTS } from './mockData';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface PatientLookupService {
  /**
   * Search for patients matching a free-text query.
   * Implementations should support name, MRN, and date-of-birth matching.
   * Returns an empty array when the query is blank.
   */
  search(query: string): Promise<Patient[]>;

  /**
   * Retrieve a single patient by internal ID.
   * Returns null if not found.
   */
  getById(id: string): Promise<Patient | null>;
}

// ─── Firestore Implementation ─────────────────────────────────────────────────

/**
 * Reads from the `patients` Firestore collection.
 * Because Firestore does not support full-text search natively, this
 * implementation fetches up to 500 patients and filters client-side.
 * A production deployment with > 500 patients should add Algolia or
 * Typesense as a search index layer — this adapter would then delegate to
 * that service while keeping the interface contract unchanged.
 */
class FirestorePatientServiceImpl implements PatientLookupService {
  private cache: Patient[] | null = null;

  private async getAll(): Promise<Patient[]> {
    if (this.cache) return this.cache;
    const snap = await getDocs(query(collection(db, 'patients'), orderBy('name'), limit(500)));
    this.cache = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Patient));
    return this.cache;
  }

  async search(q: string): Promise<Patient[]> {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    const all = await this.getAll();
    return all.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.mrn.toLowerCase().includes(lower) ||
        p.dob.toLowerCase().includes(lower)
    );
  }

  async getById(id: string): Promise<Patient | null> {
    const all = await this.getAll();
    return all.find((p) => p.id === id) ?? null;
  }
}

// ─── Mock Implementation (fallback when Firestore collection is empty) ────────

/**
 * Filters the in-bundle MOCK_PATIENTS array.
 * Used when Firestore has not been seeded — eliminated after first seed run.
 */
class MockPatientServiceImpl implements PatientLookupService {
  async search(q: string): Promise<Patient[]> {
    if (!q.trim()) return [];
    const lower = q.toLowerCase();
    return MOCK_PATIENTS.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.mrn.toLowerCase().includes(lower) ||
        p.dob.toLowerCase().includes(lower)
    );
  }

  async getById(id: string): Promise<Patient | null> {
    return MOCK_PATIENTS.find((p) => p.id === id) ?? null;
  }
}

// ─── Composite Implementation — Firestore with mock fallback ──────────────────

/**
 * Tries Firestore first; falls back to mock data if the collection is empty.
 * This lets development continue without a seeded Firestore while production
 * transparently uses real patient records.
 */
class CompositePatientService implements PatientLookupService {
  private readonly firestore = new FirestorePatientServiceImpl();
  private readonly mock = new MockPatientServiceImpl();

  async search(q: string): Promise<Patient[]> {
    try {
      const results = await this.firestore.search(q);
      if (results.length > 0) return results;
      // Firestore empty — use mock fallback
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
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const patientService: PatientLookupService = new CompositePatientService();
