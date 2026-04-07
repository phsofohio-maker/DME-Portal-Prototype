/**
 * Seeds the Firebase Emulator with test users and fixture data.
 * Called from global-setup before the Playwright suite runs.
 */
import { USERS, TEST_PASSWORD } from '../fixtures/test-users';
import { PATIENTS, REQUESTS, COMMUNICATIONS } from '../fixtures/seed-data';
import { resetEmulators, createAuthUser, writeFirestoreDoc } from './emulator';

export async function seedEmulators(): Promise<void> {
  // 1. Clear all existing data
  await resetEmulators();

  // 2. Create Auth accounts + Firestore staff docs
  for (const user of Object.values(USERS)) {
    await createAuthUser(user.email, TEST_PASSWORD, user.uid, user.displayName);

    await writeFirestoreDoc('staff', user.uid, {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      hasCompletedOnboarding: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      notificationPrefs: {
        emailOnStatusChange: true,
        emailOnNewMessage: true,
      },
    });
  }

  // 3. Seed patients
  for (const patient of PATIENTS) {
    await writeFirestoreDoc('patients', patient.id, patient);
  }

  // 4. Seed requests
  for (const request of REQUESTS) {
    await writeFirestoreDoc('requests', request.id, request);
  }

  // 5. Seed communications
  for (const msg of COMMUNICATIONS) {
    await writeFirestoreDoc('communications', msg.id, msg);
  }
}
