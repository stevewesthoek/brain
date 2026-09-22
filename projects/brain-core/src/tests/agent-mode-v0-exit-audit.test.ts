import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AgentModeOrganizationDelegationOrchestrator, K5_B_FIXTURE_DELEGATION_RULES } from '../agent-mode/organization-delegation-orchestrator.js';
import { AgentModeOrganizationFinalizer } from '../agent-mode/organization-finalization.js';
import { createK5AFixturePlan, deriveOrganizationPlanId } from '../agent-mode/organization.js';
import { JarvisReadableResultService, JarvisResponseFinalizer, deriveJarvisResponseFinalizationOperationId } from '../agent-mode/jarvis-response-finalizer.js';
import { JARVIS_READABLE_RESULT_OWNER, JARVIS_READABLE_RESULT_SCHEMA_VERSION, JARVIS_READABLE_RESULT_TYPE, deriveJarvisReadableResultContentHash } from '../agent-mode/jarvis-response-sources.js';
import { deriveJarvisRootGoalId, JarvisTextIntakeService } from '../agent-mode/jarvis-text-intake.js';
import { denyVoiceControlIntent, FixtureSpeechToTextProvider, type VoiceInputRequestV1 } from '../agent-mode/jarvis-voice-gateway.js';
import { MOCK_AGENT_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { SPAWN_POLICY_READ_ONLY, SPAWN_ROLE_READ_ONLY } from '../agent-mode/spawn-policy.js';

const NOW = '2026-09-15T10:00:00.000Z';
const DEADLINE = '2026-09-15T12:00:00.000Z';
const SUPERVISOR = 'agent:jarvis';
const SUPERVISOR_RUN = 'run:jarvis:v0-d-audit';

function rootFacts(rootGoalId: string, now: string) {
  return {
    now,
    globalKillSwitchDenied: false,
    rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active' as const, remainingSteps: 1_000, remainingBudget: 2, deadline: DEADLINE, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: { agentId: SUPERVISOR, taskId: rootGoalId, runId: SUPERVISOR_RUN, rootGoalId, depth: 0, cancellation: 'active' as const, delegableCapabilities: ['repo.read'], repositoryScopes: ['brain'], resourceScopes: [] },
  };
}

class FakeCanonicalSpeechTransport {
  invocationCount = 0;
  lastText: string | undefined;

  speak(response: { speakerRole: 'jarvis'; status: 'published'; text: string }): void {
    assert.equal(response.speakerRole, 'jarvis');
    assert.equal(response.status, 'published');
    this.invocationCount += 1;
    this.lastText = response.text;
  }
}

test('V0 exit fixture composes fixture STT, durable intake, K5, Jarvis response, and replaceable speech', async () => {
  const root = mkdtempSync(path.join('/tmp', 'brain-v0-d-exit-'));
  const databasePath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  try {
    const voiceInput: VoiceInputRequestV1 = {
      schemaVersion: 1,
      voiceRequestId: 'voice-request:v0-d-audit',
      sessionId: 'voice-session:v0-d-audit',
      inputMode: 'push_to_talk',
      audioRef: 'fixture://voice/hello-jarvis',
      capturedAt: NOW,
    };
    const stt = new FixtureSpeechToTextProvider('fixture-stt-v0-d');
    const transcript = await stt.transcribe(voiceInput);
    const intake = new JarvisTextIntakeService(store, () => NOW).acceptCommand({
      schemaVersion: 'agent-mode.jarvis-text-intake.v1',
      intakeId: 'intake:v0-d-audit',
      source: 'voice',
      operatorId: 'operator:v0-d-audit',
      text: transcript.text,
      receivedAt: NOW,
    });
    assert.equal(intake.outcome, 'accepted', JSON.stringify(intake));
    if (intake.outcome !== 'accepted') return;
    const rootGoalId = deriveJarvisRootGoalId(intake.receipt.intakeId);
    assert.equal(intake.receipt.rootGoalId, rootGoalId);
    assert.equal(intake.receipt.taskId, rootGoalId);

    store.upsertAgent({ agentId: SUPERVISOR, agentKind: 'jarvis', role: 'supervisor', displayName: 'Jarvis / CEO', policyId: SPAWN_POLICY_READ_ONLY, status: 'active', rootGoalId, roleTemplateId: SPAWN_ROLE_READ_ONLY, roleTemplateVersion: 1, policyVersion: 1, depth: 0, repositoryScope: 'brain', resourceScope: null, capabilitySetHash: 'v0-d-supervisor', capabilities: ['repo.read'] });
    assert.equal(store.createRun({ runId: SUPERVISOR_RUN, taskId: rootGoalId, agentId: SUPERVISOR, createdAt: NOW, status: 'created' }), 'created');
    const plan = createK5AFixturePlan({ rootGoalId, supervisorAgentId: SUPERVISOR, createdAt: NOW, deadline: DEADLINE });
    const planId = deriveOrganizationPlanId(plan);
    assert.equal(store.createOrganizationPlan(plan, NOW).result, 'created');

    const runtime = new MockAgentRuntime({ runtimeRef: MOCK_AGENT_RUNTIME_REF, routeRef: 'route:fixture', modelRef: 'model:fixture', modelResult: { kind: 'typed-fixture-result', traceId: 'v0-d-audit', intent: { kind: 'no-outbox', relativePath: 'README.md' } } });
    const controller = new AgentModeOrganizationDelegationOrchestrator({ store, runtime, now: NOW, controllerRef: 'controller:v0-d-audit', supervisorTaskId: rootGoalId, supervisorRunId: SUPERVISOR_RUN, rootFacts: (candidate, now) => candidate === rootGoalId ? rootFacts(rootGoalId, now) : undefined, rules: K5_B_FIXTURE_DELEGATION_RULES });
    const firstPass = await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    assert.equal(firstPass.outcome, 'ADVANCED');
    await controller.advanceOrganizationPlanOnce({ organizationPlanId: planId, maxWorkItems: 4 });
    assert.equal(runtime.dispatchInvocationCount, 3);

    const finalization = new AgentModeOrganizationFinalizer(store, () => NOW).finalizeOrganizationPlanOnce({ organizationPlanId: planId, now: NOW });
    assert.equal(finalization.outcome, 'FINALIZED', JSON.stringify(finalization));
    assert.equal(finalization.finalResult?.status, 'succeeded');
    const finalResultRef = finalization.finalResult!.organizationFinalResultId;
    const readable = {
      schemaVersion: JARVIS_READABLE_RESULT_SCHEMA_VERSION,
      resultRef: finalResultRef,
      rootGoalId,
      taskId: rootGoalId,
      owner: JARVIS_READABLE_RESULT_OWNER,
      resultType: JARVIS_READABLE_RESULT_TYPE,
      facts: finalization.finalResult!.workItemResults.map((item) => ({ factId: `fact:${item.workItemKey}`, workItemKey: item.workItemKey, text: `The ${item.workItemKey} stage completed under the bounded voice-originated goal.`, evidenceRefs: [...item.evidenceRefs] })),
      contentHash: '',
      createdAt: NOW,
    };
    assert.equal(new JarvisReadableResultService(store).publish({ ...readable, contentHash: deriveJarvisReadableResultContentHash(readable) }).outcome, 'published');
    const identity = { rootGoalId, taskId: rootGoalId, sourceResultRef: finalResultRef };
    const response = new JarvisResponseFinalizer(store).finalize({ schemaVersion: 'agent-mode.jarvis-response-finalization.v1', ...identity, operationId: deriveJarvisResponseFinalizationOperationId(identity), requestedAt: NOW });
    assert.equal(response.outcome, 'PUBLISHED', JSON.stringify(response));

    const speech = new FakeCanonicalSpeechTransport();
    speech.speak(response.response!);
    assert.equal(speech.invocationCount, 1);
    assert.equal(speech.lastText, response.response!.text);
    assert.equal(store.listJarvisIntakes().length, 1);
    assert.equal(store.getAgent(SUPERVISOR)?.agentId, SUPERVISOR);
    assert.equal(store.getTask(rootGoalId)?.taskType, 'root.goal');
    assert.equal(store.listJarvisUserResponses().length, 1);
    assert.equal(store.listAgents().filter((agent) => agent.spawnIntentKey).length, 3);
    assert.equal(store.listTasks().filter((task) => task.taskType !== 'root.goal').length, 3);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('voice control approval phrases remain non-authoritative', () => {
  for (const intent of ['approve', 'reject'] as const) {
    const decision = denyVoiceControlIntent({ schemaVersion: 1, voiceRequestId: 'voice-request:v0-d-control', sessionId: 'voice-session:v0-d-control', intent, explicit: true });
    assert.equal(decision.outcome, 'DENIED');
    assert.equal(decision.controlServiceCalls, 0);
  }
});
