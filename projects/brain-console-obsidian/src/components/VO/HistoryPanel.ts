import type {
  BrainCoreVOStudioContentItem,
  BrainCoreVOStudioPlatformAccount,
} from '../../client.js';
import { getVOContextManager } from './VOContext.js';

export interface HistoryEntry {
  id: string;
  contentItemId: string;
  contentTitle: string;
  projectId: string;
  accountId: string;
  accountHandle: string;
  platform: string;
  status: 'published' | 'failed' | 'draft' | 'scheduled';
  publishedAt: string;
  error?: string;
}

type SortField = 'publishedAt' | 'status' | 'account' | 'platform';
type StatusFilter = '' | 'published' | 'failed' | 'draft' | 'scheduled';

const PAGE_SIZE = 50;

export class HistoryPanel {
  private container: HTMLElement;
  private contentItems: BrainCoreVOStudioContentItem[] = [];
  private accounts: BrainCoreVOStudioPlatformAccount[] = [];
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;

  // Filter state
  private filterAccount = '';
  private filterPlatform = '';
  private filterStatus: StatusFilter = '';
  private filterDateStart = '';
  private filterDateEnd = '';
  private sortBy: SortField = 'publishedAt';
  private sortDesc = true;
  private currentPage = 0;

  constructor(container: HTMLElement, data: {
    contentItems?: BrainCoreVOStudioContentItem[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
  }) {
    this.container = container;
    this.contentItems = data.contentItems || [];
    this.accounts = data.accounts || [];

    this.unsubscribe = this.ctx.subscribe(() => {
      this.currentPage = 0;
      this.render();
    });
    this.render();
  }

  private render(): void {
    const state = this.ctx.getState();
    const allEntries = this.buildEntries(state);
    const filtered = this.applyFilters(allEntries);
    const sorted = this.applySort(filtered);
    const pageEntries = sorted.slice(this.currentPage * PAGE_SIZE, (this.currentPage + 1) * PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));

    this.container.innerHTML = `
      <div class="vo-history-panel">
        ${this.renderFilters(state, allEntries)}
        ${this.renderTable(pageEntries)}
        ${this.renderPagination(sorted.length, totalPages)}
      </div>
    `;

    this.attachEventListeners();
  }

