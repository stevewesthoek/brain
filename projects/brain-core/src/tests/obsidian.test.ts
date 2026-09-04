import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrainConsoleSnapshotHealth, createBrainConsoleSnapshot } from '../obsidian.js';
import { getCapabilities } from '../adapters/capabilities.js';

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
    orchestrators: [],
    capabilities: getCapabilities(),
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
    runtimeReports: [],
  });

  assert.equal(snapshot.widgets.length, 10);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.contract, 'brain-console-obsidian-widget-contract-v1');
  assert.equal(snapshot.widgets[0]?.id, 'brain-status');
  assert.equal(snapshot.widgets[0]?.phase, 'read-only');
  assert.equal(snapshot.widgets.some((widget) => widget.id === 'brain-orchestrators'), true);
  assert.equal(snapshot.widgets.some((widget) => widget.id === 'brain-capabilities'), true);
  assert.equal(snapshot.widgets.some((widget) => widget.id === 'brain-video'), true);
  assert.equal(snapshot.widgets.some((widget) => widget.id === 'brain-approvals'), true);
  assert.equal(snapshot.widgets.some((widget) => widget.id === 'brain-runtime-reports'), true);
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
    orchestrators: [],
    capabilities: getCapabilities(),
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
    runtimeReports: [],
  });

  const health = checkBrainConsoleSnapshotHealth(snapshot);

  assert.equal(health.ok, true);
  assert.equal(health.expectedWidgetCount, 10);
  assert.equal(health.actualWidgetCount, 10);
  assert.equal(health.missingWidgetIds.length, 0);
});
