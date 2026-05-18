import { ItemView } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import {
  readBrainCoreApprovals,
  readBrainCoreApprovalDetail,
  readBrainCoreApprovalStore,
  readBrainCoreCapabilities,
  readBrainCoreLocalApps,
  readBrainCoreExecutionPlans,
  readBrainCoreExecutionReadiness,
  readBrainCoreMindPreviewPolicy,
  readBrainCoreMindPreviews,
  readBrainCoreRepos,
  readBrainCoreRuntimeReports,
  readBrainCoreModelRouterReportDetail,
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
  readBrainCorePostOrchestratorContracts,
  readBrainCorePostOrchestratorIntegrations,
  readBrainCorePostOrchestratorRecovery,
  readBrainCorePostOrchestratorStatus,
  readBrainCoreStbStatus,
  readBrainCoreVideoOrchestratorStatus,
  readBrainCoreStbVideoMigrationStatus,
  readBrainCoreAgents,
  readBrainCoreActions,
  readBrainCoreMaintenancePreviewDetail,
  readBrainCoreAgentRuns,
  readBrainCoreAgentEvents,
  readBrainCoreRecoveryItems,
  requestBrainCoreActionApproval,
  type BrainCoreApprovalSummary,
  type BrainCoreApprovalDetail,
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
  type BrainCorePostOrchestratorContract,
  type BrainCorePostOrchestratorIntegration,
  type BrainCorePostOrchestratorRecoveryItem,
  type BrainCorePostOrchestratorStatusResponse,
  type BrainCoreStbPipelineStatus,
  type BrainCoreVideoOrchestratorStatus,
  type BrainCoreStbVideoMigrationStatus,
  type BrainCoreAgentSummary,
  type BrainCoreModelRouterReportDetail,
  type BrainCoreMaintenancePreviewDetail,
  type BrainCoreAgentRunSummary,
  type BrainCoreAgentEventSummary,
  type BrainCoreRecoveryItemSummary,
} from './client.js';
import {
  deriveDashboardSnapshot,
  formatRelativeTime,
  getConnectionStatusColor,
  getAttentionBadgeColor,
  type DashboardSnapshot,
} from './dashboard.js';

export type BrainConsoleSectionId = 'overview' | 'apps' | 'orchestrators' | 'pipelines' | 'projects' | 'reports' | 'posts' | 'agents' | 'recovery';

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
  approvalDetail?: BrainCoreApprovalDetail;
  approvalStore?: BrainCoreApprovalStoreSummary;
  executionPlans?: BrainCoreExecutionPlan[];
  executionReadiness?: BrainCoreExecutionReadiness;
  mindPreviewPolicy?: import('./client.js').BrainCoreMindPreviewPolicy;
  mindPreviews?: import('./client.js').BrainCoreMindPreviewSummary[];
  modelRouterReportDetail?: BrainCoreModelRouterReportDetail;
  maintenancePreviewDetail?: BrainCoreMaintenancePreviewDetail;
  orchestrators?: BrainCoreOrchestratorSummary[];
  pipelines?: BrainCorePipelineSummary[];
  projects?: BrainCoreProjectSummary[];
  platforms?: BrainCorePlatformSummary[];
  postOrchestratorStatus?: BrainCorePostOrchestratorStatusResponse;
  postOrchestratorContracts?: { contracts?: BrainCorePostOrchestratorContract[] };
  postOrchestratorIntegrations?: { integrations?: BrainCorePostOrchestratorIntegration[] };
  postOrchestratorRecovery?: { items?: BrainCorePostOrchestratorRecoveryItem[] };
  stbStatus?: BrainCoreStbPipelineStatus;
  videoOrchestratorStatus?: BrainCoreVideoOrchestratorStatus;
  stbVideoMigrationStatus?: BrainCoreStbVideoMigrationStatus;
  agents?: BrainCoreAgentSummary[];
  actions?: import('./client.js').BrainCoreActionSummary[];
  agentRuns?: import('./client.js').BrainCoreAgentRunSummary[];
  agentEvents?: import('./client.js').BrainCoreAgentEventSummary[];
  recoveryItems?: import('./client.js').BrainCoreRecoveryItemSummary[];
  warning?: string;
  offline?: boolean;
  refreshedAt?: Date;
  brainCoreUrl?: string;
  statusError?: string;
  endpointErrors?: import('./client.js').EndpointError[];
  activeSection?: BrainConsoleSectionId;
}

