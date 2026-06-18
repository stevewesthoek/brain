import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateKanbanRoundTripFixture } from '../adapters/mind-steward-kanban-round-trip-fixture.js';

function roundTripFixture() {
  return {
    source: 'kanban.md',
    columns: [
      { name: 'Backlog', cardCount: 1 },
      { name: 'Done', cardCount: 1 },
    ],
    pluginSettingsRaw: `%% kanban:settings
\`\`\`
{"kanban-plugin":"board"}
\`\`\`
%%`,
    cards: [
      {
        column: 'Backlog',
        line: 4,
        checked: false,
        title: 'Save to mind improvements #p3 #you',
        raw: '- [ ] Save to mind improvements #p3 #you',
        tags: ['#p3', '#you'],
        completedAt: null,
        subtasks: [
          {
            line: 5,
            checked: true,
            title: 'Normalize producer tags output ✅ 2026-06-10',
            raw: '  - [x] Normalize producer tags output ✅ 2026-06-10',
            tags: [],
            completedAt: '2026-06-10',
          },
          {
            line: 6,
            checked: false,
            title: 'Add lightweight regression check #p2',
            raw: '  - [ ] Add lightweight regression check #p2',
            tags: ['#p2'],
            completedAt: null,
          },
        ],
      },
      {
        column: 'Done',
        line: 10,
        checked: true,
        title: 'Ship Save to Mind deployment ✅ 2026-06-01',
        raw: '- [x] Ship Save to Mind deployment ✅ 2026-06-01',
        tags: [],
        completedAt: '2026-06-01',
        subtasks: [],
      },
    ],
  };
}

test('fixture Kanban round-trip preserves counts, fields, subtasks, dates, tags, and plugin settings', () => {
  const report = validateKanbanRoundTripFixture(roundTripFixture());

  assert.equal(report.status, 'ready');
  assert.deepEqual(report.sourceTotals, { columns: 2, cards: 2, subtasks: 2 });
  assert.deepEqual(report.candidateTotals, report.sourceTotals);
  assert(report.checks.every(check => check.status === 'pass'));
  assert.match(report.candidateMarkdown ?? '', /%% kanban:settings/);
  assert.match(report.candidateMarkdown ?? '', /Normalize producer tags output/);
  assert.equal(report.safety.fixtureOnly, true);
  assert.equal(report.safety.writesKanban, false);
  assert.equal(report.safety.touchesRealKanban, false);
  assert.equal(report.safety.requiresApprovalBeforeRealWrite, true);
});

test('fixture Kanban round-trip blocks malformed canonical input before rendering', () => {
  const fixture = roundTripFixture();
  const firstCard = fixture.cards[0];
  assert(firstCard);
  const report = validateKanbanRoundTripFixture({
    ...fixture,
    cards: [
      {
        ...firstCard,
        line: 0,
        raw: '',
      },
    ],
  });

  assert.equal(report.status, 'blocked');
  assert.equal(report.candidateMarkdown, null);
  assert(report.blockers.includes('cardSourceLineRequired:0'));
  assert(report.blockers.includes('cardRawTextRequired:0'));
});

test('fixture Kanban round-trip blocks source column count mismatches', () => {
  const fixture = roundTripFixture();
  const report = validateKanbanRoundTripFixture({
    ...fixture,
    columns: [
      { name: 'Backlog', cardCount: 2 },
      { name: 'Done', cardCount: 1 },
    ],
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('roundTripColumnCountsMismatch'));
  assert.equal(report.checks.find(check => check.name === 'column-counts-preserved')?.status, 'blocked');
  assert.equal(report.safety.writesToMind, false);
});
