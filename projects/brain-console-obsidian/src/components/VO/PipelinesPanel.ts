import type {
  BrainCoreVOStudioPipelineProfile,
  BrainCoreVOStudioContentItem,
  BrainCoreVOJob,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';

export interface PipelineRun {
  id: string;
  contentItemId: string;
  contentTitle: string;
  date: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  startedAt: string;
  completedAt: string | null;
  stage: string;
  errorMessage?: string;
  logs?: string[];
  artifacts?: string[];
}

const PIPELINE_STAGES = [
  'Intake',
  'Script',
  'Assets',
  'Design',
  'Voiceover',
  'Visuals',
  'Assembly',
  'Publishing',
];

export class PipelinesPanel {
  private container: HTMLElement;
  private profiles: BrainCoreVOStudioPipelineProfile[] = [];
  private contentItems: BrainCoreVOStudioContentItem[] = [];
  private liveJobs: BrainCoreVOJob[] = [];
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private selectedProfileId: string | null = null;
  private selectedRunId: string | null = null;
  private loading = false;

  constructor(container: HTMLElement, data: {
    profiles?: BrainCoreVOStudioPipelineProfile[];
    contentItems?: BrainCoreVOStudioContentItem[];
  }) {
    this.container = container;
    this.profiles = data.profiles || [];
    this.contentItems = data.contentItems || [];

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
    this.fetchLiveJobs();
  }

  private async fetchLiveJobs(): Promise<void> {
    const state = this.ctx.getState();
    this.loading = true;
    try {
      const url = state.projectId
        ? `http://localhost:4877/api/infra/video-orchestrator/jobs?limit=50&projectId=${encodeURIComponent(state.projectId)}`
        : 'http://localhost:4877/api/infra/video-orchestrator/jobs?limit=50';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { jobs?: BrainCoreVOJob[] };
        this.liveJobs = data.jobs || [];
      }
    } catch {
      // Continue with fixture data
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    const state = this.ctx.getState();
    const profilesForProject = this.profiles.filter((p) => p.projectId === state.projectId);
    const runs = this.buildRuns();

    this.container.innerHTML = `
      <div class="vo-pipelines-panel vo-pipelines-panel--threecol">
        <div class="vo-pipelines-left">
          ${this.renderStageMap(profilesForProject)}
          ${this.renderProfileSelector(profilesForProject)}
        </div>
        <div class="vo-pipelines-center">
          ${this.renderRunHistory(runs)}
        </div>
        <div class="vo-pipelines-right ${this.selectedRunId ? 'vo-pipelines-right--open' : ''}">
          ${this.renderRunDetail(runs)}
        </div>
      </div>
    `;

    this.attachEventListeners(profilesForProject, runs);
  }

  private renderStageMap(profiles: BrainCoreVOStudioPipelineProfile[]): string {
    const currentProfileId = this.selectedProfileId || profiles[0]?.id;
    const profile = profiles.find((p) => p.id === currentProfileId);
    const stages = profile?.enabledStages ?? [];

    return `
      <div class="vo-pipelines-card">
        <h3 class="vo-overview-title">Pipeline Stages</h3>
        <div class="vo-stage-map vo-stage-map--horizontal">
          ${PIPELINE_STAGES.map((stageName, idx) => {
            const configuredStage = stages.find((s) => s.label.toLowerCase().includes(stageName.toLowerCase()));
            const statusClass = configuredStage ? this.getStageStatusClass(configuredStage.status) : 'vo-status-disabled';
            const status = configuredStage?.status ?? 'n/a';
            return `
              <div class="vo-stage-item vo-stage-item--compact">
                <div class="vo-stage-number">${idx + 1}</div>
                <div class="vo-stage-content">
                  <div class="vo-stage-name">${stageName}</div>
                  <div class="vo-stage-status ${statusClass}">${status}</div>
                </div>
                ${idx < PIPELINE_STAGES.length - 1 ? '<div class="vo-stage-arrow">→</div>' : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  private renderProfileSelector(profiles: BrainCoreVOStudioPipelineProfile[]): string {
    if (profiles.length === 0) {
      return `
        <div class="vo-pipelines-card">
          <p class="vo-placeholder">No pipeline profiles for this project</p>
        </div>
      `;
    }

    return `
      <div class="vo-pipelines-card">
        <h3 class="vo-overview-title">Profile</h3>
        <div class="vo-pipeline-selector">
          ${profiles.map((p) => `
            <button
              class="vo-pipeline-btn ${(this.selectedProfileId === p.id) || (!this.selectedProfileId && profiles[0]?.id === p.id) ? 'active' : ''}"
              data-profile-id="${p.id}"
            >
              <span class="vo-pipeline-name">${p.name}</span>
              <span class="vo-pipeline-targets">${p.targetPlatforms.join(', ')}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderRunHistory(runs: PipelineRun[]): string {
    if (this.loading) {
      return `
        <div class="vo-pipelines-card">
          <h3 class="vo-overview-title">Run History</h3>
          <p class="vo-placeholder">Loading...</p>
        </div>
      `;
    }

    if (runs.length === 0) {
      return `
        <div class="vo-pipelines-card">
          <h3 class="vo-overview-title">Run History</h3>
          <p class="vo-placeholder">No runs recorded</p>
        </div>
      `;
    }

    return `
      <div class="vo-pipelines-card vo-pipelines-card--fill">
        <h3 class="vo-overview-title">Run History</h3>
        <div class="vo-runs-table">
          <div class="vo-runs-header vo-runs-header--extended">
            <div class="vo-run-col-id">ID</div>
            <div class="vo-run-col-status">Status</div>
            <div class="vo-run-col-stage">Stage</div>
            <div class="vo-run-col-progress">Progress</div>
            <div class="vo-run-col-date">Started</div>
            <div class="vo-run-col-date">Completed</div>
          </div>
          ${runs.map((run) => `
            <div
              class="vo-run-row ${this.selectedRunId === run.id ? 'vo-run-row--selected' : ''}"
              data-run-id="${run.id}"
              title="Click to see detail"
            >
              <div class="vo-run-row-main vo-run-row-main--extended">
                <div class="vo-run-col-id vo-monospace">${run.id.slice(0, 10)}…</div>
                <div class="vo-run-col-status">
                  <span class="vo-run-status ${this.getRunStatusClass(run.status)}">${run.status}</span>
                </div>
                <div class="vo-run-col-stage">${run.stage}</div>
                <div class="vo-run-col-progress">
                  <div class="vo-progress-bar-wrap">
                    <div class="vo-progress-bar-fill" style="width: ${run.progress}%"></div>
                  </div>
                  <span class="vo-progress-label">${run.progress}%</span>
                </div>
                <div class="vo-run-col-date">${run.startedAt}</div>
                <div class="vo-run-col-date">${run.completedAt ?? '–'}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderRunDetail(runs: PipelineRun[]): string {
    if (!this.selectedRunId) {
      return `
        <div class="vo-pipelines-card vo-pipelines-detail-placeholder">
          <p class="vo-placeholder">Click a run row to see detail</p>
        </div>
      `;
    }

    const run = runs.find((r) => r.id === this.selectedRunId);
    if (!run) {
      return `
        <div class="vo-pipelines-card">
          <p class="vo-placeholder">Run not found</p>
        </div>
      `;
    }

    return `
      <div class="vo-pipelines-card vo-pipelines-detail-panel">
        <div class="vo-detail-panel-header">
          <h3 class="vo-overview-title">Run Detail</h3>
          <button class="vo-detail-close-btn" data-action="close-detail">✕</button>
        </div>
        <div class="vo-detail-panel-body">
          <div class="vo-run-detail-row">
            <span class="vo-detail-key">ID</span>
            <span class="vo-detail-value vo-detail-monospace">${run.id}</span>
          </div>
          <div class="vo-run-detail-row">
            <span class="vo-detail-key">Status</span>
            <span class="vo-detail-value">
              <span class="vo-run-status ${this.getRunStatusClass(run.status)}">${run.status}</span>
            </span>
          </div>
          <div class="vo-run-detail-row">
            <span class="vo-detail-key">Stage</span>
            <span class="vo-detail-value">${run.stage}</span>
          </div>
          <div class="vo-run-detail-row">
            <span class="vo-detail-key">Progress</span>
            <span class="vo-detail-value">${run.progress}%</span>
          </div>
          <div class="vo-run-detail-row">
            <span class="vo-detail-key">Started</span>
            <span class="vo-detail-value">${run.startedAt}</span>
          </div>
          <div class="vo-run-detail-row">
            <span class="vo-detail-key">Completed</span>
            <span class="vo-detail-value">${run.completedAt ?? '–'}</span>
          </div>
          <div class="vo-run-detail-row">
            <span class="vo-detail-key">Content</span>
            <span class="vo-detail-value">${run.contentTitle}</span>
          </div>
          ${run.errorMessage ? `
            <div class="vo-run-detail-row vo-detail-error">
              <span class="vo-detail-key">Error</span>
              <span class="vo-detail-value vo-detail-monospace">${run.errorMessage}</span>
            </div>
          ` : ''}
          ${run.logs && run.logs.length > 0 ? `
            <div class="vo-detail-section-label">Logs</div>
            <div class="vo-detail-logs">
              ${run.logs.map((log) => `<div class="vo-detail-log-line">${log}</div>`).join('')}
            </div>
          ` : ''}
          ${run.artifacts && run.artifacts.length > 0 ? `
            <div class="vo-detail-section-label">Artifacts</div>
            <div class="vo-detail-artifacts">
              ${run.artifacts.map((a) => `<div class="vo-detail-artifact">${a}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private buildRuns(): PipelineRun[] {
    const state = this.ctx.getState();
    const now = new Date();

    // Prefer live jobs from API
    if (this.liveJobs.length > 0) {
      return this.liveJobs.map((job) => {
        const jobStatus = this.mapJobStatus(job.jobStatus);
        const progress = this.estimateProgress(job.pipelineState, jobStatus);
        return {
          id: job.jobId,
          contentItemId: job.jobId,
          contentTitle: job.title ?? `Job ${job.jobId}`,
          date: this.formatDate(job.createdAt),
          status: jobStatus,
          progress,
          startedAt: this.formatDate(job.createdAt),
          completedAt: job.completedAt ? this.formatDate(job.completedAt) : null,
          stage: job.pipelineState || job.jobType,
          errorMessage: job.errorMessage ?? undefined,
          logs: job.errorMessage ? [`[${job.jobStatus}] ${job.errorMessage}`] : [],
          artifacts: job.adapterMode ? [`adapter: ${job.adapterMode}`] : [],
        };
      });
    }

    // Fallback: fixture runs from content items
    if (!state.projectId) return [];

    const fixtureRuns = [
      { status: 'completed' as const, progress: 100, stage: 'Publishing' },
      { status: 'completed' as const, progress: 100, stage: 'Publishing' },
      { status: 'completed' as const, progress: 100, stage: 'Publishing' },
      { status: 'failed' as const, progress: 62, stage: 'Captions', errorMessage: 'Timeout waiting for caption service' },
      { status: 'running' as const, progress: 37, stage: 'Script' },
      { status: 'queued' as const, progress: 0, stage: 'Intake' },
    ];

    const projectItems = this.contentItems.filter((i) => i.projectId === state.projectId);

    return projectItems.slice(0, 6).map((item, idx) => {
      const runDate = new Date(now.getTime() - idx * 24 * 60 * 60 * 1000);
      const fixture = fixtureRuns[idx] ?? fixtureRuns[0];
      return {
        id: `run-${item.id}-${idx}`,
        contentItemId: item.id,
        contentTitle: item.title,
        date: this.formatDate(runDate.toISOString()),
        status: fixture.status,
        progress: fixture.progress,
        startedAt: this.formatDate(runDate.toISOString()),
        completedAt: fixture.status === 'completed' || fixture.status === 'failed'
          ? this.formatDate(new Date(runDate.getTime() + 2 * 60 * 60 * 1000).toISOString())
          : null,
        stage: fixture.stage,
        errorMessage: (fixture as any).errorMessage,
        logs: (fixture as any).errorMessage
          ? [`[error] ${(fixture as any).errorMessage}`, '[info] Retrying with fallback...']
          : ['[info] Pipeline started', `[info] Stage: ${fixture.stage}`],
        artifacts: fixture.status === 'completed'
          ? ['video.mp4', 'captions.srt', 'thumbnail.jpg']
          : [],
      };
    });
  }

  private mapJobStatus(jobStatus: string): PipelineRun['status'] {
    switch (jobStatus?.toLowerCase()) {
      case 'completed':
      case 'done':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      case 'running':
      case 'in_progress':
        return 'running';
      case 'pending':
      case 'queued':
      default:
        return 'queued';
    }
  }

  private estimateProgress(pipelineState: string, status: PipelineRun['status']): number {
    if (status === 'completed') return 100;
    if (status === 'queued') return 0;
    if (status === 'failed') {
      // Estimate based on stage
      const stageIndex = PIPELINE_STAGES.findIndex((s) => s.toLowerCase() === pipelineState?.toLowerCase());
      return stageIndex >= 0 ? Math.round((stageIndex / PIPELINE_STAGES.length) * 100) : 50;
    }
    // Running — estimate mid-stage
    const stageIndex = PIPELINE_STAGES.findIndex((s) => s.toLowerCase() === pipelineState?.toLowerCase());
    return stageIndex >= 0 ? Math.round(((stageIndex + 0.5) / PIPELINE_STAGES.length) * 100) : 33;
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

  private getRunStatusClass(status: string): string {
    switch (status) {
      case 'completed':
        return 'vo-run-completed';
      case 'failed':
        return 'vo-run-failed';
      case 'running':
        return 'vo-run-in-progress';
      case 'queued':
        return 'vo-run-blocked';
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

  private attachEventListeners(profiles: BrainCoreVOStudioPipelineProfile[], runs: PipelineRun[]): void {
    // Profile selector buttons
    this.container.querySelectorAll('.vo-pipeline-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLButtonElement;
        const profileId = target.getAttribute('data-profile-id');
        this.container.querySelectorAll('.vo-pipeline-btn').forEach((b) => b.classList.remove('active'));
        target.classList.add('active');
        this.selectedProfileId = profileId;
        this.render();
      });
    });

    // Run row click → open detail drawer
    this.container.querySelectorAll('.vo-run-row').forEach((row) => {
      row.addEventListener('click', () => {
        const runId = row.getAttribute('data-run-id');
        if (this.selectedRunId === runId) {
          this.selectedRunId = null;
        } else {
          this.selectedRunId = runId;
        }
        this.render();
      });
    });

    // Close detail button
    const closeBtn = this.container.querySelector('[data-action="close-detail"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.selectedRunId = null;
        this.render();
      });
    }
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    this.container.innerHTML = '';
  }
}
