/**
 * ScriptApprovalPanel — I-7.8 / I-8.3
 *
 * Script approval and generation UI for VO Studio.
 *
 * Features:
 *  - Fetches scripts for selected channel
 *  - Shows approval status (pending / changes_requested / approved)
 *  - Approve / Request Changes buttons
 *  - Generate Video button (enabled only for approved scripts)
 *  - Shows generation status when triggered
 */

const BASE_URL = 'http://localhost:4877';

interface ScriptMetadata {
  jobId: string;
  channelId: string;
  title: string;
  status?: string;
  approval?: {
    status: 'pending' | 'changes_requested' | 'approved';
    approvedBy?: string;
    approvedAt?: string;
    notes?: string;
  };
}

export class ScriptApprovalPanel {
  private container: HTMLElement;
  private channelId: string;
  private scripts: ScriptMetadata[] = [];
  private isLoading = false;

  constructor(container: HTMLElement, channelId: string = 'prochat') {
    this.container = container;
    this.channelId = channelId;
  }

  async initialize(): Promise<void> {
    this.renderShell();
    await this.loadScripts();
  }

  private renderShell(): void {
    this.container.innerHTML = `
      <div class="vo-script-approval bc-sa">
        <div class="bc-sa__header">
          <span class="bc-sa__title">Script Approval & Generation</span>
          <div class="bc-sa__channel-selector">
            <select id="bc-sa-channel-select" class="brain-console__input">
              <option value="prochat">ProChat</option>
              <option value="says-the-bible">Says the Bible</option>
            </select>
          </div>
          <div class="bc-sa__header-actions">
            <button class="brain-console__link-button" id="bc-sa-refresh">Refresh</button>
          </div>
        </div>
        <div class="bc-sa__body" id="bc-sa-body">
          <p class="brain-console__detail">Loading scripts...</p>
        </div>
      </div>
    `;

    const channelSelect = this.container.querySelector('#bc-sa-channel-select') as HTMLSelectElement;
    if (channelSelect) {
      channelSelect.value = this.channelId;
      channelSelect.addEventListener('change', (e) => {
        this.channelId = (e.target as HTMLSelectElement).value;
        void this.loadScripts();
      });
    }

    const refreshBtn = this.container.querySelector('#bc-sa-refresh');
    refreshBtn?.addEventListener('click', () => this.loadScripts());
  }

  private async loadScripts(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    const body = this.container.querySelector('#bc-sa-body');
    if (body) body.innerHTML = '<p class="brain-console__detail">Loading scripts...</p>';

    try {
      const res = await fetch(
        `${BASE_URL}/api/video-orchestrator/scripts/channels/${encodeURIComponent(this.channelId)}`
      );
      const data = (await res.json()) as { ok?: boolean; scripts?: ScriptMetadata[] };
      this.scripts = Array.isArray(data.scripts) ? data.scripts : [];
      this.renderBody();
    } catch (err) {
      if (body) {
        body.innerHTML = `<p class="brain-console__detail">Failed to load scripts: ${err instanceof Error ? err.message : String(err)}</p>`;
      }
    } finally {
      this.isLoading = false;
    }
  }

