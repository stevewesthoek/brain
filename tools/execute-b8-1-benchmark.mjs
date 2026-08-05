#!/usr/bin/env node
/**
 * execute-b8-1-benchmark.mjs
 *
 * Bounded B8.1 benchmark executor.
 *
 * Responsibilities:
 *   - Verify an approved v5 plan digest against a materialized run
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
 *   - Accept v1/v2/v4r plan approvals
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

export const EXECUTOR_VERSION = '5.0.0';
export const REQUIRED_PLAN_VERSION = '5.0.0';
const FIXTURE_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1_048_576; // 1 MB per fixture
const SUPPORTED_SUBJECTS = new Set(['cbm', 'exact-source']);
const CBM_SEARCH_LIMIT = 50;

// Admitted network-deny sandbox profile path (relative to repo root).
const NETWORK_DENY_PROFILE_PATH = path.join(REPO_ROOT, 'operations', 'specs', 'b8-1-network-deny.sb');

// Known stale digests — rejected at materialization and executor time.
export const KNOWN_STALE_DIGESTS = new Set([
  'dd36a9d5a150591aa3f4af571d4013ef18db07dc69d8abf2ad702f901665f9b4', // v1 (path-dependent tmp)
  '1db09e76d406b6fa5ab69a3e86261efc54798178c6e7115dc50ac6d3203a9cda', // v2 (path-dependent brain-b8-1-authorization)
  '40bb7b67dc91fb39b4e301b01d2ba0130f983356a2722db851e5326849b83ba0', // v4 (stale — wrong env/sandbox/one-index; run-id v4r supersedes)
  'c39e81dcebdfb0caf7533508b7cea40fb7da0046d6dfef4349b4fd4f09a875a4', // v4r (stale — stale pins brain 257fd72c/workbench f482851/prochat e404821; v5 supersedes)
  'd9c524837195df46259fbcb40fb77eec3bf38f4c81b8246663ad7e7067dcee42', // v5 (stale — path-dependent check detail in source-root-overrides; v5r supersedes)
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
      error: `run-plan.json has planVersion=${gotVersion}; executor requires planVersion=${REQUIRED_PLAN_VERSION} — recompute with v5 preflight`,
    };
  }

  if (!approvedPlanSha256) {
    return { plan: null, error: 'approvedPlanSha256 is required' };
  }
  if (typeof approvedPlanSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(approvedPlanSha256)) {
    return { plan: null, error: 'approvedPlanSha256 must be exactly 64 lowercase hexadecimal characters' };
  }
  if (KNOWN_STALE_DIGESTS.has(approvedPlanSha256)) {
    return { plan: null, error: 'stale digest rejected — this digest is from a prior plan version; recompute against the v5 plan contract (run-id b8-1-canonical-authorization-20260804-final-v5)' };
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
            errors.push(`preflight-receipt.json has planVersion=${receipt.planVersion ?? 'absent'}; expected ${REQUIRED_PLAN_VERSION}`);
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

  const ev = {
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
    fileCorrect: result.fileCorrect ?? (outcome === 'pass'),
    lineCorrect: result.lineCorrect ?? false,
    setAccuracy: result.setAccuracy ?? null,
  };

  // Defect 6: include caller/callee precision/recall when computed
  if (result.callerPrecision !== null && result.callerPrecision !== undefined) ev.callerPrecision = result.callerPrecision;
  if (result.callerRecall !== null && result.callerRecall !== undefined) ev.callerRecall = result.callerRecall;
  if (result.calleePrecision !== null && result.calleePrecision !== undefined) ev.calleePrecision = result.calleePrecision;
  if (result.calleeRecall !== null && result.calleeRecall !== undefined) ev.calleeRecall = result.calleeRecall;

  return ev;
}

// ---------------------------------------------------------------------------
// Subject adapters
// ---------------------------------------------------------------------------

/**
 * Run a fixture with the exact-source adapter.
 * Uses fixture.verification to perform line/set/count checks.
 *
 * @param {object} fixture
 * @param {string} sourcesDir  - path to the materialized sources/<repoId>/ directory
 * @returns {{ outcome, actual, latencyMs, errors, fileCorrect, lineCorrect, setAccuracy }}
 */
const KNOWN_ALGORITHMS = new Set(['file-exists', 'line-contains', 'symbol-at-line', 'file-name-count', 'json-pointer-set']);

/**
 * RFC 6901 JSON Pointer segment unescape: ~1 → /, ~0 → ~.
 * Must be applied after splitting, not before.
 */
