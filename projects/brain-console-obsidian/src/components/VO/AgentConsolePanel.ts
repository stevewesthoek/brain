type AgentTask = {
  taskId: string;
  title: string;
  status: string;
  role: string;
  dependsOn: string[];
  approvalRequired: boolean;
  notes?: string;
};

type AgentTaskStateStep = {
  taskId: string;
  status: string;
  selectedExecutorId?: string;
  selectedProviderId?: string;
  selectedModel?: string;
  note?: string;
};

type AgentExecutorPlanStep = {
  taskId: string;
  executorId: string;
  providerId: string;
  model?: string;
  reason: string;
};

type AgentRun = {
  id: string;
  title: string;
  status: string;
  updatedAt?: string;
};

type AgentEvent = {
  id: string;
  type: string;
  status: string;
  createdAt?: string;
  occurredAt?: string;
  summary?: string;
};

type AgentConsoleSummary = {
  activeRunCount: number;
  blockedRunCount: number;
  plannedRunCount: number;
  approvalPendingCount: number;
  executorSelectionCount: number;
  nextSafeStep: string;
  taskGraph: {
    taskCount: number;
    completedCount: number;
    blockedCount: number;
    pendingCount: number;
    tasks: AgentTask[];
  };
  taskState: {
    currentTaskId?: string;
    lastCompletedTaskId?: string;
    steps: AgentTaskStateStep[];
  };
  executorPlan: {
    steps: AgentExecutorPlanStep[];
  };
  approvalGates: {
    approvalStoreStatus: string;
    pendingCount: number;
    approvedCount: number;
    rejectedCount: number;
    expiredCount: number;
    blockedApprovalKinds: string[];
    supportedApprovalKinds: string[];
  };
  ledger: {
    runCount: number;
    eventCount: number;
    approvalCount: number;
    runs: AgentRun[];
    events: AgentEvent[];
  };
  persistence: {
    enabled: boolean;
    loadedFromDisk: boolean;
  };
};

type AgentCostLineItem = {
  taskId: string;
  taskType: string;
  providerId: string;
  estimatedCostUsd: number;
  routingReason: string;
};

type AgentCostSummary = {
  totalEstimatedUsd: number;
  todayEstimatedUsd: number;
  localRouteCount: number;
  subscriptionRouteCount: number;
  paidRouteCount: number;
  budget: {
    status: string;
    remainingUsd: number;
    spentUsd: number;
    thresholdUsd: number;
  };
  topExpensiveTasks: AgentCostLineItem[];
};

export class AgentConsolePanel {
  private container: HTMLElement;
  private refreshInterval: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async initialize(): Promise<void> {
    this.renderShell();
    await this.load();
    this.startAutoRefresh();
  }

