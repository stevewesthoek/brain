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
  status: 'published' | 'failed' | 'pending' | 'scheduled';
  publishedDate: string;
  errorMessage?: string;
}

export class HistoryPanel {
  private container: HTMLElement;
  private contentItems: BrainCoreVOStudioContentItem[] = [];
  private accounts: BrainCoreVOStudioPlatformAccount[] = [];
  private ctx = getVOContextManager();
  private unsubscribe: (() => void) | null = null;
  private sortBy: 'date' | 'status' | 'account' = 'date';
  private expandedEntryId: string | null = null;

  constructor(container: HTMLElement, data: {
    contentItems?: BrainCoreVOStudioContentItem[];
    accounts?: BrainCoreVOStudioPlatformAccount[];
  }) {
    this.container = container;
    this.contentItems = data.contentItems || [];
    this.accounts = data.accounts || [];

    this.unsubscribe = this.ctx.subscribe(() => this.render());
    this.render();
  }

  private render(): void {
    const state = this.ctx.getState();

    // Generate fixture history entries
    const entries = this.getFilteredHistory(state);

    this.container.innerHTML = `
      <div class="vo-history-panel">
        ${this.renderFilters()}
        ${this.renderHistoryTable(entries)}
      </div>
    `;

    this.attachEventListeners();
  }

  private renderFilters(): string {
    const state = this.ctx.getState();

    const projects = [...new Set(this.contentItems.map((i) => i.projectId))];
    const accountsForProject = this.accounts.filter((a) => a.projectId === state.projectId);

    return `
      <div class="vo-history-filters">
        <div class="vo-filter-group">
          <label class="vo-filter-label">Sort by</label>
          <select class="vo-filter-select vo-sort-select">
            <option value="date" ${this.sortBy === 'date' ? 'selected' : ''}>Date</option>
            <option value="status" ${this.sortBy === 'status' ? 'selected' : ''}>Status</option>
            <option value="account" ${this.sortBy === 'account' ? 'selected' : ''}>Account</option>
          </select>
        </div>

        ${accountsForProject.length > 0 ? `
          <div class="vo-filter-group">
            <label class="vo-filter-label">Account</label>
            <select class="vo-filter-select vo-account-filter">
              <option value="">All accounts</option>
              ${accountsForProject.map((a) => `
                <option value="${a.id}">${a.handle}</option>
              `).join('')}
            </select>
          </div>
        ` : ''}

        <div class="vo-filter-group">
          <label class="vo-filter-label">Status</label>
          <select class="vo-filter-select vo-status-filter">
            <option value="">All statuses</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
      </div>
    `;
  }

  private renderHistoryTable(entries: HistoryEntry[]): string {
    if (entries.length === 0) {
      return `
        <div class="vo-empty-state">
          <p>No history entries found</p>
        </div>
      `;
    }

    return `
      <div class="vo-history-table">
        <div class="vo-history-header">
          <div class="vo-history-col-date">Date</div>
          <div class="vo-history-col-content">Content</div>
          <div class="vo-history-col-account">Account</div>
          <div class="vo-history-col-platform">Platform</div>
          <div class="vo-history-col-status">Status</div>
        </div>
        ${entries.map((entry) => this.renderHistoryRow(entry)).join('')}
      </div>
    `;
  }

  private renderHistoryRow(entry: HistoryEntry): string {
    return `
      <div class="vo-history-row ${this.expandedEntryId === entry.id ? 'expanded' : ''}" data-entry-id="${entry.id}">
        <div class="vo-history-row-main">
          <div class="vo-history-col-date">${entry.publishedDate}</div>
          <div class="vo-history-col-content">${entry.contentTitle}</div>
          <div class="vo-history-col-account">${entry.accountHandle}</div>
          <div class="vo-history-col-platform">${entry.platform}</div>
          <div class="vo-history-col-status">
            <span class="vo-history-status ${this.getStatusClass(entry.status)}">${entry.status}</span>
          </div>
        </div>
        ${this.expandedEntryId === entry.id ? `
          <div class="vo-history-detail">
            <div class="vo-history-detail-row">
              <span class="vo-detail-key">Content ID:</span>
              <span class="vo-detail-value vo-detail-monospace">${entry.contentItemId}</span>
            </div>
            <div class="vo-history-detail-row">
              <span class="vo-detail-key">Account ID:</span>
              <span class="vo-detail-value vo-detail-monospace">${entry.accountId}</span>
            </div>
            ${entry.errorMessage ? `
              <div class="vo-history-detail-row vo-detail-error">
                <span class="vo-detail-key">Error:</span>
                <span class="vo-detail-value vo-detail-monospace">${entry.errorMessage}</span>
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  private getStatusClass(status: string): string {
    switch (status) {
      case 'published':
        return 'vo-history-published';
      case 'failed':
        return 'vo-history-failed';
      case 'pending':
        return 'vo-history-pending';
      case 'scheduled':
        return 'vo-history-scheduled';
      default:
        return '';
    }
  }

  private getFilteredHistory(state: any): HistoryEntry[] {
    // Generate fixture history entries from content items
    const entries: HistoryEntry[] = [];
    const now = new Date();

    const fixtureStatuses = ['published', 'published', 'failed', 'pending', 'scheduled'];

    const projectItems = this.contentItems.filter((i) => i.projectId === state.projectId);

    projectItems.slice(0, 10).forEach((item, idx) => {
      const account = this.accounts.find((a) => a.id === item.platformTargets[0]?.platformAccountId);
      const date = new Date(now.getTime() - (idx * 24 * 60 * 60 * 1000));

      entries.push({
        id: `entry-${item.id}-${idx}`,
        contentItemId: item.id,
        contentTitle: item.title,
        projectId: item.projectId,
        accountId: account?.id || 'unknown',
        accountHandle: account?.handle || 'Unknown',
        platform: account?.platform || 'unknown',
        status: (fixtureStatuses[idx % fixtureStatuses.length] as any) || 'pending',
        publishedDate: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        errorMessage: idx % 4 === 0 ? 'Connection timeout to platform API' : undefined,
      });
    });

    // Apply sorting
    switch (this.sortBy) {
      case 'status':
        entries.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'account':
        entries.sort((a, b) => a.accountHandle.localeCompare(b.accountHandle));
        break;
      case 'date':
      default:
        // Already sorted by date from fixture generation
        break;
    }

    return entries;
  }

  private attachEventListeners(): void {
    // Sort selector
    const sortSelect = this.container.querySelector('.vo-sort-select') as HTMLSelectElement;
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        const target = e.target as HTMLSelectElement;
        this.sortBy = (target.value as any) || 'date';
        this.render();
      });
    }

    // Row expansion
    this.container.querySelectorAll('.vo-history-row').forEach((row) => {
      row.addEventListener('click', () => {
        const entryId = row.getAttribute('data-entry-id');
        if (this.expandedEntryId === entryId) {
          this.expandedEntryId = null;
        } else {
          this.expandedEntryId = entryId;
        }

        this.container.querySelectorAll('.vo-history-row').forEach((r) => r.classList.remove('expanded'));
        if (this.expandedEntryId) {
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
