import test from 'node:test';
import assert from 'node:assert/strict';
import { createModelRouterDryRunReport } from '../report.js';
import type { MindContractSnapshot } from '../contracts.js';

function snapshot(paths: MindContractSnapshot['paths']): MindContractSnapshot {
  return {
    paths,
    saveToMindTarget: 'capture-inbox',
    liveDeploymentVerified: true,
    failureBufferStatus: 'real-error-verified',
  };
}

test('model-router dry-run report includes all loops and safe flags', () => {
  const report = createModelRouterDryRunReport(snapshot([]));

  assert.equal(report.mode, 'dry-run-report-only');
  assert.equal(report.writesToMind, false);
  assert.equal(report.executableActions, false);
  assert.equal(report.loopPlans.length, 4);
  assert.equal(report.loopPlans.some((plan) => plan.jobId === 'mind-drift-error-loop'), true);
  assert.equal(report.validationStatus, 'blocked');
});

test('model-router dry-run report computes counts and blockers', () => {
  const report = createModelRouterDryRunReport(
    snapshot([
      { path: 'capture/inbox/a.md', kind: 'file', exists: true, modifiedAt: '2026-05-15T00:00:00.000Z' },
      { path: 'capture/failed/b.md', kind: 'file', exists: true },
      { path: 'router/current.md', kind: 'file', exists: true, lineCount: 151 },
    ]),
    new Date('2026-05-17T00:00:00.000Z'),
  );

  assert.equal(report.snapshotStats.failedCaptureCount, 1);
  assert.equal(report.snapshotStats.captureInboxCount, 1);
  assert.ok(report.snapshotStats.oldestCaptureInboxAgeDays !== undefined);
  assert.equal(report.snapshotStats.oldestCaptureInboxAgeDays, 2);
  assert.equal(Object.values(report.actionCountsByKind).length > 0, true);
  const blockers = report.blockersByLoop['mind-compile-loop'];
  assert.ok(blockers);
  assert.equal(blockers.length > 0, true);
});
