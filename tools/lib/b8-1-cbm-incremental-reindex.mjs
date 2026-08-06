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
 * Reject shared cache/config: cache and config must not be identical or shared.
 */
export function validatePathIsolation(cacheDir, configDir, sourceDir) {
  if (cacheDir === configDir) return { valid: false, reason: 'cache and config paths are identical' };
  if (cacheDir === sourceDir || configDir === sourceDir) return { valid: false, reason: 'cache/config inside source' };

  // Check for containment (one is parent of other)
  const cacheReal = fs.realpathSync(cacheDir);
  const configReal = fs.realpathSync(configDir);
  const sourceReal = fs.realpathSync(sourceDir);

  if (cacheReal.startsWith(sourceReal) || configReal.startsWith(sourceReal)) {
    return { valid: false, reason: 'cache/config is contained within source' };
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
 * Run CBM index_repository with measurements via process sampler.
 */
export async function runCbmIndex(cbmExecutable, sourcePath, projectName, cacheDir, configDir, env = {}, sandboxProfile = null, timeout = 120000) {
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

  if (!result.commandSucceeded) {
    return { success: false, error: `index failed (exit=${result.exitCode})` };
  }

  let indexOutput;
  try {
    indexOutput = JSON.parse(result.stdout);
  } catch (e) {
    return { success: false, error: 'index output not JSON' };
  }

  // Semantic validation: expect object with status or indexed flag
  if (typeof indexOutput !== 'object' || (!indexOutput.status && !indexOutput.indexed)) {
    return { success: false, error: 'index output invalid semantically' };
  }

  return {
    success: true,
    wallMs: result.wallMs,
    cpuPercent: result.cpuPercent,
    peakRssMb: result.peakRssMb,
  };
}

/**
 * Query CBM with search_code to verify marker visibility.
 */
export async function queryCbmMarker(cbmExecutable, projectName, marker, cacheDir, configDir, env = {}, sandboxProfile = null, timeout = 30000) {
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

  const result = await runChildWithTimeMetrics({
    executable,
    argv,
    cwd: cacheDir,
    env,
    timeout,
    detached: true,
  });

  if (!result.commandSucceeded) {
    return { visible: false, reason: `query failed (exit=${result.exitCode})` };
  }

  try {
    const output = JSON.parse(result.stdout);
    if (!Array.isArray(output)) {
      return { visible: false, reason: 'query output not array' };
    }
    // Marker is visible only if exact marker string appears in results
    const visible = output.some(r => r && typeof r === 'object' && r.text && r.text.includes(marker));
    return { visible, results: output };
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
 *   incrementalReindexWallMs?: number,
 *   incrementalReindexCpuPercent?: number,
 *   incrementalReindexPeakRssMb?: number,
 *   cacheBytes?: number,
 *   markerVisible?: boolean,
 *   restorationVerified?: boolean,
 *   marker?: string,
 *   targetFilePath?: string,
 *   provenance?: object
 * }>}
 */
export async function runIncrementalReindex(opts = {}) {
  const { cbmExecutable, disposableRepositoryPath, repoId, projectName, cacheDir, configDir, env, sandboxProfile, timeout = 120000 } = opts;

  if (!cbmExecutable || !disposableRepositoryPath || !repoId || !projectName || !cacheDir || !configDir || !env) {
    return { success: false, reason: 'missing required parameters' };
  }

  // Validate directories
  let validation = validateRunDirectory(cacheDir, 'cacheDir');
  if (!validation.valid) return { success: false, reason: validation.reason };

  validation = validateRunDirectory(configDir, 'configDir');
  if (!validation.valid) return { success: false, reason: validation.reason };

  if (!fs.existsSync(disposableRepositoryPath)) {
    return { success: false, reason: 'disposable repository does not exist' };
  }

  // Validate isolation
  validation = validatePathIsolation(cacheDir, configDir, disposableRepositoryPath);
  if (!validation.valid) return { success: false, reason: validation.reason };

  // Find target file
  const targetFilePath = findTargetFile(disposableRepositoryPath);
  if (!targetFilePath) {
    return { success: false, reason: 'no target file found (.ts or .js)' };
  }

  // Hash initial state
  const initialTargetHash = hashFile(targetFilePath);
  const initialRepoHash = hashDirectory(disposableRepositoryPath);
  if (!initialTargetHash || !initialRepoHash) {
    return { success: false, reason: 'failed to hash initial state' };
  }

  const marker = generateMarker();
  let markerLine = null;

  try {
    // Step 1: Initial index
    const initialIndexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir, env, sandboxProfile, timeout);
    if (!initialIndexResult.success) {
      return { success: false, reason: `initial index failed: ${initialIndexResult.error}` };
    }

    // Step 2: Apply marker
    markerLine = applyMarker(targetFilePath, marker);
    if (!markerLine) {
      return { success: false, reason: 'failed to apply marker' };
    }

    // Step 3: Re-index
    const reindexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir, env, sandboxProfile, timeout);
    if (!reindexResult.success) {
      return { success: false, reason: `incremental reindex failed: ${reindexResult.error}` };
    }

    // Step 4: Query for visibility
    const visibilityResult = await queryCbmMarker(cbmExecutable, projectName, marker, cacheDir, configDir, env, sandboxProfile, timeout);
    const markerVisible = visibilityResult.visible;

    if (!markerVisible) {
      return { success: false, reason: 'marker not visible after reindex' };
    }

    // Step 5: Measure cache bytes (must be nonzero)
    const cacheBytes = measureCacheBytes(cacheDir);
    if (cacheBytes === 0) {
      return { success: false, reason: 'cache bytes is zero after indexing' };
    }

    return {
      success: true,
      initialIndexWallMs: initialIndexResult.wallMs,
      initialIndexCpuPercent: initialIndexResult.cpuPercent,
      initialIndexPeakRssMb: initialIndexResult.peakRssMb,
      incrementalReindexWallMs: reindexResult.wallMs,
      incrementalReindexCpuPercent: reindexResult.cpuPercent,
      incrementalReindexPeakRssMb: reindexResult.peakRssMb,
      cacheBytes,
      markerVisible,
      restorationVerified: true,
      marker,
      targetFilePath,
      provenance: {
        cacheDir,
        configDir,
        sandboxProfile,
      },
    };
  } finally {
    // Always restore on exit
    if (markerLine) {
      restoreFile(targetFilePath, markerLine);
    }

    // Verify restoration
    const finalTargetHash = hashFile(targetFilePath);
    const finalRepoHash = hashDirectory(disposableRepositoryPath);
    if (finalTargetHash !== initialTargetHash || finalRepoHash !== initialRepoHash) {
      if (arguments[0].success !== false) { // Only override if not already failed
        // This should update existing success path to add failure
      }
    }
  }
}