export async function loadBrainConsoleViewState(
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS,
): Promise<BrainConsoleViewState> {
  const normalized = normalizeBrainCoreUrl(settings.brainCoreUrl);
  const baseUrl = normalized.value;
  const [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, postOrchestratorStatus, postOrchestratorContracts, postOrchestratorIntegrations, postOrchestratorRecovery, stbStatus, videoOrchestratorStatus, stbVideoMigrationStatus, agents, actions, modelRouterReportDetail, agentRuns, agentEvents, recoveryItems] = await Promise.all([
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
    readBrainCorePostOrchestratorStatus(baseUrl),
    readBrainCorePostOrchestratorContracts(baseUrl),
    readBrainCorePostOrchestratorIntegrations(baseUrl),
    readBrainCorePostOrchestratorRecovery(baseUrl),
    readBrainCoreStbStatus(baseUrl),
    readBrainCoreVideoOrchestratorStatus(baseUrl),
    readBrainCoreStbVideoMigrationStatus(baseUrl),
    readBrainCoreAgents(baseUrl),
    readBrainCoreActions(baseUrl),
    readBrainCoreModelRouterReportDetail(baseUrl),
    readBrainCoreAgentRuns(baseUrl),
    readBrainCoreAgentEvents(baseUrl),
    readBrainCoreRecoveryItems(baseUrl),
  ]);

  let approvalDetail: import('./client.js').BrainCoreApprovalDetail | undefined;
  const latestApprovalId = approvals.value?.approvals?.[0]?.id;
  if (latestApprovalId) {
    const approvalDetailResult = await readBrainCoreApprovalDetail(baseUrl, latestApprovalId);
    approvalDetail = approvalDetailResult.value?.approval;
  }

  let maintenancePreviewDetail: BrainCoreMaintenancePreviewDetail | undefined;
  const latestMaintenanceId = mindPreviews.value?.previews?.[0]?.id;
  if (latestMaintenanceId) {
    const maintenanceDetailResult = await readBrainCoreMaintenancePreviewDetail(baseUrl, latestMaintenanceId);
    maintenancePreviewDetail = maintenanceDetailResult.value?.preview;
  }

  const offline = [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, postOrchestratorStatus, postOrchestratorContracts, postOrchestratorIntegrations, postOrchestratorRecovery, stbStatus, videoOrchestratorStatus, stbVideoMigrationStatus, agents, actions, agentRuns, agentEvents, recoveryItems].every(
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
    approvalDetail,
    approvalStore: approvalStore.value,
    executionPlans: executionPlans.value?.plans,
    executionReadiness: executionReadiness.value,
    mindPreviewPolicy: mindPreviewPolicy.value,
    mindPreviews: mindPreviews.value?.previews,
    modelRouterReportDetail: modelRouterReportDetail.value?.report,
    maintenancePreviewDetail,
    orchestrators: orchestrators.value?.orchestrators,
    pipelines: pipelines.value?.pipelines,
    projects: projects.value?.projects,
    platforms: platforms.value?.platforms,
    postOrchestratorStatus: postOrchestratorStatus.value,
    postOrchestratorContracts: postOrchestratorContracts.value,
    postOrchestratorIntegrations: postOrchestratorIntegrations.value,
    postOrchestratorRecovery: postOrchestratorRecovery.value,
    stbStatus: stbStatus.value,
    videoOrchestratorStatus: videoOrchestratorStatus.value,
    stbVideoMigrationStatus: stbVideoMigrationStatus.value,
    agents: agents.value?.agents,
    actions: actions.value?.actions,
    agentRuns: agentRuns.value?.runs,
    agentEvents: agentEvents.value?.events,
    recoveryItems: recoveryItems.value?.items,
    warning: normalized.warning ?? normalized.error,
    offline,
    refreshedAt: new Date(),
    brainCoreUrl: baseUrl,
    statusError: status.error,
    endpointErrors: endpointErrors.length > 0 ? endpointErrors : undefined,
  };
}

interface SectionTabConfig {
  id: BrainConsoleSectionId;
  label: string;
  icon: string;
}

const SECTION_TABS: SectionTabConfig[] = [
  { id: 'overview', label: 'Overview', icon: '◆' },
  { id: 'apps', label: 'Apps', icon: '■' },
  { id: 'orchestrators', label: 'Orchestrators', icon: '▲' },
  { id: 'pipelines', label: 'Pipelines', icon: '→' },
  { id: 'projects', label: 'Projects', icon: '◉' },
  { id: 'reports', label: 'Reports', icon: '📋' },
  { id: 'posts', label: 'Posts', icon: '✦' },
  { id: 'agents', label: 'Agents', icon: '◈' },
  { id: 'recovery', label: 'Recovery', icon: '⚠' },
];

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
  const activeSection = state.activeSection ?? 'overview';

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
    // Section tabs
    renderSectionTabs(shell, activeSection);

    // Active section content
    renderActiveSectionContent(shell, activeSection, state, snapshot, settings);

    // Activity panel
    renderActivityPanel(shell, state);
  }
}

