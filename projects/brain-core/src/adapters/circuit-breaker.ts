export type CircuitState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. */
  failureThreshold: number;
  /** Number of consecutive successes required in half-open state to close the circuit. */
  successThreshold: number;
  /** Milliseconds to wait in open state before moving to half-open. */
  timeout: number;
  /** Optional callback invoked on every state transition. */
  onStateChange?: (state: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private readonly config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.isTimeoutExpired()) {
        this.transitionTo('half-open');
        this.successCount = 0;
      } else {
        throw new Error(`Circuit breaker is open. Retry in ${this.getTimeRemaining()}ms`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.successCount = 0;
        this.transitionTo('closed');
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === 'half-open' || this.failureCount >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(next: CircuitState): void {
    this.state = next;
    this.config.onStateChange?.(next);
  }

  private isTimeoutExpired(): boolean {
    if (this.lastFailureTime === null) return false;
    return Date.now() - this.lastFailureTime >= this.config.timeout;
  }

  private getTimeRemaining(): number {
    if (this.lastFailureTime === null) return 0;
    return Math.max(0, this.config.timeout - (Date.now() - this.lastFailureTime));
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  /** Reset to closed state — useful for testing or manual operator recovery. */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}
