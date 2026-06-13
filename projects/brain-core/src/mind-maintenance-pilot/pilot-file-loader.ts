import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const MIND_MAINTENANCE_PILOT_FILES = [
  'router/00-current-context.md',
  'live/projects/prochat-qa-memory/STRATEGY-PLAN.md',
  'wiki/organisations/prochat/brand/prochat-os-strategy.md',
  'live/dashboard.md',
  'system/automation-roadmap.md',
] as const;

export type MindMaintenancePilotFile = (typeof MIND_MAINTENANCE_PILOT_FILES)[number];

export const MIND_MAINTENANCE_REPORT_OUTPUTS = [
  'system/reports/maintenance-latest.json',
  'system/reports/maintenance-latest.md',
] as const;

export interface MindMaintenancePilotConfig {
  enabled: false;
  mode: 'report-only';
  dataset: 'bounded-five-file-pilot';
  allowContentWrites: false;
  maxFiles: 5;
  maxFindingsPerDetector: 5;
  minimumConfidence: 0.7;
  aiAssist: 'when-ambiguous';
  detectors: {
    'stale-page': true;
    'completed-but-active': true;
    'source-gap': true;
    'duplicate-candidate': false;
    'contradiction-candidate': false;
    'capture-promotion': false;
  };
}

export const MIND_MAINTENANCE_PILOT_CONFIG: MindMaintenancePilotConfig = {
  enabled: false,
  mode: 'report-only',
  dataset: 'bounded-five-file-pilot',
  allowContentWrites: false,
  maxFiles: 5,
  maxFindingsPerDetector: 5,
  minimumConfidence: 0.7,
  aiAssist: 'when-ambiguous',
  detectors: {
    'stale-page': true,
    'completed-but-active': true,
    'source-gap': true,
    'duplicate-candidate': false,
    'contradiction-candidate': false,
    'capture-promotion': false,
  },
};

export interface LoadedMindMaintenancePilotFile {
  path: MindMaintenancePilotFile;
  absolutePath: string;
  content: string;
}

export interface LoadedMindMaintenancePilotDataset {
  mindRoot: string;
  files: LoadedMindMaintenancePilotFile[];
}

function assertAbsoluteMindRoot(mindRoot: string): string {
  if (!path.isAbsolute(mindRoot)) {
    throw new Error('Mind maintenance pilot requires an absolute Mind repository root.');
  }

  return path.resolve(mindRoot);
}

function resolvePilotPath(mindRoot: string, relativePath: MindMaintenancePilotFile): string {
  const absolutePath = path.resolve(mindRoot, relativePath);
  const relativeFromRoot = path.relative(mindRoot, absolutePath);

  if (
    relativeFromRoot.startsWith('..')
    || path.isAbsolute(relativeFromRoot)
    || relativeFromRoot.split(path.sep).includes('..')
  ) {
    throw new Error(`Pilot path escapes the Mind repository root: ${relativePath}`);
  }

  return absolutePath;
}

export function isMindMaintenancePilotFile(value: string): value is MindMaintenancePilotFile {
  return MIND_MAINTENANCE_PILOT_FILES.includes(value as MindMaintenancePilotFile);
}

export function assertMindMaintenancePilotFile(value: string): asserts value is MindMaintenancePilotFile {
  if (!isMindMaintenancePilotFile(value)) {
    throw new Error(`Path is outside the bounded Mind maintenance pilot dataset: ${value}`);
  }
}

export async function loadMindMaintenancePilotDataset(
  mindRoot: string,
  requestedPaths: readonly string[] = MIND_MAINTENANCE_PILOT_FILES,
): Promise<LoadedMindMaintenancePilotDataset> {
  const resolvedMindRoot = assertAbsoluteMindRoot(mindRoot);

  if (requestedPaths.length !== MIND_MAINTENANCE_PILOT_FILES.length) {
    throw new Error(
      `Mind maintenance pilot must load exactly ${MIND_MAINTENANCE_PILOT_FILES.length} files.`,
    );
  }

  const uniqueRequestedPaths = new Set(requestedPaths);
  if (uniqueRequestedPaths.size !== MIND_MAINTENANCE_PILOT_FILES.length) {
    throw new Error('Mind maintenance pilot paths must be unique.');
  }

  for (const requiredPath of MIND_MAINTENANCE_PILOT_FILES) {
    if (!uniqueRequestedPaths.has(requiredPath)) {
      throw new Error(`Mind maintenance pilot is missing required path: ${requiredPath}`);
    }
  }

  const files = await Promise.all(
    requestedPaths.map(async (requestedPath): Promise<LoadedMindMaintenancePilotFile> => {
      assertMindMaintenancePilotFile(requestedPath);
      const absolutePath = resolvePilotPath(resolvedMindRoot, requestedPath);
      const content = await readFile(absolutePath, 'utf8');

      return {
        path: requestedPath,
        absolutePath,
        content,
      };
    }),
  );

  return {
    mindRoot: resolvedMindRoot,
    files,
  };
}
