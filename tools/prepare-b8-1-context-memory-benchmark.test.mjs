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
  computeLogicalSourceIdentity,
  computePlanDigest,
  interpretSandboxedChildResult,
  parseSourceRootOverrideArgs,
  runPreflight,
} from './prepare-b8-1-context-memory-benchmark.mjs';
import {
  verifyPlanFile,
  findPlaceholders,
  recomputeDigest,
  KNOWN_STALE_DIGESTS as VERIFIER_STALE_DIGESTS,
} from './verify-b8-1-plan-digest.mjs';

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

test('T24: subjects, manifest, schemas, binary, profile change digest; runContext is excluded', () => {
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
  ];
  for (const mutated of mutations) {
    assert.notEqual(computePlanDigest(mutated), baselineDigest, `mutation must change digest`);
  }

  // v3: plannedWritePaths and runDirectoryPhysical are in runContext which is excluded from digest
  // — same plan with different run-local paths must produce the SAME digest
  const withDifferentRunContext = { ...baseline, runContext: { runDirectoryPhysical: '/other/run', plannedWritePaths: ['/other/a', '/other/b'] } };
  assert.equal(computePlanDigest(withDifferentRunContext), baselineDigest, 'runContext must not affect digest');
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
    // v3: plannedWritePaths and runDirectoryPhysical live under runContext
    const { plannedWritePaths: rwp } = runPlan.runContext ?? {};
    assert.ok(rwp, 'runContext.plannedWritePaths must be present');
    assert.ok(rwp.every(plannedPath => path.isAbsolute(plannedPath)));
    assert.ok(rwp.includes(materialized.runDir));
    assert.ok(rwp.includes(path.join(home, '.brain')));
    assert.ok(rwp.includes(path.join(home, '.brain', 'benchmark')));
    assert.equal(rwp.some(plannedPath => plannedPath.endsWith('.tmp')), false);
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
    // v3: plannedWritePaths live under runContext
    assert.ok(runPlan.runContext?.plannedWritePaths?.includes(path.join(home, '.brain')));
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

test('T44: source-root override repository IDs must exactly match the manifest', async () => {
  const repoDir = makeTempDir('b81-override-id-repo-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-id-mismatch',
      subjects: ['exact-source'],
      sourceRootOverrides: { other: repoDir },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.equal(result.summary.planSha256, null);
    assert.match(result.checks.find(check => check.name === 'source-root-overrides')?.detail ?? '', /missing=\[test\].*unknown=\[other\]/);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T45: dirty source-root override fails closed', async () => {
  const repoDir = makeTempDir('b81-override-dirty-source-');
  const commit = makeTempGitRepo(repoDir);
  const overrideDir = makeTempDir('b81-override-dirty-root-');
  execFileSync('git', ['clone', '-q', '--no-local', repoDir, overrideDir]);
  fs.writeFileSync(path.join(overrideDir, 'dirty.txt'), 'untracked');
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-dirty',
      subjects: ['exact-source'],
      sourceRootOverrides: { test: overrideDir },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.match(result.checks.find(check => check.name === 'source-root-overrides')?.detail ?? '', /root is dirty/);
  } finally { cleanup(repoDir, overrideDir, manifestFile, home); }
});

test('T46: source-root override at the wrong commit fails closed', async () => {
  const repoDir = makeTempDir('b81-override-wrong-source-');
  const commit = makeTempGitRepo(repoDir);
  const overrideDir = makeTempDir('b81-override-wrong-root-');
  execFileSync('git', ['clone', '-q', '--no-local', repoDir, overrideDir]);
  fs.writeFileSync(path.join(overrideDir, 'later.txt'), 'later');
  execFileSync('git', ['add', 'later.txt'], { cwd: overrideDir });
  execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'later'], { cwd: overrideDir });
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-wrong-commit',
      subjects: ['exact-source'],
      sourceRootOverrides: { test: overrideDir },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.match(result.checks.find(check => check.name === 'source-root-overrides')?.detail ?? '', /does not equal pinned commit/);
  } finally { cleanup(repoDir, overrideDir, manifestFile, home); }
});

