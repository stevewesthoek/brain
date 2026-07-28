#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const REGISTRY_PATH = 'operations/specs/infinite-brain-path-registry.json';
export const PATH_TYPES = new Set([
  'canonical-directory', 'canonical-file', 'compatibility-directory', 'compatibility-file',
  'historical-directory', 'historical-file', 'generated-output', 'external-integration',
  'future-target', 'forbidden-active-default',
]);
export const LIFECYCLE_STATES = new Set(['draft', 'candidate', 'active', 'compatibility', 'deprecated', 'retired', 'historical']);
const REQUIRED_CANONICAL = new Set(['inbox/new/', 'inbox/failed/', 'inbox/raw/', 'inbox/processed/', 'projects/', 'organizations/', 'repos/', 'people/', 'faith/', 'knowledge/', 'resources/', 'history/', 'system/agent-context/', 'kanban.md']);
const REQUIRED_NONCANONICAL = new Set(['capture/inbox/', 'capture/failed/', 'live/', 'sources/', 'router/', 'archive/', 'wiki/', 'wiki/log.md', 'tasks.md', 'tasks/', '.graphify-out/', 'graphify-out/', 'system/generated/graph/']);

function safeReference(reference) {
  return reference && ['brain', 'mind'].includes(reference.repository)
    && typeof reference.path === 'string' && reference.path.length > 0
    && !reference.path.startsWith('/') && !reference.path.includes('..') && !reference.path.includes('\\');
}

function refExists(repoRoot, reference) {
  const root = reference.repository === 'brain' ? repoRoot : resolve(repoRoot, '../mind');
  return existsSync(resolve(root, reference.path));
}

function pathKey(entry) {
  return entry.literal ? `literal:${entry.literal}` : `pattern:${entry.pattern}`;
}

function normalizedToken(token) {
  if (typeof token !== 'string' || token.length === 0 || token.includes('\\') || token.startsWith('/') || token.includes('..')) return null;
  return token.replace(/^\.\//, '');
}

function matchesPattern(pattern, token) {
  if (pattern === '0[1-9]-*/') return /^0[1-9]-[^/]+\/$/.test(token);
  return false;
}

export function classifyPath(registry, token) {
  const normalized = normalizedToken(token);
  if (!normalized) return { classification: 'unknown', entry: null };
  const candidates = [normalized, normalized.endsWith('/') ? normalized.slice(0, -1) : `${normalized}/`];
  const exact = registry.entries
    .filter((entry) => entry.literal && candidates.some((candidate) => candidate === entry.literal || (entry.literal.endsWith('/') && candidate.startsWith(entry.literal))))
    .sort((left, right) => right.literal.length - left.literal.length)[0];
  if (exact) return { classification: exact.type, entry: exact };
  const patterned = registry.entries.find((entry) => entry.pattern && candidates.some((candidate) => matchesPattern(entry.pattern, candidate)));
  return patterned ? { classification: patterned.type, entry: patterned } : { classification: 'unknown', entry: null };
}

export function resolveCanonicalPath(registry, pathId) {
  const entry = registry.entries.find((candidate) => candidate.pathId === pathId);
  if (!entry || !entry.type.startsWith('canonical-')) throw new Error('canonical_path_not_found');
  return entry.literal;
}

export function assertActiveDefault(registry, token) {
  const { entry } = classifyPath(registry, token);
  if (!entry || !entry.activeDefaultAllowed) throw new Error('forbidden_active_default');
  return entry;
}

export function deletionPrerequisites(registry, token) {
  const { entry } = classifyPath(registry, token);
  if (!entry) throw new Error('unknown_path');
  return [...entry.deletionPrerequisites];
}

export function validatePathRegistry(registry, { repoRoot = process.cwd() } = {}) {
  const errors = [];
  if (!/^\d+\.\d+\.\d+$/.test(registry?.registryVersion ?? '')) errors.push('registryVersion must be semver');
  if (!Array.isArray(registry?.entries) || registry.entries.length === 0) return [...errors, 'entries must be non-empty'];
  const ids = new Set();
  const keys = new Map();
  for (const entry of registry.entries) {
    const id = entry?.pathId || '<missing-path-id>';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry?.pathId ?? '')) errors.push(`${id} has invalid pathId`);
    if (ids.has(entry?.pathId)) errors.push(`${id} is duplicated`);
    ids.add(entry?.pathId);
    if (!PATH_TYPES.has(entry?.type)) errors.push(`${id} has invalid type`);
    if (!LIFECYCLE_STATES.has(entry?.lifecycleState)) errors.push(`${id} has invalid lifecycleState`);
    if ((typeof entry?.literal === 'string') === (typeof entry?.pattern === 'string')) errors.push(`${id} requires exactly one literal or pattern`);
    const key = pathKey(entry ?? {});
    if (keys.has(key)) errors.push(`${id} duplicates ${keys.get(key)}`);
    keys.set(key, id);
    const required = ['canonicalReplacement', 'executableConsumers', 'writePolicy', 'readPolicy', 'activeDefaultAllowed', 'compatibilityReason', 'deletionPrerequisites', 'deployedState', 'observedState', 'verifiedState', 'notes'];
    required.forEach((field) => { if (!(field in (entry ?? {}))) errors.push(`${id} is missing ${field}`); });
    if (!safeReference(entry?.normativeSource) || !refExists(repoRoot, entry.normativeSource)) errors.push(`${id} has a missing or invalid normativeSource`);
    if (!Array.isArray(entry?.executableConsumers) || !Array.isArray(entry?.deletionPrerequisites)) errors.push(`${id} consumers and deletionPrerequisites must be arrays`);
    if (entry?.activeDefaultAllowed && !entry.type.startsWith('canonical-')) errors.push(`${id} non-canonical path cannot be an active default`);
    if (entry?.type.startsWith('canonical-') && !entry.activeDefaultAllowed) errors.push(`${id} canonical path must be eligible as an active default`);
    if (entry?.type === 'future-target' && entry.activeDefaultAllowed) errors.push(`${id} future target cannot be current authority`);
    if (entry?.type === 'generated-output' && entry.readPolicy !== 'generated-read') errors.push(`${id} generated output must remain non-authoritative`);
    if (entry?.lifecycleState === 'candidate' && entry.type === 'external-integration' && (entry.deployedState !== 'unverified' || entry.verifiedState !== 'unverified')) {
      errors.push(`${id} candidate integration cannot imply deployed or verified state`);
    }
    if (entry?.normativeSourceStatus === 'unresolved' && !entry.notes?.includes('unresolved')) errors.push(`${id} unresolved normative source requires explicit note`);
  }
  const literalEntries = registry.entries.filter((entry) => entry.literal);
  for (const literal of REQUIRED_CANONICAL) {
    const entry = literalEntries.find((candidate) => candidate.literal === literal);
    if (!entry || !entry.type.startsWith('canonical-')) errors.push(`missing canonical entry ${literal}`);
  }
  for (const literal of REQUIRED_NONCANONICAL) if (!literalEntries.some((entry) => entry.literal === literal)) errors.push(`missing required noncanonical entry ${literal}`);
  if (!registry.entries.some((entry) => entry.pattern === '0[1-9]-*/')) errors.push('missing numbered root pattern');
  const wikiRoot = registry.entries.find((entry) => entry.pathId === 'wiki-root');
  if (wikiRoot?.activeDefaultAllowed) errors.push('ordinary wiki root cannot be canonical');
  return errors;
}

