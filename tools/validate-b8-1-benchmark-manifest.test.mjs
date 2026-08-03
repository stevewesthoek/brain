/**
 * validate-b8-1-benchmark-manifest.test.mjs
 *
 * Tests for the B8.1 benchmark manifest validator.
 * Uses local temporary git repos — does not modify real repositories.
 */

import assert from 'node:assert/strict';
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
  verifyStructuredVerification,
  isForbiddenPath,
  checkForbiddenWording,
  validateExportedTreeSymlinks,
  removeDeclaredSymlinks,
  isProvenUnsafeSymlinkResolution,
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
    repositories: [{ repositoryId: repoId, localPath: path.relative(os.tmpdir(), repoPath), pinnedCommit: commit, description: 'test' }],
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
      verification: { algorithm: 'line-contains', path: 'src/server.js', line: 1, contains: ['console'] },
    }],
  };
}

// ---------------------------------------------------------------------------
// Test 1: Valid manifest passes schema validation
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
// Test 2: Duplicate fixture IDs rejected
// ---------------------------------------------------------------------------

test('duplicate fixture IDs are rejected', () => {
  const { root, commit } = makeTempGitRepo();
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = makeManifest({ repoPath: root, commit });
  manifest.fixtures.push({ ...manifest.fixtures[0] });
  try {
    const errors = validateSchema(manifest, schema);
    assert(errors.some(e => e.includes('duplicate fixtureId')), `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 3: Symbolic refs rejected
// ---------------------------------------------------------------------------

test('symbolic ref "main" as pinnedCommit is rejected by Ajv schema', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0',
    createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'main' }],
    fixtures: [{
      fixtureId: 'brain_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'test', expectedFile: 'src/server.js', scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'file-exists', path: 'src/server.js' },
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('Schema:') || e.includes('pinnedCommit')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 4: File existence in exported tree
// ---------------------------------------------------------------------------

test('fixture file verified in exported pinned commit tree', async () => {
  const { root, commit } = makeTempGitRepo({ files: { 'src/server.js': 'console.log("test")' } });
  const manifest = makeManifest({ repoPath: root, commit });
  const manifestFile = path.join(os.tmpdir(), `brain-b81-test-manifest-${Date.now()}.json`);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  try {
    const { valid, errors } = await validateManifest(manifestFile, SCHEMA_PATH);
    assert.equal(valid, true, `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(manifestFile, { force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 5: Correct symbol at line passes
// ---------------------------------------------------------------------------

test('verifyFixture: correct symbol at expectedLine passes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-vf-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/server.js'), 'line1\nexport const FOO = "bar";\nline3\n');
  const fixture = {
    fixtureId: 'test_f1', expectedFile: 'src/server.js', expectedSymbol: 'FOO', expectedLine: 2,
    scoringType: 'exact-match', callerCalleeApplicable: false,
    verification: { algorithm: 'symbol-at-line', path: 'src/server.js', line: 2, contains: ['FOO'] },
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert.deepEqual(errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('verifyFixture: wrong symbol at expectedLine fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-vf2-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/server.js'), 'line1\nexport const FOO = "bar";\nline3\n');
  const fixture = {
    fixtureId: 'test_f1', expectedFile: 'src/server.js', expectedSymbol: 'WRONG', expectedLine: 2,
    scoringType: 'exact-match', callerCalleeApplicable: false,
    verification: { algorithm: 'symbol-at-line', path: 'src/server.js', line: 2, contains: ['WRONG'] },
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert(errors.some(e => e.includes('not found at line')), `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 6: File count verification
// ---------------------------------------------------------------------------

test('verifyFixture: correct file count passes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-count-'));
  fs.mkdirSync(path.join(root, 'api/a'), { recursive: true });
  fs.mkdirSync(path.join(root, 'api/b'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api/a/route.ts'), '// a');
  fs.writeFileSync(path.join(root, 'api/b/route.ts'), '// b');
  const fixture = {
    fixtureId: 'pc_f2', expectedFileCount: 2, scoringType: 'count-match', callerCalleeApplicable: false,
    verification: { algorithm: 'file-name-count', root: '.', fileName: 'route.ts', expectedCount: 2 },
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert.deepEqual(errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('verifyFixture: wrong file count fails', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-count2-'));
  fs.mkdirSync(path.join(root, 'api'), { recursive: true });
  fs.writeFileSync(path.join(root, 'api/route.ts'), '// route');
  const fixture = {
    fixtureId: 'pc_f2', expectedFileCount: 27, scoringType: 'count-match', callerCalleeApplicable: false,
    verification: { algorithm: 'file-name-count', root: '.', fileName: 'route.ts', expectedCount: 27 },
  };
  try {
    const errors = verifyFixture(fixture, root);
    assert(errors.some(e => e.includes('file count mismatch')), `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 7: Caller/callee arrays required
// ---------------------------------------------------------------------------

test('expectedCallers as string (not array) is rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'brain_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'test', expectedFile: 'src/server.js',
      expectedCallers: 'some module',
      scoringType: 'exact-match', callerCalleeApplicable: true,
      verification: { algorithm: 'file-exists', path: 'src/server.js' },
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('expectedCallers') || e.includes('type')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 8: Forbidden wording
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

test('validateSchema: fixture with "or equivalent" in notes field is rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'brain_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'test', expectedFile: 'src/server.js', scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'file-exists', path: 'src/server.js' },
      notes: 'grep or equivalent src/server.js',
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('forbidden wording')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 9: Forbidden paths
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
});

// ---------------------------------------------------------------------------
// Test 10: Temp exports cleaned up
// ---------------------------------------------------------------------------

test('validateManifest: no temp exports remain after run', async () => {
  const { root, commit } = makeTempGitRepo({ files: { 'src/server.js': 'console.log("test")' } });
  const manifest = makeManifest({ repoPath: root, commit });
  const manifestFile = path.join(os.tmpdir(), `brain-b81-test-manifest-${Date.now()}.json`);
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  try {
    const before = fs.readdirSync(os.tmpdir()).filter(d => d.startsWith('brain-b81-manifest-')).length;
    await validateManifest(manifestFile, SCHEMA_PATH);
    const after = fs.readdirSync(os.tmpdir()).filter(d => d.startsWith('brain-b81-manifest-')).length;
    assert.equal(after, before, 'temp dirs must be cleaned up');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(manifestFile, { force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 11: Live manifest passes
// ---------------------------------------------------------------------------

test('live manifest schema validates without errors', () => {
  const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../operations/specs/b8-1-context-memory-benchmark-manifest.json');
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const errors = validateSchema(manifest, schema);
  assert.deepEqual(errors, [], `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 12: count-match does NOT require expectedFile
// ---------------------------------------------------------------------------

test('count-match fixture without expectedFile passes schema', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'count_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'How many?', expectedFileCount: 5, scoringType: 'count-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'file-name-count', root: '.', fileName: 'index.ts', expectedCount: 5 },
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert.deepEqual(errors, [], `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 13: exact-match requires expectedFile
// ---------------------------------------------------------------------------

test('exact-match fixture without expectedFile fails schema', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'exact_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'Where?', scoringType: 'exact-match', callerCalleeApplicable: false,
      verification: { algorithm: 'file-exists', path: 'src/index.ts' },
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('expectedFile') || e.includes('required')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 14: Path traversal rejected
// ---------------------------------------------------------------------------

test('path traversal in expectedFile is rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'brain_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'test', expectedFile: '../../../etc/passwd', scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'file-exists', path: '../../../etc/passwd' },
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('traversal')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 15: JSON pointer set verification
// ---------------------------------------------------------------------------

test('verifyStructuredVerification: json-pointer-set with object array', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-json-'));
  const data = { admissions: [null, { scope: { tools: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] } }] };
  fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify(data));
  try {
    const errors = verifyStructuredVerification(
      { algorithm: 'json-pointer-set', path: 'data.json', jsonPointer: '/admissions/1/scope/tools', expected: ['a', 'b', 'c'] },
      root
    );
    assert.deepEqual(errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('verifyStructuredVerification: json-pointer-set mismatch detected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-json2-'));
  const data = { items: [{ name: 'x' }, { name: 'y' }] };
  fs.writeFileSync(path.join(root, 'data.json'), JSON.stringify(data));
  try {
    const errors = verifyStructuredVerification(
      { algorithm: 'json-pointer-set', path: 'data.json', jsonPointer: '/items', expected: ['a', 'b'] },
      root
    );
    assert(errors.some(e => e.includes('set mismatch')), `errors: ${errors}`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Test 16: Free-form commands impossible (no verificationCommand in schema)
// ---------------------------------------------------------------------------

test('verificationCommand field is not accepted by schema', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'brain_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'test', expectedFile: 'src/x.ts', scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'file-exists', path: 'src/x.ts' },
      verificationCommand: 'grep test src/x.ts',
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('additional') || e.includes('NOT')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 17: Fixture pinnedCommit must equal repository pinnedCommit
// ---------------------------------------------------------------------------

test('fixture pinnedCommit differing from repository is rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const commit1 = 'a'.repeat(40);
  const commit2 = 'b'.repeat(40);
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: commit1 }],
    fixtures: [{
      fixtureId: 'brain_f1', repositoryId: 'brain', pinnedCommit: commit2,
      question: 'test', expectedFile: 'src/x.ts', scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'file-exists', path: 'src/x.ts' },
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('differs from repository')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 18: Symlink escape in verification path rejected
// ---------------------------------------------------------------------------

test('absolute path in verification.path rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = {
    schemaVersion: '1.0.0', createdAt: '2026-08-02',
    repositories: [{ repositoryId: 'brain', localPath: 'some/path', pinnedCommit: 'a'.repeat(40) }],
    fixtures: [{
      fixtureId: 'brain_f1', repositoryId: 'brain', pinnedCommit: 'a'.repeat(40),
      question: 'test', expectedFile: 'src/x.ts', scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'line-contains', path: '/etc/passwd', line: 1, contains: ['root'] },
    }],
  };
  const errors = validateSchema(manifest, schema);
  assert(errors.some(e => e.includes('must be relative')), `errors: ${errors}`);
});

// ---------------------------------------------------------------------------
// Test 19: Live manifest validates with full fixture verification
// ---------------------------------------------------------------------------

test('live manifest validates without errors (full live run)', async () => {
  const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../operations/specs/b8-1-context-memory-benchmark-manifest.json');
  const { valid, errors } = await validateManifest(manifestPath, SCHEMA_PATH);
  assert.equal(valid, true, `errors: ${errors.join('; ')}`);
});

test('duplicate repository IDs are rejected', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = makeManifest({ repoPath: '/tmp/repo', commit: 'a'.repeat(40) });
  manifest.repositories.push({ ...manifest.repositories[0] });
  const errors = validateSchema(manifest, schema);
  assert.ok(errors.some(error => /duplicate repositoryId/.test(error)), errors.join('; '));
});

test('absolute repository paths are rejected as non-portable', () => {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
  const manifest = makeManifest({ repoPath: '/tmp/repo', commit: 'a'.repeat(40) });
  manifest.repositories[0].localPath = '/tmp/repo';
  const errors = validateSchema(manifest, schema);
  assert.ok(errors.some(error => /portable|pattern/.test(error)), errors.join('; '));
});

test('file-name-count rejects traversal and missing roots instead of counting zero', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-count-root-'));
  try {
    const traversal = verifyStructuredVerification({
      algorithm: 'file-name-count', root: '../../', fileName: 'route.ts', expectedCount: 0,
    }, root);
    assert.ok(traversal.some(error => /escape/.test(error)), traversal.join('; '));
    const missing = verifyStructuredVerification({
      algorithm: 'file-name-count', root: 'missing', fileName: 'route.ts', expectedCount: 0,
    }, root);
    assert.ok(missing.some(error => /not found|unreadable/.test(error)), missing.join('; '));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('unreferenced symlink escapes are rejected', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-symlink-root-'));
  try {
    fs.symlinkSync('/tmp', path.join(root, 'escape'));
    const errors = validateExportedTreeSymlinks(root);
    assert.ok(errors.some(error => /symlink escape/.test(error)), errors.join('; '));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('declared symlink exclusions cannot omit a safely contained link', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-contained-link-'));
  try {
    fs.writeFileSync(path.join(root, 'target.txt'), 'safe');
    fs.symlinkSync('target.txt', path.join(root, 'link.txt'));
    const errors = removeDeclaredSymlinks(root, ['link.txt']);
    assert.ok(errors.some(error => /resolves safely/.test(error)), errors.join('; '));
    assert.equal(fs.lstatSync(path.join(root, 'link.txt')).isSymbolicLink(), true);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('declared symlink exclusions accept only proven escapes or broken targets', () => {
  assert.equal(isProvenUnsafeSymlinkResolution(Object.assign(new Error('path not found or unreadable: link'), { code: 'ENOENT' })), true);
  assert.equal(isProvenUnsafeSymlinkResolution(new Error('symlink escape: "link" resolves outside exported root')), true);
  assert.equal(isProvenUnsafeSymlinkResolution(Object.assign(new Error('path not found or unreadable: link'), { code: 'EACCES' })), false);
  assert.equal(isProvenUnsafeSymlinkResolution(Object.assign(new Error('path not found or unreadable: link'), { code: 'EIO' })), false);
});

test('provided exported root binding must not itself be a symlink', async () => {
  const { root: repoRoot, commit } = makeTempGitRepo();
  const manifest = makeManifest({ repoPath: repoRoot, commit });
  const manifestFile = path.join(os.tmpdir(), `brain-b81-binding-manifest-${Date.now()}.json`);
  const bindingParent = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-b81-binding-'));
  const bindingLink = path.join(bindingParent, 'root-link');
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  fs.symlinkSync(repoRoot, bindingLink);
  try {
    const result = await validateManifest(manifestFile, SCHEMA_PATH, { exportedRootBindings: { brain: bindingLink } });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(error => /provided exported root must be a non-symlink directory/.test(error)), result.errors.join('; '));
  } finally {
    fs.rmSync(repoRoot, { recursive: true, force: true });
    fs.rmSync(bindingParent, { recursive: true, force: true });
    fs.rmSync(manifestFile, { force: true });
  }
});
