import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AgentModeTerminalIntakeService, TERMINAL_INTAKE_SCHEMA_VERSION } from '../agent-mode/terminal-intake.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import type { AgentRuntime } from '../agent-mode/runtime-dispatch.js';
import { ModelGatewayAgentRuntime } from '../agent-mode/model-gateway-agent-runtime.js';
import type { ModelGateway } from '../agent-mode/model-gateway.js';
import type { JarvisProductionRuntimeConfiguration } from '../agent-mode/jarvis-production-runtime.js';
import type { JarvisSystemOneReflexHook } from '../agent-mode/jarvis-system-one-reflex.js';
import { JarvisContextIntakeService } from '../agent-mode/jarvis-context-intake.js';

const NOW = '2026-09-18T10:00:00.000Z';

function fakeRuntime(): AgentRuntime {
  return {
    async run(input) {
      const hash = 'a'.repeat(64);
      return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:test:${input.context.attemptId}`, resultHash: hash, evidenceRef: 'evidence:test:1', usage: { steps: 1, tokens: 1, cost: 0 }, traceSummary: ['test-runtime'], resultText: 'bounded test result' };
    },
  };
}

test('terminal intake durably binds repository context and executes through K4 once', async () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-`);
  const repository = `${directory}/repo`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [directory], now: () => NOW, runtimeFactory: () => fakeRuntime() });
    const command = { schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:1', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'Read the repository status and summarize the result.', receivedAt: NOW } as const;
    const accepted = service.accept(command);
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    assert.equal(store.getTask(accepted.receipt.rootGoalId)?.repositoryRoot, realpathSync(repository));
    assert.equal(store.getTask(accepted.receipt.rootGoalId)?.requestedModel, 'auto');
    assert.equal(store.getRun(accepted.receipt.rootRunId)?.agentId, 'agent:jarvis');
    const execution = await service.execute(accepted.receipt.rootGoalId);
    assert.equal(execution.result, 'COMPLETED', JSON.stringify(execution));
    const status = service.status(accepted.receipt.rootGoalId);
    assert.equal(status.status, 'completed');
    assert.equal(status.resultText, 'bounded test result');
    assert.equal(status.workerCount, 1);
    assert.equal(status.runtimeRef, 'runtime:mock-k0-4');
    assert.equal(status.runtimeProfileRef, 'runtime-profile:mock-k0-4');
    assert.equal(status.modelRef, 'agent-mode/minimax-m2.5');
    assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
    assert.equal(store.listTasks().filter((task) => task.childAgentId).length, 1);
    assert.equal(store.listRuns().filter((run) => run.childAgentId).length, 1);
    assert.equal(store.listAttempts().filter((attempt) => attempt.childAgentId).length, 1);
    const duplicate = service.accept(command);
    assert.equal(duplicate.outcome, 'duplicate');
    const redelivery = await service.execute(accepted.receipt.rootGoalId);
    assert.equal(redelivery.result, 'COMPLETED');
    assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 1);
    assert.equal(store.listAttempts().filter((attempt) => attempt.childAgentId).length, 1);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('terminal status exposes bounded Jev participation and route facts without exposing the request', async () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-reflex-`);
  const repository = `${directory}/repo`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  const reflex: JarvisSystemOneReflexHook = {
    async preflight(input) {
      return {
        schemaVersion: 'brain.system-one.turn-decision.v1', mode: 'SHADOW', status: 'recommendation', originalRequestHash: 'c'.repeat(64),
        intent: 'status', interactionMode: 'direct', complexity: 'simple', clarificationNeed: 'none', requiredCapabilities: [], likelySkills: [],
        contextNeeds: { candidateCount: input.candidateContexts?.length ?? 0, selectedIds: [] }, deepReasoningNeed: 'none', expensiveModelNeed: 'none',
        candidateModelScores: [{ modelRef: 'agent-mode/minimax-m2.5', score: 1 }], riskSignals: [], verificationNeed: 'recommended', confidence: 0.95,
        provider: { providerId: 'typesafe', model: 'jev-1.13.0' }, usage: { inputTokens: 10, outputTokens: 2 }, latencyMs: 12,
        cost: { amountUsd: 0.000001, basis: 'token_calculated' }, recommendation: { modelRef: 'agent-mode/minimax-m2.5', skillIds: [], contextIds: [] },
        actualRouteModelRef: input.actualRouteModelRef ?? null, reasonCode: null,
      };
    },
    async postflight(input) {
      return { status: 'verified', originalRequestHash: input.originalRequestHash, confidence: 0.9, latencyMs: 4, usage: { inputTokens: 4, outputTokens: 1 }, cost: { amountUsd: 0.000001, basis: 'token_calculated' }, reasonCode: null };
    },
  };
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [directory], now: () => NOW, runtimeFactory: () => fakeRuntime(), reflex });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:reflex', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'hello', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    await service.execute(accepted.receipt.rootGoalId);
    const current = service.status(accepted.receipt.rootGoalId);
    assert.equal(current.reflex?.mode, 'SHADOW');
    assert.equal(current.reflex?.status, 'recommendation');
    assert.equal(current.reflex?.recommendationModelRef, 'agent-mode/minimax-m2.5');
    assert.equal(current.reflex?.postflightStatus, 'verified');
    assert.equal(current.modelRef, 'agent-mode/minimax-m2.5');
    assert.equal(current.conversationHistory?.some((turn) => turn.text.includes('hello')), true);
    assert.equal(current.conversationHistory?.filter((turn) => turn.speakerRole === 'jarvis').length, 1);
    assert.equal(current.phaseTimings?.submittedAt, NOW);
    assert.equal(current.phaseTimings?.intakeAcceptedAt, NOW);
    assert.equal(current.phaseTimings?.reflexStartedAt, NOW);
    assert.equal(current.phaseTimings?.reflexCompletedAt, NOW);
    assert.equal(typeof current.phaseTimings?.runtimeStartedAt, 'string');
    assert.equal(typeof current.phaseTimings?.resultCompletedAt, 'string');
    const reflexEvents = store.listEvents(accepted.receipt.rootGoalId).filter((event) => event.eventType.startsWith('jarvis_reflex_'));
    assert.equal(reflexEvents.length, 3);
    assert.equal(reflexEvents.some((event) => event.eventType === 'jarvis_reflex_started'), true);
    assert.equal(reflexEvents.some((event) => JSON.stringify(event.payload).includes('hello')), false);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('production-configured Auto uses the K4 dispatcher with the ModelGateway runtime', async () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-model-gateway-`);
  const repository = `${directory}/repo`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  let invocations = 0;
  const gateway: ModelGateway = { async invoke(request) { invocations += 1; return { text: 'provider result', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }, cost: { inputPerMillionUsd: null, outputPerMillionUsd: null, estimatedUsd: null, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId }; } };
  const productionRuntime: JarvisProductionRuntimeConfiguration = {
    availableModels: new Set(['agent-mode/minimax-m2.5']),
    runtimeFactory: (stateStore) => new ModelGatewayAgentRuntime(stateStore, { gateway, accessEvidence: { 'agent-mode/minimax-m2.5': { version: 'fixture-access-v1', accountRef: 'account:fixture', region: 'us-east-1', modelRef: 'agent-mode/minimax-m2.5', modelId: 'minimax.minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5', state: 'verified', catalogVisible: true, callable: true, checkedAt: '2026-09-18T09:00:00.000Z', freshUntil: '2099-01-01T00:00:00.000Z', source: 'fixture' } } }),
  };
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [directory], now: () => NOW, productionRuntime });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:model-gateway', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'Read only.', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    const execution = await service.execute(accepted.receipt.rootGoalId);
    assert.equal(execution.result, 'COMPLETED', JSON.stringify(execution));
    const status = service.status(accepted.receipt.rootGoalId);
    assert.equal(invocations, 1, JSON.stringify(status));
    assert.equal(status.modelRef, 'agent-mode/minimax-m2.5');
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('execution-time Auto denial ignores stale Jev route and creates no worker lifecycle', async () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-stale-route-`);
  const repository = `${directory}/repo`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  const runtimeAvailableModels = new Set<'agent-mode/minimax-m2.5' | 'agent-mode/glm-5' | 'agent-mode/claude-opus-4.6'>(['agent-mode/minimax-m2.5']);
  const availableModels = new Set<'agent-mode/minimax-m2.5' | 'agent-mode/glm-5' | 'agent-mode/claude-opus-4.6'>(['agent-mode/minimax-m2.5']);
  let runtimeCalls = 0;
  const productionRuntime: JarvisProductionRuntimeConfiguration = {
    availableModels,
    runtimeAvailableModels,
    runtimeFactory: () => ({ async run() { runtimeCalls += 1; return { status: 'succeeded', runtimeReceiptId: 'runtime-receipt:stale-route', resultHash: 'b'.repeat(64), evidenceRef: 'evidence:stale-route', usage: { steps: 1, tokens: 1, cost: 0 }, traceSummary: [] }; } }),
  };
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [directory], now: () => NOW, productionRuntime });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:stale-route', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'Read only.', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    store.recordEvent({ eventId: `jarvis-reflex-route:${accepted.receipt.rootGoalId}`, entityType: 'jarvis_intake', entityId: accepted.receipt.rootGoalId, eventType: 'jarvis_reflex_route', occurredAt: NOW, payload: { modelRef: 'agent-mode/claude-opus-4.6', runtimeRef: 'runtime:claude-code', runtimeProfileRef: 'runtime-profile:claude-code', source: 'auto', selectionReason: 'admitted-order' } });
    availableModels.clear();
    runtimeAvailableModels.clear();
    runtimeAvailableModels.add('agent-mode/claude-opus-4.6');

    const execution = await service.execute(accepted.receipt.rootGoalId);
    assert.equal(execution.result, 'DENIED');
    assert.equal(execution.reasonCode, 'MODEL_ROUTE_NOT_ADMITTED');
    assert.equal(runtimeCalls, 0);
    assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 0);
    assert.equal(store.listTasks().filter((task) => task.childAgentId).length, 0);
    assert.equal(store.listRuns().filter((run) => run.childAgentId).length, 0);
    assert.equal(store.listAttempts().filter((attempt) => attempt.childAgentId).length, 0);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('ACTIVE_PILOT narrows the downstream context prompt from an independently confident context choice', async () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-reflex-context-`);
  const repository = `${directory}/repo`;
  const secondaryContext = `${directory}/secondary-context`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  mkdirSync(secondaryContext, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  let prompt = '';
  const gateway: ModelGateway = { async invoke(request) {
    prompt = request.messages?.[0]?.content[0]?.text ?? '';
    return { text: 'provider result', providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }, cost: { inputPerMillionUsd: null, outputPerMillionUsd: null, estimatedUsd: null, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId };
  } };
  const productionRuntime: JarvisProductionRuntimeConfiguration = {
    availableModels: new Set(['agent-mode/minimax-m2.5']),
    runtimeFactory: (stateStore) => new ModelGatewayAgentRuntime(stateStore, { gateway, accessEvidence: { 'agent-mode/minimax-m2.5': { version: 'fixture-access-v1', accountRef: 'account:fixture', region: 'us-east-1', modelRef: 'agent-mode/minimax-m2.5', modelId: 'minimax.minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5', state: 'verified', catalogVisible: true, callable: true, checkedAt: '2026-09-18T09:00:00.000Z', freshUntil: '2099-01-01T00:00:00.000Z', source: 'fixture' } } }),
  };
  const reflex: JarvisSystemOneReflexHook = {
    async preflight(input) {
      assert.deepEqual(new Set(input.candidateContexts?.map((candidate) => candidate.label)), new Set(['brain', 'filesystem']));
      assert.equal(input.candidateContexts?.some((candidate) => candidate.label?.includes('/')), false);
      const selectedContextId = input.candidateContexts?.[0]?.id ?? '';
      return {
        schemaVersion: 'brain.system-one.turn-decision.v1', mode: 'ACTIVE_PILOT', status: 'recommendation', originalRequestHash: 'e'.repeat(64),
        intent: 'task', interactionMode: 'review', complexity: 'moderate', clarificationNeed: 'none', requiredCapabilities: [], likelySkills: [],
        contextNeeds: { candidateCount: input.candidateContexts?.length ?? 0, selectedIds: [selectedContextId] }, deepReasoningNeed: 'none', expensiveModelNeed: 'none',
        candidateModelScores: [{ modelRef: 'agent-mode/minimax-m2.5', score: 0.4 }], riskSignals: [], verificationNeed: 'none', confidence: 0.4,
        decisionConfidences: { model: 0.3, skill: null, context: 0.8 }, provider: { providerId: 'typesafe', model: 'jev-1.13.0' }, usage: { inputTokens: 10, outputTokens: 2 }, latencyMs: 12,
        cost: { amountUsd: 0.000001, basis: 'token_calculated' }, recommendation: { modelRef: null, skillIds: [], contextIds: [selectedContextId] },
        actualRouteModelRef: input.actualRouteModelRef ?? null, reasonCode: null,
      };
    },
    async postflight(input) {
      return { status: 'verified', originalRequestHash: input.originalRequestHash, confidence: 0.8, latencyMs: 1, usage: null, cost: null, reasonCode: null };
    },
  };
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [directory], now: () => NOW, productionRuntime, reflex });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:reflex-context', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'Summarize the admitted repository context.', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    const rootGoalId = accepted.receipt.rootGoalId;
    const contextIntake = new JarvisContextIntakeService(store, { home: directory, eligibleRoots: [directory], writableRoots: [] }, () => NOW);
    const expansion = contextIntake.expand(rootGoalId, [
      { kind: 'repository', path: repository, repositoryRef: 'brain', requestedAccess: 'read', recursive: true, origin: 'repos-client' },
      { kind: 'filesystem', path: secondaryContext, requestedAccess: 'read', recursive: true, origin: 'local-folder' },
    ], 'fixture-contexts', 'causation:fixture-contexts');
    assert.equal(expansion.outcome, 'accepted');
    const orderedContexts = store.listJarvisContexts(rootGoalId);
    assert.equal(orderedContexts.length, 2);
    const execution = await service.execute(rootGoalId);
    assert.equal(execution.result, 'COMPLETED', JSON.stringify(execution));
    assert.match(prompt, new RegExp(`repositoryRoot: ${path.basename(orderedContexts[0]!.canonicalPath)}`, 'u'));
    assert.doesNotMatch(prompt, new RegExp(`repositoryRoot: ${path.basename(orderedContexts[1]!.canonicalPath)}`, 'u'));
    const preflight = store.listEvents(rootGoalId).find((event) => event.eventType === 'jarvis_reflex_preflight');
    assert.deepEqual((preflight?.payload as { selectedContextIds?: unknown } | undefined)?.selectedContextIds, [orderedContexts[0]!.contextId]);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('terminal routing answer is Brain-owned and model output cannot leak unsupported tool calls', async () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-routing-boundary-`);
  const repository = `${directory}/repo`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  let requestCount = 0;
  const seenMaxTokens: number[] = [];
  const gateway: ModelGateway = { async invoke(request) {
    requestCount += 1;
    seenMaxTokens.push(request.maxTokens);
    const prompt = request.messages?.[0]?.content[0]?.text ?? '';
    return { text: prompt.includes('tool fragment') ? '<minimax:tool_call><invoke name="filesystem_list_allowed_directories">' : "I'm using Claude 3.5 (Sonnet).", providerId: 'amazon-bedrock', modelRef: request.modelRef, modelId: request.modelId, routeKind: request.routeKind, routeId: request.routeId, region: 'us-east-1', usage: { inputTokens: 2, outputTokens: 3, totalTokens: 5 }, cost: { inputPerMillionUsd: null, outputPerMillionUsd: null, estimatedUsd: null, pricingSource: 'fixture' }, latencyMs: 1, completedAt: NOW, accessEvidenceVersion: request.accessEvidence.version, operationId: request.operationId, attemptId: request.attemptId };
  } };
  const productionRuntime: JarvisProductionRuntimeConfiguration = {
    availableModels: new Set(['agent-mode/minimax-m2.5']),
    runtimeFactory: (stateStore) => new ModelGatewayAgentRuntime(stateStore, { gateway, accessEvidence: { 'agent-mode/minimax-m2.5': { version: 'fixture-access-v1', accountRef: 'account:fixture', region: 'us-east-1', modelRef: 'agent-mode/minimax-m2.5', modelId: 'minimax.minimax-m2.5', routeKind: 'direct', routeId: 'minimax.minimax-m2.5', state: 'verified', catalogVisible: true, callable: true, checkedAt: '2026-09-18T09:00:00.000Z', freshUntil: '2099-01-01T00:00:00.000Z', source: 'fixture' } } }),
  };
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [directory], now: () => NOW, productionRuntime });
    const question = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:routing-question', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'What model are you using?', receivedAt: NOW });
    assert.equal(question.outcome, 'accepted');
    if (question.outcome !== 'accepted') return;
    const questionExecution = await service.execute(question.receipt.rootGoalId);
    assert.equal(questionExecution.result, 'COMPLETED', JSON.stringify(questionExecution));
    const questionStatus = service.status(question.receipt.rootGoalId);
    assert.match(questionStatus.resultText ?? '', /Brain routing: Auto selected MiniMax M2\.5/u);
    assert.doesNotMatch(questionStatus.resultText ?? '', /Claude 3\.5/u);

    const tool = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:tool-fragment', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'tool fragment', receivedAt: NOW });
    assert.equal(tool.outcome, 'accepted');
    if (tool.outcome !== 'accepted') return;
    const toolExecution = await service.execute(tool.receipt.rootGoalId);
    assert.equal(toolExecution.terminalWorkerOutcome, 'failed', JSON.stringify(toolExecution));
    const toolStatus = service.status(tool.receipt.rootGoalId);
    assert.equal(toolStatus.reasonCode, 'WORKER_FAILED');
    assert.equal(toolStatus.resultText, null);
    assert.doesNotMatch(JSON.stringify(toolStatus.conversationHistory), /<minimax:tool_call>|<invoke/u);

    const complex = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:complex-bound', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'Design and implement a bounded architecture plan for the repository.', receivedAt: NOW });
    assert.equal(complex.outcome, 'accepted');
    if (complex.outcome !== 'accepted') return;
    const complexExecution = await service.execute(complex.receipt.rootGoalId);
    assert.equal(complexExecution.result, 'COMPLETED', JSON.stringify(complexExecution));
    assert.equal(requestCount, 3);
    assert.deepEqual(seenMaxTokens, [512, 1_024, 2_048]);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('terminal intake rejects repositories outside Core-owned roots and arbitrary models', () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-invalid-`);
  const repository = `${directory}/repo`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  mkdirSync(`${directory}/allowed`, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [`${directory}/allowed`], now: () => NOW });
    const result = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:2', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'shell-command', text: 'x', receivedAt: NOW });
    assert.equal(result.outcome, 'denied');
    assert.equal(store.listTasks().length, 0);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('terminal intake canonicalizes nested repositories and rejects symlink escapes and missing roots', () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-boundary-`);
  const allowed = `${directory}/Repos`;
  const repository = `${allowed}/nested/repo`;
  const outside = `${directory}/outside/repo`;
  const escape = `${allowed}/escape`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  mkdirSync(`${outside}/.git`, { recursive: true });
  symlinkSync(outside, escape);
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [allowed], now: () => NOW, runtimeFactory: () => fakeRuntime() });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:nested', operatorId: 'operator:local', repositoryRef: 'nested/repo', repositoryRoot: repository, model: 'auto', text: 'Read only.', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    const deniedEscape = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:escape', operatorId: 'operator:local', repositoryRef: 'escape', repositoryRoot: escape, model: 'auto', text: 'Read only.', receivedAt: NOW });
    assert.deepEqual(deniedEscape, { outcome: 'denied', reasonCode: 'REPOSITORY_NOT_ALLOWED' });
    const deniedMissing = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:missing', operatorId: 'operator:local', repositoryRef: 'missing', repositoryRoot: `${allowed}/missing`, model: 'auto', text: 'Read only.', receivedAt: NOW });
    assert.deepEqual(deniedMissing, { outcome: 'denied', reasonCode: 'REPOSITORY_INVALID' });
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('ACTIVE_PILOT persists the effective route before K4 dispatch and reuses it', async () => {
  const directory = mkdtempSync(`${tmpdir()}/brain-terminal-intake-pilot-route-`);
  const repository = `${directory}/repo`;
  mkdirSync(`${repository}/.git`, { recursive: true });
  const store = new AgentModeSqliteStateStore(`${directory}/agent-mode.db`);
  const reflex: JarvisSystemOneReflexHook = {
    async preflight(input) {
      return {
        schemaVersion: 'brain.system-one.turn-decision.v1', mode: 'ACTIVE_PILOT', status: 'recommendation', originalRequestHash: 'd'.repeat(64),
        intent: 'task', interactionMode: 'direct', complexity: 'simple', clarificationNeed: 'none', requiredCapabilities: [], likelySkills: [],
        contextNeeds: { candidateCount: input.candidateContexts?.length ?? 0, selectedIds: [] }, deepReasoningNeed: 'none', expensiveModelNeed: 'none',
        candidateModelScores: [{ modelRef: 'agent-mode/glm-5', score: 1 }], riskSignals: [], verificationNeed: 'none', confidence: 0.95,
        provider: { providerId: 'typesafe', model: 'jev-1.13.0' }, usage: { inputTokens: 10, outputTokens: 2 }, latencyMs: 12,
        cost: { amountUsd: 0.000001, basis: 'token_calculated' }, recommendation: { modelRef: 'agent-mode/glm-5', skillIds: [], contextIds: [] },
        actualRouteModelRef: input.actualRouteModelRef ?? null, reasonCode: null,
      };
    },
    async postflight(input) { return { status: 'verified', originalRequestHash: input.originalRequestHash, confidence: 0.9, latencyMs: 4, usage: { inputTokens: 4, outputTokens: 1 }, cost: { amountUsd: 0.000001, basis: 'token_calculated' }, reasonCode: null }; },
  };
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [directory], now: () => NOW, runtimeFactory: () => fakeRuntime(), reflex });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:terminal:pilot-route', operatorId: 'operator:local', repositoryRef: 'brain', repositoryRoot: repository, model: 'auto', text: 'hello', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    await service.execute(accepted.receipt.rootGoalId);
    const events = store.listEvents(accepted.receipt.rootGoalId);
    const routeIndex = events.findIndex((event) => event.eventType === 'jarvis_reflex_route');
    const preflightIndex = events.findIndex((event) => event.eventType === 'jarvis_reflex_preflight');
    assert.equal(routeIndex >= 0 && routeIndex < preflightIndex, true);
    assert.equal(store.listChildAssignments()[0]?.modelRef, 'agent-mode/glm-5');
    await service.execute(accepted.receipt.rootGoalId);
    assert.equal(store.listChildAssignments().length, 1);
    assert.equal(store.listEvents(accepted.receipt.rootGoalId).filter((event) => event.eventType === 'jarvis_reflex_route').length, 1);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
