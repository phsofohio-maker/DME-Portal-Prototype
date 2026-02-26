
import React, { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Staff } from '../../types';

interface LayoutProps {
  user: Staff;
  onLogout: () => void;
  children: React.ReactNode;
}

/** HIPAA 164.312(a)(2)(iii) — automatic logoff after 15 minutes of inactivity */
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

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
};

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 15-minute inactivity auto-logout (HIPAA 164.312(a)(2)(iii)) ────────────
  useEffect(() => {
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(onLogout, INACTIVITY_TIMEOUT_MS);
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // start the clock

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, [onLogout]);

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: <Icons.Dashboard /> },
    { label: 'DME Request', path: '/request/dme', icon: <Icons.DME /> },
    { label: 'Meds Request', path: '/request/meds', icon: <Icons.Meds /> },
    { label: 'Multi-Meds', path: '/request/multi-meds', icon: <Icons.MultiMeds /> },
    { label: 'Messaging', path: '/messaging', icon: <Icons.Messaging /> },
    { label: 'Profile', path: '/profile', icon: <Icons.Profile /> },
  ];

  if (user.role === 'admin') {
    menuItems.splice(1, 0, { label: 'Admin Inbox', path: '/admin', icon: <Icons.Inbox /> });
    menuItems.push({ label: 'Team', path: '/admin/team', icon: <Icons.Team /> });
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
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
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
        <button
          onClick={onLogout}
          className="text-sm text-slate-400 flex items-center space-x-1"
        >
          <Icons.Logout />
          <span>Out</span>
        </button>
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
    </div>
  );
};
