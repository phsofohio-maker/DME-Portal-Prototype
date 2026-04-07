/**
 * Playwright global setup — runs once before the entire test suite.
 * Seeds the Firebase Emulator with test data.
 */
import { seedEmulators } from './helpers/seed';

export default async function globalSetup(): Promise<void> {
  console.log('\n[global-setup] Seeding Firebase Emulators...');
  await seedEmulators();
  console.log('[global-setup] Seed complete.\n');
}
