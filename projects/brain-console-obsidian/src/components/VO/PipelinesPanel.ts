import type {
  BrainCoreVOStudioPipelineProfile,
  BrainCoreVOStudioPipelineStage,
  BrainCoreVOStudioContentItem,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';

export interface PipelineRun {
  id: string;
  contentItemId: string;
  contentTitle: string;
  date: string;
  status: 'completed' | 'failed' | 'in-progress' | 'blocked';
  duration?: string;
  stagesCompleted?: number;
  stageFailed?: string;
  errorMessage?: string;
}

export class PipelinesPanel {
  private container: HTMLElement;
  private profiles: BrainCoreVOStudioPipelineProfile[] = [];
  private contentItems: BrainCoreVOStudioContentItem[] = [];
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private selectedProfileId: string | null = null;
  private expandedRunId: string | null = null;

  constructor(container: HTMLElement, data: {
    profiles?: BrainCoreVOStudioPipelineProfile[];
    contentItems?: BrainCoreVOStudioContentItem[];
  }) {
    this.container = container;
    this.profiles = data.profiles || [];
    this.contentItems = data.contentItems || [];

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    const state = this.ctx.getState();

    // Get filtered profiles for current project
    const profilesForProject = this.profiles.filter((p) => p.projectId === state.projectId);

    this.container.innerHTML = `
      <div class="vo-pipelines-panel">
        ${this.renderPipelineSelector(profilesForProject)}
        ${this.renderPipelineStageMap(profilesForProject)}
        ${this.renderRunHistory()}
      </div>
    `;

    // Attach event listeners
    this.attachEventListeners(profilesForProject);
  }

  private renderPipelineSelector(profiles: BrainCoreVOStudioPipelineProfile[]): string {
    const state = this.ctx.getState();

    if (profiles.length === 0) {
      return `
        <div class="vo-pipelines-card">
          <p class="vo-placeholder">No pipelines configured for this project</p>
        </div>
      `;
    }

    return `
      <div class="vo-pipelines-card">
        <h3 class="vo-overview-title">Pipeline Profile</h3>
        <div class="vo-pipeline-selector">
          ${profiles.map((p) => `
            <button class="vo-pipeline-btn ${this.selectedProfileId === p.id || !this.selectedProfileId && profiles[0]?.id === p.id ? 'active' : ''}" data-profile-id="${p.id}">
              <span class="vo-pipeline-name">${p.name}</span>
              <span class="vo-pipeline-targets">${p.targetPlatforms.join(', ')}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderPipelineStageMap(profiles: BrainCoreVOStudioPipelineProfile[]): string {
    if (profiles.length === 0) return '';

    const currentProfileId = this.selectedProfileId || profiles[0]?.id;
    const profile = profiles.find((p) => p.id === currentProfileId);

    if (!profile) {
      return '';
    }

    return `
      <div class="vo-pipelines-card">
        <h3 class="vo-overview-title">Pipeline Stages</h3>
        <div class="vo-stage-map">
          ${profile.enabledStages.map((stage, idx) => `
            <div class="vo-stage-item">
              <div class="vo-stage-number">${idx + 1}</div>
              <div class="vo-stage-content">
                <div class="vo-stage-name">${stage.label}</div>
                <div class="vo-stage-status ${this.getStageStatusClass(stage.status)}">${stage.status}</div>
              </div>
              ${idx < profile.enabledStages.length - 1 ? '<div class="vo-stage-arrow">→</div>' : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private getStageStatusClass(status: string): string {
    switch (status) {
      case 'enabled':
        return 'vo-status-enabled';
      case 'approval-gated':
        return 'vo-status-approval';
      case 'manual-only':
        return 'vo-status-manual';
      case 'disabled':
        return 'vo-status-disabled';
      default:
        return '';
    }
  }

  private renderRunHistory(): string {
    const runs = this.getRunHistory();

    if (runs.length === 0) {
      return `
        <div class="vo-pipelines-card">
          <h3 class="vo-overview-title">Run History</h3>
          <p class="vo-placeholder">No runs recorded</p>
        </div>
      `;
    }

    return `
      <div class="vo-pipelines-card">
        <h3 class="vo-overview-title">Recent Runs</h3>
        <div class="vo-runs-table">
          <div class="vo-runs-header">
            <div class="vo-run-col-date">Date</div>
            <div class="vo-run-col-content">Content</div>
            <div class="vo-run-col-status">Status</div>
            <div class="vo-run-col-duration">Duration</div>
          </div>
          ${runs.map((run) => `
            <div class="vo-run-row ${this.expandedRunId === run.id ? 'expanded' : ''}" data-run-id="${run.id}">
              <div class="vo-run-row-main">
                <div class="vo-run-col-date">${run.date}</div>
                <div class="vo-run-col-content">${run.contentTitle}</div>
                <div class="vo-run-col-status">
                  <span class="vo-run-status ${this.getRunStatusClass(run.status)}">${run.status}</span>
                </div>
                <div class="vo-run-col-duration">${run.duration || '—'}</div>
              </div>
              ${this.expandedRunId === run.id ? `
                <div class="vo-run-detail">
                  <div class="vo-run-detail-row">
                    <span class="vo-detail-key">Stages Completed:</span>
                    <span class="vo-detail-value">${run.stagesCompleted || '—'}</span>
                  </div>
                  ${run.stageFailed ? `
                    <div class="vo-run-detail-row vo-detail-error">
                      <span class="vo-detail-key">Failed Stage:</span>
                      <span class="vo-detail-value">${run.stageFailed}</span>
                    </div>
                  ` : ''}
                  ${run.errorMessage ? `
                    <div class="vo-run-detail-row vo-detail-error">
                      <span class="vo-detail-key">Error:</span>
                      <span class="vo-detail-value vo-detail-monospace">${run.errorMessage}</span>
                    </div>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private getRunStatusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'vo-run-completed';
      case 'failed':
        return 'vo-run-failed';
      case 'in-progress':
        return 'vo-run-in-progress';
      case 'blocked':
        return 'vo-run-blocked';
      default:
        return '';
    }
  }

  private getRunHistory(): PipelineRun[] {
    // In a real implementation, this would fetch from VO jobs API
    // For now, generate fixture data from content items
    const state = this.ctx.getState();

    if (!state.projectId) return [];

    // Generate 5 fixture runs from content items
    const runs: PipelineRun[] = [];
    const now = new Date();

    const fixtureRuns = [
      { status: 'completed', stagesCompleted: 8, duration: '2h 15m' },
      { status: 'completed', stagesCompleted: 8, duration: '2h 18m' },
      { status: 'completed', stagesCompleted: 8, duration: '2h 12m' },
      { status: 'failed', stagesCompleted: 5, stageFailed: 'Captions', errorMessage: 'Timeout waiting for caption service' },
      { status: 'in-progress', stagesCompleted: 3, duration: 'ongoing' },
    ];

    const projectItems = this.contentItems.filter((i) => i.projectId === state.projectId);

    projectItems.slice(0, 5).forEach((item, idx) => {
      const runDate = new Date(now.getTime() - (idx * 24 * 60 * 60 * 1000));
      const fixture = fixtureRuns[idx] || fixtureRuns[0];

      runs.push({
        id: `run-${item.id}-${idx}`,
        contentItemId: item.id,
        contentTitle: item.title,
        date: runDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        status: fixture.status as any,
        duration: fixture.duration,
        stagesCompleted: fixture.stagesCompleted,
        stageFailed: fixture.stageFailed,
        errorMessage: fixture.errorMessage,
      });
    });

    return runs;
  }

  private attachEventListeners(profiles: BrainCoreVOStudioPipelineProfile[]): void {
    // Profile selector buttons
    this.container.querySelectorAll('.vo-pipeline-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const profileId = target.getAttribute('data-profile-id');

        this.container.querySelectorAll('.vo-pipeline-btn').forEach((b) => b.classList.remove('active'));
        target.classList.add('active');

        this.selectedProfileId = profileId;
        this.renderPipelineStageMap(profiles);
      });
    });

    // Run row expansion
    this.container.querySelectorAll('.vo-run-row').forEach((row) => {
      row.addEventListener('click', () => {
        const runId = row.getAttribute('data-run-id');
        if (this.expandedRunId === runId) {
          this.expandedRunId = null;
        } else {
          this.expandedRunId = runId;
        }

        this.container.querySelectorAll('.vo-run-row').forEach((r) => r.classList.remove('expanded'));
        if (this.expandedRunId) {
          row.classList.add('expanded');
        }
      });
    });
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
