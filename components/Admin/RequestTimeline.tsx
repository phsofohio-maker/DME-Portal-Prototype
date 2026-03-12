/**
 * RequestTimeline.tsx — Audit trail timeline for a single request (Phase 2, Block 14)
 *
 * Queries audit_log entries by resourceId and renders them as a vertical
 * timeline alongside the original request details. Satisfies the HIPAA
 * audit review requirement (§164.312(b)).
 */

import React, { useState, useEffect } from 'react';
import { Request, AuditLogEntry, AuditAction } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { Skeleton } from '../ui/Skeleton';

// ─── Action display helpers ──────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  'request.create':       'Submitted',
  'request.approve':      'Approved',
  'request.deny':         'Denied',
  'request.rmi':          'More Info Requested',
  'request.update':       'Updated',
  'request.escalate':     'Escalated',
  'request.bulk_approve': 'Bulk Approved',
  'request.bulk_deny':    'Bulk Denied',
};

const ACTION_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  'request.create':       { dot: 'bg-blue-500',   bg: 'bg-blue-50',   text: 'text-blue-700' },
  'request.approve':      { dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  'request.deny':         { dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700' },
  'request.rmi':          { dot: 'bg-amber-500',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  'request.update':       { dot: 'bg-slate-400',  bg: 'bg-slate-50',  text: 'text-slate-600' },
  'request.escalate':     { dot: 'bg-violet-500', bg: 'bg-violet-50', text: 'text-violet-700' },
  'request.bulk_approve': { dot: 'bg-green-500',  bg: 'bg-green-50',  text: 'text-green-700' },
  'request.bulk_deny':    { dot: 'bg-red-500',    bg: 'bg-red-50',    text: 'text-red-700' },
};

const DEFAULT_COLOR = { dot: 'bg-slate-400', bg: 'bg-slate-50', text: 'text-slate-600' };

function statusBadge(status: string) {
  const map: Record<string, string> = {
    approved: 'bg-green-100 text-green-700 border-green-200',
    denied:   'bg-red-100 text-red-700 border-red-200',
    rmi:      'bg-amber-100 text-amber-700 border-amber-200',
    pending:  'bg-blue-100 text-blue-700 border-blue-100',
  };
  const label = status === 'rmi' ? 'Info Needed' : status;
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold border ${map[status] ?? map['pending']}`}>
      {label}
    </span>
  );
}

// ─── Timeline Loading Skeleton ───────────────────────────────────────────────

const TimelineSkeleton: React.FC = () => (
  <div className="space-y-6 py-2" role="status" aria-label="Loading timeline…">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="flex gap-4">
        <div className="flex flex-col items-center">
          <Skeleton className="w-3 h-3 rounded-full" />
          {i < 2 && <Skeleton className="w-0.5 flex-1 mt-1" />}
        </div>
        <div className="flex-1 pb-4">
          <Skeleton className="h-4 w-28 mb-2" />
          <Skeleton className="h-3 w-48 mb-1" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    ))}
    <span className="sr-only">Loading timeline, please wait…</span>
  </div>
);

// ─── Component ───────────────────────────────────────────────────────────────

interface RequestTimelineProps {
  request: Request;
  onClose: () => void;
}

export const RequestTimeline: React.FC<RequestTimelineProps> = ({ request, onClose }) => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    firebaseService.getAuditLogByResourceId(request.id).then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [request.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Request timeline for ${request.patientName}`}
      className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[300]"
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-xl font-bold text-slate-900 serif">Request Timeline</h3>
              {statusBadge(request.status)}
            </div>
            <p className="text-sm text-slate-500">
              {request.patientName} ({request.patientId}) — <span className="capitalize">{request.type}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="Close timeline"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Request details (collapsible) */}
          <div className="mb-6 border border-slate-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              aria-expanded={showDetails}
            >
              <span>Original Submission Details</span>
              <svg
                className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {showDetails && (
              <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Submitted by</span>
                  <span className="font-bold text-slate-800">{request.submitterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Type</span>
                  <span className="font-bold text-slate-800 capitalize">{request.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Created</span>
                  <span className="font-bold text-slate-800">{new Date(request.createdAt).toLocaleString()}</span>
                </div>
                {request.adminNotes && (
                  <div className="pt-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Admin Notes</p>
                    <p className="text-slate-700 bg-slate-50 p-2 rounded-lg">{request.adminNotes}</p>
                  </div>
                )}
                <details className="pt-2">
                  <summary className="text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer mb-1">
                    Full Details (JSON)
                  </summary>
                  <pre className="text-xs whitespace-pre-wrap text-slate-600 font-mono bg-slate-50 p-3 rounded-lg overflow-auto max-h-40">
                    {JSON.stringify(request.details, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>

          {/* Timeline */}
          <h4 className="text-sm font-bold text-slate-800 mb-4">Audit Trail</h4>

          {loading ? (
            <TimelineSkeleton />
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <p className="text-sm">No audit entries recorded for this request.</p>
            </div>
          ) : (
            <div className="relative" role="list" aria-label="Request audit timeline">
              {/* Vertical line */}
              <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-slate-200" aria-hidden="true" />

              {entries.map((entry, i) => {
                const colors = ACTION_COLORS[entry.action] ?? DEFAULT_COLOR;
                const afterData = entry.after as Record<string, unknown> | undefined;
                const adminNotes = afterData?.['adminNotes'] as string | undefined;
                const rmiNotes = afterData?.['rmiNotes'] as string | undefined;

                return (
                  <div key={entry.id} className="flex gap-4 relative" role="listitem">
                    {/* Dot */}
                    <div className="flex flex-col items-center z-10 shrink-0">
                      <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${colors.dot}`} />
                    </div>

                    {/* Content */}
                    <div className={`flex-1 ${i < entries.length - 1 ? 'pb-6' : ''}`}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                          {ACTION_LABELS[entry.action] ?? entry.action}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {new Date(entry.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        by <span className="font-bold text-slate-700">{entry.actorId.slice(0, 12)}</span>
                        <span className="ml-1 text-[10px] uppercase font-bold text-slate-400">
                          ({entry.actorRole})
                        </span>
                      </p>

                      {/* Admin notes from the after snapshot */}
                      {adminNotes && (
                        <div className="mt-2 bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs text-slate-600">
                          <span className="font-bold text-slate-500">Notes: </span>{adminNotes}
                        </div>
                      )}
                      {rmiNotes && (
                        <div className="mt-1 bg-amber-50 border border-amber-100 rounded-lg p-2 text-xs text-amber-700">
                          <span className="font-bold text-amber-600">RMI: </span>{rmiNotes}
                        </div>
                      )}

                      {/* Before/after diff */}
                      {entry.before && entry.after && (
                        <details className="mt-2">
                          <summary className="text-[10px] font-bold text-slate-400 uppercase tracking-wider cursor-pointer">
                            View change diff
                          </summary>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div className="bg-red-50 border border-red-100 rounded-lg p-2">
                              <p className="text-[10px] font-bold text-red-400 uppercase mb-1">Before</p>
                              <pre className="text-[10px] text-red-700 font-mono whitespace-pre-wrap">
                                {JSON.stringify(entry.before, null, 2)}
                              </pre>
                            </div>
                            <div className="bg-green-50 border border-green-100 rounded-lg p-2">
                              <p className="text-[10px] font-bold text-green-400 uppercase mb-1">After</p>
                              <pre className="text-[10px] text-green-700 font-mono whitespace-pre-wrap">
                                {JSON.stringify(entry.after, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 shrink-0 flex justify-between items-center">
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
            {entries.length} audit event{entries.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
