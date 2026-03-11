import { useState, useEffect } from 'react';

/**
 * Tracks the browser's network connectivity state.
 *
 * Returns:
 *   isOnline   — current online/offline state
 *   justReconnected — true for 3 seconds immediately after coming back online,
 *                     used to briefly show a "reconnected" confirmation banner.
 *
 * Firestore offline persistence (persistentLocalCache) automatically queues
 * writes made while offline and syncs them when connectivity is restored —
 * this hook provides the UX signal so users see that behaviour explained.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      reconnectTimer = setTimeout(() => setJustReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return { isOnline, justReconnected };
}
