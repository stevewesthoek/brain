export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  /** Fraction (0–1) of the current delay to randomise as jitter. */
  jitterFraction: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  jitterFraction: 0.2,
};

/**
 * Retry `fn` up to `config.maxAttempts` times with exponential backoff + jitter.
 *
 * `onRetry` is called before each retry delay so callers can log or record metrics.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void,
): Promise<T> {
  let lastError: Error | null = null;
  let delayMs = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < config.maxAttempts) {
        const jitter = delayMs * config.jitterFraction * Math.random();
        const actualDelayMs = Math.min(delayMs + jitter, config.maxDelayMs);

        onRetry?.(attempt, lastError, actualDelayMs);
        await sleep(actualDelayMs);

        delayMs = Math.min(delayMs * config.backoffMultiplier, config.maxDelayMs);
      }
    }
  }

  throw lastError ?? new Error('Retry exhausted');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
