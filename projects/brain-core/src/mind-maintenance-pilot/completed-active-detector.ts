import type { LoadedMindMaintenancePilotFile } from './pilot-file-loader.js';
import type { MaintenanceEvidence, MaintenanceFinding, MaintenanceRisk } from './types.js';

interface ParsedMetadataValue {
  key: string;
  value: string;
  line: number;
}

const ACTIVE_VALUES = new Set([
  'active',
  'current',
  'in-progress',
  'in_progress',
  'in progress',
  'ongoing',
]);

const COMPLETED_VALUES = new Set([
  'complete',
  'completed',
  'done',
  'closed',
  'cancelled',
  'canceled',
  'archived',
  'superseded',
  'replaced',
]);

const ACTIVE_KEYS = new Set([
  'status',
  'project_status',
  'lifecycle_status',
  'state',
]);

const COMPLETION_KEYS = new Set([
  'completion_status',
  'completed_status',
  'final_status',
  'resolution_status',
]);

const COMPLETION_DATE_KEYS = new Set([
  'completed',
  'completed_on',
  'completed_at',
  'completion_date',
  'closed_on',
  'closed_at',
  'archived_on',
  'archived_at',
]);

const SUPERSESSION_KEYS = new Set([
  'superseded_by',
  'replaced_by',
  'canonical_replacement',
  'archive_path',
]);

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeValue(value: string): string {
  const trimmed = value.trim();
  const unquoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1).trim()
      : trimmed;
  return unquoted.toLowerCase();
}

function parseMetadata(content: string): ParsedMetadataValue[] {
  const lines = content.split(/\r?\n/);
  const startsWithFrontmatter = lines[0]?.trim() === '---';
  const values: ParsedMetadataValue[] = [];
  let frontmatterClosed = !startsWithFrontmatter;

  for (let index = startsWithFrontmatter ? 1 : 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === undefined) continue;

    if (startsWithFrontmatter && !frontmatterClosed && line.trim() === '---') {
      frontmatterClosed = true;
      continue;
    }

    if (startsWithFrontmatter && frontmatterClosed) break;
    if (!startsWithFrontmatter && index > 40) break;

    const match = line.match(/^\s*([A-Za-z][A-Za-z _-]*):\s*(.*?)\s*$/);
    if (!match) continue;

    const key = normalizeKey(match[1] ?? '');
    const value = normalizeValue(match[2] ?? '');
    if (!key || !value) continue;

    values.push({ key, value, line: index + 1 });
  }

  return values;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function isTruthy(value: string): boolean {
  return ['true', 'yes', '1'].includes(value);
}

function normalizeRisk(file: LoadedMindMaintenancePilotFile): MaintenanceRisk {
  if (file.path === 'system/reports/dashboard.md') return 'high';
  if (file.path.startsWith('projects/')) return 'medium';
  return 'low';
}

function toEvidence(
  file: LoadedMindMaintenancePilotFile,
  metadata: ParsedMetadataValue,
  summary: string,
): MaintenanceEvidence {
  return {
    path: file.path,
    location: `metadata line ${metadata.line}`,
    summary,
  };
}

function findActiveEvidence(metadata: ParsedMetadataValue[]): ParsedMetadataValue | null {
  return metadata.find((entry) => ACTIVE_KEYS.has(entry.key) && ACTIVE_VALUES.has(entry.value)) ?? null;
}

function findCompletionEvidence(metadata: ParsedMetadataValue[]): ParsedMetadataValue | null {
  return metadata.find((entry) => {
    if (COMPLETION_KEYS.has(entry.key) && COMPLETED_VALUES.has(entry.value)) return true;
    if (COMPLETION_DATE_KEYS.has(entry.key) && (isIsoDate(entry.value) || isTruthy(entry.value))) return true;
    if (SUPERSESSION_KEYS.has(entry.key) && entry.value.length > 0) return true;
    if (entry.key === 'archived' && isTruthy(entry.value)) return true;
    return false;
  }) ?? null;
}

function completionDescription(entry: ParsedMetadataValue): string {
  if (SUPERSESSION_KEYS.has(entry.key)) {
    return `${entry.key} identifies ${entry.value} as a replacement or archive destination`;
  }
  if (COMPLETION_DATE_KEYS.has(entry.key)) {
    return `${entry.key} records ${entry.value} as completion or closure evidence`;
  }
  return `${entry.key} is set to ${entry.value}`;
}

export interface CompletedActiveDetectionInput {
  file: LoadedMindMaintenancePilotFile;
  reportDate: string;
}

export function detectCompletedActiveFinding(
  input: CompletedActiveDetectionInput,
): MaintenanceFinding | null {
  if (!isIsoDate(input.reportDate)) {
    throw new Error(`Completed-but-active detector requires an ISO report date: ${input.reportDate}`);
  }

  const metadata = parseMetadata(input.file.content);
  const activeEvidence = findActiveEvidence(metadata);
  const completionEvidence = findCompletionEvidence(metadata);

  if (!activeEvidence || !completionEvidence) return null;

  const activeSummary = `${activeEvidence.key} presents the page as ${activeEvidence.value}`;
  const completionSummary = completionDescription(completionEvidence);

  return {
    id: `finding-completed-active-${input.file.path
      .replace(/\.md$/i, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()}-001`,
    type: 'completed-but-active',
    status: 'open',
    created: input.reportDate,
    sourceRepo: 'mind',
    scope: input.file.path.startsWith('projects/') ? 'project' : 'navigation',
    paths: [input.file.path],
    trigger: 'active status conflicts with explicit completion or supersession metadata',
    matchedEvidence: [
      toEvidence(input.file, activeEvidence, activeSummary),
      toEvidence(input.file, completionEvidence, completionSummary),
    ],
    comparisonEvidence: [],
    uncertainty:
      'The metadata appears inconsistent, but ongoing maintenance or a deliberate transition state may explain why the page remains active.',
    confidence: 0.9,
    risk: normalizeRisk(input.file),
    recommendedAction:
      'Review the explicit status mismatch and decide whether to keep the page active, mark it as maintenance, update navigation, or archive it through a separately approved change.',
    requiresApproval: true,
    noWritePerformed: true,
    deduplicationKey: `completed-active:${input.file.path}:${activeEvidence.key}:${completionEvidence.key}`,
    suppressionUntil: null,
    review: null,
  };
}