function renderSectionTabs(shell: HTMLElement, activeSection: BrainConsoleSectionId): void {
  const tabBar = shell.createDiv({ cls: 'brain-console__section-tabs' });

  for (const tab of SECTION_TABS) {
    const btn = tabBar.createEl('button', { cls: 'brain-console__section-tab' });
    if (tab.id === activeSection) {
      btn.addClass('active');
    }
    btn.setAttribute('data-section-id', tab.id);
    btn.setAttribute('title', tab.label);
    btn.createEl('span', { cls: 'brain-console__tab-icon', text: tab.icon });
    btn.createEl('span', { cls: 'brain-console__tab-label', text: tab.label });
  }
}

function renderActiveSectionContent(
  shell: HTMLElement,
  activeSection: BrainConsoleSectionId,
  state: BrainConsoleViewState,
  snapshot: DashboardSnapshot,
  settings: BrainConsoleSettings,
): void {
  const content = shell.createDiv({ cls: 'brain-console__section-content' });

  switch (activeSection) {
    case 'overview':
      renderOverviewSection(content, state, snapshot);
      break;
    case 'apps':
      renderAppsSection(content, state, snapshot);
      break;
    case 'orchestrators':
      renderOrchestratorsSection(content, state, snapshot);
      break;
    case 'pipelines':
      renderPipelinesSection(content, state, snapshot);
      break;
    case 'projects':
      renderProjectsSection(content, state, snapshot);
      break;
    case 'reports':
      renderReportsSection(content, state, snapshot);
      break;
    case 'posts':
      renderPostOrchestratorSection(content, state, snapshot);
      break;
    case 'agents':
      renderAgentsSection(content, state, snapshot);
      break;
    case 'recovery':
      renderRecoverySection(content, state, snapshot);
      break;
  }
}

function renderOverviewSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  // What needs attention
  renderCard(grid, 'What Needs Attention', renderWhatNeedsAttentionCard(state, snapshot));

  // Next safe step
  renderCard(grid, 'Next Safe Step', renderNextSafeStepCard(state, snapshot));

  // Metric counts
  renderCard(grid, 'Metrics', renderOverviewMetricsCard(snapshot));

  // Status overview
  renderCard(grid, 'Status', renderOverviewStatusCard(state));
}

function renderAppsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Brain Core', renderBrainCoreCard(state));
  renderCard(grid, 'Scheduler', renderSchedulerCard(state));
  renderCard(grid, 'Local Apps', renderLocalAppsCard(state));
}

function renderOrchestratorsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Orchestrators', renderOrchestratorsCard(state, snapshot));

  const videoOrch = state.orchestrators?.find(o => o.id === 'video-orchestrator');
  if (videoOrch) {
    renderCard(grid, 'Video Orchestrator', renderVideoOrchestratorCard(state, snapshot));
  }
}

function renderPipelinesSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Pipelines', renderPipelinesCard(state, snapshot));
  renderCard(grid, 'STB Live Status', renderStbLiveStatusCard(state, snapshot));
  renderCard(grid, 'STB → Video Migration', renderMigrationStatusCard(state, snapshot));
}

function renderProjectsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Projects', renderProjectsCard(state, snapshot));
  renderCard(grid, 'Platforms', renderPlatformsCard(state, snapshot));
}

function renderReportsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Runtime Reports', renderRuntimeReportsCard(state));
  renderCard(grid, 'Wiki Health', renderWikiHealthCard(state));

  if (state.modelRouterReportDetail) {
    renderCard(grid, 'Model Router Report', renderModelRouterReportDetailCard(state.modelRouterReportDetail));
  }

  if (state.maintenancePreviewDetail) {
    renderCard(grid, 'Maintenance Preview', renderMaintenancePreviewDetailCard(state.maintenancePreviewDetail));
  }

  if (state.approvalDetail) {
    renderCard(grid, 'Approval Details', renderApprovalDetailCard(state.approvalDetail));
  }
}

function renderPostOrchestratorSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Post Orchestrator Status', renderPostOrchestratorStatusCard(state));
  renderCard(grid, 'Platform / Post Flows', renderPlatformPostFlowsCard(state));
  renderCard(grid, 'Social Proof Asset Flow', renderSocialProofAssetFlowCard(state));
  renderCard(grid, 'Growth Optimization Flow', renderGrowthOptimizationFlowCard(state));
  renderCard(grid, 'Contracts', renderPostContractsCard(state));
  renderCard(grid, 'Recovery / Blockers', renderPostRecoveryCard(state));
  renderCard(grid, 'Publishing Disabled', renderPublishingDisabledCard());
}

function renderAgentsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Agent View', renderAgentViewLedgerCard(state));
  renderCard(grid, 'Approval Audit Trail', renderApprovalAuditTrailCard(state));
  renderCard(grid, 'Agents (Summary)', renderAgentViewCard(state, snapshot));
}

