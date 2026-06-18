import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { getContinuousProcessingConcurrencyView } from '../adapters/continuous-processing-concurrency.js';
import { enforceMindStewardInboxQueuePolicy, refreshMindStewardInboxQueue } from '../adapters/mind-steward-inbox-queue.js';

function createMindFixture(prefix: string) {
  const tempDir = mkdtempSync(path.join('/tmp', prefix));
  const mindRoot = path.join(tempDir, 'mind');
  const inboxDir = path.join(mindRoot, 'capture', 'inbox');
  const statePath = path.join(tempDir, 'brain-runtime', 'mind-steward', 'inbox-queue-state.json');
  mkdirSync(inboxDir, { recursive: true });
  return { tempDir, mindRoot, inboxDir, statePath };
}

function ageFile(filePath: string, secondsAgo: number, now: Date): void {
  const timestamp = new Date(now.getTime() - secondsAgo * 1000);
  utimesSync(filePath, timestamp, timestamp);
}

test('concurrency view shows available slots when no jobs are running', () => {
  const fixture = createMindFixture('concurrency-available-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxConcurrentJobs: 2 },
    });
    const view = getContinuousProcessingConcurrencyView({ state, runningJobs: 0 });

    assert.equal(view.id, 'continuous-processing-concurrency-view');
    assert.equal(view.status, 'available');
    assert.equal(view.maxConcurrentJobs, 2);
    assert.equal(view.runningJobs, 0);
    assert.equal(view.availableSlots, 2);
    assert.equal(view.capReached, false);
    assert.equal(view.capBlocking, false);
    assert.equal(view.blockers.length, 0);
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.modifiesConcurrencyAtRuntime, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('concurrency view reports cap reached and blocking when running jobs equal max', () => {
  const fixture = createMindFixture('concurrency-cap-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxConcurrentJobs: 1 },
    });
    const view = getContinuousProcessingConcurrencyView({ state, runningJobs: 1 });

    assert.equal(view.status, 'available');
    assert.equal(view.maxConcurrentJobs, 1);
    assert.equal(view.runningJobs, 1);
    assert.equal(view.availableSlots, 0);
    assert.equal(view.capReached, true);
    assert.equal(view.capBlocking, true);
    assert(view.blockers.includes('maxConcurrentJobsReached'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('concurrency view reports cap reached when running jobs exceed max', () => {
  const fixture = createMindFixture('concurrency-exceed-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxConcurrentJobs: 1 },
    });
    const view = getContinuousProcessingConcurrencyView({ state, runningJobs: 3 });

    assert.equal(view.capReached, true);
    assert.equal(view.capBlocking, true);
    assert.equal(view.availableSlots, 0);
    assert(view.blockers.includes('maxConcurrentJobsReached'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('concurrency view reports missing queue state as blocked without slots', () => {
  const view = getContinuousProcessingConcurrencyView({ state: null, runningJobs: 0 });

  assert.equal(view.status, 'missing');
  assert.equal(view.maxConcurrentJobs, null);
  assert.equal(view.runningJobs, 0);
  assert.equal(view.availableSlots, 0);
  assert.equal(view.capReached, false);
  assert.equal(view.capBlocking, false);
  assert(view.blockers.includes('queueStateUnavailable'));
  assert.equal(view.safety.readOnly, true);
  assert.equal(view.safety.watcherEnabled, false);
});

test('concurrency cap is consistently enforced by queue policy', () => {
  const fixture = createMindFixture('concurrency-policy-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxConcurrentJobs: 1 },
    });
    const concurrencyView = getContinuousProcessingConcurrencyView({ state, runningJobs: 1 });
    const policy = enforceMindStewardInboxQueuePolicy({
      state,
      now,
      runningJobs: 1,
      featureFlagEnabled: true,
    });

    assert.equal(concurrencyView.capBlocking, true);
    assert.equal(policy.status, 'blocked');
    assert(policy.blockers.includes('maxConcurrentJobsReached'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('concurrency view does not modify queue state or start background processes', () => {
  const fixture = createMindFixture('concurrency-safety-');
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
    const view = getContinuousProcessingConcurrencyView({ state, runningJobs: 0 });

    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.movesCaptures, false);
    assert.equal(view.safety.deletesCaptures, false);
    assert.equal(view.safety.writesKanban, false);
    assert.equal(view.safety.createsSchedulerJob, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.runsWorkflowNow, false);
    assert.equal(view.safety.watcherEnabled, false);
    assert.equal(view.safety.modifiesConcurrencyAtRuntime, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
