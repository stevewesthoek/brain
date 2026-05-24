const BASE_URL = 'http://localhost:4877';

interface VOApprovalEntry {
  id: string;
  projectId: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt?: string;
  decisionReason?: string;
  requestPayload?: Record<string, unknown>;
}

interface ThumbnailVariant {
  id: string;
  label: string;
  templateId: string;
  previewUrl?: string;
  headlineText: string;
  active?: boolean;
}

interface TemplateCard {
  id: string;
  label: string;
  description: string;
}

const DEFAULT_TEMPLATES: TemplateCard[] = [
  {
    id: 'bold-text',
    label: 'Bold Text',
    description: 'High-contrast headline treatment for primary YouTube thumbnails.',
  },
  {
    id: 'minimal-curiosity',
    label: 'Minimal Curiosity',
    description: 'Cleaner curiosity framing with lighter copy density.',
  },
];

export class ThumbnailStudioPanel {
  private container: HTMLElement;
  private projectId: string;
  private approvals: VOApprovalEntry[] = [];
  private selectedApprovalId: string | null = null;
  private selectedVariantId: string | null = null;
  private headlineDraft = '';
  private isLoading = false;
  private isSubmitting = false;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    await this.loadApprovals();
  }

  private async loadApprovals(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;
    this.render();

    try {
      const qs = this.projectId ? `?projectId=${encodeURIComponent(this.projectId)}` : '';
      const res = await fetch(`${BASE_URL}/api/video-orchestrator/approvals${qs}`);
      const data = (await res.json()) as { approvals?: VOApprovalEntry[] };
      this.approvals = Array.isArray(data.approvals) ? data.approvals.filter((a) => a.type === 'thumbnail') : [];

      const pending = this.getPendingApprovals();
      if (pending.length === 0) {
        this.selectedApprovalId = null;
        this.selectedVariantId = null;
        this.headlineDraft = '';
      } else if (!this.selectedApprovalId || !pending.some((a) => a.id === this.selectedApprovalId)) {
        this.selectApproval(pending[0].id);
      } else {
        this.syncVariantSelection();
      }
    } catch {
      this.approvals = [];
    } finally {
      this.isLoading = false;
      this.render();
    }
  }

  private getPendingApprovals(): VOApprovalEntry[] {
    return this.approvals.filter((a) => a.status === 'pending');
  }

  private getSelectedApproval(): VOApprovalEntry | null {
    return this.getPendingApprovals().find((a) => a.id === this.selectedApprovalId) ?? null;
  }

  private extractVariants(approval: VOApprovalEntry | null): ThumbnailVariant[] {
    if (!approval) return [];
    const payload = approval.requestPayload ?? {};
    const rawVariants = Array.isArray(payload.variants) ? payload.variants as Array<Record<string, unknown>> : [];
    if (rawVariants.length > 0) {
      return rawVariants.map((variant, index) => ({
        id: String(variant.id ?? `variant-${index + 1}`),
        label: String(variant.label ?? variant.name ?? `Variant ${index + 1}`),
        templateId: String(variant.templateId ?? variant.template ?? DEFAULT_TEMPLATES[index % DEFAULT_TEMPLATES.length]?.id ?? 'custom'),
        previewUrl: typeof variant.previewUrl === 'string' ? variant.previewUrl : undefined,
        headlineText: String(variant.headlineText ?? variant.headline ?? variant.label ?? `Variant ${index + 1}`),
        active: Boolean(variant.active),
      }));
    }

    return [
      {
        id: 'variant-a',
        label: 'Variant A',
        templateId: 'bold-text',
        headlineText: 'Default A headline',
        active: true,
      },
      {
        id: 'variant-b',
        label: 'Variant B',
        templateId: 'minimal-curiosity',
        headlineText: 'Default B headline',
      },
    ];
  }

  private syncVariantSelection(): void {
    const approval = this.getSelectedApproval();
    const variants = this.extractVariants(approval);
    if (variants.length === 0) {
      this.selectedVariantId = null;
      this.headlineDraft = '';
      return;
    }

    const selected = variants.find((variant) => variant.id === this.selectedVariantId);
    if (selected) {
      if (!this.headlineDraft) {
        this.headlineDraft = selected.headlineText;
      }
      return;
    }

    const fallback = variants.find((variant) => variant.active) ?? variants[0];
    this.selectedVariantId = fallback.id;
    this.headlineDraft = fallback.headlineText;
  }

  private selectApproval(approvalId: string): void {
    this.selectedApprovalId = approvalId;
    this.selectedVariantId = null;
    this.headlineDraft = '';
    this.syncVariantSelection();
    this.render();
  }

  private selectVariant(variantId: string): void {
    this.selectedVariantId = variantId;
    const selected = this.extractVariants(this.getSelectedApproval()).find((variant) => variant.id === variantId);
    if (selected) {
      this.headlineDraft = selected.headlineText;
    }
    this.render();
  }

  private render(): void {
    const pending = this.getPendingApprovals();
    const selectedApproval = this.getSelectedApproval();
    const variants = this.extractVariants(selectedApproval);
    const selectedVariant = variants.find((variant) => variant.id === this.selectedVariantId) ?? null;
    const activeTemplateId = selectedVariant?.templateId ?? DEFAULT_TEMPLATES[0].id;

    if (this.isLoading && this.approvals.length === 0) {
      this.container.innerHTML = '<div class="vo-empty-state"><p>Loading thumbnail approvals...</p></div>';
      return;
    }

    if (pending.length === 0) {
      this.container.innerHTML = `
        <div class="vo-thumbnail-studio">
          <div class="vo-panel-header">
            <h3>Thumbnail Studio</h3>
          </div>
          <div class="vo-empty-state">
            <p>No pending thumbnail approvals for this project.</p>
          </div>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <div class="vo-thumbnail-studio">
        <div class="vo-panel-header">
          <h3>Thumbnail Studio</h3>
          <button class="brain-console__link-button" id="vo-thumb-refresh"${this.isSubmitting ? ' disabled' : ''}>Refresh</button>
        </div>
        <div class="vo-thumbnail-studio__layout">
          <section class="vo-thumbnail-studio__column vo-thumbnail-studio__column--queue">
            <div class="vo-thumbnail-studio__card">
              <div class="vo-thumbnail-studio__card-header">Approval Queue</div>
              <div class="vo-thumbnail-studio__queue">
                ${pending.map((approval) => `
                  <button
                    class="vo-thumbnail-studio__queue-item${approval.id === this.selectedApprovalId ? ' is-selected' : ''}"
                    data-approval-id="${approval.id}"
                    type="button"
                  >
                    <span class="vo-thumbnail-studio__queue-title">${this.escapeHtml(approval.id)}</span>
                    <span class="vo-thumbnail-studio__queue-meta">${this.escapeHtml(this.formatRelativeTime(approval.createdAt))}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="vo-thumbnail-studio__card">
              <div class="vo-thumbnail-studio__card-header">Template Library</div>
              <div class="vo-thumbnail-studio__templates">
                ${DEFAULT_TEMPLATES.map((template) => `
                  <div class="vo-thumbnail-studio__template${template.id === activeTemplateId ? ' is-active' : ''}">
                    <div class="vo-thumbnail-studio__template-name">${this.escapeHtml(template.label)}</div>
                    <div class="vo-thumbnail-studio__template-desc">${this.escapeHtml(template.description)}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>
          <section class="vo-thumbnail-studio__column vo-thumbnail-studio__column--preview">
            <div class="vo-thumbnail-studio__card">
              <div class="vo-thumbnail-studio__card-header">Preview Surface</div>
              <div class="vo-thumbnail-studio__preview-surface">
                <div class="vo-thumbnail-studio__preview-frame">
                  ${selectedVariant?.previewUrl
                    ? `<img src="${this.escapeAttr(selectedVariant.previewUrl)}" alt="${this.escapeAttr(selectedVariant.label)} preview" />`
                    : `<div class="vo-thumbnail-studio__preview-placeholder">${this.escapeHtml(selectedVariant?.label ?? 'Variant')}</div>`}
                  <div class="vo-thumbnail-studio__preview-headline">${this.escapeHtml(this.headlineDraft || selectedVariant?.headlineText || '')}</div>
                </div>
                <div class="vo-thumbnail-studio__preview-meta">
                  <div><strong>Variant:</strong> ${this.escapeHtml(selectedVariant?.label ?? 'None')}</div>
                  <div><strong>Template:</strong> ${this.escapeHtml(activeTemplateId)}</div>
                </div>
              </div>
            </div>
          </section>
          <section class="vo-thumbnail-studio__column vo-thumbnail-studio__column--controls">
            <div class="vo-thumbnail-studio__card">
              <div class="vo-thumbnail-studio__card-header">Variant Selector</div>
              <div class="vo-thumbnail-studio__variants">
                ${variants.map((variant) => `
                  <button
                    class="vo-thumbnail-studio__variant${variant.id === this.selectedVariantId ? ' is-selected' : ''}"
                    type="button"
                    data-variant-id="${variant.id}"
                  >
                    <span class="vo-thumbnail-studio__variant-label">${this.escapeHtml(variant.label)}</span>
                    <span class="vo-thumbnail-studio__variant-meta">${this.escapeHtml(variant.templateId)}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            <div class="vo-thumbnail-studio__card">
              <div class="vo-thumbnail-studio__card-header">Headline Edit</div>
              <div class="vo-thumbnail-studio__form">
                <label class="vo-form-group">
                  <span class="vo-form-label">Manual Headline</span>
                  <input id="vo-thumb-headline" class="vo-form-input" type="text" value="${this.escapeAttr(this.headlineDraft)}" ${this.isSubmitting ? 'disabled' : ''} />
                </label>
                <div class="vo-form-actions">
                  <button class="vo-button vo-button-primary" id="vo-thumb-approve" ${!selectedApproval || !selectedVariant || this.isSubmitting ? 'disabled' : ''}>${this.isSubmitting ? 'Saving...' : 'Approve Variant'}</button>
                  <button class="vo-button" id="vo-thumb-reject" ${!selectedApproval || this.isSubmitting ? 'disabled' : ''}>Reject</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;

    this.attachListeners();
  }

  private attachListeners(): void {
    this.container.querySelector('#vo-thumb-refresh')?.addEventListener('click', () => {
      void this.loadApprovals();
    });

    this.container.querySelectorAll<HTMLElement>('[data-approval-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const approvalId = button.getAttribute('data-approval-id');
        if (approvalId) {
          this.selectApproval(approvalId);
        }
      });
    });

    this.container.querySelectorAll<HTMLElement>('[data-variant-id]').forEach((button) => {
      button.addEventListener('click', () => {
        const variantId = button.getAttribute('data-variant-id');
        if (variantId) {
          this.selectVariant(variantId);
        }
      });
    });

    this.container.querySelector('#vo-thumb-headline')?.addEventListener('input', (event) => {
      this.headlineDraft = (event.target as HTMLInputElement).value;
      const preview = this.container.querySelector('.vo-thumbnail-studio__preview-headline');
      if (preview) {
        preview.textContent = this.headlineDraft;
      }
    });

    this.container.querySelector('#vo-thumb-approve')?.addEventListener('click', () => {
      void this.submitDecision(true);
    });

    this.container.querySelector('#vo-thumb-reject')?.addEventListener('click', () => {
      void this.submitDecision(false);
    });
  }

  private async submitDecision(approved: boolean): Promise<void> {
    const approval = this.getSelectedApproval();
    if (!approval) return;

    this.isSubmitting = true;
    this.render();

    try {
      await fetch(`${BASE_URL}/api/video-orchestrator/approvals/${approval.id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          approved,
          note: JSON.stringify({
            selectedVariantId: this.selectedVariantId,
            manualHeadline: this.headlineDraft.trim() || undefined,
          }),
        }),
      });
      await this.loadApprovals();
    } finally {
      this.isSubmitting = false;
      this.render();
    }
  }

  private formatRelativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(ms / 60000);
    if (minutes < 2) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  private escapeAttr(value: string): string {
    return this.escapeHtml(value).replaceAll("'", '&#39;');
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
