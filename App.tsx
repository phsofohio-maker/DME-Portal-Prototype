
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Staff, Request, Communication } from './types';
import { firebaseService } from './services/firebaseService';
import { Layout } from './components/ui/Layout';
import { DMEForm } from './components/Forms/DMEForm';
import { RequestList } from './components/Dashboard/RequestList';
import { generateAIPrompt } from './services/sourceCode';

// Pages
const LoginPage = ({ onLogin }: { onLogin: (u: Staff) => void }) => {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const user = await firebaseService.login(email, pin);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid credentials or PIN');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Parrish Health</h1>
          <p className="text-slate-500 mt-2">Staff DME & Logistics Portal</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="nurse@parrish.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Security PIN (4-digits)</label>
            <input
              required
              type="password"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500 tracking-[1em] text-center"
              placeholder="••••"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            disabled={loading}
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-400">
          PROTOTYPE BUILD V1.0.0
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user }: { user: Staff }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  
  useEffect(() => {
    setRequests(firebaseService.getRequests().filter(r => r.submitterId === user.uid));
  }, [user.uid]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Welcome back, {user.displayName}</h2>
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
          <p className="text-3xl font-bold text-slate-900 mt-1">{requests.filter(r => r.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Approved Today</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{requests.filter(r => r.status === 'approved').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">Meds Pending</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{requests.filter(r => r.type === 'medication' && r.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm font-medium">System Health</p>
          <p className="text-sm font-bold text-green-500 mt-2 flex items-center">
            <span className="w-2 h-2 rounded-full bg-green-500 mr-2 inline-block animate-pulse"></span>
            Operational
          </p>
        </div>
      </div>

      <RequestList 
        title="Your Recent Submissions" 
        requests={requests} 
      />
    </div>
  );
};

const AdminInbox = ({ user }: { user: Staff }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [selected, setSelected] = useState<Request | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setRequests(firebaseService.getRequests());
  }, []);

  const handleAction = async (status: 'approved' | 'denied') => {
    if (!selected) return;
    await firebaseService.updateRequestStatus(selected.id, status, notes, user.uid);
    setRequests(firebaseService.getRequests());
    setSelected(null);
    setNotes('');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Admin Requests Inbox</h2>
      <RequestList 
        title="All Pending Clinical & DME Requests" 
        requests={requests.filter(r => r.status === 'pending')} 
        onSelect={setSelected}
      />

      {selected && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl">
            <h3 className="text-xl font-bold mb-4">Process Request #{selected.id}</h3>
            <div className="space-y-4 mb-6 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Patient:</span>
                <span className="font-bold">{selected.patientName} ({selected.patientId})</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Submitter:</span>
                <span className="font-bold">{selected.submitterName}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-slate-500 mb-1">Details:</p>
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(selected.details, null, 2)}</pre>
              </div>
            </div>
            
            <label className="block text-sm font-medium mb-1">Internal Admin Notes</label>
            <textarea
              className="w-full p-3 border rounded-lg mb-6 outline-none focus:ring-2 focus:ring-blue-500 h-24"
              placeholder="Enter reason for approval or denial..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />

            <div className="flex gap-4">
              <button 
                onClick={() => handleAction('denied')}
                className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors"
              >
                Deny
              </button>
              <button 
                onClick={() => handleAction('approved')}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
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

const ProfilePage = ({ user }: { user: Staff }) => {
  const [showExport, setShowExport] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const code = generateAIPrompt();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="bg-white p-6 rounded-xl border">
        <h2 className="text-xl font-bold mb-6">User Profile</h2>
        <div className="space-y-4">
          <div className="flex justify-between py-2 border-b">
            <span className="text-slate-500">Name</span>
            <span className="font-bold">{user.displayName}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-slate-500">Email</span>
            <span className="font-bold">{user.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b">
            <span className="text-slate-500">Role</span>
            <span className="font-bold capitalize">{user.role}</span>
          </div>
          <button className="w-full mt-6 py-3 border border-slate-300 rounded-lg font-bold hover:bg-slate-50 transition-colors">
            Update Security PIN
          </button>
        </div>
      </div>

      <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-700">
        <div className="flex items-center space-x-2 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          <h3 className="font-bold">Developer Tools</h3>
        </div>
        <p className="text-sm text-slate-400 mb-6">Sync this prototype with another AI by exporting the full project source.</p>
        
        <button 
          onClick={() => setShowExport(true)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-colors shadow-lg shadow-blue-900/20"
        >
          Generate AI-Ready Export
        </button>

        {showExport && (
          <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center p-4 z-[100]">
            <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden shadow-2xl">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Project Snapshot for Claude / AI</h3>
                  <p className="text-xs text-slate-500">Formatted Markdown Project Structure</p>
                </div>
                <button onClick={() => setShowExport(false)} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
              </div>
              <div className="flex-1 p-6 overflow-y-auto bg-slate-100">
                <pre className="text-[11px] font-mono whitespace-pre-wrap text-slate-800 bg-white p-4 rounded-lg border border-slate-200">
                  {generateAIPrompt()}
                </pre>
              </div>
              <div className="p-4 border-t bg-slate-50 flex gap-4">
                <button 
                  onClick={handleCopy}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all ${copied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {copied ? 'Successfully Copied!' : 'Copy Code for AI'}
                </button>
                <button 
                  onClick={() => setShowExport(false)}
                  className="px-8 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<Staff | null>(firebaseService.getCurrentUser());

  const handleLogout = () => {
    firebaseService.logout();
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLogin={setUser} />;
  }

  return (
    <HashRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard user={user} />} />
          <Route path="/request/dme" element={<DMEForm user={user} onSuccess={() => window.location.hash = '/'} />} />
          <Route path="/request/meds" element={
            <div className="bg-white p-8 rounded-xl border text-center">
              <div className="mb-4 flex justify-center text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Medication Refill Request</h3>
              <p className="text-slate-500 mb-6">Pharmacy intake form for prescription refill synchronization.</p>
              <button onClick={() => window.location.hash = '/'} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Return to Dashboard</button>
            </div>
          } />
          <Route path="/messaging" element={
            <div className="bg-white p-8 rounded-xl border text-center">
              <div className="mb-4 flex justify-center text-blue-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </div>
              <h3 className="text-xl font-bold mb-2">Secure Staff Messaging</h3>
              <p className="text-slate-500 mb-6">HIPAA-compliant coordination channel for clinical updates.</p>
              <button onClick={() => window.location.hash = '/'} className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold">Return to Dashboard</button>
            </div>
          } />
          <Route path="/profile" element={<ProfilePage user={user} />} />
          {user.role === 'admin' && <Route path="/admin" element={<AdminInbox user={user} />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
}
