#!/usr/bin/env node
/**
 * Rollback Infinite Brain single-file metadata write to before state.
 *
 * Restores the allowlisted target file from the latest rollback snapshot.
 * Works only on files previously written via the single-file metadata write test.
 *
 * Safety:
 * - Only restores the exact target path from the rollback snapshot
 * - Never writes to multiple files
 * - Never touches non-allowlisted files
 * - Report written to Brain runtime only, never to Mind
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

const ROLLBACK_SNAPSHOT_PATH = path.resolve(
  BRAIN_ROOT,
  'runtime/local/infinite-brain/metadata-write-rollback-latest.json'
);

const ROLLBACK_APPLIED_REPORT_PATH = path.resolve(
  BRAIN_ROOT,
  'runtime/local/infinite-brain/metadata-write-rollback-applied-latest.json'
);

function fail(message, details) {
  console.error(`\n[rollback] FAILED: ${message}`);
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

async function main() {
  console.log('[rollback] Reading latest rollback snapshot...');

  const snapshot = readJsonSafely(ROLLBACK_SNAPSHOT_PATH);
  if (!snapshot) {
    fail('No rollback snapshot found. Has a single-file write test been run?', {
      snapshotPath: ROLLBACK_SNAPSHOT_PATH,
    });
  }

  console.log(`[rollback] Target file: ${snapshot.targetPath}`);
  console.log(`[rollback] Rollback ID: ${snapshot.rollbackId}`);
  console.log(`[rollback] Before hash: ${snapshot.beforeContentHash}`);

  // Verify snapshot structure
  if (!snapshot.beforeContent || !snapshot.targetPath || !snapshot.rollbackId) {
    fail('Rollback snapshot is malformed or incomplete', { snapshot });
  }

  // Read current file content before restoration
  let currentContent = '';
  let currentHash = '';
  try {
    currentContent = fs.readFileSync(snapshot.targetPath, 'utf8');
    currentHash = computeContentHash(currentContent);
    console.log(`[rollback] Current file hash: ${currentHash}`);
  } catch (err) {
    fail('Could not read target file', {
      targetPath: snapshot.targetPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Restore file content from snapshot
  console.log('[rollback] Restoring file from snapshot...');
  try {
    fs.writeFileSync(snapshot.targetPath, snapshot.beforeContent);
  } catch (err) {
    fail('Could not write to target file', {
      targetPath: snapshot.targetPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Verify restoration
  let restoredContent = '';
  let restoredHash = '';
  try {
    restoredContent = fs.readFileSync(snapshot.targetPath, 'utf8');
    restoredHash = computeContentHash(restoredContent);
    console.log(`[rollback] Restored file hash: ${restoredHash}`);
  } catch (err) {
    fail('Could not verify restored file', {
      targetPath: snapshot.targetPath,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Verify restoration matches before state
  if (restoredHash !== snapshot.beforeContentHash) {
    fail('Restored file hash does not match snapshot before hash', {
      expectedHash: snapshot.beforeContentHash,
      actualHash: restoredHash,
    });
  }

  if (restoredContent !== snapshot.beforeContent) {
    fail('Restored file content does not match snapshot before content', {
      expectedLength: snapshot.beforeContent.length,
      actualLength: restoredContent.length,
    });
  }

  // Write rollback-applied report to Brain runtime
  console.log('[rollback] Writing rollback-applied report to Brain runtime...');
  try {
    const reportDir = path.dirname(ROLLBACK_APPLIED_REPORT_PATH);
    fs.mkdirSync(reportDir, { recursive: true });

    const report = {
      rollbackId: snapshot.rollbackId,
      appliedAt: new Date().toISOString(),
      appliedByOperator: process.env.IBR_OPERATOR || 'Steve',
      reason: process.env.IBR_ROLLBACK_REASON || 'Manual rollback to before state',
      targetPath: snapshot.targetPath,
      beforeContentHash: snapshot.beforeContentHash,
      currentContentHashBeforeRollback: currentHash,
      restoredContentHash: restoredHash,
      verificationPassed: true,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        arbitraryWritesAllowed: false,
        singleFileOnly: true,
        allowlistedOnly: true,
        deletesFiles: false,
        movesFiles: false,
        appliesProposals: false,
        applied: true,
        autonomousExecution: false,
        continuousRuntime: false,
        modelCalls: false,
        usesShell: false,
      },
    };

    fs.writeFileSync(ROLLBACK_APPLIED_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  } catch (err) {
    fail('Could not write rollback-applied report', {
      reportPath: ROLLBACK_APPLIED_REPORT_PATH,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  console.log('\n[rollback] SUCCESS');
  console.log(JSON.stringify({
    rollbackId: snapshot.rollbackId,
    targetPath: snapshot.targetPath,
    beforeContentHash: snapshot.beforeContentHash,
    currentContentHashBeforeRollback: currentHash,
    restoredContentHash: restoredHash,
    verificationPassed: true,
    appliedAt: new Date().toISOString(),
  }, null, 2));
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
