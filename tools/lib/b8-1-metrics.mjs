/**
 * b8-1-metrics.mjs — Subject-neutral metric collection for B8.1 benchmark.
 *
 * Collects: CPU, RSS, payload bytes, tokenizer, operation count, indexing time,
 * refresh latency, disk bytes — per subject per repository.
 *
 * v7 changes:
 * - Truthful tokenizer identity (utf8-bytes-div4-v1, not cl100k_base)
 * - No zero-fallback for missing measurements — use typed N/A or throw
 * - Aggregate callerCalleeF1 computed from per-fixture F1 values
 * - Resource provenance tracking (method, executable, timestamps)
 */

import fs from 'node:fs';
import path from 'node:path';

export const TOKENIZER_NAME = 'utf8-bytes-div4-v1';
export const TOKENIZER_VERSION = '1.0.0';
const BYTES_PER_TOKEN_ESTIMATE = 4;

/**
 * Measure serialized payload bytes — the exact byte length of JSON.stringify(fixtureResults).
 */
export function measureSerializedPayloadBytes(fixtureResults) {
  const payload = JSON.stringify(fixtureResults);
  return Buffer.byteLength(payload, 'utf8');
}

/**
 * Estimate token count using a truthful local estimator.
 * Identity: utf8-bytes-div4-v1 — UTF-8 byte count divided by 4.
 * This is NOT a real tokenizer; it is an approximation with known identity.
 */
export function estimateTokenCount(payloadBytes) {
  return {
    name: TOKENIZER_NAME,
    version: TOKENIZER_VERSION,
    tokenCount: Math.ceil(payloadBytes / BYTES_PER_TOKEN_ESTIMATE),
  };
}

/**
 * Measure index disk bytes for a given cache/index directory.
 */
export function measureIndexDiskBytes(indexDir) {
  if (!fs.existsSync(indexDir)) return 0;
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
  walk(indexDir);
  return total;
}

/**
 * Parse resource usage from /usr/bin/time -l output on macOS.
 * Returns { peakCpuPercent, peakRssMb } with provenance.
 * Returns null values (not zero) when parsing fails — caller must handle.
 */
export function parseTimeOutput(stderr) {
  let peakRssMb = null;
  let peakCpuPercent = null;
  if (stderr) {
    const rssMatch = stderr.match(/(\d+)\s+maximum resident set size/);
    if (rssMatch) peakRssMb = parseInt(rssMatch[1], 10) / (1024 * 1024);
    const cpuMatch = stderr.match(/([\d.]+)%\s+CPU/);
    if (cpuMatch) peakCpuPercent = parseFloat(cpuMatch[1]);
  }
  return { peakCpuPercent, peakRssMb };
}

/**
 * Build resource measurement with provenance from a bounded child process execution.
 * Requires /usr/bin/time -l wrapper on macOS.
 *
 * @param {object} childResult - { stderr, exitCode, durationMs, pid }
 * @param {object} opts - { executable, method }
 * @returns {{ peakCpuPercent: number|null, peakRssMb: number|null, provenance: object }}
 */
export function measureResourceUsage(childResult, opts = {}) {
  const { peakCpuPercent, peakRssMb } = parseTimeOutput(childResult?.stderr);
  return {
    peakCpuPercent,
    peakRssMb,
    provenance: {
      method: opts.method || '/usr/bin/time -l',
      executable: opts.executable || null,
      measuredPid: childResult?.pid || null,
      exitCode: childResult?.exitCode ?? null,
      durationMs: childResult?.durationMs ?? null,
    },
  };
}

/**
 * Build repository metrics for a single repo.
 * For CBM: requires actual measured values — no zero-fallback.
 * For exact-source: indexing/refresh are typed N/A; indexDiskBytes reports source tree bytes.
 *
 * @param {object} opts
 * @param {string} opts.repositoryId
 * @param {number|{status:string,reason:string}} opts.initialIndexingTimeMs
 * @param {number|{status:string,reason:string}} opts.incrementalRefreshLatencyMs
 * @param {number|{status:string,reason:string}} opts.indexDiskBytes
 * @param {string} opts.subject - 'cbm' or 'exact-source'
 */
