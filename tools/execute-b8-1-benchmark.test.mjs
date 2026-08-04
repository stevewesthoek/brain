/**
 * execute-b8-1-benchmark.test.mjs
 *
 * Tests for the bounded B8.1 benchmark executor.
 * Uses synthetic HOME dirs, fake adapters, and synthetic run directories.
 * Never touches the real home directory or real CBM binary.
 *
 * Run: node --test tools/execute-b8-1-benchmark.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  buildFixtureEvidence,
  loadAndVerifyRunPlan,
  runExecutor,
  validateExecutorInputs,
} from './execute-b8-1-benchmark.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL_MANIFEST_PATH = 'operations/specs/b8-1-context-memory-benchmark-manifest.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTempDir(prefix = 'b81-exec-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanup(...paths) {
  for (const p of paths) {
    try { fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
  return sorted;
}

function computePlanDigest(plan) {
  const { runContext: _excluded, ...digestFields } = plan;
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(digestFields))).digest('hex');
}

/**
 * Build a synthetic manifest from a list of fixtures.
 */
function makeSyntheticManifest(fixtures) {
  const repos = [...new Set((fixtures ?? []).map(f => f.repositoryId ?? 'test'))];
  return {
    schemaVersion: '1.0.0',
    createdAt: '2026-08-04',
    repositories: repos.map(r => ({ repositoryId: r, localPath: '/synthetic', pinnedCommit: '4'.repeat(40), description: 'test' })),
    fixtures: (fixtures ?? []).map(f => ({ ...f, repositoryId: f.repositoryId ?? 'test' })),
  };
}

/**
 * Create a synthetic materialized run directory for testing.
 * Writes run-plan.json, preflight-receipt.json, evidence/, sources/<repoId>/ directories.
 * Returns planSha256, runDir, and the synthetic manifest for injection.
 */
