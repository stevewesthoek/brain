/**
 * Mind Steward persistent inbox queue.
 * Brain-owned runtime state for capture/inbox candidates. This adapter does
 * not write to Mind or move captures.
 */

import fs, { chmodSync, lstatSync, realpathSync, renameSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { MIND_INBOX_NEW_CANDIDATES, MIND_TARGET_PATHS } from '../mind-paths.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_MIND_ROOT = path.resolve(BRAIN_ROOT, '..', 'mind');
const DEFAULT_STATE_PATH = path.resolve(BRAIN_ROOT, 'runtime/local/mind-steward/inbox-queue-state.json');

export type MindStewardInboxQueueItemStatus =
  | 'pending'
  | 'running'
  | 'blocked'
  | 'failed'
  | 'reported'
  | 'approved'
  | 'done';

export interface MindStewardInboxQueueSettings {
  maxConcurrentJobs: number;
  maxFilesPerRun: number;
  debounceSeconds: number;
  maxRetries: number;
  largeFileThresholdMb: number;
  minimumSecondsBetweenRuns: number;
  localOnly: true;
}

export interface MindStewardInboxQueueItem {
  id: string;
  path: string;
  status: MindStewardInboxQueueItemStatus;
  sizeBytes: number;
  contentSha256: string;
  modifiedAt: string | null;
  firstSeenAt: string;
  lastCheckedAt: string;
  stableFile: boolean;
  stableAt: string | null;
  debounceSeconds: number;
  debounceUntil: string | null;
  attemptCount: number;
  lastError: string | null;
  nextRetryAfter: string | null;
  failureRoute: 'brain-runtime-queue-status' | 'capture-failed-move-proposal-required' | null;
  largeFile: boolean;
  selectedForSample: boolean;
  selectorStatus: 'unknown' | 'not-required' | 'blocked' | 'ready' | 'failed';
}

export interface MindStewardInboxQueueState {
  schemaVersion: '1.0';
  queueId: string;
  generatedAt: string;
  source: 'brain-runtime';
  mindRoot: string;
  inboxPath: string;
  status: 'ready' | 'blocked';
  settings: MindStewardInboxQueueSettings;
  items: MindStewardInboxQueueItem[];
  summary: {
    total: number;
    pending: number;
    blocked: number;
    failed: number;
    selectedForSample: number;
    stableFile: number;
    debouncing: number;
    largeFile: number;
    done: number;
  };
  blockers: string[];
  safety: {
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    writesKanban: false;
    stateOwnedBy: 'brain';
    statePath: string;
  };
}

export interface RefreshMindStewardInboxQueueOptions {
  mindRoot?: string;
  statePath?: string;
  now?: Date;
  settings?: Partial<Omit<MindStewardInboxQueueSettings, 'localOnly'>>;
}

export interface RecordMindStewardInboxQueueFailureOptions {
  statePath?: string;
  capturePath: string;
  error: string;
  now?: Date;
  retryDelaySeconds?: number;
}

export interface MindStewardInboxQueueFailureResult {
  status: 'retry-scheduled' | 'failed-routed' | 'blocked';
  item: MindStewardInboxQueueItem | null;
  blockers: string[];
  safety: {
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    writesKanban: false;
    failureRouteOwnedBy: 'brain-runtime';
  };
}

export interface EnforceMindStewardInboxQueuePolicyOptions {
  state: MindStewardInboxQueueState;
  now?: Date;
  lastRunAt?: string | null;
  runningJobs?: number;
  featureFlagEnabled?: boolean;
}

export interface MindStewardInboxQueuePolicyResult {
  status: 'ready' | 'blocked';
  canStartRun: boolean;
  selectedItems: MindStewardInboxQueueItem[];
  blockers: string[];
  settings: MindStewardInboxQueueSettings;
  safety: {
    writesToMind: false;
    movesCaptures: false;
    deletesCaptures: false;
    writesKanban: false;
    startsBackgroundDaemon: false;
    requiresFeatureFlag: true;
    localOnly: true;
  };
}

const DEFAULT_SETTINGS: MindStewardInboxQueueSettings = {
  maxConcurrentJobs: 1,
  maxFilesPerRun: 3,
  debounceSeconds: 30,
  maxRetries: 2,
  largeFileThresholdMb: 2,
  minimumSecondsBetweenRuns: 300,
  localOnly: true,
};

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256Buffer(value: Buffer): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function normalizeSettings(settings?: RefreshMindStewardInboxQueueOptions['settings']): MindStewardInboxQueueSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    localOnly: true,
  };
}

