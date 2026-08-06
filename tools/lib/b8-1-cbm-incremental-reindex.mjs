/**
 * b8-1-cbm-incremental-reindex.mjs — CBM incremental re-indexing with observability proof.
 *
 * Uses two consecutive index_repository calls on the same disposable repository copy.
 * Between calls, applies a reversible marker to a target file, then proves the change
 * became visible through a CBM query before restoration.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { runChildWithTimeMetrics } from './b8-1-process-metrics.mjs';

/**
 * Compute SHA-256 hash of a file.
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
 * Recursively hash a directory tree.
 * Returns a SHA-256 of the sorted file hashes.
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

    // Sort and hash
    fileHashes.sort();
    const combined = fileHashes.join('\n');
    return crypto.createHash('sha256').update(combined).digest('hex');
  } catch (e) {
    return null;
  }
}

/**
 * Compute per-repository cache bytes for a given cache directory.
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
 * Find the first .ts or .js file in a directory tree (deterministic target for marker).
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
 * Apply a reversible marker (comment line) to a file.
 * Returns the marker string used for uniqueness.
 */
export function applyMarker(filePath) {
  const marker = `// B8.1-marker-${Date.now()}-${Math.random().toString(36).slice(2, 8)}\n`;
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(filePath, marker + content, 'utf8');
    return marker;
  } catch (e) {
    return null;
  }
}

/**
 * Restore a file to its exact original state by removing the marker.
 */
export function restoreFile(filePath, marker) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    if (!content.startsWith(marker)) {
      return false; // Marker mismatch
    }
    const restored = content.slice(marker.length);
    fs.writeFileSync(filePath, restored, 'utf8');
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Run CBM query to check if a marker is visible (observability proof).
 */
export async function queryMarkerVisibility(cbmExecutable, cacheDir, marker) {
  // Use CBM search_codebase to query for the marker string
  const queryArgs = [
    'cli', 'search_codebase',
    '--query', marker.trim(),
  ];

  const result = await runChildWithTimeMetrics({
    executable: cbmExecutable,
    argv: queryArgs,
    cwd: cacheDir,
    timeout: 30000,
  });

  if (!result.success || result.exitCode !== 0) {
    return { visible: false, reason: `query failed (exit=${result.exitCode})` };
  }

  try {
    const output = JSON.parse(result.stdout);
    if (Array.isArray(output) && output.length > 0) {
      return { visible: true, results: output };
    }
  } catch (e) {
    // JSON parse failed; try text search
  }

  return { visible: result.stdout.includes(marker.trim()), reason: 'text search' };
}

/**
 * Execute CBM index_repository with measurements.
 */
export async function runCbmIndex(cbmExecutable, sourcePath, projectName, cacheDir, configDir, env = {}) {
  const indexArgs = [
    'cli', 'index_repository',
    '--repo-path', sourcePath,
    '--persistence', 'false',
    '--mode', 'fast',
    '--name', projectName,
  ];

  const result = await runChildWithTimeMetrics({
    executable: cbmExecutable,
    argv: indexArgs,
    cwd: cacheDir,
    env,
    timeout: 120000, // 2 min timeout for indexing
  });

  if (!result.success || result.exitCode !== 0) {
    return { success: false, error: `index_repository failed (exit=${result.exitCode})` };
  }

  let indexOutput;
  try {
    indexOutput = JSON.parse(result.stdout);
  } catch (e) {
    return { success: false, error: 'index_repository output not JSON' };
  }

  return {
    success: true,
    wallMs: result.wallMs,
    cpuPercent: result.cpuPercent,
    peakRssMb: result.peakRssMb,
  };
}

/**
 * Incremental reindex test: initial index → apply marker → re-index → query → restore → verify.
 *
 * @param {object} opts
 * @param {string} opts.cbmExecutable - path to codebase-memory-mcp binary
 * @param {string} opts.disposableRepositoryPath - path to writable repository copy
 * @param {string} opts.repoId - repository ID (brain, workbench, prochat)
 * @param {string} opts.projectName - stable project name for CBM
 * @param {string} opts.cacheDir - per-run cache directory
 * @param {string} opts.configDir - per-run config directory (HOME override)
 * @param {string} [opts.sandboxProfile] - unused (for future network isolation)
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
 *   targetFilePath?: string
 * }>}
 */
export async function runIncrementalReindex(opts = {}) {
  const { cbmExecutable, disposableRepositoryPath, repoId, projectName, cacheDir, configDir, sandboxProfile, timeout = 120000 } = opts;

  if (!cbmExecutable || !disposableRepositoryPath || !repoId || !projectName || !cacheDir) {
    return { success: false, reason: 'missing required parameters' };
  }

  if (!fs.existsSync(disposableRepositoryPath)) {
    return { success: false, reason: `disposable repository path does not exist: ${disposableRepositoryPath}` };
  }

  // Find target file for marker
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

  // Step 1: Initial index
  const initialIndexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir);
  if (!initialIndexResult.success) {
    return { success: false, reason: `initial index failed: ${initialIndexResult.error}` };
  }

  // Step 2: Apply marker
  const marker = applyMarker(targetFilePath);
  if (!marker) {
    return { success: false, reason: 'failed to apply marker' };
  }

  // Step 3: Re-index with marker present
  const reindexResult = await runCbmIndex(cbmExecutable, disposableRepositoryPath, projectName, cacheDir, configDir);
  if (!reindexResult.success) {
    // Restore before returning error
    restoreFile(targetFilePath, marker);
    return { success: false, reason: `incremental reindex failed: ${reindexResult.error}` };
  }

  // Step 4: Query for marker visibility
  const visibilityResult = await queryMarkerVisibility(cbmExecutable, cacheDir, marker);
  const markerVisible = visibilityResult.visible;

  // Step 5: Restore file
  const restoreSuccess = restoreFile(targetFilePath, marker);
  if (!restoreSuccess) {
    return { success: false, reason: 'failed to restore file (marker mismatch)' };
  }

  // Step 6: Verify restoration
  const finalTargetHash = hashFile(targetFilePath);
  const finalRepoHash = hashDirectory(disposableRepositoryPath);
  if (finalTargetHash !== initialTargetHash || finalRepoHash !== initialRepoHash) {
    return { success: false, reason: 'restoration hash mismatch' };
  }

  // Step 7: Measure cache bytes
  const cacheBytes = measureCacheBytes(cacheDir);

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
    targetFilePath,
  };
}
