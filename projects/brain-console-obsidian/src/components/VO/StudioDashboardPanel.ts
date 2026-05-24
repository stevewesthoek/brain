type PipelineHealth = {
  score: number;
  status: 'healthy' | 'degraded' | 'critical';
  components: Record<string, { score: number; status: string }>;
};

type RoutingStatEntry = {
  platform: string;
  mappingCount: number;
  eventTypes: string[];
  lastRoutedAt: string;
};

type WebhookDeliveryRates = {
  successCount: number;
  failureCount: number;
  pendingCount: number;
  successRate: number;
};

type EventEntry = {
  id: string;
  type: string;
  actor: string;
  at: string;
  status: string;
};

type ApiResponse<T> = {
  ok: boolean;
  [key: string]: unknown;
} & T;

export class StudioDashboardPanel {
  private container: HTMLElement;
  private projectId: string;
  private refreshInterval: number | null = null;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.render();
    await this.loadAll();
    this.startAutoRefresh();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-dashboard-panel">
        <div class="vo-panel-header">
          <h2>VO Studio Dashboard</h2>
          <button class="vo-btn-secondary" id="dashboard-refresh">Refresh</button>
        </div>

        <div class="vo-overview-card">
          <div class="vo-overview-title">Pipeline Health</div>
          <div class="vo-health-grid" id="dashboard-health-grid">
            <div class="vo-health-indicator">
              <div class="vo-health-score" id="health-score-value">—</div>
              <div class="vo-health-badge" id="health-status-badge">—</div>
            </div>
          </div>
        </div>

        <div class="vo-overview-card">
          <div class="vo-overview-title">Routing Statistics</div>
          <div class="vo-activity-grid" id="dashboard-routing-grid">
            <div class="vo-activity-stat">
              <span class="vo-stat-label">Platforms</span>
              <span class="vo-stat-value" id="routing-platform-count">—</span>
            </div>
            <div class="vo-activity-stat">
              <span class="vo-stat-label">Mapped Events</span>
              <span class="vo-stat-value" id="routing-event-count">—</span>
            </div>
            <div class="vo-activity-stat">
              <span class="vo-stat-label">Last Route</span>
              <span class="vo-stat-value" id="routing-last-at">—</span>
            </div>
          </div>
        </div>

        <div class="vo-overview-card">
          <div class="vo-overview-title">Webhook Summary</div>
          <div class="vo-stats-table" id="dashboard-webhook-table">
            <div class="vo-stat-row">
              <span class="vo-stat-key">Success</span>
              <span class="vo-stat-value" id="webhook-success">—</span>
            </div>
            <div class="vo-stat-row">
              <span class="vo-stat-key">Failures</span>
              <span class="vo-stat-value" id="webhook-failure">—</span>
            </div>
            <div class="vo-stat-row">
              <span class="vo-stat-key">Rate</span>
              <span class="vo-stat-value" id="webhook-rate">—%</span>
            </div>
          </div>
        </div>

        <div class="vo-overview-card">
          <div class="vo-overview-title">Recent Events</div>
          <div id="dashboard-events-list" class="vo-event-list-preview">
            <!-- Events will be populated here -->
          </div>
        </div>

