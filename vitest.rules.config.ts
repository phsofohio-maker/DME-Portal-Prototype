/**
 * vitest.rules.config.ts — Firestore Security Rules test configuration.
 *
 * Requires the Firebase Emulator to be running:
 *   npx firebase emulators:start --only firestore
 *
 * Run with: npm run test:rules
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/rules/**/*.test.ts'],
    testTimeout: 30_000, // emulator startup can be slow
    hookTimeout: 30_000,
  },
});
