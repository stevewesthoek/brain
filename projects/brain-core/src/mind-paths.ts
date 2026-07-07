export type MindPathKind = 'file' | 'directory';
export type MindPathEra = 'target' | 'legacy-fallback';

export interface MindPathCandidate {
  path: string;
  kind: MindPathKind;
  era: MindPathEra;
  purpose: string;
}

export interface MindPathCompatibilityGroup {
  id: string;
  purpose: string;
  candidates: readonly MindPathCandidate[];
}

export const MIND_TARGET_PATHS = {
  tasks: 'tasks.md',
  inboxNew: 'inbox/new',
  inboxRaw: 'inbox/raw',
  inboxProcessed: 'inbox/processed',
  inboxFailed: 'inbox/failed',
  projects: 'projects',
  organizations: 'organizations',
  repos: 'repos',
  people: 'people',
  faith: 'faith',
  knowledge: 'knowledge',
  resources: 'resources',
  history: 'history',
  agentContext: 'system/agent-context',
  graphOutput: 'system/generated/graph',
} as const;

export const MIND_LEGACY_PATHS = {
  kanban: 'kanban.md',
  captureInbox: 'capture/inbox',
  captureFailed: 'capture/failed',
  live: 'live',
  wiki: 'wiki',
  wikiLog: 'wiki/log.md',
  sources: 'sources',
  archive: 'archive',
  router: 'router',
  graphifyOut: 'graphify-out',
  legacyGraphifyOut: '.graphify-out',
} as const;

export const MIND_INBOX_NEW_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxNew,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first universal dump zone for new captures',
  },
  {
    path: MIND_LEGACY_PATHS.captureInbox,
    kind: 'directory',
    era: 'legacy-fallback',
    purpose: 'legacy Save-to-Mind unprocessed capture inbox',
  },
] as const;

export const MIND_FAILED_INBOX_CANDIDATES: readonly MindPathCandidate[] = [
  {
    path: MIND_TARGET_PATHS.inboxFailed,
    kind: 'directory',
    era: 'target',
    purpose: 'human-first failed or blocked capture processing surface',
  },
  {
    path: MIND_LEGACY_PATHS.captureFailed,
    kind: 'directory',
    era: 'legacy-fallback',
    purpose: 'legacy failed capture routing target',
  },
] as const;

