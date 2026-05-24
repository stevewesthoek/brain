import type {
  BrainCoreAiModelSelectorStatus,
  BrainCoreVOStudioAnalyticsSummary,
  BrainCoreVOAccountStatsResponse,
  BrainCoreVOStudioPlatformAccount,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';

export class OverviewPanel {
  private container: HTMLElement;
  private selector: BrainCoreAiModelSelectorStatus | undefined;
  private analytics: BrainCoreVOStudioAnalyticsSummary | undefined;
  private accountStats: BrainCoreVOAccountStatsResponse | undefined;
  private accounts: BrainCoreVOStudioPlatformAccount[] = [];
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, data: {
    selector?: BrainCoreAiModelSelectorStatus;
    analytics?: BrainCoreVOStudioAnalyticsSummary;
    accountStats?: BrainCoreVOAccountStatsResponse;
    accounts?: BrainCoreVOStudioPlatformAccount[];
  }) {
    this.container = container;
    this.selector = data.selector;
    this.analytics = data.analytics;
    this.accountStats = data.accountStats;
    this.accounts = data.accounts || [];

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-overview-panel">
        ${this.renderHealthIndicators()}
        ${this.renderActiveJobsSummary()}
        ${this.renderBlockers()}
        ${this.renderRecentStats()}
      </div>
    `;
  }

  private renderHealthIndicators(): string {
    const selectorHealthy = this.selector?.healthy ?? false;
    const selectorRunning = this.selector?.running ?? false;

    const selectorColor = selectorHealthy ? '#4ade80' : selectorRunning ? '#facc15' : '#fb7185';
    const selectorLabel = selectorHealthy ? 'Healthy' : selectorRunning ? 'Degraded' : 'Offline';

    return `
      <div class="vo-overview-card">
        <h3 class="vo-overview-title">System Health</h3>
        <div class="vo-health-grid">
          <div class="vo-health-indicator">
            <div class="vo-health-badge" style="background-color: ${selectorColor}"></div>
            <div class="vo-health-label">
              <span class="vo-health-name">AI Selector</span>
              <span class="vo-health-status">${selectorLabel}</span>
            </div>
          </div>
          ${this.renderProviderStatus()}
        </div>
      </div>
    `;
  }

  private renderProviderStatus(): string {
    if (!this.selector?.providers || this.selector.providers.length === 0) {
      return '';
    }

    return this.selector.providers
      .map((provider) => {
        const color = provider.healthy ? '#4ade80' : '#fb7185';
        const status = provider.healthy ? 'Healthy' : `Circuit: ${provider.circuitState}`;

        return `
          <div class="vo-health-indicator">
            <div class="vo-health-badge" style="background-color: ${color}"></div>
            <div class="vo-health-label">
              <span class="vo-health-name">${provider.id}</span>
              <span class="vo-health-status">${status}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  private renderActiveJobsSummary(): string {
    const analytics = this.analytics;
    if (!analytics) {
      return `
        <div class="vo-overview-card">
          <h3 class="vo-overview-title">Activity</h3>
          <p class="vo-placeholder">No analytics data available</p>
        </div>
      `;
    }

    const published = analytics.byPlatform?.reduce((sum, p) => sum + p.publishedCount, 0) ?? 0;
    const scheduled = analytics.byPlatform?.reduce((sum, p) => sum + p.scheduledCount, 0) ?? 0;
    const failed = analytics.byPlatform?.reduce((sum, p) => sum + p.failedCount, 0) ?? 0;

    return `
      <div class="vo-overview-card">
        <h3 class="vo-overview-title">Activity Summary</h3>
        <div class="vo-activity-grid">
          <div class="vo-activity-stat">
            <span class="vo-stat-value" style="color: #4ade80">${published}</span>
            <span class="vo-stat-label">Published</span>
          </div>
          <div class="vo-activity-stat">
            <span class="vo-stat-value" style="color: #60a5fa">${scheduled}</span>
            <span class="vo-stat-label">Scheduled</span>
          </div>
          <div class="vo-activity-stat">
            <span class="vo-stat-value" style="color: #fb7185">${failed}</span>
            <span class="vo-stat-label">Failed</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderBlockers(): string {
    const state = this.ctx.getState();
    const blockers = this.collectBlockers();

    if (blockers.length === 0) {
      return '';
    }

    return `
      <div class="vo-overview-card vo-overview-card--alert">
        <h3 class="vo-overview-title">⚠️ Blockers</h3>
        <div class="vo-blockers-list">
          ${blockers.map((blocker) => `
            <div class="vo-blocker">
              <div class="vo-blocker-icon">⚠️</div>
              <div class="vo-blocker-content">
                <div class="vo-blocker-title">${blocker.title}</div>
                <div class="vo-blocker-detail">${blocker.detail}</div>
                <div class="vo-blocker-guidance">${blocker.guidance}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private collectBlockers(): Array<{ title: string; detail: string; guidance: string }> {
    const blockers: Array<{ title: string; detail: string; guidance: string }> = [];
    const state = this.ctx.getState();

    // Check selector health
    if (this.selector && !this.selector.healthy) {
      blockers.push({
        title: 'AI Selector Degraded',
        detail: this.selector.error || 'The AI model selector service is not responding normally',
        guidance: 'Check selector logs at ~/.config/video-orchestrator/logs/selector.log',
      });
    }

    // Check for missing credentials on selected account
    if (state.accountId && this.accounts.length > 0) {
      const account = this.accounts.find((a) => a.id === state.accountId);
      if (account && account.credentialState === 'missing') {
        blockers.push({
          title: 'Missing Credentials',
          detail: `${account.handle} (${account.platform}) lacks configured credentials`,
          guidance: `Configure credentials in Brain Console credentials section, then restart the worker.`,
        });
      }
    }

    // Check for quota issues on selected account
    if (state.accountId && this.accountStats?.stats) {
      const stats = this.accountStats.stats.find((s) => s.accountId === state.accountId);
      if (stats && stats.failedJobs30d > stats.succeededJobs30d * 2) {
        const failRate = ((stats.failedJobs30d / (stats.succeededJobs30d + stats.failedJobs30d)) * 100).toFixed(0);
        blockers.push({
          title: `High Failure Rate (${failRate}%)`,
          detail: `${stats.accountHandle} has ${stats.failedJobs30d} failed jobs in last 30 days`,
          guidance: `Review failed job logs and quota limits for ${stats.platform}.`,
        });
      }
    }

    return blockers;
  }

  private renderRecentStats(): string {
    const state = this.ctx.getState();
    if (!state.accountId || !this.accountStats?.stats) {
      return '';
    }

    const stats = this.accountStats.stats.find((s) => s.accountId === state.accountId);
    if (!stats) {
      return '';
    }

    const successRate = stats.successRate30d !== null
      ? `${(stats.successRate30d * 100).toFixed(0)}%`
      : 'N/A';

    const lastJob = stats.lastJobAt
      ? new Date(stats.lastJobAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Never';

    return `
      <div class="vo-overview-card">
        <h3 class="vo-overview-title">Account Statistics (30d)</h3>
        <div class="vo-stats-table">
          <div class="vo-stat-row">
            <span class="vo-stat-key">Total Jobs</span>
            <span class="vo-stat-value">${stats.totalJobs30d}</span>
          </div>
          <div class="vo-stat-row">
            <span class="vo-stat-key">Succeeded</span>
            <span class="vo-stat-value" style="color: #4ade80">${stats.succeededJobs30d}</span>
          </div>
          <div class="vo-stat-row">
            <span class="vo-stat-key">Failed</span>
            <span class="vo-stat-value" style="color: #fb7185">${stats.failedJobs30d}</span>
          </div>
          <div class="vo-stat-row">
            <span class="vo-stat-key">Success Rate</span>
            <span class="vo-stat-value">${successRate}</span>
          </div>
          <div class="vo-stat-row">
            <span class="vo-stat-key">Last Job</span>
            <span class="vo-stat-value">${lastJob}</span>
          </div>
        </div>
      </div>
    `;
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
