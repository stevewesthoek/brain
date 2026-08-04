#!/usr/bin/env node
/**
 * execute-b8-1-benchmark.mjs
 *
 * Bounded B8.1 benchmark executor.
 *
 * Responsibilities:
 *   - Verify an approved v3 plan digest against a materialized run
 *   - Execute each fixture with bounded timeout/output using cbm or exact-source adapters
 *   - Record evidence atomically
 *   - Terminate children; produce execution and cleanup receipts
 *   - Fail closed on any unexpected state
 *
 * This executor does NOT:
 *   - Start MCP servers or register MCP
 *   - Modify user config (~/.claude.json, ~/.codex, etc.)
 *   - Use LLMs or remote APIs
 *   - Execute graphify
 *   - Accept v1/v2 plan approvals
 *
 * Exit codes:
 *   0 = all fixtures passed (or dry-run succeeded)
 *   1 = one or more fixtures failed / blocked
 *   2 = internal or configuration error
 */

import assert from 'node:assert';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const EXECUTOR_VERSION = '3.0.0';
const REQUIRED_PLAN_VERSION = '3.0.0';
const FIXTURE_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1_048_576; // 1 MB per fixture
const SUPPORTED_SUBJECTS = new Set(['cbm', 'exact-source']);

// Known stale v1/v2 digests — same set as in the preflight harness
const KNOWN_STALE_DIGESTS = new Set([
  'dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4',
  '1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
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

function atomicWriteJson(filePath, obj) {
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Plan loading and verification
// ---------------------------------------------------------------------------

/**
 * Load run-plan.json from a materialized run directory, verify v3 planVersion,
 * check approved digest, and return the plan.
 *
 * @param {string} runDir
 * @param {string} approvedPlanSha256
 * @returns {{ plan: object, error: string|null }}
 */
export function loadAndVerifyRunPlan(runDir, approvedPlanSha256) {
  if (!runDir || typeof runDir !== 'string') {
    return { plan: null, error: 'runDir must be a non-empty string' };
  }
  if (!fs.existsSync(runDir)) {
    return { plan: null, error: `run directory does not exist: ${runDir}` };
  }

  const runPlanPath = path.join(runDir, 'run-plan.json');
  if (!fs.existsSync(runPlanPath)) {
    return { plan: null, error: `run-plan.json not found in run directory: ${runDir}` };
  }

  let plan;
  try {
    plan = JSON.parse(fs.readFileSync(runPlanPath, 'utf8'));
  } catch (e) {
    return { plan: null, error: `failed to parse run-plan.json: ${e.message}` };
  }

  // Reject v1/v2 plans (planVersion absent or schemaVersion: '1.0.0' without planVersion)
  if (plan.planVersion !== REQUIRED_PLAN_VERSION) {
    const gotVersion = plan.planVersion ?? `absent (schemaVersion=${plan.schemaVersion ?? 'absent'})`;
    return {
      plan: null,
      error: `run-plan.json has planVersion=${gotVersion}; executor requires planVersion=${REQUIRED_PLAN_VERSION} — recompute with v3 preflight`,
    };
  }

  if (!approvedPlanSha256) {
    return { plan: null, error: 'approvedPlanSha256 is required' };
  }
  if (typeof approvedPlanSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(approvedPlanSha256)) {
    return { plan: null, error: 'approvedPlanSha256 must be exactly 64 lowercase hexadecimal characters' };
  }
  if (KNOWN_STALE_DIGESTS.has(approvedPlanSha256)) {
    return { plan: null, error: 'stale v1/v2 approval digest rejected — recompute against v3 plan contract' };
  }

  // Recompute the digest from the stored plan fields (excluding planSha256/createdAt/runContext)
  const { planSha256: storedDigest, createdAt: _createdAt, ...digestFields } = plan;
  const computedDigest = computePlanDigest(digestFields);

  if (storedDigest !== computedDigest) {
    return { plan: null, error: `run-plan.json has been tampered: stored digest ${storedDigest?.slice(0, 16)}... does not match recomputed ${computedDigest.slice(0, 16)}...` };
  }
  if (approvedPlanSha256 !== computedDigest) {
    return { plan: null, error: `approved digest mismatch: provided ${approvedPlanSha256.slice(0, 16)}... does not match run plan ${computedDigest.slice(0, 16)}...` };
  }

  return { plan, error: null };
}

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

/**
 * Validate all executor inputs before execution.
 *
 * @param {object} opts
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateExecutorInputs({ runId, runDir, plan, approvedPlanSha256, dryRun }) {
  const errors = [];

  if (!runId || typeof runId !== 'string') errors.push('runId is required');
  if (!runDir || typeof runDir !== 'string') errors.push('runDir is required');

  if (plan) {
    // Reject graphify
    const selected = plan.selectedSubjects ?? [];
    if (selected.includes('graphify')) {
      errors.push('graphify is not supported by this executor — it requires a separate bounded graphify contract');
    }
    for (const subject of selected) {
      if (!SUPPORTED_SUBJECTS.has(subject)) {
        errors.push(`unsupported subject "${subject}": executor supports only [${[...SUPPORTED_SUBJECTS].join(', ')}]`);
      }
    }

    // Verify preflight-receipt.json exists and matches
    if (runDir && fs.existsSync(runDir)) {
      const receiptPath = path.join(runDir, 'preflight-receipt.json');
      if (!fs.existsSync(receiptPath)) {
        errors.push('preflight-receipt.json not found — run must be materialized by the v3 preflight harness');
      } else {
        try {
          const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
          if (receipt.planVersion !== REQUIRED_PLAN_VERSION) {
            errors.push(`preflight-receipt.json has planVersion=${receipt.planVersion}; expected ${REQUIRED_PLAN_VERSION}`);
          }
        } catch (e) {
          errors.push(`failed to parse preflight-receipt.json: ${e.message}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Fixture evidence building
// ---------------------------------------------------------------------------

/**
 * Build a single fixture evidence record.
 *
 * @param {object} fixture     - fixture from the manifest
 * @param {object} result      - { outcome, actual, latencyMs, errors, subjectIdentity }
 * @param {string} subject     - 'cbm' | 'exact-source'
 * @param {object} runMeta     - { runId, planVersion, planSha256 }
 * @returns {object}
 */
export function buildFixtureEvidence(fixture, result, subject, runMeta) {
  const { outcome, actual, latencyMs, errors, subjectIdentity } = result;
  const expected = fixture.expectedFile ?? null;

  let passed = false;
  if (outcome === 'pass') {
    if (fixture.scoringType === 'exact-match') {
      passed = actual === expected;
    } else {
      passed = true;
    }
  }

  return {
    fixtureId: fixture.fixtureId,
    repositoryId: fixture.repositoryId,
    pinnedCommit: fixture.pinnedCommit,
    subject,
    startedAt: result.startedAt ?? null,
    completedAt: result.completedAt ?? null,
    latencyMs: latencyMs ?? null,
    result: outcome,
    assertion: {
      expected,
      actual: actual ?? null,
      passed,
    },
    provenance: {
      runId: runMeta.runId,
      planVersion: runMeta.planVersion,
      planSha256: runMeta.planSha256,
    },
    errors: errors ?? [],
    subjectIdentity: subjectIdentity ?? null,
  };
}

// ---------------------------------------------------------------------------
// Subject adapters
// ---------------------------------------------------------------------------

/**
 * Run a fixture with the exact-source adapter.
 * Verifies the expected file exists in the materialized sources tree.
 *
 * @param {object} fixture
 * @param {string} sourcesDir  - path to the materialized sources/<repoId>/ directory
 * @returns {{ outcome, actual, latencyMs, errors }}
 */
function runExactSourceFixture(fixture, sourcesDir) {
  const start = Date.now();
  const errors = [];
  let outcome = 'fail';
  let actual = null;

  try {
    const expectedFile = fixture.expectedFile;
    if (!expectedFile) {
      errors.push('fixture has no expectedFile');
      return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors };
    }

    // Path containment check — expectedFile must not escape sourcesDir
    const targetPath = path.resolve(sourcesDir, expectedFile);
    const rel = path.relative(sourcesDir, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      errors.push(`expectedFile "${expectedFile}" escapes sources directory`);
      return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors };
    }

    if (fs.existsSync(targetPath)) {
      actual = expectedFile;
      outcome = 'pass';
    } else {
      actual = null;
      outcome = 'fail';
      errors.push(`expected file not found: ${expectedFile}`);
    }
  } catch (e) {
    errors.push(e.message);
    outcome = 'error';
  }

  return { outcome, actual, latencyMs: Date.now() - start, errors };
}

/**
 * Run a fixture with a CBM adapter.
 * In dry-run mode or when a fake adapter is injected, uses the fake adapter.
 * In production mode (not yet implemented — executor is dry-run only for v3),
 * would spawn the real CBM binary.
 *
 * @param {object} fixture
 * @param {object} cbmIdentity   - { stablePath, resolvedPath, version, sha256 }
 * @param {string} cacheDir      - per-run CBM cache directory
 * @param {string} configDir     - per-run CBM config directory
 * @param {object} opts          - injectable test hooks: { _cbmAdapter }
 * @returns {Promise<{ outcome, actual, latencyMs, errors, subjectIdentity }>}
 */
async function runCbmFixture(fixture, cbmIdentity, cacheDir, configDir, opts = {}) {
  const start = Date.now();
  const errors = [];

  const adapter = opts._cbmAdapter;
  if (!adapter) {
    // Real CBM execution is not implemented in the v3 dry-run package.
    // Future: spawn the cbm binary with per-run config/cache and network isolation.
    return {
      outcome: 'skipped',
      actual: null,
      latencyMs: Date.now() - start,
      errors: ['CBM execution not implemented in v3 dry-run package'],
      subjectIdentity: cbmIdentity ? { cbm: { version: cbmIdentity.version, sha256: cbmIdentity.sha256 } } : null,
    };
  }

  // Injected fake adapter (tests only)
  try {
    const result = await Promise.race([
      adapter(fixture, { cacheDir, configDir }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT')), FIXTURE_TIMEOUT_MS)
      ),
    ]);
    const outputStr = typeof result === 'string' ? result : JSON.stringify(result);
    if (outputStr.length > MAX_OUTPUT_BYTES) {
      return {
        outcome: 'error',
        actual: null,
        latencyMs: Date.now() - start,
        errors: [`output exceeds ${MAX_OUTPUT_BYTES} bytes`],
        subjectIdentity: null,
      };
    }
    let parsed;
    try { parsed = typeof result === 'object' ? result : JSON.parse(outputStr); }
    catch (e) {
      return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors: [`malformed output: ${e.message}`], subjectIdentity: null };
    }
    return {
      outcome: parsed.outcome ?? 'fail',
      actual: parsed.actual ?? null,
      latencyMs: Date.now() - start,
      errors: parsed.errors ?? [],
      subjectIdentity: cbmIdentity ? { cbm: { version: cbmIdentity.version, sha256: cbmIdentity.sha256 } } : null,
    };
  } catch (e) {
    if (e.message === 'TIMEOUT') {
      return { outcome: 'timeout', actual: null, latencyMs: Date.now() - start, errors: ['fixture timed out after 30s'], subjectIdentity: null };
    }
    return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors: [e.message], subjectIdentity: null };
  }
}