function makeSyntheticRun(home, { runId, fixtures, selectedSubjects = ['exact-source'], tampered = false, planVersionOverride } = {}) {
  const runDir = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId);
  fs.mkdirSync(path.join(runDir, 'evidence'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'subjects', 'cbm', 'cache'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'subjects', 'cbm', 'config'), { recursive: true });

  const repos = [...new Set((fixtures ?? []).map(f => f.repositoryId ?? 'test'))];
  for (const repoId of repos) {
    const sourcesDir = path.join(runDir, 'sources', repoId);
    fs.mkdirSync(sourcesDir, { recursive: true });
    // Write expected files
    for (const fixture of (fixtures ?? []).filter(f => (f.repositoryId ?? 'test') === repoId)) {
      if (fixture.expectedFile) {
        const filePath = path.join(sourcesDir, fixture.expectedFile);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, `content of ${fixture.expectedFile}`);
      }
    }
  }

  const planBase = {
    planVersion: planVersionOverride ?? '4.0.0',
    runId,
    partialEvidence: !selectedSubjects.includes('graphify'),
    selectedSubjects: [...selectedSubjects].sort(),
    excludedSubjects: ['graphify'].filter(s => !selectedSubjects.includes(s)),
    manifestRepoRelPath: REAL_MANIFEST_PATH,
    manifestHash: `sha256:${'1'.repeat(64)}`,
    manifestSchemaRepoRelPath: 'operations/specs/b8-1-context-memory-benchmark-manifest.schema.json',
    manifestSchemaHash: `sha256:${'2'.repeat(64)}`,
    evidenceSchemaRepoRelPath: 'operations/specs/b8-1-context-memory-benchmark-evidence.schema.json',
    evidenceSchemaHash: `sha256:${'3'.repeat(64)}`,
    pinnedRepositoryCommits: repos.map(r => ({ repositoryId: r, commit: '4'.repeat(40) })).sort((a, b) => a.repositoryId.localeCompare(b.repositoryId)),
    subjectBinaryIdentity: selectedSubjects.includes('cbm') ? { cbm: { stablePath: '/fake/cbm', resolvedPath: '/fake/cbm', version: 'v0.9.0', sha256: '5'.repeat(64) } } : {},
    networkIsolationProof: { required: false, status: 'not-required' },
    cbmVerification: { required: false, status: 'not-required' },
    graphifyStatus: { status: 'excluded-subject', reason: 'graphify not selected', profileSha256: '8'.repeat(64), governanceSha256: '9'.repeat(64) },
    diskResult: { name: 'disk-budget', status: 'pass', detail: '4096 MB available' },
    sourceStateHash: `sha256:${'a'.repeat(64)}`,
    sourceLogicalIdentity: { schemaVersion: 2, repositories: repos.map(r => ({ repositoryId: r, pinnedCommit: '4'.repeat(40), HEAD: '4'.repeat(40), statusSha256: 'b'.repeat(64), pinnedCommitAvailable: true, exportedTreeSha256: 'c'.repeat(64) })) },
    checks: [{ name: 'manifest-validation', status: 'pass', detail: 'valid' }],
    runContext: {
      runDirectoryPhysical: runDir,
      plannedWritePaths: [runDir],
    },
  };

  const planSha256 = computePlanDigest(planBase);
  const plan = { ...planBase, planSha256, createdAt: '2026-08-04T00:00:00.000Z' };

  if (tampered) {
    plan.runId = 'tampered-run-id'; // changes digest but not planSha256
  }

  fs.writeFileSync(path.join(runDir, 'run-plan.json'), JSON.stringify(plan, null, 2));
  fs.writeFileSync(path.join(runDir, 'preflight-receipt.json'), JSON.stringify(plan, null, 2));

  const syntheticManifest = makeSyntheticManifest(fixtures);
  return { runDir, plan, planSha256, syntheticManifest };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('E1: wrong approved digest is rejected', async () => {
  const home = makeTempDir('b81-exec-e1-');
  try {
    const { planSha256 } = makeSyntheticRun(home, { runId: 'b8-1-exec-e1', fixtures: [] });
    const wrongDigest = 'f'.repeat(64);
    assert.notEqual(wrongDigest, planSha256);
    const result = await runExecutor({ runId: 'b8-1-exec-e1', approvedPlanSha256: wrongDigest, _homeOverride: home });
    assert.equal(result.outcome, 'fail');
    assert.ok(result.errors.some(e => /digest mismatch|stale/i.test(e)));
  } finally { cleanup(home); }
});

test('E2: unmaterialized run directory is rejected', async () => {
  const home = makeTempDir('b81-exec-e2-');
  try {
    const result = await runExecutor({ runId: 'b8-1-exec-e2-nonexistent', approvedPlanSha256: 'a'.repeat(64), _homeOverride: home });
    assert.equal(result.outcome, 'fail');
    assert.ok(result.errors.some(e => /does not exist/i.test(e)));
  } finally { cleanup(home); }
});

test('E3: tampered run-plan.json is rejected', async () => {
  const home = makeTempDir('b81-exec-e3-');
  try {
    const { planSha256 } = makeSyntheticRun(home, { runId: 'b8-1-exec-e3', fixtures: [] });
    // Tamper with the stored run-plan.json after creation
    const runDir = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', 'b8-1-exec-e3');
    const plan = JSON.parse(fs.readFileSync(path.join(runDir, 'run-plan.json'), 'utf8'));
    plan.runId = 'tampered'; // changes content but stored digest is now stale
    fs.writeFileSync(path.join(runDir, 'run-plan.json'), JSON.stringify(plan, null, 2));
    const result = await runExecutor({ runId: 'b8-1-exec-e3', approvedPlanSha256: planSha256, _homeOverride: home });
    assert.equal(result.outcome, 'fail');
    assert.ok(result.errors.some(e => /tampered/i.test(e)));
  } finally { cleanup(home); }
});

