/**
 * ErrorBoundary.tsx — React Error Boundary (Phase 2)
 *
 * Catches unhandled render errors so the entire app does not white-screen.
 * Shows a branded fallback UI with a "Reload page" button and an option to
 * copy the error details for reporting.
 *
 * HIPAA note: stack traces are shown only in development builds (import.meta.env.DEV).
 * In production, only a generic message is displayed to avoid leaking internals.
 */

import React from 'react';
import { logger } from '../../services/logger';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional custom fallback. Receives the error object. */
  fallback?: (error: Error) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, copied: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.critical('ErrorBoundary', 'Uncaught render error', error, {
      componentStack: import.meta.env.DEV ? info.componentStack : undefined,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReportIssue = () => {
    const { error } = this.state;
    const context = [
      `Error: ${error?.message ?? 'Unknown'}`,
      `Time: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `UA: ${navigator.userAgent}`,
    ].join('\n');
    navigator.clipboard.writeText(context).then(
      () => { this.setState({ copied: true }); setTimeout(() => this.setState({ copied: false }), 2000); },
      () => { /* clipboard unavailable — ignore */ }
    );
    logger.error('ErrorBoundary', 'User reported issue', error ?? undefined, { url: window.location.href });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { error } = this.state;

    if (this.props.fallback && error) {
      return this.props.fallback(error);
    }

    const isDev = import.meta.env.DEV;

    return (
      <div
        role="alert"
        aria-live="assertive"
        className="min-h-screen flex items-center justify-center bg-slate-50 p-6"
      >
        <div className="max-w-lg w-full bg-white rounded-2xl border border-red-100 shadow-xl p-8 text-center">
          {/* Icon */}
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-slate-500 text-sm mb-6">
            An unexpected error occurred in the portal. Your work may not have been saved.
            Please reload the page. If the problem persists, contact IT support.
          </p>

          {isDev && error && (
            <details className="text-left bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs text-red-700 font-mono overflow-auto max-h-40">
              <summary className="font-bold text-slate-700 cursor-pointer mb-2">
                Error details (dev only)
              </summary>
              {error.message}
              {error.stack && (
                <pre className="mt-2 whitespace-pre-wrap text-slate-500">{error.stack}</pre>
              )}
            </details>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={this.handleReset}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={this.handleReportIssue}
              className="px-5 py-2.5 border border-amber-200 bg-amber-50 rounded-xl text-sm font-bold text-amber-700 hover:bg-amber-100 transition-colors"
            >
              {this.state.copied ? 'Copied to Clipboard!' : 'Report Issue'}
            </button>
            <button
              onClick={this.handleReload}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
            >
              Reload Page
            </button>
          </div>

          <p className="text-[10px] text-slate-400 mt-6 uppercase tracking-widest font-medium">
            Parrish Health — Staff Portal v2
          </p>
        </div>
      </div>
    );
  }
}
