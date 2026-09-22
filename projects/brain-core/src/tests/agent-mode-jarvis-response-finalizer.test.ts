import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { JarvisTextIntakeService, deriveJarvisRootGoalId } from '../agent-mode/jarvis-text-intake.js';
import { JarvisReadableResultService, JarvisResponseFinalizer, deriveJarvisResponseFinalizationOperationId, JARVIS_RESPONSE_FINALIZATION_SCHEMA_VERSION } from '../agent-mode/jarvis-response-finalizer.js';
import { deriveJarvisReadableResultContentHash, JARVIS_READABLE_RESULT_OWNER, JARVIS_READABLE_RESULT_SCHEMA_VERSION, JARVIS_READABLE_RESULT_TYPE } from '../agent-mode/jarvis-response-sources.js';
import { createK5AFixturePlan, deriveOrganizationPlanId } from '../agent-mode/organization.js';
import { AgentModeOrganizationDelegationOrchestrator, K5_B_FIXTURE_DELEGATION_RULES } from '../agent-mode/organization-delegation-orchestrator.js';
import { AgentModeOrganizationFinalizer } from '../agent-mode/organization-finalization.js';
import { MOCK_AGENT_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';
import { validateJarvisResponseFinalizationRequest } from '../agent-mode/jarvis-response-finalizer.js';
import { JarvisUserResponseService } from '../agent-mode/jarvis-user-response.js';

const NOW = '2026-09-15T10:00:00.000Z';
const DEADLINE = '2026-09-15T12:00:00.000Z';
const INTAKE_ID = 'intake:v0-c1-summary';
const SUPERVISOR = 'agent:jarvis';
const SUPERVISOR_RUN = 'run:jarvis:v0-c1';

function rootFacts(rootGoalId: string, now = NOW) {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active' as const, remainingSteps: 1000, remainingBudget: 2, deadline: DEADLINE, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: { agentId: SUPERVISOR, taskId: rootGoalId, runId: SUPERVISOR_RUN, rootGoalId, depth: 0, cancellation: 'active' as const, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
  };
}

async function setup(): Promise<{ store: AgentModeSqliteStateStore; databasePath: string; rootGoalId: string; finalResultRef: string; runtime: MockAgentRuntime }> {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-v0-c1-finalizer-'));
  const databasePath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  const intake = new JarvisTextIntakeService(store, () => NOW).acceptCommand({ schemaVersion: 'agent-mode.jarvis-text-intake.v1', intakeId: INTAKE_ID, source: 'typed', operatorId: 'operator:v0-c1', text: 'Summarize the completed research.', receivedAt: NOW });
  assert.equal(intake.outcome, 'accepted', JSON.stringify(intake));
  const rootGoalId = deriveJarvisRootGoalId(INTAKE_ID);
  store.upsertAgent({ agentId: SUPERVISOR, agentKind: 'jarvis', role: 'supervisor', displayName: 'Jarvis / CEO', policyId: SPAWN_POLICY_READ_ONLY, status: 'active', rootGoalId, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 0, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'supervisor-capabilities', capabilities: ['repo.read'] });
  assert.equal(store.createRun({ runId: SUPERVISOR_RUN, taskId: rootGoalId, agentId: SUPERVISOR, createdAt: NOW, status: 'created' }), 'created');
  const plan = createK5AFixturePlan({ rootGoalId, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: DEADLINE });
  const planId = deriveOrganizationPlanId(plan);
  assert.equal(store.createOrganizationPlan(plan, NOW).result, 'created');
  const runtime = new MockAgentRuntime({ runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: 'route:fixture', modelRef: 'model:fixture', modelResult: { kind: 'typed-fixture-result', traceId: 'v0-c1', intent: { kind: 'no-outbox', relativePath: 'README.md' } } });
  const controller = new AgentModeOrganizationDelegationOrchestrator({ store, runtime, now: NOW, controllerRef: 'controller:v0-c1', supervisorTaskId: rootGoalId, supervisorRunId: SUPERVISOR_RUN, rootFacts: (candidate, now) => candidate === rootGoalId ? rootFacts(rootGoalId, now) : undefined, rules: K5_B_FIXTURE_DELEGATION_RULES });
  await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
  await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
  const finalized = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId, now: NOW });
  assert.equal(finalized.outcome, 'FINALIZED', JSON.stringify(finalized));
  const finalResultRef = finalized.finalResult!.organizationFinalResultId;
  const finalResult = store.getOrganizationFinalResult(planId)!;
  const readable = {
    schemaVersion: JARVIS_READABLE_RESULT_SCHEMA_VERSION,
    resultRef: finalResultRef,
    rootGoalId,
    taskId: rootGoalId,
    owner: JARVIS_READABLE_RESULT_OWNER,
    resultType: JARVIS_READABLE_RESULT_TYPE,
    facts: finalResult.workItemResults.map((item) => ({
      factId: `fact:${item.workItemKey}`,
      workItemKey: item.workItemKey,
      text: item.workItemKey === 'research'
        ? 'The research review compared the requested material and produced a concise conclusion.'
        : item.workItemKey === 'engineering'
          ? 'The engineering implementation was checked against the bounded requirements.'
          : 'The independent audit verified the research and engineering conclusions.',
      evidenceRefs: [...item.evidenceRefs],
    })),
    contentHash: '',
    createdAt: NOW,
  };
  const record = { ...readable, contentHash: deriveJarvisReadableResultContentHash(readable) };
  const published = new JarvisReadableResultService(store).publish(record);
  assert.equal(published.outcome, 'published', JSON.stringify(published));
  return { store, databasePath, rootGoalId, finalResultRef, runtime };
}

