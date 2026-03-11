/**
 * logger.ts — Phase 4: Structured error and event logging
 *
 * Provides a single logging interface that:
 *   - In development: logs formatted output to the browser console.
 *   - In production: can be extended to ship logs to Cloud Logging via a
 *     Cloud Function endpoint (not wired yet — requires a BAA-covered logging
 *     sink, configured during the Phase 4 DevOps setup).
 *
 * HIPAA note: log entries must NEVER include raw PHI (patient names, MRNs,
 * DOBs). Use resource IDs and action types; leave clinical content out of
 * structured logs. Actual clinical data lives only in Firestore under
 * access-controlled collections.
 *
 * Log levels follow the Cloud Logging severity scale:
 *   DEBUG < INFO < NOTICE < WARNING < ERROR < CRITICAL
 */

type LogLevel = 'DEBUG' | 'INFO' | 'NOTICE' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface LogEntry {
  level:     LogLevel;
  context:   string;       // Component or service that emitted the log
  message:   string;
  timestamp: string;       // ISO 8601
  metadata?: Record<string, unknown>;  // Never include PHI here
}

const isDev = import.meta.env.DEV;

// Console colour map for development readability
const LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG:    'color: #94a3b8',
  INFO:     'color: #3b82f6',
  NOTICE:   'color: #0d9488',
  WARNING:  'color: #f59e0b; font-weight: bold',
  ERROR:    'color: #ef4444; font-weight: bold',
  CRITICAL: 'color: #ffffff; background: #dc2626; font-weight: bold',
};

function emit(entry: LogEntry): void {
  if (isDev) {
    const style = LEVEL_STYLES[entry.level];
    console.log(
      `%c[${entry.level}] [${entry.context}] ${entry.message}`,
      style,
      entry.metadata ?? ''
    );
    return;
  }

  // Production: structured JSON to stdout (captured by Cloud Logging agent).
  // In a browser context this still goes to the console, but can be intercepted
  // by a service worker or sent to a Cloud Function endpoint in a future sprint.
  console.log(JSON.stringify(entry));
}

function buildEntry(
  level: LogLevel,
  context: string,
  message: string,
  metadata?: Record<string, unknown>
): LogEntry {
  return {
    level,
    context,
    message,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const logger = {
  debug(context: string, message: string, metadata?: Record<string, unknown>): void {
    if (!isDev) return; // Strip debug logs from production builds
    emit(buildEntry('DEBUG', context, message, metadata));
  },

  info(context: string, message: string, metadata?: Record<string, unknown>): void {
    emit(buildEntry('INFO', context, message, metadata));
  },

  notice(context: string, message: string, metadata?: Record<string, unknown>): void {
    emit(buildEntry('NOTICE', context, message, metadata));
  },

  warn(context: string, message: string, metadata?: Record<string, unknown>): void {
    emit(buildEntry('WARNING', context, message, metadata));
  },

  error(
    context: string,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const errorMeta: Record<string, unknown> = { ...metadata };
    if (error instanceof Error) {
      errorMeta['error'] = { name: error.name, message: error.message };
      // Stack trace only in dev — never ship raw stacks to production logs
      if (isDev) errorMeta['stack'] = error.stack;
    }
    emit(buildEntry('ERROR', context, message, errorMeta));
  },

  critical(
    context: string,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>
  ): void {
    const errorMeta: Record<string, unknown> = { ...metadata };
    if (error instanceof Error) {
      errorMeta['error'] = { name: error.name, message: error.message };
    }
    emit(buildEntry('CRITICAL', context, message, errorMeta));

    // Phase 5: fire-and-forget Slack alert via Cloud Function endpoint.
    // The endpoint URL is set via VITE_ALERT_ENDPOINT in the environment.
    // If the env var is not set (dev / staging), this is a no-op.
    const alertEndpoint = import.meta.env['VITE_ALERT_ENDPOINT'] as string | undefined;
    if (alertEndpoint && !isDev) {
      fetch(alertEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'critical',
          context,
          message,
          metadata: errorMeta,
        }),
      }).catch(() => {
        // Intentionally silent — alerting must never crash the app
      });
    }
  },

  /**
   * Log a HIPAA-relevant user action for local audit trail supplementation.
   * These are informational only — the authoritative audit log lives in Firestore
   * (written by Cloud Functions, not this client-side logger).
   *
   * @param actorId   Firebase Auth UID of the user taking the action
   * @param action    Action identifier (e.g. 'request.submit', 'report.export')
   * @param resourceId  ID of the affected resource (never PHI)
   */
  audit(actorId: string, action: string, resourceId?: string): void {
    emit(buildEntry('NOTICE', 'AUDIT', `${action}${resourceId ? ` — ${resourceId}` : ''}`, {
      actorId,
      action,
      resourceId,
    }));
  },
};