test('T47: source-root override containing traversal fails closed', async () => {
  const repoDir = makeTempDir('b81-override-traversal-source-');
  const commit = makeTempGitRepo(repoDir);
  const traversingRoot = `${repoDir}/../${path.basename(repoDir)}`;
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-traversal',
      subjects: ['exact-source'],
      sourceRootOverrides: { test: traversingRoot },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.match(result.checks.find(check => check.name === 'source-root-overrides')?.detail ?? '', /path traversal/);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T48: missing source-root override fails closed', async () => {
  const repoDir = makeTempDir('b81-override-missing-source-');
  const commit = makeTempGitRepo(repoDir);
  const missingRoot = path.join(os.tmpdir(), `b81-missing-${crypto.randomBytes(4).toString('hex')}`);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-missing',
      subjects: ['exact-source'],
      sourceRootOverrides: { test: missingRoot },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false);
    assert.match(result.checks.find(check => check.name === 'source-root-overrides')?.detail ?? '', /root not found/);
  } finally { cleanup(repoDir, manifestFile, home); }
});

test('T49: same commit at two different clean source-root paths produces the same digest (path-independent)', async () => {
  // Defect 3 fix: source-root-overrides check detail must use only logical identity
  // (repositoryId@pinnedCommit), not physical paths. Same content = same digest.
  const repoDir = makeTempDir('b81-override-success-source-');
  const commit = makeTempGitRepo(repoDir);
  const firstOverride = makeTempDir('b81-override-success-a-');
  const secondOverride = makeTempDir('b81-override-success-b-');
  execFileSync('git', ['clone', '-q', '--no-local', repoDir, firstOverride]);
  execFileSync('git', ['clone', '-q', '--no-local', repoDir, secondOverride]);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const first = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-success',
      subjects: ['exact-source'],
      sourceRootOverrides: { test: firstOverride },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    const second = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-success',
      subjects: ['exact-source'],
      sourceRootOverrides: { test: secondOverride },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(first.summary.executionReady, true);
    assert.equal(second.summary.executionReady, true);
    assert.equal(first.checks.find(check => check.name === 'source-root-overrides')?.status, 'pass');
    // Path-independence guarantee: same commit at different physical paths = same digest
    assert.equal(first.summary.planSha256, second.summary.planSha256,
      'digest must be identical for same commit at different physical paths (path-independent)');
    // The check detail must not contain physical path segments
    const detail = first.checks.find(c => c.name === 'source-root-overrides')?.detail ?? '';
    assert.ok(!detail.includes(firstOverride), 'check detail must not contain absolute physical path');
  } finally { cleanup(repoDir, firstOverride, secondOverride, manifestFile, home); }
});

test('T50: source-root CLI parser rejects duplicate and malformed mappings', () => {
  assert.match(
    parseSourceRootOverrideArgs(['--source-root', 'test=/tmp/a', '--source-root=test=/tmp/b']).error ?? '',
    /duplicate/,
  );
  assert.match(parseSourceRootOverrideArgs(['--source-root=missing-separator']).error ?? '', /expected repositoryId=/);
});

