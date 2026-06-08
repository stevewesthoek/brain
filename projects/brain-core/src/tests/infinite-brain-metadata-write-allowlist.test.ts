/**
 * Infinite Brain Metadata Write Allowlist Tests
 * Tests for single-file write scope policy
 *
 * Safety: allowlistedOnly: true, singleFileOnly: true, arbitraryWritesAllowed: false
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  getMetadataWriteAllowlist,
  isMetadataWritePathAllowlisted,
  validateSingleFileWriteScope,
  resolveMetadataWriteTestPath,
} from '../adapters/infinite-brain-metadata-write-allowlist.js';

test('Allowlist: default path resolves inside Mind', () => {
  const validation = resolveMetadataWriteTestPath();
  assert.ok(validation.normalizedPath, 'normalizedPath should exist');
  assert.ok(validation.normalizedPath!.includes('mind'), 'path should contain "mind"');
  assert.ok(validation.normalizedPath!.endsWith('.md'), 'path should end with .md');
});

test('Allowlist: default path ends with .md', () => {
  const allowlist = getMetadataWriteAllowlist();
  assert.ok(allowlist.endsWith('.md'), 'allowlisted path must end with .md');
});

test('Allowlist: non-md file rejected', () => {
  const validation = validateSingleFileWriteScope('/Users/Office/Repos/stevewesthoek/mind/test.txt');
  assert.equal(validation.allowed, false, 'non-.md files should be rejected');
  assert.ok(validation.reason.includes('markdown'), 'reason should mention markdown');
  assert.equal(validation.safety.arbitraryWritesAllowed, false, 'arbitrary writes must be blocked');
});

test('Allowlist: path outside Mind rejected', () => {
  const validation = validateSingleFileWriteScope('/tmp/test.md');
  assert.equal(validation.allowed, false, 'paths outside Mind should be rejected');
  assert.ok(validation.reason.includes('outside'), 'reason should mention outside');
  assert.equal(validation.safety.broadMindAccess, false, 'broad Mind access must be blocked');
});

test('Allowlist: path with .. rejected', () => {
  const validation = validateSingleFileWriteScope('/Users/Office/Repos/stevewesthoek/mind/../../../test.md');
  assert.equal(validation.allowed, false, 'paths with .. should be rejected');
  assert.ok(validation.reason, 'should have a reason');
});

test('Allowlist: only exact allowlisted path accepted', () => {
  const allowlist = getMetadataWriteAllowlist();
  const validation = validateSingleFileWriteScope(allowlist);
  assert.equal(validation.allowed, true, 'exact allowlisted path must be allowed');
  assert.ok(validation.normalizedPath, 'normalizedPath should exist');
  assert.equal(validation.safety.singleFileOnly, true, 'singleFileOnly must be true');
  assert.equal(validation.safety.allowlistedOnly, true, 'allowlistedOnly must be true');
});

test('Allowlist: isMetadataWritePathAllowlisted for allowlist', () => {
  const allowlist = getMetadataWriteAllowlist();
  assert.ok(isMetadataWritePathAllowlisted(allowlist), 'allowlist path should pass check');
});

test('Allowlist: isMetadataWritePathAllowlisted rejects other paths', () => {
  assert.equal(isMetadataWritePathAllowlisted('/tmp/other.md'), false, 'non-allowlisted path should fail');
});

test('Allowlist: directory rejected', () => {
  const mindPath = process.env.IBR_MIND_REPO_PATH || '/Users/Office/Repos/stevewesthoek/mind';
  const dirPath = path.join(mindPath, 'system');
  const validation = validateSingleFileWriteScope(dirPath);
  // Directory may or may not exist, but if it does, it should be rejected
  if (validation.normalizedPath && validation.normalizedPath.endsWith('system')) {
    // If normalized, it would not have .md extension, so it will be rejected
    assert.equal(validation.allowed, false, 'directories should be rejected');
  }
});

test('Allowlist: safety flags all correct', () => {
  const allowlist = getMetadataWriteAllowlist();
  const validation = validateSingleFileWriteScope(allowlist);

  assert.equal(validation.safety.allowlistedOnly, true);
  assert.equal(validation.safety.singleFileOnly, true);
  assert.equal(validation.safety.arbitraryWritesAllowed, false);
  assert.equal(validation.safety.deletesFiles, false);
  assert.equal(validation.safety.movesFiles, false);
  assert.equal(validation.safety.broadMindAccess, false);
});