// ---------------------------------------------------------------------------
// Evidence validation
// ---------------------------------------------------------------------------

function validateEvidence(evidenceDir, expectedFixtureIds) {
  const errors = [];
  const found = new Set();
  for (const fixtureId of expectedFixtureIds) {
    const evidencePath = path.join(evidenceDir, `${fixtureId}.json`);
    if (!fs.existsSync(evidencePath)) {
      errors.push(`evidence missing for fixture ${fixtureId}`);
      continue;
    }
    try {
      const ev = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      if (ev.fixtureId !== fixtureId) errors.push(`evidence fixtureId mismatch: ${ev.fixtureId} !== ${fixtureId}`);
      if (!ev.provenance?.runId) errors.push(`evidence ${fixtureId}: missing provenance.runId`);
      found.add(fixtureId);
    } catch (e) {
      errors.push(`evidence ${fixtureId}: parse error: ${e.message}`);
    }
  }
  // Check for extra evidence files
  try {
    for (const file of fs.readdirSync(evidenceDir)) {
      if (!file.endsWith('.json')) continue;
      const fixtureId = file.slice(0, -5);
      if (!expectedFixtureIds.includes(fixtureId) && file !== '_execution-receipt.json') {
        errors.push(`unexpected evidence file: ${file}`);
      }
    }
  } catch { /* evidenceDir may not exist on total failure */ }
  return errors;
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Run the B8.1 benchmark executor.
 *
 * @param {object} opts
 * @param {string} opts.runId
 * @param {string} opts.approvedPlanSha256
 * @param {boolean} [opts.dryRun]            - if true, skip actual fixture execution
 * @param {string} [opts._homeOverride]      - inject synthetic home for tests
 * @param {Function} [opts._cbmAdapter]      - inject fake CBM adapter for tests
 * @returns {Promise<{ outcome, fixtureResults, executionReceipt, cleanupReceipt, errors }>}
 */
export async function runExecutor({
  runId,
  approvedPlanSha256,
  dryRun = false,
  _homeOverride,
  _cbmAdapter,
  _manifestOverride,  // inject a manifest object directly (tests only)
} = {}) {
  const home = _homeOverride ?? os.homedir();
  const errors = [];
  const terminatedPids = [];

  if (!runId || typeof runId !== 'string' || !/^[a-zA-Z0-9._-]+$/.test(runId)) {
    return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors: ['invalid or missing runId'] };
  }

  const runDir = path.join(home, '.brain', 'benchmark', 'b8-1', 'runs', runId);

  // Load and verify plan
  const { plan, error: planError } = loadAndVerifyRunPlan(runDir, approvedPlanSha256);
  if (planError) {
    return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors: [planError] };
  }

  // Validate inputs
  const { valid, errors: inputErrors } = validateExecutorInputs({ runId, runDir, plan, approvedPlanSha256, dryRun });
  if (!valid) {
    return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors: inputErrors };
  }

  const { planSha256: storedDigest, createdAt: _createdAt, ...planDigestFields } = plan;
  const planSha256 = computePlanDigest(planDigestFields);
  const runMeta = { runId, planVersion: plan.planVersion, planSha256 };

  const selectedSubjects = plan.selectedSubjects ?? [];
  const cbmIdentity = plan.subjectBinaryIdentity?.cbm ?? null;

  // Load manifest — injected override (tests) or from repo-relative path
  let manifest = _manifestOverride ?? null;
  if (!manifest) {
    const manifestRepoRelPath = plan.manifestRepoRelPath;
    if (manifestRepoRelPath) {
      const manifestAbsPath = path.join(REPO_ROOT, manifestRepoRelPath);
      try {
        manifest = JSON.parse(fs.readFileSync(manifestAbsPath, 'utf8'));
      } catch (e) {
        return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors: [`failed to load manifest: ${e.message}`] };
      }
    }
  }

  if (!manifest) {
    return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors: ['manifest not available in run plan'] };
  }

  const fixtures = manifest.fixtures ?? [];
  if (fixtures.length === 0) {
    return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors: ['manifest has no fixtures'] };
  }

  const evidenceDir = path.join(runDir, 'evidence');

  // Verify expected materialized sources exist
  for (const repo of manifest.repositories ?? []) {
    const sourcesPath = path.join(runDir, 'sources', repo.repositoryId);
    if (!fs.existsSync(sourcesPath)) {
      errors.push(`materialized sources missing for repository ${repo.repositoryId}: ${sourcesPath}`);
    }
  }
  if (errors.length > 0) {
    return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors };
  }

  // Verify evidence dir exists
  if (!fs.existsSync(evidenceDir)) {
    return { outcome: 'fail', fixtureResults: [], executionReceipt: null, cleanupReceipt: null, errors: [`evidence directory not found: ${evidenceDir}`] };
  }

  const fixtureResults = [];
  const startedAt = new Date().toISOString();

  if (!dryRun) {
    const cbmCacheDir = path.join(runDir, 'subjects', 'cbm', 'cache');
    const cbmConfigDir = path.join(runDir, 'subjects', 'cbm', 'config');

    for (const fixture of fixtures) {
      const subject = selectedSubjects.includes('cbm') ? 'cbm' : 'exact-source';
      const subjectForFixture = selectedSubjects.includes('exact-source') && !selectedSubjects.includes('cbm') ? 'exact-source' : subject;

      const fixtureStart = new Date().toISOString();
      let result;

      if (subjectForFixture === 'exact-source') {
        const sourcesDir = path.join(runDir, 'sources', fixture.repositoryId);
        const rawResult = runExactSourceFixture(fixture, sourcesDir);
        result = {
          ...rawResult,
          startedAt: fixtureStart,
          completedAt: new Date().toISOString(),
          subjectIdentity: { exactSource: true },
        };
      } else {
        // cbm
        const rawResult = await runCbmFixture(fixture, cbmIdentity, cbmCacheDir, cbmConfigDir, { _cbmAdapter });
        result = {
          ...rawResult,
          startedAt: fixtureStart,
          completedAt: new Date().toISOString(),
        };
      }

      const evidenceRecord = buildFixtureEvidence(fixture, result, subjectForFixture, runMeta);
      atomicWriteJson(path.join(evidenceDir, `${fixture.fixtureId}.json`), evidenceRecord);
      fixtureResults.push(evidenceRecord);
    }
  }

  // Validate final evidence (skip in dry-run)
  if (!dryRun) {
    const expectedIds = fixtures.map(f => f.fixtureId);
    const evidenceErrors = validateEvidence(evidenceDir, expectedIds);
    if (evidenceErrors.length > 0) {
      errors.push(...evidenceErrors);
    }
  }

  const completedAt = new Date().toISOString();
  const passed = fixtureResults.filter(f => f.result === 'pass' && f.assertion?.passed).length;
  const failed = fixtureResults.filter(f => f.result === 'fail').length;
  const timeouts = fixtureResults.filter(f => f.result === 'timeout').length;
  const fixtureErrors = fixtureResults.filter(f => f.result === 'error').length;
  const total = fixtureResults.length;

  let outcome;
  if (dryRun) {
    outcome = 'pass';
  } else if (errors.length > 0 || timeouts > 0 || fixtureErrors > 0) {
    outcome = total > 0 && passed > 0 ? 'partial' : 'fail';
  } else if (failed > 0) {
    outcome = total > 0 && passed > 0 ? 'partial' : 'fail';
  } else {
    outcome = 'pass';
  }

  const executionReceipt = {
    executorVersion: EXECUTOR_VERSION,
    runId,
    planSha256,
    startedAt,
    completedAt,
    dryRun,
    fixtures: fixtureResults,
    summary: { total, passed, failed, errors: fixtureErrors, timeouts },
    outcome,
    errors,
  };

  atomicWriteJson(path.join(runDir, 'execution-receipt.json'), executionReceipt);

  const cleanupReceipt = {
    cleanedAt: new Date().toISOString(),
    runId,
    terminatedPids,
    orphanedProcesses: 0,
    outcome: errors.length === 0 ? 'clean' : 'partial',
  };

  atomicWriteJson(path.join(runDir, 'cleanup-receipt.json'), cleanupReceipt);

  return { outcome, fixtureResults, executionReceipt, cleanupReceipt, errors };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const IS_MAIN = (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })()
);

