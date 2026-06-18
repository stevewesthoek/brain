import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { decideApproval, requestAction } from '../adapters/actions.js';
import { getExecutionKillSwitch, getExecutionReadiness } from '../adapters/execution-plans.js';
import { requestOnDemandRun } from '../adapters/on-demand-runs.js';
import { listSchedulerJobs } from '../adapters/scheduler.js';

function withKillSwitch<T>(value: string | undefined, fn: () => T): T {
  const previous = process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
  if (value === undefined) delete process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
  else process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = value;
  try {
    return fn();
  } finally {
    if (previous === undefined) delete process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
    else process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = previous;
  }
}

test('execution kill switch is off by default and exposes safety metadata', () => {
  withKillSwitch(undefined, () => {
    const killSwitch = getExecutionKillSwitch();

    assert.equal(killSwitch.flagName, 'BRAIN_CORE_EXECUTION_KILL_SWITCH');
    assert.equal(killSwitch.enabled, false);
    assert.equal(killSwitch.blocksOnDemandRequests, true);
    assert.equal(killSwitch.blocksApprovedExecution, true);
    assert.equal(killSwitch.blocksSchedulerEligibility, true);
    assert.equal(killSwitch.writesToMind, false);
  });
});

test('execution readiness reports active kill switch as a blocker', () => {
  withKillSwitch('true', () => {
    const readiness = getExecutionReadiness();

    assert.equal(readiness.killSwitch.enabled, true);
    assert.equal(readiness.executionEnabled, false);
    assert(readiness.blockers.includes('execution kill switch enabled'));
    assert.equal(readiness.writesToMind, false);
    assert.equal(readiness.executableActions, false);
  });
});

test('kill switch blocks on-demand workflow requests', () => {
  withKillSwitch('true', () => {
    const result = requestOnDemandRun('scheduler-run-mind-steward-inbox-queue-dry-run');

    assert.equal(result.accepted, false);
    assert.equal(result.executed, false);
    assert.equal(result.approval, undefined);
    assert(result.message.includes('BRAIN_CORE_EXECUTION_KILL_SWITCH is true'));
    assert.equal(result.onDemandRun.schedulerRequired, false);
    assert.equal(result.onDemandRun.scheduled, false);
  });
});

test('kill switch blocks approved execution before feature flag and durable store checks', () => {
  withKillSwitch('true', () => {
    const request = requestAction('scheduler-run-mind-steward-dry-run');
    assert(request.approval);

    const decision = decideApproval(request.approval.id, 'approve');

    assert.equal(decision.accepted, true);
    assert.equal(decision.executed, false);
    assert.equal(decision.execution?.status, 'blocked');
    assert.equal(decision.execution?.message, 'BRAIN_CORE_EXECUTION_KILL_SWITCH is true.');
    assert.equal(decision.execution?.writesToMind, false);
    assert.equal(decision.execution?.externalSideEffects, false);
  });
});

test('kill switch keeps scheduler jobs ineligible even after manual success evidence', () => {
  const testDir = path.join(process.cwd(), '.buildflow-test-kill-switch-scheduler');
  const reportPath = path.join(testDir, 'latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ status: 'success', trigger: 'on-demand', manualSuccess: true }));
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = reportPath;

  try {
    withKillSwitch('true', () => {
      const job = listSchedulerJobs().find(item => item.id === 'mind-steward-dry-run');

      assert.equal(job?.manualSuccessProven, true);
      assert.equal(job?.schedulerEligible, false);
      assert.equal(job?.schedulerEnabled, false);
      assert(job?.blockers.includes('executionKillSwitchEnabled'));
      assert.equal(job?.safety.createsSchedulerJob, false);
    });
  } finally {
    if (previousReportPath === undefined) delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    else process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});
