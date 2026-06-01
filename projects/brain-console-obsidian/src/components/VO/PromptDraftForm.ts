import type {
  BrainCoreChannelStatus,
  CreateJobFromPromptRequest,
  CreateJobFromPromptResult,
} from '../../client.js';
import { createBrainCoreVideoJobFromPrompt } from '../../client.js';

interface CreateDraftResult {
  result?: CreateJobFromPromptResult;
  error?: string;
}

const MIN_PROMPT_LENGTH = 10;
const MAX_PROMPT_LENGTH = 500;

export class PromptDraftForm {
  private container: HTMLElement;
  private baseUrl: string;
  private channels: BrainCoreChannelStatus[] = [];
  private selectedChannelId = '';
  private prompt = '';
  private isSubmitting = false;
  private lastResult: CreateDraftResult | null = null;
  private onRefresh: (() => void) | null = null;

  constructor(
    container: HTMLElement,
    channels: BrainCoreChannelStatus[] = [],
    baseUrl: string = 'http://localhost:4877',
  ) {
    this.container = container;
    this.channels = channels;
    this.baseUrl = baseUrl;
    if (channels.length > 0) {
      this.selectedChannelId = channels[0].channelId;
    }
    this.render();
    this.attachEventListeners();
  }

  setRefreshCallback(callback: () => void): void {
    this.onRefresh = callback;
  }

  private getChannelLabel(channelId: string): string {
    const channel = this.channels.find(c => c.channelId === channelId);
    return channel?.displayName ?? channelId;
  }

  private getSafetyMessage(channelId: string): string {
    const label = this.getChannelLabel(channelId).toLowerCase();
    if (label.includes('bible') || label.includes('says-the-bible')) {
      return 'Theology review required before generation.';
    }
    if (label.includes('prochat') || label.includes('pro-chat')) {
      return 'Approval required before generation.';
    }
    return 'Approval required before generation.';
  }

  private isPromptValid(): boolean {
    const length = this.prompt.trim().length;
    return length >= MIN_PROMPT_LENGTH && length <= MAX_PROMPT_LENGTH;
  }

  private render(): void {
    const safetyMsg = this.selectedChannelId ? this.getSafetyMessage(this.selectedChannelId) : '';
    const isValid = this.isPromptValid();

    this.container.innerHTML = `
      <div class="prompt-draft-form">
        <div class="prompt-draft-form__header">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Create Draft Video</h3>
        </div>

        <div class="prompt-draft-form__content">
          <label class="prompt-draft-form__group">
            <span class="prompt-draft-form__label">Channel</span>
            <select id="prompt-draft-channel" class="prompt-draft-form__select" ${this.isSubmitting ? 'disabled' : ''}>
              ${this.channels.map(ch => `
                <option value="${this.escapeHtml(ch.channelId)}" ${ch.channelId === this.selectedChannelId ? 'selected' : ''}>
                  ${this.escapeHtml(ch.displayName)}
                </option>
              `).join('')}
            </select>
          </label>

          <label class="prompt-draft-form__group">
            <span class="prompt-draft-form__label">Prompt</span>
            <textarea
              id="prompt-draft-textarea"
              class="prompt-draft-form__textarea"
              placeholder="Describe the video content (10-500 characters)..."
              ${this.isSubmitting ? 'disabled' : ''}
            >${this.escapeHtml(this.prompt)}</textarea>
            <div class="prompt-draft-form__char-count">
              ${this.prompt.length} / ${MAX_PROMPT_LENGTH} characters
            </div>
          </label>

          ${safetyMsg ? `
            <div class="prompt-draft-form__safety-note">
              <strong>⚠️ Important:</strong> ${this.escapeHtml(safetyMsg)}
            </div>
          ` : ''}

          <div class="prompt-draft-form__actions">
            <button
              id="prompt-draft-submit"
              class="prompt-draft-form__button prompt-draft-form__button--primary"
              ${!isValid || this.isSubmitting || this.channels.length === 0 ? 'disabled' : ''}
            >
              ${this.isSubmitting ? 'Creating...' : 'Create Draft'}
            </button>
          </div>
        </div>

        ${this.renderResult()}
      </div>
    `;
  }

