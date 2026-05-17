import { ItemView } from './obsidian.js';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import {
  readBrainCoreApprovals,
  readBrainCoreApprovalStore,
  readBrainCoreCapabilities,
  readBrainCoreLocalApps,
  readBrainCoreExecutionPlans,
  readBrainCoreExecutionReadiness,
  readBrainCoreMindPreviewPolicy,
  readBrainCoreRepos,
  readBrainCoreRuntimeReports,
  readBrainCoreSchedulerJobs,
  readBrainCoreSchedulerStatus,
  readBrainCoreSessions,
  readBrainCoreVideoQueue,
  readBrainCoreVideoStatus,
  readBrainCoreStatus,
  type BrainCoreApprovalSummary,
  type BrainCoreApprovalStoreSummary,
  type BrainCoreCapabilitySummary,
  type BrainCoreLocalAppSummary,
  type BrainCoreExecutionPlan,
  type BrainCoreExecutionReadiness,
  type BrainCoreRepoSummary,
  type BrainCoreRuntimeReportSummary,
  type BrainCoreSchedulerJobSummary,
  type BrainCoreSchedulerStatus,
  type BrainCoreSessionSummary,
  type BrainCoreVideoQueueItem,
  type BrainCoreVideoStatus,
  type BrainCoreStatus,
} from './client.js';

export interface BrainConsoleViewState {
  status?: BrainCoreStatus;
  capabilities?: BrainCoreCapabilitySummary;
  runtimeReports?: BrainCoreRuntimeReportSummary[];
  videoStatus?: BrainCoreVideoStatus;
  videoQueue?: BrainCoreVideoQueueItem[];
  localApps?: BrainCoreLocalAppSummary[];
  schedulerStatus?: BrainCoreSchedulerStatus;
  schedulerJobs?: BrainCoreSchedulerJobSummary[];
  sessions?: BrainCoreSessionSummary[];
  repos?: BrainCoreRepoSummary[];
  approvals?: BrainCoreApprovalSummary[];
  approvalStore?: BrainCoreApprovalStoreSummary;
  executionPlans?: BrainCoreExecutionPlan[];
  executionReadiness?: BrainCoreExecutionReadiness;
  mindPreviewPolicy?: import('./client.js').BrainCoreMindPreviewPolicy;
  warning?: string;
  offline?: boolean;
}

export async function loadBrainConsoleViewState(
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS,
): Promise<BrainConsoleViewState> {
  const normalized = normalizeBrainCoreUrl(settings.brainCoreUrl);
  const baseUrl = normalized.value;
  const [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy] = await Promise.all([
    readBrainCoreStatus(baseUrl),
    readBrainCoreCapabilities(baseUrl),
    readBrainCoreRuntimeReports(baseUrl),
    readBrainCoreVideoStatus(baseUrl),
    readBrainCoreVideoQueue(baseUrl),
    readBrainCoreLocalApps(baseUrl),
    readBrainCoreSchedulerStatus(baseUrl),
    readBrainCoreSchedulerJobs(baseUrl),
    readBrainCoreSessions(baseUrl),
    readBrainCoreRepos(baseUrl),
    readBrainCoreApprovals(baseUrl),
    readBrainCoreApprovalStore(baseUrl),
    readBrainCoreExecutionPlans(baseUrl),
    readBrainCoreExecutionReadiness(baseUrl),
    readBrainCoreMindPreviewPolicy(baseUrl),
  ]);

  const offline = [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy].every(
    (result) => result.value === undefined,
  );

  return {
    status: status.value,
    capabilities: capabilities.value,
    runtimeReports: runtimeReports.value?.reports,
    videoStatus: videoStatus.value,
    videoQueue: videoQueue.value?.queue,
    localApps: localApps.value?.apps,
    schedulerStatus: schedulerStatus.value,
    schedulerJobs: schedulerJobs.value?.jobs,
    sessions: sessions.value?.sessions,
    repos: repos.value?.repos,
    approvals: approvals.value?.approvals,
    approvalStore: approvalStore.value,
    executionPlans: executionPlans.value?.plans,
    executionReadiness: executionReadiness.value,
    mindPreviewPolicy: mindPreviewPolicy.value,
    warning: normalized.warning ?? normalized.error,
    offline,
  };
}

