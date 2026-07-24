import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import {
  getContinuousProcessingLargeFileFallbackView,
  getLargeFileNightlyFallbackPlan,
} from '../adapters/continuous-processing-large-file-fallback.js';
import { refreshMindStewardInboxQueue } from '../adapters/mind-steward-inbox-queue.js';

function createMindFixture(prefix: string) {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  const inboxDir = path.join(mindRoot, 'inbox', 'new');
  const statePath = path.join(tempDir, 'brain-runtime', 'mind-steward', 'inbox-queue-state.json');
  mkdirSync(inboxDir, { recursive: true });
  return { tempDir, mindRoot, inboxDir, statePath };
}

function ageFile(filePath: string, secondsAgo: number, now: Date): void {
  const timestamp = new Date(now.getTime() - secondsAgo * 1000);
  utimesSync(filePath, timestamp, timestamp);
}

// --- View tests (existing behavior preserved) ---

test('large-file fallback view shows no blocked files when all files are below threshold', () => {
  const fixture = createMindFixture('large-file-none-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'small.md');
  writeFileSync(filePath, '# Small\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 2 },
    });
    const view = getContinuousProcessingLargeFileFallbackView({ state });

    assert.equal(view.id, 'continuous-processing-large-file-fallback-view');
    assert.equal(view.status, 'available');
    assert.equal(view.largeFileThresholdMb, 2);
    assert.equal(view.largeFileCount, 0);
    assert.equal(view.blockedLargeFiles.length, 0);
    assert.equal(view.nightlyFallbackEnabled, false);
    assert.equal(view.nightlyFallbackScheduled, false);
    assert.equal(view.blockers.length, 0);
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.schedulesNightlyJob, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('large-file fallback view lists blocked large files awaiting nightly processing', () => {
  const fixture = createMindFixture('large-file-blocked-');
  const now = new Date('2026-06-18T12:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big-capture.md');
  const smallPath = path.join(fixture.inboxDir, 'normal.md');
  writeFileSync(largePath, 'x'.repeat(3 * 1024));
  writeFileSync(smallPath, '# Normal\n');
  ageFile(largePath, 120, now);
  ageFile(smallPath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const view = getContinuousProcessingLargeFileFallbackView({ state });

    assert.equal(view.largeFileCount, 1);
    assert.equal(view.blockedLargeFiles.length, 1);
    assert.equal(view.blockedLargeFiles[0]?.path, 'inbox/new/big-capture.md');
    assert.equal(view.blockedLargeFiles[0]?.status, 'blocked');
    assert.equal(view.blockedLargeFiles[0]?.lastError, 'blocked_large_file');
    assert(view.blockedLargeFiles[0]!.sizeBytes >= 3 * 1024);
    assert(view.blockers.includes('largeFilesAwaitNightlyFallback'));
    assert.equal(view.nightlyFallbackEnabled, false);
    assert.equal(view.nightlyFallbackScheduled, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('large-file fallback view reports missing queue state as blocked', () => {
  const view = getContinuousProcessingLargeFileFallbackView({ state: null });

  assert.equal(view.status, 'missing');
  assert.equal(view.largeFileThresholdMb, null);
  assert.equal(view.largeFileCount, 0);
  assert.equal(view.blockedLargeFiles.length, 0);
  assert(view.blockers.includes('queueStateUnavailable'));
  assert.equal(view.safety.readOnly, true);
  assert.equal(view.safety.writesToMind, false);
  assert.equal(view.safety.schedulesNightlyJob, false);
});

test('large-file fallback view nightly scheduling is not yet enabled', () => {
  const fixture = createMindFixture('large-file-schedule-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, 'x'.repeat(5 * 1024));
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const view = getContinuousProcessingLargeFileFallbackView({ state });

    assert.equal(view.nightlyFallbackEnabled, false);
    assert.equal(view.nightlyFallbackScheduled, false);
    assert.equal(view.safety.schedulesNightlyJob, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.createsSchedulerJob, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('large-file fallback view does not write to Mind, move files, or start processes', () => {
  const fixture = createMindFixture('large-file-safety-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingLargeFileFallbackView({ state });

    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.movesCaptures, false);
    assert.equal(view.safety.deletesCaptures, false);
    assert.equal(view.safety.writesKanban, false);
    assert.equal(view.safety.createsSchedulerJob, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.runsWorkflowNow, false);
    assert.equal(view.safety.watcherEnabled, false);
    assert.equal(view.safety.schedulesNightlyJob, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

// --- Plan tests (new fallback mechanism) ---

test('plan: missing queue state fails safely with blocked status', () => {
  const plan = getLargeFileNightlyFallbackPlan({ state: null, now: new Date('2026-06-18T03:00:00Z') });

  assert.equal(plan.id, 'large-file-nightly-fallback-plan');
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.largeFileThresholdMb, null);
  assert.equal(plan.eligibleCount, 0);
  assert.equal(plan.eligibleFiles.length, 0);
  assert(plan.blockers.includes('queueStateUnavailable'));
  assert.equal(plan.safety.planOnly, true);
  assert.equal(plan.safety.writesToMind, false);
  assert.equal(plan.safety.runsWorkflowNow, false);
});

test('plan: no large files produces no eligible files in plan', () => {
  const fixture = createMindFixture('plan-no-large-');
  const now = new Date('2026-06-18T03:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'small.md');
  writeFileSync(filePath, '# Small\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 2 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.eligibleCount, 0);
    assert.equal(plan.eligibleFiles.length, 0);
    assert.notEqual(plan.status, 'plan-available');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: large files remain blocked from continuous selection', () => {
  const fixture = createMindFixture('plan-blocked-continuous-');
  const now = new Date('2026-06-18T03:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big.md');
  writeFileSync(largePath, 'x'.repeat(5 * 1024));
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });

    const largeItem = state.items.find(i => i.largeFile);
    assert(largeItem, 'large file should exist in queue');
    assert.equal(largeItem.status, 'blocked');
    assert.equal(largeItem.selectedForSample, false);
    assert.equal(largeItem.lastError, 'blocked_large_file');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: eligible large files appear in bounded fallback plan', () => {
  const fixture = createMindFixture('plan-eligible-');
  const now = new Date('2026-06-18T03:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big-capture.md');
  writeFileSync(largePath, 'x'.repeat(5 * 1024));
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.eligibleCount, 1);
    assert.equal(plan.eligibleFiles.length, 1);
    assert.equal(plan.eligibleFiles[0]?.path, 'inbox/new/big-capture.md');
    assert.equal(plan.eligibleFiles[0]?.eligible, true);
    assert.equal(plan.eligibleFiles[0]?.reason, 'blocked_large_file_within_nightly_bound');
    assert(plan.eligibleFiles[0]!.sizeBytes >= 5 * 1024);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: respects large-file threshold from queue settings', () => {
  const fixture = createMindFixture('plan-threshold-');
  const now = new Date('2026-06-18T03:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'medium.md');
  writeFileSync(filePath, 'x'.repeat(1 * 1024));
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 10 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.largeFileThresholdMb, 10);
    assert.equal(plan.eligibleCount, 0);
    assert.notEqual(plan.status, 'plan-available');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: respects feature-flag state (disabled by default)', () => {
  const fixture = createMindFixture('plan-flag-');
  const now = new Date('2026-06-18T03:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big.md');
  writeFileSync(largePath, 'x'.repeat(5 * 1024));
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.featureFlagEnabled, false);
    assert(plan.blockers.includes('featureFlagDisabled'));
    assert.equal(plan.status, 'blocked');
    assert.equal(plan.schedulerEnabled, false);
    assert.equal(plan.safety.requiresFeatureFlag, true);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: respects execution kill switch', () => {
  const originalValue = process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
  process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = 'true';
  const fixture = createMindFixture('plan-killswitch-');
  const now = new Date('2026-06-18T03:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big.md');
  writeFileSync(largePath, 'x'.repeat(5 * 1024));
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.killSwitchEnabled, true);
    assert(plan.blockers.includes('executionKillSwitchEnabled'));
    assert.equal(plan.status, 'blocked');
    assert.equal(plan.safety.honorsKillSwitch, true);
  } finally {
    process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = originalValue ?? '';
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: respects manual-success scheduler gates', () => {
  const fixture = createMindFixture('plan-manual-success-');
  const now = new Date('2026-06-18T03:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big.md');
  writeFileSync(largePath, 'x'.repeat(5 * 1024));
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.manualSuccessRequired, true);
    assert.equal(plan.manualSuccessProven, false);
    assert(plan.blockers.includes('manualOnDemandSuccessRequiredBeforeScheduling'));
    assert.equal(plan.safety.requiresManualSuccessBeforeScheduling, true);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: disabled by default (schedulerEnabled is always false)', () => {
  const fixture = createMindFixture('plan-disabled-');
  const now = new Date('2026-06-18T03:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big.md');
  writeFileSync(largePath, 'x'.repeat(5 * 1024));
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.schedulerEnabled, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: calling the route does not execute, schedule, mutate Mind, move captures, or start a daemon', () => {
  const fixture = createMindFixture('plan-no-execute-');
  const now = new Date('2026-06-18T03:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'big.md');
  writeFileSync(largePath, 'x'.repeat(5 * 1024));
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert.equal(plan.safety.planOnly, true);
    assert.equal(plan.safety.writesToMind, false);
    assert.equal(plan.safety.movesCaptures, false);
    assert.equal(plan.safety.deletesCaptures, false);
    assert.equal(plan.safety.writesKanban, false);
    assert.equal(plan.safety.createsSchedulerJob, false);
    assert.equal(plan.safety.startsBackgroundDaemon, false);
    assert.equal(plan.safety.runsWorkflowNow, false);
    assert.equal(plan.safety.watcherEnabled, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: file-count bound cannot be exceeded', () => {
  const fixture = createMindFixture('plan-bound-');
  const now = new Date('2026-06-18T03:00:00Z');
  for (let i = 0; i < 10; i++) {
    const filePath = path.join(fixture.inboxDir, `big-${i}.md`);
    writeFileSync(filePath, 'x'.repeat(5 * 1024));
    ageFile(filePath, 120, now);
  }

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const plan = getLargeFileNightlyFallbackPlan({ state, now });

    assert(plan.eligibleCount <= plan.maxFilesPerNightlyRun);
    assert(plan.eligibleFiles.length <= 5);
    assert.equal(plan.maxFilesPerNightlyRun, 5);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('plan: invalid/malformed queue state fails closed', () => {
  const malformedState = {
    schemaVersion: '1.0' as const,
    queueId: 'test',
    generatedAt: '2026-06-18T03:00:00Z',
    source: 'brain-runtime' as const,
    mindRoot: '/nonexistent',
    inboxPath: '/nonexistent/inbox/new',
    status: 'blocked' as const,
    settings: {
      maxConcurrentJobs: 1,
      maxFilesPerRun: 3,
      debounceSeconds: 30,
      maxRetries: 2,
      largeFileThresholdMb: 2,
      minimumSecondsBetweenRuns: 300,
      localOnly: true as const,
    },
    items: [],
    summary: { total: 0, pending: 0, blocked: 0, failed: 0, selectedForSample: 0, stableFile: 0, debouncing: 0, largeFile: 0, done: 0 },
    blockers: ['captureInboxUnavailable'],
    safety: {
      writesToMind: false as const,
      movesCaptures: false as const,
      deletesCaptures: false as const,
      writesKanban: false as const,
      stateOwnedBy: 'brain' as const,
      statePath: '/tmp/test.json',
    },
  };

  const plan = getLargeFileNightlyFallbackPlan({
    state: malformedState,
    now: new Date('2026-06-18T03:00:00Z'),
  });

  assert.equal(plan.status, 'blocked');
  assert(plan.blockers.includes('queueStateUnavailable'));
  assert.equal(plan.eligibleCount, 0);
});
