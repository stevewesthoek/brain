import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  MIND_MAINTENANCE_PILOT_FILES,
  MIND_MAINTENANCE_REPORT_OUTPUTS,
} from '../mind-maintenance-pilot/pilot-file-loader.js';
import { MIND_STRUCTURE_COMPATIBILITY_GROUPS } from '../mind-paths.js';

export const MIND_STRUCTURE_VALIDATION_SCHEMA_VERSION = '1.0';
export const MIND_STRUCTURE_VALIDATION_MODE = 'report-only';

export type MindStructureCheckStatus = 'pass' | 'warn' | 'fail';
export type MindStructurePathKind = 'file' | 'directory';

export interface MindStructureRequiredPath {
  path: string;
  kind: MindStructurePathKind;
  purpose: string;
}

export interface MindStructureValidationCheck {
  id: string;
  status: MindStructureCheckStatus;
  category:
    | 'required-path'
    | 'maintenance-pilot-path'
    | 'report-output'
    | 'freshness-metadata'
    | 'graphify-output'
    | 'runtime-truth-boundary';
  message: string;
  path: string | null;
  recommendation: string | null;
}

export interface MindStructureValidationReport {
  schemaVersion: typeof MIND_STRUCTURE_VALIDATION_SCHEMA_VERSION;
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  mode: typeof MIND_STRUCTURE_VALIDATION_MODE;
  sourceRepo: 'mind';
  mindRoot: string;
  status: MindStructureCheckStatus;
  summary: {
    pass: number;
    warn: number;
    fail: number;
    total: number;
  };
  checks: MindStructureValidationCheck[];
  safety: {
    noWritePerformed: true;
    sourceFilesChanged: 0;
    reportOnly: true;
  };
}

export interface BuildMindStructureValidationReportInput {
  mindRoot: string;
  generatedAt?: string;
  generatedBy?: string;
}

export const REQUIRED_MIND_STRUCTURE_PATHS: readonly MindStructureRequiredPath[] = [
  { path: 'home.md', kind: 'file', purpose: 'primary human user manual and navigation entry point' },
] as const;

const FRESHNESS_SCAN_PATHS = [
  'router/00-current-context.md',
  ...MIND_MAINTENANCE_PILOT_FILES,
] as const;

const FRESHNESS_KEYS = new Set(['status', 'last_reviewed', 'review_after', 'freshness_risk']);
const RISK_LEVELS = new Set(['low', 'medium', 'high']);

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function assertAbsoluteMindRoot(mindRoot: string): string {
  if (!path.isAbsolute(mindRoot)) {
    throw new Error('Mind structure validator requires an absolute Mind repository root.');
  }
  return path.resolve(mindRoot);
}

function resolveMindPath(mindRoot: string, relativePath: string): string {
  const absolutePath = path.resolve(mindRoot, relativePath);
  const relativeFromRoot = path.relative(mindRoot, absolutePath);

  if (
    relativeFromRoot.startsWith('..')
    || path.isAbsolute(relativeFromRoot)
    || relativeFromRoot.split(path.sep).includes('..')
  ) {
    throw new Error(`Mind structure validator path escapes the repository root: ${relativePath}`);
  }

  return absolutePath;
}

