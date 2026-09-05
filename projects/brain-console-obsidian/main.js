'use strict';

const {
  Plugin,
  ItemView,
  Notice,
  PluginSettingTab,
  Setting,
  requestUrl,
} = require('obsidian');
const core = require('./decision-center-core.cjs');

const {
  VIEW_TYPE,
  DEFAULT_BRAIN_CORE_URL,
  DEFAULT_NOTIFICATION_POLL_MS,
  brainConsoleUrl,
  normalizeBaseUrl,
  normalizeQueue,
  decisionCounts,
  buildDecisionPayload,
  genericNotificationText,
  safeEvidenceRefs,
} = core;

const BRAIN_CONSOLE_WIDGET_CONTRACT = Object.freeze({
  contract: 'brain-console-obsidian-widget-contract-v1',
  version: 1,
  widgetIds: Object.freeze([
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
  ]),
});

const DEFAULT_SETTINGS = Object.freeze({
  brainCoreUrl: DEFAULT_BRAIN_CORE_URL,
  decidedBy: 'obsidian-owner',
  notificationPolling: true,
  notificationPollMs: DEFAULT_NOTIFICATION_POLL_MS,
});

class BrainCoreClient {
  constructor(plugin) {
    this.plugin = plugin;
  }

  baseUrl() {
    return normalizeBaseUrl(this.plugin.settings.brainCoreUrl);
  }

