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

export async function brainCoreRequest<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema, init?: RequestInit & { timeoutMs?: number }): Promise<z.output<TSchema>> {
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
      const backendPayload = payload && typeof payload === 'object' ? payload as { error?: unknown; message?: unknown; code?: unknown } : null;
      const nestedError = backendPayload?.error && typeof backendPayload.error === 'object'
        ? backendPayload.error as { message?: unknown; code?: unknown }
        : null;
      const backendMessage = nestedError?.message ?? backendPayload?.message ?? nestedError?.code ?? backendPayload?.code ?? backendPayload?.error;
      const detail = typeof backendMessage === 'string' ? `: ${backendMessage}` : '';
      throw new BrainCoreError(`${requestInit.method ?? 'GET'} ${path} failed with HTTP ${response.status}${detail}`, response.status, payload);
    }
    const parsed = schema.safeParse(payload);
    if (!parsed.success) {
      throw new BrainCoreError(`${requestInit.method ?? 'GET'} ${path} returned an unexpected response shape`, response.status, {
        issues: parsed.error.issues,
        payload,
      });
    }
    return parsed.data as z.output<TSchema>;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BrainCoreError(`${requestInit.method ?? 'GET'} ${path} timed out`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function postBrainCoreAction<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema, body: Record<string, unknown> = {}, timeoutMs?: number): Promise<z.output<TSchema>> {
  return brainCoreRequest(path, schema, {
    method: 'POST',
    body: JSON.stringify(body),
    timeoutMs,
  });
}
