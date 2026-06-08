/**
 * Infinite Brain Metadata Writer Validation Tests
 * Validation of metadata entries from write manifest
 * Route-level tests are in routes.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateMetadataValidationReport, writeMetadataValidationReport, readMetadataValidationReport, readMetadataValidationSummary } from '../adapters/infinite-brain-metadata-writer-validation.js';

test('generateMetadataValidationReport returns blocked when manifest missing', () => {
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'metadata-validation-test-missing-'));
  const nonExistentPath = path.join(tempDir, 'manifest.json');

  try {
    process.env.IBR_WRITE_MANIFEST_PATH = nonExistentPath;

    const report = generateMetadataValidationReport();

    assert.equal(report.status, 'blocked', 'status should be blocked');
    assert.equal(report.validationAvailable, false, 'validationAvailable must be false');
    assert.equal(report.canWrite, false, 'canWrite must be false');
    assert.equal(report.canWriteToMind, false, 'canWriteToMind must be false');
    assert(report.blockers.length > 0, 'should have blockers');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalManifestEnv) {
      process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    } else {
      delete process.env.IBR_WRITE_MANIFEST_PATH;
    }
  }
});

test('generateMetadataValidationReport with metadata entries creates validation entries', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const originalValidationEnv = process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'metadata-validation-test-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');
  const manifestPath = path.join(tempDir, 'manifest.json');

  // Create a fake dry-run report
  writeFileSync(dryRunPath, JSON.stringify({
    reportId: 'dry-run-meta-123',
    status: 'dry-run-ready',
    operations: [
      {
        operationId: 'op-meta-1',
        proposalId: 'proposal-meta-1',
        category: 'entity-metadata',
        operationType: 'create',
        targetPathsPreview: ['/file.md'],
      },
    ],
  }));

  // Create a manifest with metadata entries
  writeFileSync(manifestPath, JSON.stringify({
    manifestId: 'manifest-meta-123',
    generatedAt: new Date().toISOString(),
    status: 'manifest-ready',
    entries: [
      {
        entryId: 'entry-meta-1',
        operationId: 'op-meta-1',
        proposalId: 'proposal-meta-1',
        category: 'entity-metadata',
        operationType: 'create',
        targetPathsPreview: ['/file.md'],
        writeBlocked: true,
        applied: false,
      },
    ],
    blockers: [],
    safety: {
      writesToMind: false,
      modifiesMind: false,
      appliesProposals: false,
      canWrite: false,
      canWriteToMind: false,
      manifestOnly: true,
      reportOnly: true,
    },
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    process.env.IBR_WRITE_MANIFEST_PATH = manifestPath;

    const report = generateMetadataValidationReport();

    assert.equal(report.totalMetadataEntries, 1, 'should have 1 metadata entry');
    assert(report.entries.length > 0, 'should have validation entries');
    assert.equal(report.entries[0]?.validationStatus, 'blocked', 'entry should have blocked validation status');
    assert.equal(report.entries[0]?.writeBlocked, true, 'entry writeBlocked must be true');
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
    if (originalValidationEnv) {
      process.env.IBR_METADATA_WRITER_VALIDATION_PATH = originalValidationEnv;
    } else {
      delete process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
    }
  }
});

test('reportId is deterministic for same manifest and entries', () => {
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'metadata-validation-test-deterministic-'));
  const manifestPath = path.join(tempDir, 'manifest.json');

  const manifest = {
    manifestId: 'manifest-meta-456',
    generatedAt: new Date().toISOString(),
    status: 'manifest-ready',
    entries: [
      {
        entryId: 'entry-meta-2',
        operationId: 'op-meta-2',
        proposalId: 'proposal-meta-2',
        category: 'entity-metadata',
        operationType: 'update',
        targetPathsPreview: ['/path/file.md'],
        writeBlocked: true,
        applied: false,
      },
    ],
    blockers: [],
    safety: {
      writesToMind: false,
      modifiesMind: false,
      appliesProposals: false,
      canWrite: false,
      canWriteToMind: false,
      manifestOnly: true,
      reportOnly: true,
    },
  };

  writeFileSync(manifestPath, JSON.stringify(manifest));

  try {
    process.env.IBR_WRITE_MANIFEST_PATH = manifestPath;

    const report1 = generateMetadataValidationReport();
    const report2 = generateMetadataValidationReport();

    assert.equal(report1.reportId, report2.reportId, 'Same manifest should produce same reportId');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalManifestEnv) {
      process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    } else {
      delete process.env.IBR_WRITE_MANIFEST_PATH;
    }
  }
});

test('safety block has all write gates false and validationOnly/reportOnly true', () => {
  const report = generateMetadataValidationReport();

  assert.equal(report.safety.writesToMind, false, 'writesToMind must be false');
  assert.equal(report.safety.modifiesMind, false, 'modifiesMind must be false');
  assert.equal(report.safety.appliesProposals, false, 'appliesProposals must be false');
  assert.equal(report.safety.canWrite, false, 'canWrite must be false');
  assert.equal(report.safety.canWriteToMind, false, 'canWriteToMind must be false');
  assert.equal(report.safety.validationOnly, true, 'validationOnly must be true');
  assert.equal(report.safety.reportOnly, true, 'reportOnly must be true');
  assert.equal(report.safety.continuousRuntime, false, 'continuousRuntime must be false');
  assert.equal(report.safety.modelCalls, false, 'modelCalls must be false');
  assert.equal(report.safety.usesShell, false, 'usesShell must be false');
});

test('readMetadataValidationSummary returns available false when report missing', () => {
  const originalEnv = process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'metadata-validation-test-summary-'));
  const nonExistentPath = path.join(tempDir, 'missing.json');

  try {
    process.env.IBR_METADATA_WRITER_VALIDATION_PATH = nonExistentPath;

    const summary = readMetadataValidationSummary();

    assert.equal(summary.available, false, 'available should be false when report missing');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.IBR_METADATA_WRITER_VALIDATION_PATH = originalEnv;
    } else {
      delete process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
    }
  }
});

test('writeMetadataValidationReport creates report file and readMetadataValidationReport retrieves it', () => {
  const originalEnv = process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'metadata-validation-test-write-'));
  const reportPath = path.join(tempDir, 'validation.json');

  try {
    process.env.IBR_METADATA_WRITER_VALIDATION_PATH = reportPath;

    const originalReport = generateMetadataValidationReport();
    const writeSuccess = writeMetadataValidationReport(originalReport);
    assert.equal(writeSuccess, true, 'write should succeed');

    const retrievedReport = readMetadataValidationReport();
    assert(retrievedReport, 'report should be retrievable');
    assert.equal(retrievedReport?.reportId, originalReport.reportId, 'report IDs should match');
    assert.equal(retrievedReport?.status, originalReport.status, 'report status should match');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalEnv) {
      process.env.IBR_METADATA_WRITER_VALIDATION_PATH = originalEnv;
    } else {
      delete process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
    }
  }
});
