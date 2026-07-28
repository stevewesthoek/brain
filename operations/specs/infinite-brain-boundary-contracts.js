import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PATH_REGISTRY_PATH = path.join(MODULE_DIR, 'infinite-brain-path-registry.json');

function loadPathRegistry() {
  return JSON.parse(readFileSync(PATH_REGISTRY_PATH, 'utf8'));
}

function resolvePath(registry, pathId) {
  const entry = registry.entries.find((candidate) => candidate.pathId === pathId);
  if (!entry || typeof entry.literal !== 'string') {
    throw new Error(`missing_path_registry_entry:${pathId}`);
  }
  return entry.literal;
}

const PATH_REGISTRY = loadPathRegistry();

export const MIND_CANONICAL_PATHS = Object.freeze({
  inboxNew: resolvePath(PATH_REGISTRY, 'inbox-new'),
  inboxFailed: resolvePath(PATH_REGISTRY, 'inbox-failed'),
  inboxRaw: resolvePath(PATH_REGISTRY, 'inbox-raw'),
  inboxProcessed: resolvePath(PATH_REGISTRY, 'inbox-processed'),
  projects: resolvePath(PATH_REGISTRY, 'projects'),
  organizations: resolvePath(PATH_REGISTRY, 'organizations'),
  repos: resolvePath(PATH_REGISTRY, 'repos'),
  people: resolvePath(PATH_REGISTRY, 'people'),
  faith: resolvePath(PATH_REGISTRY, 'faith'),
  knowledge: resolvePath(PATH_REGISTRY, 'knowledge'),
  resources: resolvePath(PATH_REGISTRY, 'resources'),
  history: resolvePath(PATH_REGISTRY, 'history'),
  agentContext: resolvePath(PATH_REGISTRY, 'agent-context'),
  kanban: resolvePath(PATH_REGISTRY, 'kanban-current-authority'),
  graphOutput: 'system/generated/graph',
});

export const MIND_PATH_POLICY = Object.freeze({
  blockedPrefixes: Object.freeze(['.git/', '.obsidian/', 'node_modules/', 'dist/', 'build/', 'coverage/', 'runtime/', 'logs/']),
  blockedExactPaths: Object.freeze(['.env']),
  blockedSuffixes: Object.freeze(['.env']),
  historicalPrefixes: Object.freeze(['archive/', 'history/', 'capture/inbox/', 'capture/failed/']),
  generatedPrefixes: Object.freeze(['.graphify-out/', 'graphify-out/', 'system/generated/graph/']),
  compatibilityPrefixes: Object.freeze(['live/', 'sources/', 'router/', 'wiki/', 'tasks.md', 'tasks/']),
});

export const MIND_PREVIEW_POLICY = Object.freeze({
  allowedTargets: Object.freeze([path.join(MIND_CANONICAL_PATHS.agentContext, 'current.md')]),
  blockedPrefixes: MIND_PATH_POLICY.blockedPrefixes,
  blockedExactPaths: MIND_PATH_POLICY.blockedExactPaths,
  blockedSuffixes: MIND_PATH_POLICY.blockedSuffixes,
  secretPrefixes: Object.freeze(['sk-', 'gh' + 'p_', 'AI' + 'za']),
});

export const MIND_CONTRACT = Object.freeze({
  currentSuccessPath: MIND_CANONICAL_PATHS.inboxNew.replace(/\/$/, ''),
  currentFailurePath: MIND_CANONICAL_PATHS.inboxFailed.replace(/\/$/, ''),
  activeCandidatePaths: Object.freeze([
    Object.freeze({
      path: MIND_CANONICAL_PATHS.inboxNew.replace(/\/$/, ''),
      kind: 'directory',
      era: 'target',
      purpose: 'human-first universal dump zone for new captures',
    }),
    Object.freeze({
      path: MIND_CANONICAL_PATHS.inboxFailed.replace(/\/$/, ''),
      kind: 'directory',
      era: 'target',
      purpose: 'human-first failed or blocked capture processing surface',
    }),
  ]),
  authorityLabels: Object.freeze([
    'active',
    'review-surface',
    'historical-only',
  ]),
  reviewSurfaces: Object.freeze([
    MIND_CANONICAL_PATHS.inboxProcessed.replace(/\/$/, ''),
    'wiki/log.md',
  ]),
  historicalOnlyPaths: Object.freeze([
    'capture/inbox',
    'capture/failed',
    'live',
    'wiki',
    'sources',
    'archive',
    'router',
    'graphify-out',
    '.graphify-out',
  ]),
});

export const MIND_MAINTENANCE_POLICY = Object.freeze({
  blockedPrefixes: MIND_PATH_POLICY.blockedPrefixes,
  blockedExactPaths: MIND_PATH_POLICY.blockedExactPaths,
  blockedSuffixes: MIND_PATH_POLICY.blockedSuffixes,
});

export const EXACT_SCOPE_APPROVAL_POLICY = Object.freeze({
  forbiddenModelFields: Object.freeze(['approvalId', 'approvedBy', 'approvedAt', 'expiresAt', 'authorization', 'files', 'rollback']),
  rollbackStrategy: 'restore-before-content',
});

export const SECRET_SURFACE_POLICY = Object.freeze({
  keyPattern: /(?:credential|authorization|api[_-]?key|secret|password|private[_-]?key|access[_-]?token|refresh[_-]?token)/i,
  valuePattern: /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|bearer\s+[a-z0-9._-]{16,}|(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s]{8,})/i,
});

export function loadBoundaryPathRegistry() {
  return structuredClone(PATH_REGISTRY);
}
