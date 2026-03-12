/**
 * AppRoutes.tsx — Route declarations for the authenticated shell.
 *
 * Lives inside <HashRouter> so it can call useNavigate() to perform
 * programmatic navigation after form submissions, replacing the
 * window.location.hash hack that was in App.tsx.
 *
 * All page components are lazily imported so Vite splits them into
 * separate JS chunks — only the current route's chunk is downloaded.
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Staff } from '../types';

// ─── Lazy page/component imports ─────────────────────────────────────────────

const Dashboard           = lazy(() => import('../pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const AdminInbox          = lazy(() => import('../pages/AdminInbox').then((m) => ({ default: m.AdminInbox })));
const ProfilePage         = lazy(() => import('../pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const HelpPage            = lazy(() => import('../pages/HelpPage').then((m) => ({ default: m.HelpPage })));
const GoLivePage          = lazy(() => import('../pages/GoLivePage').then((m) => ({ default: m.GoLivePage })));
const AuditLogPage        = lazy(() => import('../pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })));
const AnalyticsPage       = lazy(() => import('../pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const DMEForm             = lazy(() => import('./Forms/DMEForm').then((m) => ({ default: m.DMEForm })));
const MedicationForm      = lazy(() => import('./Forms/MedicationForm').then((m) => ({ default: m.MedicationForm })));
const MultiMedicationForm = lazy(() => import('./Forms/MultiMedicationForm').then((m) => ({ default: m.MultiMedicationForm })));
const MessagingPortal     = lazy(() => import('./Messaging/MessagingPortal').then((m) => ({ default: m.MessagingPortal })));
const UserManagement      = lazy(() => import('./Admin/UserManagement').then((m) => ({ default: m.UserManagement })));

// ─── Suspense fallback (thin indicator shown while a chunk loads) ─────────────

const RouteFallback: React.FC = () => (
  <div className="flex items-center justify-center py-24" role="status" aria-label="Loading page">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
  </div>
);

// ─── Route tree ───────────────────────────────────────────────────────────────

interface AppRoutesProps {
  user: Staff;
  refreshUser: () => Promise<void>;
}

export const AppRoutes: React.FC<AppRoutesProps> = ({ user, refreshUser }) => {
  const navigate = useNavigate();
  const goHome = () => navigate('/');

  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Dashboard user={user} />} />
        <Route path="/request/dme"        element={<DMEForm user={user} onSuccess={goHome} />} />
        <Route path="/request/meds"       element={<MedicationForm user={user} onSuccess={goHome} />} />
        <Route path="/request/multi-meds" element={<MultiMedicationForm user={user} onSuccess={goHome} />} />
        <Route path="/messaging"          element={<MessagingPortal currentUser={user} />} />
        <Route path="/profile"            element={<ProfilePage user={user} onUpdate={refreshUser} />} />
        <Route path="/help"               element={<HelpPage user={user} />} />
        {user.role === 'admin' && (
          <>
            <Route path="/admin"            element={<AdminInbox user={user} />} />
            <Route path="/admin/team"       element={<UserManagement currentUser={user} />} />
            <Route path="/admin/go-live"    element={<GoLivePage />} />
            <Route path="/admin/audit-log"  element={<AuditLogPage />} />
            <Route path="/admin/analytics"  element={<AnalyticsPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
};
