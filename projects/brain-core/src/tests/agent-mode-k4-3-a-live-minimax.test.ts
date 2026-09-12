import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AgentModeDynamicWorkerOrchestrator, K43A_LIVE_MINIMAX_ACTION_RULE, K43A_LIVE_MINIMAX_ACTION_RULE_ID, K43A_LIVE_MINIMAX_CONTROLLER_REF, K43A_LIVE_MINIMAX_SOURCE_ID } from '../agent-mode/dynamic-worker-orchestrator.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../agent-mode/event-source.js';
import { createK43AModelBridge, K43A_MODEL_ID, K43A_MODEL_REF, K43A_ROUTE_ID, K43A_REGION, deterministicK43AProviderOperationId } from '../agent-mode/k4-3-a-live-minimax.js';
import { ModelGatewayError, type ModelAccessEvidence, type ModelGateway, type NormalizedModelResult } from '../agent-mode/model-gateway.js';
import { RESTRICTED_HARNESS_FIXTURE_TIMEOUT_MS, RESTRICTED_HARNESS_LIVE_MODEL_TIMEOUT_MS, RestrictedHarnessAgentRuntime, K43A_LIVE_EXPECTED_RESPONSE, K43A_LIVE_MODEL_PROMPT } from '../agent-mode/restricted-harness-agent-runtime.js';
import { AgentModeSqliteStateStore, type AgentModeSchedulerEventInput } from '../agent-mode/sqlite-state-store.js';

const NOW = '2026-09-11T10:00:00.000Z';
const ROOT = 'goal:k4-3-a-live';
const DEADLINE = '2026-09-11T11:00:00.000Z';
const HARNESS_ROOT = process.env.BRAIN_D2_HARNESS_ROOT ?? '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';

const evidence: ModelAccessEvidence = {
  version: 'agent-mode-live-access:test', accountRef: 'aws-account:test', region: K43A_REGION,
  modelRef: K43A_MODEL_REF, modelId: K43A_MODEL_ID, routeKind: 'direct', routeId: K43A_ROUTE_ID,
  state: 'verified', catalogVisible: true, callable: true, checkedAt: NOW, freshUntil: DEADLINE,
  source: 'deterministic-test-fixture',
};

function result(request: Parameters<ModelGateway['invoke']>[0]): NormalizedModelResult {
  return {
    text: K43A_LIVE_EXPECTED_RESPONSE, providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId,
    routeKind: request.routeKind, routeId: request.routeId, region: K43A_REGION,
    usage: { inputTokens: 18, outputTokens: 7, totalTokens: 25 },
    cost: { inputPerMillionUsd: 0.3, outputPerMillionUsd: 1.2, estimatedUsd: 0.000014, pricingSource: 'fixture-authoritative-k1-1' },
    stopReason: 'stop', requestId: 'request:test-k43-a', latencyMs: 12, completedAt: NOW,
    accessEvidenceVersion: evidence.version, operationId: request.operationId, attemptId: request.attemptId,
  };
}

function event(): AgentModeSchedulerEventInput {
  return {
    eventId: 'event:k4-3-a-live', eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, source: K43A_LIVE_MINIMAX_SOURCE_ID,
    occurredAt: NOW, receivedAt: NOW, causationId: 'commit:k4-3-a', correlationId: 'corr:k4-3-a',
    deduplicationKey: 'dedupe:k4-3-a-live', payloadVersion: 'k4.0',
    payload: { rootGoalId: ROOT, repositoryRef: 'brain', commitSha: 'sha:k4-3-a', subject: 'bounded live acceptance' },
    nextEligibleAt: NOW, deadline: null, maxAttempts: 3,
  };
}

function rootFacts(now: string) {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: ROOT, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active' as const, remainingSteps: 1, remainingBudget: 0.01, deadline: DEADLINE, delegableCapabilities: [], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: null,
  };
}

function setup(store: AgentModeSqliteStateStore): void {
  assert.equal(store.upsertEventSource({ sourceId: K43A_LIVE_MINIMAX_SOURCE_ID, sourceType: GIT_REPOSITORY_REVISION_SOURCE, repositoryRef: 'brain', adapterType: 'git.repository.revision', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 1, enabled: true, bootstrapWatermark: null }), 'created');
  assert.equal(store.createSchedulerEvent(event()), 'created');
}