async function pathKind(mindRoot: string, relativePath: string): Promise<MindStructurePathKind | null> {
  try {
    const stats = await stat(resolveMindPath(mindRoot, relativePath));
    if (stats.isDirectory()) return 'directory';
    if (stats.isFile()) return 'file';
    return null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readTextIfPresent(mindRoot: string, relativePath: string): Promise<string | null> {
  try {
    return await readFile(resolveMindPath(mindRoot, relativePath), 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function check(
  id: string,
  status: MindStructureCheckStatus,
  category: MindStructureValidationCheck['category'],
  message: string,
  relativePath: string | null = null,
  recommendation: string | null = null,
): MindStructureValidationCheck {
  return {
    id,
    status,
    category,
    message,
    path: relativePath,
    recommendation,
  };
}

function extractFreshnessMetadata(content: string): Map<string, string> {
  const metadata = new Map<string, string>();
  const lines = content.split(/\r?\n/).slice(0, 120);
  const frontmatter = lines[0]?.trim() === '---';
  let inYamlFence = false;

  for (let index = frontmatter ? 1 : 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();

    if (frontmatter && index > 0 && trimmed === '---') break;

    if (/^```(?:ya?ml)?$/i.test(trimmed)) {
      inYamlFence = true;
      continue;
    }

    if (trimmed === '```' && inYamlFence) {
      inYamlFence = false;
      continue;
    }

    const match = line.match(/^\s*([A-Za-z][A-Za-z _-]*):\s*(.*?)\s*$/);
    if (!match) continue;

    const rawKey = match[1];
    const rawValue = match[2];
    if (rawKey === undefined || rawValue === undefined) continue;

    const key = normalizeKey(rawKey);
    if (!FRESHNESS_KEYS.has(key)) continue;

    const value = rawValue.trim().replace(/^["']|["']$/g, '');
    if (!metadata.has(key)) metadata.set(key, value);
  }

  return metadata;
}

async function checkRequiredPaths(mindRoot: string): Promise<MindStructureValidationCheck[]> {
  const checks: MindStructureValidationCheck[] = [];

  for (const requiredPath of REQUIRED_MIND_STRUCTURE_PATHS) {
    const actualKind = await pathKind(mindRoot, requiredPath.path);

    if (actualKind === requiredPath.kind) {
      checks.push(check(
        `required-path:${requiredPath.path}`,
        'pass',
        'required-path',
        `Required ${requiredPath.kind} exists for ${requiredPath.purpose}.`,
        requiredPath.path,
        null,
      ));
      continue;
    }

    checks.push(check(
      `required-path:${requiredPath.path}`,
      'fail',
      'required-path',
      actualKind === null
        ? `Required ${requiredPath.kind} is missing.`
        : `Required path exists but is a ${actualKind}, not a ${requiredPath.kind}.`,
      requiredPath.path,
      `Restore or intentionally migrate ${requiredPath.path} before relying on Infinite Brain workflows.`,
    ));
  }

  return checks;
}

async function checkCompatibilityGroups(mindRoot: string): Promise<MindStructureValidationCheck[]> {
  const checks: MindStructureValidationCheck[] = [];

  for (const group of MIND_STRUCTURE_COMPATIBILITY_GROUPS) {
    const found: Array<{ path: string; era: 'target' | 'legacy-fallback' }> = [];
    for (const candidate of group.candidates) {
      const actualKind = await pathKind(mindRoot, candidate.path);
      if (actualKind === candidate.kind) {
        found.push({ path: candidate.path, era: candidate.era });
      }
    }

    const targetFound = found.find(item => item.era === 'target');
    const fallbackFound = found.find(item => item.era === 'legacy-fallback');
    if (targetFound) {
      checks.push(check(
        `required-path:${group.id}`,
        'pass',
        'required-path',
        `Target Mind structure path exists for ${group.purpose}.`,
        targetFound.path,
        null,
      ));
      continue;
    }

    if (fallbackFound) {
      checks.push(check(
        `required-path:${group.id}`,
        'warn',
        'required-path',
        `Legacy fallback exists for ${group.purpose}; target path is not active yet.`,
        fallbackFound.path,
        `Create or migrate to ${group.candidates[0]?.path ?? group.id} before removing legacy path support.`,
      ));
      continue;
    }

    checks.push(check(
      `required-path:${group.id}`,
      'warn',
      'required-path',
      `Target path is not active yet for ${group.purpose}, and no legacy fallback exists.`,
      group.candidates[0]?.path ?? null,
      `Create ${group.candidates[0]?.path ?? group.id} during the approved Mind folder migration before removing compatibility mode.`,
    ));
  }

  return checks;
}

async function checkMaintenancePilotPaths(mindRoot: string): Promise<MindStructureValidationCheck[]> {
  const checks: MindStructureValidationCheck[] = [];

  for (const pilotPath of MIND_MAINTENANCE_PILOT_FILES) {
    const actualKind = await pathKind(mindRoot, pilotPath);

    checks.push(check(
      `maintenance-pilot-path:${pilotPath}`,
      actualKind === 'file' ? 'pass' : 'fail',
      'maintenance-pilot-path',
      actualKind === 'file'
        ? 'Maintenance pilot configured path exists.'
        : 'Maintenance pilot configured path is missing or is not a file.',
      pilotPath,
      actualKind === 'file'
        ? null
        : 'Update the Brain maintenance pilot configuration or restore/migrate the real Mind file path.',
    ));
  }

  return checks;
}

async function checkReportOutputs(mindRoot: string): Promise<MindStructureValidationCheck[]> {
  const checks: MindStructureValidationCheck[] = [];
  const [jsonPath, markdownPath] = MIND_MAINTENANCE_REPORT_OUTPUTS;

  if (jsonPath === undefined || markdownPath === undefined) {
    throw new Error('Mind maintenance report output configuration is incomplete.');
  }

  const jsonContent = await readTextIfPresent(mindRoot, jsonPath);
  if (jsonContent === null) {
    checks.push(check(
      `report-output:${jsonPath}`,
      'fail',
      'report-output',
      'Latest maintenance JSON report is missing.',
      jsonPath,
      'Run the canonical report-only maintenance pilot before relying on maintenance status.',
    ));
  } else {
    try {
      JSON.parse(jsonContent) as unknown;
      checks.push(check(
        `report-output:${jsonPath}`,
        'pass',
        'report-output',
        'Latest maintenance JSON report exists and is parseable.',
        jsonPath,
        null,
      ));
    } catch {
      checks.push(check(
        `report-output:${jsonPath}`,
        'fail',
        'report-output',
        'Latest maintenance JSON report exists but is not valid JSON.',
        jsonPath,
        'Regenerate the report with the canonical report-only maintenance pilot.',
      ));
    }
  }

  const markdownContent = await readTextIfPresent(mindRoot, markdownPath);
  checks.push(check(
    `report-output:${markdownPath}`,
    markdownContent !== null && markdownContent.trim().length > 0 ? 'pass' : 'fail',
    'report-output',
    markdownContent !== null && markdownContent.trim().length > 0
      ? 'Latest maintenance Markdown report exists and is non-empty.'
      : 'Latest maintenance Markdown report is missing or empty.',
    markdownPath,
    markdownContent !== null && markdownContent.trim().length > 0
      ? null
      : 'Regenerate the report with the canonical report-only maintenance pilot.',
  ));

  return checks;
}

async function checkFreshnessMetadata(mindRoot: string): Promise<MindStructureValidationCheck[]> {
  const checks: MindStructureValidationCheck[] = [];
  const uniquePaths = [...new Set(FRESHNESS_SCAN_PATHS)];

  for (const relativePath of uniquePaths) {
    const content = await readTextIfPresent(mindRoot, relativePath);
    if (content === null) continue;

    const metadata = extractFreshnessMetadata(content);
    if (metadata.size === 0) {
      checks.push(check(
        `freshness-metadata:${relativePath}`,
        'pass',
        'freshness-metadata',
        'No freshness metadata present; nothing to validate.',
        relativePath,
        null,
      ));
      continue;
    }

    const issues: string[] = [];
    const lastReviewed = metadata.get('last_reviewed');
    const reviewAfter = metadata.get('review_after');
    const freshnessRisk = metadata.get('freshness_risk');

    if (lastReviewed !== undefined && !isIsoDate(lastReviewed)) {
      issues.push('last_reviewed must be YYYY-MM-DD');
    }

    if (reviewAfter !== undefined && !isIsoDate(reviewAfter)) {
      issues.push('review_after must be YYYY-MM-DD');
    }

    if (freshnessRisk !== undefined && !RISK_LEVELS.has(freshnessRisk)) {
      issues.push('freshness_risk must be low, medium, or high');
    }

    checks.push(check(
      `freshness-metadata:${relativePath}`,
      issues.length === 0 ? 'pass' : 'fail',
      'freshness-metadata',
      issues.length === 0
        ? 'Freshness metadata is parseable where present.'
        : `Freshness metadata is present but invalid: ${issues.join('; ')}.`,
      relativePath,
      issues.length === 0
        ? null
        : 'Fix the metadata block before relying on freshness or stale-page detection.',
    ));
  }

  return checks;
}

async function checkGraphifyOutputPath(mindRoot: string): Promise<MindStructureValidationCheck[]> {
  const graphifyOutKind = await pathKind(mindRoot, 'graphify-out');
  const legacyGraphifyOutKind = await pathKind(mindRoot, '.graphify-out');

  if (graphifyOutKind !== null && legacyGraphifyOutKind !== null) {
    return [check(
      'graphify-output:path-consistency',
      'fail',
      'graphify-output',
      'Both graphify-out/ and .graphify-out/ exist, so generated graph output naming is ambiguous.',
      null,
      'Choose the actual configured output path and update contracts/configuration before refreshing Graphify.',
    )];
  }

  if (legacyGraphifyOutKind !== null) {
    return [check(
      'graphify-output:path-consistency',
      'warn',
      'graphify-output',
      'Legacy .graphify-out/ exists without graphify-out/.',
      '.graphify-out',
      'Confirm whether Graphify still writes the legacy path or migrate docs/config to graphify-out/.',
    )];
  }

  if (graphifyOutKind !== null) {
    return [check(
      'graphify-output:path-consistency',
      'pass',
      'graphify-output',
      'Graphify generated output uses graphify-out/.',
      'graphify-out',
      null,
    )];
  }

  return [check(
    'graphify-output:path-consistency',
    'warn',
    'graphify-output',
    'No Graphify output folder was found.',
    null,
    'Generate Graphify output only when needed; keep generated output separate from durable Mind truth.',
  )];
}

function checkRuntimeTruthBoundary(): MindStructureValidationCheck[] {
  return [check(
    'runtime-truth-boundary:generated-paths-outside-required-surfaces',
    'pass',
    'runtime-truth-boundary',
    'Known generated/runtime output paths are not part of the required Mind startup surfaces or maintenance pilot dataset.',
    null,
    null,
  )];
}

function summarize(checks: readonly MindStructureValidationCheck[]): MindStructureValidationReport['summary'] {
  const summary = { pass: 0, warn: 0, fail: 0, total: checks.length };

  for (const item of checks) {
    summary[item.status] += 1;
  }

  return summary;
}

function statusFromSummary(summary: MindStructureValidationReport['summary']): MindStructureCheckStatus {
  if (summary.fail > 0) return 'fail';
  if (summary.warn > 0) return 'warn';
  return 'pass';
}

export async function buildMindStructureValidationReport(
  input: BuildMindStructureValidationReportInput,
): Promise<MindStructureValidationReport> {
  const mindRoot = assertAbsoluteMindRoot(input.mindRoot);
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const generatedBy = input.generatedBy ?? 'brain-core mind-structure-validator';

  const checks = [
    ...(await checkRequiredPaths(mindRoot)),
    ...(await checkCompatibilityGroups(mindRoot)),
    ...(await checkMaintenancePilotPaths(mindRoot)),
    ...(await checkReportOutputs(mindRoot)),
    ...(await checkFreshnessMetadata(mindRoot)),
    ...(await checkGraphifyOutputPath(mindRoot)),
    ...checkRuntimeTruthBoundary(),
  ];
  const summary = summarize(checks);

  return {
    schemaVersion: MIND_STRUCTURE_VALIDATION_SCHEMA_VERSION,
    reportId: `mind-structure-${generatedAt.replace(/[-:.]/g, '').replace(/Z$/, 'Z')}`,
    generatedAt,
    generatedBy,
    mode: MIND_STRUCTURE_VALIDATION_MODE,
    sourceRepo: 'mind',
    mindRoot,
    status: statusFromSummary(summary),
    summary,
    checks,
    safety: {
      noWritePerformed: true,
      sourceFilesChanged: 0,
      reportOnly: true,
    },
  };
}
