import { FirebaseError } from 'firebase/app';
import { logger } from '../services/logger';

/**
 * Firestore error codes that indicate a transient failure worth retrying.
 * Permanent errors (permission-denied, not-found, invalid-argument, etc.)
 * are excluded — retrying them would waste time and mask real bugs.
 */
const TRANSIENT_CODES = new Set([
  'unavailable',        // Service temporarily unavailable
  'deadline-exceeded',  // Operation timed out server-side
  'internal',           // Internal server error (often transient)
  'resource-exhausted', // Quota / rate-limit briefly hit
]);

export function isTransient(error: unknown): boolean {
  if (error instanceof FirebaseError) return TRANSIENT_CODES.has(error.code);
  // Generic network errors (fetch failures, offline during the write window)
  if (error instanceof TypeError && error.message.toLowerCase().includes('network')) return true;
  return false;
}

/**
 * Wraps an async operation with exponential backoff + jitter.
 *
 * @param operation   Async function to attempt
 * @param context     Caller label used in log entries (e.g. 'submitRequest')
 * @param maxAttempts Maximum total attempts (default 4 → delays: ~1s, ~2s, ~4s)
 * @param baseDelayMs Base delay in ms before the first retry (default 1000)
 *
 * @throws The last error if all attempts are exhausted or the error is not transient.
 *
 * Example delays with baseDelayMs=1000 and ±20% jitter:
 *   Attempt 2: ~1000ms
 *   Attempt 3: ~2000ms
 *   Attempt 4: ~4000ms
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  context: string,
  maxAttempts = 4,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isTransient(error) || attempt === maxAttempts) {
        // Either a permanent error or we've exhausted retries — surface it.
        if (attempt > 1) {
          logger.error(context, `Failed after ${attempt} attempt(s)`, error);
        }
        throw error;
      }

      // Calculate delay: baseDelay * 2^(attempt-1) with ±20% jitter
      const exponential = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = exponential * 0.2 * (Math.random() * 2 - 1); // -20% to +20%
      const delay = Math.round(exponential + jitter);

      logger.warn(
        context,
        `Transient error on attempt ${attempt}/${maxAttempts} — retrying in ${delay}ms`,
        {
          attempt,
          delay,
          errorCode: error instanceof FirebaseError ? error.code : 'unknown',
        }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
