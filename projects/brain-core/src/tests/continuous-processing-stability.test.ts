import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { getContinuousProcessingStabilityView } from '../adapters/continuous-processing-stability.js';
import { enforceMindStewardInboxQueuePolicy, refreshMindStewardInboxQueue } from '../adapters/mind-steward-inbox-queue.js';

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

test('continuous stability view exposes stable and debouncing queue candidates without processing them', () => {
  const fixture = createMindFixture('continuous-stability-');
  const now = new Date('2026-06-18T12:00:00Z');
  const stablePath = path.join(fixture.inboxDir, 'stable.md');
  const recentPath = path.join(fixture.inboxDir, 'recent.md');
  writeFileSync(stablePath, '# Stable\n');
  writeFileSync(recentPath, '# Recent\n');
  ageFile(stablePath, 90, now);
  ageFile(recentPath, 5, now);

  try {
    const queueState = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { debounceSeconds: 30 },
    });
    const view = getContinuousProcessingStabilityView(queueState);
    const byPath = new Map(view.items.map(item => [item.path, item]));

    assert.equal(view.status, 'available');
    assert.equal(view.queueStatePath, fixture.statePath);
    assert.equal(view.debounceSeconds, 30);
    assert.equal(view.totalCount, 2);
    assert.equal(view.stableCount, 1);
    assert.equal(view.debouncingCount, 1);
    assert.equal(view.selectedStableCount, 1);
    assert.equal(byPath.get('capture/inbox/stable.md')?.stableFile, true);
    assert.equal(byPath.get('capture/inbox/stable.md')?.debounceUntil, null);
    assert.equal(byPath.get('capture/inbox/recent.md')?.stableFile, false);
    assert.equal(byPath.get('capture/inbox/recent.md')?.debounceUntil, '2026-06-18T12:00:25.000Z');
    assert.equal(view.safety.readOnly, true);
    assert.equal(view.safety.runsWorkflowNow, false);
    assert.equal(view.safety.startsBackgroundDaemon, false);
    assert.equal(view.safety.watcherEnabled, false);
    assert.equal(view.safety.writesToMind, false);
    assert.equal(view.safety.movesCaptures, false);
    assert.equal(view.safety.deletesCaptures, false);
    assert.equal(view.safety.writesKanban, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('continuous stability view reports missing queue state as blocked read-only visibility', () => {
  const view = getContinuousProcessingStabilityView(null);

  assert.equal(view.status, 'missing');
  assert.equal(view.totalCount, 0);
  assert.equal(view.stableCount, 0);
  assert.equal(view.debouncingCount, 0);
  assert.equal(view.selectedStableCount, 0);
  assert(view.blockers.includes('queueStateUnavailable'));
  assert.equal(view.safety.readOnly, true);
  assert.equal(view.safety.writesToMind, false);
  assert.equal(view.safety.startsBackgroundDaemon, false);
  assert.equal(view.safety.createsSchedulerJob, false);
});

test('stableAt equals modifiedAt plus debounce duration exactly', () => {
  const fixture = createMindFixture('stability-stableAt-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'timed.md');
  writeFileSync(filePath, '# Timed\n');
  ageFile(filePath, 45, now);

  try {
    const queueState = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { debounceSeconds: 30 },
    });
    const view = getContinuousProcessingStabilityView(queueState);
    const item = view.items[0];
    assert(item);
    const modifiedMs = Date.parse(item.modifiedAt!);
    const stableMs = Date.parse(item.stableAt!);
    assert.equal(stableMs - modifiedMs, 30 * 1000);
    assert.equal(item.debounceSeconds, 30);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('file is unstable immediately before the boundary and stable exactly at it', () => {
  const fixture = createMindFixture('stability-boundary-');
  const filePath = path.join(fixture.inboxDir, 'boundary.md');
  writeFileSync(filePath, '# Boundary\n');

  const modifiedAt = new Date('2026-06-18T11:59:00Z');
  utimesSync(filePath, modifiedAt, modifiedAt);

  try {
    const justBefore = new Date('2026-06-18T11:59:29.999Z');
    const qBefore = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: justBefore,
      settings: { debounceSeconds: 30 },
    });
    const vBefore = getContinuousProcessingStabilityView(qBefore);
    assert.equal(vBefore.items[0]?.stableFile, false);
    assert.notEqual(vBefore.items[0]?.debounceUntil, null);
    assert.equal(vBefore.stableCount, 0);
    assert.equal(vBefore.debouncingCount, 1);

    const exactAt = new Date('2026-06-18T11:59:30.000Z');
    const qAt = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: exactAt,
      settings: { debounceSeconds: 30 },
    });
    const vAt = getContinuousProcessingStabilityView(qAt);
    assert.equal(vAt.items[0]?.stableFile, true);
    assert.equal(vAt.items[0]?.debounceUntil, null);
    assert.equal(vAt.stableCount, 1);
    assert.equal(vAt.debouncingCount, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('debounceUntil is present only while item is debouncing', () => {
  const fixture = createMindFixture('stability-debounceUntil-');
  const now = new Date('2026-06-18T12:00:00Z');
  const stablePath = path.join(fixture.inboxDir, 'old.md');
  const recentPath = path.join(fixture.inboxDir, 'new.md');
  writeFileSync(stablePath, '# Old\n');
  writeFileSync(recentPath, '# New\n');
  ageFile(stablePath, 120, now);
  ageFile(recentPath, 10, now);

  try {
    const q = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { debounceSeconds: 30 },
    });
    const view = getContinuousProcessingStabilityView(q);
    const byPath = new Map(view.items.map(item => [item.path, item]));
    assert.equal(byPath.get('capture/inbox/old.md')?.debounceUntil, null);
    assert.notEqual(byPath.get('capture/inbox/new.md')?.debounceUntil, null);
    assert.equal(typeof byPath.get('capture/inbox/new.md')?.debounceUntil, 'string');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('a selected debouncing item is blocked by policy enforcement', () => {
  const fixture = createMindFixture('stability-policy-block-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'debouncing.md');
  writeFileSync(filePath, '# Debouncing\n');
  ageFile(filePath, 10, now);

  try {
    const q = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { debounceSeconds: 30 },
    });
    assert.equal(q.items[0]?.stableFile, false);
    assert.equal(q.items[0]?.selectedForSample, false);

    const manipulated = {
      ...q,
      items: q.items.map(item => ({ ...item, selectedForSample: true })),
    };
    const policy = enforceMindStewardInboxQueuePolicy({
      state: manipulated,
      now,
      featureFlagEnabled: true,
    });
    assert.equal(policy.status, 'blocked');
    assert(policy.blockers.includes('selectedItemsMustBeStableAfterDebounce'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('existing pre-change persisted queue state without new fields is handled safely', () => {
  const fixture = createMindFixture('stability-compat-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'legacy.md');
  writeFileSync(filePath, '# Legacy\n');
  ageFile(filePath, 120, now);

  const legacyState = {
    schemaVersion: '1.0',
    queueId: 'mind-inbox-queue-abc123',
    generatedAt: '2026-06-17T10:00:00Z',
    source: 'brain-runtime',
    mindRoot: fixture.mindRoot,
    inboxPath: fixture.inboxDir,
    status: 'ready',
    settings: { maxConcurrentJobs: 1, maxFilesPerRun: 3, debounceSeconds: 30, maxRetries: 2, largeFileThresholdMb: 2, minimumSecondsBetweenRuns: 300, localOnly: true },
    items: [{
      id: 'mind-inbox-legacy001',
      path: 'capture/inbox/legacy.md',
      status: 'pending',
      sizeBytes: 10,
      modifiedAt: '2026-06-17T09:58:00Z',
      firstSeenAt: '2026-06-17T09:00:00Z',
      lastCheckedAt: '2026-06-17T10:00:00Z',
      attemptCount: 0,
      lastError: null,
      largeFile: false,
      selectedForSample: true,
      selectorStatus: 'unknown',
    }],
    summary: { total: 1, pending: 1, blocked: 0, failed: 0, selectedForSample: 1, stableFile: 0, debouncing: 0, largeFile: 0, done: 0 },
    blockers: [],
    safety: { writesToMind: false, movesCaptures: false, deletesCaptures: false, writesKanban: false, stateOwnedBy: 'brain', statePath: fixture.statePath },
  };
  mkdirSync(path.dirname(fixture.statePath), { recursive: true });
  writeFileSync(fixture.statePath, JSON.stringify(legacyState, null, 2) + '\n');

  try {
    const refreshed = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { debounceSeconds: 30 },
    });
    assert.equal(refreshed.status, 'ready');
    assert.equal(refreshed.items[0]?.firstSeenAt, '2026-06-17T09:00:00Z');
    assert.equal(typeof refreshed.items[0]?.stableFile, 'boolean');
    assert.equal(typeof refreshed.items[0]?.stableAt, 'string');
    assert.equal(typeof refreshed.items[0]?.debounceSeconds, 'number');
    assert.equal(refreshed.items[0]?.stableFile, true);
    assert.equal(refreshed.items[0]?.debounceUntil, null);

    const view = getContinuousProcessingStabilityView(refreshed);
    assert.equal(view.status, 'available');
    assert.equal(view.stableCount, 1);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('malformed or incomplete persisted queue state fails closed on refresh', () => {
  const fixture = createMindFixture('stability-malformed-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'test.md');
  writeFileSync(filePath, '# Test\n');
  ageFile(filePath, 120, now);
  mkdirSync(path.dirname(fixture.statePath), { recursive: true });
  writeFileSync(fixture.statePath, '{ "broken json');

  try {
    const refreshed = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
    });
    assert.equal(refreshed.status, 'ready');
    assert.equal(refreshed.items.length, 1);
    assert.equal(typeof refreshed.items[0]?.stableFile, 'boolean');
    assert.equal(typeof refreshed.items[0]?.stableAt, 'string');
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('repeated refresh does not create duplicate queue items', () => {
  const fixture = createMindFixture('stability-nodups-');
  const now = new Date('2026-06-18T12:00:00Z');
  const filePath = path.join(fixture.inboxDir, 'single.md');
  writeFileSync(filePath, '# Single\n');
  ageFile(filePath, 120, now);

  try {
    refreshMindStewardInboxQueue({ mindRoot: fixture.mindRoot, statePath: fixture.statePath, now });
    const second = refreshMindStewardInboxQueue({ mindRoot: fixture.mindRoot, statePath: fixture.statePath, now: new Date('2026-06-18T12:01:00Z') });
    const third = refreshMindStewardInboxQueue({ mindRoot: fixture.mindRoot, statePath: fixture.statePath, now: new Date('2026-06-18T12:02:00Z') });

    assert.equal(second.items.length, 1);
    assert.equal(third.items.length, 1);
    assert.equal(second.items[0]?.id, third.items[0]?.id);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('existing large-file and handled-item behavior remains intact through stability view', () => {
  const fixture = createMindFixture('stability-existing-');
  const now = new Date('2026-06-18T12:00:00Z');
  const largePath = path.join(fixture.inboxDir, 'large.md');
  const handledPath = path.join(fixture.inboxDir, 'handled.md');
  writeFileSync(largePath, 'x'.repeat(3 * 1024));
  writeFileSync(handledPath, '# Handled\n');
  ageFile(largePath, 120, now);
  ageFile(handledPath, 120, now);

  try {
    refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now,
      settings: { largeFileThresholdMb: 0.001 },
    });
    const persisted = JSON.parse(readFileSync(fixture.statePath, 'utf8'));
    const handledItem = persisted.items.find((i: any) => i.path === 'capture/inbox/handled.md');
    if (handledItem) { handledItem.status = 'reported'; handledItem.selectedForSample = false; }
    writeFileSync(fixture.statePath, JSON.stringify(persisted, null, 2) + '\n');

    const refreshed = refreshMindStewardInboxQueue({
      mindRoot: fixture.mindRoot,
      statePath: fixture.statePath,
      now: new Date('2026-06-18T12:01:00Z'),
      settings: { largeFileThresholdMb: 0.001 },
    });
    const view = getContinuousProcessingStabilityView(refreshed);
    const byPath = new Map(view.items.map(item => [item.path, item]));

    assert.equal(byPath.get('capture/inbox/large.md')?.largeFile, true);
    assert.equal(byPath.get('capture/inbox/large.md')?.selectedForSample, false);
    assert.equal(byPath.get('capture/inbox/handled.md')?.status, 'reported');
    assert.equal(byPath.get('capture/inbox/handled.md')?.selectedForSample, false);
    assert.equal(view.safety.readOnly, true);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
