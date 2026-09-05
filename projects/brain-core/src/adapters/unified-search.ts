import fs from 'node:fs';
import path from 'node:path';
import type {
  BrainCoreAgentTaskSummary,
  BrainCoreSchedulerJobSummary,
} from '../types/api.js';
import { readAgentTaskGraph } from './agent-ledger.js';
import { listAgentRuns } from './agent-runs.js';
import { getCapabilities } from './capabilities.js';
import { listLocalApps } from './local-apps.js';
import { listOrchestrators } from './orchestrators.js';
import { listRepos } from './repos.js';
import { listRuntimeReports } from './runtime-reports.js';
import { listSchedulerJobs } from './scheduler.js';
import { readServicesProjection } from './system-projections.js';

export type UnifiedSearchResultType =
  | 'ROUTE'
  | 'TASK'
  | 'EVIDENCE'
  | 'CONTEXT'
  | 'CONTINUATION'
  | 'REPORT'
  | 'SERVICE'
  | 'SCHEDULER_JOB'
  | 'CONSUMER'
  | 'OBSIDIAN_NOTE';
export type UnifiedSearchFreshness = 'CURRENT' | 'STALE' | 'DEGRADED' | 'UNAVAILABLE';

export interface UnifiedSearchResult {
  id: string;
  type: UnifiedSearchResultType;
  title: string;
  subtitle: string;
  source: string;
  freshness: UnifiedSearchFreshness;
  href: string | null;
  deepLink?: string;
  state?: string;
  status?: string;
}

export interface UnifiedSearchIndex {
  generatedAt: string;
  freshness: UnifiedSearchFreshness;
  results: UnifiedSearchResult[];
  sourceCount: number;
  failures: string[];
}

export interface UnifiedSearchResponse {
  id: 'brain-unified-search-v1';
  query: string;
  generatedAt: string;
  results: UnifiedSearchResult[];
  total: number;
  index: {
    freshness: UnifiedSearchFreshness;
    generatedAt: string | null;
    sourceCount: number;
    cacheHit: boolean;
    fullScanPerQuery: false;
  };
  failures: string[];
}

const MAX_RESULTS = 32;
const MAX_INDEX_RESULTS = 512;
const INDEX_TTL_MS = 15_000;
const KNOWN_OBSIDIAN_NOTES = [
  'home.md',
  'kanban.md',
  'tasks.md',
  'system/agent-context/00-start-here.md',
  'system/agent-context/00-current-context.md',
  'system/agent-context/00-memory-map.md',
  'system/brain-mind-bridge.md',
  'projects/README.md',
  'resources/index.md',
  'knowledge/ai.md',
  'knowledge/decisions.md',
] as const;

let cachedIndex: { expiresAt: number; value: UnifiedSearchIndex } | null = null;
let refreshPromise: Promise<UnifiedSearchIndex> | null = null;

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function result(input: Omit<UnifiedSearchResult, 'freshness'> & { freshness?: UnifiedSearchFreshness }): UnifiedSearchResult {
  return { freshness: 'CURRENT', ...input };
}

function safe<T>(label: string, read: () => T, failures: string[], fallback: T): T {
  try {
    return read();
  } catch {
    failures.push(label);
    return fallback;
  }
}

