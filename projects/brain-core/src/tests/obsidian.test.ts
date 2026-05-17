import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrainConsoleSnapshotHealth, createBrainConsoleSnapshot } from '../obsidian.js';

test('createBrainConsoleSnapshot maps Brain Core read-only data into widgets', () => {
  const snapshot = createBrainConsoleSnapshot({
    status: {
      service: 'brain-core',
      mode: 'read-only',
      ok: true,
      startedAt: new Date(0).toISOString(),
      uptimeSeconds: 0,
      version: '0.1.0',
      host: 'localhost',
    },
    sessions: [],
    repos: [],
    skills: [],
    schedulerStatus: {
      status: 'placeholder',
      enabled: false,
      latestRunStatus: 'unknown',
      source: 'placeholder',
      message: 'placeholder',
    },
    schedulerJobs: [],
    localApps: [],
    videoStatus: {
      status: 'placeholder',
      enabled: false,
      queueDepth: 0,
      source: 'placeholder',
      message: 'placeholder',
    },
    videoQueue: [],
    approvals: [],
  });

  assert.equal(snapshot.widgets.length, 8);
  assert.equal(snapshot.widgets[0]?.id, 'brain-status');
  assert.equal(snapshot.widgets[0]?.phase, 'read-only');
  assert.equal(snapshot.widgets.some((widget) => widget.id === 'brain-video-queue'), true);
  assert.equal(snapshot.widgets.some((widget) => widget.id === 'brain-approvals'), true);
});

test('checkBrainConsoleSnapshotHealth reports complete widget coverage', () => {
  const snapshot = createBrainConsoleSnapshot({
    status: {
      service: 'brain-core',
      mode: 'read-only',
      ok: true,
      startedAt: new Date(0).toISOString(),
      uptimeSeconds: 0,
      version: '0.1.0',
      host: 'localhost',
    },
    sessions: [],
    repos: [],
    skills: [],
    schedulerStatus: {
      status: 'placeholder',
      enabled: false,
      latestRunStatus: 'unknown',
      source: 'placeholder',
      message: 'placeholder',
    },
    schedulerJobs: [],
    localApps: [],
    videoStatus: {
      status: 'placeholder',
      enabled: false,
      queueDepth: 0,
      source: 'placeholder',
      message: 'placeholder',
    },
    videoQueue: [],
    approvals: [],
  });

  const health = checkBrainConsoleSnapshotHealth(snapshot);

  assert.equal(health.ok, true);
  assert.equal(health.expectedWidgetCount, 8);
  assert.equal(health.actualWidgetCount, 8);
  assert.equal(health.missingWidgetIds.length, 0);
});
