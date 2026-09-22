import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import {
  AGENT_MODE_CONTROL_SCHEMA_VERSION,
  AgentModeControlService,
  deriveAgentModeControlOperationId,
  type AgentModeOperatorAttributionV1,
  type AgentModeLifecycleControlCommandV1,
  type AgentModeReviewDecisionCommandV1,
} from '../agent-mode/agent-mode-control-service.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';

const NOW = '2026-09-14T10:00:00.000Z';

function admit(store: AgentModeSqliteStateStore): void {
  store.admitAttempt({
    task: { taskId: 'task:controls-service', taskType: 'agent-mode.controls', inputHash: 'hash', createdAt: NOW },
    run: { runId: 'run:controls-service', taskId: 'task:controls-service', agentId: 'agent:worker', createdAt: NOW },
    attempt: { attemptId: 'attempt:controls-service', runId: 'run:controls-service', agentId: 'agent:worker', runtimeRef: 'runtime:test', routeRef: 'route:test', modelRef: 'model:test', policyVersion: 'test-policy', capabilityScopeHash: 'scope', budgetScopeId: 'budget:controls-service', createdAt: NOW },
    budget: { budgetScopeId: 'budget:controls-service', maxSteps: 4, maxTokens: 5000, maxDollars: 1 },
    estimate: { reservationId: 'reservation:controls-service', steps: 1, tokens: 10, dollars: 0.001 },
    lease: { leaseId: 'lease:controls-service', resourceKey: 'resource:controls-service', ownerId: 'agent:worker', expiresAt: '2026-09-14T11:00:00.000Z' },
    now: NOW,
  });
  store.setRunRuntimePid('run:controls-service', 12345, { startedAt: 'fixture', command: 'brain-agent fixture', token: 'fixture-token' });
}

function lifecycle(action: AgentModeLifecycleControlCommandV1['action'], operationId: string, runId = 'run:controls-service', operator?: AgentModeOperatorAttributionV1): AgentModeLifecycleControlCommandV1 {
  return { schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION, operationId, action, runId, actor: { source: 'operator', actorId: 'operator:fixture' }, requestedAt: NOW, reason: `fixture ${action}`, ...(operator ? { operator } : {}) };
}

function tempStore(): { root: string; store: AgentModeSqliteStateStore; databasePath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-control-service-'));
  const databasePath = path.join(root, 'agent-mode.db');
  return { root, databasePath, store: new AgentModeSqliteStateStore(databasePath) };
}

