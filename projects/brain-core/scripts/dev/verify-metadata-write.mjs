#!/usr/bin/env node
/**
 * Post-write verification runner for Infinite Brain single-file metadata writes.
 *
 * Fetches the latest write report and verifies:
 * - Target file exists and is readable
 * - Target file hash matches expected after hash
 * - Rollback snapshot exists and is valid
 * - Write report is safe and single-file-only
 *
 * Safety: Report-only, no writes, all verification read-only.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

const WRITE_REPORT_PATH = path.resolve(
  BRAIN_ROOT,
  'runtime/local/infinite-brain/metadata-writer-write-latest.json'
);

const ROLLBACK_SNAPSHOT_PATH = path.resolve(
  BRAIN_ROOT,
  'runtime/local/infinite-brain/metadata-write-rollback-latest.json'
);

const VERIFICATION_REPORT_PATH = path.resolve(
  BRAIN_ROOT,
  'runtime/local/infinite-brain/metadata-write-verification-latest.json'
);

function fail(message, details) {
  console.error(`\n[verify] FAILED: ${message}`);
  if (details !== undefined) {
    console.error(JSON.stringify(details, null, 2));
  }
  process.exit(1);
}

function readJsonSafely(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function computeContentHash(content) {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 12);
}

function performVerificationChecks(writeReport, rollbackSnapshot) {
  const checks = [];

  // Check 1: write report status is test-write-applied
  checks.push({
    checkId: 'check-write-status',
    label: 'Write status is test-write-applied',
    status: writeReport.status === 'test-write-applied' ? 'pass' : 'fail',
    reason:
      writeReport.status === 'test-write-applied'
        ? 'Write report shows test-write-applied status'
        : `Expected status 'test-write-applied' but got '${writeReport.status}'`,
  });

  // Check 2: write report has required fields
  checks.push({
    checkId: 'check-required-fields',
    label: 'Write report has required fields',
    status:
      writeReport.beforeContentHash && writeReport.afterContentHash && writeReport.targetPath
        ? 'pass'
        : 'fail',
    reason:
      writeReport.beforeContentHash && writeReport.afterContentHash && writeReport.targetPath
        ? 'Required fields present'
        : 'Missing beforeContentHash, afterContentHash, or targetPath',
  });

  // Check 3: target file exists and is readable
  let fileExists = false;
  let fileContent = '';
  let actualHash = '';
  try {
    fileContent = fs.readFileSync(writeReport.targetPath, 'utf8');
    fileExists = true;
    actualHash = computeContentHash(fileContent);
  } catch {
    fileExists = false;
  }

  checks.push({
    checkId: 'check-target-file-exists',
    label: 'Target file exists and is readable',
    status: fileExists ? 'pass' : 'fail',
    reason: fileExists ? `Target file is readable at ${writeReport.targetPath}` : 'Target file not found or not readable',
  });

  // Check 4: target file hash matches expected after hash
  checks.push({
    checkId: 'check-content-hash-match',
    label: 'Target file hash matches expected after hash',
    status:
      fileExists && actualHash === writeReport.afterContentHash
        ? 'pass'
        : fileExists
          ? 'fail'
          : 'blocked',
    reason:
      fileExists && actualHash === writeReport.afterContentHash
        ? `File hash ${actualHash} matches expected ${writeReport.afterContentHash}`
        : fileExists
          ? `File hash ${actualHash} does not match expected ${writeReport.afterContentHash}`
          : 'Cannot verify hash without readable file',
  });

  // Check 5: rollback snapshot exists
  checks.push({
    checkId: 'check-rollback-snapshot',
    label: 'Rollback snapshot exists',
    status: rollbackSnapshot ? 'pass' : 'fail',
    reason: rollbackSnapshot ? 'Rollback snapshot is available' : 'No rollback snapshot found',
  });

  // Check 6: rollback snapshot has before content
  checks.push({
    checkId: 'check-rollback-before-content',
    label: 'Rollback snapshot has before content',
    status: rollbackSnapshot && rollbackSnapshot.beforeContent ? 'pass' : 'fail',
    reason:
      rollbackSnapshot && rollbackSnapshot.beforeContent
        ? 'Rollback snapshot contains before content'
        : 'Rollback snapshot missing before content',
  });

  // Check 7: write report is single-file only
  checks.push({
    checkId: 'check-single-file-only',
    label: 'Write report is single-file-only',
    status: writeReport.singleFileOnly === true ? 'pass' : 'fail',
    reason:
      writeReport.singleFileOnly === true
        ? 'Write was single-file-only as required'
        : 'Write report singleFileOnly is not true',
  });

  // Check 8: write report is allowlisted only
  checks.push({
    checkId: 'check-allowlisted-only',
    label: 'Write report is allowlisted-only',
    status: writeReport.allowlistedOnly === true ? 'pass' : 'fail',
    reason:
      writeReport.allowlistedOnly === true
        ? 'Write was allowlisted-only as required'
        : 'Write report allowlistedOnly is not true',
  });

  // Check 9: write report autonomous execution is false
  checks.push({
    checkId: 'check-no-autonomous-execution',
    label: 'No autonomous execution',
    status: writeReport.autonomousExecution === false ? 'pass' : 'fail',
    reason:
      writeReport.autonomousExecution === false
        ? 'Autonomous execution is disabled'
        : 'Autonomous execution flag is not false',
  });

  // Check 10: write report applied is false
  checks.push({
    checkId: 'check-not-applied',
    label: 'Write is test-write only (not applied)',
    status: writeReport.applied === false ? 'pass' : 'fail',
    reason:
      writeReport.applied === false ? 'Write is test-write only' : 'Write report applied is not false',
  });

  // Check 11: safety flags are correct
  checks.push({
    checkId: 'check-safety-flags',
    label: 'Safety flags are correct',
    status:
      writeReport.safety &&
      writeReport.safety.writesToMind === true &&
      writeReport.safety.modifiesMind === true &&
      writeReport.safety.singleFileOnly === true &&
      writeReport.safety.allowlistedOnly === true &&
      writeReport.safety.autonomousExecution === false &&
      writeReport.safety.applied === false
        ? 'pass'
        : 'fail',
    reason:
      writeReport.safety &&
      writeReport.safety.writesToMind === true &&
      writeReport.safety.modifiesMind === true &&
      writeReport.safety.singleFileOnly === true &&
      writeReport.safety.allowlistedOnly === true &&
      writeReport.safety.autonomousExecution === false &&
      writeReport.safety.applied === false
        ? 'All safety flags are correct'
        : 'One or more safety flags are incorrect',
  });

  return checks;
}

async function main() {
  console.log('[verify] Reading latest write report...');

  let writeReport = readJsonSafely(WRITE_REPORT_PATH);

  // Fallback: fetch from API if not on disk
  if (!writeReport) {
    const BASE = process.env.BRAIN_CORE_API_BASE ?? 'http://127.0.0.1:4877';
    try {
      const response = await fetch(`${BASE}/api/infinite-brain/metadata-writer/write`);
      const body = await response.json();
      if (body?.report) {
        writeReport = body.report;
        console.log('[verify] Fetched write report from API');
      }
    } catch (err) {
      // Silently fail and use null
    }
  }

  if (!writeReport) {
    fail('No write report found. Has a single-file write test been run?', {
      reportPath: WRITE_REPORT_PATH,
      apiEndpoint: 'http://127.0.0.1:4877/api/infinite-brain/metadata-writer/write',
    });
  }

  console.log(`[verify] Write ID: ${writeReport.writeId}`);
  console.log(`[verify] Status: ${writeReport.status}`);
  console.log(`[verify] Target file: ${writeReport.targetPath}`);

  console.log('[verify] Reading rollback snapshot...');
  const rollbackSnapshot = readJsonSafely(ROLLBACK_SNAPSHOT_PATH);

  console.log('[verify] Performing verification checks...');
  const checks = performVerificationChecks(writeReport, rollbackSnapshot);

  const passedChecks = checks.filter(c => c.status === 'pass');
  const failedChecks = checks.filter(c => c.status === 'fail');
  const blockedChecks = checks.filter(c => c.status === 'blocked');

  console.log(`[verify] Passed: ${passedChecks.length}/${checks.length}`);
  if (failedChecks.length > 0) {
    console.log(`[verify] Failed: ${failedChecks.length}`);
  }
  if (blockedChecks.length > 0) {
    console.log(`[verify] Blocked: ${blockedChecks.length}`);
  }

  // Write verification report to Brain runtime
  console.log('[verify] Writing verification report to Brain runtime...');
  try {
    const reportDir = path.dirname(VERIFICATION_REPORT_PATH);
    fs.mkdirSync(reportDir, { recursive: true });

    const report = {
      verificationId: `pwv-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      writeId: writeReport.writeId,
      targetPath: writeReport.targetPath,
      status: failedChecks.length === 0 ? 'verified' : 'verification-failed',
      checks,
      passedCount: passedChecks.length,
      failedCount: failedChecks.length,
      blockedCount: blockedChecks.length,
      totalChecks: checks.length,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        verificationOnly: true,
        reportOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: false,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };

    fs.writeFileSync(VERIFICATION_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    fail('Could not write verification report', {
      reportPath: VERIFICATION_REPORT_PATH,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (failedChecks.length > 0) {
    console.error('\n[verify] VERIFICATION FAILED');
    console.error('Failed checks:');
    for (const check of failedChecks) {
      console.error(`  - ${check.label}: ${check.reason}`);
    }
    process.exit(1);
  }

  console.log('\n[verify] SUCCESS');
  console.log(JSON.stringify({
    writeId: writeReport.writeId,
    targetPath: writeReport.targetPath,
    status: 'verified',
    passedCount: passedChecks.length,
    totalChecks: checks.length,
    verifiedAt: new Date().toISOString(),
  }, null, 2));
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