function rule() { return { ...K43A_LIVE_MINIMAX_ACTION_RULE, enabled: true }; }

test('K4.3-A keeps the live Harness timeout bounded but longer than the fixture timeout', () => {
  assert.equal(RESTRICTED_HARNESS_FIXTURE_TIMEOUT_MS, 10_000);
  assert.equal(RESTRICTED_HARNESS_LIVE_MODEL_TIMEOUT_MS, 90_000);
  assert.ok(RESTRICTED_HARNESS_LIVE_MODEL_TIMEOUT_MS > RESTRICTED_HARNESS_FIXTURE_TIMEOUT_MS);
});

test('K4.3-A deterministic bounded dynamic worker uses one parent-owned model turn and settles', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k43-a-'));
  const databasePath = path.join(root, 'agent-mode.db');
  const store = new AgentModeSqliteStateStore(databasePath);
  let gatewayCalls = 0;
  let observedAwsEnvironment: boolean | undefined;
  let observedPrompt: string | undefined;
  const gateway: ModelGateway = { invoke: async (request) => { gatewayCalls += 1; assert.equal(request.modelRef, K43A_MODEL_REF); assert.equal(request.modelId, K43A_MODEL_ID); assert.equal(request.routeId, K43A_ROUTE_ID); assert.equal(request.maxTokens, 256); assert.equal(request.tools, undefined); assert.deepEqual(request.messages, [{ role: 'user', content: [{ text: K43A_LIVE_MODEL_PROMPT }] }]); assert.equal(request.prompt, undefined); return result(request); } };
  try {
    setup(store);
    const bridge = createK43AModelBridge({ store, gateway, accessEvidence: evidence, now: () => NOW });
    const runtime = new RestrictedHarnessAgentRuntime({ store, harnessRoot: HARNESS_ROOT, evidenceRoot: path.join(root, 'evidence'), modelBridge: bridge, fixtureEnvironmentObserved: (value) => { observedAwsEnvironment = value; }, modelPromptObserved: (value) => { observedPrompt = value; } });
    const orchestrator = new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [rule()], rootFacts: (id, now) => id === ROOT ? rootFacts(now) : undefined, ownerId: 'owner:k4-3-a', controllerRef: K43A_LIVE_MINIMAX_CONTROLLER_REF, now: NOW, clock: () => NOW });
    const pass = await orchestrator.advance();
    const decision = pass.decisions[0]!;
    assert.equal(decision.result, 'COMPLETED', JSON.stringify(pass));
    assert.equal(decision.ruleId, K43A_LIVE_MINIMAX_ACTION_RULE_ID);
    assert.equal(decision.terminalWorkerOutcome, 'succeeded');
    assert.equal(gatewayCalls, 1);
    assert.equal(runtime.invocationCount, 1);
    assert.equal(runtime.processLaunchCount, 1);
    assert.equal(runtime.processReapedCount, 1);
    assert.equal(observedAwsEnvironment, false);
    assert.equal(observedPrompt, K43A_LIVE_MODEL_PROMPT);
    assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
    assert.equal(store.listTasks().length, 1); assert.equal(store.listRuns().length, 1); assert.equal(store.listAttempts().length, 1);
    const modelOps = store.listOutbox().filter((entry) => entry.effectKind === 'model.invoke');
    assert.equal(modelOps.length, 1);
    assert.equal(modelOps[0]?.operationId, deterministicK43AProviderOperationId({ rootGoalId: ROOT, childAgentId: decision.childAgentId!, attemptId: decision.attemptId!, dispatchId: decision.dispatchId! } as never));
    assert.equal(store.getBudget(store.getAttempt(decision.attemptId!)!.budgetScopeId)?.usedTokens, 25);
    assert.equal(store.getBudget(store.getAttempt(decision.attemptId!)!.budgetScopeId)?.usedDollars, 0.000014);
    const projection = readAgentModeObserver(NOW, databasePath);
    assert.equal(projection.modelOperations.length, 1);
    assert.equal((projection.modelOperations[0]?.receipt as Record<string, unknown>)?.modelRef, K43A_MODEL_REF);
    assert.equal((projection.modelOperations[0]?.receipt as Record<string, unknown>)?.modelId, K43A_MODEL_ID);
    assert.equal((projection.modelOperations[0]?.receipt as Record<string, unknown>)?.region, K43A_REGION);
    assert.equal(JSON.stringify(projection).includes('BRAIN_K4_3_A_LIVE_MINIMAX_PASS'), false);
    assert.equal(JSON.stringify(projection).includes('fixture-authoritative-k1-1'), true);
    const redelivery = await orchestrator.handleSchedulerEvent({ event: store.getSchedulerEvent('event:k4-3-a-live')!, now: NOW });
    assert.equal(redelivery.result, 'COMPLETED', JSON.stringify(redelivery));
    assert.equal(gatewayCalls, 1);
    assert.equal(runtime.invocationCount, 1);
    assert.equal(runtime.processLaunchCount, 1);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('K4.3-A is disabled by default and stale access evidence fails before gateway invocation', async () => {
  assert.equal(K43A_LIVE_MINIMAX_ACTION_RULE.enabled, false);
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k43-a-denied-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  let calls = 0;
  try {
    const stale = { ...evidence, freshUntil: NOW };
    const bridge = createK43AModelBridge({ store, gateway: { invoke: async () => { calls += 1; throw new Error('must not call'); } }, accessEvidence: stale, now: () => NOW });
    await assert.rejects(bridge({ context: {} as never, turn: 1, maxTokens: 256, prompt: K43A_LIVE_MODEL_PROMPT, signal: new AbortController().signal, isCancellationRequested: () => false }), /K43A_ACCESS_EVIDENCE_INVALID/);
    assert.equal(calls, 0);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('K4.3-A model bridge denies a second turn without a second gateway call', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k43-a-second-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  let calls = 0;
  try {
    const bridge = createK43AModelBridge({ store, gateway: { invoke: async (request) => { calls += 1; return result(request); } }, accessEvidence: evidence, now: () => NOW });
    const context = { rootGoalId: ROOT, childAgentId: 'agent:child:test', attemptId: 'attempt:test', dispatchId: 'dispatch:test', capabilitySetHash: 'scope', operationId: 'operation:test', controllerRef: 'controller:test', leaseId: 'lease:test', fence: 1, deadline: DEADLINE } as never;
    await assert.rejects(bridge({ context, turn: 2, maxTokens: 256, prompt: K43A_LIVE_MODEL_PROMPT, signal: new AbortController().signal, isCancellationRequested: () => false }), /K43A_MODEL_REQUEST_INVALID/);
    assert.equal(calls, 0);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('K4.3-A rejects the old bare-token request and cancellation before dispatch', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k43-a-contract-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  let calls = 0;
  try {
    const bridge = createK43AModelBridge({ store, gateway: { invoke: async (request) => { calls += 1; return result(request); } }, accessEvidence: evidence, now: () => NOW });
    const base = { context: {} as never, turn: 1, maxTokens: 256, signal: new AbortController().signal, isCancellationRequested: () => false };
    await assert.rejects(bridge({ ...base, prompt: K43A_LIVE_EXPECTED_RESPONSE }), /K43A_MODEL_REQUEST_INVALID/);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(bridge({ ...base, prompt: K43A_LIVE_MODEL_PROMPT, signal: controller.signal }), /K43A_MODEL_CANCELLED_BEFORE_PROVIDER/);
    assert.equal(calls, 0);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('K4.3-A accepts only the exact token after outer whitespace normalization', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k43-a-whitespace-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  let calls = 0;
  try {
    setup(store);
    const bridge = createK43AModelBridge({ store, gateway: { invoke: async (request) => { calls += 1; return { ...result(request), text: `\n  ${K43A_LIVE_EXPECTED_RESPONSE}  \n` }; } }, accessEvidence: evidence, now: () => NOW });
    const runtime = new RestrictedHarnessAgentRuntime({ store, harnessRoot: HARNESS_ROOT, evidenceRoot: path.join(root, 'evidence'), modelBridge: bridge });
    const orchestrator = new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [rule()], rootFacts: (id, now) => id === ROOT ? rootFacts(now) : undefined, ownerId: 'owner:k4-3-a-whitespace', controllerRef: K43A_LIVE_MINIMAX_CONTROLLER_REF, now: NOW, clock: () => NOW });
    const pass = await orchestrator.advance();
    assert.equal(pass.decisions[0]?.terminalWorkerOutcome, 'succeeded', JSON.stringify(pass));
    assert.equal(calls, 1);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('K4.3-A rejects verbose and extra response text without retry', async () => {
  for (const [suffix, text] of [['verbose', `Sure! ${K43A_LIVE_EXPECTED_RESPONSE}`], ['extra', `${K43A_LIVE_EXPECTED_RESPONSE}\nextra`]] as const) {
    const root = mkdtempSync(path.join(tmpdir(), `brain-agent-mode-k43-a-${suffix}-`));
    const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
    let calls = 0;
    try {
      setup(store);
      const bridge = createK43AModelBridge({ store, gateway: { invoke: async (request) => { calls += 1; return { ...result(request), text }; } }, accessEvidence: evidence, now: () => NOW });
      const runtime = new RestrictedHarnessAgentRuntime({ store, harnessRoot: HARNESS_ROOT, evidenceRoot: path.join(root, 'evidence'), modelBridge: bridge });
      const orchestrator = new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [rule()], rootFacts: (id, now) => id === ROOT ? rootFacts(now) : undefined, ownerId: `owner:k4-3-a-${suffix}`, controllerRef: K43A_LIVE_MINIMAX_CONTROLLER_REF, now: NOW, clock: () => NOW });
      const pass = await orchestrator.advance();
      assert.equal(pass.decisions[0]?.terminalWorkerOutcome, 'failed', JSON.stringify(pass));
      assert.equal(calls, 1);
      assert.equal(store.listOutbox().find((entry) => entry.effectKind === 'model.invoke')?.state, 'effect_applied');
    } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
  }
});

test('K4.3-A rejects a live response that is not the exact acceptance token', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k43-a-response-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  let calls = 0;
  try {
    setup(store);
    const bridge = createK43AModelBridge({ store, gateway: { invoke: async (request) => { calls += 1; return { ...result(request), text: 'unexpected live response' }; } }, accessEvidence: evidence, now: () => NOW });
    const runtime = new RestrictedHarnessAgentRuntime({ store, harnessRoot: HARNESS_ROOT, evidenceRoot: path.join(root, 'evidence'), modelBridge: bridge });
    const orchestrator = new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [rule()], rootFacts: (id, now) => id === ROOT ? rootFacts(now) : undefined, ownerId: 'owner:k4-3-a-response', controllerRef: K43A_LIVE_MINIMAX_CONTROLLER_REF, now: NOW, clock: () => NOW });
    const pass = await orchestrator.advance();
    assert.equal(pass.decisions[0]?.terminalWorkerOutcome, 'failed', JSON.stringify(pass));
    assert.equal(calls, 1);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('K4.3-A provider failure is terminal, journaled as observed, and never retried', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-k43-a-provider-failure-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'agent-mode.db'));
  let calls = 0;
  try {
    setup(store);
    const bridge = createK43AModelBridge({ store, gateway: { invoke: async () => { calls += 1; throw new ModelGatewayError('provider_error', 'deterministic provider failure'); } }, accessEvidence: evidence, now: () => NOW });
    const runtime = new RestrictedHarnessAgentRuntime({ store, harnessRoot: HARNESS_ROOT, evidenceRoot: path.join(root, 'evidence'), modelBridge: bridge });
    const orchestrator = new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [rule()], rootFacts: (id, now) => id === ROOT ? rootFacts(now) : undefined, ownerId: 'owner:k4-3-a-failure', controllerRef: K43A_LIVE_MINIMAX_CONTROLLER_REF, now: NOW, clock: () => NOW });
    const pass = await orchestrator.advance();
    assert.equal(pass.decisions[0]?.terminalWorkerOutcome, 'failed', JSON.stringify(pass));
    assert.equal(calls, 1);
    assert.equal(runtime.invocationCount, 1);
    assert.equal(runtime.processLaunchCount, 1);
    assert.equal(runtime.processReapedCount, 1);
    assert.equal(store.listOutbox().filter((entry) => entry.effectKind === 'model.invoke').length, 1);
    assert.equal(store.listOutbox().find((entry) => entry.effectKind === 'model.invoke')?.state, 'effect_applied');
    const redelivery = await orchestrator.handleSchedulerEvent({ event: store.getSchedulerEvent('event:k4-3-a-live')!, now: NOW });
    assert.equal(redelivery.result, 'COMPLETED', JSON.stringify(redelivery));
    assert.equal(calls, 1);
    assert.equal(runtime.invocationCount, 1);
    assert.equal(runtime.processLaunchCount, 1);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