function resolveMindRoot(value?: string): string {
  const configured = value ?? process.env.BRAIN_CORE_MIND_STEWARD_MIND_ROOT ?? DEFAULT_MIND_ROOT;
  return path.resolve(configured);
}

function resolveStatePath(value?: string): string {
  const configured = value ?? process.env.BRAIN_CORE_MIND_STEWARD_INBOX_QUEUE_STATE_PATH;
  if (!configured) return DEFAULT_STATE_PATH;
  return path.isAbsolute(configured) ? configured : path.resolve(BRAIN_ROOT, configured);
}

function readExistingState(statePath: string): MindStewardInboxQueueState | null {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8')) as MindStewardInboxQueueState;
  } catch {
    return null;
  }
}

function writeJsonAtomically(filePath: string, value: unknown): void {
  const directory = path.dirname(filePath);
  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  renameSync(temporary, filePath);
  chmodSync(filePath, 0o600);
}

function toIsoTime(ms: number): string {
  return new Date(ms).toISOString();
}

function buildItemId(relativePath: string): string {
  return `mind-inbox-${sha256(relativePath).slice(0, 16)}`;
}

function hashFile(filePath: string): string {
  return sha256Buffer(fs.readFileSync(filePath, null as any) as unknown as Buffer);
}

function isTerminalHandledStatus(status: MindStewardInboxQueueItemStatus): boolean {
  return status === 'reported' || status === 'approved' || status === 'done';
}

function isRetryHeld(previousItem: MindStewardInboxQueueItem | undefined, now: Date): boolean {
  if (!previousItem?.nextRetryAfter) return false;
  const retryAt = Date.parse(previousItem.nextRetryAfter);
  return Number.isFinite(retryAt) && retryAt > now.getTime();
}

function isUnchangedCapture(previousItem: MindStewardInboxQueueItem | undefined, sizeBytes: number, modifiedAt: string, contentSha256: string): boolean {
  if (!previousItem) return false;
  if (previousItem.contentSha256) return previousItem.contentSha256 === contentSha256;
  return previousItem.sizeBytes === sizeBytes && previousItem.modifiedAt === modifiedAt;
}

function isSafeInboxFile(mindRoot: string, inboxRoot: string, candidate: string): boolean {
  try {
    const stat = lstatSync(candidate);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const resolved = realpathSync(candidate);
    const relativeToInbox = path.relative(inboxRoot, resolved);
    const relativeToMind = path.relative(mindRoot, resolved);
    return Boolean(relativeToInbox)
      && !relativeToInbox.startsWith('..')
      && !path.isAbsolute(relativeToInbox)
      && !relativeToMind.startsWith('..')
      && !path.isAbsolute(relativeToMind);
  } catch {
    return false;
  }
}

function summarize(items: MindStewardInboxQueueItem[]): MindStewardInboxQueueState['summary'] {
  return {
    total: items.length,
    pending: items.filter(item => item.status === 'pending').length,
    blocked: items.filter(item => item.status === 'blocked').length,
    failed: items.filter(item => item.status === 'failed').length,
    selectedForSample: items.filter(item => item.selectedForSample).length,
    stableFile: items.filter(item => item.stableFile).length,
    debouncing: items.filter(item => item.debounceUntil !== null).length,
    largeFile: items.filter(item => item.largeFile).length,
    done: items.filter(item => item.status === 'done').length,
  };
}

