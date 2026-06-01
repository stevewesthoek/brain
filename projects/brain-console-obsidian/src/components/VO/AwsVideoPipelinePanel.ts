import type {
  BrainCoreVideoOrchestratorStatusResponse,
  BrainCoreChannelStatus,
  BrainCoreTopicCandidate,
  BrainCoreVideoJobSummary,
  BrainCoreVideoJobTimeline,
} from '../../client.js';
import { createBrainCoreVideoJobFromPrompt, readBrainCoreAwsVideoPipelineStatus } from '../../client.js';
import { StatusPill } from '../Design/shadcn-components.js';

const REFRESH_INTERVAL_MS = 30_000;
const JOB_POLL_INTERVAL_MS = 10_000;
const TERMINAL_JOB_STATES = new Set(['generated', 'ready_to_publish', 'published', 'failed']);
const GENERATING_JOB_STATES = new Set(['generating', 'publishing']);
const GENERATED_JOB_STATES = new Set(['generating', 'generated', 'ready_to_publish', 'publishing', 'published']);

export class AwsVideoPipelinePanel {
  private container: HTMLElement;
  private baseUrl: string;
  private data: BrainCoreVideoOrchestratorStatusResponse['data'] | undefined;
  private selectedJobId: string | null = null;
  private selectedJob: BrainCoreVideoJobSummary | null = null;
  private selectedTimeline: BrainCoreVideoJobTimeline | null = null;
  private recentJobs: BrainCoreVideoJobSummary[] = [];
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private loading = false;
  private jobLoading = false;
  private showCreateDraftModal = false;
  private draftChannelId = '';
  private draftPrompt = '';
  private draftSubmitting = false;
  private error: string | undefined;
  private actionMessage: string | undefined;

  constructor(container: HTMLElement, baseUrl: string = 'http://localhost:4877') {
    this.container = container;
    this.baseUrl = baseUrl;
    this.render();
    void this.fetchLiveData();
    this.refreshTimer = setInterval(() => void this.fetchLiveData(), REFRESH_INTERVAL_MS);
  }

