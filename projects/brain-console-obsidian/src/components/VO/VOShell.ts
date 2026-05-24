import { VOContextBar } from './VOContextBar.js';
import { getVOContextManager } from './VOContext.js';
import type {
  BrainCoreVOStudioProject,
  BrainCoreVOStudioPlatformAccount,
  BrainCoreVOStudioPipelineProfile,
} from '../../client.js';

export class VOShell {
  private container: HTMLElement;
  private contextBar: VOContextBar;
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, data: {
    projects?: BrainCoreVOStudioProject[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
    pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
  }) {
    this.container = container;
    this.container.classList.add('vo-shell');

    // Create and mount context bar
    const barContainer = document.createElement('div');
    this.contextBar = new VOContextBar(barContainer, data);
    this.container.appendChild(barContainer);

    // Create tabs and content area
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'vo-tabs-container';
    tabsContainer.innerHTML = `
      <div class="vo-tabs">
        <button class="vo-tab vo-tab--active" data-tab="overview">Overview</button>
        <button class="vo-tab" data-tab="pipelines">Pipelines</button>
        <button class="vo-tab" data-tab="accounts">Accounts</button>
        <button class="vo-tab" data-tab="content">Content</button>
        <button class="vo-tab" data-tab="history">History</button>
      </div>
    `;
    this.container.appendChild(tabsContainer);

    const contentContainer = document.createElement('div');
    contentContainer.className = 'vo-tab-content';
    this.container.appendChild(contentContainer);

    // Attach tab listeners
    tabsContainer.querySelectorAll('.vo-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        tabsContainer.querySelectorAll('.vo-tab').forEach((b) => b.classList.remove('vo-tab--active'));
        target.classList.add('vo-tab--active');
      });
    });

    // Subscribe to context changes to update content
    this.unsubscribe = this.ctx.subscribe(() => this.updateContent(contentContainer));
    this.updateContent(contentContainer);
  }

  private updateContent(contentContainer: HTMLElement): void {
    const state = this.ctx.getState();

    if (state.projectId && state.accountId) {
      contentContainer.innerHTML = `
        <div class="vo-selected-state">
          <p><strong>Project:</strong> ${state.projectId}</p>
          <p><strong>Account:</strong> ${state.accountId}</p>
          <p><strong>Platforms:</strong> ${state.platformTargets.join(', ') || 'None selected'}</p>
          <p><strong>Profile:</strong> ${state.pipelineProfileId || 'None'}</p>
          <p><strong>Date Range:</strong> ${state.dateRange.startDate} to ${state.dateRange.endDate}</p>
        </div>
      `;
    } else {
      contentContainer.innerHTML = `
        <div class="vo-empty-state">
          <p>Select a project and account to begin</p>
        </div>
      `;
    }
  }

  destroy(): void {
    this.contextBar.destroy();
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