test('control service applies pause/cancel through StateStore and preserves idempotent receipts', () => {
  const fixture = tempStore();
  try {
    admit(fixture.store);
    const service = new AgentModeControlService(fixture.store, { verifyRuntimeIdentity: () => false });
    const pause = service.pauseRun(lifecycle('pause', 'control:pause', 'run:controls-service', { operatorId: 'operator:fixture', sessionAuditId: 'a'.repeat(64) }));
    assert.equal(pause.outcome, 'completed');
    assert.deepEqual(pause.receipt?.operator, { operatorId: 'operator:fixture', sessionAuditId: 'a'.repeat(64) });
    assert.equal(pause.receipt?.serviceActor, null);
    assert.equal(pause.receipt?.reason, 'fixture pause');
    const audit = readAgentModeObserver(NOW, fixture.databasePath).controlAudits[0];
    assert.equal(audit?.operatorId, 'operator:fixture');
    assert.equal(audit?.targetType, 'run');
    assert.equal(audit?.targetId, 'run:controls-service');
    assert.equal(fixture.store.getRun('run:controls-service')?.status, 'paused');
    const repeated = service.pauseRun(lifecycle('pause', 'control:pause', 'run:controls-service', { operatorId: 'operator:fixture', sessionAuditId: 'a'.repeat(64) }));
    assert.equal(repeated.outcome, 'already_applied');
    const conflicting = service.cancelRun(lifecycle('cancel', 'control:pause'));
    assert.equal(conflicting.outcome, 'conflict');
    assert.equal(fixture.store.getRun('run:controls-service')?.status, 'paused');
    const cancelled = service.cancelRun(lifecycle('cancel', 'control:cancel'));
    assert.equal(cancelled.outcome, 'completed');
    assert.equal(cancelled.receipt?.recoveryCode, 'CONTROLLER_ABSENT_CANCEL_ACKNOWLEDGED');
    assert.equal(fixture.store.getRun('run:controls-service')?.status, 'cancelled');
    assert.equal(fixture.store.listEvents('control:pause').filter((event) => event.eventType === 'agent_mode_control_receipt').length, 1);
  } finally {
    fixture.store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('resume requires verified recorded runtime ownership and never creates a replacement', () => {
  const fixture = tempStore();
  try {
    admit(fixture.store);
    const denied = new AgentModeControlService(fixture.store, { verifyRuntimeIdentity: () => false }).resumeRun(lifecycle('resume', 'control:resume-denied'));
    assert.equal(denied.outcome, 're_admission_required');
    assert.equal(denied.receipt?.recoveryCode, 'RE_ADMISSION_REQUIRED');
    assert.equal(fixture.store.getRun('run:controls-service')?.status, 'active');
    assert.equal(fixture.store.listTasks().length, 1);
    assert.equal(fixture.store.listAttempts().length, 1);
  } finally {
    fixture.store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('kill signals only verified recorded runtime identity and redelivery never signals twice', () => {
  const fixture = tempStore();
  let signals = 0;
  try {
    admit(fixture.store);
    const service = new AgentModeControlService(fixture.store, {
      verifyRuntimeIdentity: () => true,
      signalRuntime: () => { signals += 1; return { sent: true, reasonCode: 'RUNTIME_SIGNAL_SENT' }; },
    });
    const command = lifecycle('kill', 'control:kill');
    const first = service.killRun(command);
    assert.equal(first.outcome, 'completed');
    assert.equal(first.receipt?.signalState, 'sent');
    assert.equal(signals, 1);
    const repeated = service.killRun(command);
    assert.equal(repeated.outcome, 'completed');
    assert.equal(repeated.receipt?.signalState, 'sent');
    assert.equal(signals, 1);
    assert.equal(fixture.store.getRun('run:controls-service')?.status, 'cancelled');
  } finally {
    fixture.store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('unverified kill records durable kill state without signaling and survives restart', () => {
  const fixture = tempStore();
  const command = lifecycle('kill', 'control:kill-unverified');
  try {
    admit(fixture.store);
    const result = new AgentModeControlService(fixture.store, { verifyRuntimeIdentity: () => false, signalRuntime: () => { throw new Error('must not signal'); } }).killRun(command);
    assert.equal(result.outcome, 'runtime_identity_unverified');
    assert.equal(result.receipt?.signalState, 'not_attempted');
    fixture.store.close();
    const reopened = new AgentModeSqliteStateStore(fixture.databasePath);
    try {
      const repeated = new AgentModeControlService(reopened, { verifyRuntimeIdentity: () => true, signalRuntime: () => { throw new Error('must not redeliver'); } }).killRun(command);
      assert.equal(repeated.outcome, 'runtime_identity_unverified');
      assert.equal(reopened.listEvents('control:kill-unverified').filter((event) => event.eventType === 'agent_mode_control_receipt').length, 1);
    } finally {
      reopened.close();
    }
  } finally {
    try { fixture.store.close(); } catch {}
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('review decision service delegates to the existing StateStore review path with trusted actor identity', () => {
  let recorded: AgentModeReviewDecisionCommandV1 | undefined;
  const fakeStore = {
    withTransaction<T>(callback: () => T): T { return callback(); },
    listEvents(): [] { return []; },
    getReviewRequest(): { reviewId: string; workerAgentId: string; status: 'pending' } { return { reviewId: 'review:fixture', workerAgentId: 'agent:worker', status: 'pending' }; },
    recordReviewDecision(decision: { reviewer: string }): 'created' { recorded = { schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION, operationId: 'control:review', reviewId: 'review:fixture', decision: 'approved', actor: { source: 'operator', actorId: decision.reviewer }, decidedAt: NOW, reason: 'fixture approval', evidenceHash: 'hash:fixture' }; return 'created'; },
    recordEvent(): 'created' { return 'created'; },
  } as unknown as AgentModeSqliteStateStore;
  const command: AgentModeReviewDecisionCommandV1 = { schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION, operationId: 'control:review', reviewId: 'review:fixture', decision: 'approved', actor: { source: 'operator', actorId: 'operator:reviewer' }, decidedAt: NOW, reason: 'fixture approval', evidenceHash: 'hash:fixture' };
  const result = new AgentModeControlService(fakeStore).decideReview(command);
  assert.equal(result.outcome, 'completed');
  assert.equal(result.receipt?.decision, 'approved');
  assert.equal(recorded?.reviewId, command.reviewId);
  assert.equal(recorded?.actor.actorId, command.actor.actorId);
});

test('malformed commands fail closed before StateStore mutation', () => {
  const fixture = tempStore();
  try {
    const service = new AgentModeControlService(fixture.store);
    const invalid = service.pauseRun({ ...lifecycle('pause', 'control:invalid'), schemaVersion: 'agent-mode-control-v0' as typeof AGENT_MODE_CONTROL_SCHEMA_VERSION });
    assert.equal(invalid.outcome, 'conflict');
    assert.equal(invalid.reasonCode, 'SCHEMA_VERSION_INVALID');
    assert.equal(fixture.store.listEvents('control:invalid').length, 0);
  } finally {
    fixture.store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('control operation identity is deterministic for the same bounded command material', () => {
  const command = {
    schemaVersion: AGENT_MODE_CONTROL_SCHEMA_VERSION,
    action: 'pause' as const,
    runId: 'run:identity',
    actor: { source: 'operator' as const, actorId: 'operator:fixture' },
    requestedAt: NOW,
    reason: 'fixture pause',
  };
  assert.equal(deriveAgentModeControlOperationId(command), deriveAgentModeControlOperationId({ ...command }));
  assert.notEqual(deriveAgentModeControlOperationId(command), deriveAgentModeControlOperationId({ ...command, action: 'cancel' }));
});
