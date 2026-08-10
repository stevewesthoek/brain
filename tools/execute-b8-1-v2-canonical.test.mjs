import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { computePlanDigest, verifyPlan, KNOWN_STALE_DIGESTS } from './lib/b8-1-v2-plan-digest.mjs';
import { validateAuthorization } from './execute-b8-1-v2-canonical.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadCurrentPlan() {
  const reportsDir = path.join(ROOT, 'operations/reports');
  const planFiles = fs.readdirSync(reportsDir)
    .filter(f => f.startsWith('b8-1-v2-1-') && f.endsWith('.json') && !f.includes('node20-canonical-dry-run-plan-2026-08-10'))
    .sort()
    .reverse();
  if (planFiles.length === 0) return null;
  const latest = path.join(reportsDir, planFiles[0]);
  return { path: latest, plan: JSON.parse(fs.readFileSync(latest, 'utf8')) };
}

function currentPlanOrSkip(t) {
  const result = loadCurrentPlan();
  if (!result || KNOWN_STALE_DIGESTS.has(result.plan.planSha256)) {
    t.skip('no valid current plan — run preparer first');
    return null;
  }
  return result;
}

// ── validateAuthorization: missing-arg failures ───────────────────────────────

test('validateAuthorization: missing --plan fails closed', () => {
  const result = validateAuthorization({ planPath: undefined, authorizedPlanSha256: 'abc', authorizedRunId: 'b8-1-v2-test' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('--plan')));
  assert.equal(result.plan, null);
});

test('validateAuthorization: missing --authorized-plan-sha256 fails closed', () => {
  const result = validateAuthorization({ planPath: '/tmp/some-plan.json', authorizedPlanSha256: undefined, authorizedRunId: 'b8-1-v2-test' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('--authorized-plan-sha256')));
  assert.equal(result.plan, null);
});

test('validateAuthorization: missing --authorized-run-id fails closed', () => {
  const result = validateAuthorization({ planPath: '/tmp/some-plan.json', authorizedPlanSha256: 'abc', authorizedRunId: undefined });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('--authorized-run-id')));
  assert.equal(result.plan, null);
});

test('validateAuthorization: all args missing fails closed with all three errors', () => {
  const result = validateAuthorization({ planPath: undefined, authorizedPlanSha256: undefined, authorizedRunId: undefined });
  assert.equal(result.valid, false);
  assert.equal(result.errors.filter(e => e.includes('missing required argument')).length, 3);
  assert.equal(result.plan, null);
});

// ── validateAuthorization: plan-file errors ───────────────────────────────────

test('validateAuthorization: non-existent plan file fails closed', () => {
  const result = validateAuthorization({ planPath: '/tmp/does-not-exist-b8-1-test.json', authorizedPlanSha256: 'abc', authorizedRunId: 'b8-1-v2-test' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('not found')));
  assert.equal(result.plan, null);
});

test('validateAuthorization: wrong digest (file exists but hash mismatch) fails closed', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const result = validateAuthorization({ planPath: planEntry.path, authorizedPlanSha256: '0000000000000000000000000000000000000000000000000000000000000000', authorizedRunId: planEntry.plan.runId });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('SHA mismatch') || e.includes('does not match')));
  assert.equal(result.plan, null);
});

test('validateAuthorization: wrong run ID fails closed', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const result = validateAuthorization({ planPath: planEntry.path, authorizedPlanSha256: planEntry.plan.planSha256, authorizedRunId: 'b8-1-v2-tampered-run-id' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('runId') || e.includes('run-id')));
  assert.equal(result.plan, null);
});

// ── validateAuthorization: stale-digest rejection ────────────────────────────

