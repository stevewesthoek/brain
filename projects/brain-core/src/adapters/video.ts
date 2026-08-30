import fs from 'node:fs';
import path from 'node:path';
import type {
  BrainCoreRuntimeReportSummary,
  BrainCoreVideoQueueItem,
  BrainCoreVideoStatus,
  BrainCoreVideoStorageClassification,
  BrainCoreVideoStorageRoot,
  BrainCoreVideoStorageScanStatus,
  BrainCoreVideoStorageTelemetry,
} from '../types/api.js';

const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build'];
const STORAGE_AGE_BUCKETS = ['lt_1d', '1d_7d', '7d_30d', '30d_90d', 'gt_90d', 'unknown'];

export function normalizeVideoStorageTelemetry(value: unknown): BrainCoreVideoStorageTelemetry | undefined {
  if (!isRecord(value)) return undefined;
  const schemaVersion = safeString(value.schemaVersion);
  const status = storageScanStatus(value.status);
  const generatedAt = value.generatedAt === null ? null : safeString(value.generatedAt) ?? null;
  const rawRoots = value.roots;
  const totals = normalizeTotals(value.totals);
  const warningThresholds = normalizeWarningThresholds(value.warningThresholds);
  const bounds = normalizeBounds(value.bounds);
  const safety = value.safety;
  if (!schemaVersion || !status || !Array.isArray(rawRoots) || rawRoots.length > 20 || !totals || !warningThresholds || !bounds || !isRecord(safety)) return undefined;
  if (safety.reportOnly !== true || safety.writesToMind !== false || safety.executableActions !== false || safety.deletesFiles !== false || safety.movesFiles !== false || safety.archivesFiles !== false || safety.networkAccess !== false || safety.privateContentNames !== false) return undefined;

  const roots: BrainCoreVideoStorageRoot[] = [];
  for (const rawRoot of rawRoots) {
    const root = normalizeStorageRoot(rawRoot);
    if (!root) return undefined;
    roots.push(root);
  }
  const candidateCount = nonNegativeInteger(value.candidateCount);
  if (candidateCount === undefined) return undefined;
  return {
    schemaVersion,
    status,
    generatedAt,
    rootCount: roots.length,
    roots,
    totals,
    ageBuckets: normalizeAgeBuckets(value.ageBuckets),
    warningThresholds,
    bounds,
    warnings: boundedStrings(value.warnings),
    collectionErrors: boundedStrings(value.collectionErrors),
    candidateCount,
    safety: {
      reportOnly: true,
      writesToMind: false,
      executableActions: false,
      deletesFiles: false,
      movesFiles: false,
      archivesFiles: false,
      networkAccess: false,
      privateContentNames: false,
    },
  };
}

export function getVideoStatus(): BrainCoreVideoStatus {
  const report = readVideoRuntimeReport();
  if (!report) {
    return {
      status: 'placeholder',
      enabled: false,
      queueDepth: 0,
      source: 'placeholder',
      message: 'Video runtime report not connected yet.',
    };
  }

  if (report.status === 'invalid') {
    return {
      status: 'failed',
      enabled: false,
      queueDepth: 0,
      source: 'runtime-report',
      message: report.message ?? 'Video runtime report is invalid.',
    };
  }

  const queue = normalizeVideoQueue(report.queue ?? []);
  const latestRunAt = typeof report.latestRunAt === 'string' && report.latestRunAt.trim().length > 0 ? report.latestRunAt.trim() : undefined;
  const storage = normalizeVideoStorageTelemetry(report.storage);
  return {
    status: normalizeVideoRuntimeStatus(report.status, report.latestRunStatus),
    enabled: true,
    queueDepth: queue.length,
    ...(latestRunAt ? { latestRunAt } : {}),
    source: 'runtime-report',
    message: report.message ?? 'Video runtime report is available.',
    ...(storage ? { storage } : {}),
  };
}

export function listVideoQueue(): BrainCoreVideoQueueItem[] {
  const report = readVideoRuntimeReport();
  if (!report || report.status === 'invalid' || report.status === 'missing') {
    return [];
  }
  return normalizeVideoQueue(report.queue ?? []);
}

function readVideoRuntimeReport(): VideoRuntimeReport | undefined {
  const configuredPath = process.env.BRAIN_CORE_VIDEO_REPORT_PATH;
  const defaultPath = path.resolve(process.cwd(), 'runtime/local/video/latest.json');
  const resolved = configuredPath ? resolveSafeRuntimePath(configuredPath) : defaultPath;
  if (!resolved || !fs.existsSync(resolved)) {
    return undefined;
  }

  try {
    const body = JSON.parse(fs.readFileSync(resolved, 'utf8')) as VideoRuntimeReport;
    if (body.executableActions || body.writesToMind) {
      return { status: 'invalid', message: 'Video runtime report declares unsupported execution flags.', queue: [] };
    }
    const storage = normalizeVideoStorageTelemetry(body.storage);
    return {
      status: body.status ?? 'unknown',
      enabled: body.enabled ?? true,
      latestRunAt: body.latestRunAt,
      latestRunStatus: body.latestRunStatus ?? 'unknown',
      message: body.message ?? 'Video runtime report is available.',
      queue: body.queue ?? [],
      writesToMind: false,
      executableActions: false,
      ...(storage ? { storage } : {}),
    };
  } catch {
    return { status: 'invalid', message: 'Video runtime report JSON could not be parsed safely.', queue: [] };
  }
}

function normalizeVideoQueue(queue: Array<Partial<BrainCoreVideoQueueItem>>): BrainCoreVideoQueueItem[] {
  return queue.map((item, index) => ({
    id: safeText(item.id, `video-${index + 1}`),
    title: safeText(item.title, 'Untitled video item'),
    status: normalizeQueueStatus(item.status),
    source: 'runtime-report',
  }));
}