test('T51: an approved dry-run plan materializes with the same exact source-root override', async () => {
  const repoDir = makeTempDir('b81-override-lifecycle-source-');
  const commit = makeTempGitRepo(repoDir);
  const overrideDir = makeTempDir('b81-override-lifecycle-root-');
  execFileSync('git', ['clone', '-q', '--no-local', repoDir, overrideDir]);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  try {
    const planned = await runPreflight({
      dryRun: true,
      runId: 'b8-1-override-lifecycle',
      subjects: ['exact-source'],
      sourceRootOverrides: { test: overrideDir },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(planned.summary.executionReady, true);
    assert.match(planned.summary.planSha256 ?? '', /^[a-f0-9]{64}$/);

    const materialized = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-override-lifecycle',
      subjects: ['exact-source'],
      approvedPlanSha256: planned.summary.planSha256,
      sourceRootOverrides: { test: overrideDir },
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(materialized.summary.executionReady, true);
    assert.equal(materialized.summary.materialized, true);
    assert.equal(execFileSync('git', ['-C', overrideDir, 'status', '--porcelain'], { encoding: 'utf8' }), '');
  } finally { cleanup(repoDir, overrideDir, manifestFile, home); }
});

// ---------------------------------------------------------------------------
// Test 52: digest is stable when source root path changes but commit/tree are identical
// ---------------------------------------------------------------------------

test('T52: digest is stable when source root path changes but commit/tree are identical', async () => {
  const repoA = makeTempDir('b81-t52-a-');
  const repoB = makeTempDir('b81-t52-b-');
  const homeA = makeSyntheticHome();
  const homeB = makeSyntheticHome();
  let manifestFileA = null;
  let manifestFileB = null;
  try {
    // Create repo A and get its commit
    const commit = makeTempGitRepo(repoA, { 'README.md': '# T52 test repo' });

    // Create a worktree of the same commit at path B using git worktree
    execFileSync('git', ['worktree', 'add', '--detach', repoB, commit], { cwd: repoA });

    // Build two manifests pointing to the same commit but at different paths
    const manifestA = makeMinimalManifest([{ id: 'test', path: repoA, commit, files: { 'README.md': '' } }]);
    const manifestB = makeMinimalManifest([{ id: 'test', path: repoB, commit, files: { 'README.md': '' } }]);
    manifestFileA = writeTempManifest(manifestA);
    manifestFileB = writeTempManifest(manifestB);

    const resultA = await runPreflight({
      dryRun: true,
      runId: 'b8-1-t52-a',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFileA,
      _homeOverride: homeA,
    });
    const resultB = await runPreflight({
      dryRun: true,
      runId: 'b8-1-t52-b',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFileB,
      _homeOverride: homeB,
    });

    // Both should be execution-ready
    assert.equal(resultA.summary.executionReady, true, 'run A must be executionReady');
    assert.equal(resultB.summary.executionReady, true, 'run B must be executionReady');

    // sourceLogicalIdentity must be equal (path-independent)
    assert.deepEqual(
      resultA.canonicalPlan.sourceLogicalIdentity,
      resultB.canonicalPlan.sourceLogicalIdentity,
      'sourceLogicalIdentity must be equal regardless of path'
    );

    // The sourceStateHash must be equal (both use logical identity)
    assert.equal(
      resultA.canonicalPlan.sourceStateHash,
      resultB.canonicalPlan.sourceStateHash,
      'sourceStateHash must be equal regardless of source root path'
    );
  } finally {
    // Remove worktree before cleaning up the main repo
    try { execFileSync('git', ['worktree', 'remove', '--force', repoB], { cwd: repoA }); } catch {}
    cleanup(repoA, repoB, homeA, homeB);
    if (manifestFileA) cleanup(manifestFileA);
    if (manifestFileB) cleanup(manifestFileB);
  }
});

// ---------------------------------------------------------------------------
// Test 53: dirty source root fails source-state binding
// ---------------------------------------------------------------------------

test('T53: dirty source root fails source-state binding', async () => {
  const repoDir = makeTempDir('b81-t53-');
  const home = makeSyntheticHome();
  let manifestFile = null;
  try {
    const commit = makeTempGitRepo(repoDir, { 'README.md': '# T53' });
    // Dirty the repo
    fs.writeFileSync(path.join(repoDir, 'dirty.txt'), 'unstaged change');
    const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'README.md': '' } }]);
    manifestFile = writeTempManifest(manifest);
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-t53',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false, 'dirty repo must block execution');
    const bindingCheck = result.checks.find(c => c.name === 'source-state-binding');
    assert.ok(bindingCheck, 'source-state-binding check must exist');
    assert.equal(bindingCheck.status, 'fail', 'source-state-binding must fail for dirty repo');
  } finally { cleanup(repoDir, home); if (manifestFile) cleanup(manifestFile); }
});

// ---------------------------------------------------------------------------
// Test 54: wrong commit in source root fails source-state binding
// ---------------------------------------------------------------------------

