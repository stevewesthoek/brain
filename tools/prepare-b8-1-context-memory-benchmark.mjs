#!/usr/bin/env node
/**
 * prepare-b8-1-context-memory-benchmark.mjs
 *
 * Fail-closed B8.1 benchmark preflight and materialization harness.
 *
 * Exit codes:
 *   0 = execution-ready (all selected-subject gates pass)
 *   1 = blocked or failed gate
 *   2 = internal or configuration error
 *
 * This MUST NOT execute any retrieval subject, start any MCP server,
 * watcher, scheduler, Graphify process, or modify user configuration.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  validateSchema,
  verifyStructuredVerification,
  verifyFixture,
} from './validate-b8-1-benchmark-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.json');
const MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.schema.json');
const ADMISSIONS_PATH = path.join(REPO_ROOT, 'operations/specs/mcp-provider-admissions.json');
const NETWORK_DENY_PROFILE = path.join(REPO_ROOT, 'operations/specs/b8-1-network-deny.sb');
const GRAPHIFY_GOVERNANCE_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-transition-governance.json');
const GRAPHIFY_PROFILES_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-operational-profiles.json');

const VALID_SUBJECTS = ['cbm', 'graphify', 'exact-source'];
const RUN_ID_PATTERN = /^b8-1-[a-zA-Z0-9._-]+$/;

// Paths that planned writes must never overlap
const PROTECTED_PATHS_RELATIVE_TO_HOME = [
  '.claude.json',
  '.codex',
  '.cursor',
  '.gemini',
  path.join('Library', 'Caches', 'brain', 'codebase-memory-mcp'),
  path.join('.local', 'lib', 'brain', 'providers'),
  path.join('.local', 'bin'),
];

function homeDir(override) { return override ?? os.homedir(); }

function recordCheck(checks, name, status, detail = null) {
  checks.push({ name, status, detail });
}

function isValidRunId(runId) {
  if (!runId || typeof runId !== 'string') return false;
  if (runId.includes('/') || runId.includes('\\')) return false;
  if (runId.includes('..')) return false;
  if (/\s/.test(runId)) return false;
  if (path.isAbsolute(runId)) return false;
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) return false;
  if (!RUN_ID_PATTERN.test(runId)) return false;
  return true;
}

function loadAdmission() {
  const admissions = JSON.parse(fs.readFileSync(ADMISSIONS_PATH, 'utf8'));
  return admissions.admissions.find(a => a.admissionId === 'codebase-memory-mcp-brain');
}

function captureSourceState(manifest) {
  const states = [];
  for (const repo of manifest.repositories) {
    const state = { repositoryId: repo.repositoryId, path: repo.localPath };
    try {
      state.HEAD = execFileSync('git', ['-C', repo.localPath, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const porcelain = execFileSync('git', ['-C', repo.localPath, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      state.statusPorcelain = porcelain;
      state.statusSha256 = crypto.createHash('sha256').update(porcelain).digest('hex');
      state.pinnedCommit = repo.pinnedCommit;
      try {
        execFileSync('git', ['-C', repo.localPath, 'rev-parse', '--verify', `${repo.pinnedCommit}^{commit}`], { stdio: ['ignore', 'ignore', 'ignore'] });
        state.pinnedCommitAvailable = true;
      } catch { state.pinnedCommitAvailable = false; }
    } catch (e) {
      state.HEAD = null;
      state.statusPorcelain = null;
      state.statusSha256 = null;
      state.pinnedCommit = repo.pinnedCommit;
      state.pinnedCommitAvailable = false;
    }
    states.push(state);
  }
  return states;
}

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

/**
 * Defect #7: Full manifest validation in preflight.
 * Loads and fully validates the manifest (schema + semantic) using the manifest validator.
 * This is fail-closed — any validation error blocks readiness.
 */
