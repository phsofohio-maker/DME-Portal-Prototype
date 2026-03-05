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
  apiKey: "AIzaSyBEMZoWCqesSpCvB29p9MAAc7KSX_DJq5w",
  authDomain: "parrish-dme-portal.firebaseapp.com",
  projectId: "parrish-dme-portal",
  storageBucket: "parrish-dme-portal.firebasestorage.app",
  messagingSenderId: "1017187886488",
  appId: "1:1017187886488:web:63304918011c4b9ad937ed",
  measurementId: "G-FW91NSP8S8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Enable multi-tab offline persistence (HIPAA note: cache is local IndexedDB, not PHI transit)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const functions = getFunctions(app);
