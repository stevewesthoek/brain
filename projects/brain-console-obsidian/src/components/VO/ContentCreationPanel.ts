import { getVOContextManager } from './VOContext.js';
import type { BrainCoreVOStudioContentItem } from '../../client.js';

interface CreationFormState {
  title: string;
  description: string;
  sourceAudioPath: string;
  backgroundImagePath: string;
  submitting: boolean;
  error: string | null;
  success: boolean;
}

export class ContentCreationPanel {
  private container: HTMLElement;
  private ctx = getVOContextManager();
  private formState: CreationFormState = {
    title: '',
    description: '',
    sourceAudioPath: '',
    backgroundImagePath: '',
    submitting: false,
    error: null,
    success: false,
  };

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-content-creation">
        <div class="vo-creation-header">
          <h2>Create New Content Item</h2>
          <p>Create a new video content item to add to your project.</p>
        </div>

        <div class="vo-creation-form">
          <div class="vo-form-group">
            <label class="vo-form-label" for="title">Title *</label>
            <input
              class="vo-form-input"
              type="text"
              id="title"
              name="title"
              placeholder="Episode title"
              value="${this.escapeHtml(this.formState.title)}"
              ${this.formState.submitting ? 'disabled' : ''}
            />
          </div>

          <div class="vo-form-group">
            <label class="vo-form-label" for="description">Description</label>
            <textarea
              class="vo-form-textarea"
              id="description"
              name="description"
              placeholder="Optional description"
              rows="3"
              ${this.formState.submitting ? 'disabled' : ''}
            >${this.escapeHtml(this.formState.description)}</textarea>
          </div>

          <div class="vo-form-group">
            <label class="vo-form-label" for="sourceAudioPath">Source Audio Path *</label>
            <input
              class="vo-form-input"
              type="text"
              id="sourceAudioPath"
              name="sourceAudioPath"
              placeholder="/path/to/audio.mp3"
              value="${this.escapeHtml(this.formState.sourceAudioPath)}"
              ${this.formState.submitting ? 'disabled' : ''}
            />
            <span class="vo-form-hint">Path to source audio file</span>
          </div>

          <div class="vo-form-group">
            <label class="vo-form-label" for="backgroundImagePath">Background Image Path *</label>
            <input
              class="vo-form-input"
              type="text"
              id="backgroundImagePath"
              name="backgroundImagePath"
              placeholder="/path/to/background.png"
              value="${this.escapeHtml(this.formState.backgroundImagePath)}"
              ${this.formState.submitting ? 'disabled' : ''}
            />
            <span class="vo-form-hint">Path to background image file</span>
          </div>

          ${this.formState.error ? `
            <div class="vo-form-error">
              <span class="vo-error-icon">⚠</span>
              <span class="vo-error-message">${this.escapeHtml(this.formState.error)}</span>
            </div>
          ` : ''}

          ${this.formState.success ? `
            <div class="vo-form-success">
              <span class="vo-success-icon">✓</span>
              <span class="vo-success-message">Content item created and awaiting approval</span>
            </div>
          ` : ''}

          <div class="vo-form-actions">
            <button
              class="vo-button vo-button-primary"
              id="createBtn"
              ${this.formState.submitting ? 'disabled' : ''}
            >
              ${this.formState.submitting ? 'Creating...' : 'Create Content Item'}
            </button>
            <button
              class="vo-button vo-button-secondary"
              id="resetBtn"
              ${this.formState.submitting ? 'disabled' : ''}
            >
              Reset
            </button>
          </div>
        </div>

        ${this.formState.success ? `
          <div class="vo-creation-next-steps">
            <h3>Next Steps</h3>
            <ol>
              <li>Check the Overview tab to see your approval request</li>
              <li>Once approved, your content item will be ready for processing</li>
              <li>You can then generate thumbnails, metadata, and queue for publishing</li>
            </ol>
          </div>
        ` : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const titleInput = this.container.querySelector('#title') as HTMLInputElement;
    const descriptionInput = this.container.querySelector('#description') as HTMLTextAreaElement;
    const sourceAudioInput = this.container.querySelector('#sourceAudioPath') as HTMLInputElement;
    const backgroundImageInput = this.container.querySelector('#backgroundImagePath') as HTMLInputElement;
    const createBtn = this.container.querySelector('#createBtn') as HTMLButtonElement;
    const resetBtn = this.container.querySelector('#resetBtn') as HTMLButtonElement;

    if (titleInput) {
      titleInput.addEventListener('change', (e) => {
        this.formState.title = (e.target as HTMLInputElement).value;
      });
    }

    if (descriptionInput) {
      descriptionInput.addEventListener('change', (e) => {
        this.formState.description = (e.target as HTMLTextAreaElement).value;
      });
    }

    if (sourceAudioInput) {
      sourceAudioInput.addEventListener('change', (e) => {
        this.formState.sourceAudioPath = (e.target as HTMLInputElement).value;
      });
    }

    if (backgroundImageInput) {
      backgroundImageInput.addEventListener('change', (e) => {
        this.formState.backgroundImagePath = (e.target as HTMLInputElement).value;
      });
    }

    if (createBtn) {
      createBtn.addEventListener('click', () => this.handleSubmit());
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.handleReset());
    }
  }

  private async handleSubmit(): Promise<void> {
    this.formState.error = null;
    this.formState.success = false;

    const state = this.ctx.getState();
    if (!state.projectId) {
      this.formState.error = 'Please select a project first';
      this.render();
      return;
    }

    this.formState.submitting = true;
    this.render();

    try {
      const response = await fetch('http://localhost:4877/api/video-orchestrator/content-items/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: state.projectId,
          title: this.formState.title,
          description: this.formState.description,
          sourceAudioPath: this.formState.sourceAudioPath,
          backgroundImagePath: this.formState.backgroundImagePath,
        }),
      });

      const data = await response.json() as {
        ok?: boolean;
        error?: string;
        approval?: { id: string; status: string };
      };

      if (!response.ok || !data.ok) {
        this.formState.error = data.error || 'Failed to create content item';
        this.formState.submitting = false;
        this.render();
        return;
      }

      this.formState.success = true;
      this.formState.title = '';
      this.formState.description = '';
      this.formState.sourceAudioPath = '';
      this.formState.backgroundImagePath = '';
      this.formState.submitting = false;
      this.render();

      setTimeout(() => {
        this.formState.success = false;
        this.render();
      }, 5000);
    } catch (error) {
      this.formState.error = error instanceof Error ? error.message : 'Request failed';
      this.formState.submitting = false;
      this.render();
    }
  }

  private handleReset(): void {
    this.formState.title = '';
    this.formState.description = '';
    this.formState.sourceAudioPath = '';
    this.formState.backgroundImagePath = '';
    this.formState.error = null;
    this.formState.success = false;
    this.render();
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
