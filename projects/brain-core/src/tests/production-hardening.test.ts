/**
 * Tests for production-hardening infrastructure:
 *   - circuit-breaker
 *   - retry-logic
 *   - error-recovery
 *   - observability (metrics + logger)
 *   - alerting
 *   - /api/health route
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

import { CircuitBreaker } from '../adapters/circuit-breaker.js';

test('CircuitBreaker: starts in closed state', () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, successThreshold: 2, timeout: 1000 });
  assert.equal(cb.getState(), 'closed');
});

test('CircuitBreaker: opens after failureThreshold consecutive failures', async () => {
  const states: string[] = [];
  const cb = new CircuitBreaker({
    failureThreshold: 2,
    successThreshold: 2,
    timeout: 500,
    onStateChange: s => states.push(s),
  });

  const fail = () => Promise.reject(new Error('boom'));

  await assert.rejects(() => cb.execute(fail), /boom/);
  assert.equal(cb.getState(), 'closed'); // 1 failure, not yet open

  await assert.rejects(() => cb.execute(fail), /boom/);
  assert.equal(cb.getState(), 'open'); // 2 failures — threshold reached
  assert.deepEqual(states, ['open']);
});

test('CircuitBreaker: rejects immediately when open (before timeout)', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeout: 60_000 });

  await assert.rejects(() => cb.execute(() => Promise.reject(new Error('initial'))), /initial/);
  assert.equal(cb.getState(), 'open');

  await assert.rejects(
    () => cb.execute(() => Promise.resolve('should not run')),
    /Circuit breaker is open/,
  );
});

test('CircuitBreaker: moves to half-open after timeout expires', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeout: 10 });

  await assert.rejects(() => cb.execute(() => Promise.reject(new Error('trip'))), /trip/);
  assert.equal(cb.getState(), 'open');

  // Wait for timeout
  await new Promise(resolve => setTimeout(resolve, 30));

  // Next call should be tried (half-open)
  const result = await cb.execute(() => Promise.resolve('recovered'));
  assert.equal(result, 'recovered');
  assert.equal(cb.getState(), 'closed');
});

test('CircuitBreaker: returns to open from half-open on failure', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 2, timeout: 10 });

  await assert.rejects(() => cb.execute(() => Promise.reject(new Error('trip'))), /trip/);
  await new Promise(resolve => setTimeout(resolve, 30)); // wait for timeout → half-open

  await assert.rejects(() => cb.execute(() => Promise.reject(new Error('half-open fail'))), /half-open fail/);
  assert.equal(cb.getState(), 'open');
});

test('CircuitBreaker: reset() restores to closed state', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeout: 60_000 });

  await assert.rejects(() => cb.execute(() => Promise.reject(new Error('trip'))));
  assert.equal(cb.getState(), 'open');

  cb.reset();
  assert.equal(cb.getState(), 'closed');
  assert.equal(cb.getFailureCount(), 0);
});

test('CircuitBreaker: success in closed state resets failure counter', async () => {
  const cb = new CircuitBreaker({ failureThreshold: 3, successThreshold: 1, timeout: 1000 });

  await assert.rejects(() => cb.execute(() => Promise.reject(new Error('x'))));
  await assert.rejects(() => cb.execute(() => Promise.reject(new Error('x'))));
  assert.equal(cb.getFailureCount(), 2);

  await cb.execute(() => Promise.resolve('ok'));
  assert.equal(cb.getFailureCount(), 0);
  assert.equal(cb.getState(), 'closed');
});

// ---------------------------------------------------------------------------
// Retry logic
// ---------------------------------------------------------------------------

import { retryWithBackoff } from '../adapters/retry-logic.js';

test('retryWithBackoff: returns immediately on first-attempt success', async () => {
  let calls = 0;
  const result = await retryWithBackoff(
    async () => { calls++; return 'done'; },
    { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2, jitterFraction: 0 },
  );
  assert.equal(result, 'done');
  assert.equal(calls, 1);
});

test('retryWithBackoff: retries on failure and succeeds', async () => {
  let calls = 0;
  const result = await retryWithBackoff(
    async () => {
      calls++;
      if (calls < 3) throw new Error('not yet');
      return 'success';
    },
    { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2, jitterFraction: 0 },
  );
  assert.equal(result, 'success');
  assert.equal(calls, 3);
});

test('retryWithBackoff: throws after maxAttempts exhausted', async () => {
  let calls = 0;
  const config = { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 5, backoffMultiplier: 2, jitterFraction: 0 };
  await assert.rejects(
    () => retryWithBackoff(async () => { calls++; throw new Error('always fails'); }, config),
    /always fails/,
  );
  assert.equal(calls, 3);
});

test('retryWithBackoff: calls onRetry with attempt number, error, and delay', async () => {
  const retryLog: Array<{ attempt: number; msg: string }> = [];
  const config = { maxAttempts: 3, initialDelayMs: 1, maxDelayMs: 10, backoffMultiplier: 2, jitterFraction: 0 };

  await assert.rejects(
    () => retryWithBackoff(
      async () => { throw new Error('retry-test'); },
      config,
      (attempt, error) => { retryLog.push({ attempt, msg: error.message }); },
    ),
    /retry-test/,
  );

  assert.equal(retryLog.length, 2); // called before attempts 2 and 3
  assert.equal(retryLog[0]?.attempt, 1);
  assert.equal(retryLog[1]?.attempt, 2);
});

// ---------------------------------------------------------------------------
// Error recovery
// ---------------------------------------------------------------------------

import {
  ErrorRecoveryRegistry,
  buildErrorContext,
  defaultRecoveryRegistry,
} from '../adapters/error-recovery.js';

test('ErrorRecoveryRegistry: executes registered handler', async () => {
  const registry = new ErrorRecoveryRegistry();
  let called = false;

  registry.register('test_error', async (_err, ctx) => {
    called = true;
    assert.equal(ctx.operation, 'upload');
  });

  const err = new Error('oops');
  const ctx = buildErrorContext('upload', 'video-1', 'agent-a', err, 'transient');
  await registry.recover('test_error', err, ctx);

  assert.equal(called, true);
  assert.equal(ctx.recoveryAction, 'successful');
});

test('ErrorRecoveryRegistry: marks recoveryAction "failed" when handler throws', async () => {
  const registry = new ErrorRecoveryRegistry();
  registry.register('bad_handler', async () => { throw new Error('handler exploded'); });

  const err = new Error('original');
  const ctx = buildErrorContext('op', 'res', 'actor', err, 'critical');
  await registry.recover('bad_handler', err, ctx);

  assert.equal(ctx.recoveryAction, 'failed');
});

test('ErrorRecoveryRegistry: no-ops for unregistered error types', async () => {
  const registry = new ErrorRecoveryRegistry();
  const err = new Error('unknown');
  const ctx = buildErrorContext('op', 'res', 'actor', err, 'transient');
  await registry.recover('no_such_type', err, ctx);
  assert.equal(ctx.recoveryAction, undefined);
});

test('buildErrorContext: populates all fields', () => {
  const err = new Error('test error');
  const ctx = buildErrorContext('my-op', 'my-resource', 'my-actor', err, 'degraded');

  assert.equal(ctx.operation, 'my-op');
  assert.equal(ctx.resource, 'my-resource');
  assert.equal(ctx.actor, 'my-actor');
  assert.equal(ctx.severity, 'degraded');
  assert.equal(ctx.message, 'test error');
  assert.ok(ctx.timestamp);
});

test('defaultRecoveryRegistry: has expected built-in handlers', () => {
  assert.equal(defaultRecoveryRegistry.has('database_connection_failed'), true);
  assert.equal(defaultRecoveryRegistry.has('api_rate_limited'), true);
  assert.equal(defaultRecoveryRegistry.has('video_upload_failed'), true);
});

// ---------------------------------------------------------------------------
// Observability — MetricsCollector
// ---------------------------------------------------------------------------

import { MetricsCollector, StructuredLogger } from '../adapters/observability.js';

test('MetricsCollector: recordMetric stores a metric', () => {
  const mc = new MetricsCollector();
  mc.recordMetric('http_requests', 1, 'count', { method: 'GET' });

  const metrics = mc.getMetrics();
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0]?.name, 'http_requests');
  assert.equal(metrics[0]?.value, 1);
  assert.equal(metrics[0]?.unit, 'count');
  assert.equal(metrics[0]?.tags['method'], 'GET');
});

test('MetricsCollector: recordLatency records ms metric', () => {
  const mc = new MetricsCollector();
  mc.recordLatency('db_query', 42);

  const metrics = mc.getMetrics({ name: 'operation_latency' });
  assert.equal(metrics.length, 1);
  assert.equal(metrics[0]?.value, 42);
  assert.equal(metrics[0]?.tags['operation'], 'db_query');
});

test('MetricsCollector: recordError stores error count metric', () => {
  const mc = new MetricsCollector();
  mc.recordError('timeout', 'transient');

  const m = mc.getMetrics({ name: 'errors' });
  assert.equal(m.length, 1);
  assert.equal(m[0]?.tags['type'], 'timeout');
  assert.equal(m[0]?.tags['severity'], 'transient');
});

test('MetricsCollector: recordApproval records decision and latency', () => {
  const mc = new MetricsCollector();
  mc.recordApproval('approved', 5);

  const decisions = mc.getMetrics({ name: 'approval_decision' });
  const latencies = mc.getMetrics({ name: 'approval_latency' });
  assert.equal(decisions.length, 1);
  assert.equal(latencies.length, 1);
  assert.equal(latencies[0]?.value, 5);
  assert.equal(latencies[0]?.tags['status'], 'approved');
});

test('MetricsCollector: getMetrics filters by name', () => {
  const mc = new MetricsCollector();
  mc.recordMetric('a', 1, 'count');
  mc.recordMetric('b', 2, 'count');
  mc.recordMetric('a', 3, 'count');

  const aOnly = mc.getMetrics({ name: 'a' });
  assert.equal(aOnly.length, 2);
});

test('MetricsCollector: getMetrics filters by since date', async () => {
  const mc = new MetricsCollector();
  mc.recordMetric('early', 1, 'count');

  // cutoff is 1ms after 'early' was recorded — guarantees 'early' is excluded
  await new Promise(resolve => setTimeout(resolve, 5));
  const cutoff = new Date();
  await new Promise(resolve => setTimeout(resolve, 5));
  mc.recordMetric('late', 2, 'count');

  const recent = mc.getMetrics({ since: cutoff });
  assert.equal(recent.length, 1);
  assert.equal(recent[0]?.name, 'late');
});

test('MetricsCollector: clear() removes all metrics', () => {
  const mc = new MetricsCollector();
  mc.recordMetric('x', 1, 'count');
  mc.clear();
  assert.equal(mc.getMetrics().length, 0);
});

test('StructuredLogger: log() emits valid JSON', () => {
  const lines: string[] = [];
  const logger = new StructuredLogger();

  // Temporarily override console.log to capture output
  const original = console.log;
  console.log = (line: string) => lines.push(line);
  try {
    logger.info('test message', { requestId: '123' });
  } finally {
    console.log = original;
  }

  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0] ?? '{}') as Record<string, unknown>;
  assert.equal(parsed['level'], 'info');
  assert.equal(parsed['message'], 'test message');
  assert.equal(parsed['requestId'], '123');
  assert.ok(parsed['timestamp']);
});

// ---------------------------------------------------------------------------
// Alerting
// ---------------------------------------------------------------------------

import {
  AlertManager,
  ConsoleAlertChannel,
  type Alert,
} from '../adapters/alerting.js';

test('AlertManager: raiseAlert returns alert with correct fields', async () => {
  const am = new AlertManager();
  const alert = await am.raiseAlert('critical', 'DB down', 'Connection refused');

  assert.equal(alert.severity, 'critical');
  assert.equal(alert.title, 'DB down');
  assert.equal(alert.message, 'Connection refused');
  assert.ok(alert.id.startsWith('alert-'));
  assert.ok(alert.timestamp);
  assert.equal(alert.resolved, undefined);
});

test('AlertManager: getActiveAlerts returns only unresolved alerts', async () => {
  const am = new AlertManager();
  const a1 = await am.raiseAlert('warning', 'Slow query', 'p99 > 500ms');
  const a2 = await am.raiseAlert('info', 'Deploy started', 'v1.2.0');

  await am.resolveAlert(a1.id);

  const active = am.getActiveAlerts();
  assert.equal(active.length, 1);
  assert.equal(active[0]?.id, a2.id);
});

test('AlertManager: resolveAlert marks alert resolved with timestamp', async () => {
  const am = new AlertManager();
  const alert = await am.raiseAlert('critical', 'Title', 'Msg');
  const resolved = await am.resolveAlert(alert.id);

  assert.equal(resolved, true);

  const all = am.getAllAlerts();
  const found = all.find(a => a.id === alert.id);
  assert.equal(found?.resolved, true);
  assert.ok(found?.resolvedAt);
});

test('AlertManager: resolveAlert returns false for unknown id', async () => {
  const am = new AlertManager();
  const result = await am.resolveAlert('alert-nonexistent');
  assert.equal(result, false);
});

test('AlertManager: channel receives alert on raiseAlert', async () => {
  const received: Alert[] = [];
  const am = new AlertManager();
  am.registerChannel('warning', {
    name: 'test-channel',
    async send(alert) { received.push(alert); },
  });

  await am.raiseAlert('warning', 'Watch out', 'High memory');
  assert.equal(received.length, 1);
  assert.equal(received[0]?.title, 'Watch out');
});

test('AlertManager: channel error does not propagate to caller', async () => {
  const am = new AlertManager();
  am.registerChannel('info', {
    name: 'broken-channel',
    async send() { throw new Error('channel broken'); },
  });

  // Should not throw
  await assert.doesNotReject(() => am.raiseAlert('info', 'Test', 'Msg'));
});

test('ConsoleAlertChannel: name is "console"', () => {
  const ch = new ConsoleAlertChannel();
  assert.equal(ch.name, 'console');
});

// ---------------------------------------------------------------------------
// /api/health route
// ---------------------------------------------------------------------------

import { routeRequest } from '../api/routes.js';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function makeRequest(method: string, path: string): IncomingMessage {
  return {
    socket: { remoteAddress: '127.0.0.1' },
    method,
    url: path,
  } as unknown as IncomingMessage;
}

test('GET /api/health returns 200 with health report shape', async () => {
  const response = new MockResponse();
  await routeRequest(makeRequest('GET', '/api/health'), response as unknown as ServerResponse);

  assert.equal(response.statusCode, 200);

  const body = JSON.parse(response.body) as {
    ok: boolean;
    timestamp: string;
    service: string;
    externalServices: Record<string, string>;
    activeAlerts: number;
  };

  assert.equal(body.ok, true);
  assert.equal(body.service, 'brain-core');
  assert.ok(body.timestamp);
  assert.ok(typeof body.activeAlerts === 'number');
  assert.ok('n8n' in body.externalServices);
  assert.ok('studio' in body.externalServices);
});