test('T54: wrong commit in source root fails source-state binding', async () => {
  const repoDir = makeTempDir('b81-t54-');
  const home = makeSyntheticHome();
  let manifestFile = null;
  try {
    const firstCommit = makeTempGitRepo(repoDir, { 'README.md': '# T54 first' });
    // Make a second commit to advance HEAD
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# T54 second');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'second'], { cwd: repoDir });
    // pinnedCommit is the first commit, but HEAD is the second
    const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit: firstCommit, files: { 'README.md': '' } }]);
    manifestFile = writeTempManifest(manifest);
    const result = await runPreflight({
      dryRun: true,
      runId: 'b8-1-t54',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(result.summary.executionReady, false, 'wrong commit must block execution');
    const bindingCheck = result.checks.find(c => c.name === 'source-state-binding');
    assert.ok(bindingCheck, 'source-state-binding check must exist');
    assert.equal(bindingCheck.status, 'fail', 'source-state-binding must fail when HEAD != pinnedCommit');
  } finally { cleanup(repoDir, home); if (manifestFile) cleanup(manifestFile); }
});

// ---------------------------------------------------------------------------
// Test 55: changed tree bytes (different commit at same path) change digest
// ---------------------------------------------------------------------------

test('T55: changed tree bytes (different commit at same path) change digest', async () => {
  const repoDir = makeTempDir('b81-t55-');
  const homeA = makeSyntheticHome();
  const homeB = makeSyntheticHome();
  let manifestFileA = null;
  let manifestFileB = null;
  try {
    // First commit
    const commitA = makeTempGitRepo(repoDir, { 'README.md': '# T55 version A' });
    const manifestA = makeMinimalManifest([{ id: 'test', path: repoDir, commit: commitA, files: { 'README.md': '' } }]);
    manifestFileA = writeTempManifest(manifestA);
    const resultA = await runPreflight({
      dryRun: true,
      runId: 'b8-1-t55-a',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFileA,
      _homeOverride: homeA,
    });
    assert.equal(resultA.summary.executionReady, true, 'run A must be executionReady');

    // Second commit with different content at the same path
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# T55 version B');
    execFileSync('git', ['add', '.'], { cwd: repoDir });
    execFileSync('git', ['-c', 'user.name=T', '-c', 'user.email=t@t.invalid', 'commit', '-qm', 'version B'], { cwd: repoDir });
    const commitB = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoDir, encoding: 'utf8' }).trim();

    const manifestB = makeMinimalManifest([{ id: 'test', path: repoDir, commit: commitB, files: { 'README.md': '' } }]);
    manifestFileB = writeTempManifest(manifestB);
    const resultB = await runPreflight({
      dryRun: true,
      runId: 'b8-1-t55-b',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFileB,
      _homeOverride: homeB,
    });
    assert.equal(resultB.summary.executionReady, true, 'run B must be executionReady');

    // Different commits = different tree bytes = different digest
    assert.notEqual(
      resultA.canonicalPlan.sourceStateHash,
      resultB.canonicalPlan.sourceStateHash,
      'different tree bytes must produce different sourceStateHash'
    );
    assert.notEqual(
      resultA.canonicalPlan.sourceLogicalIdentity.repositories[0].exportedTreeSha256,
      resultB.canonicalPlan.sourceLogicalIdentity.repositories[0].exportedTreeSha256,
      'different commits must produce different exportedTreeSha256'
    );
  } finally {
    cleanup(repoDir, homeA, homeB);
    if (manifestFileA) cleanup(manifestFileA);
    if (manifestFileB) cleanup(manifestFileB);
  }
});

// ---------------------------------------------------------------------------
// Test 56: stale approval (old digest) is rejected at materialization
// ---------------------------------------------------------------------------

test('T56: stale approval (old digest) is rejected at materialization', async () => {
  const repoDir = makeTempDir('b81-t56-');
  const home = makeSyntheticHome();
  let manifestFile = null;
  try {
    const commit = makeTempGitRepo(repoDir, { 'README.md': '# T56' });
    const manifest = makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'README.md': '' } }]);
    manifestFile = writeTempManifest(manifest);

    // Get valid digest from dry-run
    const dryRun = await runPreflight({
      dryRun: true,
      runId: 'b8-1-t56',
      subjects: ['exact-source'],
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(dryRun.summary.executionReady, true, 'dry-run must be executionReady');
    const oldDigest = dryRun.summary.planSha256;

    // Now make the repo dirty (stale approval)
    fs.writeFileSync(path.join(repoDir, 'new-file.txt'), 'makes repo dirty');

    // Try to materialize with the old (now stale) digest
    const materialized = await runPreflight({
      dryRun: false,
      materialize: true,
      runId: 'b8-1-t56',
      subjects: ['exact-source'],
      approvedPlanSha256: oldDigest,
      _manifestPathOverride: manifestFile,
      _homeOverride: home,
    });
    assert.equal(materialized.summary.executionReady, false, 'stale approval must be rejected');
    assert.ok(materialized.summary.blockingChecks.length > 0, 'must have blocking checks');
  } finally { cleanup(repoDir, home); if (manifestFile) cleanup(manifestFile); }
});

