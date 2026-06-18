import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMindMaintenanceReportOnlySchedule } from '../adapters/mind-maintenance-schedule.js';
import type { BrainCoreSchedulerJobSummary } from '../types/api.js';

function maintenanceJob(input: Partial<BrainCoreSchedulerJobSummary> = {}): BrainCoreSchedulerJobSummary {
  return {
    id: 'mind-maintenance-report-only',
    name: 'Mind maintenance report-only review',
    status: 'ok',
    mutationRequired: false,
    workflowKind: 'scheduler-run-mind-steward-dry-run',
    manualSuccessRequired: true,
    manualSuccessProven: false,
    schedulerEligible: false,
    schedulerEnabled: false,
    blockers: ['manualOnDemandSuccessRequiredBeforeScheduling'],
    safety: {
      writesToMind: false,
      createsSchedulerJob: false,
      startsBackgroundDaemon: false,
      requiresManualSuccessBeforeScheduling: true,
    },
    ...input,
  };
}

test('maintenance schedule recommends report-only run when latest report is missing', () => {
  const schedule = getMindMaintenanceReportOnlySchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    latestReport: null,
    schedulerJobs: [maintenanceJob()],
  });

  assert.equal(schedule.status, 'schedule-recommended');
  assert.equal(schedule.scheduleRecommended, true);
  assert.equal(schedule.approvedWritesBlockedUntilFreshReport, true);
  assert(schedule.blockers.includes('maintenanceReportMissing'));
  assert(schedule.blockers.includes('manualOnDemandSuccessRequiredBeforeScheduling'));
  assert.equal(schedule.latestReport.available, false);
  assert.equal(schedule.schedulerEnabled, false);
  assert.equal(schedule.safety.planOnly, true);
  assert.equal(schedule.safety.reportOnly, true);
  assert.equal(schedule.safety.writesToMind, false);
  assert.equal(schedule.safety.writesReportsNow, false);
  assert.equal(schedule.safety.executesMaintenanceNow, false);
  assert.equal(schedule.safety.createsSchedulerJob, false);
  assert.equal(schedule.safety.startsBackgroundDaemon, false);
  assert.equal(schedule.safety.mustRunBeforeApprovedWrites, true);
});

test('maintenance schedule blocks approved writes for stale or unsafe report-only evidence', () => {
  const schedule = getMindMaintenanceReportOnlySchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    staleAfterHours: 24,
    latestReport: {
      reportId: 'mind-maintenance-20260616-000000',
      generatedAt: '2026-06-16T00:00:00Z',
      mode: 'report-only',
      noWritePerformed: false,
      summary: {
        findingsOpen: 2,
        detectorErrors: 1,
      },
      errors: [{ message: 'detector failed' }],
    },
    schedulerJobs: [maintenanceJob({ blockers: [] })],
  });

  assert.equal(schedule.status, 'schedule-recommended');
  assert.equal(schedule.latestReport.available, true);
  assert.equal(schedule.latestReport.ageHours, 60);
  assert.equal(schedule.latestReport.findingsOpen, 2);
  assert.equal(schedule.latestReport.detectorErrors, 1);
  assert.equal(schedule.approvedWritesBlockedUntilFreshReport, true);
  assert.equal(schedule.approvedWritesRequireHumanReview, true);
  assert(schedule.blockers.includes('maintenanceReportStale'));
  assert(schedule.blockers.includes('maintenanceReportNoWriteProofMissing'));
  assert(schedule.blockers.includes('maintenanceDetectorErrorsVisible'));
  assert.equal(schedule.schedulerEnabled, false);
});

test('maintenance schedule treats fresh no-write report-only evidence as satisfying the pre-write gate', () => {
  const schedule = getMindMaintenanceReportOnlySchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    latestReport: {
      reportId: 'mind-maintenance-20260618-080000',
      generatedAt: '2026-06-18T08:00:00Z',
      mode: 'report-only',
      noWritePerformed: true,
      summary: {
        filesConsidered: 5,
        findingsTotal: 1,
        findingsOpen: 1,
        detectorErrors: 0,
      },
      errors: [],
    },
    schedulerJobs: [maintenanceJob({ manualSuccessProven: true, schedulerEligible: true, blockers: [] })],
  });

  assert.equal(schedule.status, 'fresh');
  assert.equal(schedule.scheduleRecommended, false);
  assert.equal(schedule.approvedWritesBlockedUntilFreshReport, false);
  assert.equal(schedule.approvedWritesRequireHumanReview, true);
  assert.equal(schedule.latestReport.noWritePerformed, true);
  assert.equal(schedule.latestReport.ageHours, 4);
  assert.deepEqual(schedule.blockers, []);
  assert.equal(schedule.schedulerEligible, true);
  assert.equal(schedule.schedulerEnabled, false);
});

test('maintenance schedule recommends a run when timestamp or report-only proof is invalid', () => {
  const schedule = getMindMaintenanceReportOnlySchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    latestReport: {
      reportId: 'mind-maintenance-invalid',
      generatedAt: 'not-a-date',
      mode: 'write-mode',
      noWritePerformed: true,
      summary: {
        findingsOpen: 0,
        detectorErrors: 0,
      },
    },
    schedulerJobs: [],
  });

  assert.equal(schedule.status, 'schedule-recommended');
  assert(schedule.blockers.includes('maintenanceReportNotReportOnly'));
  assert(schedule.blockers.includes('maintenanceReportTimestampMissing'));
  assert(schedule.blockers.includes('maintenanceSchedulerJobMissing'));
  assert.equal(schedule.approvedWritesBlockedUntilFreshReport, true);
});
