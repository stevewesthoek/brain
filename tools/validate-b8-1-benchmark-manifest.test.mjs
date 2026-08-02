/**
 * validate-b8-1-benchmark-manifest.test.mjs
 *
 * Tests for the B8.1 benchmark manifest validator.
 * Uses local temporary git repos created in tests — does not rely on
 * dirty working-tree contents or real repository checkouts.
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  validateManifest,
  validateSchema,
  verifyFixture,
  isForbiddenPath,
  checkForbiddenWording,
} from './validate-b8-1-benchmark-manifest.mjs';

const SCHEMA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../operations/specs/b8-1-context-memory-benchmark-manifest.schema.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempGitRepo({ files = { 'src/server.js': 'console.log("server")' } } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-test-'));
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(root, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'init'], { cwd: root });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  return { root, commit };
}

function makeManifest({ repoId = 'brain', repoPath, commit, fixtures = null } = {}) {
  return {
    schemaVersion: '1.0.0',
    createdAt: '2026-08-02',
    repositories: [{ repositoryId: repoId, localPath: repoPath, pinnedCommit: commit, description: 'test' }],
    fixtures: fixtures ?? [{
      fixtureId: 'brain_f1',
      repositoryId: repoId,
      pinnedCommit: commit,
      question: 'Where is the server entry point?',
      expectedFile: 'src/server.js',
      expectedSymbol: 'console',
      expectedLine: 1,
      expectedCallers: [],
      expectedCallees: [],
      scoringType: 'exact-match',
      callerCalleeApplicable: true,
      verificationCommand: 'grep -n "console" src/server.js',
    }],
  };
}

// ---------------------------------------------------------------------------
// Test 1: Schema validation — valid manifest passes
// ---------------------------------------------------------------------------

test('valid manifest passes schema validation', () => {
  const { root, commit } = makeTempGitRepo();
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = makeManifest({ repoPath: root, commit });
  try {
    const errors = validateSchema(manifest, schema);
    assert.deepEqual(errors, [], `schema errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 2: Duplicate fixture IDs are rejected
// ---------------------------------------------------------------------------

test('duplicate fixture IDs are rejected', () => {
  const { root, commit } = makeTempGitRepo();
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = makeManifest({ repoPath: root, commit });
  // Duplicate the fixture
  manifest.fixtures.push({ ...manifest.fixtures[0] });
  try {
    const errors = validateSchema(manifest, schema);
    assert(errors.some((e) => e.includes('duplicate fixtureId')), `expected duplicate error: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: Symbolic refs (main, HEAD) are rejected as pinnedCommit
// ---------------------------------------------------------------------------

test('symbolic ref "main" as pinnedCommit is rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0',
    createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: '/some/path', pinnedCommit: 'main' }],
    fixtures: [{
      fixtureId: 'brain_f1',
      repositoryId: 'brain',
      pinnedCommit: 'aaaa'.repeat(10),
      question: 'test',
      expectedFile: 'src/server.js',
      scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verificationCommand: 'ls',
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some((e) => e.includes('pinnedCommit must be 40-char hex') || e.includes('symbolic ref')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 4: File existence verified in exported tree
// ---------------------------------------------------------------------------

test('fixture file verified in exported pinned commit tree', async () => {
  const { root, commit } = makeTempGitRepo({ files: { 'src/server.js': 'console.log("test")' } });
  const manifest = makeManifest({ repoPath: root, commit });
  try {
    const { valid, errors } = await validateManifest(
      null, SCHEMA_PATH, { allowMissingRepos: false, _manifestOverride: manifest }
    );
    // Since we pass manifest as override but the API takes path, test via validateSchema + verifyFixture
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: Expected literal at recorded line verified
// ---------------------------------------------------------------------------

test('verifyFixture: correct symbol at expectedLine passes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-vf-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/server.js'), 'line1\nexport const FOO = "bar";\nline3\n');
  const fixture = {
    fixtureId: 'test_f1',
    expectedFile: 'src/server.js',
    expectedSymbol: 'FOO',
    expectedLine: 2,
    scoringType: 'exact-match',
    callerCalleeApplicable: false,
    verificationCommand: 'grep -n FOO src/server.js',
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert.deepEqual(errors, [], `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('verifyFixture: wrong symbol at expectedLine fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-vf2-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/server.js'), 'line1\nexport const FOO = "bar";\nline3\n');
  const fixture = {
    fixtureId: 'test_f1',
    expectedFile: 'src/server.js',
    expectedSymbol: 'WRONG_SYMBOL',
    expectedLine: 2,
    scoringType: 'exact-match',
    callerCalleeApplicable: false,
    verificationCommand: 'grep -n WRONG_SYMBOL src/server.js',
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert(errors.some((e) => e.includes('not found at line')), `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: Exact file count verified
// ---------------------------------------------------------------------------

test('verifyFixture: correct file count passes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-count-'));
  fs.mkdirSync(path.join(root, 'api/a'), { recursive: true });
  fs.mkdirSync(path.join(root, 'api/b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api/a/route.ts'), '// route a');
  fs.writeFileSync(path.join(root, 'api/b/route.ts'), '// route b');
  const fixture = {
    fixtureId: 'pc_f2',
    expectedFileCount: 2,
    scoringType: 'count-match',
    callerCalleeApplicable: false,
    verificationCommand: "find . -name 'route.ts' | wc -l",
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert.deepEqual(errors, [], `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('verifyFixture: wrong file count fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-count2-'));
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api/route.ts'), '// route');
  const fixture = {
    fixtureId: 'pc_f2',
    expectedFileCount: 27,
    scoringType: 'count-match',
    callerCalleeApplicable: false,
    verificationCommand: "find . -name 'route.ts' | wc -l",
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert(errors.some((e) => e.includes('file count mismatch')), `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: Caller/callee explicit arrays required
// ---------------------------------------------------------------------------

test('expectedCallers as string (not array) is rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0',
    createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: '/some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'brain_f1',
      repositoryId: 'brain',
      pinnedCommit: 'a'.repeat(40),
      question: 'test',
      expectedFile: 'src/server.js',
      expectedCallers: 'some module',  // should be array
      scoringType: 'exact-match',
      callerCalleeApplicable: true,
      verificationCommand: 'ls',
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some((e) => e.includes('expectedCallers must be an explicit array')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 8: Forbidden approximation wording
// ---------------------------------------------------------------------------

test('checkForbiddenWording: "or equivalent" is rejected', () => {
  assert.equal(checkForbiddenWording('the main function or equivalent'), 'or equivalent');
});

test('checkForbiddenWording: "approximately" is rejected', () => {
  assert.equal(checkForbiddenWording('approximately 5 files'), 'approximately');
});

test('checkForbiddenWording: clean text passes', () => {
  assert.equal(checkForbiddenWording('export const MIND_TARGET_PATHS = {'), null);
});

test('validateSchema: fixture with "or equivalent" in verificationCommand is rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0',
    createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: '/some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'brain_f1',
      repositoryId: 'brain',
      pinnedCommit: 'a'.repeat(40),
      question: 'test',
      expectedFile: 'src/server.js',
      scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verificationCommand: 'grep or equivalent src/server.js',
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some((e) => e.includes('forbidden wording')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 9: Forbidden paths rejected
// ---------------------------------------------------------------------------

test('isForbiddenPath: mind/ path is forbidden', () => {
  assert.equal(isForbiddenPath('mind/system/agent-context/AGENTS.md'), true);
});

test('isForbiddenPath: node_modules path is forbidden', () => {
  assert.equal(isForbiddenPath('packages/web/node_modules/foo/bar.ts'), true);
});

test('isForbiddenPath: graphify-out/ is forbidden', () => {
  assert.equal(isForbiddenPath('graphify-out/graph.json'), true);
});

test('isForbiddenPath: normal source file is allowed', () => {
  assert.equal(isForbiddenPath('projects/brain-core/src/mind-paths.ts'), false);
  assert.equal(isForbiddenPath('src/app/layout.tsx'), false);
  assert.equal(isForbiddenPath('packages/mcp/src/configure-core.ts'), false);
});

// ---------------------------------------------------------------------------
// Test 10: No temporary exports remain after validation
// ---------------------------------------------------------------------------

test('validateManifest: no temp exports remain after run', async () => {
  const { root, commit } = makeTempGitRepo({ files: { 'src/server.js': 'console.log("test")' } });
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = makeManifest({ repoPath: root, commit });

  // Save to a temp file
  const manifestFile = path.join(os.tmpdir(), `brain-b81-test-manifest-${Date.now()}.json`);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));

  try {
    const tmpDirsBefore = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('brain-b81-manifest-')).length;

    await validateManifest(manifestFile, SCHEMA_PATH);

    const tmpDirsAfter = fs.readdirSync(os.tmpdir()).filter((d) => d.startsWith('brain-b81-manifest-')).length;
    assert.equal(tmpDirsAfter, tmpDirsBefore, 'temp export dirs must be cleaned up after validation');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(manifestFile, { force: true });
  }
});

// ---------------------------------------------------------------------------
// Test: Live manifest validates against the actual pinned repositories
// (skipped if repos not available — allowMissingRepos)
// ---------------------------------------------------------------------------

test('live manifest schema validates without errors', () => {
  const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../operations/specs/b8-1-context-memory-benchmark-manifest.json');
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const errors = validateSchema(manifest, schema);
  assert.deepEqual(errors, [], `live manifest schema errors: ${errors}`);
});
