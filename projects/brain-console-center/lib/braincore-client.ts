import { z } from 'zod';

export const BRAIN_CORE_URL = (process.env.NEXT_PUBLIC_BRAIN_CORE_URL ?? 'http://localhost:4877').replace(/\/$/, '');

const REQUEST_TIMEOUT_MS = 10_000;

export class BrainCoreError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'BrainCoreError';
  }
}

export async function brainCoreRequest<T>(path: string, schema: z.ZodType<T>, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const controller = new AbortController();
  const { timeoutMs, ...requestInit } = init ?? {};
  const timeout = setTimeout(() => controller.abort(), timeoutMs ?? REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${BRAIN_CORE_URL}${path}`, {
      ...requestInit,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(requestInit.headers ?? {}),
      },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new BrainCoreError(`${requestInit.method ?? 'GET'} ${path} failed with HTTP ${response.status}`, response.status, payload);
    }
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BrainCoreError(`${requestInit.method ?? 'GET'} ${path} timed out`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function postBrainCoreAction<T>(path: string, schema: z.ZodType<T>, body: Record<string, unknown> = {}, timeoutMs?: number): Promise<T> {
  return brainCoreRequest(path, schema, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs,
  });
}
