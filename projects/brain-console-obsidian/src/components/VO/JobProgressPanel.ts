const BASE_URL = 'http://localhost:4877';

interface InfraVOJob {
  jobId: string;
  jobType: string;
  jobStatus: string;
  pipelineState: string;
  adapterMode: string | null;
  platform: string | null;
  accountHandle: string | null;
  title: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function normalizeStatus(job: InfraVOJob): 'pending' | 'processing' | 'awaiting-approval' | 'done' | 'failed' {
  if (job.jobStatus === 'pending') return 'pending';
  if (job.jobStatus === 'failed' || job.jobStatus === 'dead') return 'failed';
  if (job.jobStatus === 'succeeded') return 'done';
  if (job.jobStatus === 'running' && job.pipelineState === 'awaiting-approval') {
    return 'awaiting-approval';
  }
  if (job.pipelineState === 'approved' || job.pipelineState === 'awaiting-approval') {
    return 'awaiting-approval';
  }
  return 'processing';
}

function estimateProgress(job: InfraVOJob): number {
  switch (normalizeStatus(job)) {
    case 'pending':
      return 0;
    case 'awaiting-approval':
      return 55;
    case 'processing':
      return 65;
    case 'done':
      return 100;
    case 'failed':
      return 100;
  }
}

export class JobProgressPanel {
  private container: HTMLElement;
  private projectId: string;
  private jobs: InfraVOJob[] = [];
  private refreshInterval: number | null = null;
  private isLoading = false;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.renderShell();
    await this.loadJobs();
    this.startAutoRefresh();
  }

  private renderShell(): void {
    this.container.innerHTML = `
      <div class="vo-job-progress">
        <div class="vo-panel-header">
          <h3>Job Progress</h3>
          <button class="vo-btn-secondary" id="job-progress-refresh">Refresh</button>
        </div>
        <div class="vo-job-progress-subtitle">Composition, subtitles, thumbnails, metadata, and publishing jobs.</div>
        <div class="vo-jobs-list" id="jobs-list">
          <div class="vo-empty-state">Loading jobs...</div>
        </div>
      </div>
    `;

    this.container.querySelector('#job-progress-refresh')?.addEventListener('click', () => {
      void this.loadJobs();
    });
  }

  private async loadJobs(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    const listEl = this.container.querySelector('#jobs-list');
    if (listEl && this.jobs.length === 0) {
      listEl.innerHTML = '<div class="vo-empty-state">Loading jobs...</div>';
    }

    try {
      const qs = this.projectId ? `?projectId=${encodeURIComponent(this.projectId)}` : '';
      const res = await fetch(`${BASE_URL}/api/infra/video-orchestrator/jobs${qs}`);
      const data = await res.json() as { ok?: boolean; jobs?: InfraVOJob[] };
      this.jobs = Array.isArray(data.jobs) ? data.jobs : [];
      this.renderJobs();
    } catch {
      if (listEl) {
        listEl.innerHTML = '<div class="vo-empty-state">Failed to load jobs.</div>';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private renderJobs(): void {
    const listEl = this.container.querySelector('#jobs-list');
    if (!listEl) return;

    if (this.jobs.length === 0) {
      listEl.innerHTML = '<div class="vo-empty-state">No jobs found for this project.</div>';
      return;
    }

    listEl.innerHTML = this.jobs.map((job) => this.renderJobCard(job)).join('');
  }

  private renderJobCard(job: InfraVOJob): string {
    const normalizedStatus = normalizeStatus(job);
    const progress = estimateProgress(job);
    const approvalLabel = normalizedStatus === 'awaiting-approval'
      ? 'Awaiting Operator Decision'
      : normalizedStatus === 'processing'
        ? 'Processing'
        : normalizedStatus === 'done'
          ? 'Completed'
          : normalizedStatus === 'failed'
            ? 'Failed'
            : 'Pending';
    const errorHtml = job.errorMessage
      ? `<div class="vo-job-error">${job.errorMessage}</div>`
      : '';

    return `
      <article class="vo-job-card vo-job-card--${normalizedStatus}" data-job-id="${job.jobId}">
        <div class="vo-job-card__header">
          <div>
            <div class="vo-job-card__title">${job.title ?? `Job ${job.jobId}`}</div>
            <div class="vo-job-card__meta">${job.jobType}${job.platform ? ` • ${job.platform}` : ''}${job.accountHandle ? ` • @${job.accountHandle}` : ''}</div>
          </div>
          <span class="vo-status-badge vo-status-${normalizedStatus}">${approvalLabel}</span>
        </div>

        <div class="vo-job-card__progress">
          <div class="vo-progress-bar-wrap">
            <div class="vo-progress-bar-fill" style="width: ${progress}%"></div>
          </div>
          <span class="vo-progress-label">${progress}%</span>
        </div>

        <div class="vo-job-card__details">
          <div><span class="vo-job-card__label">Stage</span> ${job.pipelineState}</div>
          <div><span class="vo-job-card__label">Adapter</span> ${job.adapterMode ?? '—'}</div>
          <div><span class="vo-job-card__label">Created</span> ${formatDate(job.createdAt)}</div>
          <div><span class="vo-job-card__label">Completed</span> ${job.completedAt ? formatDate(job.completedAt) : '—'}</div>
        </div>

        ${errorHtml}
      </article>
    `;
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
    }
    this.refreshInterval = window.setInterval(() => {
      void this.loadJobs();
    }, 30000);
  }

  destroy(): void {
    if (this.refreshInterval) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.container.innerHTML = '';
  }
}