export function renderBrainConsoleView(
  container: HTMLElement,
  state: BrainConsoleViewState,
  onRefresh?: () => void,
): void {
  container.empty();
  container.addClass('brain-console');

  const shell = container.createDiv({ cls: 'brain-console__shell' });
  const header = shell.createDiv({ cls: 'brain-console__header' });
  header.createEl('h2', { text: 'Brain Console' });
  header.createEl('p', {
    text: 'Read-only Brain Core cockpit. No POST calls. No note writes. Manual refresh only.',
  });

  const safety = header.createDiv({ cls: 'brain-console__banner' });
  safety.setText('Read-only plugin. POST endpoints are never called automatically. Executable actions stay disabled.');

  if (state.warning) {
    header.createDiv({ cls: 'brain-console__warning' }).setText(state.warning);
  }

  if (state.offline) {
    const offline = shell.createDiv({ cls: 'brain-console__offline' });
    offline.createEl('h3', { text: 'Brain Core offline' });
    offline.createEl('p', {
      text: 'The plugin is still usable. Start Brain Core to load live summaries.',
    });
    return;
  }

  const refresh = header.createEl('button', { text: 'Manual refresh' });
  refresh.addClass('brain-console__refresh');
  if (onRefresh) {
    refresh.addEventListener('click', () => onRefresh());
  }

  const grid = shell.createDiv({ cls: 'brain-console__grid' });
  renderSection(grid, 'Brain Core status', [
    ['Online', formatStatus(state.status?.ok === true ? 'online' : 'offline')],
    ['Mode', state.status?.mode ?? 'unknown'],
    ['Host', state.status?.host ?? 'localhost'],
    ['Version', state.status?.version ?? 'unknown'],
  ]);
  renderSection(grid, 'Capabilities', [
    ['Executable actions', String(state.capabilities?.executableActionsEnabled ?? false)],
    ['Runtime reports', String(state.capabilities?.runtimeReportsSupported ?? false)],
    ['Brain Console installed in Mind', String(state.capabilities?.brainConsole?.installedInMindVault ?? false)],
    ['ProBot aliases enabled', String(state.capabilities?.probot?.commandAliasesEnabled ?? false)],
    ['Legacy migration', state.capabilities?.mindWorkspace?.legacyTaskMigrationStatus ?? 'unknown'],
    ['Execution gate', state.capabilities?.executionGate?.executionEnabled === false ? 'disabled' : 'unknown'],
    ['Model-router execution flag', formatFlagState(state.capabilities?.executionGate?.modelRouterDryRunExecutionFlagEnabled)],
    ['Execution flag name', state.capabilities?.executionGate?.modelRouterDryRunExecutionFlagName ?? 'unknown'],
    ['First candidate', state.capabilities?.executionGate?.firstCandidate ?? 'unknown'],
  ]);
  renderSection(grid, 'Runtime reports', describeRuntimeReports(state.runtimeReports));
  renderSection(grid, 'Video', describeVideo(state.videoStatus, state.videoQueue));
  renderSection(grid, 'Local apps', describeLocalApps(state.localApps));
  renderSection(grid, 'Scheduler', describeScheduler(state.schedulerStatus, state.schedulerJobs));
  renderSection(grid, 'Sessions / repos / approvals', describeCollections(state.sessions, state.repos, state.approvals));
  renderSection(grid, 'Approval gate', describeApprovalGate(state.approvalStore));
  renderSection(grid, 'Execution readiness', describeExecutionReadiness(state.executionReadiness, state.executionPlans));
  renderSection(grid, 'Mind preview policy', describeMindPreviewPolicy(state.mindPreviewPolicy));
}

function renderSection(parent: HTMLElement, title: string, entries: Array<[string, string]>): void {
  const section = parent.createDiv({ cls: 'brain-console__section' });
  section.createEl('h3', { text: title });
  const list = section.createEl('dl');
  entries.forEach(([label, value]) => {
    const row = list.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });
}

function describeRuntimeReports(reports: BrainCoreRuntimeReportSummary[] | undefined): Array<[string, string]> {
  const byId = new Map((reports ?? []).map((report) => [report.id, report]));
  return ['model-router', 'approval-audit', 'video', 'local-apps'].map((id) => {
    const report = byId.get(id as BrainCoreRuntimeReportSummary['id']);
    if (!report) {
      return [id, 'Unavailable'];
    }
    return [id, `${report.status} · writesToMind=${report.writesToMind} · executed=${report.executableActions}`];
  });
}

function describeVideo(
  status: BrainCoreVideoStatus | undefined,
  queue: BrainCoreVideoQueueItem[] | undefined,
): Array<[string, string]> {
  const queueItems = queue ?? [];
  return [
    ['Status', status ? `${status.status} · enabled=${status.enabled}` : 'Unavailable'],
    ['Queue depth', String(status?.queueDepth ?? queueItems.length)],
    ['Latest run', status?.latestRunAt ?? 'unknown'],
    ['Top queue items', queueItems.slice(0, 3).map((item) => `${item.title}:${item.status}`).join(', ') || 'none'],
  ];
}

