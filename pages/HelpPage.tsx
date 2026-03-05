/**
 * HelpPage.tsx — Phase 4: In-app FAQ and help center
 *
 * Role-specific FAQ content for admins, nurses, homemakers, and office staff.
 * Accessible without an internet connection (fully static).
 */

import React, { useState } from 'react';
import { Staff } from '../types';

interface HelpPageProps {
  user: Staff;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  title: string;
  icon: React.ReactNode;
  items: FAQItem[];
}

// ─── FAQ Content ───────────────────────────────────────────────────────────────

const GENERAL_FAQ: FAQItem[] = [
  {
    question: 'How do I reset my password?',
    answer:
      'Click "Forgot password?" on the login screen. A reset link will be sent to your registered email address within a few minutes. Check your spam folder if you don\'t see it.',
  },
  {
    question: 'How long does my session stay active?',
    answer:
      'For HIPAA compliance, your session automatically ends after 15 minutes of inactivity. You\'ll see a warning 2 minutes before this happens. Click "Stay Signed In" to extend your session.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. All data is encrypted in transit (TLS 1.3) and at rest (AES-256). Access is controlled by your role — you can only see data relevant to your work. All actions are logged in an immutable audit trail.',
  },
  {
    question: 'What should I do if I suspect a HIPAA breach?',
    answer:
      'Immediately stop using the system and contact your HIPAA Security Officer. Do not attempt to investigate or remediate the breach yourself. Parrish Health is required to report breaches affecting more than 500 individuals to HHS within 72 hours.',
  },
  {
    question: 'Who do I contact for technical support?',
    answer:
      'Contact your department super user first — they can resolve most common issues. For system-level problems, email the IT help desk. For urgent clinical issues, call the on-call IT support line.',
  },
];

const DME_FAQ: FAQItem[] = [
  {
    question: 'How do I submit a DME request?',
    answer:
      'Navigate to "DME Request" in the sidebar. Search for the patient by name or MRN, select the equipment category and item, fill in the clinical justification (minimum 20 characters), provide a valid ICD-10 code, and sign the attestation. Your request goes directly to the admin inbox.',
  },
  {
    question: 'What is a valid ICD-10 code format?',
    answer:
      'ICD-10 codes must start with a letter, followed by 2 digits, optionally a period, and up to 4 more alphanumeric characters. Example: M54.5 (Low back pain), E11.9 (Type 2 diabetes without complications). Use your clinical reference or ask your supervisor if unsure.',
  },
  {
    question: 'What does "RMI" mean on a request?',
    answer:
      '"Request More Information" — the admin has reviewed your submission and needs additional details before they can approve or deny it. Check the request notes for what\'s needed, then contact the admin directly via the Messaging portal.',
  },
  {
    question: 'Can I edit a request after submitting?',
    answer:
      'No. Once submitted, requests are immutable records. If you need to change something, contact the reviewing admin via Messaging so they can note it in the review process, or submit a new corrected request.',
  },
  {
    question: 'How long does approval take?',
    answer:
      'Routine requests are typically reviewed within 24 hours. Urgent requests (marked STAT) should be reviewed within 4 hours. If your request is time-sensitive, also notify your admin directly via the Messaging portal.',
  },
];

const MESSAGING_FAQ: FAQItem[] = [
  {
    question: 'Is the messaging portal secure?',
    answer:
      'Messages are stored in Firestore with server-side access rules — only the sender and recipient can read a message. All message events are logged in the audit trail. Application-layer encryption is scheduled for a future release.',
  },
  {
    question: 'Can I send patient information in messages?',
    answer:
      'Avoid including patient MRNs, dates of birth, or detailed clinical information in messages where possible. Use the request ID instead. For complex clinical discussions, follow your department\'s PHI communication policy.',
  },
  {
    question: 'How do I know if my message was read?',
    answer:
      'A checkmark appears next to your sent messages. A grey checkmark means delivered; a blue checkmark means the recipient has opened the conversation and your message was marked as read.',
  },
];

