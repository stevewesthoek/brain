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
  };
}

export function renderBrainConsoleView(
  container: HTMLElement,
  state: BrainConsoleViewState,
  onRefresh?: () => void,
): void {
  container.empty();
  container.addClass('brain-console');
  container.addClass('brain-console--dashboard');

  const shell = container.createDiv({ cls: 'brain-console__shell' });

  // Status strip (6 pills)
  const statusStrip = shell.createDiv({ cls: 'brain-console__status-strip' });
  renderStatusPills(statusStrip, state);

  // Header
  const header = shell.createDiv({ cls: 'brain-console__header' });
  header.createEl('h1', { text: 'Brain Cockpit' });
  header.createEl('p', { text: 'System status, maintenance queue, and next safe action' });

  // Safety banner
  const safety = header.createDiv({ cls: 'brain-console__banner' });
  safety.setText('Read-only. Manual refresh. No automatic POST calls.');

  if (state.warning) {
    header.createDiv({ cls: 'brain-console__warning' }).setText(state.warning);
  }

  if (state.offline) {
    const offline = shell.createDiv({ cls: 'brain-console__offline' });
    offline.createEl('h3', { text: 'Brain Core offline' });
    offline.createEl('p', { text: 'Start Brain Core to load live summaries.' });
    return;
  }

  // Action row
  const actions = header.createDiv({ cls: 'brain-console__actions' });
  renderActionButtons(actions, onRefresh);

  // Dashboard grid (6 core cards + 2 optional)
  const dashboard = shell.createDiv({ cls: 'brain-console__dashboard' });

  // MVP cards (6 must-have)
  renderCard(dashboard, 'Wiki Health', renderWikiHealthCard(state));
  renderCard(dashboard, 'Maintenance Previews', renderMaintenancePreviewsCard(state));
  renderCard(dashboard, 'Approvals', renderApprovalsCard(state));
  renderCard(dashboard, 'Scheduler Status', renderSchedulerCard(state));
  renderCard(dashboard, 'Brain Core', renderBrainCoreCard(state));
  renderCard(dashboard, 'Next Safe Action', renderNextActionCard(state));

  // Activity panel at the bottom
  const activity = shell.createDiv({ cls: 'brain-console__activity' });
  renderActivityPanel(activity, state);
}

function renderStatusPills(container: HTMLElement, state: BrainConsoleViewState): void {
  const pills = container.createDiv({ cls: 'brain-console__pills' });

  // Brain Core pill
  const brainCorePill = pills.createDiv({ cls: 'brain-console__pill' });
  brainCorePill.createEl('span', {
    text: `Brain Core: ${state.status?.ok === true ? '●' : '○'} ${state.status?.mode ?? 'unknown'}`,
  });

  // Model Router pill
  const mrReport = (state.runtimeReports ?? []).find((r) => r.id === 'model-router');
  const mrPill = pills.createDiv({ cls: 'brain-console__pill' });
  mrPill.createEl('span', { text: `Model Router: ${mrReport?.status ?? 'unknown'}` });

  // Scheduler pill
  const schedPill = pills.createDiv({ cls: 'brain-console__pill' });
  schedPill.createEl('span', { text: `Scheduler: ${state.schedulerStatus?.status ?? 'unknown'}` });

  // Save-to-Mind pill
  const capturePill = pills.createDiv({ cls: 'brain-console__pill' });
  capturePill.createEl('span', { text: 'Save-to-Mind: live' });

  // Approvals pill
  const approvalsCount = state.approvals?.length ?? 0;
  const approvalsPill = pills.createDiv({ cls: 'brain-console__pill' });
  approvalsPill.createEl('span', { text: `Approvals: ${approvalsCount}` });

  // Maintenance pill
  const maintenanceCount = (state.mindPreviews ?? []).filter((p) => !p.expired).length;
  const maintenancePill = pills.createDiv({ cls: 'brain-console__pill' });
  maintenancePill.createEl('span', { text: `Maintenance: ${maintenanceCount} pending` });
}

function renderActionButtons(container: HTMLElement, onRefresh?: () => void): void {
  const buttonGroup = container.createDiv({ cls: 'brain-console__button-group' });

  const refreshBtn = buttonGroup.createEl('button', { text: 'Refresh' });
  refreshBtn.addClass('brain-console__btn');
  if (onRefresh) {
    refreshBtn.addEventListener('click', () => onRefresh());
  }

  const dryRunBtn = buttonGroup.createEl('button', { text: 'Request Dry Run' });
  dryRunBtn.addClass('brain-console__btn');
  dryRunBtn.disabled = true;

  const viewBtn = buttonGroup.createEl('button', { text: 'View Latest' });
  viewBtn.addClass('brain-console__btn');
  viewBtn.disabled = true;

  const mindBtn = buttonGroup.createEl('button', { text: 'Open Mind' });
  mindBtn.addClass('brain-console__btn');
  mindBtn.disabled = true;

  const logBtn = buttonGroup.createEl('button', { text: 'Wiki Log' });
  logBtn.addClass('brain-console__btn');
  logBtn.disabled = true;
}

