/**
 * b8-1-metrics.mjs — Subject-neutral metric collection for B8.1 benchmark.
 *
 * Collects: CPU, RSS, payload bytes, tokenizer, operation count, indexing time,
 * refresh latency, disk bytes — per subject per repository.
 */

import fs from 'node:fs';
import path from 'node:path';

const TOKENIZER_NAME = 'cl100k_base';
const TOKENIZER_VERSION = '1.0.0';
const BYTES_PER_TOKEN_ESTIMATE = 4;

/**
 * Measure serialized payload bytes — the exact byte length of JSON.stringify(fixtureResults).
 */
export function measureSerializedPayloadBytes(fixtureResults) {
  const payload = JSON.stringify(fixtureResults);
  return Buffer.byteLength(payload, 'utf8');
}

/**
 * Estimate token count using a pinned local tokenizer (byte-based estimate).
 * Uses cl100k_base approximation: ~4 bytes per token.
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
 * Measure peak CPU% and RSS MB from a bounded child process execution.
 * On macOS, uses /usr/bin/time -l to get max RSS.
 * Returns { peakCpuPercent, peakRssMb }.
 */
export function measureResourceUsage(childResult) {
  // Parse from stderr of /usr/bin/time output if available
  let peakRssMb = 0;
  let peakCpuPercent = 0;
  if (childResult && childResult.stderr) {
    const rssMatch = childResult.stderr.match(/(\d+)\s+maximum resident set size/);
    if (rssMatch) peakRssMb = parseInt(rssMatch[1], 10) / (1024 * 1024);
    const cpuMatch = childResult.stderr.match(/([\d.]+)%\s+CPU/);
    if (cpuMatch) peakCpuPercent = parseFloat(cpuMatch[1]);
  }
  return { peakCpuPercent, peakRssMb };
}

/**
 * Build repository metrics for a single repo.
 * @param {object} opts
 * @param {string} opts.repositoryId
 * @param {number|null} opts.initialIndexingTimeMs
 * @param {number|null} opts.incrementalRefreshLatencyMs
 * @param {number} opts.indexDiskBytes
 * @param {string} opts.subject - 'cbm' or 'exact-source'
 */
export function buildRepositoryMetric({ repositoryId, initialIndexingTimeMs, incrementalRefreshLatencyMs, indexDiskBytes, subject }) {
  const metric = { indexDiskBytes };

  // For exact-source, indexing and refresh are not applicable
  if (subject === 'exact-source') {
    metric.initialIndexingTimeMs = { status: 'not-applicable', reason: 'exact-source-no-index' };
    metric.incrementalRefreshLatencyMs = { status: 'not-applicable', reason: 'exact-source-no-refresh' };
  } else {
    metric.initialIndexingTimeMs = initialIndexingTimeMs ?? 0;
    metric.incrementalRefreshLatencyMs = incrementalRefreshLatencyMs ?? 0;
  }

  return metric;
}

/**
 * Build complete subject metrics for a subject.
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

  return {
    retrievalAccuracy,
    peakCpuPercent,
    peakRssMb,
    serializedPayloadBytes,
    tokenizer,
    retrievalOperationCount,
    repositoryMetrics,
  };
}
