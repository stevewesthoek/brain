const BASE_URL = 'http://localhost:4877';

type FeedbackSummary = {
  ok: boolean;
  projectId: string;
  outcomes: Array<{
    id: string;
    projectId: string;
    packageId: string;
    status: 'succeeded' | 'failed';
    thumbnailVariant?: string;
    metadataVariant?: string;
    note?: string;
    createdAt: string;
  }>;
  metrics: Array<{
    id: string;
    projectId: string;
    packageId: string;
    views24h: number;
    ctr: number;
    engagementRate: number;
    thumbnailVariant?: string;
    metadataVariant?: string;
    createdAt: string;
  }>;
  recommendation: {
    bestThumbnailVariant?: string;
    bestMetadataVariant?: string;
    note: string;
  };
};

export class FeedbackLoopPanel {
  private container: HTMLElement;
  private projectId: string;
  private summary: FeedbackSummary | null = null;
  private refreshInterval: number | null = null;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.render();
    await this.load();
    this.startAutoRefresh();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-feedback-loop">
        <div class="vo-panel-header">
          <h3>Feedback Loop</h3>
          <button class="vo-btn-secondary" id="feedback-refresh">Refresh</button>
        </div>
        <div id="feedback-summary" class="vo-feedback-summary">
          <div class="vo-empty-state">Loading feedback...</div>
        </div>
      </div>
    `;
    this.container.querySelector('#feedback-refresh')?.addEventListener('click', () => {
      void this.load();
    });
  }

  private async load(): Promise<void> {
    try {
      const res = await fetch(`${BASE_URL}/api/video-orchestrator/analytics/feedback?projectId=${encodeURIComponent(this.projectId)}`);
      this.summary = await res.json() as FeedbackSummary;
      this.renderSummary();
    } catch {
      const el = this.container.querySelector('#feedback-summary');
      if (el) el.innerHTML = '<div class="vo-empty-state">Failed to load feedback.</div>';
    }
  }

  private renderSummary(): void {
    const el = this.container.querySelector('#feedback-summary');
    if (!el || !this.summary) return;

    const { outcomes, metrics, recommendation } = this.summary;
    el.innerHTML = `
      <div class="vo-feedback-card">
        <div class="vo-feedback-label">Recommendation</div>
        <div class="vo-feedback-value">${this.escapeHtml(recommendation.note)}</div>
        <div class="vo-feedback-subvalue">Thumbnail: ${this.escapeHtml(recommendation.bestThumbnailVariant ?? '—')}</div>
        <div class="vo-feedback-subvalue">Metadata: ${this.escapeHtml(recommendation.bestMetadataVariant ?? '—')}</div>
      </div>
      <div class="vo-feedback-grid">
        <div class="vo-feedback-card">
          <div class="vo-feedback-label">Outcomes</div>
          <div class="vo-feedback-value">${outcomes.length}</div>
          <div class="vo-feedback-subvalue">Publish success/failure records</div>
        </div>
        <div class="vo-feedback-card">
          <div class="vo-feedback-label">Metrics</div>
          <div class="vo-feedback-value">${metrics.length}</div>
          <div class="vo-feedback-subvalue">24h performance snapshots</div>
        </div>
      </div>
      <div class="vo-feedback-list">
        ${metrics.map((metric) => `
          <div class="vo-feedback-row">
            <div class="vo-feedback-row-main">
              <div class="vo-feedback-row-title">${this.escapeHtml(metric.packageId)}</div>
              <div class="vo-feedback-row-meta">
                CTR ${metric.ctr.toFixed(2)}% · Views ${metric.views24h} · Engagement ${metric.engagementRate.toFixed(2)}%
              </div>
            </div>
            <div class="vo-feedback-row-tags">
              ${metric.thumbnailVariant ? `<span class="vo-status-badge vo-status-done">${this.escapeHtml(metric.thumbnailVariant)}</span>` : ''}
              ${metric.metadataVariant ? `<span class="vo-status-badge vo-status-done">${this.escapeHtml(metric.metadataVariant)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = window.setInterval(() => void this.load(), 60000);
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  destroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.container.innerHTML = '';
  }
}
