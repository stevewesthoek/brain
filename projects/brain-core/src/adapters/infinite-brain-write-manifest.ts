/**
 * Infinite Brain Write Manifest Generation
 * Converts executor dry-run operations into concrete manifest of intended writes
 * This phase: manifest generation only, no writes, all operations blocked
 *
 * Input:
 *   - runtime/local/infinite-brain/proposal-executor-dry-run-latest.json
 *
 * Output:
 *   - runtime/local/infinite-brain/write-manifest-latest.json
 *
 * Safety: writeEnabled: false, canWriteToMind: false, manifestOnly: true, reportOnly: true
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_WRITE_MANIFEST_RELATIVE_PATH = 'runtime/local/infinite-brain/write-manifest-latest.json';
const DEFAULT_EXECUTOR_DRY_RUN_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-executor-dry-run-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export interface WriteManifestEntry {
  entryId: string;
  operationId: string;
  proposalId: string;
  category: string;
  operationType: string;
  intendedAction: string;
  targetPathsPreview: string[];
  contentPreviewAvailable: boolean;
  contentPreviewHash: string | null;
  wouldCreateFiles: boolean;
  wouldModifyFiles: boolean;
  wouldDeleteFiles: boolean;
  wouldMoveFiles: boolean;
  requiresRollbackPlan: boolean;
  rollbackPreview: string;
  validationRequired: string[];
  writeBlocked: boolean;
  applied: boolean;
}

export interface WriteManifestSafety {
  writesToMind: boolean;
  modifiesMind: boolean;
  deletesFiles: boolean;
  movesFiles: boolean;
  appliesProposals: boolean;
  writeEnabled: boolean;
  canWriteToMind: boolean;
  manifestOnly: boolean;
  reportOnly: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
  usesShell: boolean;
}

export interface WriteManifest {
  manifestId: string;
  generatedAt: string;
  sourceDryRunReportId: string | null;
  status: 'blocked' | 'manifest-ready';
  writeEnabled: boolean;
  canWriteToMind: boolean;
  totalOperations: number;
  totalManifestEntries: number;
  entries: WriteManifestEntry[];
  blockers: string[];
  safety: WriteManifestSafety;
}

function getWriteManifestPath(): string {
  const envPath = process.env.IBR_WRITE_MANIFEST_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_WRITE_MANIFEST_RELATIVE_PATH);
}

function getExecutorDryRunPath(): string {
  const envPath = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_EXECUTOR_DRY_RUN_RELATIVE_PATH);
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function generateManifestId(dryRunId: string | null, operationIds: string[]): string {
  const sortedOps = operationIds.sort().join(',');
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      dryRunId: dryRunId || 'no-dry-run',
      operations: sortedOps,
    }))
    .digest('hex')
    .substring(0, 12);

  return `manifest-${hash}`;
}

function generateEntryId(operationId: string, operationType: string, category: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      operationId,
      operationType,
      category,
    }))
    .digest('hex')
    .substring(0, 12);

  return `entry-${hash}`;
}

function generateSafetyBlock(): WriteManifestSafety {
  return {
    writesToMind: false,
    modifiesMind: false,
    deletesFiles: false,
    movesFiles: false,
    appliesProposals: false,
    writeEnabled: false,
    canWriteToMind: false,
    manifestOnly: true,
    reportOnly: true,
    continuousRuntime: false,
    modelCalls: false,
    usesShell: false,
  };
}

function convertDryRunOperationsToManifestEntries(
  dryRunOps: any[]
): WriteManifestEntry[] {
  const entries: WriteManifestEntry[] = [];

  for (const op of dryRunOps) {
    const entryId = generateEntryId(op.operationId, op.operationType, op.category);

    entries.push({
      entryId,
      operationId: op.operationId,
      proposalId: op.proposalId,
      category: op.category,
      operationType: op.operationType,
      intendedAction: `${op.operationType} in ${op.category}`,
      targetPathsPreview: op.targetPathsPreview || [],
      contentPreviewAvailable: false,
      contentPreviewHash: null,
      wouldCreateFiles: op.operationType.toLowerCase().includes('create') || false,
      wouldModifyFiles: op.operationType.toLowerCase().includes('update') || false,
      wouldDeleteFiles: op.wouldDeleteFiles || false,
      wouldMoveFiles: op.wouldMoveFiles || false,
      requiresRollbackPlan: op.wouldDeleteFiles || op.wouldMoveFiles || false,
      rollbackPreview: op.rollbackPreview || '',
      validationRequired: op.validationChecks?.map((c: any) => c.label) || [],
      writeBlocked: true,
      applied: false,
    });
  }

  return entries;
}

export function generateWriteManifest(): WriteManifest {
  const dryRunPath = getExecutorDryRunPath();
  const dryRunReport = readJsonSafely<{ id?: string; reportId?: string; operations?: any[] }>(dryRunPath);
  const dryRunId = dryRunReport?.id || dryRunReport?.reportId || null;

  const dryRunExists = dryRunReport !== null;
  const operations = dryRunReport?.operations || [];

  const entries = dryRunExists ? convertDryRunOperationsToManifestEntries(operations) : [];
  const operationIds = entries.map(e => e.operationId);

  const blockers: string[] = [];
  if (!dryRunExists) {
    blockers.push('Executor dry-run report missing. Generate one first.');
  }
  if (entries.length === 0) {
    blockers.push('No operations found in dry-run report.');
  }

  const status = blockers.length > 0 ? 'blocked' : 'manifest-ready';

  return {
    manifestId: generateManifestId(dryRunId, operationIds),
    generatedAt: new Date().toISOString(),
    sourceDryRunReportId: dryRunId,
    status,
    writeEnabled: false,
    canWriteToMind: false,
    totalOperations: operations.length,
    totalManifestEntries: entries.length,
    entries,
    blockers,
    safety: generateSafetyBlock(),
  };
}

export function writeWriteManifest(manifest: WriteManifest): boolean {
  try {
    const manifestPath = getWriteManifestPath();
    const manifestDir = path.dirname(manifestPath);
    fs.mkdirSync(manifestDir, { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readWriteManifest(): WriteManifest | null {
  const manifestPath = getWriteManifestPath();
  return readJsonSafely<WriteManifest>(manifestPath);
}

export function readWriteManifestSummary(): {
  available: boolean;
  generatedAt?: string;
  status?: string;
  totalManifestEntries?: number;
  writeEnabled?: boolean;
  canWriteToMind?: boolean;
  blockerCount?: number;
} {
  const manifest = readWriteManifest();
  if (!manifest) {
    return { available: false };
  }

  return {
    available: true,
    generatedAt: manifest.generatedAt,
    status: manifest.status,
    totalManifestEntries: manifest.totalManifestEntries,
    writeEnabled: manifest.writeEnabled,
    canWriteToMind: manifest.canWriteToMind,
    blockerCount: manifest.blockers.length,
  };
}
