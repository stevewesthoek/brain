import type {
  BrainCoreVOStudioContentItem,
  BrainCoreVOStudioArtifactVariant,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';

type StudioTab = 'brief' | 'media' | 'captions' | 'preview';

const STUDIO_TABS: Array<{ id: StudioTab; label: string }> = [
  { id: 'brief', label: 'Brief' },
  { id: 'media', label: 'Media' },
  { id: 'captions', label: 'Captions' },
  { id: 'preview', label: 'Preview' },
];

export class StudioPanel {
  private container: HTMLElement;
  private contentItems: BrainCoreVOStudioContentItem[] = [];
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private selectedItemId: string | null = null;
  private activeTab: StudioTab = 'brief';
  private loading = false;

  constructor(container: HTMLElement, data: {
    contentItems?: BrainCoreVOStudioContentItem[];
  }) {
    this.container = container;
    this.contentItems = data.contentItems || [];

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
    this.fetchContentItems();
  }

  private async fetchContentItems(): Promise<void> {
    const state = this.ctx.getState();
    if (!state.projectId) return;

    this.loading = true;
    this.render();

    try {
      const res = await fetch(
        `http://localhost:4877/api/video-orchestrator/content-items?projectId=${encodeURIComponent(state.projectId)}`,
      );
      if (res.ok) {
        const data = await res.json() as { items?: BrainCoreVOStudioContentItem[] };
        if (data.items && data.items.length > 0) {
          this.contentItems = data.items;
          if (!this.selectedItemId) {
            this.selectedItemId = data.items[0].id;
          }
        }
      }
    } catch {
      // Continue with passed-in data
    } finally {
      this.loading = false;
      this.render();
    }
  }

  private render(): void {
    const state = this.ctx.getState();
    const projectItems = this.contentItems.filter((i) => i.projectId === state.projectId);
    const selectedItem = projectItems.find((i) => i.id === this.selectedItemId) ?? projectItems[0] ?? null;

    if (this.loading) {
      this.container.innerHTML = `
        <div class="vo-studio-panel">
          <div class="vo-empty-state"><p>Loading content items...</p></div>
        </div>
      `;
      return;
    }

    if (projectItems.length === 0) {
      this.container.innerHTML = `
        <div class="vo-studio-panel">
          <div class="vo-empty-state"><p>No content items found for this project</p></div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="vo-studio-panel">
        ${this.renderItemSelector(projectItems, selectedItem)}
        ${selectedItem ? this.renderStudioTabs(selectedItem) : ''}
        ${selectedItem ? this.renderTabContent(selectedItem) : ''}
      </div>
    `;

    this.attachEventListeners();
  }

  private renderItemSelector(items: BrainCoreVOStudioContentItem[], selected: BrainCoreVOStudioContentItem | null): string {
    return `
      <div class="vo-studio-item-selector">
        <label class="vo-filter-label">Content Item</label>
        <select class="vo-filter-select vo-studio-item-select">
          ${items.map((item) => `
            <option value="${item.id}" ${selected?.id === item.id ? 'selected' : ''}>${item.title}</option>
          `).join('')}
        </select>
        <span class="vo-studio-item-status ${this.getStatusClass(selected?.status ?? '')}">
          ${selected?.status ?? ''}
        </span>
      </div>
    `;
  }

  private renderStudioTabs(item: BrainCoreVOStudioContentItem): string {
    return `
      <div class="vo-studio-tab-row">
        ${STUDIO_TABS.map((tab) => `
          <button
            class="vo-studio-tab ${this.activeTab === tab.id ? 'vo-studio-tab--active' : ''}"
            data-tab="${tab.id}"
          >${tab.label}</button>
        `).join('')}
      </div>
    `;
  }

  private renderTabContent(item: BrainCoreVOStudioContentItem): string {
    switch (this.activeTab) {
      case 'brief':
        return this.renderBriefTab(item);
      case 'media':
        return this.renderMediaTab(item);
      case 'captions':
        return this.renderCaptionsTab(item);
      case 'preview':
        return this.renderPreviewTab(item);
      default:
        return '';
    }
  }

  private renderBriefTab(item: BrainCoreVOStudioContentItem): string {
    const brief = `Title: ${item.title}\n\nSource: ${item.canonicalSource}\n\nSlug: ${item.sourceSlug}\n\nPipeline Profile: ${item.pipelineProfileId}\n\nStatus: ${item.status}`;

    return `
      <div class="vo-studio-tab-content">
        <div class="vo-studio-card">
          <div class="vo-studio-card-header">Brief</div>
          <div class="vo-studio-card-body">
            <div class="vo-studio-readonly-label">Project Brief</div>
            <textarea class="vo-studio-textarea" readonly>${brief}</textarea>
          </div>
        </div>
        <div class="vo-studio-card">
          <div class="vo-studio-card-header">Metadata</div>
          <div class="vo-studio-card-body">
            <div class="vo-studio-meta-grid">
              <div class="vo-studio-meta-item">
                <span class="vo-studio-meta-key">ID</span>
                <span class="vo-studio-meta-value vo-monospace">${item.id}</span>
              </div>
              <div class="vo-studio-meta-item">
                <span class="vo-studio-meta-key">Package ID</span>
                <span class="vo-studio-meta-value vo-monospace">${item.packageId || '–'}</span>
              </div>
              <div class="vo-studio-meta-item">
                <span class="vo-studio-meta-key">Platform Targets</span>
                <span class="vo-studio-meta-value">${item.platformTargets.length} target(s)</span>
              </div>
              <div class="vo-studio-meta-item">
                <span class="vo-studio-meta-key">Artifacts</span>
                <span class="vo-studio-meta-value">${item.artifactVariants.length} variant(s)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderMediaTab(item: BrainCoreVOStudioContentItem): string {
    const videoVariants = item.artifactVariants.filter((v) => v.kind === 'video');

    return `
      <div class="vo-studio-tab-content">
        <div class="vo-studio-card">
          <div class="vo-studio-card-header">Media Files</div>
          <div class="vo-studio-card-body">
            ${videoVariants.length === 0 ? `
              <div class="vo-studio-media-empty">
                <div class="vo-studio-media-placeholder">
                  <span class="vo-studio-media-icon">▶</span>
                  <span class="vo-studio-media-label">No media files generated yet</span>
                </div>
              </div>
            ` : videoVariants.map((v) => `
              <div class="vo-studio-media-item">
                <div class="vo-studio-media-preview">
                  <div class="vo-studio-media-thumb">
                    <span class="vo-studio-media-icon">▶</span>
                  </div>
                </div>
                <div class="vo-studio-media-info">
                  <div class="vo-studio-media-title">${v.formatId}</div>
                  <div class="vo-studio-media-meta">${v.platform} · <span class="vo-studio-badge vo-studio-badge--${v.status}">${v.status}</span></div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="vo-studio-card">
          <div class="vo-studio-card-header">Source Info</div>
          <div class="vo-studio-card-body">
            <div class="vo-studio-meta-grid">
              <div class="vo-studio-meta-item">
                <span class="vo-studio-meta-key">Canonical Source</span>
                <span class="vo-studio-meta-value vo-monospace">${item.canonicalSource}</span>
              </div>
              <div class="vo-studio-meta-item">
                <span class="vo-studio-meta-key">Source Slug</span>
                <span class="vo-studio-meta-value vo-monospace">${item.sourceSlug}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderCaptionsTab(item: BrainCoreVOStudioContentItem): string {
    const captionVariants = item.artifactVariants.filter((v) => v.kind === 'captions');

    const srtPreview = captionVariants.length > 0
      ? `1\n00:00:00,000 --> 00:00:03,000\n[Captions artifact found: ${captionVariants[0].formatId}]\n\n2\n00:00:03,000 --> 00:00:06,000\nStatus: ${captionVariants[0].status}\n\n[Full SRT content would load here]`
      : `[No captions artifact found for this content item]\n\nAvailable artifact kinds: ${[...new Set(item.artifactVariants.map((v) => v.kind))].join(', ') || 'none'}`;

    return `
      <div class="vo-studio-tab-content">
        <div class="vo-studio-card">
          <div class="vo-studio-card-header">
            Captions (SRT)
            ${captionVariants.length > 0 ? `<span class="vo-studio-badge vo-studio-badge--${captionVariants[0].status}">${captionVariants[0].status}</span>` : ''}
          </div>
          <div class="vo-studio-card-body">
            <div class="vo-studio-readonly-label">SRT Preview (read-only)</div>
            <textarea class="vo-studio-textarea vo-studio-textarea--tall vo-monospace-textarea" readonly>${srtPreview}</textarea>
            ${captionVariants.length > 1 ? `
              <div class="vo-studio-caption-variants">
                ${captionVariants.map((v) => `
                  <span class="vo-studio-badge vo-studio-badge--${v.status}">${v.platform}: ${v.formatId}</span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  private renderPreviewTab(item: BrainCoreVOStudioContentItem): string {
    const videoArtifact = item.artifactVariants.find((v) => v.kind === 'video');
    const captionArtifact = item.artifactVariants.find((v) => v.kind === 'captions');
    const thumbArtifact = item.artifactVariants.find((v) => v.kind === 'thumbnail');

    return `
      <div class="vo-studio-tab-content">
        <div class="vo-studio-card">
          <div class="vo-studio-card-header">Preview</div>
          <div class="vo-studio-card-body">
            <div class="vo-studio-preview-player">
              <div class="vo-studio-preview-viewport">
                <div class="vo-studio-preview-placeholder">
                  <span class="vo-studio-preview-icon">▶</span>
                  <span class="vo-studio-preview-label">${videoArtifact ? `Video: ${videoArtifact.formatId}` : 'No video artifact ready'}</span>
                </div>
                ${captionArtifact ? `
                  <div class="vo-studio-preview-captions">
                    <span class="vo-studio-caption-overlay">[Captions: ${captionArtifact.formatId}]</span>
                  </div>
                ` : ''}
              </div>
              <div class="vo-studio-preview-controls">
                <div class="vo-studio-preview-progress">
                  <div class="vo-studio-preview-bar"></div>
                </div>
                <div class="vo-studio-preview-meta">
                  <span class="vo-muted">${item.title}</span>
                  <span class="vo-studio-badge vo-studio-badge--${item.status}">${item.status}</span>
                </div>
              </div>
            </div>
            <div class="vo-studio-preview-artifacts">
              <div class="vo-studio-artifact-row">
                <span class="vo-studio-artifact-label">Video</span>
                <span class="vo-studio-badge ${videoArtifact ? `vo-studio-badge--${videoArtifact.status}` : 'vo-studio-badge--missing'}">${videoArtifact ? videoArtifact.status : 'not generated'}</span>
              </div>
              <div class="vo-studio-artifact-row">
                <span class="vo-studio-artifact-label">Captions</span>
                <span class="vo-studio-badge ${captionArtifact ? `vo-studio-badge--${captionArtifact.status}` : 'vo-studio-badge--missing'}">${captionArtifact ? captionArtifact.status : 'not generated'}</span>
              </div>
              <div class="vo-studio-artifact-row">
                <span class="vo-studio-artifact-label">Thumbnail</span>
                <span class="vo-studio-badge ${thumbArtifact ? `vo-studio-badge--${thumbArtifact.status}` : 'vo-studio-badge--missing'}">${thumbArtifact ? thumbArtifact.status : 'not generated'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderSharedBoundaryNotice(): string {
    return `
      <div class="vo-studio-tab-content">
        <div class="vo-studio-card">
          <div class="vo-studio-card-header">Shared Boundary</div>
          <div class="vo-studio-card-body">
            <p class="vo-muted">
              Brain Console shows shared orchestration state, shared artifacts, approvals, and health.
              Project-specific scripting, thumbnail design, and SEO strategy live in the project repo that calls Brain Core API.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  private getStatusClass(status: string): string {
    switch (status) {
      case 'draft':
        return 'vo-studio-status--draft';
      case 'package-preview':
        return 'vo-studio-status--preview';
      case 'blocked':
        return 'vo-studio-status--blocked';
      default:
        return '';
    }
  }

  private attachEventListeners(): void {
    // Item selector
    const itemSelect = this.container.querySelector('.vo-studio-item-select') as HTMLSelectElement;
    if (itemSelect) {
      itemSelect.addEventListener('change', (e) => {
        this.selectedItemId = (e.target as HTMLSelectElement).value;
        this.render();
      });
    }

    // Tab buttons
    this.container.querySelectorAll('.vo-studio-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const tab = (e.currentTarget as HTMLButtonElement).getAttribute('data-tab') as StudioTab;
        if (tab) {
          this.activeTab = tab;
          this.render();
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
