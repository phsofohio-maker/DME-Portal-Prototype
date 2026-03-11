
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Staff } from '../../types';
import { NotificationBell } from '../Notifications/NotificationBell';

interface LayoutProps {
  user: Staff;
  onLogout: () => void;
  children: React.ReactNode;
}

/** HIPAA 164.312(a)(2)(iii) — automatic logoff after 15 minutes of inactivity */
const INACTIVITY_TIMEOUT_MS  = 15 * 60 * 1000;
/** Show a warning modal 2 minutes before auto-logout */
const WARNING_BEFORE_MS      =  2 * 60 * 1000;

const Icons = {
  Dashboard: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/>
      <rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
    </svg>
  ),
  DME: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 16h6"/><path d="M19 13v6"/>
      <rect width="20" height="14" x="2" y="6" rx="2"/>
      <path d="M7 15h.01"/><path d="M11 15h.01"/>
    </svg>
  ),
  Meds: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/>
      <path d="m8.5 8.5 7 7"/>
    </svg>
  ),
  MultiMeds: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 3h5v5M8 3H3v5M3 16v5h5M21 16v5h-5M7 12h10M12 7v10"/>
    </svg>
  ),
  Messaging: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Profile: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  Team: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  Inbox: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
  Logout: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" x2="9" y1="12" y2="12"/>
    </svg>
  ),
  Help: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <path d="M12 17h.01"/>
    </svg>
  ),
  GoLive: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  ),
  AuditLog: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  Analytics: () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
};

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const logoutTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);

  // ── 15-minute inactivity auto-logout (HIPAA 164.312(a)(2)(iii)) ────────────
  // Warning modal appears 2 minutes before auto-logout fires.
  const resetTimer = useCallback(() => {
    if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    setShowTimeoutWarning(false);

    warningTimerRef.current = setTimeout(
      () => setShowTimeoutWarning(true),
      INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS
    );
    logoutTimerRef.current = setTimeout(onLogout, INACTIVITY_TIMEOUT_MS);
  }, [onLogout]);

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the clock

    return () => {
      if (logoutTimerRef.current)  clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [resetTimer]);

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: <Icons.Dashboard /> },
    { label: 'DME Request', path: '/request/dme', icon: <Icons.DME /> },
    { label: 'Meds Request', path: '/request/meds', icon: <Icons.Meds /> },
    { label: 'Multi-Meds', path: '/request/multi-meds', icon: <Icons.MultiMeds /> },
    { label: 'Messaging', path: '/messaging', icon: <Icons.Messaging /> },
    { label: 'Profile', path: '/profile', icon: <Icons.Profile /> },
    { label: 'Help', path: '/help', icon: <Icons.Help /> },
  ];

  if (user.role === 'admin') {
    menuItems.splice(1, 0, { label: 'Admin Inbox', path: '/admin', icon: <Icons.Inbox /> });
    menuItems.push({ label: 'Team', path: '/admin/team', icon: <Icons.Team /> });
    menuItems.push({ label: 'Audit Log', path: '/admin/audit-log', icon: <Icons.AuditLog /> });
    menuItems.push({ label: 'Analytics', path: '/admin/analytics', icon: <Icons.Analytics /> });
    menuItems.push({ label: 'Go-Live', path: '/admin/go-live', icon: <Icons.GoLive /> });
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Sidebar — Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white p-6 sticky top-0 h-screen overflow-y-auto">
        <div className="mb-8">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">Parrish Health</h1>
          <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold">
            DME Portal
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold shrink-0">
              {user.displayName.charAt(0)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <NotificationBell uid={user.uid} />
          </div>
          <button
            onClick={onLogout}
            className="w-full text-left text-sm text-slate-400 hover:text-red-400 flex items-center space-x-2 transition-colors"
          >
            <Icons.Logout />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Header — Mobile */}
      <header className="md:hidden bg-slate-900 text-white p-4 sticky top-0 z-[200] flex justify-between items-center">
        <h1 className="font-bold text-blue-400">Parrish Portal</h1>
        <div className="flex items-center gap-2">
          <NotificationBell uid={user.uid} />
          <button
            onClick={onLogout}
            className="text-sm text-slate-400 flex items-center space-x-1"
          >
            <Icons.Logout />
            <span>Out</span>
          </button>
        </div>
      </header>

      {/* Bottom Nav — Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around p-2 z-[200] overflow-x-auto">
        {menuItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center p-2 rounded-lg min-w-[60px] ${
              location.pathname === item.path ? 'text-blue-600' : 'text-slate-500'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-[9px] mt-1 font-medium whitespace-nowrap">{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="flex-1 p-4 md:p-8 mb-20 md:mb-0 max-w-5xl mx-auto w-full">
        {children}
      </main>

      {/* ── Session timeout warning modal ── */}
      {showTimeoutWarning && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="timeout-warning-title"
          aria-describedby="timeout-warning-desc"
          className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-[600]"
        >
          <div className="bg-white rounded-2xl p-7 w-full max-w-sm shadow-2xl text-center">
            <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
              </svg>
            </div>
            <h2 id="timeout-warning-title" className="text-lg font-bold text-slate-900 mb-2">
              Session Expiring Soon
            </h2>
            <p id="timeout-warning-desc" className="text-sm text-slate-500 mb-6">
              For HIPAA compliance, your session will automatically end in{' '}
              <strong>2 minutes</strong> due to inactivity. Click below to stay signed in.
            </p>
            <div className="flex gap-3">
              <button
                onClick={onLogout}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Sign Out Now
              </button>
              <button
                onClick={resetTimer}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
              >
                Stay Signed In
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
