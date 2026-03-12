/**
 * LoadingSkeleton.tsx — Skeleton loading components (Phase 2)
 *
 * Provides branded placeholder UIs while Firestore data loads.
 * All skeletons use the same `animate-pulse` Tailwind utility so they
 * feel consistent throughout the app.
 */

import React from 'react';
import { Skeleton as Shimmer } from './Skeleton';

// ─── Request Table Row Skeleton ────────────────────────────────────────────────

export const RequestRowSkeleton: React.FC = () => (
  <tr aria-busy="true" aria-label="Loading request…">
    <td className="px-6 py-4">
      <Shimmer className="h-4 w-24" />
    </td>
    <td className="px-6 py-4">
      <Shimmer className="h-4 w-32 mb-1" />
      <Shimmer className="h-3 w-20" />
    </td>
    <td className="px-6 py-4">
      <Shimmer className="h-5 w-16 rounded-full" />
    </td>
    <td className="px-6 py-4">
      <Shimmer className="h-4 w-20" />
    </td>
  </tr>
);

// ─── Request List Skeleton (wraps N row skeletons) ────────────────────────────

export const RequestListSkeleton: React.FC<{ rows?: number; title?: string }> = ({
  rows = 4,
  title = 'Loading…',
}) => (
  <div
    className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden"
    role="status"
    aria-label={title}
  >
    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
      <Shimmer className="h-5 w-40" />
      <Shimmer className="h-5 w-12 rounded" />
    </div>
    <table className="w-full text-sm" aria-hidden="true">
      <thead className="bg-slate-50">
        <tr>
          {['Type', 'Patient', 'Status', 'Submitted'].map((col) => (
            <th key={col} className="px-6 py-3 text-left">
              <Shimmer className="h-3 w-16" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {Array.from({ length: rows }).map((_, i) => (
          <RequestRowSkeleton key={i} />
        ))}
      </tbody>
    </table>
    <span className="sr-only">Loading requests, please wait…</span>
  </div>
);

// ─── Stats Card Skeleton (Dashboard summary tiles) ────────────────────────────

export const StatCardSkeleton: React.FC = () => (
  <div
    className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm"
    aria-busy="true"
    aria-hidden="true"
  >
    <Shimmer className="h-4 w-28 mb-3" />
    <Shimmer className="h-8 w-12" />
  </div>
);

// ─── Dashboard Skeleton ───────────────────────────────────────────────────────

export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6" role="status" aria-label="Loading dashboard…">
    <div>
      <Shimmer className="h-7 w-56 mb-2" />
      <Shimmer className="h-4 w-72" />
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
    <RequestListSkeleton title="Loading requests…" rows={3} />
    <span className="sr-only">Loading dashboard, please wait…</span>
  </div>
);

// ─── Audit Log Row Skeleton ───────────────────────────────────────────────────

export const AuditLogRowSkeleton: React.FC = () => (
  <div className="px-6 py-3 flex items-center gap-4 border-b border-slate-50 last:border-0" aria-hidden="true">
    {/* Action badge */}
    <Shimmer className="h-5 w-24 rounded-full shrink-0" />
    {/* Resource ID */}
    <Shimmer className="h-4 w-32 hidden sm:block shrink-0" />
    {/* Actor */}
    <Shimmer className="h-4 w-44 flex-1 hidden md:block" />
    {/* Timestamp */}
    <Shimmer className="h-4 w-20 ml-auto shrink-0" />
  </div>
);

// ─── Audit Log Skeleton ───────────────────────────────────────────────────────

export const AuditLogSkeleton: React.FC<{ rows?: number }> = ({ rows = 8 }) => (
  <div role="status" aria-label="Loading audit log entries…">
    {Array.from({ length: rows }).map((_, i) => (
      <AuditLogRowSkeleton key={i} />
    ))}
    <span className="sr-only">Loading audit log, please wait…</span>
  </div>
);

// ─── Analytics Skeleton ────────────────────────────────────────────────────────

export const AnalyticsSkeleton: React.FC = () => (
  <div className="space-y-6" role="status" aria-label="Loading analytics…">
    {/* 4 KPI stat cards */}
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>

    {/* Approval rate card */}
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4" aria-hidden="true">
      <Shimmer className="w-16 h-16 rounded-2xl shrink-0" />
      <div className="flex-1">
        <Shimmer className="h-4 w-32 mb-2" />
        <Shimmer className="h-3 w-56" />
      </div>
    </div>

    {/* Charts row */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Trend chart placeholder */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6" aria-hidden="true">
        <Shimmer className="h-4 w-48 mb-4" />
        <div className="flex items-end gap-1 h-32">
          {Array.from({ length: 30 }).map((_, i) => (
            <Shimmer
              key={i}
              className="flex-1 rounded-t"
              style={{ height: `${20 + Math.sin(i * 0.7) * 15 + (i % 5) * 8}%` } as React.CSSProperties}
            />
          ))}
        </div>
      </div>
      {/* Status breakdown placeholder */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4" aria-hidden="true">
        <Shimmer className="h-4 w-40 mb-2" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <div className="flex justify-between mb-1">
              <Shimmer className="h-3 w-16" />
              <Shimmer className="h-3 w-12" />
            </div>
            <Shimmer className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    </div>

    {/* KPI targets table */}
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" aria-hidden="true">
      <div className="px-6 py-4 border-b border-slate-100">
        <Shimmer className="h-4 w-36" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="px-6 py-3 flex items-center gap-4 border-b border-slate-50 last:border-0">
          <div className="flex-1">
            <Shimmer className="h-3 w-48 mb-1.5" />
            <Shimmer className="h-3 w-64" />
          </div>
          <Shimmer className="h-3 w-20 shrink-0" />
          <Shimmer className="h-5 w-16 rounded-full shrink-0" />
        </div>
      ))}
    </div>

    <span className="sr-only">Loading analytics, please wait…</span>
  </div>
);

// ─── Messaging Contact Skeleton ───────────────────────────────────────────────

export const ContactSkeleton: React.FC = () => (
  <div className="p-4 flex items-center gap-3 border-b border-slate-100/50" aria-hidden="true">
    <Shimmer className="w-10 h-10 rounded-full flex-shrink-0" />
    <div className="flex-1">
      <Shimmer className="h-4 w-28 mb-1" />
      <Shimmer className="h-3 w-16" />
    </div>
  </div>
);
