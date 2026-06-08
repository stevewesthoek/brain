/**
 * Infinite Brain Post-Write Verification Tests
 * Read-only verification framework tests
 * Route-level tests are in routes.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generatePostWriteVerificationReport, writePostWriteVerificationReport, readPostWriteVerificationReport, readPostWriteVerificationSummary } from '../adapters/infinite-brain-post-write-verification.js';

test('generatePostWriteVerificationReport returns blocked when dry-run missing', () => {
  const originalEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'post-write-verification-test-missing-'));
  const nonExistentPath = path.join(tempDir, 'dry-run.json');

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = nonExistentPath;

    const report = generatePostWriteVerificationReport();

    assert.equal(report.status, 'blocked', 'status should be blocked');
    assert.equal(report.verificationAvailable, false, 'verificationAvailable must be false');
    assert.equal(report.canVerifyWrites, false, 'canVerifyWrites must be false');
    assert.equal(report.canExecute, false, 'canExecute must be false');
    assert(report.blockers.length > 0, 'should have blockers');
    assert(report.checks.some(c => c.label === 'Dry-run report exists' && c.status === 'blocked'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
  }
});

test('generatePostWriteVerificationReport with temp dry-run returns report-only result', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const originalVerificationEnv = process.env.IBR_POST_WRITE_VERIFICATION_PATH;
  const originalMindEnv = process.env.IBR_MIND_REPO_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'post-write-verification-test-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');
  const mindPath = path.join(tempDir, 'mind');

  // Create a fake dry-run report
  writeFileSync(dryRunPath, JSON.stringify({ id: 'dry-run-123', status: 'complete' }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    process.env.IBR_MIND_REPO_PATH = mindPath;

    const report = generatePostWriteVerificationReport();

    assert.equal(report.verificationAvailable, false, 'verificationAvailable must remain false');
    assert.equal(report.canVerifyWrites, false, 'canVerifyWrites must remain false');
    assert.equal(report.canExecute, false, 'canExecute must remain false');
    assert.equal(report.safety.writesToMind, false, 'writesToMind must be false');
    assert.equal(report.safety.modifiesMind, false, 'modifiesMind must be false');
    assert.equal(report.safety.verificationOnly, true, 'verificationOnly must be true');
    assert.equal(report.safety.reportOnly, true, 'reportOnly must be true');
    assert.equal(report.dryRunReportId, 'dry-run-123', 'should capture dryRunId');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
    if (originalVerificationEnv) {
      process.env.IBR_POST_WRITE_VERIFICATION_PATH = originalVerificationEnv;
    } else {
      delete process.env.IBR_POST_WRITE_VERIFICATION_PATH;
    }
    if (originalMindEnv) {
      process.env.IBR_MIND_REPO_PATH = originalMindEnv;
    } else {
      delete process.env.IBR_MIND_REPO_PATH;
    }
  }
});

test('reportId is deterministic for same checks', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const originalVerificationEnv = process.env.IBR_POST_WRITE_VERIFICATION_PATH;
  const originalMindEnv = process.env.IBR_MIND_REPO_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'post-write-verification-test-deterministic-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');
  const mindPath = path.join(tempDir, 'mind');

  writeFileSync(dryRunPath, JSON.stringify({ id: 'dry-run-456', status: 'complete' }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    process.env.IBR_MIND_REPO_PATH = mindPath;

    const report1 = generatePostWriteVerificationReport();
    const report2 = generatePostWriteVerificationReport();

    assert.equal(report1.reportId, report2.reportId, 'Same checks should produce same reportId');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
    if (originalVerificationEnv) {
      process.env.IBR_POST_WRITE_VERIFICATION_PATH = originalVerificationEnv;
    } else {
      delete process.env.IBR_POST_WRITE_VERIFICATION_PATH;
    }
    if (originalMindEnv) {
      process.env.IBR_MIND_REPO_PATH = originalMindEnv;
    } else {
      delete process.env.IBR_MIND_REPO_PATH;
    }
  }
});

test('safety block has writesToMind false, modifiesMind false, canExecute false, usesShell false', () => {
  const report = generatePostWriteVerificationReport();

  assert.equal(report.safety.writesToMind, false, 'writesToMind must be false');
  assert.equal(report.safety.modifiesMind, false, 'modifiesMind must be false');
  assert.equal(report.safety.deletesFiles, false, 'deletesFiles must be false');
  assert.equal(report.safety.movesFiles, false, 'movesFiles must be false');
  assert.equal(report.safety.canExecute, false, 'canExecute must be false');
  assert.equal(report.safety.usesShell, false, 'usesShell must be false');
  assert.equal(report.safety.verificationOnly, true, 'verificationOnly must be true');
  assert.equal(report.safety.reportOnly, true, 'reportOnly must be true');
  assert.equal(report.safety.continuousRuntime, false, 'continuousRuntime must be false');
  assert.equal(report.safety.modelCalls, false, 'modelCalls must be false');
});

test('readPostWriteVerificationSummary returns blocked values when report missing', () => {
  const originalEnv = process.env.IBR_POST_WRITE_VERIFICATION_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'post-write-verification-test-summary-'));
  const nonExistentPath = path.join(tempDir, 'missing.json');

  try {
    process.env.IBR_POST_WRITE_VERIFICATION_PATH = nonExistentPath;

    const summary = readPostWriteVerificationSummary();

    assert.equal(summary.available, false, 'available should be false when report missing');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.IBR_POST_WRITE_VERIFICATION_PATH = originalEnv;
    } else {
      delete process.env.IBR_POST_WRITE_VERIFICATION_PATH;
    }
  }
});
