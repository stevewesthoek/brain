import { execFile as execFileCallback } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  AgentModeSqliteStateStore,
  type AgentModeEventSourceConfig,
  type AgentModeEventSourceObservationResult,
  type AgentModeSchedulerEventInput,
} from './sqlite-state-store.js';
import { computeFreshness, effectiveStatus } from '../adapters/infrastructure-observation-runtime.mjs';
import { readInfrastructureCatalog, readInfrastructureHealth } from '../adapters/infrastructure-plane.mjs';

const execFile = promisify(execFileCallback);

export const GIT_REPOSITORY_REVISION_SOURCE = 'git.repository.revision' as const;
export const REPOSITORY_COMMIT_OBSERVED_EVENT = 'repository.commit.observed' as const;
export const BRAIN_TASK_LIFECYCLE_SOURCE = 'brain.task.lifecycle' as const;
export const TASK_LIFECYCLE_OBSERVED_EVENT = 'task.lifecycle.observed' as const;
export const INFRASTRUCTURE_HOST_HEALTH_SOURCE = 'infrastructure.host-health' as const;
export const INFRASTRUCTURE_HOST_HEALTH_CHANGED_EVENT = 'infrastructure.host-health.changed' as const;
export const CI_WORKFLOW_RUN_SOURCE = 'ci.workflow-run' as const;
export const CI_WORKFLOW_STARTED_EVENT = 'ci.workflow.started' as const;
export const CI_WORKFLOW_COMPLETED_EVENT = 'ci.workflow.completed' as const;
export const GITHUB_ACTIONS_PROVIDER = 'github-actions' as const;

export type EventSourceObservationContext = {
  sourceId: string;
  previousWatermark: string | null;
  observedAt: string;
  catchUpLimit: number;
  debounceWindowMs: number;
  scanLimit?: number;
};

export type EventSourceObservation<TEvent> = {
  sourceId: string;
  sourceType: string;
  previousWatermark: string | null;
  observedWatermark: string | null;
  events: TEvent[];
  hasMore: boolean;
  observedAt: string;
  status: 'bootstrapped' | 'advanced' | 'unchanged' | 'diverged';
};

export interface EventSourceAdapter<TEvent = unknown> {
  readonly sourceId: string;
  readonly sourceType: string;
  observe(context: EventSourceObservationContext): Promise<EventSourceObservation<TEvent>>;
}

export type GitRepositoryCommitEvent = {
  commitSha: string;
  parentSha: string | null;
  author: string;
  subject: string;
  committedAt: string;
  ref: string;
  observationSequence: number;
  debounceGroupId: string;
};

export type BrainTaskLifecycleEvent = {
  sourceEventId: string;
  sourceSequence: number;
  entityType: 'task' | 'run' | 'attempt';
  entityId: string;
  lifecycleEventType: string;
  occurredAt: string;
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
};

export type HostHealthObservation = {
  observationId: string;
  resourceId: string;
  providerId: string;
  bindingId: string;
  observedAt: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  freshness: 'fresh' | 'stale' | 'unknown';
  conditionCodes: string[];
};

export type HostHealthObservationReader = (now: Date) => Promise<{ observations: HostHealthObservation[]; expectedBindingKeys: string[] }>;

export type HostHealthSemanticState = HostHealthObservation & { fingerprint: string; lastTransitionAt: string | null };
export type HostHealthTransitionEvent = HostHealthObservation & {
  fingerprint: string;
  previousStatus: HostHealthObservation['status'];
  previousFreshness: HostHealthObservation['freshness'];
  previousConditionCodes: string[];
};

export type CiWorkflowRunStatus = 'queued' | 'in_progress' | 'completed';
export type CiWorkflowRunConclusion = 'success' | 'failure' | 'cancelled' | 'timed_out' | 'neutral' | 'skipped' | 'action_required' | 'unknown' | null;

/** Provider-neutral, bounded CI workflow-run observation. Provider payload is never retained. */
export type CiWorkflowRunObservation = {
  providerId: string;
  repositoryRef: string;
  workflowId: string;
  workflowName: string;
  runId: string;
  attempt: number;
  headSha: string;
  status: CiWorkflowRunStatus;
  conclusion: CiWorkflowRunConclusion;
  queuedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string | null;
  observedAt: string;
};

export type CiWorkflowSemanticEvent = CiWorkflowRunObservation & {
  semanticType: typeof CI_WORKFLOW_STARTED_EVENT | typeof CI_WORKFLOW_COMPLETED_EVENT;
  previousStatus: CiWorkflowRunStatus | null;
  previousConclusion: CiWorkflowRunConclusion;
};

export type CiWorkflowRunReader = {
  read(input: { repositoryRef: string; workflowId?: string; providerCursor: string | null; maxItems: number; maxPages: number; observedAt?: string }): Promise<{
    providerId: string;
    repositoryRef: string;
    runs: CiWorkflowRunObservation[];
    nextProviderCursor: string | null;
    hasMore: boolean;
  }>;
};

export type GitHubActionsWorkflowRunRecord = {
  id: string | number;
  workflow_id: string | number;
  name?: unknown;
  run_attempt?: unknown;
  head_sha?: unknown;
  status?: unknown;
  conclusion?: unknown;
  created_at?: unknown;
  run_started_at?: unknown;
  updated_at?: unknown;
  completed_at?: unknown;
};

export type GitHubActionsWorkflowRunPageReader = {
  readPage(input: { repositoryRef: string; workflowId?: string; providerCursor: string | null; perPage: number }): Promise<{
    repositoryRef: string;
    runs: readonly GitHubActionsWorkflowRunRecord[];
    nextProviderCursor: string | null;
    hasMore: boolean;
  }>;
};

const CI_MAX_CURSOR_BYTES = 64 * 1024;
const CI_MAX_STATES = 500;
const CI_MAX_ITEMS = 500;
const CI_MAX_PAGES = 8;
const CI_STATUS_RANK: Record<CiWorkflowRunStatus, number> = { queued: 0, in_progress: 1, completed: 2 };
const CI_CONCLUSIONS = new Set(['success', 'failure', 'cancelled', 'timed_out', 'neutral', 'skipped', 'action_required']);

type CiWorkflowRunState = CiWorkflowRunObservation & { fingerprint: string; lastEmittedPhase: 'started' | 'completed' | null };
type CiWorkflowCursor = { version: 1; bootstrapping: boolean; providerCursor: string | null; pendingRuns: CiWorkflowRunObservation[]; states: CiWorkflowRunState[] };

