import { ItemView } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import {
  readBrainCoreApprovals,
  readBrainCoreApprovalStore,
  readBrainCoreCapabilities,
  readBrainCoreLocalApps,
  readBrainCoreExecutionPlans,
  readBrainCoreExecutionReadiness,
  readBrainCoreMindPreviewPolicy,
  readBrainCoreMindPreviews,
  readBrainCoreRepos,
  readBrainCoreRuntimeReports,
  readBrainCoreSchedulerJobs,
  readBrainCoreSchedulerStatus,
  readBrainCoreSessions,
  readBrainCoreVideoQueue,
  readBrainCoreVideoStatus,
  readBrainCoreStatus,
  readBrainCoreOrchestrators,
  readBrainCorePipelines,
  readBrainCoreProjects,
  readBrainCorePlatforms,
  readBrainCoreStbStatus,
  readBrainCoreVideoOrchestratorStatus,
  readBrainCoreStbVideoMigrationStatus,
  readBrainCoreAgents,
  readBrainCoreActions,
  requestBrainCoreActionApproval,
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
  type BrainCoreOrchestratorSummary,
  type BrainCorePipelineSummary,
  type BrainCoreProjectSummary,
  type BrainCorePlatformSummary,
  type BrainCoreStbPipelineStatus,
  type BrainCoreVideoOrchestratorStatus,
  type BrainCoreStbVideoMigrationStatus,
  type BrainCoreAgentSummary,
} from './client.js';
import {
  deriveDashboardSnapshot,
  formatRelativeTime,
  getConnectionStatusColor,
  getAttentionBadgeColor,
  type DashboardSnapshot,
} from './dashboard.js';

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
  mindPreviews?: import('./client.js').BrainCoreMindPreviewSummary[];
  orchestrators?: BrainCoreOrchestratorSummary[];
  pipelines?: BrainCorePipelineSummary[];
  projects?: BrainCoreProjectSummary[];
  platforms?: BrainCorePlatformSummary[];
  stbStatus?: BrainCoreStbPipelineStatus;
  videoOrchestratorStatus?: BrainCoreVideoOrchestratorStatus;
  stbVideoMigrationStatus?: BrainCoreStbVideoMigrationStatus;
  agents?: BrainCoreAgentSummary[];
  actions?: import('./client.js').BrainCoreActionSummary[];
  warning?: string;
  offline?: boolean;
  refreshedAt?: Date;
  brainCoreUrl?: string;
  statusError?: string;
  endpointErrors?: import('./client.js').EndpointError[];
}

export async function loadBrainConsoleViewState(
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS,
): Promise<BrainConsoleViewState> {
  const normalized = normalizeBrainCoreUrl(settings.brainCoreUrl);
  const baseUrl = normalized.value;
  const [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, stbStatus, videoOrchestratorStatus, stbVideoMigrationStatus, agents, actions] = await Promise.all([
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
    readBrainCoreMindPreviews(baseUrl),
    readBrainCoreOrchestrators(baseUrl),
    readBrainCorePipelines(baseUrl),
    readBrainCoreProjects(baseUrl),
    readBrainCorePlatforms(baseUrl),
    readBrainCoreStbStatus(baseUrl),
    readBrainCoreVideoOrchestratorStatus(baseUrl),
    readBrainCoreStbVideoMigrationStatus(baseUrl),
    readBrainCoreAgents(baseUrl),
    readBrainCoreActions(baseUrl),
  ]);

  const offline = [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, stbStatus, videoOrchestratorStatus, stbVideoMigrationStatus, agents, actions].every(
    (result) => result.value === undefined,
  );

  // Collect endpoint errors for diagnostics
  const endpointErrors: import('./client.js').EndpointError[] = [];
  [
    { name: '/status', result: status },
    { name: '/runtime/reports', result: runtimeReports },
    { name: '/scheduler/status', result: schedulerStatus },
  ].forEach(({ name, result }) => {
    if ((result as any).error) {
      endpointErrors.push({
        pathname: name,
        error: (result as any).error,
        detail: (result as any).detail,
        status: (result as any).status,
        url: (result as any).url,
      });
    }
  });

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
    mindPreviews: mindPreviews.value?.previews,
    orchestrators: orchestrators.value?.orchestrators,
    pipelines: pipelines.value?.pipelines,
    projects: projects.value?.projects,
    platforms: platforms.value?.platforms,
    stbStatus: stbStatus.value,
    videoOrchestratorStatus: videoOrchestratorStatus.value,
    stbVideoMigrationStatus: stbVideoMigrationStatus.value,
    agents: agents.value?.agents,
    actions: actions.value?.actions,
    warning: normalized.warning ?? normalized.error,
    offline,
    refreshedAt: new Date(),
    brainCoreUrl: baseUrl,
    statusError: status.error,
    endpointErrors: endpointErrors.length > 0 ? endpointErrors : undefined,
  };
}

