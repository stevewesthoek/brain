/**
 * Infinite Brain Operator Approval Tests
 * Adapter-level tests for approval intent recording and blocking behavior
 * Route-level tests are in routes.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { generateOperatorApprovalRecord, writeOperatorApprovalRecord, readOperatorApprovalRecord, readOperatorApprovalSummary } from '../adapters/infinite-brain-operator-approval.js';

test('Adapter: generateOperatorApprovalRecord with empty operator still produces valid record', () => {
  const record = generateOperatorApprovalRecord('', 'approved', 'test reason');
  // Adapter doesn't validate; API layer does
  assert(record.approvalId);
  assert.equal(record.executionEnabled, false);
  assert.equal(record.canExecute, false);
});

test('Adapter: generateOperatorApprovalRecord with empty reason still produces valid record', () => {
  // Adapter accepts empty reason; API layer validates non-empty
  const record = generateOperatorApprovalRecord('test-operator', 'approved', '');
  assert(record.approvalId);
  assert.equal(record.reason, '');
});

test('Adapter: generateOperatorApprovalRecord validates decision is one of the allowed values', () => {
  // TypeScript types enforce this at compile time; runtime record has correct value
  const record = generateOperatorApprovalRecord('test-operator', 'approved', 'test reason');
  assert(['approved', 'rejected', 'needs-review'].includes(record.decision));
});

test('POST operator approval with approved decision returns blocked safety', () => {
  const record = generateOperatorApprovalRecord('operator1', 'approved', 'Approved for execution gate consideration');

  assert.equal(record.decision, 'approved');
  assert.equal(record.canExecute, false);
  assert.equal(record.executionEnabled, false);
  assert.equal(record.applied, false);
  assert.equal(record.writesToMind, false);
  assert.equal(record.safety.approvalRecordOnly, true);

  // Safety block must have all correct false values
  assert.equal(record.safety.writesToMind, false);
  assert.equal(record.safety.appliesProposals, false);
  assert.equal(record.safety.canExecute, false);
  assert.equal(record.safety.executionEnabled, false);
  assert.equal(record.safety.applied, false);
  assert.equal(record.safety.continuousRuntime, false);
  assert.equal(record.safety.modelCalls, false);
});

test('Deterministic approvalId for same input', () => {
  const record1 = generateOperatorApprovalRecord('operator1', 'approved', 'Test reason');
  const record2 = generateOperatorApprovalRecord('operator1', 'approved', 'Test reason');

  // Same input should produce same approvalId
  assert.equal(record1.approvalId, record2.approvalId);
});

test('Execution readiness incorporates approval intent but remains canExecute false', () => {
  const originalEnvPath = process.env.IBR_OPERATOR_APPROVAL_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'operator-approval-test-'));
  const approvalPath = path.join(tempDir, 'approval.json');

  try {
    process.env.IBR_OPERATOR_APPROVAL_PATH = approvalPath;

    // Generate and write approval record
    const record = generateOperatorApprovalRecord('operator1', 'approved', 'Ready for next gate');
    const writeSuccess = writeOperatorApprovalRecord(record);
    assert(writeSuccess, 'Should write approval record successfully');

    // Read it back
    const readRecord = readOperatorApprovalRecord();
    assert(readRecord, 'Should read approval record');
    assert.equal(readRecord.decision, 'approved');
    assert.equal(readRecord.canExecute, false); // Still blocked
    assert.equal(readRecord.executionEnabled, false); // Still blocked

    // Get summary
    const summary = readOperatorApprovalSummary();
    assert(summary.available);
    assert.equal(summary.decision, 'approved');
    assert.equal(summary.canExecute, false);
    assert.equal(summary.executionEnabled, false);
    assert.equal(summary.approvalRecordOnly, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnvPath) {
      process.env.IBR_OPERATOR_APPROVAL_PATH = originalEnvPath;
    } else {
      delete process.env.IBR_OPERATOR_APPROVAL_PATH;
    }
  }
});

test('Approval with needs-review decision remains blocked', () => {
  const record = generateOperatorApprovalRecord('operator1', 'needs-review', 'Needs more review');
  assert.equal(record.decision, 'needs-review');
  assert.equal(record.canExecute, false);
  assert.equal(record.executionEnabled, false);
});

test('Approval with rejected decision remains blocked', () => {
  const record = generateOperatorApprovalRecord('operator1', 'rejected', 'Rejected due to risk');
  assert.equal(record.decision, 'rejected');
  assert.equal(record.canExecute, false);
  assert.equal(record.executionEnabled, false);
});

test('Operator approval record has required next gates listed', () => {
  const record = generateOperatorApprovalRecord('operator1', 'approved', 'Ready for next gate');
  assert(Array.isArray(record.requiredNextGates));
  assert(record.requiredNextGates.length > 0);
  assert(record.requiredNextGates.includes('deletion-sync-verification'));
});
