export interface TimeoutConfig {
  initial_delay_ms: number;
  max_delay_ms: number;
  max_retries: number;
}

export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  initial_delay_ms: 1000,
  max_delay_ms: 60000,
  max_retries: 3,
};

export function calculateBackoffDelay(retry_count: number, config: TimeoutConfig): number {
  const delay = config.initial_delay_ms * Math.pow(2, retry_count);
  return Math.min(delay, config.max_delay_ms);
}

export async function waitWithTimeout<T>(
  promise: Promise<T>,
  timeout_ms: number,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeout_ms}ms`));
    }, timeout_ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: TimeoutConfig = DEFAULT_TIMEOUT_CONFIG,
): Promise<T> {
  for (let attempt = 0; attempt <= config.max_retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === config.max_retries) {
        throw error;
      }

      const delay = calculateBackoffDelay(attempt, config);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry exhausted');
}
