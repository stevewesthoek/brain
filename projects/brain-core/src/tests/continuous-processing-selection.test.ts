import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getContinuousProcessingSelection } from '../adapters/continuous-processing-selection.js';
import type { BrainCoreSchedulerJobSummary } from '../types/api.js';

function schedulerJob(input: Partial<BrainCoreSchedulerJobSummary> = {}): BrainCoreSchedulerJobSummary {
  return {
    id: 'mind-steward-inbox-queue-dry-run',
    name: 'Mind Steward inbox queue dry-run report',
    status: 'ok',
    mutationRequired: false,
    workflowKind: 'scheduler-run-mind-steward-inbox-queue-dry-run',
    manualSuccessRequired: true,
    manualSuccessProven: true,
    schedulerEligible: true,
    schedulerEnabled: false,
    blockers: [],
    safety: {
      writesToMind: false,
      createsSchedulerJob: false,
      startsBackgroundDaemon: false,
      requiresManualSuccessBeforeScheduling: true,
    },
    ...input,
  };
}

test('continuous processing selection chooses only the proven inbox queue workflow', () => {
  const selection = getContinuousProcessingSelection({
    now: new Date('2026-06-18T12:00:00Z'),
    schedulerJobs: [
      schedulerJob(),
      schedulerJob({
        id: 'graphify-preflight-mind',
        name: 'Graphify Mind preflight report',
        workflowKind: 'scheduler-run-graphify-preflight-mind',
      }),
      schedulerJob({
        id: 'mind-maintenance-report-only',
        name: 'Mind maintenance report-only review',
        workflowKind: 'scheduler-run-mind-steward-dry-run',
      }),
    ],
  });

  assert.equal(selection.id, 'continuous-processing-workflow-selection');
  assert.equal(selection.status, 'selected-blocked');
  assert.equal(selection.selectedWorkflowKind, 'scheduler-run-mind-steward-inbox-queue-dry-run');
  assert.equal(selection.selectedSchedulerJobId, 'mind-steward-inbox-queue-dry-run');
  assert.equal(selection.selectedCount, 1);
  assert.equal(selection.continuousReady, false);
  assert.equal(selection.continuousEnabled, false);
  assert.equal(selection.watcherEnabled, false);
  assert(selection.requiredBeforeEnablement.includes('stable-file-detection'));
  assert(selection.requiredBeforeEnablement.includes('latency-process-memory-and-review-count-measurement'));
  assert(selection.blockers.includes('continuousEnablementRequiresLaterPhase9Controls'));
  assert.equal(selection.workflows.filter(workflow => workflow.selected).length, 1);
  assert.equal(selection.workflows.find(workflow => workflow.schedulerJobId === 'graphify-preflight-mind')?.selected, false);
});

test('continuous processing selection blocks when manual on-demand success is not proven', () => {
  const selection = getContinuousProcessingSelection({
    now: new Date('2026-06-18T12:00:00Z'),
    schedulerJobs: [
      schedulerJob({
        manualSuccessProven: false,
        schedulerEligible: false,
        blockers: ['manualOnDemandSuccessRequiredBeforeScheduling'],
      }),
    ],
  });

  const selected = selection.workflows.find(workflow => workflow.selected);
  assert.equal(selection.status, 'selected-blocked');
  assert.equal(selected?.manualSuccessProven, false);
  assert(selected?.blockers.includes('manualOnDemandSuccessRequiredBeforeContinuousSelection'));
  assert(selection.blockers.includes('manualOnDemandSuccessRequiredBeforeContinuousSelection'));
  assert.equal(selection.continuousEnabled, false);
});

test('continuous processing selection reports a failure when selected workflow is unavailable', () => {
  const selection = getContinuousProcessingSelection({
    now: new Date('2026-06-18T12:00:00Z'),
    schedulerJobs: [
      schedulerJob({
        id: 'graphify-preflight-mind',
        name: 'Graphify Mind preflight report',
        workflowKind: 'scheduler-run-graphify-preflight-mind',
      }),
    ],
  });

  assert.equal(selection.status, 'selected-blocked');
  assert.equal(selection.selectedCount, 0);
  assert(selection.blockers.includes('selectedWorkflowUnavailable'));
  assert.equal(selection.workflows.every(workflow => workflow.selected === false), true);
  assert.equal(selection.safety.writesToMind, false);
  assert.equal(selection.safety.startsBackgroundDaemon, false);
});

test('continuous processing selection remains disabled under kill switch and never starts a watcher', () => {
  const previousKillSwitch = process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
  process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = 'true';

  try {
    const selection = getContinuousProcessingSelection({
      now: new Date('2026-06-18T12:00:00Z'),
      schedulerJobs: [schedulerJob()],
    });

    const selected = selection.workflows.find(workflow => workflow.selected);
    assert.equal(selection.status, 'selected-blocked');
    assert(selection.blockers.includes('executionKillSwitchEnabled'));
    assert(selected?.blockers.includes('executionKillSwitchEnabled'));
    assert.equal(selection.safety.planOnly, true);
    assert.equal(selection.safety.readOnly, true);
    assert.equal(selection.safety.continuousEnabled, false);
    assert.equal(selection.safety.watcherEnabled, false);
    assert.equal(selection.safety.runsWorkflowNow, false);
    assert.equal(selection.safety.writesToMind, false);
    assert.equal(selection.safety.movesCaptures, false);
    assert.equal(selection.safety.deletesCaptures, false);
    assert.equal(selection.safety.writesKanban, false);
    assert.equal(selection.safety.basicMindUseRequiresContinuousProcessing, false);
  } finally {
    if (previousKillSwitch === undefined) delete process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH;
    else process.env.BRAIN_CORE_EXECUTION_KILL_SWITCH = previousKillSwitch;
  }
});