function ciBoundedText(value: unknown, limit: number, label: string): string {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error(`GitHub Actions ${label} is malformed`);
  const text = boundedText(String(value), limit);
  if (!text) throw new Error(`GitHub Actions ${label} is empty`);
  return text;
}

function ciOptionalIso(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`GitHub Actions ${label} is malformed`);
  return new Date(value).toISOString();
}

function normalizeGitHubActionsStatus(value: unknown): CiWorkflowRunStatus {
  if (value === 'queued' || value === 'waiting' || value === 'pending') return 'queued';
  if (value === 'in_progress' || value === 'in-progress' || value === 'running') return 'in_progress';
  if (value === 'completed') return 'completed';
  throw new Error('GitHub Actions workflow-run status is unsupported');
}

function normalizeGitHubActionsConclusion(value: unknown, status: CiWorkflowRunStatus): CiWorkflowRunConclusion {
  if (value === null || value === undefined || value === '') return status === 'completed' ? 'unknown' : null;
  if (typeof value !== 'string') throw new Error('GitHub Actions workflow-run conclusion is malformed');
  const conclusion = value.toLowerCase().replace(/-/g, '_');
  return CI_CONCLUSIONS.has(conclusion) ? conclusion as Exclude<CiWorkflowRunConclusion, null | 'unknown'> : 'unknown';
}

export function normalizeGitHubActionsWorkflowRun(record: GitHubActionsWorkflowRunRecord, repositoryRef: string, observedAt: string): CiWorkflowRunObservation {
  const workflowId = ciBoundedText(record.workflow_id, 128, 'workflow_id');
  const runId = ciBoundedText(record.id, 128, 'run id');
  const attemptValue = record.run_attempt === undefined ? 1 : Number(record.run_attempt);
  if (!Number.isSafeInteger(attemptValue) || attemptValue < 1 || attemptValue > 1000) throw new Error('GitHub Actions workflow-run attempt is invalid');
  const status = normalizeGitHubActionsStatus(record.status);
  return {
    providerId: GITHUB_ACTIONS_PROVIDER,
    repositoryRef,
    workflowId,
    workflowName: ciBoundedText(record.name ?? workflowId, 256, 'workflow name'),
    runId,
    attempt: attemptValue,
    headSha: ciBoundedText(record.head_sha ?? 'unknown', 128, 'head_sha'),
    status,
    conclusion: normalizeGitHubActionsConclusion(record.conclusion, status),
    queuedAt: ciOptionalIso(record.created_at, 'created_at'),
    startedAt: ciOptionalIso(record.run_started_at, 'run_started_at'),
    completedAt: ciOptionalIso(record.completed_at, 'completed_at'),
    updatedAt: ciOptionalIso(record.updated_at, 'updated_at'),
    observedAt,
  };
}

function validateCiPage(page: { repositoryRef: string; runs: readonly GitHubActionsWorkflowRunRecord[]; nextProviderCursor: string | null; hasMore: boolean }, input: { repositoryRef: string; providerCursor: string | null }): void {
  if (page.repositoryRef !== input.repositoryRef) throw new Error('GitHub Actions repository binding mismatch');
  if (!Array.isArray(page.runs) || page.runs.length > CI_MAX_ITEMS) throw new Error('GitHub Actions workflow-run page exceeds bounds');
  if (page.hasMore && (typeof page.nextProviderCursor !== 'string' || page.nextProviderCursor.length < 1 || page.nextProviderCursor.length > 512)) throw new Error('GitHub Actions pagination cursor is invalid');
  if (!page.hasMore && page.nextProviderCursor !== null) throw new Error('GitHub Actions pagination cursor is inconsistent');
  if (page.nextProviderCursor !== null && /[\u0000\r\n]/.test(page.nextProviderCursor)) throw new Error('GitHub Actions pagination cursor is malformed');
}

/** GitHub Actions stays behind an injected page reader; this class never owns credentials or network access. */
export class GitHubActionsCiObservationReader implements CiWorkflowRunReader {
  private readonly pageReader: GitHubActionsWorkflowRunPageReader;

  constructor(pageReader: GitHubActionsWorkflowRunPageReader) { this.pageReader = pageReader; }

  async read(input: { repositoryRef: string; workflowId?: string; providerCursor: string | null; maxItems: number; maxPages: number; observedAt?: string }): Promise<{ providerId: string; repositoryRef: string; runs: CiWorkflowRunObservation[]; nextProviderCursor: string | null; hasMore: boolean }> {
    const maxItems = Math.max(1, Math.min(CI_MAX_ITEMS, Math.floor(input.maxItems)));
    const maxPages = Math.max(1, Math.min(CI_MAX_PAGES, Math.floor(input.maxPages)));
    const runs: CiWorkflowRunObservation[] = [];
    let providerCursor = input.providerCursor;
    let hasMore = false;
    const observedAt = input.observedAt ?? new Date().toISOString();
    for (let pageNumber = 0; pageNumber < maxPages && runs.length < maxItems; pageNumber += 1) {
      const page = await this.pageReader.readPage({ repositoryRef: input.repositoryRef, ...(input.workflowId ? { workflowId: input.workflowId } : {}), providerCursor, perPage: Math.min(100, maxItems - runs.length) });
      validateCiPage(page, input);
      const remaining = maxItems - runs.length;
      runs.push(...page.runs.slice(0, remaining).map((record) => normalizeGitHubActionsWorkflowRun(record, input.repositoryRef, observedAt)));
      hasMore = page.hasMore || page.runs.length > remaining;
      providerCursor = page.nextProviderCursor;
      if (!hasMore) break;
      if (!providerCursor) throw new Error('GitHub Actions pagination ended without a cursor');
    }
    return { providerId: GITHUB_ACTIONS_PROVIDER, repositoryRef: input.repositoryRef, runs, nextProviderCursor: hasMore ? providerCursor : null, hasMore };
  }
}