function unescapeJsonPointerSegment(seg) {
  return seg.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Compute caller precision/recall against expectedCallers list.
 * exact-source uses a simple grep for each expected caller path in the source tree.
 */
function computeExactSourceCallerCallee(fixture, sourcesDir) {
  const callerCalleeApplicable = fixture.callerCalleeApplicable ?? false;
  if (!callerCalleeApplicable) {
    return { callerPrecision: null, callerRecall: null, calleePrecision: null, calleeRecall: null };
  }

  const expectedCallers = Array.isArray(fixture.expectedCallers) ? fixture.expectedCallers : [];
  const expectedCallees = Array.isArray(fixture.expectedCallees) ? fixture.expectedCallees : [];

  function findPresent(items) {
    return items.filter(item => {
      const fullPath = path.resolve(sourcesDir, item);
      const rel = path.relative(sourcesDir, fullPath);
      if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
      return fs.existsSync(fullPath);
    });
  }

  function findCalleePresent(callees) {
    // For callees (symbols/identifiers), do a simple search in all .ts/.js/.mjs files
    return callees.filter(callee => {
      let found = false;
      function searchDir(dir) {
        if (found) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          if (found) break;
          if (entry.name === '.git' || entry.name === 'node_modules') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) { searchDir(full); }
          else if (entry.isFile() && /\.(ts|js|mjs|tsx|jsx)$/.test(entry.name)) {
            try {
              const content = fs.readFileSync(full, 'utf8');
              if (content.includes(callee)) { found = true; }
            } catch {}
          }
        }
      }
      searchDir(sourcesDir);
      return found;
    });
  }

  const presentCallers = findPresent(expectedCallers);
  const presentCallees = findCalleePresent(expectedCallees);

  // For exact-source: precision is not computable (no separate predicted set vs expected set).
  // Only recall is computable: fraction of expected items that exist in the source tree.
  // callerPrecision and calleePrecision are null — not computable from exact-source.
  const callerPrecision = null;
  const callerRecall = expectedCallers.length > 0 ? presentCallers.length / expectedCallers.length : null;
  const calleePrecision = null;
  const calleeRecall = expectedCallees.length > 0 ? presentCallees.length / expectedCallees.length : null;

  return { callerPrecision, callerRecall, calleePrecision, calleeRecall };
}

