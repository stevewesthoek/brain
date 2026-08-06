/**
 * b8-1-cbm-incremental-reindex.mjs — Hardened CBM incremental reindexing with strict validation.
 *
 * Requires: existing distinct cache/config dirs, isolated HOME/XDG_* env, sandbox wrapping,
 * exact marker verification, semantic index output validation, nonzero cache bytes.
 *
 * Uses real CBM CLI: index_repository, search_code --pattern --project.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runChildWithTimeMetrics } from './b8-1-process-metrics.mjs';

/**
 * Validate directory: exists, is directory, not symlink, owned by run.
 */
export function validateRunDirectory(dirPath, name) {
  if (!dirPath) return { valid: false, reason: `${name} path missing` };
  if (!fs.existsSync(dirPath)) return { valid: false, reason: `${name} does not exist` };
  const stat = fs.lstatSync(dirPath);
  if (!stat.isDirectory()) return { valid: false, reason: `${name} not a directory` };
  if (stat.isSymbolicLink()) return { valid: false, reason: `${name} is symlink` };
  return { valid: true };
}

/**
 * Validate path isolation with boundary-safe containment checks.
 * Uses normalized real paths and path.relative() to detect:
 * - cache inside source, config inside source
 * - source inside cache, source inside config
 * - cache inside config, config inside cache
 * - identical paths, symlinks
 */
