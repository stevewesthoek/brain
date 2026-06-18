import { test } from 'node:test';
import assert from 'node:assert/strict';
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
import { runLiveStatusSingleFileWrite } from '../adapters/infinite-brain-writers/writer-live-status.js';
import { runSupersedeArchiveMove } from '../adapters/infinite-brain-writers/writer-supersede-archive.js';
import { runSourceRoutingMove } from '../adapters/infinite-brain-writers/writer-source-routing.js';
import { createWriterRecoveryProcedure } from '../adapters/infinite-brain-writers/writer-recovery-procedure.js';

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function withEnv<T>(values: Record<string, string>, run: () => T): T {
  const originals = new Map<string, string | undefined>();
  for (const key of Object.keys(values)) {
    originals.set(key, process.env[key]);
    process.env[key] = values[key];
  }
  try {
    return run();
  } finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('Recovery procedure is ready for an applied wiki update and does not mutate Mind', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'writer-recovery-wiki-'));
  const mindRoot = path.join(tempDir, 'mind');
  const targetPath = 'wiki/example.md';
  const absoluteTargetPath = path.join(mindRoot, targetPath);
  const beforeContent = '# Example\n\nBefore.\n';
  const afterContent = '# Example\n\nAfter.\n';
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  writeFileSync(absoluteTargetPath, beforeContent);

  try {
    const report = withEnv({
      IBR_WIKI_WRITER_ROLLBACK_DIR: path.join(tempDir, 'rollbacks'),
      IBR_WIKI_WRITER_WRITE_REPORT_PATH: path.join(tempDir, 'wiki-report.json'),
      IBR_WRITER_AUDIT_LOG_DIR: path.join(tempDir, 'audit'),
    }, () => runWikiWriterSingleFileWrite({
      approvalId: 'mind-approval-recovery-wiki',
      proposalId: 'proposal-recovery-wiki',
      sourceReportId: 'report-recovery-wiki',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-18T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      targetPath,
      expectedBeforeHash: sha256(beforeContent),
      newContent: afterContent,
      allowedSections: ['Example'],
      contentIntent: 'Test recovery procedure for an exact wiki update.',
      operator: 'human-reviewer',
      reason: 'Apply test update before generating recovery procedure.',
      manualSingleWriteConfirm: true,
      mindRoot,
    }));

    const procedure = createWriterRecoveryProcedure({
      operationType: 'wiki-update',
      mindRoot,
      report,
    });

    assert.equal(procedure.status, 'ready');
    assert.equal(procedure.canRecover, true);
    assert.deepEqual(procedure.changedPaths, [targetPath]);
    assert.deepEqual(procedure.expectedCurrentState, { [targetPath]: sha256(afterContent) });
    assert.deepEqual(procedure.restoreState, { [targetPath]: sha256(beforeContent) });
    assert.equal(procedure.safety.writesToMind, false);
    assert.equal(procedure.safety.appliesRecovery, false);
    assert.equal(readFileSync(absoluteTargetPath, 'utf8'), afterContent);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Recovery procedure is ready for an applied live-status update', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'writer-recovery-live-'));
  const mindRoot = path.join(tempDir, 'mind');
  const targetPath = 'live/projects/example.md';
  const absoluteTargetPath = path.join(mindRoot, targetPath);
  const beforeContent = '# Project\n\nStatus: active\n';
  const afterContent = '# Project\n\nStatus: complete\n';
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  writeFileSync(absoluteTargetPath, beforeContent);

  try {
    const report = withEnv({
      IBR_LIVE_STATUS_WRITER_ROLLBACK_DIR: path.join(tempDir, 'rollbacks'),
      IBR_LIVE_STATUS_WRITER_WRITE_REPORT_PATH: path.join(tempDir, 'live-report.json'),
      IBR_WRITER_AUDIT_LOG_DIR: path.join(tempDir, 'audit'),
    }, () => runLiveStatusSingleFileWrite({
      approvalId: 'mind-approval-recovery-live',
      proposalId: 'proposal-recovery-live',
      sourceReportId: 'report-recovery-live',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-18T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      targetPath,
      expectedBeforeHash: sha256(beforeContent),
      newContent: afterContent,
      allowedSections: ['Status'],
      contentIntent: 'Test recovery procedure for an exact live status update.',
      operator: 'human-reviewer',
      reason: 'Apply test update before generating recovery procedure.',
      manualSingleWriteConfirm: true,
      mindRoot,
    }));

    const procedure = createWriterRecoveryProcedure({
      operationType: 'live-status-update',
      mindRoot,
      report,
    });

    assert.equal(procedure.status, 'ready');
    assert.deepEqual(procedure.recoveryPaths, [targetPath]);
    assert.equal(procedure.safety.humanApprovalRequired, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Recovery procedure is ready for an applied supersede/archive move', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'writer-recovery-archive-'));
  const mindRoot = path.join(tempDir, 'mind');
  const sourcePath = 'live/projects/example.md';
  const destinationPath = 'archive/projects/example.md';
  const source = path.join(mindRoot, sourcePath);
  const destination = path.join(mindRoot, destinationPath);
  const content = '# Project\n\nStatus: obsolete\n';
  mkdirSync(path.dirname(source), { recursive: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(source, content);

  try {
    const report = withEnv({
      IBR_SUPERSEDE_ARCHIVE_ROLLBACK_DIR: path.join(tempDir, 'rollbacks'),
      IBR_SUPERSEDE_ARCHIVE_REPORT_PATH: path.join(tempDir, 'archive-report.json'),
      IBR_WRITER_AUDIT_LOG_DIR: path.join(tempDir, 'audit'),
    }, () => runSupersedeArchiveMove({
      approvalId: 'mind-approval-recovery-archive',
      proposalId: 'proposal-recovery-archive',
      sourceReportId: 'report-recovery-archive',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-18T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      sourcePath,
      destinationPath,
      expectedSourceHash: sha256(content),
      contradictionSummary: 'Test contradiction summary.',
      supersessionReason: 'Test supersession reason.',
      operator: 'human-reviewer',
      manualSingleMoveConfirm: true,
      mindRoot,
    }));

    const procedure = createWriterRecoveryProcedure({
      operationType: 'supersede-archive',
      mindRoot,
      report,
    });

    assert.equal(procedure.status, 'ready');
    assert.deepEqual(procedure.expectedCurrentState, {
      [sourcePath]: null,
      [destinationPath]: sha256(content),
    });
    assert.deepEqual(procedure.restoreState, {
      [sourcePath]: sha256(content),
      [destinationPath]: null,
    });
    assert.equal(existsSync(source), false);
    assert.equal(readFileSync(destination, 'utf8'), content);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Recovery procedure is ready for an applied source-routing move', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'writer-recovery-source-routing-'));
  const mindRoot = path.join(tempDir, 'mind');
  const sourcePath = 'capture/inbox/research.md';
  const destinationPath = 'sources/research/research.md';
  const source = path.join(mindRoot, sourcePath);
  const destination = path.join(mindRoot, destinationPath);
  const content = '# Research\n\nEvidence.\n';
  mkdirSync(path.dirname(source), { recursive: true });
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(source, content);

  try {
    const report = withEnv({
      IBR_SOURCE_ROUTING_ROLLBACK_DIR: path.join(tempDir, 'rollbacks'),
      IBR_SOURCE_ROUTING_REPORT_PATH: path.join(tempDir, 'source-routing-report.json'),
      IBR_WRITER_AUDIT_LOG_DIR: path.join(tempDir, 'audit'),
    }, () => runSourceRoutingMove({
      approvalId: 'mind-approval-recovery-source-routing',
      proposalId: 'proposal-recovery-source-routing',
      sourceReportId: 'report-recovery-source-routing',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-18T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      sourcePath,
      destinationPath,
      expectedSourceHash: sha256(content),
      routingReason: 'Route approved test source.',
      sourceSummary: 'Test source summary.',
      operator: 'human-reviewer',
      manualSingleMoveConfirm: true,
      mindRoot,
    }));

    const procedure = createWriterRecoveryProcedure({
      operationType: 'source-routing',
      mindRoot,
      report,
    });

    assert.equal(procedure.status, 'ready');
    assert.deepEqual(procedure.recoveryPaths, [destinationPath, sourcePath]);
    assert.equal(procedure.safety.movesFiles, false);
    assert.equal(existsSync(source), false);
    assert.equal(readFileSync(destination, 'utf8'), content);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Recovery procedure blocks when the rollback artifact is missing', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'writer-recovery-missing-'));
  const mindRoot = path.join(tempDir, 'mind');
  const targetPath = 'wiki/example.md';
  const absoluteTargetPath = path.join(mindRoot, targetPath);
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  writeFileSync(absoluteTargetPath, '# Example\n\nAfter.\n');

  try {
    const procedure = createWriterRecoveryProcedure({
      operationType: 'wiki-update',
      mindRoot,
      report: {
        writeId: 'wiki-write-missing',
        generatedAt: '2026-06-18T12:00:00Z',
        status: 'applied',
        targetPath,
        changedPaths: [targetPath],
        approvalId: 'approval-missing',
        proposalId: 'proposal-missing',
        sourceReportId: null,
        sourceCommit: '0123456789abcdef0123456789abcdef01234567',
        approvedBy: 'human-reviewer',
        approvedAt: '2026-06-18T12:00:00Z',
        expiresAt: '2099-06-18T12:00:00Z',
        beforeContentHash: sha256('# Example\n\nBefore.\n'),
        afterContentHash: sha256('# Example\n\nAfter.\n'),
        rollbackId: 'wiki-rollback-missing',
        rollbackSnapshotPath: path.join(tempDir, 'missing-rollback.json'),
        writeReportPath: null,
        blockers: [],
        singleFileOnly: true,
        exactPathOnly: true,
        atomicWrite: true,
        wroteToMind: true,
        applied: true,
      },
    });

    assert.equal(procedure.status, 'blocked');
    assert.equal(procedure.canRecover, false);
    assert(procedure.blockers.includes('rollbackSnapshotReadableRequired'));
    assert.equal(readFileSync(absoluteTargetPath, 'utf8'), '# Example\n\nAfter.\n');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Recovery procedure blocks when current Mind state no longer matches the write report', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'writer-recovery-mismatch-'));
  const mindRoot = path.join(tempDir, 'mind');
  const targetPath = 'wiki/example.md';
  const absoluteTargetPath = path.join(mindRoot, targetPath);
  const beforeContent = '# Example\n\nBefore.\n';
  const afterContent = '# Example\n\nAfter.\n';
  mkdirSync(path.dirname(absoluteTargetPath), { recursive: true });
  writeFileSync(absoluteTargetPath, beforeContent);

  try {
    const report = withEnv({
      IBR_WIKI_WRITER_ROLLBACK_DIR: path.join(tempDir, 'rollbacks'),
      IBR_WIKI_WRITER_WRITE_REPORT_PATH: path.join(tempDir, 'wiki-report.json'),
      IBR_WRITER_AUDIT_LOG_DIR: path.join(tempDir, 'audit'),
    }, () => runWikiWriterSingleFileWrite({
      approvalId: 'mind-approval-recovery-mismatch',
      proposalId: 'proposal-recovery-mismatch',
      sourceReportId: 'report-recovery-mismatch',
      sourceCommit: '0123456789abcdef0123456789abcdef01234567',
      approvedBy: 'human-reviewer',
      approvedAt: '2026-06-18T12:00:00Z',
      expiresAt: '2099-06-18T12:00:00Z',
      targetPath,
      expectedBeforeHash: sha256(beforeContent),
      newContent: afterContent,
      allowedSections: ['Example'],
      contentIntent: 'Test recovery current-state mismatch.',
      operator: 'human-reviewer',
      reason: 'Apply test update before generating recovery procedure.',
      manualSingleWriteConfirm: true,
      mindRoot,
    }));

    writeFileSync(absoluteTargetPath, '# Example\n\nUnexpected later edit.\n');
    const procedure = createWriterRecoveryProcedure({
      operationType: 'wiki-update',
      mindRoot,
      report,
    });

    assert.equal(procedure.status, 'blocked');
    assert(procedure.blockers.includes('currentStateHashMismatch'));
    assert.equal(readFileSync(absoluteTargetPath, 'utf8'), '# Example\n\nUnexpected later edit.\n');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
