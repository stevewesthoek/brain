/**
 * prepare-b8-1-context-memory-benchmark.test.mjs
 *
 * 22 regression tests for the B8.1 benchmark preflight harness.
 * Uses synthetic HOME directories and temp git repos — never touches real home.
 * Run: node --test tools/prepare-b8-1-context-memory-benchmark.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { runPreflight } from './prepare-b8-1-context-memory-benchmark.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL_MANIFEST = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(prefix = 'b81-pf-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeTempGitRepo(dir, files = { 'README.md': '# hello' }) {
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'init'], { cwd: dir });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
}

function makeMinimalManifest(repos) {
  return {
    schemaVersion: '1.0.0',
    createdAt: '2026-08-03',
    repositories: repos.map(r => ({
      repositoryId: r.id,
      localPath: r.path,
      pinnedCommit: r.commit,
      description: 'test'
    })),
    fixtures: repos.map((r, i) => ({
      fixtureId: `${r.id}_f${i + 1}`,
      repositoryId: r.id,
      pinnedCommit: r.commit,
      question: 'test?',
      expectedFile: Object.keys(r.files || { 'README.md': '' })[0],
      scoringType: 'exact-match',
      callerCalleeApplicable: false,
      verification: { algorithm: 'file-exists', path: Object.keys(r.files || { 'README.md': '' })[0] },
    })),
  };
}

function writeTempManifest(manifest) {
  const f = path.join(os.tmpdir(), `b81-test-manifest-${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(f, JSON.stringify(manifest));
  return f;
}

function makeSyntheticHome() {
  const home = makeTempDir('b81-home-');
  fs.mkdirSync(path.join(home, '.brain'), { recursive: true });
  return home;
}

function cleanup(...paths) {
  for (const p of paths) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
}

// ---------------------------------------------------------------------------
// Test 1: Dry run with exact-source only exits successfully
// ---------------------------------------------------------------------------

test('T1: dry run with exact-source only exits with executionReady=true', async () => {
  const repoDir = makeTempDir('b81-repo1-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'README.md': '' } }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-run-001',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, true);
    assert.deepEqual(summary.selectedSubjects, ['exact-source']);
    assert.ok(summary.excludedSubjects.includes('cbm'));
    assert.ok(summary.excludedSubjects.includes('graphify'));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 2: Invalid run ID rejected
// ---------------------------------------------------------------------------

test('T2: invalid run ID is rejected', async () => {
  const repoDir = makeTempDir('b81-repo2-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: '../escape/bad',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    assert.ok(checks.some(c => c.name === 'run-id-valid' && c.status === 'fail'));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 3: Traversal in run ID rejected
// ---------------------------------------------------------------------------

test('T3: run ID with path traversal is rejected', async () => {
  const repoDir = makeTempDir('b81-repo3-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-../../etc',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 4: Whitespace in run ID rejected
// ---------------------------------------------------------------------------

test('T4: run ID with whitespace is rejected', async () => {
  const repoDir = makeTempDir('b81-repo4-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-has space',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 5: Missing run ID rejected
// ---------------------------------------------------------------------------

test('T5: missing run ID causes executionReady=false', async () => {
  const repoDir = makeTempDir('b81-repo5-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary } = await runPreflight({
      dryRun: true,
      runId: null,
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 6: Existing run directory rejected
// ---------------------------------------------------------------------------

test('T6: existing run directory causes fail check', async () => {
  const repoDir = makeTempDir('b81-repo6-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  const runDir = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', 'b8-1-existing-run');
  fs.mkdirSync(runDir, { recursive: true });
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-existing-run',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    assert.ok(checks.some(c => c.name === 'run-directory-exists' && c.status === 'fail'));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 7: CBM excluded when not in selected subjects
// ---------------------------------------------------------------------------

test('T7: CBM binary check returns excluded-subject when cbm not selected', async () => {
  const repoDir = makeTempDir('b81-repo7-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-007',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const cbmCheck = checks.find(c => c.name === 'cbm-binary-identity');
    assert.ok(cbmCheck);
    assert.equal(cbmCheck.status, 'excluded-subject');
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 8: Network isolation excluded when cbm not selected
// ---------------------------------------------------------------------------

test('T8: network isolation excluded when cbm not selected', async () => {
  const repoDir = makeTempDir('b81-repo8-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-008',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const netCheck = checks.find(c => c.name === 'network-isolation');
    assert.ok(netCheck);
    assert.equal(netCheck.status, 'excluded-subject');
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 9: Graphify excluded when not in selected subjects
// ---------------------------------------------------------------------------

test('T9: graphify check returns excluded-subject when graphify not selected', async () => {
  const repoDir = makeTempDir('b81-repo9-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-009',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const gCheck = checks.find(c => c.name === 'graphify-subject');
    assert.ok(gCheck);
    assert.equal(gCheck.status, 'excluded-subject');
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 10: Manifest load failure yields executionReady=false
// ---------------------------------------------------------------------------

test('T10: non-existent manifest causes fail', async () => {
  const home = makeSyntheticHome();
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-010',
      subjects: ['exact-source'],
      _manifestPathOverride: '/nonexistent/manifest.json',
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    assert.ok(checks.some(c => c.name === 'manifest-validation' && c.status === 'fail'));
  } finally {
    cleanup(home);
  }
});

// ---------------------------------------------------------------------------
// Test 11: Malformed JSON manifest is rejected
// ---------------------------------------------------------------------------

test('T11: malformed JSON manifest causes fail', async () => {
  const home = makeSyntheticHome();
  const badManifest = path.join(os.tmpdir(), `b81-bad-${crypto.randomBytes(4).toString('hex')}.json`);
  fs.writeFileSync(badManifest, '{not valid json');
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-011',
      subjects: ['exact-source'],
      _manifestPathOverride: badManifest,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    assert.ok(checks.some(c => c.name === 'manifest-validation' && c.status === 'fail'));
  } finally {
    cleanup(home, badManifest);
  }
});

// ---------------------------------------------------------------------------
// Test 12: Wrong schemaVersion is rejected
// ---------------------------------------------------------------------------

test('T12: wrong schemaVersion fails manifest check', async () => {
  const home = makeSyntheticHome();
  const manifest = { schemaVersion: '99.0.0', createdAt: '2026', repositories: [], fixtures: [] };
  const manifestFile = writeTempManifest(manifest);
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-012',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    assert.ok(checks.some(c => c.name === 'manifest-validation' && c.status === 'fail'));
  } finally {
    cleanup(home, manifestFile);
  }
});

// ---------------------------------------------------------------------------
// Test 13: Pinned commit not found → fail
// ---------------------------------------------------------------------------

test('T13: pinned commit not found in repository causes fail', async () => {
  const repoDir = makeTempDir('b81-repo13-');
  makeTempGitRepo(repoDir);
  const fakePinned = 'deadbeef'.repeat(5);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit: fakePinned }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-013',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    // Task 1: Full manifest validation now catches missing pinned commits during validation
    assert.ok(checks.some(c => c.name === 'manifest-validation' && c.status === 'fail'));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 14: Repository path not found → fail
// ---------------------------------------------------------------------------

test('T14: repository path not found causes fail', async () => {
  const manifest = makeMinimalManifest([{ id: 'test', path: '/nonexistent/repo/path', commit: 'a'.repeat(40) }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-014',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    // Task 1: Full manifest validation now catches missing repositories during validation
    assert.ok(checks.some(c => c.name === 'manifest-validation' && c.status === 'fail'));
  } finally {
    cleanup(manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 15: Return shape has required fields
// ---------------------------------------------------------------------------

test('T15: return shape includes checks, summary, runDir, dryRun', async () => {
  const repoDir = makeTempDir('b81-repo15-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-015',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.ok(Array.isArray(result.checks));
    assert.ok(typeof result.summary === 'object');
    assert.ok('runDir' in result);
    assert.equal(result.dryRun, true);
    assert.ok(typeof result.summary.executionReady === 'boolean');
    assert.ok(Array.isArray(result.summary.selectedSubjects));
    assert.ok(Array.isArray(result.summary.excludedSubjects));
    assert.ok(Array.isArray(result.summary.blockingChecks));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 16: Check status is one of the five valid statuses
// ---------------------------------------------------------------------------

test('T16: all check statuses are valid (pass|informational|excluded-subject|blocked|fail)', async () => {
  const repoDir = makeTempDir('b81-repo16-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  const validStatuses = new Set(['pass', 'informational', 'excluded-subject', 'blocked', 'fail']);
  try {
    const { checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-016',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    for (const check of checks) {
      assert.ok(validStatuses.has(check.status), `check "${check.name}" has invalid status "${check.status}"`);
    }
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 17: Materialization refused when not executionReady
// ---------------------------------------------------------------------------

test('T17: materialization refused when not executionReady', async () => {
  const repoDir = makeTempDir('b81-repo17-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { checks } = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: null,
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const matCheck = checks.find(c => c.name === 'materialization');
    assert.ok(matCheck);
    assert.equal(matCheck.status, 'fail');
    assert.ok(matCheck.detail.includes('not ready'));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 18: Materialization creates run directory with atomic rename
// ---------------------------------------------------------------------------

test('T18: materialization creates run directory with expected structure', async () => {
  const repoDir = makeTempDir('b81-repo18-');
  const commit = makeTempGitRepo(repoDir, { 'src/index.ts': 'export const x = 1;' });
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'src/index.ts': '' } }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    // Task 2: Get plan digest from dry-run first, then materialize with approval
    const dryRun = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-018',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(dryRun.summary.executionReady, true);
    const planSha256 = dryRun.summary.planSha256;
    assert.ok(planSha256, 'planSha256 must be present in dry-run');

    const { summary, runDir } = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-018',
      subjects: ['exact-source'],
      approvedPlanSha256: planSha256,
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, true);
    assert.ok(fs.existsSync(runDir));
    assert.ok(fs.existsSync(path.join(runDir, 'sources', 'test')));
    assert.ok(fs.existsSync(path.join(runDir, 'evidence')));
    assert.ok(fs.existsSync(path.join(runDir, 'logs')));
    assert.ok(fs.existsSync(path.join(runDir, 'preflight-receipt.json')));
    assert.ok(fs.existsSync(path.join(runDir, 'run-plan.json')));
    assert.ok(fs.existsSync(path.join(runDir, 'cleanup-manifest.json')));
    assert.ok(fs.existsSync(path.join(runDir, 'source-state-before.json')));
    assert.ok(fs.existsSync(path.join(runDir, 'source-state-after.json')));
    const tmpSibling = runDir + '.tmp';
    assert.equal(fs.existsSync(tmpSibling), false, 'tmp sibling must not remain');
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 19: Source-state invariant (before == after)
// ---------------------------------------------------------------------------

test('T19: source state before and after match in materialized run', async () => {
  const repoDir = makeTempDir('b81-repo19-');
  const commit = makeTempGitRepo(repoDir, { 'a.txt': 'content' });
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'a.txt': '' } }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    // Task 2: Get plan digest from dry-run first
    const dryRun = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-019',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const planSha256 = dryRun.summary.planSha256;

    const { runDir } = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-019',
      subjects: ['exact-source'],
      approvedPlanSha256: planSha256,
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const before = JSON.parse(fs.readFileSync(path.join(runDir, 'source-state-before.json'), 'utf8'));
    const after = JSON.parse(fs.readFileSync(path.join(runDir, 'source-state-after.json'), 'utf8'));
    assert.equal(before.length, after.length);
    for (let i = 0; i < before.length; i++) {
      assert.equal(before[i].HEAD, after[i].HEAD);
      assert.equal(before[i].statusSha256, after[i].statusSha256);
    }
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 20: Cleanup manifest targets correct run ID
// ---------------------------------------------------------------------------

test('T20: cleanup manifest references exact run ID', async () => {
  const repoDir = makeTempDir('b81-repo20-');
  const commit = makeTempGitRepo(repoDir, { 'b.txt': 'hello' });
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'b.txt': '' } }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    // Task 2: Get plan digest from dry-run first
    const dryRun = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-020',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const planSha256 = dryRun.summary.planSha256;

    const { runDir } = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-020',
      subjects: ['exact-source'],
      approvedPlanSha256: planSha256,
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const cleanupManifest = JSON.parse(fs.readFileSync(path.join(runDir, 'cleanup-manifest.json'), 'utf8'));
    assert.equal(cleanupManifest.runId, 'b8-1-test-020');
    assert.equal(cleanupManifest.runDirectory, runDir);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 21: CBM selected but admission missing → fail
// ---------------------------------------------------------------------------

test('T21: CBM selected but admissions file missing causes fail', async () => {
  const repoDir = makeTempDir('b81-repo21-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { summary, checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-021',
      subjects: ['cbm', 'exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(summary.executionReady, false);
    const cbmCheck = checks.find(c => c.name === 'cbm-binary-identity');
    assert.ok(cbmCheck);
    assert.equal(cbmCheck.status, 'fail');
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

// ---------------------------------------------------------------------------
// Test 22: Disk budget check runs (informational or pass, not crash)
// ---------------------------------------------------------------------------

test('T22: disk budget check does not crash', async () => {
  const repoDir = makeTempDir('b81-repo22-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  try {
    const { checks } = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-022',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const diskCheck = checks.find(c => c.name === 'disk-budget');
    assert.ok(diskCheck, 'disk-budget check must exist');
    assert.ok(['pass', 'fail', 'informational'].includes(diskCheck.status));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});