  private async fetchLiveData(): Promise<void> {
    this.loading = true;
    this.error = undefined;
    this.actionMessage = undefined;
    try {
      // Fetch status and recent jobs independently to avoid hanging if one fails
      const statusResult = await readBrainCoreAwsVideoPipelineStatus(this.baseUrl);
      const recentJobs = await this.fetchRecentJobs();

      if (statusResult.error) {
        this.error = statusResult.error;
      } else if (statusResult.value?.ok && statusResult.value.data) {
        this.data = statusResult.value.data;
        if (!this.draftChannelId && this.data.channels.length > 0) {
          this.draftChannelId = this.data.channels[0]?.channelId ?? '';
        }
      } else if (!statusResult.error) {
        // Only set generic error if no specific error was already set
        if (!this.data) {
          this.error = 'Failed to fetch pipeline status';
        }
      }

      this.recentJobs = recentJobs;
      if (!this.selectedJobId && this.recentJobs.length > 0) {
        this.selectedJobId = this.recentJobs[0]?.jobId ?? null;
      }
      if (this.selectedJobId) {
        await this.loadJobDetail(this.selectedJobId, false);
      }
    } catch (err) {
      this.error = `Failed to fetch data: ${err instanceof Error ? err.message : 'Unknown error'}`;
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private async fetchRecentJobs(): Promise<BrainCoreVideoJobSummary[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/video-orchestrator/jobs/recent`);
      if (!response.ok) {
        this.error = `Failed to fetch recent jobs: HTTP ${response.status}`;
        return [];
      }
      const payload = await response.json() as { jobs?: BrainCoreVideoJobSummary[] };
      return Array.isArray(payload.jobs) ? payload.jobs : [];
    } catch (err) {
      this.error = `Failed to fetch recent jobs: ${err instanceof Error ? err.message : String(err)}`;
      return [];
    }
  }

  private async loadJobDetail(jobId: string, rerender = true): Promise<void> {
    this.jobLoading = true;
    try {
      const jobDetailRes = await fetch(`${this.baseUrl}/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}`);
      const timelineRes = await fetch(`${this.baseUrl}/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/timeline`);

      if (jobDetailRes.ok) {
        const detail = await jobDetailRes.json() as { data?: BrainCoreVideoJobSummary };
        this.selectedJob = detail.data ?? null;
        this.selectedJobId = this.selectedJob?.jobId ?? null;
      } else {
        this.selectedJob = null;
        this.selectedJobId = null;
        this.error = `Failed to load job ${jobId}: HTTP ${jobDetailRes.status}`;
      }

      if (timelineRes.ok) {
        const tl = await timelineRes.json() as { data?: BrainCoreVideoJobTimeline };
        this.selectedTimeline = tl.data ?? null;
      } else {
        this.selectedTimeline = null;
      }

      this.syncPollingState();
    } catch (err) {
      this.error = `Failed to load job detail: ${err instanceof Error ? err.message : String(err)}`;
      this.selectedJob = null;
      this.selectedTimeline = null;
    } finally {
      this.jobLoading = false;
      if (rerender) this.render();
    }
  }

  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.stopPolling();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="aws-video-pipeline-panel">
        ${this.renderRefreshIndicator()}
        ${this.renderPipelineHealth()}
        ${this.renderRecentJobs()}
        ${this.renderSelectedJobDetail()}
        ${this.renderCreateDraftCard()}
        ${this.renderTopicBacklog()}
        ${this.renderChannelCards()}
        ${this.renderErrors()}
        ${this.showCreateDraftModal ? this.renderCreateDraftModal() : ''}
      </div>
    `;
    this.attachEventListeners();
  }

  private renderRefreshIndicator(): string {
    return `
      <div class="aws-video-refresh-bar">
        <span class="aws-video-refresh-label">
          ${this.loading ? 'Refreshing operational dashboard...' : 'AWS Video control tower · auto-refreshes every 30s'}
        </span>
        <button type="button" class="aws-video-refresh-button" data-action="refresh-now">Refresh now</button>
        <span class="aws-video-refresh-dot ${this.loading ? 'aws-refresh-dot--active' : ''}"></span>
      </div>
    `;
  }

  private renderPipelineHealth(): string {
    if (!this.data) return '<div class="aws-video-connection-warning">Loading pipeline data...</div>';

    const genStatus = this.data.generationStatus ?? 'ready';
    const pubStatus = this.data.publishingStatus ?? 'ready';
    const genPill = genStatus === 'ready' ? 'ok' : genStatus === 'in-progress' ? 'warning' : 'error';
    const pubPill = pubStatus === 'ready' ? 'ok' : pubStatus === 'in-progress' ? 'warning' : 'error';
    const publishedCount = this.recentJobs.filter(job => job.status === 'published').length;
    const activeCount = this.recentJobs.filter(job => GENERATING_JOB_STATES.has(job.status)).length;
    const pendingCount = this.recentJobs.filter(job => job.status === 'awaiting_approval' || job.status === 'draft').length;

    return `
      <div class="aws-video-health-card">
        <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 12px;">
          <h3 style="margin: 0; font-size: 14px; font-weight: 600;">Pipeline Health</h3>
          ${StatusPill({ status: this.data.pipelineReady ? 'ok' : 'warning', label: this.data.pipelineReady ? 'Ready' : 'Check Health' })}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
          <div class="aws-video-status-item"><span>Generation</span>${StatusPill({ status: genPill, label: genStatus })}</div>
          <div class="aws-video-status-item"><span>Publishing</span>${StatusPill({ status: pubPill, label: pubStatus })}</div>
          <div class="aws-video-status-item"><span>Recent Jobs</span><strong>${this.recentJobs.length}</strong></div>
          <div class="aws-video-status-item"><span>Active</span><strong>${activeCount}</strong></div>
          <div class="aws-video-status-item"><span>Pending</span><strong>${pendingCount}</strong></div>
          <div class="aws-video-status-item"><span>Published</span><strong>${publishedCount}</strong></div>
        </div>
      </div>
    `;
  }

  private renderRecentJobs(): string {
    if (this.recentJobs.length === 0) {
      return `
        <div class="aws-video-health-card" style="margin-top: 16px;">
          <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600;">Recent Jobs</h3>
          <div style="font-size: 12px; color: var(--text-muted);">No jobs yet. Create a draft to get started.</div>
        </div>
      `;
    }

    return `
      <div class="aws-video-health-card" style="margin-top: 16px;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600;">Recent Jobs</h3>
        <div style="display: flex; flex-direction: column; gap: 6px;">
          ${this.recentJobs.map(job => this.renderRecentJobRow(job)).join('')}
        </div>
      </div>
    `;
  }

  private renderRecentJobRow(job: BrainCoreVideoJobSummary): string {
    const selected = job.jobId === this.selectedJobId;
    return `
      <button type="button" class="aws-video-job-row" data-job-id="${this.escapeHtml(job.jobId)}" style="
        width: 100%; text-align: left; padding: 10px; border-radius: 6px;
        border: 1px solid ${selected ? 'var(--interactive-accent)' : 'var(--border-color)'};
        background: ${selected ? 'var(--background-modifier-hover)' : 'var(--background-secondary)'};
        cursor: pointer;
      ">
        <div style="display: grid; grid-template-columns: 110px 150px 110px 1fr 120px 110px; gap: 8px; align-items: center; font-size: 12px;">
          ${StatusPill({ status: this.statusPillType(job.status), label: job.status.replace(/_/g, ' ') })}
          <code title="${this.escapeHtml(job.jobId)}">${this.escapeHtml(this.truncate(job.jobId, 18))}</code>
          <span>${this.escapeHtml(job.channelId)}</span>
          <span>${this.escapeHtml(this.truncate(job.title, 52))}</span>
          <span>${this.escapeHtml(job.currentStep ?? '—')}</span>
          <span>${this.escapeHtml(this.nextAction(job))}</span>
        </div>
      </button>
    `;
  }

  private renderSelectedJobDetail(): string {
    if (this.jobLoading) {
      return '<div class="aws-video-health-card" style="margin-top: 16px;">Loading selected job...</div>';
    }
    if (!this.selectedJob) {
      return '<div class="aws-video-health-card" style="margin-top: 16px;">Select a job to inspect operational detail.</div>';
    }

    const job = this.selectedJob;
    const canGenerate = job.approval.status === 'approved' && !GENERATED_JOB_STATES.has(job.status);
    const canApprove = job.approval.status === 'pending';
    const isPolling = GENERATING_JOB_STATES.has(job.status);

    return `
      <div class="aws-video-health-card" style="margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 16px;">
          <div>
            <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">Selected Job Detail</h3>
            <code style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(job.jobId)}</code>
          </div>
          ${StatusPill({ status: this.statusPillType(job.status), label: `${job.status.replace(/_/g, ' ')} · ${job.progress}%` })}
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          ${this.renderDetailCard('Title', job.title)}
          ${this.renderDetailCard('Channel', job.channelId)}
          ${this.renderDetailCard('Current Step', job.currentStep ?? '—')}
          ${this.renderDetailCard('Updated', this.formatDate(job.updatedAt ?? job.createdAt))}
        </div>

        <div style="margin-top: 16px; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">
          <div class="aws-video-job-detail-card">
            <h4>Approval</h4>
            ${StatusPill({ status: this.statusPillType(job.approval.status), label: job.approval.status })}
            <div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">Required: ${job.approval.required ? 'yes' : 'no'}</div>
            ${canApprove ? `
              <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                <button type="button" data-action="approve-job" data-job-id="${this.escapeHtml(job.jobId)}">Approve</button>
                <button type="button" data-action="request-changes" data-job-id="${this.escapeHtml(job.jobId)}">Request Changes</button>
              </div>
            ` : ''}
          </div>
          <div class="aws-video-job-detail-card">
            <h4>Generation</h4>
            <div>Status: ${this.escapeHtml(job.generation.status)}</div>
            <div>Execution: ${job.generation.executionArn ? `<code>${this.escapeHtml(this.truncate(job.generation.executionArn, 34))}</code>` : '—'}</div>
            ${canGenerate ? `<button type="button" data-action="generate-job" data-job-id="${this.escapeHtml(job.jobId)}" style="margin-top: 10px;">Generate artifacts</button>` : ''}
            ${isPolling ? '<div style="margin-top: 8px; font-size: 12px; color: var(--text-muted);">Polling active · ETA: usually 1–5 minutes</div>' : ''}
          </div>
          <div class="aws-video-job-detail-card">
            <h4>Publishing</h4>
            <div>Status: ${this.escapeHtml(job.publishing.status)}</div>
            <div>Video ID: ${job.publishing.videoId ? `<code>${this.escapeHtml(job.publishing.videoId)}</code>` : '—'}</div>
            <div>URL: ${job.publishing.url ? `<a href="${this.escapeHtml(job.publishing.url)}">open</a>` : '—'}</div>
          </div>
        </div>

        ${this.renderArtifacts(job)}
        ${this.renderTimeline()}
        ${job.error.step || job.error.message ? this.renderErrorBox(job) : ''}
      </div>
    `;
  }

  private renderDetailCard(label: string, value: string): string {
    return `<div class="aws-video-job-detail-card"><h4>${this.escapeHtml(label)}</h4><div>${this.escapeHtml(value)}</div></div>`;
  }

  private renderArtifacts(job: BrainCoreVideoJobSummary): string {
    const artifacts = job.artifacts;
    return `
      <div class="aws-video-job-detail-card" style="margin-top: 12px;">
        <h4>Artifacts</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; font-size: 12px;">
          ${this.renderArtifact('Script', artifacts.script)}
          ${this.renderArtifact('Narration', artifacts.narration)}
          ${this.renderArtifact('Final Video', artifacts.finalVideo)}
          ${this.renderArtifact('Thumbnail', artifacts.thumbnail)}
        </div>
      </div>
    `;
  }

  private renderArtifact(label: string, value: string | null): string {
    return `<div><strong>${this.escapeHtml(label)}:</strong> ${value ? `<code>${this.escapeHtml(value)}</code>` : '—'}</div>`;
  }

  private renderTimeline(): string {
    const events = this.selectedTimeline?.events ?? [];
    if (events.length === 0) {
      return '<div class="aws-video-job-detail-card" style="margin-top: 12px;"><h4>Timeline</h4><div style="font-size: 12px; color: var(--text-muted);">No timeline events yet.</div></div>';
    }
    return `
      <div class="aws-video-job-detail-card" style="margin-top: 12px;">
        <h4>Timeline</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${events.map(event => `
            <div style="display: grid; grid-template-columns: 24px 170px 1fr 150px; gap: 8px; align-items: center; font-size: 12px;">
              <span>${this.timelineIcon(event.status)}</span>
              <code>${this.escapeHtml(event.step)}</code>
              <span>${this.escapeHtml(event.message)}</span>
              <span style="color: var(--text-muted);">${this.escapeHtml(this.formatDate(event.timestamp))}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderErrorBox(job: BrainCoreVideoJobSummary): string {
    return `
      <div class="aws-video-error-banner" style="margin-top: 12px;">
        <strong>Error:</strong> ${this.escapeHtml(job.error.step ?? 'unknown step')} · ${this.escapeHtml(job.error.message ?? 'No error message')}
      </div>
    `;
  }

  private renderCreateDraftCard(): string {
    return `
      <div class="aws-video-health-card" style="margin-top: 16px;">
        <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center;">
          <div>
            <h3 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 600;">Create Draft</h3>
            <div style="font-size: 12px; color: var(--text-muted);">Create a draft only. Approval remains required before generation.</div>
          </div>
          <button type="button" data-action="open-create-draft">Create Draft Video</button>
        </div>
        ${this.actionMessage ? `<div style="margin-top: 8px; font-size: 12px; color: var(--text-accent);">${this.escapeHtml(this.actionMessage)}</div>` : ''}
      </div>
    `;
  }

  private renderCreateDraftModal(): string {
    const channels = this.data?.channels ?? [];
    return `
      <div class="aws-video-modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 9999; display: flex; align-items: center; justify-content: center;">
        <div class="aws-video-modal" style="width: min(640px, 92vw); background: var(--background-primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.35);">
          <h3 style="margin: 0 0 12px 0;">Create Draft Video</h3>
          <label style="display: block; margin-bottom: 12px; font-size: 12px;">Channel
            <select id="aws-video-draft-channel" style="width: 100%; margin-top: 4px;" ${this.draftSubmitting ? 'disabled' : ''}>
              ${channels.map(ch => `<option value="${this.escapeHtml(ch.channelId)}" ${ch.channelId === this.draftChannelId ? 'selected' : ''}>${this.escapeHtml(ch.displayName)}</option>`).join('')}
            </select>
          </label>
          <label style="display: block; margin-bottom: 12px; font-size: 12px;">Prompt
            <textarea id="aws-video-draft-prompt" style="width: 100%; min-height: 120px; margin-top: 4px;" placeholder="Describe the video content..." ${this.draftSubmitting ? 'disabled' : ''}>${this.escapeHtml(this.draftPrompt)}</textarea>
          </label>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" data-action="close-create-draft" ${this.draftSubmitting ? 'disabled' : ''}>Cancel</button>
            <button type="button" data-action="submit-create-draft" ${this.draftSubmitting || this.draftPrompt.trim().length < 10 ? 'disabled' : ''}>${this.draftSubmitting ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderChannelCards(): string {
    if (!this.data?.channels || this.data.channels.length === 0) return '<div class="aws-video-no-channels">No channels configured</div>';
    return `
      <div class="aws-video-channels-section" style="margin-top: 24px;">
        <h3 style="margin: 16px 0 12px 0; font-size: 14px; font-weight: 600;">Channels</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px;">
          ${this.data.channels.map(ch => this.renderChannelCard(ch)).join('')}
        </div>
      </div>
    `;
  }

  private renderChannelCard(channel: BrainCoreChannelStatus): string {
    return `
      <div class="aws-video-channel-card" style="border: 1px solid var(--border-color); border-radius: 8px; padding: 12px; background: var(--background-elevated);">
        <div style="display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 4px;">${this.escapeHtml(channel.displayName)}</div>
            <div style="font-size: 11px; color: var(--text-muted);">${this.escapeHtml(channel.channelId)}</div>
          </div>
          ${StatusPill({ status: channel.publishingStatus === 'ready' ? 'ok' : 'warning', label: channel.publishingStatus })}
        </div>
        <div style="font-size: 12px; color: var(--text-muted);">${channel.totalTopics} topic${channel.totalTopics !== 1 ? 's' : ''} · YouTube ${channel.youtubeEnabled ? 'enabled' : 'disabled'}</div>
      </div>
    `;
  }

  private renderTopicBacklog(): string {
    if (!this.data?.channels || this.data.channels.length === 0) return '';
    return `
      <div class="aws-video-topics-section" style="margin-top: 24px;">
        <h3 style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600;">Topic Candidates</h3>
        ${this.data.channels.map(ch => this.renderChannelTopics(ch)).join('')}
      </div>
    `;
  }

  private renderChannelTopics(channel: BrainCoreChannelStatus): string {
    if (!channel.topCandidates || channel.topCandidates.length === 0) {
      return `<div style="margin-bottom: 12px; padding: 12px; background: var(--background-secondary); border-radius: 6px;"><strong>${this.escapeHtml(channel.displayName)}</strong><br><span style="font-size: 12px; color: var(--text-muted);">No candidate topics yet</span></div>`;
    }
    return `
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 500; font-size: 12px; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">${this.escapeHtml(channel.displayName)}</div>
        <div style="display: flex; flex-direction: column; gap: 8px;">${channel.topCandidates.slice(0, 5).map((topic, idx) => this.renderTopicItem(topic, idx + 1)).join('')}</div>
      </div>
    `;
  }

  private renderTopicItem(topic: BrainCoreTopicCandidate, rank: number): string {
    return `
      <div style="padding: 10px 12px; background: var(--background-secondary); border-radius: 6px; display: flex; justify-content: space-between; gap: 12px; font-size: 12px;">
        <span><strong>#${rank}</strong> ${this.escapeHtml(topic.title)}</span>
        <span>${topic.score} · ${this.escapeHtml(topic.status)}</span>
      </div>
    `;
  }

  private renderErrors(): string {
    if (!this.error && !this.actionMessage) return '';
    const content: string[] = [];
    if (this.error) {
      content.push(`<div class="aws-video-error-banner" style="margin-top: 16px; padding: 12px; background: #fee; border: 1px solid #fcc; border-radius: 4px; font-size: 12px; color: #c00;">
        <strong>Error:</strong> ${this.escapeHtml(this.error)}<br/>
        <code style="font-size: 11px; display: block; margin-top: 4px;">Brain Core: ${this.escapeHtml(this.baseUrl)}</code>
      </div>`);
    }
    if (this.actionMessage) {
      content.push(`<div class="aws-video-action-message" style="margin-top: 16px; padding: 12px; background: #efe; border: 1px solid #cfc; border-radius: 4px; font-size: 12px; color: #060;">
        ✓ ${this.escapeHtml(this.actionMessage)}
      </div>`);
    }
    return content.join('');
  }

  private attachEventListeners(): void {
    this.container.querySelectorAll<HTMLElement>('[data-job-id]').forEach(row => {
      row.addEventListener('click', () => {
        const jobId = row.dataset.jobId;
        if (jobId) void this.loadJobDetail(jobId);
      });
    });

    this.container.querySelector('[data-action="refresh-now"]')?.addEventListener('click', () => void this.fetchLiveData());
    this.container.querySelector('[data-action="open-create-draft"]')?.addEventListener('click', () => {
      this.showCreateDraftModal = true;
      this.render();
    });
    this.container.querySelector('[data-action="close-create-draft"]')?.addEventListener('click', () => {
      this.showCreateDraftModal = false;
      this.render();
    });
    this.container.querySelector('[data-action="submit-create-draft"]')?.addEventListener('click', () => void this.createDraftFromModal());
    this.container.querySelector('[data-action="generate-job"]')?.addEventListener('click', (event) => {
      const jobId = (event.currentTarget as HTMLElement).dataset.jobId;
      if (jobId) void this.generateJob(jobId);
    });
    this.container.querySelector('[data-action="approve-job"]')?.addEventListener('click', (event) => {
      const jobId = (event.currentTarget as HTMLElement).dataset.jobId;
      if (jobId) void this.approveJob(jobId);
    });
    this.container.querySelector('[data-action="request-changes"]')?.addEventListener('click', (event) => {
      const jobId = (event.currentTarget as HTMLElement).dataset.jobId;
      if (jobId) void this.requestChanges(jobId);
    });

    const channelSelect = this.container.querySelector('#aws-video-draft-channel') as HTMLSelectElement | null;
    channelSelect?.addEventListener('change', () => { this.draftChannelId = channelSelect.value; });
    const promptInput = this.container.querySelector('#aws-video-draft-prompt') as HTMLTextAreaElement | null;
    promptInput?.addEventListener('input', () => { this.draftPrompt = promptInput.value; });
  }

  private async createDraftFromModal(): Promise<void> {
    if (!this.draftChannelId || this.draftPrompt.trim().length < 10) return;
    this.draftSubmitting = true;
    this.render();
    const response = await createBrainCoreVideoJobFromPrompt(this.baseUrl, {
      channelId: this.draftChannelId,
      prompt: this.draftPrompt.trim(),
      requestedBy: 'brain-console',
    });
    this.draftSubmitting = false;

    if (response.value?.ok) {
      this.actionMessage = `Draft created · next: Approve Script · ${response.value.jobId}`;
      this.showCreateDraftModal = false;
      this.draftPrompt = '';
      await this.fetchLiveData();
      await this.loadJobDetail(response.value.jobId);
    } else {
      this.error = response.error ?? response.value?.message ?? 'Draft creation failed';
      this.render();
    }
  }

  private async generateJob(jobId: string): Promise<void> {
    if (!confirm('Generate video artifacts only. This will not publish to YouTube.')) return;
    try {
      const response = await fetch(`${this.baseUrl}/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestedBy: 'brain-console' }),
      });
      if (!response.ok) {
        this.error = `Generate request failed for ${jobId}: HTTP ${response.status}`;
      } else {
        this.actionMessage = `Generation requested for ${jobId}`;
        this.error = undefined;
      }
    } catch (err) {
      this.error = `Generate request failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    await this.loadJobDetail(jobId);
  }

  private async approveJob(jobId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'brain-console', notes: 'Approved from AWS Video operational console' }),
      });
      if (response.ok) {
        this.actionMessage = `Approved ${jobId}`;
        this.error = undefined;
      } else {
        this.error = `Approve failed for ${jobId}: HTTP ${response.status}`;
      }
    } catch (err) {
      this.error = `Approve failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    await this.loadJobDetail(jobId);
  }

  private async requestChanges(jobId: string): Promise<void> {
    const notes = prompt('Request changes notes:') ?? '';
    if (!notes.trim()) return;
    try {
      const response = await fetch(`${this.baseUrl}/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/request-changes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestedBy: 'brain-console', notes: notes.trim() }),
      });
      if (response.ok) {
        this.actionMessage = `Changes requested for ${jobId}`;
        this.error = undefined;
      } else {
        this.error = `Request changes failed for ${jobId}: HTTP ${response.status}`;
      }
    } catch (err) {
      this.error = `Request changes failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    await this.loadJobDetail(jobId);
  }

  private syncPollingState(): void {
    if (this.selectedJob && GENERATING_JOB_STATES.has(this.selectedJob.status)) {
      this.startPolling();
      return;
    }
    if (!this.selectedJob || TERMINAL_JOB_STATES.has(this.selectedJob.status)) {
      this.stopPolling();
    }
  }

  private startPolling(): void {
    this.stopPolling();
    this.pollingInterval = setInterval(() => {
      if (this.selectedJobId) void this.loadJobDetail(this.selectedJobId);
    }, JOB_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  private statusPillType(status: string): 'ok' | 'warning' | 'error' | 'preview' {
    if (status === 'published' || status === 'ready_to_publish' || status === 'approved') return 'ok';
    if (status === 'failed' || status === 'rejected') return 'error';
    if (status === 'generating' || status === 'publishing' || status === 'awaiting_approval') return 'warning';
    return 'preview';
  }

  private nextAction(job: BrainCoreVideoJobSummary): string {
    if (job.status === 'draft' || job.status === 'awaiting_approval') return 'Approve script';
    if (job.status === 'approved') return 'Generate';
    if (job.status === 'ready_to_publish') return 'Publish review';
    if (job.status === 'published') return 'Done';
    if (job.status === 'failed') return 'Investigate';
    return 'Monitor';
  }

  private timelineIcon(status: string): string {
    if (status === 'complete') return '✓';
    if (status === 'in_progress') return '…';
    if (status === 'failed') return '✕';
    return '○';
  }

  private formatDate(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  private truncate(text: string, max: number): string {
    return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
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
