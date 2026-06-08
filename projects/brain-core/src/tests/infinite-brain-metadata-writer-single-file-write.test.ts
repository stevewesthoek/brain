/**
 * Infinite Brain Metadata Writer Single-File Write Tests
 * Tests for the first real metadata write path (allowlisted, single-file, manual confirmation)
 * Uses temp directories and env overrides only — does NOT write to real Mind repo
 *
 * Safety: arbitraryWritesAllowed: false, singleFileOnly: true, allowlistedOnly: true
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { runMetadataWriterSingleFileWrite } from '../adapters/infinite-brain-writers/writer-metadata.js';

// Helper: Create a temp directory that simulates the Mind repo structure
function createTempMindStructure(): { mindRoot: string; allowlistedPath: string; cleanup: () => void } {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'ibr-test-'));
  const mindRoot = tempDir;
  const systemDir = path.join(mindRoot, '00_System');
  fs.mkdirSync(systemDir, { recursive: true });

  const allowlistedPath = path.join(systemDir, 'InfiniteBrainWriteTest.md');

  // Create initial test file with basic frontmatter
  const initialContent = `---
id: test-1
name: Infinite Brain Write Test
description: Test file for single-file metadata write
status: setup
---

# Test Content

This is a test file.
`;

  fs.writeFileSync(allowlistedPath, initialContent);

  const cleanup = () => {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  };

  return { mindRoot, allowlistedPath, cleanup };
}

// Set env overrides to use temp directory instead of real Mind
function withTempMindEnv(mindRoot: string, callback: () => void) {
  const oldMindRepoPath = process.env.IBR_MIND_REPO_PATH;
  const oldAllowlistPath = process.env.IBR_METADATA_WRITE_ALLOWLIST_PATH;
  const oldWriteReportPath = process.env.IBR_METADATA_WRITER_WRITE_REPORT_PATH;

  try {
    process.env.IBR_MIND_REPO_PATH = mindRoot;
    process.env.IBR_METADATA_WRITE_ALLOWLIST_PATH = path.join(mindRoot, '00_System', 'InfiniteBrainWriteTest.md');
    process.env.IBR_METADATA_WRITER_WRITE_REPORT_PATH = path.join(mindRoot, 'write-report.json');

    callback();
  } finally {
    // Restore original env
    if (oldMindRepoPath !== undefined) {
      process.env.IBR_MIND_REPO_PATH = oldMindRepoPath;
    } else {
      delete process.env.IBR_MIND_REPO_PATH;
    }

    if (oldAllowlistPath !== undefined) {
      process.env.IBR_METADATA_WRITE_ALLOWLIST_PATH = oldAllowlistPath;
    } else {
      delete process.env.IBR_METADATA_WRITE_ALLOWLIST_PATH;
    }

    if (oldWriteReportPath !== undefined) {
      process.env.IBR_METADATA_WRITER_WRITE_REPORT_PATH = oldWriteReportPath;
    } else {
      delete process.env.IBR_METADATA_WRITER_WRITE_REPORT_PATH;
    }
  }
}

test('Single-file write: missing manualSingleWriteConfirm blocks and file unchanged', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const beforeContent = fs.readFileSync(allowlistedPath, 'utf8');

      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'description',
        value: 'Updated description',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: false,
      });

      // Verify blocked
      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
      assert.equal(report.modifiedMind, false);
      assert.equal(report.testWriteApplied, false);

      // Verify file unchanged
      const afterContent = fs.readFileSync(allowlistedPath, 'utf8');
      assert.equal(beforeContent, afterContent);

      // Verify blockers
      assert(report.blockers.some(b => b.includes('manualSingleWriteConfirm')));
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: missing operator blocks and file unchanged', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const beforeContent = fs.readFileSync(allowlistedPath, 'utf8');

      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'description',
        value: 'Updated description',
        operator: '',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
      const afterContent = fs.readFileSync(allowlistedPath, 'utf8');
      assert.equal(beforeContent, afterContent);
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: missing reason blocks and file unchanged', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const beforeContent = fs.readFileSync(allowlistedPath, 'utf8');

      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'description',
        value: 'Updated description',
        operator: 'test-operator',
        reason: '',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
      const afterContent = fs.readFileSync(allowlistedPath, 'utf8');
      assert.equal(beforeContent, afterContent);
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: outside allowlist blocks and file unchanged', () => {
  const { mindRoot, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const nonAllowlistedPath = path.join(mindRoot, '01-inbox', 'some-file.md');
      fs.mkdirSync(path.dirname(nonAllowlistedPath), { recursive: true });
      fs.writeFileSync(nonAllowlistedPath, 'Original content');

      const report = runMetadataWriterSingleFileWrite({
        targetPath: nonAllowlistedPath,
        fieldName: 'description',
        value: 'Updated',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
      assert(report.blockers.some(b => b.includes('notAllowlisted')));
      assert.equal(fs.readFileSync(nonAllowlistedPath, 'utf8'), 'Original content');
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: missing target file blocks and does not create file', () => {
  const { mindRoot, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      // Delete the allowlisted file
      const allowlistedPath = path.join(mindRoot, '00_System', 'InfiniteBrainWriteTest.md');
      rmSync(allowlistedPath, { force: true });
      assert(!fs.existsSync(allowlistedPath));

      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'description',
        value: 'Updated',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
      assert(report.blockers.includes('targetFileNotFound'));
      assert(!fs.existsSync(allowlistedPath), 'File should not be created');
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: invalid fieldName blocks and file unchanged', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const beforeContent = fs.readFileSync(allowlistedPath, 'utf8');

      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'invalidFieldThatDoesNotExist',
        value: 'Updated',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'blocked');
      assert.equal(report.wroteToMind, false);
      assert(report.blockers.includes('invalidFieldName'));
      const afterContent = fs.readFileSync(allowlistedPath, 'utf8');
      assert.equal(beforeContent, afterContent);
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: successful temp allowlisted write modifies exactly one file', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const beforeContent = fs.readFileSync(allowlistedPath, 'utf8');

      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'description',
        value: 'Updated test description',
        operator: 'test-operator',
        reason: 'testing single-file write',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'test-write-applied');
      assert.equal(report.wroteToMind, true);
      assert.equal(report.modifiedMind, true);
      assert.equal(report.testWriteApplied, true);

      const afterContent = fs.readFileSync(allowlistedPath, 'utf8');
      assert.notEqual(beforeContent, afterContent);
      assert(afterContent.includes('Updated test description'));
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: successful report has correct flags', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'status',
        value: 'verified',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'test-write-applied');
      assert.equal(report.applied, false, 'applied must be false');
      assert.equal(report.autonomousExecution, false, 'autonomousExecution must be false');
      assert.equal(report.wroteToMind, true);
      assert.equal(report.modifiedMind, true);
      assert.equal(report.testWriteApplied, true);
      assert.equal(report.singleFileOnly, true);
      assert.equal(report.allowlistedOnly, true);
      assert.equal(report.safety.arbitraryWritesAllowed, false);
      assert.equal(report.safety.deletesFiles, false);
      assert.equal(report.safety.movesFiles, false);
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: rollback snapshot created after successful write', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'name',
        value: 'Updated Name',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'test-write-applied');
      assert(report.rollbackId, 'rollbackId should be present');
      assert.equal(report.rollbackId?.length, 12, 'rollbackId should be 12 characters');
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: after hash matches actual file content', () => {
  const { mindRoot, allowlistedPath, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'description',
        value: 'Final test value',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'test-write-applied');

      // Read the actual file and compute its hash
      const actualContent = fs.readFileSync(allowlistedPath, 'utf8');
      assert(actualContent.includes('Final test value'));
      assert(report.afterContentHash.length === 12);
    });
  } finally {
    cleanup();
  }
});

test('Single-file write: second file in same temp Mind remains unchanged', () => {
  const { mindRoot, cleanup } = createTempMindStructure();
  try {
    withTempMindEnv(mindRoot, () => {
      // Create a second file
      const secondFilePath = path.join(mindRoot, '00_System', 'OtherFile.md');
      fs.writeFileSync(secondFilePath, 'Second file content');
      const secondFileOriginal = fs.readFileSync(secondFilePath, 'utf8');

      const allowlistedPath = path.join(mindRoot, '00_System', 'InfiniteBrainWriteTest.md');

      // Write to allowlisted file
      const report = runMetadataWriterSingleFileWrite({
        targetPath: allowlistedPath,
        fieldName: 'description',
        value: 'Updated',
        operator: 'test-operator',
        reason: 'testing',
        manualSingleWriteConfirm: true,
      });

      assert.equal(report.status, 'test-write-applied');

      // Verify second file unchanged
      const secondFileAfter = fs.readFileSync(secondFilePath, 'utf8');
      assert.equal(secondFileOriginal, secondFileAfter);
    });
  } finally {
    cleanup();
  }
});