function resolveExistingInboxPath(mindRoot: string): { absolutePath: string; relativePath: string } | null {
  for (const candidate of MIND_INBOX_NEW_CANDIDATES) {
    const absolutePath = path.join(mindRoot, ...candidate.path.split('/'));
    try {
      const resolvedPath = realpathSync(absolutePath);
      if (fs.statSync(resolvedPath).isDirectory()) {
        return { absolutePath: resolvedPath, relativePath: candidate.path };
      }
    } catch {
      // Try the next migration candidate.
    }
  }
  return null;
}

function createBlockedState(
  mindRoot: string,
  inboxPath: string,
  statePath: string,
  nowIso: string,
  settings: MindStewardInboxQueueSettings,
  blockers: string[],
): MindStewardInboxQueueState {
  return {
    schemaVersion: '1.0',
    queueId: `mind-inbox-queue-${sha256(`${mindRoot}:${inboxPath}`).slice(0, 12)}`,
    generatedAt: nowIso,
    source: 'brain-runtime',
    mindRoot,
    inboxPath,
    status: 'blocked',
    settings,
    items: [],
    summary: summarize([]),
    blockers,
    safety: {
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      writesKanban: false,
      stateOwnedBy: 'brain',
      statePath,
    },
  };
}

export function refreshMindStewardInboxQueue(
  options: RefreshMindStewardInboxQueueOptions = {},
): MindStewardInboxQueueState {
  const settings = normalizeSettings(options.settings);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const mindRoot = resolveMindRoot(options.mindRoot);
  const statePath = resolveStatePath(options.statePath);
  const previous = readExistingState(statePath);
  const previousByPath = new Map((previous?.items ?? []).map(item => [item.path, item]));

  let resolvedMindRoot: string;
  try {
    resolvedMindRoot = realpathSync(mindRoot);
    if (!fs.statSync(resolvedMindRoot).isDirectory()) {
      throw new Error('not a directory');
    }
  } catch {
    const state = createBlockedState(mindRoot, path.join(mindRoot, ...MIND_TARGET_PATHS.inboxNew.split('/')), statePath, nowIso, settings, [
      'mindRootUnavailable',
    ]);
    writeJsonAtomically(statePath, state);
    return state;
  }

  const resolvedInbox = resolveExistingInboxPath(resolvedMindRoot);
  if (!resolvedInbox) {
    const state = createBlockedState(
      resolvedMindRoot,
      path.join(resolvedMindRoot, ...MIND_TARGET_PATHS.inboxNew.split('/')),
      statePath,
      nowIso,
      settings,
      ['mindInboxUnavailable'],
    );
    writeJsonAtomically(statePath, state);
    return state;
  }

  const inboxPath = path.join(resolvedMindRoot, ...resolvedInbox.relativePath.split('/'));
  const resolvedInboxPath = resolvedInbox.absolutePath;

  const largeFileThresholdBytes = settings.largeFileThresholdMb * 1024 * 1024;
  const entries = fs.readdirSync(resolvedInboxPath, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => path.join(resolvedInboxPath, entry.name))
    .filter(candidate => isSafeInboxFile(resolvedMindRoot, resolvedInboxPath, candidate))
    .sort((a, b) => {
      const aStat = fs.statSync(a);
      const bStat = fs.statSync(b);
      return aStat.mtime.getTime() - bStat.mtime.getTime() || path.basename(a).localeCompare(path.basename(b));
    });

  let selectedCount = 0;
  const seenPaths = new Set<string>();
  const items: MindStewardInboxQueueItem[] = entries.map(filePath => {
    const stat = fs.statSync(filePath);
    const relativePath = path.relative(resolvedMindRoot, filePath).replace(/\\/g, '/');
    seenPaths.add(relativePath);
    const previousItem = previousByPath.get(relativePath);
    const modifiedAt = toIsoTime(stat.mtime.getTime());
    const contentSha256 = hashFile(filePath);
    const largeFile = stat.size > largeFileThresholdBytes;
    const stableAt = toIsoTime(stat.mtime.getTime() + settings.debounceSeconds * 1000);
    const stable = now.getTime() >= stat.mtime.getTime() + settings.debounceSeconds * 1000;
    const unchangedHandled = isTerminalHandledStatus(previousItem?.status ?? 'pending')
      && isUnchangedCapture(previousItem, stat.size, modifiedAt, contentSha256);
    const unchangedFailed = previousItem?.status === 'failed'
      && isUnchangedCapture(previousItem, stat.size, modifiedAt, contentSha256);
    const retryHeld = isRetryHeld(previousItem, now);
    const preservePreviousState = unchangedHandled || unchangedFailed || retryHeld;
    const canSelect = !preservePreviousState && !largeFile && stable && selectedCount < settings.maxFilesPerRun;
    if (canSelect) selectedCount += 1;

    return {
      id: previousItem?.id ?? buildItemId(relativePath),
      path: relativePath,
      status: preservePreviousState ? previousItem?.status ?? 'pending' : largeFile ? 'blocked' : 'pending',
      sizeBytes: stat.size,
      contentSha256,
      modifiedAt,
      firstSeenAt: previousItem?.firstSeenAt ?? nowIso,
      lastCheckedAt: nowIso,
      stableFile: stable,
      stableAt,
      debounceSeconds: settings.debounceSeconds,
      debounceUntil: stable ? null : stableAt,
      attemptCount: previousItem?.attemptCount ?? 0,
      lastError: preservePreviousState ? previousItem?.lastError ?? 'already_processed' : largeFile ? 'blocked_large_file' : null,
      nextRetryAfter: preservePreviousState ? previousItem?.nextRetryAfter ?? null : null,
      failureRoute: preservePreviousState ? previousItem?.failureRoute ?? null : null,
      largeFile,
      selectedForSample: canSelect,
      selectorStatus: previousItem?.selectorStatus ?? 'unknown',
    };
  });

  for (const previousItem of previous?.items ?? []) {
    if (seenPaths.has(previousItem.path)) continue;
    items.push({
      ...previousItem,
      status: 'done',
      lastCheckedAt: nowIso,
      stableFile: false,
      stableAt: null,
      debounceSeconds: settings.debounceSeconds,
      debounceUntil: null,
      selectedForSample: false,
      lastError: previousItem.lastError ?? 'capture_not_found_in_inbox',
    });
  }

  const state: MindStewardInboxQueueState = {
    schemaVersion: '1.0',
    queueId: previous?.queueId ?? `mind-inbox-queue-${sha256(resolvedInboxPath).slice(0, 12)}`,
    generatedAt: nowIso,
    source: 'brain-runtime',
    mindRoot: resolvedMindRoot,
    inboxPath: resolvedInboxPath,
    status: 'ready',
    settings,
    items,
    summary: summarize(items),
    blockers: [],
    safety: {
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      writesKanban: false,
      stateOwnedBy: 'brain',
      statePath,
    },
  };

  writeJsonAtomically(statePath, state);
  return state;
}

