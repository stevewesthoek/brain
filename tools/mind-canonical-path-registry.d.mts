export interface MindPathRegistryEntry {
  pathId: string;
  literal?: string;
  pattern?: string;
  type: string;
  readPolicy: string;
  writePolicy: string;
  activeDefaultAllowed: boolean;
  deletionPrerequisites: string[];
  [key: string]: unknown;
}

export interface MindPathRegistry {
  registryVersion: string;
  entries: MindPathRegistryEntry[];
}

export interface ClassifiedMindPathResult {
  classification: string;
  entry: MindPathRegistryEntry | null;
}

export function loadPathRegistry(options?: {
  registryPath?: string;
  repoRoot?: string;
}): MindPathRegistry;

export function classifyPath(
  registry: MindPathRegistry,
  mindPath: string,
): ClassifiedMindPathResult;

export function resolveCanonicalPath(
  registry: MindPathRegistry,
  pathId: string,
): string;
