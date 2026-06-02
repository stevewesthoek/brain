import { requestUrl } from 'obsidian';
import { StatusPill } from '../Design/shadcn-components.js';

type FetchState = 'idle' | 'pending' | 'ok' | 'error';
type JobStatus = 'draft' | 'awaiting_approval' | 'approved' | 'generating' | 'generated' | 'ready_to_publish' | 'publishing' | 'published' | 'failed' | string;
type ActivityLevel = 'info' | 'success' | 'warning' | 'error';

interface ActivityEntry {
  at: string;
  level: ActivityLevel;
  message: string;
  jobId?: string;
}

interface ChannelStatus {
  channelId: string;
  displayName?: string;
  publishingStatus?: string;
  totalTopics?: number;
  youtubeEnabled?: boolean;
  topCandidates?: Array<{ title: string; score?: number; status?: string }>;
}

interface PipelineStatusData {
  channels?: ChannelStatus[];
  pipelineReady?: boolean;
  generationStatus?: string;
  publishingStatus?: string;
}

interface VideoJobSummary {
  jobId: string;
  channelId: string;
  title: string;
  status: JobStatus;
  currentStep: string | null;
  progress: number;
  createdAt: string | null;
  updatedAt: string | null;
  approval: { status: string; required: boolean };
  generation: { status: string; executionArn: string | null; startedAt: string | null; completedAt: string | null };
  publishing: { status: string; videoId: string | null; url: string | null };
  error: { step: string | null; message: string | null };
  artifacts: { script: string | null; narration: string | null; finalVideo: string | null; thumbnail: string | null };
}

interface VideoTimeline {
  jobId: string;
  events: Array<{ step: string; status: string; timestamp: string | null; message: string }>;
}

const BUILD_MARKER = 'v2.23-aws-video-minimal-panel';
const REFRESH_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;
const TERMINAL_STATES = new Set(['generated', 'ready_to_publish', 'published', 'failed']);
const ACTIVE_STATES = new Set(['generating', 'publishing']);

export class AwsVideoPipelinePanel {
  private container: HTMLElement;
  private baseUrl: string;
  private instanceId = Math.random().toString(36).slice(2, 10);
  private mountedAt = new Date();
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private pollingTimer: ReturnType<typeof setInterval> | null = null;
  private refreshSequence = 0;

  private statusFetch: FetchState = 'idle';
  private jobsFetch: FetchState = 'idle';
  private lastRefresh: Date | null = null;
  private lastStatusError = 'none';
  private lastJobsError = 'none';
  private loading = false;
  private error: string | null = null;
  private data: PipelineStatusData | null = null;
  private recentJobs: VideoJobSummary[] = [];
  private selectedJobId: string | null = null;
  private selectedJob: VideoJobSummary | null = null;
  private selectedTimeline: VideoTimeline | null = null;
  private activityLog: ActivityEntry[] = [];

  private showCreateDraftModal = false;
  private draftChannelId = '';
  private draftPrompt = '';
  private draftSubmitting = false;

  constructor(container: HTMLElement, baseUrl: string = 'http://localhost:4877') {
    this.container = container;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.addActivity('info', `Panel mounted (${this.instanceId})`);
    this.render();
    void this.fetchLiveData('initial load');
    this.refreshTimer = setInterval(() => void this.fetchLiveData('auto refresh'), REFRESH_INTERVAL_MS);
  }

  destroy(): void {
    if (this.refreshTimer) clearInterval(this.refreshTimer);
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.refreshTimer = null;
    this.pollingTimer = null;
    this.container.onclick = null;
    this.container.oninput = null;
    this.container.onchange = null;
  }