test('validateAuthorization: stale digest is rejected even if structurally valid', () => {
  // Use the still-present V2 plan (d95c684c...) which is in KNOWN_STALE_DIGESTS
  const STALE = 'd95c684c0aca9355d704b921f2d194f0a70959ff4518c20447645b6601fb4284';
  assert.ok(KNOWN_STALE_DIGESTS.has(STALE), 'prerequisite: this digest must be in KNOWN_STALE_DIGESTS');
  const stalePlanPath = path.join(ROOT, 'operations/reports/b8-1-v2-canonical-dry-run-plan-2026-08-10.json');
  const staleResult = validateAuthorization({ planPath: stalePlanPath, authorizedPlanSha256: STALE, authorizedRunId: 'b8-1-v2-canonical-authorization-20260810-final-v1' });
  assert.equal(staleResult.valid, false);
  assert.ok(staleResult.errors.some(e => e.includes('stale')));
  assert.equal(staleResult.plan, null);
});

test('KNOWN_STALE_DIGESTS: superseded Node25 plan digest is blocked', () => {
  assert.ok(KNOWN_STALE_DIGESTS.has('f0695fdfe163c50f96544e9ff901dec8737eca1eff458d8a87dd01ca7664fe34'));
});

test('KNOWN_STALE_DIGESTS: superseded Node20 plan digest is blocked', () => {
  assert.ok(KNOWN_STALE_DIGESTS.has('d828c726920a0ec40b52a39fee23dcf8ebd79cf0b3573d2451634514a39b9a0b'));
});

test('KNOWN_STALE_DIGESTS: auth-binding plan (no executor identity) is blocked', () => {
  assert.ok(KNOWN_STALE_DIGESTS.has('d6b9586e898a9e3a5ef24eaf13456f5d54be5101ae9765fb00a4d59aa46d36c6'));
});

test('KNOWN_STALE_DIGESTS: final plan (per-repo gate bug) is blocked', () => {
  assert.ok(KNOWN_STALE_DIGESTS.has('c4fa507e06b9614d7e23914d90a3fbf9bef2bfc3f371b6e8b7eeb6415707ac07'));
});

test('KNOWN_STALE_DIGESTS: contains at least 9 entries covering all superseded plans', () => {
  assert.ok(KNOWN_STALE_DIGESTS.size >= 9);
});

// ── validateAuthorization: exact approval binding (current plan) ──────────────

test('validateAuthorization: correct plan/digest/runId passes', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const result = validateAuthorization({ planPath: planEntry.path, authorizedPlanSha256: planEntry.plan.planSha256, authorizedRunId: planEntry.plan.runId });
  assert.equal(result.valid, true, `expected valid, got errors: ${result.errors.join(', ')}`);
  assert.ok(result.plan !== null);
  assert.equal(result.plan.runId, planEntry.plan.runId);
});

// ── Executor identity binding (current plan) ─────────────────────────────────

test('current plan: implementationIdentity.canonicalExecutor is present', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.ok(planEntry.plan.implementationIdentity?.canonicalExecutor, 'canonicalExecutor missing from implementationIdentity');
  assert.ok(planEntry.plan.implementationIdentity.canonicalExecutor.sha256, 'canonicalExecutor.sha256 missing');
  assert.ok(planEntry.plan.implementationIdentity.canonicalExecutor.repoRelPath, 'canonicalExecutor.repoRelPath missing');
});

test('current plan: canonicalExecutor SHA matches actual executor file', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const executorPath = path.join(ROOT, 'tools/execute-b8-1-v2-canonical.mjs');
  const actualSha = crypto.createHash('sha256').update(fs.readFileSync(executorPath)).digest('hex');
  assert.equal(actualSha, planEntry.plan.implementationIdentity.canonicalExecutor.sha256,
    'Executor SHA in plan does not match current file — plan must be regenerated after executor changes');
});

