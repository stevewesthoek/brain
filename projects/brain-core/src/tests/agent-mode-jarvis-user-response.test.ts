import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { IncomingMessage, ServerResponse } from 'node:http';
import test from 'node:test';
import { routeRequest } from '../api/routes.js';
import { AgentModeOrganizationDelegationOrchestrator, K5_B_FIXTURE_DELEGATION_RULES } from '../agent-mode/organization-delegation-orchestrator.js';
import { AgentModeOrganizationFinalizer } from '../agent-mode/organization-finalization.js';
import { createK5AFixturePlan, deriveOrganizationPlanId } from '../agent-mode/organization.js';
import { MOCK_AGENT_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import { SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';
import {
  JARVIS_USER_RESPONSE_SCHEMA_VERSION,
  JarvisUserResponseService,
  canonicalJarvisUserResponseText,
  deriveJarvisUserResponseId,
  validateJarvisUserResponsePublication,
} from '../agent-mode/jarvis-user-response.js';

const NOW = '2026-09-15T10:00:00.000Z';
const ROOT_DEADLINE = '2026-09-15T12:00:00.000Z';
const ROOT_GOAL = 'goal:v0-c-response';
const SUPERVISOR = 'agent:jarvis';
const SUPERVISOR_RUN = 'run:jarvis:v0-c';

function rootFacts(now = NOW) {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: ROOT_GOAL, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active' as const, remainingSteps: 1000, remainingBudget: 2, deadline: ROOT_DEADLINE, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: { agentId: SUPERVISOR, taskId: ROOT_GOAL, runId: SUPERVISOR_RUN, rootGoalId: ROOT_GOAL, depth: 0, cancellation: 'active' as const, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
  };
}

async function setup(): Promise<{ store: AgentModeSqliteStateStore; databasePath: string; planId: string; sourceResultRef: string }> {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-v0-c-response-'));
  const databasePath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  store.upsertAgent({ agentId: SUPERVISOR, agentKind: 'jarvis', role: 'supervisor', displayName: 'Jarvis / CEO', policyId: SPAWN_POLICY_READ_ONLY, status: 'active', rootGoalId: ROOT_GOAL, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 0, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'supervisor-capabilities', capabilities: ['repo.read'] });
  assert.equal(store.createTask({ taskId: ROOT_GOAL, taskType: 'root-goal', inputHash: 'root-material', createdAt: NOW, status: 'admitted' }), 'created');
  assert.equal(store.createRun({ runId: SUPERVISOR_RUN, taskId: ROOT_GOAL, agentId: SUPERVISOR, createdAt: NOW, status: 'created' }), 'created');
  const plan = createK5AFixturePlan({ rootGoalId: ROOT_GOAL, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: ROOT_DEADLINE });
  const planId = deriveOrganizationPlanId(plan);
  assert.equal(store.createOrganizationPlan(plan, NOW).result, 'created');
  const runtime = new MockAgentRuntime({
    runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: 'route:deferred', modelRef: 'model:deferred',
    modelResult: { kind: 'typed-fixture-result', traceId: 'v0-c', intent: { kind: 'no-outbox', relativePath: 'README.md' } },
  });
  const controller = new AgentModeOrganizationDelegationOrchestrator({
    store, runtime, now: NOW, controllerRef: 'controller:v0-c', supervisorTaskId: ROOT_GOAL, supervisorRunId: SUPERVISOR_RUN,
    rootFacts: (rootGoalId, now) => rootGoalId === ROOT_GOAL ? rootFacts(now) : undefined,
    rules: K5_B_FIXTURE_DELEGATION_RULES,
  });
  await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
  await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
  const finalized = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId });
  assert.equal(finalized.outcome, 'FINALIZED', JSON.stringify(finalized));
  assert.ok(finalized.finalResult?.organizationFinalResultId);
  return { store, databasePath, planId, sourceResultRef: finalized.finalResult.organizationFinalResultId };
}

class Response implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';
  writeHead(statusCode: number, headers?: Record<string, string>): void { this.statusCode = statusCode; this.headers = headers ?? {}; }
  end(body?: string): void { this.body = body ?? ''; }
}

function getRequest(url: string): IncomingMessage {
  return { method: 'GET', url, socket: { remoteAddress: '127.0.0.1' } } as unknown as IncomingMessage;
}

