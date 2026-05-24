import { VOContextBar } from './VOContextBar.js';
import { OverviewPanel } from './OverviewPanel.js';
import { PipelinesPanel } from './PipelinesPanel.js';
import { AccountsPanel } from './AccountsPanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { ContentCreationPanel } from './ContentCreationPanel.js';
import { getVOContextManager } from './VOContext.js';
import type {
  BrainCoreVOStudioProject,
  BrainCoreVOStudioPlatformAccount,
  BrainCoreVOStudioPipelineProfile,
  BrainCoreVOStudioContentItem,
  BrainCoreAiModelSelectorStatus,
  BrainCoreVOStudioAnalyticsSummary,
  BrainCoreVOAccountStatsResponse,
} from '../../client.js';

export class VOShell {
  private container: HTMLElement;
  private contextBar: VOContextBar;
  private overviewPanel: OverviewPanel | null = null;
  private pipelinesPanel: PipelinesPanel | null = null;
  private accountsPanel: AccountsPanel | null = null;
  private contentCreationPanel: ContentCreationPanel | null = null;
  private historyPanel: HistoryPanel | null = null;
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private contentContainer: HTMLElement | null = null;
  private currentTab: string = 'overview';
  private data: {
    projects?: BrainCoreVOStudioProject[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
    pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
    contentItems?: BrainCoreVOStudioContentItem[];
    selector?: BrainCoreAiModelSelectorStatus;
    analytics?: BrainCoreVOStudioAnalyticsSummary;
    accountStats?: BrainCoreVOAccountStatsResponse;
  };

  constructor(container: HTMLElement, data: {
    projects?: BrainCoreVOStudioProject[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
    pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
    contentItems?: BrainCoreVOStudioContentItem[];
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

    // Clean up previous panels
    if (this.overviewPanel) {
      this.overviewPanel.destroy();
      this.overviewPanel = null;
    }
    if (this.pipelinesPanel) {
      this.pipelinesPanel.destroy();
      this.pipelinesPanel = null;
    }
    if (this.accountsPanel) {
      this.accountsPanel.destroy();
      this.accountsPanel = null;
    }
    if (this.contentCreationPanel) {
      this.contentCreationPanel.destroy();
      this.contentCreationPanel = null;
    }
    if (this.historyPanel) {
      this.historyPanel.destroy();
      this.historyPanel = null;
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
        if (state.projectId) {
          this.pipelinesPanel = new PipelinesPanel(this.contentContainer, {
            profiles: this.data.pipelineProfiles,
            contentItems: this.data.contentItems,
          });
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view pipelines</p>
            </div>
          `;
        }
        break;

      case 'accounts':
        if (state.projectId) {
          this.accountsPanel = new AccountsPanel(this.contentContainer, {
            accounts: this.data.accounts,
            profiles: this.data.pipelineProfiles,
            accountStats: this.data.accountStats?.stats,
          });
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view accounts</p>
            </div>
          `;
        }
        break;

      case 'content':
        if (state.projectId) {
          this.contentCreationPanel = new ContentCreationPanel(this.contentContainer);
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to create content items</p>
            </div>
          `;
        }
        break;

      case 'history':
        if (state.projectId) {
          this.historyPanel = new HistoryPanel(this.contentContainer, {
            contentItems: this.data.contentItems,
            accounts: this.data.accounts,
          });
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view history</p>
            </div>
          `;
        }
        break;
    }
  }

  destroy(): void {
    this.contextBar.destroy();
    if (this.overviewPanel) {
      this.overviewPanel.destroy();
    }
    if (this.pipelinesPanel) {
      this.pipelinesPanel.destroy();
    }
    if (this.accountsPanel) {
      this.accountsPanel.destroy();
    }
    if (this.contentCreationPanel) {
      this.contentCreationPanel.destroy();
    }
    if (this.historyPanel) {
      this.historyPanel.destroy();
    }
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
