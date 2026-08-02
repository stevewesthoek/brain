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




test('post-write verification passes exact-path wiki approval checks for a valid manifest', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const originalMindEnv = process.env.IBR_MIND_REPO_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'post-write-verification-wiki-valid-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');
  const manifestPath = path.join(tempDir, 'manifest.json');
  const mindPath = path.join(tempDir, 'mind');

  writeFileSync(dryRunPath, JSON.stringify({ reportId: 'dry-run-wiki-valid' }));
  writeFileSync(manifestPath, JSON.stringify({
    manifestId: 'manifest-wiki-valid',
    generatedAt: '2026-06-17T12:00:00Z',
    sourceDryRunReportId: 'dry-run-wiki-valid',
    status: 'manifest-ready',
    writeEnabled: false,
    canWriteToMind: false,
    totalOperations: 1,
    totalManifestEntries: 1,
    blockers: [],
    safety: {},
    entries: [{
      entryId: 'entry-wiki-valid',
      operationId: 'op-wiki-valid',
      proposalId: 'proposal-wiki-valid',
      category: 'wiki-writing',
      operationType: 'update',
      intendedAction: 'update in wiki-writing',
      targetPathsPreview: ['knowledge/example.md'],
      approvalId: 'mind-approval-valid',
      sourceReportId: 'report-1',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-17T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      expectedBeforeHashes: { 'knowledge/example.md': 'a'.repeat(64) },
      allowedSections: { 'knowledge/example.md': ['Approved section'] },
      contentIntent: 'Update only the approved section.',
      exactPathApprovalValid: true,
      exactPathApprovalErrors: [],
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
      applied: false
    }]
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    process.env.IBR_WRITE_MANIFEST_PATH = manifestPath;
    process.env.IBR_MIND_REPO_PATH = mindPath;

    const report = generatePostWriteVerificationReport();
    const checks = new Map(report.checks.map(check => [check.label, check.status]));

    assert.equal(checks.get('Exact approved wiki target paths are valid'), 'pass');
    assert.equal(checks.get('Expected before-state hashes are present'), 'pass');
    assert.equal(checks.get('Approval provenance is complete and unexpired'), 'pass');
    assert.equal(checks.get('No unapproved wiki paths are present'), 'pass');
    assert.equal(report.canExecute, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    else delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    if (originalManifestEnv) process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    else delete process.env.IBR_WRITE_MANIFEST_PATH;
    if (originalMindEnv) process.env.IBR_MIND_REPO_PATH = originalMindEnv;
    else delete process.env.IBR_MIND_REPO_PATH;
  }
});

test('post-write verification blocks invalid or unapproved wiki paths', () => {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'post-write-verification-wiki-invalid-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');
  const manifestPath = path.join(tempDir, 'manifest.json');

  writeFileSync(dryRunPath, JSON.stringify({ reportId: 'dry-run-wiki-invalid' }));
  writeFileSync(manifestPath, JSON.stringify({
    manifestId: 'manifest-wiki-invalid', generatedAt: '2026-06-17T12:00:00Z', sourceDryRunReportId: 'dry-run-wiki-invalid',
    status: 'manifest-ready', writeEnabled: false, canWriteToMind: false, totalOperations: 1, totalManifestEntries: 1,
    blockers: [], safety: {}, entries: [{
      entryId: 'entry-invalid', operationId: 'op-invalid', proposalId: 'proposal-invalid', category: 'wiki-writing',
      operationType: 'update', intendedAction: 'update in wiki-writing', targetPathsPreview: ['wiki/'],
      approvalId: null, sourceReportId: null, sourceCommit: null, approvedBy: null, approvedAt: null,
      expiresAt: '2020-01-01T00:00:00Z', expectedBeforeHashes: {}, allowedSections: {}, contentIntent: null,
      exactPathApprovalValid: false, exactPathApprovalErrors: ['invalid-wiki-target:wiki/'], contentPreviewAvailable: false,
      contentPreviewHash: null, wouldCreateFiles: false, wouldModifyFiles: true, wouldDeleteFiles: false,
      wouldMoveFiles: false, requiresRollbackPlan: false, rollbackPreview: '', validationRequired: [], writeBlocked: true, applied: false
    }]
  }));

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    process.env.IBR_WRITE_MANIFEST_PATH = manifestPath;

    const report = generatePostWriteVerificationReport();
    const checks = new Map(report.checks.map(check => [check.label, check.status]));

    assert.equal(checks.get('Exact approved wiki target paths are valid'), 'blocked');
    assert.equal(checks.get('Expected before-state hashes are present'), 'blocked');
    assert.equal(checks.get('Approval provenance is complete and unexpired'), 'blocked');
    assert.equal(checks.get('No unapproved wiki paths are present'), 'blocked');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    else delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    if (originalManifestEnv) process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    else delete process.env.IBR_WRITE_MANIFEST_PATH;
  }
});




