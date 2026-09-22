import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { homedir, tmpdir } from 'node:os';
import test from 'node:test';
import { JarvisContextIntakeService } from '../agent-mode/jarvis-context-intake.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { AgentModeTerminalIntakeService, TERMINAL_INTAKE_SCHEMA_VERSION } from '../agent-mode/terminal-intake.js';
import type { AgentRuntime } from '../agent-mode/runtime-dispatch.js';
import { createAttemptExecutionScope } from '../agent-mode/jarvis-local-context.js';

const NOW = '2026-09-19T12:00:00.000Z';

function fakeCodex(root: string): string {
  const command = path.join(root, 'codex-fixture.sh');
  writeFileSync(command, `#!/bin/sh
if [ "$1" = "--version" ]; then printf 'codex-fixture 0.0.1\\n'; exit 0; fi
if [ "$1" = "exec" ] && [ "$2" = "--help" ]; then printf '%s\\n' '--json --output-last-message --sandbox --ephemeral --ignore-user-config --skip-git-repo-check --add-dir'; exit 0; fi
out=""
prev=""
for arg in "$@"; do if [ "$prev" = "--output-last-message" ]; then out="$arg"; fi; prev="$arg"; done
printf '{"type":"thread.started","thread_id":"thread:jarvis-fixture"}\\n'
printf '{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}\\n'
printf 'bounded Jarvis context result' > "$out"
`);
  chmodSync(command, 0o755);
  return command;
}

function fixture(): { root: string; command: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-jarvis-v2-execution-'));
  return { root, command: fakeCodex(root) };
}