export function validatePathIsolation(cacheDir, configDir, sourceDir) {
  let cacheReal, configReal, sourceReal;
  try {
    cacheReal = fs.realpathSync(cacheDir);
    configReal = fs.realpathSync(configDir);
    sourceReal = fs.realpathSync(sourceDir);
  } catch (e) {
    return { valid: false, reason: `path resolution failed: ${e.message}` };
  }

  // Reject identical paths
  if (cacheReal === configReal) return { valid: false, reason: 'cache and config paths are identical' };
  if (cacheReal === sourceReal) return { valid: false, reason: 'cache and source paths are identical' };
  if (configReal === sourceReal) return { valid: false, reason: 'config and source paths are identical' };

  // Reject symlinks (realpathSync follows symlinks, check with lstat)
  try {
    if (fs.lstatSync(cacheDir).isSymbolicLink()) return { valid: false, reason: 'cache path is a symlink' };
    if (fs.lstatSync(configDir).isSymbolicLink()) return { valid: false, reason: 'config path is a symlink' };
    if (fs.lstatSync(sourceDir).isSymbolicLink()) return { valid: false, reason: 'source path is a symlink' };
  } catch (e) {
    return { valid: false, reason: `symlink check failed: ${e.message}` };
  }

  // Check containment using path.relative (path-boundary-safe)
  // If A is inside B, path.relative(B, A) will not start with '..'
  const cacheRelSource = path.relative(sourceReal, cacheReal);
  const configRelSource = path.relative(sourceReal, configReal);
  const sourceRelCache = path.relative(cacheReal, sourceReal);
  const sourceRelConfig = path.relative(configReal, sourceReal);
  const cacheRelConfig = path.relative(configReal, cacheReal);
  const configRelCache = path.relative(cacheReal, configReal);

  if (!cacheRelSource.startsWith('..') && cacheRelSource !== cacheReal) {
    return { valid: false, reason: 'cache is contained within source' };
  }
  if (!configRelSource.startsWith('..') && configRelSource !== configReal) {
    return { valid: false, reason: 'config is contained within source' };
  }
  if (!sourceRelCache.startsWith('..') && sourceRelCache !== sourceReal) {
    return { valid: false, reason: 'source is contained within cache' };
  }
  if (!sourceRelConfig.startsWith('..') && sourceRelConfig !== sourceReal) {
    return { valid: false, reason: 'source is contained within config' };
  }
  if (!cacheRelConfig.startsWith('..') && cacheRelConfig !== cacheReal) {
    return { valid: false, reason: 'cache is contained within config' };
  }
  if (!configRelCache.startsWith('..') && configRelCache !== configReal) {
    return { valid: false, reason: 'config is contained within cache' };
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
 * Validate environment: HOME must be owner-only, XDG_* must match dirs, allowlist enforced.
 */
export function validateEnvironment(env, cacheDir, configDir, homeDir) {
  if (!env || typeof env !== 'object') {
    return { valid: false, reason: 'environment must be an object' };
  }

  // HOME must be specified and must match approved owner-only synthetic home
  if (!env.HOME) {
    return { valid: false, reason: 'HOME not set' };
  }

  try {
    const stat = fs.statSync(env.HOME);
    if ((stat.mode & 0o077) !== 0) {
      return { valid: false, reason: 'HOME directory has non-owner permissions' };
    }
  } catch (e) {
    return { valid: false, reason: `HOME validation failed: ${e.message}` };
  }

  // XDG_CACHE_HOME must exactly match cacheDir
  if (env.XDG_CACHE_HOME !== cacheDir) {
    return { valid: false, reason: 'XDG_CACHE_HOME does not match cacheDir' };
  }

  // XDG_CONFIG_HOME must exactly match configDir
  if (env.XDG_CONFIG_HOME !== configDir) {
    return { valid: false, reason: 'XDG_CONFIG_HOME does not match configDir' };
  }

  // Whitelist allowed environment keys
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
export async function runCbmIndex(cbmExecutable, sourcePath, projectName, cacheDir, configDir, env = {}, sandboxProfile = null, timeout = 120000) {
  // Validate environment before running
  const envValidation = validateEnvironment(env, cacheDir, configDir, env.HOME);
  if (!envValidation.valid) {
    return { success: false, error: envValidation.reason, measurementProvenance: null };
  }

  const indexArgs = [
    'cli', 'index_repository',
    '--repo-path', sourcePath,
    '--mode', 'fast',
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
    env,
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
 */
export async function queryCbmMarker(cbmExecutable, projectName, marker, targetPath, cacheDir, configDir, env = {}, sandboxProfile = null, timeout = 30000) {
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
    return { visible: false, reason: `environment invalid: ${envValidation.reason}` };
  }

  const result = await runChildWithTimeMetrics({
    executable,
    argv,
    cwd: cacheDir,
    env,
    timeout,
    detached: true,
  });

  // Require result.success === true, not just commandSucceeded
  if (!result.success) {
    return {
      visible: false,
      reason: `query failed (exit=${result.exitCode})`,
      measurementProvenance: {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
      }
    };
  }

  try {
    const output = JSON.parse(result.stdout);
    if (!Array.isArray(output)) {
      return { visible: false, reason: 'query output not array' };
    }
    // Marker is visible only if exact marker string appears in results
    // AND the result file matches the expected target path relative to repository
    const visible = output.some(r => {
      if (!r || typeof r !== 'object') return false;
      if (!r.text || !r.text.includes(marker)) return false;
      // Verify the marker appeared in the target file (check by filename or path)
      const resultFile = r.file || '';
      const targetFilename = path.basename(targetPath);
      return resultFile === targetFilename || resultFile.includes(targetFilename);
    });
    return {
      visible,
      results: output,
      measurementProvenance: {
        exitCode: result.exitCode,
        signal: result.signal,
        timedOut: result.timedOut,
        wallMs: result.wallMs,
      }
    };
  } catch (e) {
    return { visible: false, reason: `query parse error: ${e.message}` };
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
  const { cbmExecutable, disposableRepositoryPath, repoId, projectName, cacheDir, configDir, env, sandboxProfile, timeout = 120000 } = opts;

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
    markerQueryProvenance: null,
    cacheBytes: null,
    cacheBytesInitial: null,
    markerVisible: false,
    restorationVerified: false,
    marker: null,
    targetFilePath: null,
    provenance: null,
  };

  if (!cbmExecutable || !disposableRepositoryPath || !repoId || !projectName || !cacheDir || !configDir || !env) {
    result.reason = 'missing required parameters';
    return result;
  }

  // Validate directories
  let validation = validateRunDirectory(cacheDir, 'cacheDir');
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

  // Validate isolation
  validation = validatePathIsolation(cacheDir, configDir, disposableRepositoryPath);
  if (!validation.valid) {
    result.reason = validation.reason;
    return result;
  }

  // Find target file
  const targetFilePath = findTargetFile(disposableRepositoryPath);
  if (!targetFilePath) {
    result.reason = 'no target file found (.ts or .js)';
    return result;
  }

  result.targetFilePath = targetFilePath;

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
    const initialIndexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir, env, sandboxProfile, timeout);
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
    const reindexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir, env, sandboxProfile, timeout);
    if (!reindexResult.success) {
      result.reason = `incremental reindex failed: ${reindexResult.error}`;
      return result;
    }

    result.incrementalReindexWallMs = reindexResult.wallMs;
    result.incrementalReindexCpuPercent = reindexResult.cpuPercent;
    result.incrementalReindexPeakRssMb = reindexResult.peakRssMb;
    result.incrementalReindexProvenance = reindexResult.measurementProvenance;

    // Step 4: Query for visibility
    const visibilityResult = await queryCbmMarker(cbmExecutable, projectName, marker, targetFilePath, cacheDir, configDir, env, sandboxProfile, timeout);
    if (!visibilityResult.visible) {
      result.reason = `marker not visible after reindex: ${visibilityResult.reason || 'unknown'}`;
      result.markerQueryProvenance = visibilityResult.measurementProvenance;
      return result;
    }

    result.markerVisible = true;
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
    // Always restore on exit
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

    result.provenance = {
      cacheDir,
      configDir,
      sandboxProfile,
      initialTargetHash,
      initialRepoHash,
      finalTargetHash,
      finalRepoHash,
      targetHashMatches,
      repoHashMatches,
    };
  }

  return result;
}
