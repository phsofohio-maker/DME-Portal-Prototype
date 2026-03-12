/**
 * test/rules/infra.test.ts — Firestore Security Rules infrastructure smoke test.
 *
 * Verifies that @firebase/rules-unit-testing is installed and importable.
 * Does NOT connect to the emulator — that happens in Block 2 tests.
 *
 * Run with: npm run test:rules
 * (Requires Firebase Emulator for the full rules test suite.)
 */

import { describe, it, expect } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';

describe('Firestore rules test infra (smoke)', () => {
  it('exports initializeTestEnvironment as a function', () => {
    // Confirm the library is installed and the main API is accessible.
    expect(typeof initializeTestEnvironment).toBe('function');
  });
});
