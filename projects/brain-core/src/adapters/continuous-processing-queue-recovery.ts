/**
 * Queue State Self-Healing.
 *
 * Detects and recovers from malformed or missing queue state files.
 * Preserves diagnostic evidence when malformed state is detected.
 *
 * Safety guarantees:
 * - NEVER writes to Mind
 * - NEVER moves or deletes captures
 * - NEVER writes to Kanban
 * - Preserves malformed files as diagnostic backups (does not delete them)
 * - Reconstruction reads Mind in read-only mode (via refreshMindStewardInboxQueue)
 */

import fs, { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  refreshMindStewardInboxQueue,
  type MindStewardInboxQueueState,
} from './mind-steward-inbox-queue.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_STATE_PATH = path.resolve(
  BRAIN_ROOT,
  'runtime/local/mind-steward/inbox-queue-state.json',
);

const BASE_SAFETY = {
  writesToMind: false,
  movesCaptures: false,
  deletesCaptures: false,
  writesKanban: false,
  reconstructsFromMindReadOnly: true,
} as const;

export interface QueueStateRecoverySafety {
  writesToMind: false;
  movesCaptures: false;
  deletesCaptures: false;
  writesKanban: false;
  preservesDiagnosticEvidence: boolean;
  reconstructsFromMindReadOnly: true;
}

export interface QueueStateRecoveryResult {
  id: 'queue-state-recovery';
  status: 'healthy' | 'reconstructed' | 'reconstruction-failed' | 'paused' | 'no-action-needed';
  source: 'brain-runtime-queue-state';
  malformedDetected: boolean;
  malformedPreservedAt: string | null;
  reconstructionAttempted: boolean;
  reconstructionSucceeded: boolean;
  reconstructionFailureCount: number;
  paused: boolean;
  pausedReason: string | null;
  mindMutated: false;
  capturesMoved: false;
  capturesDeleted: false;
  blockers: string[];
  safety: QueueStateRecoverySafety;
}

function makeSafety(preservesDiagnosticEvidence: boolean): QueueStateRecoverySafety {
  return { ...BASE_SAFETY, preservesDiagnosticEvidence };
}

export interface QueueStateRecoveryOptions {
  statePath?: string;
  mindRoot?: string;
  now?: Date;
  maxReconstructionFailures?: number;
}

function resolveStatePath(value?: string): string {
  const configured = value ?? process.env.BRAIN_CORE_MIND_STEWARD_INBOX_QUEUE_STATE_PATH;
  if (!configured) return DEFAULT_STATE_PATH;
  return path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured);
}

const VALID_ITEM_STATUSES = new Set([
  'pending', 'running', 'blocked', 'failed', 'reported', 'approved', 'done',
]);

function isValidQueueState(parsed: unknown): parsed is MindStewardInboxQueueState {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;

  // Required top-level string fields
  if (obj['schemaVersion'] !== '1.0') return false;
  if (typeof obj['queueId'] !== 'string' || !obj['queueId']) return false;
  if (typeof obj['generatedAt'] !== 'string' || !obj['generatedAt']) return false;
  if (obj['source'] !== 'brain-runtime') return false;
  if (typeof obj['mindRoot'] !== 'string' || !obj['mindRoot']) return false;
  if (typeof obj['inboxPath'] !== 'string' || !obj['inboxPath']) return false;

  // Status vocabulary
  if (obj['status'] !== 'ready' && obj['status'] !== 'blocked') return false;

  // Settings object with bounded numeric fields
  const settings = obj['settings'];
  if (typeof settings !== 'object' || settings === null) return false;
  const s = settings as Record<string, unknown>;
  if (typeof s['maxConcurrentJobs'] !== 'number' || s['maxConcurrentJobs'] < 1) return false;
  if (typeof s['maxFilesPerRun'] !== 'number' || s['maxFilesPerRun'] < 1) return false;
  if (typeof s['debounceSeconds'] !== 'number' || s['debounceSeconds'] < 0) return false;
  if (typeof s['maxRetries'] !== 'number' || s['maxRetries'] < 0) return false;
  if (typeof s['largeFileThresholdMb'] !== 'number' || s['largeFileThresholdMb'] <= 0) return false;
  if (typeof s['minimumSecondsBetweenRuns'] !== 'number' || s['minimumSecondsBetweenRuns'] < 0) return false;

  // Items array with required fields and status vocabulary
  if (!Array.isArray(obj['items'])) return false;
  for (const item of obj['items']) {
    if (typeof item !== 'object' || item === null) return false;
    const it = item as Record<string, unknown>;
    if (typeof it['id'] !== 'string' || !it['id']) return false;
    if (typeof it['path'] !== 'string' || !it['path']) return false;
    if (typeof it['status'] !== 'string' || !VALID_ITEM_STATUSES.has(it['status'])) return false;
    if (typeof it['sizeBytes'] !== 'number') return false;
  }

  // Summary object
  if (typeof obj['summary'] !== 'object' || obj['summary'] === null) return false;
  const sum = obj['summary'] as Record<string, unknown>;
  if (typeof sum['total'] !== 'number') return false;

  // Blockers array
  if (!Array.isArray(obj['blockers'])) return false;

  // Safety object
  if (typeof obj['safety'] !== 'object' || obj['safety'] === null) return false;
  const safety = obj['safety'] as Record<string, unknown>;
  if (safety['stateOwnedBy'] !== 'brain') return false;
  if (typeof safety['statePath'] !== 'string' || !safety['statePath']) return false;
  if (safety['writesToMind'] !== false) return false;
  if (safety['movesCaptures'] !== false) return false;

  return true;
}