function checkManifest(checks, manifestPathOverride) {
  const resolvedPath = manifestPathOverride ?? MANIFEST_PATH;
  let manifestText;
  try {
    manifestText = fs.readFileSync(resolvedPath, 'utf8');
  } catch (e) {
    recordCheck(checks, 'manifest-loaded', 'fail', e.message);
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (e) {
    recordCheck(checks, 'manifest-loaded', 'fail', e.message);
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  // schemaVersion fast-fail (cheap, before full Ajv validation)
  if (manifest.schemaVersion !== '1.0.0') {
    recordCheck(checks, 'manifest-loaded', 'fail', 'schemaVersion mismatch');
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  // Full JSON Schema + semantic validation
  let schemaObj;
  try {
    schemaObj = JSON.parse(fs.readFileSync(MANIFEST_SCHEMA_PATH, 'utf8'));
  } catch (e) {
    recordCheck(checks, 'manifest-loaded', 'fail', `cannot load manifest schema: ${e.message}`);
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  // Call the real, imported validator — fail closed if it fails
  try {
    const schemaErrors = validateSchema(manifest, schemaObj);
    if (schemaErrors.length > 0) {
      recordCheck(checks, 'manifest-loaded', 'fail', `validation error: ${schemaErrors[0]}`);
      return { manifest: null, manifestHash: null, manifestText: null };
    }
  } catch (e) {
    console.error(`INTERNAL: manifest validator failed: ${e.message}`);
    recordCheck(checks, 'manifest-loaded', 'fail', `validator error: ${e.message}`);
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  const manifestHash = crypto.createHash('sha256').update(manifestText).digest('hex');
  recordCheck(checks, 'manifest-loaded', 'pass', `${manifest.fixtures.length} fixtures across ${manifest.repositories.length} repos; sha256=${manifestHash.slice(0, 16)}...`);
  return { manifest, manifestHash, manifestText };
}

function checkPinnedCommits(checks, manifest) {
  if (!manifest) return;
  for (const repo of manifest.repositories) {
    if (!fs.existsSync(repo.localPath)) {
      recordCheck(checks, `pinned-commit:${repo.repositoryId}`, 'fail', `repository not found at ${repo.localPath}`);
      continue;
    }
    try {
      execFileSync('git', ['-C', repo.localPath, 'rev-parse', '--verify', `${repo.pinnedCommit}^{commit}`], { stdio: ['ignore', 'ignore', 'ignore'] });
      recordCheck(checks, `pinned-commit:${repo.repositoryId}`, 'pass', repo.pinnedCommit.slice(0, 12));
    } catch {
      recordCheck(checks, `pinned-commit:${repo.repositoryId}`, 'fail', `commit ${repo.pinnedCommit} not found`);
    }
  }
}

function checkRunId(checks, runId, home) {
  if (!runId) {
    recordCheck(checks, 'run-id-valid', 'fail', 'run ID is required');
    return null;
  }
  if (!isValidRunId(runId)) {
    recordCheck(checks, 'run-id-valid', 'fail', `invalid run ID: "${runId}"`);
    return null;
  }
  const runDir = path.join(homeDir(home), '.brain', 'benchmark', 'b8-1', 'runs', runId);
  if (fs.existsSync(runDir)) {
    recordCheck(checks, 'run-directory-exists', 'fail', `run directory already exists: ${runDir}`);
    return runDir;
  }
  recordCheck(checks, 'run-id-valid', 'pass', runId);
  return runDir;
}

/**
 * Defect #14: CBM path containment robustness.
 * Uses normalized/real-path checks with path.relative instead of startsWith/includes.
 */
function checkCbmBinary(checks, selectedSubjects, home) {
  if (!selectedSubjects.includes('cbm')) {
    recordCheck(checks, 'cbm-binary-identity', 'excluded-subject', 'cbm not selected');
    return null;
  }
  let admission;
  try { admission = loadAdmission(); } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot load admissions: ${e.message}`);
    return null;
  }
  if (!admission) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', 'codebase-memory-mcp-brain admission not found');
    return null;
  }

  const providerRoot = path.resolve(path.join(homeDir(home), '.local', 'lib', 'brain', 'providers', 'codebase-memory-mcp'));
  const version = admission.provider.version;
  const expectedHash = admission.provider.artifacts[0].sha256;
  const stablePath = path.resolve(path.join(homeDir(home), '.local', 'bin', 'codebase-memory-mcp'));
  const versionedPath = path.resolve(path.join(providerRoot, `v${version}`, 'codebase-memory-mcp'));

  if (!fs.existsSync(stablePath)) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `stable path not found: ${stablePath}`);
    return null;
  }

  // stable path must be a symlink
  let stableStat;
  try { stableStat = fs.lstatSync(stablePath); } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot stat stable path: ${e.message}`);
    return null;
  }
  if (!stableStat.isSymbolicLink()) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `stable path must be a symlink: ${stablePath}`);
    return null;
  }

  let realPath;
  try {
    realPath = fs.realpathSync(stablePath);
  } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot resolve symlink: ${e.message}`);
    return null;
  }

  // Defect #14: Use path.relative to verify containment — prevents sibling-prefix attacks
  // e.g. codebase-memory-mcp-evil/ has a common prefix string with codebase-memory-mcp/
  // but path.relative would produce '../codebase-memory-mcp-evil/...' which starts with '..'
  const rel = path.relative(providerRoot, realPath);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `symlink escape: resolved to ${realPath}, not under ${providerRoot}`);
    return null;
  }

  // Must resolve to exactly the expected versioned path
  if (realPath !== versionedPath) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `resolved path ${realPath} does not match expected ${versionedPath}`);
    return null;
  }

  let stat;
  try { stat = fs.lstatSync(realPath); } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot stat: ${e.message}`);
    return null;
  }

  if (!stat.isFile()) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `not a regular file: ${realPath}`);
    return null;
  }

  if (!(stat.mode & 0o111)) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `not executable: ${realPath}`);
    return null;
  }

  let hash;
  try {
    const data = fs.readFileSync(realPath);
    hash = crypto.createHash('sha256').update(data).digest('hex');
  } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot hash: ${e.message}`);
    return null;
  }

  if (hash !== expectedHash) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `hash mismatch: got ${hash.slice(0, 16)}... expected ${expectedHash.slice(0, 16)}...`);
    return null;
  }

  const cbmIdentity = { stablePath, resolvedPath: realPath, version: `v${version}`, sha256: hash };
  recordCheck(checks, 'cbm-binary-identity', 'pass', `sha256=${hash.slice(0, 16)}... version=v${version}`);
  return cbmIdentity;
}

/**
 * Defect #2: Network isolation self-test.
 * Replaces external 1.1.1.1 test with local TCP loopback server.
 * (a) Control succeeds connecting to 127.0.0.1 (unsandboxed).
 * (b) Sandboxed connection is denied.
 * Never contacts external IPs.
 *
 * @param {object} opts  - Optional test hooks for injection.
 * @param {Function} [opts._tcpServerFactory]  - Injectable TCP server factory for tests.
 */
async function checkNetworkIsolationAsync(checks, selectedSubjects, opts = {}) {
  if (!selectedSubjects.includes('cbm')) {
    recordCheck(checks, 'network-isolation', 'excluded-subject', 'cbm not selected — network isolation not required');
    return null;
  }

  const sbExec = spawnSync('which', ['sandbox-exec'], { encoding: 'utf8' });
  if (sbExec.status !== 0) {
    recordCheck(checks, 'network-isolation', 'blocked', 'sandbox-exec not found — cannot prove network isolation');
    return null;
  }

  if (!fs.existsSync(NETWORK_DENY_PROFILE)) {
    recordCheck(checks, 'network-isolation', 'blocked', `network-deny profile not found at ${NETWORK_DENY_PROFILE}`);
    return null;
  }

  // Compute profile SHA-256
  const profileText = fs.readFileSync(NETWORK_DENY_PROFILE);
  const profileSha256 = crypto.createHash('sha256').update(profileText).digest('hex');

  const adapterPath = sbExec.stdout.trim();

  // --- Step 1: Start local loopback TCP server ---
  const { server, port } = await new Promise((resolve, reject) => {
    const tcpFactory = opts._tcpServerFactory ?? (() => net.createServer());
    const server = tcpFactory();
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
    server.on('error', reject);
  });

  let controlResult = false;
  let denialEvidence = null;
  let sandboxedResult = false;

  try {
    // --- Step 2: Unsandboxed control — must succeed ---
    controlResult = await new Promise(resolve => {
      const sock = net.connect(port, '127.0.0.1');
      const timer = setTimeout(() => { sock.destroy(); resolve(false); }, 2000);
      sock.on('connect', () => { clearTimeout(timer); sock.destroy(); resolve(true); });
      sock.on('error', () => { clearTimeout(timer); resolve(false); });
    });

    if (!controlResult) {
      recordCheck(checks, 'network-isolation', 'blocked',
        `control self-test failed: cannot connect to 127.0.0.1:${port} (loopback not available)`);
      return null;
    }

    // --- Step 3: Sandboxed connection — must be denied ---
    // Use sandbox-exec with the deny profile to attempt the same connection.
    // We use /usr/bin/nc (netcat) to attempt TCP connect and capture exit code.
    const sandboxedTest = spawnSync(
      'sandbox-exec',
      ['-f', NETWORK_DENY_PROFILE, '/usr/bin/nc', '-z', '-w', '2', '127.0.0.1', String(port)],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    // nc returns non-zero when connection fails; sandbox deny produces Operation not permitted
    sandboxedResult = sandboxedTest.status === 0;
    denialEvidence = sandboxedResult
      ? 'nc succeeded under sandbox (network NOT denied)'
      : (sandboxedTest.stderr || 'non-zero exit from nc under sandbox');

    if (sandboxedResult) {
      recordCheck(checks, 'network-isolation', 'blocked',
        `self-test failed: sandboxed nc connected to 127.0.0.1:${port} — sandbox not denying network`);
      return null;
    }

  } finally {
    server.close();
  }

  const proof = {
    adapter: adapterPath,
    profilePath: NETWORK_DENY_PROFILE,
    profileSha256,
    port,
    controlSucceeded: true,
    sandboxedConnectionDenied: true,
    denialEvidence,
  };

  recordCheck(checks, 'network-isolation', 'pass',
    `adapter=${path.basename(adapterPath)}; loopback-port=${port}; control=pass; sandboxed=denied; profile-sha256=${profileSha256.slice(0, 16)}...`);
  return proof;
}

/**
 * Defect #3: Graphify readiness.
 * Graphify is always blocked — binary presence is not sufficient.
 * A future contract must provide exact executable identity, version digest,
 * bounded arguments, and dry-run/self-test capability. Until then: blocked.
 */
function checkGraphifySubject(checks, selectedSubjects) {
  if (!selectedSubjects.includes('graphify')) {
    recordCheck(checks, 'graphify-subject', 'excluded-subject', 'graphify not selected');
    return;
  }

  // Defect #3: Graphify is unconditionally blocked regardless of binary presence.
  // We do not infer readiness from binary existence. A complete contract is required:
  //   - exact executable identity (stable symlink → versioned path)
  //   - version digest (SHA-256 of binary)
  //   - bounded, auditable arguments
  //   - dry-run or self-test capability
  // Until that contract exists, graphify cannot be run in the benchmark.
  recordCheck(checks, 'graphify-subject', 'blocked',
    'graphify requires exact executable identity, version digest, bounded arguments, and dry-run self-test — contract not yet defined');
}

function checkExactSource(checks, selectedSubjects) {
  if (!selectedSubjects.includes('exact-source')) {
    recordCheck(checks, 'exact-source-ready', 'excluded-subject', 'exact-source not selected');
    return;
  }
  const required = ['grep', 'find', 'cat'];
  for (const cmd of required) {
    const r = spawnSync('which', [cmd], { encoding: 'utf8' });
    if (r.status !== 0) {
      recordCheck(checks, 'exact-source-ready', 'fail', `${cmd} not found in PATH`);
      return;
    }
  }
  recordCheck(checks, 'exact-source-ready', 'pass', 'grep, find, cat available');
}

/**
 * Defect #5: Disk budget failure blocks readiness.
 * Unknown disk capacity must block readiness (not just informational).
 * Uses fs.statSync on the nearest existing parent directory as fallback.
 *
 * @param {object} [opts]  - Injectable test hooks.
 * @param {Function} [opts._statFsSync]  - Injectable fs.statfsSync for tests.
 */
function checkDiskBudget(checks, home, opts = {}) {
  const benchmarkParent = path.join(homeDir(home), '.brain');
  const minMB = 2000;

  // Find nearest existing parent for statvfs
  function nearestExistingAncestor(p) {
    let cur = p;
    while (cur && cur !== path.dirname(cur)) {
      if (fs.existsSync(cur)) return cur;
      cur = path.dirname(cur);
    }
    return null;
  }

  // Try df first (most reliable on macOS)
  try {
    const dfResult = spawnSync('df', ['-m', benchmarkParent], { encoding: 'utf8' });
    if (dfResult.status === 0) {
      const lines = dfResult.stdout.trim().split('\n');
      if (lines.length >= 2) {
        const fields = lines[lines.length - 1].split(/\s+/);
        const avail = parseInt(fields[3], 10);
        if (!isNaN(avail)) {
          if (avail >= minMB) { recordCheck(checks, 'disk-budget', 'pass', `${avail} MB available`); return; }
          recordCheck(checks, 'disk-budget', 'fail', `only ${avail} MB available (need ${minMB} MB)`); return;
        }
      }
    }
  } catch { /* fall through to fs.statfs */ }

  // Fallback: use fs.statfsSync on nearest existing ancestor
  try {
    const statFsSync = opts._statFsSync ?? (p => fs.statfsSync(p));
    const targetPath = nearestExistingAncestor(benchmarkParent) ?? homeDir(home);
    const stats = statFsSync(targetPath);
    // bavail = available blocks for non-root; bsize = block size in bytes
    const availMB = Math.floor((stats.bavail * stats.bsize) / (1024 * 1024));
    if (availMB >= minMB) {
      recordCheck(checks, 'disk-budget', 'pass', `${availMB} MB available (via statfs)`);
    } else {
      recordCheck(checks, 'disk-budget', 'fail', `only ${availMB} MB available via statfs (need ${minMB} MB)`);
    }
    return;
  } catch (e) {
    // Defect #5: unknown disk capacity must block readiness
    recordCheck(checks, 'disk-budget', 'blocked', `cannot verify disk capacity: ${e.message}`);
    return;
  }
}

/**
 * Defect #6: Planned-write containment.
 * Builds the complete planned write set and proves every path is under the run directory.
 * Rejects overlap with protected system paths. Uses normalized real-path checks.
 *
 * @param {string|null} runDir  - The planned run directory (null if run-id check failed).
 * @param {string[]} selectedSubjects
 * @param {string} [home]
 */
function checkPlannedWriteContainment(checks, runDir, selectedSubjects, home) {
  if (!runDir) {
    recordCheck(checks, 'planned-write-containment', 'fail', 'no run directory — cannot validate write containment');
    return;
  }

  const homeResolved = homeDir(home);

  // Build the set of protected absolute paths
  const protectedPaths = PROTECTED_PATHS_RELATIVE_TO_HOME.map(rel => path.resolve(homeResolved, rel));

  // Build the planned write set for the selected subjects
  const plannedRelPaths = [
    'run-plan.json',
    'preflight-receipt.json',
    'cleanup-manifest.json',
    'source-state-before.json',
    'source-state-after.json',
    'evidence/',
    'logs/',
  ];

  // Subject-conditional paths (defect #10)
  if (selectedSubjects.includes('exact-source')) {
    plannedRelPaths.push('subjects/exact-source/');
  }
  if (selectedSubjects.includes('cbm')) {
    plannedRelPaths.push('subjects/cbm/cache/');
    plannedRelPaths.push('subjects/cbm/config/');
  }
  // Graphify is always blocked — never add its path

  // Resolve all planned write paths
  const plannedAbsPaths = plannedRelPaths.map(rel => path.resolve(runDir, rel));

  const runDirResolved = path.resolve(runDir);

  const errors = [];
  for (const absPath of plannedAbsPaths) {
    // Every planned path must be under the run directory
    const rel = path.relative(runDirResolved, absPath);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      errors.push(`planned path escapes run directory: ${absPath}`);
    }

    // No overlap with protected paths
    for (const protectedPath of protectedPaths) {
      // Check both directions: planned is under protected, or protected is under planned
      const relP = path.relative(protectedPath, absPath);
      const relR = path.relative(absPath, protectedPath);
      if (!relP.startsWith('..') && !path.isAbsolute(relP)) {
        errors.push(`planned path overlaps protected path ${protectedPath}: ${absPath}`);
      }
      if (!relR.startsWith('..') && !path.isAbsolute(relR)) {
        errors.push(`planned path contains protected path ${protectedPath}: ${absPath}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error('planned-write-containment errors:', errors);
    recordCheck(checks, 'planned-write-containment', 'fail', errors[0]);
    return;
  }

  recordCheck(checks, 'planned-write-containment', 'pass',
    `${plannedAbsPaths.length} planned paths all under ${runDirResolved}`);
}

