
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter } from 'react-router-dom';
import { onAuthStateChanged, multiFactor, MultiFactorResolver } from 'firebase/auth';
import { Staff } from './types';
import { auth } from './services/firebase';
import { firebaseService } from './services/firebaseService';
import { Layout } from './components/ui/Layout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AppRoutes } from './components/AppRoutes';

// ─── Eagerly loaded (needed before auth resolves) ─────────────────────────────
import { LoginPage } from './pages/LoginPage';
import { Onboarding } from './components/Auth/Onboarding';
import { MFAChallenge } from './components/Auth/MFAChallenge';
import { MFAEnrollment } from './components/Auth/MFAEnrollment';

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

  // MFA state
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [needsMfaEnrollment, setNeedsMfaEnrollment] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await firebaseService.getStaffProfile(firebaseUser.uid);
        setUser(profile);

        // Check if admin needs MFA enrollment
        if (profile?.role === 'admin') {
          const enrolledFactors = multiFactor(firebaseUser).enrolledFactors;
          if (enrolledFactors.length === 0) {
            setNeedsMfaEnrollment(true);
          }
        }
      } else {
        setUser(null);
        setNeedsMfaEnrollment(false);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogout = useCallback(async () => {
    await firebaseService.logout();
    setMfaResolver(null);
    setNeedsMfaEnrollment(false);
    // onAuthStateChanged fires automatically and sets user → null
  }, []);

  const refreshUser = useCallback(async () => {
    const firebaseUser = auth.currentUser;
    if (firebaseUser) {
      const updated = await firebaseService.getStaffProfile(firebaseUser.uid);
      setUser(updated);
    }
  }, []);

  // ─── MFA Challenge: user has enrolled MFA, needs to complete second factor ──
  const handleMFARequired = useCallback((resolver: MultiFactorResolver) => {
    setMfaResolver(resolver);
  }, []);

  const handleMFAChallengeSuccess = useCallback(() => {
    setMfaResolver(null);
    // onAuthStateChanged will fire and set the user
  }, []);

  const handleMFAChallengeCancel = useCallback(async () => {
    setMfaResolver(null);
    await firebaseService.logout();
  }, []);

  // ─── MFA Enrollment: admin logged in but hasn't set up MFA yet ──────────────
  const handleMFAEnrollmentComplete = useCallback(() => {
    setNeedsMfaEnrollment(false);
  }, []);

  if (authLoading) return <LoadingScreen />;

  // Show MFA challenge screen (second factor required during login)
  if (mfaResolver) {
    return (
      <MFAChallenge
        resolver={mfaResolver}
        onSuccess={handleMFAChallengeSuccess}
        onCancel={handleMFAChallengeCancel}
      />
    );
  }

  if (!user) return <LoginPage onMFARequired={handleMFARequired} />;

  if (!user.hasCompletedOnboarding) {
    return <Onboarding user={user} onComplete={refreshUser} />;
  }

  // Show MFA enrollment for admins who haven't set up MFA yet
  if (needsMfaEnrollment) {
    return (
      <MFAEnrollment
        user={user}
        onComplete={handleMFAEnrollmentComplete}
        onSkip={handleMFAEnrollmentComplete}
      />
    );
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
