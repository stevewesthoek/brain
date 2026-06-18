import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getGraphifyRefreshSchedule } from '../adapters/graphify-refresh-schedule.js';
import type { GraphifyStatus } from '../adapters/graphify-status.js';

function graphifyStatus(input: {
  mind?: Partial<{
    available: boolean;
    status: string;
    generatedAt: string | null;
  }>;
  brain?: Partial<{
    available: boolean;
    status: string;
    generatedAt: string | null;
  }>;
}): GraphifyStatus {
  const mind = {
    available: false,
    fileName: 'mind-knowledge-latest.json' as const,
    status: 'missing',
    generatedAt: null,
    repoPath: null,
    profile: null,
    repoRole: null,
    modes: [],
    operation: null,
    executeRequested: null,
    executionEnabled: null,
    plannedOnly: null,
    graphifyCommand: null,
    blockedReason: null,
    selectorStatus: null,
    selectorResolutionRequested: null,
    selectorResolutionEnabled: null,
    selectedProvider: null,
    selectedModel: null,
    outputValidation: null,
    safety: null,
    ...input.mind,
  };
  const brain = {
    available: false,
    fileName: 'brain-runtime-latest.json' as const,
    status: 'missing',
    generatedAt: null,
    repoPath: null,
    profile: null,
    repoRole: null,
    modes: [],
    operation: null,
    executeRequested: null,
    executionEnabled: null,
    plannedOnly: null,
    graphifyCommand: null,
    blockedReason: null,
    selectorStatus: null,
    selectorResolutionRequested: null,
    selectorResolutionEnabled: null,
    selectedProvider: null,
    selectedModel: null,
    outputValidation: null,
    safety: null,
    ...input.brain,
  };

  return {
    status: mind.available && brain.available ? 'ok' : mind.available || brain.available ? 'partial' : 'missing',
    source: 'runtime/local/graphify',
    reportCount: 2,
    availableCount: [mind, brain].filter(report => report.available).length,
    reports: {
      mindKnowledge: mind,
      brainRuntime: brain,
    },
  };
}

test('Graphify refresh schedule recommends missing report-only preflight jobs without enabling scheduling', () => {
  const schedule = getGraphifyRefreshSchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    graphifyStatus: graphifyStatus({}),
    schedulerJobs: [],
  });

  assert.equal(schedule.status, 'schedule-recommended');
  assert.equal(schedule.candidateCount, 2);
  assert.equal(schedule.recommendedCount, 2);
  assert.equal(schedule.items.every(item => item.scheduleRecommended), true);
  assert.equal(schedule.items.every(item => item.usefulnessReason === 'reportMissing'), true);
  assert.equal(schedule.items.some(item => item.workflowKind === 'scheduler-run-graphify-preflight-mind'), true);
  assert.equal(schedule.items.some(item => item.workflowKind === 'scheduler-run-graphify-preflight-brain'), true);
  assert.equal(schedule.items.every(item => item.schedulerEnabled === false), true);
  assert.equal(schedule.items.every(item => item.safety.reportOnly === true), true);
  assert.equal(schedule.items.every(item => item.safety.writesToMind === false), true);
  assert.equal(schedule.items.every(item => item.safety.writesTargetRepo === false), true);
  assert.equal(schedule.items.every(item => item.safety.runsGraphifyNow === false), true);
  assert.equal(schedule.items.every(item => item.safety.createsSchedulerJob === false), true);
  assert.equal(schedule.items.every(item => item.safety.requiresFeatureFlag === true), true);
  assert.equal(schedule.items.every(item => item.safety.requiresManualSuccessBeforeScheduling === true), true);
});

test('Graphify refresh schedule treats fresh reports as not useful yet', () => {
  const schedule = getGraphifyRefreshSchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    graphifyStatus: graphifyStatus({
      mind: { available: true, status: 'ok', generatedAt: '2026-06-18T08:00:00Z' },
      brain: { available: true, status: 'ok', generatedAt: '2026-06-18T07:00:00Z' },
    }),
    schedulerJobs: [],
  });

  assert.equal(schedule.status, 'fresh');
  assert.equal(schedule.recommendedCount, 0);
  assert.equal(schedule.items.every(item => item.scheduleRecommended === false), true);
  assert.equal(schedule.items.every(item => item.usefulnessReason === 'reportFresh'), true);
  assert.equal(schedule.items.every(item => item.blockers.includes('graphifyReportFresh')), true);
});

test('Graphify refresh schedule recommends stale and failed reports while preserving scheduler gates', () => {
  const schedule = getGraphifyRefreshSchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    staleAfterHours: 24,
    graphifyStatus: graphifyStatus({
      mind: { available: true, status: 'ok', generatedAt: '2026-06-16T11:00:00Z' },
      brain: { available: true, status: 'failed', generatedAt: '2026-06-18T11:00:00Z' },
    }),
    schedulerJobs: [
      {
        id: 'graphify-preflight-mind',
        name: 'Graphify Mind preflight report',
        status: 'ok',
        mutationRequired: false,
        workflowKind: 'scheduler-run-graphify-preflight-mind',
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
      },
    ],
  });
  const mind = schedule.items.find(item => item.repo === 'mind');
  const brain = schedule.items.find(item => item.repo === 'brain');

  assert.equal(schedule.status, 'schedule-recommended');
  assert.equal(schedule.recommendedCount, 2);
  assert.equal(mind?.usefulnessReason, 'reportStale');
  assert.equal(mind?.report.ageHours, 49);
  assert.equal(mind?.blockers.includes('manualOnDemandSuccessRequiredBeforeScheduling'), true);
  assert.equal(mind?.schedulerEligible, false);
  assert.equal(mind?.schedulerEnabled, false);
  assert.equal(brain?.usefulnessReason, 'reportFailed');
  assert.equal(brain?.schedulerEligible, false);
  assert.equal(brain?.blockers.includes('graphifySchedulerJobMissing'), true);
});

test('Graphify refresh schedule includes feature flag metadata for report-only workflows', () => {
  const schedule = getGraphifyRefreshSchedule({
    now: new Date('2026-06-18T12:00:00Z'),
    graphifyStatus: graphifyStatus({}),
    schedulerJobs: [],
  });

  for (const item of schedule.items) {
    assert.equal(item.featureFlag?.workflowId, item.workflowKind);
    assert.equal(item.featureFlag?.requiredForExecution, true);
    assert.equal(item.featureFlag?.defaultEnabled, false);
    assert.equal(item.featureFlag?.writesToMind, false);
    assert.equal(item.featureFlag?.externalSideEffects, false);
  }
});
