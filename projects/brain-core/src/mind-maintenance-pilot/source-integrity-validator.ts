import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MIND_MAINTENANCE_DECISION_PATH } from './finding-decision-file.js';
import { MIND_TASK_FILE_CANDIDATES } from '../mind-paths.js';
import {
  MIND_MAINTENANCE_COMPATIBLE_PILOT_FILES,
  MIND_MAINTENANCE_REPORT_OUTPUTS,
  type LoadedMindMaintenancePilotDataset,
} from './pilot-file-loader.js';

export const MIND_MAINTENANCE_INTEGRITY_PATHS = [
  ...MIND_MAINTENANCE_COMPATIBLE_PILOT_FILES,
  ...MIND_TASK_FILE_CANDIDATES,
  MIND_MAINTENANCE_DECISION_PATH,
] as const;

export type MindMaintenanceIntegrityPath = (typeof MIND_MAINTENANCE_INTEGRITY_PATHS)[number];

export interface MindMaintenanceIntegrityEntry {
  path: MindMaintenanceIntegrityPath;
  exists: boolean;
  sha256: string | null;
}

export interface MindMaintenanceIntegritySnapshot {
  mindRoot: string;
  entries: MindMaintenanceIntegrityEntry[];
}

export interface MindMaintenanceIntegrityResult {
  ok: boolean;
  changedSourcePaths: MindMaintenanceIntegrityPath[];
  allowedOutputPaths: string[];
  unexpectedChangedPaths: string[];
}

function hashContent(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

async function snapshotPath(
  mindRoot: string,
  relativePath: MindMaintenanceIntegrityPath,
): Promise<MindMaintenanceIntegrityEntry> {
  const absolutePath = path.resolve(mindRoot, relativePath);
  const relativeFromRoot = path.relative(mindRoot, absolutePath);

  if (
    relativeFromRoot.startsWith('..')
    || path.isAbsolute(relativeFromRoot)
    || relativeFromRoot.split(path.sep).includes('..')
  ) {
    throw new Error(`Integrity path escapes the Mind repository root: ${relativePath}`);
  }

  try {
    const content = await readFile(absolutePath);
    return {
      path: relativePath,
      exists: true,
      sha256: hashContent(content),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        path: relativePath,
        exists: false,
        sha256: null,
      };
    }
    throw error;
  }
}

export async function captureMindMaintenanceIntegritySnapshot(
  dataset: LoadedMindMaintenancePilotDataset,
): Promise<MindMaintenanceIntegritySnapshot> {
  const entries = await Promise.all(
    MIND_MAINTENANCE_INTEGRITY_PATHS.map((relativePath) =>
      snapshotPath(dataset.mindRoot, relativePath),
    ),
  );

  return {
    mindRoot: dataset.mindRoot,
    entries,
  };
}

export function compareMindMaintenanceIntegritySnapshots(
  before: MindMaintenanceIntegritySnapshot,
  after: MindMaintenanceIntegritySnapshot,
  newlyChangedPaths: readonly string[],
): MindMaintenanceIntegrityResult {
  if (path.resolve(before.mindRoot) !== path.resolve(after.mindRoot)) {
    throw new Error('Integrity snapshots must refer to the same Mind repository root.');
  }

  const beforeByPath = new Map(before.entries.map((entry) => [entry.path, entry]));
  const changedSourcePaths: MindMaintenanceIntegrityPath[] = [];

  for (const afterEntry of after.entries) {
    const beforeEntry = beforeByPath.get(afterEntry.path);
    if (!beforeEntry) {
      changedSourcePaths.push(afterEntry.path);
      continue;
    }

    if (
      beforeEntry.exists !== afterEntry.exists
      || beforeEntry.sha256 !== afterEntry.sha256
    ) {
      changedSourcePaths.push(afterEntry.path);
    }
  }

  const allowedOutputs = new Set<string>(MIND_MAINTENANCE_REPORT_OUTPUTS);
  const unexpectedChangedPaths = newlyChangedPaths.filter(
    (changedPath) => !allowedOutputs.has(changedPath),
  );

  return {
    ok: changedSourcePaths.length === 0 && unexpectedChangedPaths.length === 0,
    changedSourcePaths,
    allowedOutputPaths: [...MIND_MAINTENANCE_REPORT_OUTPUTS],
    unexpectedChangedPaths,
  };
}
