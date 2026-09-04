import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type CodexUsageFreshness = 'CURRENT' | 'STALE' | 'DEGRADED' | 'UNAVAILABLE' | 'PENDING';

export interface CodexUsageWindow {
  remainingPercent: number;
  usedPercent: number;
  resetsAt: string | null;
}

export interface CodexUsageDiagnostics {
  refreshCount: number;
  filesInspected: number;
  filesRead: number;
  bytesRead: number;
  cachedFiles: number;
  truncated: boolean;
  inFlight: boolean;
  lastRefreshAt: string | null;
  lastRefreshDurationMs: number | null;
  errorCount: number;
}

export interface CodexUsageSnapshot {
  fiveHour: CodexUsageWindow;
  sevenDay: CodexUsageWindow;
  asOf: string | null;
  freshness: CodexUsageFreshness;
  diagnostics: CodexUsageDiagnostics;
}

interface RateLimitWindow {
  used_percent: number;
  window_minutes: number;
  resets_at: number;
}

interface UsageCandidate {
  fiveHour: CodexUsageWindow;
  sevenDay: CodexUsageWindow;
  asOf: string;
}

interface FileMetadata {
  filePath: string;
  mtimeMs: number;
  size: number;
}

interface CachedFileRecord {
  mtimeMs: number;
  size: number;
  candidate: UsageCandidate | null;
}

interface PersistedIndex {
  version: 1;
  savedAt: string;
  records: Record<string, CachedFileRecord>;
}

export interface CodexUsageReaderOptions {
  sessionsDir?: string;
  cachePath?: string;
  now?: () => number;
  readFileTail?: (filePath: string, maxBytes: number) => Promise<{ text: string; bytesRead: number }>;
  maxFiles?: number;
  maxDirectories?: number;
  maxDirectoryEntries?: number;
  maxDepth?: number;
  maxBytesPerRefresh?: number;
  maxTailBytesPerFile?: number;
  refreshTtlMs?: number;
}

const DEFAULT_WINDOW: CodexUsageWindow = {
  remainingPercent: 100,
  usedPercent: 0,
  resetsAt: null,
};

export const CODEX_USAGE_BOUNDS = {
  maxFiles: 2_048,
  maxDirectories: 2_048,
  maxDirectoryEntries: 16_384,
  maxDepth: 16,
  maxBytesPerRefresh: 64 * 1024 * 1024,
  maxTailBytesPerFile: 64 * 1024,
  maxCacheBytes: 8 * 1024 * 1024,
  refreshTtlMs: 30_000,
} as const;

function fallbackWindow(): CodexUsageWindow {
  return { ...DEFAULT_WINDOW };
}

function pendingSnapshot(): CodexUsageSnapshot {
  return {
    fiveHour: fallbackWindow(),
    sevenDay: fallbackWindow(),
    asOf: null,
    freshness: 'PENDING',
    diagnostics: {
      refreshCount: 0,
      filesInspected: 0,
      filesRead: 0,
      bytesRead: 0,
      cachedFiles: 0,
      truncated: false,
      inFlight: false,
      lastRefreshAt: null,
      lastRefreshDurationMs: null,
      errorCount: 0,
    },
  };
}

function toCodexWindow(window: RateLimitWindow | undefined): CodexUsageWindow {
  if (!window || !Number.isFinite(window.used_percent) || !Number.isFinite(window.resets_at)) {
    return fallbackWindow();
  }
  return {
    usedPercent: Math.round(window.used_percent),
    remainingPercent: Math.round(Math.max(0, 100 - window.used_percent)),
    resetsAt: new Date(window.resets_at * 1000).toISOString(),
  };
}

async function readFileTail(filePath: string, maxBytes: number): Promise<{ text: string; bytesRead: number }> {
  const handle = await fs.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    const bytesToRead = Math.min(stat.size, maxBytes);
    if (bytesToRead <= 0) return { text: '', bytesRead: 0 };
    const buffer = Buffer.allocUnsafe(bytesToRead);
    const result = await handle.read(buffer, 0, bytesToRead, Math.max(0, stat.size - bytesToRead));
    return { text: buffer.subarray(0, result.bytesRead).toString('utf8'), bytesRead: result.bytesRead };
  } finally {
    await handle.close();
  }
}

