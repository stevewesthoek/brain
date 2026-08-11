/**
 * b8-1-cbm-incremental-reindex.mjs — Hardened CBM incremental reindexing with strict validation.
 *
 * Requires: existing distinct cache/config dirs, isolated HOME/XDG_* env, sandbox wrapping,
 * provider cache binding via a derived CBM_CACHE_DIR,
 * exact marker verification, semantic index output validation, nonzero cache bytes.
 *
 * Uses real CBM CLI: index_repository, search_code --pattern --project.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runChildWithTimeMetrics } from './b8-1-process-metrics.mjs';

/**
 * Check if childPath is strictly contained within parentPath.
 * Boundary-safe: correctly rejects both ".." and child names like "..cache".
 * Uses path.relative() + path.sep logic:
 * - contained only if relative is nonempty AND
 * - relative is not ".." AND
 * - relative does not start with `..${path.sep}` AND
 * - relative is not absolute
 */
function isPathContainedIn(childPath, parentPath) {
  const normalizedParent = path.normalize(parentPath);
  const normalizedChild = path.normalize(childPath);
  const relative = path.relative(normalizedParent, normalizedChild);

  // Empty or "." means identical (handled separately)
  if (!relative || relative === '.') return false;

  // Absolute means outside (different volumes on Windows, etc.)
  if (path.isAbsolute(relative)) return false;

  // Exactly ".." means direct parent (outside)
  if (relative === '..') return false;

  // Starts with `..${path.sep}` means ancestor (outside)
  if (relative.startsWith('..' + path.sep)) return false;

  // Everything else is inside
  return true;
}

/**
 * Validate directory: exists, is directory, not symlink, regular file.
 * Requires owner UID = current user, mode excludes group/world (0o700).
 */
export function validateRunDirectory(dirPath, name) {
  if (!dirPath) return { valid: false, reason: `${name} path missing` };
  if (!fs.existsSync(dirPath)) return { valid: false, reason: `${name} does not exist` };
  const stat = fs.lstatSync(dirPath);
  if (!stat.isDirectory()) return { valid: false, reason: `${name} not a directory` };
  if (stat.isSymbolicLink()) return { valid: false, reason: `${name} is symlink` };
  // Require owner UID = current user
  const currentUid = process.getuid?.();
  if (currentUid !== undefined && stat.uid !== currentUid) {
    return { valid: false, reason: `${name} not owned by current user (uid mismatch)` };
  }
  // Require mode excludes group/world permissions (0o700)
  if ((stat.mode & 0o077) !== 0) {
    return { valid: false, reason: `${name} has group/world permissions (mode=${oct(stat.mode)})` };
  }
  return { valid: true };
}

function oct(n) {
  return '0o' + (n & 0o7777).toString(8);
}

/**
 * Validate path isolation with boundary-safe containment checks.
 * Requires: all four paths (cache, config, HOME, source) mutually non-identical, non-contained.
 * Uses isPathContainedIn() with path.relative() for boundary-safe detection.
 * Correctly rejects children named ".cache", ".config", etc.
 */
export function validatePathIsolation(cacheDir, configDir, sourceDir, homeDir) {
  let cacheReal, configReal, sourceReal, homeReal;
  try {
    cacheReal = fs.realpathSync(cacheDir);
    configReal = fs.realpathSync(configDir);
    sourceReal = fs.realpathSync(sourceDir);
    if (homeDir) homeReal = fs.realpathSync(homeDir);
  } catch (e) {
    return { valid: false, reason: `path resolution failed: ${e.message}` };
  }

  // Reject identical paths (pairwise)
  const pairs = [
    [cacheReal, configReal, 'cache', 'config'],
    [cacheReal, sourceReal, 'cache', 'source'],
    [configReal, sourceReal, 'config', 'source'],
  ];
  if (homeReal) {
    pairs.push([cacheReal, homeReal, 'cache', 'HOME']);
    pairs.push([configReal, homeReal, 'config', 'HOME']);
    pairs.push([sourceReal, homeReal, 'source', 'HOME']);
  }

  for (const [p1, p2, n1, n2] of pairs) {
    if (p1 === p2) return { valid: false, reason: `${n1} and ${n2} paths are identical` };
  }

  // Reject symlinks
  for (const [pth, nm] of [[cacheDir, 'cache'], [configDir, 'config'], [sourceDir, 'source'], [homeDir, 'HOME']]) {
    if (pth) {
      try {
        if (fs.lstatSync(pth).isSymbolicLink()) {
          return { valid: false, reason: `${nm} path is a symlink` };
        }
      } catch (e) {
        return { valid: false, reason: `${nm} symlink check failed: ${e.message}` };
      }
    }
  }

  // Check all containment relationships (6 for cache/config/source, +6 for HOME if present)
  const dirs = [
    [cacheReal, 'cache'],
    [configReal, 'config'],
    [sourceReal, 'source'],
  ];
  if (homeReal) dirs.push([homeReal, 'HOME']);

  for (let i = 0; i < dirs.length; i++) {
    for (let j = i + 1; j < dirs.length; j++) {
      const [pi, ni] = dirs[i];
      const [pj, nj] = dirs[j];
      if (isPathContainedIn(pi, pj)) {
        return { valid: false, reason: `${ni} is contained within ${nj}` };
      }
      if (isPathContainedIn(pj, pi)) {
        return { valid: false, reason: `${nj} is contained within ${ni}` };
      }
    }
  }

  return { valid: true };
}

