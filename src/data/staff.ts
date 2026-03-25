import type { Staff } from "../types";

const prefs = { emailOnStatusChange: true, emailOnNewMessage: true };

export const STAFF: Staff[] = [
  { uid: "s1", displayName: "Kobe Reynolds",  email: "kobe@parrish.health",    role: "admin",        status: "active", hasCompletedOnboarding: true, notificationPrefs: prefs },
  { uid: "s2", displayName: "Maria Santos",   email: "maria@parrish.health",   role: "nurse",        status: "active", hasCompletedOnboarding: true, notificationPrefs: prefs },
  { uid: "s3", displayName: "DeShawn Carter", email: "deshawn@parrish.health", role: "homemaker",    status: "active", hasCompletedOnboarding: true, notificationPrefs: prefs },
  { uid: "s4", displayName: "Angela Watts",   email: "angela@parrish.health",  role: "office_staff", status: "active", hasCompletedOnboarding: true, notificationPrefs: prefs },
  { uid: "s5", displayName: "James Okonkwo",  email: "james@parrish.health",   role: "nurse",        status: "active", hasCompletedOnboarding: true, notificationPrefs: prefs },
];