const ADMIN_FAQ: FAQItem[] = [
  {
    question: 'How do I approve or deny a request?',
    answer:
      'Go to "Admin Inbox" and click on any pending request. Review the details, enter admin notes (minimum 5 characters — these are your clinical justification notes), then click Approve, Deny, or RMI. The submitter receives an email notification and an in-app notification.',
  },
  {
    question: 'How do I invite a new staff member?',
    answer:
      'Go to Team → Invite Staff. Enter their email address and assign their role. They will receive a password-reset email to set their own credentials. They will complete onboarding (display name, department) on first login.',
  },
  {
    question: 'How do I suspend an account?',
    answer:
      'Go to Team, find the staff member, and click "Suspend". This soft-deletes the account — the user can no longer log in, but their historical records are preserved for HIPAA audit compliance. Contact IT to fully delete a Firebase Auth account if required.',
  },
  {
    question: 'Can I view the audit log?',
    answer:
      'The audit log is currently accessible via the Firebase Console (Firestore → audit_log collection). A built-in audit log viewer is planned for a future release.',
  },
  {
    question: 'What is the Go-Live checklist?',
    answer:
      'The Go-Live page (Admin → Go-Live) tracks all required steps before the portal goes live in production. Each item is marked Required or Recommended. Review it with your HIPAA Security Officer and DevOps team before launch.',
  },
];

// ─── Accordion item ───────────────────────────────────────────────────────────

const AccordionItem: React.FC<{ item: FAQItem; index: number; sectionId: string }> = ({
  item,
  index,
  sectionId,
}) => {
  const [open, setOpen] = useState(false);
  const id = `${sectionId}-item-${index}`;

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        id={`${id}-button`}
        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <span className="font-medium text-slate-800 text-sm pr-4">{item.question}</span>
        <svg
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          id={`${id}-panel`}
          role="region"
          aria-labelledby={`${id}-button`}
          className="px-5 pb-4 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3 bg-slate-50/50"
        >
          {item.answer}
        </div>
      )}
    </div>
  );
};

// ─── FAQ Section ──────────────────────────────────────────────────────────────

const FAQSectionCard: React.FC<{ section: FAQSection; id: string }> = ({ section, id }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
      <div className="w-9 h-9 bg-blue-50 text-blue-600 flex items-center justify-center rounded-xl">
        {section.icon}
      </div>
      <h3 className="font-bold text-slate-900">{section.title}</h3>
    </div>
    <div className="p-4 space-y-2">
      {section.items.map((item, i) => (
        <AccordionItem key={i} item={item} index={i} sectionId={id} />
      ))}
    </div>
  </div>
);

// ─── Page ─────────────────────────────────────────────────────────────────────

export const HelpPage: React.FC<HelpPageProps> = ({ user }) => {
  const sections: Array<FAQSection & { id: string }> = [
    {
      id: 'general',
      title: 'General & Account',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
        </svg>
      ),
      items: GENERAL_FAQ,
    },
    {
      id: 'dme',
      title: 'DME & Medication Requests',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M16 16h6" /><path d="M19 13v6" /><rect width="20" height="14" x="2" y="6" rx="2" /><path d="M7 15h.01" /><path d="M11 15h.01" />
        </svg>
      ),
      items: DME_FAQ,
    },
    {
      id: 'messaging',
      title: 'Secure Messaging',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
      items: MESSAGING_FAQ,
    },
    ...(user.role === 'admin'
      ? [
          {
            id: 'admin',
            title: 'Admin Functions',
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            ),
            items: ADMIN_FAQ,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Help Center</h2>
        <p className="text-slate-500 mt-1">
          Frequently asked questions about the Parrish Health DME Portal.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-700">
          Can't find what you're looking for? Contact your department super user or email the
          IT help desk. For urgent security concerns, contact the HIPAA Security Officer
          immediately.
        </p>
      </div>

      {sections.map((section) => (
        <FAQSectionCard key={section.id} section={section} id={section.id} />
      ))}
    </div>
  );
};