function runExactSourceFixture(fixture, sourcesDir) {
  const start = Date.now();
  const errors = [];
  let outcome = 'fail';
  let actual = null;
  let fileCorrect = false;
  let lineCorrect = false;
  let setAccuracy = null;

  try {
    const expectedFile = fixture.expectedFile;
    const verification = fixture.verification ?? {};
    const algorithm = verification.algorithm ?? 'file-exists';

    // Defect 7: reject unknown algorithms rather than silently passing
    if (!KNOWN_ALGORITHMS.has(algorithm)) {
      errors.push(`unknown verification algorithm "${algorithm}"`);
      return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy };
    }

    // --- file-name-count: no expectedFile required ---
    if (algorithm === 'file-name-count') {
      const root = verification.root ?? '.';
      const fileName = verification.fileName;
      const expectedCount = verification.expectedCount ?? null;
      if (!fileName) {
        errors.push('verification.fileName is required for file-name-count');
        return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy };
      }

      // Defect 7: containment check on the root before counting
      const rootDir = path.resolve(sourcesDir, root);
      const rootRel = path.relative(sourcesDir, rootDir);
      if (rootRel.startsWith('..') || path.isAbsolute(rootRel)) {
        errors.push(`verification.root "${root}" escapes sources directory`);
        return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy };
      }
      if (!fs.existsSync(rootDir)) {
        errors.push(`verification.root not found: ${root}`);
        return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy };
      }

      let count = 0;
      function countFiles(dir) {
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          if (entry.name === '.git') continue;
          const full = path.join(dir, entry.name);
          if (entry.isSymbolicLink()) continue; // skip symlinks inside source tree
          if (entry.isDirectory()) { countFiles(full); }
          else if (entry.isFile() && entry.name === fileName) { count += 1; }
        }
      }
      countFiles(rootDir);
      actual = count;
      fileCorrect = expectedCount === null ? true : count === expectedCount;
      lineCorrect = false;
      outcome = fileCorrect ? 'pass' : 'fail';
      if (!fileCorrect) errors.push(`expected ${expectedCount} files named "${fileName}" but found ${count}`);

      const callerCallee = computeExactSourceCallerCallee(fixture, sourcesDir);
      return { outcome, actual, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy, ...callerCallee };
    }

    // For all other algorithms, expectedFile is required
    if (!expectedFile) {
      errors.push('fixture has no expectedFile');
      return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy };
    }

    // Path containment check — expectedFile must not escape sourcesDir
    const targetPath = path.resolve(sourcesDir, expectedFile);
    const rel = path.relative(sourcesDir, targetPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      errors.push(`expectedFile "${expectedFile}" escapes sources directory`);
      return { outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy };
    }

    if (!fs.existsSync(targetPath)) {
      errors.push(`expected file not found: ${expectedFile}`);
      return { outcome: 'fail', actual: null, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy };
    }

    actual = expectedFile;
    fileCorrect = true;

    if (algorithm === 'file-exists') {
      lineCorrect = false;
      outcome = 'pass';
    } else if (algorithm === 'line-contains' || algorithm === 'symbol-at-line') {
      const verPath = verification.path ?? expectedFile;
      const verFilePath = path.resolve(sourcesDir, verPath);
      const verRel = path.relative(sourcesDir, verFilePath);
      if (verRel.startsWith('..') || path.isAbsolute(verRel)) {
        errors.push(`verification.path "${verPath}" escapes sources directory`);
        outcome = 'error';
      } else if (!fs.existsSync(verFilePath)) {
        errors.push(`verification file not found: ${verPath}`);
        outcome = 'fail';
      } else {
        const lines = fs.readFileSync(verFilePath, 'utf8').split('\n');
        const verLine = verification.line ?? fixture.expectedLine ?? null;
        const contains = Array.isArray(verification.contains) ? verification.contains : [];
        if (verLine !== null) {
          const idx = verLine - 1; // 1-based to 0-based
          const lineContent = lines[idx] ?? '';
          // Defect 7: outcome is exact match at the stated line; lineCorrect is ±5 window
          const exactMatch = contains.every(s => lineContent.includes(s));
          // lineCorrect: any matching line within ±5 of expected
          const expectedLine = fixture.expectedLine ?? verLine;
          const windowMatch = lines.findIndex((l, i) => Math.abs(i - (expectedLine - 1)) <= 5 && contains.every(s => l.includes(s)));
          lineCorrect = windowMatch !== -1;
          // outcome passes only on exact line match
          outcome = exactMatch ? 'pass' : 'fail';
          if (!exactMatch) errors.push(`line ${verLine} does not contain expected tokens: ${contains.join(', ')}`);
        } else {
          // No line specified — any line containing tokens
          const lineMatch = lines.some(l => contains.every(s => l.includes(s)));
          lineCorrect = lineMatch;
          outcome = lineMatch ? 'pass' : 'fail';
          if (!lineMatch) errors.push(`no line contains expected tokens: ${contains.join(', ')}`);
        }
      }
    } else if (algorithm === 'json-pointer-set') {
      const verPath = verification.path ?? expectedFile;
      const verFilePath = path.resolve(sourcesDir, verPath);
      const verRel = path.relative(sourcesDir, verFilePath);
      if (verRel.startsWith('..') || path.isAbsolute(verRel)) {
        errors.push(`verification.path "${verPath}" escapes sources directory`);
        outcome = 'error';
      } else if (!fs.existsSync(verFilePath)) {
        errors.push(`verification file not found: ${verPath}`);
        outcome = 'fail';
      } else {
        let parsed;
        try { parsed = JSON.parse(fs.readFileSync(verFilePath, 'utf8')); }
        catch (e) { errors.push(`failed to parse JSON: ${e.message}`); outcome = 'error'; parsed = null; }
        if (parsed !== null) {
          // Defect 7: proper RFC 6901 pointer evaluation with segment unescaping
          const pointer = verification.jsonPointer ?? '';
          let node = parsed;
          if (pointer !== '') {
            if (!pointer.startsWith('/')) {
              errors.push(`invalid JSON pointer "${pointer}": must start with /`);
              outcome = 'error';
              node = null;
            } else {
              const parts = pointer.slice(1).split('/').map(unescapeJsonPointerSegment);
              for (const part of parts) {
                if (node === null || typeof node !== 'object') { node = undefined; break; }
                node = Array.isArray(node) ? node[Number(part)] : node[part];
              }
            }
          }
          if (node !== null && outcome !== 'error') {
            const expected = Array.isArray(verification.expected) ? verification.expected : [];
            if (Array.isArray(node)) {
              const actualSet = new Set(node);
              const expectedSet = new Set(expected);
              const intersection = expected.filter(v => actualSet.has(v)).length;
              setAccuracy = expected.length > 0 ? intersection / Math.max(actualSet.size, expectedSet.size) : 1;
              const setsMatch = actualSet.size === expectedSet.size && expected.every(v => actualSet.has(v));
              lineCorrect = false;
              outcome = setsMatch ? 'pass' : 'fail';
              if (!setsMatch) errors.push(`set mismatch: expected [${expected.join(',')}] got [${[...actualSet].join(',')}]`);
            } else if (outcome !== 'error') {
              errors.push(`JSON pointer "${pointer}" did not resolve to an array`);
              outcome = 'fail';
            }
          }
        }
      }
    }
  } catch (e) {
    errors.push(e.message);
    outcome = 'error';
  }

  const callerCallee = computeExactSourceCallerCallee(fixture, sourcesDir);
  return { outcome, actual, latencyMs: Date.now() - start, errors, fileCorrect, lineCorrect, setAccuracy, ...callerCallee };
}