export const MIND_STRUCTURE_COMPATIBILITY_GROUPS: readonly MindPathCompatibilityGroup[] = [
  {
    id: 'tasks',
    purpose: 'human task source of truth',
    candidates: [
      { path: MIND_TARGET_PATHS.tasks, kind: 'file', era: 'target', purpose: 'human task source of truth' },
      { path: MIND_LEGACY_PATHS.kanban, kind: 'file', era: 'legacy-fallback', purpose: 'legacy Kanban task source of truth' },
    ],
  },
  {
    id: 'inbox-new',
    purpose: 'unprocessed capture intake',
    candidates: MIND_INBOX_NEW_CANDIDATES,
  },
  {
    id: 'inbox-failed',
    purpose: 'failed capture intake routing',
    candidates: MIND_FAILED_INBOX_CANDIDATES,
  },
  {
    id: 'inbox-raw',
    purpose: 'immutable raw capture/source preservation area',
    candidates: [
      { path: MIND_TARGET_PATHS.inboxRaw, kind: 'directory', era: 'target', purpose: 'immutable raw capture/source preservation area' },
      { path: MIND_LEGACY_PATHS.captureInbox, kind: 'directory', era: 'legacy-fallback', purpose: 'legacy raw capture source location during migration' },
    ],
  },
  {
    id: 'inbox-processed',
    purpose: 'processed capture proposals and review surfaces',
    candidates: [
      { path: MIND_TARGET_PATHS.inboxProcessed, kind: 'directory', era: 'target', purpose: 'Brain-generated processed proposals and review surfaces' },
      { path: MIND_LEGACY_PATHS.wikiLog, kind: 'file', era: 'legacy-fallback', purpose: 'legacy proposal and maintenance review surface' },
    ],
  },
  {
    id: 'projects',
    purpose: 'active projects and deliverables',
    candidates: [
      { path: MIND_TARGET_PATHS.projects, kind: 'directory', era: 'target', purpose: 'active projects and deliverables' },
      { path: 'live/projects', kind: 'directory', era: 'legacy-fallback', purpose: 'legacy active project state' },
    ],
  },
  {
    id: 'organizations',
    purpose: 'businesses, ministries, non-profits, and long-lived entities',
    candidates: [
      { path: MIND_TARGET_PATHS.organizations, kind: 'directory', era: 'target', purpose: 'businesses, ministries, non-profits, and long-lived entities' },
      { path: 'wiki/organisations', kind: 'directory', era: 'legacy-fallback', purpose: 'legacy organisation knowledge root' },
    ],
  },
  {
    id: 'repos',
    purpose: 'code repositories, apps, and repo-specific memory',
    candidates: [
      { path: MIND_TARGET_PATHS.repos, kind: 'directory', era: 'target', purpose: 'code repositories, apps, and repo-specific memory' },
    ],
  },
  {
    id: 'people',
    purpose: 'people connected to work, faith, clients, teams, books, and research',
    candidates: [
      { path: MIND_TARGET_PATHS.people, kind: 'directory', era: 'target', purpose: 'people connected to work, faith, clients, teams, books, and research' },
    ],
  },
  {
    id: 'faith',
    purpose: 'Bible, theology, apologetics, ministry, studies, and faith resources',
    candidates: [
      { path: MIND_TARGET_PATHS.faith, kind: 'directory', era: 'target', purpose: 'Bible, theology, apologetics, ministry, studies, and faith resources' },
      { path: 'sources/research/bible', kind: 'directory', era: 'legacy-fallback', purpose: 'legacy Bible research source area' },
      { path: 'sources/research/theology', kind: 'directory', era: 'legacy-fallback', purpose: 'legacy theology research source area' },
      { path: 'sources/research/apologetics', kind: 'directory', era: 'legacy-fallback', purpose: 'legacy apologetics research source area' },
    ],
  },
  {
    id: 'knowledge',
    purpose: 'durable non-faith understanding and best practices',
    candidates: [
      { path: MIND_TARGET_PATHS.knowledge, kind: 'directory', era: 'target', purpose: 'durable non-faith understanding and best practices' },
      { path: MIND_LEGACY_PATHS.wiki, kind: 'directory', era: 'legacy-fallback', purpose: 'legacy durable knowledge root' },
    ],
  },
  {
    id: 'resources',
    purpose: 'non-faith source and reference material',
    candidates: [
      { path: MIND_TARGET_PATHS.resources, kind: 'directory', era: 'target', purpose: 'non-faith source and reference material' },
      { path: MIND_LEGACY_PATHS.sources, kind: 'directory', era: 'legacy-fallback', purpose: 'legacy source/reference root' },
    ],
  },
  {
    id: 'history',
    purpose: 'completed, superseded, old, inactive, or historical material',
    candidates: [
      { path: MIND_TARGET_PATHS.history, kind: 'directory', era: 'target', purpose: 'completed, superseded, old, inactive, or historical material' },
      { path: MIND_LEGACY_PATHS.archive, kind: 'directory', era: 'legacy-fallback', purpose: 'legacy archive root' },
    ],
  },
  {
    id: 'agent-context',
    purpose: 'AI and coding-agent context entrypoints',
    candidates: [
      { path: MIND_TARGET_PATHS.agentContext, kind: 'directory', era: 'target', purpose: 'human-first agent context under system' },
      { path: MIND_LEGACY_PATHS.router, kind: 'directory', era: 'legacy-fallback', purpose: 'legacy router and AI startup context root' },
    ],
  },
] as const;

export function mindPathCandidatePrefixes(candidates: readonly MindPathCandidate[]): string[] {
  return candidates.map(candidate => `${candidate.path.replace(/\/+$/g, '')}/`);
}