  private renderFilters(state: any, allEntries: HistoryEntry[]): string {
    const accountsForProject = this.accounts.filter((a) => a.projectId === state.projectId);
    const platforms = [...new Set(allEntries.map((e) => e.platform).filter(Boolean))].sort();

    return `
      <div class="vo-history-filters">
        ${accountsForProject.length > 0 ? `
          <div class="vo-filter-group">
            <label class="vo-filter-label">Account</label>
            <select class="vo-filter-select" data-filter="account">
              <option value="">All accounts</option>
              ${accountsForProject.map((a) => `
                <option value="${a.id}" ${this.filterAccount === a.id ? 'selected' : ''}>${a.handle}</option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        <div class="vo-filter-group">
          <label class="vo-filter-label">Platform</label>
          <select class="vo-filter-select" data-filter="platform">
            <option value="">All platforms</option>
            ${platforms.map((p) => `
              <option value="${p}" ${this.filterPlatform === p ? 'selected' : ''}>${p}</option>
            `).join('')}
          </select>
        </div>

        <div class="vo-filter-group">
          <label class="vo-filter-label">Status</label>
          <select class="vo-filter-select" data-filter="status">
            <option value="">All statuses</option>
            <option value="published" ${this.filterStatus === 'published' ? 'selected' : ''}>Published</option>
            <option value="scheduled" ${this.filterStatus === 'scheduled' ? 'selected' : ''}>Scheduled</option>
            <option value="failed" ${this.filterStatus === 'failed' ? 'selected' : ''}>Failed</option>
            <option value="draft" ${this.filterStatus === 'draft' ? 'selected' : ''}>Draft</option>
          </select>
        </div>

        <div class="vo-filter-group">
          <label class="vo-filter-label">From</label>
          <input
            class="vo-filter-date"
            type="date"
            data-filter="dateStart"
            value="${this.filterDateStart}"
          />
        </div>

        <div class="vo-filter-group">
          <label class="vo-filter-label">To</label>
          <input
            class="vo-filter-date"
            type="date"
            data-filter="dateEnd"
            value="${this.filterDateEnd}"
          />
        </div>

        <div class="vo-filter-group">
          <label class="vo-filter-label">Sort</label>
          <select class="vo-filter-select" data-filter="sortBy">
            <option value="publishedAt" ${this.sortBy === 'publishedAt' ? 'selected' : ''}>Published At</option>
            <option value="status" ${this.sortBy === 'status' ? 'selected' : ''}>Status</option>
            <option value="account" ${this.sortBy === 'account' ? 'selected' : ''}>Account</option>
            <option value="platform" ${this.sortBy === 'platform' ? 'selected' : ''}>Platform</option>
          </select>
        </div>

        <div class="vo-filter-group">
          <label class="vo-filter-label">Order</label>
          <button class="vo-filter-sort-btn" data-action="toggle-sort" title="Toggle sort direction">
            ${this.sortDesc ? '↓ Desc' : '↑ Asc'}
          </button>
        </div>
      </div>
    `;
  }

  private renderTable(entries: HistoryEntry[]): string {
    if (entries.length === 0) {
      return `
        <div class="vo-empty-state">
          <p>No history entries found</p>
        </div>
      `;
    }

    return `
      <div class="vo-history-table">
        <div class="vo-history-header vo-history-header--extended">
          <div class="vo-history-col-id">Content Item ID</div>
          <div class="vo-history-col-platform">Platform</div>
          <div class="vo-history-col-account">Account</div>
          <div class="vo-history-col-status">Status</div>
          <div class="vo-history-col-date">Published At</div>
          <div class="vo-history-col-error">Error</div>
        </div>
        ${entries.map((entry) => this.renderRow(entry)).join('')}
      </div>
    `;
  }

  private renderRow(entry: HistoryEntry): string {
    return `
      <div class="vo-history-row" data-entry-id="${entry.id}">
        <div class="vo-history-row-main vo-history-row-main--extended">
          <div class="vo-history-col-id vo-monospace">${entry.contentItemId.slice(0, 12)}…</div>
          <div class="vo-history-col-platform">${entry.platform}</div>
          <div class="vo-history-col-account">${entry.accountHandle}</div>
          <div class="vo-history-col-status">
            <span class="vo-history-status ${this.getStatusClass(entry.status)}">${entry.status}</span>
          </div>
          <div class="vo-history-col-date">${entry.publishedAt}</div>
          <div class="vo-history-col-error ${entry.error ? 'vo-detail-error' : 'vo-muted'}">
            ${entry.error ? entry.error.slice(0, 40) + (entry.error.length > 40 ? '…' : '') : '–'}
          </div>
        </div>
      </div>
    `;
  }

  private renderPagination(total: number, totalPages: number): string {
    if (totalPages <= 1) {
      return `<div class="vo-history-pagination-bar"><span class="vo-muted">${total} entries</span></div>`;
    }

    const start = this.currentPage * PAGE_SIZE + 1;
    const end = Math.min((this.currentPage + 1) * PAGE_SIZE, total);

    return `
      <div class="vo-history-pagination-bar">
        <span class="vo-muted">${start}–${end} of ${total}</span>
        <div class="vo-history-pagination-controls">
          <button
            class="vo-pagination-btn"
            data-action="page-prev"
            ${this.currentPage === 0 ? 'disabled' : ''}
          >← Prev</button>
          <span class="vo-pagination-page">${this.currentPage + 1} / ${totalPages}</span>
          <button
            class="vo-pagination-btn"
            data-action="page-next"
            ${this.currentPage >= totalPages - 1 ? 'disabled' : ''}
          >Next →</button>
        </div>
      </div>
    `;
  }

  private buildEntries(state: any): HistoryEntry[] {
    const now = new Date();
    const fixtureStatuses: HistoryEntry['status'][] = ['published', 'published', 'failed', 'scheduled', 'draft'];
    const errors = [
      'Connection timeout to platform API',
      'OAuth token expired',
      'Upload size limit exceeded',
    ];

    const projectItems = this.contentItems.filter((i) => i.projectId === state.projectId);
    const entries: HistoryEntry[] = [];

    projectItems.forEach((item, itemIdx) => {
      // Each content item can have multiple posting targets → one history row each
      const targets = item.platformTargets.length > 0 ? item.platformTargets : [{ platformAccountId: null, platform: 'unknown', mode: 'manual-package', status: 'draft', approvalRequired: false, id: item.id }];

      targets.forEach((target, targetIdx) => {
        const account = this.accounts.find((a) => a.id === target.platformAccountId);
        const entryDate = new Date(now.getTime() - (itemIdx * 3 + targetIdx) * 12 * 60 * 60 * 1000);
        const statusIdx = (itemIdx + targetIdx) % fixtureStatuses.length;
        const status = fixtureStatuses[statusIdx];
        const hasError = status === 'failed';

        entries.push({
          id: `h-${item.id}-${targetIdx}`,
          contentItemId: item.id,
          contentTitle: item.title,
          projectId: item.projectId,
          accountId: account?.id ?? 'unknown',
          accountHandle: account?.handle ?? (target as any).platform ?? 'Unknown',
          platform: account?.platform ?? (target as any).platform ?? 'unknown',
          status,
          publishedAt: entryDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          error: hasError ? errors[itemIdx % errors.length] : undefined,
        });
      });
    });

    return entries;
  }

  private applyFilters(entries: HistoryEntry[]): HistoryEntry[] {
    return entries.filter((e) => {
      if (this.filterAccount && e.accountId !== this.filterAccount) return false;
      if (this.filterPlatform && e.platform !== this.filterPlatform) return false;
      if (this.filterStatus && e.status !== this.filterStatus) return false;
      return true;
    });
  }

  private applySort(entries: HistoryEntry[]): HistoryEntry[] {
    const sorted = [...entries].sort((a, b) => {
      let cmp = 0;
      switch (this.sortBy) {
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
        case 'account':
          cmp = a.accountHandle.localeCompare(b.accountHandle);
          break;
        case 'platform':
          cmp = a.platform.localeCompare(b.platform);
          break;
        case 'publishedAt':
        default:
          // Already in most-recent-first order by construction
          cmp = 0;
          break;
      }
      return this.sortDesc ? -cmp : cmp;
    });
    return sorted;
  }

  private getStatusClass(status: string): string {
    switch (status) {
      case 'published':
        return 'vo-history-published';
      case 'failed':
        return 'vo-history-failed';
      case 'draft':
        return 'vo-history-pending';
      case 'scheduled':
        return 'vo-history-scheduled';
      default:
        return '';
    }
  }

  private attachEventListeners(): void {
    // Filter selects
    this.container.querySelectorAll('.vo-filter-select[data-filter]').forEach((el) => {
      el.addEventListener('change', (e) => {
        const filter = (e.currentTarget as HTMLSelectElement).getAttribute('data-filter');
        const value = (e.currentTarget as HTMLSelectElement).value;
        this.currentPage = 0;
        switch (filter) {
          case 'account':
            this.filterAccount = value;
            break;
          case 'platform':
            this.filterPlatform = value;
            break;
          case 'status':
            this.filterStatus = value as StatusFilter;
            break;
          case 'sortBy':
            this.sortBy = value as SortField;
            break;
        }
        this.render();
      });
    });

    // Date filters
    this.container.querySelectorAll('.vo-filter-date[data-filter]').forEach((el) => {
      el.addEventListener('change', (e) => {
        const filter = (e.currentTarget as HTMLInputElement).getAttribute('data-filter');
        const value = (e.currentTarget as HTMLInputElement).value;
        this.currentPage = 0;
        if (filter === 'dateStart') this.filterDateStart = value;
        if (filter === 'dateEnd') this.filterDateEnd = value;
        this.render();
      });
    });

    // Sort direction toggle
    const sortBtn = this.container.querySelector('[data-action="toggle-sort"]');
    if (sortBtn) {
      sortBtn.addEventListener('click', () => {
        this.sortDesc = !this.sortDesc;
        this.currentPage = 0;
        this.render();
      });
    }

    // Pagination
    const prevBtn = this.container.querySelector('[data-action="page-prev"]');
    const nextBtn = this.container.querySelector('[data-action="page-next"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 0) {
          this.currentPage--;
          this.render();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.currentPage++;
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