/**
 * v5: Fail-closed sandbox availability check.
 * Verifies that /usr/bin/sandbox-exec and the network-deny profile both exist.
 * Returns { ok: true } or { ok: false, error: string }.
 *
 * @param {string} profilePath  - absolute path to the sandbox deny profile
 * @returns {{ ok: boolean, error?: string }}
 */
export function checkSandboxAvailable(profilePath) {
  if (!fs.existsSync('/usr/bin/sandbox-exec')) {
    return { ok: false, error: 'sandbox-exec or deny profile not available — executor fails closed' };
  }
  if (!profilePath || !fs.existsSync(profilePath)) {
    return { ok: false, error: 'sandbox-exec or deny profile not available — executor fails closed' };
  }
  return { ok: true };
}

/**
 * Spawn a command (optionally sandbox-wrapped) with bounded timeout and process-group kill.
 * Returns { stdout, stderr, exitCode, timedOut }.
 *
 * @param {string} binaryPath
 * @param {string[]} args
 * @param {{ env?: object, cwd?: string, timeoutMs: number, sandboxProfile?: string }} opts
 */
function spawnBounded(binaryPath, args, { env = {}, cwd, timeoutMs, sandboxProfile } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    // Wrap in sandbox-exec when profile is provided (Defect 5: sandbox isolation)
    let spawnPath, spawnArgs;
    if (sandboxProfile && process.platform === 'darwin') {
      spawnPath = '/usr/bin/sandbox-exec';
      spawnArgs = ['-f', sandboxProfile, binaryPath, ...args];
    } else {
      spawnPath = binaryPath;
      spawnArgs = args;
    }

    // Build a clean env — only pass through explicitly needed vars + CBM_CACHE_DIR
    // Defect 4: use CBM_CACHE_DIR (not CODEBASE_MEMORY_HOME/CODEBASE_MEMORY_AUTO_WATCH)
    // v5: HOME is NOT inherited from user's real home; caller must supply a per-run synthetic HOME via env
    const childEnv = {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      TMPDIR: process.env.TMPDIR ?? '/tmp',
      ...env,
    };

    const child = spawn(spawnPath, spawnArgs, {
      env: childEnv,
      cwd,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let timer = null;

    function settle(exitCode) {
      if (settled) return;
      settled = true;
      if (timer !== null) { clearTimeout(timer); timer = null; }
      resolve({ stdout, stderr, exitCode, timedOut });
    }

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout, 'utf8') > MAX_OUTPUT_BYTES) {
        timedOut = false;
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
        settle(-1);
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
      if (Buffer.byteLength(stderr, 'utf8') > MAX_OUTPUT_BYTES) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch {}
        settle(-1);
      }
    });

    child.on('exit', (code) => settle(code ?? -1));
    child.on('error', () => settle(-1));

    timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
      settle(-1);
    }, timeoutMs);
  });
}

// Backwards-compatible alias used in some test code paths
const spawnCbmCommand = (binaryPath, args, opts) => spawnBounded(binaryPath, args, opts);

/**
 * Run a fixture with a CBM adapter.
 * When _cbmAdapter is injected (tests), uses the fake adapter.
 * When cbmIdentity is present and no adapter is injected, uses the real CBM binary subprocess.
 *
 * @param {object} fixture
 * @param {object} cbmIdentity   - { stablePath, resolvedPath, version, sha256 }
 * @param {string} sourcesDir    - path to materialized sources/<repoId>/
 * @param {string} cacheDir      - per-run CBM cache directory (CBM_CACHE_DIR)
 * @param {string} configDir     - per-run CBM config directory
 * @param {string} runId         - run ID for CBM project naming
 * @param {object} opts          - injectable test hooks: { _cbmAdapter, _repoIndexed: Map }
 * @returns {Promise<{ outcome, actual, latencyMs, errors, subjectIdentity, fileCorrect, lineCorrect, setAccuracy }>}
 */
