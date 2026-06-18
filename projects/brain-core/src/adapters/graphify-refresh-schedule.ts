import { getExecutionPlan } from './execution-plans.js';
import { getGraphifyStatus } from './graphify-status.js';
import { listSchedulerJobs } from './scheduler.js';
import type {
  BrainCoreGraphifyRefreshSchedule,
  BrainCoreGraphifyRefreshScheduleItem,
  BrainCoreSchedulerJobSummary,
} from '../types/api.js';

type GraphifyStatus = ReturnType<typeof getGraphifyStatus>;
type GraphifyReportKey = 'mindKnowledge' | 'brainRuntime';
type GraphifyReport = GraphifyStatus['reports'][GraphifyReportKey];

interface GraphifyRefreshScheduleOptions {
  now?: Date;
  staleAfterHours?: number;
  graphifyStatus?: GraphifyStatus;
  schedulerJobs?: BrainCoreSchedulerJobSummary[];
}

const DEFAULT_STALE_AFTER_HOURS = 24;

const GRAPHIFY_REFRESH_TARGETS = [
  {
    id: 'graphify-refresh-mind-knowledge',
    repo: 'mind',
    reportKey: 'mindKnowledge',
    schedulerJobId: 'graphify-preflight-mind',
    workflowKind: 'scheduler-run-graphify-preflight-mind',
    commandPreview: 'bash tools/scripts/graphify-orchestrator-report.sh preflight-mind',
    cadence: 'daily',
    localWindow: '03:00-07:00 Europe/Lisbon',
  },
  {
    id: 'graphify-refresh-brain-runtime',
    repo: 'brain',
    reportKey: 'brainRuntime',
    schedulerJobId: 'graphify-preflight-brain',
    workflowKind: 'scheduler-run-graphify-preflight-brain',
    commandPreview: 'bash tools/scripts/graphify-orchestrator-report.sh preflight-brain',
    cadence: 'daily',
    localWindow: '03:00-07:00 Europe/Lisbon',
  },
] as const;

const SAFETY = {
  planOnly: true,
  reportOnly: true,
  writesToMind: false,
  writesTargetRepo: false,
  writesGeneratedGraphOutput: false,
  runsGraphifyNow: false,
  createsSchedulerJob: false,
  startsBackgroundDaemon: false,
  requiresFeatureFlag: true,
  requiresManualSuccessBeforeScheduling: true,
  honorsKillSwitch: true,
} as const;

export function getGraphifyRefreshSchedule(
  options: GraphifyRefreshScheduleOptions = {},
): BrainCoreGraphifyRefreshSchedule {
  const now = options.now ?? new Date();
  const staleAfterHours = options.staleAfterHours ?? DEFAULT_STALE_AFTER_HOURS;
  const graphifyStatus = options.graphifyStatus ?? getGraphifyStatus();
  const jobs = options.schedulerJobs ?? listSchedulerJobs();

  const items = GRAPHIFY_REFRESH_TARGETS.map(target => {
    const report = graphifyStatus.reports[target.reportKey];
    const job = jobs.find(candidate => candidate.id === target.schedulerJobId) ?? null;
    return buildScheduleItem(target, report, job, now, staleAfterHours);
  });
  const recommendedCount = items.filter(item => item.scheduleRecommended).length;

  return {
    id: 'graphify-refresh-schedule',
    status: recommendedCount > 0 ? 'schedule-recommended' : 'fresh',
    generatedAt: now.toISOString(),
    source: 'brain-core-scheduler-plan',
    staleAfterHours,
    candidateCount: items.length,
    recommendedCount,
    items,
    blockers: items.flatMap(item => item.blockers),
    safety: SAFETY,
  };
}

function buildScheduleItem(
  target: typeof GRAPHIFY_REFRESH_TARGETS[number],
  report: GraphifyReport,
  job: BrainCoreSchedulerJobSummary | null,
  now: Date,
  staleAfterHours: number,
): BrainCoreGraphifyRefreshScheduleItem {
  const usefulness = getUsefulness(report, now, staleAfterHours);
  const plan = getExecutionPlan(target.workflowKind);
  const blockers = new Set<string>();
  if (!usefulness.useful) blockers.add('graphifyReportFresh');
  if (!plan) blockers.add('graphifyExecutionPlanMissing');
  if (!job) blockers.add('graphifySchedulerJobMissing');
  for (const blocker of job?.blockers ?? []) blockers.add(blocker);

  return {
    id: target.id,
    repo: target.repo,
    reportKey: target.reportKey,
    workflowKind: target.workflowKind,
    schedulerJobId: target.schedulerJobId,
    commandPreview: target.commandPreview,
    cadence: target.cadence,
    localWindow: target.localWindow,
    scheduleRecommended: usefulness.useful,
    usefulnessReason: usefulness.reason,
    report: {
      available: report.available,
      status: report.status,
      generatedAt: report.generatedAt,
      ageHours: usefulness.ageHours,
      stale: usefulness.reason === 'reportStale',
    },
    featureFlag: plan?.workflowFeatureFlag ?? null,
    schedulerEligible: job?.schedulerEligible ?? false,
    schedulerEnabled: false,
    manualSuccessRequired: true,
    manualSuccessProven: job?.manualSuccessProven ?? false,
    blockers: [...blockers],
    safety: SAFETY,
  };
}

function getUsefulness(
  report: GraphifyReport,
  now: Date,
  staleAfterHours: number,
): { useful: boolean; reason: BrainCoreGraphifyRefreshScheduleItem['usefulnessReason']; ageHours: number | null } {
  if (!report.available) return { useful: true, reason: 'reportMissing', ageHours: null };
  if (report.status === 'failed' || report.status === 'error') return { useful: true, reason: 'reportFailed', ageHours: null };
  if (!report.generatedAt) return { useful: true, reason: 'timestampMissing', ageHours: null };

  const generatedAt = Date.parse(report.generatedAt);
  if (!Number.isFinite(generatedAt)) return { useful: true, reason: 'timestampMissing', ageHours: null };

  const ageHours = Math.max(0, Math.floor((now.getTime() - generatedAt) / (60 * 60 * 1000)));
  if (ageHours >= staleAfterHours) return { useful: true, reason: 'reportStale', ageHours };
  return { useful: false, reason: 'reportFresh', ageHours };
}
