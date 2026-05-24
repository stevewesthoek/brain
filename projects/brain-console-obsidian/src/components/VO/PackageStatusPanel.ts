export interface PackageStatus {
  id: string;
  contentItemId: string;
  status: string;
  stage: string;
  progressPercent: number;
  currentJob?: {
    id: string;
    type: string;
    status: string;
    startedAt?: string;
  };
  completedStages: string[];
  failedStages: string[];
}

export class PackageStatusPanel {
  private container: HTMLElement;
  private packages: Map<string, PackageStatus> = new Map();
  private refreshInterval: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async initialize(): Promise<void> {
    this.render();
    this.startAutoRefresh();
  }

  private render(): void {
    const html = `
      <div class="vo-package-status">
        <div class="vo-panel-header">
          <h3>Package Execution</h3>
          <button class="vo-btn-secondary" id="status-refresh">Refresh</button>
        </div>

        <div class="vo-packages-list" id="packages-list">
          <div class="vo-empty-state">No packages to track</div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;

    const refreshBtn = this.container.querySelector('#status-refresh');
    refreshBtn?.addEventListener('click', () => this.loadPackages());
  }

  async loadPackages(): Promise<void> {
    // This would be called with specific package IDs
    // For now, render any packages that have been added
    this.renderPackages();
  }

  trackPackage(packageId: string, status: PackageStatus): void {
    this.packages.set(packageId, status);
    this.renderPackages();
  }

  private renderPackages(): void {
    const listEl = this.container.querySelector('#packages-list');
    if (!listEl) return;

    if (this.packages.size === 0) {
      listEl.innerHTML = '<div class="vo-empty-state">No packages to track</div>';
      return;
    }

    const packagesHtml = Array.from(this.packages.values())
      .map((pkg) => this.renderPackageCard(pkg))
      .join('');

    listEl.innerHTML = packagesHtml;
  }

  private renderPackageCard(pkg: PackageStatus): string {
    const stageBars = this.renderStageProgress(pkg);
    const currentJobInfo = pkg.currentJob
      ? `<div class="vo-current-job">
           <span>${pkg.currentJob.type}</span>
           <span class="vo-job-status">${pkg.currentJob.status}</span>
         </div>`
      : '';

    return `
      <div class="vo-package-card" data-package-id="${pkg.id}">
        <div class="vo-package-header">
          <h4>${pkg.contentItemId}</h4>
          <span class="vo-status-badge vo-status-${pkg.status}">${pkg.status}</span>
        </div>

        <div class="vo-progress-section">
          <div class="vo-progress-bar">
            <div class="vo-progress-fill" style="width: ${pkg.progressPercent}%"></div>
          </div>
          <span class="vo-progress-text">${pkg.progressPercent}%</span>
        </div>

        <div class="vo-stages-section">
          ${stageBars}
        </div>

        ${currentJobInfo}

        <div class="vo-package-actions">
          <button class="vo-btn-small" data-package-id="${pkg.id}">View Details</button>
        </div>
      </div>
    `;
  }

  private renderStageProgress(pkg: PackageStatus): string {
    const stages = ['thumbnail', 'metadata', 'final_review', 'publishing'];

    return stages
      .map((stage) => {
        let stageClass = 'vo-stage-pending';
        if (pkg.completedStages.includes(stage)) {
          stageClass = 'vo-stage-completed';
        } else if (pkg.failedStages.includes(stage)) {
          stageClass = 'vo-stage-failed';
        } else if (pkg.stage === stage) {
          stageClass = 'vo-stage-active';
        }

        return `<div class="vo-stage-item ${stageClass}" title="${stage}">${stage.slice(0, 3)}</div>`;
      })
      .join('');
  }

  private startAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = window.setInterval(() => {
      this.loadPackages();
    }, 30000); // Refresh every 30 seconds
  }

  destroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.container.innerHTML = '';
  }
}
