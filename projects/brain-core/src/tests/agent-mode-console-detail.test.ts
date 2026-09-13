import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';
import { readAgentModeObserver, type AgentModeObserverProjection } from '../agent-mode/agent-mode-observer.js';
import { AGENT_MODE_CONSOLE_DETAIL_KINDS, buildAgentModeConsoleDetail, readAgentModeConsoleDetail } from '../agent-mode/agent-mode-console-detail.js';
import { createK5AFixturePlan, deriveOrganizationPlanId } from '../agent-mode/organization.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';

const NOW = '2026-09-13T13:00:00.000Z';

class MockResponse implements ServerResponse {
  statusCode = 0;
  body = '';
  writeHead(statusCode: number): void { this.statusCode = statusCode; }
  end(chunk?: string): void { this.body = chunk ?? ''; }
}

function request(url: string): IncomingMessage {
  return { method: 'GET', url, socket: { remoteAddress: '127.0.0.1' } } as IncomingMessage;
}

function fixtureObserver(): AgentModeObserverProjection {
  const missing = path.join(mkdtempSync(path.join(tmpdir(), 'agent-mode-detail-fixture-')), 'missing.db');
  const empty = readAgentModeObserver(NOW, missing);
  return {
    ...empty,
    availability: 'available',
    persistence: { databasePresent: true },
    agents: [
      { agentId: 'agent:jarvis', agentKind: 'jarvis', rootGoalId: 'goal:root', parentAgentId: null, status: 'active', depth: 0, childCreatedAt: NOW },
      { agentId: 'agent:research', agentKind: 'worker', rootGoalId: 'goal:root', parentAgentId: 'agent:jarvis', roleTemplateId: 'agent-role.read-only.v1', status: 'completed', spawnDepth: 1, childCreatedAt: NOW, expiresAt: '2026-09-14T13:00:00.000Z' },
    ],
    tasks: [{ taskId: 'task:research', taskType: 'organization-work-item', taskSpecRef: 'fixture.research.v1', inputHash: 'hash:research', createdAt: NOW, status: 'completed', childAgentId: 'agent:research' }],
    runs: [{ runId: 'run:research', taskId: 'task:research', agentId: 'agent:research', createdAt: NOW, status: 'completed' }],
    attempts: [{ attemptId: 'attempt:research', runId: 'run:research', agentId: 'agent:research', runtimeRef: 'agent-mode.mock-runtime', runtimeProfileRef: 'agent-mode.mock.v1', routeRef: 'mock', modelRef: 'deferred:none', policyVersion: 1, status: 'completed', cancellationStatus: 'running', createdAt: NOW, updatedAt: NOW, budget: { budgetScopeId: 'budget:research', maxSteps: 10, usedSteps: 4, reservedSteps: 0, maxTokens: 100, usedTokens: 20, reservedTokens: 0, maxDollars: 1, usedDollars: 0, reservedDollars: 0 } }],
    runtimeDispatches: [{ operationId: 'operation:research', dispatchId: 'dispatch:research', attemptId: 'attempt:research', runtimeRef: 'agent-mode.mock-runtime', runtimeProfileRef: 'agent-mode.mock.v1', state: 'verified', preparedAt: NOW, dispatchedAt: NOW, reconciliationStatus: 'not_required', receipt: { status: 'succeeded', resultHash: 'result:research', evidenceRef: 'evidence:research', recordedAt: NOW } }],
    operations: [{ operationId: 'operation:research', attemptId: 'attempt:research', state: 'verified', preparedAt: NOW, dispatchedAt: NOW, resultHash: 'result:research', evidenceRef: 'evidence:research' }],
    organizationPlans: [{ organizationPlanId: 'organization:fixture', rootGoalId: 'goal:root', supervisorAgentId: 'agent:jarvis', supervisorOrganizationRoleId: 'agent-mode.org-role.jarvis-ceo.v1', planVersion: 1, status: 'completed', readinessState: 'completed', deadline: '2026-09-14T13:00:00.000Z' }],
    organizationWorkItems: [{ organizationPlanId: 'organization:fixture', workItemId: 'work:research', workItemKey: 'research', organizationRoleId: 'agent-mode.org-role.research.v1', dependencyKeys: [], readiness: 'completed', delegationState: 'succeeded', childAgentId: 'agent:research', taskId: 'task:research', runId: 'run:research', attemptId: 'attempt:research', terminalStatus: 'succeeded', resultRef: 'k4:runtime:result:research', settledCost: 0 }],
    organizationFinalResults: [{ organizationPlanId: 'organization:fixture', organizationFinalResultId: 'final:fixture', status: 'succeeded', aggregateDigest: 'digest:fixture', auditorWorkItemId: 'work:auditor', auditorResultRef: 'k4:runtime:result:auditor', totalSettledCost: 0, finalizedAt: NOW }],
    spawnRootStates: [{ rootGoalId: 'goal:root', maxAggregateChildSteps: 100, reservedChildSteps: 4, maxAggregateChildCost: 4, reservedChildCost: 0, activeChildren: 0, totalChildCreations: 1, cancellation: 'active', deadline: '2026-09-14T13:00:00.000Z', updatedAt: NOW }],
    schedulerSchedules: [{ scheduleId: 'schedule:fixture', kind: 'heartbeat', deduplicationKey: 'fixture', status: 'pending', dueAt: NOW, nextEligibleAt: NOW, attemptCount: 0, maxAttempts: 3, lastFailure: null, deadline: '2026-09-14T13:00:00.000Z', correlationId: 'correlation:fixture', rootGoalId: 'goal:root' }],
    schedulerEvents: [{ eventId: 'event:fixture', scheduleId: 'schedule:fixture', status: 'completed', createdAt: NOW, lastFailure: null, correlationId: 'correlation:fixture' }],
    events: [{ eventId: 'event:attempt', entityType: 'attempt', entityId: 'attempt:research', eventType: 'attempt_completed', occurredAt: NOW, payload: {} }],
  };
}