  private async fetchLiveData(reason = 'refresh'): Promise<void> {
    const refreshId = ++this.refreshSequence;
    this.loading = true;
    this.error = null;
    this.lastRefresh = new Date();
    this.statusFetch = 'pending';
    this.jobsFetch = 'pending';
    this.lastStatusError = 'none';
    this.lastJobsError = 'none';
    this.addActivity('info', `Refresh started: ${reason}`);
    this.render();

    try {
      this.addActivity('info', 'Status request started');
      this.render();
      const statusPayload = await this.getJson('/api/video-orchestrator/status');
      if (!this.isCurrentRefresh(refreshId)) return;
      this.data = this.unwrapStatus(statusPayload);
      this.statusFetch = 'ok';
      this.addActivity('success', 'Status request ok');
      if (!this.draftChannelId) {
        this.draftChannelId = this.data.channels?.[0]?.channelId ?? '';
      }
    } catch (err) {
      if (!this.isCurrentRefresh(refreshId)) return;
      this.statusFetch = 'error';
      this.lastStatusError = this.errorMessage(err);
      this.addActivity('error', `Status request failed: ${this.lastStatusError}`);
    }

    try {
      this.addActivity('info', 'Jobs request started');
      this.render();
      const jobsPayload = await this.getJson('/api/video-orchestrator/jobs/recent');
      if (!this.isCurrentRefresh(refreshId)) return;
      this.recentJobs = this.unwrapRecentJobs(jobsPayload);
      this.jobsFetch = 'ok';
      this.addActivity('success', `Loaded ${this.recentJobs.length} operational jobs`);
      if (!this.selectedJobId && this.recentJobs.length > 0) {
        this.selectedJobId = this.recentJobs[0]?.jobId ?? null;
      }
      if (this.selectedJobId) {
        await this.loadJobDetail(this.selectedJobId, false);
      }
    } catch (err) {
      if (!this.isCurrentRefresh(refreshId)) return;
      this.jobsFetch = 'error';
      this.lastJobsError = this.errorMessage(err);
      this.error = this.lastJobsError;
      this.addActivity('error', `Jobs request failed: ${this.lastJobsError}`);
    } finally {
      if (this.isCurrentRefresh(refreshId)) {
        this.loading = false;
        this.syncPolling();
        this.render();
      }
    }
  }

