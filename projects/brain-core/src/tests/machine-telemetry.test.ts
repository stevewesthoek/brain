import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MachineTelemetryCollector,
  collectMachineTelemetry,
  diskStateForUsage,
  parseDfOutput,
  parsePsOutput,
  type MachineSample,
} from '../adapters/machine-telemetry.js';

const sampledAt = '2026-09-05T08:00:00.000Z';

test('disk telemetry parses the primary volume and applies conservative pressure states', () => {
  const disk = parseDfOutput('Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3s1 1000000 850000 150000 85% /\n', sampledAt);
  assert.equal(disk.id, 'primary-system-volume');
  assert.equal(disk.mountPoint, '/');
  assert.equal(disk.filesystem, 'local system volume');
  assert.equal(disk.totalBytes, 1024000000);
  assert.equal(disk.usedPercent, 85);
  assert.equal(disk.state, 'DEGRADED');
  assert.equal(diskStateForUsage(95), 'ERROR');
  assert.equal(diskStateForUsage(null), 'UNAVAILABLE');
});

test('process projection is bounded, service-correlated, and excludes raw command lines', () => {
  const result = parsePsOutput([
    '101 12.5 600000 01:02:03 S node /Users/Office/Repos/stevewesthoek/brain-core/dist/index.js',
    '102 8.0 500000 00:12:00 R node /Users/Office/Repos/stevewesthoek/brain-console-service/server.js',
    '103 3.0 100000 02:00:00 S /Users/Office/.local/bin/brain-scheduler-runner',
    '104 1.0 300000 3-01:00:00 S /Applications/Obsidian.app/Contents/MacOS/Obsidian',
    '105 0.5 700000 00:01:00 S /usr/bin/private-worker --token=never-return-this',
    '106 0.2 1000 00:01:00 S /usr/bin/small-worker',
  ].join('\n'), sampledAt, 101, 5);

  assert.equal(result.processes.length, 5);
  assert.equal(result.totalProcessCount, 6);
  assert.equal(result.truncated, true);
  assert.equal(result.processes.find((process) => process.serviceId === 'brain-core')?.serviceId, 'brain-core');
  assert.equal(result.processes.find((process) => process.serviceId === 'brain-console')?.serviceId, 'brain-console');
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('never-return-this'), false);
  assert.equal(result.processes.some((process) => process.serviceId === 'scheduler'), true);
});

test('collection isolates command failures and never invokes a shell', async () => {
  const calls: Array<{ file: string; args: string[] }> = [];
  const sample = await collectMachineTelemetry({
    now: () => new Date(sampledAt),
    brainCorePid: 101,
    runCommand: async (file, args) => {
      calls.push({ file, args });
      if (file === '/bin/df') throw new Error('disk unavailable');
      return { stdout: '101 1.0 100 00:01:00 S node /brain-core/dist/index.js' };
    },
  });
  assert.equal(sample.disk.state, 'UNAVAILABLE');
  assert.equal(sample.processes.sampledCount, 1);
  assert.deepEqual(calls.map((call) => call.file).sort(), ['/bin/df', '/bin/ps']);
  assert.ok(calls.every((call) => call.args.every((arg) => !arg.includes('&&') && !arg.includes(';'))));
});

function sample(): MachineSample {
  return {
    generatedAt: sampledAt,
    collectionDurationMs: 12,
    disk: parseDfOutput('Filesystem 1024-blocks Used Available Capacity Mounted on\n/dev/disk3s1 1000 100 900 10% /\n', sampledAt),
    processes: {
      state: 'CURRENT', sampledAt, sampleLatencyMs: 12, sampledCount: 1, totalProcessCount: 1, truncated: false,
      topCpu: [], topMemory: [], brainServices: [], anomalies: [],
    },
  };
}

test('collector deduplicates concurrent refreshes and exposes bounded cache diagnostics', async () => {
  let calls = 0;
  let resolve: ((value: MachineSample) => void) | undefined;
  const collector = new MachineTelemetryCollector({
    now: () => new Date(sampledAt),
    collect: () => {
      calls += 1;
      return new Promise<MachineSample>((done) => { resolve = done; });
    },
  });
  const first = collector.refresh();
  const second = collector.refresh();
  assert.equal(first, second);
  assert.equal(calls, 1);
  resolve?.(sample());
  const snapshot = await first;
  assert.equal(snapshot.collector.collectionCount, 1);
  assert.equal(snapshot.collector.payloadBytes > 0, true);
  assert.equal(snapshot.collector.inFlight, false);
  assert.equal(snapshot.processes.topCpu.length, 0);
});
