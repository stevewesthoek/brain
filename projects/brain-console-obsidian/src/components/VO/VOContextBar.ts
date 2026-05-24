import { getVOContextManager } from './VOContext.js';
import type {
  BrainCoreAiModelSelectorStatus,
  BrainCoreVOStudioProject,
  BrainCoreVOStudioPlatformAccount,
  BrainCoreVOStudioPipelineProfile,
} from '../../client.js';

export class VOContextBar {
  private container: HTMLElement;
  private projects: BrainCoreVOStudioProject[] = [];
  private accounts: BrainCoreVOStudioPlatformAccount[] = [];
  private pipelineProfiles: BrainCoreVOStudioPipelineProfile[] = [];
  private selector: BrainCoreAiModelSelectorStatus | undefined;
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, data: {
    projects?: BrainCoreVOStudioProject[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
    pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
    selector?: BrainCoreAiModelSelectorStatus;
  }) {
    this.container = container;
    this.projects = data.projects || [];
    this.accounts = data.accounts || [];
    this.pipelineProfiles = data.pipelineProfiles || [];
    this.selector = data.selector;

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  private getFilteredAccounts(): BrainCoreVOStudioPlatformAccount[] {
    const state = this.ctx.getState();
    return this.accounts.filter((a) => a.projectId === state.projectId);
  }

  private getSelectedAccount(): BrainCoreVOStudioPlatformAccount | undefined {
    const state = this.ctx.getState();
    return this.getFilteredAccounts().find((a) => a.id === state.accountId);
  }

  private getFilteredProfiles(): BrainCoreVOStudioPipelineProfile[] {
    const state = this.ctx.getState();
    return this.pipelineProfiles.filter((p) => p.projectId === state.projectId);
  }

  private render(): void {
    const state = this.ctx.getState();
    const filteredAccounts = this.getFilteredAccounts();
    const selectedAccount = this.getSelectedAccount();
    const filteredProfiles = this.getFilteredProfiles();

    this.container.innerHTML = `
      <div class="vo-context-bar">
        <div class="vo-context-selectors">
          ${this.renderProjectSelector()}
          ${this.renderAccountSelector(filteredAccounts)}
          ${this.renderPlatformTargets(selectedAccount)}
          ${this.renderProfileSelector(filteredProfiles)}
        </div>
        <div class="vo-context-meta">
          ${this.renderSelectorHealthChip()}
          ${this.renderDateRange()}
        </div>
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners(filteredAccounts, filteredProfiles);
  }

  private renderProjectSelector(): string {
    const state = this.ctx.getState();
    return `
      <div class="vo-selector">
        <label>Project</label>
        <select class="vo-select vo-project-select" ${this.projects.length === 0 ? 'disabled' : ''}>
          <option value="">— Choose project —</option>
          ${this.projects.map((p) => `
            <option value="${p.id}" ${p.id === state.projectId ? 'selected' : ''}>
              ${p.name}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }

  private renderAccountSelector(filteredAccounts: BrainCoreVOStudioPlatformAccount[]): string {
    const state = this.ctx.getState();
    return `
      <div class="vo-selector">
        <label>Account</label>
        <select class="vo-select vo-account-select" ${!state.projectId || filteredAccounts.length === 0 ? 'disabled' : ''}>
          <option value="">— Choose account —</option>
          ${filteredAccounts.map((a) => `
            <option value="${a.id}" ${a.id === state.accountId ? 'selected' : ''}>
              ${a.handle} (${a.platform})
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }

  private renderPlatformTargets(selectedAccount?: BrainCoreVOStudioPlatformAccount): string {
    const state = this.ctx.getState();
    if (!selectedAccount) {
      return `
        <div class="vo-selector">
          <label>Platform Targets</label>
          <div class="vo-platform-targets">
            <span class="vo-placeholder">Select account first</span>
          </div>
        </div>
      `;
    }

    return `
      <div class="vo-selector">
        <label>Platform Targets</label>
        <div class="vo-platform-targets">
          <label class="vo-checkbox">
            <input
              type="checkbox"
              class="vo-platform-checkbox"
              value="${selectedAccount.platform}"
              ${state.platformTargets.includes(selectedAccount.platform) ? 'checked' : ''}
            />
            ${selectedAccount.platform.toUpperCase()}
          </label>
        </div>
      </div>
    `;
  }

  private renderProfileSelector(filteredProfiles: BrainCoreVOStudioPipelineProfile[]): string {
    const state = this.ctx.getState();
    return `
      <div class="vo-selector">
        <label>Pipeline Profile</label>
        <select class="vo-select vo-profile-select" ${!state.projectId || filteredProfiles.length === 0 ? 'disabled' : ''}>
          <option value="">— Choose profile —</option>
          ${filteredProfiles.map((p) => `
            <option value="${p.id}" ${p.id === state.pipelineProfileId ? 'selected' : ''}>
              ${p.name}
            </option>
          `).join('')}
        </select>
      </div>
    `;
  }

  private renderDateRange(): string {
    const state = this.ctx.getState();
    const dateLabel = state.dateRange.preset === 'custom'
      ? `${state.dateRange.startDate} to ${state.dateRange.endDate}`
      : state.dateRange.preset.charAt(0).toUpperCase() + state.dateRange.preset.slice(1);

    return `
      <div class="vo-date-range">
        <label>Date Range</label>
        <div class="vo-date-buttons">
          <button class="vo-date-btn ${state.dateRange.preset === 'today' ? 'active' : ''}" data-preset="today">
            Today
          </button>
          <button class="vo-date-btn ${state.dateRange.preset === 'week' ? 'active' : ''}" data-preset="week">
            Week
          </button>
          <button class="vo-date-btn ${state.dateRange.preset === 'month' ? 'active' : ''}" data-preset="month">
            Month
          </button>
          <button class="vo-date-btn ${state.dateRange.preset === 'custom' ? 'active' : ''}" data-preset="custom">
            Custom
          </button>
        </div>
        <span class="vo-date-display">${dateLabel}</span>
      </div>
    `;
  }

  private renderSelectorHealthChip(): string {
    const selector = this.selector;
    const state = !selector
      ? 'unknown'
      : selector.running && selector.healthy
        ? 'healthy'
        : selector.running
          ? 'degraded'
          : 'stopped';
    const statusLabel = state === 'healthy'
      ? 'Running'
      : state === 'degraded'
        ? 'Degraded'
        : state === 'stopped'
          ? 'Stopped'
          : 'Unknown';
    const currentProvider = selector?.providers?.find((provider) => provider.healthy)?.id
      ?? selector?.providers?.[0]?.id
      ?? 'No provider';
    const lastChecked = selector?.lastChecked
      ? new Date(selector.lastChecked).toLocaleTimeString()
      : 'Not checked';

    return `
      <div class="vo-selector-health-chip vo-selector-health-chip--${state}" title="AI selector last checked: ${lastChecked}">
        <span class="vo-selector-health-dot"></span>
        <span class="vo-selector-health-main">AI Selector ${statusLabel}</span>
        <span class="vo-selector-health-provider">${currentProvider}</span>
      </div>
    `;
  }

  private attachEventListeners(filteredAccounts: BrainCoreVOStudioPlatformAccount[], filteredProfiles: BrainCoreVOStudioPipelineProfile[]): void {
    const projectSelect = this.container.querySelector('.vo-project-select') as HTMLSelectElement;
    const accountSelect = this.container.querySelector('.vo-account-select') as HTMLSelectElement;
    const profileSelect = this.container.querySelector('.vo-profile-select') as HTMLSelectElement;
    const platformCheckbox = this.container.querySelector('.vo-platform-checkbox') as HTMLInputElement;
    const dateButtons = this.container.querySelectorAll('[data-preset]') as NodeListOf<HTMLButtonElement>;

    if (projectSelect) {
      projectSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.ctx.setProjectId(target.value || null);
      });
    }

    if (accountSelect) {
      accountSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.ctx.setAccountId(target.value || null);
      });
    }

    if (profileSelect) {
      profileSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.ctx.setPipelineProfileId(target.value || null);
      });
    }

    if (platformCheckbox) {
      platformCheckbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const updated = target.checked
          ? [target.value]
          : [];
        this.ctx.setPlatformTargets(updated);
      });
    }

    dateButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const preset = btn.getAttribute('data-preset') as any;
        this.setDatePreset(preset);
      });
    });
  }

  private setDatePreset(preset: 'today' | 'week' | 'month' | 'custom'): void {
    const now = new Date();
    let startDate: Date;

    switch (preset) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'custom':
        return;
    }

    this.ctx.setDateRange({
      preset,
      startDate: startDate.toISOString().split('T')[0],
      endDate: now.toISOString().split('T')[0],
    });
  }
}
