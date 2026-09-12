// Developer-only K4.3-A acceptance. Exactly one scheduler-created dynamic
// worker and one MiniMax turn; no retry, fallback, tool, or repository action.
import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { AgentModeDynamicWorkerOrchestrator, K43A_LIVE_MINIMAX_ACTION_RULE, K43A_LIVE_MINIMAX_CONTROLLER_REF, K43A_LIVE_MINIMAX_SOURCE_ID } from '../../projects/brain-core/dist/agent-mode/dynamic-worker-orchestrator.js';
import { readAgentModeObserver } from '../../projects/brain-core/dist/agent-mode/agent-mode-observer.js';
import { createK43AModelBridge, K43A_MAX_TOKENS, K43A_MODEL_ID, K43A_MODEL_REF, K43A_REGION, K43A_ROUTE_ID } from '../../projects/brain-core/dist/agent-mode/k4-3-a-live-minimax.js';
import { RestrictedHarnessAgentRuntime } from '../../projects/brain-core/dist/agent-mode/restricted-harness-agent-runtime.js';
import { AgentModeSqliteStateStore } from '../../projects/brain-core/dist/agent-mode/sqlite-state-store.js';
import { GIT_REPOSITORY_REVISION_SOURCE, REPOSITORY_COMMIT_OBSERVED_EVENT } from '../../projects/brain-core/dist/agent-mode/event-source.js';
import { AmazonBedrockModelGateway } from '../../projects/brain-core/dist/adapters/amazon-bedrock-model-gateway.js';

process.title = 'brain-agent k4-3-a-r3-live-minimax-acceptance';
const execFile = promisify(execFileCallback);
const HARNESS_ROOT = '/Users/Office/.local/brain/runtimes/deepseek-harness/c389f96bf3a9b6807cb71ed6bdad5849be0df6d8';
const REGION = K43A_REGION;
const ACCEPTANCE_GENERATION = 'k4.3-a-r3';
const ROOT_GOAL_ID = 'goal:k4-3-a-r3';
const EVENT_ID = 'event:k4-3-a-r3';
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FAILURE_EVIDENCE_PATH = path.join(REPO_ROOT, 'operations/reports/agent-mode-k4-3-a-r3-live-minimax-acceptance-evidence-2026-09-12.md');
const DEADLINE = new Date(Date.now() + 20 * 60 * 1000).toISOString();

