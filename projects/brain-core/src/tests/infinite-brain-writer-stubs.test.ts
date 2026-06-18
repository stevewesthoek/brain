/**
 * Infinite Brain Writer Stubs Tests
 * Verify all category-specific writers are blocked and return disabled status
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runAtomizationWriterDisabled,
  runMetadataWriterDisabled,
  runEdgesWriterDisabled,
  runWikiWriterDisabled,
  runTasksWriterDisabled,
  runCleanupWriterDisabled,
} from '../adapters/infinite-brain-writers/index.js';
import { evaluateWriterStubAvailability, executeInfiniteBrainProposalPlanDisabled } from '../adapters/infinite-brain-proposal-executor.js';

const mockInput = {
  dryRunId: 'dry-run-test',
  applicationPlanId: 'plan-test',
  category: 'atomization' as const,
};

test('Atomization writer returns blocked', async () => {
  const result = await runAtomizationWriterDisabled(mockInput);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'atomization');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
  assert.equal(result.safety.writesToMind, false);
  assert.equal(result.safety.canWrite, false);
  assert(Array.isArray(result.blockers));
  assert(result.blockers.length > 0);
});

test('Metadata writer returns blocked', async () => {
  const result = await runMetadataWriterDisabled({ ...mockInput, category: 'entity-metadata' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'entity-metadata');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Edges writer returns blocked', async () => {
  const result = await runEdgesWriterDisabled({ ...mockInput, category: 'edge-review' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'edge-review');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Wiki writer returns blocked', async () => {
  const result = await runWikiWriterDisabled({ ...mockInput, category: 'wiki-writing' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'wiki-writing');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Tasks writer returns blocked', async () => {
  const result = await runTasksWriterDisabled({ ...mockInput, category: 'task-extraction' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'task-extraction');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Cleanup writer returns blocked with destructive-disabled messaging', async () => {
  const result = await runCleanupWriterDisabled({ ...mockInput, category: 'cleanup' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'cleanup');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
  // Cleanup should have explicit destructive-disabled messaging
  assert(result.blockers.some(b => b.includes('DESTRUCTIVE')));
});

test('All writers have safety invariants correct', async () => {
  const writers = [
    await runAtomizationWriterDisabled(mockInput),
    await runMetadataWriterDisabled({ ...mockInput, category: 'entity-metadata' }),
    await runEdgesWriterDisabled({ ...mockInput, category: 'edge-review' }),
    await runWikiWriterDisabled({ ...mockInput, category: 'wiki-writing' }),
    await runTasksWriterDisabled({ ...mockInput, category: 'task-extraction' }),
    await runCleanupWriterDisabled({ ...mockInput, category: 'cleanup' }),
  ];

  for (const writer of writers) {
    assert.equal(writer.ok, false, `${writer.category}: ok must be false`);
    assert.equal(writer.status, 'blocked', `${writer.category}: status must be blocked`);
    assert.equal(writer.canWrite, false, `${writer.category}: canWrite must be false`);
    assert.equal(writer.wroteToMind, false, `${writer.category}: wroteToMind must be false`);
    assert.equal(writer.applied, false, `${writer.category}: applied must be false`);
    assert.equal(writer.executionBlocked, true, `${writer.category}: executionBlocked must be true`);
    assert.equal(writer.safety.writesToMind, false, `${writer.category}: safety.writesToMind must be false`);
    assert.equal(writer.safety.canWrite, false, `${writer.category}: safety.canWrite must be false`);
    assert.equal(writer.safety.deletesFiles, false, `${writer.category}: safety.deletesFiles must be false`);
    assert.equal(writer.safety.movesFiles, false, `${writer.category}: safety.movesFiles must be false`);
    assert.equal(writer.filesCreated.length, 0, `${writer.category}: filesCreated must be empty`);
    assert.equal(writer.filesModified.length, 0, `${writer.category}: filesModified must be empty`);
    assert.equal(writer.filesDeleted.length, 0, `${writer.category}: filesDeleted must be empty`);
  }
});

test('Writer stub availability shows all blocked', () => {
  const availability = evaluateWriterStubAvailability();
  assert.equal(availability.length, 6);

  for (const stub of availability) {
    assert.equal(stub.available, false);
    assert(stub.blockerCount > 0, `${stub.category}: should have blockers`);
    assert(stub.blockers.length > 0, `${stub.category}: blockers list should not be empty`);
  }

  // Verify cleanup is destructive-disabled
  const cleanupStub = availability.find(s => s.category === 'cleanup');
  assert(cleanupStub, 'Cleanup stub should exist');
  assert(cleanupStub.blockers.some(b => b.includes('DESTRUCTIVE')));
});

test('Disabled executor remains blocked with writer stubs', () => {
  const result = executeInfiniteBrainProposalPlanDisabled('dry-run-id', 5);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.canExecute, false);
  assert.equal(result.executed, false);
  assert.equal(result.appliedSteps, 0);
  assert.equal(result.safety.writesToMind, false);
  assert.equal(result.safety.executionBlocked, true);
});




import crypto from 'node:crypto';
import path from 'node:path';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { runWikiWriterSingleFileWrite } from '../adapters/infinite-brain-writers/writer-wiki.js';
import type { InfiniteBrainWikiSingleFileWriteInput } from '../adapters/infinite-brain-writers/types.js';

function sha256ForWikiWriterTest(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function createWikiWriterFixture(prefix: string): {
  tempDir: string;
  mindRoot: string;
  targetPath: string;
  absoluteTargetPath: string;
  beforeContent: string;
  input: InfiniteBrainWikiSingleFileWriteInput;
} {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  const wikiDir = path.join(mindRoot, 'wiki');
  const targetPath = 'wiki/example.md';
  const absoluteTargetPath = path.join(mindRoot, targetPath);
  const beforeContent = '# Example\n\nBefore.\n';

  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(absoluteTargetPath, beforeContent);

  return {
    tempDir,
    mindRoot,
    targetPath,
    absoluteTargetPath,
    beforeContent,
    input: {
      approvalId: 'mind-approval-wiki-test',
      proposalId: 'proposal-wiki-test',
      sourceReportId: 'report-wiki-test',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-17T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      targetPath,
      expectedBeforeHash: sha256ForWikiWriterTest(beforeContent),
      newContent: '# Example\n\nAfter.\n',
      allowedSections: ['Example'],
      contentIntent: 'Replace only the approved page content.',
      operator: 'human-reviewer',
      reason: 'Apply the approved bounded wiki update.',
      manualSingleWriteConfirm: true,
      mindRoot,
    },
  };
}

test('Wiki single-file writer applies one exact approved path atomically', () => {
  const fixture = createWikiWriterFixture('wiki-writer-success-');
  const neighborPath = path.join(fixture.mindRoot, 'wiki', 'neighbor.md');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'wiki-write-report.json');
  const originalRollbackEnv = process.env.IBR_WIKI_WRITER_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH;

  writeFileSync(neighborPath, '# Neighbor\n');

  try {
    process.env.IBR_WIKI_WRITER_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH = reportPath;

    const report = runWikiWriterSingleFileWrite(fixture.input);

    assert.equal(report.status, 'applied');
    assert.equal(report.applied, true);
    assert.equal(report.wroteToMind, true);
    assert.equal(report.atomicWrite, true);
    assert.deepEqual(report.changedPaths, [fixture.targetPath]);
    assert.equal(readFileSync(fixture.absoluteTargetPath, 'utf8'), fixture.input.newContent);
    assert.equal(readFileSync(neighborPath, 'utf8'), '# Neighbor\n');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_WIKI_WRITER_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_WIKI_WRITER_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH;
  }
});

test('Wiki single-file writer rejects a before-hash mismatch without changing Mind', () => {
  const fixture = createWikiWriterFixture('wiki-writer-hash-mismatch-');
  const originalContent = readFileSync(fixture.absoluteTargetPath, 'utf8');

  try {
    const report = runWikiWriterSingleFileWrite({
      ...fixture.input,
      expectedBeforeHash: 'b'.repeat(64),
    });

    assert.equal(report.status, 'blocked');
    assert.equal(report.applied, false);
    assert.equal(report.wroteToMind, false);
    assert(report.blockers.includes('beforeHashMismatch'));
    assert.deepEqual(report.changedPaths, []);
    assert.equal(readFileSync(fixture.absoluteTargetPath, 'utf8'), originalContent);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Wiki single-file writer rejects broad and invalid target paths', () => {
  const fixture = createWikiWriterFixture('wiki-writer-invalid-path-');

  try {
    for (const targetPath of ['', 'wiki/', 'wiki/*.md', 'wiki/../live/status.md', 'live/status.md']) {
      const report = runWikiWriterSingleFileWrite({ ...fixture.input, targetPath });
      assert.equal(report.status, 'blocked');
      assert(report.blockers.includes('invalidExactWikiTargetPath'));
      assert.equal(report.wroteToMind, false);
      assert.deepEqual(report.changedPaths, []);
    }
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Wiki single-file writer persists rollback snapshot and structured write report', () => {
  const fixture = createWikiWriterFixture('wiki-writer-artifacts-');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'wiki-write-report.json');
  const auditDir = path.join(fixture.tempDir, 'audit-log');
  const originalRollbackEnv = process.env.IBR_WIKI_WRITER_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH;
  const originalAuditEnv = process.env.IBR_WRITER_AUDIT_LOG_DIR;

  try {
    process.env.IBR_WIKI_WRITER_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH = reportPath;
    process.env.IBR_WRITER_AUDIT_LOG_DIR = auditDir;

    const report = runWikiWriterSingleFileWrite(fixture.input);

    assert.equal(report.status, 'applied');
    assert(report.rollbackSnapshotPath);
    assert(report.writeReportPath);
    assert(report.auditLogPath);
    assert(existsSync(report.rollbackSnapshotPath));
    assert(existsSync(report.writeReportPath));
    assert(existsSync(report.auditLogPath));

    const rollback = JSON.parse(readFileSync(report.rollbackSnapshotPath, 'utf8')) as {
      targetPath: string;
      beforeContentHash: string;
      beforeContent: string;
    };
    const persistedReport = JSON.parse(readFileSync(report.writeReportPath, 'utf8')) as {
      approvalId: string;
      targetPath: string;
      beforeContentHash: string;
      afterContentHash: string;
      changedPaths: string[];
    };
    const audit = JSON.parse(readFileSync(report.auditLogPath, 'utf8')) as {
      changedPaths: string[];
      beforeState: Record<string, string | null>;
      afterState: Record<string, string | null>;
      approval: { approvalId: string; proposalId: string; approvedBy: string };
      result: { status: string; applied: boolean; wroteToMind: boolean; blockers: string[] };
    };

    assert.equal(rollback.targetPath, fixture.targetPath);
    assert.equal(rollback.beforeContentHash, fixture.input.expectedBeforeHash);
    assert.equal(rollback.beforeContent, fixture.beforeContent);
    assert.equal(persistedReport.approvalId, fixture.input.approvalId);
    assert.equal(persistedReport.targetPath, fixture.targetPath);
    assert.equal(persistedReport.beforeContentHash, fixture.input.expectedBeforeHash);
    assert.equal(persistedReport.afterContentHash, sha256ForWikiWriterTest(fixture.input.newContent));
    assert.deepEqual(persistedReport.changedPaths, [fixture.targetPath]);
    assert.deepEqual(audit.changedPaths, [fixture.targetPath]);
    assert.deepEqual(audit.beforeState, { [fixture.targetPath]: fixture.input.expectedBeforeHash });
    assert.deepEqual(audit.afterState, { [fixture.targetPath]: sha256ForWikiWriterTest(fixture.input.newContent) });
    assert.deepEqual(audit.approval, {
      approvalId: fixture.input.approvalId,
      proposalId: fixture.input.proposalId,
      sourceReportId: fixture.input.sourceReportId,
      sourceCommit: fixture.input.sourceCommit,
      approvedBy: fixture.input.approvedBy,
      approvedAt: fixture.input.approvedAt,
      expiresAt: fixture.input.expiresAt,
    });
    assert.deepEqual(audit.result, {
      status: 'applied',
      applied: true,
      wroteToMind: true,
      blockers: [],
    });
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_WIKI_WRITER_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_WIKI_WRITER_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_WIKI_WRITER_WRITE_REPORT_PATH;
    if (originalAuditEnv) process.env.IBR_WRITER_AUDIT_LOG_DIR = originalAuditEnv;
    else delete process.env.IBR_WRITER_AUDIT_LOG_DIR;
  }
});




test('Wiki single-file writer rejects a symlink target without changing Mind', async () => {
  const fixture = createWikiWriterFixture('wiki-writer-symlink-');
  const realTarget = path.join(fixture.mindRoot, 'wiki', 'real.md');
  const symlinkTarget = path.join(fixture.mindRoot, 'wiki', 'linked.md');

  writeFileSync(realTarget, fixture.beforeContent);
  rmSync(fixture.absoluteTargetPath, { force: true });
  const { symlinkSync } = await import('node:fs');
  symlinkSync(realTarget, symlinkTarget);

  try {
    const report = runWikiWriterSingleFileWrite({
      ...fixture.input,
      targetPath: 'wiki/linked.md',
      expectedBeforeHash: sha256ForWikiWriterTest(fixture.beforeContent),
    });

    assert.equal(report.status, 'blocked');
    assert.equal(report.applied, false);
    assert.equal(report.wroteToMind, false);
    assert(report.blockers.includes('existingTargetFileRequired'));
    assert.equal(readFileSync(realTarget, 'utf8'), fixture.beforeContent);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});




import { runLiveStatusSingleFileWrite } from '../adapters/infinite-brain-writers/writer-live-status.js';
import type { InfiniteBrainLiveStatusSingleFileWriteInput } from '../adapters/infinite-brain-writers/types.js';

function createLiveStatusWriterFixture(prefix: string): {
  tempDir: string;
  mindRoot: string;
  targetPath: string;
  absoluteTargetPath: string;
  beforeContent: string;
  input: InfiniteBrainLiveStatusSingleFileWriteInput;
} {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  const liveDir = path.join(mindRoot, 'live', 'projects');
  const targetPath = 'live/projects/example.md';
  const absoluteTargetPath = path.join(mindRoot, targetPath);
  const beforeContent = '# Example project\n\nStatus: active\n';

  mkdirSync(liveDir, { recursive: true });
  writeFileSync(absoluteTargetPath, beforeContent);

  return {
    tempDir,
    mindRoot,
    targetPath,
    absoluteTargetPath,
    beforeContent,
    input: {
      approvalId: 'mind-approval-live-status-test',
      proposalId: 'proposal-live-status-test',
      sourceReportId: 'report-live-status-test',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-17T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      targetPath,
      expectedBeforeHash: sha256ForWikiWriterTest(beforeContent),
      newContent: '# Example project\n\nStatus: completed\n',
      allowedSections: ['Status'],
      contentIntent: 'Update only the approved current project status.',
      operator: 'human-reviewer',
      reason: 'Apply the approved bounded live-page status update.',
      manualSingleWriteConfirm: true,
      mindRoot,
    },
  };
}

test('Live status writer applies one exact approved live path atomically', () => {
  const fixture = createLiveStatusWriterFixture('live-status-success-');
  const neighborPath = path.join(fixture.mindRoot, 'live', 'projects', 'neighbor.md');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'live-status-write-report.json');
  const originalRollbackEnv = process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH;

  writeFileSync(neighborPath, '# Neighbor\n\nStatus: active\n');

  try {
    process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH = reportPath;

    const report = runLiveStatusSingleFileWrite(fixture.input);

    assert.equal(report.status, 'applied');
    assert.equal(report.applied, true);
    assert.equal(report.wroteToMind, true);
    assert.equal(report.atomicWrite, true);
    assert.deepEqual(report.changedPaths, [fixture.targetPath]);
    assert.equal(readFileSync(fixture.absoluteTargetPath, 'utf8'), fixture.input.newContent);
    assert.equal(readFileSync(neighborPath, 'utf8'), '# Neighbor\n\nStatus: active\n');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH;
  }
});

test('Live status writer rejects before-hash mismatch without changing Mind', () => {
  const fixture = createLiveStatusWriterFixture('live-status-hash-mismatch-');
  try {
    const report = runLiveStatusSingleFileWrite({ ...fixture.input, expectedBeforeHash: 'c'.repeat(64) });
    assert.equal(report.status, 'blocked');
    assert.equal(report.wroteToMind, false);
    assert(report.blockers.includes('beforeHashMismatch'));
    assert.equal(readFileSync(fixture.absoluteTargetPath, 'utf8'), fixture.beforeContent);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Live status writer rejects broad, traversal, and non-live paths', () => {
  const fixture = createLiveStatusWriterFixture('live-status-invalid-path-');
  try {
    for (const targetPath of ['', 'live/', 'live/*.md', 'live/../wiki/example.md', 'wiki/example.md']) {
      const report = runLiveStatusSingleFileWrite({ ...fixture.input, targetPath });
      assert.equal(report.status, 'blocked');
      assert(report.blockers.includes('invalidExactLiveTargetPath'));
      assert.equal(report.wroteToMind, false);
    }
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Live status writer persists rollback snapshot and structured report', () => {
  const fixture = createLiveStatusWriterFixture('live-status-artifacts-');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'live-status-write-report.json');
  const auditDir = path.join(fixture.tempDir, 'audit-log');
  const originalRollbackEnv = process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH;
  const originalAuditEnv = process.env.IBR_WRITER_AUDIT_LOG_DIR;

  try {
    process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH = reportPath;
    process.env.IBR_WRITER_AUDIT_LOG_DIR = auditDir;

    const report = runLiveStatusSingleFileWrite(fixture.input);
    assert.equal(report.status, 'applied');
    assert(report.rollbackSnapshotPath);
    assert(report.writeReportPath);
    assert(report.auditLogPath);
    assert(existsSync(report.rollbackSnapshotPath));
    assert(existsSync(report.writeReportPath));
    assert(existsSync(report.auditLogPath));

    const audit = JSON.parse(readFileSync(report.auditLogPath, 'utf8')) as {
      changedPaths: string[];
      beforeState: Record<string, string | null>;
      afterState: Record<string, string | null>;
      approval: { approvalId: string; proposalId: string; approvedBy: string };
      result: { status: string; applied: boolean; wroteToMind: boolean; blockers: string[] };
    };
    assert.deepEqual(audit.changedPaths, [fixture.targetPath]);
    assert.deepEqual(audit.beforeState, { [fixture.targetPath]: fixture.input.expectedBeforeHash });
    assert.deepEqual(audit.afterState, { [fixture.targetPath]: sha256ForWikiWriterTest(fixture.input.newContent) });
    assert.equal(audit.approval.approvalId, fixture.input.approvalId);
    assert.equal(audit.approval.proposalId, fixture.input.proposalId);
    assert.equal(audit.approval.approvedBy, fixture.input.approvedBy);
    assert.deepEqual(audit.result, {
      status: 'applied',
      applied: true,
      wroteToMind: true,
      blockers: [],
    });
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH;
    if (originalAuditEnv) process.env.IBR_WRITER_AUDIT_LOG_DIR = originalAuditEnv;
    else delete process.env.IBR_WRITER_AUDIT_LOG_DIR;
  }
});

test('Live status writer rejects a symlink target without changing Mind', async () => {
  const fixture = createLiveStatusWriterFixture('live-status-symlink-');
  const realTarget = path.join(fixture.mindRoot, 'live', 'projects', 'real.md');
  const symlinkTarget = path.join(fixture.mindRoot, 'live', 'projects', 'linked.md');
  writeFileSync(realTarget, fixture.beforeContent);
  const { symlinkSync } = await import('node:fs');
  symlinkSync(realTarget, symlinkTarget);

  try {
    const report = runLiveStatusSingleFileWrite({
      ...fixture.input,
      targetPath: 'live/projects/linked.md',
      expectedBeforeHash: sha256ForWikiWriterTest(fixture.beforeContent),
    });
    assert.equal(report.status, 'blocked');
    assert(report.blockers.includes('existingTargetFileRequired'));
    assert.equal(report.wroteToMind, false);
    assert.equal(readFileSync(realTarget, 'utf8'), fixture.beforeContent);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});




import { runSupersedeArchiveMove } from '../adapters/infinite-brain-writers/writer-supersede-archive.js';
import type { InfiniteBrainSupersedeArchiveMoveInput } from '../adapters/infinite-brain-writers/types.js';

function createSupersedeArchiveFixture(prefix: string): {
  tempDir: string;
  mindRoot: string;
  sourcePath: string;
  destinationPath: string;
  absoluteSourcePath: string;
  absoluteDestinationPath: string;
  content: string;
  input: InfiniteBrainSupersedeArchiveMoveInput;
} {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  const sourcePath = 'live/projects/example.md';
  const destinationPath = 'archive/projects/example.md';
  const absoluteSourcePath = path.join(mindRoot, sourcePath);
  const absoluteDestinationPath = path.join(mindRoot, destinationPath);
  const content = '# Example project\n\nStatus: obsolete\n';

  mkdirSync(path.dirname(absoluteSourcePath), { recursive: true });
  mkdirSync(path.dirname(absoluteDestinationPath), { recursive: true });
  writeFileSync(absoluteSourcePath, content);

  return {
    tempDir,
    mindRoot,
    sourcePath,
    destinationPath,
    absoluteSourcePath,
    absoluteDestinationPath,
    content,
    input: {
      approvalId: 'mind-approval-supersede-test',
      proposalId: 'proposal-supersede-test',
      sourceReportId: 'report-supersede-test',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-17T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      sourcePath,
      destinationPath,
      expectedSourceHash: sha256ForWikiWriterTest(content),
      contradictionSummary: 'The current project status conflicts with completed evidence.',
      supersessionReason: 'Archive the obsolete live page while preserving history.',
      operator: 'human-reviewer',
      manualSingleMoveConfirm: true,
      mindRoot,
    },
  };
}

test('Supersede/archive writer moves one exact approved file into archive', () => {
  const fixture = createSupersedeArchiveFixture('supersede-archive-success-');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'supersede-archive-report.json');
  const originalRollbackEnv = process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH;

  try {
    process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH = reportPath;

    const report = runSupersedeArchiveMove(fixture.input);

    assert.equal(report.status, 'applied');
    assert.equal(report.applied, true);
    assert.equal(report.nonDeletingArchiveMove, true);
    assert.deepEqual(report.changedPaths, [fixture.sourcePath, fixture.destinationPath]);
    assert.equal(existsSync(fixture.absoluteSourcePath), false);
    assert.equal(readFileSync(fixture.absoluteDestinationPath, 'utf8'), fixture.content);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH;
  }
});

test('Supersede/archive writer rejects source hash mismatch', () => {
  const fixture = createSupersedeArchiveFixture('supersede-archive-hash-');
  try {
    const report = runSupersedeArchiveMove({ ...fixture.input, expectedSourceHash: 'd'.repeat(64) });
    assert.equal(report.status, 'blocked');
    assert(report.blockers.includes('sourceHashMismatch'));
    assert.equal(existsSync(fixture.absoluteSourcePath), true);
    assert.equal(existsSync(fixture.absoluteDestinationPath), false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Supersede/archive writer rejects broad, traversal, archive-source, and non-archive destinations', () => {
  const fixture = createSupersedeArchiveFixture('supersede-archive-invalid-');
  try {
    const cases = [
      { sourcePath: '', destinationPath: fixture.destinationPath },
      { sourcePath: 'live/', destinationPath: fixture.destinationPath },
      { sourcePath: 'live/../wiki/example.md', destinationPath: fixture.destinationPath },
      { sourcePath: 'archive/old.md', destinationPath: fixture.destinationPath },
      { sourcePath: fixture.sourcePath, destinationPath: '' },
      { sourcePath: fixture.sourcePath, destinationPath: 'wiki/example.md' },
      { sourcePath: fixture.sourcePath, destinationPath: 'archive/*.md' },
    ];
    for (const testCase of cases) {
      const report = runSupersedeArchiveMove({ ...fixture.input, ...testCase });
      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
    }
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Supersede/archive writer rejects destination collisions without overwrite', () => {
  const fixture = createSupersedeArchiveFixture('supersede-archive-collision-');
  writeFileSync(fixture.absoluteDestinationPath, '# Existing archive\n');
  try {
    const report = runSupersedeArchiveMove(fixture.input);
    assert.equal(report.status, 'blocked');
    assert(report.blockers.includes('availableArchiveDestinationRequired'));
    assert.equal(readFileSync(fixture.absoluteDestinationPath, 'utf8'), '# Existing archive\n');
    assert.equal(readFileSync(fixture.absoluteSourcePath, 'utf8'), fixture.content);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Supersede/archive writer persists rollback metadata and move report', () => {
  const fixture = createSupersedeArchiveFixture('supersede-archive-artifacts-');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'supersede-archive-report.json');
  const auditDir = path.join(fixture.tempDir, 'audit-log');
  const originalRollbackEnv = process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH;
  const originalAuditEnv = process.env.IBR_WRITER_AUDIT_LOG_DIR;
  try {
    process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH = reportPath;
    process.env.IBR_WRITER_AUDIT_LOG_DIR = auditDir;
    const report = runSupersedeArchiveMove(fixture.input);
    assert.equal(report.status, 'applied');
    assert(report.rollbackMetadataPath);
    assert(report.moveReportPath);
    assert(report.auditLogPath);
    assert(existsSync(report.rollbackMetadataPath));
    assert(existsSync(report.moveReportPath));
    assert(existsSync(report.auditLogPath));

    const audit = JSON.parse(readFileSync(report.auditLogPath, 'utf8')) as {
      changedPaths: string[];
      beforeState: Record<string, string | null>;
      afterState: Record<string, string | null>;
      approval: { approvalId: string; proposalId: string; approvedBy: string };
      result: { status: string; applied: boolean; wroteToMind: boolean; blockers: string[] };
    };
    assert.deepEqual(audit.changedPaths, [fixture.sourcePath, fixture.destinationPath]);
    assert.deepEqual(audit.beforeState, {
      [fixture.sourcePath]: fixture.input.expectedSourceHash,
      [fixture.destinationPath]: null,
    });
    assert.deepEqual(audit.afterState, {
      [fixture.sourcePath]: null,
      [fixture.destinationPath]: fixture.input.expectedSourceHash,
    });
    assert.equal(audit.approval.approvalId, fixture.input.approvalId);
    assert.equal(audit.approval.proposalId, fixture.input.proposalId);
    assert.equal(audit.approval.approvedBy, fixture.input.approvedBy);
    assert.deepEqual(audit.result, {
      status: 'applied',
      applied: true,
      wroteToMind: true,
      blockers: [],
    });
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_SUPERSEDE_ARCHIVE_REPORT_PATH;
    if (originalAuditEnv) process.env.IBR_WRITER_AUDIT_LOG_DIR = originalAuditEnv;
    else delete process.env.IBR_WRITER_AUDIT_LOG_DIR;
  }
});

test('Supersede/archive writer rejects symlink sources and symlink archive parents', async () => {
  const fixture = createSupersedeArchiveFixture('supersede-archive-symlink-');
  const { symlinkSync } = await import('node:fs');
  const realSource = path.join(fixture.mindRoot, 'live', 'projects', 'real.md');
  const linkedSource = path.join(fixture.mindRoot, 'live', 'projects', 'linked.md');
  writeFileSync(realSource, fixture.content);
  symlinkSync(realSource, linkedSource);
  try {
    const sourceReport = runSupersedeArchiveMove({
      ...fixture.input,
      sourcePath: 'live/projects/linked.md',
      expectedSourceHash: sha256ForWikiWriterTest(fixture.content),
    });
    assert.equal(sourceReport.status, 'blocked');
    assert(sourceReport.blockers.includes('existingSourceFileRequired'));

    const archiveReal = path.join(fixture.mindRoot, 'archive-real');
    const archiveLink = path.join(fixture.mindRoot, 'archive-link');
    mkdirSync(archiveReal, { recursive: true });
    symlinkSync(archiveReal, archiveLink);
    const destinationReport = runSupersedeArchiveMove({
      ...fixture.input,
      destinationPath: 'archive-link/example.md',
    });
    assert.equal(destinationReport.status, 'blocked');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});




import { runSourceRoutingMove } from '../adapters/infinite-brain-writers/writer-source-routing.js';
import type { InfiniteBrainSourceRoutingMoveInput } from '../adapters/infinite-brain-writers/types.js';

function createSourceRoutingFixture(prefix: string): {
  tempDir: string;
  mindRoot: string;
  sourcePath: string;
  destinationPath: string;
  absoluteSourcePath: string;
  absoluteDestinationPath: string;
  content: string;
  input: InfiniteBrainSourceRoutingMoveInput;
} {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  const sourcePath = 'capture/inbox/research-draft.md';
  const destinationPath = 'sources/research/research-draft.md';
  const absoluteSourcePath = path.join(mindRoot, sourcePath);
  const absoluteDestinationPath = path.join(mindRoot, destinationPath);
  const content = '# Research draft\n\nSupported findings.\n';

  mkdirSync(path.dirname(absoluteSourcePath), { recursive: true });
  mkdirSync(path.dirname(absoluteDestinationPath), { recursive: true });
  writeFileSync(absoluteSourcePath, content);

  return {
    tempDir,
    mindRoot,
    sourcePath,
    destinationPath,
    absoluteSourcePath,
    absoluteDestinationPath,
    content,
    input: {
      approvalId: 'mind-approval-source-routing-test',
      proposalId: 'proposal-source-routing-test',
      sourceReportId: 'report-source-routing-test',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-18T08:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      sourcePath,
      destinationPath,
      expectedSourceHash: sha256ForWikiWriterTest(content),
      routingReason: 'Route the approved research draft into the durable sources area.',
      sourceSummary: 'Research summary with supporting evidence and uncertainty.',
      operator: 'human-reviewer',
      manualSingleMoveConfirm: true,
      mindRoot,
    },
  };
}

test('Source-routing writer moves one exact approved file into sources', () => {
  const fixture = createSourceRoutingFixture('source-routing-success-');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'source-routing-report.json');
  const originalRollbackEnv = process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_SOURCE_ROUTING_REPORT_PATH;

  try {
    process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_SOURCE_ROUTING_REPORT_PATH = reportPath;

    const report = runSourceRoutingMove(fixture.input);

    assert.equal(report.status, 'applied');
    assert.equal(report.applied, true);
    assert.equal(report.sourcesDestinationOnly, true);
    assert.deepEqual(report.changedPaths, [fixture.sourcePath, fixture.destinationPath]);
    assert.equal(existsSync(fixture.absoluteSourcePath), false);
    assert.equal(readFileSync(fixture.absoluteDestinationPath, 'utf8'), fixture.content);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_SOURCE_ROUTING_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_SOURCE_ROUTING_REPORT_PATH;
  }
});

test('Source-routing writer rejects source hash mismatch', () => {
  const fixture = createSourceRoutingFixture('source-routing-hash-');
  try {
    const report = runSourceRoutingMove({ ...fixture.input, expectedSourceHash: 'e'.repeat(64) });
    assert.equal(report.status, 'blocked');
    assert(report.blockers.includes('sourceHashMismatch'));
    assert.equal(existsSync(fixture.absoluteSourcePath), true);
    assert.equal(existsSync(fixture.absoluteDestinationPath), false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Source-routing writer rejects broad, traversal, sources-origin, and non-sources destinations', () => {
  const fixture = createSourceRoutingFixture('source-routing-invalid-');
  try {
    const cases = [
      { sourcePath: '', destinationPath: fixture.destinationPath },
      { sourcePath: 'capture/inbox/', destinationPath: fixture.destinationPath },
      { sourcePath: 'capture/../wiki/example.md', destinationPath: fixture.destinationPath },
      { sourcePath: 'sources/existing.md', destinationPath: fixture.destinationPath },
      { sourcePath: fixture.sourcePath, destinationPath: '' },
      { sourcePath: fixture.sourcePath, destinationPath: 'wiki/example.md' },
      { sourcePath: fixture.sourcePath, destinationPath: 'sources/*.md' },
    ];
    for (const testCase of cases) {
      const report = runSourceRoutingMove({ ...fixture.input, ...testCase });
      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
    }
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Source-routing writer rejects destination collisions without overwrite', () => {
  const fixture = createSourceRoutingFixture('source-routing-collision-');
  writeFileSync(fixture.absoluteDestinationPath, '# Existing source\n');
  try {
    const report = runSourceRoutingMove(fixture.input);
    assert.equal(report.status, 'blocked');
    assert(report.blockers.includes('availableSourcesDestinationRequired'));
    assert.equal(readFileSync(fixture.absoluteDestinationPath, 'utf8'), '# Existing source\n');
    assert.equal(readFileSync(fixture.absoluteSourcePath, 'utf8'), fixture.content);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Source-routing writer persists rollback metadata and move report', () => {
  const fixture = createSourceRoutingFixture('source-routing-artifacts-');
  const rollbackDir = path.join(fixture.tempDir, 'rollbacks');
  const reportPath = path.join(fixture.tempDir, 'source-routing-report.json');
  const auditDir = path.join(fixture.tempDir, 'audit-log');
  const originalRollbackEnv = process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR;
  const originalReportEnv = process.env.IBR_SOURCE_ROUTING_REPORT_PATH;
  const originalAuditEnv = process.env.IBR_WRITER_AUDIT_LOG_DIR;

  try {
    process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR = rollbackDir;
    process.env.IBR_SOURCE_ROUTING_REPORT_PATH = reportPath;
    process.env.IBR_WRITER_AUDIT_LOG_DIR = auditDir;

    const report = runSourceRoutingMove(fixture.input);
    assert.equal(report.status, 'applied');
    assert(report.rollbackMetadataPath);
    assert(report.moveReportPath);
    assert(report.auditLogPath);
    assert(existsSync(report.rollbackMetadataPath));
    assert(existsSync(report.moveReportPath));
    assert(existsSync(report.auditLogPath));

    const audit = JSON.parse(readFileSync(report.auditLogPath, 'utf8')) as {
      changedPaths: string[];
      beforeState: Record<string, string | null>;
      afterState: Record<string, string | null>;
      approval: { approvalId: string; proposalId: string; approvedBy: string };
      result: { status: string; applied: boolean; wroteToMind: boolean; blockers: string[] };
    };
    assert.deepEqual(audit.changedPaths, [fixture.sourcePath, fixture.destinationPath]);
    assert.deepEqual(audit.beforeState, {
      [fixture.sourcePath]: fixture.input.expectedSourceHash,
      [fixture.destinationPath]: null,
    });
    assert.deepEqual(audit.afterState, {
      [fixture.sourcePath]: null,
      [fixture.destinationPath]: fixture.input.expectedSourceHash,
    });
    assert.equal(audit.approval.approvalId, fixture.input.approvalId);
    assert.equal(audit.approval.proposalId, fixture.input.proposalId);
    assert.equal(audit.approval.approvedBy, fixture.input.approvedBy);
    assert.deepEqual(audit.result, {
      status: 'applied',
      applied: true,
      wroteToMind: true,
      blockers: [],
    });
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
    if (originalRollbackEnv) process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR = originalRollbackEnv;
    else delete process.env.IBR_SOURCE_ROUTING_ROLLBACK_DIR;
    if (originalReportEnv) process.env.IBR_SOURCE_ROUTING_REPORT_PATH = originalReportEnv;
    else delete process.env.IBR_SOURCE_ROUTING_REPORT_PATH;
    if (originalAuditEnv) process.env.IBR_WRITER_AUDIT_LOG_DIR = originalAuditEnv;
    else delete process.env.IBR_WRITER_AUDIT_LOG_DIR;
  }
});

test('Source-routing writer rejects symlink sources and symlink destination parents', async () => {
  const fixture = createSourceRoutingFixture('source-routing-symlink-');
  const { symlinkSync } = await import('node:fs');
  const realSource = path.join(fixture.mindRoot, 'capture', 'inbox', 'real.md');
  const linkedSource = path.join(fixture.mindRoot, 'capture', 'inbox', 'linked.md');
  writeFileSync(realSource, fixture.content);
  symlinkSync(realSource, linkedSource);

  try {
    const sourceReport = runSourceRoutingMove({
      ...fixture.input,
      sourcePath: 'capture/inbox/linked.md',
      expectedSourceHash: sha256ForWikiWriterTest(fixture.content),
    });
    assert.equal(sourceReport.status, 'blocked');
    assert(sourceReport.blockers.includes('existingSourceFileRequired'));

    const realParent = path.join(fixture.mindRoot, 'sources-real');
    const linkedParent = path.join(fixture.mindRoot, 'sources-link');
    mkdirSync(realParent, { recursive: true });
    symlinkSync(realParent, linkedParent);
    const destinationReport = runSourceRoutingMove({
      ...fixture.input,
      destinationPath: 'sources-link/research-draft.md',
    });
    assert.equal(destinationReport.status, 'blocked');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
