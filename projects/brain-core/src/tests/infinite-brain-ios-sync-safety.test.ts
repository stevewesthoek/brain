/**
 * Infinite Brain iOS/Obsidian Sync Safety Tests
 * Verify sync safety report generation and blocking behavior
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import { generateIosSyncSafetyReport, writeIosSyncSafetyReport, readIosSyncSafetyReport } from '../adapters/infinite-brain-ios-sync-safety.js';

test('Generate sync safety report with missing Mind path returns blocked status', () => {
  // Override to point to non-existent path
  const originalEnv = process.env.IBR_MIND_REPO_PATH;
  process.env.IBR_MIND_REPO_PATH = '/nonexistent/path/to/mind';

  try {
    const report = generateIosSyncSafetyReport();

    assert.equal(report.status, 'blocked');
    assert.equal(report.syncSafe, false);
    assert.equal(report.canWriteToMind, false);
    assert(report.blockers.length > 0);
    assert(report.checks.length === 10);

    // Verify safety block
    assert.equal(report.safety.writesToMind, false);
    assert.equal(report.safety.modifiesGit, false);
    assert.equal(report.safety.usesShell, false);
    assert.equal(report.safety.canWriteToMind, false);
    assert.equal(report.safety.syncSafe, false);
    assert.equal(report.safety.reportOnly, true);
  } finally {
    if (originalEnv) {
      process.env.IBR_MIND_REPO_PATH = originalEnv;
    } else {
      delete process.env.IBR_MIND_REPO_PATH;
    }
  }
});

test('Sync safety report has deterministic reportId for same checks', () => {
  const originalEnv = process.env.IBR_MIND_REPO_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-test-'));

  try {
    process.env.IBR_MIND_REPO_PATH = tempDir;

    const report1 = generateIosSyncSafetyReport();
    const report2 = generateIosSyncSafetyReport();

    // Same conditions should produce same reportId
    assert.equal(report1.reportId, report2.reportId);
    assert.equal(report1.status, report2.status);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.IBR_MIND_REPO_PATH = originalEnv;
    } else {
      delete process.env.IBR_MIND_REPO_PATH;
    }
  }
});

test('Sync safety report safety block has correct false values', () => {
  const report = generateIosSyncSafetyReport();

  // All these must be false in disabled phase
  assert.equal(report.safety.writesToMind, false);
  assert.equal(report.safety.modifiesGit, false);
  assert.equal(report.safety.usesShell, false);
  assert.equal(report.safety.canWriteToMind, false);
  assert.equal(report.safety.syncSafe, false);
  assert.equal(report.safety.reportOnly, true);
  assert.equal(report.safety.continuousRuntime, false);
});

test('Sync safety checks have required preconditions blocked', () => {
  const report = generateIosSyncSafetyReport();

  // Verify at least some checks are blocked
  const blockedChecks = report.checks.filter(c => c.status === 'blocked');
  assert(blockedChecks.length > 0, 'Should have at least some blocked checks');

  // Verify deletion sync check is blocked
  const deletionCheck = report.checks.find(c => c.label.includes('Deletion'));
  assert(deletionCheck, 'Should have deletion sync check');
  assert.equal(deletionCheck.status, 'blocked');

  // Verify operator confirmation check is blocked
  const operatorCheck = report.checks.find(c => c.label.includes('Operator'));
  assert(operatorCheck, 'Should have operator confirmation check');
  assert.equal(operatorCheck.status, 'blocked');
});

test('Report write and read roundtrip works', () => {
  const originalReportPath = process.env.IBR_IOS_SYNC_SAFETY_REPORT_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'sync-safety-test-'));
  const reportPath = path.join(tempDir, 'report.json');

  try {
    process.env.IBR_IOS_SYNC_SAFETY_REPORT_PATH = reportPath;

    const originalReport = generateIosSyncSafetyReport();
    writeIosSyncSafetyReport(originalReport);

    const readReport = readIosSyncSafetyReport();
    assert(readReport, 'Report should be readable');
    assert.equal(readReport.reportId, originalReport.reportId);
    assert.equal(readReport.status, originalReport.status);
    assert.equal(readReport.syncSafe, false);
    assert.equal(readReport.canWriteToMind, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalReportPath) {
      process.env.IBR_IOS_SYNC_SAFETY_REPORT_PATH = originalReportPath;
    } else {
      delete process.env.IBR_IOS_SYNC_SAFETY_REPORT_PATH;
    }
  }
});

test('Sync safety status shows blocked/uncertain and not safe', () => {
  const report = generateIosSyncSafetyReport();

  // Status must be blocked or uncertain, never safe in this phase
  assert(report.status === 'blocked' || report.status === 'uncertain');
  assert.notEqual(report.status, 'safe');

  // canWriteToMind must remain false
  assert.equal(report.canWriteToMind, false);
});
