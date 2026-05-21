import { ItemView, Notice, Plugin, PluginSettingTab, Setting, requestUrl, type WorkspaceLeaf } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import { loadBrainConsoleViewState, renderBrainConsoleView, type BrainConsoleSectionId, type BrainConsoleViewState } from './view.js';
import { setRequestUrl } from './client.js';

const VIEW_TYPE = 'brain-console-view';
export const BRAIN_CONSOLE_BUILD_ID = 'v2.10';

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

  private async reopenConsoleFresh(): Promise<void> {
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
  private heartbeatInterval: number | null = null;

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

    state.createDiv({ cls: 'brain-console__status-line', text: 'Manual refresh + Brain Core allowlisted local app actions · plugin never executes shell' });
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
    if (this.heartbeatInterval !== null) return;
    this.heartbeatInterval = this.registerInterval(
      window.setInterval(async () => {
        if (this.isRefreshing) return;
        await this.fullRefresh();
      }, 3000),
    );
  }

  /** Full refresh: reload all Brain Core data and re-render */
  private async fullRefresh(): Promise<void> {
    const settings = await this.plugin.getSettings();
    this.cachedState = await loadBrainConsoleViewState(settings);
    this.rerenderWithCachedState();
  }

  /** Re-render using cached state (instant tab switch) */
  private rerenderWithCachedState(): void {
    if (!this.cachedState) return;
    const settings = this.plugin.settings;
    this.cachedState.activeSection = this.activeSection;
    renderBrainConsoleView(this.contentEl, this.cachedState, settings, () => {
      void this.fullRefresh();
    });
  }

  async refresh(): Promise<void> {
    try {
      await this.fullRefresh();
    } catch (error) {
      this.renderOpenFallback(error);
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
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

function sanitizeSettings(data: unknown): BrainConsoleSettings {
  const maybeData = data as Partial<BrainConsoleSettings> | undefined;
  const normalized = normalizeBrainCoreUrl(maybeData?.brainCoreUrl ?? DEFAULT_BRAIN_CONSOLE_SETTINGS.brainCoreUrl);
  return { brainCoreUrl: normalized.value };
}
