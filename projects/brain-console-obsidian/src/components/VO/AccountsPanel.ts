import type {
  BrainCoreVOStudioPlatformAccount,
  BrainCoreVOStudioPipelineProfile,
  BrainCoreVOAccountStat,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';

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

    // Get filtered accounts for current project
    const accountsForProject = this.accounts.filter((a) => a.projectId === state.projectId);

    this.container.innerHTML = `
      <div class="vo-accounts-panel">
        ${this.renderAccountCards(accountsForProject)}
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

    const credentialColor = this.getCredentialColor(account.credentialState);
    const adapterColor = this.getAdapterColor(account.adapterStatus);

    return `
      <div class="vo-account-card">
        <div class="vo-account-header">
          <div class="vo-account-icon">
            <span class="vo-platform-icon">${this.getPlatformIcon(account.platform)}</span>
          </div>
          <div class="vo-account-title">
            <div class="vo-account-handle">${account.handle}</div>
            <div class="vo-account-platform">${account.platform}</div>
          </div>
        </div>

        <div class="vo-account-body">
          <div class="vo-account-row">
            <span class="vo-account-label">Status</span>
            <span class="vo-account-value ${this.getStatusClass(account.status)}">${account.status}</span>
          </div>

          <div class="vo-account-row">
            <span class="vo-account-label">Credentials</span>
            <span class="vo-account-badge" style="background-color: ${credentialColor}">
              ${account.credentialState}
            </span>
          </div>

          <div class="vo-account-row">
            <span class="vo-account-label">Adapter</span>
            <span class="vo-account-badge" style="background-color: ${adapterColor}">
              ${account.adapterStatus}
            </span>
          </div>

          <div class="vo-account-row">
            <span class="vo-account-label">Quota</span>
            <span class="vo-account-value">${account.quotaState}</span>
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
          ` : ''}

          <div class="vo-account-row">
            <span class="vo-account-label">Scheduler</span>
            <span class="vo-account-value vo-scheduler-label">${account.schedulerPolicy}</span>
          </div>
        </div>

        <div class="vo-account-footer">
          <div class="vo-account-profiles">
            <div class="vo-profiles-label">Enabled Profiles</div>
            <div class="vo-profiles-list">
              ${this.renderEnabledProfiles(account.enabledPipelineProfileIds)}
            </div>
          </div>
        </div>

        <div class="vo-account-capabilities">
          <div class="vo-capabilities-label">Capabilities</div>
          <div class="vo-capabilities-tags">
            ${account.capabilities.map((cap) => `
              <span class="vo-capability-tag">${cap}</span>
            `).join('')}
          </div>
        </div>
      </div>
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

    return profileNames.map((name) => `<span class="vo-profile-tag">${name}</span>`).join('') + (more ? `<span class="vo-profile-tag">${more}</span>` : '');
  }

  private getPlatformIcon(platform: string): string {
    switch (platform.toLowerCase()) {
      case 'youtube':
        return '▶️';
      case 'facebook':
        return 'f';
      case 'tiktok':
        return '♪';
      case 'instagram':
        return '📷';
      case 'linkedin':
        return 'in';
      case 'pinterest':
        return 'P';
      default:
        return '○';
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

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
