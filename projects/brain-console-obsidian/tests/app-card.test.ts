import { describe, it, expect, beforeEach } from 'vitest';

describe('Brain Console App Card Rendering', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders app list with status badges', () => {
    const mockApps = [
      { id: 'brain-core', name: 'Brain Core API', status: 'running' as const, source: 'runtime-report' as const, actionsSupported: false },
      { id: 'brainConsole', name: 'BrainConsole Service', status: 'stopped' as const, source: 'runtime-report' as const, actionsSupported: false },
    ];

    // Simulate the app list rendering
    const appList = container.createDiv({ cls: 'brain-console__app-list' });
    mockApps.forEach(app => {
      const item = appList.createDiv({ cls: 'brain-console__app-item' });
      item.createDiv({ cls: 'brain-console__app-name', text: app.name });

      const row = item.createDiv({ cls: 'brain-console__app-controls' });
      const badge = row.createDiv({ cls: 'brain-console__app-status-badge' });
      badge.textContent = app.status;

      const actions = row.createDiv({ cls: 'brain-console__app-actions' });
      const startBtn = actions.createEl('button', { text: 'Start', cls: 'brain-console__app-btn-disabled' });
      startBtn.disabled = true;
      startBtn.title = 'Approval-gated, planned Phase 5';
    });

    const appItems = container.querySelectorAll('.brain-console__app-item');
    expect(appItems.length).toBe(2);

    // Check first app (running)
    const firstApp = appItems[0];
    const firstName = firstApp.querySelector('.brain-console__app-name');
    expect(firstName?.textContent).toBe('Brain Core API');

    const firstBadge = firstApp.querySelector('.brain-console__app-status-badge');
    expect(firstBadge?.textContent).toBe('running');

    const firstButtons = firstApp.querySelectorAll('.brain-console__app-btn-disabled');
    expect(firstButtons.length).toBe(2); // start and stop buttons
    expect((firstButtons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((firstButtons[0] as HTMLButtonElement).title).toBe('Approval-gated, planned Phase 5');

    // Check second app (stopped)
    const secondApp = appItems[1];
    const secondName = secondApp.querySelector('.brain-console__app-name');
    expect(secondName?.textContent).toBe('BrainConsole Service');

    const secondBadge = secondApp.querySelector('.brain-console__app-status-badge');
    expect(secondBadge?.textContent).toBe('stopped');
  });

  it('renders empty state when no apps available', () => {
    const appList = container.createDiv({ cls: 'brain-console__app-list' });
    const note = appList.createDiv({ cls: 'brain-console__list-note', text: 'No local apps available' });

    expect(note.textContent).toBe('No local apps available');
    expect(container.querySelectorAll('.brain-console__app-item').length).toBe(0);
  });

  it('renders more indicator when apps exceed 8', () => {
    const mockApps = Array.from({ length: 10 }, (_, i) => ({
      id: `app-${i}`,
      name: `App ${i}`,
      status: 'running' as const,
      source: 'runtime-report' as const,
      actionsSupported: false,
    }));

    const appList = container.createDiv({ cls: 'brain-console__app-list' });
    mockApps.slice(0, 8).forEach(app => {
      const item = appList.createDiv({ cls: 'brain-console__app-item' });
      item.createDiv({ cls: 'brain-console__app-name', text: app.name });
    });

    if (mockApps.length > 8) {
      appList.createEl('div', { cls: 'brain-console__list-note', text: `... and ${mockApps.length - 8} more` });
    }

    const appItems = container.querySelectorAll('.brain-console__app-item');
    expect(appItems.length).toBe(8);

    const moreNote = container.querySelector('.brain-console__list-note');
    expect(moreNote?.textContent).toBe('... and 2 more');
  });

  it('applies correct colors to status badges', () => {
    const statuses = [
      { status: 'running', expectedColor: '#22c55e' },
      { status: 'stopped', expectedColor: '#ef4444' },
      { status: 'disabled', expectedColor: '#64748b' },
      { status: 'unknown', expectedColor: '#94a3b8' },
    ];

    statuses.forEach(({ status, expectedColor }) => {
      const badge = document.createElement('div');
      badge.className = 'brain-console__app-status-badge';
      badge.textContent = status;

      // Simulate color assignment logic
      if (status === 'running') badge.style.color = '#22c55e';
      else if (status === 'stopped') badge.style.color = '#ef4444';
      else if (status === 'disabled') badge.style.color = '#64748b';
      else badge.style.color = '#94a3b8';

      expect(badge.style.color).toBe(expectedColor);
    });
  });
});
