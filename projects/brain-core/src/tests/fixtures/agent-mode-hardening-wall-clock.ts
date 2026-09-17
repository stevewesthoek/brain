/** Explicit, test-only wall-clock soak scheduler. It never runs from the fast suite. */

export const HARDENING_WALL_CLOCK_MINUTE_MS = 60_000;
export const HARDENING_WALL_CLOCK_SIX_HOURS_MS = 6 * 60 * 60 * 1_000;
export const HARDENING_WALL_CLOCK_PRELIGHT_MS = 30 * 60 * 1_000;
export const HARDENING_WALL_CLOCK_RESTART_AT_MONOTONIC_MS = [120 * 60_000, 240 * 60_000] as const;

/** Frozen interval-start fault windows for one six-hour acceptance. */
export const HARDENING_WALL_CLOCK_FAULT_SCHEDULE = [
  { atMonotonicMs: 0, faultClass: 'duplicate_delivery', action: 'duplicate_delivery' },
  { atMonotonicMs: 30 * 60_000, faultClass: 'provider_outage', action: 'provider_outage_recovery' },
  { atMonotonicMs: 60 * 60_000, faultClass: 'stale_lease', action: 'stale_lease_fence' },
  { atMonotonicMs: 90 * 60_000, faultClass: 'host_loss_reconnect', action: 'fixture_node_disconnect_reconnect' },
  { atMonotonicMs: 120 * 60_000, faultClass: 'process_crash_restart', action: 'process_crash_restart' },
  { atMonotonicMs: 150 * 60_000, faultClass: 'stuck_agent', action: 'stuck_child_ttl_expiry' },
  { atMonotonicMs: 180 * 60_000, faultClass: 'spawn_limit', action: 'spawn_admission_denial' },
  { atMonotonicMs: 210 * 60_000, faultClass: 'sandbox_denial', action: 'restricted_profile_denial' },
  { atMonotonicMs: 240 * 60_000, faultClass: 'process_crash_restart', action: 'controlled_process_restart' },
  { atMonotonicMs: 270 * 60_000, faultClass: 'corrupted_state', action: 'isolated_fixture_rejection' },
  { atMonotonicMs: 300 * 60_000, faultClass: 'process_crash_restart', action: 'state_store_reopen' },
  { atMonotonicMs: 330 * 60_000, faultClass: 'tool_denial', action: 'capability_denial' },
] as const;

export type HardeningWallClockFaultPoint = typeof HARDENING_WALL_CLOCK_FAULT_SCHEDULE[number];

export function wallClockFaultPointAt(elapsedMonotonicMs: number): HardeningWallClockFaultPoint | undefined {
  return HARDENING_WALL_CLOCK_FAULT_SCHEDULE.find((point) => point.atMonotonicMs === elapsedMonotonicMs);
}

export interface HardeningWallClockSample {
  readonly cycleIndex: number;
  readonly missedCycleIndices: readonly number[];
  readonly missedFaultPointIds: readonly string[];
  readonly elapsedMonotonicMs: number;
  readonly cycleLatencyMs: number;
  readonly cycleStartDriftMs: number;
  readonly missedCycle: boolean;
  readonly faultPoint: boolean;
  readonly faultPointId: string | null;
  readonly processRestartPoint: boolean;
}

export interface HardeningWallClockOptions {
  readonly durationMs: number;
  readonly cyclePeriodMs: number;
  readonly warmupMs: number;
  readonly faultPeriodMs: number;
  readonly restartPeriodMs: number;
  readonly sample: (sample: HardeningWallClockSample) => Promise<void> | void;
  readonly scheduleReport?: (sample: HardeningWallClockSample) => void;
  readonly cycle: (cycleIndex: number, faultPoint: boolean, processRestartPoint: boolean, scheduledFault?: HardeningWallClockFaultPoint) => Promise<void>;
  readonly monotonicNow?: () => number;
  readonly wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  readonly signal?: AbortSignal;
}

export interface HardeningWallClockResult {
  readonly status: 'passed' | 'failed' | 'incomplete';
  readonly reasonCode: 'DURATION_REACHED' | 'CANCELLED' | 'CYCLE_FAILED' | 'SAMPLE_FAILED';
  readonly elapsedMonotonicMs: number;
  readonly scheduledCycles: number;
  readonly cyclesCompleted: number;
  readonly missedCycles: number;
  readonly samples: number;
  readonly faults: number;
  readonly processRestarts: number;
}

const defaultWait = (milliseconds: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal?.aborted) return reject(signal.reason ?? new Error('aborted'));
  const finish = () => { signal?.removeEventListener('abort', onAbort); resolve(); };
  const timer = setTimeout(finish, Math.max(0, milliseconds));
  const onAbort = () => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    reject(signal?.reason ?? new Error('aborted'));
  };
  signal?.addEventListener('abort', onAbort, { once: true });
});

/**
 * Runs sequential bounded cycles against a real monotonic clock. The caller owns
 * the process/StateStore lifecycle; this scheduler only emits deterministic
 * minute, 30-minute fault and two-hour restart boundaries.
 */
