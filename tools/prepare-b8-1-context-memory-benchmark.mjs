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
  validateManifest,
  validateSchema,
  verifyStructuredVerification,
  verifyFixture,
  resolveRepositoryPaths,
  removeDeclaredSymlinks,
  validateExportedTreeSymlinks,
} from './validate-b8-1-benchmark-manifest.mjs';
import {
  PLAN_VERSION,
  KNOWN_STALE_DIGESTS,
  computePlanDigest,
  canonicalize,
} from './lib/b8-1-plan-digest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.json');
const MANIFEST_SCHEMA_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.schema.json');
const EVIDENCE_SCHEMA_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-evidence.schema.json');
const ADMISSIONS_PATH = path.join(REPO_ROOT, 'operations/specs/mcp-provider-admissions.json');
const NETWORK_DENY_PROFILE = path.join(REPO_ROOT, 'operations/specs/b8-1-network-deny.sb');
const GRAPHIFY_GOVERNANCE_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-transition-governance.json');
const GRAPHIFY_PROFILES_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-operational-profiles.json');

const VALID_SUBJECTS = ['cbm', 'graphify', 'exact-source'];
const RUN_ID_PATTERN = /^b8-1-[a-zA-Z0-9._-]+$/;
const GRAPHIFY_BLOCK_REASON = 'graphify requires exact executable identity, version digest, bounded arguments, and dry-run self-test — contract not yet defined';

// KNOWN_STALE_DIGESTS is imported from tools/lib/b8-1-plan-digest.mjs (authoritative source).

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
  const check = { name, status, detail };
  checks.push(check);
  return check;
}

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

// canonicalize is imported from tools/lib/b8-1-plan-digest.mjs (authoritative source).

function hashCanonicalJson(value) {
  return sha256Buffer(JSON.stringify(canonicalize(value)));
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

/** Parse repeatable --source-root repositoryId=/absolute/path arguments. */
export function parseSourceRootOverrideArgs(args) {
  const entries = [];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source-root') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) return { overrides: null, error: '--source-root requires repositoryId=/absolute/path' };
      entries.push(value);
      index += 1;
    } else if (arg.startsWith('--source-root=')) {
      entries.push(arg.slice('--source-root='.length));
    }
  }

  if (entries.length === 0) return { overrides: null, error: null };

  const overrides = {};
  for (const entry of entries) {
    const separator = entry.indexOf('=');
    if (separator <= 0 || separator === entry.length - 1) {
      return { overrides: null, error: `invalid --source-root mapping "${entry}"; expected repositoryId=/absolute/path` };
    }
    const repositoryId = entry.slice(0, separator);
    const root = entry.slice(separator + 1);
    if (!/^[a-zA-Z0-9_-]+$/.test(repositoryId)) {
      return { overrides: null, error: `invalid repositoryId in --source-root mapping: "${repositoryId}"` };
    }
    if (Object.hasOwn(overrides, repositoryId)) {
      return { overrides: null, error: `duplicate --source-root mapping for repositoryId "${repositoryId}"` };
    }
    overrides[repositoryId] = root;
  }
  return { overrides, error: null };
}

