
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Staff, Request, NotificationPrefs } from './types';
import { auth } from './services/firebase';
import { firebaseService } from './services/firebaseService';
import { Layout } from './components/ui/Layout';
import { DMEForm } from './components/Forms/DMEForm';
import { MedicationForm } from './components/Forms/MedicationForm';
import { MultiMedicationForm } from './components/Forms/MultiMedicationForm';
import { UserManagement } from './components/Admin/UserManagement';
import { Onboarding } from './components/Auth/Onboarding';
import { MessagingPortal } from './components/Messaging/MessagingPortal';
import { RequestList } from './components/Dashboard/RequestList';

// ─── Loading Screen ───────────────────────────────────────────────────────────

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-900">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-slate-400 text-sm font-medium">Loading Parrish Portal…</p>
    </div>
  </div>
);

// ─── Login Page ───────────────────────────────────────────────────────────────

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await firebaseService.login(email, password);
      // onAuthStateChanged in App handles setting the user state
    } catch {
      setError('Invalid email or password. Please check your credentials and try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Parrish Health</h1>
          <p className="text-slate-500 mt-2">Staff DME &amp; Logistics Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@parrish.com"
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
          PARRISH HEALTH SYSTEMS — STAFF PORTAL v1.1
        </div>
      </div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const Dashboard = ({ user }: { user: Staff }) => {
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToUserRequests(user.uid, setRequests);
    return unsubscribe;
  }, [user.uid]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Welcome back, {user.displayName}
          </h2>
          <p className="text-slate-500">Here are your active supply and logistics requests.</p>
        </div>
        <div className="hidden md:block">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 text-sm font-medium">
            Role: <span className="capitalize font-bold">{user.role}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Active Requests</p>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {requests.filter((r) => r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Approved</p>
          <p className="text-3xl font-bold text-green-600 mt-1">
            {requests.filter((r) => r.status === 'approved').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Meds Pending</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">
            {requests.filter((r) => r.type === 'medication' && r.status === 'pending').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">System Health</p>
          <p className="text-sm font-bold text-green-500 mt-2 flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 inline-block animate-pulse" />
            Operational
          </p>
        </div>
      </div>

      <RequestList title="Your Recent Submissions" requests={requests} />
    </div>
  );
};

// ─── Admin Inbox ──────────────────────────────────────────────────────────────

const AdminInbox = ({ user }: { user: Staff }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [selected, setSelected] = useState<Request | null>(null);
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToAllRequests(setRequests);
    return unsubscribe;
  }, []);

  const handleAction = async (status: 'approved' | 'denied') => {
    if (!selected) return;
    setProcessing(true);
    await firebaseService.updateRequestStatus(selected.id, status, notes, user.uid);
    setSelected(null);
    setNotes('');
    setProcessing(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Admin Requests Inbox</h2>
      <RequestList
        title="All Pending Clinical &amp; DME Requests"
        requests={requests.filter((r) => r.status === 'pending')}
        onSelect={setSelected}
      />

      {selected && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[300]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-4">Process Request #{selected.id}</h3>
            <div className="space-y-4 mb-6 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Patient:</span>
                <span className="font-bold">
                  {selected.patientName} ({selected.patientId})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Submitter:</span>
                <span className="font-bold">{selected.submitterName}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-slate-500 mb-1">Details:</p>
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
            </div>

            <label className="block text-sm font-medium mb-1">Internal Admin Notes</label>
            <textarea
              className="w-full p-3 border rounded-lg mb-6 outline-none focus:ring-2 focus:ring-blue-500 h-24"
              placeholder="Enter reason for approval or denial…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            <div className="flex gap-4">
              <button
                disabled={processing}
                onClick={() => handleAction('denied')}
                className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Deny
              </button>
              <button
                disabled={processing}
                onClick={() => handleAction('approved')}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Approve
              </button>
              <button
                onClick={() => setSelected(null)}
                className="px-6 py-3 bg-slate-200 rounded-xl font-bold hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Profile Page ─────────────────────────────────────────────────────────────

const ProfilePage = ({ user, onUpdate }: { user: Staff; onUpdate: () => void }) => {
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    user.notificationPrefs ?? { emailOnStatusChange: true, emailOnNewMessage: true }
  );

  const updatePrefs = async (newPrefs: Partial<NotificationPrefs>) => {
    const updated = { ...prefs, ...newPrefs };
    setPrefs(updated);
    setSavingPrefs(true);
    await firebaseService.updateNotificationPrefs(user.uid, updated);
    setSavingPrefs(false);
    onUpdate();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <h2 className="text-xl font-bold mb-6 serif">User Profile</h2>
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-500 text-sm">Name</span>
            <span className="font-bold text-slate-800">{user.displayName}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-500 text-sm">Email</span>
            <span className="font-bold text-slate-800">{user.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-50">
            <span className="text-slate-500 text-sm">Role</span>
            <span className="font-bold capitalize text-blue-600 text-[10px] px-2 py-0.5 bg-blue-50 rounded">
              {user.role.replace('_', ' ')}
            </span>
          </div>
          {user.department && (
            <div className="flex justify-between py-2 border-b border-slate-50">
              <span className="text-slate-500 text-sm">Department</span>
              <span className="font-bold text-slate-800">{user.department}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 serif">Email Notifications</h3>
            <p className="text-xs text-slate-500">Manage when you receive external alerts.</p>
          </div>
          {savingPrefs && (
            <div className="ml-auto text-[10px] text-blue-500 font-bold animate-pulse">
              Saving…
            </div>
          )}
        </div>

        <div className="space-y-4">
          {[
            {
              key: 'emailOnStatusChange' as const,
              label: 'Request Updates',
              desc: 'Notify me when an admin approves or denies a request.',
            },
            {
              key: 'emailOnNewMessage' as const,
              label: 'Direct Messages',
              desc: 'Notify me when a colleague sends a new secure message.',
            },
          ].map(({ key, label, desc }) => (
            <div
              key={key}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="text-sm font-bold text-slate-800">{label}</p>
                <p className="text-[11px] text-slate-500">{desc}</p>
              </div>
              <button
                onClick={() => updatePrefs({ [key]: !prefs[key] })}
                className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 ease-in-out flex items-center ${
                  prefs[key] ? 'bg-green-500' : 'bg-slate-200'
                }`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform duration-200 ${
                    prefs[key] ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
      </Layout>
    </HashRouter>
  );
}