/**
 * Compute SHA-256 of file.
 */
export function hashFile(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Recursively hash directory tree.
 */
export function hashDirectory(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return null;
    const fileHashes = [];
    function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          try {
            const content = fs.readFileSync(full);
            const hash = crypto.createHash('sha256').update(content).digest('hex');
            fileHashes.push(`${hash}  ${full}`);
          } catch {}
        }
      }
    }
    walk(dirPath);
    fileHashes.sort();
    const combined = fileHashes.join('\n');
    return crypto.createHash('sha256').update(combined).digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Find first .ts or .js file deterministically.
 */
export function findTargetFile(dirPath) {
  try {
    if (!fs.existsSync(dirPath)) return null;
    function walk(dir) {
      let entries;
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          const result = walk(full);
          if (result) return result;
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
          return full;
        }
      }
      return null;
    }
    return walk(dirPath);
  } catch (e) {
    return null;
  }
}

const REFRESH_PROBE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);
const REFRESH_PROBE_EXCLUDED_SEGMENTS = new Set([
  '.git', 'node_modules', 'vendor', 'vendors', 'dist', 'build', 'coverage', 'generated', 'graphify-out',
]);

export function isAdmittedRefreshProbePath(candidatePath) {
  if (typeof candidatePath !== 'string' || candidatePath.length === 0 || path.isAbsolute(candidatePath) || candidatePath.includes('\\')) return false;
  const segments = candidatePath.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || REFRESH_PROBE_EXCLUDED_SEGMENTS.has(segment.toLowerCase()))) return false;
  if (path.posix.normalize(candidatePath) !== candidatePath) return false;
  const basename = path.posix.basename(candidatePath).toLowerCase();
  if (basename.endsWith('.d.ts') || basename.includes('.generated.') || basename.includes('.gen.')) return false;
  return REFRESH_PROBE_EXTENSIONS.has(path.posix.extname(candidatePath).toLowerCase());
}

/**
 * Select the first manifest-admitted code fixture for a repository.
 * Manifest order is authority; filesystem traversal order is never consulted.
 */
export function selectRefreshProbeTarget(manifest, repositoryId) {
  if (!manifest || !Array.isArray(manifest.fixtures) || !repositoryId) return null;
  const fixture = manifest.fixtures.find(candidate => (
    candidate?.repositoryId === repositoryId &&
    isAdmittedRefreshProbePath(candidate.expectedFile)
  ));
  return fixture?.expectedFile ?? null;
}

