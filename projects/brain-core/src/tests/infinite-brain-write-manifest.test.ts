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




test('wiki manifest entries preserve exact-path approval provenance and required checks', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-test-wiki-approval-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');

  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-wiki-1',
    status: 'dry-run-ready',
    operations: [
      {
        operationId: 'op-wiki-1',
        proposalId: 'proposal-wiki-1',
        category: 'wiki-writing',
        operationType: 'update',
        targetPathsPreview: ['wiki/example.md'],
        approvalId: 'mind-approval-20260617-test',
        sourceReportId: 'report-1',
        sourceCommit: '0123456789abcdef0123456789abcdef01234567',
        approvedBy: 'human-reviewer',
        approvedAt: '2026-06-17T12:00:00Z',
        expiresAt: '2026-06-18T12:00:00Z',
        expectedBeforeHashes: { 'wiki/example.md': 'a'.repeat(64) },
        allowedSections: { 'wiki/example.md': ['Approved section'] },
        contentIntent: 'Replace only the approved section.',
        sourceReferences: [],
        replaceSourceReferences: false,
        sourceReferencesPreserved: true,
        exactPathApprovalValid: true,
        exactPathApprovalErrors: [],
        validationChecks: [],
      },
    ],
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;

    const manifest = generateWriteManifest();
    const entry = manifest.entries[0];

    assert(entry);
    assert.equal(entry.approvalId, 'mind-approval-20260617-test');
    assert.equal(entry.sourceReportId, 'report-1');
    assert.equal(entry.sourceCommit, '0123456789abcdef0123456789abcdef01234567');
    assert.equal(entry.approvedBy, 'human-reviewer');
    assert.equal(entry.exactPathApprovalValid, true);
    assert.deepEqual(entry.expectedBeforeHashes, { 'wiki/example.md': 'a'.repeat(64) });
    assert.deepEqual(entry.allowedSections, { 'wiki/example.md': ['Approved section'] });
    assert(entry.validationRequired.includes('target-path-match'));
    assert(entry.validationRequired.includes('before-hash-match'));
    assert(entry.validationRequired.includes('approval-not-expired'));
    assert(entry.validationRequired.includes('no-unapproved-paths-changed'));
    assert(entry.validationRequired.includes('source-reference-preserved'));
    assert.equal(entry.writeBlocked, true);
    assert.equal(entry.applied, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
  }
});

test('wiki manifest entries preserve exact-path approval errors and remain blocked', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-test-wiki-invalid-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');

  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-wiki-invalid',
    operations: [
      {
        operationId: 'op-wiki-invalid',
        proposalId: 'proposal-wiki-invalid',
        category: 'wiki-writing',
        operationType: 'update',
        targetPathsPreview: ['wiki/'],
        exactPathApprovalValid: false,
        exactPathApprovalErrors: ['invalid-wiki-target:wiki/'],
      },
    ],
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;

    const entry = generateWriteManifest().entries[0];

    assert(entry);
    assert.equal(entry.exactPathApprovalValid, false);
    assert.deepEqual(entry.exactPathApprovalErrors, [
      'invalid-wiki-target:wiki/',
      'source-reference-preservation-required',
    ]);
    assert.equal(entry.writeBlocked, true);
    assert.equal(entry.applied, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) {
      process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    } else {
      delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    }
  }
});




test('write manifest propagates preserved source references and validation label', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-source-reference-pass-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');
  const sourceReferences = [{
    path: 'sources/research/example.md',
    location: '## Evidence',
    summary: 'Supports the approved update.',
  }];

  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-source-reference-pass',
    operations: [{
      operationId: 'op-source-reference-pass',
      proposalId: 'proposal-source-reference-pass',
      category: 'wiki-writing',
      operationType: 'update',
      targetPathsPreview: ['wiki/example.md'],
      expectedBeforeHashes: { 'wiki/example.md': 'a'.repeat(64) },
      allowedSections: { 'wiki/example.md': ['Approved section'] },
      contentIntent: 'Update only the approved section.',
      exactPathApprovalValid: true,
      exactPathApprovalErrors: [],
      sourceReferences,
      replaceSourceReferences: false,
      sourceReferencesPreserved: true,
      validationChecks: [],
    }],
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    const manifest = generateWriteManifest();
    const entry = manifest.entries[0];
    assert(entry);
    assert.deepEqual(entry.sourceReferences, sourceReferences);
    assert.equal(entry.replaceSourceReferences, false);
    assert.equal(entry.sourceReferencesPreserved, true);
    assert(entry.validationRequired.includes('source-reference-preserved'));
    assert.equal(entry.exactPathApprovalValid, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    else delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  }
});

test('write manifest blocks and invalidates failed source-reference preservation', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'write-manifest-source-reference-fail-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');

  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-source-reference-fail',
    operations: [{
      operationId: 'op-source-reference-fail',
      proposalId: 'proposal-source-reference-fail',
      category: 'wiki-writing',
      operationType: 'update',
      targetPathsPreview: ['wiki/example.md'],
      expectedBeforeHashes: { 'wiki/example.md': 'a'.repeat(64) },
      exactPathApprovalValid: true,
      exactPathApprovalErrors: [],
      sourceReferences: [],
      replaceSourceReferences: false,
      sourceReferencesPreserved: false,
      validationChecks: [],
    }],
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    const manifest = generateWriteManifest();
    const entry = manifest.entries[0];
    assert(entry);
    assert.equal(entry.sourceReferencesPreserved, false);
    assert.equal(entry.exactPathApprovalValid, false);
    assert(entry.exactPathApprovalErrors.includes('source-reference-preservation-required'));
    assert.equal(entry.writeBlocked, true);
    assert.equal(entry.validationRequired.includes('source-reference-preserved'), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    else delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  }
});