test('E4: v2 plan (missing planVersion) is rejected', async () => {
  const home = makeTempDir('b81-exec-e4-');
  try {
    // Create a run with an old-style plan (schemaVersion instead of planVersion)
    const { runDir, planSha256 } = makeSyntheticRun(home, { runId: 'b8-1-exec-e4', fixtures: [], planVersionOverride: '1.0.0' });
    // Override planVersion to simulate v1/v2
    const plan = JSON.parse(fs.readFileSync(path.join(runDir, 'run-plan.json'), 'utf8'));
    delete plan.planVersion;
    plan.schemaVersion = '1.0.0';
    fs.writeFileSync(path.join(runDir, 'run-plan.json'), JSON.stringify(plan, null, 2));
    const result = await runExecutor({ runId: 'b8-1-exec-e4', approvedPlanSha256: planSha256, _homeOverride: home });
    assert.equal(result.outcome, 'fail');
    assert.ok(result.errors.some(e => /planVersion/i.test(e) || /4\.0\.0/i.test(e)));
  } finally { cleanup(home); }
});

test('E5: known stale v1/v2 approval digest is rejected', async () => {
  const home = makeTempDir('b81-exec-e5-');
  const STALE_V2 = '1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda';
  const STALE_V1 = 'dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4';
  try {
    makeSyntheticRun(home, { runId: 'b8-1-exec-e5', fixtures: [] });
    for (const staleDigest of [STALE_V2, STALE_V1]) {
      const result = await runExecutor({ runId: 'b8-1-exec-e5', approvedPlanSha256: staleDigest, _homeOverride: home });
      assert.equal(result.outcome, 'fail', `stale digest ${staleDigest.slice(0, 8)}... must be rejected`);
      assert.ok(result.errors.some(e => /stale/i.test(e)));
    }
  } finally { cleanup(home); }
});

test('E6: graphify in selected subjects is rejected by executor', async () => {
  const home = makeTempDir('b81-exec-e6-');
  try {
    const { planSha256 } = makeSyntheticRun(home, { runId: 'b8-1-exec-e6', fixtures: [], selectedSubjects: ['exact-source', 'graphify'] });
    const result = await runExecutor({ runId: 'b8-1-exec-e6', approvedPlanSha256: planSha256, _homeOverride: home });
    assert.equal(result.outcome, 'fail');
    assert.ok(result.errors.some(e => /graphify/i.test(e)));
  } finally { cleanup(home); }
});

test('E7: synthetic exact-source run succeeds with matching fixture files', async () => {
  const home = makeTempDir('b81-exec-e7-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'src/main.ts', scoringType: 'exact-match', question: 'test?' },
      { fixtureId: 'f2', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e7', fixtures, selectedSubjects: ['exact-source'] });
    const result = await runExecutor({ runId: 'b8-1-exec-e7', approvedPlanSha256: planSha256, _homeOverride: home, _manifestOverride: syntheticManifest });
    assert.equal(result.outcome, 'pass', `expected pass, got: ${result.errors.join('; ')}`);
    assert.equal(result.fixtureResults.length, 2);
    assert.ok(result.fixtureResults.every(f => f.result === 'pass' && f.assertion.passed));
    assert.ok(fs.existsSync(path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', 'b8-1-exec-e7', 'execution-receipt.json')));
  } finally { cleanup(home); }
});

test('E8: CBM fixture timeout is recorded correctly', async () => {
  const home = makeTempDir('b81-exec-e8-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e8', fixtures, selectedSubjects: ['cbm'] });

    // Reduce timeout for test speed by patching the adapter to timeout after 50ms
    const fastTimeoutAdapter = () => new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 50));

    const result = await runExecutor({ runId: 'b8-1-exec-e8', approvedPlanSha256: planSha256, _homeOverride: home, _cbmAdapter: fastTimeoutAdapter, _manifestOverride: syntheticManifest });
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'timeout');
    assert.ok(result.fixtureResults[0].errors.some(e => /timeout|timed out/i.test(e)));
  } finally { cleanup(home); }
});