        <div class="vo-overview-card">
          <div class="vo-overview-title">Quick Actions</div>
          <div class="vo-quick-actions">
            <button class="vo-btn-secondary" data-tab="approvals">Approvals Queue</button>
            <button class="vo-btn-secondary" data-tab="packages">Package Status</button>
            <button class="vo-btn-secondary" data-tab="publishing">Publishing</button>
            <button class="vo-btn-secondary" data-tab="events">Event Log</button>
            <button class="vo-btn-secondary" data-tab="webhooks">Webhooks</button>
          </div>
        </div>
      </div>
    `;

    const refreshBtn = this.container.querySelector('#dashboard-refresh') as HTMLButtonElement;
    refreshBtn?.addEventListener('click', () => {
      this.loadAll();
    });
  }

  private async loadAll(): Promise<void> {
    await Promise.allSettled([
      this.loadHealth(),
      this.loadRoutingStats(),
      this.loadWebhookSummary(),
      this.loadRecentEvents(),
    ]);
  }

  private async loadHealth(): Promise<void> {
    try {
      const res = await fetch(`/api/video-orchestrator/analytics/pipeline-health?projectId=${encodeURIComponent(this.projectId)}`);
      const data = (await res.json()) as ApiResponse<{ health?: PipelineHealth }>;

      if (data.ok && data.health) {
        const scoreEl = this.container.querySelector('#health-score-value');
        const badgeEl = this.container.querySelector('#health-status-badge');

        if (scoreEl) {
          scoreEl.textContent = data.health.score.toString();
          scoreEl.className = `vo-health-score vo-health-score-${data.health.status}`;
        }
        if (badgeEl) {
          badgeEl.textContent = data.health.status;
          badgeEl.className = `vo-health-badge vo-status-${data.health.status}`;
        }
      }
    } catch (error) {
      // Silently fail for dashboard (non-blocking)
    }
  }

  private async loadRoutingStats(): Promise<void> {
    try {
      const res = await fetch(`/api/video-orchestrator/analytics/routing-statistics?projectId=${encodeURIComponent(this.projectId)}`);
      const data = (await res.json()) as ApiResponse<{ stats?: RoutingStatEntry[] }>;

      if (data.ok && data.stats) {
        const stats = (data.stats as RoutingStatEntry[]) || [];
        const platformCountEl = this.container.querySelector('#routing-platform-count');
        const eventCountEl = this.container.querySelector('#routing-event-count');
        const lastAtEl = this.container.querySelector('#routing-last-at');

        if (platformCountEl) {
          platformCountEl.textContent = stats.length.toString();
        }
        if (eventCountEl) {
          const totalEvents = stats.reduce((sum, s) => sum + (s.mappingCount || 0), 0);
          eventCountEl.textContent = totalEvents.toString();
        }
        if (lastAtEl && stats.length > 0) {
          const lastEntry = stats[0];
          lastAtEl.textContent = new Date(lastEntry.lastRoutedAt).toLocaleTimeString();
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  private async loadWebhookSummary(): Promise<void> {
    try {
      const res = await fetch(`/api/video-orchestrator/analytics/webhook-delivery-rates?projectId=${encodeURIComponent(this.projectId)}`);
      const data = (await res.json()) as ApiResponse<{ metrics?: WebhookDeliveryRates }>;

      if (data.ok && data.metrics) {
        const metrics = data.metrics as WebhookDeliveryRates;
        const successEl = this.container.querySelector('#webhook-success');
        const failureEl = this.container.querySelector('#webhook-failure');
        const rateEl = this.container.querySelector('#webhook-rate');

        if (successEl) {
          successEl.textContent = metrics.successCount.toString();
        }
        if (failureEl) {
          failureEl.textContent = metrics.failureCount.toString();
        }
        if (rateEl) {
          rateEl.textContent = `${Math.round(metrics.successRate)}%`;
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  private async loadRecentEvents(): Promise<void> {
    try {
      const res = await fetch(`/api/video-orchestrator/events/stream?projectId=${encodeURIComponent(this.projectId)}&limit=5`);
      const data = (await res.json()) as ApiResponse<{ events?: EventEntry[] }>;

      if (data.ok && data.events) {
        const events = (data.events as EventEntry[]) || [];
        const listEl = this.container.querySelector('#dashboard-events-list');

        if (listEl) {
          if (events.length === 0) {
            listEl.innerHTML = '<div class="vo-empty-state"><p>No events recorded yet</p></div>';
          } else {
            listEl.innerHTML = events.map((evt) => this.renderEventRow(evt)).join('');
          }
        }
      }
    } catch (error) {
      // Silently fail
    }
  }

  private renderEventRow(event: EventEntry): string {
    const typeCategory = event.type.split('.')[0];
    const timeAgo = this.getTimeAgo(event.at);

    return `
      <div class="vo-dashboard-event-row">
        <span class="vo-event-type-badge vo-badge-${typeCategory}">
          ${this.escapeHtml(event.type)}
        </span>
        <span class="vo-event-actor">${this.escapeHtml(event.actor)}</span>
        <span class="vo-event-time">${timeAgo}</span>
      </div>
    `;
  }

  private getTimeAgo(isoTime: string): string {
    const now = new Date();
    const then = new Date(isoTime);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (c) => map[c]);
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = window.setInterval(() => {
      this.loadAll();
    }, 60000);
  }

  destroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.container.innerHTML = '';
  }
}