/** Validate and apply an exact, complete repositoryId → clean Git root mapping. */
function applySourceRootOverrides(checks, manifest, sourceRootOverrides) {
  if (sourceRootOverrides == null) {
    return { valid: true, manifest, repositoryRootBindings: {} };
  }
  if (typeof sourceRootOverrides !== 'object' || Array.isArray(sourceRootOverrides)) {
    recordCheck(checks, 'source-root-overrides', 'fail', 'source-root overrides must be an object mapping repository IDs to absolute paths');
    return { valid: false, manifest: null, repositoryRootBindings: {} };
  }

  const repositoryIds = (manifest.repositories ?? []).map(repo => repo.repositoryId).sort();
  const overrideIds = Object.keys(sourceRootOverrides).sort();
  const missing = repositoryIds.filter(repositoryId => !overrideIds.includes(repositoryId));
  const unknown = overrideIds.filter(repositoryId => !repositoryIds.includes(repositoryId));
  if (missing.length > 0 || unknown.length > 0) {
    recordCheck(
      checks,
      'source-root-overrides',
      'fail',
      `repository ID mismatch: missing=[${missing.join(',')}] unknown=[${unknown.join(',')}]`,
    );
    return { valid: false, manifest: null, repositoryRootBindings: {} };
  }

  const repositoryRootBindings = {};
  const errors = [];
  for (const repo of manifest.repositories) {
    const requestedRoot = sourceRootOverrides[repo.repositoryId];
    if (typeof requestedRoot !== 'string' || requestedRoot.length === 0) {
      errors.push(`${repo.repositoryId}: root must be a nonempty string`);
      continue;
    }
    if (!path.isAbsolute(requestedRoot)) {
      errors.push(`${repo.repositoryId}: root must be absolute`);
      continue;
    }
    if (requestedRoot.split(/[\\/]/).includes('..')) {
      errors.push(`${repo.repositoryId}: root contains path traversal`);
      continue;
    }
    if (!fs.existsSync(requestedRoot)) {
      errors.push(`${repo.repositoryId}: root not found: ${requestedRoot}`);
      continue;
    }

    let physicalRoot;
    try {
      const rootStat = fs.lstatSync(requestedRoot);
      if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('root must be a non-symlink directory');
      physicalRoot = fs.realpathSync(requestedRoot);
      const gitTopLevel = execFileSync('git', ['-C', physicalRoot, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (fs.realpathSync(gitTopLevel) !== physicalRoot) throw new Error('root must be the Git checkout top level');

      execFileSync('git', ['-C', physicalRoot, 'rev-parse', '--verify', `${repo.pinnedCommit}^{commit}`], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      const head = execFileSync('git', ['-C', physicalRoot, 'rev-parse', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (head !== repo.pinnedCommit) throw new Error(`HEAD ${head} does not equal pinned commit ${repo.pinnedCommit}`);
      const porcelain = execFileSync('git', ['-C', physicalRoot, 'status', '--porcelain'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      if (porcelain !== '') throw new Error('root is dirty');
    } catch (error) {
      errors.push(`${repo.repositoryId}: ${error.message}`);
      continue;
    }
    repositoryRootBindings[repo.repositoryId] = physicalRoot;
  }

  if (errors.length > 0) {
    recordCheck(checks, 'source-root-overrides', 'fail', errors.join('; '));
    return { valid: false, manifest: null, repositoryRootBindings: {} };
  }

  const effectiveManifest = {
    ...manifest,
    repositories: manifest.repositories.map(repo => ({
      ...repo,
      localPath: repositoryRootBindings[repo.repositoryId],
    })),
  };
  // Use logical identity only (repositoryId@pinnedCommit) — physical paths are
  // run-local and must not appear in the digest via check details.
  const detail = effectiveManifest.repositories
    .map(repo => `${repo.repositoryId}@${repo.pinnedCommit}`)
    .sort()
    .join('; ');
  recordCheck(checks, 'source-root-overrides', 'pass', detail);
  return { valid: true, manifest: effectiveManifest, repositoryRootBindings };
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
      // Compute SHA-256 of the committed tree via git archive (shell-free).
      // Reads the tar archive bytes directly into Node and hashes them with crypto.
      // Guard: repos >500MB return null rather than causing OOM.
      try {
        const MAX_ARCHIVE_BYTES = 500 * 1024 * 1024; // 500MB guard
        const archiveBuf = execFileSync(
          'git',
          ['-C', repo.localPath, 'archive', 'HEAD', '--format=tar'],
          { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: MAX_ARCHIVE_BYTES }
        );
        state.exportedTreeSha256 = crypto.createHash('sha256').update(archiveBuf).digest('hex');
      } catch { state.exportedTreeSha256 = null; }
    } catch (e) {
      state.HEAD = null;
      state.statusPorcelain = null;
      state.statusSha256 = null;
      state.pinnedCommit = repo.pinnedCommit;
      state.pinnedCommitAvailable = false;
      state.exportedTreeSha256 = null;
    }
    states.push(state);
  }
  return states;
}

/**
 * Project out path-dependent fields from source state entries.
 * Returns a logical identity object whose SHA-256 is path-independent.
 *
 * @param {Array} states  - output of captureSourceState()
 * @returns {{ schemaVersion: string, repositories: Array }}
 */
export function computeLogicalSourceIdentity(states) {
  const logical = states.map(state => ({
    repositoryId: state.repositoryId,
    pinnedCommit: state.pinnedCommit,
    HEAD: state.HEAD,
    statusSha256: state.statusSha256,
    pinnedCommitAvailable: state.pinnedCommitAvailable,
    exportedTreeSha256: state.exportedTreeSha256 ?? null,
  })).sort((a, b) => a.repositoryId.localeCompare(b.repositoryId));
  return { schemaVersion: 2, repositories: logical };
}

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

/**
 * Defect #7: Full manifest validation in preflight.
 * Loads and fully validates the manifest (schema + semantic + exported-tree fixtures).
 * This is fail-closed — any validation error blocks readiness.
 *
 * Async: validates manifest including fixture verification against exported pinned commits.
 */
async function checkManifestAsync(checks, manifestPathOverride, sourceRootOverrides) {
  const resolvedPath = manifestPathOverride ?? MANIFEST_PATH;
  let manifestText;
  try {
    manifestText = fs.readFileSync(resolvedPath, 'utf8');
  } catch (e) {
    recordCheck(checks, 'manifest-validation', 'fail', e.message);
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (e) {
    recordCheck(checks, 'manifest-validation', 'fail', e.message);
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  // schemaVersion fast-fail (cheap, before full validation)
  if (manifest.schemaVersion !== '1.0.0') {
    recordCheck(checks, 'manifest-validation', 'fail', 'schemaVersion mismatch');
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  const resolvedManifest = resolveRepositoryPaths(manifest, resolvedPath);
  const overrideResult = applySourceRootOverrides(checks, resolvedManifest, sourceRootOverrides);

  // Full validation: schema + semantic + exported-tree fixtures. When overrides
  // are present, archive from those exact clean roots instead of the manifest paths.
  try {
    const result = await validateManifest(resolvedPath, MANIFEST_SCHEMA_PATH, {
      allowMissingRepos: false,
      repositoryRootBindings: overrideResult.valid ? overrideResult.repositoryRootBindings : {},
    });
    if (!result.valid) {
      recordCheck(checks, 'manifest-validation', 'fail', `validation error: ${result.errors[0]}`);
      return { manifest: null, manifestHash: null, manifestText: null };
    }
  } catch (e) {
    console.error(`INTERNAL: full manifest validator failed: ${e.message}`);
    recordCheck(checks, 'manifest-validation', 'fail', `validator error: ${e.message}`);
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  if (!overrideResult.valid) {
    return { manifest: null, manifestHash: null, manifestText: null };
  }

  const manifestHash = crypto.createHash('sha256').update(manifestText).digest('hex');
  recordCheck(checks, 'manifest-validation', 'pass', `${manifest.fixtures.length} fixtures across ${manifest.repositories.length} repos; sha256=${manifestHash.slice(0, 16)}...`);
  return { manifest: overrideResult.manifest, manifestHash, manifestText };
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
  const entrypointArtifact = admission.provider.artifacts.find(artifact => artifact.path === admission.provider.entrypoint);
  if (!entrypointArtifact) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', 'admitted CBM entrypoint is not digest-pinned');
    return null;
  }
  const expectedHash = entrypointArtifact.sha256;
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
export function interpretSandboxedChildResult(sandboxedTest) {
  if (sandboxedTest?.error) {
    return { proved: false, reason: `sandboxed child launch failed: ${sandboxedTest.error.message}` };
  }

  let childStartupMarkerSeen = false;
  let childResult = null;
  const stdout = typeof sandboxedTest?.stdout === 'string' ? sandboxedTest.stdout : '';
  for (const line of stdout.split('\n')) {
    if (line === 'CHILD_STARTUP_MARKER') {
      childStartupMarkerSeen = true;
    } else if (line.trim()) {
      try {
        childResult = JSON.parse(line);
      } catch { /* non-JSON output is not proof */ }
    }
  }

  if (!childStartupMarkerSeen) {
    return { proved: false, reason: 'sandboxed child did not start (missing startup marker)' };
  }
  if (!childResult) {
    return { proved: false, reason: 'sandboxed child produced no structured output' };
  }

  const permissionDenied = sandboxedTest.status === 1
    && childResult.exitCode === 1
    && childResult.result === 'connection-denied-permission'
    && /(?:EPERM|EACCES)/.test(childResult.error ?? '');
  if (permissionDenied) {
    return { proved: true, denialEvidence: childResult.error };
  }

  const reason = childResult.exitCode === 0
    ? 'sandboxed process connected (network NOT denied)'
    : childResult.exitCode === 2
      ? 'connection refused/timeout (inconclusive, not EPERM/EACCES)'
      : `unexpected exit code ${childResult.exitCode} (${childResult.result})`;
  return { proved: false, reason };
}

async function checkNetworkIsolationAsync(checks, selectedSubjects, opts = {}) {
  if (!selectedSubjects.includes('cbm')) {
    recordCheck(checks, 'network-isolation', 'excluded-subject', 'cbm not selected — network isolation not required');
    return { required: false, status: 'not-required' };
  }

  const spawn = opts._spawnSync ?? spawnSync;
  const sbExec = spawn('which', ['sandbox-exec'], { encoding: 'utf8' });
  if (sbExec.status !== 0) {
    recordCheck(checks, 'network-isolation', 'blocked', 'sandbox-exec not found — cannot prove network isolation');
    return null;
  }

  if (!fs.existsSync(NETWORK_DENY_PROFILE)) {
    recordCheck(checks, 'network-isolation', 'blocked', `network-deny profile not found at ${NETWORK_DENY_PROFILE}`);
    return null;
  }

  // Compute profile SHA-256
  const profileSha256 = sha256File(NETWORK_DENY_PROFILE);

  const adapterPath = sbExec.stdout.trim();
  let adapterSha256;
  try {
    adapterSha256 = sha256File(adapterPath);
  } catch (e) {
    recordCheck(checks, 'network-isolation', 'blocked', `cannot hash isolation adapter ${adapterPath}: ${e.message}`);
    return null;
  }

  const childPath = path.resolve(__dirname, 'lib', 'b8-1-network-isolation-child.mjs');
  let runtimeIdentity;
  let childIdentity;
  try {
    const runtimePath = fs.realpathSync(process.execPath);
    runtimeIdentity = { path: runtimePath, sha256: sha256File(runtimePath), version: process.version };
    childIdentity = { path: childPath, sha256: sha256File(childPath) };
  } catch (error) {
    recordCheck(checks, 'network-isolation', 'blocked', `cannot bind isolation runtime/helper identity: ${error.message}`);
    return null;
  }

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

    // --- Step 3: Sandboxed connection — must be denied with EPERM/EACCES ---
    // Use sandbox-exec with the deny profile and the child helper to test connection.
    // The child helper returns structured JSON and specific exit codes.
    const sandboxedTest = spawn(
      adapterPath,
      ['-f', NETWORK_DENY_PROFILE, runtimeIdentity.path, childPath, String(port)],
      { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    const interpreted = interpretSandboxedChildResult(sandboxedTest);
    sandboxedResult = interpreted.proved;
    denialEvidence = interpreted.denialEvidence ?? null;

    if (!sandboxedResult) {
      recordCheck(checks, 'network-isolation', 'blocked', `self-test failed: ${interpreted.reason}`);
      return null;
    }

  } finally {
    server.close();
  }

  const proof = {
    required: true,
    status: 'passed',
    adapterIdentity: {
      path: adapterPath,
      sha256: adapterSha256,
    },
    runtimeIdentity,
    childIdentity,
    profilePath: NETWORK_DENY_PROFILE,
    profileSha256,
    controlSucceeded: true,
    sandboxedChildStarted: true,
    sandboxedConnectionDenied: true,
    selfTestPassed: true,
    selfTestDetail: `control succeeded; sandboxed child started; connection denied with ${/(EPERM|EACCES)/.exec(denialEvidence ?? '')?.[1] ?? 'EPERM/EACCES'}`,
  };

  recordCheck(checks, 'network-isolation', 'pass',
    `adapter=${path.basename(adapterPath)}; control=pass; sandboxed=denied; profile-sha256=${profileSha256.slice(0, 16)}...`);
  return proof;
}

/**
 * Defect #3: Graphify readiness.
 * Graphify is always blocked — binary presence is not sufficient.
 * A future contract must provide exact executable identity, version digest,
 * bounded arguments, and dry-run/self-test capability. Until then: blocked.
 */
function checkGraphifySubject(checks, selectedSubjects) {
  let profileSha256;
  let governanceSha256;
  try {
    profileSha256 = sha256File(GRAPHIFY_PROFILES_PATH);
    governanceSha256 = sha256File(GRAPHIFY_GOVERNANCE_PATH);
  } catch (e) {
    const check = recordCheck(checks, 'graphify-subject', 'fail', `cannot bind Graphify profile/governance: ${e.message}`);
    return {
      status: check.status,
      reason: check.detail,
      profilePath: GRAPHIFY_PROFILES_PATH,
      profileSha256: null,
      governancePath: GRAPHIFY_GOVERNANCE_PATH,
      governanceSha256: null,
    };
  }

  if (!selectedSubjects.includes('graphify')) {
    const check = recordCheck(checks, 'graphify-subject', 'excluded-subject', 'graphify not selected; bounded code-only invocation remains blocked');
    return {
      status: check.status,
      reason: check.detail,
      profilePath: GRAPHIFY_PROFILES_PATH,
      profileSha256,
      governancePath: GRAPHIFY_GOVERNANCE_PATH,
      governanceSha256,
    };
  }

  // Defect #3: Graphify is unconditionally blocked regardless of binary presence.
  // We do not infer readiness from binary existence. A complete contract is required:
  //   - exact executable identity (stable symlink → versioned path)
  //   - version digest (SHA-256 of binary)
  //   - bounded, auditable arguments
  //   - dry-run or self-test capability
  // Until that contract exists, graphify cannot be run in the benchmark.
  const check = recordCheck(checks, 'graphify-subject', 'blocked', GRAPHIFY_BLOCK_REASON);
  return {
    status: check.status,
    reason: check.detail,
    profilePath: GRAPHIFY_PROFILES_PATH,
    profileSha256,
    governancePath: GRAPHIFY_GOVERNANCE_PATH,
    governanceSha256,
  };
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
    const spawn = opts._spawnSync ?? spawnSync;
    const dfResult = spawn('df', ['-m', benchmarkParent], { encoding: 'utf8' });
    if (dfResult.status === 0) {
      const lines = dfResult.stdout.trim().split('\n');
      if (lines.length >= 2) {
        const fields = lines[lines.length - 1].split(/\s+/);
        const avail = parseInt(fields[3], 10);
        if (!isNaN(avail)) {
          if (avail >= minMB) {
            return recordCheck(checks, 'disk-budget', 'pass', `minimum ${minMB} MB available (verified via df)`);
          }
          return recordCheck(checks, 'disk-budget', 'fail', `only ${avail} MB available (need ${minMB} MB)`);
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
      return recordCheck(checks, 'disk-budget', 'pass', `minimum ${minMB} MB available (verified via statfs)`);
    } else {
      return recordCheck(checks, 'disk-budget', 'fail', `only ${availMB} MB available via statfs (need ${minMB} MB)`);
    }
  } catch (e) {
    // Defect #5: unknown disk capacity must block readiness
    return recordCheck(checks, 'disk-budget', 'blocked', `cannot verify disk capacity: ${e.message}`);
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
function buildPlannedWritePaths(runDir, selectedSubjects, manifest) {
  const brainRoot = path.resolve(runDir, '..', '..', '..', '..');
  const benchmarkRoot = path.resolve(runDir, '..', '..', '..');
  const b81Root = path.join(benchmarkRoot, 'b8-1');
  const runsRoot = path.join(b81Root, 'runs');
  const plannedRelPaths = [
    'run-plan.json',
    'preflight-receipt.json',
    'cleanup-manifest.json',
    'source-state-before.json',
    'source-state-after.json',
    ...(manifest?.repositories ?? []).map(repo => `_archive_${repo.repositoryId}.tar`),
    ...buildSubjectDirs(selectedSubjects, manifest),
  ];
  return [...new Set([
    brainRoot,
    benchmarkRoot,
    b81Root,
    runsRoot,
    path.resolve(runDir),
    ...plannedRelPaths.map(rel => path.resolve(runDir, rel)),
  ])].sort();
}

function nearestExistingAncestor(targetPath) {
  let current = path.resolve(targetPath);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

function physicalPathThroughExistingAncestor(targetPath) {
  const resolved = path.resolve(targetPath);
  const ancestor = nearestExistingAncestor(resolved);
  if (!ancestor) throw new Error(`no existing ancestor for ${resolved}`);
  return path.resolve(fs.realpathSync(ancestor), path.relative(ancestor, resolved));
}

function isContainedBy(basePath, candidatePath) {
  const relative = path.relative(basePath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function checkPlannedWriteContainment(checks, runDir, selectedSubjects, manifest, home) {
  if (!runDir) {
    recordCheck(checks, 'planned-write-containment', 'fail', 'no run directory — cannot validate write containment');
    return [];
  }

  const homeResolved = path.resolve(homeDir(home));
  const homePhysical = physicalPathThroughExistingAncestor(homeResolved);

  // Build the set of protected absolute paths
  const protectedPaths = PROTECTED_PATHS_RELATIVE_TO_HOME.map(rel => path.resolve(homeResolved, rel));

  const plannedAbsPaths = buildPlannedWritePaths(runDir, selectedSubjects, manifest);

  const runDirResolved = path.resolve(runDir);
  const brainRootResolved = path.resolve(runDirResolved, '..', '..', '..', '..');
  const brainRootPhysical = physicalPathThroughExistingAncestor(brainRootResolved);

  const errors = [];
  for (const absPath of plannedAbsPaths) {
    // Every planned path must stay within this benchmark's bounded write root.
    if (!isContainedBy(brainRootResolved, absPath)) {
      errors.push(`planned path escapes Brain benchmark write boundary: ${absPath}`);
    }

    let physicalPath;
    try {
      physicalPath = physicalPathThroughExistingAncestor(absPath);
    } catch (error) {
      errors.push(`cannot resolve planned path safely: ${absPath}: ${error.message}`);
      continue;
    }
    if (!isContainedBy(homePhysical, physicalPath)) {
      errors.push(`planned path escapes home through a symlinked ancestor: ${absPath}`);
    }
    if (!isContainedBy(brainRootPhysical, physicalPath)) {
      errors.push(`planned path escapes physical Brain benchmark write boundary: ${absPath}`);
    }

    // No overlap with protected paths
    for (const protectedPath of protectedPaths) {
      const protectedPhysical = physicalPathThroughExistingAncestor(protectedPath);
      // Check both directions: planned is under protected, or protected is under planned
      if (isContainedBy(protectedPhysical, physicalPath)) {
        errors.push(`planned path overlaps protected path ${protectedPath}: ${absPath}`);
      }
      if (isContainedBy(physicalPath, protectedPhysical)) {
        errors.push(`planned path contains protected path ${protectedPath}: ${absPath}`);
      }
    }
  }

  if (errors.length > 0) {
    recordCheck(checks, 'planned-write-containment', 'fail', errors[0]);
    return plannedAbsPaths;
  }

  recordCheck(checks, 'planned-write-containment', 'pass',
    `${plannedAbsPaths.length} planned paths confined to ${brainRootResolved}`);
  return plannedAbsPaths;
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
// Plan digest computation (Task 2)
// ---------------------------------------------------------------------------

/**
 * Build the complete deterministic input object approved before materialization.
 *
 * v3 changes from v1/v2:
 *  - planVersion: '3.0.0' replaces schemaVersion to avoid ambiguity with manifest schemaVersion
 *  - Artifact paths stored as repo-relative strings (not absolute), so the same Brain commit
 *    hashes identically from any clean worktree checkout path
 *  - runContext sub-object holds run-local absolute paths (runDirectoryPhysical, plannedWritePaths)
 *    and is EXCLUDED from the digest; old v1/v2 approvals fail closed
 *  - repoRoot must be provided so repo-relative paths can be computed
 *
 * v5 changes from v4r:
 *  - planVersion: '5.0.0' (new pins require new plan version)
 *  - Updated source repository pins: brain f683edff/workbench bc490861/prochat 85087d54
 *  - CBM HOME isolation: per-run configDir passed as HOME (not user's real HOME)
 *  - Sandbox fail-closed: darwin executor verifies sandbox-exec + deny profile exist before running
 *  - callerPrecision=null for exact-source (precision not computable without a predicted set)
 */
export function buildCanonicalPlan({
  runId,
  selectedSubjects,
  manifestPath,
  manifestHash,
  manifestSchemaPath,
  manifestSchemaHash,
  evidenceSchemaPath,
  evidenceSchemaHash,
  manifest,
  cbmIdentity,
  networkProof,
  graphifyStatus,
  diskResult,
  plannedWritePaths,
  runDirectoryPhysical,
  sourceStateHash,
  sourceStateBefore,
  checks,
  repoRoot,
}) {
  const canonicalSelected = [...selectedSubjects].sort();
  const excludedSubjects = VALID_SUBJECTS.filter(s => !canonicalSelected.includes(s)).sort();
  const cbmSelected = canonicalSelected.includes('cbm');
  const canonicalCbmIdentity = cbmSelected && cbmIdentity ? {
    stablePath: cbmIdentity.stablePath,
    resolvedPath: cbmIdentity.resolvedPath,
    version: cbmIdentity.version,
    sha256: cbmIdentity.sha256,
  } : null;
  // Strip Brain-worktree-local paths from networkProof — keep content-addressable SHAs only.
  // childIdentity.path and profilePath differ across worktrees; the verifier also strips them.
  function stripNetworkProofPaths(proof) {
    if (!proof || typeof proof !== 'object') return proof;
    const { childIdentity, profilePath: _profilePath, ...rest } = proof;
    const result = { ...rest };
    if (childIdentity) {
      const { path: _childPath, ...childRest } = childIdentity;
      result.childIdentity = childRest;
    }
    return result;
  }

  const canonicalNetworkProof = cbmSelected
    ? stripNetworkProofPaths(networkProof ?? { required: true, status: 'failed' })
    : { required: false, status: 'not-required' };

  // Compute repo-relative paths for artifact binding. When repoRoot is not provided
  // (e.g. in tests that pass synthetic '/synthetic/...' paths), fall back to the
  // absolute path so tests that pre-date v3 still work with their own assertions.
  function toRepoRel(absPath) {
    if (!repoRoot || !absPath) return absPath;
    const rel = path.relative(repoRoot, path.resolve(absPath));
    // If relative path escapes the repo root (starts with '..'), fall back to absolute
    if (rel.startsWith('..') || path.isAbsolute(rel)) return absPath;
    return rel;
  }

  const digestFields = {
    planVersion: PLAN_VERSION,
    runId,
    partialEvidence: excludedSubjects.length > 0,
    selectedSubjects: canonicalSelected,
    excludedSubjects,
    manifestRepoRelPath: toRepoRel(manifestPath),
    manifestHash: `sha256:${manifestHash}`,
    manifestSchemaRepoRelPath: toRepoRel(manifestSchemaPath),
    manifestSchemaHash: `sha256:${manifestSchemaHash}`,
    evidenceSchemaRepoRelPath: toRepoRel(evidenceSchemaPath),
    evidenceSchemaHash: `sha256:${evidenceSchemaHash}`,
    pinnedRepositoryCommits: (manifest.repositories || [])
      .map(r => ({ repositoryId: r.repositoryId, commit: r.pinnedCommit }))
      .sort((a, b) => a.repositoryId.localeCompare(b.repositoryId)),
    subjectBinaryIdentity: canonicalCbmIdentity ? { cbm: canonicalCbmIdentity } : {},
    networkIsolationProof: canonicalNetworkProof,
    cbmVerification: cbmSelected ? {
      required: true,
      status: canonicalCbmIdentity && canonicalNetworkProof.status === 'passed' ? 'passed' : 'failed',
      binaryIdentity: canonicalCbmIdentity,
      networkIsolationProof: canonicalNetworkProof,
    } : {
      required: false,
      status: 'not-required',
    },
    graphifyStatus: (() => {
      // Strip Brain-worktree-local paths — keep content-addressable SHAs only.
      if (!graphifyStatus || typeof graphifyStatus !== 'object') return graphifyStatus;
      const { profilePath: _pp, governancePath: _gp, ...rest } = graphifyStatus;
      return canonicalize(rest);
    })(),
    diskResult: canonicalize(diskResult),
    sourceStateHash: `sha256:${sourceStateHash}`,
    sourceLogicalIdentity: sourceStateBefore != null
      ? computeLogicalSourceIdentity(sourceStateBefore)
      : null,
    checks: checks.map(check => ({
      name: check.name,
      status: check.status,
      detail: check.detail ?? null,
    })),
  };

  // runContext is included in the output for audit purposes but EXCLUDED from the digest.
  // These are run-local absolute paths that differ across worktrees and machines.
  const runContext = {
    runDirectoryPhysical,
    plannedWritePaths: [...plannedWritePaths].sort(),
    // Brain-worktree-local artifact paths (stripped from digest fields; content SHAs remain there)
    networkDenyProfilePath: networkProof?.profilePath ?? null,
    networkChildPath: networkProof?.childIdentity?.path ?? null,
    graphifyProfilePath: graphifyStatus?.profilePath ?? null,
    graphifyGovernancePath: graphifyStatus?.governancePath ?? null,
  };

  return { ...digestFields, runContext };
}

// computePlanDigest is imported from tools/lib/b8-1-plan-digest.mjs (authoritative source).
// It excludes runContext, planSha256, createdAt, annotation fields, and Brain-worktree paths.
export { computePlanDigest };

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
    ...(manifest?.repositories ?? []).map(r => `sources/${r.repositoryId}`),
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
 *
 * @param {object} manifest
 * @param {string} repoId
 * @param {string} exportedRoot  - Path to exported tree for this repo.
 */
function validateExportedTree(manifest, repoId, exportedRoot) {
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
      throw new Error(`exported tree assertion failed for ${fixture.fixtureId}: ${verErrors[0]}`);
    }
  }
}


/**
 * Defect #9 & Task 6: Manifest hash tracking and expanded plan/receipt.
 * Materialization consumes the exact canonical plan that was approved.
 */
function rollbackMaterialization(runDir, createdRunDir) {
  if (!createdRunDir) return;
  fs.rmSync(runDir, { recursive: true, force: true });
  if (fs.existsSync(runDir)) throw new Error(`rollback left materialization artifact at ${runDir}`);
}

function materialize(runDir, manifest, checks, selectedSubjects, canonicalPlan, plannedSourceState, planSha256, hooks = {}) {
  let createdRunDir = false;
  const missingParents = [];
  try {
    // Parent directories are explicit digest-bound planned writes. The run
    // directory itself is created exclusively so a race or stale directory
    // can never be merged into or deleted as though it belonged to this run.
    for (let current = path.dirname(runDir); !fs.existsSync(current); current = path.dirname(current)) {
      missingParents.push(current);
    }
    // v3: runContext holds run-local fields (excluded from digest)
    const expectedPhysicalRunDir = canonicalPlan.runContext?.runDirectoryPhysical ?? canonicalPlan.runDirectoryPhysical;
    const effectivePlannedWritePaths = canonicalPlan.runContext?.plannedWritePaths ?? canonicalPlan.plannedWritePaths ?? [];
    if (!effectivePlannedWritePaths.includes(path.resolve(runDir))) {
      throw new Error('run directory is not present in the approved planned-write set');
    }
    hooks._beforeMaterialize?.({ runDir });
    if (physicalPathThroughExistingAncestor(runDir) !== expectedPhysicalRunDir) {
      throw new Error('run directory physical path changed after plan approval');
    }
    fs.mkdirSync(path.dirname(runDir), { recursive: true });
    fs.mkdirSync(runDir, { recursive: false });
    createdRunDir = true;
    if (fs.realpathSync(runDir) !== expectedPhysicalRunDir) {
      throw new Error('run directory physical path changed after plan approval');
    }
    hooks._failAt?.('after-run-directory');

    // Defect #10: Subject-aware directory creation
    const dirs = buildSubjectDirs(selectedSubjects, manifest);
    for (const d of dirs) fs.mkdirSync(path.join(runDir, d), { recursive: true });

    const stateBefore = captureSourceState(manifest);
    const stateBeforeHash = hashCanonicalJson(computeLogicalSourceIdentity(stateBefore));
    if (stateBeforeHash !== canonicalPlan.sourceStateHash.replace(/^sha256:/, '')) {
      throw new Error(`source state changed after approval: expected ${canonicalPlan.sourceStateHash}, got sha256:${stateBeforeHash}`);
    }
    if (hashCanonicalJson(computeLogicalSourceIdentity(plannedSourceState)) !== stateBeforeHash) {
      throw new Error('internal source-state binding mismatch before materialization');
    }
    fs.writeFileSync(path.join(runDir, 'source-state-before.json'), JSON.stringify(stateBefore, null, 2));

    for (const repo of manifest.repositories) {
      if (!fs.existsSync(repo.localPath)) continue;
      const destDir = path.join(runDir, 'sources', repo.repositoryId);
      const tarPath = path.join(runDir, `_archive_${repo.repositoryId}.tar`);
      const archiveFd = fs.openSync(tarPath, 'w');
      try {
        execFileSync('git', ['-C', repo.localPath, 'archive', repo.pinnedCommit, '--', '.'], {
          stdio: ['ignore', archiveFd, 'ignore']
        });
      } finally {
        fs.closeSync(archiveFd);
      }
      execFileSync('tar', ['-x', '-f', tarPath, '-C', destDir]);
      fs.rmSync(tarPath, { force: true });
      const symlinkErrors = [
        ...removeDeclaredSymlinks(destDir, repo.excludedSymlinkPaths),
        ...validateExportedTreeSymlinks(destDir),
      ];
      if (symlinkErrors.length > 0) throw new Error(`${repo.repositoryId}: ${symlinkErrors[0]}`);
      hooks._failAt?.(`after-export:${repo.repositoryId}`);

      // Defect #8: Validate exported tree against fixture assertions after each export
      try {
        validateExportedTree(manifest, repo.repositoryId, destDir);
      } catch (e) {
        recordCheck(checks, 'materialization', 'fail', e.message);
        throw e;
      }
    }

    const stateAfter = captureSourceState(manifest);
    fs.writeFileSync(path.join(runDir, 'source-state-after.json'), JSON.stringify(stateAfter, null, 2));

    for (let i = 0; i < stateBefore.length; i++) {
      const before = stateBefore[i];
      const after = stateAfter[i];
      if (before.HEAD !== after.HEAD || before.statusSha256 !== after.statusSha256) {
        throw new Error(`source state changed for ${before.repositoryId}: HEAD ${before.HEAD} -> ${after.HEAD}, status ${before.statusSha256} -> ${after.statusSha256}`);
      }
    }

    if (hashCanonicalJson(computeLogicalSourceIdentity(stateAfter)) !== stateBeforeHash) {
      throw new Error(`source state hash changed during materialization for run ${path.basename(runDir)}`);
    }

    const createdAt = new Date().toISOString();
    const runPlan = { ...canonicalPlan, planSha256, createdAt };
    const preflightReceipt = { ...canonicalPlan, planSha256, createdAt };
    fs.writeFileSync(path.join(runDir, 'run-plan.json'), JSON.stringify(runPlan, null, 2));
    fs.writeFileSync(path.join(runDir, 'preflight-receipt.json'), JSON.stringify(preflightReceipt, null, 2));

    const cleanupManifest = {
      runId: path.basename(runDir),
      runDirectory: runDir,
      runDirectoryPhysical: fs.realpathSync(runDir),
      createdAt: new Date().toISOString(),
      note: 'cleanup targets this exact directory only'
    };
    fs.writeFileSync(path.join(runDir, 'cleanup-manifest.json'), JSON.stringify(cleanupManifest, null, 2));

    recordCheck(checks, 'materialization', 'pass', `created ${runDir}`);
  } catch (e) {
    let rollbackError = null;
    try {
      rollbackMaterialization(runDir, createdRunDir);
    } catch (error) {
      rollbackError = error;
      recordCheck(checks, 'materialization-cleanup', 'fail', error.message);
    }
    for (const parentDir of missingParents) {
      try {
        fs.rmdirSync(parentDir);
      } catch (error) {
        try {
          const parentStat = fs.lstatSync(parentDir);
          if (parentStat.isDirectory() && !parentStat.isSymbolicLink() && fs.readdirSync(parentDir).length === 0) {
            rollbackError ??= new Error(`rollback left empty harness-created parent ${parentDir}: ${error.message}`);
            recordCheck(checks, 'materialization-cleanup', 'fail', rollbackError.message);
          }
        } catch { /* absent, nonempty, or externally replaced parent is not ours to remove */ }
      }
    }
    // Only record the check if it wasn't already recorded by validateExportedTree
    if (!checks.some(c => c.name === 'materialization')) {
      recordCheck(checks, 'materialization', 'fail', rollbackError ? `${e.message}; ${rollbackError.message}` : e.message);
    }
    if (rollbackError) throw new Error(`${e.message}; ${rollbackError.message}`);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runPreflight({
  dryRun = true,
  materialize: doMaterialize = false,
  runId,
  subjects,
  approvedPlanSha256,
  sourceRootOverrides,
  _manifestPathOverride,
  _homeOverride,
  _diskBudgetHooks,
  _networkIsolationHooks,
  _materializationHooks,
} = {}) {
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

  // Defect #7: Full manifest validation in preflight — async call
  const resolvedManifestPath = _manifestPathOverride ?? MANIFEST_PATH;
  const { manifest, manifestHash, manifestText } = await checkManifestAsync(checks, _manifestPathOverride, sourceRootOverrides);

  checkPinnedCommits(checks, manifest);
  const runDir = checkRunId(checks, runId, _homeOverride);
  const cbmIdentity = checkCbmBinary(checks, selectedSubjects, _homeOverride);
  const networkProof = await checkNetworkIsolationAsync(checks, selectedSubjects, _networkIsolationHooks ?? {});
  const graphifyStatus = checkGraphifySubject(checks, selectedSubjects);
  checkExactSource(checks, selectedSubjects);
  const diskResult = checkDiskBudget(checks, _homeOverride, _diskBudgetHooks ?? {});

  // Defect #6: Planned-write containment (replaces unconditional pass)
  const plannedWritePaths = checkPlannedWriteContainment(checks, runDir, selectedSubjects, manifest, _homeOverride);

  let sourceStateBefore = null;
  let sourceStateHash = null;
  if (manifest) {
    sourceStateBefore = captureSourceState(manifest);
    const sourceStateReady = sourceStateBefore.every(state =>
      state.HEAD === state.pinnedCommit
      && state.statusPorcelain === ''
      && state.statusSha256
      && state.pinnedCommitAvailable
      && state.exportedTreeSha256 != null
    );
    if (sourceStateReady) {
      const logicalIdentity = computeLogicalSourceIdentity(sourceStateBefore);
      sourceStateHash = hashCanonicalJson(logicalIdentity);
      recordCheck(checks, 'source-state-binding', 'pass', `sha256=${sourceStateHash.slice(0, 16)}...`);
    } else {
      const failures = sourceStateBefore
        .filter(state => state.HEAD !== state.pinnedCommit || state.statusPorcelain !== '' || !state.pinnedCommitAvailable || state.exportedTreeSha256 == null)
        .map(state => `${state.repositoryId}: HEAD=${state.HEAD ?? 'unavailable'} pinned=${state.pinnedCommit} clean=${state.statusPorcelain === ''} treeSha=${state.exportedTreeSha256 != null}`);
      recordCheck(checks, 'source-state-binding', 'fail', `source repositories must be clean at their pinned commits; ${failures.join('; ')}`);
    }
  }

  // Task 2: Compute plan digest early
  let planSha256 = null;
  let canonicalPlan = null;
  if (manifest && manifestHash && runDir && sourceStateHash) {
    const manifestSchemaHash = sha256File(MANIFEST_SCHEMA_PATH);
    const evidenceSchemaHash = sha256File(EVIDENCE_SCHEMA_PATH);
    canonicalPlan = buildCanonicalPlan({
      runId,
      selectedSubjects,
      manifestPath: resolvedManifestPath,
      manifestHash,
      manifestSchemaPath: MANIFEST_SCHEMA_PATH,
      manifestSchemaHash,
      evidenceSchemaPath: EVIDENCE_SCHEMA_PATH,
      evidenceSchemaHash,
      manifest,
      cbmIdentity,
      networkProof,
      graphifyStatus,
      diskResult,
      plannedWritePaths,
      runDirectoryPhysical: physicalPathThroughExistingAncestor(runDir),
      sourceStateHash,
      sourceStateBefore,
      checks,
      repoRoot: REPO_ROOT,
    });
    planSha256 = computePlanDigest(canonicalPlan);
  }

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
      // Task 2: Verify plan approval before materialization
      if (!planSha256) {
        recordCheck(checks, 'plan-approval', 'fail', 'cannot compute plan digest');
        blockingChecks.push('plan-approval');
      } else if (!approvedPlanSha256) {
        recordCheck(checks, 'plan-approval', 'fail', `plan digest ${planSha256.slice(0, 16)}... must be approved via --approved-plan-sha256`);
        blockingChecks.push('plan-approval');
      } else if (typeof approvedPlanSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(approvedPlanSha256)) {
        recordCheck(checks, 'plan-approval', 'fail', 'approved plan digest must be exactly 64 lowercase hexadecimal characters');
        blockingChecks.push('plan-approval');
      } else if (KNOWN_STALE_DIGESTS.has(approvedPlanSha256)) {
        // Fail closed on any known stale digest — they are from prior plan versions and are no longer valid
        recordCheck(checks, 'plan-approval', 'fail', `stale approval digest rejected — recompute against v5 plan contract (planVersion 5.0.0)`);
        blockingChecks.push('plan-approval');
      } else if (approvedPlanSha256 !== planSha256) {
        recordCheck(checks, 'plan-approval', 'fail', `approved digest mismatch: got ${approvedPlanSha256.slice(0, 16)}... expected ${planSha256.slice(0, 16)}...`);
        blockingChecks.push('plan-approval');
      } else {
        // Approval matches — proceed with materialization
        try {
          materialize(runDir, manifest, checks, selectedSubjects, canonicalPlan, sourceStateBefore, planSha256, _materializationHooks ?? {});
          materialized = true;
        } catch (e) {
          // Error is already recorded in checks by materialize()
          materialized = false;
        }
      }
    }

    // Recalculate blocking checks after materialization attempt
    blockingChecks = checks
      .filter(c => c.status === 'fail' || c.status === 'blocked')
      .map(c => c.name);
  }

  // executionReady means the last operation succeeded (or would succeed in dry-run)
  const executionReady = blockingChecks.length === 0;

  const summary = {
    executionReady,
    materialized,
    selectedSubjects,
    excludedSubjects,
    blockingChecks,
    runId: runId ?? null,
    planSha256,
  };
  return { checks: [...checks], summary, runDir, dryRun, canonicalPlan };
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

  // Parse --manifest argument
  const manifestArg = args.find(a => a.startsWith('--manifest='));
  let manifestPathOverride = null;
  if (manifestArg?.startsWith('--manifest=')) {
    manifestPathOverride = manifestArg.slice('--manifest='.length);
  } else {
    const idx = args.indexOf('--manifest');
    if (idx >= 0 && idx + 1 < args.length) manifestPathOverride = args[idx + 1];
  }

  // Parse --approved-plan-sha256 argument
  const planDigestArg = args.find(a => a.startsWith('--approved-plan-sha256='));
  let approvedPlanSha256 = null;
  if (planDigestArg?.startsWith('--approved-plan-sha256=')) {
    approvedPlanSha256 = planDigestArg.slice('--approved-plan-sha256='.length);
  } else {
    const idx = args.indexOf('--approved-plan-sha256');
    if (idx >= 0 && idx + 1 < args.length) approvedPlanSha256 = args[idx + 1];
  }

  // Parse --write-plan <path> — atomically persist the exact emitted plan to a file.
  // Only valid with --dry-run (not --materialize). Rejected if preflight is not executionReady.
  let writePlanPath = null;
  const writePlanArg = args.find(a => a.startsWith('--write-plan='));
  if (writePlanArg) {
    writePlanPath = writePlanArg.slice('--write-plan='.length);
  } else {
    const idx = args.indexOf('--write-plan');
    if (idx >= 0 && idx + 1 < args.length) writePlanPath = args[idx + 1];
  }
  if (writePlanPath && doMaterialize) {
    console.error('ERROR: --write-plan may only be used with --dry-run, not --materialize');
    process.exit(2);
  }

  const { overrides: sourceRootOverrides, error: sourceRootOverrideError } = parseSourceRootOverrideArgs(args);
  if (sourceRootOverrideError) {
    console.error(`ERROR: ${sourceRootOverrideError}`);
    process.exit(2);
  }

  // Defect #4: CLI must require explicit --subjects
  const subjectsArg = args.find(a => a.startsWith('--subjects='));
  let subjectsRaw = null;
  if (subjectsArg?.startsWith('--subjects=')) {
    const raw = subjectsArg.slice('--subjects='.length);
    subjectsRaw = raw.split(',');
    // Detect trailing/leading commas or double commas → empty strings after split
    if (raw.split(',').some(s => s.trim() === '')) {
      console.error('ERROR: malformed --subjects value: empty segment from comma-splitting');
      process.exit(2);
    }
  } else {
    const idx = args.indexOf('--subjects');
    if (idx >= 0 && idx + 1 < args.length) {
      const raw = args[idx + 1];
      subjectsRaw = raw.split(',');
      if (raw.split(',').some(s => s.trim() === '')) {
        console.error('ERROR: malformed --subjects value: empty segment from comma-splitting');
        process.exit(2);
      }
    }
    // If --subjects is not present at all, subjectsRaw remains null → parseAndValidateSubjects will error
  }

  try {
    const { checks, summary, runDir, canonicalPlan } = await runPreflight({
      dryRun: isDryRun,
      materialize: doMaterialize,
      runId,
      subjects: subjectsRaw,
      approvedPlanSha256,
      sourceRootOverrides,
      _manifestPathOverride: manifestPathOverride,
    });

    console.log(`# B8.1 Benchmark Preflight — ${isDryRun ? 'DRY RUN' : 'MATERIALIZE'}`);
    console.log('');

    for (const check of checks) {
      const status = check.status.toUpperCase().padEnd(16);
      const detail = check.detail ? ` — ${check.detail}` : '';
      console.log(`${status} ${check.name}${detail}`);
    }

    console.log('');
    if (canonicalPlan) {
      console.log(JSON.stringify({ planSha256: summary.planSha256, canonicalPlan }, null, 2));
      console.log('');
    }
    console.log(JSON.stringify(summary, null, 2));

    // --write-plan: atomically persist the exact emitted plan (placeholder-free)
    if (writePlanPath && canonicalPlan && summary.planSha256 && summary.executionReady) {
      const emittedPlan = {
        ...canonicalPlan,
        planSha256: summary.planSha256,
      };
      const tmpPath = `${writePlanPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(emittedPlan, null, 2));
      fs.renameSync(tmpPath, writePlanPath);
      console.log('');
      console.log(`# Plan written to: ${writePlanPath}`);
      console.log(`# planSha256: ${summary.planSha256}`);
    } else if (writePlanPath && !summary.executionReady) {
      console.error('ERROR: --write-plan skipped — preflight is not executionReady');
      process.exitCode = 1;
    } else if (writePlanPath && !canonicalPlan) {
      console.error('ERROR: --write-plan skipped — no canonical plan was computed');
      process.exitCode = 1;
    }

    if (!summary.executionReady) process.exitCode = 1;
  } catch (e) {
    console.error(`INTERNAL ERROR: ${e.message}`);
    process.exitCode = 2;
  }
}
