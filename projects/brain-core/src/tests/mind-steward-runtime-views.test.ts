import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import {
  getMindStewardLatestRunView,
  listMindStewardFailedItemViews,
  listMindStewardRecoveryViews,
} from '../adapters/mind-steward-runtime-views.js';
import {
  recordMindStewardInboxQueueFailure,
  refreshMindStewardInboxQueue,
} from '../adapters/mind-steward-inbox-queue.js';

function createMindRuntimeFixture(prefix: string): {
  tempDir: string;
  mindRoot: string;
  inboxDir: string;
  statePath: string;
} {
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

function withEnv(name: string, value: string | undefined, callback: () => void): void {
  const previous = process.env[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }

  try {
    callback();
  } finally {
    if (previous === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = previous;
    }
  }
}

test('Mind Steward latest-run view selects the freshest runtime report without enabling writes', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-steward-latest-run-view-'));
  const reportPath = path.join(tempDir, 'latest.json');
  mkdirSync(tempDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    status: 'success',
    message: 'Dry run completed.',
    mode: 'report-only',
    trigger: 'on-demand',
    manualSuccess: true,
    writesToMind: false,
    executableActions: false,
    endedAtLisbon: '2026-06-18T12:00:00+01:00',
    durationSeconds: 12,
  }));
  writeFileSync(path.join(tempDir, 'inbox-queue-latest.json'), JSON.stringify({
    status: 'failed',
    message: 'Queue dry run failed after source preservation.',
    mode: 'report-only',
    writesToMind: false,
    executableActions: false,
    endedAtLisbon: '2026-06-18T12:05:00+01:00',
    durationSeconds: 4,
  }));

  try {
    withEnv('BRAIN_CORE_MIND_STEWARD_REPORT_PATH', reportPath, () => {
      const view = getMindStewardLatestRunView();

      assert.equal(view.status, 'available');
      assert.equal(view.latestRun?.key, 'queue');
      assert.equal(view.latestRun?.latestRunStatus, 'failed');
      assert.equal(view.availableCount, 2);
      assert.equal(view.safety.readOnly, true);
      assert.equal(view.safety.writesToMind, false);
      assert.equal(view.safety.movesCaptures, false);
      assert.equal(view.safety.deletesCaptures, false);
      assert.equal(view.safety.writesKanban, false);
      assert.equal(view.safety.startsBackgroundDaemon, false);
      assert.equal(view.safety.createsSchedulerJob, false);
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('Mind Steward failed-item view lists exhausted queue failures from Brain runtime state', () => {
  const fixture = createMindRuntimeFixture('mind-steward-failed-items-view-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);
  const beforeCapture = readFileSync(capturePath, 'utf8');

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 1 },
    });
    recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'inbox/new/capture-a.md',
      error: 'classifier_timeout',
      now: new Date('2026-06-18T12:01:00Z'),
    });
    recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'inbox/new/capture-a.md',
      error: 'classifier_timeout',
      now: new Date('2026-06-18T12:02:00Z'),
    });

    const view = listMindStewardFailedItemViews(fixture.statePath);

    assert.equal(view.status, 'available');
    assert.equal(view.failedItemCount, 1);
    assert.equal(view.items[0]?.path, 'inbox/new/capture-a.md');
    assert.equal(view.items[0]?.status, 'failed');
    assert.equal(view.items[0]?.attemptCount, 2);
    assert.equal(view.items[0]?.maxRetries, 1);
    assert.equal(view.items[0]?.lastError, 'classifier_timeout');
    assert.equal(view.items[0]?.failureRoute, 'brain-runtime-queue-status');
    assert.equal(view.items[0]?.recoveryRequired, true);
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(readFileSync(capturePath, 'utf8'), beforeCapture);
    assert.equal(existsSync(path.join(fixture.mindRoot, 'kanban.md')), false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Mind Steward recovery view exposes approval-required guidance and no auto-fix controls', () => {
  const fixture = createMindRuntimeFixture('mind-steward-recovery-view-');
  const now = new Date('2026-06-18T12:00:00Z');
  const capturePath = path.join(fixture.inboxDir, 'capture-a.md');
  writeFileSync(capturePath, '# Capture A\n');
  ageFile(capturePath, 120, now);

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { maxRetries: 0 },
    });
    recordMindStewardInboxQueueFailure({
      statePath: fixture.statePath,
      capturePath: 'inbox/new/capture-a.md',
      error: 'selector_failed',
      now: new Date('2026-06-18T12:01:00Z'),
    });

    const view = listMindStewardRecoveryViews(fixture.statePath);

    assert.equal(view.status, 'available');
    assert.equal(view.recoveryItemCount, 1);
    assert.equal(view.safety.canAutoFix, false);
    assert.equal(view.safety.requiresApprovalForRetry, true);
    assert.equal(view.safety.proposalOnlyForCaptureMoves, true);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.movesCaptures, false);
    assert.equal(view.safety.writesKanban, false);
    assert.equal(view.items[0]?.safety.canAutoFix, false);
    assert.equal(view.items[0]?.safety.requiresApprovalForRetry, true);
    assert.equal(view.items[0]?.controls.every(control => control.writesToMind === false), true);
    assert.equal(view.items[0]?.controls.some(control => control.mode === 'approval-request' && control.requiresApproval === true), true);
    assert.equal(view.items[0]?.controls.some(control => control.mode === 'proposal-only' && control.requiresApproval === true), true);
    assert.equal(existsSync(path.join(fixture.mindRoot, 'capture', 'failed')), false);
    assert.equal(existsSync(path.join(fixture.mindRoot, 'kanban.md')), false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('Mind Steward failed-item and recovery views report missing queue state without writing fallback files', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-steward-missing-views-'));
  const statePath = path.join(tempDir, 'runtime', 'missing-state.json');

  try {
    const failedItems = listMindStewardFailedItemViews(statePath);
    const recovery = listMindStewardRecoveryViews(statePath);

    assert.equal(failedItems.status, 'missing');
    assert.equal(failedItems.failedItemCount, 0);
    assert(failedItems.blockers.includes('mindStewardInboxQueueStateMissing'));
    assert.equal(recovery.status, 'missing');
    assert.equal(recovery.recoveryItemCount, 0);
    assert.equal(recovery.safety.canAutoFix, false);
    assert.equal(existsSync(statePath), false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
