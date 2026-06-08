/**
 * Infinite Brain Metadata Write Rollback Snapshot
 * Creates and manages rollback snapshots for single-file metadata writes
 *
 * Purpose: Capture before state before any real write
 * Output: Snapshots written to Brain runtime only, never to Mind
 *
 * Safety:
 * - writesToMind: false for snapshot creation
 * - modifiesMind: false for snapshot creation
 * - rollbackSnapshotOnly: true
 * - canRestore: true
 * - deletesFiles: false
 * - movesFiles: false
 * - usesShell: false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_ROLLBACK_RELATIVE_PATH = 'runtime/local/infinite-brain/metadata-write-rollback-latest.json';
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export interface MetadataWriteRollbackSnapshot {
  rollbackId: string;
  generatedAt: string;
  targetPath: string;
  beforeContentHash: string;
  beforeContent: string;
  beforeSizeBytes: number;
  writerCategory: 'entity-metadata';
  rollbackAvailable: true;
  rollbackApplied: false;
  safety: {
    writesToMind: false;
    modifiesMind: false;
    rollbackSnapshotOnly: true;
    canRestore: true;
    deletesFiles: false;
    movesFiles: false;
    usesShell: false;
  };
}

export interface MetadataWriteRollbackReport {
  rollbackApplied: boolean;
  appliedAt?: string;
  appliedByOperator?: string;
  reason?: string;
}

function getRollbackPath(): string {
  const envPath = process.env.IBR_METADATA_WRITE_ROLLBACK_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_ROLLBACK_RELATIVE_PATH);
}

function computeContentHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex')
    .substring(0, 12);
}

function generateDeterministicRollbackId(targetPath: string, beforeContentHash: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      scope: 'metadata-write-rollback',
      targetPath,
      beforeContentHash,
    }))
    .digest('hex')
    .substring(0, 12);
  return `rbk-${hash}`;
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

/**
 * Generate a rollback snapshot for an allowlisted file
 * Reads the allowlisted target file and captures before state
 */
export function generateMetadataWriteRollbackSnapshotForAllowlistedFile(
  targetPath: string
): MetadataWriteRollbackSnapshot | null {
  try {
    // Read target file
    const beforeContent = fs.readFileSync(targetPath, 'utf8');
    const beforeContentHash = computeContentHash(beforeContent);
    const rollbackId = generateDeterministicRollbackId(targetPath, beforeContentHash);

    const snapshot: MetadataWriteRollbackSnapshot = {
      rollbackId,
      generatedAt: new Date().toISOString(),
      targetPath,
      beforeContentHash,
      beforeContent,
      beforeSizeBytes: Buffer.byteLength(beforeContent, 'utf8'),
      writerCategory: 'entity-metadata',
      rollbackAvailable: true,
      rollbackApplied: false,
      safety: {
        writesToMind: false,
        modifiesMind: false,
        rollbackSnapshotOnly: true,
        canRestore: true,
        deletesFiles: false,
        movesFiles: false,
        usesShell: false,
      },
    };

    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Write rollback snapshot to Brain runtime
 */
export function writeMetadataWriteRollbackSnapshot(snapshot: MetadataWriteRollbackSnapshot): boolean {
  try {
    const snapshotPath = getRollbackPath();
    const snapshotDir = path.dirname(snapshotPath);
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read rollback snapshot from Brain runtime
 */
export function readMetadataWriteRollbackSnapshot(): MetadataWriteRollbackSnapshot | null {
  const snapshotPath = getRollbackPath();
  return readJsonSafely<MetadataWriteRollbackSnapshot>(snapshotPath);
}

/**
 * Restore file from rollback snapshot
 * Only writes to the exact target path captured in the snapshot
 */
export function restoreFromMetadataWriteRollbackSnapshot(
  snapshot: MetadataWriteRollbackSnapshot,
  operatorName: string,
  reason: string
): boolean {
  try {
    // Write only to the exact target path in the snapshot
    fs.writeFileSync(snapshot.targetPath, snapshot.beforeContent);

    // Create rollback-applied report in Brain runtime
    const reportPath = path.resolve(
      BRAIN_ROOT,
      'runtime/local/infinite-brain/metadata-write-rollback-applied-latest.json'
    );
    const reportDir = path.dirname(reportPath);
    fs.mkdirSync(reportDir, { recursive: true });

    const report: MetadataWriteRollbackReport = {
      rollbackApplied: true,
      appliedAt: new Date().toISOString(),
      appliedByOperator: operatorName,
      reason,
    };

    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a rollback snapshot exists
 */
export function metadataWriteRollbackSnapshotExists(): boolean {
  try {
    const snapshotPath = getRollbackPath();
    return fs.existsSync(snapshotPath);
  } catch {
    return false;
  }
}