function ciRunKey(run: Pick<CiWorkflowRunObservation, 'runId' | 'attempt'>): string { return `${run.runId}:${run.attempt}`; }
function validateNormalizedCiRun(run: CiWorkflowRunObservation, repositoryRef: string, workflowId?: string): void {
  if (!run || typeof run !== 'object' || typeof run.providerId !== 'string' || run.providerId.length < 1 || run.providerId.length > 128) throw new Error('normalized CI provider identity is invalid');
  if (run.repositoryRef !== repositoryRef || (workflowId && run.workflowId !== workflowId)) throw new Error('normalized CI workflow-run binding mismatch');
  for (const [value, limit, label] of [[run.workflowId, 128, 'workflowId'], [run.workflowName, 256, 'workflowName'], [run.runId, 128, 'runId'], [run.headSha, 128, 'headSha']] as const) {
    if (typeof value !== 'string' || value.length < 1 || value.length > limit || /[\u0000\r\n]/.test(value)) throw new Error(`normalized CI ${label} is invalid`);
  }
  if (!Number.isSafeInteger(run.attempt) || run.attempt < 1 || run.attempt > 1000 || !Object.hasOwn(CI_STATUS_RANK, run.status)) throw new Error('normalized CI workflow-run state is invalid');
  if (run.conclusion !== null && (typeof run.conclusion !== 'string' || (!CI_CONCLUSIONS.has(run.conclusion) && run.conclusion !== 'unknown'))) throw new Error('normalized CI workflow-run conclusion is invalid');
  for (const [value, label] of [[run.queuedAt, 'queuedAt'], [run.startedAt, 'startedAt'], [run.completedAt, 'completedAt'], [run.updatedAt, 'updatedAt'], [run.observedAt, 'observedAt']] as const) {
    if (value !== null && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) throw new Error(`normalized CI ${label} is invalid`);
  }
}
function ciRunFingerprint(run: CiWorkflowRunObservation): string {
  return JSON.stringify([run.providerId, run.repositoryRef, run.workflowId, run.workflowName, run.runId, run.attempt, run.headSha, run.status, run.conclusion, run.queuedAt, run.startedAt, run.completedAt, run.updatedAt]);
}
function ciRunOrdering(left: CiWorkflowRunObservation, right: CiWorkflowRunObservation): number {
  const leftTime = Date.parse(left.queuedAt ?? left.startedAt ?? left.completedAt ?? left.updatedAt ?? left.observedAt);
  const rightTime = Date.parse(right.queuedAt ?? right.startedAt ?? right.completedAt ?? right.updatedAt ?? right.observedAt);
  return (Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER) - (Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER)
    || left.runId.localeCompare(right.runId, undefined, { numeric: true }) || left.attempt - right.attempt;
}

