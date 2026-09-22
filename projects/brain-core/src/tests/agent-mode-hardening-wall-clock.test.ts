import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import test from 'node:test';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { AgentModeSqliteStateStore } from '../agent-mode/sqlite-state-store.js';
import {
  verifyCorruptedSnapshotRejected,
  verifyFixtureNodeLossReconnect,
  verifyProviderOutageRecovery,
  verifySandboxAndToolDenials,
  verifySpawnLimitDenial,
  verifyStaleLeaseFence,
  verifyStuckChildExpiresAndReleasesAuthority,
} from './agent-mode-hardening-wall-clock-soak.js';
import {
  HARDENING_WALL_CLOCK_FAULT_SCHEDULE,
  HARDENING_WALL_CLOCK_RESTART_AT_MONOTONIC_MS,
  HARDENING_WALL_CLOCK_SIX_HOURS_MS,
  runHardeningWallClockSoak,
  wallClockFaultPointAt,
} from './fixtures/agent-mode-hardening-wall-clock.js';

test('H0-B fault windows are fixed, bounded, ordered, and cover twelve half-hour intervals', () => {
  assert.equal(HARDENING_WALL_CLOCK_FAULT_SCHEDULE.length, 12);
  assert.deepEqual(HARDENING_WALL_CLOCK_FAULT_SCHEDULE.map(({ atMonotonicMs }) => atMonotonicMs),
    Array.from({ length: 12 }, (_, index) => index * 30 * 60_000));
  assert.equal(wallClockFaultPointAt(30 * 60_000)?.faultClass, 'provider_outage');
  assert.equal(wallClockFaultPointAt(90 * 60_000)?.faultClass, 'host_loss_reconnect');
  assert.equal(wallClockFaultPointAt(330 * 60_000)?.faultClass, 'tool_denial');
  assert.equal(wallClockFaultPointAt(31 * 60_000), undefined);
  assert.ok(HARDENING_WALL_CLOCK_FAULT_SCHEDULE.every((point) => point.action.length > 0));
  assert.deepEqual(HARDENING_WALL_CLOCK_RESTART_AT_MONOTONIC_MS, [7_200_000, 14_400_000]);
});

test('scheduled isolated provider, lease, node, admission, sandbox, corruption, and stuck-child TTL fixtures fail closed', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'brain-h0-fault-actions-'));
  const store = new AgentModeSqliteStateStore(path.join(root, 'state.db'));
  const at = '2026-09-16T12:00:00.000Z';
  try {
    await verifyProviderOutageRecovery(at, HARDENING_WALL_CLOCK_FAULT_SCHEDULE[1]!);
    verifyStaleLeaseFence(store, at, HARDENING_WALL_CLOCK_FAULT_SCHEDULE[2]!);
    await verifyFixtureNodeLossReconnect(at);
    verifySpawnLimitDenial(at);
    verifySandboxAndToolDenials();
    verifyCorruptedSnapshotRejected();
    verifyStuckChildExpiresAndReleasesAuthority(store, at, HARDENING_WALL_CLOCK_FAULT_SCHEDULE[5]!);
    const expiredChildren = store.listAgents().filter((agent) => agent.status === 'expired');
    assert.equal(expiredChildren.length, 1);
    assert.equal(store.getSpawnRootState('goal:h0-wall-clock-fixture')?.activeChildren, 0);
    assert.equal(store.listTasks().length, 0);
  } finally {
    store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('wall-clock runner uses monotonic elapsed time and deterministic sampling/fault/restart boundaries', async () => {
  let monotonic = 0;
  const cycles: Array<{ index: number; fault: boolean; restart: boolean }> = [];
  const samples: number[] = [];
  const result = await runHardeningWallClockSoak({
    durationMs: 100,
    cyclePeriodMs: 10,
    warmupMs: 20,
    faultPeriodMs: 30,
    restartPeriodMs: 60,
    monotonicNow: () => monotonic,
    wait: async (milliseconds) => { monotonic += milliseconds; },
    cycle: async (cycleIndex, faultPoint, processRestartPoint) => {
      cycles.push({ index: cycleIndex, fault: faultPoint, restart: processRestartPoint });
    },
    sample: ({ cycleIndex }) => { samples.push(cycleIndex); },
  });
  assert.equal(result.status, 'passed');
  assert.equal(result.elapsedMonotonicMs, 100);
  assert.equal(result.cyclesCompleted, 10);
  assert.deepEqual(cycles.filter((cycle) => cycle.fault).map((cycle) => cycle.index), [1, 4, 7, 10]);
  assert.deepEqual(cycles.filter((cycle) => cycle.restart).map((cycle) => cycle.index), [7]);
  assert.deepEqual(samples, [3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(result.samples, 8);
  assert.equal(HARDENING_WALL_CLOCK_SIX_HOURS_MS, 21_600_000);
});

test('wall-clock runner never overlaps cycles and records missed schedule slots', async () => {
  let monotonic = 0;
  const completedIndices: number[] = [];
  const missedIndices: number[] = [];
  const result = await runHardeningWallClockSoak({
    durationMs: 55,
    cyclePeriodMs: 10,
    warmupMs: 0,
    faultPeriodMs: 100,
    restartPeriodMs: 100,
    monotonicNow: () => monotonic,
    wait: async (milliseconds) => { monotonic += milliseconds; },
    cycle: async (cycleIndex) => { completedIndices.push(cycleIndex); monotonic += 11; },
    scheduleReport: ({ missedCycleIndices }) => missedIndices.push(...missedCycleIndices),
    sample: () => undefined,
  });
  assert.equal(result.cyclesCompleted, 3);
  assert.equal(result.missedCycles, 3);
  assert.equal(result.scheduledCycles, 6);
  assert.deepEqual(completedIndices, [1, 3, 5]);
  assert.deepEqual(missedIndices, [2, 4, 6]);
});

test('wall-clock runner returns incomplete on cancellation and failed on cycle/sample errors', async () => {
  const controller = new AbortController();
  let monotonic = 0;
  const cancelled = await runHardeningWallClockSoak({
    durationMs: 100,
    cyclePeriodMs: 10,
    warmupMs: 10,
    faultPeriodMs: 30,
    restartPeriodMs: 60,
    signal: controller.signal,
    monotonicNow: () => monotonic,
    wait: async (milliseconds) => { monotonic += milliseconds; controller.abort(); },
    cycle: async () => undefined,
    sample: () => undefined,
  });
  assert.equal(cancelled.status, 'incomplete');
  assert.equal(cancelled.reasonCode, 'CANCELLED');

  const cycleFailure = await runHardeningWallClockSoak({
    durationMs: 100, cyclePeriodMs: 10, warmupMs: 0, faultPeriodMs: 30, restartPeriodMs: 60,
    monotonicNow: () => 0, cycle: async () => { throw new Error('private detail'); }, sample: () => undefined,
  });
  assert.equal(cycleFailure.status, 'failed');
  assert.equal(cycleFailure.reasonCode, 'CYCLE_FAILED');

  const sampleFailure = await runHardeningWallClockSoak({
    durationMs: 100, cyclePeriodMs: 10, warmupMs: 0, faultPeriodMs: 30, restartPeriodMs: 60,
    monotonicNow: () => 0, cycle: async () => undefined, sample: () => { throw new Error('private detail'); },
  });
  assert.equal(sampleFailure.status, 'failed');
  assert.equal(sampleFailure.reasonCode, 'SAMPLE_FAILED');
});
