/**
 * GoLivePage.tsx — Phase 4: Admin go-live deployment checklist
 *
 * Admin-only page that tracks the production readiness checklist from
 * the project plan (§7.3). Each item is marked Required or Recommended
 * and tracks a completion status in localStorage (so it persists across
 * sessions for the admin team reviewing readiness).
 *
 * Note: This is a planning tool, not an enforcement mechanism.
 * The authoritative go/no-go decision belongs to the HIPAA Security Officer
 * and DevOps team.
 */

import React, { useState, useEffect } from 'react';

type ItemStatus = 'pending' | 'complete' | 'na';
type Priority = 'required' | 'recommended';

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  description: string;
  priority: Priority;
  owner: string;
}

const CHECKLIST: ChecklistItem[] = [
  // ── Legal & Compliance ──────────────────────────────────────────────────────
  {
    id: 'baa-google',
    category: 'Legal & Compliance',
    label: 'BAA signed with Google Cloud / Firebase',
    description: 'Business Associate Agreement must be executed at the GCP organization level before any PHI enters the system.',
    priority: 'required',
    owner: 'Legal',
  },
  {
    id: 'baa-email',
    category: 'Legal & Compliance',
    label: 'BAA signed with email provider (SendGrid)',
    description: 'If notification emails include any PHI (patient names, request details), a BAA with SendGrid is required.',
    priority: 'required',
    owner: 'Legal',
  },
  {
    id: 'hipaa-risk',
    category: 'Legal & Compliance',
    label: 'HIPAA Security Risk Assessment documented',
    description: 'Formal documentation of all technical safeguards, residual risks, and mitigation plans per 45 CFR 164.308(a)(1).',
    priority: 'required',
    owner: 'Compliance',
  },
  {
    id: 'incident-response',
    category: 'Legal & Compliance',
    label: 'Incident response plan documented and tested',
    description: 'Documented procedure for breach notification within 72 hours, including investigation, containment, and OCR reporting.',
    priority: 'required',
    owner: 'Compliance',
  },
  {
    id: 'data-retention',
    category: 'Legal & Compliance',
    label: 'Data retention policy configured',
    description: 'HIPAA requires 6 years for compliance documentation. Configure Firestore retention policies. Never hard-delete records.',
    priority: 'recommended',
    owner: 'Compliance',
  },

  // ── Security ────────────────────────────────────────────────────────────────
  {
    id: 'pentest',
    category: 'Security',
    label: 'Third-party penetration test completed, findings remediated',
    description: 'OWASP Top 10 scope minimum against the staging environment. All critical and high findings must be resolved before go-live.',
    priority: 'required',
    owner: 'Security',
  },
  {
    id: 'ssl-audit',
    category: 'Security',
    label: 'SSL/TLS configuration audit (SSL Labs A+ target)',
    description: 'Verify Firebase Hosting TLS configuration scores A+ on SSL Labs. HSTS preload header is already configured.',
    priority: 'required',
    owner: 'DevOps',
  },
  {
    id: 'security-rules',
    category: 'Security',
    label: 'Production Firestore Security Rules deployed and verified',
    description: 'Run Firebase Security Rules unit tests against all collections. Verify the RBAC matrix against each role.',
    priority: 'required',
    owner: 'Backend',
  },
  {
    id: 'dep-scan',
    category: 'Security',
    label: 'Dependency vulnerability scan clean (npm audit)',
    description: 'Run npm audit. Zero high or critical vulnerabilities. Moderate findings reviewed and accepted or resolved.',
    priority: 'required',
    owner: 'Backend',
  },
  {
    id: 'mfa-admin',
    category: 'Security',
    label: 'TOTP MFA enabled for all admin accounts',
    description: 'Firebase Auth multi-factor enrollment required for all users with admin role before production access.',
    priority: 'required',
    owner: 'DevOps',
  },

  // ── Infrastructure ──────────────────────────────────────────────────────────
  {
    id: 'dns-ssl',
    category: 'Infrastructure',
    label: 'DNS and SSL certificate configured',
    description: 'Custom domain pointed to Firebase Hosting with automatic SSL certificate provisioning verified.',
    priority: 'required',
    owner: 'DevOps',
  },
  {
    id: 'backup',
    category: 'Infrastructure',
    label: 'Firestore backup schedule configured (daily)',
    description: 'Enable automated Firestore point-in-time recovery (PITR) and export backups to a separate Cloud Storage bucket.',
    priority: 'required',
    owner: 'DevOps',
  },
  {
    id: 'monitoring',
    category: 'Infrastructure',
    label: 'Error alerting configured (PagerDuty/Slack)',
    description: 'Cloud Monitoring alerts for Cloud Functions errors, Firestore quota limits, and Firebase Auth failures.',
    priority: 'required',
    owner: 'DevOps',
  },
  {
    id: 'rollback',
    category: 'Infrastructure',
    label: 'Rollback procedure tested',
    description: 'Verify that firebase hosting:rollback works and Firestore can be restored from backup within the RTO target.',
    priority: 'required',
    owner: 'DevOps',
  },
  {
    id: 'sendgrid-live',
    category: 'Infrastructure',
    label: 'SendGrid API key and verified sender configured',
    description: 'Set SENDGRID_API_KEY and SENDGRID_FROM in Cloud Functions environment config. Send test notifications.',
    priority: 'required',
    owner: 'DevOps',
  },
  {
    id: 'budget-alerts',
    category: 'Infrastructure',
    label: 'GCP budget alerts configured',
    description: 'Set budget alerts at 80% and 100% of monthly infrastructure budget to prevent cost overruns.',
    priority: 'recommended',
    owner: 'DevOps',
  },

  // ── Training ────────────────────────────────────────────────────────────────
  {
    id: 'training-complete',
    category: 'Staff Training',
    label: 'Staff training completed for all initial users',
    description: 'Role-specific training (Admin Guide, Nurse/Clinician Guide, Homemaker Quick Start) completed and attendance recorded.',
    priority: 'required',
    owner: 'Training',
  },
  {
    id: 'super-users',
    category: 'Staff Training',
    label: '2–3 super users designated per department',
    description: 'Super users are trained as first-line support contacts before the portal opens to all staff.',
    priority: 'required',
    owner: 'Training',
  },
  {
    id: 'hipaa-refresher',
    category: 'Staff Training',
    label: 'HIPAA refresher training completed',
    description: 'Portal-specific HIPAA training covering proper PHI handling, password hygiene, and incident reporting.',
    priority: 'required',
    owner: 'Training',
  },
];

