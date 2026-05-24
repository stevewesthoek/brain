export interface PublishingMetrics {
  totalPublished: number;
  thisWeek: number;
  thisMonth: number;
  avgTimeToPublish: number;
  platformBreakdown: Record<string, number>;
  failureRate: number;
}

export interface PublishingJob {
  id: string;
  packageId: string;
  platformId: string;
  accountId: string;
  status: string;
  scheduledAt?: string;
  publishedAt?: string;
  publishedUrl?: string;
  error?: string;
}

export class PublishingDashboardPanel {
  private container: HTMLElement;
  private metrics: PublishingMetrics | null = null;
  private jobs: PublishingJob[] = [];
  private projectId: string;
  private refreshInterval: number | null = null;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.render();
    await this.loadMetrics();
    await this.loadPublishingQueue();
    this.startAutoRefresh();
  }

  private render(): void {
    const html = `
      <div class="vo-publishing-dashboard">
        <div class="vo-panel-header">
          <h3>Publishing Dashboard</h3>
          <button class="vo-btn-secondary" id="publish-refresh">Refresh</button>
        </div>

        <div class="vo-metrics-grid" id="metrics-grid">
          <div class="vo-metric-card">
            <span class="vo-metric-label">Total Published</span>
            <span class="vo-metric-value" id="metric-total">—</span>
          </div>
          <div class="vo-metric-card">
            <span class="vo-metric-label">This Week</span>
            <span class="vo-metric-value" id="metric-week">—</span>
          </div>
          <div class="vo-metric-card">
            <span class="vo-metric-label">Avg Time</span>
            <span class="vo-metric-value" id="metric-avgtime">—</span>
          </div>
          <div class="vo-metric-card">
            <span class="vo-metric-label">Failure Rate</span>
            <span class="vo-metric-value" id="metric-failure">—</span>
          </div>
        </div>

        <div class="vo-section">
          <h4>Platform Breakdown</h4>
          <div class="vo-platform-breakdown" id="platform-breakdown"></div>
        </div>

        <div class="vo-section">
          <h4>Publishing Queue</h4>
          <div class="vo-queue-table" id="queue-table">
            <div class="vo-empty-state">Loading...</div>
          </div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    const refreshBtn = this.container.querySelector('#publish-refresh');
    refreshBtn?.addEventListener('click', async () => {
      await this.loadMetrics();
      await this.loadPublishingQueue();
    });
  }

  private async loadMetrics(): Promise<void> {
    try {
      const response = await fetch(
        `/api/video-orchestrator/analytics/publishing?projectId=${this.projectId}`,
      );
      const data = await response.json();

      if (data.ok && data.metrics) {
        this.metrics = data.metrics;
        this.updateMetricsDisplay();
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    }
  }

  private updateMetricsDisplay(): void {
    if (!this.metrics) return;

    const updateEl = (id: string, value: unknown) => {
      const el = this.container.querySelector(id);
      if (el) {
        if (typeof value === 'number') {
          if (id.includes('avgtime')) {
            el.textContent = value > 0 ? `${Math.round(value)}m` : '—';
          } else if (id.includes('failure')) {
            el.textContent = `${(value * 100).toFixed(1)}%`;
          } else {
            el.textContent = String(value);
          }
        }
      }
    };

    updateEl('#metric-total', this.metrics.totalPublished);
    updateEl('#metric-week', this.metrics.thisWeek);
    updateEl('#metric-avgtime', this.metrics.avgTimeToPublish);
    updateEl('#metric-failure', this.metrics.failureRate);

    this.renderPlatformBreakdown();
  }

  private renderPlatformBreakdown(): void {
    if (!this.metrics) return;

    const breakdownEl = this.container.querySelector('#platform-breakdown');
    if (!breakdownEl) return;

    const platforms = Object.entries(this.metrics.platformBreakdown);

    if (platforms.length === 0) {
      breakdownEl.innerHTML = '<p class="vo-empty-state">No platform data</p>';
      return;
    }

    const maxCount = Math.max(...platforms.map(([, count]) => count), 1);

    const html = platforms
      .map(
        ([platform, count]) => `
      <div class="vo-platform-item">
        <span class="vo-platform-name">${platform}</span>
        <div class="vo-platform-bar">
          <div class="vo-platform-fill" style="width: ${(count / maxCount) * 100}%"></div>
        </div>
        <span class="vo-platform-count">${count}</span>
      </div>
    `,
      )
      .join('');

    breakdownEl.innerHTML = html;
  }

  private async loadPublishingQueue(): Promise<void> {
    try {
      const response = await fetch(
        `/api/video-orchestrator/publishing/queue?projectId=${this.projectId}`,
      );
      const data = await response.json();

      if (data.ok) {
        this.jobs = data.jobs || [];
        this.renderQueue();
      }
    } catch (error) {
      console.error('Failed to load publishing queue:', error);
    }
  }

  private renderQueue(): void {
    const tableEl = this.container.querySelector('#queue-table');
    if (!tableEl) return;

    if (this.jobs.length === 0) {
      tableEl.innerHTML = '<div class="vo-empty-state">No publishing jobs</div>';
      return;
    }

    const rows = this.jobs
      .map(
        (job) => `
      <div class="vo-queue-row">
        <div class="vo-queue-col">${job.packageId}</div>
        <div class="vo-queue-col">${job.platformId}</div>
        <div class="vo-queue-col">
          <span class="vo-status-badge vo-status-${job.status}">${job.status}</span>
        </div>
        <div class="vo-queue-col">${job.publishedAt ? new Date(job.publishedAt).toLocaleDateString() : '—'}</div>
      </div>
    `,
      )
      .join('');

    tableEl.innerHTML = `
      <div class="vo-queue-header">
        <div class="vo-queue-col">Package</div>
        <div class="vo-queue-col">Platform</div>
        <div class="vo-queue-col">Status</div>
        <div class="vo-queue-col">Published</div>
      </div>
      ${rows}
    `;
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = window.setInterval(async () => {
      await this.loadMetrics();
      await this.loadPublishingQueue();
    }, 60000); // Refresh every 60 seconds
  }

  destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.container.innerHTML = '';
  }
}
