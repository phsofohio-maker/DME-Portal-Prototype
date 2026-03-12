/**
 * firebase-messaging-sw.js — Firebase Cloud Messaging service worker.
 *
 * Handles background push notifications when the portal tab is not in focus.
 * Firebase config is posted from the main thread after service worker
 * registration (avoids hard-coding secrets in a public file).
 *
 * Compatible with Firebase 12.x compat CDN builds.
 */

importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

let messaging = null;

// Main thread posts FIREBASE_CONFIG after registering this worker.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'FIREBASE_CONFIG') return;

  // Guard against duplicate initialisation on page reload.
  if (firebase.apps.length === 0) {
    firebase.initializeApp(event.data.config);
  }

  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title ?? 'Parrish Portal';
    const body  = payload.notification?.body  ?? 'You have a new notification.';

    self.registration.showNotification(title, {
      body,
      icon:  '/favicon.ico',
      badge: '/favicon.ico',
      data:  payload.data ?? {},
    });
  });
});

// Handle notification click — focus the portal tab or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(self.location.origin);
      })
  );
});