// ---------------------------------------------------------------------------
// Test 57: changed subject selection changes digest
// ---------------------------------------------------------------------------

test('T57: changed subject selection changes digest', () => {
  const planA = makeCanonicalPlanFixture({ selectedSubjects: ['cbm', 'exact-source'] });
  const planB = makeCanonicalPlanFixture({ selectedSubjects: ['exact-source'] });
  assert.notEqual(
    computePlanDigest(planA),
    computePlanDigest(planB),
    'different subject selection must produce different plan digest'
  );
});

// ---------------------------------------------------------------------------
// Test 58: changed binary sha256 changes digest
// ---------------------------------------------------------------------------

test('T58: changed binary sha256 changes digest', () => {
  const planA = makeCanonicalPlanFixture({
    cbmIdentity: {
      stablePath: '/synthetic/.local/bin/codebase-memory-mcp',
      resolvedPath: '/synthetic/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp',
      version: 'v0.9.0',
      sha256: '5'.repeat(64),
    },
  });
  const planB = makeCanonicalPlanFixture({
    cbmIdentity: {
      stablePath: '/synthetic/.local/bin/codebase-memory-mcp',
      resolvedPath: '/synthetic/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp',
      version: 'v0.9.0',
      sha256: 'e'.repeat(64),  // different sha256
    },
  });
  assert.notEqual(
    computePlanDigest(planA),
    computePlanDigest(planB),
    'different binary sha256 must produce different plan digest'
  );
});

// ---------------------------------------------------------------------------
// Test 59: changed network profile sha256 changes digest
// ---------------------------------------------------------------------------

test('T59: changed network profile sha256 changes digest', () => {
  const planA = makeCanonicalPlanFixture({
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
  });
  const planB = makeCanonicalPlanFixture({
    networkProof: {
      required: true,
      status: 'passed',
      adapterIdentity: { path: '/usr/bin/sandbox-exec', sha256: '6'.repeat(64) },
      runtimeIdentity: { path: '/synthetic/node', sha256: 'b'.repeat(64), version: 'v24.0.0' },
      childIdentity: { path: '/synthetic/b8-1-network-isolation-child.mjs', sha256: 'c'.repeat(64) },
      profilePath: '/synthetic/b8-1-network-deny.sb',
      profileSha256: 'f'.repeat(64),  // different profile sha256
      controlSucceeded: true,
      sandboxedChildStarted: true,
      sandboxedConnectionDenied: true,
      selfTestPassed: true,
      selfTestDetail: 'permission denial proven',
    },
  });
  assert.notEqual(
    computePlanDigest(planA),
    computePlanDigest(planB),
    'different network profile sha256 must produce different plan digest'
  );
});

// ---------------------------------------------------------------------------
// v5 contract tests (T60–T64)
// ---------------------------------------------------------------------------

test('T60: canonical plan has planVersion 5.1.0', () => {
  const plan = makeCanonicalPlanFixture();
  assert.equal(plan.planVersion, '5.1.0', 'planVersion must be 5.1.0 (v5s)');
});

test('T61: known stale v1/v2 digests are rejected at materialization', async () => {
  const repoDir = makeTempDir('b81-t61-');
  const commit = makeTempGitRepo(repoDir);
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit }]));
  const home = makeSyntheticHome();
  const STALE_V2_DIGEST = '1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda';
  const STALE_V1_DIGEST = 'dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4';
  try {
    for (const staleDigest of [STALE_V2_DIGEST, STALE_V1_DIGEST]) {
      const result = await runPreflight({
        dryRun: false,
        materialize: true,
        runId: 'b8-1-t61',
        subjects: ['exact-source'],
        approvedPlanSha256: staleDigest,
        _manifestPathOverride: manifestFile,
        _homeOverride: home,
      });
      const approvalCheck = result.checks.find(c => c.name === 'plan-approval');
      assert.ok(approvalCheck, 'plan-approval check must exist');
      assert.equal(approvalCheck.status, 'fail', `stale digest ${staleDigest.slice(0, 8)}... must be rejected`);
      assert.match(approvalCheck.detail, /stale.*digest|stale.*approval/i, 'must mention stale digest');
    }
  } finally {
    cleanup(repoDir, manifestFile, home);
  }
});