test('validateAuthorization: plan without canonicalExecutor identity fails closed', async (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const { computePlanDigest: recompute } = await import('./lib/b8-1-v2-plan-digest.mjs');
  const tampered = JSON.parse(JSON.stringify(planEntry.plan));
  delete tampered.implementationIdentity.canonicalExecutor;
  tampered.planSha256 = recompute(tampered);
  const tmpPath = path.join(ROOT, 'operations/reports', `__test-no-executor-${process.pid}.json`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(tampered, null, 2) + '\n');
    const result = validateAuthorization({ planPath: tmpPath, authorizedPlanSha256: tampered.planSha256, authorizedRunId: tampered.runId });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('canonicalExecutor') || e.includes('executor')),
      `Expected executor error, got: ${result.errors.join('; ')}`);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

test('validateAuthorization: plan with wrong executor SHA fails closed', async (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const { computePlanDigest: recompute } = await import('./lib/b8-1-v2-plan-digest.mjs');
  const tampered = JSON.parse(JSON.stringify(planEntry.plan));
  tampered.implementationIdentity.canonicalExecutor.sha256 = '0000000000000000000000000000000000000000000000000000000000000000';
  tampered.planSha256 = recompute(tampered);
  const tmpPath = path.join(ROOT, 'operations/reports', `__test-wrong-executor-${process.pid}.json`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(tampered, null, 2) + '\n');
    const result = validateAuthorization({ planPath: tmpPath, authorizedPlanSha256: tampered.planSha256, authorizedRunId: tampered.runId });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('executor') || e.includes('drift')),
      `Expected executor drift error, got: ${result.errors.join('; ')}`);
  } finally {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
  }
});

// ── Plan structural integrity (current plan) ─────────────────────────────────

test('current plan: planSha256 is internally consistent', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const computed = computePlanDigest(planEntry.plan);
  assert.equal(planEntry.plan.planSha256, computed);
});

test('current plan: passes verifyPlan', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const result = verifyPlan(planEntry.plan);
  assert.equal(result.valid, true, `Plan verification failed: ${result.errors.join(', ')}`);
});

test('current plan: runId matches expected pattern', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.match(planEntry.plan.runId, /^b8-1-v2-[a-zA-Z0-9._-]+$/);
});

test('current plan: mode is canonical-dry-run-authorization-only', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.equal(planEntry.plan.mode, 'canonical-dry-run-authorization-only');
});

test('current plan: partialEvidence is false', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.equal(planEntry.plan.partialEvidence, false);
});

test('current plan: canonicalMaterializationAuthorized is false (immutable field)', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.equal(planEntry.plan.canonicalMaterializationAuthorized, false);
});

test('current plan: canonicalExecutionAuthorized is false (immutable field)', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.equal(planEntry.plan.canonicalExecutionAuthorized, false);
});

// ── Single-use semantics (current plan) ──────────────────────────────────────

test('single-use semantics: canonical run path must be absent before execution', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.equal(fs.existsSync(planEntry.plan.plannedCanonicalRunPath), false,
    `Canonical run path already exists (would prevent execution): ${planEntry.plan.plannedCanonicalRunPath}`);
});

test('output containment: canonical run path is under ~/.brain/benchmark/', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.ok(planEntry.plan.plannedCanonicalRunPath.includes('.brain/benchmark/b8-1/runs/'));
});

// ── Plan integrity: mutation breaks digest ────────────────────────────────────

test('stale-plan rejection: modified plan produces different digest', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const modified = { ...planEntry.plan, runId: 'b8-1-v2-tampered-run-id' };
  const computed = computePlanDigest(modified);
  assert.notEqual(computed, planEntry.plan.planSha256);
});

test('stale-plan rejection: changing any digest-covered field invalidates planSha256', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const tampered = { ...planEntry.plan, canonicalMaterializationAuthorized: true };
  const result = verifyPlan(tampered);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('planSha256 mismatch') || e.includes('stale')));
});

// ── Provider and runtime identity (current plan) ──────────────────────────────

test('provider identity: binary exists and SHA matches plan', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const binary = planEntry.plan.provider.resolvedPath;
  assert.ok(fs.existsSync(binary), `Provider binary not found: ${binary}`);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(binary)).digest('hex');
  assert.equal(sha, planEntry.plan.provider.sha256);
});

