/**
 * prepare-b8-1-context-memory-benchmark.test.mjs
 *
 * Regression tests for the B8.1 benchmark preflight harness.
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

import {
  buildCanonicalPlan,
  computePlanDigest,
  interpretSandboxedChildResult,
  runPreflight,
} from './prepare-b8-1-context-memory-benchmark.mjs';

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
  const portableManifest = structuredClone(manifest);
  for (const repository of portableManifest.repositories ?? []) {
    if (path.isAbsolute(repository.localPath)) {
      repository.localPath = path.relative(path.dirname(f), repository.localPath);
    }
  }
  fs.writeFileSync(f, JSON.stringify(portableManifest));
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

function makeCanonicalPlanFixture(overrides = {}) {
  const selectedSubjects = overrides.selectedSubjects ?? ['cbm', 'exact-source'];
  return buildCanonicalPlan({
    runId: 'b8-1-plan-digest-test',
    selectedSubjects,
    manifestPath: '/synthetic/manifest.json',
    manifestHash: '1'.repeat(64),
    manifestSchemaPath: '/synthetic/manifest.schema.json',
    manifestSchemaHash: '2'.repeat(64),
    evidenceSchemaPath: '/synthetic/evidence.schema.json',
    evidenceSchemaHash: '3'.repeat(64),
    manifest: {
      repositories: [{ repositoryId: 'repo', pinnedCommit: '4'.repeat(40) }],
    },
    cbmIdentity: {
      stablePath: '/synthetic/.local/bin/codebase-memory-mcp',
      resolvedPath: '/synthetic/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp',
      version: 'v0.9.0',
      sha256: '5'.repeat(64),
    },
    networkProof: {
      required: true,
      status: 'passed',
      adapterIdentity: { path: '/usr/bin/sandbox-exec', sha256: '6'.repeat(64) },
      runtimeIdentity: { path: '/synthetic/node', sha256: 'b'.repeat(64), version: 'v24.0.0' },
      childIdentity: { path: '/synthetic/b8-1-network-isolation-child.mjs', sha256: 'c'.repeat(64) },
      profilePath: '/synthetic/b8-1-network-deny.sb',
      profileSha256: '7'.repeat(64),
      controlSucceeded: true,
      sandboxedChildStarted: true,
      sandboxedConnectionDenied: true,
      selfTestPassed: true,
      selfTestDetail: 'permission denial proven',
    },
    graphifyStatus: {
      status: 'excluded-subject',
      reason: 'graphify not selected',
      profilePath: '/synthetic/graphify-operational-profiles.json',
      profileSha256: '8'.repeat(64),
      governancePath: '/synthetic/graphify-transition-governance.json',
      governanceSha256: '9'.repeat(64),
    },
    diskResult: { name: 'disk-budget', status: 'pass', detail: '4096 MB available' },
    plannedWritePaths: ['/synthetic/run/evidence', '/synthetic/run/logs'],
    runDirectoryPhysical: '/synthetic/run',
    sourceStateHash: 'a'.repeat(64),
    checks: [{ name: 'manifest-validation', status: 'pass', detail: 'valid' }],
    ...overrides,
  });
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
    assert.ok(typeof result.canonicalPlan === 'object');
    assert.equal(computePlanDigest(result.canonicalPlan), result.summary.planSha256);
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
    assert.ok(['pass', 'fail', 'blocked'].includes(diskCheck.status));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T23: identical canonical plan inputs produce identical digest', () => {
  const first = makeCanonicalPlanFixture();
  const second = makeCanonicalPlanFixture();
  assert.deepEqual(first, second);
  assert.equal(computePlanDigest(first), computePlanDigest(second));
});

test('T24: subjects, manifest, schemas, binary, profile, and write paths change digest', () => {
  const baseline = makeCanonicalPlanFixture();
  const baselineDigest = computePlanDigest(baseline);
  const mutations = [
    makeCanonicalPlanFixture({ selectedSubjects: ['exact-source'] }),
    makeCanonicalPlanFixture({ manifestHash: 'b'.repeat(64) }),
    makeCanonicalPlanFixture({ manifestSchemaHash: 'c'.repeat(64) }),
    makeCanonicalPlanFixture({ evidenceSchemaHash: 'd'.repeat(64) }),
    makeCanonicalPlanFixture({
      cbmIdentity: { ...baseline.subjectBinaryIdentity.cbm, sha256: 'e'.repeat(64) },
    }),
    makeCanonicalPlanFixture({
      graphifyStatus: { ...baseline.graphifyStatus, profileSha256: 'f'.repeat(64) },
    }),
    makeCanonicalPlanFixture({
      networkProof: {
        ...baseline.networkIsolationProof,
        childIdentity: { ...baseline.networkIsolationProof.childIdentity, sha256: '0'.repeat(64) },
      },
    }),
    makeCanonicalPlanFixture({ plannedWritePaths: [...baseline.plannedWritePaths, '/synthetic/run/new-path'] }),
    makeCanonicalPlanFixture({ runDirectoryPhysical: '/synthetic/other-run' }),
  ];
  for (const mutated of mutations) {
    assert.notEqual(computePlanDigest(mutated), baselineDigest);
  }
});

test('T25: missing plan approval creates no run directory', async () => {
  const repoDir = makeTempDir('b81-repo25-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-025',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(fs.existsSync(result.runDir), false);
    assert.equal(fs.existsSync(`${result.runDir}.tmp`), false);
    assert.ok(result.checks.some(check => check.name === 'plan-approval' && check.status === 'fail'));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T26: wrong plan approval creates no run directory', async () => {
  const repoDir = makeTempDir('b81-repo26-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-026',
      subjects: ['exact-source'],
      approvedPlanSha256: '0'.repeat(64),
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(fs.existsSync(result.runDir), false);
    assert.equal(fs.existsSync(`${result.runDir}.tmp`), false);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T27: refused and timeout child results never prove sandbox denial', () => {
  for (const result of ['connection-refused-or-timeout', 'connection-timeout']) {
    const interpreted = interpretSandboxedChildResult({
      status: 2,
      stdout: `CHILD_STARTUP_MARKER\n${JSON.stringify({ result, error: 'ECONNREFUSED', exitCode: 2 })}\n`,
    });
    assert.equal(interpreted.proved, false);
    assert.match(interpreted.reason, /refused\/timeout/);
  }
});

test('T28: child launch failure never proves sandbox denial', () => {
  const interpreted = interpretSandboxedChildResult({
    error: new Error('spawn sandbox-exec ENOENT'),
    stdout: '',
  });
  assert.equal(interpreted.proved, false);
  assert.match(interpreted.reason, /launch failed/);
});

test('T29: invalid fixture blocks dry-run and materialization without artifacts', async () => {
  const repoDir = makeTempDir('b81-repo29-');
  const commit = makeTempGitRepo(repoDir);
  const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit }]);
  manifest.fixtures[0].verification.path = 'missing.txt';
  const manifestFile = writeTempManifest(manifest);
  const home = makeSyntheticHome();
  const runId = 'b8-1-test-029';
  try {
    const dryRun = await runPreflight({
      dryRun: true,
      runId,
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(dryRun.summary.executionReady, false);
    assert.ok(dryRun.checks.some(check => check.name === 'manifest-validation' && check.status === 'fail'));

    const materialization = await runPreflight({
      dryRun: false,
      materialize: true,
      runId,
      subjects: ['exact-source'],
      approvedPlanSha256: '0'.repeat(64),
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(materialization.summary.executionReady, false);
    assert.equal(fs.existsSync(path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId)), false);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T30: materialized plan and receipt bind expanded deterministic inputs', async () => {
  const repoDir = makeTempDir('b81-repo30-');
  const commit = makeTempGitRepo(repoDir, { 'src/index.ts': 'export const x = 1;' });
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'src/index.ts': '' } }]));
  const home = makeSyntheticHome();
  try {
    const dryRun = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-030',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const materialized = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-030',
      subjects: ['exact-source'],
      approvedPlanSha256: dryRun.summary.planSha256,
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(materialized.summary.executionReady, true);
    const runPlan = JSON.parse(fs.readFileSync(path.join(materialized.runDir, 'run-plan.json'), 'utf8'));
    const receipt = JSON.parse(fs.readFileSync(path.join(materialized.runDir, 'preflight-receipt.json'), 'utf8'));
    assert.equal(runPlan.partialEvidence, true);
    assert.deepEqual(runPlan.networkIsolationProof, { required: false, status: 'not-required' });
    assert.match(runPlan.graphifyStatus.profileSha256, /^[a-f0-9]{64}$/);
    assert.equal(runPlan.diskResult.name, 'disk-budget');
    assert.match(runPlan.sourceStateHash, /^sha256:[a-f0-9]{64}$/);
    assert.ok(runPlan.plannedWritePaths.every(plannedPath => path.isAbsolute(plannedPath)));
    assert.ok(runPlan.plannedWritePaths.includes(materialized.runDir));
    assert.ok(runPlan.plannedWritePaths.includes(path.join(home, '.brain')));
    assert.ok(runPlan.plannedWritePaths.includes(path.join(home, '.brain', 'benchmark')));
    assert.equal(runPlan.plannedWritePaths.some(plannedPath => plannedPath.endsWith('.tmp')), false);
    for (const check of runPlan.checks) {
      assert.deepEqual(Object.keys(check).sort(), ['detail', 'name', 'status']);
    }
    const { planSha256, createdAt, ...digestInputs } = runPlan;
    assert.equal(computePlanDigest(digestInputs), planSha256);
    const { planSha256: receiptDigest, createdAt: receiptCreatedAt, ...receiptInputs } = receipt;
    assert.equal(receiptDigest, planSha256);
    assert.deepEqual(receiptInputs, digestInputs);
    assert.ok(createdAt);
    assert.ok(receiptCreatedAt);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T31: only an exit-status-1 EPERM/EACCES child proves sandbox denial', () => {
  const stdout = `CHILD_STARTUP_MARKER\n${JSON.stringify({
    result: 'connection-denied-permission',
    error: 'EPERM: operation not permitted',
    exitCode: 1,
  })}\n`;
  assert.equal(interpretSandboxedChildResult({ status: 1, stdout }).proved, true);
  const falseProof = interpretSandboxedChildResult({ status: 0, stdout });
  assert.equal(falseProof.proved, false);
  assert.match(falseProof.reason, /unexpected exit code/);
});

test('T32: malformed plan approval fails closed without creating a directory', async () => {
  const repoDir = makeTempDir('b81-repo32-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-032',
      subjects: ['exact-source'],
      approvedPlanSha256: 42,
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(fs.existsSync(result.runDir), false);
    assert.ok(result.checks.some(check => check.name === 'plan-approval' && /64 lowercase/.test(check.detail)));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T33: symlinked benchmark ancestor cannot redirect writes into a protected path', async () => {
  const repoDir = makeTempDir('b81-repo33-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeTempDir('b81-home-symlink-');
  fs.mkdirSync(path.join(home, '.codex'), { recursive: true });
  fs.symlinkSync('.codex', path.join(home, '.brain'));
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-033',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.ok(result.checks.some(check => check.name === 'planned-write-containment' && check.status === 'fail'));
    assert.equal(fs.existsSync(path.join(home, '.codex', 'benchmark', 'b8-1', 'runs', 'b8-1-test-033')), false);
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T34: dirty source repository blocks source-state binding and plan approval', async () => {
  const repoDir = makeTempDir('b81-repo34-');
  const commit = makeTempGitRepo(repoDir);
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# dirty');
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-034',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(result.summary.planSha256, null);
    assert.ok(result.checks.some(check => check.name === 'source-state-binding' && check.status === 'fail' && /clean=false/.test(check.detail)));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T35: clean source repository at a different HEAD blocks source-state binding', async () => {
  const repoDir = makeTempDir('b81-repo35-');
  const pinnedCommit = makeTempGitRepo(repoDir);
  fs.writeFileSync(path.join(repoDir, 'SECOND.md'), 'second');
  execFileSync('git', ['add', 'SECOND.md'], { cwd: repoDir });
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'second'], { cwd: repoDir });
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit: pinnedCommit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-035',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(result.summary.planSha256, null);
    assert.ok(result.checks.some(check => check.name === 'source-state-binding' && check.status === 'fail' && /HEAD=/.test(check.detail)));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T36: absent .brain directory is a digest-bound planned write before materialization', async () => {
  const repoDir = makeTempDir('b81-repo36-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeTempDir('b81-home-no-brain-');
  try {
    const dryRun = await runPreflight({
      dryRun: true,
      runId: 'b8-1-test-036',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(dryRun.summary.executionReady, true);
    const materialized = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-test-036',
      subjects: ['exact-source'],
      approvedPlanSha256: dryRun.summary.planSha256,
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(materialized.summary.executionReady, true);
    const runPlan = JSON.parse(fs.readFileSync(path.join(materialized.runDir, 'run-plan.json'), 'utf8'));
    assert.ok(runPlan.plannedWritePaths.includes(path.join(home, '.brain')));
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T37: insufficient disk blocks readiness and creates no run artifact', async () => {
  const repoDir = makeTempDir('b81-disk-low-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const runId = 'b8-1-disk-low';
  try {
    const result = await runPreflight({
      dryRun: true, runId, subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: home,
      _diskBudgetHooks: { _spawnSync: () => ({ status: 0, stdout: 'Filesystem 1M-blocks Used Available Capacity Mounted on\n/dev/test 1 1 100 1% /' }) },
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(result.checks.find(check => check.name === 'disk-budget')?.status, 'fail');
    assert.equal(fs.existsSync(path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId)), false);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T38: unknown disk capacity blocks readiness and creates no run artifact', async () => {
  const repoDir = makeTempDir('b81-disk-unknown-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const runId = 'b8-1-disk-unknown';
  try {
    const result = await runPreflight({
      dryRun: true, runId, subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: home,
      _diskBudgetHooks: {
        _spawnSync: () => ({ status: 1, stdout: '' }),
        _statFsSync: () => { throw new Error('capacity unavailable'); },
      },
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(result.checks.find(check => check.name === 'disk-budget')?.status, 'blocked');
    assert.equal(fs.existsSync(path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId)), false);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T39: selected Graphify remains blocked and creates no run artifact', async () => {
  const repoDir = makeTempDir('b81-graphify-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const runId = 'b8-1-graphify-blocked';
  try {
    const result = await runPreflight({ dryRun: true, runId, subjects: ['graphify'], _manifestPathOverride: manifestFile, _homeOverride: home });
    assert.equal(result.summary.executionReady, false);
    assert.equal(result.checks.find(check => check.name === 'graphify-subject')?.status, 'blocked');
    assert.equal(fs.existsSync(path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId)), false);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T40: stale approval after manifest input change creates no run directory', async () => {
  const repoDir = makeTempDir('b81-stale-plan-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const runId = 'b8-1-stale-plan';
  try {
    const dryRun = await runPreflight({ dryRun: true, runId, subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: home });
    const changedManifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    changedManifest.repositories[0].description = 'digest-changing description';
    fs.writeFileSync(manifestFile, JSON.stringify(changedManifest));
    const materialization = await runPreflight({
      dryRun: false, materialize: true, runId, subjects: ['exact-source'], approvedPlanSha256: dryRun.summary.planSha256,
      _manifestPathOverride: manifestFile, _homeOverride: home,
    });
    assert.equal(materialization.summary.executionReady, false);
    assert.ok(materialization.checks.some(check => check.name === 'plan-approval' && check.status === 'fail'));
    assert.equal(fs.existsSync(path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId)), false);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T41: materialization-time run collision never writes into the colliding directory', async () => {
  const repoDir = makeTempDir('b81-collision-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const runId = 'b8-1-collision-race';
  const runDir = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId);
  try {
    const dryRun = await runPreflight({ dryRun: true, runId, subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: home });
    const result = await runPreflight({
      dryRun: false, materialize: true, runId, subjects: ['exact-source'], approvedPlanSha256: dryRun.summary.planSha256,
      _manifestPathOverride: manifestFile, _homeOverride: home,
      _materializationHooks: { _beforeMaterialize: () => fs.mkdirSync(runDir, { recursive: true }) },
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(fs.existsSync(path.join(runDir, 'run-plan.json')), false);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T42: forced mid-materialization failure rolls back the owned run directory', async () => {
  const repoDir = makeTempDir('b81-rollback-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const runId = 'b8-1-forced-rollback';
  const runDir = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId);
  try {
    const dryRun = await runPreflight({ dryRun: true, runId, subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: home });
    const result = await runPreflight({
      dryRun: false, materialize: true, runId, subjects: ['exact-source'], approvedPlanSha256: dryRun.summary.planSha256,
      _manifestPathOverride: manifestFile, _homeOverride: home,
      _materializationHooks: { _failAt: phase => { if (phase === 'after-run-directory') throw new Error('injected materialization failure'); } },
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(fs.existsSync(runDir), false);
    assert.equal(fs.existsSync(path.join(home, '.brain', 'benchmark')), false);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T43: symlink retarget after approval is rejected before any run write', async () => {
  const repoDir = makeTempDir('b81-retarget-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const escapeRoot = makeTempDir('b81-retarget-escape-');
  const runId = 'b8-1-retarget-race';
  try {
    const dryRun = await runPreflight({ dryRun: true, runId, subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: home });
    const result = await runPreflight({
      dryRun: false, materialize: true, runId, subjects: ['exact-source'], approvedPlanSha256: dryRun.summary.planSha256,
      _manifestPathOverride: manifestFile, _homeOverride: home,
      _materializationHooks: {
        _beforeMaterialize: () => fs.symlinkSync(escapeRoot, path.join(home, '.brain', 'benchmark')),
      },
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(fs.existsSync(path.join(escapeRoot, 'b8-1', 'runs', runId)), false);
  } finally { cleanup(repoDir, manifestFile, home, escapeRoot); }
});
