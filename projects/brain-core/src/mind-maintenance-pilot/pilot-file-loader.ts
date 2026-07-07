import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const MIND_MAINTENANCE_PILOT_FILE_GROUPS = [
  {
    id: 'current-context',
    candidates: [
      'system/agent-context/00-current-context.md',
      'router/00-current-context.md',
    ],
  },
  {
    id: 'prochat-qa-memory-strategy',
    candidates: [
      'projects/prochat-qa-memory/STRATEGY-PLAN.md',
      'live/projects/prochat-qa-memory/STRATEGY-PLAN.md',
    ],
  },
  {
    id: 'prochat-product-strategy',
    candidates: [
      'organizations/prochat/brand/product-strategy.md',
      'wiki/organisations/prochat/brand/product-strategy.md',
    ],
  },
  {
    id: 'dashboard',
    candidates: [
      'system/reports/dashboard.md',
      'live/dashboard.md',
    ],
  },
  {
    id: 'automation-roadmap',
    candidates: [
      'system/automation-roadmap.md',
    ],
  },
] as const;

export type MindMaintenancePilotFileGroup = (typeof MIND_MAINTENANCE_PILOT_FILE_GROUPS)[number];
export type MindMaintenancePilotFileGroupId = MindMaintenancePilotFileGroup['id'];
export type MindMaintenancePilotFile = MindMaintenancePilotFileGroup['candidates'][number];

export const MIND_MAINTENANCE_TARGET_PILOT_FILES = MIND_MAINTENANCE_PILOT_FILE_GROUPS
  .map(group => group.candidates[0]) as readonly MindMaintenancePilotFile[];

export const MIND_MAINTENANCE_PILOT_FILES = MIND_MAINTENANCE_PILOT_FILE_GROUPS
  .map(group => group.candidates[1] ?? group.candidates[0]) as readonly MindMaintenancePilotFile[];

export const MIND_MAINTENANCE_COMPATIBLE_PILOT_FILES = MIND_MAINTENANCE_PILOT_FILE_GROUPS
  .flatMap(group => [...group.candidates]) as readonly MindMaintenancePilotFile[];

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

export function mindMaintenancePilotGroupForPath(value: string): MindMaintenancePilotFileGroup | null {
  return MIND_MAINTENANCE_PILOT_FILE_GROUPS.find(group =>
    (group.candidates as readonly string[]).includes(value),
  ) ?? null;
}

export function isMindMaintenancePilotFile(value: string): value is MindMaintenancePilotFile {
  return mindMaintenancePilotGroupForPath(value) !== null;
}

export function assertMindMaintenancePilotFile(value: string): asserts value is MindMaintenancePilotFile {
  if (!isMindMaintenancePilotFile(value)) {
    throw new Error(`Path is outside the bounded Mind maintenance pilot dataset: ${value}`);
  }
}

function assertExactlyOnePathPerPilotGroup(requestedPaths: readonly string[]): void {
  if (requestedPaths.length !== MIND_MAINTENANCE_PILOT_FILE_GROUPS.length) {
    throw new Error(
      `Mind maintenance pilot must load exactly ${MIND_MAINTENANCE_PILOT_FILE_GROUPS.length} files.`,
    );
  }

  const uniqueRequestedPaths = new Set(requestedPaths);
  if (uniqueRequestedPaths.size !== MIND_MAINTENANCE_PILOT_FILE_GROUPS.length) {
    throw new Error('Mind maintenance pilot paths must be unique.');
  }

  for (const requestedPath of requestedPaths) {
    assertMindMaintenancePilotFile(requestedPath);
  }

  for (const group of MIND_MAINTENANCE_PILOT_FILE_GROUPS) {
    const selected = requestedPaths.filter(requestedPath =>
      (group.candidates as readonly string[]).includes(requestedPath),
    );
    if (selected.length !== 1) {
      throw new Error(`Mind maintenance pilot must include exactly one path for group: ${group.id}`);
    }
  }
}

export async function loadMindMaintenancePilotDataset(
  mindRoot: string,
  requestedPaths: readonly string[] = MIND_MAINTENANCE_PILOT_FILES,
): Promise<LoadedMindMaintenancePilotDataset> {
  const resolvedMindRoot = assertAbsoluteMindRoot(mindRoot);
  assertExactlyOnePathPerPilotGroup(requestedPaths);

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
