/**
 * Infinite Brain Write Manifest Tests
 * Manifest generation from executor dry-run
 * Route-level tests are in routes.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateWriteManifest, writeWriteManifest, readWriteManifest, readWriteManifestSummary } from '../adapters/infinite-brain-write-manifest.js';

test('generateWriteManifest returns blocked when dry-run missing', () => {
  const originalEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-test-missing-'));
  const nonExistentPath = path.join(tempDir, 'dry-run.json');

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = nonExistentPath;

    const manifest = generateWriteManifest();

    assert.equal(manifest.status, 'blocked', 'status should be blocked');
    assert.equal(manifest.writeEnabled, false, 'writeEnabled must be false');
    assert.equal(manifest.canWriteToMind, false, 'canWriteToMind must be false');
    assert(manifest.blockers.length > 0, 'should have blockers');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
  }
});

test('generateWriteManifest with temp executor dry-run creates manifest entries', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-test-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');

  // Create a fake dry-run report with operations
  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-123',
    status: 'dry-run-ready',
    operations: [
      {
        operationId: 'op-1',
        proposalId: 'proposal-1',
        category: 'inbox',
        operationType: 'create',
        targetPathsPreview: ['/path/to/file'],
        wouldDeleteFiles: false,
        wouldMoveFiles: false,
      },
      {
        operationId: 'op-2',
        proposalId: 'proposal-2',
        category: 'strategy',
        operationType: 'update',
        targetPathsPreview: ['/path/to/file2'],
        wouldDeleteFiles: false,
        wouldMoveFiles: false,
      },
    ],
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;

    const manifest = generateWriteManifest();

    assert.equal(manifest.totalOperations, 2, 'should have 2 operations');
    assert.equal(manifest.totalManifestEntries, 2, 'should have 2 manifest entries');
    assert(manifest.entries.length > 0, 'should have entries');
    assert.equal(manifest.entries[0]?.operationId, 'op-1', 'first entry should reference first operation');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
    if (originalManifestEnv) {
      process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    } else {
      delete process.env.IBR_WRITE_MANIFEST_PATH;
    }
  }
});

test('manifestId is deterministic for same operations', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-test-deterministic-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');

  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-456',
    status: 'dry-run-ready',
    operations: [
      {
        operationId: 'op-1',
        proposalId: 'proposal-1',
        category: 'inbox',
        operationType: 'create',
        targetPathsPreview: ['/path/to/file'],
      },
    ],
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;

    const manifest1 = generateWriteManifest();
    const manifest2 = generateWriteManifest();

    assert.equal(manifest1.manifestId, manifest2.manifestId, 'Same operations should produce same manifestId');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
  }
});

test('entries have writeBlocked true and applied false', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-test-blocked-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');

  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-789',
    status: 'dry-run-ready',
    operations: [
      {
        operationId: 'op-1',
        proposalId: 'proposal-1',
        category: 'inbox',
        operationType: 'create',
        targetPathsPreview: ['/file'],
      },
    ],
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;

    const manifest = generateWriteManifest();

    assert(manifest.entries.length > 0, 'should have entries');
    assert.equal(manifest.entries[0]?.writeBlocked, true, 'writeBlocked must be true');
    assert.equal(manifest.entries[0]?.applied, false, 'applied must be false');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
  }
});

test('safety block has writesToMind false, modifiesMind false, canWriteToMind false, usesShell false', () => {
  const manifest = generateWriteManifest();

  assert.equal(manifest.safety.writesToMind, false, 'writesToMind must be false');
  assert.equal(manifest.safety.modifiesMind, false, 'modifiesMind must be false');
  assert.equal(manifest.safety.deletesFiles, false, 'deletesFiles must be false');
  assert.equal(manifest.safety.movesFiles, false, 'movesFiles must be false');
  assert.equal(manifest.safety.appliesProposals, false, 'appliesProposals must be false');
  assert.equal(manifest.safety.writeEnabled, false, 'writeEnabled must be false');
  assert.equal(manifest.safety.canWriteToMind, false, 'canWriteToMind must be false');
  assert.equal(manifest.safety.manifestOnly, true, 'manifestOnly must be true');
  assert.equal(manifest.safety.reportOnly, true, 'reportOnly must be true');
  assert.equal(manifest.safety.usesShell, false, 'usesShell must be false');
});

test('readWriteManifestSummary returns available false when manifest missing', () => {
  const originalEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-test-summary-'));
  const nonExistentPath = path.join(tempDir, 'missing.json');

  try {
    process.env.IBR_WRITE_MANIFEST_PATH = nonExistentPath;

    const summary = readWriteManifestSummary();

    assert.equal(summary.available, false, 'available should be false when manifest missing');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.IBR_WRITE_MANIFEST_PATH = originalEnv;
    } else {
      delete process.env.IBR_WRITE_MANIFEST_PATH;
    }
  }
});
