/**
 * AdminInbox.tsx — Admin request processing page (Phase 2)
 *
 * Features:
 *  - RMI, Approve, Deny actions with Zod-validated admin notes
 *  - Escalation: assign to another admin or flag for supervisor review
 *  - Bulk approve / deny with confirmation modal
 *  - Selectable pending-requests table with "Select All" support
 *  - Loading skeleton while first batch of requests arrives
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Staff, Request } from '../types';
import { firebaseService } from '../services/firebaseService';
import { RequestList } from '../components/Dashboard/RequestList';
import { RequestListSkeleton } from '../components/ui/LoadingSkeleton';
import { adminActionSchema, bulkAdminActionSchema } from '../lib/schemas';
import { exportRequestPDF } from '../services/pdfService';

interface AdminInboxProps {
  user: Staff;
}

// ─── Small icons used inline ──────────────────────────────────────────────────

const ChevronDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

const FlagIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

// ─── Status badge helper ──────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: 'bg-green-100 text-green-700 border-green-200',
    denied:   'bg-red-100 text-red-700 border-red-200',
    rmi:      'bg-amber-100 text-amber-700 border-amber-200',
    pending:  'bg-blue-100 text-blue-700 border-blue-100',
  };
  const label = status === 'rmi' ? 'Info Needed' : status;
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border ${map[status] ?? map['pending']}`}>
      {label}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AdminInbox: React.FC<AdminInboxProps> = ({ user }) => {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  // Single-request modal
  const [selected, setSelected] = useState<Request | null>(null);
  const [notes, setNotes] = useState('');
  const [rmiNotes, setRmiNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [formError, setFormError] = useState('');

  // Escalation (within process modal)
  const [showEscalation, setShowEscalation] = useState(false);
  const [admins, setAdmins] = useState<Staff[]>([]);
  const [escalateTo, setEscalateTo] = useState('');
  const [flagSupervisor, setFlagSupervisor] = useState(false);
  const [escalationNote, setEscalationNote] = useState('');
  const [escalating, setEscalating] = useState(false);
  const [escalationDone, setEscalationDone] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'approved' | 'denied' | null>(null);
  const [bulkNotes, setBulkNotes] = useState('');
  const [bulkError, setBulkError] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ succeeded: number; failed: number } | null>(null);

  // ── Subscribe to requests ───────────────────────────────────────────────────

  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToAllRequests((data) => {
      setRequests(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // ── Fetch admin list (for escalation dropdown) ──────────────────────────────

  useEffect(() => {
    firebaseService.getAllStaff().then((staff) =>
      setAdmins(staff.filter((s) => s.role === 'admin' && s.uid !== user.uid && s.status === 'active'))
    );
  }, [user.uid]);

  // ── Single-request modal helpers ────────────────────────────────────────────

  const closeModal = useCallback(() => {
    setSelected(null);
    setNotes('');
    setRmiNotes('');
    setFormError('');
    setShowEscalation(false);
    setEscalateTo('');
    setFlagSupervisor(false);
    setEscalationNote('');
    setEscalationDone(false);
  }, []);

  const handleAction = async (status: 'approved' | 'denied' | 'rmi') => {
    if (!selected) return;

    const result = adminActionSchema.safeParse({
      requestId: selected.id,
      status,
      adminNotes: notes,
      rmiNotes: status === 'rmi' ? rmiNotes : undefined,
    });

    if (!result.success) {
      setFormError(result.error.errors[0]?.message ?? 'Validation error.');
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

  const handleEscalate = async () => {
    if (!selected || (!escalateTo && !flagSupervisor)) return;
    setEscalating(true);
    const targetAdmin = admins.find((a) => a.uid === escalateTo);
    await firebaseService.escalateRequest(
      selected.id,
      escalateTo || undefined,
      targetAdmin?.displayName,
      flagSupervisor,
      escalationNote || undefined
    );
    setEscalating(false);
    setEscalationDone(true);
  };

  // ── Bulk selection helpers ──────────────────────────────────────────────────

  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'rmi');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
    }
  };

  const openBulkModal = (action: 'approved' | 'denied') => {
    setBulkAction(action);
    setBulkNotes('');
    setBulkError('');
    setBulkResult(null);
  };

  const closeBulkModal = () => {
    setBulkAction(null);
    setBulkNotes('');
    setBulkError('');
    setBulkResult(null);
  };

  const handleBulkSubmit = async () => {
    if (!bulkAction) return;
    const ids = Array.from(selectedIds);
    const validation = bulkAdminActionSchema.safeParse({
      requestIds: ids,
      status: bulkAction,
      adminNotes: bulkNotes,
    });
    if (!validation.success) {
      setBulkError(validation.error.errors[0]?.message ?? 'Validation error.');
      return;
    }
    setBulkError('');
    setBulkProcessing(true);
    const { succeeded, failed } = await firebaseService.bulkUpdateRequestStatus(
      ids, bulkAction, bulkNotes, user.uid
    );
    setBulkProcessing(false);
    setBulkResult({ succeeded: succeeded.length, failed: failed.length });
    setSelectedIds(new Set());
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3">
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

      {/* Pending requests — selectable table */}
      {loading ? (
        <RequestListSkeleton title="Loading requests…" rows={5} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" role="region" aria-label="Pending requests">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">All Pending &amp; RMI Requests</h3>
            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-medium">
              {pendingRequests.length} Total
            </span>
          </div>

          {/* Bulk toolbar — visible when ≥1 row selected */}
          {selectedIds.size > 0 && (
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-blue-700">{selectedIds.size} selected</span>
              <button
                onClick={() => openBulkModal('approved')}
                className="px-4 py-1.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors text-xs"
              >
                Approve Selected
              </button>
              <button
                onClick={() => openBulkModal('denied')}
                className="px-4 py-1.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors text-xs"
              >
                Deny Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-slate-500 hover:text-slate-700 text-xs"
              >
                Clear
              </button>
            </div>
          )}

          {pendingRequests.length === 0 ? (
            <div className="p-12 text-center text-slate-400" role="status">
              <p className="font-medium">No pending requests</p>
              <p className="text-xs">New submissions will appear here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm" aria-label="Pending requests table">
                <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wide">
                  <tr>
                    <th scope="col" className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        aria-label="Select all pending requests"
                        checked={selectedIds.size === pendingRequests.length && pendingRequests.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th scope="col" className="px-4 py-3">Type</th>
                    <th scope="col" className="px-4 py-3">Patient</th>
                    <th scope="col" className="px-4 py-3">Submitted by</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pendingRequests.map((req) => (
                    <tr
                      key={req.id}
                      className={`hover:bg-slate-50 transition-colors ${selectedIds.has(req.id) ? 'bg-blue-50/60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          aria-label={`Select request for ${req.patientName}`}
                          checked={selectedIds.has(req.id)}
                          onChange={() => toggleSelect(req.id)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">{req.type}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{req.patientName}</p>
                        <p className="text-xs text-slate-400">ID: {req.patientId}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{req.submitterName}</td>
                      <td className="px-4 py-3">{statusBadge(req.status)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 flex items-center gap-3">
                        <button
                          onClick={() => setSelected(req)}
                          className="text-blue-600 hover:underline font-medium text-xs"
                          aria-label={`Process request for ${req.patientName}`}
                        >
                          Process
                        </button>
                        {(req.escalatedTo || req.flaggedForSupervisor) && (
                          <span
                            className="text-violet-500"
                            title={req.escalatedToName ? `Assigned to ${req.escalatedToName}` : 'Flagged for supervisor'}
                          >
                            <FlagIcon />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Processed requests */}
      {!loading && (
        <RequestList
          title="Processed Requests"
          requests={requests.filter((r) => r.status === 'approved' || r.status === 'denied')}
          onExport={exportRequestPDF}
        />
      )}

      {/* ══ Single-request process modal ══ */}
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
                <span className="font-bold">{selected.patientName} ({selected.patientId})</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Submitted by:</span>
                <span className="font-bold">{selected.submitterName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-500">Type:</span>
                <span className="font-bold capitalize">{selected.type}</span>
              </div>
              {(selected.escalatedTo || selected.flaggedForSupervisor) && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider mb-1">Escalation</p>
                  {selected.escalatedToName && (
                    <p className="text-sm text-violet-800">Assigned to: <strong>{selected.escalatedToName}</strong></p>
                  )}
                  {selected.flaggedForSupervisor && (
                    <p className="text-sm text-violet-800">Flagged for supervisor review</p>
                  )}
                  {selected.escalationNote && (
                    <p className="text-xs text-violet-700 mt-1 italic">"{selected.escalationNote}"</p>
                  )}
                </div>
              )}
              {selected.status === 'rmi' && selected.rmiNotes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1">Previous RMI Note</p>
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

            {/* Action buttons */}
            <div className="flex gap-3 mb-4">
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

            {/* Escalation section (collapsible) */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowEscalation((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                aria-expanded={showEscalation}
              >
                <span className="flex items-center gap-2">
                  <FlagIcon />
                  Escalate / Assign
                </span>
                {showEscalation ? <ChevronUp /> : <ChevronDown />}
              </button>

              {showEscalation && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                  {escalationDone ? (
                    <p className="text-sm text-emerald-600 font-medium">Escalation saved.</p>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="escalate-to" className="block text-xs font-medium text-slate-600 mb-1">
                          Assign to Admin
                        </label>
                        <select
                          id="escalate-to"
                          value={escalateTo}
                          onChange={(e) => setEscalateTo(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          <option value="">— Unassigned —</option>
                          {admins.map((a) => (
                            <option key={a.uid} value={a.uid}>{a.displayName} ({a.email})</option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={flagSupervisor}
                          onChange={(e) => setFlagSupervisor(e.target.checked)}
                          className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        Flag for supervisor review
                      </label>

                      <div>
                        <label htmlFor="escalation-note" className="block text-xs font-medium text-slate-600 mb-1">
                          Escalation Note (optional)
                        </label>
                        <textarea
                          id="escalation-note"
                          value={escalationNote}
                          onChange={(e) => setEscalationNote(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400 h-14 resize-none"
                          placeholder="Reason for escalation…"
                        />
                      </div>

                      <button
                        onClick={handleEscalate}
                        disabled={escalating || (!escalateTo && !flagSupervisor)}
                        className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition-colors disabled:opacity-40"
                      >
                        {escalating ? 'Saving…' : 'Save Escalation'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Bulk action confirmation modal ══ */}
      {bulkAction && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Bulk ${bulkAction} confirmation`}
          className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[400]"
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold mb-1">
              Bulk {bulkAction === 'approved' ? 'Approve' : 'Deny'} — {selectedIds.size} Request{selectedIds.size !== 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              This will {bulkAction === 'approved' ? 'approve' : 'deny'} all {selectedIds.size} selected
              request{selectedIds.size !== 1 ? 's' : ''} simultaneously.
            </p>

            {bulkResult ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                  {bulkResult.succeeded} request{bulkResult.succeeded !== 1 ? 's' : ''} {bulkAction === 'approved' ? 'approved' : 'denied'} successfully.
                </div>
                {bulkResult.failed > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                    {bulkResult.failed} request{bulkResult.failed !== 1 ? 's' : ''} failed — please retry individually.
                  </div>
                )}
                <button
                  onClick={closeBulkModal}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <label htmlFor="bulk-notes" className="block text-sm font-medium mb-1">
                  Reason / Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="bulk-notes"
                  className="w-full p-3 border rounded-lg mb-1 outline-none focus:ring-2 focus:ring-blue-500 h-20 text-sm"
                  placeholder={`Enter reason for bulk ${bulkAction}…`}
                  value={bulkNotes}
                  onChange={(e) => { setBulkNotes(e.target.value); setBulkError(''); }}
                />
                {bulkError && (
                  <div role="alert" className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl p-3 mb-3">
                    {bulkError}
                  </div>
                )}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={closeBulkModal}
                    disabled={bulkProcessing}
                    className="flex-1 py-3 border border-slate-200 rounded-xl font-bold text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkSubmit}
                    disabled={bulkProcessing}
                    className={`flex-1 py-3 text-white rounded-xl font-bold transition-colors disabled:opacity-50 ${
                      bulkAction === 'approved' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {bulkProcessing ? 'Processing…' : `Confirm ${bulkAction === 'approved' ? 'Approve' : 'Deny'}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
