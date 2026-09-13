import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeRequest } from '../api/routes.js';
import { readAgentModeObserver, type AgentModeObserverProjection } from '../agent-mode/agent-mode-observer.js';
import { buildAgentModeConsoleProjection, readAgentModeConsoleProjection } from '../agent-mode/agent-mode-console-projection.js';

const NOW = '2026-09-13T12:00:00.000Z';

function fixtureObserver(): AgentModeObserverProjection {
  const root = readAgentModeObserver(NOW, path.join(mkdtempSync(path.join(tmpdir(), 'missing-agent-mode-')), 'missing.db'));
  return {
    ...root,
    availability: 'available',
    persistence: { databasePresent: true },
    agents: [
      { agentId: 'agent:worker', agentKind: 'worker', rootGoalId: 'goal:root', parentAgentId: 'agent:jarvis', roleTemplateId: 'agent-role.read-only.v1', status: 'running', depth: 1, childCreatedAt: NOW, secret: 'must-not-project' },
      { agentId: 'agent:jarvis', agentKind: 'jarvis', rootGoalId: 'goal:root', parentAgentId: null, roleTemplateId: null, status: 'active', depth: 0, childCreatedAt: NOW },
    ],
    tasks: [{ taskId: 'task:worker', status: 'running', createdAt: NOW }],
    runs: [{ runId: 'run:worker', taskId: 'task:worker', agentId: 'agent:worker', status: 'active', createdAt: NOW }],
    attempts: [
      { attemptId: 'attempt:uncertain', runId: 'run:worker', agentId: 'agent:worker', status: 'uncertain', cancellationStatus: 'running', runtimeRef: 'agent-mode.mock-runtime', runtimeProfileRef: 'agent-mode.mock.v1', modelRef: 'deferred:none', createdAt: NOW, updatedAt: NOW },
      { attemptId: 'attempt:cancelled', runId: 'run:cancelled', agentId: 'agent:jarvis', status: 'cancelled', cancellationStatus: 'acknowledged', runtimeRef: 'agent-mode.mock-runtime', runtimeProfileRef: 'agent-mode.mock.v1', modelRef: 'deferred:none', createdAt: NOW, updatedAt: NOW },
    ],
    runtimeDispatches: [{ dispatchId: 'dispatch:worker', attemptId: 'attempt:uncertain', runtimeRef: 'agent-mode.mock-runtime', runtimeProfileRef: 'agent-mode.mock.v1', state: 'uncertain', reconciliationStatus: 'pending', preparedAt: NOW, dispatchedAt: NOW }],
    spawnRootStates: [{ rootGoalId: 'goal:root', policyId: 'policy:root', policyVersion: 1, maxConcurrentChildren: 2, maxTotalChildCreations: 4, maxAggregateChildSteps: 100, maxAggregateChildCost: 4, activeChildren: 1, totalChildCreations: 1, reservedChildSteps: 10, reservedChildCost: 1, depth: 0, cancellation: 'active', deadline: '2026-09-14T12:00:00.000Z', delegableCapabilities: [], repositoryScopes: [], resourceScopes: [], updatedAt: NOW }],
    organizationPlans: [{ organizationPlanId: 'agent-mode.organization-plan:fixture', rootGoalId: 'goal:root', supervisorAgentId: 'agent:jarvis', supervisorOrganizationRoleId: 'agent-mode.org-role.jarvis-ceo.v1', status: 'completed', workItemCount: 3, dependencyCount: 2, finalResultId: 'agent-mode.organization-final-result:fixture', finalStatus: 'succeeded', totalSettledCost: 0, createdAt: NOW, finalizedAt: NOW }],
    organizationWorkItems: [
      { organizationPlanId: 'agent-mode.organization-plan:fixture', workItemId: 'work:research', workItemKey: 'research', organizationRoleId: 'agent-mode.org-role.research.v1', dependencyCount: 0, readiness: 'completed', delegationState: 'succeeded', childAgentId: 'agent:research', taskId: 'task:research', runId: 'run:research', attemptId: 'attempt:research', terminalStatus: 'succeeded', resultRef: 'k4:runtime:receipt-research', evidenceRefCount: 1, settledCost: 0 },
      { organizationPlanId: 'agent-mode.organization-plan:fixture', workItemId: 'work:engineering', workItemKey: 'engineering', organizationRoleId: 'agent-mode.org-role.engineering.v1', dependencyCount: 0, readiness: 'completed', delegationState: 'succeeded', childAgentId: 'agent:engineering', taskId: 'task:engineering', runId: 'run:engineering', attemptId: 'attempt:engineering', terminalStatus: 'succeeded', resultRef: 'k4:runtime:receipt-engineering', evidenceRefCount: 1, settledCost: 0 },
      { organizationPlanId: 'agent-mode.organization-plan:fixture', workItemId: 'work:auditor', workItemKey: 'independent-auditor', organizationRoleId: 'agent-mode.org-role.independent-auditor.v1', dependencyCount: 2, readiness: 'completed', delegationState: 'succeeded', childAgentId: 'agent:auditor', taskId: 'task:auditor', runId: 'run:auditor', attemptId: 'attempt:auditor', terminalStatus: 'succeeded', resultRef: 'k4:runtime:receipt-auditor', evidenceRefCount: 1, settledCost: 0 },
    ],
    organizationExecution: [{ organizationPlanId: 'agent-mode.organization-plan:fixture', rootGoalId: 'goal:root', supervisorAgentId: 'agent:jarvis', readyCount: 0, runningCount: 0, succeededCount: 3, failedCount: 0, cancelledCount: 0, dependencyFailedCount: 0, uncertainCount: 0, settledCost: 0, terminal: true, terminalStatus: 'succeeded', workItems: [] }],
    organizationFinalResults: [{ organizationPlanId: 'agent-mode.organization-plan:fixture', organizationFinalResultId: 'agent-mode.organization-final-result:fixture', status: 'succeeded', aggregateDigest: 'digest:fixture', auditorWorkItemId: 'work:auditor', auditorResultRef: 'k4:runtime:receipt-auditor', workItemResultCount: 3, evidenceRefCount: 3, totalSettledCost: 0, finalizedAt: NOW }],
    reviewRequests: [{ requestId: 'approval:fixture', requestType: 'review', status: 'pending', requestedAt: NOW, updatedAt: NOW }],
    schedulerSchedules: [{ scheduleId: 'schedule:fixture', kind: 'heartbeat', status: 'pending', dueAt: NOW, nextEligibleAt: NOW, completedAt: null, deadLetteredAt: null }],
  };
}

