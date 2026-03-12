/**
 * Skeleton.tsx — Reusable skeleton loading primitive (Phase 2, Block 13)
 *
 * A low-level animated placeholder used to build contextually shaped
 * loading states. All page-level skeletons in LoadingSkeleton.tsx are
 * composed from this base component.
 *
 * Usage:
 *   <Skeleton className="h-4 w-32" />           // text line
 *   <Skeleton className="h-10 w-10 rounded-full" /> // avatar circle
 *   <Skeleton className="h-24 w-full" />         // card block
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
  /** Override the element type (default: div) */
  as?: keyof React.JSX.IntrinsicElements;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  as: Tag = 'div',
  style,
}) => (
  <Tag
    className={`bg-slate-200 rounded animate-pulse ${className}`}
    aria-hidden="true"
    style={style}
  />
);

// ─── Composed helpers ─────────────────────────────────────────────────────────

/** Patient search result row skeleton */
export const PatientRowSkeleton: React.FC = () => (
  <div className="p-3 flex items-center gap-3" aria-hidden="true">
    <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
    <div className="flex-1">
      <Skeleton className="h-4 w-32 mb-1" />
      <Skeleton className="h-3 w-48" />
    </div>
    <Skeleton className="h-5 w-16 rounded-md" />
  </div>
);

/** Message bubble skeleton (used in MessagingPortal) */
export const MessageBubbleSkeleton: React.FC<{ align?: 'left' | 'right' }> = ({
  align = 'left',
}) => (
  <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`} aria-hidden="true">
    <div className="max-w-[70%]">
      <Skeleton
        className={`h-12 rounded-2xl ${align === 'right' ? 'w-48 rounded-tr-none' : 'w-56 rounded-tl-none'}`}
      />
      <Skeleton className={`h-2 w-12 mt-1 ${align === 'right' ? 'ml-auto' : ''}`} />
    </div>
  </div>
);

/** Profile page skeleton */
export const ProfileSkeleton: React.FC = () => (
  <div className="max-w-2xl mx-auto space-y-6" role="status" aria-label="Loading profile…">
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
      <Skeleton className="h-6 w-32 mb-6" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between py-2 border-b border-slate-50">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-36" />
        </div>
      ))}
    </div>
    <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div>
          <Skeleton className="h-4 w-40 mb-1" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-slate-100">
          <div>
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="w-12 h-6 rounded-full" />
        </div>
      ))}
    </div>
    <span className="sr-only">Loading profile, please wait…</span>
  </div>
);