  async request(pathname, options = {}) {
    const response = await requestUrl({
      url: `${this.baseUrl()}${pathname}`,
      method: options.method || 'GET',
      headers: options.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      throw: false,
    });
    if (response.status >= 400) {
      const payload = response.json && typeof response.json === 'object' ? response.json : {};
      const error = new Error(payload.message || payload.code || `Brain Core request failed: HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return response.json;
  }

  async decisions() {
    return this.request('/api/infinite-brain/decisions');
  }

  async decide(item, decision, options = {}) {
    const payload = buildDecisionPayload(item, decision, this.plugin.settings.decidedBy, options);
    return this.request(`/api/infinite-brain/decisions/${encodeURIComponent(item.proposalId)}`, {
      method: 'POST',
      body: payload,
    });
  }

  async pollNotifications() {
    return this.request('/api/infinite-brain/decisions/notifications/poll', {
      method: 'POST',
      body: {},
    });
  }
}

class BrainConsoleView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.queue = null;
    this.loading = false;
  }

  getViewType() {
    return VIEW_TYPE;
  }

  getDisplayText() {
    return 'Brain Console';
  }

  getIcon() {
    return 'brain-circuit';
  }

  async onOpen() {
    await this.refresh();
  }

  async refresh() {
    if (this.loading) return;
    this.loading = true;
    this.renderLoading();
    try {
      this.queue = await this.plugin.client.decisions();
      this.plugin.updatePendingStatus(this.queue);
      this.renderQueue();
    } catch (error) {
      this.renderOffline(error);
    } finally {
      this.loading = false;
    }
  }

  renderShell(title = 'Decision Center') {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass('brain-console-root');
    container.dataset.brainConsoleWidgetContract = BRAIN_CONSOLE_WIDGET_CONTRACT.contract;
    const header = container.createDiv({ cls: 'brain-console-header' });
    const titleWrap = header.createDiv();
    titleWrap.createEl('h2', { text: title });
    titleWrap.createEl('p', {
      text: 'One logical Decision Core. Obsidian is the primary human cockpit; Brain Core remains the headless control boundary.',
      cls: 'brain-console-subtitle',
    });
    const refresh = header.createEl('button', { text: 'Refresh', cls: 'mod-cta' });
    refresh.addEventListener('click', () => void this.refresh());
    const openConsole = header.createEl('button', { text: 'Open Brain Console' });
    openConsole.setAttr('aria-label', 'Open this view in Brain Console');
    openConsole.addEventListener('click', () => window.open(brainConsoleUrl('/command-center'), '_blank'));
    return container;
  }

  renderLoading() {
    const container = this.renderShell();
    container.createDiv({ text: 'Loading Decision Core…', cls: 'brain-console-state' });
  }

  renderOffline(error) {
    const container = this.renderShell();
    const state = container.createDiv({ cls: 'brain-console-state brain-console-offline' });
    state.createEl('strong', { text: 'Brain Core unavailable' });
    state.createEl('p', { text: error instanceof Error ? error.message : 'Unable to load the Decision Core.' });
    state.createEl('p', {
      text: `Configured endpoint: ${normalizeBaseUrl(this.plugin.settings.brainCoreUrl)}`,
      cls: 'brain-console-muted',
    });
  }

  renderQueue() {
    const container = this.renderShell();
    const items = normalizeQueue(this.queue);
    const counts = decisionCounts(this.queue);

    const summary = container.createDiv({ cls: 'brain-console-summary' });
    summary.createDiv({ text: `${counts.pending}`, cls: 'brain-console-count' });
    summary.createDiv({ text: 'pending decisions', cls: 'brain-console-count-label' });
    if (counts.highPriorityPending > 0) {
      summary.createDiv({ text: `${counts.highPriorityPending} high-priority`, cls: 'brain-console-high' });
    }

    if (items.length === 0) {
      container.createDiv({ text: 'No Decision Core items are available.', cls: 'brain-console-state' });
      return;
    }

    const list = container.createDiv({ cls: 'brain-console-list' });
    for (const item of items) this.renderDecision(list, item);
  }

  renderDecision(parent, item) {
    const card = parent.createDiv({ cls: `brain-console-card is-${item.status} priority-${item.priority}` });
    const meta = card.createDiv({ cls: 'brain-console-meta' });
    meta.createSpan({ text: item.priority.toUpperCase(), cls: 'brain-console-priority' });
    meta.createSpan({ text: item.status, cls: 'brain-console-status' });
    meta.createSpan({ text: item.category, cls: 'brain-console-category' });

    card.createEl('h3', { text: item.title });
    if (item.summary) card.createEl('p', { text: item.summary });

    if (item.whyNow) {
      const section = card.createDiv({ cls: 'brain-console-section' });
      section.createEl('strong', { text: 'Why now' });
      section.createEl('p', { text: item.whyNow });
    }
    if (item.recommendedAction) {
      const section = card.createDiv({ cls: 'brain-console-section' });
      section.createEl('strong', { text: 'Recommendation' });
      section.createEl('p', { text: item.recommendedAction });
    }
    if (item.alternatives.length > 0) {
      const section = card.createDiv({ cls: 'brain-console-section' });
      section.createEl('strong', { text: 'Alternatives' });
      const list = section.createEl('ul');
      for (const alternative of item.alternatives) list.createEl('li', { text: alternative });
    }
    if (item.consequenceOfDelay) {
      const section = card.createDiv({ cls: 'brain-console-section' });
      section.createEl('strong', { text: 'If delayed' });
      section.createEl('p', { text: item.consequenceOfDelay });
    }

    const evidence = safeEvidenceRefs(item);
    if (evidence.length > 0) {
      const details = card.createEl('details', { cls: 'brain-console-evidence' });
      details.createEl('summary', { text: `Evidence references (${evidence.length})` });
      const list = details.createEl('ul');
      for (const ref of evidence) list.createEl('li', { text: ref });
    }

    if (item.writesToMindIfApproved) {
      card.createDiv({
        text: 'Mind-targeting proposal: this decision records human approval only. CLR3 does not apply the change.',
        cls: 'brain-console-warning',
      });
    }

    if (!item.pending) {
      if (item.deferUntil) card.createDiv({ text: `Deferred until ${item.deferUntil}`, cls: 'brain-console-muted' });
      return;
    }

    const actions = card.createDiv({ cls: 'brain-console-actions' });
    this.actionButton(actions, 'Approve', item, 'approved', 'Reviewed and approved in Decision Center.');
    this.actionButton(actions, 'Reject', item, 'rejected', 'Reviewed and rejected in Decision Center.');
    this.actionButton(actions, 'Needs review', item, 'needs-review', 'More review is required before a durable decision.');

    const defer = actions.createEl('button', { text: 'Defer 24h' });
    defer.addEventListener('click', () => {
      const deferUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      void this.submitDecision(item, 'deferred', { reason: 'Deferred for 24 hours in Decision Center.', deferUntil });
    });
  }

  actionButton(parent, label, item, decision, reason) {
    const button = parent.createEl('button', { text: label });
    button.addEventListener('click', () => void this.submitDecision(item, decision, { reason }));
  }

  async submitDecision(item, decision, options) {
    try {
      const response = await this.plugin.client.decide(item, decision, options);
      if (response?.code === 'decision_idempotent') new Notice('Decision already recorded; no duplicate was created.');
      else new Notice('Decision recorded. Execution remains blocked.');
      this.queue = response?.queue || await this.plugin.client.decisions();
      this.plugin.updatePendingStatus(this.queue);
      this.renderQueue();
    } catch (error) {
      if (error?.status === 409 || error?.payload?.code === 'stale_proposal_hash') {
        new Notice('Decision was not recorded: the proposal changed. Refresh and review the current version.');
        await this.refresh();
        return;
      }
      new Notice(`Decision Center action failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

class BrainConsoleSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Brain Console' });
    containerEl.createEl('p', {
      text: 'Configuration only. Do not store secrets here; Brain Core remains the policy and execution boundary.',
    });

    new Setting(containerEl)
      .setName('Brain Core URL')
      .setDesc('Source-neutral Brain Core endpoint for this installation.')
      .addText((text) => text
        .setPlaceholder(DEFAULT_BRAIN_CORE_URL)
        .setValue(this.plugin.settings.brainCoreUrl)
        .onChange(async (value) => {
          this.plugin.settings.brainCoreUrl = normalizeBaseUrl(value);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Decision identity')
      .setDesc('Local audit label written into Decision Core records. Do not put credentials here.')
      .addText((text) => text
        .setValue(this.plugin.settings.decidedBy)
        .onChange(async (value) => {
          this.plugin.settings.decidedBy = String(value || 'obsidian-owner').slice(0, 120);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Decision notifications')
      .setDesc('Poll only aggregate Decision Center attention state every five minutes. Context refresh remains manual.')
      .addToggle((toggle) => toggle
        .setValue(this.plugin.settings.notificationPolling)
        .onChange(async (value) => {
          this.plugin.settings.notificationPolling = value;
          await this.plugin.saveSettings();
          new Notice('Reload Obsidian to apply notification polling changes.');
        }));
  }
}

module.exports = class BrainConsolePlugin extends Plugin {
  async onload() {
    await this.loadSettings();
    this.client = new BrainCoreClient(this);
    this.statusBar = this.addStatusBarItem();
    this.statusBar.setText('Decision Center: …');

    this.registerView(VIEW_TYPE, (leaf) => new BrainConsoleView(leaf, this));
    this.addRibbonIcon('brain-circuit', 'Open Brain Console', () => void this.activateView());
    this.addCommand({
      id: 'open-brain-console',
      name: 'Open Brain Console',
      callback: () => void this.activateView(),
    });
    this.addCommand({
      id: 'open-brain-command-center',
      name: 'Open Brain Command Center',
      callback: () => window.open(brainConsoleUrl('/command-center'), '_blank'),
    });
    this.addCommand({
      id: 'open-brain-operations',
      name: 'Open Brain Operations',
      callback: () => window.open(brainConsoleUrl('/operations'), '_blank'),
    });
    this.addCommand({
      id: 'open-brain-computer',
      name: 'Open Brain Computer',
      callback: () => window.open(brainConsoleUrl('/computer'), '_blank'),
    });
    this.addCommand({
      id: 'open-brain-task-0c-c',
      name: 'Open Brain Task 0C-C',
      callback: () => window.open(brainConsoleUrl('/brain/tasks/0C-C'), '_blank'),
    });
    this.addSettingTab(new BrainConsoleSettingTab(this.app, this));

    if (this.settings.notificationPolling) {
      void this.pollNotifications();
      const interval = Math.max(DEFAULT_NOTIFICATION_POLL_MS, Number(this.settings.notificationPollMs) || DEFAULT_NOTIFICATION_POLL_MS);
      this.registerInterval(globalThis.setInterval(() => void this.pollNotifications(), interval));
    }
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  async loadSettings() {
    const stored = await this.loadData();
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(stored && typeof stored === 'object' ? stored : {}),
    };
    this.settings.brainCoreUrl = normalizeBaseUrl(this.settings.brainCoreUrl);
    this.settings.notificationPollMs = DEFAULT_NOTIFICATION_POLL_MS;
  }

  async saveSettings() {
    await this.saveData({
      brainCoreUrl: normalizeBaseUrl(this.settings.brainCoreUrl),
      decidedBy: String(this.settings.decidedBy || 'obsidian-owner').slice(0, 120),
      notificationPolling: this.settings.notificationPolling === true,
      notificationPollMs: DEFAULT_NOTIFICATION_POLL_MS,
    });
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];
    const leaf = existing || this.app.workspace.getRightLeaf(false);
    if (!leaf) {
      new Notice('Unable to open Brain Console view.');
      return;
    }
    if (!existing) await leaf.setViewState({ type: VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }

  updatePendingStatus(queue) {
    const counts = decisionCounts(queue);
    this.statusBar.setText(`Decision Center: ${counts.pending} pending`);
    this.statusBar.setAttr('aria-label', `${counts.pending} pending Decision Center items`);
  }

  async pollNotifications() {
    try {
      const response = await this.client.pollNotifications();
      if (Number.isInteger(response?.pendingCount)) {
        this.statusBar.setText(`Decision Center: ${response.pendingCount} pending`);
      }
      for (const notification of response?.notifications || []) {
        new Notice(genericNotificationText(notification), 8000);
      }
    } catch {
      this.statusBar.setText('Decision Center: offline');
    }
  }
};