function parseCiCursor(value: string | null): CiWorkflowCursor {
  if (!value) return { version: 1, bootstrapping: true, providerCursor: null, pendingRuns: [], states: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('CI workflow-run watermark is malformed'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('CI workflow-run watermark is invalid');
  const cursor = parsed as Partial<CiWorkflowCursor>;
  if (cursor.version !== 1 || typeof cursor.bootstrapping !== 'boolean' || (cursor.providerCursor !== null && typeof cursor.providerCursor !== 'string') || !Array.isArray(cursor.pendingRuns) || !Array.isArray(cursor.states) || cursor.pendingRuns.length > CI_MAX_ITEMS || cursor.states.length > CI_MAX_STATES) throw new Error('CI workflow-run watermark schema is invalid');
  return { version: 1, bootstrapping: cursor.bootstrapping, providerCursor: cursor.providerCursor ?? null, pendingRuns: cursor.pendingRuns as CiWorkflowRunObservation[], states: cursor.states as CiWorkflowRunState[] };
}

function encodeCiCursor(cursor: CiWorkflowCursor): string {
  const states = [...cursor.states].sort((left, right) => ciRunKey(left).localeCompare(ciRunKey(right))).slice(0, CI_MAX_STATES);
  const pendingRuns = cursor.pendingRuns.slice(0, CI_MAX_ITEMS);
  const encoded = JSON.stringify({ version: 1, bootstrapping: cursor.bootstrapping, providerCursor: cursor.providerCursor, pendingRuns, states });
  if (encoded.length > CI_MAX_CURSOR_BYTES) throw new Error('CI workflow-run watermark exceeds 64 KiB');
  return encoded;
}

export type CiWorkflowRunEventSourceOptions = {
  sourceId: string;
  repositoryRef: string;
  workflowId?: string;
  reader: CiWorkflowRunReader;
  maxItems?: number;
  maxPages?: number;
};

export class CiWorkflowRunEventSourceAdapter implements EventSourceAdapter<CiWorkflowSemanticEvent> {
  readonly sourceType = CI_WORKFLOW_RUN_SOURCE;
  readonly sourceId: string;
  private readonly repositoryRef: string;
  private readonly workflowId: string | undefined;
  private readonly reader: CiWorkflowRunReader;
  private readonly maxItems: number;
  private readonly maxPages: number;

  constructor(options: CiWorkflowRunEventSourceOptions) {
    if (!options.sourceId || !options.repositoryRef) throw new Error('CI workflow-run source identity and binding are required');
    this.sourceId = options.sourceId; this.repositoryRef = options.repositoryRef; this.workflowId = options.workflowId; this.reader = options.reader;
    this.maxItems = Math.max(1, Math.min(CI_MAX_ITEMS, Math.floor(options.maxItems ?? CI_MAX_ITEMS)));
    this.maxPages = Math.max(1, Math.min(CI_MAX_PAGES, Math.floor(options.maxPages ?? CI_MAX_PAGES)));
  }

  async observe(context: EventSourceObservationContext): Promise<EventSourceObservation<CiWorkflowSemanticEvent>> {
    if (context.sourceId !== this.sourceId) throw new Error('event source context identity mismatch');
    const initial = context.previousWatermark === null;
    const cursor = parseCiCursor(context.previousWatermark);
    const cursorKeys = new Set<string>();
    for (const state of cursor.states) { validateNormalizedCiRun(state, this.repositoryRef, this.workflowId); const key = ciRunKey(state); if (cursorKeys.has(key)) throw new Error('CI workflow-run watermark contains duplicate run attempts'); cursorKeys.add(key); }
    for (const pending of cursor.pendingRuns) validateNormalizedCiRun(pending, this.repositoryRef, this.workflowId);
    let pendingRuns = [...cursor.pendingRuns];
    let providerCursor = cursor.providerCursor;
    let pageHasMore = Boolean(providerCursor);
    if (!pendingRuns.length) {
      const page = await this.reader.read({ repositoryRef: this.repositoryRef, ...(this.workflowId ? { workflowId: this.workflowId } : {}), providerCursor, maxItems: this.maxItems, maxPages: this.maxPages, observedAt: context.observedAt });
      if (!page.providerId || page.providerId.length > 128) throw new Error('CI provider identity is invalid');
      if (page.repositoryRef !== this.repositoryRef) throw new Error('CI repository binding mismatch');
      if (page.hasMore !== Boolean(page.nextProviderCursor) || (page.nextProviderCursor !== null && (page.nextProviderCursor.length > 512 || /[\u0000\r\n]/.test(page.nextProviderCursor)))) throw new Error('CI provider pagination state is invalid');
      pendingRuns = [...page.runs].sort(ciRunOrdering);
      providerCursor = page.nextProviderCursor;
      pageHasMore = page.hasMore;
    }
    const statesByKey = new Map(cursor.states.map((state) => [ciRunKey(state), state]));
    const nextStates = new Map(statesByKey);
    const events: CiWorkflowSemanticEvent[] = [];
    const remaining: CiWorkflowRunObservation[] = [];
    const limit = Math.max(1, Math.min(100, Math.floor(context.catchUpLimit)));
    for (const run of pendingRuns) {
      if (run.repositoryRef !== this.repositoryRef || (this.workflowId && run.workflowId !== this.workflowId)) throw new Error('normalized CI workflow-run binding mismatch');
      validateNormalizedCiRun(run, this.repositoryRef, this.workflowId);
      const key = ciRunKey(run);
      const previous = statesByKey.get(key);
      if (previous && CI_STATUS_RANK[run.status] < CI_STATUS_RANK[previous.status]) continue;
      if (previous && previous.updatedAt && run.updatedAt && Date.parse(run.updatedAt) < Date.parse(previous.updatedAt)) continue;
      const fingerprint = ciRunFingerprint(run);
      let nextState: CiWorkflowRunState = { ...run, fingerprint, lastEmittedPhase: previous?.lastEmittedPhase ?? null };
      if (!cursor.bootstrapping && (!previous || previous.fingerprint !== fingerprint)) {
        const semanticType = run.status === 'completed' ? CI_WORKFLOW_COMPLETED_EVENT : previous?.lastEmittedPhase === 'started' ? null : CI_WORKFLOW_STARTED_EVENT;
        const changedConclusion = Boolean(previous && previous.status === 'completed' && run.status === 'completed' && previous.conclusion !== run.conclusion);
        if (semanticType && events.length >= limit) { remaining.push(run); continue; }
        if (semanticType || changedConclusion) {
          const effectiveType = changedConclusion ? CI_WORKFLOW_COMPLETED_EVENT : semanticType as typeof CI_WORKFLOW_STARTED_EVENT | typeof CI_WORKFLOW_COMPLETED_EVENT;
          events.push({ ...run, semanticType: effectiveType, previousStatus: previous?.status ?? null, previousConclusion: previous?.conclusion ?? null });
          nextState = { ...nextState, lastEmittedPhase: effectiveType === CI_WORKFLOW_COMPLETED_EVENT ? 'completed' : 'started' };
        }
      }
      nextStates.set(key, nextState);
    }
    const hasMore = remaining.length > 0 || pageHasMore;
    const nextCursor = encodeCiCursor({ version: 1, bootstrapping: cursor.bootstrapping && hasMore, providerCursor: hasMore ? providerCursor : null, pendingRuns: remaining, states: [...nextStates.values()] });
    return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: context.previousWatermark, observedWatermark: nextCursor, events, hasMore, observedAt: context.observedAt, status: initial ? 'bootstrapped' : events.length ? 'advanced' : 'unchanged' };
  }
}

type HostHealthCursor = { version: 1; scanOffset: number; states: HostHealthSemanticState[] };

export type GitRepositorySourceReader = {
  inspect(repositoryRoot: string): Promise<{ root: string; head: string; ref: string }>;
  isAncestor(repositoryRoot: string, ancestor: string, descendant: string): Promise<boolean>;
  listCommitShas(repositoryRoot: string, ancestor: string, descendant: string, limit: number): Promise<string[]>;
  readCommit(repositoryRoot: string, commitSha: string): Promise<{ commitSha: string; parentSha: string | null; author: string; subject: string; committedAt: string }>;
};

const SHA_PATTERN = /^[0-9a-f]{40,64}$/;

function boundedText(value: string, limit: number): string {
  return value.replace(/[\u0000\r\n]/g, ' ').slice(0, limit);
}

function canonicalRoot(value: string): string {
  return path.resolve(value);
}

async function fixedGit(repositoryRoot: string, args: readonly string[], maxBuffer = 512 * 1024): Promise<string> {
  const root = canonicalRoot(repositoryRoot);
  const result = await execFile('git', ['-C', root, ...args], { encoding: 'utf8', timeout: 15_000, maxBuffer });
  return String(result.stdout).trim();
}

/** Read-only Git operations required by K4.1-A; no fetch, ref mutation, or shell. */
export class GitCliRepositorySourceReader implements GitRepositorySourceReader {
  async inspect(repositoryRoot: string): Promise<{ root: string; head: string; ref: string }> {
    const root = canonicalRoot(await realpath(repositoryRoot));
    const verifiedRoot = canonicalRoot(await fixedGit(root, ['rev-parse', '--show-toplevel']));
    const head = await fixedGit(verifiedRoot, ['rev-parse', '--verify', 'HEAD^{commit}']);
    const ref = (await fixedGit(verifiedRoot, ['symbolic-ref', '--short', '-q', 'HEAD']).catch(() => '')) || 'HEAD';
    if (!SHA_PATTERN.test(head)) throw new Error('Git repository returned an invalid HEAD');
    return { root: verifiedRoot, head, ref: boundedText(ref, 128) };
  }

  async isAncestor(repositoryRoot: string, ancestor: string, descendant: string): Promise<boolean> {
    if (!SHA_PATTERN.test(ancestor) || !SHA_PATTERN.test(descendant)) throw new Error('Git ancestry identity is invalid');
    try {
      await fixedGit(repositoryRoot, ['merge-base', '--is-ancestor', ancestor, descendant]);
      return true;
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? (error as { code?: unknown }).code : undefined;
      if (code === 1) return false;
      throw error;
    }
  }

  async listCommitShas(repositoryRoot: string, ancestor: string, descendant: string, limit: number): Promise<string[]> {
    if (!SHA_PATTERN.test(ancestor) || !SHA_PATTERN.test(descendant)) throw new Error('Git commit identity is invalid');
    const boundedLimit = Math.max(1, Math.min(101, Math.floor(limit)));
    const output = await fixedGit(repositoryRoot, ['rev-list', '--reverse', '--first-parent', '--ancestry-path', `--max-count=${boundedLimit}`, `${ancestor}..${descendant}`]);
    const shas = output.split('\n').map((value) => value.trim()).filter(Boolean);
    if (shas.some((sha) => !SHA_PATTERN.test(sha))) throw new Error('Git returned an invalid commit identity');
    return shas;
  }

  async readCommit(repositoryRoot: string, commitSha: string): Promise<{ commitSha: string; parentSha: string | null; author: string; subject: string; committedAt: string }> {
    if (!SHA_PATTERN.test(commitSha)) throw new Error('Git commit identity is invalid');
    const output = await fixedGit(repositoryRoot, ['show', '-s', '--format=%H%x00%P%x00%ct%x00%an%x00%s', commitSha], 64 * 1024);
    const [sha, parents, epoch, author, subject] = output.split('\0');
    if (!sha || !SHA_PATTERN.test(sha) || !epoch || !/^\d+$/.test(epoch)) throw new Error('Git returned malformed commit metadata');
    const committedAt = new Date(Number(epoch) * 1000).toISOString();
    return { commitSha: sha, parentSha: parents?.split(/\s+/).filter(Boolean)[0] ?? null, author: boundedText(author ?? '', 256), subject: boundedText(subject ?? '', 512), committedAt };
  }
}

export type GitRepositoryEventSourceOptions = {
  sourceId: string;
  repositoryRef: string;
  repositoryRoot: string;
  reader?: GitRepositorySourceReader;
};

export class GitRepositoryEventSourceAdapter implements EventSourceAdapter<GitRepositoryCommitEvent> {
  readonly sourceType = GIT_REPOSITORY_REVISION_SOURCE;
  readonly sourceId: string;
  private readonly repositoryRef: string;
  private readonly repositoryRoot: string;
  private readonly reader: GitRepositorySourceReader;

  constructor(options: GitRepositoryEventSourceOptions) {
    if (!options.sourceId || !options.repositoryRef || !options.repositoryRoot) throw new Error('Git event source identity and binding are required');
    this.sourceId = options.sourceId;
    this.repositoryRef = options.repositoryRef;
    this.repositoryRoot = options.repositoryRoot;
    this.reader = options.reader ?? new GitCliRepositorySourceReader();
  }

  async observe(context: EventSourceObservationContext): Promise<EventSourceObservation<GitRepositoryCommitEvent>> {
    if (context.sourceId !== this.sourceId) throw new Error('event source context identity mismatch');
    const inspected = await this.reader.inspect(this.repositoryRoot);
    if (!context.previousWatermark) return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: null, observedWatermark: inspected.head, events: [], hasMore: false, observedAt: context.observedAt, status: 'bootstrapped' };
    if (context.previousWatermark === inspected.head) return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: context.previousWatermark, observedWatermark: inspected.head, events: [], hasMore: false, observedAt: context.observedAt, status: 'unchanged' };
    if (!(await this.reader.isAncestor(inspected.root, context.previousWatermark, inspected.head))) return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: context.previousWatermark, observedWatermark: inspected.head, events: [], hasMore: false, observedAt: context.observedAt, status: 'diverged' };
    const shas = await this.reader.listCommitShas(inspected.root, context.previousWatermark, inspected.head, context.catchUpLimit + 1);
    const selected = shas.slice(0, context.catchUpLimit);
    const debounceGroupId = context.debounceWindowMs > 0
      ? `${this.sourceId}:debounce:${Math.floor(Date.parse(context.observedAt) / context.debounceWindowMs)}`
      : `${this.sourceId}:debounce:${context.observedAt}`;
    const events: GitRepositoryCommitEvent[] = [];
    for (const [index, sha] of selected.entries()) {
      const metadata = await this.reader.readCommit(inspected.root, sha);
      events.push({ ...metadata, author: boundedText(metadata.author, 256), subject: boundedText(metadata.subject, 512), ref: inspected.ref, observationSequence: index + 1, debounceGroupId });
    }
    return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: context.previousWatermark, observedWatermark: selected.at(-1) ?? inspected.head, events, hasMore: shas.length > selected.length, observedAt: context.observedAt, status: events.length ? 'advanced' : 'unchanged' };
  }
}

