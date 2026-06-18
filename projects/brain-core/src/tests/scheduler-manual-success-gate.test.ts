import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { listSchedulerJobs } from '../adapters/scheduler.js';

function withMindStewardReport(report: Record<string, unknown> | null, fn: () => void): void {
  const testDir = path.join(process.cwd(), '.buildflow-test-scheduler-manual-success');
  const reportPath = path.join(testDir, 'latest.json');
  const previousReportPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });
  if (report) fs.writeFileSync(reportPath, JSON.stringify(report));
  process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = reportPath;

  try {
    fn();
  } finally {
    if (previousReportPath === undefined) delete process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;
    else process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH = previousReportPath;
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

test('scheduler jobs are not eligible before manual on-demand success', () => {
  withMindStewardReport(null, () => {
    const jobs = listSchedulerJobs();

    assert.equal(jobs.every(job => job.manualSuccessRequired === true), true);
    assert.equal(jobs.every(job => job.schedulerEnabled === false), true);
    assert.equal(jobs.every(job => job.schedulerEligible === false), true);
    assert.equal(jobs.every(job => job.safety.createsSchedulerJob === false), true);
    assert.equal(jobs.every(job => job.safety.startsBackgroundDaemon === false), true);
    assert(jobs.find(job => job.id === 'mind-steward-dry-run')?.blockers.includes('manualOnDemandSuccessRequiredBeforeScheduling'));
  });
});

test('scheduler job stays ineligible when runtime report lacks manual success evidence', () => {
  withMindStewardReport({ status: 'success', mode: 'dry-run-report-only' }, () => {
    const job = listSchedulerJobs().find(item => item.id === 'mind-steward-dry-run');

    assert.equal(job?.status, 'ok');
    assert.equal(job?.manualSuccessProven, false);
    assert.equal(job?.schedulerEligible, false);
    assert.equal(job?.schedulerEnabled, false);
    assert(job?.blockers.includes('manualOnDemandSuccessRequiredBeforeScheduling'));
  });
});

test('scheduler job becomes eligible only after successful manual on-demand report evidence', () => {
  withMindStewardReport({ status: 'success', trigger: 'on-demand', manualSuccess: true }, () => {
    const job = listSchedulerJobs().find(item => item.id === 'mind-steward-dry-run');

    assert.equal(job?.status, 'ok');
    assert.equal(job?.workflowKind, 'scheduler-run-mind-steward-dry-run');
    assert.equal(job?.manualSuccessProven, true);
    assert.equal(job?.schedulerEligible, true);
    assert.equal(job?.schedulerEnabled, false);
    assert.deepEqual(job?.blockers, []);
  });
});

test('mutation scheduler candidates remain ineligible even if other jobs have manual success', () => {
  withMindStewardReport({ status: 'success', trigger: 'on-demand', manualSuccess: true }, () => {
    const job = listSchedulerJobs().find(item => item.id === 'mind-compile-loop');

    assert.equal(job?.mutationRequired, true);
    assert.equal(job?.manualSuccessProven, false);
    assert.equal(job?.schedulerEligible, false);
    assert.equal(job?.schedulerEnabled, false);
    assert(job?.blockers.includes('schedulerJobRequiresFutureApprovedMutationPolicy'));
  });
});