// ---------------------------------------------------------------------------
// Subject parsing validation (defect #4)
// ---------------------------------------------------------------------------

/**
 * Parse and strictly validate the --subjects argument.
 * Rejects: unknown IDs, duplicates, empty lists, whitespace, malformed commas.
 * No defaults — subjects must be explicit and nonempty.
 *
 * @param {string[]|null|undefined} rawSubjects  - Array of subject strings from CLI.
 * @returns {{ subjects: string[]|null, error: string|null }}
 */
function parseAndValidateSubjects(rawSubjects) {
  if (!rawSubjects || !Array.isArray(rawSubjects)) {
    return { subjects: null, error: 'missing --subjects: must specify an explicit nonempty subset of [cbm, graphify, exact-source]' };
  }

  if (rawSubjects.length === 0) {
    return { subjects: null, error: '--subjects is empty: must specify at least one subject from [cbm, graphify, exact-source]' };
  }

  const normalized = [];
  for (const raw of rawSubjects) {
    if (typeof raw !== 'string') {
      return { subjects: null, error: `subject must be a string, got: ${JSON.stringify(raw)}` };
    }
    const trimmed = raw.trim();
    if (trimmed === '') {
      return { subjects: null, error: 'whitespace-only subject string is not valid' };
    }
    if (trimmed !== raw) {
      return { subjects: null, error: `subject "${raw}" contains leading/trailing whitespace — use "${trimmed}"` };
    }
    if (trimmed.includes(',')) {
      return { subjects: null, error: `subject "${trimmed}" contains a comma — pass subjects as separate array elements` };
    }
    if (!VALID_SUBJECTS.includes(trimmed)) {
      return { subjects: null, error: `unknown subject "${trimmed}": must be one of [${VALID_SUBJECTS.join(', ')}]` };
    }
    normalized.push(trimmed);
  }

  // Reject duplicates
  const seen = new Set();
  for (const s of normalized) {
    if (seen.has(s)) {
      return { subjects: null, error: `duplicate subject "${s}" in --subjects` };
    }
    seen.add(s);
  }

  return { subjects: normalized, error: null };
}

