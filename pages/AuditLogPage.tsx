/**
 * AuditLogPage.tsx — Phase 5: Admin audit log viewer
 *
 * Provides a paginated, filterable view of the Firestore audit_log collection.
 * HIPAA Security Rule §164.312(b) requires audit controls and periodic review.
 * This page satisfies the "monthly review of audit logs" requirement from §8.
 *
 * The audit log is append-only (written by Cloud Functions) — no mutations
 * can be made from this interface.
 *
 * Admin only — non-admin users are redirected in App.tsx routing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { firebaseService } from '../services/firebaseService';
import { AuditLogEntry, AuditAction } from '../types';
import { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import { AuditLogSkeleton } from '../components/ui/LoadingSkeleton';
import { logger } from '../services/logger';

// ─── Action label map ─────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  'request.create':       'Request Created',
  'request.approve':      'Request Approved',
  'request.deny':         'Request Denied',
  'request.rmi':          'Request — More Info',
  'request.update':       'Request Updated',
  'staff.create':         'Staff Created',
  'staff.update':         'Staff Updated',
  'staff.suspend':        'Staff Suspended',
  'communication.create': 'Message Sent',
  'invitation.create':    'Invitation Sent',
  'invitation.revoke':    'Invitation Revoked',
  'auth.login':           'Login',
  'auth.logout':          'Logout',
};

const ACTION_COLORS: Record<string, string> = {
  'request.approve':      'bg-green-100 text-green-700',
  'request.deny':         'bg-red-100 text-red-700',
  'request.rmi':          'bg-amber-100 text-amber-700',
  'request.create':       'bg-blue-100 text-blue-700',
  'staff.suspend':        'bg-red-100 text-red-700',
  'auth.login':           'bg-slate-100 text-slate-600',
  'auth.logout':          'bg-slate-100 text-slate-600',
  'communication.create': 'bg-purple-100 text-purple-700',
  'invitation.create':    'bg-teal-100 text-teal-700',
  'invitation.revoke':    'bg-orange-100 text-orange-700',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS) as AuditAction[];

// ─── Row Component ─────────────────────────────────────────────────────────────

const AuditRow: React.FC<{ entry: AuditLogEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const label = ACTION_LABELS[entry.action] ?? entry.action;
  const colorClass = ACTION_COLORS[entry.action] ?? 'bg-slate-100 text-slate-600';
  const ts = entry.timestamp
    ? new Date(entry.timestamp).toLocaleString()
    : '—';

  const hasDiff = entry.before !== undefined || entry.after !== undefined;

  return (
    <div className="border-b border-slate-50 last:border-0">
      <div
        className={`px-6 py-3 flex items-center gap-4 text-sm ${hasDiff ? 'cursor-pointer hover:bg-slate-50' : ''}`}
        onClick={() => hasDiff && setExpanded((o) => !o)}
        role={hasDiff ? 'button' : undefined}
        aria-expanded={hasDiff ? expanded : undefined}
        tabIndex={hasDiff ? 0 : undefined}
        onKeyDown={(e) => { if (hasDiff && (e.key === 'Enter' || e.key === ' ')) setExpanded((o) => !o); }}
      >
        {/* Action badge */}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${colorClass}`}>
          {label}
        </span>

        {/* Resource ID */}
        <span className="font-mono text-xs text-slate-500 truncate hidden sm:block w-48 shrink-0">
          {entry.resourceId ? entry.resourceId.slice(0, 14) + (entry.resourceId.length > 14 ? '…' : '') : '—'}
        </span>

        {/* Actor */}
        <span className="text-xs text-slate-500 truncate flex-1 hidden md:block">
          Actor: <span className="font-mono">{entry.actorId.slice(0, 10)}…</span>
          <span className="ml-2 text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">{entry.actorRole}</span>
        </span>

        {/* Timestamp */}
        <span className="text-xs text-slate-500 shrink-0 ml-auto">{ts}</span>

        {/* Expand chevron */}
        {hasDiff && (
          <svg
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>

      {/* Expanded diff */}
      {expanded && hasDiff && (
        <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {entry.before !== undefined && (
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase mb-1">Before</p>
              <pre className="text-xs bg-red-50 border border-red-100 text-red-800 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(entry.before, null, 2)}
              </pre>
            </div>
          )}
          {entry.after !== undefined && (
            <div>
              <p className="text-[10px] font-bold text-slate-600 uppercase mb-1">After</p>
              <pre className="text-xs bg-green-50 border border-green-100 text-green-800 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap">
                {JSON.stringify(entry.after, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AuditLogPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filterAction, setFilterAction] = useState<AuditAction | ''>('');

  const load = useCallback(async (action: AuditAction | '', append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const { entries: newEntries, cursor: newCursor } = await firebaseService.getAuditLog(
        50,
        append ? (cursor ?? undefined) : undefined,
        action || undefined
      );
      setEntries((prev) => append ? [...prev, ...newEntries] : newEntries);
      setCursor(newCursor);
      setHasMore(newCursor !== null);
    } catch (err) {
      setError('Failed to load audit log. Ensure you have admin access and Firestore rules are deployed.');
      logger.error('AuditLogPage', 'Failed to load audit log', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor]);

  // Initial load
  useEffect(() => {
    load(filterAction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (action: AuditAction | '') => {
    setFilterAction(action);
    setCursor(null);
    load(action, false);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Audit Log</h2>
        <p className="text-slate-600 mt-1">
          Immutable record of all system actions. Review monthly per HIPAA §164.312(b).
          This log is written by Cloud Functions — no client-side mutations are possible.
        </p>
      </div>

      {/* HIPAA reminder banner */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
        <svg className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-700">
          Access to this log is restricted to admin accounts and is itself logged. Quarterly access
          reviews should compare this log against the active staff roster to identify anomalous patterns.
        </p>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-2 items-center">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
        <button
          onClick={() => handleFilterChange('')}
          className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${filterAction === '' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          All Actions
        </button>
        {ALL_ACTIONS.map((action) => (
          <button
            key={action}
            onClick={() => handleFilterChange(action)}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${filterAction === action ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {ACTION_LABELS[action]}
          </button>
        ))}
      </div>

      {/* Log table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-slate-100 flex items-center gap-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-1">Action</span>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider w-48 hidden sm:block">Resource ID</span>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-1 hidden md:block">Actor</span>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-auto">Timestamp</span>
        </div>

        {loading ? (
          <AuditLogSkeleton rows={8} />
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-slate-500 text-sm">No audit log entries found.</p>
            <p className="text-slate-500 text-xs mt-1">Entries are created by Cloud Functions as actions occur in production.</p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          {loadingMore ? (
            <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <AuditLogSkeleton rows={5} />
            </div>
          ) : (
            <button
              onClick={() => load(filterAction, true)}
              className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Load more entries
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-slate-500 text-center pb-4">
        Showing {entries.length} entries. Audit log is append-only — no data can be modified or deleted.
      </p>
    </div>
  );
};
