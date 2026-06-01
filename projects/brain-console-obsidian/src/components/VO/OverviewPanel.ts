import type {
  BrainCoreAiModelSelectorStatus,
  BrainCoreVOStudioAnalyticsSummary,
  BrainCoreVOAccountStatsResponse,
  BrainCoreVOStudioPlatformAccount,
  BrainCoreInfraVOStatusResponse,
} from '../../client.js';
import {
  readBrainCoreAwsVideoPipelineStatus,
  readBrainCoreVOStudioAnalyticsSummary,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';
import { StatusPill, Badge } from '../Design/shadcn-components.js';

const BASE_URL = 'http://localhost:4877';
const REFRESH_INTERVAL_MS = 30_000;

export class OverviewPanel {
  private container: HTMLElement;
  private selector: BrainCoreAiModelSelectorStatus | undefined;
  private analytics: BrainCoreVOStudioAnalyticsSummary | undefined;
  private accountStats: BrainCoreVOAccountStatsResponse | undefined;
  private accounts: BrainCoreVOStudioPlatformAccount[] = [];
  private voStatus: BrainCoreInfraVOStatusResponse | undefined;
  private brainCoreUrl: string;
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;
  private loading = false;

  constructor(
    container: HTMLElement,
    data: {
      selector?: BrainCoreAiModelSelectorStatus;
      analytics?: BrainCoreVOStudioAnalyticsSummary;
      accountStats?: BrainCoreVOAccountStatsResponse;
      accounts?: BrainCoreVOStudioPlatformAccount[];
    },
    brainCoreUrl: string = 'http://localhost:4877',
  ) {
    this.container = container;
    this.selector = data.selector;
    this.analytics = data.analytics;
    this.accountStats = data.accountStats;
    this.accounts = data.accounts || [];
    this.brainCoreUrl = brainCoreUrl;

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
    // Kick off live fetch and start refresh loop
    this.fetchLiveData();
    this.refreshTimer = setInterval(() => this.fetchLiveData(), REFRESH_INTERVAL_MS);
  }

  private async fetchLiveData(): Promise<void> {
    this.loading = true;
    try {
      const [statusRes, analyticsRes] = await Promise.allSettled([
        readBrainCoreAwsVideoPipelineStatus(this.brainCoreUrl),
        readBrainCoreVOStudioAnalyticsSummary(this.brainCoreUrl),
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value?.value?.ok) {
        this.voStatus = statusRes.value.value.data as BrainCoreInfraVOStatusResponse;
      }
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.value?.ok) {
        this.analytics = analyticsRes.value.value as BrainCoreVOStudioAnalyticsSummary;
      }
    } catch {
      // Silently continue with existing data
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-overview-panel">
        ${this.renderRefreshIndicator()}
        ${this.renderWorkerHealthCard()}
        ${this.renderAiSelectorCard()}
        ${this.renderActiveJobsCard()}
        ${this.renderQuotaWarningsCard()}
        ${this.renderCredentialStatusCard()}
        ${this.renderBlockers()}
      </div>
    `;
  }

  private renderRefreshIndicator(): string {
    return `
      <div class="vo-overview-refresh-bar">
        <span class="vo-overview-refresh-label">
          ${this.loading ? 'Refreshing...' : 'Auto-refreshes every 30s'}
        </span>
        <span class="vo-overview-refresh-dot ${this.loading ? 'vo-refresh-dot--active' : ''}"></span>
      </div>
    `;
  }

  private renderWorkerHealthCard(): string {
    const queueDepth = this.voStatus?.queueDepth;
    const pending = queueDepth?.pending ?? '–';
    const running = queueDepth?.running ?? '–';
    const failed = queueDepth?.failed ?? '–';
    const hasStatus = this.voStatus?.ok !== undefined;
    const workerOk = this.voStatus?.ok ?? null;
    const workerStatus = workerOk === true ? 'Online' : workerOk === false ? 'Error' : 'Unknown';
    const statusPill = workerOk === true ? 'ok' : workerOk === false ? 'error' : 'warning';

    return `
      <div class="vo-overview-card">
        <div class="vo-card-header">
          <span class="vo-card-icon">⚙</span>
          <span class="vo-card-label">Worker Health</span>
          ${StatusPill({ status: statusPill, label: workerStatus })}
        </div>
        <div class="vo-card-body">
          <div class="vo-card-stat-row">
            <span class="vo-card-stat-label">Queue: Pending</span>
            <span class="vo-card-stat-value">${pending}</span>
          </div>
          <div class="vo-card-stat-row">
            <span class="vo-card-stat-label">Queue: Running</span>
            <span class="vo-card-stat-value" style="color: var(--bc-blue)">${running}</span>
          </div>
          <div class="vo-card-stat-row">
            <span class="vo-card-stat-label">Queue: Failed</span>
            <span class="vo-card-stat-value" style="color: var(--bc-red)">${failed}</span>
          </div>
          ${this.voStatus?.lastJobAt ? `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Last Job</span>
              <span class="vo-card-stat-value">${this.formatDate(this.voStatus.lastJobAt)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderAiSelectorCard(): string {
    const selectorHealthy = this.selector?.healthy ?? false;
    const selectorRunning = this.selector?.running ?? false;
    const selectorLabel = selectorHealthy ? 'Healthy' : selectorRunning ? 'Degraded' : 'Offline';
    const statusPill = selectorHealthy ? 'ok' : selectorRunning ? 'warning' : 'error';
    const providerCount = this.selector?.providers?.length ?? 0;
    const healthyProviders = this.selector?.providers?.filter((p) => p.healthy).length ?? 0;

    return `
      <div class="vo-overview-card">
        <div class="vo-card-header">
          <span class="vo-card-icon">◆</span>
          <span class="vo-card-label">AI Selector Status</span>
          ${StatusPill({ status: statusPill, label: selectorLabel })}
        </div>
        <div class="vo-card-body">
          ${providerCount > 0 ? `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Providers</span>
              <span class="vo-card-stat-value">${healthyProviders}/${providerCount} healthy</span>
            </div>
          ` : `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Providers</span>
              <span class="vo-card-stat-value vo-muted">No data</span>
            </div>
          `}
          ${this.selector?.error ? `
            <div class="vo-card-alert">${this.selector.error}</div>
          ` : ''}
          ${this.selector?.uptime ? `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Uptime</span>
              <span class="vo-card-stat-value">${this.selector.uptime}</span>
            </div>
          ` : ''}
          ${(this.selector?.providers ?? []).map((p) => `
            <div class="vo-card-provider-row">
              <span class="vo-card-provider-dot" style="background: ${p.healthy ? 'var(--bc-green)' : 'var(--bc-red)'}"></span>
              <span class="vo-card-provider-name">${p.id}</span>
              <span class="vo-card-provider-state vo-muted">${p.circuitState}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderActiveJobsCard(): string {
    const running = this.voStatus?.queueDepth?.running ?? null;
    const byType = this.voStatus?.jobsByType ?? {};
    const typeEntries = Object.entries(byType);
    const accounts = this.voStatus?.activeAccounts ?? null;

    return `
      <div class="vo-overview-card">
        <div class="vo-card-header">
          <span class="vo-card-icon">▶</span>
          <span class="vo-card-label">Active Jobs</span>
          ${StatusPill({ status: 'ok', label: `${running ?? '–'} running` })}
        </div>
        <div class="vo-card-body">
          ${accounts !== null ? `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Active Accounts</span>
              <span class="vo-card-stat-value">${accounts}</span>
            </div>
          ` : ''}
          ${typeEntries.length > 0 ? typeEntries.map(([type, count]) => `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">${type}</span>
              <span class="vo-card-stat-value">${count}</span>
            </div>
          `).join('') : `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label vo-muted">No active job breakdown</span>
            </div>
          `}
          ${this.renderRecentPosts()}
        </div>
      </div>
    `;
  }

  private renderRecentPosts(): string {
    const recent = this.voStatus?.recentPosts;
    if (!recent || recent.length === 0) return '';

    return `
      <div class="vo-card-divider"></div>
      <div class="vo-card-sublabel">Recent Posts</div>
      ${recent.slice(0, 3).map((post) => `
        <div class="vo-card-post-row">
          <span class="vo-card-post-platform">${post.platform}</span>
          <span class="vo-card-post-handle">${post.accountHandle}</span>
          <span class="vo-card-post-time vo-muted">${this.formatDate(post.postedAt)}</span>
        </div>
      `).join('')}
    `;
  }

  private renderQuotaWarningsCard(): string {
    const accountsByPlatform = this.voStatus?.accountsByPlatform ?? {};
    const platformEntries = Object.entries(accountsByPlatform);

    // Check for quota issues from accountStats
    const quotaWarnings: string[] = [];
    for (const account of this.accounts) {
      if (account.quotaState === 'limited') {
        quotaWarnings.push(`${account.handle} (${account.platform}) quota limited`);
      }
    }

    const hasWarnings = quotaWarnings.length > 0;
    const statusPill = hasWarnings ? 'warning' : 'ok';
    const badgeLabel = hasWarnings ? `${quotaWarnings.length} warning${quotaWarnings.length !== 1 ? 's' : ''}` : 'All OK';

    return `
      <div class="vo-overview-card ${hasWarnings ? 'vo-overview-card--warn' : ''}">
        <div class="vo-card-header">
          <span class="vo-card-icon">⚡</span>
          <span class="vo-card-label">Quota Warnings</span>
          ${StatusPill({ status: statusPill, label: badgeLabel })}
        </div>
        <div class="vo-card-body">
          ${hasWarnings ? quotaWarnings.map((w) => `
            <div class="vo-card-warning-row">
              <span class="vo-card-warning-dot" style="background: var(--bc-yellow)"></span>
              <span class="vo-card-warning-text">${w}</span>
            </div>
          `).join('') : `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label vo-muted">No quota warnings</span>
            </div>
          `}
          ${platformEntries.length > 0 ? `
            <div class="vo-card-divider"></div>
            <div class="vo-card-sublabel">Accounts by Platform</div>
            ${platformEntries.map(([platform, count]) => `
              <div class="vo-card-stat-row">
                <span class="vo-card-stat-label">${platform}</span>
                <span class="vo-card-stat-value">${count}</span>
              </div>
            `).join('')}
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderCredentialStatusCard(): string {
    const missing = this.accounts.filter((a) => a.credentialState === 'missing');
    const manual = this.accounts.filter((a) => a.credentialState === 'manual');
    const connected = this.accounts.filter((a) => a.credentialState === 'connected');
    const total = this.accounts.length;
    const hasIssues = missing.length > 0;
    const statusPill = hasIssues ? 'error' : 'ok';
    const badgeLabel = hasIssues ? `${missing.length} missing` : total > 0 ? 'All configured' : 'No accounts';

    return `
      <div class="vo-overview-card ${hasIssues ? 'vo-overview-card--alert' : ''}">
        <div class="vo-card-header">
          <span class="vo-card-icon">🔑</span>
          <span class="vo-card-label">Credential Status</span>
          ${StatusPill({ status: statusPill, label: badgeLabel })}
        </div>
        <div class="vo-card-body">
          ${total === 0 ? `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label vo-muted">No accounts configured</span>
            </div>
          ` : `
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Connected</span>
              <span class="vo-card-stat-value" style="color: var(--bc-green)">${connected.length}</span>
            </div>
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Manual</span>
              <span class="vo-card-stat-value" style="color: var(--bc-yellow)">${manual.length}</span>
            </div>
            <div class="vo-card-stat-row">
              <span class="vo-card-stat-label">Missing</span>
              <span class="vo-card-stat-value" style="color: var(--bc-red)">${missing.length}</span>
            </div>
          `}
          ${missing.length > 0 ? `
            <div class="vo-card-divider"></div>
            ${missing.map((a) => `
              <div class="vo-card-warning-row">
                <span class="vo-card-warning-dot" style="background: var(--bc-red)"></span>
                <span class="vo-card-warning-text">${a.handle} (${a.platform})</span>
              </div>
            `).join('')}
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderBlockers(): string {
    const blockers = this.collectBlockers();

    if (blockers.length === 0) {
      return '';
    }

    return `
      <div class="vo-overview-card vo-overview-card--alert">
        <div class="vo-card-header">
          <span class="vo-card-icon">⚠</span>
          <span class="vo-card-label">Blockers</span>
          ${Badge({ count: blockers.length, status: 'error' })}
        </div>
        <div class="vo-card-body">
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
          guidance: 'Configure credentials in Brain Console credentials section, then restart the worker.',
        });
      }
    }

    // Check for high failure rate
    if (state.accountId && this.accountStats?.stats) {
      const stats = this.accountStats.stats.find((s) => s.accountId === state.accountId);
      if (stats && stats.failedJobs30d > stats.succeededJobs30d * 2 && stats.totalJobs30d > 0) {
        const failRate = ((stats.failedJobs30d / stats.totalJobs30d) * 100).toFixed(0);
        blockers.push({
          title: `High Failure Rate (${failRate}%)`,
          detail: `${stats.accountHandle} has ${stats.failedJobs30d} failed jobs in last 30 days`,
          guidance: `Review failed job logs and quota limits for ${stats.platform}.`,
        });
      }
    }

    return blockers;
  }

  private formatDate(iso: string | null): string {
    if (!iso) return '–';
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (this.refreshTimer !== null) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.container.innerHTML = '';
  }
}