  private async loadJobDetail(jobId: string, rerender = true): Promise<void> {
    this.selectedJobId = jobId;
    this.addActivity('info', `Loading job detail`, jobId);
    if (rerender) this.render();
    try {
      const [jobPayload, timelinePayload] = await Promise.all([
        this.getJson(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}`),
        this.getJson(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/timeline`),
      ]);
      this.selectedJob = this.unwrapJob(jobPayload);
      this.selectedTimeline = this.unwrapTimeline(timelinePayload);
      this.addActivity('success', `Loaded job detail`, jobId);
    } catch (err) {
      this.selectedJob = null;
      this.selectedTimeline = null;
      this.error = this.errorMessage(err);
      this.addActivity('error', `Failed to load job detail: ${this.error}`, jobId);
    } finally {
      this.syncPolling();
      if (rerender) this.render();
    }
  }

  private async createDraftFromModal(): Promise<void> {
    if (!this.draftChannelId || this.draftPrompt.trim().length < 10 || this.draftSubmitting) return;
    this.draftSubmitting = true;
    this.addActivity('info', 'Creating draft...');
    this.render();
    try {
      const payload = await this.postJson('/api/video-orchestrator/jobs/create-from-prompt', {
        channelId: this.draftChannelId,
        prompt: this.draftPrompt.trim(),
        requestedBy: 'brain-console-webview',
      });
      const jobId = this.extractJobId(payload);
      if (!jobId) throw new Error(`Create draft returned no jobId. Keys: ${this.objectKeys(payload)}`);
      this.showCreateDraftModal = false;
      this.draftPrompt = '';
      this.selectedJobId = jobId;
      this.addActivity('success', `Draft created. Next: approve script.`, jobId);
      await this.fetchLiveData('draft created');
      await this.loadJobDetail(jobId);
    } catch (err) {
      this.error = this.errorMessage(err);
      this.addActivity('error', `Draft creation failed: ${this.error}`);
      this.render();
    } finally {
      this.draftSubmitting = false;
      this.render();
    }
  }

  private async approveJob(jobId: string): Promise<void> {
    this.addActivity('info', 'Approving script...', jobId);
    this.render();
    try {
      await this.postJson(`/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/approve`, {
        approvedBy: 'brain-console-webview',
        notes: 'Approved from AWS Video operational console',
      });
      this.addActivity('success', 'Script approved', jobId);
      await this.fetchLiveData('script approved');
      await this.loadJobDetail(jobId);
    } catch (err) {
      this.error = this.errorMessage(err);
      this.addActivity('error', `Approve failed: ${this.error}`, jobId);
      this.render();
    }
  }

  private async generateJob(jobId: string): Promise<void> {
    if (!confirm('Generate video artifacts only. This will not publish to YouTube.')) return;
    this.addActivity('info', 'Generation request started...', jobId);
    this.render();
    try {
      await this.postJson(`/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/generate`, {
        requestedBy: 'brain-console-webview',
      });
      this.addActivity('success', 'Generation request accepted', jobId);
      await this.fetchLiveData('generation requested');
      await this.loadJobDetail(jobId);
    } catch (err) {
      this.error = this.errorMessage(err);
      this.addActivity('error', `Generation failed: ${this.error}`, jobId);
      this.render();
    }
  }

  private async requestChanges(jobId: string): Promise<void> {
    const notes = prompt('Request changes notes:')?.trim();
    if (!notes) return;
    this.addActivity('info', 'Requesting changes...', jobId);
    this.render();
    try {
      await this.postJson(`/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/changes`, {
        requestedBy: 'brain-console-webview',
        notes,
      });
      this.addActivity('success', 'Changes requested', jobId);
      await this.fetchLiveData('changes requested');
      await this.loadJobDetail(jobId);
    } catch (err) {
      this.error = this.errorMessage(err);
      this.addActivity('error', `Request changes failed: ${this.error}`, jobId);
      this.render();
    }
  }

  private async getJson(path: string): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.withTimeout(requestUrl({ url, method: 'GET' }), `GET ${url}`);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`GET ${path} failed with HTTP ${response.status}`);
    }
    return response.json;
  }

  private async postJson(path: string, body: Record<string, unknown>): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const response = await this.withTimeout(requestUrl({
      url,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }), `POST ${url}`);
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`POST ${path} failed with HTTP ${response.status}: ${response.text}`);
    }
    return response.json;
  }

  private async withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="aws-video-pipeline-panel">
        <h2>AWS Video Pipeline</h2>
        <p>Topic Intelligence & Channel Status</p>
        ${this.renderDiagnostics()}
        ${this.renderActivityLog()}
        ${this.renderControls()}
        ${this.renderHealth()}
        ${this.renderRecentJobs()}
        ${this.renderSelectedJob()}
        ${this.renderCreateDraftCard()}
        ${this.renderTopics()}
        ${this.renderChannels()}
        ${this.renderError()}
        ${this.showCreateDraftModal ? this.renderCreateDraftModal() : ''}
      </div>
    `;
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    this.container.onclick = event => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const actionEl = target.closest<HTMLElement>('[data-action]');
      const jobRow = target.closest<HTMLElement>('[data-job-id]');
      const action = actionEl?.dataset.action;
      const jobId = actionEl?.dataset.jobId ?? jobRow?.dataset.jobId;

      if (action === 'refresh-now') void this.fetchLiveData('manual refresh');
      else if (action === 'open-create-draft') { this.showCreateDraftModal = true; this.addActivity('info', 'Create draft modal opened'); this.render(); }
      else if (action === 'close-create-draft') { this.showCreateDraftModal = false; this.render(); }
      else if (action === 'submit-create-draft') void this.createDraftFromModal();
      else if (action === 'select-job' && jobId) void this.loadJobDetail(jobId);
      else if (action === 'approve-job' && jobId) void this.approveJob(jobId);
      else if (action === 'request-changes' && jobId) void this.requestChanges(jobId);
      else if (action === 'generate-job' && jobId) void this.generateJob(jobId);
      else if (jobRow?.dataset.jobId) void this.loadJobDetail(jobRow.dataset.jobId);
    };

    this.container.oninput = event => {
      const target = event.target as HTMLTextAreaElement | null;
      if (target?.id === 'aws-video-draft-prompt') this.draftPrompt = target.value;
    };

    this.container.onchange = event => {
      const target = event.target as HTMLSelectElement | null;
      if (target?.id === 'aws-video-draft-channel') this.draftChannelId = target.value;
    };
  }

  private renderDiagnostics(): string {
    return `
      <div class="aws-video-health-card" style="margin: 16px 0;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; font-size: 12px; color: var(--text-muted);">
          <div><strong>Build:</strong> ${BUILD_MARKER}</div>
          <div><strong>Panel instance:</strong> ${this.escape(this.instanceId)}</div>
          <div><strong>Mounted at:</strong> ${this.mountedAt.toLocaleTimeString()}</div>
          <div><strong>Brain Core:</strong> ${this.escape(this.baseUrl)}</div>
          <div><strong>Container connected:</strong> ${this.container.isConnected ? 'yes' : 'no'}</div>
          <div><strong>Last Refresh:</strong> ${this.lastRefresh ? this.lastRefresh.toLocaleTimeString() : 'never'}</div>
          <div>${this.fetchIcon(this.statusFetch)} Status fetch: ${this.statusFetch}</div>
          <div>${this.fetchIcon(this.jobsFetch)} Jobs fetch: ${this.jobsFetch}</div>
          <div><strong>Loaded jobs:</strong> ${this.recentJobs.length}</div>
          <div><strong>Last status endpoint error:</strong> ${this.escape(this.lastStatusError)}</div>
          <div><strong>Last jobs endpoint error:</strong> ${this.escape(this.lastJobsError)}</div>
        </div>
      </div>
    `;
  }

  private renderActivityLog(): string {
    return `
      <div class="aws-video-health-card" style="margin-bottom: 16px;">
        <h3 style="margin: 0 0 10px 0; font-size: 13px;">Activity Log</h3>
        ${this.activityLog.length === 0 ? '<div style="font-size: 12px; color: var(--text-muted);">No activity yet.</div>' : this.activityLog.map(entry => `
          <div style="display: grid; grid-template-columns: 22px 1fr 90px; gap: 8px; align-items: center; font-size: 12px; margin: 6px 0; color: ${this.activityColor(entry.level)};">
            <span>${this.activityIcon(entry.level)}</span>
            <span>${this.escape(entry.message)}${entry.jobId ? ` <code>${this.escape(entry.jobId)}</code>` : ''}</span>
            <span style="color: var(--text-muted);">${this.escape(entry.at)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderControls(): string {
    return `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
        <span>${this.loading ? 'Refreshing operational dashboard...' : 'AWS Video control tower · auto-refreshes every 30s'}</span>
        <button type="button" data-action="refresh-now">Refresh now</button>
      </div>
    `;
  }

  private renderHealth(): string {
    if (!this.data) return '<div style="margin-bottom: 12px;">Loading pipeline data...</div>';
    const generation = this.data.generationStatus ?? 'unknown';
    const publishing = this.data.publishingStatus ?? 'unknown';
    return `
      <div style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><strong>Pipeline Health</strong>${StatusPill({ status: this.data.pipelineReady ? 'ok' : 'warning', label: this.data.pipelineReady ? 'Ready' : 'Check' })}</div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;">
          <div>Generation ${StatusPill({ status: generation === 'ready' ? 'ok' : 'warning', label: generation })}</div>
          <div>Publishing ${StatusPill({ status: publishing === 'ready' ? 'ok' : 'warning', label: publishing })}</div>
          <div>Recent Jobs <strong>${this.recentJobs.length}</strong></div>
          <div>Active <strong>${this.recentJobs.filter(j => ACTIVE_STATES.has(j.status)).length}</strong></div>
          <div>Pending <strong>${this.recentJobs.filter(j => j.status === 'draft' || j.status === 'awaiting_approval').length}</strong></div>
          <div>Published <strong>${this.recentJobs.filter(j => j.status === 'published').length}</strong></div>
        </div>
      </div>
    `;
  }

  private renderRecentJobs(): string {
    return `
      <div style="margin-bottom: 18px;">
        <h3 style="font-size: 15px; margin: 0 0 8px 0;">Recent Jobs</h3>
        ${this.recentJobs.length === 0 ? '<div style="font-size: 12px; color: var(--text-muted);">No jobs yet. Create a draft to get started.</div>' : this.recentJobs.map(job => `
          <button type="button" data-action="select-job" data-job-id="${this.escape(job.jobId)}" style="display: grid; grid-template-columns: 120px 240px 120px 1fr 120px; gap: 8px; width: 100%; margin: 4px 0; padding: 8px; text-align: left; border: 1px solid ${job.jobId === this.selectedJobId ? 'var(--interactive-accent)' : 'transparent'}; border-radius: 6px; background: var(--background-secondary); cursor: pointer;">
            <span>${StatusPill({ status: this.statusPill(job.status), label: job.status.replace(/_/g, ' ') })}</span>
            <code>${this.escape(this.truncate(job.jobId, 34))}</code>
            <span>${this.escape(job.channelId)}</span>
            <span>${this.escape(this.truncate(job.title, 60))}</span>
            <span>${this.escape(this.nextAction(job))}</span>
          </button>
        `).join('')}
      </div>
    `;
  }

  private renderSelectedJob(): string {
    if (!this.selectedJobId) return '<div style="margin-bottom: 18px;">Select a job to inspect operational detail.</div>';
    if (!this.selectedJob) return `<div style="margin-bottom: 18px; color: var(--text-error);">Selected job ${this.escape(this.selectedJobId)} is loading or unavailable.</div>`;
    const job = this.selectedJob;
    const canApprove = job.approval.status === 'pending';
    const canGenerate = job.approval.status === 'approved' && !TERMINAL_STATES.has(job.status) && !ACTIVE_STATES.has(job.status);
    return `
      <div class="aws-video-health-card" style="margin-bottom: 18px;">
        <div style="display: flex; justify-content: space-between; gap: 12px; align-items: start;">
          <div><h3 style="margin: 0 0 4px 0;">Selected Job Detail</h3><code>${this.escape(job.jobId)}</code></div>
          ${StatusPill({ status: this.statusPill(job.status), label: `${job.status.replace(/_/g, ' ')} · ${job.progress}%` })}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; font-size: 12px;">
          <div><strong>Title:</strong> ${this.escape(job.title)}</div>
          <div><strong>Channel:</strong> ${this.escape(job.channelId)}</div>
          <div><strong>Approval:</strong> ${this.escape(job.approval.status)}</div>
          <div><strong>Generation:</strong> ${this.escape(job.generation.status)}</div>
          <div><strong>Publishing:</strong> ${this.escape(job.publishing.status)}</div>
          <div><strong>Current step:</strong> ${this.escape(job.currentStep ?? '—')}</div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;">
          ${canApprove ? `<button type="button" data-action="approve-job" data-job-id="${this.escape(job.jobId)}">Approve</button><button type="button" data-action="request-changes" data-job-id="${this.escape(job.jobId)}">Request Changes</button>` : ''}
          ${canGenerate ? `<button type="button" data-action="generate-job" data-job-id="${this.escape(job.jobId)}">Generate artifacts</button>` : ''}
          ${job.status === 'ready_to_publish' ? '<span style="color: var(--text-muted);">Ready to publish — publishing intentionally disabled in this console.</span>' : ''}
          ${ACTIVE_STATES.has(job.status) ? '<span style="color: var(--text-muted);">Polling active · ETA usually 1–5 minutes.</span>' : ''}
        </div>
        ${this.renderArtifacts(job)}
        ${this.renderTimeline()}
      </div>
    `;
  }

  private renderArtifacts(job: VideoJobSummary): string {
    const artifactLines = Object.entries(job.artifacts).map(([key, value]) => `<div><strong>${this.escape(key)}:</strong> ${value ? `<code>${this.escape(value)}</code>` : '—'}</div>`).join('');
    return `<div style="margin-top: 12px;"><strong>Artifacts</strong><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 6px; font-size: 12px; margin-top: 6px;">${artifactLines}</div></div>`;
  }

  private renderTimeline(): string {
    const events = this.selectedTimeline?.events ?? [];
    return `<div style="margin-top: 12px;"><strong>Timeline</strong>${events.length === 0 ? '<div style="font-size: 12px; color: var(--text-muted);">No timeline events yet.</div>' : events.map(event => `<div style="font-size: 12px; margin-top: 4px;">${this.escape(event.status)} · <code>${this.escape(event.step)}</code> · ${this.escape(event.message)}</div>`).join('')}</div>`;
  }

  private renderCreateDraftCard(): string {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 18px;">
        <div><h3 style="margin: 0 0 4px 0;">Create Draft</h3><div style="font-size: 12px; color: var(--text-muted);">Create a draft only. Approval remains required before generation.</div></div>
        <button type="button" data-action="open-create-draft">Create Draft Video</button>
      </div>
    `;
  }

  private renderCreateDraftModal(): string {
    const channels = this.data?.channels ?? [];
    return `
      <div style="position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
        <div style="background: var(--background-primary); border: 1px solid var(--border-color); border-radius: 10px; padding: 18px; width: min(680px, 92vw);">
          <h3 style="margin-top: 0;">Create Draft Video</h3>
          <label style="display:block; margin-bottom: 10px;">Channel
            <select id="aws-video-draft-channel" style="width: 100%; margin-top: 4px;" ${this.draftSubmitting ? 'disabled' : ''}>
              ${channels.map(channel => `<option value="${this.escape(channel.channelId)}" ${channel.channelId === this.draftChannelId ? 'selected' : ''}>${this.escape(channel.displayName ?? channel.channelId)}</option>`).join('')}
            </select>
          </label>
          <label style="display:block; margin-bottom: 10px;">Prompt
            <textarea id="aws-video-draft-prompt" style="width: 100%; min-height: 130px; margin-top: 4px;" ${this.draftSubmitting ? 'disabled' : ''}>${this.escape(this.draftPrompt)}</textarea>
          </label>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" data-action="close-create-draft" ${this.draftSubmitting ? 'disabled' : ''}>Cancel</button>
            <button type="button" data-action="submit-create-draft" ${this.draftSubmitting ? 'disabled' : ''}>${this.draftSubmitting ? 'Creating...' : 'Create'}</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderTopics(): string {
    const channels = this.data?.channels ?? [];
    if (channels.length === 0) return '';
    return `<div style="margin-bottom: 18px;"><h3>Topic Candidates</h3>${channels.map(channel => `<div style="margin-bottom: 12px;"><strong>${this.escape(channel.displayName ?? channel.channelId)}</strong>${(channel.topCandidates ?? []).slice(0, 5).map((topic, index) => `<div style="display: flex; justify-content: space-between; background: var(--background-secondary); padding: 8px; margin-top: 4px; border-radius: 6px;"><span>#${index + 1} ${this.escape(topic.title)}</span><span>${topic.score ?? '—'} · ${this.escape(topic.status ?? 'candidate')}</span></div>`).join('')}</div>`).join('')}</div>`;
  }

  private renderChannels(): string {
    const channels = this.data?.channels ?? [];
    if (channels.length === 0) return '<div>No channels configured</div>';
    return `<div><h3>Channels</h3><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px;">${channels.map(channel => `<div style="background: var(--background-secondary); padding: 12px; border-radius: 6px;"><strong>${this.escape(channel.displayName ?? channel.channelId)}</strong><div style="font-size: 12px; color: var(--text-muted);">${this.escape(channel.channelId)} · ${channel.totalTopics ?? 0} topics · YouTube ${channel.youtubeEnabled ? 'enabled' : 'disabled'}</div></div>`).join('')}</div></div>`;
  }

  private renderError(): string {
    return this.error ? `<div style="margin-top: 14px; padding: 12px; border-radius: 6px; background: #ffe5e5; color: #b00020;"><strong>Error:</strong> ${this.escape(this.error)}<br><code>Brain Core: ${this.escape(this.baseUrl)}</code></div>` : '';
  }

  private addActivity(level: ActivityLevel, message: string, jobId?: string): void {
    this.activityLog = [{ at: new Date().toLocaleTimeString(), level, message, jobId }, ...this.activityLog].slice(0, 10);
  }

  private syncPolling(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    if (this.selectedJob && ACTIVE_STATES.has(this.selectedJob.status)) {
      this.pollingTimer = setInterval(() => {
        if (this.selectedJobId) void this.loadJobDetail(this.selectedJobId);
      }, 10_000);
    }
  }

  private isCurrentRefresh(refreshId: number): boolean {
    return refreshId === this.refreshSequence;
  }

  private unwrapStatus(payload: unknown): PipelineStatusData {
    const root = this.asRecord(payload);
    const data = this.asRecord(root?.data) ?? root;
    return {
      channels: Array.isArray(data?.channels) ? data.channels as ChannelStatus[] : [],
      pipelineReady: Boolean(data?.pipelineReady),
      generationStatus: typeof data?.generationStatus === 'string' ? data.generationStatus : 'unknown',
      publishingStatus: typeof data?.publishingStatus === 'string' ? data.publishingStatus : 'unknown',
    };
  }

  private unwrapRecentJobs(payload: unknown): VideoJobSummary[] {
    const root = this.asRecord(payload);
    const data = this.asRecord(root?.data);
    const jobs = Array.isArray(payload) ? payload : Array.isArray(root?.jobs) ? root.jobs : Array.isArray(data?.jobs) ? data.jobs : [];
    return jobs.filter((job): job is VideoJobSummary => Boolean(this.asRecord(job)?.jobId));
  }

  private unwrapJob(payload: unknown): VideoJobSummary {
    const root = this.asRecord(payload);
    const job = this.asRecord(root?.data) ?? root;
    if (!job?.jobId) throw new Error(`Unexpected job response shape: ${this.objectKeys(payload)}`);
    return job as unknown as VideoJobSummary;
  }

  private unwrapTimeline(payload: unknown): VideoTimeline {
    const root = this.asRecord(payload);
    const timeline = this.asRecord(root?.data) ?? root;
    if (!timeline?.jobId || !Array.isArray(timeline.events)) return { jobId: this.selectedJobId ?? 'unknown', events: [] };
    return timeline as unknown as VideoTimeline;
  }

  private extractJobId(payload: unknown): string | null {
    const root = this.asRecord(payload);
    const data = this.asRecord(root?.data);
    const job = this.asRecord(root?.job) ?? this.asRecord(data?.job);
    return this.stringValue(root?.jobId) ?? this.stringValue(data?.jobId) ?? this.stringValue(job?.jobId);
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private objectKeys(value: unknown): string {
    const record = this.asRecord(value);
    return record ? Object.keys(record).join(', ') : typeof value;
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private statusPill(status: string): 'ok' | 'warning' | 'error' | 'preview' {
    if (status === 'published' || status === 'ready_to_publish' || status === 'approved') return 'ok';
    if (status === 'failed' || status === 'rejected') return 'error';
    if (status === 'generating' || status === 'publishing' || status === 'awaiting_approval') return 'warning';
    return 'preview';
  }

  private nextAction(job: VideoJobSummary): string {
    if (job.status === 'draft' || job.status === 'awaiting_approval') return 'Approve script';
    if (job.status === 'approved') return 'Generate';
    if (job.status === 'ready_to_publish') return 'Publish disabled';
    if (job.status === 'published') return 'Done';
    if (job.status === 'failed') return 'Investigate';
    return 'Monitor';
  }

  private fetchIcon(state: FetchState): string {
    if (state === 'ok') return '✓';
    if (state === 'error') return '✕';
    if (state === 'pending') return '○';
    return '—';
  }

  private activityIcon(level: ActivityLevel): string {
    if (level === 'success') return '✓';
    if (level === 'warning') return '⚠';
    if (level === 'error') return '✕';
    return 'ℹ';
  }

  private activityColor(level: ActivityLevel): string {
    if (level === 'success') return 'var(--text-success, #22c55e)';
    if (level === 'warning') return 'var(--text-warning, #f59e0b)';
    if (level === 'error') return 'var(--text-error, #ef4444)';
    return 'var(--text-accent)';
  }

  private truncate(value: string, max: number): string {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
  }

  private escape(value: string): string {
    return value.replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char] ?? char));
  }
}