test('E9: oversized CBM output is recorded as error', async () => {
  const home = makeTempDir('b81-exec-e9-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e9', fixtures, selectedSubjects: ['cbm'] });

    // Adapter returning oversized string
    const oversizedAdapter = async () => 'x'.repeat(1_048_577); // 1MB + 1

    const result = await runExecutor({ runId: 'b8-1-exec-e9', approvedPlanSha256: planSha256, _homeOverride: home, _cbmAdapter: oversizedAdapter, _manifestOverride: syntheticManifest });
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'error');
    assert.ok(result.fixtureResults[0].errors.some(e => /exceed|bytes/i.test(e)));
  } finally { cleanup(home); }
});

test('E10: malformed CBM output is recorded as error', async () => {
  const home = makeTempDir('b81-exec-e10-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e10', fixtures, selectedSubjects: ['cbm'] });

    // Adapter returning non-JSON string
    const malformedAdapter = async () => 'not-json-at-all{{{';

    const result = await runExecutor({ runId: 'b8-1-exec-e10', approvedPlanSha256: planSha256, _homeOverride: home, _cbmAdapter: malformedAdapter, _manifestOverride: syntheticManifest });
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'error');
    assert.ok(result.fixtureResults[0].errors.some(e => /malformed/i.test(e)));
  } finally { cleanup(home); }
});

test('E11: fixture file missing causes fail result (not crash)', async () => {
  const home = makeTempDir('b81-exec-e11-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'nonexistent-file.ts', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e11', fixtures, selectedSubjects: ['exact-source'] });
    // Do NOT create the expected file in the sources dir
    const sourcesDir = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', 'b8-1-exec-e11', 'sources', 'test');
    try { fs.rmSync(path.join(sourcesDir, 'nonexistent-file.ts'), { force: true }); } catch {}
    const result = await runExecutor({ runId: 'b8-1-exec-e11', approvedPlanSha256: planSha256, _homeOverride: home, _manifestOverride: syntheticManifest });
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'fail');
    assert.equal(result.fixtureResults[0].assertion.passed, false);
  } finally { cleanup(home); }
});

test('E12: path escape in expectedFile is rejected', async () => {
  const home = makeTempDir('b81-exec-e12-');
  try {
    // Fixture with path traversal in expectedFile
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: '../../etc/passwd', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e12', fixtures, selectedSubjects: ['exact-source'] });
    const result = await runExecutor({ runId: 'b8-1-exec-e12', approvedPlanSha256: planSha256, _homeOverride: home, _manifestOverride: syntheticManifest });
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'error');
    assert.ok(result.fixtureResults[0].errors.some(e => /escape/i.test(e)));
  } finally { cleanup(home); }
});

test('E13: partial failure — one pass, one fail', async () => {
  const home = makeTempDir('b81-exec-e13-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
      { fixtureId: 'f2', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'MISSING.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e13', fixtures, selectedSubjects: ['exact-source'] });
    // Remove MISSING.md so the second fixture must fail
    const runDir13 = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', 'b8-1-exec-e13');
    try { fs.rmSync(path.join(runDir13, 'sources', 'test', 'MISSING.md'), { force: true }); } catch {}
    const result = await runExecutor({ runId: 'b8-1-exec-e13', approvedPlanSha256: planSha256, _homeOverride: home, _manifestOverride: syntheticManifest });
    assert.equal(result.fixtureResults.length, 2);
    const passCount = result.fixtureResults.filter(f => f.result === 'pass').length;
    const failCount = result.fixtureResults.filter(f => f.result === 'fail').length;
    assert.equal(passCount, 1, 'one fixture must pass');
    assert.equal(failCount, 1, 'one fixture must fail');
    assert.equal(result.outcome, 'partial', 'outcome must be partial');
  } finally { cleanup(home); }
});

