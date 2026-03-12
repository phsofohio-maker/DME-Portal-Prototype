/**
 * vitest.functions.config.ts — Cloud Function integration test configuration.
 *
 * Tests the Cloud Function handlers in functions/src/index.ts with mocked
 * Firebase Admin SDK and SendGrid.  All external dependencies are vi.mock()'d
 * so no emulator or network access is required.
 *
 * Run with: npm run test:functions
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/functions/**/*.test.ts'],
    testTimeout: 15_000,
  },
});
