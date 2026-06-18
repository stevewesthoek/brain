import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defineLosslessCanonicalTaskRecords } from '../adapters/mind-steward-canonical-task-record.js';

function fixtureExport() {
  return {
    source: 'kanban.md',
    cards: [
      {
        column: 'Backlog',
        line: 12,
        checked: false,
        title: 'Save to mind improvements #p3 #you',
        raw: '- [ ] Save to mind improvements #p3 #you',
        tags: ['#p3', '#you'],
        completedAt: null,
        subtasks: [
          {
            line: 13,
            checked: true,
            title: 'Normalize producer tags output ✅ 2026-06-10',
            raw: '  - [x] Normalize producer tags output ✅ 2026-06-10',
            tags: [],
            completedAt: '2026-06-10',
          },
          {
            line: 14,
            checked: false,
            title: 'Add lightweight regression check #p2',
            raw: '  - [ ] Add lightweight regression check #p2',
            tags: ['#p2'],
            completedAt: null,
          },
        ],
      },
    ],
  };
}

test('canonical task records preserve lossless Kanban card fields', () => {
  const report = defineLosslessCanonicalTaskRecords(fixtureExport());

  assert.equal(report.status, 'ready');
  assert.equal(report.purpose, 'round-trip-validation-only');
  assert.equal(report.records.length, 1);
  const record = report.records[0];
  assert(record);
  assert.match(record.id, /^task-[a-f0-9]{16}$/);
  assert.equal(record.source, 'kanban.md');
  assert.equal(record.sourceLine, 12);
  assert.equal(record.status, 'Backlog');
  assert.equal(record.column, 'Backlog');
  assert.equal(record.checked, false);
  assert.equal(record.rawText, '- [ ] Save to mind improvements #p3 #you');
  assert.equal(record.title, 'Save to mind improvements #p3 #you');
  assert.deepEqual(record.tags, ['#p3', '#you']);
  assert.equal(record.completedAt, null);
  assert.equal(record.subtasks.length, 2);
  assert.equal(record.subtasks[0]?.rawText, '  - [x] Normalize producer tags output ✅ 2026-06-10');
  assert.equal(record.subtasks[0]?.checked, true);
  assert.equal(record.subtasks[0]?.completedAt, '2026-06-10');
  assert.deepEqual(record.subtasks[1]?.tags, ['#p2']);
  assert.equal(record.lossless.rawTextPreserved, true);
  assert.equal(record.lossless.sourceLinePreserved, true);
  assert.equal(record.lossless.columnPreserved, true);
  assert.equal(record.lossless.subtaskRawTextPreserved, true);
  assert.equal(report.safety.writesKanban, false);
  assert.equal(report.safety.createsDurableTaskFiles, false);
});

test('canonical task record IDs are stable for identical exporter data', () => {
  const first = defineLosslessCanonicalTaskRecords(fixtureExport());
  const second = defineLosslessCanonicalTaskRecords(fixtureExport());

  assert.equal(first.records[0]?.id, second.records[0]?.id);
});

test('canonical task record definition blocks malformed exporter cards', () => {
  const report = defineLosslessCanonicalTaskRecords({
    source: 'kanban.md',
    cards: [
      {
        column: '',
        line: 0,
        checked: false,
        title: '',
        raw: '',
        tags: [],
        completedAt: null,
        subtasks: [
          {
            line: 0,
            checked: false,
            title: '',
            raw: '',
            tags: [],
            completedAt: null,
          },
        ],
      },
    ],
  });

  assert.equal(report.status, 'blocked');
  assert.equal(report.records.length, 0);
  assert(report.blockers.includes('cardSourceLineRequired:0'));
  assert(report.blockers.includes('cardRawTextRequired:0'));
  assert(report.blockers.includes('cardColumnRequired:0'));
  assert(report.blockers.includes('subtaskSourceLineRequired:0:0'));
  assert(report.blockers.includes('subtaskRawTextRequired:0:0'));
});

test('canonical task record definition blocks non-kanban sources', () => {
  const exportData = fixtureExport();
  const report = defineLosslessCanonicalTaskRecords({
    ...exportData,
    source: 'live/tasks.md',
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('kanbanSourceRequired'));
  assert.equal(report.safety.replacesKanbanSourceOfTruth, false);
});
