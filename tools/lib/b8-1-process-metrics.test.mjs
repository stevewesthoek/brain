/**
 * b8-1-process-metrics.test.mjs — Tests for hardened process sampler.
 */

import assert from 'node:assert';
import { test } from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseTimeMetricsFile, validateTimeMetrics, computeCpuPercent, runChildWithTimeMetrics } from './b8-1-process-metrics.mjs';

test('parseTimeMetricsFile: valid metrics file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-1-test-'));
  try {
    const metricsFile = path.join(tmpDir, 'metrics.txt');
    fs.writeFileSync(metricsFile, `        0.52 real         0.38 user         0.10 sys\n             41127936  maximum resident set size`);
    const result = parseTimeMetricsFile(metricsFile);
    assert.equal(result.parsed, true);
    assert.equal(result.wallSeconds, 0.52);
  } finally { fs.rmSync(tmpDir, { recursive: true }); }
});

test('parseTimeMetricsFile: nonexistent file', () => {
  const result = parseTimeMetricsFile('/nonexistent/metrics.txt');
  assert.equal(result.parsed, false);
});

test('parseTimeMetricsFile: empty file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-1-test-'));
  try {
    const metricsFile = path.join(tmpDir, 'empty.txt');
    fs.writeFileSync(metricsFile, '');
    const result = parseTimeMetricsFile(metricsFile);
    assert.equal(result.parsed, false);
  } finally { fs.rmSync(tmpDir, { recursive: true }); }
});

test('validateTimeMetrics: valid metrics', () => {
  const metrics = { wallSeconds: 0.5, userSeconds: 0.3, systemSeconds: 0.1, rssBytes: 1000000, parsed: true };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, true);
});

test('validateTimeMetrics: negative wall time', () => {
  const metrics = { wallSeconds: -0.1, userSeconds: 0.1, systemSeconds: 0.1, rssBytes: 1000000, parsed: true };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, false);
});

test('validateTimeMetrics: multicore CPU exceeding wall time (legitimate)', () => {
  const numCores = os.cpus().length;
  const metrics = { wallSeconds: 1.0, userSeconds: numCores * 0.5, systemSeconds: numCores * 0.4, rssBytes: 1000000, parsed: true };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, true);
});

test('computeCpuPercent: valid inputs', () => {
  const result = computeCpuPercent(1.0, 0.5, 0.3);
  assert.equal(result.isValid, true);
  assert.equal(result.cpuPercent, 80);
});

test('computeCpuPercent: zero wall time with zero CPU', () => {
  const result = computeCpuPercent(0, 0, 0);
  assert.equal(result.isValid, true);
  assert.equal(result.cpuPercent, 0);
});

test('computeCpuPercent: zero wall time with nonzero CPU (reject)', () => {
  const result = computeCpuPercent(0, 0.5, 0.3);
  assert.equal(result.isValid, false);
});

test('runChildWithTimeMetrics: success with echo', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/echo',
    argv: ['hello'],
    env: { PATH: '/bin:/usr/bin' },
    timeout: 5000,
  });
  assert.equal(result.success, true);
  assert.equal(result.measurementValid, true);
  assert.equal(result.commandSucceeded, true);
  assert.ok(result.cpuPercent !== null);
});

test('runChildWithTimeMetrics: explicit env isolation', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/sh',
    argv: ['-c', 'echo $TEST_VAR'],
    env: { PATH: '/bin:/usr/bin', TEST_VAR: 'explicit_value' },
    timeout: 5000,
  });
  assert.equal(result.exitCode, 0);
  assert.ok(result.stdout.includes('explicit_value'));
});

test('runChildWithTimeMetrics: nonzero exit fails success', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/sh',
    argv: ['-c', 'exit 42'],
    env: { PATH: '/bin:/usr/bin' },
    timeout: 5000,
  });
  assert.equal(result.success, false);
  assert.equal(result.exitCode, 42);
});

test('runChildWithTimeMetrics: missing executable fails', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/nonexistent/binary',
    argv: [],
    env: { PATH: '/bin' },
    timeout: 5000,
  });
  assert.equal(result.success, false);
  assert.equal(result.commandSucceeded, false);
});

test('runChildWithTimeMetrics: missing env parameter', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/echo',
    argv: ['hello'],
    timeout: 5000,
  });
  assert.equal(result.success, false);
});

test('runChildWithTimeMetrics: timeout kills process', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/sh',
    argv: ['-c', 'sleep 60'],
    env: { PATH: '/bin:/usr/bin' },
    timeout: 300,
    detached: true,
  });
  assert.equal(result.timedOut, true);
  assert.equal(result.success, false);
});

test('runChildWithTimeMetrics: provenance recorded', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/true',
    argv: [],
    env: { PATH: '/bin' },
    timeout: 5000,
  });
  assert.ok(result.provenance);
  assert.equal(result.provenance.method, '/usr/bin/time -l (via metrics file)');
  assert.ok(result.provenance.samplerPid);
});
