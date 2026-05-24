import { VOContextBar } from './VOContextBar.js';
import { OverviewPanel } from './OverviewPanel.js';
import { getVOContextManager } from './VOContext.js';
import type {
  BrainCoreVOStudioProject,
  BrainCoreVOStudioPlatformAccount,
  BrainCoreVOStudioPipelineProfile,
  BrainCoreAiModelSelectorStatus,
  BrainCoreVOStudioAnalyticsSummary,
  BrainCoreVOAccountStatsResponse,
} from '../../client.js';

export class VOShell {
  private container: HTMLElement;
  private contextBar: VOContextBar;
  private overviewPanel: OverviewPanel | null = null;
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private contentContainer: HTMLElement | null = null;
  private currentTab: string = 'overview';
  private data: {
    projects?: BrainCoreVOStudioProject[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
    pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
    selector?: BrainCoreAiModelSelectorStatus;
    analytics?: BrainCoreVOStudioAnalyticsSummary;
    accountStats?: BrainCoreVOAccountStatsResponse;
  };

  constructor(container: HTMLElement, data: {
    projects?: BrainCoreVOStudioProject[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
    pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
    selector?: BrainCoreAiModelSelectorStatus;
    analytics?: BrainCoreVOStudioAnalyticsSummary;
    accountStats?: BrainCoreVOAccountStatsResponse;
  }) {
    this.container = container;
    this.container.classList.add('vo-shell');
    this.data = data;

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

    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'vo-tab-content';
    this.container.appendChild(this.contentContainer);

    // Attach tab listeners
    tabsContainer.querySelectorAll('.vo-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const tab = target.getAttribute('data-tab');
        if (tab) {
          this.switchTab(tab, tabsContainer);
        }
      });
    });

    // Subscribe to context changes to update content
    this.unsubscribe = this.ctx.subscribe(() => this.renderCurrentTab());
    this.renderCurrentTab();
  }

  private switchTab(tabName: string, tabsContainer: HTMLElement): void {
    this.currentTab = tabName;

    // Update active tab button
    tabsContainer.querySelectorAll('.vo-tab').forEach((b) => b.classList.remove('vo-tab--active'));
    tabsContainer.querySelector(`[data-tab="${tabName}"]`)?.classList.add('vo-tab--active');

    // Render new tab content
    this.renderCurrentTab();
  }

  private renderCurrentTab(): void {
    if (!this.contentContainer) return;

    // Clean up previous panel if it exists
    if (this.overviewPanel) {
      this.overviewPanel.destroy();
      this.overviewPanel = null;
    }

    const state = this.ctx.getState();

    // Render based on current tab
    switch (this.currentTab) {
      case 'overview':
        if (state.projectId && state.accountId) {
          this.overviewPanel = new OverviewPanel(this.contentContainer, {
            selector: this.data.selector,
            analytics: this.data.analytics,
            accountStats: this.data.accountStats,
            accounts: this.data.accounts,
          });
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project and account to view overview</p>
            </div>
          `;
        }
        break;

      case 'pipelines':
        this.contentContainer.innerHTML = `
          <div class="vo-empty-state">
            <p>Pipelines panel — coming soon</p>
          </div>
        `;
        break;

      case 'accounts':
        this.contentContainer.innerHTML = `
          <div class="vo-empty-state">
            <p>Accounts panel — coming soon</p>
          </div>
        `;
        break;

      case 'content':
        this.contentContainer.innerHTML = `
          <div class="vo-empty-state">
            <p>Content panel — coming soon</p>
          </div>
        `;
        break;

      case 'history':
        this.contentContainer.innerHTML = `
          <div class="vo-empty-state">
            <p>History panel — coming soon</p>
          </div>
        `;
        break;
    }
  }

  destroy(): void {
    this.contextBar.destroy();
    if (this.overviewPanel) {
      this.overviewPanel.destroy();
    }
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
