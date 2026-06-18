/**
 * Fixture-only Kanban round-trip validation.
 * Converts exported Kanban fixture data to canonical records, renders an
 * in-memory candidate board, reparses it, and compares lossless fields.
 */

import {
  defineLosslessCanonicalTaskRecords,
  type KanbanExporterCard,
  type KanbanExporterData,
  type MindStewardCanonicalTaskRecord,
} from './mind-steward-canonical-task-record.js';

export interface KanbanRoundTripFixtureColumn {
  name: string;
  cardCount: number;
}

export interface KanbanRoundTripFixtureInput extends KanbanExporterData {
  columns: KanbanRoundTripFixtureColumn[];
  pluginSettingsRaw?: string | null;
}

export interface KanbanRoundTripFixtureReport {
  status: 'ready' | 'blocked';
  checks: Array<{
    name: string;
    status: 'pass' | 'blocked';
    detail: string;
  }>;
  sourceTotals: {
    columns: number;
    cards: number;
    subtasks: number;
  };
  candidateTotals: {
    columns: number;
    cards: number;
    subtasks: number;
  };
  candidateMarkdown: string | null;
  blockers: string[];
  safety: {
    fixtureOnly: true;
    writesToMind: false;
    writesKanban: false;
    touchesRealKanban: false;
    requiresApprovalBeforeRealWrite: true;
  };
}

function renderRecordsToMarkdown(
  columns: KanbanRoundTripFixtureColumn[],
  records: MindStewardCanonicalTaskRecord[],
  pluginSettingsRaw: string | null,
): string {
  const lines: string[] = ['# Kanban', ''];
  for (const column of columns) {
    lines.push(`## ${column.name}`, '');
    for (const record of records.filter(item => item.column === column.name)) {
      lines.push(record.rawText);
      for (const subtask of record.subtasks) {
        lines.push(subtask.rawText);
      }
    }
    lines.push('');
  }
  if (pluginSettingsRaw) {
    lines.push(pluginSettingsRaw.trimEnd(), '');
  }
  return `${lines.join('\n')}`;
}

