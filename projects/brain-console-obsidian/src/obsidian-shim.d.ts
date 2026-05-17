declare module 'obsidian' {
  export class App {
    vault: unknown;
    workspace: {
      getLeavesOfType(viewType: string): WorkspaceLeaf[];
      getRightLeaf(open: boolean): WorkspaceLeaf;
      getActiveViewOfType<T>(viewType: string): T | null;
    };
  }

  export class Plugin {
    app: App;
    manifest: { id: string };
    loadData(): Promise<unknown>;
    saveData(data: unknown): Promise<void>;
    addRibbonIcon(icon: string, title: string, callback: () => void): { remove(): void };
    addCommand(command: { id: string; name: string; callback: () => void }): void;
    addSettingTab(tab: PluginSettingTab): void;
    registerView(type: string, creator: (leaf: WorkspaceLeaf) => ItemView): void;
    unload(): Promise<void> | void;
  }

  export class PluginSettingTab {
    containerEl: HTMLElement;
    constructor(app: App, plugin: Plugin);
    display(): void;
  }

  export class Setting {
    constructor(containerEl: HTMLElement);
    setName(name: string): this;
    setDesc(desc: string): this;
    addText(onChange: (text: { setValue(value: string): void; onChange(callback: (value: string) => void): void }) => void): this;
    addButton(onChange: (button: { setButtonText(text: string): void; onClick(callback: () => void): void }) => void): this;
  }

  export class Notice {
    constructor(message: string);
  }

  export class WorkspaceLeaf {
    setViewState(state: { type: string; active?: boolean }): Promise<void>;
  }

  export abstract class ItemView {
    containerEl: HTMLElement;
    contentEl: HTMLElement;
    constructor(leaf: WorkspaceLeaf);
    getViewType(): string;
    getDisplayText(): string;
    onOpen(): Promise<void> | void;
    onClose(): Promise<void> | void;
  }
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