export function isSafeRelativeMindPath(value: string): boolean {
  const normalized = value.replace(/\\/g, '/');
  return normalized === pathNormalizePosix(value)
    && normalized.length > 0
    && !normalized.includes('\0')
    && !normalized.includes('*')
    && !normalized.includes('?')
    && !normalized.includes('[')
    && !normalized.includes(']')
    && !normalized.startsWith('../')
    && !normalized.includes('/../')
    && normalized !== '..'
    && normalized !== '.'
    && !normalized.startsWith('/');
}

export function isSafeMindInboxCapturePath(capturePath: string | null): capturePath is string {
  if (!capturePath || !isSafeRelativeMindPath(capturePath)) return false;
  const normalized = pathNormalizePosix(capturePath);
  return mindPathCandidatePrefixes(MIND_INBOX_NEW_CANDIDATES)
    .some(prefix => normalized.startsWith(prefix) && normalized.length > prefix.length);
}

export function buildMindInboxCapturePath(captureName: string, inboxRelativePath: string = MIND_LEGACY_PATHS.captureInbox): string | null {
  if (!isSafeCaptureName(captureName)) return null;
  const normalizedInboxPath = pathNormalizePosix(inboxRelativePath).replace(/\/+$/g, '');
  if (!isSafeRelativeMindPath(normalizedInboxPath)) return null;
  return `${normalizedInboxPath}/${captureName}`;
}

function isSafeCaptureName(name: string): boolean {
  return name.trim().length > 0
    && name !== '.'
    && name !== '..'
    && !name.includes('/')
    && !name.includes('\\')
    && !name.includes('\0')
    && !name.includes('*')
    && !name.includes('?')
    && !name.includes('[')
    && !name.includes(']');
}

function pathNormalizePosix(value: string): string {
  const normalized = value.replace(/\\/g, '/');
  const parts: string[] = [];
  for (const part of normalized.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      parts.push('..');
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}



export const MIND_PROJECT_WRITE_PREFIXES = ['projects/', 'live/'] as const;
export const MIND_KNOWLEDGE_WRITE_PREFIXES = ['knowledge/', 'wiki/'] as const;
export const MIND_RESOURCE_WRITE_PREFIXES = ['resources/', 'sources/'] as const;
export const MIND_HISTORY_WRITE_PREFIXES = ['history/', 'archive/'] as const;
export const MIND_ORGANIZATION_WRITE_PREFIXES = ['organizations/', 'wiki/organisations/'] as const;
export const MIND_FAITH_WRITE_PREFIXES = [
  'faith/',
  'sources/research/bible/',
  'sources/research/theology/',
  'sources/research/apologetics/',
] as const;

export const MIND_DURABLE_WRITE_PREFIXES = [
  ...MIND_PROJECT_WRITE_PREFIXES,
  ...MIND_KNOWLEDGE_WRITE_PREFIXES,
  ...MIND_RESOURCE_WRITE_PREFIXES,
  ...MIND_HISTORY_WRITE_PREFIXES,
  ...MIND_ORGANIZATION_WRITE_PREFIXES,
  ...MIND_FAITH_WRITE_PREFIXES,
] as const;

export function normalizeExactMindMarkdownPathForPrefixes(
  value: string,
  prefixes: readonly string[],
): string | null {
  if (!value || value.includes('\\') || value.includes('\0')) return null;
  if (!value.endsWith('.md') || value.endsWith('/')) return null;
  if (!isSafeRelativeMindPath(value)) return null;
  const normalized = pathNormalizePosix(value);
  if (normalized !== value.replace(/\\/g, '/')) return null;
  return prefixes.some(prefix => normalized.startsWith(prefix) && normalized.length > prefix.length)
    ? normalized
    : null;
}



export const MIND_TASK_FILE_CANDIDATES = [MIND_TARGET_PATHS.tasks, MIND_LEGACY_PATHS.kanban] as const;
export const MIND_PROJECT_PAGE_PREFIXES = ['projects/', 'live/projects/'] as const;
export const MIND_COMPLETED_PROJECT_ARCHIVE_PREFIXES = ['history/projects/', 'archive/projects/'] as const;

export function isMindTaskFilePath(value: string): value is typeof MIND_TASK_FILE_CANDIDATES[number] {
  return MIND_TASK_FILE_CANDIDATES.includes(value as typeof MIND_TASK_FILE_CANDIDATES[number]);
}
