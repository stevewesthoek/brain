import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAgentConsoleSummary, saveAgentConsoleSummarySnapshot } from '../adapters/agent-console-summary.js';

const snapshotPath = '/Users/Office/.local/video-orchestrator/state/agent-console.json';

function cleanupSnapshot(): void {
  fs.rmSync(snapshotPath, { force: true });
}

test.beforeEach(cleanupSnapshot);
test.afterEach(cleanupSnapshot);

test('readAgentConsoleSummary returns a read-only agent console surface', () => {
  const summary = readAgentConsoleSummary();

  assert.equal(summary.id, 'agent-console');
  assert.equal(summary.status, 'read-only');
  assert.ok(summary.executorSelectionCount > 0);
  assert.ok(summary.approvalPendingCount >= 0);
});

test('saveAgentConsoleSummarySnapshot writes and reloads the agent console summary', () => {
  const summary = readAgentConsoleSummary();

  assert.equal(saveAgentConsoleSummarySnapshot(summary), true);

  const reloaded = readAgentConsoleSummary();

  assert.equal(reloaded.source, 'snapshot');
  assert.equal(reloaded.status, 'snapshot');
  assert.equal(reloaded.executorSelectionCount, summary.executorSelectionCount);
});
