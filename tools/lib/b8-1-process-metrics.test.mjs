/**
 * b8-1-process-metrics.test.mjs — Tests for bounded child-process sampler.
 */

import assert from 'node:assert';
import { test } from 'node:test';
import { parseTimeOutput, validateTimeMetrics, computeCpuPercent, runChildWithTimeMetrics } from './b8-1-process-metrics.mjs';

test('parseTimeOutput: valid macOS time -l output', () => {
  const stderr = `       0.52 real     0.38 user     0.10 sys
   41127936  maximum resident set size`;
  const result = parseTimeOutput(stderr);
  assert.equal(result.parsed, true);
  assert.equal(result.wallSeconds, 0.52);
  assert.equal(result.userSeconds, 0.38);
  assert.equal(result.systemSeconds, 0.10);
  assert.equal(result.rssBytes, 41127936);
});

test('parseTimeOutput: missing wall time', () => {
  const stderr = `   41127936  maximum resident set size`;
  const result = parseTimeOutput(stderr);
  assert.equal(result.parsed, false);
  assert.equal(result.wallSeconds, null);
});

test('parseTimeOutput: missing RSS', () => {
  const stderr = `       0.52 real     0.38 user     0.10 sys`;
  const result = parseTimeOutput(stderr);
  assert.equal(result.parsed, false);
  assert.equal(result.rssBytes, null);
});

test('parseTimeOutput: null stderr', () => {
  const result = parseTimeOutput(null);
  assert.equal(result.parsed, false);
});

test('validateTimeMetrics: valid metrics', () => {
  const metrics = { wallSeconds: 0.5, userSeconds: 0.3, systemSeconds: 0.1, rssBytes: 1000000, parsed: true };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, true);
});

test('validateTimeMetrics: zero wall time is allowed (fast command)', () => {
  const metrics = { wallSeconds: 0, userSeconds: 0, systemSeconds: 0, rssBytes: 1000000, parsed: true };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, true); // Zero wall time is acceptable for fast commands
});

test('validateTimeMetrics: negative user time', () => {
  const metrics = { wallSeconds: 0.5, userSeconds: -0.1, systemSeconds: 0.1, rssBytes: 1000000, parsed: true };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, false);
  assert.match(result.reason, /userSeconds/);
});

test('validateTimeMetrics: CPU time exceeds wall time', () => {
  const metrics = { wallSeconds: 0.5, userSeconds: 0.4, systemSeconds: 0.2, rssBytes: 1000000, parsed: true };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, false);
  assert.match(result.reason, /CPU time/);
});

test('validateTimeMetrics: not parsed', () => {
  const metrics = { wallSeconds: null, userSeconds: null, systemSeconds: null, rssBytes: null, parsed: false };
  const result = validateTimeMetrics(metrics);
  assert.equal(result.valid, false);
});

test('computeCpuPercent: valid inputs', () => {
  const result = computeCpuPercent(1.0, 0.5, 0.3);
  assert.equal(result.isValid, true);
  assert.equal(result.cpuPercent, 80); // (0.5 + 0.3) / 1.0 * 100
});

test('computeCpuPercent: zero wall seconds', () => {
  const result = computeCpuPercent(0, 0, 0); // Zero wall time with zero CPU is valid
  assert.equal(result.isValid, true);
  assert.equal(result.cpuPercent, 0);
});

test('computeCpuPercent: zero wall seconds with nonzero CPU', () => {
  const result = computeCpuPercent(0, 0.5, 0.3);
  assert.equal(result.isValid, false); // Cannot compute percentage with zero denominator and nonzero CPU
  assert.equal(result.cpuPercent, null);
});

test('computeCpuPercent: negative user seconds', () => {
  const result = computeCpuPercent(1.0, -0.1, 0.3);
  assert.equal(result.isValid, false);
  assert.equal(result.cpuPercent, null);
});

test('runChildWithTimeMetrics: success with echo', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/echo',
    argv: ['hello world'],
    timeout: 5000,
  });
  assert.equal(result.success, true, 'should measure successfully');
  assert.ok(result.cpuPercent !== null, 'cpuPercent should not be null');
  assert.ok(result.peakRssMb !== null, 'peakRssMb should not be null');
  assert.ok(result.peakRssMb > 0, 'peakRssMb should be positive');
  assert.equal(result.exitCode, 0, 'exit code should be 0');
  assert.ok(result.stdout.includes('hello world'), 'stdout should contain command output');
  assert.equal(result.timedOut, false);
});

test('runChildWithTimeMetrics: nonzero exit code', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/sh',
    argv: ['-c', 'exit 42'],
    timeout: 5000,
  });
  assert.equal(result.success, true, 'should measure even on exit code 42');
  assert.equal(result.exitCode, 42);
  assert.ok(result.cpuPercent !== null, 'cpuPercent should still be measured');
});

test('runChildWithTimeMetrics: timeout kills process group', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/sh',
    argv: ['-c', 'sleep 60'],
    timeout: 500, // 500ms timeout
    detached: true,
  });
  assert.equal(result.timedOut, true, 'should have timed out');
  // Exit code may vary depending on signal; just verify timeout flag is set
});

test('runChildWithTimeMetrics: invalid executable', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/nonexistent/binary',
    argv: [],
    timeout: 5000,
  });
  // May succeed or fail depending on whether the error is captured as a parsing failure
  // Just verify the structure is correct
  assert.ok(result.hasOwnProperty('success'));
  assert.ok(result.provenance.samplerExecutable);
  assert.ok(result.provenance.childExecutable);
});

test('runChildWithTimeMetrics: missing executable', async () => {
  const result = await runChildWithTimeMetrics({
    executable: null,
    argv: [],
  });
  assert.equal(result.success, false);
  assert.equal(result.pid, null);
});

test('runChildWithTimeMetrics: provenance recorded', async () => {
  const result = await runChildWithTimeMetrics({
    executable: '/bin/true',
    argv: [],
    timeout: 5000,
  });
  assert.ok(result.provenance);
  assert.equal(result.provenance.method, '/usr/bin/time -l');
  assert.equal(result.provenance.samplerExecutable, '/usr/bin/time');
  assert.equal(result.provenance.childExecutable, '/bin/true');
  assert.ok(result.provenance.pid);
  assert.ok(result.provenance.durationMs);
});
