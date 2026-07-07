import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProjectStatusReviewSuggestions } from '../adapters/mind-steward-project-status-suggestions.js';

test('project status suggestions flag due review_after metadata', () => {
  const report = generateProjectStatusReviewSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'live/projects/prochat/strategy.md',
        content: `---
status: active
last_reviewed: 2026-06-01
review_after: 2026-06-15
---
# Project
`,
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.reason, 'review-after-due');
  assert.equal(report.suggestions[0]?.projectPath, 'live/projects/prochat/strategy.md');
  assert.equal(report.suggestions[0]?.requiresApproval, true);
  assert.equal(report.safety.writesLiveProjects, false);
});

test('project status suggestions accept target projects path during migration', () => {
  const report = generateProjectStatusReviewSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'projects/prochat/strategy.md',
        content: `---
status: active
last_reviewed: 2026-06-01
review_after: 2026-06-15
---
# Project
`,
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.projectPath, 'projects/prochat/strategy.md');
  assert.equal(report.suggestions[0]?.reason, 'review-after-due');
  assert.equal(report.suggestions[0]?.requiresApproval, true);
});

test('project status suggestions flag stale last_reviewed metadata', () => {
  const report = generateProjectStatusReviewSuggestions({
    reportDate: '2026-06-18',
    staleAfterDays: 30,
    files: [
      {
        path: 'live/projects/prochat/qa-memory.md',
        content: `---
project_status: current
last_reviewed: 2026-05-01
---
# Project
`,
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.reason, 'last-reviewed-stale');
  assert.match(report.suggestions[0]?.evidence[0] ?? '', /older than 30 days/);
});

test('project status suggestions flag missing project status metadata', () => {
  const report = generateProjectStatusReviewSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'live/projects/prochat/missing-status.md',
        content: '# Project\n\nNo project status metadata.\n',
      },
    ],
  });

  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.reason, 'missing-status');
  assert.equal(report.suggestions[0]?.currentStatus, null);
});

test('project status suggestions ignore non-project and unsafe paths', () => {
  const report = generateProjectStatusReviewSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'live/dashboard.md',
        content: 'status: active\nreview_after: 2026-06-01\n',
      },
      {
        path: 'live/projects/../dashboard.md',
        content: 'status: active\nreview_after: 2026-06-01\n',
      },
      {
        path: 'live/projects/prochat/current.md',
        content: 'status: active\nreview_after: 2026-07-01\n',
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 0);
  assert.equal(report.safety.writesToMind, false);
  assert.equal(report.safety.writesKanban, false);
});

test('project status suggestions block invalid report dates and stale thresholds', () => {
  const report = generateProjectStatusReviewSuggestions({
    reportDate: 'June 18, 2026',
    staleAfterDays: 0,
    files: [
      {
        path: 'live/projects/prochat/current.md',
        content: 'status: active\n',
      },
    ],
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('validIsoReportDateRequired'));
  assert(report.blockers.includes('validStaleAfterDaysRequired'));
  assert.equal(report.suggestions.length, 0);
  assert.equal(report.safety.suggestionOnly, true);
});
