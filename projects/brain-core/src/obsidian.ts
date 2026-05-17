import type {
  BrainCoreApprovalSummary,
  BrainCoreLocalAppSummary,
  BrainCoreRepoSummary,
  BrainCoreRoutes,
  BrainCoreSchedulerJobSummary,
  BrainCoreSchedulerStatus,
  BrainCoreSessionSummary,
  BrainCoreSkillSummary,
  BrainCoreStatus,
  BrainCoreVideoQueueItem,
  BrainCoreVideoStatus,
} from './types/api.js';

export type BrainConsoleWidgetId =
  | 'brain-status'
  | 'brain-sessions'
  | 'brain-repos'
  | 'brain-skills'
  | 'brain-scheduler'
  | 'brain-local-apps'
  | 'brain-video-queue'
  | 'brain-approvals';

const EXPECTED_WIDGET_IDS: BrainConsoleWidgetId[] = [
  'brain-status',
  'brain-sessions',
  'brain-repos',
  'brain-skills',
  'brain-scheduler',
  'brain-local-apps',
  'brain-video-queue',
  'brain-approvals',
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
  widgets: Array<
    | BrainConsoleWidget<BrainCoreStatus>
    | BrainConsoleWidget<{ sessions: BrainCoreSessionSummary[] }>
    | BrainConsoleWidget<{ repos: BrainCoreRepoSummary[] }>
    | BrainConsoleWidget<{ skills: BrainCoreSkillSummary[] }>
    | BrainConsoleWidget<{ status: BrainCoreSchedulerStatus; jobs: BrainCoreSchedulerJobSummary[] }>
    | BrainConsoleWidget<{ apps: BrainCoreLocalAppSummary[] }>
    | BrainConsoleWidget<{ status: BrainCoreVideoStatus; queue: BrainCoreVideoQueueItem[] }>
    | BrainConsoleWidget<{ approvals: BrainCoreApprovalSummary[] }>
  >;
}

export function createBrainConsoleSnapshot(input: {
  status: BrainCoreStatus;
  sessions: BrainCoreSessionSummary[];
  repos: BrainCoreRepoSummary[];
  skills: BrainCoreSkillSummary[];
  schedulerStatus: BrainCoreSchedulerStatus;
  schedulerJobs: BrainCoreSchedulerJobSummary[];
  localApps: BrainCoreLocalAppSummary[];
  videoStatus: BrainCoreVideoStatus;
  videoQueue: BrainCoreVideoQueueItem[];
  approvals: BrainCoreApprovalSummary[];
}): BrainConsoleSnapshot {
  return {
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
        id: 'brain-skills',
        title: 'Skills',
        endpoint: '/skills',
        phase: 'read-only',
        data: { skills: input.skills },
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
        id: 'brain-video-queue',
        title: 'Video queue',
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