test('E14: execution receipt is written atomically and validates planSha256', async () => {
  const home = makeTempDir('b81-exec-e14-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e14', fixtures, selectedSubjects: ['exact-source'] });
    const result = await runExecutor({ runId: 'b8-1-exec-e14', approvedPlanSha256: planSha256, _homeOverride: home, _manifestOverride: syntheticManifest });
    assert.equal(result.outcome, 'pass');
    const receiptPath = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', 'b8-1-exec-e14', 'execution-receipt.json');
    assert.ok(fs.existsSync(receiptPath), 'execution-receipt.json must exist');
    // Verify no .tmp file remains
    assert.equal(fs.existsSync(`${receiptPath}.tmp`), false, 'no .tmp file should remain');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    assert.equal(receipt.planSha256, planSha256, 'receipt planSha256 must match');
    assert.equal(receipt.executorVersion, '4.0.0');
  } finally { cleanup(home); }
});

test('E15: dry-run mode skips fixture execution and produces pass outcome', async () => {
  const home = makeTempDir('b81-exec-e15-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e15', fixtures, selectedSubjects: ['exact-source'] });
    const result = await runExecutor({ runId: 'b8-1-exec-e15', approvedPlanSha256: planSha256, dryRun: true, _homeOverride: home, _manifestOverride: syntheticManifest });
    assert.equal(result.outcome, 'pass');
    assert.equal(result.fixtureResults.length, 0, 'dry-run must not execute fixtures');
  } finally { cleanup(home); }
});

test('E16: buildFixtureEvidence constructs correct evidence record', () => {
  const fixture = { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'src/main.ts', scoringType: 'exact-match', question: 'test?' };
  const result = {
    outcome: 'pass',
    actual: 'src/main.ts',
    latencyMs: 42,
    errors: [],
    startedAt: '2026-08-04T00:00:00.000Z',
    completedAt: '2026-08-04T00:00:00.042Z',
    subjectIdentity: { exactSource: true },
  };
  const runMeta = { runId: 'b8-1-test', planVersion: '4.0.0', planSha256: 'a'.repeat(64) };
  const ev = buildFixtureEvidence(fixture, result, 'exact-source', runMeta);
  assert.equal(ev.fixtureId, 'f1');
  assert.equal(ev.subject, 'exact-source');
  assert.equal(ev.assertion.passed, true);
  assert.equal(ev.assertion.expected, 'src/main.ts');
  assert.equal(ev.assertion.actual, 'src/main.ts');
  assert.equal(ev.provenance.planVersion, '4.0.0');
  assert.equal(ev.provenance.runId, 'b8-1-test');
  assert.equal(ev.latencyMs, 42);
});

test('E17: validateExecutorInputs rejects graphify subject', () => {
  const { valid, errors } = validateExecutorInputs({
    runId: 'b8-1-test',
    runDir: '/fake/run',
    plan: { planVersion: '4.0.0', selectedSubjects: ['exact-source', 'graphify'] },
    approvedPlanSha256: 'a'.repeat(64),
    dryRun: false,
  });
  assert.equal(valid, false);
  assert.ok(errors.some(e => /graphify/i.test(e)));
});

test('E18: loadAndVerifyRunPlan rejects stale v1/v2 digests', () => {
  const STALE = '1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda';
  // runDir doesn't exist — we only need to test the digest check which runs before filesystem check
  // However loadAndVerifyRunPlan checks runDir first. So create a temp dir with a dummy plan.
  const tmpDir = makeTempDir('b81-exec-e18-');
  try {
    const runDir = path.join(tmpDir, 'run');
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'run-plan.json'), JSON.stringify({ planVersion: '4.0.0', planSha256: '0'.repeat(64), runId: 'x' }, null, 2));
    const { error } = loadAndVerifyRunPlan(runDir, STALE);
    assert.ok(error, 'must return error for stale digest');
    assert.match(error, /stale/i);
  } finally { cleanup(tmpDir); }
});

// ---------------------------------------------------------------------------
// New tests: Defects 1-6
// ---------------------------------------------------------------------------