export function enforceMindStewardInboxQueuePolicy(
  options: EnforceMindStewardInboxQueuePolicyOptions,
): MindStewardInboxQueuePolicyResult {
  const now = options.now ?? new Date();
  const state = options.state;
  const selectedItems = state.items.filter(item => item.selectedForSample);
  const blockers: string[] = [];

  if (options.featureFlagEnabled !== true) blockers.push('queueWorkflowFeatureFlagRequired');
  if (state.status !== 'ready') blockers.push('queueStateMustBeReady');
  if (state.settings.localOnly !== true) blockers.push('queueMustRemainLocalOnly');
  if ((options.runningJobs ?? 0) >= state.settings.maxConcurrentJobs) blockers.push('maxConcurrentJobsReached');
  if (selectedItems.length === 0) blockers.push('noSelectedQueueItems');
  if (selectedItems.length > state.settings.maxFilesPerRun) blockers.push('maxFilesPerRunExceeded');
  if (selectedItems.some(item => !item.stableFile || item.debounceUntil !== null)) blockers.push('selectedItemsMustBeStableAfterDebounce');
  if (selectedItems.some(item => item.largeFile || item.lastError === 'blocked_large_file')) blockers.push('largeFileSelectedForRun');
  if (selectedItems.some(item => item.attemptCount > state.settings.maxRetries)) blockers.push('retryLimitExceeded');
  if (selectedItems.some(item => item.status !== 'pending')) blockers.push('selectedItemsMustBePending');

  if (options.lastRunAt) {
    const lastRunAt = Date.parse(options.lastRunAt);
    if (Number.isFinite(lastRunAt)) {
      const elapsedSeconds = Math.floor((now.getTime() - lastRunAt) / 1000);
      if (elapsedSeconds < state.settings.minimumSecondsBetweenRuns) blockers.push('minimumSecondsBetweenRunsNotElapsed');
    } else {
      blockers.push('lastRunAtInvalid');
    }
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    canStartRun: blockers.length === 0,
    selectedItems,
    blockers,
    settings: state.settings,
    safety: {
      writesToMind: false,
      movesCaptures: false,
      deletesCaptures: false,
      writesKanban: false,
      startsBackgroundDaemon: false,
      requiresFeatureFlag: true,
      localOnly: true,
    },
  };
}

