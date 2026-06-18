import { requestAction } from './actions.js';
import { getExecutionKillSwitch, getExecutionPlan, listExecutionPlans } from './execution-plans.js';
import type {
  BrainCoreActionRequestResult,
  BrainCoreOnDemandRunRequestResult,
  BrainCoreOnDemandRunSummary,
} from '../types/api.js';

export function listOnDemandRuns(): BrainCoreOnDemandRunSummary[] {
  return listExecutionPlans().map(plan => ({
    kind: plan.kind,
    summary: plan.summary,
    requestEndpoint: `/execution/on-demand-runs/${plan.kind}/request`,
    approvalKind: plan.kind,
    onDemand: true,
    schedulerRequired: false,
    scheduled: false,
    willRunImmediately: false,
    requiresApproval: true,
    featureFlag: plan.workflowFeatureFlag,
    safety: {
      writesToMind: false,
      externalSideEffects: false,
      createsSchedulerJob: false,
      startsBackgroundDaemon: false,
    },
  }));
}

export function getOnDemandRun(kind: string): BrainCoreOnDemandRunSummary | undefined {
  return listOnDemandRuns().find(run => run.kind === kind);
}

export function requestOnDemandRun(kind: string): BrainCoreOnDemandRunRequestResult {
  const killSwitch = getExecutionKillSwitch();
  if (killSwitch.enabled) {
    return {
      accepted: false,
      executed: false,
      message: `${killSwitch.flagName} is true. On-demand workflow requests are disabled.`,
      onDemandRun: {
        kind,
        schedulerRequired: false,
        scheduled: false,
        willRunImmediately: false,
      },
    };
  }

  const run = getOnDemandRun(kind);
  if (!run || !getExecutionPlan(kind)) {
    return {
      accepted: false,
      executed: false,
      message: `Unsupported on-demand workflow kind: ${kind}`,
      onDemandRun: {
        kind,
        schedulerRequired: false,
        scheduled: false,
        willRunImmediately: false,
      },
    };
  }

  const result: BrainCoreActionRequestResult = requestAction(kind);
  return {
    ...result,
    executed: false,
    onDemandRun: {
      kind: run.kind,
      schedulerRequired: false,
      scheduled: false,
      willRunImmediately: false,
    },
  };
}
