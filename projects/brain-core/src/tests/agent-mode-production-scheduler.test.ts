import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { AgentModeProductionScheduler } from '../agent-mode/production-scheduler.js';
import { JarvisContextIntakeService } from '../agent-mode/jarvis-context-intake.js';
import { DEFERRED_MODEL_REF, DEFERRED_ROUTE_REF, MOCK_AGENT_RUNTIME_PROFILE_REF, MOCK_AGENT_RUNTIME_REF, MODEL_GATEWAY_RUNTIME_PROFILE_REF, MODEL_GATEWAY_RUNTIME_REF } from '../agent-mode/child-assignment.js';
import { MockAgentRuntime } from '../agent-mode/mock-agent-runtime.js';
import type { JarvisProductionRuntimeConfiguration } from '../agent-mode/jarvis-production-runtime.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import type { JarvisSystemOneReflexHook } from '../agent-mode/jarvis-system-one-reflex.js';

const NOW = '2026-09-20T12:00:00.000Z';

function makeFixture(): { root: string; databasePath: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-agent-mode-production-scheduler-'));
  return { root, databasePath: path.join(root, 'state', 'agent-mode.db') };
}

function runtime(runtimeRef: string = MOCK_AGENT_RUNTIME_REF, modelRef: string = DEFERRED_MODEL_REF): MockAgentRuntime {
  return new MockAgentRuntime({
    runtimeRef,
    routeRef: DEFERRED_ROUTE_REF,
    modelRef,
    modelResult: { kind: 'typed-fixture-result', traceId: 'production-scheduler', intent: { kind: 'no-outbox', relativePath: 'README.md' } },
  });
}

function intake(store: AgentModeSqliteStateStore, root: string, requestId: string): { service: JarvisContextIntakeService; rootGoalId: string } {
  const service = new JarvisContextIntakeService(store, { home: root, eligibleRoots: [root], writableRoots: [] }, () => NOW, { runtimeFactory: () => runtime() });
  const accepted = service.accept({ schemaVersion: 'agent-mode.jarvis-intake.v2', requestId, operatorId: 'operator:production-scheduler-test', model: 'auto', text: 'Read only bounded context.', contexts: [], receivedAt: NOW });
  assert.equal(accepted.outcome, 'accepted');
  if (accepted.outcome !== 'accepted') throw new Error('fixture intake was not accepted');
  return { service, rootGoalId: accepted.receipt.rootGoalId };
}

function scheduler(databasePath: string, root: string, worker: MockAgentRuntime): AgentModeProductionScheduler {
  return new AgentModeProductionScheduler({
    databasePath,
    home: root,
    eligibleRoots: [root],
    writableRoots: [],
    clock: () => NOW,
    runtimeFactory: () => worker,
  });
}