function renderCard(parent: HTMLElement, title: string, content: HTMLElement): void {
  const card = parent.createDiv({ cls: 'brain-console__card' });
  const cardHeader = card.createDiv({ cls: 'brain-console__card-header' });
  cardHeader.createEl('h3', { text: title });
  card.appendChild(content);
}

function renderWikiHealthCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const mrReport = (state.runtimeReports ?? []).find((r) => r.id === 'model-router');
  if (!mrReport?.wikiHealth) {
    container.createEl('p', { text: 'Wiki health data unavailable' });
    return container;
  }

  const health = mrReport.wikiHealth;
  const status = health.ok ? '✓ OK' : `⚠ Issues`;

  container.createEl('div', { cls: 'brain-console__metric', text: status });
  if (!health.ok) {
    container.createEl('p', {
      text: `Warnings: ${health.warningCount} · Errors: ${health.errorCount}`,
      cls: 'brain-console__detail',
    });
  }

  return container;
}

function renderMaintenancePreviewsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const previews = state.mindPreviews ?? [];
  const pending = previews.filter((p) => !p.expired);

  if (pending.length === 0) {
    container.createEl('p', { text: 'No maintenance queued' });
    return container;
  }

  container.createEl('div', { cls: 'brain-console__metric', text: `${pending.length} pending` });
  if (pending[0]) {
    container.createEl('p', {
      text: `Latest: ${new Date(pending[0].createdAt).toLocaleDateString()}`,
      cls: 'brain-console__detail',
    });
  }

  return container;
}

function renderApprovalsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const approvals = state.approvals ?? [];
  if (approvals.length === 0) {
    container.createEl('p', { text: 'No approvals pending' });
    return container;
  }

  container.createEl('div', { cls: 'brain-console__metric', text: `${approvals.length} pending` });
  const sample = approvals.slice(0, 2);
  const list = container.createEl('ul', { cls: 'brain-console__list' });
  sample.forEach((a) => {
    list.createEl('li', { text: `${a.kind}: ${a.status}` });
  });

  return container;
}

function renderSchedulerCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  container.createEl('div', { cls: 'brain-console__metric', text: state.schedulerStatus?.status ?? 'unknown' });
  container.createEl('p', {
    text: `Latest: ${state.schedulerStatus?.latestRunStatus ?? 'never'}`,
    cls: 'brain-console__detail',
  });

  const jobs = state.schedulerJobs ?? [];
  if (jobs.length > 0) {
    const jobSummary = jobs.slice(0, 2).map((j) => `${j.id}: ${j.status}`).join(' · ');
    container.createEl('p', { text: jobSummary, cls: 'brain-console__detail' });
  }

  return container;
}

function renderBrainCoreCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const online = state.status?.ok === true ? 'online' : 'offline';
  container.createEl('div', { cls: 'brain-console__metric', text: online });
  container.createEl('p', {
    text: `Host: ${state.status?.host ?? 'localhost'} · v${state.status?.version ?? '?'}`,
    cls: 'brain-console__detail',
  });
  container.createEl('p', {
    text: `Execution: ${state.executionReadiness?.executionEnabled ? 'enabled' : 'disabled'}`,
    cls: 'brain-console__detail',
  });

  return container;
}

function renderNextActionCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const readiness = state.executionReadiness;
  if (!readiness) {
    container.createEl('p', { text: 'Readiness unavailable' });
    return container;
  }

  const nextAction = readiness.blockers.length > 0 ? `Blocked: ${readiness.blockers[0]}` : `Ready: ${readiness.readyCandidateCount}`;
  container.createEl('div', { cls: 'brain-console__metric', text: nextAction });

  if (readiness.readyCandidateCount > 0) {
    container.createEl('p', { text: 'Candidates available for execution', cls: 'brain-console__detail' });
  }

  return container;
}

function renderActivityPanel(container: HTMLElement, state: BrainConsoleViewState): void {
  const panel = container.createDiv({ cls: 'brain-console__activity-panel' });
  panel.createEl('h4', { text: 'Recent Activity' });

  const activity = panel.createEl('ul', { cls: 'brain-console__activity-list' });

  // Sample activity items (in real implementation, would come from Brain Core)
  if (state.sessions && state.sessions.length > 0) {
    activity.createEl('li', { text: `Latest session: ${state.sessions[0]?.title ?? 'unknown'}` });
  }

  if (state.runtimeReports && state.runtimeReports.length > 0) {
    activity.createEl('li', { text: `Runtime reports available: ${state.runtimeReports.length}` });
  }

  const mindPreviews = state.mindPreviews ?? [];
  if (mindPreviews.length > 0) {
    activity.createEl('li', { text: `Maintenance previews: ${mindPreviews.length}` });
  }
}

