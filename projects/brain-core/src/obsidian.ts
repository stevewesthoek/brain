import type {
  BrainCoreApprovalSummary,
  BrainCoreCapabilitySummary,
  BrainCoreLocalAppSummary,
  BrainCoreOrchestratorSummary,
  BrainCoreRepoSummary,
  BrainCoreRoutes,
  BrainCoreSchedulerJobSummary,
  BrainCoreSchedulerStatus,
  BrainCoreSessionSummary,
  BrainCoreStatus,
  BrainCoreVideoQueueItem,
  BrainCoreVideoStatus,
  BrainCoreRuntimeReportSummary,
} from './types/api.js';

export const BRAIN_CONSOLE_OBSIDIAN_CONTRACT = 'brain-console-obsidian-widget-contract-v1' as const;

export type BrainConsoleWidgetId =
  | 'brain-status'
  | 'brain-sessions'
  | 'brain-repos'
  | 'brain-orchestrators'
  | 'brain-capabilities'
  | 'brain-scheduler'
  | 'brain-local-apps'
  | 'brain-video'
  | 'brain-approvals'
  | 'brain-runtime-reports';

const EXPECTED_WIDGET_IDS: BrainConsoleWidgetId[] = [
  'brain-status',
  'brain-sessions',
  'brain-repos',
  'brain-orchestrators',
  'brain-capabilities',
  'brain-scheduler',
  'brain-local-apps',
  'brain-video',
  'brain-approvals',
  'brain-runtime-reports',
];

export interface BrainConsoleWidget<TData> {
  id: BrainConsoleWidgetId;
  title: string;
  endpoint: keyof BrainCoreRoutes;
  phase: 'read-only';
  data: TData;
}

export interface BrainConsoleHealthCheck {
  ok: boolean;
  expectedWidgetCount: number;
  actualWidgetCount: number;
  missingWidgetIds: BrainConsoleWidgetId[];
}

export interface BrainConsoleSnapshot {
  contract: typeof BRAIN_CONSOLE_OBSIDIAN_CONTRACT;
  version: 1;
  widgets: Array<
    | BrainConsoleWidget<BrainCoreStatus>
    | BrainConsoleWidget<{ sessions: BrainCoreSessionSummary[] }>
    | BrainConsoleWidget<{ repos: BrainCoreRepoSummary[] }>
    | BrainConsoleWidget<{ orchestrators: BrainCoreOrchestratorSummary[] }>
    | BrainConsoleWidget<BrainCoreCapabilitySummary>
    | BrainConsoleWidget<{ status: BrainCoreSchedulerStatus; jobs: BrainCoreSchedulerJobSummary[] }>
    | BrainConsoleWidget<{ apps: BrainCoreLocalAppSummary[] }>
    | BrainConsoleWidget<{ status: BrainCoreVideoStatus; queue: BrainCoreVideoQueueItem[] }>
    | BrainConsoleWidget<{ approvals: BrainCoreApprovalSummary[] }>
    | BrainConsoleWidget<{ reports: BrainCoreRuntimeReportSummary[] }>
  >;
}

export function createBrainConsoleSnapshot(input: {
  status: BrainCoreStatus;
  sessions: BrainCoreSessionSummary[];
  repos: BrainCoreRepoSummary[];
  orchestrators: BrainCoreOrchestratorSummary[];
  capabilities: BrainCoreCapabilitySummary;
  schedulerStatus: BrainCoreSchedulerStatus;
  schedulerJobs: BrainCoreSchedulerJobSummary[];
  localApps: BrainCoreLocalAppSummary[];
  videoStatus: BrainCoreVideoStatus;
  videoQueue: BrainCoreVideoQueueItem[];
  approvals: BrainCoreApprovalSummary[];
  runtimeReports: BrainCoreRuntimeReportSummary[];
}): BrainConsoleSnapshot {
  return {
    contract: BRAIN_CONSOLE_OBSIDIAN_CONTRACT,
    version: 1,
    widgets: [
      {
        id: 'brain-status',
        title: 'Brain Core status',
        endpoint: '/status',
        phase: 'read-only',
        data: input.status,
      },
      {
        id: 'brain-sessions',
        title: 'AI sessions',
        endpoint: '/sessions',
        phase: 'read-only',
        data: { sessions: input.sessions },
      },
      {
        id: 'brain-repos',
        title: 'Repos',
        endpoint: '/repos',
        phase: 'read-only',
        data: { repos: input.repos },
      },
      {
        id: 'brain-orchestrators',
        title: 'Orchestrators',
        endpoint: '/orchestrators',
        phase: 'read-only',
        data: { orchestrators: input.orchestrators },
      },
      {
        id: 'brain-capabilities',
        title: 'Capabilities',
        endpoint: '/capabilities',
        phase: 'read-only',
        data: input.capabilities,
      },
      {
        id: 'brain-scheduler',
        title: 'Scheduler',
        endpoint: '/scheduler/status',
        phase: 'read-only',
        data: {
          status: input.schedulerStatus,
          jobs: input.schedulerJobs,
        },
      },
      {
        id: 'brain-local-apps',
        title: 'Local apps',
        endpoint: '/local-apps',
        phase: 'read-only',
        data: { apps: input.localApps },
      },
      {
        id: 'brain-video',
        title: 'Video',
        endpoint: '/video/status',
        phase: 'read-only',
        data: {
          status: input.videoStatus,
          queue: input.videoQueue,
        },
      },
      {
        id: 'brain-approvals',
        title: 'Approvals',
        endpoint: '/approvals',
        phase: 'read-only',
        data: { approvals: input.approvals },
      },
      {
        id: 'brain-runtime-reports',
        title: 'Runtime reports',
        endpoint: '/runtime/reports',
        phase: 'read-only',
        data: { reports: input.runtimeReports },
      },
    ],
  };
}


export function checkBrainConsoleSnapshotHealth(snapshot: BrainConsoleSnapshot): BrainConsoleHealthCheck {
  const actualIds = new Set(snapshot.widgets.map((widget) => widget.id));
  const missingWidgetIds = EXPECTED_WIDGET_IDS.filter((id) => !actualIds.has(id));

  return {
    ok: missingWidgetIds.length === 0 && snapshot.widgets.length === EXPECTED_WIDGET_IDS.length,
    expectedWidgetCount: EXPECTED_WIDGET_IDS.length,
    actualWidgetCount: snapshot.widgets.length,
    missingWidgetIds,
  };
}
