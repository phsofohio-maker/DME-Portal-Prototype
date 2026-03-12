import React, { useState } from 'react';
import { MultiFactorError, MultiFactorResolver, getMultiFactorResolver } from 'firebase/auth';
import { auth } from '../services/firebase';
import { firebaseService } from '../services/firebaseService';

interface LoginPageProps {
  /** Called when Firebase Auth requires a second factor (MFA challenge). */
  onMFARequired?: (resolver: MultiFactorResolver) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onMFARequired }) => {
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
    } catch (err: unknown) {
      // Firebase throws MultiFactorError when MFA is enrolled
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'auth/multi-factor-auth-required'
      ) {
        const resolver = getMultiFactorResolver(auth, err as MultiFactorError);
        onMFARequired?.(resolver);
      } else {
        setError('Invalid email or password. Please check your credentials and try again.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Parrish Health</h1>
          <p className="text-slate-600 mt-2">Staff DME &amp; Logistics Portal</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="name@parrish.com"
              autoComplete="email"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
              aria-describedby={error ? 'login-error' : undefined}
            />
          </div>

          {error && (
            <div
              id="login-error"
              role="alert"
              className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3"
            >
              {error}
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-all shadow-lg active:scale-95 disabled:opacity-50"
            aria-busy={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
          PARRISH HEALTH SYSTEMS — STAFF PORTAL v2.0
        </div>
      </div>
    </div>
  );
};
