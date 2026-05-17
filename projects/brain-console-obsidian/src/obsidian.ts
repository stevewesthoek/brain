export class App {
  vault!: unknown;
  workspace!: {
    getLeavesOfType(viewType: string): WorkspaceLeaf[];
    getRightLeaf(open: boolean): WorkspaceLeaf;
    getActiveViewOfType<T>(viewType: string): T | null;
  };
}

export class Plugin {
  app!: App;
  manifest!: { id: string };
  loadData(): Promise<unknown> {
    return Promise.resolve(undefined);
  }
  saveData(_data: unknown): Promise<void> {
    return Promise.resolve();
  }
  addRibbonIcon(_icon: string, _title: string, _callback: () => void): { remove(): void } {
    return { remove() {} };
  }
  addCommand(_command: { id: string; name: string; callback: () => void }): void {}
  addSettingTab(_tab: PluginSettingTab): void {}
  registerView(_type: string, _creator: (leaf: WorkspaceLeaf) => ItemView): void {}
  unload(): Promise<void> | void {}
}

export class PluginSettingTab {
  containerEl!: HTMLElement;
  constructor(_app: App, _plugin: Plugin) {}
  display(): void {}
}

export class Setting {
  constructor(_containerEl: HTMLElement) {}
  setName(_name: string): this {
    return this;
  }
  setDesc(_desc: string): this {
    return this;
  }
  addText(_onChange: (text: { setValue(value: string): void; onChange(callback: (value: string) => void): void }) => void): this {
    return this;
  }
  addButton(_onChange: (button: { setButtonText(text: string): void; onClick(callback: () => void): void }) => void): this {
    return this;
  }
}

export class Notice {
  constructor(_message: string) {}
}

export class WorkspaceLeaf {
  setViewState(_state: { type: string; active?: boolean }): Promise<void> {
    return Promise.resolve();
  }
}

export abstract class ItemView {
  containerEl!: HTMLElement;
  contentEl!: HTMLElement;
  constructor(_leaf: WorkspaceLeaf) {}
  abstract getViewType(): string;
  abstract getDisplayText(): string;
  onOpen(): Promise<void> | void {}
  onClose(): Promise<void> | void {}
}

declare global {
  interface HTMLElement {
    empty(): void;
    addClass(className: string): void;
    createEl<K extends keyof HTMLElementTagNameMap>(tag: K, options?: { text?: string; cls?: string }): HTMLElementTagNameMap[K];
    createDiv(options?: { cls?: string; text?: string }): HTMLDivElement;
    setText(text: string): void;
  }
}

export {};
