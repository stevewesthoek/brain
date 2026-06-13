import type { LoadedMindMaintenancePilotFile } from './pilot-file-loader.js';
import type { MaintenanceFinding, MaintenanceRisk } from './types.js';

interface FreshnessMetadata {
  status: string | null;
  lastReviewed: string | null;
  reviewAfter: string | null;
  freshnessRisk: string | null;
}

function normalizeMetadataKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function stripMetadataValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function parseMetadataLines(content: string): Map<string, string> {
  const metadata = new Map<string, string>();
  const lines = content.split(/\r?\n/);
  const startsWithFrontmatter = lines[0]?.trim() === '---';
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

    const match = /^\s*([A-Za-z][A-Za-z _-]*):\s*(.*?)\s*$/.exec(line);
    if (!match) continue;

    const key = normalizeMetadataKey(match[1] ?? '');
    const value = stripMetadataValue(match[2] ?? '');
    if (key && value && !metadata.has(key)) metadata.set(key, value);
  }

  return metadata;
}

function readFreshnessMetadata(content: string): FreshnessMetadata {
  const metadata = parseMetadataLines(content);
  return {
    status: metadata.get('status') ?? null,
    lastReviewed: metadata.get('last_reviewed') ?? null,
    reviewAfter: metadata.get('review_after') ?? null,
    freshnessRisk: metadata.get('freshness_risk') ?? null,
  };
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function compareIsoDates(left: string, right: string): number {
  return left.localeCompare(right);
}

function normalizeRisk(value: string | null): MaintenanceRisk {
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  return 'medium';
}

function findingIdForPath(path: string): string {
  const slug = path
    .replace(/\.md$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `finding-stale-page-${slug}-001`;
}

export interface StalePageDetectionInput {
  file: LoadedMindMaintenancePilotFile;
  reportDate: string;
}

export function detectStalePageFinding(input: StalePageDetectionInput): MaintenanceFinding | null {
  const { file, reportDate } = input;
  if (!isIsoDate(reportDate)) {
    throw new Error(`Stale-page detector requires an ISO report date: ${reportDate}`);
  }

  const metadata = readFreshnessMetadata(file.content);
  if (!metadata.reviewAfter || !isIsoDate(metadata.reviewAfter)) return null;
  if (compareIsoDates(reportDate, metadata.reviewAfter) <= 0) return null;

  const statusDetail = metadata.status ? `The page is marked ${metadata.status} and ` : 'The page ';
  const lastReviewedDetail = metadata.lastReviewed
    ? ` It was last reviewed on ${metadata.lastReviewed}.`
    : '';

  return {
    id: findingIdForPath(file.path),
    type: 'stale-page',
    status: 'open',
    created: reportDate,
    sourceRepo: 'mind',
    scope: file.path === 'router/00-current-context.md' ? 'system' : 'page',
    paths: [file.path],
    trigger: 'review_after date has passed',
    matchedEvidence: [
      {
        path: file.path,
        location: 'freshness metadata',
        summary: `${statusDetail}review_after is ${metadata.reviewAfter}, earlier than the report date.${lastReviewedDetail}`,
      },
    ],
    comparisonEvidence: [],
    uncertainty:
      'The elapsed review date shows that review is due; it does not show that any statement on the page is incorrect.',
    confidence: 0.98,
    risk: normalizeRisk(metadata.freshnessRisk),
    recommendedAction:
      'Review the page and either confirm it as current or update only the sections that no longer match present reality.',
    requiresApproval: true,
    noWritePerformed: true,
    deduplicationKey: `stale-page:${file.path}:review_after`,
    suppressionUntil: null,
    review: null,
  };
}
