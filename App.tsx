
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Staff } from './types';
import { auth } from './services/firebase';
import { firebaseService } from './services/firebaseService';
import { Layout } from './components/ui/Layout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { DMEForm } from './components/Forms/DMEForm';
import { MedicationForm } from './components/Forms/MedicationForm';
import { MultiMedicationForm } from './components/Forms/MultiMedicationForm';
import { UserManagement } from './components/Admin/UserManagement';
import { Onboarding } from './components/Auth/Onboarding';
import { MessagingPortal } from './components/Messaging/MessagingPortal';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { AdminInbox } from './pages/AdminInbox';
import { ProfilePage } from './pages/ProfilePage';

// ─── Loading Screen ───────────────────────────────────────────────────────────

const LoadingScreen = () => (
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
          <Routes>
            <Route path="/" element={<Dashboard user={user} />} />
            <Route
              path="/request/dme"
              element={
                <DMEForm user={user} onSuccess={() => (window.location.hash = '/')} />
              }
            />
            <Route
              path="/request/meds"
              element={
                <MedicationForm user={user} onSuccess={() => (window.location.hash = '/')} />
              }
            />
            <Route
              path="/request/multi-meds"
              element={
                <MultiMedicationForm
                  user={user}
                  onSuccess={() => (window.location.hash = '/')}
                />
              }
            />
            <Route path="/messaging" element={<MessagingPortal currentUser={user} />} />
            <Route
              path="/profile"
              element={<ProfilePage user={user} onUpdate={refreshUser} />}
            />
            {user.role === 'admin' && (
              <>
                <Route path="/admin" element={<AdminInbox user={user} />} />
                <Route
                  path="/admin/team"
                  element={<UserManagement currentUser={user} />}
                />
              </>
            )}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </ErrorBoundary>
      </Layout>
    </HashRouter>
  );
}
