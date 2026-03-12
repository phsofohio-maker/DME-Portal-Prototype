/**
 * test/setup.ts — Global Vitest setup for unit and component tests.
 *
 * Loaded by vitest.config.ts via `setupFiles`.
 * - Extends expect with @testing-library/jest-dom matchers.
 * - Stubs import.meta.env so modules that read Firebase config at
 *   module load time do not throw in the test environment.
 * - Mocks the firebase service module so no real SDK calls are made.
 */

import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ── Stub Vite env vars ────────────────────────────────────────────────────────
// Modules imported during tests may reference import.meta.env at module scope
// (e.g. services/firebase.ts). Provide safe placeholder values.
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        VITE_FIREBASE_API_KEY: 'test-api-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'demo-test.firebaseapp.com',
        VITE_FIREBASE_PROJECT_ID: 'demo-test',
        VITE_FIREBASE_STORAGE_BUCKET: 'demo-test.appspot.com',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
        VITE_FIREBASE_APP_ID: '1:000000000000:web:000000000000',
      },
    },
  },
  writable: true,
  configurable: true,
});

// ── Mock Firebase SDK ─────────────────────────────────────────────────────────
// Prevents real Firebase initialisation (and network calls) during tests.
// Individual test files may override with vi.mock() for more specific mocks.
vi.mock('../services/firebase', () => ({
  auth: { currentUser: null, onAuthStateChanged: vi.fn(() => () => {}) },
  db: {},
  functions: {},
  messaging: Promise.resolve(null),
}));