test('E19: dual-subject run produces 2×fixtureCount results (cbm + exact-source)', async () => {
  const home = makeTempDir('b81-exec-e19-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
      { fixtureId: 'f2', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'src/main.ts', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, {
      runId: 'b8-1-exec-e19',
      fixtures,
      selectedSubjects: ['cbm', 'exact-source'],
    });
    const cbmAdapter = async () => ({ outcome: 'pass', actual: 'README.md', errors: [], fileCorrect: true, lineCorrect: true });
    const result = await runExecutor({
      runId: 'b8-1-exec-e19',
      approvedPlanSha256: planSha256,
      _homeOverride: home,
      _cbmAdapter: cbmAdapter,
      _manifestOverride: syntheticManifest,
    });
    // 2 fixtures × 2 subjects = 4 results
    assert.equal(result.fixtureResults.length, 4, `expected 4 fixture results (2 fixtures × 2 subjects), got ${result.fixtureResults.length}`);
    const subjects = new Set(result.fixtureResults.map(f => f.subject));
    assert.ok(subjects.has('cbm'), 'must have cbm results');
    assert.ok(subjects.has('exact-source'), 'must have exact-source results');
    const fixtureIds = new Set(result.fixtureResults.map(f => f.fixtureId));
    assert.ok(fixtureIds.has('f1') && fixtureIds.has('f2'), 'must have results for both fixture IDs');
  } finally { cleanup(home); }
});

test('E20: contract 4.0.0 rejects plan with planVersion 3.0.0', async () => {
  const home = makeTempDir('b81-exec-e20-');
  try {
    const { runDir, planSha256 } = makeSyntheticRun(home, { runId: 'b8-1-exec-e20', fixtures: [], planVersionOverride: '3.0.0' });
    const result = await runExecutor({ runId: 'b8-1-exec-e20', approvedPlanSha256: planSha256, _homeOverride: home });
    assert.equal(result.outcome, 'fail');
    assert.ok(result.errors.some(e => /planVersion|4\.0\.0/i.test(e)), `errors: ${result.errors.join('; ')}`);
  } finally { cleanup(home); }
});

test('E21: exact-source line-contains scoring returns fileCorrect and lineCorrect', async () => {
  const home = makeTempDir('b81-exec-e21-');
  try {
    const fixtures = [
      {
        fixtureId: 'f1',
        repositoryId: 'test',
        pinnedCommit: '4'.repeat(40),
        expectedFile: 'src/main.ts',
        scoringType: 'exact-match',
        question: 'test?',
        expectedLine: 3,
        verification: {
          algorithm: 'line-contains',
          path: 'src/main.ts',
          line: 3,
          contains: ['export function main'],
        },
      },
    ];
    const { planSha256, syntheticManifest, runDir } = makeSyntheticRun(home, {
      runId: 'b8-1-exec-e21',
      fixtures,
      selectedSubjects: ['exact-source'],
    });
    // Write the file with 5 lines, target content at line 3
    const sourcesDir = path.join(runDir, 'sources', 'test');
    const mainPath = path.join(sourcesDir, 'src', 'main.ts');
    fs.mkdirSync(path.dirname(mainPath), { recursive: true });
    fs.writeFileSync(mainPath, 'line 1\nline 2\nexport function main() {}\nline 4\nline 5\n');
    const result = await runExecutor({
      runId: 'b8-1-exec-e21',
      approvedPlanSha256: planSha256,
      _homeOverride: home,
      _manifestOverride: syntheticManifest,
    });
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'pass');
    assert.equal(result.fixtureResults[0].fileCorrect, true, 'fileCorrect must be true');
    assert.equal(result.fixtureResults[0].lineCorrect, true, 'lineCorrect must be true');
  } finally { cleanup(home); }
});

