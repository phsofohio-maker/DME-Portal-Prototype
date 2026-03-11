
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Staff } from './types';
import { auth } from './services/firebase';
import { firebaseService } from './services/firebaseService';
import { Layout } from './components/ui/Layout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

// ─── Eagerly loaded (needed before auth resolves) ─────────────────────────────
import { LoginPage } from './pages/LoginPage';
import { Onboarding } from './components/Auth/Onboarding';

// ─── Lazily loaded routes — split into separate chunks by Vite ───────────────
// Each import() boundary becomes its own JS chunk that is only downloaded
// when the user navigates to that route.

const Dashboard          = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const AdminInbox         = lazy(() => import('./pages/AdminInbox').then((m) => ({ default: m.AdminInbox })));
const ProfilePage        = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const HelpPage           = lazy(() => import('./pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const GoLivePage         = lazy(() => import('./pages/GoLivePage').then((m) => ({ default: m.GoLivePage })));
const AuditLogPage       = lazy(() => import('./pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const AnalyticsPage      = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const DMEForm            = lazy(() => import('./components/Forms/DMEForm').then((m) => ({ default: m.DMEForm })));
const MedicationForm     = lazy(() => import('./components/Forms/MedicationForm').then((m) => ({ default: m.MedicationForm })));
const MultiMedicationForm = lazy(() => import('./components/Forms/MultiMedicationForm').then((m) => ({ default: m.MultiMedicationForm })));
const MessagingPortal    = lazy(() => import('./components/Messaging/MessagingPortal').then((m) => ({ default: m.MessagingPortal })));
const UserManagement     = lazy(() => import('./components/Admin/UserManagement').then((m) => ({ default: m.UserManagement })));

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

// ─── Route suspense fallback (thin spinner — not full-page) ──────────────────

const RouteFallback = () => (
  <div className="flex items-center justify-center py-24" role="status" aria-label="Loading page">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
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
          <Suspense fallback={<RouteFallback />}>
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
              <Route path="/help" element={<HelpPage user={user} />} />
              {user.role === 'admin' && (
                <>
                  <Route path="/admin" element={<AdminInbox user={user} />} />
                  <Route
                    path="/admin/team"
                    element={<UserManagement currentUser={user} />}
                  />
                  <Route path="/admin/go-live" element={<GoLivePage />} />
                  <Route path="/admin/audit-log" element={<AuditLogPage />} />
                  <Route path="/admin/analytics" element={<AnalyticsPage />} />
                </>
              )}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Layout>
    </HashRouter>
  );
}
