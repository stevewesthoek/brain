import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { getContinuousProcessingFailureBufferView } from '../adapters/continuous-processing-failure-buffer.js';
import { recordMindStewardInboxQueueFailure, refreshMindStewardInboxQueue } from '../adapters/mind-steward-inbox-queue.js';

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

test('failure buffer shows empty state when no failures exist', () => {
  const fixture = createMindFixture('failure-buffer-empty-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'capture.md');
  writeFileSync(filePath, '# Capture\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 2 },
    });
    const view = getContinuousProcessingFailureBufferView({ state });

    assert.equal(view.id, 'continuous-processing-failure-buffer-view');
    assert.equal(view.status, 'available');
    assert.equal(view.maxRetries, 2);
    assert.equal(view.exhaustedCount, 0);
    assert.equal(view.retryPendingCount, 0);
    assert.equal(view.totalFailureBufferCount, 0);
    assert.equal(view.shouldPauseContinuousProcessing, false);
    assert.equal(view.items.length, 0);
    assert.equal(view.blockers.length, 0);
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.clearsFailureBuffer, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('failure buffer tracks retry-pending items without pausing', () => {
  const fixture = createMindFixture('failure-buffer-pending-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'retry.md');
  writeFileSync(filePath, '# Retry\n');
  ageFile(filePath, 120, now);

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 3 },
    });
    recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'inbox/new/retry.md',
      error: 'classifier_timeout',
      now: new Date('2026-06-18T12:01:00Z'),
      retryDelaySeconds: 120,
    });
    const refreshed = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:01:30Z'),
      settings: { maxRetries: 3 },
    });
    const view = getContinuousProcessingFailureBufferView({ state: refreshed });

    assert.equal(view.exhaustedCount, 0);
    assert.equal(view.retryPendingCount, 1);
    assert.equal(view.totalFailureBufferCount, 1);
    assert.equal(view.shouldPauseContinuousProcessing, false);
    assert.equal(view.items[0]?.retriesExhausted, false);
    assert.equal(view.items[0]?.attemptCount, 1);
    assert.notEqual(view.items[0]?.nextRetryAfter, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('failure buffer tracks exhausted items and recommends pausing above threshold', () => {
  const fixture = createMindFixture('failure-buffer-pause-');
  const now = new Date('2026-06-18T12:00:00Z');

  for (let i = 0; i < 6; i++) {
    const filePath = path.join(fixture.inboxDir, `fail-${i}.md`);
    writeFileSync(filePath, `# Fail ${i}\n`);
    ageFile(filePath, 120, now);
  }

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 1, maxFilesPerRun: 10 },
    });

    for (let i = 0; i < 6; i++) {
      recordMindStewardInboxQueueFailure({
        statePath: fixture.statePath,
        capturePath: `inbox/new/fail-${i}.md`,
        error: 'classifier_timeout',
        now: new Date(`2026-06-18T12:01:0${i}Z`),
        retryDelaySeconds: 60,
      });
      recordMindStewardInboxQueueFailure({
        statePath: fixture.statePath,
        capturePath: `inbox/new/fail-${i}.md`,
        error: 'classifier_timeout_again',
        now: new Date(`2026-06-18T12:03:0${i}Z`),
        retryDelaySeconds: 60,
      });
    }

    const refreshed = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:10:00Z'),
      settings: { maxRetries: 1, maxFilesPerRun: 10 },
    });
    const view = getContinuousProcessingFailureBufferView({
      state: refreshed,
      failureBufferPauseThreshold: 5,
    });

    assert.equal(view.exhaustedCount, 6);
    assert.equal(view.shouldPauseContinuousProcessing, true);
    assert(view.blockers.includes('failureBufferExceedsPauseThreshold'));
    assert.equal(view.items.every(item => item.retriesExhausted), true);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('failure buffer does not pause when exhausted count is below threshold', () => {
  const fixture = createMindFixture('failure-buffer-under-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'one-fail.md');
  writeFileSync(filePath, '# One fail\n');
  ageFile(filePath, 120, now);

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 1 },
    });
    recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'inbox/new/one-fail.md',
      error: 'timeout',
      now: new Date('2026-06-18T12:01:00Z'),
    });
    recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'inbox/new/one-fail.md',
      error: 'timeout_again',
      now: new Date('2026-06-18T12:02:00Z'),
    });
    const refreshed = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:10:00Z'),
      settings: { maxRetries: 1 },
    });
    const view = getContinuousProcessingFailureBufferView({
      state: refreshed,
      failureBufferPauseThreshold: 5,
    });

    assert.equal(view.exhaustedCount, 1);
    assert.equal(view.shouldPauseContinuousProcessing, false);
    assert.equal(view.blockers.length, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('failure buffer reports missing queue state as blocked read-only', () => {
  const view = getContinuousProcessingFailureBufferView({ state: null });

  assert.equal(view.status, 'missing');
  assert.equal(view.maxRetries, null);
  assert.equal(view.exhaustedCount, 0);
  assert.equal(view.retryPendingCount, 0);
  assert.equal(view.shouldPauseContinuousProcessing, false);
  assert(view.blockers.includes('queueStateUnavailable'));
  assert.equal(view.safety.readOnly, true);
  assert.equal(view.safety.writesToMind, false);
  assert.equal(view.safety.startsBackgroundDaemon, false);
  assert.equal(view.safety.clearsFailureBuffer, false);
});

test('failure buffer does not clear failures or start background processes', () => {
  const fixture = createMindFixture('failure-buffer-safety-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'safe.md');
  writeFileSync(filePath, '# Safe\n');
  ageFile(filePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const view = getContinuousProcessingFailureBufferView({ state });

    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.movesCaptures, false);
    assert.equal(view.safety.deletesCaptures, false);
    assert.equal(view.safety.writesKanban, false);
    assert.equal(view.safety.createsSchedulerJob, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.runsWorkflowNow, false);
    assert.equal(view.safety.watcherEnabled, false);
    assert.equal(view.safety.clearsFailureBuffer, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