function normalizeQueueStatus(
  status: Partial<BrainCoreVideoQueueItem>['status'],
): BrainCoreVideoQueueItem['status'] {
  return status === 'queued' || status === 'running' || status === 'failed' || status === 'done' ? status : 'placeholder';
}

function safeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function resolveSafeRuntimePath(rawPath: string): string | undefined {
  const normalized = rawPath.replace(/\\/g, '/');
  const segments = normalized.split('/').map((segment) => segment.toLowerCase());
  if (DISALLOWED_SEGMENTS.some((segment) => segments.includes(segment))) {
    return undefined;
  }
  if (segments.includes('mind')) {
    return undefined;
  }
  return path.resolve(rawPath);
}

function normalizeVideoRuntimeStatus(
  status: VideoRuntimeReport['status'],
  latestRunStatus: VideoRuntimeReport['latestRunStatus'],
): BrainCoreVideoStatus['status'] {
  if (status === 'ok' || status === 'failed' || status === 'unknown') {
    return status;
  }
  return latestRunStatus ?? 'unknown';
}

interface VideoRuntimeReport {
  status: 'ok' | 'failed' | 'unknown' | 'available' | 'invalid' | 'missing';
  enabled?: boolean;
  queueDepth?: number;
  latestRunAt?: string | undefined;
  latestRunStatus?: 'ok' | 'failed' | 'unknown';
  message?: string;
  queue?: Array<Partial<BrainCoreVideoQueueItem>>;
  writesToMind?: false;
  executableActions?: false;
  storage?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().slice(0, 200) : undefined;
}

function boundedStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim().slice(0, 200)).filter(Boolean).slice(0, 100);
}

function nonNegativeInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function storageScanStatus(value: unknown): BrainCoreVideoStorageScanStatus | undefined {
  return value === 'ok' || value === 'missing' || value === 'partial' || value === 'unavailable' ? value : undefined;
}

function storageClassification(value: unknown): BrainCoreVideoStorageClassification | undefined {
  return value === 'CURRENT_DURABLE' || value === 'CURRENT_TEMPORARY' || value === 'LEGACY' || value === 'UNKNOWN' ? value : undefined;
}

function normalizeStorageRoot(value: unknown): BrainCoreVideoStorageRoot | undefined {
  if (!isRecord(value)) return undefined;
  const id = safeString(value.id);
  const classification = storageClassification(value.classification);
  const status = storageScanStatus(value.status);
  const bytes = nonNegativeInteger(value.bytes);
  const fileCount = nonNegativeInteger(value.fileCount);
  const directoryCount = nonNegativeInteger(value.directoryCount);
  if (!id || !/^[A-Za-z0-9._-]+$/.test(id) || !classification || !status || bytes === undefined || fileCount === undefined || directoryCount === undefined || typeof value.exists !== 'boolean') return undefined;
  return {
    id,
    classification,
    status,
    exists: value.exists,
    bytes,
    fileCount,
    directoryCount,
    oldestModifiedAt: value.oldestModifiedAt === null ? null : safeString(value.oldestModifiedAt) ?? null,
    newestModifiedAt: value.newestModifiedAt === null ? null : safeString(value.newestModifiedAt) ?? null,
    ageBuckets: normalizeAgeBuckets(value.ageBuckets),
    warnings: boundedStrings(value.warnings),
  };
}

function normalizeAgeBuckets(value: unknown): Record<string, number> {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(STORAGE_AGE_BUCKETS.map((key) => [key, nonNegativeInteger(record[key]) ?? 0]));
}

function normalizeTotals(value: unknown): BrainCoreVideoStorageTelemetry['totals'] | undefined {
  if (!isRecord(value)) return undefined;
  const keys = ['bytes', 'files', 'directories', 'temporaryBytes', 'durableBytes', 'legacyBytes', 'unknownBytes'] as const;
  const values = keys.map((key) => nonNegativeInteger(value[key]));
  if (values.some((entry) => entry === undefined)) return undefined;
  return Object.fromEntries(keys.map((key, index) => [key, values[index]])) as BrainCoreVideoStorageTelemetry['totals'];
}

function normalizeWarningThresholds(value: unknown): BrainCoreVideoStorageTelemetry['warningThresholds'] | undefined {
  if (!isRecord(value)) return undefined;
  const staleAgeDays = nonNegativeInteger(value.staleAgeDays);
  const unknownBytes = nonNegativeInteger(value.unknownBytes);
  const legacyBytes = nonNegativeInteger(value.legacyBytes);
  if (staleAgeDays === undefined || unknownBytes === undefined || legacyBytes === undefined) return undefined;
  return { staleAgeDays, unknownBytes, legacyBytes };
}

function normalizeBounds(value: unknown): BrainCoreVideoStorageTelemetry['bounds'] | undefined {
  if (!isRecord(value)) return undefined;
  const maxDepth = nonNegativeInteger(value.maxDepth);
  const maxFilesPerRoot = nonNegativeInteger(value.maxFilesPerRoot);
  const maxDirectoriesPerRoot = nonNegativeInteger(value.maxDirectoriesPerRoot);
  const timeoutSeconds = nonNegativeInteger(value.timeoutSeconds);
  if (maxDepth === undefined || maxFilesPerRoot === undefined || maxDirectoriesPerRoot === undefined || timeoutSeconds === undefined) return undefined;
  return { maxDepth, maxFilesPerRoot, maxDirectoriesPerRoot, timeoutSeconds };
}