const STORAGE_KEY = 'parrish-golive-checklist';

const CATEGORY_ORDER = ['Legal & Compliance', 'Security', 'Infrastructure', 'Staff Training'];

// ─── Component ────────────────────────────────────────────────────────────────

export const GoLivePage: React.FC = () => {
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  }, [statuses]);

  const setStatus = (id: string, status: ItemStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
  };

  const required = CHECKLIST.filter((i) => i.priority === 'required');
  const requiredComplete = required.filter((i) => (statuses[i.id] ?? 'pending') === 'complete' || (statuses[i.id] ?? 'pending') === 'na').length;
  const totalComplete = CHECKLIST.filter((i) => (statuses[i.id] ?? 'pending') === 'complete' || (statuses[i.id] ?? 'pending') === 'na').length;
  const allRequiredMet = requiredComplete === required.length;
  const progress = Math.round((totalComplete / CHECKLIST.length) * 100);

  const categories = CATEGORY_ORDER.map((cat) => ({
    name: cat,
    items: CHECKLIST.filter((i) => i.category === cat),
  }));

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Go-Live Readiness Checklist</h2>
        <p className="text-slate-500 mt-1">
          All <strong>Required</strong> items must be completed before production deployment.
          Review with your HIPAA Security Officer and DevOps team.
        </p>
      </div>

      {/* Summary card */}
      <div className={`rounded-2xl border p-5 ${allRequiredMet ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${allRequiredMet ? 'bg-green-100' : 'bg-amber-100'}`}>
            {allRequiredMet ? (
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className={`font-bold text-lg ${allRequiredMet ? 'text-green-800' : 'text-amber-800'}`}>
              {allRequiredMet ? 'All required items complete — ready for go-live review' : `${required.length - requiredComplete} required items remaining`}
            </p>
            <p className={`text-sm ${allRequiredMet ? 'text-green-600' : 'text-amber-600'}`}>
              {totalComplete} of {CHECKLIST.length} items complete · {progress}% overall
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <div className="w-32 bg-white/60 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${allRequiredMet ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${progress}% complete`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Checklist by category */}
      {categories.map((cat) => (
        <div key={cat.name} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900">{cat.name}</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {cat.items.map((item) => {
              const status: ItemStatus = statuses[item.id] ?? 'pending';
              return (
                <div key={item.id} className="px-6 py-4 flex items-start gap-4">
                  {/* Status selector */}
                  <select
                    value={status}
                    onChange={(e) => setStatus(item.id, e.target.value as ItemStatus)}
                    aria-label={`Status for: ${item.label}`}
                    className={`text-xs font-bold border rounded-lg px-2 py-1 mt-0.5 shrink-0 cursor-pointer outline-none focus:ring-2 focus:ring-blue-500 ${
                      status === 'complete' ? 'border-green-300 text-green-700 bg-green-50' :
                      status === 'na'       ? 'border-slate-300 text-slate-400 bg-slate-50' :
                                             'border-amber-300 text-amber-700 bg-amber-50'
                    }`}
                  >
                    <option value="pending">Pending</option>
                    <option value="complete">Complete</option>
                    <option value="na">N/A</option>
                  </select>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className={`font-medium text-sm ${status === 'complete' || status === 'na' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {item.label}
                      </p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                        item.priority === 'required'
                          ? 'text-red-700 border-red-200 bg-red-50'
                          : 'text-blue-600 border-blue-100 bg-blue-50'
                      }`}>
                        {item.priority === 'required' ? 'Required' : 'Recommended'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">Owner: {item.owner}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <p className="text-xs text-slate-500 text-center pb-4">
        Checklist progress is saved in your browser. This is a planning tool — the authoritative
        go/no-go decision belongs to your HIPAA Security Officer and DevOps lead.
      </p>
    </div>
  );
};