function parseRenderedKanban(markdown: string): { columns: KanbanRoundTripFixtureColumn[]; cards: KanbanExporterCard[] } {
  const lines = markdown.split(/\r?\n/);
  const columns: Array<KanbanRoundTripFixtureColumn & { cards: KanbanExporterCard[] }> = [];
  let currentColumn: (KanbanRoundTripFixtureColumn & { cards: KanbanExporterCard[] }) | null = null;
  let currentCard: KanbanExporterCard | null = null;
  let inPluginSettings = false;
  const finishCard = (): void => {
    if (currentColumn && currentCard) {
      currentColumn.cards.push(currentCard);
      currentCard = null;
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '%% kanban:settings') {
      finishCard();
      inPluginSettings = true;
      continue;
    }
    if (inPluginSettings) continue;
    const columnMatch = /^##\s+(.+?)\s*$/.exec(line);
    if (columnMatch) {
      finishCard();
      currentColumn = { name: columnMatch[1] ?? '', cardCount: 0, cards: [] };
      columns.push(currentColumn);
      continue;
    }
    const cardMatch = /^- \[( |x|X)\]\s*(.*)$/.exec(line);
    if (cardMatch && currentColumn) {
      finishCard();
      currentCard = {
        column: currentColumn.name,
        line: index + 1,
        checked: (cardMatch[1] ?? '').toLowerCase() === 'x',
        title: (cardMatch[2] ?? '').trim(),
        raw: line,
        tags: [...line.matchAll(/#[\p{L}\p{N}_-]+/gu)].map(match => match[0]),
        completedAt: (/✅\s*(\d{4}-\d{2}-\d{2})/.exec(line) ?? [null, null])[1],
        subtasks: [],
      };
      continue;
    }
    const subtaskMatch = /^\s+- \[( |x|X)\]\s*(.*)$/.exec(line);
    if (subtaskMatch && currentCard) {
      currentCard.subtasks.push({
        line: index + 1,
        checked: (subtaskMatch[1] ?? '').toLowerCase() === 'x',
        title: (subtaskMatch[2] ?? '').trim(),
        raw: line,
        tags: [...line.matchAll(/#[\p{L}\p{N}_-]+/gu)].map(match => match[0]),
        completedAt: (/✅\s*(\d{4}-\d{2}-\d{2})/.exec(line) ?? [null, null])[1],
      });
    }
  }
  finishCard();
  return {
    columns: columns.map(column => ({ name: column.name, cardCount: column.cards.length })),
    cards: columns.flatMap(column => column.cards),
  };
}

function totals(columns: KanbanRoundTripFixtureColumn[], cards: KanbanExporterCard[]): KanbanRoundTripFixtureReport['sourceTotals'] {
  return {
    columns: columns.length,
    cards: cards.length,
    subtasks: cards.reduce((total, card) => total + card.subtasks.length, 0),
  };
}

function compareCards(sourceCards: KanbanExporterCard[], candidateCards: KanbanExporterCard[]): string[] {
  const blockers: string[] = [];
  if (sourceCards.length !== candidateCards.length) {
    blockers.push(`cardCountMismatch:${sourceCards.length}:${candidateCards.length}`);
    return blockers;
  }
  for (let index = 0; index < sourceCards.length; index += 1) {
    const source = sourceCards[index];
    const candidate = candidateCards[index];
    if (!source || !candidate) continue;
    if (source.column !== candidate.column) blockers.push(`columnMismatch:${index}`);
    if (source.raw !== candidate.raw) blockers.push(`rawTextMismatch:${index}`);
    if (source.title !== candidate.title) blockers.push(`titleMismatch:${index}`);
    if (source.checked !== candidate.checked) blockers.push(`checkedMismatch:${index}`);
    if (source.completedAt !== candidate.completedAt) blockers.push(`completedAtMismatch:${index}`);
    if (source.tags.join('\0') !== candidate.tags.join('\0')) blockers.push(`tagsMismatch:${index}`);
    if (source.subtasks.length !== candidate.subtasks.length) {
      blockers.push(`subtaskCountMismatch:${index}`);
      continue;
    }
    for (let subtaskIndex = 0; subtaskIndex < source.subtasks.length; subtaskIndex += 1) {
      const sourceSubtask = source.subtasks[subtaskIndex];
      const candidateSubtask = candidate.subtasks[subtaskIndex];
      if (!sourceSubtask || !candidateSubtask) continue;
      if (sourceSubtask.raw !== candidateSubtask.raw) blockers.push(`subtaskRawTextMismatch:${index}:${subtaskIndex}`);
      if (sourceSubtask.checked !== candidateSubtask.checked) blockers.push(`subtaskCheckedMismatch:${index}:${subtaskIndex}`);
      if (sourceSubtask.completedAt !== candidateSubtask.completedAt) blockers.push(`subtaskCompletedAtMismatch:${index}:${subtaskIndex}`);
      if (sourceSubtask.tags.join('\0') !== candidateSubtask.tags.join('\0')) blockers.push(`subtaskTagsMismatch:${index}:${subtaskIndex}`);
    }
  }
  return blockers;
}

export function validateKanbanRoundTripFixture(
  input: KanbanRoundTripFixtureInput,
): KanbanRoundTripFixtureReport {
  const canonical = defineLosslessCanonicalTaskRecords(input);
  const sourceTotals = totals(input.columns, input.cards);
  const checks: KanbanRoundTripFixtureReport['checks'] = [];
  const blockers = [...canonical.blockers];
  let candidateMarkdown: string | null = null;
  let candidateTotals = { columns: 0, cards: 0, subtasks: 0 };

  if (canonical.status === 'ready') {
    candidateMarkdown = renderRecordsToMarkdown(input.columns, canonical.records, input.pluginSettingsRaw ?? null);
    const parsed = parseRenderedKanban(candidateMarkdown);
    candidateTotals = totals(parsed.columns, parsed.cards);
    const columnCountsMatch = JSON.stringify(input.columns) === JSON.stringify(parsed.columns);
    checks.push({
      name: 'column-counts-preserved',
      status: columnCountsMatch ? 'pass' : 'blocked',
      detail: `source=${JSON.stringify(input.columns)} candidate=${JSON.stringify(parsed.columns)}`,
    });
    if (!columnCountsMatch) blockers.push('roundTripColumnCountsMismatch');
    const countMatches = JSON.stringify(sourceTotals) === JSON.stringify(candidateTotals);
    checks.push({
      name: 'counts-preserved',
      status: countMatches ? 'pass' : 'blocked',
      detail: `source=${JSON.stringify(sourceTotals)} candidate=${JSON.stringify(candidateTotals)}`,
    });
    if (!countMatches) blockers.push('roundTripCountsMismatch');
    const cardBlockers = compareCards(input.cards, parsed.cards);
    checks.push({
      name: 'card-fields-preserved',
      status: cardBlockers.length === 0 ? 'pass' : 'blocked',
      detail: cardBlockers.length === 0 ? 'all card fields match' : cardBlockers.join(', '),
    });
    blockers.push(...cardBlockers);
    if (input.pluginSettingsRaw) {
      const pluginSettingsPreserved = candidateMarkdown.includes(input.pluginSettingsRaw.trimEnd());
      checks.push({
        name: 'plugin-settings-preserved',
        status: pluginSettingsPreserved ? 'pass' : 'blocked',
        detail: pluginSettingsPreserved ? 'plugin settings copied into candidate fixture' : 'plugin settings missing from candidate fixture',
      });
      if (!pluginSettingsPreserved) blockers.push('pluginSettingsNotPreserved');
    }
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    checks,
    sourceTotals,
    candidateTotals,
    candidateMarkdown,
    blockers,
    safety: {
      fixtureOnly: true,
      writesToMind: false,
      writesKanban: false,
      touchesRealKanban: false,
      requiresApprovalBeforeRealWrite: true,
    },
  };
}