  private renderResult(): string {
    if (!this.lastResult) return '';

    const { result, error } = this.lastResult;

    if (error) {
      return `
        <div class="prompt-draft-form__error">
          <strong>Error:</strong> ${this.escapeHtml(error)}
        </div>
      `;
    }

    if (result && !result.ok) {
      return `
        <div class="prompt-draft-form__error">
          <strong>Error:</strong> ${this.escapeHtml(result.message)}
        </div>
      `;
    }

    if (result && result.ok) {
      return `
        <div class="prompt-draft-form__success">
          <div class="prompt-draft-form__success-title">✓ Draft Created Successfully</div>
          <div class="prompt-draft-form__result-item">
            <span class="prompt-draft-form__result-label">Job ID:</span>
            <code class="prompt-draft-form__result-value">${this.escapeHtml(result.jobId)}</code>
          </div>
          <div class="prompt-draft-form__result-item">
            <span class="prompt-draft-form__result-label">Topic ID:</span>
            <code class="prompt-draft-form__result-value">${this.escapeHtml(result.topicId)}</code>
          </div>
          <div class="prompt-draft-form__result-item">
            <span class="prompt-draft-form__result-label">Status:</span>
            <span class="prompt-draft-form__result-value">${this.escapeHtml(result.scriptStatus)} (${this.escapeHtml(result.approvalStatus)})</span>
          </div>
          <div class="prompt-draft-form__result-item">
            <span class="prompt-draft-form__result-label">Next Step:</span>
            <span class="prompt-draft-form__result-value" style="font-weight: 600; color: #2563eb;">
              ${this.escapeHtml(result.nextStep.replace(/_/g, ' '))}
            </span>
          </div>
        </div>
      `;
    }

    return '';
  }

  private attachEventListeners(): void {
    const channelSelect = this.container.querySelector('#prompt-draft-channel') as HTMLSelectElement | null;
    const textarea = this.container.querySelector('#prompt-draft-textarea') as HTMLTextAreaElement | null;
    const submitBtn = this.container.querySelector('#prompt-draft-submit') as HTMLButtonElement | null;

    if (channelSelect) {
      channelSelect.addEventListener('change', (e) => {
        this.selectedChannelId = (e.target as HTMLSelectElement).value;
        this.render();
        this.attachEventListeners();
      });
    }

    if (textarea) {
      textarea.addEventListener('input', (e) => {
        this.prompt = (e.target as HTMLTextAreaElement).value;
        this.render();
        this.attachEventListeners();
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        void this.handleSubmit();
      });
    }
  }

  private async handleSubmit(): Promise<void> {
    if (!this.isPromptValid() || !this.selectedChannelId) {
      this.lastResult = { error: 'Invalid prompt or channel not selected' };
      this.render();
      return;
    }

    this.isSubmitting = true;
    this.render();

    try {
      const request: CreateJobFromPromptRequest = {
        channelId: this.selectedChannelId,
        prompt: this.prompt.trim(),
        requestedBy: 'brain-console',
      };

      const response = await createBrainCoreVideoJobFromPrompt(this.baseUrl, request);

      if (response.error) {
        this.lastResult = { error: response.error };
      } else if (response.value) {
        this.lastResult = { result: response.value };
        if (this.onRefresh) {
          setTimeout(() => {
            this.onRefresh?.();
          }, 1500);
        }
      } else {
        this.lastResult = { error: 'Unknown response from server' };
      }
    } catch (err) {
      this.lastResult = {
        error: err instanceof Error ? err.message : 'Request failed',
      };
    } finally {
      this.isSubmitting = false;
      this.render();
      this.attachEventListeners();
    }
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  destroy(): void {
    this.container.innerHTML = '';
    this.onRefresh = null;
  }
}