class MockResponse implements ServerResponse {
  statusCode = 0;
  body = '';
  writeHead(statusCode: number): void { this.statusCode = statusCode; }
  end(chunk?: string): void { this.body = chunk ?? ''; }
}

function request(url: string): IncomingMessage {
  return { method: 'GET', url, socket: { remoteAddress: '127.0.0.1' } } as IncomingMessage;
}

test('empty StateStore produces a valid explicit unavailable projection', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'agent-mode-console-empty-'));
  try {
    const projection = readAgentModeConsoleProjection(NOW, path.join(root, 'missing.db'));
    assert.equal(projection.schemaVersion, 'agent-mode-console-v1');
    assert.equal(projection.freshness.status, 'unavailable');
    assert.equal(projection.freshness.sourceStatus, 'unavailable');
    assert.deepEqual(projection.agents, []);
    assert.deepEqual(projection.organizations, []);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('projection joins durable lifecycle state and exposes K5 without secrets', () => {
  const projection = buildAgentModeConsoleProjection(fixtureObserver(), NOW);
  assert.equal(projection.freshness.status, 'fresh');
  assert.equal(projection.summary.activeAgentCount, 2);
  assert.equal(projection.summary.runningTaskCount, 1);
  assert.equal(projection.summary.uncertainCount, 1);
  assert.equal(projection.summary.pendingApprovalCount, 1);
  assert.equal(projection.summary.activeScheduleCount, 1);
  assert.equal(projection.organizations.length, 1);
  assert.equal(projection.organizations[0]?.finalResultId, 'agent-mode.organization-final-result:fixture');
  assert.equal(projection.organizations[0]?.succeededCount, 3);
  assert.equal(projection.organizations[0]?.workItems[2]?.workItemKey, 'research');
  assert.equal(projection.tasks[0]?.rootGoalId, 'goal:root');
  assert.equal(projection.attempts.some((attempt) => attempt.uncertaintyState === 'uncertain'), true);
  assert.equal(projection.failures.some((failure) => failure.status === 'cancelled'), true);
  assert.equal('secret' in projection.agents[0]!, false);
  assert.equal(JSON.stringify(projection).includes('must-not-project'), false);
});

test('projection is deterministically ordered and bounded', () => {
  const observer = fixtureObserver();
  observer.agents = Array.from({ length: 101 }, (_, index) => ({ agentId: `agent:${String(index).padStart(3, '0')}`, agentKind: 'worker', status: index === 100 ? 'completed' : 'running', childCreatedAt: NOW }));
  const first = buildAgentModeConsoleProjection(observer, NOW);
  const second = buildAgentModeConsoleProjection(observer, NOW);
  assert.equal(first.agents.length, 100);
  assert.deepEqual(first, second);
  assert.equal(first.agents[0]?.lifecycleStatus, 'running');
  assert.equal(first.agents.at(-1)?.lifecycleStatus, 'running');
});

test('GET /agent-mode/console is read-only and returns the versioned contract', async () => {
  const previous = process.env.BRAIN_AGENT_MODE_STATE_DIR;
  const root = mkdtempSync(path.join(tmpdir(), 'agent-mode-console-route-'));
  process.env.BRAIN_AGENT_MODE_STATE_DIR = root;
  try {
    const response = new MockResponse();
    await routeRequest(request('/agent-mode/console'), response);
    const body = JSON.parse(response.body) as { schemaVersion: string; source: string; freshness: { status: string } };
    assert.equal(response.statusCode, 200);
    assert.equal(body.schemaVersion, 'agent-mode-console-v1');
    assert.equal(body.source, 'agent-mode-state-store');
    assert.equal(body.freshness.status, 'unavailable');
  } finally {
    if (previous === undefined) delete process.env.BRAIN_AGENT_MODE_STATE_DIR;
    else process.env.BRAIN_AGENT_MODE_STATE_DIR = previous;
    rmSync(root, { recursive: true, force: true });
  }
});