function renderRecoverySection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Recovery / Blockers', renderRecoveryPanelCard(state));
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

function renderRuntimeReportsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  if (!state.runtimeReports || state.runtimeReports.length === 0) {
    container.textContent = 'no reports';
    return container;
  }

  // Show model-router report with focus
  const mrReport = state.runtimeReports.find((r) => r.id === 'model-router');
  const list = container.createEl('ul', { cls: 'brain-console__list' });

  // Model-router report: show status, wiki health summary, file path
  if (mrReport) {
    const item = list.createEl('li', { text: `Model Router: ${mrReport.status}` });
    item.addClass('brain-console__list-item-highlight');

    if (mrReport.latestRunStatus === 'ok') {
      item.style.color = '#22c55e';
    } else if (mrReport.latestRunStatus === 'failed') {
      item.style.color = '#ef4444';
    }

    // Add wiki health if available
    if (mrReport.wikiHealth) {
      const wikiText = mrReport.wikiHealth.ok
        ? `Wiki: ✓ ok`
        : `Wiki: ${mrReport.wikiHealth.errorCount}e ${mrReport.wikiHealth.warningCount}w`;
      list.createEl('li', { cls: 'brain-console__list-sub', text: wikiText });
    }

    // Add message if available
    if (mrReport.message && mrReport.message !== 'Runtime report is available.') {
      list.createEl('li', { cls: 'brain-console__list-sub', text: mrReport.message });
    }
  }

  // List other reports
  const otherReports = state.runtimeReports.filter((r) => r.id !== 'model-router' && r.status === 'available');
  if (otherReports.length > 0) {
    for (const report of otherReports) {
      list.createEl('li', { cls: 'brain-console__list-note', text: `${report.id}: ${report.status}` });
    }
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

function renderWhatNeedsAttentionCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const issues: string[] = [];

  // Recovery errors
  if (snapshot.recoveryItemErrorCount > 0) {
    issues.push(`${snapshot.recoveryItemErrorCount} recovery error${snapshot.recoveryItemErrorCount > 1 ? 's' : ''}`);
  }

  // Wiki health
  if (snapshot.wikiHealthErrors > 0) {
    issues.push(`${snapshot.wikiHealthErrors} wiki error${snapshot.wikiHealthErrors > 1 ? 's' : ''}`);
  }

  // Blocked agents
  if (snapshot.agentRunBlockedCount > 0) {
    issues.push(`${snapshot.agentRunBlockedCount} blocked agent run${snapshot.agentRunBlockedCount > 1 ? 's' : ''}`);
  }

  // Migration blocked
  if (snapshot.migrationBlockedCount > 0) {
    issues.push(`${snapshot.migrationBlockedCount} migration blocked`);
  }

  // Pending approvals
  if (snapshot.approvalsCount > 0) {
    issues.push(`${snapshot.approvalsCount} approval${snapshot.approvalsCount > 1 ? 's' : ''} pending`);
  }

  // Maintenance previews
  if (snapshot.maintenanceCount > 0) {
    issues.push(`${snapshot.maintenanceCount} maintenance in queue`);
  }

  if (issues.length === 0) {
    const metric = container.createEl('div', { cls: 'brain-console__metric', text: '✓ clear' });
    metric.style.color = '#22c55e';
    container.createEl('p', { cls: 'brain-console__detail', text: 'No urgent issues detected.' });
  } else {
    const list = container.createEl('ul', { cls: 'brain-console__list' });
    issues.forEach(issue => {
      list.createEl('li', { text: issue });
    });
  }

  return container;
}

function renderNextSafeStepCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  let step = 'No action needed.';

  // Top recovery blocker
  if (snapshot.recoveryItemErrorCount > 0 && state.recoveryItems?.length) {
    const topError = state.recoveryItems.find(i => i.severity === 'error');
    if (topError?.nextSafeStep) {
      step = topError.nextSafeStep;
    } else {
      step = 'Review recovery blockers.';
    }
  } else if (snapshot.wikiHealthErrors > 0) {
    step = 'Review wiki health report.';
  } else if (snapshot.migrationBlockedCount > 0) {
    step = 'Review STB to video migration status.';
  } else if (snapshot.approvalsCount > 0) {
    step = 'Review pending approvals.';
  } else if (snapshot.maintenanceCount > 0) {
    step = 'Review maintenance queue.';
  }

  container.createEl('div', { cls: 'brain-console__metric', text: '→' });
  container.createEl('p', { cls: 'brain-console__detail', text: step });

  return container;
}