async function aws(args) {
  const result = await execFile('aws', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  return JSON.parse(String(result.stdout));
}

async function persistFailureEvidence(summary) {
  const body = [
    '# Agent Mode K4.3-A R3 Live MiniMax Acceptance Evidence — 2026-09-12',
    '',
    'Bounded failure summary for one fresh authorized acceptance generation. No credentials, raw provider payloads, hidden reasoning, full environment, or account identifiers are retained.',
    '',
    '```json',
    JSON.stringify(summary, null, 2),
    '```',
    '',
  ].join('\n');
  await writeFile(FAILURE_EVIDENCE_PATH, body, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
}

function rootFacts(now) {
  return {
    now, globalKillSwitchDenied: false, rootKillSwitchDenied: false,
    authority: { killSwitch: true, rootLookup: true, parentLookup: true, cancellation: true, budget: true },
    root: { rootGoalId: ROOT_GOAL_ID, depth: 0, activeChildren: 0, totalChildCreations: 0, cancellation: 'active', remainingSteps: 1, remainingBudget: 0.01, deadline: DEADLINE, delegableCapabilities: [], repositoryScopes: ['brain'], resourceScopes: [] },
    parent: null,
  };
}

async function main() {
  const identity = await aws(['sts', 'get-caller-identity', '--query', '{account:Account}', '--output', 'json']);
  const details = await aws(['bedrock', 'get-foundation-model', '--model-identifier', K43A_MODEL_ID, '--region', REGION, '--query', '{model:modelDetails.modelId,status:modelDetails.modelLifecycle.status}', '--output', 'json']);
  const availability = await aws(['bedrock', 'get-foundation-model-availability', '--model-id', K43A_MODEL_ID, '--region', REGION, '--output', 'json']);
  if (details.model !== K43A_MODEL_ID || details.status !== 'ACTIVE' || availability.authorizationStatus !== 'AUTHORIZED' || availability.agreementAvailability?.status !== 'AVAILABLE' || availability.entitlementAvailability !== 'AVAILABLE' || availability.regionAvailability !== 'AVAILABLE') {
    throw new Error('fresh MiniMax access evidence is insufficient; no model invocation was attempted');
  }
  const checkedAt = new Date().toISOString();
  const freshUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const accountRef = `aws-account:${identity.account}`;
  const accessEvidence = { version: `agent-mode-live-access:${checkedAt}`, accountRef, region: REGION, modelRef: K43A_MODEL_REF, modelId: K43A_MODEL_ID, routeKind: 'direct', routeId: K43A_ROUTE_ID, state: 'verified', catalogVisible: true, callable: true, checkedAt, freshUntil, source: 'aws-bedrock-get-foundation-model-and-availability' };
  const root = await mkdtemp('/tmp/brain-agent-mode-k4-3-a-r3-');
  const databasePath = path.join(root, 'agent-mode.db');
  let gatewayCalls = 0;
  let lastModelResult;
  let gatewayFailureCode = null;
  let failureEvidence;
  const liveGateway = new AmazonBedrockModelGateway({ accountRef, region: REGION });
  const gateway = { invoke: async (request) => {
    gatewayCalls += 1;
    try {
      const value = await liveGateway.invoke(request);
      lastModelResult = value;
      return value;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      gatewayFailureCode = typeof code === 'string' && /^[a-z_]{1,32}$/.test(code) ? code : 'unknown';
      throw error;
    }
  } };
  let store;
  try {
    store = new AgentModeSqliteStateStore(databasePath);
    if (store.upsertEventSource({ sourceId: K43A_LIVE_MINIMAX_SOURCE_ID, sourceType: GIT_REPOSITORY_REVISION_SOURCE, repositoryRef: 'brain', adapterType: 'git.repository.revision', debounceWindowMs: 0, cooldownWindowMs: 0, catchUpLimit: 1, enabled: true, bootstrapWatermark: null }) !== 'created') throw new Error('event source setup failed');
    if (store.createSchedulerEvent({ eventId: EVENT_ID, eventType: REPOSITORY_COMMIT_OBSERVED_EVENT, source: K43A_LIVE_MINIMAX_SOURCE_ID, occurredAt: checkedAt, receivedAt: checkedAt, causationId: 'commit:k4-3-a-r3', correlationId: 'corr:k4-3-a-r3', deduplicationKey: 'dedupe:k4-3-a-r3', payloadVersion: 'k4.0', payload: { rootGoalId: ROOT_GOAL_ID, repositoryRef: 'brain', commitSha: 'sha:k4-3-a-r3', subject: 'bounded live acceptance' }, nextEligibleAt: checkedAt, deadline: null, maxAttempts: 1 }) !== 'created') throw new Error('scheduler event setup failed');
    const runtime = new RestrictedHarnessAgentRuntime({ store, harnessRoot: HARNESS_ROOT, evidenceRoot: path.join(root, 'evidence'), modelBridge: createK43AModelBridge({ store, gateway, accessEvidence, now: () => new Date().toISOString() }) });
    const orchestrator = new AgentModeDynamicWorkerOrchestrator({ store, runtime, actionRules: [{ ...K43A_LIVE_MINIMAX_ACTION_RULE, enabled: true }], rootFacts: (id, now) => id === ROOT_GOAL_ID ? rootFacts(now) : undefined, ownerId: 'owner:k4-3-a-r3', controllerRef: K43A_LIVE_MINIMAX_CONTROLLER_REF, now: checkedAt, clock: () => new Date().toISOString() });
    const pass = await orchestrator.advance(checkedAt, 1);
    const decision = pass.decisions[0];
    if (!decision || decision.result !== 'COMPLETED' || decision.terminalWorkerOutcome !== 'succeeded') {
      const modelOutbox = store.listOutbox().filter((entry) => entry.effectKind === 'model.invoke').map((entry) => ({ operationId: entry.operationId, state: entry.state }));
      const runtimeErrors = decision.attemptId
        ? store.listEvents(decision.attemptId)
          .filter((event) => event.eventType === 'runtime_process_error')
          .map((event) => event.payload.errorCode)
          .filter((value) => typeof value === 'string')
          .slice(0, 2)
        : [];
      const modelOperation = modelOutbox[0];
      const providerReceiptExisted = modelOperation ? Boolean(store.getReceipt(modelOperation.operationId)) : false;
      failureEvidence = {
        acceptanceGeneration: ACCEPTANCE_GENERATION,
        status: 'failed',
        eventId: EVENT_ID,
        childAgentId: decision.childAgentId ?? null,
        taskId: decision.taskId ?? null,
        runId: decision.runId ?? null,
        attemptId: decision.attemptId ?? null,
        runtimeDispatchId: decision.dispatchId ?? null,
        modelOperationId: modelOperation?.operationId ?? null,
        modelOutboxState: modelOperation?.state ?? null,
        modelGatewayInvocationCount: gatewayCalls,
        normalizedGatewayFailureCode: gatewayFailureCode,
        runtimeErrorCodes: runtimeErrors,
        harnessLaunches: runtime.processLaunchCount,
        harnessReaps: runtime.processReapedCount,
        providerResultExisted: Boolean(lastModelResult),
        providerReceiptExisted,
        outcome: decision.terminalWorkerOutcome === 'uncertain' || modelOperation?.state === 'uncertain' ? 'uncertain' : decision.terminalWorkerOutcome === 'failed' ? 'known_failure' : 'unknown_failure',
        startedAt: checkedAt,
        observedAt: new Date().toISOString(),
        elapsedMs: Math.max(0, Date.now() - Date.parse(checkedAt)),
      };
      throw new Error(`live dynamic worker did not settle successfully: ${JSON.stringify({ result: pass.result, decision, gatewayCalls, gatewayFailureCode, modelResult: lastModelResult ? { textLength: String(lastModelResult.text ?? '').length, usage: lastModelResult.usage, cost: lastModelResult.cost.estimatedUsd, stopReason: lastModelResult.stopReason ?? null, latencyMs: lastModelResult.latencyMs } : null, runtimeErrors, runtimeInvocations: runtime.invocationCount, harnessLaunches: runtime.processLaunchCount, harnessReaps: runtime.processReapedCount, modelOutbox })}`);
    }
    if (gatewayCalls !== 1 || runtime.invocationCount !== 1 || runtime.processLaunchCount !== 1 || runtime.processReapedCount !== 1) throw new Error('K4.3-A positive counts failed');
    const budget = store.getBudget(store.getAttempt(decision.attemptId).budgetScopeId);
    const modelOps = store.listOutbox().filter((entry) => entry.effectKind === 'model.invoke');
    if (modelOps.length !== 1 || modelOps[0].state !== 'verified') throw new Error('model journal did not verify exactly once');
    const receipt = store.getReceipt(modelOps[0].operationId);
    if (!receipt) throw new Error('model receipt is missing');
    store.close(); store = undefined;
    const observer = readAgentModeObserver(new Date().toISOString(), databasePath);
    const redeliveryStore = new AgentModeSqliteStateStore(databasePath);
    const redeliveryRuntime = new RestrictedHarnessAgentRuntime({ store: redeliveryStore, harnessRoot: HARNESS_ROOT, evidenceRoot: path.join(root, 'evidence'), modelBridge: createK43AModelBridge({ store: redeliveryStore, gateway, accessEvidence, now: () => new Date().toISOString() }) });
    const redelivery = await new AgentModeDynamicWorkerOrchestrator({ store: redeliveryStore, runtime: redeliveryRuntime, actionRules: [{ ...K43A_LIVE_MINIMAX_ACTION_RULE, enabled: true }], rootFacts: (id, now) => id === ROOT_GOAL_ID ? rootFacts(now) : undefined, ownerId: 'owner:k4-3-a-r3-redelivery', controllerRef: K43A_LIVE_MINIMAX_CONTROLLER_REF }).handleSchedulerEvent({ event: redeliveryStore.getSchedulerEvent(EVENT_ID), now: new Date().toISOString() });
    redeliveryStore.close();
    if (redelivery.result !== 'COMPLETED' || gatewayCalls !== 1) throw new Error('redelivery was not a quiet duplicate');
    console.log(JSON.stringify({ status: 'passed', accessEvidence: { version: accessEvidence.version, modelRef: accessEvidence.modelRef, modelId: accessEvidence.modelId, route: accessEvidence.routeId, region: accessEvidence.region, checkedAt: accessEvidence.checkedAt, freshUntil: accessEvidence.freshUntil, source: accessEvidence.source }, schedulerToChild: { schedulerEvents: observer.summary.schedulerEventCount, children: observer.summary.agentCount, tasks: observer.summary.taskCount, runs: observer.summary.runCount, attempts: observer.summary.attemptCount, runtimeDispatches: observer.runtimeDispatches.length }, counts: { gatewayCalls, runtimeInvocations: runtime.invocationCount, harnessLaunches: runtime.processLaunchCount, harnessReaps: runtime.processReapedCount, modelOperations: observer.modelOperations.length, modelTurns: 1, toolCalls: 0, brainNodes: 0, workcells: observer.summary.workcellCount }, model: { modelRef: K43A_MODEL_REF, modelId: K43A_MODEL_ID, route: K43A_ROUTE_ID, region: REGION, maxOutputTokens: K43A_MAX_TOKENS, response: String(lastModelResult?.text ?? '').slice(0, 256), inputTokens: lastModelResult?.usage.inputTokens, outputTokens: lastModelResult?.usage.outputTokens, totalTokens: lastModelResult?.usage.totalTokens, settledCostUsd: budget?.usedDollars, providerRequestId: lastModelResult?.requestId ?? null, latencyMs: lastModelResult?.latencyMs, receipt: observer.modelOperations[0]?.receipt ?? null }, journal: { modelState: observer.modelOperations[0]?.state, redelivery: 'no second model call', restartObserver: 'reopened observer verified' }, databasePath }));
  } finally {
    if (failureEvidence) await persistFailureEvidence(failureEvidence);
    try { store?.close(); } catch {}
    await rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(JSON.stringify({ status: 'blocked-before-or-during-live-call', error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; });