async function collectFileMetadata(
  sessionsDir: string,
  bounds: Pick<CodexUsageReaderOptions, 'maxFiles' | 'maxDirectories' | 'maxDirectoryEntries' | 'maxDepth'>,
): Promise<{ files: FileMetadata[]; filesInspected: number; truncated: boolean; rootAvailable: boolean }> {
  const maxFiles = bounds.maxFiles ?? CODEX_USAGE_BOUNDS.maxFiles;
  const maxDirectories = bounds.maxDirectories ?? CODEX_USAGE_BOUNDS.maxDirectories;
  const maxDirectoryEntries = bounds.maxDirectoryEntries ?? CODEX_USAGE_BOUNDS.maxDirectoryEntries;
  const maxDepth = bounds.maxDepth ?? CODEX_USAGE_BOUNDS.maxDepth;
  const files: FileMetadata[] = [];
  const pendingDirectories: Array<{ directory: string; depth: number }> = [{ directory: sessionsDir, depth: 0 }];
  let directoriesVisited = 0;
  let entriesVisited = 0;
  let truncated = false;

  try {
    await fs.access(sessionsDir);
  } catch {
    return { files, filesInspected: 0, truncated: false, rootAvailable: false };
  }

  while (pendingDirectories.length > 0 && directoriesVisited < maxDirectories && entriesVisited < maxDirectoryEntries) {
    const current = pendingDirectories.shift();
    if (!current) break;
    directoriesVisited += 1;

    let directory;
    try {
      directory = await fs.opendir(current.directory);
    } catch {
      truncated = true;
      continue;
    }

    try {
      for await (const entry of directory) {
        entriesVisited += 1;
        if (entriesVisited > maxDirectoryEntries) {
          truncated = true;
          break;
        }
        const entryPath = path.join(current.directory, entry.name);
        if (entry.isDirectory()) {
          if (current.depth >= maxDepth || pendingDirectories.length + directoriesVisited >= maxDirectories) {
            truncated = true;
          } else {
            pendingDirectories.push({ directory: entryPath, depth: current.depth + 1 });
          }
          continue;
        }
        if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
        let stat;
        try {
          stat = await fs.stat(entryPath);
        } catch {
          truncated = true;
          continue;
        }
        files.push({ filePath: entryPath, mtimeMs: stat.mtime.getTime(), size: stat.size });
        if (files.length >= maxFiles) {
          truncated = true;
          break;
        }
      }
    } finally {
      await directory.close().catch(() => undefined);
    }
  }

  if (pendingDirectories.length > 0 || directoriesVisited >= maxDirectories || entriesVisited >= maxDirectoryEntries) {
    truncated = true;
  }
  files.sort((left, right) => right.mtimeMs - left.mtimeMs || right.size - left.size || left.filePath.localeCompare(right.filePath));
  return { files, filesInspected: files.length, truncated, rootAvailable: true };
}

function candidateFromText(text: string, offset: number): UsageCandidate | null {
  const completeText = offset > 0 ? text.slice(text.indexOf('\n') + 1) : text;
  let best: UsageCandidate | null = null;
  for (const line of completeText.split('\n')) {
    if (!line.includes('"token_count"')) continue;
    try {
      const object = JSON.parse(line) as {
        type?: string;
        timestamp?: string;
        payload?: { type?: string; rate_limits?: { primary?: RateLimitWindow; secondary?: RateLimitWindow } };
      };
      if (object.type !== 'event_msg' || object.payload?.type !== 'token_count' || !object.payload.rate_limits?.primary || !object.timestamp) continue;
      const timestamp = new Date(object.timestamp).getTime();
      if (!Number.isFinite(timestamp)) continue;
      if (best && new Date(best.asOf).getTime() >= timestamp) continue;
      best = {
        fiveHour: toCodexWindow(object.payload.rate_limits.primary),
        sevenDay: toCodexWindow(object.payload.rate_limits.secondary),
        asOf: object.timestamp,
      };
    } catch {
      // Malformed session lines are ignored without retaining their contents.
    }
  }
  return best;
}

async function loadIndex(cachePath: string): Promise<PersistedIndex | null> {
  try {
    const stat = await fs.stat(cachePath);
    if (stat.size > CODEX_USAGE_BOUNDS.maxCacheBytes) return null;
    const value = JSON.parse(await fs.readFile(cachePath, 'utf8')) as PersistedIndex;
    if (value.version !== 1 || !value.records || typeof value.records !== 'object') return null;
    return value;
  } catch {
    return null;
  }
}

