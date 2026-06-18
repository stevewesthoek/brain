import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getExecutionCandidateKinds } from '../adapters/execution-plans.js';
import { getOnDemandRun, listOnDemandRuns, requestOnDemandRun } from '../adapters/on-demand-runs.js';

test('on-demand runs expose one approval-only request surface per workflow', () => {
  const runs = listOnDemandRuns();

  assert.equal(runs.length, getExecutionCandidateKinds().length);
  assert.equal(new Set(runs.map(run => run.kind)).size, runs.length);
  for (const run of runs) {
    assert.equal(run.onDemand, true);
    assert.equal(run.requestEndpoint, `/execution/on-demand-runs/${run.kind}/request`);
    assert.equal(run.approvalKind, run.kind);
    assert.equal(run.schedulerRequired, false);
    assert.equal(run.scheduled, false);
    assert.equal(run.willRunImmediately, false);
    assert.equal(run.requiresApproval, true);
    assert.equal(run.featureFlag.workflowId, run.kind);
    assert.equal(run.safety.writesToMind, false);
    assert.equal(run.safety.externalSideEffects, false);
    assert.equal(run.safety.createsSchedulerJob, false);
    assert.equal(run.safety.startsBackgroundDaemon, false);
  }
});

test('on-demand run request creates an approval record without executing or scheduling', () => {
  const result = requestOnDemandRun('scheduler-run-mind-steward-inbox-queue-dry-run');

  assert.equal(result.accepted, true);
  assert.equal(result.executed, false);
  assert.equal(result.approval?.kind, 'scheduler-run-mind-steward-inbox-queue-dry-run');
  assert.equal(result.approval?.status, 'pending');
  assert.equal(result.preview?.wouldExecute, false);
  assert.equal(result.preview?.writesToMind, false);
  assert.equal(result.policy?.executionEnabled, false);
  assert.deepEqual(result.onDemandRun, {
    kind: 'scheduler-run-mind-steward-inbox-queue-dry-run',
    schedulerRequired: false,
    scheduled: false,
    willRunImmediately: false,
  });
});

test('on-demand run request blocks unknown workflows', () => {
  const result = requestOnDemandRun('scheduler-run-unknown-workflow');

  assert.equal(result.accepted, false);
  assert.equal(result.executed, false);
  assert.equal(result.approval, undefined);
  assert.equal(result.message, 'Unsupported on-demand workflow kind: scheduler-run-unknown-workflow');
  assert.deepEqual(result.onDemandRun, {
    kind: 'scheduler-run-unknown-workflow',
    schedulerRequired: false,
    scheduled: false,
    willRunImmediately: false,
  });
});

test('on-demand run lookup returns exact workflow only', () => {
  assert.equal(getOnDemandRun('scheduler-run-graphify-preflight-mind')?.kind, 'scheduler-run-graphify-preflight-mind');
  assert.equal(getOnDemandRun('../scheduler-run-graphify-preflight-mind'), undefined);
});
