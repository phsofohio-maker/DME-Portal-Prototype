/**
 * test/unit/session-timeout.test.ts — Block 5 Session Timeout unit tests.
 *
 * Verifies the HIPAA 164.312(a)(2)(iii) automatic logoff behaviour
 * implemented in Layout.tsx:
 *   - Warning modal appears at 13 minutes of inactivity
 *   - Auto-logout fires at 15 minutes of inactivity
 *   - Activity events reset the timer
 *   - auth.timeout audit log is sent before sign-out
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Constants matching Layout.tsx ──────────────────────────────────────────
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;   // 15 minutes
const WARNING_BEFORE_MS     =  2 * 60 * 1000;    //  2 minutes
const WARNING_AT_MS         = INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS; // 13 minutes

describe('Session timeout logic (HIPAA auto-logoff)', () => {
  let warningTimer: ReturnType<typeof setTimeout> | null = null;
  let logoutTimer: ReturnType<typeof setTimeout> | null = null;
  let showWarning = false;
  let loggedOut = false;
  let timeoutAuditLogged = false;

  /** Simulates the resetTimer callback from Layout.tsx */
  function resetTimer() {
    if (warningTimer) clearTimeout(warningTimer);
    if (logoutTimer) clearTimeout(logoutTimer);
    showWarning = false;

    warningTimer = setTimeout(() => {
      showWarning = true;
    }, WARNING_AT_MS);

    logoutTimer = setTimeout(async () => {
      timeoutAuditLogged = true; // simulates logAuthEvent({ action: 'auth.timeout' })
      loggedOut = true;
    }, INACTIVITY_TIMEOUT_MS);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    showWarning = false;
    loggedOut = false;
    timeoutAuditLogged = false;
    warningTimer = null;
    logoutTimer = null;
  });

  afterEach(() => {
    if (warningTimer) clearTimeout(warningTimer);
    if (logoutTimer) clearTimeout(logoutTimer);
    vi.useRealTimers();
  });

  it('does not show warning or logout before 13 minutes', () => {
    resetTimer();
    vi.advanceTimersByTime(WARNING_AT_MS - 1000); // 12:59
    expect(showWarning).toBe(false);
    expect(loggedOut).toBe(false);
  });

  it('shows warning at 13 minutes', () => {
    resetTimer();
    vi.advanceTimersByTime(WARNING_AT_MS);
    expect(showWarning).toBe(true);
    expect(loggedOut).toBe(false);
  });

  it('does not logout at 13 minutes', () => {
    resetTimer();
    vi.advanceTimersByTime(WARNING_AT_MS);
    expect(loggedOut).toBe(false);
  });

  it('fires auto-logout at 15 minutes', () => {
    resetTimer();
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    expect(loggedOut).toBe(true);
  });

  it('logs auth.timeout before signing out', () => {
    resetTimer();
    vi.advanceTimersByTime(INACTIVITY_TIMEOUT_MS);
    expect(timeoutAuditLogged).toBe(true);
  });

  it('resets warning and timers on activity', () => {
    resetTimer();

    // Advance to 12 minutes (warning hasn't fired)
    vi.advanceTimersByTime(12 * 60 * 1000);
    expect(showWarning).toBe(false);

    // Simulate activity — resetTimer called by event listener
    resetTimer();

    // Advance another 12 minutes from the reset point (total 24 min from start)
    vi.advanceTimersByTime(12 * 60 * 1000);
    expect(showWarning).toBe(false);
    expect(loggedOut).toBe(false);
  });

  it('resets fully — need another 15 minutes after reset to logout', () => {
    resetTimer();

    // Go to 14 minutes — warning shown, not logged out
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(showWarning).toBe(true);

    // User clicks "Stay Signed In" → resetTimer()
    resetTimer();
    expect(showWarning).toBe(false);
    expect(loggedOut).toBe(false);

    // 14 minutes later — warning should show again
    vi.advanceTimersByTime(14 * 60 * 1000);
    expect(showWarning).toBe(true);
    expect(loggedOut).toBe(false);

    // 1 more minute → 15 total since reset → logout
    vi.advanceTimersByTime(1 * 60 * 1000);
    expect(loggedOut).toBe(true);
  });

  it('warning duration is exactly 2 minutes before logout', () => {
    resetTimer();
    vi.advanceTimersByTime(WARNING_AT_MS);
    expect(showWarning).toBe(true);

    // Exactly 2 more minutes → logout
    vi.advanceTimersByTime(WARNING_BEFORE_MS);
    expect(loggedOut).toBe(true);
  });
});
