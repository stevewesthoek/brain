const BASE_URL = 'http://localhost:4877';

interface GeneratorResult {
  ok?: boolean;
  error?: string;
  approval?: { id: string; status: string };
  preview?: {
    metadata?: {
      youtubeTitle?: string;
      youtubeDescription?: string;
      youtubeTags?: string[];
      tiktokCaption?: string;
      instagramCaption?: string;
      hashtags?: string[];
      source?: string;
    };
  };
}

export class MetadataGeneratorPanel {
  private container: HTMLElement;
  private projectId: string;
  private contentItemId = '';
  private templateId = '';
  private lastResult: GeneratorResult | null = null;
  private isSubmitting = false;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-metadata-generator">
        <div class="vo-panel-header">
          <h3>Metadata Generator</h3>
        </div>
        <div class="vo-metadata-generator__form">
          <label class="vo-form-group">
            <span class="vo-form-label">Content Item ID</span>
            <input id="vo-meta-content-item" class="vo-form-input" type="text" value="${this.escapeHtml(this.contentItemId)}" placeholder="content-..." ${this.isSubmitting ? 'disabled' : ''} />
          </label>
          <label class="vo-form-group">
            <span class="vo-form-label">Template ID</span>
            <input id="vo-meta-template-id" class="vo-form-input" type="text" value="${this.escapeHtml(this.templateId)}" placeholder="optional" ${this.isSubmitting ? 'disabled' : ''} />
          </label>
          <div class="vo-form-actions">
            <button class="vo-button vo-button-primary" id="vo-meta-generate" ${this.isSubmitting ? 'disabled' : ''}>${this.isSubmitting ? 'Generating...' : 'Generate Metadata'}</button>
          </div>
        </div>
        ${this.renderResult()}
      </div>
    `;

    this.container.querySelector('#vo-meta-generate')?.addEventListener('click', () => {
      void this.handleGenerate();
    });

    this.container.querySelector('#vo-meta-content-item')?.addEventListener('input', (event) => {
      this.contentItemId = (event.target as HTMLInputElement).value;
    });
    this.container.querySelector('#vo-meta-template-id')?.addEventListener('input', (event) => {
      this.templateId = (event.target as HTMLInputElement).value;
    });
  }

  private renderResult(): string {
    if (!this.lastResult) return '';
    if (!this.lastResult.ok) {
      return `<div class="vo-form-error">${this.escapeHtml(this.lastResult.error ?? 'Metadata generation failed')}</div>`;
    }

    const meta = this.lastResult.preview?.metadata;
    if (!meta) return '';

    return `
      <div class="vo-metadata-generator__preview">
        <div class="vo-metadata-generator__section-title">Preview</div>
        <div><strong>Title:</strong> ${this.escapeHtml(meta.youtubeTitle ?? '')}</div>
        <div><strong>Description:</strong> ${this.escapeHtml(meta.youtubeDescription ?? '')}</div>
        <div><strong>Tags:</strong> ${this.escapeHtml((meta.youtubeTags ?? []).join(', '))}</div>
        <div><strong>Captions:</strong></div>
        <div class="vo-metadata-generator__mono">${this.escapeHtml(meta.tiktokCaption ?? '')}</div>
        <div class="vo-metadata-generator__mono">${this.escapeHtml(meta.instagramCaption ?? '')}</div>
        <div><strong>Hashtags:</strong> ${this.escapeHtml((meta.hashtags ?? []).join(' '))}</div>
        <div><strong>Source:</strong> ${this.escapeHtml(meta.source ?? 'fallback')}</div>
      </div>
    `;
  }

  private async handleGenerate(): Promise<void> {
    const contentItemInput = this.container.querySelector('#vo-meta-content-item') as HTMLInputElement | null;
    const templateInput = this.container.querySelector('#vo-meta-template-id') as HTMLInputElement | null;
    this.contentItemId = contentItemInput?.value ?? this.contentItemId;
    this.templateId = templateInput?.value ?? this.templateId;

    if (!this.projectId || !this.contentItemId.trim()) {
      this.lastResult = { ok: false, error: 'projectId and contentItemId are required' };
      this.render();
      return;
    }

    this.isSubmitting = true;
    this.render();

    try {
      const res = await fetch(`${BASE_URL}/api/video-orchestrator/metadata/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: this.projectId,
          contentItemId: this.contentItemId,
          templateId: this.templateId || undefined,
        }),
      });
      this.lastResult = await res.json() as GeneratorResult;
    } catch (error) {
      this.lastResult = { ok: false, error: error instanceof Error ? error.message : 'Request failed' };
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
