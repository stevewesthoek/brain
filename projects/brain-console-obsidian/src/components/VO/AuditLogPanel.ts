type AuditLogEntry = {
  id: string;
  approvalId: string;
  action: 'created' | 'approved' | 'rejected' | 'escalated' | 'expired';
  actor: string;
  timestamp: string;
  details: Record<string, unknown>;
};

type AuditLogApiResponse = {
  ok: boolean;
  entries?: AuditLogEntry[];
  count?: number;
  error?: string;
};

export class AuditLogPanel {
  private container: HTMLElement;
  private projectId: string;
  private allEntries: AuditLogEntry[] = [];

  constructor(container: HTMLElement, projectId: string) {
    this.container = container;
    this.projectId = projectId;
  }

  async initialize(): Promise<void> {
    this.render();
    await this.loadAuditLog();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="vo-audit-log-panel">
        <div class="vo-panel-header">
          <h3>Approval Audit Log</h3>
          <div class="vo-panel-header-actions">
            <input type="text" id="audit-filter" placeholder="Filter by approval ID..." class="vo-filter-input">
            <button class="vo-btn-secondary" id="audit-refresh">Refresh</button>
          </div>
        </div>

        <div class="vo-audit-table-wrapper">
          <table class="vo-audit-table">
            <thead>
              <tr>
                <th>Approval ID</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Timestamp</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody id="audit-log-tbody">
              <tr><td colspan="5" class="vo-loading-state">Loading audit log...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    const filterInput = this.container.querySelector('#audit-filter') as HTMLInputElement | null;
    filterInput?.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      this.filterLog(value);
    });

    const refreshBtn = this.container.querySelector('#audit-refresh') as HTMLButtonElement | null;
    refreshBtn?.addEventListener('click', () => {
      this.loadAuditLog();
    });
  }

  private async loadAuditLog(): Promise<void> {
    const tbody = this.container.querySelector('#audit-log-tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="5" class="vo-loading-state">Loading...</td></tr>';
    }

    try {
      const url = `http://localhost:4877/api/video-orchestrator/audit-log?projectId=${encodeURIComponent(this.projectId)}`;
      const response = await fetch(url);
      const data = (await response.json()) as AuditLogApiResponse;

      if (data.ok && data.entries) {
        this.allEntries = data.entries;
        this.renderLog(data.entries);
      } else {
        this.showError(data.error ?? 'Failed to load audit log');
      }
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Network error');
    }
  }

  private renderLog(entries: AuditLogEntry[]): void {
    const tbody = this.container.querySelector('#audit-log-tbody');
    if (!tbody) return;

    if (entries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="vo-empty-state">No audit log entries</td></tr>';
      return;
    }

    tbody.innerHTML = entries
      .map(
        (entry) => `
      <tr data-approval-id="${this.escapeAttr(entry.approvalId)}">
        <td class="vo-approval-id">${this.escapeHtml(entry.approvalId)}</td>
        <td><span class="vo-action-badge vo-action-${this.escapeAttr(entry.action)}">${this.escapeHtml(entry.action)}</span></td>
        <td>${this.escapeHtml(entry.actor)}</td>
        <td title="${this.escapeAttr(entry.timestamp)}">${new Date(entry.timestamp).toLocaleString()}</td>
        <td><button class="vo-btn-small vo-btn-details" data-entry-id="${this.escapeAttr(entry.id)}" data-details="${this.escapeAttr(JSON.stringify(entry.details))}">View</button></td>
      </tr>
    `,
      )
      .join('');

    // Attach detail button handlers
    tbody.querySelectorAll('.vo-btn-details').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = e.target as HTMLButtonElement;
        const details = target.getAttribute('data-details') ?? '{}';
        this.showDetails(details);
      });
    });
  }

  private filterLog(value: string): void {
    const rows = Array.from(
      this.container.querySelectorAll<HTMLTableRowElement>('#audit-log-tbody tr[data-approval-id]'),
    );
    const query = value.toLowerCase().trim();

    for (const row of rows) {
      const approvalId = (row.getAttribute('data-approval-id') ?? '').toLowerCase();
      row.style.display = query === '' || approvalId.includes(query) ? '' : 'none';
    }
  }

  private showDetails(detailsJson: string): void {
    try {
      const details = JSON.parse(detailsJson) as Record<string, unknown>;
      const message = Object.entries(details)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join('\n');
      // Simple inline alert — Phase 2 could use a modal
      alert(message || 'No details available');
    } catch {
      alert('Could not parse details');
    }
  }

  private showError(message: string): void {
    const tbody = this.container.querySelector('#audit-log-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="5" class="vo-error">${this.escapeHtml(message)}</td></tr>`;
    }
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
  }

  private escapeAttr(text: string): string {
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  destroy(): void {
    this.allEntries = [];
    this.container.innerHTML = '';
  }
}