function describeLocalApps(apps: BrainCoreLocalAppSummary[] | undefined): Array<[string, string]> {
  const items = apps ?? [];
  return [
    ['App count', String(items.length)],
    ['Status summary', items.slice(0, 3).map((app) => `${app.name}:${app.status}`).join(', ') || 'none'],
    ['Actions supported', String(items.some((app) => app.actionsSupported))],
  ];
}

function describeScheduler(
  schedulerStatus: BrainCoreSchedulerStatus | undefined,
  jobs: BrainCoreSchedulerJobSummary[] | undefined,
): Array<[string, string]> {
  const modelRouterJob = (jobs ?? []).find((job) => job.id === 'model-router-dry-run');
  return [
    ['Scheduler status', schedulerStatus ? `${schedulerStatus.status} · ${schedulerStatus.message}` : 'Unavailable'],
    ['Latest run', schedulerStatus?.latestRunStatus ?? 'unknown'],
    ['model-router-dry-run', modelRouterJob ? `${modelRouterJob.status} · mutationRequired=${modelRouterJob.mutationRequired}` : 'Unavailable'],
  ];
}

function describeCollections(
  sessions: BrainCoreSessionSummary[] | undefined,
  repos: BrainCoreRepoSummary[] | undefined,
  approvals: BrainCoreApprovalSummary[] | undefined,
): Array<[string, string]> {
  const sessionList = sessions ?? [];
  const repoList = repos ?? [];
  const approvalList = approvals ?? [];
  const sampleSessions = sessionList.slice(0, 3).map((session) => session.title).join(', ') || 'none';
  const sampleRepos = repoList.slice(0, 3).map((repo) => repo.alias).join(', ') || 'none';
  const sampleApprovals = approvalList.slice(0, 3).map((approval) => `${approval.kind}:${approval.status}`).join(', ') || 'none';
  return [
    ['Sessions', `${sessionList.length} · ${sampleSessions}`],
    ['Repos', `${repoList.length} · ${sampleRepos}`],
    ['Approvals', `${approvalList.length} · ${sampleApprovals}`],
  ];
}

function describeApprovalGate(
  approvalStore: BrainConsoleViewState['approvalStore'],
): Array<[string, string]> {
  if (!approvalStore) {
    return [
      ['Store status', 'Unavailable'],
      ['Execution enabled', 'false'],
      ['Gate', 'disabled-until-explicit-enable'],
    ];
  }

  return [
    ['Store status', approvalStore.status],
    ['Records', String(approvalStore.recordCount)],
    ['Execution enabled', String(false)],
    ['Gate', 'disabled-until-explicit-enable'],
  ];
}

function describeExecutionReadiness(
  readiness: BrainConsoleViewState['executionReadiness'],
  plans: BrainCoreExecutionPlan[] | undefined,
): Array<[string, string]> {
  const firstPlan = plans?.[0];
  if (!readiness) {
    return [
      ['Execution enabled', 'false'],
      ['Candidates', 'Unavailable'],
      ['Ready candidates', 'Unavailable'],
      ['Blockers', 'Unavailable'],
    ];
  }

  return [
    ['Execution enabled', String(readiness.executionEnabled)],
    ['Model-router execution flag', formatFlagState(readiness.modelRouterDryRunExecutionFlagEnabled)],
    ['Execution flag name', readiness.modelRouterDryRunExecutionFlagName ?? firstPlan?.modelRouterDryRunExecutionFlagName ?? 'unknown'],
    ['Candidates', String(readiness.candidateCount)],
    ['Ready candidates', String(readiness.readyCandidateCount)],
    ['Blockers', readiness.blockers.slice(0, 3).join(', ') || 'none'],
    ['First candidate', firstPlan?.kind ?? 'none'],
  ];
}

function describeMindPreviewPolicy(
  policy: BrainConsoleViewState['mindPreviewPolicy'],
): Array<[string, string]> {
  if (!policy) {
    return [
      ['Status', 'preview-only'],
      ['Apply route enabled', 'false'],
      ['First proposed target', 'router/current.md'],
    ];
  }

  return [
    ['Status', policy.status],
    ['Apply route enabled', String(policy.applyRouteEnabled)],
    ['First proposed target', policy.firstProposedTarget],
    ['First proposed action', policy.firstProposedAction],
    ['Writes to Mind', String(policy.writesToMind)],
    ['External side effects', String(policy.externalSideEffects)],
    ['Blocked prefixes', policy.blockedPrefixes.slice(0, 4).join(', ') || 'none'],
  ];
}

function formatStatus(value: string): string {
  return value === 'online' ? 'online' : 'offline';
}

function formatFlagState(value: boolean | undefined): string {
  if (value === true) {
    return 'enabled flag, execution still gated';
  }
  if (value === false) {
    return 'disabled';
  }
  return 'unknown';
}
