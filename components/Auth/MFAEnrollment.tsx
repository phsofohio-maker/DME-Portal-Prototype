/**
 * components/Auth/MFAEnrollment.tsx — Block 6: Admin TOTP MFA Enrollment
 *
 * Guides an admin through TOTP multi-factor authentication setup:
 *   1. Generate a TOTP secret via Firebase Auth
 *   2. Display the secret as a QR code (or manual entry key)
 *   3. Verify a 6-digit code from the authenticator app
 *   4. Finalize enrollment
 *
 * HIPAA §164.312(d) — Person or Entity Authentication: admins with
 * elevated access to PHI must use multi-factor authentication.
 */

import React, { useState, useEffect } from 'react';
import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../../services/firebase';
import { Staff } from '../../types';

interface MFAEnrollmentProps {
  user: Staff;
  onComplete: () => void;
  onSkip?: () => void;
}

type EnrollStep = 'intro' | 'qr' | 'verify' | 'success' | 'error';

export const MFAEnrollment: React.FC<MFAEnrollmentProps> = ({
  user,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<EnrollStep>('intro');
  const [totpSecret, setTotpSecret] = useState<TotpSecret | null>(null);
  const [secretUri, setSecretUri] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /** Step 1 → 2: Start enrollment — generate TOTP secret */
  const startEnrollment = async () => {
    setLoading(true);
    setError('');
    try {
      const firebaseUser = auth.currentUser;
      if (!firebaseUser) throw new Error('Not authenticated');

      const mfaSession = await multiFactor(firebaseUser).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(mfaSession);

      setTotpSecret(secret);
      setSecretUri(secret.generateQrCodeUrl(user.email, 'Parrish Health DME Portal'));
      setSecretKey(secret.secretKey);
      setStep('qr');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start MFA enrollment';
      setError(msg);
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  /** Step 2 → 3: User has scanned QR, now verify */
  const verifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (!totpSecret) throw new Error('TOTP secret not available');

      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        verificationCode
      );
      await multiFactor(auth.currentUser!).enroll(assertion, 'Authenticator App');

      // Audit log — fire and forget
      httpsCallable(functions, 'logAuthEvent')({ action: 'auth.mfa_enrollment' }).catch(() => {});

      setStep('success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed';
      if (msg.includes('invalid-verification-code') || msg.includes('INVALID')) {
        setError('Invalid code. Check your authenticator app and try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {step === 'success' ? 'MFA Enabled' : 'Set Up Two-Factor Authentication'}
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {step === 'intro' && 'HIPAA requires multi-factor authentication for admin accounts.'}
            {step === 'qr' && 'Scan this QR code with your authenticator app.'}
            {step === 'verify' && 'Enter the 6-digit code from your authenticator.'}
            {step === 'success' && 'Your account is now protected with MFA.'}
            {step === 'error' && 'Something went wrong. Please try again.'}
          </p>
        </div>

        {/* Intro Step */}
        {step === 'intro' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-bold mb-1">Required for Admin Access</p>
              <p>You'll need an authenticator app like Google Authenticator, Authy, or 1Password to generate verification codes.</p>
            </div>
            <button
              onClick={startEnrollment}
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              aria-busy={loading}
            >
              {loading ? 'Setting up…' : 'Begin Setup'}
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>
        )}

        {/* QR Code Step */}
        {step === 'qr' && (
          <div className="space-y-4">
            <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
              {secretUri ? (
                <>
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(secretUri)}`}
                    alt="TOTP QR Code — scan with your authenticator app"
                    className="mx-auto mb-3"
                    width={200}
                    height={200}
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Can't scan? Enter this key manually:
                  </p>
                  <code className="text-xs font-mono bg-slate-100 px-3 py-1 rounded mt-1 inline-block select-all break-all">
                    {secretKey}
                  </code>
                </>
              ) : (
                <p className="text-slate-500">Generating QR code…</p>
              )}
            </div>
            <button
              onClick={() => setStep('verify')}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              I've Scanned the Code
            </button>
          </div>
        )}

        {/* Verify Step */}
        {step === 'verify' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="mfa-code" className="block text-sm font-medium text-slate-700 mb-1">
                Verification Code
              </label>
              <input
                id="mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setError('');
                }}
                placeholder="000000"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 text-center text-2xl tracking-[0.3em] font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                autoComplete="one-time-code"
                aria-describedby={error ? 'mfa-error' : undefined}
              />
            </div>
            {error && (
              <div id="mfa-error" role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3">
                {error}
              </div>
            )}
            <button
              onClick={verifyCode}
              disabled={loading || verificationCode.length !== 6}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50"
              aria-busy={loading}
            >
              {loading ? 'Verifying…' : 'Verify & Enable MFA'}
            </button>
            <button
              onClick={() => setStep('qr')}
              className="w-full py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Back to QR Code
            </button>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <p className="text-sm text-slate-600">
              Two-factor authentication is now active. You'll be asked for a code from your authenticator app each time you sign in.
            </p>
            <button
              onClick={onComplete}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Continue to Portal
            </button>
          </div>
        )}

        {/* Error Step */}
        {step === 'error' && (
          <div className="space-y-4">
            <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-4">
              {error || 'An unexpected error occurred.'}
            </div>
            <button
              onClick={() => { setError(''); setStep('intro'); }}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            {onSkip && (
              <button
                onClick={onSkip}
                className="w-full py-2 text-sm text-slate-400 hover:text-slate-600"
              >
                Skip for now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
