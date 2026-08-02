import { getExecutionKillSwitch, getWorkflowFeatureFlagForKind } from './execution-plans.js';
import { listSchedulerJobs } from './scheduler.js';
import type {
  BrainCoreContinuousProcessingSelection,
  BrainCoreContinuousProcessingWorkflowSelection,
  BrainCoreSchedulerJobSummary,
} from '../types/api.js';

interface ContinuousProcessingSelectionOptions {
  now?: Date;
  schedulerJobs?: BrainCoreSchedulerJobSummary[];
}

const SELECTED_WORKFLOW_KIND = 'scheduler-run-mind-steward-inbox-queue-dry-run';
const SELECTED_SCHEDULER_JOB_ID = 'mind-steward-inbox-queue-dry-run';

const REQUIRED_BEFORE_ENABLEMENT = [
  'stable-file-detection',
  'debounce-verification',
  'concurrency-cap',
  'retry-exhaustion-and-failure-buffer',
  'large-file-nightly-fallback',
  'latency-process-memory-and-review-count-measurement',
  'disable-and-recovery-procedure',
] as const;

const SAFETY = {
  planOnly: true,
  readOnly: true,
  continuousEnabled: false,
  watcherEnabled: false,
  createsSchedulerJob: false,
  startsBackgroundDaemon: false,
  runsWorkflowNow: false,
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  basicMindUseRequiresContinuousProcessing: false,
  requiresKillSwitch: true,
  requiresFeatureFlag: true,
  requiresManualSuccess: true,
  requiresQueueThrottlePolicy: true,
  requiresHumanReviewForWrites: true,
} as const;

export function getContinuousProcessingSelection(
  options: ContinuousProcessingSelectionOptions = {},
): BrainCoreContinuousProcessingSelection {
  const now = options.now ?? new Date();
  const jobs = options.schedulerJobs ?? listSchedulerJobs();
  const killSwitch = getExecutionKillSwitch();
  const workflows = jobs
    .filter(job => Boolean(job.workflowKind))
    .map(job => toWorkflowSelection(job, killSwitch.enabled));
  const selected = workflows.filter(workflow => workflow.selected);
  const selectedWorkflow = selected[0] ?? null;
  const blockers = new Set<string>();

  if (!selectedWorkflow) {
    blockers.add('selectedWorkflowUnavailable');
  }

  for (const blocker of selectedWorkflow?.blockers ?? []) {
    blockers.add(blocker);
  }

  if (selected.length > 1) {
    blockers.add('multipleContinuousWorkflowsSelected');
  }

  return {
    id: 'continuous-processing-workflow-selection',
    status: blockers.size === 0 ? 'selected' : 'selected-blocked',
    generatedAt: now.toISOString(),
    source: 'brain-core-continuous-processing-plan',
    phase: 'Phase 9',
    selectedWorkflowKind: selectedWorkflow?.workflowKind ?? SELECTED_WORKFLOW_KIND,
    selectedSchedulerJobId: selectedWorkflow?.schedulerJobId ?? SELECTED_SCHEDULER_JOB_ID,
    selectedCount: selected.length,
    candidateCount: workflows.length,
    continuousReady: false,
    continuousEnabled: false,
    watcherEnabled: false,
    requiredBeforeEnablement: [...REQUIRED_BEFORE_ENABLEMENT],
    selectionRationale: [
      'inbox/new is the canonical on-arrival workflow; retired capture paths are not selected by this plan',
      'the inbox queue dry-run already preserves Brain-owned runtime state',
      'the queue dry-run is report-only and preserves capture, Kanban, and Mind write boundaries',
      'all other scheduler workflows are scheduled/report or mutation candidates, not the first continuous runner',
    ],
    blockers: [...blockers],
    workflows,
    safety: SAFETY,
  };
}

function toWorkflowSelection(
  job: BrainCoreSchedulerJobSummary,
  killSwitchEnabled: boolean,
): BrainCoreContinuousProcessingWorkflowSelection {
  const selected = job.workflowKind === SELECTED_WORKFLOW_KIND && job.id === SELECTED_SCHEDULER_JOB_ID;
  const blockers = new Set<string>();

  if (selected) {
    if (!job.manualSuccessProven) blockers.add('manualOnDemandSuccessRequiredBeforeContinuousSelection');
    if (job.mutationRequired) blockers.add('mutationWorkflowCannotBeContinuousFirst');
    if (killSwitchEnabled) blockers.add('executionKillSwitchEnabled');
    blockers.add('continuousEnablementRequiresLaterPhase9Controls');
  } else {
    blockers.add(toNonSelectedBlocker(job));
  }

  return {
    schedulerJobId: job.id,
    workflowKind: job.workflowKind ?? 'unmapped',
    name: job.name,
    selected,
    status: selected ? 'selected' : 'not-selected',
    reason: selected ? 'proven-inbox-queue-candidate' : 'not-first-continuous-candidate',
    manualSuccessProven: job.manualSuccessProven,
    schedulerEligible: job.schedulerEligible,
    schedulerEnabled: false,
    continuousEnabled: false,
    watcherEnabled: false,
    featureFlag: job.workflowKind ? getWorkflowFeatureFlagForKind(job.workflowKind) ?? null : null,
    blockers: [...blockers],
    requiredBeforeEnablement: selected ? [...REQUIRED_BEFORE_ENABLEMENT] : [],
    safety: {
      reportOnly: true,
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      writesKanban: false,
      createsSchedulerJob: false,
      startsBackgroundDaemon: false,
      runsWorkflowNow: false,
      requiresHumanReviewForWrites: true,
    },
  };
}

function toNonSelectedBlocker(job: BrainCoreSchedulerJobSummary): string {
  if (job.mutationRequired) return 'mutationWorkflowNotEligibleForFirstContinuousRunner';
  if (job.workflowKind?.includes('graphify')) return 'graphifyRefreshIsScheduledReportOnlyNotFirstContinuousRunner';
  if (job.id === 'mind-maintenance-report-only') return 'maintenanceReportOnlyIsPreWriteGateNotFirstContinuousRunner';
  if (job.workflowKind?.includes('mind-steward')) return 'mindStewardWorkflowDoesNotOwnQueueThrottleBoundary';
  return 'workflowNotSelectedForContinuousProcessing';
}
