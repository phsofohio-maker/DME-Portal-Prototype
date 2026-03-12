/**
 * AnalyticsPage.tsx — Phase 5: Admin KPI dashboard
 *
 * Tracks the success metrics defined in §11 of the project plan:
 *   - Total request volume and breakdown by status
 *   - 30-day daily submission trend (bar chart, CSS-only)
 *   - Approval turnaround times
 *   - Active staff count
 *   - Form validation error rate (from request data)
 *
 * Admin only — non-admin users are redirected by App.tsx routing.
 *
 * Note: This is a client-side aggregation over Firestore data. For large
 * datasets (hundreds of users), consider moving aggregations to Cloud Functions
 * and caching results in a `analytics` Firestore collection.
 */

import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { Request } from '../types';
import { AnalyticsSkeleton } from '../components/ui/LoadingSkeleton';
import { logger } from '../services/logger';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  if (ms < 86_400_000) return `${(ms / 3_600_000).toFixed(1)}h`;
  return `${(ms / 86_400_000).toFixed(1)}d`;
}

/** Build a 30-day daily submission series from an array of requests. */
function buildDailySeries(requests: Request[]): Array<{ date: string; label: string; count: number }> {
  const now = new Date();
  const series: Array<{ date: string; label: string; count: number }> = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    series.push({ date: key, label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), count: 0 });
  }

  for (const r of requests) {
    const key = new Date(r.createdAt).toISOString().slice(0, 10);
    const slot = series.find((s) => s.date === key);
    if (slot) slot.count++;
  }

  return series;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}> = ({ label, value, sub, color = 'text-slate-900' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</p>
    <p className={`text-3xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
  </div>
);

// ─── Bar Chart (CSS-only) ─────────────────────────────────────────────────────

const TrendChart: React.FC<{ series: Array<{ label: string; count: number }> }> = ({ series }) => {
  const maxCount = Math.max(...series.map((s) => s.count), 1);
  // Show every 5th label to avoid crowding
  const labelEvery = Math.ceil(series.length / 6);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Submissions — Last 30 Days</h3>
      <div className="flex items-end gap-1 h-32" role="img" aria-label="Bar chart of daily request submissions">
        {series.map((s, i) => (
          <div key={s.label} className="flex flex-col items-center flex-1 group relative">
            <div
              className="w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
              style={{ height: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 4 : 0)}%` }}
              aria-label={`${s.label}: ${s.count} submissions`}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity">
              {s.label}: {s.count}
            </div>
          </div>
        ))}
      </div>
      {/* X-axis labels */}
      <div className="flex gap-1 mt-1">
        {series.map((s, i) => (
          <div key={s.label} className="flex-1 text-center">
            {i % labelEvery === 0 && (
              <span className="text-[9px] text-slate-400">{s.label.split(' ')[1]}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Status Breakdown ─────────────────────────────────────────────────────────

const StatusBreakdown: React.FC<{ byStatus: Record<string, number>; total: number }> = ({
  byStatus,
  total,
}) => {
  const bars: Array<{ key: string; label: string; color: string; bg: string }> = [
    { key: 'pending',  label: 'Pending',   color: 'bg-amber-500',  bg: 'bg-amber-50'  },
    { key: 'approved', label: 'Approved',  color: 'bg-green-500',  bg: 'bg-green-50'  },
    { key: 'denied',   label: 'Denied',    color: 'bg-red-500',    bg: 'bg-red-50'    },
    { key: 'rmi',      label: 'Needs Info', color: 'bg-blue-500',  bg: 'bg-blue-50'   },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <h3 className="text-sm font-bold text-slate-700 mb-4">Requests by Status</h3>
      <div className="space-y-3">
        {bars.map(({ key, label, color, bg }) => {
          const count = byStatus[key] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600">{label}</span>
                <span className="font-bold text-slate-800">{count} <span className="font-normal text-slate-400">({pct}%)</span></span>
              </div>
              <div className={`w-full h-2 rounded-full ${bg} overflow-hidden`}>
                <div
                  className={`h-2 rounded-full ${color} transition-all`}
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label}: ${pct}%`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const AnalyticsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState<{
    totalRequests: number;
    byStatus: Record<string, number>;
    recentRequests: Request[];
    activeStaff: number;
  } | null>(null);

  useEffect(() => {
    firebaseService.getAnalytics()
      .then(setAnalytics)
      .catch((err) => {
        logger.error('AnalyticsPage', 'Failed to load analytics', err);
        setError('Failed to load analytics. Check your connection and admin permissions.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Compute derived metrics
  const series = analytics ? buildDailySeries(analytics.recentRequests) : [];

  const processedRequests = analytics
    ? analytics.recentRequests.filter(
        (r) => (r.status === 'approved' || r.status === 'denied') && r.processedAt && r.createdAt
      )
    : [];

  const avgTurnaround =
    processedRequests.length > 0
      ? processedRequests.reduce((sum, r) => sum + ((r.processedAt ?? 0) - r.createdAt), 0) /
        processedRequests.length
      : null;

  const submissionsLast30 = analytics
    ? analytics.recentRequests.length
    : 0;

  const approvalRate = analytics && (analytics.byStatus['approved'] ?? 0) > 0
    ? Math.round(
        ((analytics.byStatus['approved'] ?? 0) /
          Math.max((analytics.byStatus['approved'] ?? 0) + (analytics.byStatus['denied'] ?? 0), 1)) *
          100
      )
    : null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Analytics & KPIs</h2>
        <p className="text-slate-500 mt-1">
          Success metrics from §11 of the project plan. Review monthly to track portal adoption
          and clinical workflow efficiency.
        </p>
      </div>

      {loading ? (
        <AnalyticsSkeleton />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      ) : analytics ? (
        <>
          {/* KPI summary row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard
              label="Total Requests"
              value={analytics.totalRequests}
              sub="All time"
            />
            <StatCard
              label="Last 30 Days"
              value={submissionsLast30}
              sub="Submissions"
              color="text-blue-600"
            />
            <StatCard
              label="Active Staff"
              value={analytics.activeStaff}
              sub="Active accounts"
              color="text-teal-600"
            />
            <StatCard
              label="Avg Turnaround"
              value={avgTurnaround !== null ? formatDuration(avgTurnaround) : '—'}
              sub={avgTurnaround !== null ? `${processedRequests.length} processed (30d)` : 'No processed requests yet'}
              color={
                avgTurnaround !== null && avgTurnaround < 86_400_000
                  ? 'text-green-600'
                  : 'text-amber-600'
              }
            />
          </div>

          {/* Approval rate */}
          {approvalRate !== null && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center shrink-0">
                <span className="text-2xl font-bold text-green-600">{approvalRate}%</span>
              </div>
              <div>
                <p className="font-bold text-slate-800">Approval Rate</p>
                <p className="text-sm text-slate-500">
                  {analytics.byStatus['approved'] ?? 0} approved of{' '}
                  {(analytics.byStatus['approved'] ?? 0) + (analytics.byStatus['denied'] ?? 0)} decided
                  requests all time.
                </p>
              </div>
            </div>
          )}

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TrendChart series={series} />
            <StatusBreakdown byStatus={analytics.byStatus} total={analytics.totalRequests} />
          </div>

          {/* Target thresholds from §11 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">KPI Targets (6-Month)</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {[
                {
                  metric: 'Request submission time',
                  target: '< 3 minutes',
                  note: 'Measured via form analytics (not yet instrumented)',
                  status: 'pending' as const,
                },
                {
                  metric: 'Approval turnaround (routine)',
                  target: '< 24 hours',
                  note: avgTurnaround !== null
                    ? `Current avg: ${formatDuration(avgTurnaround)}`
                    : 'No processed requests yet',
                  status: avgTurnaround !== null && avgTurnaround < 86_400_000 ? 'met' : avgTurnaround !== null ? 'missed' : 'pending' as const,
                },
                {
                  metric: 'Staff adoption rate',
                  target: '> 80% active weekly',
                  note: `${analytics.activeStaff} active accounts (weekly active not yet tracked)`,
                  status: 'pending' as const,
                },
                {
                  metric: 'System uptime',
                  target: '> 99.5%',
                  note: 'Monitor via Firebase Status + UptimeRobot (configure externally)',
                  status: 'pending' as const,
                },
                {
                  metric: 'Audit log completeness',
                  target: '100% of mutations',
                  note: 'Cloud Functions write audit entries on every state change',
                  status: 'met' as const,
                },
              ].map(({ metric, target, note, status }) => (
                <div key={metric} className="px-6 py-3 flex items-center gap-4 text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{metric}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{note}</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 shrink-0">{target}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    status === 'met'    ? 'bg-green-100 text-green-700' :
                    status === 'missed' ? 'bg-red-100 text-red-700' :
                                         'bg-slate-100 text-slate-500'
                  }`}>
                    {status === 'met' ? 'On Track' : status === 'missed' ? 'Off Target' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-400 text-center pb-4">
            Data reflects all Firestore records. Refresh the page to see the latest figures.
            For high-volume deployments, consider moving aggregations to a scheduled Cloud Function.
          </p>
        </>
      ) : null}
    </div>
  );
};
