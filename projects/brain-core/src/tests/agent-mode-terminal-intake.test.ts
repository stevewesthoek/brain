import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { AgentModeTerminalIntakeService, TERMINAL_INTAKE_SCHEMA_VERSION } from '../agent-mode/terminal-intake.js';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import type { AgentRuntime } from '../agent-mode/runtime-dispatch.js';

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
    assert.equal(execution.result, 'COMPLETED');
    const status = service.status(accepted.receipt.rootGoalId);
    assert.equal(status.status, 'completed');
    assert.equal(status.resultText, 'bounded test result');
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
