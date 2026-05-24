type ApprovalStats = {
  totalRequested: number;
  totalApproved: number;
  totalRejected: number;
  approvalRate: number;
  avgDecisionTimeMinutes: number;
  avgWaitTimeMinutes: number;
  rejectionReasons: Record<string, number>;
  byType: Record<string, { requested: number; approved: number; rejected: number }>;
  byProject: Record<string, { requested: number; approved: number; rejected: number }>;
  byOperator: Record<string, { decided: number; approvalRate: number }>;
};

type ApprovalStatsApiResponse = {
  ok: boolean;
  stats?: ApprovalStats;
  since?: string;
  until?: string;
  error?: string;
};

type PendingApprovalApiResponse = {
  ok: boolean;
  count?: number;
  error?: string;
};

export class OperatorDashboardPanel {
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
      <div class="vo-operator-dashboard">
        <div class="vo-panel-header">
          <h2>Operator Dashboard</h2>
          <button id="dashboard-refresh" class="vo-btn-secondary">Refresh</button>
        </div>

        <div class="vo-stats-grid">
          <div class="vo-stat-card">
            <div class="vo-stat-label">Total Approvals (30d)</div>
            <div class="vo-stat-value" id="stat-total">—</div>
          </div>

          <div class="vo-stat-card">
            <div class="vo-stat-label">Approval Rate</div>
            <div class="vo-stat-value" id="stat-rate">—</div>
          </div>

          <div class="vo-stat-card">
            <div class="vo-stat-label">Avg Decision Time</div>
            <div class="vo-stat-value" id="stat-avg-time">—</div>
          </div>

          <div class="vo-stat-card">
            <div class="vo-stat-label">Pending (Current)</div>
            <div class="vo-stat-value" id="stat-pending">—</div>
          </div>
        </div>

        <div class="vo-charts-grid">
          <div class="vo-chart-card">
            <h3>Approvals by Type</h3>
            <div id="chart-by-type" class="vo-chart-bars"></div>
          </div>

          <div class="vo-chart-card">
            <h3>Top Rejection Reasons</h3>
            <ul id="chart-rejections" class="vo-rejection-list"></ul>
          </div>

          <div class="vo-chart-card">
            <h3>Operator Performance</h3>
            <table id="chart-operators" class="vo-operator-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Decisions</th>
                  <th>Approval %</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.container.querySelector('#dashboard-refresh')?.addEventListener('click', () => {
      this.loadAll();
    });
  }

  private async loadAll(): Promise<void> {
    await Promise.allSettled([this.loadStats(), this.loadPendingCount()]);
  }

  private async loadStats(): Promise<void> {
    try {
      const url = `http://localhost:4877/api/video-orchestrator/analytics/approvals?projectId=${encodeURIComponent(this.projectId)}&since=30d`;
      const response = await fetch(url);
      const data = (await response.json()) as ApprovalStatsApiResponse;

      if (data.ok && data.stats) {
        this.renderStats(data.stats);
      } else {
        console.error('Failed to load operator dashboard stats:', data.error);
      }
    } catch (error) {
      console.error('Error loading operator dashboard stats:', error);
    }
  }

  private async loadPendingCount(): Promise<void> {
    try {
      const url = `http://localhost:4877/api/video-orchestrator/approvals?projectId=${encodeURIComponent(this.projectId)}`;
      const response = await fetch(url);
      const data = (await response.json()) as PendingApprovalApiResponse;

      const pendingEl = this.container.querySelector('#stat-pending');
      if (pendingEl && data.ok) {
        pendingEl.textContent = String(data.count ?? 0);
      }
    } catch (error) {
      console.error('Error loading pending count:', error);
    }
  }

  private renderStats(stats: ApprovalStats): void {
    // Stat cards
    const totalEl = this.container.querySelector('#stat-total');
    if (totalEl) totalEl.textContent = String(stats.totalRequested);

    const rateEl = this.container.querySelector('#stat-rate');
    if (rateEl) rateEl.textContent = `${(stats.approvalRate * 100).toFixed(1)}%`;

    const avgTimeEl = this.container.querySelector('#stat-avg-time');
    if (avgTimeEl) {
      avgTimeEl.textContent =
        stats.avgDecisionTimeMinutes > 0
          ? `${stats.avgDecisionTimeMinutes.toFixed(0)}m`
          : '—';
    }

    // By-type bar chart
    const byTypeContainer = this.container.querySelector('#chart-by-type');
    if (byTypeContainer) {
      const entries = Object.entries(stats.byType);
      if (entries.length === 0) {
        byTypeContainer.innerHTML = '<p class="vo-empty-state">No data</p>';
      } else {
        byTypeContainer.innerHTML = entries
          .map(([type, data]) => {
            const pct =
              data.requested > 0
                ? Math.round((data.approved / data.requested) * 100)
                : 0;
            return `
            <div class="vo-chart-row">
              <span class="vo-chart-label">${this.escapeHtml(type)}</span>
              <div class="vo-bar-track">
                <div class="vo-bar-fill" style="width: ${pct}%"></div>
              </div>
              <span class="vo-chart-count">${data.approved}/${data.requested}</span>
            </div>
          `;
          })
          .join('');
      }
    }

    // Rejection reasons
    const rejectionsEl = this.container.querySelector('#chart-rejections');
    if (rejectionsEl) {
      const sorted = Object.entries(stats.rejectionReasons).sort(([, a], [, b]) => b - a);
      const top5 = sorted.slice(0, 5);
      if (top5.length === 0) {
        rejectionsEl.innerHTML = '<li class="vo-empty-state">No rejections</li>';
      } else {
        rejectionsEl.innerHTML = top5
          .map(([reason, count]) => `<li>${this.escapeHtml(reason)}: <strong>${count}</strong></li>`)
          .join('');
      }
    }

    // Operator performance table
    const operatorTbody = this.container.querySelector('#chart-operators tbody');
    if (operatorTbody) {
      const entries = Object.entries(stats.byOperator);
      if (entries.length === 0) {
        operatorTbody.innerHTML =
          '<tr><td colspan="3" class="vo-empty-state">No operator data</td></tr>';
      } else {
        operatorTbody.innerHTML = entries
          .sort(([, a], [, b]) => b.decided - a.decided)
          .map(
            ([operator, data]) => `
          <tr>
            <td>${this.escapeHtml(operator)}</td>
            <td>${data.decided}</td>
            <td>${(data.approvalRate * 100).toFixed(1)}%</td>
          </tr>
        `,
          )
          .join('');
      }
    }
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.refreshInterval = window.setInterval(
      () => {
        this.loadAll();
      },
      5 * 60 * 1000,
    ); // 5-minute refresh
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
  }

  destroy(): void {
    if (this.refreshInterval) clearInterval(this.refreshInterval);
    this.container.innerHTML = '';
  }
}