const ELIGIBLE_LIFECYCLE_EVENTS = new Set([
  'attempt_admitted', 'attempt_started', 'attempt_finished',
  'cancellation_requested', 'cancellation_acknowledged',
  'run_paused', 'run_resumed', 'controller_lost',
  'attempt_readmitted_after_process_loss', 'run_cancel_requested',
  'run_cancelled', 'run_killed',
]);

function boundedIdentity(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 ? value : null;
}

export class InternalLifecycleEventSourceAdapter implements EventSourceAdapter<BrainTaskLifecycleEvent> {
  readonly sourceId: string;
  readonly sourceType = BRAIN_TASK_LIFECYCLE_SOURCE;
  private readonly store: AgentModeSqliteStateStore;
  private readonly scanLimit: number;

  constructor(options: { store: AgentModeSqliteStateStore; sourceId?: string; scanLimit?: number }) {
    this.store = options.store;
    this.sourceId = options.sourceId ?? BRAIN_TASK_LIFECYCLE_SOURCE;
    this.scanLimit = Math.max(1, Math.min(500, Math.floor(options.scanLimit ?? 100)));
  }

  async observe(context: EventSourceObservationContext): Promise<EventSourceObservation<BrainTaskLifecycleEvent>> {
    if (context.sourceId !== this.sourceId) throw new Error('event source context identity mismatch');
    const previous = context.previousWatermark === null ? null : Number(context.previousWatermark);
    if (previous !== null && (!Number.isSafeInteger(previous) || previous < 0)) throw new Error('lifecycle event sequence watermark is invalid');
    if (previous === null) {
      const current = this.store.getHighestEventSequence();
      return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: null, observedWatermark: String(current), events: [], hasMore: false, observedAt: context.observedAt, status: 'bootstrapped' };
    }
    const scanLimit = Math.max(1, Math.min(500, Math.floor(context.scanLimit ?? this.scanLimit)));
    const rows = this.store.listEventsAfterSequence(previous, scanLimit + 1);
    const scanRows = rows.slice(0, scanLimit);
    const events: BrainTaskLifecycleEvent[] = [];
    let lastScanned = previous;
    let blockedByEmitLimit = false;
    for (const row of scanRows) {
      const sequence = row.sequence;
      if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence <= lastScanned) throw new Error('lifecycle event sequence is invalid or non-monotonic');
      if (ELIGIBLE_LIFECYCLE_EVENTS.has(row.eventType) && !['task', 'run', 'attempt'].includes(row.entityType)) throw new Error('eligible lifecycle event entity type is invalid');
      if (ELIGIBLE_LIFECYCLE_EVENTS.has(row.eventType)) {
        if (events.length >= context.catchUpLimit) { blockedByEmitLimit = true; break; }
        const taskId = boundedIdentity(row.payload.taskId);
        const runId = boundedIdentity(row.payload.runId);
        const attemptId = boundedIdentity(row.payload.attemptId);
        events.push({ sourceEventId: row.eventId, sourceSequence: sequence, entityType: row.entityType as BrainTaskLifecycleEvent['entityType'], entityId: row.entityId, lifecycleEventType: row.eventType, occurredAt: row.occurredAt, taskId, runId, attemptId });
      }
      lastScanned = sequence;
    }
    const hasMore = blockedByEmitLimit || rows.length > scanRows.length;
    return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: context.previousWatermark, observedWatermark: String(lastScanned), events, hasMore, observedAt: context.observedAt, status: events.length ? 'advanced' : lastScanned > previous ? 'advanced' : 'unchanged' };
  }
}

