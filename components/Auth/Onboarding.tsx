
import React, { useState } from 'react';
import { Staff } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export const Onboarding: React.FC<{ user: Staff; onComplete: () => void }> = ({
  user,
  onComplete,
}) => {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFinish = async () => {
    setLoading(true);
    await firebaseService.updateStaff(user.uid, {
      displayName,
      phoneNumber,
      department,
      hasCompletedOnboarding: true,
    });
    setLoading(false);
    onComplete();
  };

  const onboardingTrapRef = useFocusTrap(true);

  return (
    <div ref={onboardingTrapRef} className="fixed inset-0 bg-slate-900 z-[500] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Staff onboarding">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row h-[600px]">
        {/* Left sidebar */}
        <div className="w-full md:w-72 bg-blue-600 p-8 text-white flex flex-col">
          <div className="mb-12">
            <h1 className="text-2xl font-bold tracking-tight">Parrish Health</h1>
            <p className="text-blue-100 text-xs mt-1 uppercase tracking-widest font-semibold">
              Staff Onboarding
            </p>
          </div>

          <div className="space-y-8 flex-1">
            {[
              { n: 1, t: 'Identity', d: 'Basic profile details' },
              { n: 2, t: 'Security', d: 'Account protection' },
              { n: 3, t: 'Orientation', d: 'System overview' },
            ].map((s) => (
              <div
                key={s.n}
                className={`flex gap-4 items-center transition-opacity ${
                  step === s.n ? 'opacity-100' : 'opacity-40'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                    step === s.n
                      ? 'bg-white text-blue-600 border-white'
                      : 'border-blue-300'
                  }`}
                >
                  {s.n}
                </div>
                <div>
                  <p className="font-bold text-sm">{s.t}</p>
                  <p className="text-[10px] text-blue-100">{s.d}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto">
            <p className="text-[10px] text-blue-200">UID: {user.uid.substring(0, 8)}</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-10 flex flex-col overflow-y-auto">
          {/* Step 1 — Identity */}
          {step === 1 && (
            <div className="space-y-6 flex flex-col flex-1">
              <h2 className="text-3xl font-bold text-slate-900 serif">
                Welcome to Parrish Health
              </h2>
              <p className="text-slate-600">
                Confirm your identity details as they will appear on requests and clinical
                documents.
              </p>

              <div className="space-y-4 pt-4 flex-1">
                <div className="space-y-1.5">
                  <label htmlFor="onboard-name" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Full Name / Signature Name
                  </label>
                  <input
                    id="onboard-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="onboard-phone" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Phone Number
                    </label>
                    <input
                      id="onboard-phone"
                      type="tel"
                      placeholder="(555) 000-0000"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="onboard-dept" className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Primary Department
                    </label>
                    <input
                      id="onboard-dept"
                      type="text"
                      placeholder="Home Health"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                className="mt-auto w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg hover:bg-slate-800"
              >
                Next Step
              </button>
            </div>
          )}

          {/* Step 2 — Security (informational; Firebase Auth manages the password) */}
          {step === 2 && (
            <div className="space-y-6 flex flex-col flex-1">
              <h2 className="text-3xl font-bold text-slate-900 serif">Account Security</h2>
              <p className="text-slate-600">
                Your account is secured by Firebase Authentication. You signed in with the
                password set via your invitation email.
              </p>

              <div className="space-y-4 pt-4 flex-1">
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-4">
                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-blue-900 text-sm">Secure Password</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Your password was set via the invitation link. Use your browser's
                        password manager to keep it secure.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-blue-900 text-sm">Session Timeout</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        For HIPAA compliance, you will be automatically signed out after
                        15 minutes of inactivity.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-blue-900 text-sm">Audit Logging</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        All actions in the portal are recorded in an immutable audit log
                        as required by HIPAA Security Rule §164.312(b).
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-auto">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-2 py-4 bg-slate-900 text-white rounded-2xl font-bold px-8"
                >
                  Next Step
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Orientation */}
          {step === 3 && (
            <div className="space-y-6 flex flex-col flex-1">
              <h2 className="text-3xl font-bold text-slate-900 serif">Ready to Begin</h2>
              <p className="text-slate-600">
                Your account is configured. Remember that all activity in this portal is
                logged for HIPAA compliance.
              </p>

              <div className="bg-slate-50 p-6 rounded-2xl space-y-4 flex-1">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Secure Access Active</p>
                    <p className="text-xs text-slate-600">
                      Your account is protected by Firebase Authentication.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">Real-time Coordination</p>
                    <p className="text-xs text-slate-600">
                      Requests are synced instantly across all devices for your care team.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 mt-auto">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold"
                >
                  Back
                </button>
                <button
                  disabled={loading}
                  onClick={handleFinish}
                  className="flex-2 py-4 bg-blue-600 text-white rounded-2xl font-bold px-8 hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50"
                >
                  {loading ? 'Saving…' : 'Complete Onboarding →'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