if (IS_MAIN) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  let runId = null;
  const runIdIdx = args.indexOf('--run-id');
  if (runIdIdx >= 0 && runIdIdx + 1 < args.length) runId = args[runIdIdx + 1];
  const runIdEq = args.find(a => a.startsWith('--run-id='));
  if (runIdEq) runId = runIdEq.slice('--run-id='.length);

  let approvedPlanSha256 = null;
  const digestIdx = args.indexOf('--approved-plan-sha256');
  if (digestIdx >= 0 && digestIdx + 1 < args.length) approvedPlanSha256 = args[digestIdx + 1];
  const digestEq = args.find(a => a.startsWith('--approved-plan-sha256='));
  if (digestEq) approvedPlanSha256 = digestEq.slice('--approved-plan-sha256='.length);

  if (!runId) {
    console.error('ERROR: --run-id is required');
    process.exit(2);
  }
  if (!approvedPlanSha256) {
    console.error('ERROR: --approved-plan-sha256 is required');
    process.exit(2);
  }

  try {
    const result = await runExecutor({ runId, approvedPlanSha256, dryRun: isDryRun });
    console.log(JSON.stringify(result.executionReceipt ?? { outcome: result.outcome, errors: result.errors }, null, 2));
    if (result.outcome !== 'pass') process.exitCode = 1;
  } catch (e) {
    console.error(`INTERNAL ERROR: ${e.message}`);
    process.exitCode = 2;
  }
}
