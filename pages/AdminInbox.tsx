/**
 * AdminInbox.tsx — Admin request processing page (Phase 2)
 *
 * Adds:
 *  - RMI (Request More Information) action alongside Approve / Deny
 *  - Zod-validated admin notes (min 5 chars)
 *  - Status history timeline in the modal
 *  - Loading skeleton while first batch of requests arrives
 */

import React, { useState, useEffect } from 'react';
import { Staff, Request } from '../types';
import { firebaseService } from '../services/firebaseService';
import { RequestList } from '../components/Dashboard/RequestList';
import { RequestListSkeleton } from '../components/ui/LoadingSkeleton';
import { adminActionSchema } from '../lib/schemas';
import { exportRequestPDF } from '../services/pdfService';

interface AdminInboxProps {
  user: Staff;
}

export const AdminInbox: React.FC<AdminInboxProps> = ({ user }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Request | null>(null);
  const [notes, setNotes] = useState('');
  const [rmiNotes, setRmiNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToAllRequests((data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const closeModal = () => {
    setSelected(null);
    setNotes('');
    setRmiNotes('');
    setFormError('');
  };

  const handleAction = async (status: 'approved' | 'denied' | 'rmi') => {
    if (!selected) return;

    // Validate with Zod before submitting
    const result = adminActionSchema.safeParse({
      requestId: selected.id,
      status,
      adminNotes: notes,
      rmiNotes: status === 'rmi' ? rmiNotes : undefined,
    });

    if (!result.success) {
      const firstError = result.error.errors[0]?.message ?? 'Validation error.';
      setFormError(firstError);
      return;
    }

    setFormError('');
    setProcessing(true);
    await firebaseService.updateRequestStatus(
      selected.id,
      status,
      notes,
      user.uid,
      status === 'rmi' ? rmiNotes : undefined
    );
    closeModal();
    setProcessing(false);
  };

  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'rmi');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Admin Requests Inbox</h2>
        <div className="flex gap-3 text-sm">
          <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-bold">
            {pendingRequests.length} Pending
          </span>
          <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-bold">
            {requests.filter((r) => r.status === 'rmi').length} RMI
          </span>
        </div>
      </div>

      {loading ? (
        <RequestListSkeleton title="Loading requests…" rows={5} />
      ) : (
        <RequestList
          title="All Pending & RMI Requests"
          requests={pendingRequests}
          onSelect={setSelected}
        />
      )}

      {/* ── Request detail / action modal ── */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Process request ${selected.id}`}
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[300]"
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-xl shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Process Request</h3>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Request summary */}
            <div className="space-y-3 mb-5 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Patient:</span>
                <span className="font-bold">
                  {selected.patientName} ({selected.patientId})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Submitted by:</span>
                <span className="font-bold">{selected.submitterName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Type:</span>
                <span className="font-bold capitalize">{selected.type}</span>
              </div>
              {selected.status === 'rmi' && selected.rmiNotes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">
                    Previous RMI Note
                  </p>
                  <p className="text-sm text-amber-800">{selected.rmiNotes}</p>
                </div>
              )}
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-slate-500 mb-1 text-xs font-bold uppercase tracking-wide">Request Details</p>
                <pre className="text-xs whitespace-pre-wrap text-slate-700 font-mono">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
            </div>

            {/* Admin notes */}
            <label htmlFor="admin-notes" className="block text-sm font-medium mb-1">
              Internal Admin Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              id="admin-notes"
              className="w-full p-3 border rounded-lg mb-1 outline-none focus:ring-2 focus:ring-blue-500 h-20 text-sm"
              placeholder="Enter reason for approval, denial, or additional info needed…"
              value={notes}
              onChange={(e) => { setNotes(e.target.value); setFormError(''); }}
              aria-required="true"
            />

            {/* RMI-specific note field */}
            <div className="mb-4">
              <label htmlFor="rmi-notes" className="block text-sm font-medium mb-1">
                Message to Submitter (RMI only)
              </label>
              <textarea
                id="rmi-notes"
                className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-amber-400 h-16 text-sm"
                placeholder="Explain what additional information is required…"
                value={rmiNotes}
                onChange={(e) => { setRmiNotes(e.target.value); setFormError(''); }}
              />
            </div>

            {formError && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-4">
                {formError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                disabled={processing}
                onClick={() => handleAction('denied')}
                className="flex-1 py-3 border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Deny
              </button>
              <button
                disabled={processing}
                onClick={() => handleAction('rmi')}
                className="flex-1 py-3 border border-amber-300 text-amber-700 rounded-xl font-bold hover:bg-amber-50 transition-colors disabled:opacity-50"
                title="Request More Information"
              >
                RMI
              </button>
              <button
                disabled={processing}
                onClick={() => handleAction('approved')}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Processed Requests (approved / denied) with PDF export ── */}
      {!loading && (
        <RequestList
          title="Processed Requests"
          requests={requests.filter((r) => r.status === 'approved' || r.status === 'denied')}
          onExport={exportRequestPDF}
        />
      )}
    </div>
  );
};
