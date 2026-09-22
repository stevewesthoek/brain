import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  classifyPath,
  loadPathRegistry,
  resolveCanonicalPath,
} from '../../../tools/mind-canonical-path-registry.mjs';

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(MODULE_DIRECTORY, '..', '..', '..');
const PACKAGED_ROOT = path.resolve(MODULE_DIRECTORY, '..', '..');
const ROOT = existsSync(path.join(PACKAGED_ROOT, 'operations', 'specs', 'infinite-brain-path-registry.json')) ? PACKAGED_ROOT : REPOSITORY_ROOT;
const REGISTRY = loadPathRegistry({ repoRoot: ROOT });

export interface ClassifiedMindPathEntry {
  pathId: string;
  type: string;
  readPolicy: string;
  writePolicy: string;
  activeDefaultAllowed: boolean;
}

export function resolveCanonicalMindPath(pathId: string): string {
  return resolveCanonicalPath(REGISTRY, pathId);
}

export function canonicalMindPrefix(pathId: string): string {
  return `${resolveCanonicalMindPath(pathId).replace(/\/+$/, '')}/`;
}

export function describeMindPath(mindPath: string): ClassifiedMindPathEntry | null {
  const result = classifyPath(REGISTRY, mindPath) as { entry?: ClassifiedMindPathEntry | null };
  return result.entry ?? null;
}
