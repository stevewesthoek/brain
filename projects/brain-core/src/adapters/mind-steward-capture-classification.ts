/**
 * Mind Steward capture classification normalization.
 * Converts classifier dry-run output into a stable reviewable shape without
 * writing to Mind or choosing final destinations.
 */

import crypto from 'node:crypto';
import path from 'node:path';

export type NormalizedCaptureClassificationStatus = 'ready-for-review' | 'skipped' | 'blocked';

export interface NormalizedCaptureClassification {
  classificationId: string;
  type: 'capture-classification';
  status: NormalizedCaptureClassificationStatus;
  capturePath: string | null;
  captureName: string;
  sizeBytes: number | null;
  modifiedAt: string | null;
  proposedSummary: string | null;
  proposedTags: string[];
  recommendedDestination: null;
  confidence: number;
  reviewReason: string;
  requiresApproval: true;
  selectorStatus: string;
  selectorProviderId: string | null;
  selectorModel: string | null;
  evidence: Array<{
    kind: 'preview' | 'skip-reason' | 'error';
    value: string;
  }>;
  blockers: string[];
}

export interface NormalizedCaptureClassificationOutput {
  schemaVersion: '1.0';
  normalizedAt: string;
  sourceJob: string | null;
  sourceMode: string | null;
  sourceStatus: string | null;
  selectorTaskType: string | null;
  classifications: NormalizedCaptureClassification[];
  summary: {
    total: number;
    readyForReview: number;
    skipped: number;
    blocked: number;
  };
  safety: {
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    writesKanban: false;
    normalizedOnly: true;
  };
  blockers: string[];
}

interface ClassifierDryRunFile {
  name?: unknown;
  sizeBytes?: unknown;
  modifiedAt?: unknown;
  preview?: unknown;
  reason?: unknown;
  error?: unknown;
}

interface ClassifierDryRunReport {
  job?: unknown;
  mode?: unknown;
  status?: unknown;
  message?: unknown;
  selectorTaskType?: unknown;
  selector?: {
    status?: unknown;
    providerId?: unknown;
    model?: unknown;
  };
  inbox?: {
    sampledFiles?: unknown;
    skippedFiles?: unknown;
  };
  errors?: unknown;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function safeCapturePath(name: string): string | null {
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) return null;
  if (name === '.' || name === '..' || name.trim().length === 0) return null;
  if (name.includes('*') || name.includes('?') || name.includes('[') || name.includes(']')) return null;
  return path.posix.join('capture/inbox', name);
}

function classificationId(capturePath: string | null, captureName: string, preview: string | null): string {
  const digest = crypto.createHash('sha256')
    .update(JSON.stringify({ capturePath, captureName, preview: preview?.slice(0, 240) ?? null }))
    .digest('hex')
    .slice(0, 16);
  return `capture-classification-${digest}`;
}

function summarizePreview(preview: string | null): string | null {
  if (!preview) return null;
  const firstMeaningfulLine = preview
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^#+\s*/, ''))
    .find(line => line.length > 0);
  if (!firstMeaningfulLine) return null;
  return firstMeaningfulLine.length > 180
    ? `${firstMeaningfulLine.slice(0, 177)}...`
    : firstMeaningfulLine;
}

function normalizeSampledFile(
  file: ClassifierDryRunFile,
  selector: ClassifierDryRunReport['selector'],
): NormalizedCaptureClassification {
  const captureName = asString(file.name) ?? 'unknown';
  const preview = asString(file.preview);
  const capturePath = safeCapturePath(captureName);
  const blockers = capturePath ? [] : ['invalidCaptureName'];
  const selectorStatus = asString(selector?.status) ?? 'unknown';

  return {
    classificationId: classificationId(capturePath, captureName, preview),
    type: 'capture-classification',
    status: blockers.length === 0 ? 'ready-for-review' : 'blocked',
    capturePath,
    captureName,
    sizeBytes: asNumber(file.sizeBytes),
    modifiedAt: asString(file.modifiedAt),
    proposedSummary: summarizePreview(preview),
    proposedTags: [],
    recommendedDestination: null,
    confidence: 0,
    reviewReason: 'Normalized classifier dry-run output only; semantic destination and duplicate checks are handled by later approved tasks.',
    requiresApproval: true,
    selectorStatus,
    selectorProviderId: asString(selector?.providerId),
    selectorModel: asString(selector?.model),
    evidence: preview ? [{ kind: 'preview', value: preview.slice(0, 500) }] : [],
    blockers,
  };
}

function normalizeSkippedFile(file: ClassifierDryRunFile): NormalizedCaptureClassification {
  const captureName = asString(file.name) ?? 'unknown';
  const capturePath = safeCapturePath(captureName);
  const reason = asString(file.reason) ?? 'skipped';
  const error = asString(file.error);
  const blockers = [reason, ...(capturePath ? [] : ['invalidCaptureName'])];

  return {
    classificationId: classificationId(capturePath, captureName, reason),
    type: 'capture-classification',
    status: 'skipped',
    capturePath,
    captureName,
    sizeBytes: asNumber(file.sizeBytes),
    modifiedAt: asString(file.modifiedAt),
    proposedSummary: null,
    proposedTags: [],
    recommendedDestination: null,
    confidence: 0,
    reviewReason: 'Capture was skipped by the classifier dry-run and needs review before any later processing.',
    requiresApproval: true,
    selectorStatus: 'not-run',
    selectorProviderId: null,
    selectorModel: null,
    evidence: [
      { kind: 'skip-reason', value: reason },
      ...(error ? [{ kind: 'error' as const, value: error }] : []),
    ],
    blockers,
  };
}

export function normalizeCaptureClassificationOutput(
  report: ClassifierDryRunReport,
  now: Date = new Date(),
): NormalizedCaptureClassificationOutput {
  const sampledFiles = Array.isArray(report.inbox?.sampledFiles)
    ? report.inbox.sampledFiles as ClassifierDryRunFile[]
    : [];
  const skippedFiles = Array.isArray(report.inbox?.skippedFiles)
    ? report.inbox.skippedFiles as ClassifierDryRunFile[]
    : [];

  const classifications = [
    ...sampledFiles.map(file => normalizeSampledFile(file, report.selector)),
    ...skippedFiles.map(normalizeSkippedFile),
  ];

  const topLevelBlockers: string[] = [];
  if (asString(report.status) !== 'ok') {
    topLevelBlockers.push(asString(report.message) ?? 'classifierReportNotOk');
  }
  if (sampledFiles.length === 0 && skippedFiles.length === 0) {
    topLevelBlockers.push('noClassifierFileEntries');
  }

  return {
    schemaVersion: '1.0',
    normalizedAt: now.toISOString(),
    sourceJob: asString(report.job),
    sourceMode: asString(report.mode),
    sourceStatus: asString(report.status),
    selectorTaskType: asString(report.selectorTaskType),
    classifications,
    summary: {
      total: classifications.length,
      readyForReview: classifications.filter(item => item.status === 'ready-for-review').length,
      skipped: classifications.filter(item => item.status === 'skipped').length,
      blocked: classifications.filter(item => item.status === 'blocked').length,
    },
    safety: {
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      writesKanban: false,
      normalizedOnly: true,
    },
    blockers: topLevelBlockers,
  };
}