export async function runHardeningWallClockSoak(options: HardeningWallClockOptions): Promise<HardeningWallClockResult> {
  const now = options.monotonicNow ?? (() => performance.now());
  const wait = options.wait ?? defaultWait;
  if (!Number.isSafeInteger(options.durationMs) || options.durationMs <= 0
    || !Number.isSafeInteger(options.cyclePeriodMs) || options.cyclePeriodMs <= 0
    || !Number.isSafeInteger(options.warmupMs) || options.warmupMs < 0
    || !Number.isSafeInteger(options.faultPeriodMs) || options.faultPeriodMs <= 0
    || !Number.isSafeInteger(options.restartPeriodMs) || options.restartPeriodMs <= 0) {
    throw new Error('invalid wall-clock soak schedule');
  }
  const scheduledCycles = Math.ceil(options.durationMs / options.cyclePeriodMs);
  if (!Number.isSafeInteger(scheduledCycles) || scheduledCycles > 10_000) throw new Error('wall-clock soak cycle bound exceeded');
  const started = now();
  if (!Number.isFinite(started)) throw new Error('invalid monotonic clock');
  let cyclesCompleted = 0;
  let missedCycles = 0;
  let samples = 0;
  let faults = 0;
  let processRestarts = 0;
  let nextCycleAt = started;
  let nextCycleIndex = 1;
  let status: HardeningWallClockResult['status'] = 'passed';
  let reasonCode: HardeningWallClockResult['reasonCode'] = 'DURATION_REACHED';

  const finish = (): HardeningWallClockResult => ({
    status,
    reasonCode,
    elapsedMonotonicMs: Math.max(0, now() - started),
    scheduledCycles,
    cyclesCompleted,
    missedCycles,
    samples,
    faults,
    processRestarts,
  });

  while (nextCycleIndex <= scheduledCycles) {
    if (options.signal?.aborted) {
      status = 'incomplete'; reasonCode = 'CANCELLED'; return finish();
    }
    const elapsed = now() - started;
    if (elapsed < nextCycleAt - started) {
      try { await wait(nextCycleAt - now(), options.signal); }
      catch { status = 'incomplete'; reasonCode = 'CANCELLED'; return finish(); }
      continue;
    }
    const cycleIndex = nextCycleIndex;
    const scheduledFault = wallClockFaultPointAt((cycleIndex - 1) * options.cyclePeriodMs);
    const faultPoint = scheduledFault !== undefined || (cycleIndex > 1 && (cycleIndex - 1) * options.cyclePeriodMs % options.faultPeriodMs === 0);
    const processRestartPoint = cycleIndex > 1 && (cycleIndex - 1) * options.cyclePeriodMs % options.restartPeriodMs === 0;
    const scheduledStartAt = nextCycleAt;
    const cycleStarted = now();
    try {
      await options.cycle(cycleIndex, faultPoint, processRestartPoint, scheduledFault);
    } catch {
      status = 'failed'; reasonCode = 'CYCLE_FAILED'; return finish();
    }
    const cycleEnded = now();
    cyclesCompleted += 1;
    const cycleLatencyMs = Math.max(0, cycleEnded - cycleStarted);
    nextCycleAt += options.cyclePeriodMs;
    nextCycleIndex += 1;
    let missedCycleIndices: number[] = [];
    if (cycleEnded > nextCycleAt) {
      const skipped = Math.ceil((cycleEnded - nextCycleAt) / options.cyclePeriodMs);
      missedCycleIndices = Array.from({ length: skipped }, (_, offset) => nextCycleIndex + offset);
      missedCycles += skipped;
      nextCycleAt += skipped * options.cyclePeriodMs;
      nextCycleIndex += skipped;
    }
    const missedFaultPointIds = missedCycleIndices.flatMap((missedIndex) => {
      const point = wallClockFaultPointAt((missedIndex - 1) * options.cyclePeriodMs);
      return point ? [`${point.faultClass}:${point.atMonotonicMs}`] : [];
    });
    const completedElapsed = cycleEnded - started;
    const sample: HardeningWallClockSample = {
      cycleIndex,
      missedCycleIndices,
      missedFaultPointIds,
      elapsedMonotonicMs: completedElapsed,
      cycleLatencyMs,
      cycleStartDriftMs: Math.max(0, cycleStarted - scheduledStartAt),
      missedCycle: missedCycleIndices.length > 0,
      faultPoint,
      faultPointId: scheduledFault ? `${scheduledFault.faultClass}:${scheduledFault.atMonotonicMs}` : null,
      processRestartPoint,
    };
    options.scheduleReport?.(sample);
    if (faultPoint) faults += 1;
    if (processRestartPoint) processRestarts += 1;
    if (completedElapsed >= options.warmupMs) {
      try { await options.sample(sample); samples += 1; }
      catch { status = 'failed'; reasonCode = 'SAMPLE_FAILED'; return finish(); }
    }
    if (cycleEnded <= nextCycleAt) {
      try { await wait(nextCycleAt - cycleEnded, options.signal); }
      catch { status = 'incomplete'; reasonCode = 'CANCELLED'; return finish(); }
    } else {
      // Never overlap or catch up: missed absolute slots remain explicit and
      // future work stays aligned to the original monotonic schedule.
    }
  }
  const result = finish();
  if (result.elapsedMonotonicMs < options.durationMs) {
    return { ...result, status: 'incomplete', reasonCode: 'CANCELLED' };
  }
  return result;
}