async function saveIndex(cachePath: string, index: PersistedIndex): Promise<void> {
  try {
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(index), { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Disk cache failure must not affect the live telemetry response.
  }
}

export function createCodexUsageReader(options: CodexUsageReaderOptions = {}) {
  const sessionsDir = options.sessionsDir ?? path.join(os.homedir(), '.codex', 'sessions');
  const cachePath = options.cachePath ?? path.join(os.homedir(), '.brain', 'cache', 'brain-core', 'codex-usage-index.json');
  const now = options.now ?? (() => Date.now());
  const refreshTtlMs = options.refreshTtlMs ?? CODEX_USAGE_BOUNDS.refreshTtlMs;
  const maxBytesPerRefresh = options.maxBytesPerRefresh ?? CODEX_USAGE_BOUNDS.maxBytesPerRefresh;
  const maxTailBytesPerFile = options.maxTailBytesPerFile ?? CODEX_USAGE_BOUNDS.maxTailBytesPerFile;
  const readTail = options.readFileTail ?? readFileTail;
  let snapshot = pendingSnapshot();
  let persistedIndex: PersistedIndex | null | undefined;
  let refreshPromise: Promise<CodexUsageSnapshot> | null = null;
  let retryAfter = 0;

  function startRefresh(): Promise<CodexUsageSnapshot> {
    if (refreshPromise) return refreshPromise;
    const startedAt = now();
    snapshot = { ...snapshot, diagnostics: { ...snapshot.diagnostics, inFlight: true } };
    refreshPromise = (async () => {
      if (persistedIndex === undefined) persistedIndex = await loadIndex(cachePath);
      const listing = await collectFileMetadata(sessionsDir, options);
      const previousRecords = persistedIndex?.records ?? {};
      const records: Record<string, CachedFileRecord> = {};
      let bytesRead = 0;
      let filesRead = 0;
      let cachedFiles = 0;
      let errorCount = 0;
      let truncated = listing.truncated;
      let latest: UsageCandidate | null = null;

      for (const file of listing.files) {
        const previous = previousRecords[file.filePath];
        let candidate: UsageCandidate | null;
        if (previous?.mtimeMs === file.mtimeMs && previous.size === file.size) {
          candidate = previous.candidate;
          cachedFiles += 1;
        } else if (bytesRead >= maxBytesPerRefresh) {
          candidate = null;
          truncated = true;
        } else {
          try {
            const tail = await readTail(file.filePath, Math.min(maxTailBytesPerFile, maxBytesPerRefresh - bytesRead));
            bytesRead += tail.bytesRead;
            filesRead += 1;
            candidate = candidateFromText(tail.text, Math.max(0, file.size - tail.bytesRead));
          } catch {
            bytesRead += 0;
            filesRead += 1;
            errorCount += 1;
            candidate = null;
          }
        }
        records[file.filePath] = { mtimeMs: file.mtimeMs, size: file.size, candidate };
        if (candidate && (!latest || new Date(candidate.asOf).getTime() > new Date(latest.asOf).getTime())) latest = candidate;
      }

      const completedAt = now();
      const freshness: CodexUsageFreshness = !listing.rootAvailable
        ? 'UNAVAILABLE'
        : errorCount > 0 || truncated
          ? 'DEGRADED'
          : latest
            ? 'CURRENT'
            : 'UNAVAILABLE';
      const nextDiagnostics: CodexUsageDiagnostics = {
        refreshCount: snapshot.diagnostics.refreshCount + 1,
        filesInspected: listing.filesInspected,
        filesRead,
        bytesRead,
        cachedFiles,
        truncated,
        inFlight: false,
        lastRefreshAt: new Date(completedAt).toISOString(),
        lastRefreshDurationMs: Math.max(0, completedAt - startedAt),
        errorCount,
      };
      snapshot = {
        fiveHour: latest?.fiveHour ?? fallbackWindow(),
        sevenDay: latest?.sevenDay ?? fallbackWindow(),
        asOf: latest?.asOf ?? null,
        freshness,
        diagnostics: nextDiagnostics,
      };
      persistedIndex = { version: 1, savedAt: nextDiagnostics.lastRefreshAt ?? new Date(completedAt).toISOString(), records };
      await saveIndex(cachePath, persistedIndex);
      retryAfter = 0;
      return snapshot;
    })().catch(() => {
      const completedAt = now();
      const hasValue = snapshot.asOf !== null;
      snapshot = {
        ...snapshot,
        freshness: hasValue ? 'DEGRADED' : 'UNAVAILABLE',
        diagnostics: {
          ...snapshot.diagnostics,
          inFlight: false,
          refreshCount: snapshot.diagnostics.refreshCount + 1,
          lastRefreshAt: new Date(completedAt).toISOString(),
          lastRefreshDurationMs: Math.max(0, completedAt - startedAt),
          errorCount: snapshot.diagnostics.errorCount + 1,
        },
      };
      retryAfter = completedAt + refreshTtlMs;
      return snapshot;
    }).finally(() => {
      refreshPromise = null;
    });
    return refreshPromise;
  }

  function getSnapshot(): CodexUsageSnapshot {
    const currentTime = now();
    const lastRefresh = snapshot.diagnostics.lastRefreshAt ? Date.parse(snapshot.diagnostics.lastRefreshAt) : null;
    const expired = lastRefresh === null || currentTime - lastRefresh >= refreshTtlMs;
    if (expired && currentTime >= retryAfter && !refreshPromise) {
      if (lastRefresh !== null) snapshot = { ...snapshot, freshness: 'STALE' };
      void startRefresh();
    }
    return snapshot;
  }

  return {
    getSnapshot,
    refresh: () => startRefresh(),
    getInFlightRefresh: () => refreshPromise,
  };
}