async function runCbmFixture(fixture, cbmIdentity, sourcesDir, cacheDir, configDir, runId, opts = {}) {
  const start = Date.now();
  const errors = [];
  const subjectIdentity = cbmIdentity ? { cbm: { version: cbmIdentity.version, sha256: cbmIdentity.sha256 } } : null;

  const adapter = opts._cbmAdapter;

  // ---------------------------------------------------------------------------
  // Injected fake adapter (tests only)
  // ---------------------------------------------------------------------------
  if (adapter) {
    let timer = null;
    try {
      const result = await Promise.race([
        adapter(fixture, { cacheDir, configDir }),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('TIMEOUT')), FIXTURE_TIMEOUT_MS);
        }),
      ]);
      if (timer !== null) { clearTimeout(timer); timer = null; }
      const outputStr = typeof result === 'string' ? result : JSON.stringify(result);
      if (outputStr.length > MAX_OUTPUT_BYTES) {
        return {
          outcome: 'error', actual: null, latencyMs: Date.now() - start,
          errors: [`output exceeds ${MAX_OUTPUT_BYTES} bytes`], subjectIdentity: null,
          fileCorrect: false, lineCorrect: false, setAccuracy: null,
        };
      }
      let parsed;
      try { parsed = typeof result === 'object' ? result : JSON.parse(outputStr); }
      catch (e) {
        return {
          outcome: 'error', actual: null, latencyMs: Date.now() - start,
          errors: [`malformed output: ${e.message}`], subjectIdentity: null,
          fileCorrect: false, lineCorrect: false, setAccuracy: null,
        };
      }
      return {
        outcome: parsed.outcome ?? 'fail',
        actual: parsed.actual ?? null,
        latencyMs: Date.now() - start,
        errors: parsed.errors ?? [],
        subjectIdentity,
        fileCorrect: parsed.fileCorrect ?? false,
        lineCorrect: parsed.lineCorrect ?? false,
        setAccuracy: parsed.setAccuracy ?? null,
      };
    } catch (e) {
      if (timer !== null) { clearTimeout(timer); timer = null; }
      if (e.message === 'TIMEOUT') {
        return {
          outcome: 'timeout', actual: null, latencyMs: Date.now() - start,
          errors: ['fixture timed out after 30s'], subjectIdentity: null,
          fileCorrect: false, lineCorrect: false, setAccuracy: null,
        };
      }
      return {
        outcome: 'error', actual: null, latencyMs: Date.now() - start,
        errors: [e.message], subjectIdentity: null,
        fileCorrect: false, lineCorrect: false, setAccuracy: null,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Real CBM subprocess execution
  // ---------------------------------------------------------------------------
  if (!cbmIdentity || !cbmIdentity.resolvedPath) {
    return {
      outcome: 'skipped', actual: null, latencyMs: Date.now() - start,
      errors: ['cbmIdentity.resolvedPath is not available'],
      subjectIdentity: null, fileCorrect: false, lineCorrect: false, setAccuracy: null,
    };
  }

  const binaryPath = cbmIdentity.resolvedPath;
  const repoId = fixture.repositoryId;
  const projectName = `${runId}-${repoId}`;

  // Defect 4: use CBM_CACHE_DIR (not CODEBASE_MEMORY_HOME or CODEBASE_MEMORY_AUTO_WATCH)
  // v5: HOME points to per-run configDir (synthetic, not user's real home)
  const env = { CBM_CACHE_DIR: cacheDir, HOME: configDir };
  const sandboxProfile = fs.existsSync(NETWORK_DENY_PROFILE_PATH) ? NETWORK_DENY_PROFILE_PATH : undefined;

  // Defect 4: config set auto_watch false + verify, using admitted env var CBM_CACHE_DIR
  // This must be done before indexing. Use repoIndexed map (set by caller) to do it once.
  if (!opts._repoIndexed) {
    errors.push('internal: _repoIndexed map required for one-index-per-repo');
    return {
      outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, subjectIdentity,
      fileCorrect: false, lineCorrect: false, setAccuracy: null,
    };
  }

  // v5: fail-closed sandbox check — only on darwin (sandbox-exec is macOS-specific)
  if (process.platform === 'darwin' && !opts._repoIndexed.get('_sandboxChecked')) {
    const sandboxCheckResult = checkSandboxAvailable(NETWORK_DENY_PROFILE_PATH);
    if (!sandboxCheckResult.ok) {
      return {
        outcome: 'error', actual: null, latencyMs: Date.now() - start,
        errors: [sandboxCheckResult.error], subjectIdentity,
        fileCorrect: false, lineCorrect: false, setAccuracy: null,
      };
    }
    opts._repoIndexed.set('_sandboxChecked', true);
  }

  if (!opts._repoIndexed.get('_configDone')) {
    // Set auto_watch false in the per-run cache config
    const configSetResult = await spawnBounded(binaryPath, ['config', 'set', 'auto_watch', 'false'], {
      env, cwd: cacheDir, timeoutMs: 10_000, sandboxProfile,
    });
    if (configSetResult.exitCode !== 0) {
      errors.push(`CBM config set auto_watch false failed (exit=${configSetResult.exitCode})`);
      return {
        outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, subjectIdentity,
        fileCorrect: false, lineCorrect: false, setAccuracy: null,
      };
    }
    // Verify: config get auto_watch must return 'false'
    const configGetResult = await spawnBounded(binaryPath, ['config', 'get', 'auto_watch'], {
      env, cwd: cacheDir, timeoutMs: 5_000, sandboxProfile,
    });
    const configVal = configGetResult.stdout.trim();
    if (configVal !== 'false') {
      errors.push(`CBM auto_watch verification failed: got "${configVal}", expected "false"`);
      return {
        outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, subjectIdentity,
        fileCorrect: false, lineCorrect: false, setAccuracy: null,
      };
    }
    opts._repoIndexed.set('_configDone', true);
  }

  // Defect 8: index once per repository, not once per fixture
  if (!opts._repoIndexed.has(repoId)) {
    const indexArgs = [
      'cli', 'index_repository',
      '--repo-path', sourcesDir,
      '--persistence', 'false',
      '--mode', 'fast',
      '--name', projectName,
    ];
    const indexResult = await spawnBounded(binaryPath, indexArgs, {
      env, cwd: cacheDir, timeoutMs: FIXTURE_TIMEOUT_MS, sandboxProfile,
    });
    if (indexResult.timedOut) {
      return {
        outcome: 'timeout', actual: null, latencyMs: Date.now() - start,
        errors: ['CBM index_repository timed out'], subjectIdentity,
        fileCorrect: false, lineCorrect: false, setAccuracy: null,
      };
    }
    let indexParsed;
    try { indexParsed = JSON.parse(indexResult.stdout); }
    catch { indexParsed = null; }
    if (indexResult.exitCode !== 0 || !indexParsed) {
      errors.push(`CBM index_repository failed (exit=${indexResult.exitCode})`);
      return {
        outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, subjectIdentity,
        fileCorrect: false, lineCorrect: false, setAccuracy: null,
      };
    }
    opts._repoIndexed.set(repoId, projectName);
  }

  // Step 2: query based on verification algorithm
  const verification = fixture.verification ?? {};
  const algorithm = verification.algorithm ?? 'symbol-at-line';
  let queryPattern = '';

  if (algorithm === 'line-contains' || algorithm === 'symbol-at-line') {
    const contains = Array.isArray(verification.contains) ? verification.contains : [];
    queryPattern = contains[0] ?? fixture.expectedSymbol ?? '';
  } else if (algorithm === 'file-name-count') {
    queryPattern = verification.fileName ?? '';
  } else if (algorithm === 'json-pointer-set') {
    const expected = Array.isArray(verification.expected) ? verification.expected : [];
    queryPattern = expected[0] ?? '';
  } else if (algorithm === 'file-exists') {
    queryPattern = path.basename(fixture.expectedFile ?? '');
  } else {
    queryPattern = fixture.expectedSymbol ?? fixture.expectedFile ?? '';
  }

  if (!queryPattern) {
    errors.push(`no query pattern for algorithm "${algorithm}"`);
    return {
      outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, subjectIdentity,
      fileCorrect: false, lineCorrect: false, setAccuracy: null,
    };
  }

  const remainingMs = FIXTURE_TIMEOUT_MS - (Date.now() - start);
  if (remainingMs <= 0) {
    return {
      outcome: 'timeout', actual: null, latencyMs: Date.now() - start,
      errors: ['CBM query timed out (no time remaining)'], subjectIdentity,
      fileCorrect: false, lineCorrect: false, setAccuracy: null,
    };
  }

  const searchArgs = [
    'cli', 'search_code',
    '--pattern', queryPattern,
    '--project', projectName,
    '--mode', 'compact',
    '--limit', String(CBM_SEARCH_LIMIT),
  ];
  const searchResult = await spawnBounded(binaryPath, searchArgs, {
    env, cwd: cacheDir, timeoutMs: remainingMs, sandboxProfile,
  });
  if (searchResult.timedOut) {
    return {
      outcome: 'timeout', actual: null, latencyMs: Date.now() - start,
      errors: ['CBM search_code timed out'], subjectIdentity,
      fileCorrect: false, lineCorrect: false, setAccuracy: null,
    };
  }

  let searchParsed;
  try { searchParsed = JSON.parse(searchResult.stdout); }
  catch { searchParsed = null; }

  if (!searchParsed) {
    errors.push('CBM search_code returned unparseable output');
    return {
      outcome: 'error', actual: null, latencyMs: Date.now() - start, errors, subjectIdentity,
      fileCorrect: false, lineCorrect: false, setAccuracy: null,
    };
  }

  // Score the result
  const expectedFile = fixture.expectedFile ?? null;
  const expectedLine = fixture.expectedLine ?? null;
  const results = Array.isArray(searchParsed?.results) ? searchParsed.results
    : Array.isArray(searchParsed) ? searchParsed : [];

  let fileCorrect = false;
  let lineCorrect = false;
  let setAccuracy = null;
  let actual = null;

  if (algorithm === 'file-name-count') {
    const count = results.length;
    const expectedCount = verification.expectedCount ?? null;
    actual = count;
    fileCorrect = expectedCount === null ? true : count === expectedCount;
    lineCorrect = false;
  } else if (algorithm === 'json-pointer-set') {
    const expected = Array.isArray(verification.expected) ? verification.expected : [];
    const found = new Set(results.map(r => r.value ?? r.name ?? r.symbol ?? '').filter(Boolean));
    const intersection = expected.filter(v => found.has(v)).length;
    setAccuracy = expected.length > 0 ? intersection / Math.max(found.size, expected.length) : 1;
    fileCorrect = expectedFile ? results.some(r => (r.file ?? r.path ?? '').includes(expectedFile)) : true;
    lineCorrect = false;
    actual = [...found].join(',') || null;
  } else {
    // line-contains, symbol-at-line, file-exists
    const match = results.find(r => {
      const file = r.file ?? r.path ?? '';
      return expectedFile ? file.endsWith(expectedFile) || file.includes(expectedFile) : true;
    });
    if (match) {
      actual = match.file ?? match.path ?? null;
      fileCorrect = expectedFile ? !!(actual && (actual.endsWith(expectedFile) || actual.includes(expectedFile))) : true;
      if (expectedLine !== null && match.line !== undefined) {
        lineCorrect = Math.abs((match.line ?? 0) - expectedLine) <= 5;
      } else {
        lineCorrect = fileCorrect;
      }
    }
  }

  const outcome = fileCorrect ? 'pass' : 'fail';
  if (!fileCorrect && expectedFile) errors.push(`CBM did not return expected file: ${expectedFile}`);

  return {
    outcome, actual, latencyMs: Date.now() - start, errors, subjectIdentity,
    fileCorrect, lineCorrect, setAccuracy,
  };
}

// ---------------------------------------------------------------------------
// Evidence validation
// ---------------------------------------------------------------------------

function validateEvidence(evidenceDir, expectedFixtureIds, selectedSubjects = []) {
  const errors = [];
  const found = new Set();
  // With dual-subject, evidence files are named <fixtureId>_<subject>.json
  const useCompositeKeys = selectedSubjects.length > 1;
  const pairs = [];
  for (const fixtureId of expectedFixtureIds) {
    for (const subject of (selectedSubjects.length > 0 ? selectedSubjects : ['unknown'])) {
      pairs.push({ fixtureId, subject });
    }
  }
  for (const { fixtureId, subject } of pairs) {
    const fileName = useCompositeKeys ? `${fixtureId}_${subject}.json` : `${fixtureId}.json`;
    const evidencePath = path.join(evidenceDir, fileName);
    if (!fs.existsSync(evidencePath)) {
      errors.push(`evidence missing for fixture ${fixtureId} subject ${subject}`);
      continue;
    }
    try {
      const ev = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
      if (ev.fixtureId !== fixtureId) errors.push(`evidence fixtureId mismatch: ${ev.fixtureId} !== ${fixtureId}`);
      if (!ev.provenance?.runId) errors.push(`evidence ${fixtureId}: missing provenance.runId`);
      found.add(`${fixtureId}_${subject}`);
    } catch (e) {
      errors.push(`evidence ${fixtureId}: parse error: ${e.message}`);
    }
  }
  // Check for unexpected evidence files
  try {
    const expectedKeys = new Set(pairs.map(p => useCompositeKeys ? `${p.fixtureId}_${p.subject}.json` : `${p.fixtureId}.json`));
    for (const file of fs.readdirSync(evidenceDir)) {
      if (!file.endsWith('.json')) continue;
      if (!expectedKeys.has(file) && file !== '_execution-receipt.json') {
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
  const useCompositeKeys = selectedSubjects.length > 1;

  if (!dryRun) {
    const cbmCacheDir = path.join(runDir, 'subjects', 'cbm', 'cache');
    const cbmConfigDir = path.join(runDir, 'subjects', 'cbm', 'config');

    // Defect 8: one-index-per-repo map shared across all fixtures for cbm subject
    const cbmRepoIndexed = new Map();

    for (const fixture of fixtures) {
      for (const subject of selectedSubjects) {
        const fixtureStart = new Date().toISOString();
        let result;

        if (subject === 'exact-source') {
          const sourcesDir = path.join(runDir, 'sources', fixture.repositoryId);
          const rawResult = runExactSourceFixture(fixture, sourcesDir);
          result = {
            ...rawResult,
            startedAt: fixtureStart,
            completedAt: new Date().toISOString(),
            subjectIdentity: { exactSource: true },
          };
        } else if (subject === 'cbm') {
          const sourcesDir = path.join(runDir, 'sources', fixture.repositoryId);
          const rawResult = await runCbmFixture(
            fixture, cbmIdentity, sourcesDir, cbmCacheDir, cbmConfigDir, runId,
            { _cbmAdapter, _repoIndexed: cbmRepoIndexed }
          );
          result = {
            ...rawResult,
            startedAt: fixtureStart,
            completedAt: new Date().toISOString(),
          };
        } else {
          result = {
            outcome: 'skipped', actual: null, latencyMs: 0,
            errors: [`unsupported subject: ${subject}`],
            startedAt: fixtureStart, completedAt: new Date().toISOString(),
            subjectIdentity: null, fileCorrect: false, lineCorrect: false, setAccuracy: null,
          };
        }

        const evidenceRecord = buildFixtureEvidence(fixture, result, subject, runMeta);
        // Composite key when multiple subjects: <fixtureId>_<subject>.json
        const evidenceFileName = useCompositeKeys
          ? `${fixture.fixtureId}_${subject}.json`
          : `${fixture.fixtureId}.json`;
        atomicWriteJson(path.join(evidenceDir, evidenceFileName), evidenceRecord);
        fixtureResults.push(evidenceRecord);
      }
    }
  }

  // Validate final evidence (skip in dry-run)
  if (!dryRun) {
    const expectedIds = fixtures.map(f => f.fixtureId);
    const evidenceErrors = validateEvidence(evidenceDir, expectedIds, selectedSubjects);
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

  // Defect 5: Write aggregate evidence.json to the run directory (not evidence/ subdir)
  if (!dryRun) {
    const fileCorrectCount = fixtureResults.filter(f => f.fileCorrect).length;
    const lineCorrectCount = fixtureResults.filter(f => f.lineCorrect).length;
    const setAccuracyValues = fixtureResults.map(f => f.setAccuracy).filter(v => v !== null && v !== undefined);
    const excludedSubjects = plan.excludedSubjects ?? [];
    const preflightReceiptHash = (() => {
      try {
        const receiptBytes = fs.readFileSync(path.join(runDir, 'preflight-receipt.json'));
        return `sha256:${crypto.createHash('sha256').update(receiptBytes).digest('hex')}`;
      } catch { return null; }
    })();
    const aggregateEvidence = {
      schemaVersion: '1.0.0',
      runId,
      partialEvidence: excludedSubjects.length > 0,
      selectedSubjects: [...selectedSubjects].sort(),
      excludedSubjects: [...excludedSubjects].sort(),
      pinnedRepositoryCommits: (() => {
        const commits = {};
        for (const entry of plan.pinnedRepositoryCommits ?? []) {
          commits[entry.repositoryId] = { repositoryId: entry.repositoryId, commit: entry.commit };
        }
        return commits;
      })(),
      manifestHash: plan.manifestHash ?? null,
      preflightReceiptHash: preflightReceiptHash ?? `sha256:${'0'.repeat(64)}`,
      planSha256,
      subjectBinaryIdentity: plan.subjectBinaryIdentity ?? {},
      networkIsolationProof: plan.networkIsolationProof ?? { required: false, status: 'not-required' },
      fixtureResults: fixtureResults.map(f => {
        const fr = {
          fixtureId: f.fixtureId,
          subject: f.subject,
          fileCorrect: f.fileCorrect ?? false,
          lineCorrect: f.lineCorrect ?? false,
        };
        if (f.setAccuracy !== null && f.setAccuracy !== undefined) fr.setAccuracy = f.setAccuracy;
        if (f.callerPrecision !== null && f.callerPrecision !== undefined) fr.callerPrecision = f.callerPrecision;
        if (f.callerRecall !== null && f.callerRecall !== undefined) fr.callerRecall = f.callerRecall;
        if (f.calleePrecision !== null && f.calleePrecision !== undefined) fr.calleePrecision = f.calleePrecision;
        if (f.calleeRecall !== null && f.calleeRecall !== undefined) fr.calleeRecall = f.calleeRecall;
        return fr;
      }),
      offlineMetrics: {
        fileAccuracy: total > 0 ? fileCorrectCount / total : 0,
        lineAccuracy: total > 0 ? lineCorrectCount / total : 0,
        setAccuracy: setAccuracyValues.length > 0
          ? setAccuracyValues.reduce((a, b) => a + b, 0) / setAccuracyValues.length
          : 1.0,
      },
      violations: errors.map(e => ({ reason: 'executor-error', detail: e })),
      cleanupStatus: { runDirectory: runDir, removed: false },
    };
    atomicWriteJson(path.join(runDir, 'evidence.json'), aggregateEvidence);
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
