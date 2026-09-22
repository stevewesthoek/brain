import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { JARVIS_TEXT_INTAKE_SCHEMA_VERSION, JarvisTextIntakeService } from '../agent-mode/jarvis-text-intake.js';
import { readAgentModeObserver } from '../agent-mode/agent-mode-observer.js';
import { buildAgentModeConsoleProjection } from '../agent-mode/agent-mode-console-projection.js';

const NOW = '2026-09-15T10:00:00.000Z';

test('durable Jarvis typed and voice intake is atomic, idempotent, and restartable', () => {
  const dir = mkdtempSync(`${tmpdir()}/brain-jarvis-intake-`);
  const databasePath = `${dir}/agent-mode.db`;
  try {
    const store = new AgentModeSqliteStateStore(databasePath);
    const service = new JarvisTextIntakeService(store, () => NOW);
    const command = { schemaVersion: JARVIS_TEXT_INTAKE_SCHEMA_VERSION, intakeId: 'intake:one', source: 'typed' as const, operatorId: 'operator:one', text: '  Build   the bounded plan. ', receivedAt: NOW };
    const first = service.acceptCommand(command);
    assert.equal(first.outcome, 'accepted');
    if (first.outcome !== 'accepted') return;
    assert.equal(first.receipt.rootGoalId, first.receipt.taskId);
    assert.equal(first.receipt.jarvisAgentId, 'agent:jarvis');
    assert.equal(store.getTask(first.receipt.rootGoalId)?.taskType, 'root.goal');
    assert.equal(store.getTask(first.receipt.rootGoalId)?.inputHash, first.receipt.canonicalTextHash);
    assert.equal(store.getAgent('agent:jarvis')?.agentKind, 'jarvis');
    assert.equal(store.listJarvisIntakes().length, 1);
    const duplicate = service.acceptCommand({ ...command, receivedAt: '2026-09-15T10:05:00.000Z' });
    assert.equal(duplicate.outcome, 'duplicate');
    if (duplicate.outcome === 'duplicate') assert.deepEqual(duplicate.receipt, { ...first.receipt, status: 'duplicate' });
    assert.equal(service.acceptCommand({ ...command, text: 'A conflicting root.' }).outcome, 'conflict');
    store.close();
    const reopened = new AgentModeSqliteStateStore(databasePath);
    assert.deepEqual(reopened.getJarvisIntake('intake:one'), reopened.listJarvisIntakes()[0]);
    assert.equal(reopened.getTask(first.receipt.taskId)?.taskType, 'root.goal');
    assert.equal(reopened.getAgent('agent:jarvis')?.agentId, 'agent:jarvis');
    const voice = new JarvisTextIntakeService(reopened, () => NOW).acceptCommand({ ...command, intakeId: 'intake:voice', source: 'voice' });
    assert.equal(voice.outcome, 'accepted');
    assert.equal(reopened.listJarvisIntakes().length, 2);
    const projection = buildAgentModeConsoleProjection(readAgentModeObserver(NOW, databasePath), NOW);
    assert.equal(projection.rootGoals.some((root) => root.rootGoalId === first.receipt.rootGoalId && root.jarvisAgentId === 'agent:jarvis'), true);
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('Jarvis intake rejects malformed commands before any durable state is created', () => {
  const dir = mkdtempSync(`${tmpdir()}/brain-jarvis-intake-invalid-`);
  const store = new AgentModeSqliteStateStore(`${dir}/agent-mode.db`);
  try {
    const result = new JarvisTextIntakeService(store, () => NOW).acceptCommand({ schemaVersion: JARVIS_TEXT_INTAKE_SCHEMA_VERSION, intakeId: 'intake:invalid', source: 'typed', operatorId: 'operator:one', text: ' ', receivedAt: NOW });
    assert.deepEqual(result, { outcome: 'denied', reasonCode: 'JARVIS_INTAKE_INVALID' });
    assert.equal(store.listJarvisIntakes().length, 0);
    assert.equal(store.listTasks().length, 0);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
