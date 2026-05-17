import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreMindPreviewDetail, BrainCoreMindPreviewSummary } from '../types/api.js';

const DEFAULT_RELATIVE_PREVIEW_ROOT = 'runtime/local/model-router/previews';
const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', 'mind'];

export function listMindPreviewSummaries(): BrainCoreMindPreviewSummary[] {
  const root = resolveSafePreviewRoot();
  if (!root || !fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith('.json'))
    .map((entry) => readPreview(path.join(root, entry.name), new Date()))
    .filter((preview): preview is BrainCoreMindPreviewSummary => preview !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function readLatestMindPreviewDetail(): BrainCoreMindPreviewDetail | undefined {
  const summaries = listMindPreviewSummaries();
  if (summaries.length === 0) return undefined;
  return readMindPreviewDetail(summaries[0]!.id) ?? undefined;
}

export function readMindPreviewDetailById(id: string): BrainCoreMindPreviewDetail | undefined {
  return readMindPreviewDetail(id);
}

function readMindPreviewDetail(id: string): BrainCoreMindPreviewDetail | undefined {
  const root = resolveSafePreviewRoot();
  if (!root || !fs.existsSync(root)) return undefined;
  const filePath = path.join(root, `${id}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<BrainCoreMindPreviewDetail>;
    if (
      !parsed.id ||
      !parsed.actionKind ||
      !parsed.targetPath ||
      !parsed.createdAt ||
      !parsed.expiresAt ||
      typeof parsed.allowedRoot !== 'boolean' ||
      typeof parsed.blockedRoot !== 'boolean'
    ) {
      return undefined;
    }
    return {
      id: parsed.id,
      actionKind: parsed.actionKind,
      targetPath: parsed.targetPath,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      expired: Date.parse(parsed.expiresAt) <= Date.now(),
      allowedRoot: parsed.allowedRoot,
      blockedRoot: parsed.blockedRoot,
      writesToMind: false,
      externalSideEffects: false,
      operation: parsed.operation ?? 'overwrite',
      oldHash: parsed.oldHash ?? null,
      newHash: parsed.newHash ?? '',
      lineCountBefore: parsed.lineCountBefore ?? 0,
      lineCountAfter: parsed.lineCountAfter ?? 0,
      maxLines: typeof parsed.maxLines === 'number' ? parsed.maxLines : null,
      unifiedDiff: parsed.unifiedDiff ?? '',
      policyReasons: Array.isArray(parsed.policyReasons) ? parsed.policyReasons.filter((reason): reason is string => typeof reason === 'string') : [],
    };
  } catch {
    return undefined;
  }
}

function readPreview(filePath: string, now: Date): BrainCoreMindPreviewSummary | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<BrainCoreMindPreviewDetail>;
    if (
      !parsed.id ||
      !parsed.actionKind ||
      !parsed.targetPath ||
      !parsed.createdAt ||
      !parsed.expiresAt ||
      typeof parsed.allowedRoot !== 'boolean' ||
      typeof parsed.blockedRoot !== 'boolean'
    ) {
      return null;
    }
    return {
      id: parsed.id,
      actionKind: parsed.actionKind,
      targetPath: parsed.targetPath,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      expired: Date.parse(parsed.expiresAt) <= now.getTime(),
      allowedRoot: parsed.allowedRoot,
      blockedRoot: parsed.blockedRoot,
      writesToMind: false,
      externalSideEffects: false,
    };
  } catch {
    return null;
  }
}

function resolveSafePreviewRoot(): string | undefined {
  const configured = process.env.BRAIN_CORE_MODEL_ROUTER_PREVIEW_PATH ?? path.resolve(process.cwd(), DEFAULT_RELATIVE_PREVIEW_ROOT);
  const normalized = configured.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  if (segments.some((segment) => DISALLOWED_SEGMENTS.includes(segment))) {
    return undefined;
  }
  return path.resolve(configured);
}
