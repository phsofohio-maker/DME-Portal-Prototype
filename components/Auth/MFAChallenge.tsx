/**
 * components/Auth/MFAChallenge.tsx — Block 6: Admin TOTP MFA Challenge
 *
 * Shown when a user with enrolled TOTP MFA signs in. Firebase Auth throws
 * a MultiFactorError on signInWithEmailAndPassword; the resolver from that
 * error is passed here so the user can complete the second factor.
 *
 * HIPAA §164.312(d) — Person or Entity Authentication.
 */

import React, { useState } from 'react';
import {
  MultiFactorResolver,
  TotpMultiFactorGenerator,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';

interface MFAChallengeProps {
  resolver: MultiFactorResolver;
  onSuccess: () => void;
  onCancel: () => void;
}

export const MFAChallenge: React.FC<MFAChallengeProps> = ({
  resolver,
  onSuccess,
  onCancel,
}) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      // Find the TOTP hint among enrolled factors
      const totpHint = resolver.hints.find(
        (h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID
      );
      if (!totpHint) {
        setError('No TOTP factor enrolled. Contact your administrator.');
        setLoading(false);
        return;
      }

      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpHint.uid,
        code
      );
      await resolver.resolveSignIn(assertion);

      // Audit log — fire and forget (user is now authenticated)
      httpsCallable(functions, 'logAuthEvent')({ action: 'auth.mfa_challenge' }).catch(() => {});

      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      if (msg.includes('invalid-verification-code') || msg.includes('INVALID')) {
        setError('Invalid code. Please check your authenticator and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Two-Factor Authentication</h2>
          <p className="text-sm text-slate-500 mt-1">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        {/* Code Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="mfa-challenge-code" className="sr-only">
              Verification Code
            </label>
            <input
              id="mfa-challenge-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              onKeyDown={handleKeyDown}
              placeholder="000000"
              className="w-full px-4 py-4 rounded-xl border border-slate-300 text-center text-2xl tracking-[0.3em] font-mono focus:ring-2 focus:ring-blue-500 outline-none"
              autoComplete="one-time-code"
              autoFocus
              aria-describedby={error ? 'mfa-challenge-error' : undefined}
            />
          </div>

          {error && (
            <div
              id="mfa-challenge-error"
              role="alert"
              className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3"
            >
              {error}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            aria-busy={loading}
          >
            {loading ? 'Verifying…' : 'Verify'}
          </button>

          <button
            onClick={onCancel}
            className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
          >
            Cancel — Sign in with a different account
          </button>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-400">
          PARRISH HEALTH — HIPAA MULTI-FACTOR AUTHENTICATION
        </div>
      </div>
    </div>
  );
};
