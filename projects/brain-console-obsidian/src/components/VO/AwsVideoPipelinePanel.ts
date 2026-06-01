import type {
  BrainCoreVideoOrchestratorStatusResponse,
  BrainCoreChannelStatus,
  BrainCoreTopicCandidate,
} from '../../client.js';
import { readBrainCoreAwsVideoPipelineStatus } from '../../client.js';
import { StatusPill, Badge } from '../Design/shadcn-components.js';
import { PromptDraftForm } from './PromptDraftForm.js';

const REFRESH_INTERVAL_MS = 30_000;

export class AwsVideoPipelinePanel {
  private container: HTMLElement;
  private baseUrl: string;
  private data: BrainCoreVideoOrchestratorStatusResponse['data'] | undefined;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private loading = false;
  private error: string | undefined;
  private promptDraftForm: PromptDraftForm | null = null;

  constructor(container: HTMLElement, baseUrl: string = 'http://localhost:4877') {
    this.container = container;
    this.baseUrl = baseUrl;
    this.render();
    this.fetchLiveData();
    this.refreshTimer = setInterval(() => this.fetchLiveData(), REFRESH_INTERVAL_MS);
  }

  private async fetchLiveData(): Promise<void> {
    this.loading = true;
    this.error = undefined;
    try {
      const result = await readBrainCoreAwsVideoPipelineStatus(this.baseUrl);
      if (result.error) {
        this.error = result.error;
      } else if (result.value?.ok && result.value.data) {
        this.data = result.value.data;
      } else {
        this.error = 'Failed to fetch pipeline status';
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Fetch failed';
    } finally {
      this.loading = false;
      this.render();
    }
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    if (this.promptDraftForm) {
      this.promptDraftForm.destroy();
      this.promptDraftForm = null;
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="aws-video-pipeline-panel">
        ${this.renderRefreshIndicator()}
        ${this.renderConnectionStatus()}
        ${this.renderPipelineHealth()}
        ${this.renderPromptDraftFormSection()}
        ${this.renderChannelCards()}
        ${this.renderTopicBacklog()}
        ${this.renderErrors()}
      </div>
    `;
    this.attachPromptDraftForm();
  }

  private renderRefreshIndicator(): string {
    return `
      <div class="aws-video-refresh-bar">
        <span class="aws-video-refresh-label">
          ${this.loading ? 'Refreshing...' : 'Auto-refreshes every 30s'}
        </span>
        <span class="aws-video-refresh-dot ${this.loading ? 'aws-refresh-dot--active' : ''}"></span>
      </div>
    `;
  }

  private renderConnectionStatus(): string {
    if (!this.data) {
      return '<div class="aws-video-connection-warning">Loading pipeline data...</div>';
    }

    const pipelineReady = this.data.pipelineReady ?? false;
    const status = pipelineReady ? 'online' : 'degraded';
    const statusPill = pipelineReady ? 'ok' : 'warning';

    return `
      <div class="aws-video-connection-status">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Brain Core Connection</h3>
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: ${pipelineReady ? '#10b981' : '#f59e0b'};"></span>
          <span style="font-size: 13px; font-weight: 500;">${status === 'online' ? 'Connected' : 'Degraded'}</span>
          ${StatusPill({ status: statusPill, label: pipelineReady ? 'Ready' : 'Check Health' })}
        </div>
      </div>
    `;
  }

  private renderPipelineHealth(): string {
    if (!this.data) return '';

    const genStatus = this.data.generationStatus ?? 'ready';
    const pubStatus = this.data.publishingStatus ?? 'ready';

    const genPill = genStatus === 'ready' ? 'ok' : genStatus === 'in-progress' ? 'warning' : 'error';
    const pubPill = pubStatus === 'ready' ? 'ok' : pubStatus === 'in-progress' ? 'warning' : 'error';

    return `
      <div class="aws-video-health-card">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Pipeline Status</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div class="aws-video-status-item">
            <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Generation</span>
            ${StatusPill({ status: genPill, label: genStatus })}
          </div>
          <div class="aws-video-status-item">
            <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Publishing</span>
            ${StatusPill({ status: pubPill, label: pubStatus })}
          </div>
        </div>
      </div>
    `;
  }

  private renderChannelCards(): string {
    if (!this.data?.channels || this.data.channels.length === 0) {
      return '<div class="aws-video-no-channels">No channels configured</div>';
    }

    return `
      <div class="aws-video-channels-section">
        <h3 style="margin: 16px 0 12px 0; font-size: 14px; font-weight: 600;">Channels</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px;">
          ${this.data.channels.map(ch => this.renderChannelCard(ch)).join('')}
        </div>
      </div>
    `;
  }

  private renderChannelCard(channel: BrainCoreChannelStatus): string {
    const youtubeStatus = channel.youtubeEnabled ? 'enabled' : 'disabled';
    const youtubeColor = channel.youtubeEnabled ? '#ef4444' : '#9ca3af';
    const pubStatus = channel.publishingStatus === 'ready' ? 'ok' : 'warning';

    return `
      <div class="aws-video-channel-card" style="
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px;
        background: var(--background-elevated);
      ">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">${this.escapeHtml(channel.displayName)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(channel.channelId)}</div>
          </div>
          ${StatusPill({ status: pubStatus, label: channel.publishingStatus })}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px;">
            <span style="width: 6px; height: 6px; border-radius: 50%; background: ${youtubeColor};"></span>
            <span>YouTube ${youtubeStatus}</span>
          </div>
          <div style="font-size: 12px; color: var(--text-muted);">
            ${channel.totalTopics} topic${channel.totalTopics !== 1 ? 's' : ''} in backlog
          </div>
        </div>
      </div>
    `;
  }

  private renderTopicBacklog(): string {
    if (!this.data?.channels || this.data.channels.length === 0) {
      return '';
    }

    return `
      <div class="aws-video-topics-section" style="margin-top: 24px;">
        <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600;">Topic Candidates (Ranked)</h3>
        ${this.data.channels.map(ch => this.renderChannelTopics(ch)).join('')}
      </div>
    `;
  }

  private renderChannelTopics(channel: BrainCoreChannelStatus): string {
    if (!channel.topCandidates || channel.topCandidates.length === 0) {
      return `
        <div style="margin-bottom: 20px; padding: 12px; background: var(--background-secondary); border-radius: 6px; border-left: 3px solid var(--text-muted);">
          <div style="font-weight: 500; font-size: 13px; margin-bottom: 4px;">${this.escapeHtml(channel.displayName)}</div>
          <div style="font-size: 12px; color: var(--text-muted);">No candidate topics yet</div>
        </div>
      `;
    }

    return `
      <div style="margin-bottom: 20px;">
        <div style="font-weight: 500; font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          ${this.escapeHtml(channel.displayName)}
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${channel.topCandidates.slice(0, 5).map((topic, idx) => this.renderTopicItem(topic, idx + 1)).join('')}
        </div>
      </div>
    `;
  }

  private renderTopicItem(topic: BrainCoreTopicCandidate, rank: number): string {
    const scoreColor = topic.score >= 85 ? '#10b981' : topic.score >= 70 ? '#3b82f6' : '#f59e0b';
    const statusBadgeClass = topic.status === 'candidate' ? 'badge-candidate' : 'badge-status';

    return `
      <div style="
        padding: 10px 12px;
        background: var(--background-secondary);
        border-radius: 6px;
        border-left: 3px solid ${scoreColor};
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      ">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 600; font-size: 12px; color: var(--text-muted);">#${rank}</span>
            <span style="font-size: 12px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${this.escapeHtml(topic.title)}
            </span>
          </div>
          ${topic.reasoning && topic.reasoning.length > 0 ? `
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">
              ${topic.reasoning.slice(0, 2).map(r => `• ${this.escapeHtml(r)}`).join('<br>')}
            </div>
          ` : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-end; white-space: nowrap;">
          <span style="font-weight: 600; font-size: 13px; color: ${scoreColor};">${topic.score}</span>
          <span style="font-size: 10px; padding: 2px 6px; background: var(--background-elevated); border-radius: 3px; text-transform: capitalize;">
            ${topic.status}
          </span>
        </div>
      </div>
    `;
  }

  private renderPromptDraftFormSection(): string {
    if (!this.data?.channels || this.data.channels.length === 0) {
      return '';
    }

    return `
      <div class="aws-video-prompt-draft-section" style="
        margin-top: 24px;
        padding: 16px;
        background: var(--background-secondary);
        border-radius: 8px;
        border: 1px solid var(--border-color);
      ">
        <div id="aws-video-prompt-draft-form" style="width: 100%;"></div>
      </div>
    `;
  }

  private attachPromptDraftForm(): void {
    const formContainer = this.container.querySelector('#aws-video-prompt-draft-form') as HTMLElement | null;
    if (!formContainer || !this.data?.channels) {
      return;
    }

    if (this.promptDraftForm) {
      this.promptDraftForm.destroy();
    }

    this.promptDraftForm = new PromptDraftForm(formContainer, this.data.channels, this.baseUrl);
    this.promptDraftForm.setRefreshCallback(() => {
      void this.fetchLiveData();
    });
  }

  private renderErrors(): string {
    if (!this.error) return '';

    return `
      <div class="aws-video-error-banner" style="
        margin-top: 16px;
        padding: 12px;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 6px;
        color: #ef4444;
        font-size: 12px;
      ">
        <strong>Error:</strong> ${this.escapeHtml(this.error)}
      </div>
    `;
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
}