test('detail projection reconstructs every closed kind from durable observer state', () => {
  const observer = fixtureObserver();
  const ids: Record<(typeof AGENT_MODE_CONSOLE_DETAIL_KINDS)[number], string> = {
    agent: 'agent:research', task: 'task:research', run: 'run:research', attempt: 'attempt:research', organization: 'organization:fixture', budget: 'goal:root', schedule: 'schedule:fixture', failure: 'attempt:research', evidence: 'k4:evidence:evidence:research',
  };
  for (const kind of AGENT_MODE_CONSOLE_DETAIL_KINDS) {
    const result = buildAgentModeConsoleDetail(observer, kind, ids[kind], NOW);
    assert.equal(result.status, 'available', kind);
    assert.equal(result.detail?.kind, kind);
  }
  const organization = buildAgentModeConsoleDetail(observer, 'organization', 'organization:fixture', NOW);
  assert.equal(organization.status, 'available');
  if (organization.status === 'available' && organization.detail.kind === 'organization') {
    assert.equal(organization.detail.workItems[0]?.workItemKey, 'research');
    assert.equal(organization.detail.finalResult?.finalResultId, 'final:fixture');
  }
});

test('detail projection preserves safe cross-links and never exposes raw payloads', () => {
  const observer = fixtureObserver();
  const attempt = buildAgentModeConsoleDetail(observer, 'attempt', 'attempt:research', NOW);
  assert.equal(attempt.status, 'available');
  if (attempt.status === 'available' && attempt.detail.kind === 'attempt') {
    assert.equal(attempt.detail.taskId, 'task:research');
    assert.equal(attempt.detail.evidence[0]?.ownerRunId, 'run:research');
    assert.equal(attempt.detail.evidence[0]?.redactionStatus, 'metadata-only');
    assert.equal(JSON.stringify(attempt).includes('payload'), false);
  }
  const budget = buildAgentModeConsoleDetail(observer, 'budget', 'goal:root', NOW);
  assert.equal(budget.status, 'available');
  if (budget.status === 'available' && budget.detail.kind === 'budget') assert.equal(budget.detail.rootGoalId, 'goal:root');
});

