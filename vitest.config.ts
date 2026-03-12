/**
 * vitest.config.ts — Unit and component test configuration.
 *
 * Runs all tests under test/unit/ and test/smoke/.
 * Does NOT include test/rules/ — those require the Firebase Emulator
 * and run via `npm run test:rules` (vitest.rules.config.ts).
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    globals: true,
    include: [
      'test/unit/**/*.test.{ts,tsx}',
      'test/smoke/**/*.test.{ts,tsx}',
    ],
    exclude: ['test/rules/**', 'node_modules/**', 'functions/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**', 'components/**', 'pages/**'],
      exclude: ['services/firebase.ts', '**/*.d.ts', 'node_modules/**'],
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
