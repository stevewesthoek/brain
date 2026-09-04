import { BrainCoreError, brainCoreRequest } from './braincore-client';
import type { z } from 'zod';

const DEFAULT_NEGATIVE_CACHE_TTL_MS = 5 * 60_000;

export class OptionalEndpointNegativeCache {
  private readonly entries = new Map<string, number>();

  constructor(private readonly ttlMs = DEFAULT_NEGATIVE_CACHE_TTL_MS) {}

  has(path: string, now = Date.now()): boolean {
    const expiresAt = this.entries.get(path);
    if (expiresAt === undefined) return false;
    if (expiresAt <= now) {
      this.entries.delete(path);
      return false;
    }
    return true;
  }

  mark(path: string, now = Date.now()): void {
    this.entries.set(path, now + this.ttlMs);
  }

  clear(path?: string): void {
    if (path) this.entries.delete(path);
    else this.entries.clear();
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
