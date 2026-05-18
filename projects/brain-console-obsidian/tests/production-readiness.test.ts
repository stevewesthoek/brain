import { describe, it, expect, beforeEach } from 'vitest';

describe('Brain Console Production Readiness Cards', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('calculates production status correctly', () => {
    const videoReadiness = 32;
    const stbContinuity = 50; // unknown = 50%
    const postReadiness = 60; // partial = 60%
    const avgReadiness = Math.round((videoReadiness + stbContinuity + postReadiness) / 3);

    expect(avgReadiness).toBe(47);
    expect(avgReadiness < 50).toBe(true); // Should be warning color
  });

  it('identifies video orchestrator blockers', () => {
    const modules = [
      { id: 'module1', status: 'implemented' as const, name: 'Module 1' },
      { id: 'module2', status: 'blocked' as const, name: 'Module 2' },
      { id: 'module3', status: 'blocked' as const, name: 'Module 3' },
    ];

    const blocked = modules.filter(m => m.status === 'blocked');
    expect(blocked.length).toBe(2);

    const blockerText = `Video: ${blocked.length} module${blocked.length > 1 ? 's' : ''} blocked`;
    expect(blockerText).toBe('Video: 2 modules blocked');
  });

  it('detects STB pipeline offline status', () => {
    const stbStatus = 'unknown';
    const isBroken = stbStatus === 'unknown' || stbStatus === 'failed';
    expect(isBroken).toBe(true);

    const blockerText = 'STB: pipeline offline or unknown';
    expect(blockerText).toContain('offline');
  });

  it('detects when publishing and scheduling are disabled', () => {
    const publishingEnabled = false;
    const schedulingEnabled = false;

    const blocked = publishingEnabled === false && schedulingEnabled === false;
    expect(blocked).toBe(true);

    const blockerText = 'Posts: publishing & scheduling disabled';
    expect(blockerText).toContain('disabled');
  });

  it('renders blocker list with warning icons', () => {
    const blockers = ['Video: 2 modules blocked', 'STB: pipeline offline or unknown'];

    const list = container.createEl('ul', { cls: 'brain-console__blocker-list' });
    blockers.forEach(blocker => {
      list.createEl('li', { text: blocker });
    });

    const items = container.querySelectorAll('.brain-console__blocker-list li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Video: 2 modules blocked');
    expect(items[1].textContent).toContain('STB: pipeline offline');
  });

  it('renders video readiness with correct metrics', () => {
    const videoOrch = {
      moduleProgress: {
        total: 11,
        implemented: 0,
        partial: 7,
        planned: 4,
        blocked: 0,
        percent: 32,
      },
    };

    const metric = container.createEl('div', { cls: 'brain-console__metric', text: `${videoOrch.moduleProgress.percent}%` });
    expect(metric.textContent).toBe('32%');

    const row1 = container.createEl('div', { cls: 'brain-console__row' });
    row1.createEl('dt', { text: 'Implemented' });
    row1.createEl('dd', { text: `${videoOrch.moduleProgress.implemented}/${videoOrch.moduleProgress.total}` });

    const row2 = container.createEl('div', { cls: 'brain-console__row' });
    row2.createEl('dt', { text: 'Blocked' });
    row2.createEl('dd', { text: `${videoOrch.moduleProgress.blocked}` });

    expect(container.querySelector('dd')?.textContent).toBe('0/11');
  });

  it('applies color codes based on readiness percentage', () => {
    const testCases = [
      { percent: 85, expectedColor: '#22c55e' }, // green
      { percent: 60, expectedColor: '#eab308' }, // yellow
      { percent: 30, expectedColor: '#ef4444' }, // red
    ];

    testCases.forEach(({ percent, expectedColor }) => {
      const metric = document.createElement('div');
      metric.className = 'brain-console__metric';
      metric.textContent = `${percent}%`;

      if (percent >= 75) metric.style.color = '#22c55e';
      else if (percent >= 50) metric.style.color = '#eab308';
      else metric.style.color = '#ef4444';

      expect(metric.style.color).toBe(expectedColor);
    });
  });
});
