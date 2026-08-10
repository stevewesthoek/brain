import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { computePlanDigest, verifyPlan } from './lib/b8-1-v2-plan-digest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAN_PATH = path.join(ROOT, 'operations/reports/b8-1-v2-canonical-dry-run-plan-2026-08-10.json');
const MANIFEST_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json');

const plan = JSON.parse(fs.readFileSync(PLAN_PATH, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

test('authorization binding: plan digest matches approved digest', () => {
  const expectedDigest = 'd95c684c0aca9355d704b921f2d194f0a70959ff4518c20447645b6601fb4284';
  assert.equal(plan.planSha256, expectedDigest);
  const computed = computePlanDigest(plan);
  assert.equal(computed, expectedDigest);
});

test('authorization binding: run ID matches approved run ID', () => {
  assert.equal(plan.runId, 'b8-1-v2-canonical-authorization-20260810-final-v1');
});

test('authorization binding: plan passes structural verification', () => {
  const result = verifyPlan(plan);
  assert.equal(result.valid, true, `Plan verification failed: ${result.errors.join(', ')}`);
});

test('single-use semantics: canonical run path must be absent before execution', () => {
  assert.equal(fs.existsSync(plan.plannedCanonicalRunPath), false,
    `Canonical run path already exists (would prevent execution): ${plan.plannedCanonicalRunPath}`);
});

test('single-use semantics: plan rejects stale digests', () => {
  const stale = { ...plan, planSha256: '86859184919a029c9a3aaa989c55240ad07aff368c09e6895d9564577dfadf30' };
  const result = verifyPlan(stale);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('stale')));
});

test('output containment: evidence directory is under operations/reports/', () => {
  const evidenceDir = path.join(ROOT, 'operations/reports/b8-1-v2-evidence');
  const relative = path.relative(ROOT, evidenceDir);
  assert.ok(!relative.startsWith('..'));
  assert.ok(relative.startsWith('operations/reports/'));
});

test('output containment: canonical run path is under ~/.brain/benchmark/', () => {
  assert.ok(plan.plannedCanonicalRunPath.includes('.brain/benchmark/b8-1/runs/'));
});

test('cleanup requirement: validator requires cleanupStatus.removed=true', async () => {
  const { validateEvidenceObjects } = await import('./validate-b8-1-v2-evidence.mjs');
  const fakeEvidence = {
    schemaVersion: '4.0.0', contractVersion: 'B8.1-V2', runId: plan.runId,
    partialEvidence: false, selectedSubjects: ['cbm', 'exact-source'], excludedSubjects: [],
    pinnedRepositoryCommits: {}, manifestHash: `sha256:${plan.manifest.sha256}`,
    preflightReceiptHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    planSha256: plan.planSha256, subjectBinaryIdentity: {},
    networkIsolationProof: { required: false, status: 'not-required' },
    isolationSelfTests: { allowedUnixSocketRoot: '/private/tmp/cbm-daemon-502', allowedUnixSocketRootValidation: { ownerUid: 502, mode: '0700', directory: true, symlink: false }, results: [] },
    coverageEvidence: {}, fallbackProbes: {}, lifecycleMetrics: {},
    runResults: [], acceptanceSummary: {}, fixtureResults: [],
    violations: [],
    cleanupStatus: { removed: false, runDirectory: plan.plannedCanonicalRunPath },
  };
  const result = validateEvidenceObjects({ evidence: fakeEvidence, plan, manifest, preflightReceiptPath: null, checkFilesystem: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('cleanup')));
});

test('stale-plan rejection: modified plan produces different digest', () => {
  const modified = { ...plan, runId: 'b8-1-v2-tampered-run-id' };
  const computed = computePlanDigest(modified);
  assert.notEqual(computed, plan.planSha256);
});

test('provider identity: binary exists and SHA matches plan', () => {
  const binary = plan.provider.resolvedPath;
  assert.ok(fs.existsSync(binary), `Provider binary not found: ${binary}`);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  assert.equal(sha, plan.provider.sha256);
});

test('runtime identity: Node binary exists and SHA matches plan', () => {
  const runtime = plan.runtime.path;
  assert.ok(fs.existsSync(runtime), `Runtime not found: ${runtime}`);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(runtime)).digest('hex');
  assert.equal(sha, plan.runtime.sha256);
});

test('manifest identity: SHA matches plan', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(MANIFEST_PATH)).digest('hex');
  assert.equal(sha, plan.manifest.sha256);
});

test('Graphify exclusion: plan has graphify excluded', () => {
  assert.equal(plan.graphifyStatus, 'excluded-out-of-contract');
});

test('evidence validation: schema compiles without error', async () => {
  const Ajv2020 = (await import('ajv/dist/2020.js')).default;
  const schemaPath = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert.ok(typeof validate === 'function');
});

test('source pins: all pinned commits exist in their repositories', async () => {
  const { execFileSync } = await import('node:child_process');
  for (const pin of plan.sourcePins) {
    const repo = manifest.repositories.find(r => r.repositoryId === pin.repositoryId);
    assert.ok(repo, `repo ${pin.repositoryId} not in manifest`);
    const repoRoot = path.resolve(path.dirname(MANIFEST_PATH), repo.localPath);
    const result = execFileSync('git', ['-C', repoRoot, 'cat-file', '-t', pin.commit], { encoding: 'utf8' }).trim();
    assert.equal(result, 'commit', `${pin.repositoryId}: ${pin.commit} is not a commit object`);
  }
});