export function renderBrainConsoleView(
  container: HTMLElement,
  state: BrainConsoleViewState,
  settings: BrainConsoleSettings,
  onRefresh?: () => void,
): void {
  container.empty();
  container.addClass('brain-console');
  container.addClass('brain-console--cockpit');

  const snapshot = deriveDashboardSnapshot(state, settings.brainCoreUrl);

  const shell = container.createDiv({ cls: 'brain-console__shell' });

  // Command bar
  renderCommandBar(shell, snapshot, onRefresh);

  // Status pills
  renderStatusPills(shell, state);

  // Hero attention panel
  renderHeroPanel(shell, snapshot, state);

  // Main content area
  if (snapshot.connectionStatus === 'offline') {
    renderOfflineState(shell, state.brainCoreUrl || settings.brainCoreUrl, state.statusError, state.endpointErrors);
  } else {
    // Dashboard grid with cards
    const grid = shell.createDiv({ cls: 'brain-console__dashboard-grid' });

    renderCard(grid, 'Wiki Health', renderWikiHealthCard(state));
    renderCard(grid, 'Maintenance', renderMaintenanceCard(state));
    renderCard(grid, 'Approvals', renderApprovalsCard(state));
    renderCard(grid, 'Scheduler', renderSchedulerCard(state));
    renderCard(grid, 'Brain Core', renderBrainCoreCard(state));
    renderCard(grid, 'Next Action', renderNextActionCard(snapshot));

    // Registry panels
    renderCard(grid, 'Orchestrators', renderOrchestratorsCard(state, snapshot));
    renderCard(grid, 'Pipelines', renderPipelinesCard(state, snapshot));
    renderCard(grid, 'Projects', renderProjectsCard(state, snapshot));
    renderCard(grid, 'Platforms', renderPlatformsCard(state, snapshot));

    // Live status panels
    renderCard(grid, 'STB Live Status', renderStbLiveStatusCard(state, snapshot));
    renderCard(grid, 'Video Orchestrator', renderVideoOrchestratorCard(state, snapshot));
    renderCard(grid, 'STB → Video Migration', renderMigrationStatusCard(state, snapshot));
    renderCard(grid, 'Agents (Read-Only)', renderAgentViewCard(state, snapshot));
    renderCard(grid, 'Action Preview', renderActionPreviewCard(state, settings));

    // Activity panel
    renderActivityPanel(shell, state);
  }
}

function renderCommandBar(shell: HTMLElement, snapshot: DashboardSnapshot, onRefresh?: () => void): void {
  const bar = shell.createDiv({ cls: 'brain-console__command-bar' });

  // Left side: logo/label
  const left = bar.createDiv({ cls: 'brain-console__bar-left' });
  left.createEl('div', { cls: 'brain-console__logo', text: '◈ BRAIN OS' });

  // Center: connection status badge
  const center = bar.createDiv({ cls: 'brain-console__bar-center' });
  const badge = center.createEl('span', { cls: 'brain-console__status-badge' });
  badge.style.color = getConnectionStatusColor(snapshot.connectionStatus);
  badge.textContent = `● ${snapshot.connectionStatus.toUpperCase()}`;

  // Right side: refresh button + timestamp
  const right = bar.createDiv({ cls: 'brain-console__bar-right' });

  const refreshBtn = right.createEl('button', { text: '↻ refresh' });
  refreshBtn.addClass('brain-console__btn-mini');
  if (onRefresh) {
    refreshBtn.addEventListener('click', () => onRefresh());
  }

  const timestamp = right.createEl('span', { text: formatRelativeTime(snapshot.refreshedAt) });
  timestamp.addClass('brain-console__timestamp');
}

