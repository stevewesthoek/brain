import { ItemView, Notice, Plugin, PluginSettingTab, Setting, requestUrl, type WorkspaceLeaf } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import { loadBrainConsoleViewState, renderBrainConsoleView, type BrainConsoleSectionId } from './view.js';
import { setRequestUrl } from './client.js';

const VIEW_TYPE = 'brain-console-view';

export default class BrainConsolePlugin extends Plugin {
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS;

  async onload(): Promise<void> {
    setRequestUrl(requestUrl);
    this.settings = sanitizeSettings(await this.loadData());

    this.addRibbonIcon('brain-circuit', 'Open Brain Console', () => {
      void this.openConsole();
    });

    this.addCommand({
      id: 'open-brain-console',
      name: 'Open Brain Console',
      callback: () => {
        void this.openConsole();
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
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
    const view = this.app.workspace.getActiveViewOfType(BrainConsoleView);
    if (view) {
      await view.refresh();
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
    state.createEl('h2', { text: 'Brain Console' });
    state.createDiv({ cls: 'brain-console__status-line', text: 'Manual refresh only · read-only · no POST calls' });

    const actions = state.createDiv({ cls: 'brain-console__actions' });
    const refreshButton = actions.createEl('button', { text: 'Manual refresh' });
    refreshButton.addEventListener('click', () => {
      void this.refresh();
    });

    // Attach tab click handler to container
    this.registerDomEvent(this.contentEl, 'click', (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('brain-console__section-tab')) {
        const sectionId = target.getAttribute('data-section-id') as BrainConsoleSectionId | null;
        if (sectionId) {
          this.activeSection = sectionId;
          void this.refresh();
        }
      }
    });

    await this.refresh();
  }

  async refresh(): Promise<void> {
    const settings = await this.plugin.getSettings();
    const current = await loadBrainConsoleViewState(settings);
    current.activeSection = this.activeSection;
    renderBrainConsoleView(this.contentEl, current, settings, () => {
      void this.refresh();
    });
  }
}

function sanitizeSettings(data: unknown): BrainConsoleSettings {
  const maybeData = data as Partial<BrainConsoleSettings> | undefined;
  const normalized = normalizeBrainCoreUrl(maybeData?.brainCoreUrl ?? DEFAULT_BRAIN_CONSOLE_SETTINGS.brainCoreUrl);
  return { brainCoreUrl: normalized.value };
}
