import type {
  BrainCoreVOStudioPlatformAccount,
  BrainCoreVOStudioPipelineProfile,
  BrainCoreVOAccountStat,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';

const PLATFORM_ICONS: Record<string, string> = {
  youtube: '▶',
  'youtube-shorts': '▶',
  tiktok: '♪',
  instagram: '◉',
  facebook: 'f',
  linkedin: 'in',
  pinterest: 'P',
};

const QUOTA_LIMITS: Record<string, number> = {
  youtube: 10000,
  'youtube-shorts': 10000,
  tiktok: 500,
  instagram: 200,
  facebook: 300,
  linkedin: 300,
  pinterest: 1000,
};

export class AccountsPanel {
  private container: HTMLElement;
  private accounts: BrainCoreVOStudioPlatformAccount[] = [];
  private profiles: BrainCoreVOStudioPipelineProfile[] = [];
  private accountStats: BrainCoreVOAccountStat[] = [];
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, data: {
    accounts?: BrainCoreVOStudioPlatformAccount[];
    profiles?: BrainCoreVOStudioPipelineProfile[];
    accountStats?: BrainCoreVOAccountStat[];
  }) {
    this.container = container;
    this.accounts = data.accounts || [];
    this.profiles = data.profiles || [];
    this.accountStats = data.accountStats || [];

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    const state = this.ctx.getState();
    const accountsForProject = this.accounts.filter((a) => a.projectId === state.projectId);

    this.container.innerHTML = `
      <div class="vo-accounts-panel">
        ${this.renderSummaryBar(accountsForProject)}
        ${this.renderAccountCards(accountsForProject)}
      </div>
    `;
  }

  private renderSummaryBar(accounts: BrainCoreVOStudioPlatformAccount[]): string {
    if (accounts.length === 0) return '';

    const configured = accounts.filter((a) => a.credentialState === 'connected').length;
    const expired = accounts.filter((a) => a.credentialState === 'missing').length;
    const manual = accounts.filter((a) => a.credentialState === 'manual').length;
    const active = accounts.filter((a) => a.status === 'active').length;

    return `
      <div class="vo-accounts-summary-bar">
        <div class="vo-accounts-summary-stat">
          <span class="vo-accounts-summary-value" style="color: var(--bc-green)">${configured}</span>
          <span class="vo-accounts-summary-label">Connected</span>
        </div>
        <div class="vo-accounts-summary-stat">
          <span class="vo-accounts-summary-value" style="color: var(--bc-yellow)">${manual}</span>
          <span class="vo-accounts-summary-label">Manual</span>
        </div>
        <div class="vo-accounts-summary-stat">
          <span class="vo-accounts-summary-value" style="color: var(--bc-red)">${expired}</span>
          <span class="vo-accounts-summary-label">Missing</span>
        </div>
        <div class="vo-accounts-summary-stat">
          <span class="vo-accounts-summary-value" style="color: var(--bc-blue)">${active}</span>
          <span class="vo-accounts-summary-label">Active</span>
        </div>
        <div class="vo-accounts-summary-stat">
          <span class="vo-accounts-summary-value">${accounts.length}</span>
          <span class="vo-accounts-summary-label">Total</span>
        </div>
      </div>
    `;
  }

  private renderAccountCards(accounts: BrainCoreVOStudioPlatformAccount[]): string {
    if (accounts.length === 0) {
      return `
        <div class="vo-empty-state">
          <p>No platform accounts configured for this project</p>
        </div>
      `;
    }

    return `
      <div class="vo-accounts-grid">
        ${accounts.map((account) => this.renderAccountCard(account)).join('')}
      </div>
    `;
  }

  private renderAccountCard(account: BrainCoreVOStudioPlatformAccount): string {
    const stats = this.accountStats.find((s) => s.accountId === account.id);
    const successRate = stats?.successRate30d !== null && stats?.successRate30d !== undefined
      ? `${(stats.successRate30d * 100).toFixed(0)}%`
      : 'N/A';

    return `
      <div class="vo-account-card">
        ${this.renderAccountHeader(account)}
        ${this.renderConnectionStateBadge(account)}
        ${this.renderAccountBody(account, stats, successRate)}
        ${this.renderQuotaBar(account, stats)}
        ${this.renderSchedulerToggle(account)}
        ${this.renderAccountFooter(account)}
      </div>
    `;
  }

  private renderAccountHeader(account: BrainCoreVOStudioPlatformAccount): string {
    const icon = PLATFORM_ICONS[account.platform] ?? '○';
    return `
      <div class="vo-account-header">
        <div class="vo-account-icon">
          <span class="vo-platform-icon">${icon}</span>
        </div>
        <div class="vo-account-title">
          <div class="vo-account-handle">${account.handle}</div>
          <div class="vo-account-platform">${account.platform}</div>
        </div>
      </div>
    `;
  }

  private renderConnectionStateBadge(account: BrainCoreVOStudioPlatformAccount): string {
    const badgeColor = this.getCredentialColor(account.credentialState);
    const label = this.getConnectionStateLabel(account.credentialState);
    return `
      <div class="vo-account-connection-banner" style="background: color-mix(in srgb, ${badgeColor} 15%, var(--background-primary) 85%); border-left: 3px solid ${badgeColor};">
        <span class="vo-account-connection-dot" style="background: ${badgeColor}"></span>
        <span class="vo-account-connection-label">${label}</span>
        <span class="vo-account-adapter-badge" style="background: color-mix(in srgb, ${this.getAdapterColor(account.adapterStatus)} 20%, transparent); color: ${this.getAdapterColor(account.adapterStatus)};">${this.getAdapterLabel(account.adapterStatus)}</span>
      </div>
    `;
  }

  private renderAccountBody(
    account: BrainCoreVOStudioPlatformAccount,
    stats: BrainCoreVOAccountStat | undefined,
    successRate: string,
  ): string {
    return `
      <div class="vo-account-body">
        <div class="vo-account-row">
          <span class="vo-account-label">Status</span>
          <span class="vo-account-value ${this.getStatusClass(account.status)}">${account.status}</span>
        </div>

        <div class="vo-account-row">
          <span class="vo-account-label">Quota State</span>
          <span class="vo-account-value ${this.getQuotaStateClass(account.quotaState)}">${account.quotaState}</span>
        </div>

        ${stats ? `
          <div class="vo-account-row">
            <span class="vo-account-label">Success Rate (30d)</span>
            <span class="vo-account-value">${successRate}</span>
          </div>
          <div class="vo-account-row">
            <span class="vo-account-label">Jobs (30d)</span>
            <span class="vo-account-value">${stats.succeededJobs30d}/${stats.totalJobs30d}</span>
          </div>
          ${stats.lastJobAt ? `
            <div class="vo-account-row">
              <span class="vo-account-label">Last Job</span>
              <span class="vo-account-value">${this.formatDate(stats.lastJobAt)}</span>
            </div>
          ` : ''}
        ` : ''}
      </div>
    `;
  }

  private renderQuotaBar(account: BrainCoreVOStudioPlatformAccount, stats: BrainCoreVOAccountStat | undefined): string {
    const limit = QUOTA_LIMITS[account.platform] ?? 1000;
    const usage = stats?.totalJobs30d ?? 0;
    const pct = Math.min(100, Math.round((usage / limit) * 100));
    const barColor = pct >= 90 ? 'var(--bc-red)' : pct >= 70 ? 'var(--bc-yellow)' : 'var(--bc-green)';

    return `
      <div class="vo-account-quota-section">
        <div class="vo-account-quota-row">
          <span class="vo-account-label">Quota Usage</span>
          <span class="vo-account-quota-text">${usage} / ${limit}</span>
        </div>
        <div class="vo-quota-bar-track">
          <div
            class="vo-quota-bar-fill"
            style="width: ${pct}%; background: ${barColor};"
            title="${pct}% of quota used"
          ></div>
        </div>
      </div>
    `;
  }

  private renderSchedulerToggle(account: BrainCoreVOStudioPlatformAccount): string {
    const isActive = account.status === 'active';
    const policyLabel = account.schedulerPolicy || 'not-set';

    return `
      <div class="vo-account-scheduler-row">
        <span class="vo-account-label">Scheduler</span>
        <div class="vo-scheduler-toggle-wrap">
          <div class="vo-scheduler-toggle vo-scheduler-toggle--${isActive ? 'on' : 'off'}" title="Read-only in Phase 0.9">
            <div class="vo-scheduler-toggle-thumb"></div>
          </div>
          <span class="vo-scheduler-policy-label">${policyLabel}</span>
        </div>
      </div>
    `;
  }

  private renderAccountFooter(account: BrainCoreVOStudioPlatformAccount): string {
    return `
      <div class="vo-account-footer">
        <div class="vo-account-profiles">
          <div class="vo-profiles-label">Enabled Profiles</div>
          <div class="vo-profiles-list">
            ${this.renderEnabledProfiles(account.enabledPipelineProfileIds)}
          </div>
        </div>
      </div>
      ${account.capabilities.length > 0 ? `
        <div class="vo-account-capabilities">
          <div class="vo-capabilities-label">Capabilities</div>
          <div class="vo-capabilities-tags">
            ${account.capabilities.map((cap) => `
              <span class="vo-capability-tag">${cap}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  private renderEnabledProfiles(profileIds: string[]): string {
    if (profileIds.length === 0) {
      return '<span class="vo-placeholder">None</span>';
    }

    const profileNames = profileIds
      .map((id) => this.profiles.find((p) => p.id === id)?.name || id)
      .slice(0, 3);

    const more = profileIds.length > 3 ? ` +${profileIds.length - 3}` : '';
    return profileNames.map((name) => `<span class="vo-profile-tag">${name}</span>`).join('') +
      (more ? `<span class="vo-profile-tag">${more}</span>` : '');
  }

  private getConnectionStateLabel(state: string): string {
    switch (state) {
      case 'connected':
        return 'Connected';
      case 'missing':
        return 'Credentials Missing';
      case 'manual':
        return 'Manual';
      default:
        return state;
    }
  }

  private getAdapterLabel(state: string): string {
    switch (state) {
      case 'ready-read-only':
        return 'direct_upload';
      case 'manual-package':
        return 'n8n_fallback';
      case 'disabled':
        return 'manual_only';
      default:
        return state;
    }
  }

  private getCredentialColor(state: string): string {
    switch (state) {
      case 'connected':
        return '#4ade80';
      case 'missing':
        return '#fb7185';
      case 'manual':
        return '#facc15';
      default:
        return '#60a5fa';
    }
  }

  private getAdapterColor(state: string): string {
    switch (state) {
      case 'ready-read-only':
        return '#4ade80';
      case 'manual-package':
        return '#facc15';
      case 'disabled':
        return '#fb7185';
      default:
        return '#60a5fa';
    }
  }

  private getStatusClass(status: string): string {
    switch (status) {
      case 'active':
        return 'vo-status-active';
      case 'manual-only':
        return 'vo-status-manual';
      case 'blocked':
        return 'vo-status-blocked';
      default:
        return '';
    }
  }

  private getQuotaStateClass(quotaState: string): string {
    switch (quotaState) {
      case 'ok':
        return 'vo-status-active';
      case 'limited':
        return 'vo-status-manual';
      case 'unknown':
      default:
        return '';
    }
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
    this.container.innerHTML = '';
  }
}