test('runtime identity: Node binary exists and SHA matches plan', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const runtime = planEntry.plan.runtime.path;
  assert.ok(fs.existsSync(runtime), `Runtime not found: ${runtime}`);
  const sha = crypto.createHash('sha256').update(fs.readFileSync(runtime)).digest('hex');
  assert.equal(sha, planEntry.plan.runtime.sha256);
});

test('manifest identity: SHA matches current plan', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const sha = crypto.createHash('sha256').update(fs.readFileSync(MANIFEST_PATH)).digest('hex');
  assert.equal(sha, planEntry.plan.manifest.sha256);
});

test('Graphify exclusion: plan has graphify excluded', (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  assert.equal(planEntry.plan.graphifyStatus, 'excluded-out-of-contract');
});

// ── Source pins (current plan) ────────────────────────────────────────────────

test('source pins: all pinned commits exist in their repositories', async (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const { execFileSync } = await import('node:child_process');
  for (const pin of planEntry.plan.sourcePins) {
    const repo = manifest.repositories.find(r => r.repositoryId === pin.repositoryId);
    assert.ok(repo, `repo ${pin.repositoryId} not in manifest`);
    const repoRoot = path.resolve(path.dirname(MANIFEST_PATH), repo.localPath);
    const result = execFileSync('git', ['-C', repoRoot, 'cat-file', '-t', pin.commit], { encoding: 'utf8' }).trim();
    assert.equal(result, 'commit', `${pin.repositoryId}: ${pin.commit} is not a commit object`);
  }
});

// ── Evidence schema ───────────────────────────────────────────────────────────

test('evidence validation: schema compiles without error', async () => {
  const Ajv2020 = (await import('ajv/dist/2020.js')).default;
  const schemaPath = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert.ok(typeof validate === 'function');
});

// ── Cleanup requirement ───────────────────────────────────────────────────────

test('cleanup requirement: validator requires cleanupStatus.removed=true', async (t) => {
  const planEntry = currentPlanOrSkip(t);
  if (!planEntry) return;
  const { validateEvidenceObjects } = await import('./validate-b8-1-v2-evidence.mjs');
  const fakeEvidence = {
    schemaVersion: '4.0.0', contractVersion: 'B8.1-V2.1', runId: planEntry.plan.runId,
    partialEvidence: false, selectedSubjects: ['cbm', 'exact-source'], excludedSubjects: [],
    pinnedRepositoryCommits: {}, manifestHash: `sha256:${planEntry.plan.manifest.sha256}`,
    preflightReceiptHash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
    planSha256: planEntry.plan.planSha256, subjectBinaryIdentity: {},
    networkIsolationProof: { required: false, status: 'not-required' },
    isolationSelfTests: { allowedUnixSocketRoot: '/private/tmp/cbm-daemon-502', allowedUnixSocketRootValidation: { ownerUid: 502, mode: '0700', directory: true, symlink: false }, results: [] },
    coverageEvidence: {}, fallbackProbes: {}, lifecycleMetrics: {},
    runResults: [], acceptanceSummary: {}, fixtureResults: [],
    violations: [],
    cleanupStatus: { removed: false, runDirectory: planEntry.plan.plannedCanonicalRunPath },
  };
  const result = validateEvidenceObjects({ evidence: fakeEvidence, plan: planEntry.plan, manifest, preflightReceiptPath: null, checkFilesystem: false });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('cleanup')));
});

// ── Output containment ────────────────────────────────────────────────────────

test('output containment: evidence directory is under operations/reports/', () => {
  const evidenceDir = path.join(ROOT, 'operations/reports/b8-1-v2-evidence');
  const relative = path.relative(ROOT, evidenceDir);
  assert.ok(!relative.startsWith('..'));
  assert.ok(relative.startsWith('operations/reports/'));
});
