export type ErrorSeverity = 'transient' | 'degraded' | 'critical';

export interface ErrorContext {
  operation: string;
  resource: string;
  actor: string;
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  recoveryAction?: string;
}

type RecoveryHandler = (error: Error, context: ErrorContext) => Promise<void>;

/**
 * Registry of named recovery handlers keyed by error-type string.
 *
 * Usage:
 *   registry.register('database_connection_failed', async (err, ctx) => { ... });
 *   await registry.recover('database_connection_failed', err, ctx);
 */
export class ErrorRecoveryRegistry {
  private readonly handlers = new Map<string, RecoveryHandler>();

  register(errorType: string, handler: RecoveryHandler): void {
    this.handlers.set(errorType, handler);
  }

  async recover(errorType: string, error: Error, context: ErrorContext): Promise<void> {
    const handler = this.handlers.get(errorType);
    if (!handler) {
      return;
    }

    try {
      await handler(error, context);
      context.recoveryAction = 'successful';
    } catch (recoveryError) {
      context.recoveryAction = 'failed';
      console.error(
        `[error-recovery] Recovery handler for "${errorType}" threw:`,
        recoveryError,
      );
    }
  }

  has(errorType: string): boolean {
    return this.handlers.has(errorType);
  }

  registeredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }
}

/** Convenience factory: builds an ErrorContext from the minimum required fields. */
export function buildErrorContext(
  operation: string,
  resource: string,
  actor: string,
  error: Error,
  severity: ErrorSeverity,
): ErrorContext {
  const ctx: ErrorContext = {
    operation,
    resource,
    actor,
    timestamp: new Date().toISOString(),
    severity,
    message: error.message,
  };

  if (error.stack !== undefined) {
    ctx.stack = error.stack;
  }

  return ctx;
}

// ---------------------------------------------------------------------------
// Shared singleton registry pre-loaded with common recovery strategies.
// ---------------------------------------------------------------------------
export const defaultRecoveryRegistry = new ErrorRecoveryRegistry();

defaultRecoveryRegistry.register('database_connection_failed', async (_error, context) => {
  console.log(`[${context.timestamp}] Attempting database reconnection…`);
  // Actual reconnect logic lives in the adapter that owns the connection.
});

defaultRecoveryRegistry.register('api_rate_limited', async (_error, context) => {
  console.log(`[${context.timestamp}] Rate limited — backing off 5 s…`);
  await new Promise(resolve => setTimeout(resolve, 5_000));
});

defaultRecoveryRegistry.register('video_upload_failed', async (_error, context) => {
  console.log(`[${context.timestamp}] Direct upload failed — routing to n8n fallback…`);
  // Caller is responsible for triggering the actual n8n handoff.
});
