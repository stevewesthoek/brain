/**
 * Mind Steward original capture source preservation.
 * Records the source capture identity and hash before later proposal/review
 * steps. This adapter is read-only and does not decide post-approval moves.
 */

import fs, { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { NormalizedCaptureClassification } from './mind-steward-capture-classification.js';

export interface MindStewardCaptureSourceRecord {
  schemaVersion: '1.0';
  recordId: string;
  recordedAt: string;
  classificationId: string;
  status: 'preserved' | 'blocked';
  originalCapture: {
    path: string | null;
    contentSha256: string | null;
    sizeBytes: number | null;
    modifiedAt: string | null;
  };
  retentionPolicy: 'preserve-in-place-until-approved-outcome-defined';
  requiresOriginalCapture: true;
  blockers: string[];
  safety: {
    readOnly: true;
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    overwritesCaptures: false;
  };
}

export interface MindStewardCaptureSourceGate {
  status: 'ready' | 'blocked';
  canContinueCaptureReview: boolean;
  classificationId: string;
  sourcePreservationRequired: true;
  sourceRecord: MindStewardCaptureSourceRecord | null;
  blockers: string[];
  safety: {
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    proposalOnly: true;
  };
}

export interface CreateCaptureSourceRecordOptions {
  mindRoot: string;
  classification: NormalizedCaptureClassification;
  now?: Date;
}

function sha256Buffer(value: Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256String(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function toMindRelativePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function resolveMindRoot(mindRoot: string): string | null {
  try {
    const resolved = realpathSync(mindRoot);
    return fs.statSync(resolved).isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

function isSafeCaptureInboxPath(capturePath: string | null): capturePath is string {
  if (!capturePath) return false;
  const normalized = path.posix.normalize(capturePath);
  return normalized === capturePath
    && normalized.startsWith('capture/inbox/')
    && normalized.length > 'capture/inbox/'.length
    && !normalized.includes('\0')
    && !normalized.includes('*')
    && !normalized.includes('?')
    && !path.posix.isAbsolute(normalized);
}

function createBlockedRecord(
  classification: NormalizedCaptureClassification,
  nowIso: string,
  blockers: string[],
): MindStewardCaptureSourceRecord {
  return {
    schemaVersion: '1.0',
    recordId: `capture-source-${sha256String(JSON.stringify({
      classificationId: classification.classificationId,
      capturePath: classification.capturePath,
      blockers,
    })).slice(0, 16)}`,
    recordedAt: nowIso,
    classificationId: classification.classificationId,
    status: 'blocked',
    originalCapture: {
      path: classification.capturePath,
      contentSha256: null,
      sizeBytes: null,
      modifiedAt: null,
    },
    retentionPolicy: 'preserve-in-place-until-approved-outcome-defined',
    requiresOriginalCapture: true,
    blockers,
    safety: {
      readOnly: true,
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      overwritesCaptures: false,
    },
  };
}

export function createCaptureSourcePreservationRecord(
  options: CreateCaptureSourceRecordOptions,
): MindStewardCaptureSourceRecord {
  const nowIso = (options.now ?? new Date()).toISOString();
  if (!isSafeCaptureInboxPath(options.classification.capturePath)) {
    return createBlockedRecord(options.classification, nowIso, ['invalidOrMissingCapturePath']);
  }

  const mindRoot = resolveMindRoot(options.mindRoot);
  if (!mindRoot) {
    return createBlockedRecord(options.classification, nowIso, ['mindRootUnavailable']);
  }

  const captureAbsolutePath = path.join(mindRoot, options.classification.capturePath);
  try {
    const stat = lstatSync(captureAbsolutePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return createBlockedRecord(options.classification, nowIso, ['captureSourceNotRegularFile']);
    }
    const resolvedCapturePath = realpathSync(captureAbsolutePath);
    const relativeToMind = toMindRelativePath(path.relative(mindRoot, resolvedCapturePath));
    if (relativeToMind !== options.classification.capturePath || relativeToMind.startsWith('..') || path.isAbsolute(relativeToMind)) {
      return createBlockedRecord(options.classification, nowIso, ['captureSourceEscapesMindRoot']);
    }

    const content = readFileSync(resolvedCapturePath, null as any) as unknown as Buffer;
    const contentSha256 = sha256Buffer(content);
    return {
      schemaVersion: '1.0',
      recordId: `capture-source-${sha256String(JSON.stringify({
        classificationId: options.classification.classificationId,
        capturePath: options.classification.capturePath,
        contentSha256,
      })).slice(0, 16)}`,
      recordedAt: nowIso,
      classificationId: options.classification.classificationId,
      status: 'preserved',
      originalCapture: {
        path: options.classification.capturePath,
        contentSha256,
        sizeBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      },
      retentionPolicy: 'preserve-in-place-until-approved-outcome-defined',
      requiresOriginalCapture: true,
      blockers: [],
      safety: {
        readOnly: true,
        writesToMind: false,
        movesCaptures: false,
        deletesCaptures: false,
        overwritesCaptures: false,
      },
    };
  } catch {
    return createBlockedRecord(options.classification, nowIso, ['captureSourceUnavailable']);
  }
}

export function createCaptureSourcePreservationGate(
  classification: NormalizedCaptureClassification,
  sourceRecord: MindStewardCaptureSourceRecord | null,
): MindStewardCaptureSourceGate {
  const blockers: string[] = [];
  if (!sourceRecord) {
    blockers.push('captureSourcePreservationRequired');
  } else {
    if (sourceRecord.status !== 'preserved') {
      blockers.push(...sourceRecord.blockers);
    }
    if (sourceRecord.classificationId !== classification.classificationId) {
      blockers.push('captureSourceClassificationMismatch');
    }
    if (sourceRecord.originalCapture.path !== classification.capturePath) {
      blockers.push('captureSourcePathMismatch');
    }
    if (!sourceRecord.originalCapture.contentSha256) {
      blockers.push('captureSourceHashMissing');
    }
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    canContinueCaptureReview: blockers.length === 0,
    classificationId: classification.classificationId,
    sourcePreservationRequired: true,
    sourceRecord,
    blockers,
    safety: {
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      proposalOnly: true,
    },
  };
}