export function readMindStewardInboxQueueState(statePath?: string): MindStewardInboxQueueState | null {
  return readExistingState(resolveStatePath(statePath));
}

export function recordMindStewardInboxQueueFailure(
  options: RecordMindStewardInboxQueueFailureOptions,
): MindStewardInboxQueueFailureResult {
  const statePath = resolveStatePath(options.statePath);
  const state = readExistingState(statePath);
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const retryDelaySeconds = options.retryDelaySeconds ?? 60;
  const blockers: string[] = [];
  if (!state) blockers.push('queueStateUnavailable');
  const item = state?.items.find(entry => entry.path === options.capturePath) ?? null;
  if (state && !item) blockers.push('queueItemUnavailable');

  const safety = {
    writesToMind: false as const,
    movesCaptures: false as const,
    deletesCaptures: false as const,
    writesKanban: false as const,
    failureRouteOwnedBy: 'brain-runtime' as const,
  };

  if (!state || !item || blockers.length > 0) {
    return {
      status: 'blocked',
      item: null,
      blockers,
      safety,
    };
  }

  const nextAttemptCount = item.attemptCount + 1;
  const retriesExhausted = nextAttemptCount > state.settings.maxRetries;
  const updatedItem: MindStewardInboxQueueItem = {
    ...item,
    status: retriesExhausted ? 'failed' : 'pending',
    selectedForSample: false,
    selectorStatus: 'failed',
    attemptCount: nextAttemptCount,
    lastCheckedAt: nowIso,
    lastError: options.error,
    nextRetryAfter: retriesExhausted
      ? null
      : new Date(now.getTime() + retryDelaySeconds * 1000).toISOString(),
    failureRoute: retriesExhausted ? 'brain-runtime-queue-status' : null,
  };

  const updatedState: MindStewardInboxQueueState = {
    ...state,
    generatedAt: nowIso,
    items: state.items.map(entry => entry.path === options.capturePath ? updatedItem : entry),
  };
  updatedState.summary = summarize(updatedState.items);
  writeJsonAtomically(statePath, updatedState);

  return {
    status: retriesExhausted ? 'failed-routed' : 'retry-scheduled',
    item: updatedItem,
    blockers: [],
    safety,
  };
}