test('production scheduler consumes a durable v2 ready event without direct service execution', async () => {
  const fixture = makeFixture();
  mkdirSync(path.join(fixture.root, 'workspace'));
  const store = new AgentModeSqliteStateStore(fixture.databasePath);
  try {
    const accepted = intake(store, fixture.root, 'request:production-scheduler-initial');
    const worker = runtime();
    const schedulerService = scheduler(fixture.databasePath, fixture.root, worker);
    schedulerService.start();
    await schedulerService.stop();
    assert.equal(store.listAgents().filter((agent) => agent.rootGoalId === accepted.rootGoalId && agent.agentKind === 'worker').length, 1);
    assert.equal(worker.dispatchInvocationCount, 1);
    const event = store.listSchedulerEvents().find((candidate) => candidate.correlationId === accepted.rootGoalId);
    assert.equal(event?.status, 'completed');
    assert.equal(store.listChildAssignments().filter((assignment) => assignment.rootGoalId === accepted.rootGoalId).length, 1);
  } finally {
    store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('production scheduler resumes after store close and executes expansion events through the same root', async () => {
  const fixture = makeFixture();
  const firstStore = new AgentModeSqliteStateStore(fixture.databasePath);
  const worker = runtime();
  let rootGoalId: string;
  try {
    const accepted = intake(firstStore, fixture.root, 'request:production-scheduler-restart');
    rootGoalId = accepted.rootGoalId;
    firstStore.close();
    const restarted = scheduler(fixture.databasePath, fixture.root, worker);
    await restarted.runOnce();
    const expansionStore = new AgentModeSqliteStateStore(fixture.databasePath);
    try {
      const service = new JarvisContextIntakeService(expansionStore, { home: fixture.root, eligibleRoots: [fixture.root], writableRoots: [] }, () => NOW);
      const expanded = service.expand(rootGoalId, [{ kind: 'filesystem', path: fixture.root, requestedAccess: 'read', recursive: false, origin: 'expansion' }], 'test-expansion', 'cause:production-scheduler-test');
      assert.equal(expanded.outcome, 'accepted');
    } finally { expansionStore.close(); }
    await restarted.runOnce();
    const reopened = new AgentModeSqliteStateStore(fixture.databasePath);
    try {
      assert.equal(reopened.listAgents().filter((agent) => agent.rootGoalId === rootGoalId && agent.agentKind === 'worker').length, 2);
      assert.equal(worker.dispatchInvocationCount, 2);
      assert.equal(reopened.listSchedulerEvents().filter((event) => event.correlationId === rootGoalId && event.status === 'completed').length, 2);
    } finally { reopened.close(); }
  } finally {
    try { firstStore.close(); } catch { /* already closed in the restart path */ }
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('concurrent production scheduler passes converge on one worker lifecycle', async () => {
  const fixture = makeFixture();
  const store = new AgentModeSqliteStateStore(fixture.databasePath);
  try {
    const accepted = intake(store, fixture.root, 'request:production-scheduler-concurrent');
    const worker = runtime();
    const first = scheduler(fixture.databasePath, fixture.root, worker);
    const second = scheduler(fixture.databasePath, fixture.root, worker);
    await Promise.all([first.runOnce(), second.runOnce()]);
    assert.equal(worker.dispatchInvocationCount, 1);
    assert.equal(store.listAgents().filter((agent) => agent.rootGoalId === accepted.rootGoalId && agent.agentKind === 'worker').length, 1);
    assert.equal(store.listChildAssignments().filter((assignment) => assignment.rootGoalId === accepted.rootGoalId).length, 1);
  } finally {
    store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('production scheduler uses the canonical production runtime configuration instead of a fixture route', async () => {
  const fixture = makeFixture();
  const store = new AgentModeSqliteStateStore(fixture.databasePath);
  const worker = runtime(MODEL_GATEWAY_RUNTIME_REF, 'agent-mode/glm-5');
  const productionRuntime: JarvisProductionRuntimeConfiguration = {
    availableModels: new Set(['agent-mode/glm-5']),
    runtimeFactory: () => worker,
  };
  try {
    const service = new JarvisContextIntakeService(store, { home: fixture.root, eligibleRoots: [fixture.root], writableRoots: [] }, () => NOW, { productionRuntime });
    const accepted = service.accept({ schemaVersion: 'agent-mode.jarvis-intake.v2', requestId: 'request:production-runtime-config', operatorId: 'operator:production-scheduler-test', model: 'glm-5', text: 'Read only bounded context.', contexts: [], receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    const schedulerService = new AgentModeProductionScheduler({
      databasePath: fixture.databasePath,
      home: fixture.root,
      eligibleRoots: [fixture.root],
      writableRoots: [],
      clock: () => NOW,
      productionRuntime,
    });
    await schedulerService.runOnce();
    const assignment = store.listChildAssignments()[0];
    assert.ok(assignment);
    assert.equal(assignment.runtimeRef, MODEL_GATEWAY_RUNTIME_REF);
    assert.equal(assignment.runtimeProfileRef, MODEL_GATEWAY_RUNTIME_PROFILE_REF);
    assert.equal(assignment.modelRef, 'agent-mode/glm-5');
    assert.notEqual(assignment.runtimeRef, MOCK_AGENT_RUNTIME_REF);
    assert.equal(worker.dispatchInvocationCount, 1);
  } finally {
    store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('production scheduler never silently falls back to mock when live runtime configuration is unavailable', async () => {
  const fixture = makeFixture();
  const store = new AgentModeSqliteStateStore(fixture.databasePath);
  const previous = new Map(['BRAIN_AGENT_MODE_ENABLE_LIVE_RUNTIME', 'BRAIN_AGENT_MODE_ENABLE_CLAUDE_CODE', 'BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON', 'BRAIN_AGENT_MODE_ACCOUNT_REF'].map((key) => [key, process.env[key]]));
  for (const key of previous.keys()) delete process.env[key];
  try {
    const accepted = intake(store, fixture.root, 'request:production-runtime-unavailable');
    const schedulerService = new AgentModeProductionScheduler({
      databasePath: fixture.databasePath,
      home: fixture.root,
      eligibleRoots: [fixture.root],
      writableRoots: [],
      clock: () => NOW,
    });
    const tick = await schedulerService.runOnce();
    assert.equal(tick?.completed, 0);
    assert.equal(tick?.deferred, 1);
    assert.equal(store.listChildAssignments().filter((assignment) => assignment.rootGoalId === accepted.rootGoalId).length, 0);
    assert.equal(store.listAgents().filter((agent) => agent.rootGoalId === accepted.rootGoalId && agent.agentKind === 'worker').length, 0);
  } finally {
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('production scheduler can add advisory Jarvis reflex preflight/postflight around K4 without changing execution', async () => {
  const fixture = makeFixture();
  const store = new AgentModeSqliteStateStore(fixture.databasePath);
  let preflightCalls = 0;
  let postflightCalls = 0;
  const reflex: JarvisSystemOneReflexHook = {
    async preflight(turn) {
      preflightCalls += 1;
      assert.equal(turn.text, 'Read only bounded context.');
      assert.equal(turn.actualRouteModelRef, 'agent-mode/minimax-m2.5');
      return {
        schemaVersion: 'brain.system-one.turn-decision.v1',
        mode: 'SHADOW',
        status: 'recommendation',
        originalRequestHash: 'a'.repeat(64),
        intent: 'task',
        interactionMode: 'task',
        complexity: 'simple',
        clarificationNeed: 'none',
        requiredCapabilities: [],
        likelySkills: [],
        contextNeeds: { candidateCount: 0, selectedIds: [] },
        deepReasoningNeed: 'none',
        expensiveModelNeed: 'none',
        candidateModelScores: [{ modelRef: 'agent-mode/minimax-m2.5', score: 1 }],
        riskSignals: [],
        verificationNeed: 'recommended',
        confidence: 0.9,
        provider: { providerId: 'typesafe', model: 'jev-1.13.0' },
        usage: { inputTokens: 10, outputTokens: 2 },
        latencyMs: 1,
        cost: { amountUsd: 0.000001, basis: 'token_calculated' },
        recommendation: { modelRef: 'agent-mode/minimax-m2.5', skillIds: [], contextIds: [] },
        actualRouteModelRef: 'agent-mode/minimax-m2.5',
        reasonCode: null,
      };
    },
    async postflight(input) {
      postflightCalls += 1;
      assert.equal(input.originalRequestHash, 'a'.repeat(64));
      assert.equal(input.resultFacts.result, 'COMPLETED');
      return { status: 'verified', originalRequestHash: input.originalRequestHash, confidence: 0.9, latencyMs: 1, usage: { inputTokens: 3, outputTokens: 1 }, cost: { amountUsd: 0.000001, basis: 'token_calculated' }, reasonCode: null };
    },
  };
  try {
    const accepted = intake(store, fixture.root, 'request:production-scheduler-reflex');
    const worker = runtime();
    const schedulerService = new AgentModeProductionScheduler({ databasePath: fixture.databasePath, home: fixture.root, eligibleRoots: [fixture.root], writableRoots: [], clock: () => NOW, runtimeFactory: () => worker, reflex });
    const tick = await schedulerService.runOnce();
    assert.equal(tick?.completed, 1);
    assert.equal(preflightCalls, 1);
    assert.equal(postflightCalls, 1);
    assert.equal(worker.dispatchInvocationCount, 1);
    assert.equal(store.listAgents().filter((agent) => agent.rootGoalId === accepted.rootGoalId && agent.agentKind === 'worker').length, 1);
  } finally {
    store.close();
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
