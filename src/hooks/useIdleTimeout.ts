/**
 * useIdleTimeout.ts — HIPAA §164.312(a)(2)(iii) automatic logoff.
 *
 * Monitors user activity (mouse, keyboard, touch, scroll) and fires
 * a warning callback before auto-logout. Default: 15 min timeout,
 * warning at 13 min.
 */

import { useEffect, useRef, useCallback, useState } from "react";

const TIMEOUT_MS  = 15 * 60 * 1000; // 15 minutes
const WARNING_MS  = 13 * 60 * 1000; // 13 minutes (warn 2 min before)
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  "mousemove", "keydown", "click", "scroll", "touchstart",
];

interface UseIdleTimeoutOptions {
  onTimeout: () => void;
  enabled?: boolean;
}

export function useIdleTimeout({ onTimeout, enabled = true }: UseIdleTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeoutRef    = useRef(onTimeout);
  onTimeoutRef.current  = onTimeout;

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) { clearTimeout(warningTimerRef.current); warningTimerRef.current = null; }
    if (timeoutTimerRef.current) { clearTimeout(timeoutTimerRef.current); timeoutTimerRef.current = null; }
    if (countdownRef.current)    { clearInterval(countdownRef.current);   countdownRef.current = null; }
  }, []);

  const resetTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setRemainingSeconds(120);

    if (!enabled) return;

    // Warning fires at 13 minutes
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(120);

      // Countdown every second
      let secsLeft = 120;
      countdownRef.current = setInterval(() => {
        secsLeft -= 1;
        setRemainingSeconds(secsLeft);
        if (secsLeft <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);
    }, WARNING_MS);

    // Actual timeout at 15 minutes
    timeoutTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      onTimeoutRef.current();
    }, TIMEOUT_MS);
  }, [enabled, clearAllTimers]);

  // Activity listener
  useEffect(() => {
    if (!enabled) return;

    resetTimers();

    function handleActivity() {
      resetTimers();
    }

    for (const evt of ACTIVITY_EVENTS) {
      document.addEventListener(evt, handleActivity, { passive: true });
    }

    return () => {
      clearAllTimers();
      for (const evt of ACTIVITY_EVENTS) {
        document.removeEventListener(evt, handleActivity);
      }
    };
  }, [enabled, resetTimers, clearAllTimers]);

  const stayLoggedIn = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return { showWarning, remainingSeconds, stayLoggedIn };
}
