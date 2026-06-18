import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MIND_ROOT = path.resolve(process.cwd(), '..', '..', '..', 'mind');
const EXPORTER = path.join(MIND_ROOT, 'tools', 'export-kanban-tasks.mjs');
const KANBAN = path.join(MIND_ROOT, 'kanban.md');

test('existing Mind Kanban exporter emits structured JSON without modifying kanban.md', () => {
  assert.equal(existsSync(EXPORTER), true);
  assert.equal(existsSync(KANBAN), true);
  const before = readFileSync(KANBAN, 'utf8');

  const output = execFileSync('node', [EXPORTER], {
    cwd: MIND_ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const after = readFileSync(KANBAN, 'utf8');
  const parsed = JSON.parse(output) as {
    source: string;
    totals: { columns: number; cards: number; subtasks: number };
    columns: Array<{ name: string; cardCount: number }>;
    cards: Array<{ column: string; title: string; raw: string; subtasks: unknown[] }>;
  };

  assert.equal(after, before);
  assert.equal(parsed.source, 'kanban.md');
  assert(parsed.totals.columns > 0);
  assert(parsed.totals.cards >= 0);
  assert.equal(parsed.columns.reduce((total, column) => total + column.cardCount, 0), parsed.cards.length);
  assert.equal(parsed.totals.cards, parsed.cards.length);
  assert.equal(parsed.totals.subtasks, parsed.cards.reduce((total, card) => total + card.subtasks.length, 0));
  for (const card of parsed.cards) {
    assert.equal(typeof card.raw, 'string');
    assert.equal(typeof card.title, 'string');
    assert(parsed.columns.some(column => column.name === card.column));
  }
});

test('existing Mind Kanban exporter emits Markdown summary without modifying kanban.md', () => {
  const before = readFileSync(KANBAN, 'utf8');

  const output = execFileSync('node', [EXPORTER, '--markdown'], {
    cwd: MIND_ROOT,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  const after = readFileSync(KANBAN, 'utf8');

  assert.equal(after, before);
  assert.match(output, /^# Kanban Export/m);
  assert.match(output, /## Totals/);
  assert.match(output, /- Columns:/);
});

test('existing Mind Kanban exporter help documents stdout as default', () => {
  const before = readFileSync(KANBAN, 'utf8');
  const output = execFileSync('node', [EXPORTER, '--help'], {
    cwd: MIND_ROOT,
    encoding: 'utf8',
  });
  const after = readFileSync(KANBAN, 'utf8');

  assert.equal(after, before);
  assert.match(output, /Default behavior prints JSON to stdout/);
  assert.match(output, /--write/);
});
