import type {
  BrainCoreVideoOrchestratorStatusResponse,
  BrainCoreChannelStatus,
  BrainCoreTopicCandidate,
  BrainCoreVideoJobSummary,
  BrainCoreVideoJobTimeline,
} from '../../client.js';
import {
  createBrainCoreVideoJobFromPrompt,
  readBrainCoreAwsVideoPipelineStatus,
  readBrainCoreOperationalRecentVideoJobs,
  readBrainCoreOperationalVideoJob,
  readBrainCoreOperationalVideoJobTimeline,
  requestBrainCoreOperationalApproveVideoJob,
  requestBrainCoreOperationalGenerateVideoJob,
  requestBrainCoreOperationalRequestVideoJobChanges,
  type HttpResult,
} from '../../client.js';
import { StatusPill } from '../Design/shadcn-components.js';

declare global {
  interface Window {
    BRAIN_CONSOLE_BUILD_ID: string;
  }
}

const REFRESH_INTERVAL_MS = 30_000;
const JOB_POLL_INTERVAL_MS = 10_000;
const PANEL_REQUEST_TIMEOUT_MS = 5_000;
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
  private lastRefreshTime: Date | null = null;
  private statusFetchStatus: 'ok' | 'error' | null = null;
  private jobsFetchStatus: 'ok' | 'error' | null = null;
  private lastStatusEndpointError: string | null = null;
  private lastJobsEndpointError: string | null = null;
  private listenersAttached = false;
  private refreshSequence = 0;
  private refreshPending: { status: boolean; jobs: boolean } | null = null;

  constructor(container: HTMLElement, baseUrl: string = 'http://localhost:4877') {
    this.container = container;
    this.baseUrl = baseUrl;
    this.attachEventListeners();
    this.render();
    void this.fetchLiveData();
    this.refreshTimer = setInterval(() => void this.fetchLiveData(), REFRESH_INTERVAL_MS);
  }

  private async fetchLiveData(): Promise<void> {
    const refreshId = ++this.refreshSequence;
    this.lastRefreshTime = new Date();
    this.statusFetchStatus = null;
    this.jobsFetchStatus = null;
    this.lastStatusEndpointError = null;
    this.lastJobsEndpointError = null;
    this.refreshPending = { status: true, jobs: true };
    this.loading = true;
    this.error = undefined;
    this.actionMessage = undefined;
    this.render();

    void this.fetchStatusForRefresh(refreshId);
  }

  private async fetchStatusForRefresh(refreshId: number): Promise<void> {
    try {
      const statusResult = await this.withPanelTimeout(
        () => readBrainCoreAwsVideoPipelineStatus(this.baseUrl),
        'GET',
        '/api/video-orchestrator/topic-intelligence/status',
      );
      if (!this.isCurrentRefresh(refreshId)) return;

      const statusData = this.normalizePipelineStatusData(statusResult.value);
      if (statusResult.error) {
        this.statusFetchStatus = 'error';
        this.lastStatusEndpointError = this.describeHttpError(statusResult);
        this.error = this.lastStatusEndpointError;
      } else if (statusData) {
        this.statusFetchStatus = 'ok';
        this.data = statusData;
        if (!this.draftChannelId && this.data.channels.length > 0) {
          this.draftChannelId = this.data.channels[0]?.channelId ?? '';
        }
        if (this.hydrateRecentJobsFromPipelineStatus(this.data)) {
          this.markRefreshPartDone(refreshId, 'jobs');
        } else {
          void this.fetchJobsForRefresh(refreshId);
        }
      } else {
        this.statusFetchStatus = 'error';
        this.lastStatusEndpointError = this.describeStatusError(statusResult.value);
        if (!this.error) this.error = this.lastStatusEndpointError;
        this.jobsFetchStatus = 'error';
        this.lastJobsEndpointError = 'Recent jobs unavailable because pipeline status did not return a usable payload';
        this.markRefreshPartDone(refreshId, 'jobs');
      }
    } catch (err) {
      if (!this.isCurrentRefresh(refreshId)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.statusFetchStatus = 'error';
      this.lastStatusEndpointError = message;
      this.jobsFetchStatus = 'error';
      this.lastJobsEndpointError = `Recent jobs unavailable because pipeline status failed: ${message}`;
      this.error = message;
      this.markRefreshPartDone(refreshId, 'jobs');
    } finally {
      this.markRefreshPartDone(refreshId, 'status');
    }
  }

  private async fetchJobsForRefresh(refreshId: number): Promise<void> {
    try {
      const jobsResult = await this.withPanelTimeout(
        () => this.fetchRecentJobs(),
        'GET',
        '/api/video-orchestrator/jobs/recent',
      );
      if (!this.isCurrentRefresh(refreshId)) return;

      if (jobsResult.error) {
        this.jobsFetchStatus = 'error';
        this.lastJobsEndpointError = this.describeHttpError(jobsResult);
        if (!this.error) this.error = this.lastJobsEndpointError;
      } else {
        this.jobsFetchStatus = 'ok';
        this.recentJobs = jobsResult.value ?? [];
        if (!this.selectedJobId && this.recentJobs.length > 0) {
          this.selectedJobId = this.recentJobs[0]?.jobId ?? null;
        }
        if (this.selectedJobId) {
          void this.loadJobDetail(this.selectedJobId, false);
        }
      }
    } catch (err) {
      if (!this.isCurrentRefresh(refreshId)) return;
      const message = err instanceof Error ? err.message : String(err);
      this.jobsFetchStatus = 'error';
      this.lastJobsEndpointError = message;
      this.error = message;
    } finally {
      this.markRefreshPartDone(refreshId, 'jobs');
    }
  }

  private async fetchRecentJobs(): Promise<HttpResult<BrainCoreVideoJobSummary[]>> {
    return readBrainCoreOperationalRecentVideoJobs(this.baseUrl);
  }

  private hydrateRecentJobsFromPipelineStatus(data: BrainCoreVideoOrchestratorStatusResponse['data']): boolean {
    if (!Array.isArray(data.recentJobs) || data.recentJobs.length === 0) return false;

    this.recentJobs = data.recentJobs.map((job) => ({
      jobId: job.jobId,
      channelId: job.channelId,
      title: job.videoId ? `Published video ${job.videoId}` : job.jobId,
      status: job.status as BrainCoreVideoJobSummary['status'],
      currentStep: null,
      progress: job.status === 'published' ? 100 : 0,
      createdAt: null,
      updatedAt: null,
      approval: {
        status: job.status === 'published' ? 'approved' : 'pending',
        required: true,
      },
      generation: {
        status: job.status === 'published' ? 'complete' : 'pending',
        executionArn: null,
        startedAt: null,
        completedAt: null,
      },
      publishing: {
        status: job.status === 'published' ? 'uploaded' : 'pending',
        videoId: job.videoId ?? null,
        url: job.videoId ? `https://www.youtube.com/watch?v=${job.videoId}` : null,
      },
      error: {
        step: null,
        message: null,
      },
      artifacts: {
        script: null,
        narration: null,
        finalVideo: null,
        thumbnail: null,
      },
    }));
    this.selectedJobId = this.recentJobs[0]?.jobId ?? null;
    this.selectedJob = null;
    this.selectedTimeline = null;
    this.jobsFetchStatus = 'ok';
    this.lastJobsEndpointError = null;
    return true;
  }

  private async withPanelTimeout<T>(
    requestFactory: () => Promise<HttpResult<T>>,
    method: 'GET' | 'POST',
    path: string,
  ): Promise<HttpResult<T>> {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<HttpResult<T>>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve({ error: `Brain Core request timed out after 5000ms: ${method} ${path}` });
      }, PANEL_REQUEST_TIMEOUT_MS);
    });

    try {
      return await Promise.race([Promise.resolve().then(requestFactory), timeoutResult]);
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  private isCurrentRefresh(refreshId: number): boolean {
    return refreshId === this.refreshSequence;
  }

  private markRefreshPartDone(refreshId: number, part: 'status' | 'jobs'): void {
    if (!this.isCurrentRefresh(refreshId) || !this.refreshPending) return;
    this.refreshPending[part] = false;
    if (!this.refreshPending.status && !this.refreshPending.jobs) {
      this.loading = false;
      this.refreshPending = null;
      if (this.selectedJobId) this.syncPollingState();
    }
    this.render();
  }

  private normalizePipelineStatusData(
    value: BrainCoreVideoOrchestratorStatusResponse | BrainCoreVideoOrchestratorStatusResponse['data'] | undefined,
  ): BrainCoreVideoOrchestratorStatusResponse['data'] | null {
    if (!value || typeof value !== 'object') return null;
    if ('channels' in value && Array.isArray(value.channels)) {
      return value as BrainCoreVideoOrchestratorStatusResponse['data'];
    }
    const wrappedData = (value as BrainCoreVideoOrchestratorStatusResponse).data;
    if (wrappedData && Array.isArray(wrappedData.channels)) {
      return wrappedData;
    }
    return null;
  }

  private async loadJobDetail(jobId: string, rerender = true): Promise<void> {
    this.jobLoading = true;
    if (rerender) this.render();
    try {
      const jobDetailRes = await readBrainCoreOperationalVideoJob(this.baseUrl, jobId);
      if (jobDetailRes.value) {
        this.selectedJob = jobDetailRes.value;
        this.selectedJobId = jobDetailRes.value.jobId;
        this.error = undefined;
      } else {
        this.selectedJob = null;
        this.selectedJobId = null;
        this.error = `Failed to load job ${jobId}: ${this.describeHttpError(jobDetailRes)}`;
      }

      const timelineRes = await readBrainCoreOperationalVideoJobTimeline(this.baseUrl, jobId);
      if (timelineRes.value) {
        this.selectedTimeline = timelineRes.value;
      } else {
        this.selectedTimeline = null;
        if (timelineRes.error && !this.error) {
          this.error = `Failed to load timeline for ${jobId}: ${this.describeHttpError(timelineRes)}`;
        }
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
        ${this.renderDiagnostics()}
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
  }

  private renderDiagnostics(): string {
    const buildId = (typeof window !== 'undefined' && window.BRAIN_CONSOLE_BUILD_ID) ? window.BRAIN_CONSOLE_BUILD_ID : 'unknown';
    const lastRefresh = this.lastRefreshTime ? this.lastRefreshTime.toLocaleTimeString() : 'never';
    const statusIcon = this.statusFetchStatus === 'ok' ? '✓' : this.statusFetchStatus === 'error' ? '✕' : '○';
    const jobsIcon = this.jobsFetchStatus === 'ok' ? '✓' : this.jobsFetchStatus === 'error' ? '✕' : '○';

    return `
      <div style="padding: 10px 12px; margin-bottom: 12px; background: var(--background-secondary); border: 1px solid var(--border-color); border-radius: 6px; font-size: 11px; color: var(--text-muted);">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px; margin-bottom: 6px;">
          <div><strong>Build:</strong> <code>${this.escapeHtml(buildId)}</code></div>
          <div><strong>Brain Core:</strong> <code>${this.escapeHtml(this.baseUrl)}</code></div>
          <div><strong>Last Refresh:</strong> ${this.escapeHtml(lastRefresh)}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">
          <div>${statusIcon} Status fetch: ${this.statusFetchStatus ?? 'pending'}</div>
          <div>${jobsIcon} Jobs fetch: ${this.jobsFetchStatus ?? 'pending'}</div>
          <div>Loaded jobs: ${this.recentJobs.length}</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 8px; margin-top: 6px;">
          <div><strong>Last status endpoint error:</strong> ${this.escapeHtml(this.lastStatusEndpointError ?? 'none')}</div>
          <div><strong>Last jobs endpoint error:</strong> ${this.escapeHtml(this.lastJobsEndpointError ?? 'none')}</div>
        </div>
      </div>
    `;
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
    if (this.listenersAttached) return;
    this.listenersAttached = true;
    // Use event delegation instead of querySelectorAll to handle re-renders
    this.container.onclick = (event) => {
      const target = event.target as HTMLElement;

      // Refresh button
      if (target.closest('[data-action="refresh-now"]')) {
        void this.fetchLiveData();
        return;
      }

      // Create draft modal open
      if (target.closest('[data-action="open-create-draft"]')) {
        this.showCreateDraftModal = true;
        this.render();
        return;
      }

      // Create draft modal close
      if (target.closest('[data-action="close-create-draft"]')) {
        this.showCreateDraftModal = false;
        this.draftSubmitting = false;
        this.render();
        return;
      }

      // Create draft modal submit
      if (target.closest('[data-action="submit-create-draft"]')) {
        void this.createDraftFromModal();
        return;
      }

      // Generate job
      const generateBtn = target.closest('[data-action="generate-job"]') as HTMLElement | null;
      if (generateBtn) {
        const jobId = generateBtn.dataset.jobId;
        if (jobId) void this.generateJob(jobId);
        return;
      }

      // Approve job
      const approveBtn = target.closest('[data-action="approve-job"]') as HTMLElement | null;
      if (approveBtn) {
        const jobId = approveBtn.dataset.jobId;
        if (jobId) void this.approveJob(jobId);
        return;
      }

      // Request changes
      const changesBtn = target.closest('[data-action="request-changes"]') as HTMLElement | null;
      if (changesBtn) {
        const jobId = changesBtn.dataset.jobId;
        if (jobId) void this.requestChanges(jobId);
        return;
      }

      // Job row selection. Keep this last so action buttons with data-job-id
      // do not get interpreted as row navigation.
      const jobRow = target.closest('.aws-video-job-row[data-job-id]') as HTMLElement | null;
      if (jobRow) {
        const jobId = jobRow.dataset.jobId;
        if (jobId) void this.loadJobDetail(jobId);
      }
    };

    // Handle change/input events with delegation
    this.container.onchange = (event) => {
      const target = event.target as HTMLElement;
      if (target.id === 'aws-video-draft-channel') {
        this.draftChannelId = (target as HTMLSelectElement).value;
      }
    };

    this.container.oninput = (event) => {
      const target = event.target as HTMLElement;
      if (target.id === 'aws-video-draft-prompt') {
        this.draftPrompt = (target as HTMLTextAreaElement).value;
        this.render();
      }
    };
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
    const response = await requestBrainCoreOperationalGenerateVideoJob(this.baseUrl, jobId);
    if (response.error) {
      this.error = `Generate request failed for ${jobId}: ${this.describeHttpError(response)}`;
    } else {
      this.actionMessage = `Generation requested for ${jobId}`;
      this.error = undefined;
    }
    await this.loadJobDetail(jobId);
  }

  private async approveJob(jobId: string): Promise<void> {
    const response = await requestBrainCoreOperationalApproveVideoJob(this.baseUrl, jobId);
    if (response.error) {
      this.error = `Approve failed for ${jobId}: ${this.describeHttpError(response)}`;
    } else {
      this.actionMessage = `Approved ${jobId}`;
      this.error = undefined;
    }
    await this.loadJobDetail(jobId);
  }

  private async requestChanges(jobId: string): Promise<void> {
    const notes = prompt('Request changes notes:') ?? '';
    if (!notes.trim()) return;
    const response = await requestBrainCoreOperationalRequestVideoJobChanges(this.baseUrl, jobId, notes.trim());
    if (response.error) {
      this.error = `Request changes failed for ${jobId}: ${this.describeHttpError(response)}`;
    } else {
      this.actionMessage = `Changes requested for ${jobId}`;
      this.error = undefined;
    }
    await this.loadJobDetail(jobId);
  }

  private describeHttpError(result: HttpResult<unknown>): string {
    const base = result.error ?? `HTTP ${result.status ?? 'unknown'}`;
    const detail = result.detail ? ` · ${result.detail}` : '';
    return `${base}${detail}`;
  }

  private describeStatusError(
    value: BrainCoreVideoOrchestratorStatusResponse | BrainCoreVideoOrchestratorStatusResponse['data'] | undefined,
  ): string {
    if (value && typeof value === 'object' && 'error' in value && value.error) {
      return String(value.error);
    }
    return 'Failed to fetch pipeline status';
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