function hostHealthChannelKey(observation: Pick<HostHealthObservation, 'resourceId' | 'providerId' | 'bindingId'>): string {
  return `${observation.resourceId}|${observation.providerId}|${observation.bindingId}`;
}

function hostHealthFingerprint(observation: Pick<HostHealthObservation, 'resourceId' | 'providerId' | 'bindingId' | 'status' | 'freshness' | 'conditionCodes'>): string {
  return JSON.stringify([observation.resourceId, observation.providerId, observation.bindingId, observation.status, observation.freshness, [...observation.conditionCodes].sort()]);
}

function parseHostHealthCursor(value: string | null): HostHealthCursor {
  if (!value) return { version: 1, scanOffset: 0, states: [] };
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error('host-health watermark is malformed'); }
  if (!parsed || typeof parsed !== 'object') throw new Error('host-health watermark is invalid');
  const cursor = parsed as Partial<HostHealthCursor>;
  if (cursor.version !== 1 || !Number.isSafeInteger(cursor.scanOffset) || (cursor.scanOffset ?? 0) < 0 || !Array.isArray(cursor.states) || cursor.states.length > 500) throw new Error('host-health watermark schema is invalid');
  return { version: 1, scanOffset: cursor.scanOffset ?? 0, states: cursor.states as HostHealthSemanticState[] };
}

function encodeHostHealthCursor(cursor: HostHealthCursor): string {
  const states = [...cursor.states].sort((left, right) => hostHealthChannelKey(left).localeCompare(hostHealthChannelKey(right))).slice(0, 500);
  const encoded = JSON.stringify({ version: 1, scanOffset: cursor.scanOffset, states });
  if (encoded.length > 64 * 1024) throw new Error('host-health watermark exceeds 64 KiB');
  return encoded;
}

function safeConditionCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length <= 128))].sort();
}

export function createInfrastructurePlaneHostHealthReader(root?: string): HostHealthObservationReader {
  return async (now) => {
    const health = (root ? readInfrastructureHealth({ root, now }) : readInfrastructureHealth({ now })) as unknown as { runtimeState: string; observations: Array<Record<string, unknown>> };
    if (health.runtimeState !== 'ok') throw new Error(`normalized infrastructure health snapshot unavailable: ${health.runtimeState}`);
    const catalog = (root ? readInfrastructureCatalog({ root, now }) : readInfrastructureCatalog({ now })) as unknown as { resources: Array<Record<string, unknown>> };
    const hostResourceIds = new Set(catalog.resources.filter((resource) => resource.resourceClass === 'host').map((resource) => String(resource.resourceId)));
    const bindingsPath = path.resolve(root ?? path.resolve(new URL('../../../..', import.meta.url).pathname), 'operations/infrastructure/health/provider-bindings.v1.json');
    let bindingDocument: unknown;
    try { bindingDocument = JSON.parse(fs.readFileSync(bindingsPath, 'utf8')); } catch (error) { throw new Error(`infrastructure health bindings unavailable: ${error instanceof Error ? error.message : String(error)}`); }
    const bindings = bindingDocument && typeof bindingDocument === 'object' && Array.isArray((bindingDocument as { bindings?: unknown }).bindings) ? (bindingDocument as { bindings: Array<Record<string, unknown>> }).bindings : [];
    const hostBindings = bindings.filter((binding) => hostResourceIds.has(String(binding.resourceId)) && typeof binding.bindingId === 'string' && typeof binding.providerId === 'string');
    if (!hostBindings.length) throw new Error('no admitted host health bindings exist');
    const observations: HostHealthObservation[] = [];
    for (const binding of hostBindings) {
      const normalized = (health.observations as Array<Record<string, unknown>>).find((candidate) => candidate.resourceId === binding.resourceId && candidate.providerId === binding.providerId);
      if (!normalized) continue;
      const freshnessResult = computeFreshness({ observedAt: normalized.observedAt, now, freshnessSeconds: Number(binding.freshnessSeconds), providerState: 'ok' });
      const freshness = freshnessResult.freshness as HostHealthObservation['freshness'];
      const conditionCodes = safeConditionCodes(normalized.conditionCodes);
      if (freshness === 'stale' && !conditionCodes.includes('observation_stale')) conditionCodes.push('observation_stale');
      if (freshness === 'unknown' && !conditionCodes.includes('observation_unknown')) conditionCodes.push('observation_unknown');
      conditionCodes.sort();
      observations.push({ observationId: String(normalized.observationId), resourceId: String(binding.resourceId), providerId: String(binding.providerId), bindingId: String(binding.bindingId), observedAt: String(normalized.observedAt), status: effectiveStatus(String(normalized.status), freshness) as HostHealthObservation['status'], freshness, conditionCodes });
    }
    return { observations, expectedBindingKeys: hostBindings.map((binding) => `${binding.resourceId}|${binding.providerId}|${binding.bindingId}`).sort() };
  };
}