function renderOverviewMetricsCard(snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const metrics = [
    { label: 'Approvals', value: snapshot.approvalsCount },
    { label: 'Maintenance', value: snapshot.maintenanceCount },
    { label: 'Agent runs', value: snapshot.agentRunCount },
    { label: 'Recovery items', value: snapshot.recoveryItemCount },
    { label: 'Actions', value: snapshot.actionCount },
    { label: 'Reports', value: snapshot.approvalsCount > 0 ? '▸' : '○' },
  ];

  const list = container.createEl('ul', { cls: 'brain-console__list' });
  metrics.forEach(m => {
    list.createEl('li', { text: `${m.label}: ${m.value}` });
  });

  return container;
}

function renderOverviewStatusCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const online = state.status?.ok === true;
  const statusText = online ? 'online' : 'offline';
  const statusColor = online ? '#22c55e' : '#ef4444';

  const metric = container.createEl('div', { cls: 'brain-console__metric', text: statusText });
  metric.style.color = statusColor;

  container.createEl('p', { cls: 'brain-console__detail', text: `v${state.status?.version ?? '?'}` });

  const mrReport = state.runtimeReports?.find(r => r.id === 'model-router');
  if (mrReport?.wikiHealth) {
    const wikiText = mrReport.wikiHealth.ok
      ? 'Wiki: ✓ ok'
      : `Wiki: ${mrReport.wikiHealth.errorCount}e ${mrReport.wikiHealth.warningCount}w`;
    container.createEl('p', { cls: 'brain-console__detail', text: wikiText });
  }

  return container;
}

function renderLocalAppsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  if (!state.localApps || state.localApps.length === 0) {
    container.createEl('div', { cls: 'brain-console__list-note', text: 'No local apps available' });
    return container;
  }

  const list = container.createEl('ul', { cls: 'brain-console__list' });
  state.localApps.slice(0, 5).forEach(app => {
    list.createEl('li', { text: `${app.name}` });
  });

  if (state.localApps.length > 5) {
    list.createEl('li', { cls: 'brain-console__list-note', text: `... and ${state.localApps.length - 5} more` });
  }

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

      // Display readiness status if available
      const readiness = (action as any).readiness;
      if (readiness) {
        if (readiness.status === 'blocked' && readiness.blockers?.length > 0) {
          const blockerText = readiness.blockers.join('; ');
          item.createEl('span', { text: ` [⚠ ${blockerText}]`, cls: 'brain-console__readiness-blocked' });
        } else if (readiness.status === 'ready') {
          item.createEl('span', { text: ' [✓ ready]', cls: 'brain-console__readiness-ready' });
        }

        // Show latest approval status if available
        if (readiness.latestApprovalStatus) {
          const statusEmoji = readiness.latestApprovalStatus === 'approved' ? '✓' :
                             readiness.latestApprovalStatus === 'rejected' ? '✗' :
                             readiness.latestApprovalStatus === 'expired' ? '⏱' : '⏳';
          const ageText = readiness.latestRequestAgeMinutes !== undefined ? ` (${readiness.latestRequestAgeMinutes}m ago)` : '';
          item.createEl('span', { text: ` ${statusEmoji} ${readiness.latestApprovalStatus}${ageText}`, cls: 'brain-console__latest-approval' });
        }

        // Show latest report availability if model-router action
        if (action.id === 'model-router-dry-run') {
          const mrReport = state.runtimeReports?.find((r) => r.id === 'model-router');
          if (mrReport && mrReport.status === 'available') {
            item.createEl('span', { text: ' 📄 report available', cls: 'brain-console__report-available' });
          }
        }
      }
    });
  }

  const blocked = state.actions.filter((a) => a.status === 'blocked');
  if (blocked.length > 0) {
    list.createEl('li', { text: `Blocked: ${blocked.length}` });
    blocked.slice(0, 2).forEach((action) => {
      const item = list.createEl('li', { text: `  • ${action.label}`, cls: 'brain-console__list-sub' });
      item.createEl('span', { text: ` — ${action.reason}`, cls: 'brain-console__block-reason' });
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
    const request = result.value;
    if (request?.status === 'requested') {
      console.log(`✓ Action approval requested: ${actionId}`);
      if (request.approvalId) {
        console.log(`  Approval ID: ${request.approvalId}`);
      }
      console.log(`  ⚠ Execution did not run (approval process only)`);
    } else if (request?.status === 'blocked') {
      console.warn(`⚠ Action request blocked: ${request.summary}`);
    } else if (request?.status === 'invalid') {
      console.error(`✗ Invalid action request: ${request.summary}`);
    }
  } catch (err) {
    console.error(`Error requesting action approval: ${err}`);
  }
}

function renderApprovalDetailCard(detail: import('./client.js').BrainCoreApprovalDetail): HTMLElement {
  const el = document.createElement('div');
  const rows = [
    { label: 'ID', value: detail.id },
    { label: 'Kind', value: detail.kind },
    { label: 'Status', value: detail.status },
    { label: 'Age', value: detail.ageMinutes !== undefined ? `${detail.ageMinutes}m` : 'unknown' },
    { label: 'Expires', value: detail.expired ? '✗ expired' : (detail.expiresAt ? 'pending' : 'never') },
    { label: 'WritesToMind', value: 'false' },
    { label: 'ApplyEnabled', value: 'false' },
  ];
  
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });
  
  return el;
}

