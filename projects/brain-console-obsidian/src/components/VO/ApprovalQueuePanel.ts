/**
 * ApprovalQueuePanel — Phase 2W upgrade
 *
 * Bulk approval UI for VO Studio approvals.
 *
 * Features:
 *  - Fetches from GET /api/video-orchestrator/approvals
 *  - Per-item checkboxes + "Select All" for bulk operations
 *  - "Approve Selected" / "Reject Selected" bulk action buttons
 *  - Per-item approve/reject fallback buttons
 *  - Expiry countdown indicators
 *  - Decided approvals shown in a collapsed summary below
 */

const BASE_URL = 'http://localhost:4877';

// Legacy export kept for backward compatibility with VOShell
export interface ApprovalQueueItem {
  id: string;
  type: string;
  contentItemId?: string;
  packageId?: string;
  requestedAt?: string;
  variants?: Array<{ id: string; label: string }>;
}

// Internal shape from the new /api/video-orchestrator/approvals endpoint
interface VOApprovalEntry {
  id: string;
  projectId: string;
  type: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt?: string;
  decisionReason?: string;
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatExpiryLabel(expiresAt: string): string {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining < 0) return 'expired';
  const minutes = Math.floor(remaining / 60000);
  if (minutes < 5) return `expires in ${minutes}m ⚠`;
  if (minutes < 60) return `expires in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `expires in ${hours}h`;
  return `expires in ${Math.floor(hours / 24)}d`;
}

export class ApprovalQueuePanel {
  private container: HTMLElement;
  private projectId: string;
  private approvals: VOApprovalEntry[] = [];
  private selectedIds = new Set<string>();
  private isLoading = false;

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.renderShell();
    await this.loadApprovals();
  }

  private renderShell(): void {
    this.container.innerHTML = `
      <div class="vo-approval-queue bc-aq">
        <div class="bc-aq__header">
          <span class="bc-aq__title">VO Approval Queue</span>
          <div class="bc-aq__header-actions">
            <button class="brain-console__link-button" id="bc-aq-refresh">Refresh</button>
          </div>
        </div>
        <div class="bc-aq__body" id="bc-aq-body">
          <p class="brain-console__detail">Loading approvals...</p>
        </div>
      </div>
    `;
    const refreshBtn = this.container.querySelector('#bc-aq-refresh');
    refreshBtn?.addEventListener('click', () => this.loadApprovals());
  }

  private async loadApprovals(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    const body = this.container.querySelector('#bc-aq-body');
    if (body) body.innerHTML = '<p class="brain-console__detail">Loading...</p>';

    try {
      const qs = this.projectId ? `?projectId=${encodeURIComponent(this.projectId)}` : '';
      const res = await fetch(`${BASE_URL}/api/video-orchestrator/approvals${qs}`);
      const data = (await res.json()) as { ok?: boolean; approvals?: VOApprovalEntry[] };
      this.approvals = Array.isArray(data.approvals) ? data.approvals : [];
      this.selectedIds = new Set();
      this.renderBody();
    } catch {
      if (body) body.innerHTML = '<p class="brain-console__detail">Failed to load approvals.</p>';
    } finally {
      this.isLoading = false;
    }
  }

  private renderBody(): void {
    const body = this.container.querySelector('#bc-aq-body') as HTMLElement | null;
    if (!body) return;

    body.innerHTML = '';
    this.selectedIds = new Set();

    const pending = this.approvals.filter((a) => a.status === 'pending');
    const decided = this.approvals.filter((a) => a.status !== 'pending');

    if (pending.length === 0 && decided.length === 0) {
      body.innerHTML = '<p class="brain-console__detail">No approval records found.</p>';
      return;
    }

    if (pending.length > 0) {
      // Toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'bc-aq__toolbar';

      const selectAllLabel = document.createElement('label');
      selectAllLabel.className = 'bc-aq__select-all-label';
      const selectAllCb = document.createElement('input');
      selectAllCb.type = 'checkbox';
      selectAllCb.title = 'Select all pending';
      selectAllLabel.appendChild(selectAllCb);
      selectAllLabel.append(' Select all');

      const bulkApproveBtn = document.createElement('button');
      bulkApproveBtn.className = 'brain-console__local-app-action is-enabled bc-aq__btn-approve';
      bulkApproveBtn.textContent = 'Approve Selected';
      bulkApproveBtn.disabled = true;

      const bulkRejectBtn = document.createElement('button');
      bulkRejectBtn.className = 'brain-console__local-app-action bc-aq__btn-reject';
      bulkRejectBtn.textContent = 'Reject Selected';
      bulkRejectBtn.disabled = true;

      toolbar.appendChild(selectAllLabel);
      toolbar.appendChild(bulkApproveBtn);
      toolbar.appendChild(bulkRejectBtn);
      body.appendChild(toolbar);

      const updateToolbar = () => {
        const has = this.selectedIds.size > 0;
        bulkApproveBtn.disabled = !has;
        bulkRejectBtn.disabled = !has;
        selectAllCb.indeterminate = this.selectedIds.size > 0 && this.selectedIds.size < pending.length;
        selectAllCb.checked = this.selectedIds.size === pending.length && pending.length > 0;
      };

      selectAllCb.addEventListener('change', () => {
        if (selectAllCb.checked) {
          for (const a of pending) this.selectedIds.add(a.id);
        } else {
          this.selectedIds.clear();
        }
        body.querySelectorAll<HTMLInputElement>('.bc-aq__item-cb').forEach((cb) => {
          cb.checked = selectAllCb.checked;
        });
        updateToolbar();
      });

      const handleBulk = (approved: boolean) => {
        if (this.selectedIds.size === 0) return;
        const ids = Array.from(this.selectedIds);
        bulkApproveBtn.disabled = true;
        bulkRejectBtn.disabled = true;
        bulkApproveBtn.textContent = approved ? 'Approving...' : 'Approve Selected';
        bulkRejectBtn.textContent = approved ? 'Reject Selected' : 'Rejecting...';

        void this.bulkDecide(ids, approved).then((ok) => {
          if (ok) void this.loadApprovals();
          else {
            bulkApproveBtn.textContent = 'Approve Selected';
            bulkRejectBtn.textContent = 'Reject Selected';
            updateToolbar();
          }
        });
      };

      bulkApproveBtn.addEventListener('click', () => handleBulk(true));
      bulkRejectBtn.addEventListener('click', () => handleBulk(false));

      // Pending list
      const section = document.createElement('div');
      section.className = 'bc-aq__section';
      const sectionLabel = document.createElement('p');
      sectionLabel.className = 'bc-aq__section-label';
      sectionLabel.textContent = `Pending (${pending.length})`;
      section.appendChild(sectionLabel);

      const list = document.createElement('div');
      list.className = 'bc-aq__list';

      for (const approval of pending) {
        const item = document.createElement('div');
        item.className = 'bc-aq__item bc-aq__item--pending';

        const cbLabel = document.createElement('label');
        cbLabel.className = 'bc-aq__item-cb-label';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'bc-aq__item-cb';
        cbLabel.appendChild(cb);

        cb.addEventListener('change', () => {
          if (cb.checked) this.selectedIds.add(approval.id);
          else this.selectedIds.delete(approval.id);
          updateToolbar();
        });

        const info = document.createElement('div');
        info.className = 'bc-aq__item-info';

        const typeEl = document.createElement('span');
        typeEl.className = 'bc-aq__item-type';
        typeEl.textContent = approval.type;

        const projEl = document.createElement('span');
        projEl.className = 'bc-aq__item-project brain-console__detail';
        projEl.textContent = approval.projectId;

        const ageEl = document.createElement('span');
        ageEl.className = 'bc-aq__item-age brain-console__detail';
        ageEl.textContent = formatRelativeTime(approval.createdAt);

        info.appendChild(typeEl);
        info.appendChild(projEl);
        info.appendChild(ageEl);

        if (approval.expiresAt) {
          const expiryLabel = formatExpiryLabel(approval.expiresAt);
          const expiryEl = document.createElement('span');
          expiryEl.className = 'bc-aq__item-expiry brain-console__detail';
          expiryEl.textContent = expiryLabel;
          if (expiryLabel.includes('⚠')) {
            expiryEl.style.color = 'var(--bc-yellow, orange)';
          }
          info.appendChild(expiryEl);
        }

        const actions = document.createElement('div');
        actions.className = 'bc-aq__item-actions';

        const approveBtn = document.createElement('button');
        approveBtn.className = 'brain-console__local-app-action is-enabled bc-aq__btn-approve bc-aq__btn-sm';
        approveBtn.textContent = 'Approve';

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'brain-console__local-app-action bc-aq__btn-reject bc-aq__btn-sm';
        rejectBtn.textContent = 'Reject';

        approveBtn.addEventListener('click', () => {
          approveBtn.disabled = true;
          rejectBtn.disabled = true;
          approveBtn.textContent = '...';
          void this.singleDecide(approval.id, true).then(() => this.loadApprovals());
        });

        rejectBtn.addEventListener('click', () => {
          approveBtn.disabled = true;
          rejectBtn.disabled = true;
          rejectBtn.textContent = '...';
          void this.singleDecide(approval.id, false).then(() => this.loadApprovals());
        });

        actions.appendChild(approveBtn);
        actions.appendChild(rejectBtn);

        item.appendChild(cbLabel);
        item.appendChild(info);
        item.appendChild(actions);
        list.appendChild(item);
      }

      section.appendChild(list);
      body.appendChild(section);
    }

    // Decided summary
    if (decided.length > 0) {
      const decidedSection = document.createElement('div');
      decidedSection.className = 'bc-aq__section';
      const decidedLabel = document.createElement('p');
      decidedLabel.className = 'bc-aq__section-label brain-console__detail';
      decidedLabel.textContent = `Decided (${decided.length})`;
      decidedSection.appendChild(decidedLabel);

      const decidedList = document.createElement('div');
      decidedList.className = 'bc-aq__list bc-aq__list--decided';

      for (const approval of decided.slice(0, 10)) {
        const item = document.createElement('div');
        item.className = `bc-aq__item bc-aq__item--${approval.status}`;

        const info = document.createElement('div');
        info.className = 'bc-aq__item-info';

        const typeEl = document.createElement('span');
        typeEl.className = 'bc-aq__item-type';
        typeEl.textContent = approval.type;

        const projEl = document.createElement('span');
        projEl.className = 'bc-aq__item-project brain-console__detail';
        projEl.textContent = approval.projectId;

        const badge = document.createElement('span');
        badge.className = `bc-aq__badge bc-aq__badge--${approval.status}`;
        badge.textContent = approval.status;
        badge.title = approval.decisionReason ?? '';

        info.appendChild(typeEl);
        info.appendChild(projEl);
        info.appendChild(badge);
        item.appendChild(info);
        decidedList.appendChild(item);
      }

      if (decided.length > 10) {
        const more = document.createElement('p');
        more.className = 'brain-console__detail';
        more.textContent = `…and ${decided.length - 10} more`;
        decidedSection.appendChild(more);
      }

      decidedSection.appendChild(decidedList);
      body.appendChild(decidedSection);
    }
  }

  private async bulkDecide(ids: string[], approved: boolean): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/api/video-orchestrator/approvals/bulk-decide`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvalIds: ids, approved }),
      });
      const data = (await res.json()) as { ok: boolean };
      return data.ok === true;
    } catch {
      return false;
    }
  }

  private async singleDecide(approvalId: string, approved: boolean): Promise<void> {
    const action = approved ? 'approve' : 'reject';
    try {
      await fetch(`${BASE_URL}/api/video-orchestrator/approvals/${encodeURIComponent(approvalId)}/${action}`, {
        method: 'POST',
      });
    } catch {
      // Silently absorb — reload will show updated state
    }
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