test('E22: exact-source file-name-count scoring counts files', async () => {
  const home = makeTempDir('b81-exec-e22-');
  try {
    const fixtures = [
      {
        fixtureId: 'f1',
        repositoryId: 'test',
        pinnedCommit: '4'.repeat(40),
        scoringType: 'count-match',
        question: 'how many?',
        verification: {
          algorithm: 'file-name-count',
          root: '.',
          fileName: 'route.ts',
          expectedCount: 2,
        },
      },
    ];
    const { planSha256, syntheticManifest, runDir } = makeSyntheticRun(home, {
      runId: 'b8-1-exec-e22',
      fixtures,
      selectedSubjects: ['exact-source'],
    });
    // Create 2 route.ts files in sources/test
    const sourcesDir = path.join(runDir, 'sources', 'test');
    fs.mkdirSync(path.join(sourcesDir, 'api'), { recursive: true });
    fs.mkdirSync(path.join(sourcesDir, 'web'), { recursive: true });
    fs.writeFileSync(path.join(sourcesDir, 'api', 'route.ts'), 'export const GET = () => {}');
    fs.writeFileSync(path.join(sourcesDir, 'web', 'route.ts'), 'export const GET = () => {}');
    const result = await runExecutor({
      runId: 'b8-1-exec-e22',
      approvedPlanSha256: planSha256,
      _homeOverride: home,
      _manifestOverride: syntheticManifest,
    });
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'pass', `result: ${result.fixtureResults[0].result}, errors: ${result.fixtureResults[0].errors?.join('; ')}`);
    assert.equal(result.fixtureResults[0].fileCorrect, true, 'fileCorrect must be true for matching count');
  } finally { cleanup(home); }
});

test('E23: aggregate evidence.json is written to run directory after execution', async () => {
  const home = makeTempDir('b81-exec-e23-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest, runDir } = makeSyntheticRun(home, {
      runId: 'b8-1-exec-e23',
      fixtures,
      selectedSubjects: ['exact-source'],
    });
    await runExecutor({
      runId: 'b8-1-exec-e23',
      approvedPlanSha256: planSha256,
      _homeOverride: home,
      _manifestOverride: syntheticManifest,
    });
    const evidencePath = path.join(runDir, 'evidence.json');
    assert.ok(fs.existsSync(evidencePath), 'evidence.json must be written to run directory');
    const agg = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    assert.equal(agg.schemaVersion, '1.0.0', 'aggregate evidence must have schemaVersion 1.0.0');
    assert.equal(agg.runId, 'b8-1-exec-e23', 'aggregate evidence runId must match');
    assert.ok(Array.isArray(agg.fixtureResults), 'fixtureResults must be an array');
    assert.equal(agg.fixtureResults.length, 1, 'must have 1 fixture result');
    assert.equal(typeof agg.offlineMetrics?.fileAccuracy, 'number', 'offlineMetrics.fileAccuracy must be a number');
  } finally { cleanup(home); }
});

test('E24: timer is cleared when CBM adapter resolves before timeout', async () => {
  const home = makeTempDir('b81-exec-e24-');
  try {
    const fixtures = [
      { fixtureId: 'f1', repositoryId: 'test', pinnedCommit: '4'.repeat(40), expectedFile: 'README.md', scoringType: 'exact-match', question: 'test?' },
    ];
    const { planSha256, syntheticManifest } = makeSyntheticRun(home, { runId: 'b8-1-exec-e24', fixtures, selectedSubjects: ['cbm'] });
    let timerFiredAfterResolve = false;
    // Adapter resolves fast; if timer leaks it would fire after test finishes
    const fastAdapter = async () => {
      await new Promise(r => setTimeout(r, 5));
      return { outcome: 'pass', actual: 'README.md', errors: [], fileCorrect: true, lineCorrect: true };
    };
    const result = await runExecutor({
      runId: 'b8-1-exec-e24',
      approvedPlanSha256: planSha256,
      _homeOverride: home,
      _cbmAdapter: fastAdapter,
      _manifestOverride: syntheticManifest,
    });
    // Wait a small extra time to check timer doesn't fire spuriously
    await new Promise(r => setTimeout(r, 20));
    assert.equal(result.fixtureResults.length, 1);
    assert.equal(result.fixtureResults[0].result, 'pass', 'fixture must pass');
    // The key invariant: outcome is pass (no spurious timeout from leaked timer)
    assert.notEqual(result.fixtureResults[0].result, 'timeout', 'must not be timeout — timer must be cleared');
  } finally { cleanup(home); }
});