  destroy(): void {
    if (this.refreshInterval !== null) {
      window.clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
    this.container.innerHTML = '';
  }

  private renderShell(): void {
    this.container.innerHTML = `
      <div class="vo-agent-panel">
        <div class="vo-panel-header">
          <h2>Agent Console</h2>
          <button class="vo-btn-secondary" id="agent-console-refresh">Refresh</button>
        </div>
        <div id="agent-console-status" class="vo-empty-state">
          <p>Loading agent console...</p>
        </div>
      </div>
    `;

    const refreshButton = this.container.querySelector('#agent-console-refresh') as HTMLButtonElement | null;
    refreshButton?.addEventListener('click', () => {
      void this.load();
    });
  }

  private startAutoRefresh(): void {
    this.refreshInterval = window.setInterval(() => {
      void this.load();
    }, 30000);
  }

  private async load(): Promise<void> {
    const statusEl = this.container.querySelector('#agent-console-status');
    if (!statusEl) return;

    try {
      const [consoleResponse, costResponse] = await Promise.all([
        fetch('/agent-console'),
        fetch('/agent-cost-summary'),
      ]);

      if (!consoleResponse.ok || !costResponse.ok) {
        throw new Error(`Failed to load agent console (${consoleResponse.status}/${costResponse.status})`);
      }

      const consoleSummary = (await consoleResponse.json()) as AgentConsoleSummary;
      const costSummary = (await costResponse.json()) as AgentCostSummary;
      statusEl.outerHTML = this.renderData(consoleSummary, costSummary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      statusEl.outerHTML = `
        <div id="agent-console-status" class="vo-empty-state">
          <p>Unable to load agent console.</p>
          <p>${this.escapeHtml(message)}</p>
        </div>
      `;
    }
  }

  private renderData(summary: AgentConsoleSummary, costSummary: AgentCostSummary): string {
    const currentStep = summary.taskState.steps.find((step) => step.taskId === summary.taskState.currentTaskId);
    const latestRuns = summary.ledger.runs.slice(0, 4);
    const latestEvents = summary.ledger.events.slice(0, 5);
    const expensiveTasks = costSummary.topExpensiveTasks.slice(0, 4);

    return `
      <div id="agent-console-status" class="vo-agent-console">
        <div class="vo-agent-grid">
          <section class="vo-overview-card">
            <div class="vo-overview-title">Run Summary</div>
            <div class="vo-activity-grid">
              ${this.renderMetric('Active', String(summary.activeRunCount))}
              ${this.renderMetric('Blocked', String(summary.blockedRunCount))}
              ${this.renderMetric('Planned', String(summary.plannedRunCount))}
              ${this.renderMetric('Events', String(summary.ledger.eventCount))}
            </div>
          </section>

          <section class="vo-overview-card">
            <div class="vo-overview-title">Task Graph</div>
            <div class="vo-activity-grid">
              ${this.renderMetric('Tasks', String(summary.taskGraph.taskCount))}
              ${this.renderMetric('Completed', String(summary.taskGraph.completedCount))}
              ${this.renderMetric('Pending', String(summary.taskGraph.pendingCount))}
              ${this.renderMetric('Current', currentStep ? this.escapeHtml(currentStep.taskId) : '—')}
            </div>
          </section>

          <section class="vo-overview-card">
            <div class="vo-overview-title">Approval Gates</div>
            <div class="vo-stats-table">
              ${this.renderStatRow('Store', summary.approvalGates.approvalStoreStatus)}
              ${this.renderStatRow('Pending', String(summary.approvalGates.pendingCount))}
              ${this.renderStatRow('Approved', String(summary.approvalGates.approvedCount))}
              ${this.renderStatRow('Blocked Kinds', summary.approvalGates.blockedApprovalKinds.join(', ') || 'None')}
            </div>
          </section>

          <section class="vo-overview-card">
            <div class="vo-overview-title">Cost Snapshot</div>
            <div class="vo-stats-table">
              ${this.renderStatRow('Spent', `$${costSummary.budget.spentUsd.toFixed(4)}`)}
              ${this.renderStatRow('Remaining', `$${costSummary.budget.remainingUsd.toFixed(2)}`)}
              ${this.renderStatRow('Budget', costSummary.budget.status)}
              ${this.renderStatRow('Local Routes', String(costSummary.localRouteCount))}
            </div>
          </section>
        </div>

        <div class="vo-agent-grid vo-agent-grid--detail">
          <section class="vo-overview-card">
            <div class="vo-overview-title">Current Task State</div>
            <div class="vo-stats-table">
              ${this.renderStatRow('Current Task', summary.taskState.currentTaskId || '—')}
              ${this.renderStatRow('Last Completed', summary.taskState.lastCompletedTaskId || '—')}
              ${this.renderStatRow('Executor Selections', String(summary.executorSelectionCount))}
              ${this.renderStatRow('Persistence', summary.persistence.loadedFromDisk ? 'Snapshot' : 'Derived')}
            </div>
            <p class="vo-agent-next-step">${this.escapeHtml(summary.nextSafeStep)}</p>
          </section>

          <section class="vo-overview-card">
            <div class="vo-overview-title">Executor Plan</div>
            <div class="vo-agent-list">
              ${summary.executorPlan.steps.map((step) => `
                <div class="vo-agent-list-item">
                  <div class="vo-agent-list-header">
                    <strong>${this.escapeHtml(step.taskId)}</strong>
                    <span>${this.escapeHtml(step.providerId)}</span>
                  </div>
                  <div class="vo-agent-list-meta">${this.escapeHtml(step.executorId)}${step.model ? ` · ${this.escapeHtml(step.model)}` : ''}</div>
                  <div class="vo-agent-list-copy">${this.escapeHtml(step.reason)}</div>
                </div>
              `).join('')}
            </div>
          </section>
        </div>

        <div class="vo-agent-grid vo-agent-grid--detail">
          <section class="vo-overview-card">
            <div class="vo-overview-title">Recent Runs</div>
            <div class="vo-agent-list">
              ${latestRuns.map((run) => `
                <div class="vo-agent-list-item">
                  <div class="vo-agent-list-header">
                    <strong>${this.escapeHtml(run.title)}</strong>
                    <span>${this.escapeHtml(run.status)}</span>
                  </div>
                  <div class="vo-agent-list-meta">${this.escapeHtml(run.id)}</div>
                </div>
              `).join('') || '<div class="vo-agent-list-item">No runs recorded.</div>'}
            </div>
          </section>

          <section class="vo-overview-card">
            <div class="vo-overview-title">Recent Events</div>
            <div class="vo-agent-list">
              ${latestEvents.map((event) => `
                <div class="vo-agent-list-item">
                  <div class="vo-agent-list-header">
                    <strong>${this.escapeHtml(event.type)}</strong>
                    <span>${this.escapeHtml(event.status)}</span>
                  </div>
                  <div class="vo-agent-list-meta">${this.escapeHtml(event.id)}</div>
                  ${event.summary ? `<div class="vo-agent-list-copy">${this.escapeHtml(event.summary)}</div>` : ''}
                </div>
              `).join('') || '<div class="vo-agent-list-item">No events recorded.</div>'}
            </div>
          </section>

          <section class="vo-overview-card">
            <div class="vo-overview-title">Top Costed Tasks</div>
            <div class="vo-agent-list">
              ${expensiveTasks.map((task) => `
                <div class="vo-agent-list-item">
                  <div class="vo-agent-list-header">
                    <strong>${this.escapeHtml(task.taskId)}</strong>
                    <span>$${task.estimatedCostUsd.toFixed(4)}</span>
                  </div>
                  <div class="vo-agent-list-meta">${this.escapeHtml(task.providerId)} · ${this.escapeHtml(task.taskType)}</div>
                  <div class="vo-agent-list-copy">${this.escapeHtml(task.routingReason)}</div>
                </div>
              `).join('') || '<div class="vo-agent-list-item">No cost entries recorded.</div>'}
            </div>
          </section>
        </div>

        <section class="vo-overview-card">
          <div class="vo-overview-title">Task Detail</div>
          <div class="vo-agent-task-table">
            <div class="vo-agent-task-row vo-agent-task-row--header">
              <span>Task</span>
              <span>Status</span>
              <span>Role</span>
              <span>Depends On</span>
              <span>Approval</span>
            </div>
            ${summary.taskGraph.tasks.map((task) => `
              <div class="vo-agent-task-row">
                <span><strong>${this.escapeHtml(task.taskId)}</strong><br>${this.escapeHtml(task.title)}</span>
                <span>${this.escapeHtml(task.status)}</span>
                <span>${this.escapeHtml(task.role)}</span>
                <span>${this.escapeHtml(task.dependsOn.join(', ') || '—')}</span>
                <span>${task.approvalRequired ? 'Required' : 'None'}</span>
              </div>
            `).join('')}
          </div>
        </section>
      </div>
    `;
  }

  private renderMetric(label: string, value: string): string {
    return `
      <div class="vo-activity-stat">
        <span class="vo-stat-label">${this.escapeHtml(label)}</span>
        <span class="vo-stat-value">${this.escapeHtml(value)}</span>
      </div>
    `;
  }

  private renderStatRow(label: string, value: string): string {
    return `
      <div class="vo-stat-row">
        <span class="vo-stat-key">${this.escapeHtml(label)}</span>
        <span class="vo-stat-value">${this.escapeHtml(value)}</span>
      </div>
    `;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
