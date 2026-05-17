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
  const [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews] = await Promise.all([
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
  ]);

  const offline = [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews].every(
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