test('canonical Jarvis response is bounded, Jarvis-owned, and deterministic', () => {
  const input = { schemaVersion: JARVIS_USER_RESPONSE_SCHEMA_VERSION, rootGoalId: ROOT_GOAL, taskId: ROOT_GOAL, jarvisAgentId: 'agent:jarvis' as const, speakerRole: 'jarvis' as const, sourceResultRef: 'organization-final-result:sha256:' + 'a'.repeat(64), text: '  The   organization is complete.  ', createdAt: NOW };
  assert.equal(canonicalJarvisUserResponseText(input.text), 'The organization is complete.');
  assert.equal(validateJarvisUserResponsePublication(input), null);
  const differentText = { ...input, text: 'A different rendering.' };
  assert.equal(deriveJarvisUserResponseId(input), deriveJarvisUserResponseId(differentText));
  assert.equal(validateJarvisUserResponsePublication({ ...input, modelRef: 'provider:model' } as never), 'JARVIS_RESPONSE_INVALID');
  assert.equal(validateJarvisUserResponsePublication({ ...input, speakerRole: 'worker' as never }), 'JARVIS_RESPONSE_OWNER_INVALID');
  assert.equal(validateJarvisUserResponsePublication({ ...input, sourceResultRef: 'k4:runtime:worker' }), 'JARVIS_RESPONSE_SOURCE_INVALID');
  assert.equal(validateJarvisUserResponsePublication({ ...input, text: 'x'.repeat(2_001) }), 'JARVIS_RESPONSE_INVALID');
});

test('durable response publication requires an authoritative organization result and survives reopen', async () => {
  const { store, databasePath, planId, sourceResultRef } = await setup();
  try {
    const input = { schemaVersion: JARVIS_USER_RESPONSE_SCHEMA_VERSION, rootGoalId: ROOT_GOAL, taskId: ROOT_GOAL, jarvisAgentId: 'agent:jarvis' as const, speakerRole: 'jarvis' as const, sourceResultRef, text: 'The bounded organization completed successfully.', createdAt: NOW };
    const service = new JarvisUserResponseService(store);
    const first = service.publish(input);
    assert.equal(first.outcome, 'accepted', JSON.stringify(first));
    assert.equal(store.listJarvisUserResponses().length, 1);
    assert.equal(service.publish(input).outcome, 'duplicate');
    const conflicting = service.publish({ ...input, text: 'A conflicting response.' });
    assert.deepEqual(conflicting, { outcome: 'denied', reasonCode: 'JARVIS_RESPONSE_CONFLICT' });
    store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    try {
      if (first.outcome !== 'accepted') throw new Error(JSON.stringify(first));
      const reopenedResponse = reopened.getJarvisUserResponseForRoot(ROOT_GOAL);
      assert.ok(reopenedResponse);
      assert.equal(reopenedResponse.responseId, first.response.responseId);
      assert.equal(reopenedResponse.text, first.response.text);
      assert.equal(reopenedResponse.textHash, first.response.textHash);
      assert.equal(reopenedResponse.sourceResultRef, sourceResultRef);
      assert.ok(reopenedResponse.materialHash);
      const priorState = process.env.BRAIN_AGENT_MODE_STATE_DIR;
      process.env.BRAIN_AGENT_MODE_STATE_DIR = path.dirname(databasePath);
      try {
        const response = new Response();
        await routeRequest(getRequest(`/agent-mode/jarvis/responses/${encodeURIComponent(ROOT_GOAL)}`), response);
        assert.equal(response.statusCode, 200);
        const payload = JSON.parse(response.body) as { ok: boolean; response: Record<string, unknown> };
        assert.equal(payload.ok, true);
        assert.equal(payload.response.text, input.text);
        assert.equal('materialHash' in payload.response, false);
      } finally { if (priorState === undefined) delete process.env.BRAIN_AGENT_MODE_STATE_DIR; else process.env.BRAIN_AGENT_MODE_STATE_DIR = priorState; }
    } finally { reopened.close(); }
  } finally { try { store.close(); } catch {} rmSync(path.dirname(databasePath), { recursive: true, force: true }); }
});

test('response service denies missing canonical result and non-Jarvis speaker authority', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-v0-c-response-denied-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  try {
    const input = { schemaVersion: JARVIS_USER_RESPONSE_SCHEMA_VERSION, rootGoalId: ROOT_GOAL, taskId: ROOT_GOAL, jarvisAgentId: 'agent:jarvis' as const, speakerRole: 'jarvis' as const, sourceResultRef: 'organization-final-result:sha256:' + 'b'.repeat(64), text: 'This must not publish.', createdAt: NOW };
    assert.equal(new JarvisUserResponseService(store).publish(input).outcome, 'denied');
    assert.equal(validateJarvisUserResponsePublication({ ...input, jarvisAgentId: 'agent:worker' as never }), 'JARVIS_RESPONSE_OWNER_INVALID');
    assert.equal(store.listJarvisUserResponses().length, 0);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