function obsidianResults(): UnifiedSearchResult[] {
  const vaultPath = process.env.BRAIN_CORE_OBSIDIAN_VAULT_PATH || path.join('/Users/Office/Repos/stevewesthoek/mind');
  const vaultName = process.env.BRAIN_CORE_OBSIDIAN_VAULT_NAME || path.basename(vaultPath);
  return KNOWN_OBSIDIAN_NOTES.flatMap((relativePath) => {
    const absolutePath = path.join(vaultPath, relativePath);
    if (!fs.existsSync(absolutePath)) return [];
    const title = path.basename(relativePath, '.md').replace(/[-_]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
    const deepLink = `obsidian://open?${new URLSearchParams({ vault: vaultName, file: relativePath }).toString()}`;
    return [result({
      id: `obsidian:${relativePath}`,
      type: 'OBSIDIAN_NOTE',
      title,
      subtitle: relativePath,
      source: 'bounded-obsidian-note-registry',
      freshness: 'CURRENT',
      href: null,
      deepLink,
    })];
  });
}

function taskResults(tasks: BrainCoreTaskLike[]): UnifiedSearchResult[] {
  return tasks.flatMap((task) => {
    const base = result({
      id: `task:${task.taskId}`,
      type: 'TASK',
      title: task.title,
      subtitle: `${task.taskId} · ${task.role}`,
      source: 'agent-task-graph',
      href: `/brain/tasks/${encodeURIComponent(task.taskId)}`,
      state: task.status,
      status: task.status,
    });
    const refs: UnifiedSearchResult[] = [];
    for (const ref of task.contextPackRefs ?? []) {
      refs.push(result({
        id: `context:${ref.packetId}`,
        type: 'CONTEXT',
        title: ref.packetId,
        subtitle: `${task.title} · context pack reference`,
        source: ref.source || 'agent-task-graph',
        freshness: freshness(ref.freshness),
        href: `/brain/tasks/${encodeURIComponent(task.taskId)}?context=${encodeURIComponent(ref.packetId)}`,
        state: ref.status,
      }));
    }
    for (const ref of task.evidencePacketRefs ?? []) {
      refs.push(result({
        id: `evidence:${ref.packetId}`,
        type: 'EVIDENCE',
        title: ref.packetId,
        subtitle: `${task.title} · evidence packet reference`,
        source: ref.source || 'agent-task-graph',
        freshness: freshness(ref.freshness),
        href: `/brain/tasks/${encodeURIComponent(task.taskId)}?evidence=${encodeURIComponent(ref.packetId)}`,
        state: ref.status,
      }));
    }
    return [base, ...refs];
  });
}

function freshness(value: unknown): UnifiedSearchFreshness {
  const normalized = text(value).toUpperCase();
  if (normalized === 'STALE') return 'STALE';
  if (normalized === 'DEGRADED') return 'DEGRADED';
  if (normalized === 'UNAVAILABLE') return 'UNAVAILABLE';
  return 'CURRENT';
}

type BrainCoreTaskLike = BrainCoreAgentTaskSummary;

function buildIndex(): UnifiedSearchIndex {
  const failures: string[] = [];
  const tasks = safe('tasks', () => readAgentTaskGraph().tasks, failures, [] as BrainCoreTaskLike[]);
  const jobs = safe('scheduler jobs', () => listSchedulerJobs(), failures, [] as BrainCoreSchedulerJobSummary[]);
  const reports = safe('runtime reports', () => listRuntimeReports(), failures, []);
  const apps = safe('local apps', () => listLocalApps(), failures, []);
  const orchestrators = safe('orchestrators', () => listOrchestrators(), failures, []);
  const repos = safe('repositories', () => listRepos(), failures, []);
  const capabilities = safe('capabilities', () => getCapabilities(), failures, null);
  const services = safe('services', () => readServicesProjection({ generatedAt: new Date().toISOString() }).data.services, failures, []);
  const now = new Date().toISOString();
  const entries: UnifiedSearchResult[] = [
    ...taskResults(tasks),
    ...safe('agent runs', () => listAgentRuns(), failures, []).slice(0, 64).map((run) => result({
      id: `continuation:${run.id}`,
      type: 'CONTINUATION',
      title: run.title,
      subtitle: `${run.source} · ${run.summary}`,
      source: 'agent-runs',
      href: `/brain/active-work?run=${encodeURIComponent(run.id)}`,
      state: run.status,
      status: run.status,
    })),
    ...jobs.map((job) => result({
      id: `scheduler:${job.id}`,
      type: 'SCHEDULER_JOB',
      title: job.name,
      subtitle: `${job.id} · ${job.status}`,
      source: 'scheduler',
      href: `/scheduler?job=${encodeURIComponent(job.id)}`,
      state: job.status,
      status: job.status,
    })),
    ...reports.map((report) => result({
      id: `report:${report.id}`,
      type: 'REPORT',
      title: `${report.id} runtime report`,
      subtitle: report.message,
      source: 'runtime-reports',
      freshness: report.status === 'available' ? 'CURRENT' : 'STALE',
      href: `/operations?report=${encodeURIComponent(report.id)}`,
      state: report.status,
    })),
    ...apps.map((app) => result({
      id: `service:${app.id}`,
      type: 'SERVICE',
      title: app.name,
      subtitle: `${app.id} · ${app.status}`,
      source: 'local-apps',
      href: `/local-apps?app=${encodeURIComponent(app.id)}`,
      state: app.status,
    })),
    ...services.map((service) => result({
      id: `service:${service.id}`,
      type: 'SERVICE',
      title: service.label,
      subtitle: `${service.id} · ${service.status}`,
      source: 'services-projection',
      href: '/operations',
      state: service.status,
    })),
    ...orchestrators.map((entry) => result({
      id: `consumer:${entry.id}`,
      type: 'CONSUMER',
      title: entry.name,
      subtitle: entry.description || `${entry.role || 'consumer'} · ${entry.status}`,
      source: 'orchestrators',
      href: '/brain/capability-routing',
      state: entry.status,
    })),
    ...repos.map((repo) => result({
      id: `consumer:repo:${repo.alias}`,
      type: 'CONSUMER',
      title: repo.alias,
      subtitle: 'repository reference',
      source: 'repositories',
      href: '/brain',
      state: repo.exists ? 'available' : 'unknown',
    })),
    ...(capabilities?.readEndpoints ?? []).slice(0, 96).map((endpoint) => result({
      id: `capability:${endpoint}`,
      type: 'CONSUMER',
      title: endpoint.replace(/^\//, '').replaceAll('/', ' · '),
      subtitle: 'Brain Core read capability',
      source: 'capabilities',
      href: endpoint.startsWith('/') ? endpoint : '/brain/capability-routing',
      state: 'available',
    })),
    ...obsidianResults(),
  ];
  return {
    generatedAt: now,
    freshness: failures.length === 0 ? 'CURRENT' : entries.length > 0 ? 'DEGRADED' : 'UNAVAILABLE',
    results: entries.slice(0, MAX_INDEX_RESULTS),
    sourceCount: 10 - failures.length,
    failures,
  };
}

export function refreshUnifiedSearchIndex(): Promise<UnifiedSearchIndex> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = Promise.resolve().then(buildIndex).then((value) => {
    cachedIndex = { expiresAt: Date.now() + INDEX_TTL_MS, value };
    refreshPromise = null;
    return value;
  }).catch((error) => {
    refreshPromise = null;
    throw error;
  });
  return refreshPromise;
}

export function startUnifiedSearchIndex(): void {
  void refreshUnifiedSearchIndex().catch(() => undefined);
}

function score(entry: UnifiedSearchResult, query: string): number {
  const needle = query.toLocaleLowerCase();
  const title = entry.title.toLocaleLowerCase();
  const haystack = `${title} ${entry.subtitle.toLocaleLowerCase()} ${entry.id.toLocaleLowerCase()}`;
  if (title === needle) return 1000;
  if (title.startsWith(needle)) return 800;
  if (title.includes(needle)) return 600;
  if (haystack.includes(needle)) return 400;
  return needle.split(/\s+/).every((part) => haystack.includes(part)) ? 200 : -1;
}

export async function searchUnified(queryInput: string): Promise<UnifiedSearchResponse> {
  const query = queryInput.trim().slice(0, 120);
  const cached = cachedIndex && cachedIndex.expiresAt > Date.now();
  const index = cached ? cachedIndex!.value : await refreshUnifiedSearchIndex();
  const results = query.length === 0
    ? []
    : index.results.map((entry) => ({ entry, score: score(entry, query) })).filter((item) => item.score >= 0)
      .sort((left, right) => right.score - left.score || left.entry.type.localeCompare(right.entry.type) || left.entry.title.localeCompare(right.entry.title))
      .slice(0, MAX_RESULTS)
      .map(({ entry }) => entry);
  return {
    id: 'brain-unified-search-v1',
    query,
    generatedAt: new Date().toISOString(),
    results,
    total: results.length,
    index: {
      freshness: index.freshness,
      generatedAt: index.generatedAt,
      sourceCount: index.sourceCount,
      cacheHit: Boolean(cached),
      fullScanPerQuery: false,
    },
    failures: index.failures,
  };
}

export function assertUnifiedSearchBounds(response: UnifiedSearchResponse): void {
  if (response.results.length > MAX_RESULTS) throw new Error('unified search result bound exceeded');
}
