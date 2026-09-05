import assert from 'node:assert/strict';
import test from 'node:test';
import { readOpsAiCosts, readOpsAiUsageWindows, readOpsSystemMetrics } from '../adapters/ops-dashboard.js';

test('ops dashboard exposes live system metrics and AI metrics', async () => {
  const [system, usage, costs] = await Promise.all([
    readOpsSystemMetrics(),
    readOpsAiUsageWindows(),
    readOpsAiCosts(),
  ]);

  assert.equal(system.id, 'ops-system-metrics');
  assert.equal(system.data.cpuLoad.status, 'fresh');
  assert.ok(system.data.memoryPressure.status === 'fresh' || system.data.memoryPressure.status === 'unavailable');
  assert.ok(typeof system.data.cpuLoad.value === 'number');
  assert.ok(typeof system.data.memoryPressure.value === 'number' || system.data.memoryPressure.value === null);
  assert.ok(system.data.gpuLoad.status === 'fresh' || system.data.gpuLoad.status === 'unavailable');
  assert.equal(system.data.disk.id, 'primary-system-volume');
  assert.ok(['CURRENT', 'STALE', 'DEGRADED', 'UNAVAILABLE', 'ERROR', 'PENDING'].includes(system.data.disk.state));
  assert.ok(system.data.processes.topCpu.length <= 5);
  assert.ok(system.data.processes.topMemory.length <= 5);
  assert.ok(system.data.processes.brainServices.length <= 5);
  assert.equal(system.data.collector.samplingIntervalMs, 10_000);
  assert.ok(system.data.collector.payloadBytes >= 0);

  assert.equal(usage.id, 'ops-ai-usage-windows');
  assert.ok(usage.status === 'available' || usage.status === 'partial');
  assert.ok(usage.data.diagnostics.filesInspected >= 0);
  assert.ok(usage.data.diagnostics.bytesRead >= 0);
  assert.ok(['CURRENT', 'STALE', 'DEGRADED', 'UNAVAILABLE', 'PENDING'].includes(usage.data.diagnostics.freshness));
  assert.ok(['fresh', 'stale', 'unavailable'].includes(usage.data.codexCurrentWindow.status));
  assert.ok(['fresh', 'stale', 'unavailable'].includes(usage.data.codexFiveHourWindow.status));
  assert.ok(['fresh', 'stale', 'unavailable'].includes(usage.data.codexSevenDayWindow.status));
  assert.ok(typeof usage.data.codexCurrentWindow.value === 'number');
  assert.ok(typeof usage.data.codexFiveHourWindow.value === 'number');
  assert.ok(typeof usage.data.codexSevenDayWindow.value === 'number');

  assert.equal(costs.id, 'ops-ai-costs');
  assert.ok(costs.status === 'available' || costs.status === 'partial');
  assert.equal(costs.data.claudeCodeHaiku.status, 'fresh');
  assert.equal(costs.data.claudeCodeSonnet.status, 'fresh');
  assert.equal(costs.data.claudeCodeOpus.status, 'fresh');
  assert.ok(typeof costs.data.claudeCodeHaiku.value === 'number');
  assert.ok(typeof costs.data.claudeCodeSonnet.value === 'number');
  assert.ok(typeof costs.data.claudeCodeOpus.value === 'number');
});
