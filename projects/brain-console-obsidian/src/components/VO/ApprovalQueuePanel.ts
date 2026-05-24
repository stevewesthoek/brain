import { getVOContextManager } from './VOContext.js';

const BASE_URL = 'http://localhost:4877';

export interface ApprovalQueueItem {
  id: string;
  type: 'thumbnail' | 'metadata' | 'final_review';
  contentItemId: string;
  packageId: string;
  requestedAt: string;
  variants: Array<{
    id: string;
    label: string;
  }>;
}

export class ApprovalQueuePanel {
  private container: HTMLElement;
  private projectId: string;
  private items: ApprovalQueueItem[] = [];
  private selectedApprovalId: string | null = null;
  private isLoading = false;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.render();
    await this.loadApprovals();
  }

  private render(): void {
    const html = `
      <div class="vo-approval-queue">
        <div class="vo-panel-header">
          <h3>Approval Queue</h3>
          <button class="vo-btn-secondary" id="approval-refresh">Refresh</button>
        </div>
        
        <div class="vo-queue-stats">
          <div class="vo-stat-item">
            <span class="vo-stat-label">Pending</span>
            <span class="vo-stat-value" id="approval-count">0</span>
          </div>
        </div>

        <div class="vo-queue-list" id="approval-list">
          <div class="vo-empty-state">Loading approvals...</div>
        </div>

        <div class="vo-queue-detail" id="approval-detail" style="display: none;">
          <div class="vo-detail-header">
            <button class="vo-btn-icon" id="approval-back">← Back</button>
            <h4 id="approval-detail-title">Approval Detail</h4>
          </div>
          <div id="approval-detail-content"></div>
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const refreshBtn = this.container.querySelector('#approval-refresh');
    refreshBtn?.addEventListener('click', () => this.loadApprovals());

    const backBtn = this.container.querySelector('#approval-back');
    backBtn?.addEventListener('click', () => this.showList());
  }

  private async loadApprovals(): Promise<void> {
    this.isLoading = true;
    try {
      const response = await fetch(
        `${BASE_URL}/api/video-orchestrator/approvals/queue?projectId=${encodeURIComponent(this.projectId)}`,
      );
      const data = await response.json();

      if (data.ok) {
        this.items = data.items || [];
        this.renderList();
      } else {
        this.showError(data.error || 'Failed to load approvals');
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Network error');
    } finally {
      this.isLoading = false;
    }
  }

  private renderList(): void {
    const listContainer = this.container.querySelector('#approval-list');
    if (!listContainer) return;

    const countEl = this.container.querySelector('#approval-count');
    if (countEl) countEl.textContent = String(this.items.length);

    if (this.items.length === 0) {
      listContainer.innerHTML = '<div class="vo-empty-state">No pending approvals</div>';
      return;
    }

    const itemsHtml = this.items
      .map(
        (item) => `
      <div class="vo-queue-item" data-id="${item.id}">
        <div class="vo-queue-item-header">
          <span class="vo-approval-type vo-type-${item.type}">${item.type}</span>
          <span class="vo-queue-time">${new Date(item.requestedAt).toLocaleTimeString()}</span>
        </div>
        <div class="vo-queue-item-content">
          <p class="vo-content-id">Content: ${item.contentItemId}</p>
          <p class="vo-variants-count">${item.variants.length} variant(s)</p>
        </div>
      </div>
    `,
      )
      .join('');

    listContainer.innerHTML = itemsHtml;

    this.container.querySelectorAll('.vo-queue-item').forEach((el) => {
      el.addEventListener('click', () => {
        const approvalId = el.getAttribute('data-id');
        if (approvalId) {
          this.showDetail(approvalId);
        }
      });
    });
  }

  private showDetail(approvalId: string): void {
    const item = this.items.find((i) => i.id === approvalId);
    if (!item) return;

    this.selectedApprovalId = approvalId;

    const detailEl = this.container.querySelector('#approval-detail');
    const listEl = this.container.querySelector('.vo-queue-list');

    if (detailEl) {
      (detailEl as HTMLElement).style.display = 'block';
    }
    if (listEl) {
      (listEl as HTMLElement).style.display = 'none';
    }

    const titleEl = this.container.querySelector('#approval-detail-title');
    if (titleEl) {
      titleEl.textContent = `${item.type.toUpperCase()} Approval`;
    }

    const contentEl = this.container.querySelector('#approval-detail-content');
    if (contentEl) {
      const variantsHtml = item.variants
        .map(
          (v) => `
        <div class="vo-variant-option">
          <input type="radio" name="variant" value="${v.id}" id="var-${v.id}">
          <label for="var-${v.id}">${v.label}</label>
        </div>
      `,
        )
        .join('');

      contentEl.innerHTML = `
        <div class="vo-approval-form">
          <div class="vo-form-section">
            <label>Package ID</label>
            <p class="vo-form-value">${item.packageId}</p>
          </div>
          
          <div class="vo-form-section">
            <label>Select Variant</label>
            <div class="vo-variants-list">
              ${variantsHtml}
            </div>
          </div>

          <div class="vo-form-actions">
            <button class="vo-btn-primary" id="approval-submit">Approve Selected</button>
            <button class="vo-btn-secondary" id="approval-reject">Reject</button>
          </div>
        </div>
      `;

      const submitBtn = contentEl.querySelector('#approval-submit');
      submitBtn?.addEventListener('click', () => this.handleApproval(item, true));

      const rejectBtn = contentEl.querySelector('#approval-reject');
      rejectBtn?.addEventListener('click', () => this.handleApproval(item, false));
    }
  }

  private showList(): void {
    this.selectedApprovalId = null;

    const detailEl = this.container.querySelector('#approval-detail');
    const listEl = this.container.querySelector('.vo-queue-list');

    if (detailEl) {
      (detailEl as HTMLElement).style.display = 'none';
    }
    if (listEl) {
      (listEl as HTMLElement).style.display = 'block';
    }
  }

  private async handleApproval(item: ApprovalQueueItem, approved: boolean): Promise<void> {
    if (!this.selectedApprovalId) return;

    try {
      // Phase 1W: route to the VO approval store decision endpoint.
      // This updates the persisted record in ~/.local/video-orchestrator/state/approvals.json.
      const decision = approved ? 'approve' : 'reject';
      const endpoint = `${BASE_URL}/api/video-orchestrator/approvals/${encodeURIComponent(this.selectedApprovalId)}/${decision}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: approved ? undefined : 'Rejected by operator' }),
      });

      const data = await response.json() as { ok: boolean; error?: string };

      if (data.ok) {
        this.showSuccess(
          approved ? `${item.type} approved successfully` : `${item.type} rejected`,
        );
        await this.loadApprovals();
        this.showList();
      } else {
        this.showError(data.error ?? 'Failed to process approval');
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Network error');
    }
  }

  private showSuccess(message: string): void {
    const msgEl = document.createElement('div');
    msgEl.className = 'vo-message vo-message-success';
    msgEl.textContent = `✓ ${message}`;
    this.container.appendChild(msgEl);
    setTimeout(() => msgEl.remove(), 5000);
  }

  private showError(message: string): void {
    const msgEl = document.createElement('div');
    msgEl.className = 'vo-message vo-message-error';
    msgEl.textContent = `⚠ ${message}`;
    this.container.appendChild(msgEl);
    setTimeout(() => msgEl.remove(), 5000);
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
