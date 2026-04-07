/**
 * Test user accounts for E2E tests against the Firebase Emulator.
 * One user per role, plus a pre-suspended user for negative tests.
 * All passwords are the same for simplicity in test fixtures.
 */
export const TEST_PASSWORD = 'Parrish2024!';

export interface TestUser {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'nurse' | 'homemaker' | 'office_staff';
  status: 'active' | 'suspended';
}

export const USERS: Record<string, TestUser> = {
  admin: {
    uid: 'test-admin-uid',
    email: 'kobe@parrish.health',
    displayName: 'Kobe Reynolds',
    role: 'admin',
    status: 'active',
  },
  nurse: {
    uid: 'test-nurse-uid',
    email: 'maria@parrish.health',
    displayName: 'Maria Santos',
    role: 'nurse',
    status: 'active',
  },
  homemaker: {
    uid: 'test-homemaker-uid',
    email: 'deshawn@parrish.health',
    displayName: 'DeShawn Carter',
    role: 'homemaker',
    status: 'active',
  },
  office_staff: {
    uid: 'test-officestaff-uid',
    email: 'angela@parrish.health',
    displayName: 'Angela Watts',
    role: 'office_staff',
    status: 'active',
  },
  suspended: {
    uid: 'test-suspended-uid',
    email: 'suspended@parrish.health',
    displayName: 'Suspended User',
    role: 'nurse',
    status: 'suspended',
  },
};