test('T62: runContext is excluded from digest (path-independent)', () => {
  const planA = makeCanonicalPlanFixture();
  const planB = { ...planA, runContext: { runDirectoryPhysical: '/totally/different/path', plannedWritePaths: ['/other/a'] } };
  assert.equal(
    computePlanDigest(planA),
    computePlanDigest(planB),
    'runContext must not affect digest'
  );
});

test('T63: repo-relative artifact paths are included in digest', () => {
  const planA = makeCanonicalPlanFixture();
  // Changing manifestRepoRelPath must change the digest
  const planB = { ...planA, manifestRepoRelPath: 'operations/specs/different-manifest.json' };
  assert.notEqual(
    computePlanDigest(planA),
    computePlanDigest(planB),
    'manifestRepoRelPath must be included in digest'
  );
});

test('T64: shell-free tree hashing produces consistent exportedTreeSha256', async () => {
  const repoDir = makeTempDir('b81-t64-');
  const commit = makeTempGitRepo(repoDir, { 'README.md': '# T64 tree hashing' });
  const manifestFile = writeTempManifest(makeMinimalManifest([{ id: 'test', path: repoDir, commit, files: { 'README.md': '' } }]));
  const homeA = makeSyntheticHome();
  const homeB = makeSyntheticHome();
  try {
    const resultA = await runPreflight({ dryRun: true, runId: 'b8-1-t64-a', subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: homeA });
    const resultB = await runPreflight({ dryRun: true, runId: 'b8-1-t64-b', subjects: ['exact-source'], _manifestPathOverride: manifestFile, _homeOverride: homeB });
    // Both runs must produce the same exportedTreeSha256 (same repo, same commit)
    const shaA = resultA.canonicalPlan?.sourceLogicalIdentity?.repositories?.[0]?.exportedTreeSha256;
    const shaB = resultB.canonicalPlan?.sourceLogicalIdentity?.repositories?.[0]?.exportedTreeSha256;
    assert.ok(shaA, 'exportedTreeSha256 must be computed');
    assert.match(shaA, /^[a-f0-9]{64}$/, 'must be a 64-char hex hash');
    assert.equal(shaA, shaB, 'same commit must produce same exportedTreeSha256');
    // sourceLogicalIdentity (which feeds into sourceStateHash and plan digest) must be identical
    assert.deepEqual(
      resultA.canonicalPlan?.sourceLogicalIdentity,
      resultB.canonicalPlan?.sourceLogicalIdentity,
      'same repo+commit must produce identical sourceLogicalIdentity'
    );
  } finally {
    cleanup(repoDir, manifestFile, homeA, homeB);
  }
});

// ---------------------------------------------------------------------------
// Plan integrity tests (T65–T68) — independent verifier + write-plan
// ---------------------------------------------------------------------------

test('T65: verifier rejects BOUND_AT_PREFLIGHT placeholders', () => {
  const planWithPlaceholders = {
    planVersion: '5.0.0',
    planSha256: 'a'.repeat(64),
    runId: 'b8-1-test',
    networkIsolationProof: 'BOUND_AT_PREFLIGHT',
    checks: 'BOUND_AT_PREFLIGHT',
  };
  const placeholders = findPlaceholders(planWithPlaceholders);
  assert.ok(placeholders.length > 0, 'must detect BOUND_AT_PREFLIGHT placeholders');
  assert.ok(placeholders.some(p => p.includes('networkIsolationProof')));
  assert.ok(placeholders.some(p => p.includes('checks')));
});

test('T66: verifier rejects annotation fields (_xxx)', () => {
  const { annotationFields } = recomputeDigest({
    planVersion: '5.0.0',
    runId: 'b8-1-test',
    _planSha256Note: 'this is a template annotation',
    _staleDigests: {},
  });
  assert.ok(annotationFields.includes('_planSha256Note'));
  assert.ok(annotationFields.includes('_staleDigests'));
});

