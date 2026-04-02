import { logger } from "../services/logger";

/**
 * Retries an async operation with exponential backoff on transient errors.
 * Gives up after maxAttempts and re-throws the last error.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  label: string,
  maxAttempts = 3,
  baseDelayMs = 300
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn("retryWithBackoff", `${label} attempt ${attempt} failed, retrying in ${delay}ms`, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
