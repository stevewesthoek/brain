import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type MindRegistryPathType = 'canonical-directory' | 'canonical-file' | 'compatibility-directory' | 'compatibility-file' | 'historical-directory' | 'future-target' | 'generated-output' | 'external-integration';

export interface MindRegistryPathEntry {
  pathId: string;
  type: MindRegistryPathType;
  literal?: string;
  pattern?: string;
  writePolicy: string;
  readPolicy: string;
  activeDefaultAllowed: boolean;
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..');
const RESOLVER = path.join(BRAIN_ROOT, 'tools', 'mind-canonical-path-registry.mjs');

function invokeResolver(command: 'export' | 'resolve' | 'describe', argument?: string): string {
  return execFileSync(process.execPath, [RESOLVER, command, ...(argument === undefined ? [] : [argument])], {
    cwd: BRAIN_ROOT,
    encoding: 'utf8',
    env: { PATH: process.env.PATH ?? '' },
  }).trim();
}

export function loadMindPathRegistry(): { registryVersion: string; entries: MindRegistryPathEntry[] } {
  const parsed = JSON.parse(invokeResolver('export')) as { registryVersion?: unknown; entries?: unknown };
  if (typeof parsed.registryVersion !== 'string' || !Array.isArray(parsed.entries)) throw new Error('invalid_canonical_path_registry');
  return { registryVersion: parsed.registryVersion, entries: parsed.entries as MindRegistryPathEntry[] };
}

export function resolveCanonicalMindPath(pathId: string): string {
  const result = invokeResolver('resolve', pathId).match(/^path=(.+)$/m)?.[1];
  if (!result) throw new Error('canonical_path_not_found');
  return result;
}

export function describeMindPath(token: string): MindRegistryPathEntry | null {
  const parsed = JSON.parse(invokeResolver('describe', token)) as { entry?: MindRegistryPathEntry | null };
  return parsed.entry ?? null;
}

export function isRegisteredCompatibilityRead(token: string): boolean {
  const entry = describeMindPath(token);
  return Boolean(entry && !entry.activeDefaultAllowed && ['compatibility-read', 'historical-read', 'scoped-authoritative-read'].includes(entry.readPolicy));
}

export function isCanonicalActivePath(token: string): boolean {
  return describeMindPath(token)?.activeDefaultAllowed === true;
}

export function joinMindPath(rootPath: string, leaf: string): string {
  return `${rootPath.replace(/\/+$/, '')}/${leaf.replace(/^\/+/, '')}`;
}