function runSourceReferenceVerificationFixture(
  entry: Record<string, unknown> | null,
): ReturnType<typeof generatePostWriteVerificationReport> {
  const originalDryRunEnv = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  const originalManifestEnv = process.env.IBR_WRITE_MANIFEST_PATH;
  const originalMindEnv = process.env.IBR_MIND_REPO_PATH;
  const tempDir = mkdtempSync(path.join('/tmp', 'post-write-source-reference-'));
  const dryRunPath = path.join(tempDir, 'dry-run.json');
  const manifestPath = path.join(tempDir, 'manifest.json');

  writeFileSync(dryRunPath, JSON.stringify({ id: 'dry-run-source-reference', status: 'complete' }));
  if (entry) {
    writeFileSync(manifestPath, JSON.stringify({
      manifestId: 'manifest-source-reference',
      generatedAt: '2026-06-18T09:00:00Z',
      sourceDryRunReportId: 'dry-run-source-reference',
      status: 'manifest-ready',
      writeEnabled: false,
      canWriteToMind: false,
      totalOperations: 1,
      totalManifestEntries: 1,
      entries: [entry],
      blockers: [],
      safety: {},
    }));
  }

  try {
    process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = dryRunPath;
    process.env.IBR_WRITE_MANIFEST_PATH = entry ? manifestPath : path.join(tempDir, 'missing-manifest.json');
    process.env.IBR_MIND_REPO_PATH = tempDir;
    return generatePostWriteVerificationReport();
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    if (originalDryRunEnv) process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH = originalDryRunEnv;
    else delete process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
    if (originalManifestEnv) process.env.IBR_WRITE_MANIFEST_PATH = originalManifestEnv;
    else delete process.env.IBR_WRITE_MANIFEST_PATH;
    if (originalMindEnv) process.env.IBR_MIND_REPO_PATH = originalMindEnv;
    else delete process.env.IBR_MIND_REPO_PATH;
  }
}

function sourceReferenceManifestEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    entryId: 'entry-source-reference',
    operationId: 'op-source-reference',
    proposalId: 'proposal-source-reference',
    category: 'wiki-writing',
    operationType: 'update',
    intendedAction: 'update in wiki-writing',
    targetPathsPreview: ['wiki/example.md'],
    approvalId: 'approval-source-reference',
    sourceReportId: null,
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    approvedBy: 'human-reviewer',
    approvedAt: '2026-06-18T09:00:00Z',
    expiresAt: '2099-06-18T12:00:00Z',
    expectedBeforeHashes: { 'wiki/example.md': 'a'.repeat(64) },
    allowedSections: { 'wiki/example.md': ['Approved section'] },
    contentIntent: 'Update only the approved section.',
    sourceReferences: [{
      path: 'sources/research/example.md',
      location: '## Evidence',
      summary: 'Supports the approved update.',
    }],
    replaceSourceReferences: false,
    sourceReferencesPreserved: true,
    exactPathApprovalValid: true,
    exactPathApprovalErrors: [],
    contentPreviewAvailable: false,
    contentPreviewHash: null,
    wouldCreateFiles: false,
    wouldModifyFiles: true,
    wouldDeleteFiles: false,
    wouldMoveFiles: false,
    requiresRollbackPlan: false,
    rollbackPreview: '',
    validationRequired: ['source-reference-preserved'],
    writeBlocked: true,
    applied: false,
    ...overrides,
  };
}

test('post-write verification passes source-reference preservation with complete evidence', () => {
  const report = runSourceReferenceVerificationFixture(sourceReferenceManifestEntry());
  assert(report.checks.some(check =>
    check.label === 'source-reference-preserved' && check.status === 'pass'
  ));
});

test('post-write verification fails source-reference preservation when evidence is false', () => {
  const report = runSourceReferenceVerificationFixture(sourceReferenceManifestEntry({
    sourceReferencesPreserved: false,
    exactPathApprovalValid: false,
    validationRequired: [],
  }));
  assert(report.checks.some(check =>
    check.label === 'source-reference-preserved' && check.status === 'fail'
  ));
});

test('post-write verification blocks source-reference preservation without a manifest', () => {
  const report = runSourceReferenceVerificationFixture(null);
  assert(report.checks.some(check =>
    check.label === 'source-reference-preserved' && check.status === 'blocked'
  ));
});
