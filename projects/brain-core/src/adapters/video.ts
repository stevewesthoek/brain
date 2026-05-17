import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreRuntimeReportSummary, BrainCoreVideoQueueItem, BrainCoreVideoStatus } from '../types/api.js';

const DISALLOWED_SEGMENTS = ['..', '.env', '.git', 'node_modules', 'dist', 'build'];

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
  return {
    status: normalizeVideoRuntimeStatus(report.status, report.latestRunStatus),
    enabled: true,
    queueDepth: queue.length,
    ...(latestRunAt ? { latestRunAt } : {}),
    source: 'runtime-report',
    message: report.message ?? 'Video runtime report is available.',
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
    return {
      status: body.status ?? 'unknown',
      enabled: body.enabled ?? true,
      latestRunAt: body.latestRunAt,
      latestRunStatus: body.latestRunStatus ?? 'unknown',
      message: body.message ?? 'Video runtime report is available.',
      queue: body.queue ?? [],
      writesToMind: false,
      executableActions: false,
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
}
