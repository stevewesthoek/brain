import { BrainCoreError, brainCoreRequest } from './braincore-client';
import type { z } from 'zod';

const DEFAULT_NEGATIVE_CACHE_TTL_MS = 5 * 60_000;
const STORAGE_KEY = 'brain-console.optional-endpoint-negative-cache.v1';

function readStoredEntries(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = value ? JSON.parse(value) : {};
    return parsed && typeof parsed === 'object' ? parsed as Record<string, number> : {};
  } catch {
    return {};
  }
}

function writeStoredEntries(entries: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage is an optimization; the in-memory cache remains authoritative.
  }
}

export class OptionalEndpointNegativeCache {
  private readonly entries = new Map<string, number>();

  constructor(private readonly ttlMs = DEFAULT_NEGATIVE_CACHE_TTL_MS) {}

  has(path: string, now = Date.now()): boolean {
    const expiresAt = this.entries.get(path) ?? readStoredEntries()[path];
    if (expiresAt === undefined) return false;
    if (expiresAt <= now) {
      this.entries.delete(path);
      const stored = readStoredEntries();
      delete stored[path];
      writeStoredEntries(stored);
      return false;
    }
    this.entries.set(path, expiresAt);
    return true;
  }

  mark(path: string, now = Date.now()): void {
    const expiresAt = now + this.ttlMs;
    this.entries.set(path, expiresAt);
    writeStoredEntries({ ...readStoredEntries(), [path]: expiresAt });
  }

  clear(path?: string): void {
    const stored = readStoredEntries();
    if (path) {
      this.entries.delete(path);
      delete stored[path];
    } else {
      this.entries.clear();
      for (const key of Object.keys(stored)) delete stored[key];
    }
    writeStoredEntries(stored);
  }
}

export const optionalEndpointNegativeCache = new OptionalEndpointNegativeCache();

export async function optionalBrainCoreRequest<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema): Promise<z.output<TSchema>> {
  if (optionalEndpointNegativeCache.has(path)) {
    throw new BrainCoreError(`GET ${path} is temporarily unavailable (negative cache)`, 404, { cached: true });
  }

  try {
    return await brainCoreRequest(path, schema);
  } catch (error) {
    if (error instanceof BrainCoreError && error.status === 404) {
      optionalEndpointNegativeCache.mark(path);
    }
    throw error;
  }
}