test('T67: verifier rejects d9c524... (known stale v5 digest)', () => {
  const stale = 'd9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42';
  assert.ok(VERIFIER_STALE_DIGESTS.has(stale), 'v5 stale digest must be in verifier stale set');
  // Write a synthetic plan file with the stale digest and verify it fails
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b81-t67-'));
  const planPath = path.join(tmpDir, 'plan.json');
  try {
    fs.writeFileSync(planPath, JSON.stringify({ planVersion: '5.0.0', planSha256: stale, runId: 'b8-1-t67' }));
    const { ok, errors } = verifyPlanFile(planPath);
    assert.equal(ok, false);
    assert.ok(errors.some(e => e.includes('stale')), `expected stale-digest error, got: ${errors.join('; ')}`);
  } finally {
    cleanup(tmpDir);
  }
});

test('T68: verifier accepts a valid emitted plan and rejects tampered digest', () => {
  // Build a minimal valid emitted plan (no annotations, no placeholders)
  const plan = makeCanonicalPlanFixture({ selectedSubjects: ['exact-source'] });
  const digest = computePlanDigest(plan);
  const emittedPlan = { ...plan, planSha256: digest };

  // Write to temp file and verify
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b81-t68-'));
  const planPath = path.join(tmpDir, 'plan.json');
  try {
    fs.writeFileSync(planPath, JSON.stringify(emittedPlan, null, 2));
    const { ok, planSha256 } = verifyPlanFile(planPath);
    assert.equal(ok, true, 'valid emitted plan must verify successfully');
    assert.equal(planSha256, digest);

    // Tamper: change a digest field and re-verify
    const tampered = { ...emittedPlan, runId: 'b8-1-tampered' };
    fs.writeFileSync(planPath, JSON.stringify(tampered, null, 2));
    const { ok: ok2, errors } = verifyPlanFile(planPath);
    assert.equal(ok2, false, 'tampered plan must fail verification');
    assert.ok(errors.some(e => e.includes('mismatch')));
  } finally {
    cleanup(tmpDir);
  }
});

// ---------------------------------------------------------------------------
// Shared digest contract tests (T69–T72) — v5s path-independence + allowlist
// ---------------------------------------------------------------------------

import {
  projectForDigest,
  findUnknownTopLevelFields,
  DIGEST_ALLOWED_TOP_LEVEL,
} from './lib/b8-1-plan-digest.mjs';

test('T69: Brain-worktree paths stripped from networkIsolationProof in digest projection', () => {
  const plan = makeCanonicalPlanFixture({
    networkProof: {
      required: true,
      status: 'passed',
      adapterIdentity: { path: '/usr/bin/sandbox-exec', sha256: '6'.repeat(64) },
      runtimeIdentity: { path: '/opt/homebrew/bin/node', sha256: 'b'.repeat(64), version: 'v25.0.0' },
      childIdentity: { path: '/Users/Office/Repos/brain-b8-1-v5s/tools/lib/b8-1-network-isolation-child.mjs', sha256: 'c'.repeat(64) },
      profilePath: '/Users/Office/Repos/brain-b8-1-v5s/operations/specs/b8-1-network-deny.sb',
      profileSha256: '7'.repeat(64),
      controlSucceeded: true,
      sandboxedChildStarted: true,
      sandboxedConnectionDenied: true,
      selfTestPassed: true,
      selfTestDetail: 'permission denial proven',
    },
  });
  const projected = projectForDigest(plan);
  const proof = projected.networkIsolationProof;
  // Brain-worktree paths must be stripped
  assert.ok(!('profilePath' in proof), 'profilePath must be stripped from digest projection');
  assert.ok(!('path' in (proof.childIdentity ?? {})), 'childIdentity.path must be stripped from digest projection');
  // SHAs must remain
  assert.equal(proof.profileSha256, '7'.repeat(64), 'profileSha256 must remain in projection');
  assert.equal(proof.childIdentity?.sha256, 'c'.repeat(64), 'childIdentity.sha256 must remain in projection');
  // External binary paths (adapter, runtime) are intentionally machine-bound — must remain
  assert.equal(proof.adapterIdentity?.path, '/usr/bin/sandbox-exec', 'adapter path must remain (intentionally machine-bound)');
  assert.equal(proof.runtimeIdentity?.path, '/opt/homebrew/bin/node', 'runtime path must remain (intentionally machine-bound)');
});