export class HostHealthEventSourceAdapter implements EventSourceAdapter<HostHealthTransitionEvent> {
  readonly sourceId: string;
  readonly sourceType = INFRASTRUCTURE_HOST_HEALTH_SOURCE;
  private readonly reader: HostHealthObservationReader;
  private readonly maxBindings: number;

  constructor(options: { reader?: HostHealthObservationReader; root?: string; sourceId?: string; maxBindings?: number } = {}) {
    this.sourceId = options.sourceId ?? INFRASTRUCTURE_HOST_HEALTH_SOURCE;
    this.reader = options.reader ?? createInfrastructurePlaneHostHealthReader(options.root);
    this.maxBindings = Math.max(1, Math.min(500, Math.floor(options.maxBindings ?? 100)));
  }

  async observe(context: EventSourceObservationContext): Promise<EventSourceObservation<HostHealthTransitionEvent>> {
    if (context.sourceId !== this.sourceId) throw new Error('event source context identity mismatch');
    const cursor = parseHostHealthCursor(context.previousWatermark);
    const result = await this.reader(new Date(context.observedAt));
    const observations = [...result.observations].sort((left, right) => hostHealthChannelKey(left).localeCompare(hostHealthChannelKey(right)));
    const expected = new Set(result.expectedBindingKeys);
    if (observations.some((observation) => !expected.has(hostHealthChannelKey(observation)))) throw new Error('normalized host-health observation has no admitted binding');
    const observedKeys = new Set(observations.map(hostHealthChannelKey));
    if (expected.size !== observedKeys.size || [...expected].some((key) => !observedKeys.has(key))) throw new Error('normalized host-health observation is missing an admitted binding');
    if (context.previousWatermark === null) {
      const baseline = observations.slice(0, 500).map((observation) => ({ ...observation, fingerprint: hostHealthFingerprint(observation), lastTransitionAt: null }));
      return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: null, observedWatermark: encodeHostHealthCursor({ version: 1, scanOffset: observations.length > this.maxBindings ? this.maxBindings : 0, states: baseline }), events: [], hasMore: observations.length > this.maxBindings, observedAt: context.observedAt, status: 'bootstrapped' };
    }
    const start = observations.length ? Math.min(cursor.scanOffset, observations.length) : 0;
    const scanned = observations.slice(start, start + this.maxBindings);
    const stateByKey = new Map(cursor.states.map((state) => [hostHealthChannelKey(state), state]));
    const events: HostHealthTransitionEvent[] = [];
    const nextStates = new Map(stateByKey);
    let stoppedForEmitLimit = false;
    for (const observation of scanned) {
      const key = hostHealthChannelKey(observation);
      const previous = stateByKey.get(key);
      if (previous && Date.parse(observation.observedAt) < Date.parse(previous.observedAt)) continue;
      const fingerprint = hostHealthFingerprint(observation);
      if (!previous) { nextStates.set(key, { ...observation, fingerprint, lastTransitionAt: null }); continue; }
      if (previous.fingerprint !== fingerprint) {
        if (events.length >= context.catchUpLimit) { stoppedForEmitLimit = true; break; }
        events.push({ ...observation, fingerprint, previousStatus: previous.status, previousFreshness: previous.freshness, previousConditionCodes: previous.conditionCodes }); nextStates.set(key, { ...observation, fingerprint, lastTransitionAt: context.observedAt });
      } else nextStates.set(key, { ...observation, fingerprint, lastTransitionAt: previous.lastTransitionAt });
    }
    const hasMore = stoppedForEmitLimit || start + scanned.length < observations.length;
    const scanOffset = hasMore ? (stoppedForEmitLimit ? start : start + scanned.length) : 0;
    return { sourceId: this.sourceId, sourceType: this.sourceType, previousWatermark: context.previousWatermark, observedWatermark: encodeHostHealthCursor({ version: 1, scanOffset, states: [...nextStates.values()] }), events, hasMore, observedAt: context.observedAt, status: events.length ? 'advanced' : 'unchanged' };
  }
}

function toSchedulerEvent(source: AgentModeEventSourceConfigLike, event: GitRepositoryCommitEvent | BrainTaskLifecycleEvent | HostHealthTransitionEvent | CiWorkflowSemanticEvent, now: string): AgentModeSchedulerEventInput {
  if ('sourceSequence' in event) return {
    eventId: `${source.sourceId}:${event.sourceEventId}`,
    eventType: TASK_LIFECYCLE_OBSERVED_EVENT,
    source: source.sourceId,
    occurredAt: event.occurredAt,
    receivedAt: now,
    causationId: event.attemptId ?? event.runId ?? event.taskId,
    correlationId: event.runId ?? event.taskId,
    deduplicationKey: `${source.sourceId}:${event.sourceEventId}:${event.sourceSequence}`,
    payloadVersion: 'k4.0',
    payload: { sourceEventId: event.sourceEventId, sourceSequence: event.sourceSequence, entityType: event.entityType, entityId: event.entityId, lifecycleEventType: event.lifecycleEventType, occurredAt: event.occurredAt, taskId: event.taskId, runId: event.runId, attemptId: event.attemptId },
    nextEligibleAt: now, deadline: null, maxAttempts: 3,
  };
  if ('previousStatus' in event && 'bindingId' in event) return {
    eventId: `${source.sourceId}:${event.bindingId}:${event.observationId}:${event.observedAt}`,
    eventType: INFRASTRUCTURE_HOST_HEALTH_CHANGED_EVENT,
    source: source.sourceId,
    occurredAt: event.observedAt,
    receivedAt: now,
    causationId: event.bindingId,
    correlationId: event.resourceId,
    deduplicationKey: `${source.sourceId}:${event.bindingId}:${event.fingerprint}`,
    payloadVersion: 'k4.0',
    payload: { resourceId: event.resourceId, providerId: event.providerId, bindingId: event.bindingId, previousStatus: event.previousStatus, currentStatus: event.status, previousFreshness: event.previousFreshness, currentFreshness: event.freshness, previousConditionCodes: event.previousConditionCodes, conditionCodes: event.conditionCodes, sourceObservationId: event.observationId, observedAt: event.observedAt, evaluatedAt: now },
    nextEligibleAt: now, deadline: null, maxAttempts: 3,
  };
  if ('semanticType' in event) return {
    eventId: `${source.sourceId}:${event.runId}:${event.attempt}:${event.semanticType}:${event.conclusion ?? 'pending'}`,
    eventType: event.semanticType,
    source: source.sourceId,
    occurredAt: event.status === 'completed' ? event.completedAt ?? event.updatedAt ?? event.observedAt : event.startedAt ?? event.queuedAt ?? event.updatedAt ?? event.observedAt,
    receivedAt: now,
    causationId: `${event.runId}:${event.attempt}`,
    correlationId: event.workflowId,
    deduplicationKey: `${source.sourceId}:${event.providerId}:${event.repositoryRef}:${event.workflowId}:${event.runId}:${event.attempt}:${event.semanticType}:${event.conclusion ?? 'pending'}`,
    payloadVersion: 'k4.0',
    payload: {
      providerId: event.providerId, repositoryRef: event.repositoryRef, workflowId: event.workflowId, workflowName: event.workflowName,
      runId: event.runId, attempt: event.attempt, headSha: event.headSha, status: event.status, conclusion: event.conclusion,
      previousStatus: event.previousStatus, previousConclusion: event.previousConclusion,
      queuedAt: event.queuedAt, startedAt: event.startedAt, completedAt: event.completedAt,
    },
    nextEligibleAt: now, deadline: null, maxAttempts: 3,
  };
  return {
    eventId: `${source.sourceId}:${event.commitSha}`,
    eventType: REPOSITORY_COMMIT_OBSERVED_EVENT,
    source: source.sourceId,
    occurredAt: event.committedAt,
    receivedAt: now,
    causationId: event.parentSha,
    correlationId: event.debounceGroupId,
    deduplicationKey: `${source.sourceId}:${source.repositoryRef}:${event.commitSha}`,
    payloadVersion: 'k4.0',
    payload: { repositoryRef: source.repositoryRef, commitSha: event.commitSha, parentSha: event.parentSha, ref: event.ref, author: event.author, subject: event.subject, committedAt: event.committedAt, observationSequence: event.observationSequence, debounceGroupId: event.debounceGroupId },
    nextEligibleAt: now,
    deadline: null,
    maxAttempts: 3,
  };
}

