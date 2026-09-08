import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';

const NOW = '2026-09-08T00:01:00.000Z';

test('missing Agent Mode state is explicit and observation creates no directory or database', () => {
  const root = mkdtempSync(path.join('/tmp', 'brain-k0-4-observer-missing-'));
  const stateDir = path.join(root, 'missing-state');
  try {
    const projection = readAgentModeObserver(NOW, path.join(stateDir, 'agent-mode.db'));
    assert.equal(projection.availability, 'unavailable');
    assert.equal(projection.source, 'agent-mode-state-store');
    assert.equal(projection.summary.executionSource, 'none');
    assert.equal(existsSync(stateDir), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('existing observer reads are side-effect-free and redact proof/path payloads', () => {
  const root = mkdtempSync(path.join('/tmp', 'brain-k0-4-observer-read-'));
  const dbPath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(dbPath);
  store.upsertAgent({ agentId: 'agent:observer', agentKind: 'worker', role: 'observer-test', displayName: 'Observer', policyId: 'policy:test', status: 'active' });
  store.recordEvent({
    eventId: 'event:secret', entityType: 'attempt', entityId: 'attempt:missing', eventType: 'fixture_event', occurredAt: NOW,
    payload: { authProof: 'do-not-expose', credential: 'also-secret', absolutePath: '/Users/Office/private.txt', safe: 'visible' },
  });
  store.close();
  const before = statSync(dbPath).mtime.getTime();
  try {
    const projection = readAgentModeObserver(NOW, dbPath);
    const after = statSync(dbPath).mtime.getTime();
    assert.equal(projection.availability, 'available');
    assert.equal(after, before);
    assert.equal(projection.events.length, 1);
    const payload = projection.events[0]?.payload as Record<string, unknown>;
    assert.equal(payload.safe, 'visible');
    assert.equal(payload.authProof, '[redacted]');
    assert.equal(payload.credential, '[redacted]');
    assert.equal(payload.absolutePath, '[redacted]');
    assert.equal(JSON.stringify(projection).includes('do-not-expose'), false);
    assert.equal(JSON.stringify(projection).includes('/Users/Office/private.txt'), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('observer represents cancellation, uncertain recovery, stale fencing, and stable event identity', () => {
  const root = mkdtempSync(path.join('/tmp', 'brain-k0-4-observer-recovery-'));
  const dbPath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(dbPath);
  store.admitAttempt({
    task: { taskId: 'task:observer', taskType: 'fixture', inputHash: 'input', createdAt: '2026-09-08T00:00:00.000Z' },
    run: { runId: 'run:observer', taskId: 'task:observer', agentId: 'agent:observer', createdAt: '2026-09-08T00:00:00.000Z' },
    attempt: { attemptId: 'attempt:observer', runId: 'run:observer', agentId: 'agent:observer', runtimeRef: 'runtime:test', routeRef: 'route:test', modelRef: 'model:test', policyVersion: 'policy:test', capabilityScopeHash: 'scope:test', budgetScopeId: 'budget:observer', createdAt: '2026-09-08T00:00:00.000Z' },
    budget: { budgetScopeId: 'budget:observer', maxSteps: 2, maxTokens: 10, maxDollars: 1 },
    estimate: { reservationId: 'reservation:observer', steps: 1, tokens: 1, dollars: 0.01 },
    lease: { leaseId: 'lease:observer', resourceKey: 'resource:observer', ownerId: 'agent:observer', expiresAt: '2099-09-09T00:00:00.000Z' },
    now: '2026-09-08T00:00:00.000Z',
  });
  store.requestCancellation({ requestId: 'cancel:observer', attemptId: 'attempt:observer', requestedAt: NOW });
  store.recordEvent({ eventId: 'event:duplicate', entityType: 'attempt', entityId: 'attempt:observer', eventType: 'progress', occurredAt: NOW, payload: { step: 1 } });
  assert.equal(store.recordEvent({ eventId: 'event:duplicate', entityType: 'attempt', entityId: 'attempt:observer', eventType: 'progress', occurredAt: NOW, payload: { step: 1 } }), 'duplicate');
  store.admitAttempt({
    task: { taskId: 'task:uncertain', taskType: 'fixture', inputHash: 'uncertain-input', createdAt: '2026-09-08T00:00:00.000Z' },
    run: { runId: 'run:uncertain', taskId: 'task:uncertain', agentId: 'agent:observer', createdAt: '2026-09-08T00:00:00.000Z' },
    attempt: { attemptId: 'attempt:uncertain', runId: 'run:uncertain', agentId: 'agent:observer', runtimeRef: 'runtime:test', routeRef: 'route:test', modelRef: 'model:test', policyVersion: 'policy:test', capabilityScopeHash: 'scope:uncertain', budgetScopeId: 'budget:uncertain', createdAt: '2026-09-08T00:00:00.000Z' },
    budget: { budgetScopeId: 'budget:uncertain', maxSteps: 2, maxTokens: 10, maxDollars: 1 },
    estimate: { reservationId: 'reservation:uncertain', steps: 1, tokens: 1, dollars: 0.01 },
    lease: { leaseId: 'lease:uncertain', resourceKey: 'resource:uncertain', ownerId: 'agent:observer', expiresAt: '2099-09-09T00:00:00.000Z' },
    now: '2026-09-08T00:00:00.000Z',
  });
  store.prepareOperation({ operationId: 'operation:uncertain', attemptId: 'attempt:uncertain', effectKind: 'capability.read', capabilityId: 'repo.read', grantId: 'grant:test', scopeHash: 'scope:uncertain', policyVersion: 'policy:test', leaseResourceKey: 'resource:uncertain', leaseId: 'lease:uncertain', leaseFence: 1, deadline: '2099-09-10T00:00:00.000Z', preparedAt: NOW });
  store.markDispatched('operation:uncertain', NOW);
  store.markEffectObserved('operation:uncertain', NOW);
  store.admitAttempt({
    task: { taskId: 'task:stale', taskType: 'fixture', inputHash: 'stale-input', createdAt: '2026-09-08T00:00:00.000Z' },
    run: { runId: 'run:stale', taskId: 'task:stale', agentId: 'agent:observer', createdAt: '2026-09-08T00:00:00.000Z' },
    attempt: { attemptId: 'attempt:stale', runId: 'run:stale', agentId: 'agent:observer', runtimeRef: 'runtime:test', routeRef: 'route:test', modelRef: 'model:test', policyVersion: 'policy:test', capabilityScopeHash: 'scope:stale', budgetScopeId: 'budget:stale', createdAt: '2026-09-08T00:00:00.000Z' },
    budget: { budgetScopeId: 'budget:stale', maxSteps: 2, maxTokens: 10, maxDollars: 1 },
    estimate: { reservationId: 'reservation:stale', steps: 1, tokens: 1, dollars: 0.01 },
    lease: { leaseId: 'lease:stale', resourceKey: 'resource:stale', ownerId: 'agent:observer', expiresAt: '2099-09-09T00:00:00.000Z' },
    now: '2026-09-08T00:00:00.000Z',
  });
  assert.equal(store.releaseLease('resource:stale', 'lease:stale', 1), true);
  assert.equal(store.acquireLease({ leaseId: 'lease:stale:new', resourceKey: 'resource:stale', ownerId: 'agent:new', expiresAt: '2099-09-09T00:00:00.000Z' })?.fence, 2);
  store.close();
  try {
    const first = readAgentModeObserver(NOW, dbPath);
    const second = readAgentModeObserver(NOW, dbPath);
    assert.equal(first.events.filter((event) => event.eventId === 'event:duplicate').length, 1);
    assert.deepEqual(first.events, second.events);
    assert.equal(first.attempts.find((attempt) => attempt.attemptId === 'attempt:observer')?.cancellationStatus, 'requested');
    assert.equal(first.recovery.find((item) => item.attemptId === 'attempt:observer')?.classification, 'cancelled_ack_pending');
    assert.equal(first.recovery.find((item) => item.attemptId === 'attempt:uncertain')?.classification, 'uncertain_non_idempotent_effect');
    assert.equal(first.recovery.find((item) => item.attemptId === 'attempt:stale')?.classification, 'stale_fenced_writer');
    const staleAttempt = first.attempts.find((attempt) => attempt.attemptId === 'attempt:stale');
    assert.equal((staleAttempt?.lease as { current?: boolean } | undefined)?.current, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
