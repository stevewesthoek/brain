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