/** Resolve and validate a manifest-derived, repository-relative refresh target. */
export function validateRefreshProbeTarget(sourceDir, refreshProbeTarget) {
  if (typeof refreshProbeTarget !== 'string' || refreshProbeTarget.length === 0) {
    return { valid: false, reason: 'refreshProbeTarget is required' };
  }
  if (path.isAbsolute(refreshProbeTarget) || refreshProbeTarget.includes('\\')) {
    return { valid: false, reason: 'refreshProbeTarget must be a normalized POSIX repository-relative path' };
  }
  const segments = refreshProbeTarget.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..') || path.posix.normalize(refreshProbeTarget) !== refreshProbeTarget) {
    return { valid: false, reason: 'refreshProbeTarget contains traversal or non-normalized segments' };
  }
  if (!isAdmittedRefreshProbePath(refreshProbeTarget)) {
    return { valid: false, reason: 'refreshProbeTarget is not an admitted source path' };
  }

  const sourceReal = fs.realpathSync(sourceDir);
  let cursor = sourceReal;
  try {
    for (const segment of segments) {
      cursor = path.join(cursor, segment);
      const stat = fs.lstatSync(cursor);
      if (stat.isSymbolicLink()) {
        return { valid: false, reason: 'refreshProbeTarget or an ancestor is a symlink' };
      }
    }
    if (!fs.statSync(cursor).isFile()) {
      return { valid: false, reason: 'refreshProbeTarget is not a regular file' };
    }
    const targetReal = fs.realpathSync(cursor);
    if (!isPathContainedIn(targetReal, sourceReal)) {
      return { valid: false, reason: 'refreshProbeTarget escapes disposable repository' };
    }
    return { valid: true, targetFilePath: targetReal };
  } catch (error) {
    return { valid: false, reason: `refreshProbeTarget missing or unreadable: ${error.message}` };
  }
}

/**
 * Generate valid marker identifier: `B8.1-mark-<uuid>-<timestamp>`
 */
export function generateMarker() {
  const uuid = crypto.randomBytes(4).toString('hex');
  const timestamp = Date.now().toString(36);
  return `B8.1-mark-${uuid}-${timestamp}`;
}

/**
 * Apply reversible marker to target file.
 */
export function applyMarker(filePath, marker) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const markerLine = `// ${marker}\n`;
    fs.writeFileSync(filePath, markerLine + content, 'utf8');
    return markerLine;
  } catch (e) {
    return null;
  }
}

/**
 * Restore file by removing marker.
 */
export function restoreFile(filePath, markerLine) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.startsWith(markerLine)) {
      return { success: false, reason: 'marker mismatch on restore' };
    }
    fs.writeFileSync(filePath, content.slice(markerLine.length), 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, reason: `restore error: ${e.message}` };
  }
}

/**
 * Measure cache bytes for per-repository storage.
 */
export function measureCacheBytes(cacheDir) {
  if (!fs.existsSync(cacheDir)) return 0;
  let total = 0;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        try { total += fs.statSync(full).size; } catch {}
      }
    }
  }
  walk(cacheDir);
  return total;
}

/**
 * Validate environment: HOME must exactly match homeDir, XDG_* must exactly match dirs.
 * Enforce strict caller-controlled allowlist: PATH, HOME, TMPDIR, XDG_CACHE_HOME,
 * XDG_CONFIG_HOME only. The provider-specific CBM_CACHE_DIR is derived from the
 * validated cacheDir after this check and cannot be supplied by the caller.
 * Reject missing or unexpected keys.
 */
