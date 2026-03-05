/**
 * Firebase app initialisation.
 *
 * All env vars are injected by Vite at build time from .env.local.
 * Copy .env.local.example → .env.local and fill in your Firebase project
 * values before running `npm run dev` or `npm run build`.
 *
 * IMPORTANT (HIPAA): ensure the Google Cloud BAA is signed for your project
 * before storing any Protected Health Information (PHI).
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Enable multi-tab offline persistence (HIPAA note: cache is local IndexedDB, not PHI transit)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const functions = getFunctions(app);
