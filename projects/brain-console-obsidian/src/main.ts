import { ItemView, Notice, Plugin, PluginSettingTab, Setting, type WorkspaceLeaf } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import { loadBrainConsoleViewState, renderBrainConsoleView } from './view.js';

const VIEW_TYPE = 'brain-console-view';

export default class BrainConsolePlugin extends Plugin {
  private settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS;

  async onload(): Promise<void> {
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
      .setDesc('Read-only Brain Core endpoint. Defaults to localhost.')
      .addText((text) => {
        text.setValue(DEFAULT_BRAIN_CONSOLE_SETTINGS.brainCoreUrl);
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

    await this.refresh();
  }

  async refresh(): Promise<void> {
    const settings = await this.plugin.getSettings();
    const current = await loadBrainConsoleViewState(settings);
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
