import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreMaintenancePreviewSummary, BrainCoreMaintenancePreviewDetail } from '../types/api.js';

// Type for reading queue artifacts from runtime storage
interface MindMaintenancePreviewQueue {
  queueId?: string;
  createdAt: string;
  expiresAt?: string;
  source: string;
  summary: {
    total: number;
    lowRiskCount: number;
    mediumRiskCount: number;
    highRiskCount: number;
    approvalRequiredCount: number;
  };
  actions: Array<{
    kind: string;
    title: string;
    risk: string;
  }>;
}

const DEFAULT_RELATIVE_MAINTENANCE_PREVIEW_ROOT = 'runtime/local/mind-steward/maintenance-previews';
const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build', 'mind'];

export function listMaintenancePreviewSummaries(): BrainCoreMaintenancePreviewSummary[] {
  const root = resolveSafeMaintenancePreviewRoot();
  if (!root || !fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.name.endsWith('.json') && entry.name !== 'latest.json')
    .map((entry) => readQueueSummary(path.join(root, entry.name), new Date()))
    .filter((summary): summary is BrainCoreMaintenancePreviewSummary => summary !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function readLatestMaintenancePreviewDetail(): BrainCoreMaintenancePreviewDetail | undefined {
  const summaries = listMaintenancePreviewSummaries();
  if (summaries.length === 0) return undefined;
  return readMaintenancePreviewDetail(summaries[0]!.queueId) ?? undefined;
}

export function readMaintenancePreviewDetailById(queueId: string): BrainCoreMaintenancePreviewDetail | undefined {
  return readMaintenancePreviewDetail(queueId);
}

function readMaintenancePreviewDetail(queueId: string): BrainCoreMaintenancePreviewDetail | undefined {
  const root = resolveSafeMaintenancePreviewRoot();
  if (!root || !fs.existsSync(root)) return undefined;
  const filePath = path.join(root, `${queueId}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<MindMaintenancePreviewQueue> & { queueId?: unknown; expiresAt?: unknown };
    const id = parsed.queueId;
    if (
      !id ||
      typeof id !== 'string' ||
      !parsed.createdAt ||
      !parsed.expiresAt ||
      typeof parsed.expiresAt !== 'string' ||
      !Array.isArray(parsed.actions) ||
      !parsed.summary
    ) {
      return undefined;
    }
    return {
      queueId: id,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      expired: Date.parse(parsed.expiresAt) <= Date.now(),
      actionCount: parsed.actions.length,
      lowRiskCount: parsed.summary.lowRiskCount ?? 0,
      mediumRiskCount: parsed.summary.mediumRiskCount ?? 0,
      highRiskCount: parsed.summary.highRiskCount ?? 0,
      approvalRequiredCount: parsed.summary.approvalRequiredCount ?? 0,
      writesToMind: false,
      externalSideEffects: false,
      topActions: (parsed.actions ?? [])
        .slice(0, 3)
        .map((action: any) => ({
          kind: action.kind ?? '',
          title: action.title ?? '',
          risk: action.risk ?? 'low',
        })),
    };
  } catch {
    return undefined;
  }
}

function readQueueSummary(filePath: string, now: Date): BrainCoreMaintenancePreviewSummary | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<MindMaintenancePreviewQueue> & { queueId?: unknown; expiresAt?: unknown };
    const id = parsed.queueId;
    if (
      !id ||
      typeof id !== 'string' ||
      !parsed.createdAt ||
      !parsed.expiresAt ||
      typeof parsed.expiresAt !== 'string' ||
      !parsed.summary
    ) {
      return null;
    }
    return {
      queueId: id,
      createdAt: parsed.createdAt,
      expiresAt: parsed.expiresAt,
      expired: Date.parse(parsed.expiresAt) <= now.getTime(),
      actionCount: parsed.summary.total ?? 0,
      lowRiskCount: parsed.summary.lowRiskCount ?? 0,
      mediumRiskCount: parsed.summary.mediumRiskCount ?? 0,
      highRiskCount: parsed.summary.highRiskCount ?? 0,
      approvalRequiredCount: parsed.summary.approvalRequiredCount ?? 0,
      writesToMind: false,
      externalSideEffects: false,
    };
  } catch {
    return null;
  }
}

function resolveSafeMaintenancePreviewRoot(): string | undefined {
  const configured = process.env.BRAIN_CORE_MAINTENANCE_PREVIEW_ROOT;
  if (configured) {
    const normalized = path.normalize(configured);
    for (const disallowed of DISALLOWED_SEGMENTS) {
      if (normalized.includes(disallowed)) return undefined;
    }
    return normalized;
  }
  return DEFAULT_RELATIVE_MAINTENANCE_PREVIEW_ROOT;
}