function renderStatusPills(shell: HTMLElement, state: BrainConsoleViewState): void {
  const pills = shell.createDiv({ cls: 'brain-console__pills' });

  const mrReport = state.runtimeReports?.find((r) => r.id === 'model-router');
  const brainCoreOnline = state.status?.ok === true;

  const data = [
    { label: 'Brain Core', value: brainCoreOnline ? '● online' : '○ offline' },
    { label: 'Model Router', value: mrReport ? `${mrReport.status}` : 'unknown' },
    { label: 'Scheduler', value: state.schedulerStatus?.status ?? 'unknown' },
    { label: 'Save-to-Mind', value: 'live' },
    { label: 'Approvals', value: `${state.approvals?.length ?? 0}` },
    { label: 'Maintenance', value: `${(state.mindPreviews ?? []).filter((p) => !p.expired).length}` },
  ];

  for (const pill of data) {
    const el = pills.createDiv({ cls: 'brain-console__pill' });
    el.createEl('span', { cls: 'brain-console__pill-label', text: pill.label });
    el.createEl('span', { cls: 'brain-console__pill-value', text: pill.value });
  }
}

function renderHeroPanel(shell: HTMLElement, snapshot: DashboardSnapshot, state: BrainConsoleViewState): void {
  const hero = shell.createDiv({ cls: 'brain-console__hero' });
  hero.style.borderLeftColor = getAttentionBadgeColor(snapshot.attentionLevel);

  const label = hero.createDiv({ cls: 'brain-console__hero-label', text: 'SYSTEM ATTENTION' });

  const statusRow = hero.createDiv({ cls: 'brain-console__hero-status' });
  const statusVal = statusRow.createEl('span', { text: snapshot.attentionLevel.toUpperCase() });
  statusVal.style.color = getAttentionBadgeColor(snapshot.attentionLevel);

  const scoreRow = hero.createDiv({ cls: 'brain-console__hero-score' });
  scoreRow.createEl('span', { text: 'Score' });
  scoreRow.createEl('span', { cls: 'brain-console__score-number', text: `${snapshot.attentionScore}%` });

  // Burn bar
  const burnBar = hero.createDiv({ cls: 'brain-console__burn-bar' });
  const burnFill = burnBar.createDiv({ cls: 'brain-console__burn-fill' });
  burnFill.style.width = `${snapshot.attentionScore}%`;
  burnFill.style.backgroundColor = getAttentionBadgeColor(snapshot.attentionLevel);

  const right = hero.createDiv({ cls: 'brain-console__hero-right' });
  right.createEl('div', { text: `${snapshot.approvalsCount} approvals` });
  right.createEl('div', { text: `${snapshot.maintenanceCount} queued` });
}

function renderCard(parent: HTMLElement, title: string, content: HTMLElement): void {
  const card = parent.createDiv({ cls: 'brain-console__card' });
  const header = card.createDiv({ cls: 'brain-console__card-header' });
  header.createEl('h3', { text: title });
  card.appendChild(content);
}

function renderWikiHealthCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const mrReport = state.runtimeReports?.find((r) => r.id === 'model-router');
  if (!mrReport?.wikiHealth) {
    container.textContent = 'unavailable';
    return container;
  }

  const health = mrReport.wikiHealth;
  const metric = container.createEl('div', { cls: 'brain-console__metric', text: health.ok ? '✓ ok' : '⚠ issues' });
  if (health.ok) {
    metric.style.color = '#22c55e';
  } else {
    metric.style.color = '#ef4444';
    container.createEl('p', {
      cls: 'brain-console__detail',
      text: `${health.warningCount} warn · ${health.errorCount} err`,
    });
  }

  return container;
}

function renderMaintenanceCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const pending = (state.mindPreviews ?? []).filter((p) => !p.expired);
  if (pending.length === 0) {
    container.createEl('div', { cls: 'brain-console__metric', text: 'none' });
  } else {
    container.createEl('div', { cls: 'brain-console__metric', text: `${pending.length}` });
    if (pending[0]) {
      const date = new Date(pending[0].createdAt);
      container.createEl('p', { cls: 'brain-console__detail', text: `${formatRelativeTime(date)}` });
    }
  }

  return container;
}

function renderApprovalsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const approvals = state.approvals ?? [];
  if (approvals.length === 0) {
    container.createEl('div', { cls: 'brain-console__metric', text: 'none' });
  } else {
    container.createEl('div', { cls: 'brain-console__metric', text: `${approvals.length}` });
    const sample = approvals.slice(0, 2);
    const list = container.createEl('ul', { cls: 'brain-console__list' });
    for (const a of sample) {
      list.createEl('li', { text: `${a.kind}` });
    }
  }

  return container;
}

function renderSchedulerCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const status = state.schedulerStatus?.latestRunStatus ?? 'unknown';
  const metric = container.createEl('div', { cls: 'brain-console__metric', text: status });
  if (status === 'failed') metric.style.color = '#ef4444';
  if (status === 'ok') metric.style.color = '#22c55e';

  container.createEl('p', { cls: 'brain-console__detail', text: `${state.schedulerStatus?.latestRunAt ? formatRelativeTime(state.schedulerStatus.latestRunAt) : 'never'}` });

  return container;
}

function renderBrainCoreCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const online = state.status?.ok === true;
  const metric = container.createEl('div', { cls: 'brain-console__metric', text: online ? 'online' : 'offline' });
  if (online) metric.style.color = '#22c55e';
  else metric.style.color = '#ef4444';

  container.createEl('p', { cls: 'brain-console__detail', text: `v${state.status?.version ?? '?'}` });
  container.createEl('p', { cls: 'brain-console__detail', text: `exec: ${state.executionReadiness?.executionEnabled ? 'on' : 'off'}` });

  return container;
}

function renderNextActionCard(snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const metric = container.createEl('div', { cls: 'brain-console__metric', text: snapshot.nextAction });
  if (snapshot.attentionLevel === 'blocked') metric.style.color = '#ef4444';
  if (snapshot.attentionLevel === 'review') metric.style.color = '#f97316';
  if (snapshot.attentionLevel === 'watch') metric.style.color = '#eab308';
  if (snapshot.attentionLevel === 'clear') metric.style.color = '#22c55e';

  return container;
}

function renderOfflineState(
  shell: HTMLElement,
  brainCoreUrl: string,
  statusError?: string,
  endpointErrors?: import('./client.js').EndpointError[],
): void {
  const offline = shell.createDiv({ cls: 'brain-console__offline-panel' });

  offline.createEl('h2', { text: 'Connection lost' });
  offline.createEl('p', { text: 'Brain Core is not responding. Trying to reach:' });

  const urlEl = offline.createEl('code', { text: brainCoreUrl });
  urlEl.addClass('brain-console__url-display');

  // Show diagnostic error
  if (statusError) {
    offline.createEl('p', { text: `Error: ${statusError}` });
  }

  // Show first few endpoint errors
  if (endpointErrors && endpointErrors.length > 0) {
    const errorsDiv = offline.createDiv();
    errorsDiv.createEl('p', { text: 'Endpoint errors:' });
    const list = errorsDiv.createEl('ul');
    endpointErrors.slice(0, 3).forEach((err) => {
      const item = list.createEl('li');
      item.createEl('code', { text: err.pathname });
      item.appendText(` — ${err.error || 'no response'}`);
      if (err.detail) {
        item.appendText(` (${err.detail.slice(0, 50)})`);
      }
    });
  }

  offline.createEl('h3', { text: 'To recover:' });
  const steps = offline.createEl('ol');
  steps.createEl('li', { text: 'Verify Brain Core terminal is still running' });
  steps.createEl('li', { text: 'Test: curl http://localhost:4877/status' });
  steps.createEl('li', { text: 'If still offline, try: Settings → Brain Core URL → http://127.0.0.1:4877' });
  steps.createEl('li', { text: 'Click Refresh' });

  const refreshBtn = offline.createEl('button', { text: 'Refresh' });
  refreshBtn.addClass('brain-console__btn-main');
}