export function loadPathRegistry({ registryPath = REGISTRY_PATH, repoRoot = process.cwd() } = {}) {
  return JSON.parse(readFileSync(resolve(repoRoot, registryPath), 'utf8'));
}

function main() {
  const [command = 'validate', argument] = process.argv.slice(2);
  const registry = loadPathRegistry();
  if (command === 'validate') {
    const errors = validatePathRegistry(registry);
    if (errors.length) {
      process.stdout.write(`registry=fail\nerrors=${errors.length}\n`);
      errors.forEach((error) => process.stdout.write(`error=${error}\n`));
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`registry=pass\nregistry_version=${registry.registryVersion}\npaths=${registry.entries.length}\nnetwork_access=false\nmind_content_read=false\nresult=pass\n`);
    return;
  }
  if (command === 'classify') {
    const result = classifyPath(registry, argument);
    process.stdout.write(`classification=${result.classification}\npath_id=${result.entry?.pathId ?? 'none'}\n`);
    return;
  }
  if (command === 'resolve') {
    process.stdout.write(`path=${resolveCanonicalPath(registry, argument)}\n`);
    return;
  }
  if (command === 'deletion-prerequisites') {
    process.stdout.write(`prerequisites=${deletionPrerequisites(registry, argument).join(',')}\n`);
    return;
  }
  if (command === 'export') {
    process.stdout.write(`${JSON.stringify({ registryVersion: registry.registryVersion, entries: registry.entries })}\n`);
    return;
  }
  if (command === 'describe') {
    const result = classifyPath(registry, argument);
    process.stdout.write(`${JSON.stringify({ classification: result.classification, entry: result.entry })}\n`);
    return;
  }
  throw new Error('unsupported_command');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) { process.stderr.write(`result=fail\nreason=${error.message}\n`); process.exitCode = 1; }
}
