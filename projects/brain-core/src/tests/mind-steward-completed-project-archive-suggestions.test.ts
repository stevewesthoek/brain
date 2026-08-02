import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCompletedProjectArchiveSuggestions } from '../adapters/mind-steward-completed-project-archive-suggestions.js';

test('completed project archive suggestions propose canonical history path', () => {
  const report = generateCompletedProjectArchiveSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'projects/prochat/qa-memory.md',
        content: `---
status: active
completed_on: 2026-06-10
---
# QA Memory
`,
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.status, 'ready');
  assert.equal(report.suggestions[0]?.activePath, 'projects/prochat/qa-memory.md');
  assert.equal(report.suggestions[0]?.proposedArchivePath, 'history/projects/prochat/qa-memory.md');
  assert.equal(report.suggestions[0]?.requiresApproval, true);
  assert.equal(report.safety.writesArchive, false);
  assert.equal(report.safety.movesFiles, false);
});

test('completed project archive suggestions propose target history path for target projects path', () => {
  const report = generateCompletedProjectArchiveSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'projects/prochat/qa-memory.md',
        content: `---
status: active
completed_on: 2026-06-10
---
# QA Memory
`,
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.status, 'ready');
  assert.equal(report.suggestions[0]?.activePath, 'projects/prochat/qa-memory.md');
  assert.equal(report.suggestions[0]?.proposedArchivePath, 'history/projects/prochat/qa-memory.md');
  assert.equal(report.suggestions[0]?.affectedSurface, 'projects');
  assert.equal(report.suggestions[0]?.requiresApproval, true);
  assert.equal(report.safety.movesFiles, false);
});

test('completed project archive suggestions honor safe explicit archive path', () => {
  const report = generateCompletedProjectArchiveSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'projects/prochat/qa-memory.md',
        content: `---
project_status: current
completion_status: completed
archive_path: history/projects/completed/prochat-qa-memory.md
---
# QA Memory
`,
      },
    ],
  });

  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.proposedArchivePath, 'history/projects/completed/prochat-qa-memory.md');
  assert.deepEqual(report.suggestions[0]?.blockers, []);
});

test('completed project archive suggestions avoid pages without active-completed conflict', () => {
  const report = generateCompletedProjectArchiveSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'projects/prochat/active.md',
        content: 'status: active\n',
      },
      {
        path: 'projects/prochat/completed.md',
        content: 'completion_status: completed\n',
      },
      {
        path: 'wiki/projects/prochat/completed.md',
        content: 'status: active\ncompleted_on: 2026-06-10\n',
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 0);
  assert.equal(report.safety.writesLiveProjects, false);
});

test('completed project archive suggestions block unsafe explicit archive destinations', () => {
  const report = generateCompletedProjectArchiveSuggestions({
    reportDate: '2026-06-18',
    files: [
      {
        path: 'projects/prochat/qa-memory.md',
        content: `---
status: active
completed_on: 2026-06-10
archive_path: history/
---
# QA Memory
`,
      },
    ],
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.suggestions.length, 1);
  assert.equal(report.suggestions[0]?.status, 'blocked');
  assert(report.suggestions[0]?.blockers.includes('invalidArchiveDestination'));
  assert.equal(report.safety.deletesFiles, false);
});

test('completed project archive suggestions block invalid report dates', () => {
  const report = generateCompletedProjectArchiveSuggestions({
    reportDate: 'June 18, 2026',
    files: [
      {
        path: 'projects/prochat/qa-memory.md',
        content: 'status: active\ncompleted_on: 2026-06-10\n',
      },
    ],
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('validIsoReportDateRequired'));
  assert.equal(report.suggestions.length, 0);
  assert.equal(report.safety.suggestionOnly, true);
});