function request(rootGoalId: string, taskId: string, sourceResultRef: string) {
  const identity = { rootGoalId, taskId, sourceResultRef };
  return { schemaVersion: JARVIS_RESPONSE_FINALIZATION_SCHEMA_VERSION, ...identity, operationId: deriveJarvisResponseFinalizationOperationId(identity), requestedAt: NOW } as const;
}

test('deterministic finalizer produces meaningful Jarvis text from bounded authoritative facts', async () => {
  const fixture = await setup();
  try {
    const finalizer = new JarvisResponseFinalizer(fixture.store);
    const first = finalizer.finalize(request(fixture.rootGoalId, fixture.rootGoalId, fixture.finalResultRef));
    assert.equal(first.outcome, 'PUBLISHED', JSON.stringify(first));
    assert.match(first.response!.text, /research review/i);
    assert.match(first.response!.text, /engineering implementation/i);
    assert.doesNotMatch(first.response!.text, /(?:organization-final-result|sha256:|k4:evidence|aggregate digest)/i);
    assert.ok(first.response!.text.length > 40 && first.response!.text.length <= 2_000);
    assert.equal(fixture.runtime.dispatchInvocationCount, 3);
    const replay = finalizer.finalize(request(fixture.rootGoalId, fixture.rootGoalId, fixture.finalResultRef));
    assert.equal(replay.outcome, 'ALREADY_PUBLISHED');
    assert.equal(replay.response!.responseId, first.response!.responseId);
    assert.equal(fixture.store.listJarvisUserResponses().length, 1);
  } finally { fixture.store.close(); rmSync(path.dirname(fixture.databasePath), { recursive: true, force: true }); }
});

test('finalizer requires durable input/result seams and rejects caller authority', async () => {
  const fixture = await setup();
  try {
    const finalizer = new JarvisResponseFinalizer(fixture.store);
    const valid = request(fixture.rootGoalId, fixture.rootGoalId, fixture.finalResultRef);
    assert.equal(validateJarvisResponseFinalizationRequest({ ...valid, text: 'caller override' } as never), 'REQUEST_INVALID');
    assert.equal(validateJarvisResponseFinalizationRequest({ ...valid, modelRef: 'agent-mode/glm-5' } as never), 'REQUEST_INVALID');
    const wrongSource = request(fixture.rootGoalId, fixture.rootGoalId, `organization-final-result:sha256:${'f'.repeat(64)}`);
    assert.deepEqual(finalizer.finalize(wrongSource), { outcome: 'SOURCE_UNAVAILABLE', reasonCode: 'SOURCE_UNAVAILABLE', rootGoalId: fixture.rootGoalId, operationId: wrongSource.operationId, response: null });
    assert.equal(fixture.store.listJarvisUserResponses().length, 0);
  } finally { fixture.store.close(); rmSync(path.dirname(fixture.databasePath), { recursive: true, force: true }); }
});

test('concurrent deterministic finalizers converge on one immutable publication after reopen', async () => {
  const fixture = await setup();
  const valid = request(fixture.rootGoalId, fixture.rootGoalId, fixture.finalResultRef);
  try {
    const results = await Promise.all([new JarvisResponseFinalizer(fixture.store).finalize(valid), new JarvisResponseFinalizer(fixture.store).finalize(valid)]);
    assert.equal(results.filter((result) => result.outcome === 'PUBLISHED').length, 1);
    assert.equal(results.filter((result) => result.outcome === 'ALREADY_PUBLISHED').length, 1);
    assert.equal(fixture.store.listJarvisUserResponses().length, 1);
    fixture.store.close();
    const reopened = new AgentModeSqliteStateStore(fixture.databasePath);
    try {
      const response = reopened.getJarvisUserResponseForRoot(fixture.rootGoalId);
      assert.ok(response);
      assert.equal(response.textHash, results[0]!.response?.textHash ?? results[1]!.response?.textHash);
      assert.equal(new JarvisResponseFinalizer(reopened).finalize(valid).outcome, 'ALREADY_PUBLISHED');
    } finally { reopened.close(); }
  } finally { try { fixture.store.close(); } catch {} rmSync(path.dirname(fixture.databasePath), { recursive: true, force: true }); }
});

test('readable result publisher rejects unlinked evidence and worker-owned response publication', async () => {
  const fixture = await setup();
  try {
    const stored = fixture.store.getJarvisReadableResult(fixture.finalResultRef)!;
    const invalid = { ...stored, resultRef: `organization-final-result:sha256:${'d'.repeat(64)}`, facts: stored.facts.map((fact, index) => index === 0 ? { ...fact, evidenceRefs: ['k4:evidence:not-linked'] } : fact), contentHash: '' };
    const invalidRecord = { ...invalid, contentHash: deriveJarvisReadableResultContentHash(invalid) };
    assert.equal(new JarvisReadableResultService(fixture.store).publish(invalidRecord).outcome, 'denied');
    const workerPublication = new JarvisUserResponseService(fixture.store).publish({ schemaVersion: 'agent-mode.jarvis-user-response.v1', rootGoalId: fixture.rootGoalId, taskId: fixture.rootGoalId, jarvisAgentId: 'agent:worker' as never, speakerRole: 'worker' as never, sourceResultRef: fixture.finalResultRef, text: 'Worker must not speak to the user.', createdAt: NOW });
    assert.deepEqual(workerPublication, { outcome: 'denied', reasonCode: 'JARVIS_RESPONSE_OWNER_INVALID' });
    assert.equal(fixture.store.listJarvisUserResponses().length, 0);
    assert.equal(fixture.store.getJarvisUserResponseForRoot(fixture.rootGoalId), undefined);
  } finally { fixture.store.close(); rmSync(path.dirname(fixture.databasePath), { recursive: true, force: true }); }
});
