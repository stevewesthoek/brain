/**
 * Infinite Brain Metadata Patch Preview Tests
 * Patch preview generation and safety verification
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generateMetadataPatchPreviewReport, writeMetadataPatchPreviewReport, readMetadataPatchPreviewReport } from '../adapters/infinite-brain-metadata-patch-preview.js';

test('generateMetadataPatchPreviewReport returns blocked when validation missing', () => {
  const originalValidationEnv = process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'patch-preview-test-missing-'));
  const nonExistentValidationPath = path.join(tempDir, 'validation.json');
  const nonExistentManifestPath = path.join(tempDir, 'manifest.json');

  try {
    process.env.IBR_METADATA_WRITER_VALIDATION_PATH = nonExistentValidationPath;
    process.env.IBR_WRITE_MANIFEST_PATH = nonExistentManifestPath;

    const report = generateMetadataPatchPreviewReport();

    assert.equal(report.status, 'blocked', 'status should be blocked');
    assert.equal(report.previewAvailable, false, 'previewAvailable must be false');
    assert.equal(report.canWrite, false, 'canWrite must be false');
    assert.equal(report.canWriteToMind, false, 'canWriteToMind must be false');
    assert(report.blockers.length > 0, 'should have blockers');
    assert.deepEqual(report.patches, [], 'should have no patches');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalValidationEnv) {
      process.env.IBR_METADATA_WRITER_VALIDATION_PATH = originalValidationEnv;
    } else {
      delete process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
    }
    if (originalManifestEnv) {
      process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    } else {
      delete process.env.IBR_WRITE_MANIFEST_PATH;
    }
  }
});

test('generateMetadataPatchPreviewReport creates blocked patch previews with temp data', () => {
  const originalValidationEnv = process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const originalPreviewEnv = process.env.IBR_METADATA_PATCH_PREVIEW_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'patch-preview-test-'));
  const validationPath = path.join(tempDir, 'validation.json');
  const manifestPath = path.join(tempDir, 'manifest.json');
  const previewPath = path.join(tempDir, 'preview.json');

  // Create fake validation report
  const validationReport = {
    reportId: 'mvv-test-12345',
    generatedAt: '2024-01-01T00:00:00Z',
    sourceManifestId: 'manifest-test-12345',
    status: 'blocked',
    writerCategory: 'entity-metadata',
    validationAvailable: false,
    canWrite: false,
    canWriteToMind: false,
    totalMetadataEntries: 1,
    validatedEntries: 0,
    blockedEntries: 1,
    entries: [
      {
        entryId: 'mventry-abc123456',
        manifestEntryId: 'entry-xyz789012',
        proposalId: 'proposal-test-001',
        targetPathsPreview: ['path/to/file.md'],
        validationStatus: 'blocked',
        reasons: [],
        frontmatterPatchAvailable: false,
        targetPathSafe: true,
        conflictDetectionAvailable: false,
        yamlValidationAvailable: false,
        writeBlocked: true,
        applied: false,
      },
    ],
    checks: [],
    blockers: ['Frontmatter patcher not yet implemented'],
    safety: {
      writesToMind: false,
      modifiesMind: false,
      appliesProposals: false,
      canWrite: false,
      canWriteToMind: false,
      validationOnly: true,
      reportOnly: true,
      continuousRuntime: false,
      modelCalls: false,
      usesShell: false,
    },
  };

  // Create fake write manifest
  const manifest = {
    manifestId: 'manifest-test-12345',
    generatedAt: '2024-01-01T00:00:00Z',
    sourceDryRunReportId: 'dry-run-test',
    status: 'manifest-ready',
    writeEnabled: false,
    canWriteToMind: false,
    totalOperations: 1,
    totalManifestEntries: 1,
    entries: [
      {
        entryId: 'entry-xyz789012',
        operationId: 'op-test-001',
        proposalId: 'proposal-test-001',
        category: 'entity-metadata',
        operationType: 'update-metadata',
        intendedAction: 'update-metadata in entity-metadata',
        targetPathsPreview: ['path/to/file.md'],
        contentPreviewAvailable: false,
        contentPreviewHash: null,
        wouldCreateFiles: false,
        wouldModifyFiles: true,
        wouldDeleteFiles: false,
        wouldMoveFiles: false,
        requiresRollbackPlan: false,
        rollbackPreview: '',
        validationRequired: [],
        writeBlocked: true,
        applied: false,
      },
    ],
    blockers: [],
    safety: {
      writesToMind: false,
      modifiesMind: false,
      deletesFiles: false,
      movesFiles: false,
      appliesProposals: false,
      writeEnabled: false,
      canWriteToMind: false,
      manifestOnly: true,
      reportOnly: true,
      continuousRuntime: false,
      modelCalls: false,
      usesShell: false,
    },
  };

  writeFileSync(validationPath, JSON.stringify(validationReport));
  writeFileSync(manifestPath, JSON.stringify(manifest));

  try {
    process.env.IBR_METADATA_WRITER_VALIDATION_PATH = validationPath;
    process.env.IBR_WRITE_MANIFEST_PATH = manifestPath;
    process.env.IBR_METADATA_PATCH_PREVIEW_PATH = previewPath;

    const report = generateMetadataPatchPreviewReport();

    assert.equal(report.status, 'blocked', 'status should be blocked');
    assert.equal(report.previewAvailable, false, 'previewAvailable must be false');
    assert.equal(report.canWrite, false, 'canWrite must be false');
    assert.equal(report.canWriteToMind, false, 'canWriteToMind must be false');
    assert.equal(report.writerCategory, 'entity-metadata', 'writer category should be entity-metadata');
    assert(report.patches.length > 0, 'should have patches');

    // Verify all patches are blocked
    report.patches.forEach((patch) => {
      assert.equal(patch.patchBlocked, true, 'patch should be blocked');
      assert.equal(patch.applied, false, 'patch should not be applied');
      assert.equal(patch.beforePreviewAvailable, false, 'before preview should not be available');
      assert.equal(patch.afterPreviewAvailable, false, 'after preview should not be available');
      assert.equal(patch.diffPreviewAvailable, false, 'diff preview should not be available');
    });

    // Verify safety block
    assert.equal(report.safety.writesToMind, false, 'safety: writesToMind must be false');
    assert.equal(report.safety.modifiesMind, false, 'safety: modifiesMind must be false');
    assert.equal(report.safety.appliesProposals, false, 'safety: appliesProposals must be false');
    assert.equal(report.safety.canWrite, false, 'safety: canWrite must be false');
    assert.equal(report.safety.canWriteToMind, false, 'safety: canWriteToMind must be false');
    assert.equal(report.safety.previewOnly, true, 'safety: previewOnly must be true');
    assert.equal(report.safety.reportOnly, true, 'safety: reportOnly must be true');
    assert.equal(report.safety.continuousRuntime, false, 'safety: continuousRuntime must be false');
    assert.equal(report.safety.modelCalls, false, 'safety: modelCalls must be false');
    assert.equal(report.safety.usesShell, false, 'safety: usesShell must be false');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalValidationEnv) {
      process.env.IBR_METADATA_WRITER_VALIDATION_PATH = originalValidationEnv;
    } else {
      delete process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
    }
    if (originalManifestEnv) {
      process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    } else {
      delete process.env.IBR_WRITE_MANIFEST_PATH;
    }
    if (originalPreviewEnv) {
      process.env.IBR_METADATA_PATCH_PREVIEW_PATH = originalPreviewEnv;
    } else {
      delete process.env.IBR_METADATA_PATCH_PREVIEW_PATH;
    }
  }
});

test('patch IDs are deterministic for same entries', () => {
  const originalValidationEnv = process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const originalPreviewEnv = process.env.IBR_METADATA_PATCH_PREVIEW_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'patch-preview-test-deterministic-'));
  const validationPath = path.join(tempDir, 'validation.json');
  const manifestPath = path.join(tempDir, 'manifest.json');
  const previewPath = path.join(tempDir, 'preview.json');

  const validationReport = {
    reportId: 'mvv-test-12345',
    generatedAt: '2024-01-01T00:00:00Z',
    sourceManifestId: 'manifest-test-12345',
    status: 'blocked',
    writerCategory: 'entity-metadata',
    validationAvailable: false,
    canWrite: false,
    canWriteToMind: false,
    totalMetadataEntries: 1,
    validatedEntries: 0,
    blockedEntries: 1,
    entries: [
      {
        entryId: 'mventry-abc123456',
        manifestEntryId: 'entry-xyz789012',
        proposalId: 'proposal-test-001',
        targetPathsPreview: ['path/to/file.md'],
        validationStatus: 'blocked',
        reasons: [],
        frontmatterPatchAvailable: false,
        targetPathSafe: true,
        conflictDetectionAvailable: false,
        yamlValidationAvailable: false,
        writeBlocked: true,
        applied: false,
      },
    ],
    checks: [],
    blockers: [],
    safety: {
      writesToMind: false,
      modifiesMind: false,
      appliesProposals: false,
      canWrite: false,
      canWriteToMind: false,
      validationOnly: true,
      reportOnly: true,
      continuousRuntime: false,
      modelCalls: false,
      usesShell: false,
    },
  };

  const manifest = {
    manifestId: 'manifest-test-12345',
    generatedAt: '2024-01-01T00:00:00Z',
    sourceDryRunReportId: 'dry-run-test',
    status: 'manifest-ready',
    writeEnabled: false,
    canWriteToMind: false,
    totalOperations: 1,
    totalManifestEntries: 1,
    entries: [
      {
        entryId: 'entry-xyz789012',
        operationId: 'op-test-001',
        proposalId: 'proposal-test-001',
        category: 'entity-metadata',
        operationType: 'update-metadata',
        intendedAction: 'update-metadata in entity-metadata',
        targetPathsPreview: ['path/to/file.md'],
        contentPreviewAvailable: false,
        contentPreviewHash: null,
        wouldCreateFiles: false,
        wouldModifyFiles: true,
        wouldDeleteFiles: false,
        wouldMoveFiles: false,
        requiresRollbackPlan: false,
        rollbackPreview: '',
        validationRequired: [],
        writeBlocked: true,
        applied: false,
      },
    ],
    blockers: [],
    safety: {
      writesToMind: false,
      modifiesMind: false,
      deletesFiles: false,
      movesFiles: false,
      appliesProposals: false,
      writeEnabled: false,
      canWriteToMind: false,
      manifestOnly: true,
      reportOnly: true,
      continuousRuntime: false,
      modelCalls: false,
      usesShell: false,
    },
  };

  writeFileSync(validationPath, JSON.stringify(validationReport));
  writeFileSync(manifestPath, JSON.stringify(manifest));

  try {
    process.env.IBR_METADATA_WRITER_VALIDATION_PATH = validationPath;
    process.env.IBR_WRITE_MANIFEST_PATH = manifestPath;
    process.env.IBR_METADATA_PATCH_PREVIEW_PATH = previewPath;

    const report1 = generateMetadataPatchPreviewReport();
    const report2 = generateMetadataPatchPreviewReport();

    assert.equal(report1.previewId, report2.previewId, 'preview IDs should be deterministic');
    if (report1.patches.length > 0 && report2.patches.length > 0) {
      const patch1 = report1.patches[0];
      const patch2 = report2.patches[0];
      assert(patch1 && patch2, 'patches should be defined');
      assert.equal(patch1.patchId, patch2.patchId, 'patch IDs should be deterministic');
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalValidationEnv) {
      process.env.IBR_METADATA_WRITER_VALIDATION_PATH = originalValidationEnv;
    } else {
      delete process.env.IBR_METADATA_WRITER_VALIDATION_PATH;
    }
    if (originalManifestEnv) {
      process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    } else {
      delete process.env.IBR_WRITE_MANIFEST_PATH;
    }
    if (originalPreviewEnv) {
      process.env.IBR_METADATA_PATCH_PREVIEW_PATH = originalPreviewEnv;
    } else {
      delete process.env.IBR_METADATA_PATCH_PREVIEW_PATH;
    }
  }
});