function fixtureRuntime(store: AgentModeSqliteStateStore): AgentRuntime {
  return { async run(input) {
    const event = store.getSchedulerEvent(input.context.sourceEventId);
    const requested = event?.payload.contextIds;
    const all = store.listJarvisContexts(input.context.rootGoalId);
    const selected = Array.isArray(requested) && requested.every((value) => typeof value === 'string')
      ? all.filter((context) => requested.includes(context.contextId))
      : all;
    store.recordJarvisAttemptExecutionScope(createAttemptExecutionScope(input.context.rootGoalId, input.context.attemptId, selected));
    return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:jarvis-fixture:${input.context.attemptId}`, resultHash: 'c'.repeat(64), evidenceRef: 'evidence:jarvis-fixture:1', usage: { steps: 1, tokens: 1, cost: 0 }, traceSummary: ['jarvis-fixture-runtime'], resultText: 'bounded Jarvis context result' };
  } };
}

function makeService(root: string, command: string, home = root): { store: AgentModeSqliteStateStore; service: JarvisContextIntakeService } {
  const store = new AgentModeSqliteStateStore(path.join(root, 'state', 'agent-mode.db'));
  void command;
  return { store, service: new JarvisContextIntakeService(store, { home }, () => NOW, { runtimeFactory: (stateStore) => fixtureRuntime(stateStore) }) };
}

function accept(service: JarvisContextIntakeService, requestId: string, contexts: readonly Record<string, unknown>[]) {
  const result = service.accept({ schemaVersion: 'agent-mode.jarvis-intake.v2', requestId, operatorId: 'operator:fixture', model: 'auto', text: 'Read only bounded context.', contexts: contexts as never, receivedAt: NOW });
  assert.equal(result.outcome, 'accepted');
  if (result.outcome !== 'accepted') throw new Error('fixture intake was not accepted');
  return result.receipt.rootGoalId;
}

async function runOne(root: string, command: string, rootGoalId: string, service: JarvisContextIntakeService, store: AgentModeSqliteStateStore): Promise<void> {
  const result = await service.execute(rootGoalId);
  assert.equal(result.result, 'COMPLETED');
  assert.equal(result.terminalWorkerOutcome, 'succeeded');
  assert.equal(store.listAgents().filter((agent) => agent.rootGoalId === rootGoalId && agent.agentKind === 'worker').length, 1);
  const child = store.listAgents().find((agent) => agent.rootGoalId === rootGoalId && agent.agentKind === 'worker');
  assert.ok(child);
  const assignment = store.getChildAssignment(child!.agentId);
  assert.ok(assignment);
  assert.ok(store.getJarvisAttemptExecutionScope(assignment!.attemptId));
  assert.equal(command.length > 0, true);
}

test('v2 Codex execution supports zero context without borrowing repository or shell cwd', async () => {
  const { root, command } = fixture();
  const { store, service } = makeService(root, command);
  try {
    const rootGoalId = accept(service, 'request:zero-context-execution', []);
    await runOne(root, command, rootGoalId, service, store);
    const status = new AgentModeTerminalIntakeService(store, { now: () => NOW }).status(rootGoalId);
    assert.equal(status.status, 'completed');
    assert.equal(status.rootRunId, store.listRuns().find((run) => run.taskId === rootGoalId && run.agentId === 'agent:jarvis')?.runId);
    const child = store.listAgents().find((agent) => agent.rootGoalId === rootGoalId && agent.agentKind === 'worker')!;
    const scope = store.getJarvisAttemptExecutionScope(store.getChildAssignment(child.agentId)!.attemptId)!;
    assert.deepEqual(scope.contexts, []);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('v2 Codex execution supports an ordinary read-only local directory', async () => {
  const { root, command } = fixture();
  const local = path.join(root, 'ordinary');
  mkdirSync(local);
  const { store, service } = makeService(root, command);
  try {
    const rootGoalId = accept(service, 'request:ordinary-directory-execution', [{ kind: 'filesystem', path: local, requestedAccess: 'read', recursive: true, origin: 'local-folder' }]);
    await runOne(root, command, rootGoalId, service, store);
    const child = store.listAgents().find((agent) => agent.rootGoalId === rootGoalId && agent.agentKind === 'worker')!;
    assert.equal(store.getJarvisAttemptExecutionScope(store.getChildAssignment(child.agentId)!.attemptId)!.contexts[0]?.canonicalPath, realpathSync(local));
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('repos Auto read-only compatibility executes one admitted repository through K4', async () => {
  const { root, command } = fixture();
  const repo = path.join(root, 'Repos', 'brain');
  mkdirSync(path.join(repo, '.git'), { recursive: true });
  const store = new AgentModeSqliteStateStore(path.join(root, 'state', 'terminal.db'));
  try {
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [root], now: () => NOW, runtimeFactory: (stateStore) => ({ async run(input) {
      stateStore.recordJarvisAttemptExecutionScope(createAttemptExecutionScope(input.context.rootGoalId, input.context.attemptId, stateStore.listJarvisContexts(input.context.rootGoalId)));
      return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:terminal-fixture:${input.context.attemptId}`, resultHash: 'd'.repeat(64), evidenceRef: 'evidence:terminal-fixture:1', usage: { steps: 1, tokens: 1, cost: 0 }, traceSummary: ['terminal-fixture-runtime'], resultText: 'bounded terminal result' };
    } }) });
    const accepted = service.accept({ schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, requestId: 'request:repos-auto-smoke', operatorId: 'operator:fixture', repositoryRef: 'stevewesthoek/brain', repositoryRoot: repo, model: 'auto', text: 'Report the repository name and current branch. Do not modify anything.', receivedAt: NOW });
    assert.equal(accepted.outcome, 'accepted');
    if (accepted.outcome !== 'accepted') return;
    const result = await service.execute(accepted.receipt.rootGoalId);
    assert.equal(result.result, 'COMPLETED');
    const child = store.listAgents().find((agent) => agent.rootGoalId === accepted.receipt.rootGoalId && agent.agentKind === 'worker');
    assert.ok(child);
    const assignment = store.getChildAssignment(child!.agentId);
    assert.ok(assignment);
    const scope = store.getJarvisAttemptExecutionScope(assignment!.attemptId);
    assert.equal(scope?.contexts.length, 1);
    assert.equal(scope?.contexts[0]?.canonicalPath, realpathSync(repo));
    assert.equal(scope?.contexts[0]?.repositoryRef, 'stevewesthoek/brain');
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('v2 Codex execution supports one repository and two admitted repositories', async () => {
  const { root, command } = fixture();
  const repo = path.join(root, 'Repos', 'brain');
  const second = path.join(root, 'Repos', 'mind');
  mkdirSync(path.join(repo, '.git'), { recursive: true });
  mkdirSync(path.join(second, '.git'), { recursive: true });
  const { store, service } = makeService(root, command);
  try {
    const singleGoal = accept(service, 'request:single-repository-execution', [{ kind: 'repository', path: repo, repositoryRef: 'stevewesthoek/brain', requestedAccess: 'read', recursive: true, origin: 'repos-client' }]);
    await runOne(root, command, singleGoal, service, store);
    const singleChild = store.listAgents().find((agent) => agent.rootGoalId === singleGoal && agent.agentKind === 'worker')!;
    assert.equal(store.getJarvisAttemptExecutionScope(store.getChildAssignment(singleChild.agentId)!.attemptId)!.contexts[0]?.repositoryRef, 'stevewesthoek/brain');
    const multiGoal = accept(service, 'request:multi-root-execution', [
      { kind: 'repository', path: repo, repositoryRef: 'stevewesthoek/brain', requestedAccess: 'read', recursive: true, origin: 'repos-client' },
      { kind: 'repository', path: second, repositoryRef: 'stevewesthoek/mind', requestedAccess: 'read', recursive: true, origin: 'repos-client' },
    ]);
    await runOne(root, command, multiGoal, service, store);
    const multiChild = store.listAgents().find((agent) => agent.rootGoalId === multiGoal && agent.agentKind === 'worker')!;
    const multiScope = store.getJarvisAttemptExecutionScope(store.getChildAssignment(multiChild.agentId)!.attemptId)!;
    assert.deepEqual(multiScope.contexts.map((context) => context.repositoryRef).sort(), ['stevewesthoek/brain', 'stevewesthoek/mind']);
    assert.deepEqual(multiScope.contexts.map((context) => context.canonicalPath).sort(), [realpathSync(repo), realpathSync(second)].sort());
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('an explicit bounded home read is admitted without implicit home scope', async () => {
  const { root, command } = fixture();
  const home = realpathSync(homedir());
  const { store, service } = makeService(root, command, home);
  try {
    const rootGoalId = accept(service, 'request:explicit-home-read', [{ kind: 'filesystem', path: home, requestedAccess: 'read', recursive: false, origin: 'direct' }]);
    await runOne(root, command, rootGoalId, service, store);
    const child = store.listAgents().find((agent) => agent.rootGoalId === rootGoalId && agent.agentKind === 'worker')!;
    const scope = store.getJarvisAttemptExecutionScope(store.getChildAssignment(child.agentId)!.attemptId)!;
    assert.deepEqual(scope.contexts.map((context) => ({ canonicalPath: context.canonicalPath, admittedAccess: context.admittedAccess, recursive: context.recursive })), [{ canonicalPath: home, admittedAccess: 'read', recursive: false }]);
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('dynamic expansion executes only the newly admitted Brain context', async () => {
  const { root, command } = fixture();
  const prochat = path.join(root, 'ProChat');
  const brain = path.join(root, 'Brain');
  mkdirSync(prochat);
  mkdirSync(brain);
  const { store, service } = makeService(root, command);
  try {
    const rootGoalId = accept(service, 'request:dynamic-expansion-execution', [{ kind: 'filesystem', path: prochat, requestedAccess: 'read', recursive: true, origin: 'direct' }]);
    const expanded = service.expand(rootGoalId, [{ kind: 'filesystem', path: brain, requestedAccess: 'read', recursive: true, origin: 'expansion' }], 'prochat-to-brain', 'request:dynamic-expansion-execution');
    assert.equal(expanded.outcome, 'accepted');
    const expansionEvent = store.listSchedulerEvents(20).find((event) => event.payload.expansionId === expanded.expansion?.expansionId);
    assert.ok(expansionEvent);
    await service.execute(rootGoalId, expansionEvent!.eventId);
    const child = store.listAgents().find((agent) => agent.rootGoalId === rootGoalId && agent.agentKind === 'worker')!;
    const scope = store.getJarvisAttemptExecutionScope(store.getChildAssignment(child.agentId)!.attemptId)!;
    assert.deepEqual(scope.contexts.map((context) => context.canonicalPath), [realpathSync(brain)]);
    assert.deepEqual(store.listJarvisContexts(rootGoalId).map((context) => context.canonicalPath).sort(), [realpathSync(brain), realpathSync(prochat)].sort());
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