function renderModelRouterReportDetailCard(detail: import('./client.js').BrainCoreModelRouterReportDetail): HTMLElement {
  const el = document.createElement('div');
  const rows = [
    { label: 'Exists', value: detail.exists ? 'yes' : 'no' },
    { label: 'Status', value: detail.status || 'unknown' },
    { label: 'Latest Run', value: detail.latestRunStatus || 'unknown' },
    { label: 'Wiki Health', value: detail.wikiHealth ? (detail.wikiHealth.ok ? '✓ ok' : `⚠ ${detail.wikiHealth.errorCount} errors, ${detail.wikiHealth.warningCount} warnings`) : 'unknown' },
    { label: 'WritesToMind', value: 'false' },
    { label: 'ApplyEnabled', value: 'false' },
  ];
  
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });
  
  return el;
}

function renderMaintenancePreviewDetailCard(detail: import('./client.js').BrainCoreMaintenancePreviewDetail): HTMLElement {
  const el = document.createElement('div');
  const rows = [
    { label: 'Queue ID', value: detail.queueId },
    { label: 'Actions', value: String(detail.actionCount) },
    { label: 'Risk', value: `L:${detail.lowRiskCount} M:${detail.mediumRiskCount} H:${detail.highRiskCount}` },
    { label: 'Approval Required', value: String(detail.approvalRequiredCount) },
    { label: 'Expired', value: detail.expired ? '✗ yes' : '○ no' },
    { label: 'WritesToMind', value: 'false' },
  ];
  
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });
  
  if (detail.topActions && detail.topActions.length > 0) {
    const actionsDiv = el.createDiv({ cls: 'brain-console__section' });
    actionsDiv.createEl('strong', { text: 'Top Actions:' });
    const list = actionsDiv.createEl('ul', { cls: 'brain-console__list' });
    detail.topActions.forEach(action => {
      list.createEl('li', { text: `${action.title} (${action.risk})` });
    });
  }

  return el;
}

function renderAgentViewLedgerCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');

  // Operating mode note
  const note = el.createEl('div', { cls: 'brain-console__list-note' });
  note.textContent = '● Read-only ledger · Approval-gated · Execution disabled';

  // Count summary
  const counts = el.createDiv({ cls: 'brain-console__row' });
  counts.createEl('dt', { text: 'Total Runs' });
  counts.createEl('dd', { text: `${state.agentRuns?.length ?? 0}` });

  if (state.agentRuns && state.agentRuns.length > 0) {
    const blocked = state.agentRuns.filter(r => r.status === 'blocked').length;
    const completed = state.agentRuns.filter(r => r.status === 'completed').length;

    if (blocked > 0) {
      const blockedRow = el.createDiv({ cls: 'brain-console__row' });
      blockedRow.createEl('dt', { text: 'Blocked' });
      blockedRow.createEl('dd', { text: `${blocked}`, cls: 'brain-console__list-warning' });
    }
    if (completed > 0) {
      const completedRow = el.createDiv({ cls: 'brain-console__row' });
      completedRow.createEl('dt', { text: 'Completed' });
      completedRow.createEl('dd', { text: `${completed}`, cls: 'brain-console__list-item-highlight' });
    }
  }

  // Latest runs (max 5)
  if (state.agentRuns && state.agentRuns.length > 0) {
    el.createEl('hr');
    el.createEl('strong', { text: 'Latest Runs (read-only):' });
    const list = el.createEl('ul', { cls: 'brain-console__list' });

    const maxRuns = Math.min(5, state.agentRuns.length);
    for (let i = 0; i < maxRuns; i++) {
      const run = state.agentRuns[i];
      const li = list.createEl('li');

      const title = li.createEl('strong', { text: run.title });
      li.appendText(` (${run.agentId})`);

      const details = li.createEl('div', { cls: 'brain-console__list-note' });
      const parts: string[] = [];
      parts.push(run.status);
      if (run.ageMinutes !== undefined) parts.push(`${run.ageMinutes}m old`);
      if (run.targetId) parts.push(`→ ${run.targetId}`);
      details.textContent = parts.join(' · ');

      if (run.blockers.length > 0) {
        const blocker = li.createEl('div', { cls: 'brain-console__list-warning', text: `⚠ ${run.blockers[0]}` });
      }

      // Safety chips
      const safety = li.createEl('div', { cls: 'brain-console__list-note' });
      const chips: string[] = [];
      if (!run.safety.writesToMind) chips.push('no Mind write');
      if (!run.safety.executesShell) chips.push('no shell');
      if (!run.safety.mutatesRuntime) chips.push('no runtime mutation');
      if (!run.safety.executionEnabled) chips.push('execution disabled');
      if (run.safety.requiresApproval) chips.push('approval required');
      safety.textContent = chips.join(' · ');
    }
  } else {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No agent runs available yet.' });
  }

  const footer = el.createEl('div', { cls: 'brain-console__list-note' });
  footer.innerHTML = '<em>Agent runtime is not autonomous. This view is a read-only ledger derived from approvals, reports, and status scans.</em>';

  return el;
}

function renderApprovalAuditTrailCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');

  if (!state.agentEvents || state.agentEvents.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No approval audit events available yet.' });
    return el;
  }

  // Latest audit events (max 8)
  const list = el.createEl('ul', { cls: 'brain-console__list' });
  const maxEvents = Math.min(8, state.agentEvents.length);

  for (let i = 0; i < maxEvents; i++) {
    const event = state.agentEvents[i];
    const li = list.createEl('li');

    // Event type with severity color
    const typeSpan = li.createEl('span', { cls: 'brain-console__list-item-highlight' });
    typeSpan.textContent = event.type.toUpperCase();

    if (event.severity === 'error') {
      li.classList.add('brain-console__list-error');
    } else if (event.severity === 'warning') {
      li.classList.add('brain-console__list-warning');
    }

    // Timestamp and approval ID
    const meta = li.createEl('div', { cls: 'brain-console__list-note' });
    const parts: string[] = [];
    if (event.createdAt) {
      const timeStr = formatRelativeTime(new Date(event.createdAt));
      parts.push(timeStr);
    }
    if (event.relatedApprovalId) parts.push(`#${event.relatedApprovalId}`);
    if (event.summary) parts.push(event.summary);
    meta.textContent = parts.join(' · ');
  }

  return el;
}

function renderRecoveryPanelCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');

  if (!state.recoveryItems || state.recoveryItems.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No recovery blockers detected.' });
    return el;
  }

  // Summary counts
  const errorCount = state.recoveryItems.filter(i => i.severity === 'error').length;
  const warningCount = state.recoveryItems.filter(i => i.severity === 'warning').length;

  if (errorCount > 0 || warningCount > 0) {
    const summary = el.createDiv({ cls: 'brain-console__row' });
    if (errorCount > 0) {
      const errRow = el.createDiv({ cls: 'brain-console__row' });
      errRow.createEl('dt', { text: 'Errors' });
      errRow.createEl('dd', { text: `${errorCount}`, cls: 'brain-console__list-error' });
    }
    if (warningCount > 0) {
      const warnRow = el.createDiv({ cls: 'brain-console__row' });
      warnRow.createEl('dt', { text: 'Warnings' });
      warnRow.createEl('dd', { text: `${warningCount}`, cls: 'brain-console__list-warning' });
    }
  }

  el.createEl('hr');

  // Top recovery items (max 8)
  const list = el.createEl('ul', { cls: 'brain-console__list' });
  const maxItems = Math.min(8, state.recoveryItems.length);

  for (let i = 0; i < maxItems; i++) {
    const item = state.recoveryItems[i];
    const li = list.createEl('li');

    if (item.severity === 'error') {
      li.classList.add('brain-console__list-error');
    } else if (item.severity === 'warning') {
      li.classList.add('brain-console__list-warning');
    }

    // Title
    const titleSpan = li.createEl('strong', { text: item.title });

    // Source and severity badge
    const badge = li.createEl('span', { cls: 'brain-console__list-note' });
    badge.textContent = ` [${item.source}]`;

    // Blocker
    if (item.blocker) {
      const blockerDiv = li.createEl('div', { cls: 'brain-console__list-sub', text: `⚠ ${item.blocker}` });
    }

    // Next safe step
    if (item.nextSafeStep) {
      const stepDiv = li.createEl('div', { cls: 'brain-console__list-sub', text: `→ ${item.nextSafeStep}` });
    }

    // Safety flags
    const safetyDiv = li.createEl('div', { cls: 'brain-console__list-note' });
    const safetyChips: string[] = [];
    if (!item.safety.canAutoFix) safetyChips.push('no auto-fix');
    if (!item.safety.writesToMind) safetyChips.push('no Mind write');
    safetyDiv.textContent = safetyChips.join(' · ');
  }

  return el;
}

function renderPostOrchestratorStatusCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const status = state.postOrchestratorStatus;
  if (!status) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post orchestrator status available.' });
    return el;
  }

  const rows = [
    { label: 'Status', value: status.status },
    { label: 'Phase', value: status.phase },
    { label: 'Publishing', value: status.publishingEnabled ? 'enabled' : 'disabled' },
    { label: 'Scheduling', value: status.schedulingEnabled ? 'enabled' : 'disabled' },
    { label: 'Execution', value: status.executionEnabled ? 'enabled' : 'disabled' },
    { label: 'Next safe step', value: status.nextSafeStep },
  ];

  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  return el;
}

function renderPlatformPostFlowsCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const status = state.postOrchestratorStatus;
  const modules = status?.modules ?? [];
  const flowIds = ['x-post-flow', 'github-post-flow', 'linkedin-post-flow', 'facebook-post-flow', 'youtube-post-flow', 'blog-post-flow', 'product-milestone-post-flow', 'release-announcement-post-flow'];
  const list = el.createEl('ul', { cls: 'brain-console__list' });

  flowIds.forEach((id) => {
    const module = modules.find((item) => item.id === id);
    list.createEl('li', { text: `${module?.name ?? id}: ${module?.status ?? 'planned'}` });
  });

  if (status?.socialProofFlowLabel) {
    el.createEl('div', { cls: 'brain-console__list-note', text: `Asset flow label: ${status.socialProofFlowLabel}` });
  }
  if (status?.growthOptimizationFlowLabel) {
    el.createEl('div', { cls: 'brain-console__list-note', text: `Optimization flow label: ${status.growthOptimizationFlowLabel}` });
  }

  return el;
}

function renderSocialProofAssetFlowCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const status = state.postOrchestratorStatus;
  const integrations = state.postOrchestratorIntegrations?.integrations ?? [];
  const proofly = integrations.find((integration) => integration.id === 'proofly-social-proof-assets');

  if (!proofly) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No social proof asset flow available.' });
    return el;
  }

  const rows = [
    { label: 'Role', value: proofly.role },
    { label: 'Status', value: proofly.status },
    { label: 'Contracts', value: proofly.contractIds.join(', ') },
    { label: 'Execution', value: proofly.executionEnabled ? 'enabled' : 'disabled' },
  ];

  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  if (proofly.blockers.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    proofly.blockers.forEach((blocker) => list.createEl('li', { text: blocker }));
  }

  if (proofly.legacySource) {
    el.createEl('div', { cls: 'brain-console__list-note', text: `Internal migration source: ${proofly.legacySource}` });
  }

  return el;
}

function renderGrowthOptimizationFlowCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const integrations = state.postOrchestratorIntegrations?.integrations ?? [];
  const xgrow = integrations.find((integration) => integration.id === 'xgrow-growth-optimization');

  if (!xgrow) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No growth optimization flow available.' });
    return el;
  }

  const rows = [
    { label: 'Role', value: xgrow.role },
    { label: 'Status', value: xgrow.status },
    { label: 'Contracts', value: xgrow.contractIds.join(', ') },
    { label: 'Publishing', value: xgrow.publishingEnabled ? 'enabled' : 'disabled' },
    { label: 'Execution', value: xgrow.executionEnabled ? 'enabled' : 'disabled' },
    { label: 'Next safe step', value: xgrow.nextSafeStep },
  ];

  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  if (xgrow.safety.usesPlaywright || xgrow.safety.usesCookies) {
    el.createEl('div', { cls: 'brain-console__list-warning', text: 'Playwright/cookie risk is metadata only and execution remains disabled.' });
  }

  if (xgrow.blockers.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    xgrow.blockers.forEach((blocker) => list.createEl('li', { text: blocker }));
  }

  if (xgrow.legacySource) {
    el.createEl('div', { cls: 'brain-console__list-note', text: `Internal migration source: ${xgrow.legacySource}` });
  }

  return el;
}

function renderPostContractsCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const contracts = state.postOrchestratorContracts?.contracts ?? [];

  if (contracts.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post contracts available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  contracts.forEach((contract) => {
    list.createEl('li', {
      text: `${contract.id}: ${contract.status} · brain=${contract.implementedInBrain ? 'yes' : 'no'} · provider=${contract.implementedInProvider ? 'yes' : 'no'}`,
    });
  });

  return el;
}

function renderPostRecoveryCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const recovery = state.postOrchestratorRecovery?.items ?? [];

  if (recovery.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post recovery items available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  recovery.forEach((item) => {
    list.createEl('li', { text: `${item.id}: ${item.blocker}` });
  });

  return el;
}

function renderPublishingDisabledCard(): HTMLElement {
  const el = document.createElement('div');
  el.createEl('div', {
    cls: 'brain-console__post-disabled',
    text: 'Publishing is disabled. No post is scheduled or published from Brain in Phase P1.',
  });
  return el;
}
