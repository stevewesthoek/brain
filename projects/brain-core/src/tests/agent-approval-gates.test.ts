import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { readAgentApprovalGates, saveAgentApprovalGatesSnapshot } from '../adapters/agent-approval-gates.js';

const snapshotPath = '/Users/Office/.local/video-orchestrator/state/agent-approval-gates.json';

function cleanupSnapshot(): void {
  fs.rmSync(snapshotPath, { force: true });
}

test.beforeEach(cleanupSnapshot);
test.afterEach(cleanupSnapshot);

test('readAgentApprovalGates returns a derived read-only approval gate surface', () => {
  const gates = readAgentApprovalGates();

  assert.equal(gates.id, 'agent-approval-gates');
  assert.equal(gates.status, 'read-only');
  assert.ok(Array.isArray(gates.supportedApprovalKinds));
  assert.ok(typeof gates.nextSafeStep === 'string' && gates.nextSafeStep.length > 0);
});

test('saveAgentApprovalGatesSnapshot writes and reloads approval gates', () => {
  const gates = readAgentApprovalGates();

  assert.equal(saveAgentApprovalGatesSnapshot(gates), true);

  const reloaded = readAgentApprovalGates();

  assert.equal(reloaded.source, 'snapshot');
  assert.equal(reloaded.status, 'snapshot');
  assert.equal(reloaded.approvalStorePath, gates.approvalStorePath);
});