test('not-found, unavailable, invalid-kind, and repeated reads remain explicit and read-only', () => {
  const observer = fixtureObserver();
  const missing = buildAgentModeConsoleDetail(observer, 'agent', 'agent:missing', NOW);
  assert.equal(missing.status, 'not_found');
  if (missing.status === 'not_found') assert.equal(missing.reasonCode, 'DETAIL_NOT_FOUND');
  const root = mkdtempSync(path.join(tmpdir(), 'agent-mode-detail-unavailable-'));
  try {
    const unavailable = readAgentModeConsoleDetail('agent', 'agent:missing', NOW, path.join(root, 'missing.db'));
    assert.equal(unavailable.status, 'unavailable');
    if (unavailable.status === 'unavailable') assert.equal(unavailable.reasonCode, 'STATESTORE_UNAVAILABLE');
  } finally { rmSync(root, { recursive: true, force: true }); }
  assert.equal(JSON.stringify(buildAgentModeConsoleDetail(observer, 'agent', 'agent:research', NOW)), JSON.stringify(buildAgentModeConsoleDetail(observer, 'agent', 'agent:research', NOW)));
});

test('detail route rejects arbitrary kinds and keeps unavailable/not-found bounded', async () => {
  const previous = process.env.BRAIN_AGENT_MODE_STATE_DIR;
  const root = mkdtempSync(path.join(tmpdir(), 'agent-mode-detail-route-'));
  process.env.BRAIN_AGENT_MODE_STATE_DIR = root;
  try {
    const invalid = new MockResponse();
    await routeRequest(request('/agent-mode/console/detail/table/anything'), invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(JSON.parse(invalid.body).error.code, 'invalid_agent_mode_detail_kind');
    const unavailable = new MockResponse();
    await routeRequest(request('/agent-mode/console/detail/agent/agent%3Amissing'), unavailable);
    assert.equal(unavailable.statusCode, 200);
    assert.equal(JSON.parse(unavailable.body).status, 'unavailable');
  } finally {
    if (previous === undefined) delete process.env.BRAIN_AGENT_MODE_STATE_DIR;
    else process.env.BRAIN_AGENT_MODE_STATE_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});

test('detail projection reconstructs the persisted organization graph after StateStore close and reopen', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-mode-detail-restart-'));
  const databasePath = path.join(root, 'state.db');
  const supervisorAgentId = 'agent:jarvis:detail-restart';
  const rootGoalId = 'goal:detail-restart';
  const supervisorRunId = 'run:jarvis:detail-restart';
  const plan = createK5AFixturePlan({ rootGoalId, supervisorAgentId, createdAt: NOW, deadline: '2026-09-14T13:00:00.000Z' });
  const planId = deriveOrganizationPlanId(plan);
  const store = new AgentModeSqliteStateStore(databasePath);
  try {
    store.upsertAgent({ agentId: supervisorAgentId, agentKind: 'jarvis', role: 'supervisor', displayName: 'Jarvis / CEO', policyId: SPAWN_POLICY_READ_ONLY, status: 'active', rootGoalId, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 0, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'detail-restart', capabilities: ['repo.read'] });
    assert.equal(store.createTask({ taskId: rootGoalId, taskType: 'root-goal', inputHash: 'detail-restart', createdAt: NOW, status: 'admitted' }), 'created');
    assert.equal(store.createRun({ runId: supervisorRunId, taskId: rootGoalId, agentId: supervisorAgentId, createdAt: NOW, status: 'created' }), 'created');
    assert.equal(store.createOrganizationPlan(plan, NOW).result, 'created');
  } finally {
    store.close();
  }

  const reopened = new AgentModeSqliteStateStore(databasePath);
  try {
    assert.equal(reopened.getOrganizationPlan(planId)?.supervisorAgentId, supervisorAgentId);
    assert.equal(reopened.listOrganizationWorkItems(planId).length, 3);
  } finally {
    reopened.close();
  }

  try {
    const first = readAgentModeConsoleDetail('organization', planId, NOW, databasePath);
    const second = readAgentModeConsoleDetail('organization', planId, NOW, databasePath);
    assert.equal(first.status, 'available');
    assert.deepEqual(second, first);
    if (first.status === 'available' && first.detail.kind === 'organization') {
      assert.equal(first.detail.rootGoalId, rootGoalId);
      assert.equal(first.detail.supervisorAgentId, supervisorAgentId);
      assert.deepEqual(first.detail.workItems.map((item) => item.workItemKey), ['engineering', 'independent-auditor', 'research']);
      assert.deepEqual(first.detail.workItems.find((item) => item.workItemKey === 'independent-auditor')?.dependencies.map((dependency) => dependency.workItemKey).sort(), ['engineering', 'research']);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
