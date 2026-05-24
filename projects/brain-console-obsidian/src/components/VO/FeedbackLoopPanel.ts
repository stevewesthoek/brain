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

type VariantAggregate = {
  key: string;
  avgCtr: number;
  totalViews: number;
  count: number;
};

type PackageAggregate = {
  packageId: string;
  views24h: number;
  avgCtr: number;
  avgEngagementRate: number;
  snapshotCount: number;
  thumbnailVariant?: string;
  metadataVariant?: string;
  latestAt: string;
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
    const packageCards = this.buildPackageAggregates(metrics);
    const summary7d = this.buildWindowSummary(metrics, 7);
    const summary30d = this.buildWindowSummary(metrics, 30);
    const thumbnailStatus = this.buildThumbnailStatus(metrics, recommendation.bestThumbnailVariant);
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
      <div class="vo-feedback-grid vo-feedback-grid--triple">
        <div class="vo-feedback-card">
          <div class="vo-feedback-label">Channel Summary · 7d</div>
          <div class="vo-feedback-value">${summary7d.totalViews}</div>
          <div class="vo-feedback-subvalue">Views</div>
          <div class="vo-feedback-subvalue">Avg CTR ${summary7d.avgCtr.toFixed(2)}% · ${summary7d.snapshotCount} snapshot(s)</div>
        </div>
        <div class="vo-feedback-card">
          <div class="vo-feedback-label">Channel Summary · 30d</div>
          <div class="vo-feedback-value">${summary30d.totalViews}</div>
          <div class="vo-feedback-subvalue">Views</div>
          <div class="vo-feedback-subvalue">Avg CTR ${summary30d.avgCtr.toFixed(2)}% · ${summary30d.snapshotCount} snapshot(s)</div>
        </div>
        <div class="vo-feedback-card">
          <div class="vo-feedback-label">Thumbnail A/B Status</div>
          <div class="vo-feedback-value">${this.escapeHtml(thumbnailStatus.label)}</div>
          <div class="vo-feedback-subvalue">${this.escapeHtml(thumbnailStatus.detail)}</div>
          <div class="vo-feedback-subvalue">${this.escapeHtml(thumbnailStatus.secondary)}</div>
        </div>
      </div>
      <div class="vo-feedback-card vo-feedback-card--manual">
        <div class="vo-feedback-label">YouTube Test & Compare</div>
        <div class="vo-feedback-value">Manual in YouTube Studio</div>
        <div class="vo-feedback-subvalue">No public developer API is currently wired for starting or reading thumbnail experiments.</div>
        <div class="vo-feedback-subvalue">Operator flow: open YouTube Studio on desktop, use Thumbnail → Test & compare, upload up to 3 thumbnails, then review Reach analytics.</div>
      </div>
      <div class="vo-feedback-section">
        <div class="vo-feedback-section-title">Per-Video Performance</div>
        <div class="vo-feedback-video-grid">
          ${packageCards.length > 0 ? packageCards.map((card) => `
            <div class="vo-feedback-card vo-feedback-card--video">
              <div class="vo-feedback-label">${this.escapeHtml(card.packageId)}</div>
              <div class="vo-feedback-value">${card.views24h}</div>
              <div class="vo-feedback-subvalue">Views · Avg CTR ${card.avgCtr.toFixed(2)}%</div>
              <div class="vo-feedback-subvalue">Engagement ${card.avgEngagementRate.toFixed(2)}% · ${card.snapshotCount} snapshot(s)</div>
              <div class="vo-feedback-subvalue">Thumbnail ${this.escapeHtml(card.thumbnailVariant ?? '—')} · Metadata ${this.escapeHtml(card.metadataVariant ?? '—')}</div>
            </div>
          `).join('') : '<div class="vo-empty-state">No per-video metrics recorded yet.</div>'}
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

  private buildPackageAggregates(metrics: FeedbackSummary['metrics']): PackageAggregate[] {
    const byPackage = new Map<string, PackageAggregate>();
    for (const metric of metrics) {
      const current = byPackage.get(metric.packageId) ?? {
        packageId: metric.packageId,
        views24h: 0,
        avgCtr: 0,
        avgEngagementRate: 0,
        snapshotCount: 0,
        thumbnailVariant: metric.thumbnailVariant,
        metadataVariant: metric.metadataVariant,
        latestAt: metric.createdAt,
      };
      current.views24h += metric.views24h;
      current.avgCtr += metric.ctr;
      current.avgEngagementRate += metric.engagementRate;
      current.snapshotCount += 1;
      current.thumbnailVariant = current.thumbnailVariant ?? metric.thumbnailVariant;
      current.metadataVariant = current.metadataVariant ?? metric.metadataVariant;
      if (new Date(metric.createdAt).getTime() > new Date(current.latestAt).getTime()) {
        current.latestAt = metric.createdAt;
      }
      byPackage.set(metric.packageId, current);
    }

    return Array.from(byPackage.values())
      .map((entry) => ({
        ...entry,
        avgCtr: entry.snapshotCount > 0 ? entry.avgCtr / entry.snapshotCount : 0,
        avgEngagementRate: entry.snapshotCount > 0 ? entry.avgEngagementRate / entry.snapshotCount : 0,
      }))
      .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());
  }

  private buildWindowSummary(metrics: FeedbackSummary['metrics'], days: number): { totalViews: number; avgCtr: number; snapshotCount: number } {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const filtered = metrics.filter((metric) => new Date(metric.createdAt).getTime() >= cutoff);
    const totalViews = filtered.reduce((sum, metric) => sum + metric.views24h, 0);
    const totalCtr = filtered.reduce((sum, metric) => sum + metric.ctr, 0);
    return {
      totalViews,
      avgCtr: filtered.length > 0 ? totalCtr / filtered.length : 0,
      snapshotCount: filtered.length,
    };
  }

  private buildThumbnailStatus(metrics: FeedbackSummary['metrics'], winner?: string): { label: string; detail: string; secondary: string } {
    const variants = this.buildVariantAggregates(metrics);
    if (variants.length === 0) {
      return {
        label: 'No test data',
        detail: 'No thumbnail metrics recorded yet.',
        secondary: 'Record metrics before declaring a winner.',
      };
    }

    if (winner) {
      const winnerStats = variants.find((variant) => variant.key === winner);
      return {
        label: 'Winner available',
        detail: `${winner} leads at ${winnerStats?.avgCtr.toFixed(2) ?? '0.00'}% CTR.`,
        secondary: `${variants.length} variant(s) compared.`,
      };
    }

    const leader = variants[0]!;
    return {
      label: 'Test active',
      detail: `${leader.key} currently leads at ${leader.avgCtr.toFixed(2)}% CTR.`,
      secondary: `${variants.length} variant(s) tracked, winner not declared.`,
    };
  }

  private buildVariantAggregates(metrics: FeedbackSummary['metrics']): VariantAggregate[] {
    const variants = new Map<string, { ctr: number; views: number; count: number }>();
    for (const metric of metrics) {
      if (!metric.thumbnailVariant) continue;
      const current = variants.get(metric.thumbnailVariant) ?? { ctr: 0, views: 0, count: 0 };
      current.ctr += metric.ctr;
      current.views += metric.views24h;
      current.count += 1;
      variants.set(metric.thumbnailVariant, current);
    }
    return Array.from(variants.entries())
      .map(([key, value]) => ({
        key,
        avgCtr: value.count > 0 ? value.ctr / value.count : 0,
        totalViews: value.views,
        count: value.count,
      }))
      .sort((a, b) => b.avgCtr - a.avgCtr);
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
