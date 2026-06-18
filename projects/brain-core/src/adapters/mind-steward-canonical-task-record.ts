/**
 * Lossless canonical task record candidate for Kanban round-trip validation.
 * This does not create durable task files or replace kanban.md.
 */

import crypto from 'node:crypto';

export interface KanbanExporterCard {
  column: string;
  line: number;
  checked: boolean;
  title: string;
  raw: string;
  tags: string[];
  completedAt: string | null;
  subtasks: Array<{
    line: number;
    checked: boolean;
    title: string;
    raw: string;
    tags: string[];
    completedAt: string | null;
  }>;
}

export interface KanbanExporterData {
  source: string;
  cards: KanbanExporterCard[];
}

export interface MindStewardCanonicalSubtaskRecord {
  sourceLine: number;
  checked: boolean;
  rawText: string;
  title: string;
  tags: string[];
  completedAt: string | null;
}

export interface MindStewardCanonicalTaskRecord {
  id: string;
  source: 'kanban.md';
  sourceLine: number;
  status: string;
  column: string;
  checked: boolean;
  rawText: string;
  title: string;
  tags: string[];
  priority: null;
  owner: null;
  completedAt: string | null;
  createdAt: null;
  updatedAt: null;
  subtasks: MindStewardCanonicalSubtaskRecord[];
  links: string[];
  notes: null;
  lossless: {
    rawTextPreserved: true;
    sourceLinePreserved: true;
    columnPreserved: true;
    subtaskRawTextPreserved: true;
  };
}

export interface MindStewardCanonicalTaskRecordReport {
  status: 'ready' | 'blocked';
  source: string | null;
  records: MindStewardCanonicalTaskRecord[];
  blockers: string[];
  purpose: 'round-trip-validation-only';
  safety: {
    writesToMind: false;
    writesKanban: false;
    createsDurableTaskFiles: false;
    replacesKanbanSourceOfTruth: false;
  };
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function validLine(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateCard(card: KanbanExporterCard, index: number): string[] {
  const blockers: string[] = [];
  if (!validLine(card.line)) blockers.push(`cardSourceLineRequired:${index}`);
  if (typeof card.raw !== 'string' || card.raw.length === 0) blockers.push(`cardRawTextRequired:${index}`);
  if (typeof card.title !== 'string') blockers.push(`cardTitleRequired:${index}`);
  if (typeof card.column !== 'string' || card.column.trim().length === 0) blockers.push(`cardColumnRequired:${index}`);
  for (const [subtaskIndex, subtask] of card.subtasks.entries()) {
    if (!validLine(subtask.line)) blockers.push(`subtaskSourceLineRequired:${index}:${subtaskIndex}`);
    if (typeof subtask.raw !== 'string' || subtask.raw.length === 0) blockers.push(`subtaskRawTextRequired:${index}:${subtaskIndex}`);
    if (typeof subtask.title !== 'string') blockers.push(`subtaskTitleRequired:${index}:${subtaskIndex}`);
  }
  return blockers;
}

function recordId(card: KanbanExporterCard): string {
  return `task-${sha256(JSON.stringify({
    source: 'kanban.md',
    column: card.column,
    line: card.line,
    raw: card.raw,
  })).slice(0, 16)}`;
}

function toRecord(card: KanbanExporterCard): MindStewardCanonicalTaskRecord {
  return {
    id: recordId(card),
    source: 'kanban.md',
    sourceLine: card.line,
    status: card.column,
    column: card.column,
    checked: card.checked,
    rawText: card.raw,
    title: card.title,
    tags: [...card.tags],
    priority: null,
    owner: null,
    completedAt: card.completedAt,
    createdAt: null,
    updatedAt: null,
    subtasks: card.subtasks.map(subtask => ({
      sourceLine: subtask.line,
      checked: subtask.checked,
      rawText: subtask.raw,
      title: subtask.title,
      tags: [...subtask.tags],
      completedAt: subtask.completedAt,
    })),
    links: [],
    notes: null,
    lossless: {
      rawTextPreserved: true,
      sourceLinePreserved: true,
      columnPreserved: true,
      subtaskRawTextPreserved: true,
    },
  };
}

export function defineLosslessCanonicalTaskRecords(
  exportData: KanbanExporterData,
): MindStewardCanonicalTaskRecordReport {
  const blockers: string[] = [];
  if (exportData.source !== 'kanban.md') blockers.push('kanbanSourceRequired');
  for (const [index, card] of exportData.cards.entries()) {
    blockers.push(...validateCard(card, index));
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    source: exportData.source ?? null,
    records: blockers.length === 0 ? exportData.cards.map(toRecord) : [],
    blockers,
    purpose: 'round-trip-validation-only',
    safety: {
      writesToMind: false,
      writesKanban: false,
      createsDurableTaskFiles: false,
      replacesKanbanSourceOfTruth: false,
    },
  };
}
