import type { ErrorSeverity } from './error-recovery.js';

// ---------------------------------------------------------------------------
// Metric types
// ---------------------------------------------------------------------------

export interface Metric {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  tags: Record<string, string>;
}

export interface MetricFilter {
  name?: string;
  since?: Date;
}

// ---------------------------------------------------------------------------
// MetricsCollector
// ---------------------------------------------------------------------------

export class MetricsCollector {
  private readonly metrics: Metric[] = [];

  recordMetric(
    name: string,
    value: number,
    unit: string,
    tags: Record<string, string> = {},
  ): void {
    this.metrics.push({
      name,
      value,
      unit,
      timestamp: new Date().toISOString(),
      tags,
    });
  }

  recordLatency(operation: string, durationMs: number): void {
    this.recordMetric('operation_latency', durationMs, 'ms', { operation });
  }

  recordError(errorType: string, severity: ErrorSeverity): void {
    this.recordMetric('errors', 1, 'count', { type: errorType, severity });
  }

  recordApproval(status: 'approved' | 'rejected', durationMinutes: number): void {
    this.recordMetric('approval_decision', 1, 'count', { status });
    this.recordMetric('approval_latency', durationMinutes, 'minutes', { status });
  }

  getMetrics(filter?: MetricFilter): Metric[] {
    let result = this.metrics;

    if (filter?.name !== undefined) {
      const name = filter.name;
      result = result.filter(m => m.name === name);
    }

    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter(m => new Date(m.timestamp) >= since);
    }

    return result;
  }

  /** Remove all recorded metrics — useful for test isolation. */
  clear(): void {
    this.metrics.length = 0;
  }
}

// ---------------------------------------------------------------------------
// StructuredLogger
// ---------------------------------------------------------------------------

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  [key: string]: unknown;
}

export class StructuredLogger {
  log(level: LogLevel, message: string, context: Record<string, unknown> = {}): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    console.log(JSON.stringify(entry));
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }
}

// ---------------------------------------------------------------------------
// Shared singletons (use these by default; override in tests)
// ---------------------------------------------------------------------------
export const defaultMetrics = new MetricsCollector();
export const defaultLogger = new StructuredLogger();
