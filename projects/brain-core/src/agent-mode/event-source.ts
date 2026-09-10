import { execFile as execFileCallback } from 'node:child_process';
import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  AgentModeSqliteStateStore,
  type AgentModeEventSourceConfig,
  type AgentModeEventSourceObservationResult,
  type AgentModeSchedulerEventInput,
} from './sqlite-state-store.js';

const execFile = promisify(execFileCallback);

export const GIT_REPOSITORY_REVISION_SOURCE = 'git.repository.revision' as const;
export const REPOSITORY_COMMIT_OBSERVED_EVENT = 'repository.commit.observed' as const;
export const BRAIN_TASK_LIFECYCLE_SOURCE = 'brain.task.lifecycle' as const;
export const TASK_LIFECYCLE_OBSERVED_EVENT = 'task.lifecycle.observed' as const;

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

function toSchedulerEvent(source: AgentModeEventSourceConfigLike, event: GitRepositoryCommitEvent | BrainTaskLifecycleEvent, now: string): AgentModeSchedulerEventInput {
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

export async function pollEventSourcesOnce(options: { store: AgentModeSqliteStateStore; adapters: readonly EventSourceAdapter<GitRepositoryCommitEvent | BrainTaskLifecycleEvent>[]; now?: string; clock?: () => string; maxSources?: number }): Promise<EventSourcePollResult> {
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
