import { VOContextBar } from './VOContextBar.js';
import { OverviewPanel } from './OverviewPanel.js';
import { PipelinesPanel } from './PipelinesPanel.js';
import { AccountsPanel } from './AccountsPanel.js';
import { HistoryPanel } from './HistoryPanel.js';
import { ApprovalQueuePanel } from './ApprovalQueuePanel.js';
import { DeadLetterReviewPanel } from './DeadLetterReviewPanel.js';
import { PackageStatusPanel } from './PackageStatusPanel.js';
import { PublishingDashboardPanel } from './PublishingDashboardPanel.js';
import { EventLogPanel } from './EventLogPanel.js';
import { StudioDashboardPanel } from './StudioDashboardPanel.js';
import { AuditLogPanel } from './AuditLogPanel.js';
import { OperatorDashboardPanel } from './OperatorDashboardPanel.js';
import { JobProgressPanel } from './JobProgressPanel.js';
import { AgentConsolePanel } from './AgentConsolePanel.js';
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
  private historyPanel: HistoryPanel | null = null;
  private approvalQueuePanel: ApprovalQueuePanel | null = null;
  private deadLetterReviewPanel: DeadLetterReviewPanel | null = null;
  private jobProgressPanel: JobProgressPanel | null = null;
  private agentConsolePanel: AgentConsolePanel | null = null;
  private packageStatusPanel: PackageStatusPanel | null = null;
  private publishingDashboardPanel: PublishingDashboardPanel | null = null;
  private eventLogPanel: EventLogPanel | null = null;
  private studioDashboardPanel: StudioDashboardPanel | null = null;
  private auditLogPanel: AuditLogPanel | null = null;
  private operatorDashboardPanel: OperatorDashboardPanel | null = null;
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private contentContainer: HTMLElement | null = null;
  private currentTab: string = 'overview';
  private brainCoreUrl: string;
  private data: {
    projects?: BrainCoreVOStudioProject[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
    pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
    contentItems?: BrainCoreVOStudioContentItem[];
    selector?: BrainCoreAiModelSelectorStatus;
    analytics?: BrainCoreVOStudioAnalyticsSummary;
    accountStats?: BrainCoreVOAccountStatsResponse;
  };

  constructor(
    container: HTMLElement,
    data: {
      projects?: BrainCoreVOStudioProject[];
      accounts?: BrainCoreVOStudioPlatformAccount[];
      pipelineProfiles?: BrainCoreVOStudioPipelineProfile[];
      contentItems?: BrainCoreVOStudioContentItem[];
      selector?: BrainCoreAiModelSelectorStatus;
      analytics?: BrainCoreVOStudioAnalyticsSummary;
      accountStats?: BrainCoreVOAccountStatsResponse;
    },
    brainCoreUrl: string = 'http://localhost:4877',
  ) {
    this.container = container;
    this.container.classList.add('vo-shell');
    this.data = data;
    this.brainCoreUrl = brainCoreUrl;

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
        <button class="vo-tab" data-tab="approvals">Approvals</button>
        <button class="vo-tab" data-tab="jobs">Jobs</button>
        <button class="vo-tab" data-tab="dead-letter">Dead Letter</button>
        <button class="vo-tab" data-tab="agents">Agents</button>
        <button class="vo-tab" data-tab="packages">Packages</button>
        <button class="vo-tab" data-tab="publishing">Publishing</button>
        <button class="vo-tab" data-tab="history">History</button>
        <button class="vo-tab" data-tab="events">Events</button>
        <button class="vo-tab" data-tab="dashboard">Dashboard</button>
        <button class="vo-tab" data-tab="admin">Admin</button>
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
    if (this.approvalQueuePanel) {
      this.approvalQueuePanel.destroy();
      this.approvalQueuePanel = null;
    }
    if (this.deadLetterReviewPanel) {
      this.deadLetterReviewPanel.destroy();
      this.deadLetterReviewPanel = null;
    }
    if (this.jobProgressPanel) {
      this.jobProgressPanel.destroy();
      this.jobProgressPanel = null;
    }
    if (this.agentConsolePanel) {
      this.agentConsolePanel.destroy();
      this.agentConsolePanel = null;
    }
    if (this.packageStatusPanel) {
      this.packageStatusPanel.destroy();
      this.packageStatusPanel = null;
    }
    if (this.publishingDashboardPanel) {
      this.publishingDashboardPanel.destroy();
      this.publishingDashboardPanel = null;
    }
    if (this.historyPanel) {
      this.historyPanel.destroy();
      this.historyPanel = null;
    }
    if (this.eventLogPanel) {
      this.eventLogPanel.destroy();
      this.eventLogPanel = null;
    }
    if (this.studioDashboardPanel) {
      this.studioDashboardPanel.destroy();
      this.studioDashboardPanel = null;
    }
    if (this.auditLogPanel) {
      this.auditLogPanel.destroy();
      this.auditLogPanel = null;
    }
    if (this.operatorDashboardPanel) {
      this.operatorDashboardPanel.destroy();
      this.operatorDashboardPanel = null;
    }

    const state = this.ctx.getState();

    // Render based on current tab
    switch (this.currentTab) {
      case 'overview':
        if (state.projectId && state.accountId) {
          this.overviewPanel = new OverviewPanel(
            this.contentContainer,
            {
              selector: this.data.selector,
              analytics: this.data.analytics,
              accountStats: this.data.accountStats,
              accounts: this.data.accounts,
            },
            this.brainCoreUrl,
          );
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

      case 'approvals':
        if (state.projectId) {
          this.approvalQueuePanel = new ApprovalQueuePanel(this.contentContainer, state.projectId);
          this.approvalQueuePanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view approval queue</p>
            </div>
          `;
        }
        break;

      case 'jobs':
        if (state.projectId) {
          this.jobProgressPanel = new JobProgressPanel(this.contentContainer, state.projectId);
          this.jobProgressPanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view job progress</p>
            </div>
          `;
        }
        break;

      case 'dead-letter':
        if (state.projectId) {
          this.deadLetterReviewPanel = new DeadLetterReviewPanel(this.contentContainer, state.projectId);
          this.deadLetterReviewPanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to review dead jobs</p>
            </div>
          `;
        }
        break;

      case 'agents':
        this.agentConsolePanel = new AgentConsolePanel(this.contentContainer);
        this.agentConsolePanel.initialize();
        break;

      case 'packages':
        if (state.projectId) {
          this.packageStatusPanel = new PackageStatusPanel(this.contentContainer);
          this.packageStatusPanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view package status</p>
            </div>
          `;
        }
        break;

      case 'publishing':
        if (state.projectId) {
          this.publishingDashboardPanel = new PublishingDashboardPanel(this.contentContainer, state.projectId);
          this.publishingDashboardPanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view publishing dashboard</p>
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

      case 'events':
        if (state.projectId) {
          this.eventLogPanel = new EventLogPanel(this.contentContainer, state.projectId);
          this.eventLogPanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view event log</p>
            </div>
          `;
        }
        break;

      case 'dashboard':
        if (state.projectId) {
          this.studioDashboardPanel = new StudioDashboardPanel(this.contentContainer, state.projectId);
          this.studioDashboardPanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view dashboard</p>
            </div>
          `;
        }
        break;

      case 'admin':
        if (state.projectId) {
          // Admin tab shows two sub-panels: Operator Dashboard + Audit Log
          const adminContainer = document.createElement('div');
          adminContainer.className = 'vo-admin-tab';
          this.contentContainer.innerHTML = '';
          this.contentContainer.appendChild(adminContainer);

          const dashSection = document.createElement('div');
          dashSection.className = 'vo-admin-section';
          adminContainer.appendChild(dashSection);

          const auditSection = document.createElement('div');
          auditSection.className = 'vo-admin-section';
          adminContainer.appendChild(auditSection);

          this.operatorDashboardPanel = new OperatorDashboardPanel(dashSection, state.projectId);
          this.operatorDashboardPanel.initialize();

          this.auditLogPanel = new AuditLogPanel(auditSection, state.projectId);
          this.auditLogPanel.initialize();
        } else {
          this.contentContainer.innerHTML = `
            <div class="vo-empty-state">
              <p>Select a project to view admin panel</p>
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
    if (this.approvalQueuePanel) {
      this.approvalQueuePanel.destroy();
    }
    if (this.deadLetterReviewPanel) {
      this.deadLetterReviewPanel.destroy();
    }
    if (this.jobProgressPanel) {
      this.jobProgressPanel.destroy();
    }
    if (this.agentConsolePanel) {
      this.agentConsolePanel.destroy();
    }
    if (this.packageStatusPanel) {
      this.packageStatusPanel.destroy();
    }
    if (this.publishingDashboardPanel) {
      this.publishingDashboardPanel.destroy();
    }
    if (this.historyPanel) {
      this.historyPanel.destroy();
    }
    if (this.eventLogPanel) {
      this.eventLogPanel.destroy();
    }
    if (this.studioDashboardPanel) {
      this.studioDashboardPanel.destroy();
    }
    if (this.auditLogPanel) {
      this.auditLogPanel.destroy();
    }
    if (this.operatorDashboardPanel) {
      this.operatorDashboardPanel.destroy();
    }
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