/**
 * Returns null when backup creation fails rather than a phantom path.
 * When null is returned the caller must NOT claim preservesDiagnosticEvidence:true.
 */
function preserveMalformedFile(statePath: string, now: Date): string | null {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const backupPath = `${statePath}.malformed.${timestamp}.bak`;
  try {
    copyFileSync(statePath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}

// In-memory reconstruction failure counter (not persisted — resets on restart).
// This is module-level so it persists across calls within the same process.
let reconstructionFailureCount = 0;

export function detectAndRecoverQueueState(
  options: QueueStateRecoveryOptions = {},
): QueueStateRecoveryResult {
  const statePath = resolveStatePath(options.statePath);
  const mindRoot: string | undefined = options.mindRoot;
  const now = options.now ?? new Date();
  const maxReconstructionFailures = options.maxReconstructionFailures ?? 3;

  // Build options with only defined properties (exactOptionalPropertyTypes)
  function buildRefreshOptions() {
    return {
      statePath,
      ...(mindRoot !== undefined ? { mindRoot } : {}),
      now,
    };
  }

  const baseResult = {
    id: 'queue-state-recovery' as const,
    source: 'brain-runtime-queue-state' as const,
    mindMutated: false as const,
    capturesMoved: false as const,
    capturesDeleted: false as const,
  };

  // Check if we're already paused due to too many reconstruction failures
  if (reconstructionFailureCount >= maxReconstructionFailures) {
    return {
      ...baseResult,
      status: 'paused',
      malformedDetected: false,
      malformedPreservedAt: null,
      reconstructionAttempted: false,
      reconstructionSucceeded: false,
      reconstructionFailureCount,
      paused: true,
      pausedReason: 'maxReconstructionFailuresReached',
      blockers: ['maxReconstructionFailuresReached'],
      safety: makeSafety(false),
    };
  }

  // Step 1: Check if state file exists
  let fileExists = false;
  let fileContent: string | null = null;
  try {
    fileContent = fs.readFileSync(statePath, 'utf8');
    fileExists = true;
  } catch {
    fileExists = false;
  }

  // Step 2: File missing → reconstruct
  if (!fileExists) {
    try {
      refreshMindStewardInboxQueue(buildRefreshOptions());
      reconstructionFailureCount = 0;
      return {
        ...baseResult,
        status: 'reconstructed',
        malformedDetected: false,
        malformedPreservedAt: null,
        reconstructionAttempted: true,
        reconstructionSucceeded: true,
        reconstructionFailureCount,
        paused: false,
        pausedReason: null,
        blockers: [],
        safety: makeSafety(false),
      };
    } catch {
      reconstructionFailureCount += 1;
      const shouldPause = reconstructionFailureCount >= maxReconstructionFailures;
      return {
        ...baseResult,
        status: shouldPause ? 'paused' : 'reconstruction-failed',
        malformedDetected: false,
        malformedPreservedAt: null,
        reconstructionAttempted: true,
        reconstructionSucceeded: false,
        reconstructionFailureCount,
        paused: shouldPause,
        pausedReason: shouldPause ? 'maxReconstructionFailuresReached' : null,
        blockers: shouldPause ? ['maxReconstructionFailuresReached'] : ['reconstructionFailed'],
        safety: makeSafety(false),
      };
    }
  }

  // Step 3: File exists — try to parse JSON
  let parsed: unknown;
  let parseSuccess = false;
  try {
    parsed = JSON.parse(fileContent!);
    parseSuccess = true;
  } catch {
    parseSuccess = false;
  }

  // Step 4: Malformed JSON → attempt backup, then reconstruct
  if (!parseSuccess || !isValidQueueState(parsed)) {
    const backupPath = preserveMalformedFile(statePath, now);
    const backupCreated = backupPath !== null;
    const blockerBase = !backupCreated ? ['malformedBackupPreservationFailed'] : [];

    try {
      refreshMindStewardInboxQueue(buildRefreshOptions());
      reconstructionFailureCount = 0;
      return {
        ...baseResult,
        status: 'reconstructed',
        malformedDetected: true,
        malformedPreservedAt: backupPath,
        reconstructionAttempted: true,
        reconstructionSucceeded: true,
        reconstructionFailureCount,
        paused: false,
        pausedReason: null,
        blockers: blockerBase,
        safety: makeSafety(backupCreated),
      };
    } catch {
      reconstructionFailureCount += 1;
      const shouldPause = reconstructionFailureCount >= maxReconstructionFailures;
      const failureBlockers = shouldPause
        ? ['maxReconstructionFailuresReached', ...blockerBase]
        : ['reconstructionFailed', ...blockerBase];
      return {
        ...baseResult,
        status: shouldPause ? 'paused' : 'reconstruction-failed',
        malformedDetected: true,
        malformedPreservedAt: backupPath,
        reconstructionAttempted: true,
        reconstructionSucceeded: false,
        reconstructionFailureCount,
        paused: shouldPause,
        pausedReason: shouldPause ? 'maxReconstructionFailuresReached' : null,
        blockers: failureBlockers,
        safety: makeSafety(backupCreated),
      };
    }
  }

  // Step 5: File present and valid
  reconstructionFailureCount = 0;
  return {
    ...baseResult,
    status: 'healthy',
    malformedDetected: false,
    malformedPreservedAt: null,
    reconstructionAttempted: false,
    reconstructionSucceeded: false,
    reconstructionFailureCount: 0,
    paused: false,
    pausedReason: null,
    blockers: [],
    safety: makeSafety(false),
  };
}

/**
 * Reset the in-memory reconstruction failure counter.
 * Exposed for testing purposes only.
 */
export function _resetReconstructionFailureCount(): void {
  reconstructionFailureCount = 0;
}
