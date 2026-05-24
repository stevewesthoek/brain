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

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export class DeadLetterReviewPanel {
  private container: HTMLElement;
  private projectId: string;
  private jobs: InfraVOJob[] = [];
  private isLoading = false;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.renderShell();
    await this.loadJobs();
  }

  private renderShell(): void {
    this.container.innerHTML = `
      <div class="vo-dead-letter">
        <div class="vo-panel-header">
          <h3>Dead Letter Review</h3>
          <button class="vo-btn-secondary" id="dead-letter-refresh">Refresh</button>
        </div>
        <div class="vo-dead-letter__subtitle">Jobs that exhausted worker retries and require operator review before requeueing.</div>
        <div class="vo-dead-letter__list" id="dead-letter-list">
          <div class="vo-empty-state">Loading dead jobs...</div>
        </div>
      </div>
    `;

    this.container.querySelector('#dead-letter-refresh')?.addEventListener('click', () => {
      void this.loadJobs();
    });
  }

  private async loadJobs(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const url = `${BASE_URL}/api/infra/video-orchestrator/jobs?projectId=${encodeURIComponent(this.projectId)}&status=dead&limit=50`;
      const res = await fetch(url);
      const data = await res.json() as { jobs?: InfraVOJob[] };
      this.jobs = Array.isArray(data.jobs) ? data.jobs : [];
      this.renderJobs();
    } catch {
      const listEl = this.container.querySelector('#dead-letter-list');
      if (listEl) {
        listEl.innerHTML = '<div class="vo-empty-state">Failed to load dead jobs.</div>';
      }
    } finally {
      this.isLoading = false;
    }
  }

  private renderJobs(): void {
    const listEl = this.container.querySelector('#dead-letter-list');
    if (!listEl) return;

    if (this.jobs.length === 0) {
      listEl.innerHTML = '<div class="vo-empty-state">No dead jobs in the queue.</div>';
      return;
    }

    listEl.innerHTML = this.jobs.map((job) => `
      <article class="vo-dead-letter__card">
        <div class="vo-dead-letter__header">
          <div>
            <div class="vo-dead-letter__title">${this.escapeHtml(job.title ?? `Job ${job.jobId}`)}</div>
            <div class="vo-dead-letter__meta">${this.escapeHtml(job.jobType)}${job.platform ? ` • ${this.escapeHtml(job.platform)}` : ''}${job.accountHandle ? ` • ${this.escapeHtml(job.accountHandle)}` : ''}</div>
          </div>
          <span class="vo-status-badge vo-status-failed">Dead</span>
        </div>

        <div class="vo-dead-letter__grid">
          <div><span class="vo-dead-letter__label">Job ID</span><span class="vo-dead-letter__value vo-monospace">${this.escapeHtml(job.jobId)}</span></div>
          <div><span class="vo-dead-letter__label">Pipeline State</span><span class="vo-dead-letter__value">${this.escapeHtml(job.pipelineState)}</span></div>
          <div><span class="vo-dead-letter__label">Adapter</span><span class="vo-dead-letter__value">${this.escapeHtml(job.adapterMode ?? '—')}</span></div>
          <div><span class="vo-dead-letter__label">Created</span><span class="vo-dead-letter__value">${this.escapeHtml(formatDate(job.createdAt))}</span></div>
          <div><span class="vo-dead-letter__label">Completed</span><span class="vo-dead-letter__value">${this.escapeHtml(formatDate(job.completedAt))}</span></div>
        </div>

        <div class="vo-dead-letter__error">
          <div class="vo-dead-letter__label">Error</div>
          <div class="vo-dead-letter__error-text">${this.escapeHtml(job.errorMessage ?? 'No error message recorded.')}</div>
        </div>

        <div class="vo-dead-letter__actions">
          <div class="vo-dead-letter__action-note">Review the failure context, fix the underlying cause, then requeue from the package or worker workflow.</div>
        </div>
      </article>
    `).join('');
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