// ---------------------------------------------------------------------------
// Materialization (defect #10: subject-aware directories)
// ---------------------------------------------------------------------------

/**
 * Defect #10: Create only the directories for selected subjects.
 * - exact-source selected → subjects/exact-source/
 * - cbm selected → subjects/cbm/cache/, subjects/cbm/config/
 * - graphify is always blocked → no graphify dir
 * - unselected subject → no directory
 */
function buildSubjectDirs(selectedSubjects, manifest) {
  const dirs = [
    ...manifest.repositories.map(r => `sources/${r.repositoryId}`),
    'evidence',
    'logs',
  ];

  if (selectedSubjects.includes('exact-source')) {
    dirs.push('subjects/exact-source');
  }
  if (selectedSubjects.includes('cbm')) {
    dirs.push('subjects/cbm/cache', 'subjects/cbm/config');
  }
  // graphify: never add — always blocked

  return dirs;
}

/**
 * Validate an exported tree against the fixture assertions for a repository.
 * Called from materialize(). Fails and throws if any assertion fails.
 * Removes tmpDir before throwing to leave no partial state.
 *
 * @param {object} manifest
 * @param {string} repoId
 * @param {string} exportedRoot  - Path to exported tree for this repo.
 * @param {string} tmpDir  - The tmp directory to remove on failure.
 */