function renderActivityPanel(shell: HTMLElement, state: BrainConsoleViewState): void {
  const panel = shell.createDiv({ cls: 'brain-console__activity' });
  const header = panel.createDiv({ cls: 'brain-console__activity-header', text: 'Activity' });

  const activity = panel.createEl('ul', { cls: 'brain-console__activity-list' });

  if (state.sessions && state.sessions.length > 0) {
    activity.createEl('li', { text: `session: ${state.sessions[0]?.title?.slice(0, 40) ?? 'unknown'}` });
  }

  if (state.runtimeReports && state.runtimeReports.length > 0) {
    const ready = state.runtimeReports.filter((r) => r.status === 'available').length;
    activity.createEl('li', { text: `reports: ${ready}/${state.runtimeReports.length}` });
  }

  const mindPreviews = state.mindPreviews ?? [];
  if (mindPreviews.length > 0) {
    activity.createEl('li', { text: `previews: ${mindPreviews.length}` });
  }

  if (activity.children.length === 0) {
    activity.createEl('li', { text: 'all clear' });
  }
}

function renderOrchestratorsCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.orchestrators) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.orchestratorCount}` });
  list.createEl('li', { text: `Legacy: ${snapshot.legacySystemCount}` });

  const operationalCount = state.orchestrators.filter(o => o.lifecycle === 'operational').length;
  const problematicCount = state.orchestrators.filter(o => ['migrating', 'partial'].includes(o.lifecycle ?? '')).length;
  list.createEl('li', { text: `Operational: ${operationalCount}` });
  if (problematicCount > 0) {
    list.createEl('li', { text: `Needs Attention: ${problematicCount}`, cls: 'brain-console__list-warning' });
  }

  return card;
}

function renderPipelinesCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.pipelines) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.pipelineCount}` });

  const stbPipeline = state.pipelines.find(p => p.id === 'stb-daily-pipeline');
  if (stbPipeline) {
    const item = list.createEl('li', { text: `STB: ${stbPipeline.health}` });
    if (stbPipeline.health === 'error') {
      item.addClass('brain-console__list-error');
    }
  }

  if (snapshot.migrationBlockedCount > 0) {
    list.createEl('li', { text: `Migrations Blocked: ${snapshot.migrationBlockedCount}`, cls: 'brain-console__list-warning' });
  }

  return card;
}

function renderProjectsCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.projects) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.projectCount}` });

  const stbProject = state.projects.find(p => p.id === 'says-the-bible');
  if (stbProject) {
    const item = list.createEl('li', { text: `Says the Bible: ${stbProject.health}` });
    if (stbProject.health === 'error') {
      item.addClass('brain-console__list-error');
    }
  }

  const categories = new Set(state.projects.map(p => p.category));
  list.createEl('li', { text: `Categories: ${categories.size}` });

  return card;
}

function renderPlatformsCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.platforms) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.platformCount}` });

  const socialCount = state.platforms.filter(p => p.category === 'social').length;
  const localCount = state.platforms.filter(p => p.category === 'local').length;
  list.createEl('li', { text: `Social: ${socialCount}` });
  list.createEl('li', { text: `Local: ${localCount}` });

  return card;
}

function renderStbLiveStatusCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.stbStatus) {
    card.textContent = 'No STB status available';
    return card;
  }

  const list = card.createEl('ul');
  const statusItem = list.createEl('li', { text: `Status: ${state.stbStatus.status}` });
  if (state.stbStatus.status === 'error') {
    statusItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Health: ${state.stbStatus.health}` });
  list.createEl('li', { text: `Source: ${state.stbStatus.source}` });

  if (state.stbStatus.lastRunAgeHours) {
    list.createEl('li', { text: `Last run: ${state.stbStatus.lastRunAgeHours}h ago` });
  }

  if (state.stbStatus.limitations.length > 0) {
    list.createEl('li', { text: `Limitations: ${state.stbStatus.limitations.length}` });
  }

  return card;
}

function renderVideoOrchestratorCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoOrchestratorStatus) {
    card.textContent = 'No video status available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Progress: ${state.videoOrchestratorStatus.moduleProgress.percent}%` });
  list.createEl('li', { text: `Implemented: ${state.videoOrchestratorStatus.moduleProgress.implemented}/${state.videoOrchestratorStatus.moduleProgress.total}` });

  if (state.videoOrchestratorStatus.moduleProgress.partial > 0) {
    list.createEl('li', { text: `Partial: ${state.videoOrchestratorStatus.moduleProgress.partial}` });
  }

  if (state.videoOrchestratorStatus.moduleProgress.planned > 0) {
    list.createEl('li', { text: `Planned: ${state.videoOrchestratorStatus.moduleProgress.planned}` });
  }

  list.createEl('li', { text: `Platforms: ${state.videoOrchestratorStatus.supportedPlatforms.length}` });

  return card;
}

function renderMigrationStatusCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.stbVideoMigrationStatus) {
    card.textContent = 'No migration status available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Parity: ${state.stbVideoMigrationStatus.parityPercent}%` });
  list.createEl('li', { text: `Mapped modules: ${(state.stbVideoMigrationStatus.modules ?? []).filter(m => m.status === 'mapped').length}/${state.stbVideoMigrationStatus.modules.length}` });

  const blockedItem = list.createEl('li', { text: `Decomm Blocked: ${state.stbVideoMigrationStatus.decommissionBlocked ? 'yes' : 'no'}` });
  if (state.stbVideoMigrationStatus.decommissionBlocked) {
    blockedItem.addClass('brain-console__list-warning');
  }

  return card;
}

function renderAgentViewCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total agents: ${snapshot.agentCount}` });
  list.createEl('li', { text: `External executors: ${snapshot.externalExecutorCount}` });

  if (snapshot.plannedAgentCount > 0) {
    list.createEl('li', { text: `Planned: ${snapshot.plannedAgentCount}` });
  }

  if (snapshot.modelRouterAgentSummary) {
    list.createEl('li', { text: `Model Router: ${snapshot.modelRouterAgentSummary.health}` });
  }

  list.createEl('li', { text: 'Agent runtime is read-only (planned)', cls: 'brain-console__list-note' });

  return card;
}

function renderActionPreviewCard(state: BrainConsoleViewState, settings: BrainConsoleSettings): HTMLElement {
  const card = document.createElement('div');

  if (!state.actions || state.actions.length === 0) {
    card.textContent = 'No actions available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total actions: ${state.actions.length}` });

  const requestable = state.actions.filter((a) => a.canRequestApproval && a.status === 'approval-required');
  if (requestable.length > 0) {
    list.createEl('li', { text: `Requestable: ${requestable.length}`, cls: 'brain-console__list-item-highlight' });
    requestable.forEach((action) => {
      const item = list.createEl('li', { text: `  • ${action.label} (${action.risk})`, cls: 'brain-console__list-sub' });
      const btn = item.createEl('button', { text: 'Request', cls: 'brain-console__btn-mini' });
      btn.addEventListener('click', () => {
        void requestActionApproval(action.id, settings.brainCoreUrl);
      });
    });
  }

  const blocked = state.actions.filter((a) => a.status === 'blocked');
  if (blocked.length > 0) {
    list.createEl('li', { text: `Blocked: ${blocked.length}` });
    blocked.slice(0, 2).forEach((action) => {
      list.createEl('li', { text: `  • ${action.label}`, cls: 'brain-console__list-sub' });
    });
    if (blocked.length > 2) {
      list.createEl('li', { text: `  ... and ${blocked.length - 2} more`, cls: 'brain-console__list-note' });
    }
  }

  const planned = state.actions.filter((a) => a.status === 'planned');
  if (planned.length > 0) {
    list.createEl('li', { text: `Planned: ${planned.length}` });
  }

  list.createEl('li', { text: 'Approval requests do not execute actions', cls: 'brain-console__list-note' });

  return card;
}

async function requestActionApproval(actionId: string, brainCoreUrl: string): Promise<void> {
  try {
    const result = await requestBrainCoreActionApproval(brainCoreUrl, actionId);
    if (result.error) {
      console.error(`Action request failed: ${result.error}`, result.detail);
      return;
    }
    if (result.value?.executionDidRun === false) {
      console.log(`Action approval requested: ${actionId}. Execution did not run.`);
    }
  } catch (err) {
    console.error(`Error requesting action approval: ${err}`);
  }
}
