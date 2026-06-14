import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  MAINTENANCE_DECISION_SCHEMA_VERSION,
  assertValidMaintenanceFindingDecisionDocument,
  type MaintenanceFindingDecisionDocument,
} from './finding-decision-store.js';

export const MIND_MAINTENANCE_DECISION_PATH =
  'system/reports/maintenance-decisions.json' as const;

export interface LoadMaintenanceFindingDecisionDocumentOptions {
  whenMissingUpdatedAt: string;
}

export interface WriteMaintenanceFindingDecisionDocumentResult {
  path: string;
  bytesWritten: number;
  decisionCount: number;
}

function resolveDecisionPath(mindRoot: string): string {
  if (!path.isAbsolute(mindRoot)) {
    throw new Error(`Mind maintenance decision store requires an absolute root: ${mindRoot}`);
  }

  const absolutePath = path.resolve(mindRoot, MIND_MAINTENANCE_DECISION_PATH);
  const relativeFromRoot = path.relative(mindRoot, absolutePath);

  if (
    relativeFromRoot.startsWith('..')
    || path.isAbsolute(relativeFromRoot)
    || relativeFromRoot.split(path.sep).includes('..')
  ) {
    throw new Error('Mind maintenance decision path escapes the repository root.');
  }

  return absolutePath;
}

function createEmptyDecisionDocument(updatedAt: string): MaintenanceFindingDecisionDocument {
  const document: MaintenanceFindingDecisionDocument = {
    schemaVersion: MAINTENANCE_DECISION_SCHEMA_VERSION,
    sourceRepo: 'mind',
    updatedAt,
    decisions: [],
  };

  assertValidMaintenanceFindingDecisionDocument(document);
  return document;
}

export async function loadMaintenanceFindingDecisionDocument(
  mindRoot: string,
  options: LoadMaintenanceFindingDecisionDocumentOptions,
): Promise<MaintenanceFindingDecisionDocument> {
  const absolutePath = resolveDecisionPath(mindRoot);

  try {
    const raw = await readFile(absolutePath, 'utf8');
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw) as unknown;
    } catch (error) {
      throw new Error(
        `Mind maintenance decision file contains invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    assertValidMaintenanceFindingDecisionDocument(parsed);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createEmptyDecisionDocument(options.whenMissingUpdatedAt);
    }
    throw error;
  }
}

async function writeAtomic(targetPath: string, content: string): Promise<number> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  const handle = await open(temporaryPath, 'wx');

  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    await rename(temporaryPath, targetPath);
    return Buffer.byteLength(content, 'utf8');
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function writeMaintenanceFindingDecisionDocument(
  mindRoot: string,
  document: MaintenanceFindingDecisionDocument,
): Promise<WriteMaintenanceFindingDecisionDocumentResult> {
  assertValidMaintenanceFindingDecisionDocument(document);
  const absolutePath = resolveDecisionPath(mindRoot);
  const content = `${JSON.stringify(document, null, 2)}\n`;
  const bytesWritten = await writeAtomic(absolutePath, content);

  return {
    path: absolutePath,
    bytesWritten,
    decisionCount: document.decisions.length,
  };
}
