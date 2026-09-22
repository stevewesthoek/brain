import assert from 'node:assert/strict';
import test from 'node:test';

import {
  acknowledgeCancellation,
  admitAttempt,
  admitOperation,
  canDispatch,
  hashScope,
  reconcileOperation,
  requestCancellation,
  reserveBudget,
  verifyResult,
  type AttemptAdmissionRequest,
  type CapabilityGrant,
  type OperationCommand,
} from '../agent-mode/agent-mode-contracts.js';

const now = '2026-09-08T10:00:00.000Z';
const later = '2026-09-08T11:00:00.000Z';
const scopeHash = hashScope('fixture:/repo:read:HEAD');

function grant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    grantId: 'grant-read-1',
    capabilityId: 'repo.read',
    allowedEffects: ['capability.read'],
    scopeHash,
    policyVersion: 'policy-v1',
    expiresAt: later,
    ...overrides,
  };
}

function attempt(overrides: Partial<AttemptAdmissionRequest> = {}): AttemptAdmissionRequest {
  return {
    agentId: 'agent:jarvis',
    taskId: 'task:fixture',
    runId: 'run:fixture',
    attemptId: 'attempt:fixture-1',
    mode: 'automatic',
    allowedModelRefs: ['model:minimax-m2.5'],
    route: {
      routeKind: 'amazon-bedrock',
      vendor: 'minimax',
      modelRef: 'model:minimax-m2.5',
      invocationRef: 'bedrock:profile:fixture',
      accountRef: 'infra:account:fixture',
      region: 'us-east-1',
      access: { state: 'verified', checkedAt: now, freshUntil: later, source: 'fixture' },
    },
    runtimeRef: 'runtime:fixture',
    capabilityGrants: [grant()],
    budget: {
      maxSteps: 10,
      usedSteps: 0,
      reservedSteps: 0,
      maxTokens: 1000,
      usedTokens: 0,
      reservedTokens: 0,
      maxDollars: 1,
      usedDollars: 0,
      reservedDollars: 0,
    },
    estimate: { steps: 1, tokens: 100, dollars: 0.01 },
    now,
    ...overrides,
  };
}

function readCommand(overrides: Partial<OperationCommand> = {}): OperationCommand {
  return {
    operationId: 'op:read-1',
    attemptId: 'attempt:fixture-1',
    kind: 'capability.read',
    capabilityId: 'repo.read',
    scopeHash,
    policyVersion: 'policy-v1',
    deadline: later,
    ...overrides,
  };
}

test('admits one Jarvis/worker attempt and a read operation, then verifies its result', () => {
  const request = attempt();
  assert.deepEqual(admitAttempt(request), { ok: true, code: 'admitted', reason: 'attempt passed offline admission checks' });
  const reserved = reserveBudget(request.budget, request.estimate);
  assert.equal(reserved.reservedSteps, 1);
  assert.deepEqual(admitOperation(readCommand(), request.capabilityGrants, now).ok, true);
  const verification = verifyResult('result:1', 'evidence:1', 'verifier:fixture', true, now);
  assert.deepEqual(verification, {
    resultRef: 'result:1', evidenceRef: 'evidence:1', verifier: 'verifier:fixture', verifiedAt: now, passed: true,
  });
});

test('rejects model override before dispatch', () => {
  const result = admitAttempt(attempt({ route: { ...attempt().route, modelRef: 'model:glm-5' } }));
  assert.equal(result.code, 'model_not_allowed');
});

test('rejects unknown Codex quota automatically, while requiring an explicit bounded override', () => {
  const base = attempt({
    allowedModelRefs: ['model:codex'],
    route: {
      ...attempt().route,
      routeKind: 'codex-subscription', vendor: 'openai', modelRef: 'model:codex', quotaState: 'unknown',
    },
  });
  assert.equal(admitAttempt(base).code, 'quota_unknown');
  assert.equal(admitAttempt({ ...base, mode: 'human_override', overrideRef: 'approval:1' }).ok, true);
});