  private renderBody(): void {
    const body = this.container.querySelector('#bc-sa-body') as HTMLElement | null;
    if (!body) return;

    body.innerHTML = '';

    if (this.scripts.length === 0) {
      body.innerHTML = '<p class="brain-console__detail">No scripts found for this channel.</p>';
      return;
    }

    const section = document.createElement('div');
    section.className = 'bc-sa__section';

    const sectionLabel = document.createElement('p');
    sectionLabel.className = 'bc-sa__section-label';
    sectionLabel.textContent = `Scripts (${this.scripts.length})`;
    section.appendChild(sectionLabel);

    const list = document.createElement('div');
    list.className = 'bc-sa__list';

    for (const script of this.scripts) {
      const item = document.createElement('div');
      item.className = 'bc-sa__item';

      const titleEl = document.createElement('div');
      titleEl.className = 'bc-sa__item-title';
      titleEl.textContent = script.title;

      const statusBadge = document.createElement('span');
      statusBadge.className = `bc-sa__item-status bc-sa__status--${script.approval?.status || 'unknown'}`;
      statusBadge.textContent = script.approval?.status || 'unknown';
      titleEl.appendChild(statusBadge);

      item.appendChild(titleEl);

      const approvalStatus = script.approval?.status || 'pending';
      const actionRow = document.createElement('div');
      actionRow.className = 'bc-sa__item-actions';

      // Approve button
      const approveBtn = document.createElement('button');
      approveBtn.className = 'brain-console__local-app-action is-enabled bc-sa__btn-approve';
      approveBtn.textContent = approvalStatus === 'approved' ? '✓ Approved' : 'Approve';
      approveBtn.disabled = approvalStatus === 'approved';

      approveBtn.addEventListener('click', () => {
        approveBtn.disabled = true;
        approveBtn.textContent = 'Approving...';
        void this.approveScript(script.jobId).then((ok) => {
          if (ok) {
            void this.loadScripts();
          } else {
            approveBtn.textContent = 'Approve';
            approveBtn.disabled = false;
          }
        });
      });

      // Request Changes button
      const changesBtn = document.createElement('button');
      changesBtn.className = 'brain-console__local-app-action bc-sa__btn-changes';
      changesBtn.textContent = 'Request Changes';
      changesBtn.disabled = approvalStatus === 'pending' || approvalStatus === 'changes_requested';

      changesBtn.addEventListener('click', () => {
        const notes = prompt('Enter change request notes:');
        if (!notes) return;

        changesBtn.disabled = true;
        changesBtn.textContent = 'Requesting...';
        void this.requestChanges(script.jobId, notes).then((ok) => {
          if (ok) {
            void this.loadScripts();
          } else {
            changesBtn.textContent = 'Request Changes';
            changesBtn.disabled = false;
          }
        });
      });

      // Generate Video button (enabled ONLY for approved)
      const generateBtn = document.createElement('button');
      generateBtn.className = 'brain-console__local-app-action is-enabled bc-sa__btn-generate';
      generateBtn.textContent = 'Generate Video';
      generateBtn.disabled = approvalStatus !== 'approved';

      generateBtn.addEventListener('click', () => {
        if (
          confirm(
            'Generate video artifacts only. This will not publish to YouTube. Continue?'
          )
        ) {
          generateBtn.disabled = true;
          generateBtn.textContent = 'Generating...';
          void this.generateVideo(script.jobId).then((ok) => {
            if (ok) {
              generateBtn.textContent = 'Started ✓';
              setTimeout(() => {
                void this.loadScripts();
              }, 2000);
            } else {
              generateBtn.textContent = 'Generate Video';
              generateBtn.disabled = false;
            }
          });
        }
      });

      actionRow.appendChild(approveBtn);
      actionRow.appendChild(changesBtn);
      actionRow.appendChild(generateBtn);

      item.appendChild(actionRow);
      list.appendChild(item);
    }

    section.appendChild(list);
    body.appendChild(section);
  }

  private async approveScript(jobId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Steve', notes: 'Approved from Brain Console' }),
      });
      const data = (await res.json()) as { ok?: boolean };
      return data.ok === true;
    } catch {
      return false;
    }
  }

  private async requestChanges(jobId: string, notes: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${BASE_URL}/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/request-changes`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requestedBy: 'Steve', notes }),
        }
      );
      const data = (await res.json()) as { ok?: boolean };
      return data.ok === true;
    } catch {
      return false;
    }
  }

  private async generateVideo(jobId: string): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/generate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ requestedBy: 'Steve' }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        generationStatus?: string;
        executionArn?: string;
      };
      if (data.ok) {
        console.log(`Generation started: ${data.executionArn}`);
      }
      return data.ok === true;
    } catch (err) {
      console.error('Generation failed:', err);
      return false;
    }
  }

  render(container: HTMLElement): HTMLElement {
    this.container = container;
    void this.initialize();
    return this.container;
  }

  destroy(): void {
    // Cleanup if needed
  }
}