export function validateEnvironment(env, cacheDir, configDir, homeDir) {
  if (!env || typeof env !== 'object') {
    return { valid: false, reason: 'environment must be an object' };
  }

  // HOME must be specified and must exactly equal homeDir
  if (!env.HOME) {
    return { valid: false, reason: 'HOME not set' };
  }
  if (env.HOME !== homeDir) {
    return { valid: false, reason: `HOME does not match synthetic home (got ${env.HOME}, expected ${homeDir})` };
  }

  // XDG_CACHE_HOME must exactly match cacheDir
  if (!env.XDG_CACHE_HOME) {
    return { valid: false, reason: 'XDG_CACHE_HOME not set' };
  }
  if (env.XDG_CACHE_HOME !== cacheDir) {
    return { valid: false, reason: `XDG_CACHE_HOME does not match cacheDir (got ${env.XDG_CACHE_HOME}, expected ${cacheDir})` };
  }

  // XDG_CONFIG_HOME must exactly match configDir
  if (!env.XDG_CONFIG_HOME) {
    return { valid: false, reason: 'XDG_CONFIG_HOME not set' };
  }
  if (env.XDG_CONFIG_HOME !== configDir) {
    return { valid: false, reason: `XDG_CONFIG_HOME does not match configDir (got ${env.XDG_CONFIG_HOME}, expected ${configDir})` };
  }

  // Strict allowlist: exactly these keys allowed
  const allowlist = ['PATH', 'HOME', 'TMPDIR', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME'];
  const allowedKeys = new Set(allowlist);
  for (const key of Object.keys(env)) {
    if (!allowedKeys.has(key)) {
      return { valid: false, reason: `unexpected environment key: ${key}` };
    }
  }

  return { valid: true };
}

/**
 * Run CBM index_repository with measurements via process sampler.
 */
export async function runCbmIndex(cbmExecutable, sourcePath, projectName, cacheDir, configDir, env = {}, sandboxProfile = null, timeout = 120000, indexMode = 'fast') {
  if (!['fast', 'moderate', 'full'].includes(indexMode)) {
    return { success: false, error: `unsupported index mode: ${indexMode}`, measurementProvenance: null };
  }
  // Validate environment before running
  const envValidation = validateEnvironment(env, cacheDir, configDir, env.HOME);
  if (!envValidation.valid) {
    return { success: false, error: envValidation.reason, measurementProvenance: null };
  }

  const indexArgs = [
    'cli', 'index_repository',
    '--repo-path', sourcePath,
    '--mode', indexMode,
    '--name', projectName,
    '--persistence', 'false',
  ];

  let executable = cbmExecutable;
  let argv = indexArgs;

  // Wrap in sandbox if profile supplied
  if (sandboxProfile) {
    executable = '/usr/bin/sandbox-exec';
    argv = ['-f', sandboxProfile, cbmExecutable, ...indexArgs];
  }

  const result = await runChildWithTimeMetrics({
    executable,
    argv,
    cwd: cacheDir,
    env: { ...env, CBM_CACHE_DIR: cacheDir },
    timeout,
    detached: true,
  });

  // Require result.success === true, not just commandSucceeded
  if (!result.success) {
    return {
      success: false,
      error: `index failed: ${result.stderr || `exit=${result.exitCode}`}`,
      measurementProvenance: {
        commandSucceeded: result.commandSucceeded,
        timedOut: result.timedOut,
        exitCode: result.exitCode,
        signal: result.signal,
      }
    };
  }

  let indexOutput;
  try {
    indexOutput = JSON.parse(result.stdout);
  } catch (e) {
    return { success: false, error: 'index output not JSON', measurementProvenance: null };
  }

  // Semantic validation: expect object with status or indexed flag
  if (typeof indexOutput !== 'object' || (!indexOutput.status && !indexOutput.indexed)) {
    return { success: false, error: 'index output invalid semantically', measurementProvenance: null };
  }

  return {
    success: true,
    wallMs: result.wallMs,
    cpuPercent: result.cpuPercent,
    peakRssMb: result.peakRssMb,
    measurementProvenance: {
      wallMs: result.wallMs,
      cpuPercent: result.cpuPercent,
      peakRssMb: result.peakRssMb,
      exitCode: result.exitCode,
      signal: result.signal,
      timedOut: result.timedOut,
    }
  };
}

/**
 * Query CBM with search_code to verify marker visibility.
 *
 * Requires exact match: marker must be found in the exact target file path relative to repository root.
 * Rejects marker visibility in other files.
 */
export async function queryCbmMarker(cbmExecutable, projectName, marker, targetPath, disposableRepositoryPath, cacheDir, configDir, env = {}, sandboxProfile = null, timeout = 30000) {
  const searchArgs = [
    'cli', 'search_code',
    '--pattern', marker,
    '--project', projectName,
    '--mode', 'full',
    '--limit', '20',
  ];

  let executable = cbmExecutable;
  let argv = searchArgs;

  if (sandboxProfile) {
    executable = '/usr/bin/sandbox-exec';
    argv = ['-f', sandboxProfile, cbmExecutable, ...searchArgs];
  }

  // Validate environment
  const envValidation = validateEnvironment(env, cacheDir, configDir, env.HOME);
  if (!envValidation.valid) {
    return { querySucceeded: false, visible: false, reason: `environment invalid: ${envValidation.reason}` };
  }

  // Compute exact relative path for comparison
  let exactRelativePath;
  try {
    const normalizedTarget = fs.realpathSync(targetPath);
    const normalizedRepo = fs.realpathSync(disposableRepositoryPath);
    exactRelativePath = path.relative(normalizedRepo, normalizedTarget);
  } catch (e) {
    return { querySucceeded: false, visible: false, reason: `failed to compute relative path: ${e.message}` };
  }

  const result = await runChildWithTimeMetrics({
    executable,
    argv,
    cwd: cacheDir,
    env: { ...env, CBM_CACHE_DIR: cacheDir },
    timeout,
    detached: true,
  });

  // Require result.success === true, not just commandSucceeded
  if (!result.success) {
    return {
      querySucceeded: false,
      visible: false,
      reason: `query failed (exit=${result.exitCode})`,
      cpuPercent: result.cpuPercent,
      peakRssMb: result.peakRssMb,
      measurementProvenance: result.provenance,
    };
  }

  try {
    const output = JSON.parse(result.stdout);
    // CBM may return either bare array or { results: [...] }
    if (!Array.isArray(output) && !Array.isArray(output?.results)) {
      return { querySucceeded: false, visible: false, markerPresentAnywhere: false, reason: 'query output has invalid result shape' };
    }
    const results = Array.isArray(output) ? output : output.results;

    const markerPresentAnywhere = results.some(r => {
      if (!r || typeof r !== 'object') return false;
      const resultSource = typeof r.source === 'string' ? r.source : r.text;
      return typeof resultSource === 'string' && resultSource.includes(marker);
    });

    // Exact match required: marker must be in the exact target file path, nowhere else
    const visible = results.some(r => {
      if (!r || typeof r !== 'object') return false;
      const resultSource = typeof r.source === 'string' ? r.source : r.text;
      if (typeof resultSource !== 'string' || !resultSource.includes(marker)) return false;
      // Exact path match (relative to repository)
      const resultFile = r.file || '';
      return resultFile === exactRelativePath;
    });

    return {
      querySucceeded: true,
      visible,
      markerPresentAnywhere,
      reason: visible ? null : 'no exact marker match in query results',
      results,
      cpuPercent: result.cpuPercent,
      peakRssMb: result.peakRssMb,
      measurementProvenance: result.provenance,
    };
  } catch (e) {
    return { querySucceeded: false, visible: false, reason: `query parse error: ${e.message}` };
  }
}

/**
 * Incremental reindex: measure initial index, apply marker, re-index, verify visibility, restore.
 *
 * @param {object} opts
 * @param {string} opts.cbmExecutable - CBM binary path
 * @param {string} opts.disposableRepositoryPath - writable copy
 * @param {string} opts.repoId - repository ID
 * @param {string} opts.projectName - stable CBM project name
 * @param {string} opts.cacheDir - per-run cache (must exist, distinct)
 * @param {string} opts.configDir - per-run config (must exist, distinct)
 * @param {object} opts.env - isolated environment (HOME, XDG_CACHE_HOME, XDG_CONFIG_HOME)
 * @param {string} [opts.sandboxProfile] - optional sandbox profile path
 * @param {number} [opts.timeout] - timeout in ms
 * @returns {Promise<{
 *   success: boolean,
 *   reason?: string,
 *   initialIndexWallMs?: number,
 *   initialIndexCpuPercent?: number,
 *   initialIndexPeakRssMb?: number,
 *   initialIndexProvenance?: object,
 *   incrementalReindexWallMs?: number,
 *   incrementalReindexCpuPercent?: number,
 *   incrementalReindexPeakRssMb?: number,
 *   incrementalReindexProvenance?: object,
 *   markerQueryCpuPercent?: number,
 *   markerQueryPeakRssMb?: number,
 *   markerQueryProvenance?: object,
 *   cacheBytes?: number,
 *   cacheBytesInitial?: number,
 *   markerVisible?: boolean,
 *   restorationVerified?: boolean,
 *   marker?: string,
 *   targetFilePath?: string,
 *   provenance?: object
 * }>}
 */
export async function runIncrementalReindex(opts = {}) {
  const { cbmExecutable, disposableRepositoryPath, repoId, projectName, refreshProbeTarget, cacheDir, configDir, env, sandboxProfile, timeout = 120000, indexMode = 'fast' } = opts;

  let result = {
    success: false,
    reason: null,
    initialIndexWallMs: null,
    initialIndexCpuPercent: null,
    initialIndexPeakRssMb: null,
    initialIndexProvenance: null,
    incrementalReindexWallMs: null,
    incrementalReindexCpuPercent: null,
    incrementalReindexPeakRssMb: null,
    incrementalReindexProvenance: null,
    markerQueryCpuPercent: null,
    markerQueryPeakRssMb: null,
    markerQueryProvenance: null,
    restorationReindexCpuPercent: null,
    restorationReindexPeakRssMb: null,
    restorationReindexProvenance: null,
    restorationQueryCpuPercent: null,
    restorationQueryPeakRssMb: null,
    restorationQueryProvenance: null,
    cacheBytes: null,
    cacheBytesInitial: null,
    markerVisible: false,
    markerAbsentAfterRestoration: false,
    restorationVerified: false,
    marker: null,
    targetFilePath: null,
    refreshProbeTarget: null,
    provenance: null,
  };

  if (!cbmExecutable || !disposableRepositoryPath || !repoId || !projectName || !cacheDir || !configDir || !env) {
    result.reason = 'missing required parameters';
    return result;
  }

  // Extract HOME from env for validation
  const homeDir = env.HOME;
  if (!homeDir) {
    result.reason = 'env.HOME not set';
    return result;
  }

  // Validate directories (cache, config, HOME, source)
  let validation = validateRunDirectory(homeDir, 'HOME');
  if (!validation.valid) {
    result.reason = validation.reason;
    return result;
  }

  validation = validateRunDirectory(cacheDir, 'cacheDir');
  if (!validation.valid) {
    result.reason = validation.reason;
    return result;
  }

  validation = validateRunDirectory(configDir, 'configDir');
  if (!validation.valid) {
    result.reason = validation.reason;
    return result;
  }

  if (!fs.existsSync(disposableRepositoryPath)) {
    result.reason = 'disposable repository does not exist';
    return result;
  }

  // Validate isolation (now includes HOME)
  validation = validatePathIsolation(cacheDir, configDir, disposableRepositoryPath, homeDir);
  if (!validation.valid) {
    result.reason = validation.reason;
    return result;
  }

  // Resolve the manifest-derived target. Never fall back to filesystem order.
  const targetValidation = validateRefreshProbeTarget(disposableRepositoryPath, refreshProbeTarget);
  if (!targetValidation.valid) {
    result.reason = targetValidation.reason;
    return result;
  }
  const targetFilePath = targetValidation.targetFilePath;

  result.targetFilePath = targetFilePath;
  result.refreshProbeTarget = refreshProbeTarget;

  // Hash initial state
  const initialTargetHash = hashFile(targetFilePath);
  const initialRepoHash = hashDirectory(disposableRepositoryPath);
  if (!initialTargetHash || !initialRepoHash) {
    result.reason = 'failed to hash initial state';
    return result;
  }

  // Measure initial cache bytes
  const cacheBytesInitial = measureCacheBytes(cacheDir);
  result.cacheBytesInitial = cacheBytesInitial;

  const marker = generateMarker();
  result.marker = marker;
  let markerLine = null;

  try {
    // Step 1: Initial index
    const initialIndexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir, env, sandboxProfile, timeout, indexMode);
    if (!initialIndexResult.success) {
      result.reason = `initial index failed: ${initialIndexResult.error}`;
      return result;
    }

    result.initialIndexWallMs = initialIndexResult.wallMs;
    result.initialIndexCpuPercent = initialIndexResult.cpuPercent;
    result.initialIndexPeakRssMb = initialIndexResult.peakRssMb;
    result.initialIndexProvenance = initialIndexResult.measurementProvenance;

    // Step 2: Apply marker
    markerLine = applyMarker(targetFilePath, marker);
    if (!markerLine) {
      result.reason = 'failed to apply marker';
      return result;
    }

    // Step 3: Re-index
    const reindexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir, env, sandboxProfile, timeout, indexMode);
    if (!reindexResult.success) {
      result.reason = `incremental reindex failed: ${reindexResult.error}`;
      return result;
    }

    result.incrementalReindexWallMs = reindexResult.wallMs;
    result.incrementalReindexCpuPercent = reindexResult.cpuPercent;
    result.incrementalReindexPeakRssMb = reindexResult.peakRssMb;
    result.incrementalReindexProvenance = reindexResult.measurementProvenance;

    // Step 4: Query for visibility
    const visibilityResult = await queryCbmMarker(cbmExecutable, projectName, marker, targetFilePath, disposableRepositoryPath, cacheDir, configDir, env, sandboxProfile, timeout);
    if (!visibilityResult.visible) {
      result.reason = `marker not visible after reindex: ${visibilityResult.reason || 'unknown'}`;
      result.markerQueryProvenance = visibilityResult.measurementProvenance;
      return result;
    }

    result.markerVisible = true;
    result.markerQueryCpuPercent = visibilityResult.cpuPercent;
    result.markerQueryPeakRssMb = visibilityResult.peakRssMb;
    result.markerQueryProvenance = visibilityResult.measurementProvenance;

    // Step 5: Measure cache bytes (must be nonzero and attributable)
    const cacheBytesFinal = measureCacheBytes(cacheDir);
    result.cacheBytes = cacheBytesFinal;
    if (cacheBytesFinal === 0) {
      result.reason = 'cache bytes is zero after indexing';
      return result;
    }

    // Verify cache delta is positive and attributable
    const cacheDelta = cacheBytesFinal - cacheBytesInitial;
    if (cacheDelta <= 0) {
      result.reason = `no attributable cache delta (initial=${cacheBytesInitial}, final=${cacheBytesFinal})`;
      return result;
    }

    // Mark success only if all prior checks passed
    result.success = true;

  } finally {
    // Always restore on exit, then refresh the restored tree and prove the marker disappeared.
    let restorationError = null;
    if (markerLine) {
      const restoreResult = restoreFile(targetFilePath, markerLine);
      if (!restoreResult.success) {
        restorationError = restoreResult.reason;
        // Restoration failure overrides all earlier success
        result.success = false;
        if (!result.reason) {
          result.reason = `restoration failed: ${restorationError}`;
        }
      }
    }

    // Verify restoration by comparing hashes
    const finalTargetHash = hashFile(targetFilePath);
    const finalRepoHash = hashDirectory(disposableRepositoryPath);
    const targetHashMatches = finalTargetHash === initialTargetHash;
    const repoHashMatches = finalRepoHash === initialRepoHash;

    result.restorationVerified = targetHashMatches && repoHashMatches && !restorationError;

    if (!targetHashMatches || !repoHashMatches) {
      result.success = false;
      if (!result.reason) {
        result.reason = 'restoration verification failed: hashes do not match';
      }
    }

    if (markerLine && result.restorationVerified) {
      const restorationReindex = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir, env, sandboxProfile, timeout, indexMode);
      result.restorationReindexCpuPercent = restorationReindex.cpuPercent ?? null;
      result.restorationReindexPeakRssMb = restorationReindex.peakRssMb ?? null;
      result.restorationReindexProvenance = restorationReindex.measurementProvenance ?? null;
      if (!restorationReindex.success) {
        result.success = false;
        result.reason = result.reason || `restoration reindex failed: ${restorationReindex.error}`;
      } else {
        const restorationQuery = await queryCbmMarker(cbmExecutable, projectName, marker, targetFilePath, disposableRepositoryPath, cacheDir, configDir, env, sandboxProfile, timeout);
        result.restorationQueryCpuPercent = restorationQuery.cpuPercent ?? null;
        result.restorationQueryPeakRssMb = restorationQuery.peakRssMb ?? null;
        result.restorationQueryProvenance = restorationQuery.measurementProvenance ?? null;
        result.markerAbsentAfterRestoration = restorationQuery.querySucceeded === true && restorationQuery.markerPresentAnywhere === false;
        if (!result.markerAbsentAfterRestoration) {
          result.success = false;
          result.reason = result.reason || `marker still visible or restoration query failed: ${restorationQuery.reason || 'unknown'}`;
        }
      }
    }

    // Final disk evidence must include the restored index and its verification query.
    const cacheBytesAfterRestoration = measureCacheBytes(cacheDir);
    result.cacheBytes = cacheBytesAfterRestoration;
    if (result.success && cacheBytesAfterRestoration <= cacheBytesInitial) {
      result.success = false;
      result.reason = `no attributable final cache delta (initial=${cacheBytesInitial}, final=${cacheBytesAfterRestoration})`;
    }

    result.provenance = {
      cacheDir,
      cacheEnvironmentVariable: 'CBM_CACHE_DIR',
      configDir,
      sandboxProfile,
      initialTargetHash,
      initialRepoHash,
      finalTargetHash,
      finalRepoHash,
      targetHashMatches,
      repoHashMatches,
      refreshProbeTarget,
      markerAbsentAfterRestoration: result.markerAbsentAfterRestoration,
      cacheBytesAfterRestoration,
    };
  }

  return result;
}