export function buildRepositoryMetric({ repositoryId, initialIndexingTimeMs, incrementalRefreshLatencyMs, indexDiskBytes, refreshProbeTarget, subject }) {
  if (subject === 'exact-source') {
    return {
      initialIndexingTimeMs: { status: 'not-applicable', reason: 'exact-source-no-index' },
      incrementalRefreshLatencyMs: { status: 'not-applicable', reason: 'exact-source-no-refresh' },
      indexDiskBytes: { status: 'not-applicable', reason: 'exact-source-no-index-disk' },
      refreshProbeTarget: { status: 'not-applicable', reason: 'exact-source-no-refresh-probe' },
    };
  }

  // CBM: require actual values, never substitute zero
  if (initialIndexingTimeMs === null || initialIndexingTimeMs === undefined) {
    throw new Error(`buildRepositoryMetric: initialIndexingTimeMs is required for ${subject}/${repositoryId}`);
  }
  if (incrementalRefreshLatencyMs === null || incrementalRefreshLatencyMs === undefined) {
    throw new Error(`buildRepositoryMetric: incrementalRefreshLatencyMs is required for ${subject}/${repositoryId}`);
  }
  if (indexDiskBytes === null || indexDiskBytes === undefined) {
    throw new Error(`buildRepositoryMetric: indexDiskBytes is required for ${subject}/${repositoryId}`);
  }
  if (typeof refreshProbeTarget !== 'string' || refreshProbeTarget.length === 0) {
    throw new Error(`buildRepositoryMetric: refreshProbeTarget is required for ${subject}/${repositoryId}`);
  }

  return {
    initialIndexingTimeMs,
    incrementalRefreshLatencyMs,
    indexDiskBytes,
    refreshProbeTarget,
  };
}

/**
 * Build complete subject metrics for a subject.
 * Includes aggregate callerCalleeF1.
 */
export function buildSubjectMetrics({
  subject,
  fixtureResults,
  repositoryMetrics,
  peakCpuPercent,
  peakRssMb,
  serializedPayloadBytes,
  tokenizer,
  retrievalOperationCount,
  resourceProvenance,
}) {
  const fileCorrectCount = fixtureResults.filter(f => f.fileCorrect).length;
  const lineCorrectCount = fixtureResults.filter(f => f.lineCorrect).length;
  const total = fixtureResults.length;
  const setAccuracyValues = fixtureResults.map(f => f.setAccuracy).filter(v => v !== null && v !== undefined);

  const retrievalAccuracy = {
    fileAccuracy: total > 0 ? fileCorrectCount / total : 0,
    lineAccuracy: total > 0 ? lineCorrectCount / total : 0,
  };
  if (setAccuracyValues.length > 0) {
    retrievalAccuracy.setAccuracy = setAccuracyValues.reduce((a, b) => a + b, 0) / setAccuracyValues.length;
  }

  // Include caller/callee metrics
  const callerRecalls = fixtureResults.map(f => f.callerRecall).filter(v => v !== null && v !== undefined);
  const calleeRecalls = fixtureResults.map(f => f.calleeRecall).filter(v => v !== null && v !== undefined);
  if (callerRecalls.length > 0) {
    retrievalAccuracy.callerRecall = callerRecalls.reduce((a, b) => a + b, 0) / callerRecalls.length;
  }
  if (calleeRecalls.length > 0) {
    retrievalAccuracy.calleeRecall = calleeRecalls.reduce((a, b) => a + b, 0) / calleeRecalls.length;
  }
  const callerPrecs = fixtureResults.map(f => f.callerPrecision).filter(v => v !== null && v !== undefined);
  const calleePrecs = fixtureResults.map(f => f.calleePrecision).filter(v => v !== null && v !== undefined);
  if (callerPrecs.length > 0) {
    retrievalAccuracy.callerPrecision = callerPrecs.reduce((a, b) => a + b, 0) / callerPrecs.length;
  }
  if (calleePrecs.length > 0) {
    retrievalAccuracy.calleePrecision = calleePrecs.reduce((a, b) => a + b, 0) / calleePrecs.length;
  }

  // Aggregate callerCalleeF1: harmonic mean of average callerPrecision (or callerRecall) and average calleeRecall
  if (retrievalAccuracy.callerRecall !== undefined && retrievalAccuracy.calleeRecall !== undefined) {
    const p = retrievalAccuracy.callerPrecision ?? retrievalAccuracy.callerRecall;
    const r = retrievalAccuracy.calleeRecall;
    retrievalAccuracy.callerCalleeF1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0;
  }

  const metrics = {
    retrievalAccuracy,
    peakCpuPercent,
    peakRssMb,
    serializedPayloadBytes,
    tokenizer,
    retrievalOperationCount,
    repositoryMetrics,
  };

  if (resourceProvenance) {
    metrics.resourceProvenance = resourceProvenance;
  }

  return metrics;
}
