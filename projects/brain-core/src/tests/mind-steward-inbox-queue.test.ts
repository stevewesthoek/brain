import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import {
  enforceMindStewardInboxQueuePolicy,
  readMindStewardInboxQueueState,
  recordMindStewardInboxQueueFailure,
  refreshMindStewardInboxQueue,
} from '../adapters/mind-steward-inbox-queue.js';

function createMindFixture(prefix: string): {
  tempDir: string;
  mindRoot: string;
  inboxDir: string;
  statePath: string;
} {
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

test('persistent inbox queue writes Brain-owned state without changing Mind captures', () => {
  const fixture = createMindFixture('mind-inbox-queue-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);
  const beforeCapture = readFileSync(capturePath, 'utf8');

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });

    assert.equal(state.status, 'ready');
    assert.equal(state.source, 'brain-runtime');
    assert.equal(state.safety.stateOwnedBy, 'brain');
    assert.equal(state.safety.writesToMind, false);
    assert.equal(state.safety.movesCaptures, false);
    assert.equal(state.safety.deletesCaptures, false);
    assert.equal(state.safety.writesKanban, false);
    assert.equal(state.items.length, 1);
    assert.equal(state.items[0]?.path, 'capture/inbox/capture-a.md');
    assert.equal(state.items[0]?.status, 'pending');
    assert.equal(state.items[0]?.selectedForSample, true);
    assert.equal(state.items[0]?.stableFile, true);
    assert.equal(state.items[0]?.stableAt, '2026-06-18T11:58:30.000Z');
    assert.equal(state.items[0]?.debounceSeconds, 30);
    assert.equal(state.items[0]?.debounceUntil, null);
    assert.equal(state.items[0]?.attemptCount, 0);
    assert.equal(state.items[0]?.contentSha256.length, 64);
    assert.equal(existsSync(fixture.statePath), true);
    assert.equal(readFileSync(capturePath, 'utf8'), beforeCapture);
    assert.equal(existsSync(path.join(fixture.mindRoot, 'kanban.md')), false);

    const persisted = readMindStewardInboxQueueState(fixture.statePath);
    assert.equal(persisted?.items[0]?.firstSeenAt, state.items[0]?.firstSeenAt);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue reads human-first inbox/new before legacy capture/inbox', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-inbox-queue-target-'));
  const mindRoot = path.join(tempDir, 'mind');
  const targetInboxDir = path.join(mindRoot, 'inbox', 'new');
  const legacyInboxDir = path.join(mindRoot, 'capture', 'inbox');
  const statePath = path.join(tempDir, 'brain-runtime', 'mind-steward', 'inbox-queue-state.json');
  const now = new Date('2026-06-18T12:00:00Z');
  mkdirSync(targetInboxDir, { recursive: true });
  mkdirSync(legacyInboxDir, { recursive: true });
  const targetCapturePath = path.join(targetInboxDir, 'target-capture.md');
  const legacyCapturePath = path.join(legacyInboxDir, 'legacy-capture.md');
  writeFileSync(targetCapturePath, '# Target Capture\n');
  writeFileSync(legacyCapturePath, '# Legacy Capture\n');
  ageFile(targetCapturePath, 120, now);
  ageFile(legacyCapturePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({ mindRoot, statePath, now });

    assert.equal(state.status, 'ready');
    assert.equal(state.inboxPath, realpathSync(targetInboxDir));
    assert.deepEqual(state.items.map(item => item.path), ['inbox/new/target-capture.md']);
    assert.equal(readFileSync(targetCapturePath, 'utf8'), '# Target Capture\n');
    assert.equal(readFileSync(legacyCapturePath, 'utf8'), '# Legacy Capture\n');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue preserves firstSeenAt and attemptCount across refreshes', () => {
  const fixture = createMindFixture('mind-inbox-queue-persist-');
  const firstNow = new Date('2026-06-18T12:00:00Z');
  const secondNow = new Date('2026-06-18T12:05:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, firstNow);

  try {
    const first = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: firstNow,
    });
    const persisted = JSON.parse(readFileSync(fixture.statePath, 'utf8'));
    persisted.items[0].attemptCount = 1;
    writeFileSync(fixture.statePath, `${JSON.stringify(persisted, null, 2)}\n`);
    ageFile(capturePath, 120, secondNow);

    const second = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: secondNow,
    });

    assert.equal(second.items[0]?.firstSeenAt, first.items[0]?.firstSeenAt);
    assert.equal(second.items[0]?.attemptCount, 1);
    assert.equal(second.items[0]?.lastCheckedAt, secondNow.toISOString());
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue blocks large files and debounces unstable files', () => {
  const fixture = createMindFixture('mind-inbox-queue-blocks-');
  const now = new Date('2026-06-18T12:00:00Z');
  const stablePath = path.join(fixture.inboxDir, 'stable.md');
  const recentPath = path.join(fixture.inboxDir, 'recent.md');
  const largePath = path.join(fixture.inboxDir, 'large.md');
  writeFileSync(stablePath, '# Stable\n');
  writeFileSync(recentPath, '# Recent\n');
  writeFileSync(largePath, 'x'.repeat(2 * 1024 + 1));
  ageFile(stablePath, 120, now);
  ageFile(recentPath, 5, now);
  ageFile(largePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: {
        largeFileThresholdMb: 0.001,
        debounceSeconds: 30,
        maxFilesPerRun: 3,
      },
    });

    const byPath = new Map(state.items.map(item => [item.path, item]));
    assert.equal(byPath.get('capture/inbox/stable.md')?.selectedForSample, true);
    assert.equal(byPath.get('capture/inbox/stable.md')?.stableFile, true);
    assert.equal(byPath.get('capture/inbox/stable.md')?.debounceUntil, null);
    assert.equal(byPath.get('capture/inbox/recent.md')?.status, 'pending');
    assert.equal(byPath.get('capture/inbox/recent.md')?.selectedForSample, false);
    assert.equal(byPath.get('capture/inbox/recent.md')?.stableFile, false);
    assert.equal(byPath.get('capture/inbox/recent.md')?.stableAt, '2026-06-18T12:00:25.000Z');
    assert.equal(byPath.get('capture/inbox/recent.md')?.debounceUntil, '2026-06-18T12:00:25.000Z');
    assert.equal(byPath.get('capture/inbox/large.md')?.status, 'blocked');
    assert.equal(byPath.get('capture/inbox/large.md')?.largeFile, true);
    assert.equal(byPath.get('capture/inbox/large.md')?.lastError, 'blocked_large_file');
    assert.equal(state.summary.selectedForSample, 1);
    assert.equal(state.summary.stableFile, 2);
    assert.equal(state.summary.debouncing, 1);
    assert.equal(state.summary.blocked, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue enforces maxFilesPerRun sample limit', () => {
  const fixture = createMindFixture('mind-inbox-queue-limit-');
  const now = new Date('2026-06-18T12:00:00Z');
  for (const name of ['a.md', 'b.md', 'c.md']) {
    const filePath = path.join(fixture.inboxDir, name);
    writeFileSync(filePath, `# ${name}\n`);
    ageFile(filePath, 120, now);
  }

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxFilesPerRun: 2 },
    });

    assert.equal(state.items.filter(item => item.selectedForSample).length, 2);
    assert.equal(state.summary.total, 3);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inbox queue policy allows a flagged local run within queue limits', () => {
  const fixture = createMindFixture('mind-inbox-queue-policy-ready-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const policy = enforceMindStewardInboxQueuePolicy({
      state,
      now,
      runningJobs: 0,
      lastRunAt: '2026-06-18T11:50:00Z',
      featureFlagEnabled: true,
    });

    assert.equal(policy.status, 'ready');
    assert.equal(policy.canStartRun, true);
    assert.equal(policy.selectedItems.length, 1);
    assert.equal(policy.settings.maxConcurrentJobs, 1);
    assert.equal(policy.safety.requiresFeatureFlag, true);
    assert.equal(policy.safety.localOnly, true);
    assert.equal(policy.safety.writesToMind, false);
    assert.equal(policy.safety.movesCaptures, false);
    assert.equal(policy.safety.deletesCaptures, false);
    assert.equal(policy.safety.writesKanban, false);
    assert.equal(policy.safety.startsBackgroundDaemon, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inbox queue policy blocks a selected item that is still inside the debounce window', () => {
  const fixture = createMindFixture('mind-inbox-queue-policy-debounce-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 5, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { debounceSeconds: 30 },
    });
    const manipulatedState = {
      ...state,
      items: state.items.map(item => ({ ...item, selectedForSample: true })),
    };
    const policy = enforceMindStewardInboxQueuePolicy({
      state: manipulatedState,
      now,
      featureFlagEnabled: true,
    });

    assert.equal(state.items[0]?.stableFile, false);
    assert.equal(state.items[0]?.debounceUntil, '2026-06-18T12:00:25.000Z');
    assert.equal(policy.status, 'blocked');
    assert.equal(policy.canStartRun, false);
    assert(policy.blockers.includes('selectedItemsMustBeStableAfterDebounce'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inbox queue policy blocks when workflow feature flag is off', () => {
  const fixture = createMindFixture('mind-inbox-queue-policy-flag-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    const policy = enforceMindStewardInboxQueuePolicy({ state, now, featureFlagEnabled: false });

    assert.equal(policy.status, 'blocked');
    assert.equal(policy.canStartRun, false);
    assert(policy.blockers.includes('queueWorkflowFeatureFlagRequired'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inbox queue policy blocks max concurrency and minimum run interval violations', () => {
  const fixture = createMindFixture('mind-inbox-queue-policy-throttle-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { minimumSecondsBetweenRuns: 300, maxConcurrentJobs: 1 },
    });
    const policy = enforceMindStewardInboxQueuePolicy({
      state,
      now,
      runningJobs: 1,
      lastRunAt: '2026-06-18T11:59:00Z',
      featureFlagEnabled: true,
    });

    assert.equal(policy.status, 'blocked');
    assert(policy.blockers.includes('maxConcurrentJobsReached'));
    assert(policy.blockers.includes('minimumSecondsBetweenRunsNotElapsed'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inbox queue policy blocks selected large files and over-limit selections', () => {
  const fixture = createMindFixture('mind-inbox-queue-policy-large-');
  const now = new Date('2026-06-18T12:00:00Z');
  for (const name of ['a.md', 'b.md']) {
    const filePath = path.join(fixture.inboxDir, name);
    writeFileSync(filePath, `# ${name}\n`);
    ageFile(filePath, 120, now);
  }

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxFilesPerRun: 1 },
    });
    state.items.forEach(item => {
      item.selectedForSample = true;
      item.status = 'pending';
    });
    const firstItem = state.items[0];
    assert(firstItem);
    firstItem.largeFile = true;
    firstItem.lastError = 'blocked_large_file';

    const policy = enforceMindStewardInboxQueuePolicy({
      state,
      now,
      featureFlagEnabled: true,
    });

    assert.equal(policy.status, 'blocked');
    assert(policy.blockers.includes('maxFilesPerRunExceeded'));
    assert(policy.blockers.includes('largeFileSelectedForRun'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('inbox queue policy blocks retry-exhausted selected items', () => {
  const fixture = createMindFixture('mind-inbox-queue-policy-retry-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 2 },
    });
    const item = state.items[0];
    assert(item);
    item.attemptCount = 3;
    item.selectedForSample = true;

    const policy = enforceMindStewardInboxQueuePolicy({
      state,
      now,
      featureFlagEnabled: true,
    });

    assert.equal(policy.status, 'blocked');
    assert(policy.blockers.includes('retryLimitExceeded'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue writes blocked Brain state when inbox is missing', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-inbox-queue-missing-'));
  const mindRoot = path.join(tempDir, 'mind');
  const statePath = path.join(tempDir, 'brain-runtime', 'mind-steward', 'inbox-queue-state.json');
  mkdirSync(mindRoot, { recursive: true });

  try {
    const state = refreshMindStewardInboxQueue({
      mindRoot,
      statePath,
      now: new Date('2026-06-18T12:00:00Z'),
    });

    assert.equal(state.status, 'blocked');
    assert(state.blockers.includes('mindInboxUnavailable'));
    assert.equal(state.safety.writesToMind, false);
    assert.equal(existsSync(statePath), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue records disappeared captures as done without moving files', () => {
  const fixture = createMindFixture('mind-inbox-queue-done-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);

  try {
    const first = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    rmSync(capturePath);

    const second = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.equal(second.items[0]?.id, first.items[0]?.id);
    assert.equal(second.items[0]?.status, 'done');
    assert.equal(second.items[0]?.lastError, 'capture_not_found_in_inbox');
    assert.equal(statSync(fixture.inboxDir).isDirectory(), true);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue does not reselect unchanged handled captures', () => {
  const fixture = createMindFixture('mind-inbox-queue-repeat-');
  const now = new Date('2026-06-18T12:00:00Z');
  const statuses = ['reported', 'approved', 'done'] as const;
  for (const status of statuses) {
    const filePath = path.join(fixture.inboxDir, `${status}.md`);
    writeFileSync(filePath, `# ${status}\n`);
    ageFile(filePath, 120, now);
  }

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxFilesPerRun: 3 },
    });
    const persisted = JSON.parse(readFileSync(fixture.statePath, 'utf8'));
    for (const item of persisted.items) {
      item.status = item.path.includes('reported') ? 'reported' : item.path.includes('approved') ? 'approved' : 'done';
      item.selectedForSample = false;
      item.lastError = item.status === 'done' ? 'already_done' : null;
    }
    writeFileSync(fixture.statePath, `${JSON.stringify(persisted, null, 2)}\n`);

    const second = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:05:00Z'),
      settings: { maxFilesPerRun: 3 },
    });

    assert.equal(second.summary.selectedForSample, 0);
    const byPath = new Map(second.items.map(item => [item.path, item]));
    assert.equal(byPath.get('capture/inbox/reported.md')?.status, 'reported');
    assert.equal(byPath.get('capture/inbox/approved.md')?.status, 'approved');
    assert.equal(byPath.get('capture/inbox/done.md')?.status, 'done');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue reselects a handled capture after its content changes', () => {
  const fixture = createMindFixture('mind-inbox-queue-repeat-edited-');
  const firstNow = new Date('2026-06-18T12:00:00Z');
  const secondNow = new Date('2026-06-18T12:05:00Z');
  const capturePath = path.join(fixture.inboxDir, 'approved.md');
  writeFileSync(capturePath, '# Approved\n');
  ageFile(capturePath, 120, firstNow);

  try {
    const first = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: firstNow,
    });
    const persisted = JSON.parse(readFileSync(fixture.statePath, 'utf8'));
    persisted.items[0].status = 'approved';
    persisted.items[0].selectedForSample = false;
    writeFileSync(fixture.statePath, `${JSON.stringify(persisted, null, 2)}\n`);

    writeFileSync(capturePath, '# Approved\n\nEdited with new evidence.\n');
    ageFile(capturePath, 120, secondNow);
    const second = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: secondNow,
    });

    assert.equal(second.items[0]?.id, first.items[0]?.id);
    assert.equal(second.items[0]?.status, 'pending');
    assert.equal(second.items[0]?.selectedForSample, true);
    assert.notEqual(second.items[0]?.contentSha256, first.items[0]?.contentSha256);
    assert.equal(second.items[0]?.lastError, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue schedules bounded retries before retry time', () => {
  const fixture = createMindFixture('mind-inbox-queue-retry-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'retry.md');
  writeFileSync(capturePath, '# Retry\n');
  ageFile(capturePath, 120, now);

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 2 },
    });
    const failure = recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'capture/inbox/retry.md',
      error: 'classifier_timeout',
      now: new Date('2026-06-18T12:01:00Z'),
      retryDelaySeconds: 120,
    });

    assert.equal(failure.status, 'retry-scheduled');
    assert.equal(failure.item?.attemptCount, 1);
    assert.equal(failure.item?.status, 'pending');
    assert.equal(failure.item?.lastError, 'classifier_timeout');
    assert.equal(failure.item?.nextRetryAfter, '2026-06-18T12:03:00.000Z');
    assert.equal(failure.item?.failureRoute, null);
    assert.equal(failure.safety.writesToMind, false);

    const held = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:02:00Z'),
      settings: { maxRetries: 2 },
    });
    assert.equal(held.items[0]?.selectedForSample, false);
    assert.equal(held.items[0]?.nextRetryAfter, '2026-06-18T12:03:00.000Z');

    const due = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:04:00Z'),
      settings: { maxRetries: 2 },
    });
    assert.equal(due.items[0]?.selectedForSample, true);
    assert.equal(due.items[0]?.nextRetryAfter, null);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue routes exhausted failures to Brain runtime state without moving captures', () => {
  const fixture = createMindFixture('mind-inbox-queue-failed-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'failed.md');
  writeFileSync(capturePath, '# Failed\n');
  ageFile(capturePath, 120, now);

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 1 },
    });
    recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'capture/inbox/failed.md',
      error: 'classifier_timeout',
      now: new Date('2026-06-18T12:01:00Z'),
      retryDelaySeconds: 60,
    });
    const exhausted = recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'capture/inbox/failed.md',
      error: 'classifier_timeout_again',
      now: new Date('2026-06-18T12:03:00Z'),
      retryDelaySeconds: 60,
    });

    assert.equal(exhausted.status, 'failed-routed');
    assert.equal(exhausted.item?.status, 'failed');
    assert.equal(exhausted.item?.attemptCount, 2);
    assert.equal(exhausted.item?.failureRoute, 'brain-runtime-queue-status');
    assert.equal(exhausted.item?.nextRetryAfter, null);
    assert.equal(exhausted.safety.movesCaptures, false);
    assert.equal(existsSync(capturePath), true);

    const refreshed = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:10:00Z'),
      settings: { maxRetries: 1 },
    });
    assert.equal(refreshed.items[0]?.status, 'failed');
    assert.equal(refreshed.items[0]?.selectedForSample, false);
    assert.equal(refreshed.summary.failed, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('persistent inbox queue failure routing blocks unknown queue items', () => {
  const fixture = createMindFixture('mind-inbox-queue-failure-missing-');
  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:00:00Z'),
    });
    const result = recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'capture/inbox/missing.md',
      error: 'classifier_timeout',
      now: new Date('2026-06-18T12:01:00Z'),
    });

    assert.equal(result.status, 'blocked');
    assert(result.blockers.includes('queueItemUnavailable'));
    assert.equal(result.safety.deletesCaptures, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