type AgentModeEventSourceConfigLike = { sourceId: string; sourceType: string; repositoryRef: string; debounceWindowMs: number; cooldownWindowMs: number; catchUpLimit: number };

export type EventSourcePollResult = { observedAt: string; considered: number; deferred: number; sources: AgentModeEventSourceObservationResult[] };

export async function pollEventSourcesOnce(options: { store: AgentModeSqliteStateStore; adapters: readonly EventSourceAdapter<GitRepositoryCommitEvent | BrainTaskLifecycleEvent | HostHealthTransitionEvent | CiWorkflowSemanticEvent>[]; now?: string; clock?: () => string; maxSources?: number }): Promise<EventSourcePollResult> {
  const observedAt = options.now ?? (options.clock ?? (() => new Date().toISOString()))();
  const maxSources = Math.max(1, Math.min(16, Math.floor(options.maxSources ?? 16)));
  const adapters = new Map(options.adapters.map((adapter) => [adapter.sourceId, adapter]));
  const configured = options.store.listEventSources().filter((source) => source.enabled).slice(0, maxSources);
  const sources: AgentModeEventSourceObservationResult[] = [];
  let deferred = Math.max(0, options.store.listEventSources().filter((source) => source.enabled).length - configured.length);
  for (const source of configured) {
    if (source.status === 'diverged') {
      sources.push({ sourceId: source.sourceId, status: 'diverged', previousWatermark: source.watermark, observedWatermark: null, emittedEventCount: 0, duplicates: 0, hasMore: source.catchUpPending, observedAt, errorReason: source.lastErrorReason ?? 'source_diverged' });
      continue;
    }
    if (source.nextEligibleAt && source.nextEligibleAt > observedAt) {
      deferred += 1;
      sources.push({ sourceId: source.sourceId, status: 'cooldown', previousWatermark: source.watermark, observedWatermark: source.watermark, emittedEventCount: 0, duplicates: 0, hasMore: source.catchUpPending, observedAt });
      continue;
    }
    const adapter = adapters.get(source.sourceId);
    if (!adapter) {
      const reason = 'source_adapter_not_bound';
      options.store.recordEventSourceFailure({ sourceId: source.sourceId, observedAt, status: 'failed', reason });
      sources.push({ sourceId: source.sourceId, status: 'failed', previousWatermark: source.watermark, observedWatermark: null, emittedEventCount: 0, duplicates: 0, hasMore: source.catchUpPending, observedAt, errorReason: reason });
      continue;
    }
    try {
      const observation = await adapter.observe({ sourceId: source.sourceId, previousWatermark: source.watermark ?? source.bootstrapWatermark, observedAt, catchUpLimit: source.catchUpLimit, scanLimit: Math.min(500, source.catchUpLimit * 4), debounceWindowMs: source.debounceWindowMs });
      if (observation.status === 'diverged') {
        options.store.recordEventSourceFailure({ sourceId: source.sourceId, observedAt, status: 'diverged', reason: 'watermark_diverged_from_current_HEAD' });
        sources.push({ sourceId: source.sourceId, status: 'diverged', previousWatermark: observation.previousWatermark, observedWatermark: observation.observedWatermark, emittedEventCount: 0, duplicates: 0, hasMore: false, observedAt, errorReason: 'watermark_diverged_from_current_HEAD' });
        continue;
      }
      const events = observation.events.map((event) => toSchedulerEvent(source, event, observedAt));
      const cooldownNotBefore = source.cooldownWindowMs > 0 ? new Date(Date.parse(observedAt) + source.cooldownWindowMs).toISOString() : null;
      const ingested = options.store.ingestSchedulerEventsAndAdvanceSource({ sourceId: source.sourceId, observedAt, observedWatermark: observation.observedWatermark ?? source.watermark ?? '', events, hasMore: observation.hasMore, cooldownNotBefore });
      sources.push({ sourceId: source.sourceId, status: observation.status, previousWatermark: observation.previousWatermark, observedWatermark: observation.observedWatermark, emittedEventCount: ingested.created, duplicates: ingested.duplicates, hasMore: observation.hasMore, observedAt });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      options.store.recordEventSourceFailure({ sourceId: source.sourceId, observedAt, status: 'failed', reason });
      sources.push({ sourceId: source.sourceId, status: 'failed', previousWatermark: source.watermark, observedWatermark: null, emittedEventCount: 0, duplicates: 0, hasMore: source.catchUpPending, observedAt, errorReason: reason.slice(0, 256) });
    }
  }
  return { observedAt, considered: configured.length, deferred, sources };
}
