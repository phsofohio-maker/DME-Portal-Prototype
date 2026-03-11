import React from 'react';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';

/**
 * Displays a full-width status banner when the user is offline or has just
 * reconnected. Firestore's offline persistence queues all writes locally and
 * syncs them automatically on reconnect — this banner surfaces that behaviour.
 */
export const OfflineBanner: React.FC = () => {
  const { isOnline, justReconnected } = useOnlineStatus();

  if (isOnline && !justReconnected) return null;

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="assertive"
        className="w-full bg-amber-500 text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 z-[300]"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        You're offline — changes will sync automatically when you reconnect.
      </div>
    );
  }

  // justReconnected — brief confirmation
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-emerald-600 text-white text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 z-[300]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      Connected — syncing any queued changes…
    </div>
  );
};
