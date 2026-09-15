import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import { createStateSnapshot, importStateSnapshot, readStateSnapshot, verifyStateSnapshot, writeStateSnapshot } from '../agent-mode/state-relocation.js';

test('exports a deterministic logical snapshot from an offline read-only store and imports into a fresh target', () => {
  const root = mkdtempSync('/tmp/brain-d0-e-'); const sourcePath = path.join(root, 'source.db'); const snapshotPath = path.join(root, 'snapshot.json'); const targetPath = path.join(root, 'target.db');
  try {
    const source = new AgentModeSqliteStateStore(sourcePath); source.upsertAgent({ agentId: 'agent:root', agentKind: 'jarvis', role: 'jarvis', displayName: 'Jarvis', policyId: 'policy:v1', status: 'active', rootGoalId: 'goal:root', depth: 0 }); const expectedAgent = source.getAgent('agent:root'); source.close();
    const offline = AgentModeSqliteStateStore.openExisting(sourcePath)!; const snapshot = createStateSnapshot(offline, { mode: 'relocation-final', createdAt: '2026-09-15T00:00:00.000Z' }); const secondSnapshot = createStateSnapshot(offline, { mode: 'relocation-final', createdAt: '2026-09-16T00:00:00.000Z' }); assert.equal(snapshot.snapshotId, secondSnapshot.snapshotId); offline.close();
    assert.equal(verifyStateSnapshot(snapshot).ok, true); const writable = new AgentModeSqliteStateStore(path.join(root, 'writable.db')); assert.throws(() => createStateSnapshot(writable, { mode: 'relocation-final', createdAt: '2026-09-15T00:00:00.000Z' }), /read-only/u); writable.close(); writeStateSnapshot(snapshot, snapshotPath); assert.equal(statSync(snapshotPath).mode & 0o777, 0o600); assert.deepEqual(readStateSnapshot(snapshotPath), snapshot);
    const imported = importStateSnapshot(snapshot, targetPath, snapshot.snapshotId); assert.equal(imported.ok, true); assert.equal(existsSync(targetPath), true);
    const target = AgentModeSqliteStateStore.openExisting(targetPath)!; assert.deepEqual(target.getAgent('agent:root'), expectedAgent); target.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('snapshot tamper and populated-target imports fail without accepting partial state', () => {
  const root = mkdtempSync('/tmp/brain-d0-e-tamper-'); const sourcePath = path.join(root, 'source.db'); const targetPath = path.join(root, 'target.db');
  try {
    const source = new AgentModeSqliteStateStore(sourcePath); source.close(); const offline = AgentModeSqliteStateStore.openExisting(sourcePath)!; const snapshot = createStateSnapshot(offline, { mode: 'backup/logical-fixture', createdAt: '2026-09-15T00:00:00.000Z' }); offline.close();
    const tampered = structuredClone(snapshot); tampered.counts.agents = 99; assert.equal(verifyStateSnapshot(tampered).ok, false);
    const populated = new AgentModeSqliteStateStore(targetPath); populated.close(); assert.equal(importStateSnapshot(snapshot, targetPath, snapshot.snapshotId).ok, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
