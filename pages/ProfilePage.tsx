import React, { useState } from 'react';
import { Staff, NotificationPrefs } from '../types';
import { firebaseService } from '../services/firebaseService';

interface ProfilePageProps {
  user: Staff;
  onUpdate: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onUpdate }) => {
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
            <h3 className="font-bold text-slate-900 serif">Email Notifications</h3>
            <p className="text-xs text-slate-500">Manage when you receive external alerts.</p>
          </div>
          {savingPrefs && (
            <div className="ml-auto text-[10px] text-blue-500 font-bold animate-pulse" role="status" aria-live="polite">
              Saving…
            </div>
          )}
        </div>

        <div className="space-y-4" role="group" aria-label="Notification preferences">
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
