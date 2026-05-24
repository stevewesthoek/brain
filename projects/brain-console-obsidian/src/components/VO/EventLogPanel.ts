type EventEntry = {
  id: string;
  projectId: string;
  type: string;
  payload: Record<string, unknown>;
  actor: string;
  at: string;
  status: string;
};

type EventLogResponse = {
  ok: boolean;
  events?: EventEntry[];
  count?: number;
  error?: string;
};

export class EventLogPanel {
  private container: HTMLElement;
  private projectId: string;
  private eventTypeFilter: string = '';
  private refreshInterval: number | null = null;
  private lastRefreshTime: string = new Date().toISOString();
  private totalEventCount: number = 0;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.render();
    await this.loadEvents();
    this.startAutoRefresh();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-event-log">
        <div class="vo-event-header">
          <h2>Event Log</h2>
          <div class="vo-event-controls">
            <select class="vo-event-filter-select" id="event-filter">
              <option value="">All Events</option>
              <option value="package">Package Events</option>
              <option value="approval">Approval Events</option>
              <option value="publish">Publishing Events</option>
              <option value="webhook">Webhook Events</option>
            </select>
            <button class="vo-event-refresh-btn" id="event-refresh-btn">Refresh</button>
          </div>
        </div>

        <div class="vo-event-metrics">
          <div class="vo-event-metric">
            <span class="vo-metric-label">Total Events</span>
            <span class="vo-metric-value" id="event-total">0</span>
          </div>
          <div class="vo-event-metric">
            <span class="vo-metric-label">Last Event</span>
            <span class="vo-metric-value" id="event-last">—</span>
          </div>
          <div class="vo-event-metric">
            <span class="vo-metric-label">Status</span>
            <span class="vo-metric-value vo-status-ready" id="event-status">Ready</span>
          </div>
        </div>

        <div class="vo-event-table-container" id="event-container">
          <div class="vo-loading">Loading events...</div>
        </div>
      </div>
    `;

    const filterSelect = this.container.querySelector('#event-filter') as HTMLSelectElement;
    const refreshBtn = this.container.querySelector('#event-refresh-btn') as HTMLButtonElement;

    filterSelect?.addEventListener('change', (e) => {
      this.eventTypeFilter = (e.target as HTMLSelectElement).value;
      this.loadEvents();
    });

    refreshBtn?.addEventListener('click', () => {
      this.loadEvents();
    });
  }

  private async loadEvents(): Promise<void> {
    const container = this.container.querySelector('#event-container');
    if (!container) return;

    try {
      container.innerHTML = '<div class="vo-loading">Loading events...</div>';

      const filterParam = this.eventTypeFilter ? `&eventType=${encodeURIComponent(this.eventTypeFilter)}.*` : '';
      const res = await fetch(`/api/video-orchestrator/events/stream?projectId=${encodeURIComponent(this.projectId)}&limit=50${filterParam}`);

      if (!res.ok) {
        container.innerHTML = '<div class="vo-error">Failed to load events</div>';
        return;
      }

      const data = (await res.json()) as EventLogResponse;

      if (!data.ok) {
        container.innerHTML = `<div class="vo-error">${data.error ?? 'Failed to load events'}</div>`;
        return;
      }

      const events = data.events ?? [];
      this.totalEventCount = data.count ?? 0;

      this.updateMetrics(events);

      if (events.length === 0) {
        container.innerHTML = `
          <div class="vo-empty-state">
            <p>No events recorded${this.eventTypeFilter ? ' for this filter' : ' yet'}</p>
          </div>
        `;
        return;
      }

      const tableHtml = `
        <table class="vo-event-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Actor</th>
              <th>Timestamp</th>
              <th>Status</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            ${events.map((evt) => this.renderEventRow(evt)).join('')}
          </tbody>
        </table>
      `;

      container.innerHTML = tableHtml;
      this.attachEventRowListeners();
    } catch (error) {
      container.innerHTML = `<div class="vo-error">Error loading events: ${error instanceof Error ? error.message : 'Unknown error'}</div>`;
    }
  }

  private renderEventRow(event: EventEntry): string {
    const typeCategory = event.type.split('.')[0];
    const statusClass = `vo-event-status-${event.status}`;
    const payloadPreview = JSON.stringify(event.payload).slice(0, 50) + (JSON.stringify(event.payload).length > 50 ? '...' : '');

    return `
      <tr data-event-id="${event.id}" class="vo-event-row">
        <td>
          <span class="vo-event-type-badge vo-badge-${typeCategory}">
            ${event.type}
          </span>
        </td>
        <td>${this.escapeHtml(event.actor)}</td>
        <td>${new Date(event.at).toLocaleString()}</td>
        <td>
          <span class="${statusClass}">
            ${event.status}
          </span>
        </td>
        <td>
          <code class="vo-event-payload-preview">${this.escapeHtml(payloadPreview)}</code>
        </td>
      </tr>
    `;
  }

  private attachEventRowListeners(): void {
    const rows = this.container.querySelectorAll('.vo-event-row');
    rows.forEach((row) => {
      row.addEventListener('click', () => {
        // Toggle row expansion for detailed payload view (optional enhancement)
      });
    });
  }

  private updateMetrics(events: EventEntry[]): void {
    const totalEl = this.container.querySelector('#event-total');
    const lastEl = this.container.querySelector('#event-last');
    const statusEl = this.container.querySelector('#event-status');

    if (totalEl) {
      totalEl.textContent = this.totalEventCount.toString();
    }

    if (lastEl && events.length > 0) {
      const lastEvent = events[0];
      const timeDiff = this.getTimeAgo(lastEvent.at);
      lastEl.textContent = timeDiff;
    }

    if (statusEl) {
      statusEl.textContent = 'Ready';
      statusEl.className = 'vo-metric-value vo-status-ready';
    }
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
      this.loadEvents();
    }, 15000);
  }

  destroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.container.innerHTML = '';
  }
}
