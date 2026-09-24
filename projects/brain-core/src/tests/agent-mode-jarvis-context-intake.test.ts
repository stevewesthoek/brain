import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { JarvisContextIntakeService } from '../agent-mode/jarvis-context-intake.js';
import { admitJarvisContext, admitJarvisContextSet, createAttemptExecutionScope } from '../agent-mode/jarvis-local-context.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import type { AgentRuntime } from '../agent-mode/runtime-dispatch.js';
import type { JarvisSystemOneReflexHook } from '../agent-mode/jarvis-system-one-reflex.js';

const NOW = '2026-09-19T12:00:00.000Z';

function fixtureRuntime(): AgentRuntime {
  return { async run(input) { return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:fixture:${input.context.attemptId}`, resultHash: 'b'.repeat(64), evidenceRef: 'evidence:fixture:1', usage: { steps: 1, tokens: 1, cost: 0 }, traceSummary: ['fixture-runtime'], resultText: 'fixture result' }; } };
}

function fixture(): { root: string; repo: string; nested: string } {
  const root = mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'brain-jarvis-context-'));
  const repo = path.join(root, 'Repos', 'example');
  const nested = path.join(root, 'notes');
  mkdirSync(path.join(repo, '.git'), { recursive: true });
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(nested, 'note.txt'), 'bounded fixture');
  return { root, repo, nested };
}

test('context admission is entry-point-neutral, bounded, and fail-closed', () => {
  const { root, repo, nested } = fixture();
  const repoResult = admitJarvisContext('root:test', { kind: 'repository', path: repo, repositoryRef: 'example', requestedAccess: 'read', recursive: true, origin: 'direct' }, { home: root }, NOW);
  assert.equal(repoResult.result, 'admitted');
  if (repoResult.result === 'admitted') assert.equal(repoResult.context.admittedAccess, 'read');
  assert.equal(admitJarvisContext('root:test', { kind: 'filesystem', path: nested, requestedAccess: 'write', recursive: true, origin: 'direct' }, { home: root }).result, 'denied');
  assert.equal(admitJarvisContext('root:test', { kind: 'filesystem', path: path.join(root, 'missing'), requestedAccess: 'read', recursive: true, origin: 'direct' }, { home: root }).result, 'denied');
  assert.equal(admitJarvisContext('root:test', { kind: 'filesystem', path: path.join(root, '.ssh'), requestedAccess: 'read', recursive: true, origin: 'direct' }, { home: root }).result, 'denied');
  const outside = mkdtempSync(path.join(process.env.TMPDIR ?? '/tmp', 'brain-jarvis-outside-'));
  assert.equal(admitJarvisContext('root:test', { kind: 'filesystem', path: outside, requestedAccess: 'read', recursive: true, origin: 'direct' }, { home: root }).result, 'denied');
});

test('context set ordering and attempt scope identity are deterministic', () => {
  const { root, repo, nested } = fixture();
  const requests = [
    { kind: 'filesystem' as const, path: nested, requestedAccess: 'read' as const, recursive: true, origin: 'direct' as const },
    { kind: 'repository' as const, path: repo, repositoryRef: 'example', requestedAccess: 'read' as const, recursive: true, origin: 'direct' as const },
  ];
  const first = admitJarvisContextSet('root:test', requests, { home: root }, NOW);
  const second = admitJarvisContextSet('root:test', [...requests].reverse(), { home: root }, NOW);
  assert.equal(first.result, 'admitted');
  assert.equal(second.result, 'admitted');
  if (first.result !== 'admitted' || second.result !== 'admitted') return;
  assert.deepEqual(first.contextSet.contexts, second.contextSet.contexts);
  const scope = createAttemptExecutionScope('root:test', 'attempt:test', first.contextSet.contexts);
  assert.equal(scope.contexts.length, 2);
  assert.equal(scope.scopeDigest.length, 64);
});

test('v2 intake supports no context, multiple contexts, expansion, restart, and idempotence', () => {
  const { root, repo, nested } = fixture();
  const database = path.join(root, 'state', 'agent-mode.db');
  const command = {
    schemaVersion: 'agent-mode.jarvis-intake.v2' as const,
    requestId: 'request:test-context-v2', operatorId: 'operator:test', model: 'auto', text: 'Inspect the bounded local context.',
    contexts: [
      { kind: 'repository' as const, path: repo, repositoryRef: 'example', requestedAccess: 'read' as const, recursive: true, origin: 'direct' as const },
      { kind: 'filesystem' as const, path: nested, requestedAccess: 'read' as const, recursive: true, origin: 'local-folder' as const },
    ], receivedAt: NOW,
  };
  const store = new AgentModeSqliteStateStore(database);
  const service = new JarvisContextIntakeService(store, { home: root }, () => NOW, { runtimeFactory: () => fixtureRuntime() });
  const accepted = service.accept(command);
  assert.equal(accepted.outcome, 'accepted');
  if (accepted.outcome !== 'accepted') return;
  assert.equal(service.accept(command).outcome, 'duplicate');
  assert.equal(store.listJarvisContexts(accepted.receipt.rootGoalId).length, 2);
  const expanded = service.expand(accepted.receipt.rootGoalId, [{ kind: 'filesystem', path: root, requestedAccess: 'read', recursive: false, origin: 'expansion' }], 'operator-approved', 'request:expansion-1');
  assert.equal(expanded.outcome, 'accepted');
  assert.equal(store.listJarvisContexts(accepted.receipt.rootGoalId).length, 3);
  assert.equal(store.listJarvisContextExpansions(accepted.receipt.rootGoalId).length, 1);
  store.close();
  const reopened = new AgentModeSqliteStateStore(database);
  assert.equal(reopened.listJarvisContexts(accepted.receipt.rootGoalId).length, 3);
  const observer = readAgentModeObserver(NOW, database);
  assert.equal(observer.contexts.length, 3);
  assert.equal(observer.contextExpansions.length, 1);
  reopened.close();
});

test('context-intake reflex receives bounded semantic labels without filesystem authority', async () => {
  const { root, repo, nested } = fixture();
  const store = new AgentModeSqliteStateStore(path.join(root, 'state', 'agent-mode.db'));
  const seen: Array<{ id: string; label?: string }> = [];
  const reflex: JarvisSystemOneReflexHook = {
    async preflight(input) {
      seen.push(...(input.candidateContexts ?? []));
      assert.match(input.sessionSummary ?? '', /^root:root:jarvis:/u);
      const selected = input.candidateContexts?.[0]?.id ?? null;
      return {
        schemaVersion: 'brain.system-one.turn-decision.v1', mode: 'ACTIVE_PILOT', status: 'recommendation',
        originalRequestHash: 'c'.repeat(64), intent: 'task', interactionMode: 'review', complexity: 'moderate',
        clarificationNeed: 'none', requiredCapabilities: [], likelySkills: [],
        contextNeeds: { candidateCount: input.candidateContexts?.length ?? 0, selectedIds: selected ? [selected] : [] },
        deepReasoningNeed: 'none', expensiveModelNeed: 'none', candidateModelScores: [], riskSignals: [],
        verificationNeed: 'none', confidence: 0.9, decisionConfidences: { model: null, skill: null, context: 0.9 },
        provider: { providerId: 'fixture', model: 'fixture' }, usage: null, latencyMs: 0, cost: null,
        recommendation: { modelRef: null, skillIds: [], contextIds: selected ? [selected] : [] },
        actualRouteModelRef: input.actualRouteModelRef ?? null, reasonCode: null,
      };
    },
    async postflight(input) {
      return { status: 'verified', originalRequestHash: input.originalRequestHash, confidence: 0.9, latencyMs: 0, usage: null, cost: null, reasonCode: null };
    },
  };
  try {
    const service = new JarvisContextIntakeService(store, { home: root, eligibleRoots: [root], writableRoots: [] }, () => NOW, { runtimeFactory: () => fixtureRuntime(), reflex });
    const accepted = service.accept({
      schemaVersion: 'agent-mode.jarvis-intake.v2', requestId: 'request:context-reflex-labels', operatorId: 'operator:test', model: 'auto',
      text: 'Choose the relevant admitted context.', contexts: [
        { kind: 'repository', path: repo, repositoryRef: 'brain', requestedAccess: 'read', recursive: true, origin: 'direct' },
        { kind: 'filesystem', path: nested, requestedAccess: 'read', recursive: true, origin: 'local-folder' },
      ], receivedAt: NOW,
    });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    const execution = await service.execute(accepted.receipt.rootGoalId);
    assert.equal(execution.result, 'COMPLETED', JSON.stringify(execution));
    assert.deepEqual(seen.map((candidate) => candidate.label).sort(), ['brain', 'filesystem']);
    assert.equal(seen.some((candidate) => candidate.label?.includes('/')), false);
    assert.equal(JSON.stringify(seen).includes(root), false);
  } finally {
    store.close();
  }
});

test('execution-time Auto denial ignores a stale context-intake Jev route and creates no worker lifecycle', async () => {
  const { root } = fixture();
  const store = new AgentModeSqliteStateStore(path.join(root, 'state', 'agent-mode.db'));
  const availableModels = new Set<'agent-mode/minimax-m2.5' | 'agent-mode/glm-5' | 'agent-mode/claude-opus-4.6'>(['agent-mode/minimax-m2.5']);
  let runtimeCalls = 0;
  try {
    const service = new JarvisContextIntakeService(store, { home: root }, () => NOW, {
      productionRuntime: {
        availableModels,
        runtimeFactory: () => ({ async run() {
          runtimeCalls += 1;
          return { status: 'succeeded', runtimeReceiptId: 'runtime-receipt:stale-context-route', resultHash: 'b'.repeat(64), evidenceRef: 'evidence:stale-context-route', usage: { steps: 1, tokens: 1, cost: 0 }, traceSummary: [] };
        } }),
      },
    });
    const accepted = service.accept({ schemaVersion: 'agent-mode.jarvis-intake.v2', requestId: 'request:context:stale-route', operatorId: 'operator:test', model: 'auto', text: 'Read-only fixture request.', contexts: [], receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;

    store.recordEvent({ eventId: `jarvis-reflex-route:${accepted.receipt.rootGoalId}`, entityType: 'jarvis_intake', entityId: accepted.receipt.rootGoalId, eventType: 'jarvis_reflex_route', occurredAt: NOW, payload: { modelRef: 'agent-mode/claude-opus-4.6', runtimeRef: 'runtime:claude-code', runtimeProfileRef: 'runtime-profile:claude-code', source: 'auto', selectionReason: 'stale-fixture-route' } });
    availableModels.clear();

    const execution = await service.execute(accepted.receipt.rootGoalId);
    assert.equal(execution.result, 'DENIED');
    assert.equal(execution.reasonCode, 'MODEL_ROUTE_NOT_ADMITTED');
    assert.equal(runtimeCalls, 0);
    assert.equal(store.listAgents().filter((agent) => agent.agentKind === 'worker').length, 0);
    assert.equal(store.listTasks().filter((task) => task.childAgentId).length, 0);
    assert.equal(store.listRuns().filter((run) => run.childAgentId).length, 0);
    assert.equal(store.listAttempts().filter((attempt) => attempt.childAgentId).length, 0);
  } finally {
    store.close();
  }
});

test('zero-context mode creates a root without a fake repository scope', () => {
  const { root } = fixture();
  const store = new AgentModeSqliteStateStore(path.join(root, 'state', 'agent-mode.db'));
  const service = new JarvisContextIntakeService(store, { home: root }, () => NOW, { runtimeFactory: () => fixtureRuntime() });
  const result = service.accept({ schemaVersion: 'agent-mode.jarvis-intake.v2', requestId: 'request:no-context', operatorId: 'operator:test', model: 'auto', text: 'No context.', contexts: [], receivedAt: NOW });
  assert.equal(result.outcome, 'accepted');
  if (result.outcome === 'accepted') {
    assert.equal(store.listJarvisContexts(result.receipt.rootGoalId).length, 0);
    assert.equal(store.getTask(result.receipt.rootGoalId)?.repositoryRoot, undefined);
  }
  store.close();
});
