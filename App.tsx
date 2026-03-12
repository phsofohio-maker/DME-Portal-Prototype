
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Staff } from './types';
import { auth } from './services/firebase';
import { firebaseService } from './services/firebaseService';
import { Layout } from './components/ui/Layout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AppRoutes } from './components/AppRoutes';

// ─── Eagerly loaded (needed before auth resolves) ─────────────────────────────
import { LoginPage } from './pages/LoginPage';
import { Onboarding } from './components/Auth/Onboarding';

// ─── Full-page loading screen (shown while Firebase resolves auth state) ──────

const LoadingScreen: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900" role="status" aria-label="Loading">
    <div className="text-center">
      <div
        className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"
        aria-hidden="true"
      />
      <p className="text-slate-400 text-sm font-medium">Loading Parrish Portal…</p>
    </div>
  </div>
);

// ─── App Root ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState<Staff | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await firebaseService.getStaffProfile(firebaseUser.uid);
        setUser(profile);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogout = useCallback(async () => {
    await firebaseService.logout();
    // onAuthStateChanged fires automatically and sets user → null
  }, []);

  const refreshUser = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const updated = await firebaseService.getStaffProfile(firebaseUser.uid);
      setUser(updated);
    }
  }, []);

  if (authLoading) return <LoadingScreen />;
  if (!user) return <LoginPage />;
  if (!user.hasCompletedOnboarding) {
    return <Onboarding user={user} onComplete={refreshUser} />;
  }

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <ErrorBoundary>
          <AppRoutes user={user} refreshUser={refreshUser} />
        </ErrorBoundary>
      </Layout>
    </HashRouter>
  );
}