test('rejects ungranted tools, indirect shell/child/schedule paths, expired grants, and stale fences', () => {
  const request = attempt();
  assert.equal(admitOperation(readCommand({ kind: 'capability.write' }), request.capabilityGrants, now).code, 'effect_not_granted');
  assert.equal(admitOperation(readCommand({ kind: 'runtime.child' }), request.capabilityGrants, now).code, 'effect_not_granted');
  assert.equal(admitOperation(readCommand({ kind: 'runtime.schedule' }), request.capabilityGrants, now).code, 'effect_not_granted');
  assert.equal(admitOperation(readCommand({ kind: 'runtime.shell' }), request.capabilityGrants, now).code, 'effect_not_granted');
  assert.equal(admitOperation(readCommand(), [grant({ expiresAt: now })], now).code, 'grant_expired');

  const writeGrant = grant({ allowedEffects: ['capability.write'] });
  assert.equal(admitOperation({
    ...readCommand({ kind: 'capability.write' }),
    lease: { resourceRef: 'worktree:1', fence: 1, ownerAttemptId: 'attempt:other', expiresAt: later },
  }, [writeGrant], now, 1).code, 'stale_lease_fence');
  assert.equal(admitOperation({
    ...readCommand({ kind: 'capability.write' }),
    lease: { resourceRef: 'worktree:1', fence: 1, ownerAttemptId: 'attempt:fixture-1', expiresAt: later },
  }, [writeGrant], now, 2).code, 'stale_lease_fence');
  assert.equal(admitOperation({
    ...readCommand({ kind: 'capability.write' }),
    lease: { resourceRef: 'worktree:1', fence: 1, ownerAttemptId: 'attempt:fixture-1', expiresAt: now },
  }, [writeGrant], now, 1).code, 'lease_expired');
});

test('rejects budget exhaustion and reserves within the same bounded budget', () => {
  const request = attempt({ estimate: { steps: 11, tokens: 100, dollars: 0.01 } });
  assert.equal(admitAttempt(request).code, 'budget_exhausted');
  assert.throws(() => reserveBudget(request.budget, request.estimate), /budget exhausted/);
});

test('distinguishes duplicate receipts from uncertain effect outcomes and conflicts', () => {
  const record = { operationId: 'op:read-1', attemptId: 'attempt:fixture-1', scopeHash, status: 'outbox' as const };
  const receipt = { operationId: 'op:read-1', attemptId: 'attempt:fixture-1', scopeHash, effectHash: 'hash:1', status: 'succeeded' as const, recordedAt: now };
  assert.equal(reconcileOperation({ record, effectObserved: false }), 'pending');
  assert.equal(reconcileOperation({ record: { ...record, status: 'effect_applied' }, effectObserved: true }), 'uncertain');
  assert.equal(reconcileOperation({ record, receipt, effectObserved: true }), 'receipt_recorded');
  assert.equal(reconcileOperation({ record: { ...record, receipt }, receipt, effectObserved: true }), 'duplicate');
  assert.equal(reconcileOperation({ record, receipt: { ...receipt, scopeHash: hashScope('other') }, effectObserved: true }), 'conflict');
});

test('cancellation separates requested from acknowledged termination', () => {
  const requested = requestCancellation({ status: 'running' }, now);
  assert.equal(requested.status, 'requested');
  assert.equal(canDispatch(requested), false);
  assert.equal(acknowledgeCancellation(requested, later).status, 'acknowledged');
  assert.equal(requestCancellation({ status: 'completed' }, now).status, 'completed');
});

test('same contract works with different installation roots because paths are not part of admission', () => {
  const first = attempt({ runtimeRef: 'runtime:mac-a', route: { ...attempt().route, accountRef: 'infra:account:a' } });
  const second = attempt({ runtimeRef: 'runtime:linux-b', route: { ...attempt().route, accountRef: 'infra:account:b' } });
  assert.equal(admitAttempt(first).ok, true);
  assert.equal(admitAttempt(second).ok, true);
  assert.equal(JSON.stringify(first).includes('/Users/Office'), false);
  assert.equal(JSON.stringify(second).includes('/home/other-user'), false);
});
