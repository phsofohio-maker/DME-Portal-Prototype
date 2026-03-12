import React, { useState, useEffect } from 'react';
import { multiFactor } from 'firebase/auth';
import { auth } from '../services/firebase';
import { Staff, NotificationPrefs } from '../types';
import { firebaseService } from '../services/firebaseService';

interface ProfilePageProps {
  user: Staff;
  onUpdate: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onUpdate }) => {
  const [mfaEnrolled, setMfaEnrolled] = useState<boolean | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    user.notificationPrefs ?? { emailOnStatusChange: true, emailOnNewMessage: true, inAppOnStatusChange: true, inAppOnNewMessage: true }
  );

  // Check MFA enrollment status for admin users
  useEffect(() => {
    if (user.role === 'admin' && auth.currentUser) {
      const factors = multiFactor(auth.currentUser).enrolledFactors;
      setMfaEnrolled(factors.length > 0);
    }
  }, [user.role]);

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
        <dl className="space-y-4">
          {[
            { label: 'Name',  value: user.displayName },
            { label: 'Email', value: user.email },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between py-2 border-b border-slate-50">
              <dt className="text-slate-500 text-sm">{label}</dt>
              <dd className="font-bold text-slate-800">{value}</dd>
            </div>
          ))}
          <div className="flex justify-between py-2 border-b border-slate-50">
            <dt className="text-slate-500 text-sm">Role</dt>
            <dd>
              <span className="font-bold capitalize text-blue-600 text-[10px] px-2 py-0.5 bg-blue-50 rounded">
                {user.role.replace('_', ' ')}
              </span>
            </dd>
          </div>
          {user.department && (
            <div className="flex justify-between py-2 border-b border-slate-50">
              <dt className="text-slate-500 text-sm">Department</dt>
              <dd className="font-bold text-slate-800">{user.department}</dd>
            </div>
          )}
          {user.phoneNumber && (
            <div className="flex justify-between py-2 border-b border-slate-50">
              <dt className="text-slate-500 text-sm">Phone</dt>
              <dd className="font-bold text-slate-800">{user.phoneNumber}</dd>
            </div>
          )}
          {user.role === 'admin' && mfaEnrolled !== null && (
            <div className="flex justify-between items-center py-2 border-b border-slate-50">
              <dt className="text-slate-500 text-sm">Multi-Factor Auth</dt>
              <dd>
                {mfaEnrolled ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                    </svg>
                    TOTP Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                    </svg>
                    Not Enrolled
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl"
            aria-hidden="true"
          >
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
            <h3 className="font-bold text-slate-900 serif">Notification Preferences</h3>
            <p className="text-xs text-slate-500">Control how and when you receive alerts.</p>
          </div>
          {savingPrefs && (
            <div className="ml-auto text-[10px] text-blue-500 font-bold animate-pulse" role="status" aria-live="polite">
              Saving…
            </div>
          )}
        </div>

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Email Alerts</p>
        <div className="space-y-3 mb-6" role="group" aria-label="Email notification preferences">
          {[
            {
              key: 'emailOnStatusChange' as const,
              label: 'Request Status Updates',
              desc: 'Email me when an admin approves or denies a request.',
            },
            {
              key: 'emailOnNewMessage' as const,
              label: 'New Messages',
              desc: 'Email me when a colleague sends a new secure message.',
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
                role="switch"
                aria-checked={prefs[key]}
                aria-label={label}
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

        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">In-App Notifications</p>
        <div className="space-y-3" role="group" aria-label="In-app notification preferences">
          {[
            {
              key: 'inAppOnStatusChange' as const,
              label: 'Request Updates',
              desc: 'Show in-app notifications when a request status changes.',
            },
            {
              key: 'inAppOnNewMessage' as const,
              label: 'New Messages',
              desc: 'Show in-app notifications for incoming secure messages.',
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
                role="switch"
                aria-checked={prefs[key]}
                aria-label={label}
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