test('T70: Brain-worktree paths stripped from graphifyStatus in digest projection', () => {
  const plan = makeCanonicalPlanFixture({
    graphifyStatus: {
      status: 'excluded-subject',
      reason: 'graphify not selected',
      profilePath: '/Users/Office/Repos/brain-b8-1-v5s/operations/specs/graphify-operational-profiles.json',
      profileSha256: '8'.repeat(64),
      governancePath: '/Users/Office/Repos/brain-b8-1-v5s/operations/specs/graphify-transition-governance.json',
      governanceSha256: '9'.repeat(64),
    },
  });
  const projected = projectForDigest(plan);
  const gs = projected.graphifyStatus;
  assert.ok(!('profilePath' in gs), 'graphifyStatus.profilePath must be stripped');
  assert.ok(!('governancePath' in gs), 'graphifyStatus.governancePath must be stripped');
  assert.equal(gs.profileSha256, '8'.repeat(64), 'graphifyStatus.profileSha256 must remain');
  assert.equal(gs.governanceSha256, '9'.repeat(64), 'graphifyStatus.governanceSha256 must remain');
});

test('T71: same Brain commit from two different worktree paths produces identical digest', () => {
  // Same content at different worktree paths — must produce identical digest
  const sharedSha256 = 'c'.repeat(64);
  const planA = makeCanonicalPlanFixture({
    networkProof: {
      required: true,
      status: 'passed',
      adapterIdentity: { path: '/usr/bin/sandbox-exec', sha256: '6'.repeat(64) },
      runtimeIdentity: { path: '/opt/homebrew/bin/node', sha256: 'b'.repeat(64), version: 'v25.0.0' },
      childIdentity: { path: '/worktree-A/tools/lib/b8-1-network-isolation-child.mjs', sha256: sharedSha256 },
      profilePath: '/worktree-A/operations/specs/b8-1-network-deny.sb',
      profileSha256: '7'.repeat(64),
      controlSucceeded: true, sandboxedChildStarted: true, sandboxedConnectionDenied: true,
      selfTestPassed: true, selfTestDetail: 'ok',
    },
  });
  const planB = makeCanonicalPlanFixture({
    networkProof: {
      required: true,
      status: 'passed',
      adapterIdentity: { path: '/usr/bin/sandbox-exec', sha256: '6'.repeat(64) },
      runtimeIdentity: { path: '/opt/homebrew/bin/node', sha256: 'b'.repeat(64), version: 'v25.0.0' },
      childIdentity: { path: '/worktree-B/tools/lib/b8-1-network-isolation-child.mjs', sha256: sharedSha256 },
      profilePath: '/worktree-B/operations/specs/b8-1-network-deny.sb',
      profileSha256: '7'.repeat(64),
      controlSucceeded: true, sandboxedChildStarted: true, sandboxedConnectionDenied: true,
      selfTestPassed: true, selfTestDetail: 'ok',
    },
  });
  assert.equal(computePlanDigest(planA), computePlanDigest(planB),
    'different worktree paths with same content SHAs must produce identical digest');
});

test('T72: unknown top-level fields are detected by verifier allowlist', () => {
  const plan = makeCanonicalPlanFixture();
  // Add an unknown field
  const withUnknown = { ...plan, _unknownField: 'some value', actuallyUnknownKey: 'bad' };
  const unknownFields = findUnknownTopLevelFields(withUnknown);
  assert.ok(unknownFields.includes('actuallyUnknownKey'), 'must detect unknown field not in allowlist');
  // Annotation fields are not reported by findUnknownTopLevelFields (they are detected separately)
  assert.ok(!unknownFields.includes('_unknownField'), '_annotation fields are handled separately');
  // All fields in a clean fixture must be known
  const cleanUnknown = findUnknownTopLevelFields(plan);
  assert.equal(cleanUnknown.length, 0, 'clean fixture must have no unknown fields');
});
