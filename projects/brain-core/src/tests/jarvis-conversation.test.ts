import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { AgentModeTerminalIntakeService, TERMINAL_INTAKE_SCHEMA_VERSION } from '../agent-mode/terminal-intake.js';
import type { AgentRuntime } from '../agent-mode/runtime-dispatch.js';

const NOW = '2026-09-20T10:00:00.000Z';

function fixtureRuntime(): AgentRuntime {
  return { async run(input) { return { status: 'succeeded', runtimeReceiptId: `runtime-receipt:conversation:${input.context.attemptId}`, resultHash: 'e'.repeat(64), evidenceRef: 'evidence:conversation:1', usage: { steps: 1, tokens: 1, cost: 0 }, traceSummary: ['conversation-fixture'], resultText: `response for ${input.context.rootGoalId}` }; } };
}

test('same conversation id persists bounded multi-turn user and Jarvis history across restart', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-jarvis-conversation-'));
  const repo = path.join(root, 'repo');
  mkdirSync(path.join(repo, '.git'), { recursive: true });
  const database = path.join(root, 'agent-mode.db');
  try {
    const store = new AgentModeSqliteStateStore(database);
    const service = new AgentModeTerminalIntakeService(store, { repositoryRoots: [root], now: () => NOW, runtimeFactory: () => fixtureRuntime() });
    const base = { schemaVersion: TERMINAL_INTAKE_SCHEMA_VERSION, operatorId: 'operator:test', repositoryRef: 'fixture', repositoryRoot: repo, model: 'auto', receivedAt: NOW, conversationId: 'conversation:jarvis:multi-turn' };
    const first = service.accept({ ...base, requestId: 'request:conversation:1', text: 'First bounded request.' });
    assert.equal(first.outcome, 'accepted');
    if (first.outcome !== 'accepted') return;
    await service.execute(first.receipt.rootGoalId);
    const second = service.accept({ ...base, requestId: 'request:conversation:2', text: 'Follow up using the prior result.' });
    assert.equal(second.outcome, 'accepted');
    if (second.outcome !== 'accepted') return;
    await service.execute(second.receipt.rootGoalId);
    const turns = store.listJarvisConversationTurns('conversation:jarvis:multi-turn');
    assert.equal(turns.length, 4);
    assert.deepEqual(turns.map((turn) => [turn.sequence, turn.speakerRole]), [[1, 'user'], [2, 'jarvis'], [3, 'user'], [4, 'jarvis']]);
    const before = turns.map((turn) => ({ ...turn }));
    await service.execute(first.receipt.rootGoalId);
    assert.deepEqual(store.listJarvisConversationTurns('conversation:jarvis:multi-turn'), before);
    store.close();
    const reopened = new AgentModeSqliteStateStore(database);
    assert.deepEqual(reopened.listJarvisConversationTurns('conversation:jarvis:multi-turn'), before);
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