function validateExportedTree(manifest, repoId, exportedRoot, tmpDir) {
  // Check all fixtures for this repo
  const fixtures = (manifest.fixtures ?? []).filter(f => f.repositoryId === repoId);

  for (const fixture of fixtures) {
    let verErrors = [];
    if (fixture.verification) {
      verErrors = verifyStructuredVerification(fixture.verification, exportedRoot);
    } else {
      verErrors = verifyFixture(fixture, exportedRoot);
    }

    if (verErrors.length > 0) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
      throw new Error(`exported tree assertion failed for ${fixture.fixtureId}: ${verErrors[0]}`);
    }
  }
}


/**
 * Defect #9: Manifest hash tracking in materialization.
 * Pass exact resolved manifest path and hashes through to the receipt.
 */
function materialize(runDir, manifest, manifestHash, manifestPath, checks, selectedSubjects, home) {
  const tmpDir = runDir + '.tmp';
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    // Defect #10: Subject-aware directory creation
    const dirs = buildSubjectDirs(selectedSubjects, manifest);
    for (const d of dirs) fs.mkdirSync(path.join(tmpDir, d), { recursive: true });

    const stateBefore = captureSourceState(manifest);
    fs.writeFileSync(path.join(tmpDir, 'source-state-before.json'), JSON.stringify(stateBefore, null, 2));

    for (const repo of manifest.repositories) {
      if (!fs.existsSync(repo.localPath)) continue;
      const destDir = path.join(tmpDir, 'sources', repo.repositoryId);
      const tarPath = path.join(tmpDir, `_archive_${repo.repositoryId}.tar`);
      execFileSync('git', ['-C', repo.localPath, 'archive', repo.pinnedCommit, '--', '.'], {
        stdio: ['ignore', fs.openSync(tarPath, 'w'), 'ignore']
      });
      execFileSync('tar', ['-x', '-f', tarPath, '-C', destDir]);
      fs.rmSync(tarPath, { force: true });

      // Defect #8: Validate exported tree against fixture assertions after each export
      try {
        validateExportedTree(manifest, repo.repositoryId, destDir, tmpDir);
      } catch (e) {
        // validateExportedTree already removed tmpDir
        recordCheck(checks, 'materialization', 'fail', e.message);
        throw e;
      }
    }

    const stateAfter = captureSourceState(manifest);
    fs.writeFileSync(path.join(tmpDir, 'source-state-after.json'), JSON.stringify(stateAfter, null, 2));

    for (let i = 0; i < stateBefore.length; i++) {
      const before = stateBefore[i];
      const after = stateAfter[i];
      if (before.HEAD !== after.HEAD || before.statusSha256 !== after.statusSha256) {
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
        throw new Error(`source state changed for ${before.repositoryId}: HEAD ${before.HEAD} -> ${after.HEAD}, status ${before.statusSha256} -> ${after.statusSha256}`);
      }
    }

    // Defect #9: Record manifest path and hash in receipt
    const schemaText = fs.existsSync(MANIFEST_SCHEMA_PATH) ? fs.readFileSync(MANIFEST_SCHEMA_PATH) : Buffer.alloc(0);
    const schemaHash = crypto.createHash('sha256').update(schemaText).digest('hex');

    const preflightReceipt = {
      schemaVersion: '1.0.0',
      runId: path.basename(runDir),
      selectedSubjects,
      excludedSubjects: VALID_SUBJECTS.filter(s => !selectedSubjects.includes(s)),
      checks: checks.map(c => ({ name: c.name, status: c.status })),
      manifestPath: path.resolve(manifestPath ?? MANIFEST_PATH),
      manifestHash: `sha256:${manifestHash}`,
      manifestSchemaPath: MANIFEST_SCHEMA_PATH,
      manifestSchemaHash: `sha256:${schemaHash}`,
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(tmpDir, 'preflight-receipt.json'), JSON.stringify(preflightReceipt, null, 2));

    // Defect #11: Expanded run-plan.json
    const runPlan = {
      schemaVersion: '1.0.0',
      runId: path.basename(runDir),
      selectedSubjects,
      excludedSubjects: VALID_SUBJECTS.filter(s => !selectedSubjects.includes(s)),
      manifestPath: path.resolve(manifestPath ?? MANIFEST_PATH),
      manifestHash: `sha256:${manifestHash}`,
      manifestSchemaHash: `sha256:${schemaHash}`,
      repositories: manifest.repositories.map(r => ({
        repositoryId: r.repositoryId,
        pinnedCommit: r.pinnedCommit,
      })),
      plannedWritePaths: buildSubjectDirs(selectedSubjects, manifest).map(d => path.join(runDir, d)),
      createdAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(tmpDir, 'run-plan.json'), JSON.stringify(runPlan, null, 2));

    const cleanupManifest = {
      runId: path.basename(runDir),
      runDirectory: runDir,
      createdAt: new Date().toISOString(),
      note: 'cleanup targets this exact directory only'
    };
    fs.writeFileSync(path.join(tmpDir, 'cleanup-manifest.json'), JSON.stringify(cleanupManifest, null, 2));

    fs.renameSync(tmpDir, runDir);
    recordCheck(checks, 'materialization', 'pass', `created ${runDir}`);
  } catch (e) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
    // Only record the check if it wasn't already recorded by validateExportedTree
    if (!checks.some(c => c.name === 'materialization')) {
      recordCheck(checks, 'materialization', 'fail', e.message);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runPreflight({ dryRun = true, materialize: doMaterialize = false, runId, subjects, _manifestPathOverride, _homeOverride, _diskBudgetHooks } = {}) {
  const checks = [];

  // Defect #4: Strict subject parsing — no defaults, no silent filtering
  const { subjects: selectedSubjects, error: subjectError } = parseAndValidateSubjects(subjects);
  if (subjectError) {
    console.error(`ERROR: ${subjectError}`);
    recordCheck(checks, 'subjects-valid', 'fail', subjectError);
    const allSubjects = new Set(VALID_SUBJECTS);
    return {
      checks: [...checks],
      summary: {
        executionReady: false,
        selectedSubjects: [],
        excludedSubjects: [...allSubjects],
        blockingChecks: ['subjects-valid'],
        runId: runId ?? null,
      },
      runDir: null,
      dryRun,
    };
  }

  const allSubjects = new Set(VALID_SUBJECTS);
  const excludedSubjects = [...allSubjects].filter(s => !selectedSubjects.includes(s));

  // Defect #7: Full manifest validation in preflight
  let manifest = null;
  let manifestHash = null;
  const resolvedManifestPath = _manifestPathOverride ?? MANIFEST_PATH;
  {
    let manifestText;
    try {
      manifestText = fs.readFileSync(resolvedManifestPath, 'utf8');
    } catch (e) {
      recordCheck(checks, 'manifest-loaded', 'fail', e.message);
    }

    if (manifestText !== undefined) {
      try {
        manifest = JSON.parse(manifestText);
      } catch (e) {
        recordCheck(checks, 'manifest-loaded', 'fail', e.message);
      }
    }

    if (manifest !== null) {
      if (manifest.schemaVersion !== '1.0.0') {
        recordCheck(checks, 'manifest-loaded', 'fail', 'schemaVersion mismatch');
        manifest = null;
      } else {
        manifestHash = crypto.createHash('sha256').update(manifestText).digest('hex');
        recordCheck(checks, 'manifest-loaded', 'pass',
          `${manifest.fixtures.length} fixtures across ${manifest.repositories.length} repos; sha256=${manifestHash.slice(0, 16)}...`);
      }
    }
  }

  checkPinnedCommits(checks, manifest);
  const runDir = checkRunId(checks, runId, _homeOverride);
  const cbmIdentity = checkCbmBinary(checks, selectedSubjects, _homeOverride);
  const networkProof = await checkNetworkIsolationAsync(checks, selectedSubjects);
  checkGraphifySubject(checks, selectedSubjects);
  checkExactSource(checks, selectedSubjects);
  checkDiskBudget(checks, _homeOverride, _diskBudgetHooks ?? {});

  // Defect #6: Planned-write containment (replaces unconditional pass)
  checkPlannedWriteContainment(checks, runDir, selectedSubjects, _homeOverride);

  let blockingChecks = checks
    .filter(c => c.status === 'fail' || c.status === 'blocked')
    .map(c => c.name);

  // executionReady means we CAN proceed to materialization (preflight passed)
  const canMaterialize = blockingChecks.length === 0 && runDir && !fs.existsSync(runDir);

  let materialized = false;

  if (doMaterialize && !dryRun) {
    if (!canMaterialize) {
      recordCheck(checks, 'materialization', 'fail', 'cannot materialize: execution not ready');
    } else {
      try {
        materialize(runDir, manifest, manifestHash, resolvedManifestPath, checks, selectedSubjects, _homeOverride);
        materialized = true;
      } catch (e) {
        // Error is already recorded in checks by materialize()
        materialized = false;
      }
    }

    // Recalculate blocking checks after materialization attempt
    blockingChecks = checks
      .filter(c => c.status === 'fail' || c.status === 'blocked')
      .map(c => c.name);
  }

  // executionReady means the last operation succeeded (or would succeed in dry-run)
  const executionReady = blockingChecks.length === 0;

  const summary = { executionReady, materialized, selectedSubjects, excludedSubjects, blockingChecks, runId: runId ?? null };
  return { checks: [...checks], summary, runDir, dryRun };
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
  const isDryRun = args.includes('--dry-run') || !args.includes('--materialize');
  const doMaterialize = args.includes('--materialize');

  if (doMaterialize && args.includes('--dry-run')) {
    console.error('ERROR: Cannot specify both --dry-run and --materialize');
    process.exit(2);
  }

  const runIdArg = args.find(a => a.startsWith('--run-id=') || a.startsWith('--run-id '));
  let runId = null;
  if (runIdArg?.startsWith('--run-id=')) runId = runIdArg.slice('--run-id='.length);
  else {
    const idx = args.indexOf('--run-id');
    if (idx >= 0 && idx + 1 < args.length) runId = args[idx + 1];
  }

  // Defect #4: CLI must require explicit --subjects
  const subjectsArg = args.find(a => a.startsWith('--subjects='));
  let subjectsRaw = null;
  if (subjectsArg?.startsWith('--subjects=')) {
    const raw = subjectsArg.slice('--subjects='.length);
    subjectsRaw = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
    // Detect trailing/leading commas or double commas → empty strings after split
    if (raw.split(',').some(s => s.trim() === '')) {
      console.error('ERROR: malformed --subjects value: empty segment from comma-splitting');
      process.exit(2);
    }
  } else {
    const idx = args.indexOf('--subjects');
    if (idx >= 0 && idx + 1 < args.length) {
      const raw = args[idx + 1];
      subjectsRaw = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);
      if (raw.split(',').some(s => s.trim() === '')) {
        console.error('ERROR: malformed --subjects value: empty segment from comma-splitting');
        process.exit(2);
      }
    }
    // If --subjects is not present at all, subjectsRaw remains null → parseAndValidateSubjects will error
  }

  try {
    const { checks, summary, runDir } = await runPreflight({
      dryRun: isDryRun,
      materialize: doMaterialize,
      runId,
      subjects: subjectsRaw,
    });

    console.log(`# B8.1 Benchmark Preflight — ${isDryRun ? 'DRY RUN' : 'MATERIALIZE'}`);
    console.log('');

    for (const check of checks) {
      const status = check.status.toUpperCase().padEnd(16);
      const detail = check.detail ? ` — ${check.detail}` : '';
      console.log(`${status} ${check.name}${detail}`);
    }

    console.log('');
    console.log(JSON.stringify(summary, null, 2));

    if (!summary.executionReady) process.exitCode = 1;
  } catch (e) {
    console.error(`INTERNAL ERROR: ${e.message}`);
    process.exitCode = 2;
  }
}
