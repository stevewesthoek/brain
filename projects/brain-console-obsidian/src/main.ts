import { ItemView, Notice, Plugin, PluginSettingTab, Setting, requestUrl, type WorkspaceLeaf } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import { loadBrainConsoleViewState, renderBrainConsoleView, type BrainConsoleSectionId, type BrainConsoleViewState } from './view.js';
import { requestBrainCoreRestart, setRequestUrl, waitForBrainCoreStatus } from './client.js';

const VIEW_TYPE = 'brain-console-view';
export const BRAIN_CONSOLE_BUILD_ID = 'v2.20-aws-video-operational-jobs';

declare global {
  interface Window {
    BRAIN_CONSOLE_BUILD_ID: string;
  }
}

export default class BrainConsolePlugin extends Plugin {
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS;

  async onload(): Promise<void> {
    setRequestUrl(requestUrl);
    (window as any).BRAIN_CONSOLE_BUILD_ID = BRAIN_CONSOLE_BUILD_ID;
    this.settings = sanitizeSettings(await this.loadData());

    this.addRibbonIcon('brain-circuit', 'Open Brain Console', () => {
      void this.reopenConsoleFresh();
    });

    this.addCommand({
      id: 'open-brain-console-main',
      name: 'Open Brain Console dashboard',
      callback: () => {
        void this.openConsole();
      },
    });

    this.addCommand({
      id: 'reopen-brain-console-dashboard',
      name: 'Reopen Brain Console dashboard',
      callback: () => {
        void this.reopenConsoleFresh();
      },
    });

    this.addSettingTab(new BrainConsoleSettingTab(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new BrainConsoleView(leaf, this));
  }

  async getSettings(): Promise<BrainConsoleSettings> {
    return this.settings;
  }

  async updateSettings(next: BrainConsoleSettings): Promise<void> {
    this.settings = next;
    await this.saveData(next);
  }

  private async openConsole(): Promise<void> {
    try {
      let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE)[0];

      if (!leaf) {
        // Avoid the right sidebar here: the dashboard should live in the main editor workspace.
        leaf = this.app.workspace.getLeaf(false);
        await leaf.setViewState({ type: VIEW_TYPE, active: true });
      }

      await this.app.workspace.revealLeaf(leaf);

      const view = leaf.view instanceof BrainConsoleView ? leaf.view : this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
      if (view instanceof BrainConsoleView) {
        await view.refresh();
      }
    } catch (error) {
      console.error('Brain Console failed to open', error);
      new Notice(`Brain Console failed to open: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async reopenConsoleFresh(): Promise<void> {
    try {
      const leaves = [...this.app.workspace.getLeavesOfType(VIEW_TYPE)];
      for (const leaf of leaves) {
        await leaf.detach();
      }

      // Reopen in the main workspace, never the right sidebar. If Obsidian returns a split leaf,
      // this is still the least invasive main-workspace path available in this API surface.
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      await this.app.workspace.revealLeaf(leaf);

      const view = leaf.view instanceof BrainConsoleView ? leaf.view : this.app.workspace.getLeavesOfType(VIEW_TYPE)[0]?.view;
      if (view instanceof BrainConsoleView) {
        await view.refresh();
      }
    } catch (error) {
      console.error('Brain Console failed to reopen fresh', error);
      new Notice(`Brain Console failed to reopen fresh: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const REPO_ROOT = '/Users/Office/Repos/stevewesthoek/brain';
const BRAIN_CORE_RESTART_HELPER = '/Users/Office/Repos/stevewesthoek/brain/projects/brain-core/scripts/dev/restart-brain-core.mjs';

class BrainConsoleSettingTab extends PluginSettingTab {
  constructor(app: Plugin['app'], private readonly plugin: BrainConsolePlugin) {
    super(app, plugin);
  }

  display(): void {
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Brain Console' });

    new Setting(this.containerEl)
      .setName('Brain Core URL')
      .setDesc('Read-only Brain Core endpoint. Default: http://localhost:4877. If offline, try http://127.0.0.1:4877')
      .addText((text) => {
        text.setValue(this.plugin.settings.brainCoreUrl);
        text.onChange(async (value) => {
          const normalized = normalizeBrainCoreUrl(value);
          if (normalized.error) {
            new Notice(normalized.error);
            return;
          }
          if (normalized.warning) {
            new Notice(normalized.warning);
          }
          await this.plugin.updateSettings({ brainCoreUrl: normalized.value });
        });
      });
  }
}

class BrainConsoleView extends ItemView {
  private readonly plugin: BrainConsolePlugin;
  private activeSection: BrainConsoleSectionId = 'overview';
  private cachedState: BrainConsoleViewState | null = null;
  private isRefreshing = false;

  constructor(leaf: WorkspaceLeaf, plugin: BrainConsolePlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Brain Console';
  }

  async onOpen(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass('brain-console');

    const state = this.contentEl.createDiv({ cls: 'brain-console__state' });
    const header = state.createDiv({ cls: 'brain-console__header' });
    header.createEl('h2', { text: 'Brain Console' });
    header.createEl('span', { cls: 'brain-console__build-marker', text: `build ${BRAIN_CONSOLE_BUILD_ID}` });

    state.createDiv({ cls: 'brain-console__status-line', text: 'Manual refresh + Brain Core restart verification + allowlisted local app actions · plugin never executes shell' });
    state.createDiv({ cls: 'brain-console__install-check', text: 'If build marker above is not visible, the installed plugin bundle may be stale.' });

    const actions = state.createDiv({ cls: 'brain-console__actions' });
    const refreshButton = actions.createEl('button', { text: 'Manual refresh', cls: 'brain-console__refresh-btn' });
    refreshButton.setAttribute('type', 'button');
    const refreshTimestamp = actions.createEl('span', { cls: 'brain-console__refresh-time', text: 'Never' });

    refreshButton.addEventListener('click', async () => {
      if (this.isRefreshing) return;
      this.isRefreshing = true;
      refreshButton.disabled = true;
      refreshButton.setAttribute('aria-busy', 'true');
      refreshButton.textContent = 'Refreshing...';
      try {
        await this.fullRefresh();
        const now = new Date();
        refreshTimestamp.textContent = `Last: ${now.toLocaleTimeString()}`;
      } finally {
        this.isRefreshing = false;
        refreshButton.disabled = false;
        refreshButton.removeAttribute('aria-busy');
        refreshButton.textContent = 'Manual refresh';
      }
    });

    // Attach tab click handler to container - instant switch without reload
    this.registerDomEvent(this.contentEl, 'click', (e: Event) => {
      const target = e.target as HTMLElement;
      const tab = target.closest('[data-section-id]') as HTMLElement | null;
      if (tab) {
        const sectionId = tab.getAttribute('data-section-id') as BrainConsoleSectionId | null;
        if (sectionId && sectionId !== this.activeSection) {
          this.activeSection = sectionId;
          this.rerenderWithCachedState();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    this.startHeartbeat();
    try {
      await this.fullRefresh();
    } catch (error) {
      this.renderOpenFallback(error);
    }
  }

  private startHeartbeat(): void {
    // Disabled for now: the auto-refresh loop was causing repeated transient reconnect churn.
    // Manual refresh still reloads the full snapshot and restart button still reopens after verification.
  }

  /** Full refresh: reload all Brain Core data and re-render */
  private async fullRefresh(): Promise<void> {
    const settings = await this.plugin.getSettings();
    try {
      this.cachedState = await loadBrainConsoleViewState(settings);
      this.rerenderWithCachedState();
    } catch (error) {
      console.error('Brain Console refresh failed', error);
      if (!this.cachedState) {
        throw error;
      }
      // Preserve the last known good dashboard instead of flipping to offline on transient failures.
    }
  }

  /** Re-render using cached state (instant tab switch) */
  private rerenderWithCachedState(): void {
    if (!this.cachedState) return;
    const settings = this.plugin.settings;
    this.cachedState.activeSection = this.activeSection;
    // Save scroll position before re-render to prevent jumping to top
    const scrollArea = this.contentEl.querySelector('.brain-console__scroll-area') as HTMLElement | null;
    const savedScrollTop = scrollArea?.scrollTop ?? 0;
    renderBrainConsoleView(
      this.contentEl,
      this.cachedState,
      settings,
      () => {
        void this.fullRefresh();
      },
      () => this.restartBrainCore(),
    );
    // Restore scroll position after re-render
    if (savedScrollTop > 0) {
      const newScrollArea = this.contentEl.querySelector('.brain-console__scroll-area') as HTMLElement | null;
      if (newScrollArea) newScrollArea.scrollTop = savedScrollTop;
    }
  }

  async refresh(): Promise<void> {
    try {
      await this.fullRefresh();
    } catch (error) {
      this.renderOpenFallback(error);
    }
  }

  private async restartBrainCore(): Promise<void> {
    if (this.isRefreshing) return;

    this.isRefreshing = true;
    try {
      const settings = await this.plugin.getSettings();
      const normalizedBaseUrl = normalizeBrainCoreUrl(settings.brainCoreUrl).value;
      new Notice('Brain Core restart requested. Waiting for stop, port-free, and restart verification...');

      const request = await requestBrainCoreRestart(normalizedBaseUrl);
      if (request.error || !request.value) {
        const fallback = await this.restartBrainCoreLocally(normalizedBaseUrl, request.detail ?? request.error);
        if (!fallback.ok) {
          new Notice(`Brain Core restart failed: ${fallback.error}`);
          return;
        }
        await this.plugin.reopenConsoleFresh();
        await this.fullRefresh();
        new Notice('Brain Core restart verified: service is back online.');
        return;
      }

      if (!request.value.accepted) {
        new Notice(`Brain Core restart was not accepted: ${request.value.message}`);
        return;
      }

      const verified = await waitForBrainCoreStatus(normalizedBaseUrl);
      if (verified.error || !verified.value?.ok) {
        const message = verified.error ?? verified.detail ?? 'Brain Core did not return an ok status.';
        new Notice(`Brain Core restart did not verify: ${message}`);
        return;
      }

      new Notice('Brain Core restart verified: service is back online.');
      await this.recoverConsoleAfterRestart(normalizedBaseUrl);
    } catch (error) {
      console.error('Brain Core restart failed', error);
      new Notice(`Brain Core restart failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.isRefreshing = false;
    }
  }

  private async recoverConsoleAfterRestart(baseUrl: string): Promise<void> {
    const recoveryAttempts = 3;
    for (let attempt = 1; attempt <= recoveryAttempts; attempt += 1) {
      await this.plugin.reopenConsoleFresh();
      try {
        await this.fullRefresh();
        const currentStatus = await waitForBrainCoreStatus(baseUrl, 15_000, 1_000);
        if (!currentStatus.error && currentStatus.value?.ok) {
          return;
        }
      } catch (error) {
        console.error(`Brain Console recovery refresh attempt ${attempt} failed`, error);
      }
    }

    throw new Error('Brain Console did not recover after verified Brain Core restart.');
  }

  private async restartBrainCoreLocally(baseUrl: string, reason?: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const requireFn = (globalThis as { require?: (id: string) => unknown }).require ?? ((0, eval)('require') as (id: string) => unknown);
      const { execFile } = requireFn('child_process') as { execFile: (...args: any[]) => any };
      const { promisify } = requireFn('util') as { promisify: (...args: any[]) => any };
      const execFileAsync = promisify(execFile);
      const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
      const result = await execFileAsync('/opt/homebrew/bin/node', [BRAIN_CORE_RESTART_HELPER, 'restart'], {
        cwd: REPO_ROOT,
        env: {
          ...processEnv,
          BRAIN_CORE_HOST: normalizeBrainCoreUrl(baseUrl).value.replace(/^https?:\/\//, '').split(':')[0] ?? '127.0.0.1',
          BRAIN_CORE_PORT: '4877',
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 180_000,
      });
      console.log('Brain Core local restart output', result.stdout);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Brain Core local restart failed', reason, error);
      return { ok: false, error: message };
    }
  }

  private renderOpenFallback(error: unknown): void {
    this.contentEl.empty();
    this.contentEl.addClass('brain-console');
    const state = this.contentEl.createDiv({ cls: 'brain-console__state brain-console__state--fallback' });
    const header = state.createDiv({ cls: 'brain-console__header' });
    header.createEl('h2', { text: 'Brain Console' });
    header.createEl('span', { cls: 'brain-console__build-marker', text: `build ${BRAIN_CONSOLE_BUILD_ID}` });
    state.createDiv({ cls: 'brain-console__status-line', text: 'The Brain Console view opened, but the first data refresh failed.' });
    state.createDiv({ cls: 'brain-console__install-check', text: error instanceof Error ? error.message : String(error) });
    state.createDiv({ cls: 'brain-console__status-line', text: `Brain Core URL: ${this.plugin.settings.brainCoreUrl}` });
    const actions = state.createDiv({ cls: 'brain-console__actions' });
    const retry = actions.createEl('button', { text: 'Retry refresh', cls: 'brain-console__refresh-btn' });
    retry.setAttribute('type', 'button');
    retry.addEventListener('click', () => {
      void this.refresh();
    });
  }

  async onClose(): Promise<void> {
  }
}

function sanitizeSettings(data: unknown): BrainConsoleSettings {
  const maybeData = data as Partial<BrainConsoleSettings> | undefined;
  const normalized = normalizeBrainCoreUrl(maybeData?.brainCoreUrl ?? DEFAULT_BRAIN_CONSOLE_SETTINGS.brainCoreUrl);
  return { brainCoreUrl: normalized.value };
}
