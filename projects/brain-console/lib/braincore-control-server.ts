import 'server-only';

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { agentModeControlErrorResponseSchema, agentModeControlResultResponseSchema, type AgentModeControlResponse } from './braincore-schemas';

const BRAIN_SERVICE_AUTH_PROTOCOL_VERSION = 'brain-service-auth-v1' as const;
const MAX_BODY_BYTES = 16_384;
const MAX_REQUEST_ID_LENGTH = 128;
const REQUEST_TIMEOUT_MS = 10_000;

const lifecyclePathPattern = /^\/agent-mode\/control\/run\/[^/]+$/u;
const reviewPathPattern = /^\/agent-mode\/control\/review\/[^/]+$/u;

const lifecycleBodySchema = z.object({
  schemaVersion: z.literal('agent-mode-control-v1'),
  operationId: z.string().min(1).max(128),
  action: z.enum(['pause', 'resume', 'cancel', 'kill']),
  reason: z.string().min(1).max(512),
}).strict();

const reviewBodySchema = z.object({
  schemaVersion: z.literal('agent-mode-control-v1'),
  operationId: z.string().min(1).max(128),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().min(1).max(512),
  evidenceHash: z.string().min(1).max(256),
}).strict();

export type BrainCoreLifecycleControlBody = {
  schemaVersion: 'agent-mode-control-v1';
  operationId: string;
  action: 'pause' | 'resume' | 'cancel' | 'kill';
  reason: string;
};

export type BrainCoreReviewControlBody = {
  schemaVersion: 'agent-mode-control-v1';
  operationId: string;
  decision: 'approved' | 'rejected';
  reason: string;
  evidenceHash: string;
};

export type BrainCoreControlBody = BrainCoreLifecycleControlBody | BrainCoreReviewControlBody;

export type BrainCoreControlRequest = {
  pathname: string;
  body: BrainCoreControlBody;
  requestId?: string;
  now?: string | number | Date;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export class BrainCoreControlError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'BrainCoreControlError';
  }
}

function epochMs(value: string | number | Date | undefined): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Date.parse(value);
  return Date.now();
}

function serviceIdentity(): { serviceId: string; secret: string } {
  const serviceId = process.env.BRAIN_CORE_SERVICE_ID;
  const secret = process.env.BRAIN_CORE_SERVICE_SECRET;
  if (!serviceId || !secret) throw new BrainCoreControlError('Brain Core control is unavailable.', 'service_identity_unavailable');
  return { serviceId, secret };
}

function canonicalMaterial(input: {
  serviceId: string;
  method: string;
  pathname: string;
  requestId: string;
  timestamp: string;
  contentSha256: string;
}): string {
  return JSON.stringify({
    protocolVersion: BRAIN_SERVICE_AUTH_PROTOCOL_VERSION,
    serviceId: input.serviceId,
    method: input.method.toUpperCase(),
    pathname: input.pathname,
    requestId: input.requestId,
    timestamp: input.timestamp,
    contentSha256: input.contentSha256,
  });
}

function validateRequest(input: BrainCoreControlRequest, bodyText: string): void {
  const isLifecycle = lifecyclePathPattern.test(input.pathname);
  const isReview = reviewPathPattern.test(input.pathname);
  if (!isLifecycle && !isReview) {
    throw new BrainCoreControlError('Brain Core control path is unavailable.', 'control_path_invalid');
  }
  if (Buffer.byteLength(bodyText, 'utf8') > MAX_BODY_BYTES) {
    throw new BrainCoreControlError('Brain Core control request is too large.', 'request_body_too_large');
  }
  const requestId = input.requestId;
  if (requestId !== undefined && (requestId.length === 0 || requestId.length > MAX_REQUEST_ID_LENGTH)) {
    throw new BrainCoreControlError('Brain Core control request is invalid.', 'request_id_invalid');
  }
  const bodyResult = (isLifecycle ? lifecycleBodySchema : reviewBodySchema).safeParse(input.body);
  if (!bodyResult.success) {
    throw new BrainCoreControlError('Brain Core control request is invalid.', 'control_body_invalid');
  }
}

function parseResponse(status: number, payload: unknown): AgentModeControlResponse {
  const result = agentModeControlResultResponseSchema.safeParse(payload);
  if (result.success) return result.data;
  const error = agentModeControlErrorResponseSchema.safeParse(payload);
  if (error.success) throw new BrainCoreControlError('Brain Core control request was rejected.', error.data.error.code, status);
  throw new BrainCoreControlError('Brain Core returned an unexpected control response.', 'control_response_invalid', status);
}

export async function brainCoreControlRequest(input: BrainCoreControlRequest): Promise<AgentModeControlResponse> {
  const bodyText = JSON.stringify(input.body);
  validateRequest(input, bodyText);
  const { serviceId, secret } = serviceIdentity();
  const nowMs = epochMs(input.now);
  if (!Number.isFinite(nowMs)) throw new BrainCoreControlError('Brain Core control request is invalid.', 'timestamp_invalid');
  const timestamp = new Date(nowMs).toISOString();
  const requestId = input.requestId ?? `brain-console:${randomUUID()}`;
  const contentSha256 = createHash('sha256').update(bodyText).digest('hex');
  const signature = createHmac('sha256', secret).update(canonicalMaterial({ serviceId, method: 'POST', pathname: input.pathname, requestId, timestamp, contentSha256 })).digest('hex');
  const baseUrl = (process.env.BRAIN_CORE_URL ?? process.env.NEXT_PUBLIC_BRAIN_CORE_URL ?? 'http://localhost:4877').replace(/\/$/u, '');
  const fetcher = input.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(`${baseUrl}${input.pathname}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION,
        'x-brain-service-id': serviceId,
        'x-brain-request-id': requestId,
        'x-brain-request-timestamp': timestamp,
        'x-brain-content-sha256': contentSha256,
        'x-brain-signature': signature,
      },
      body: bodyText,
    });
    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      throw new BrainCoreControlError('Brain Core returned an unexpected control response.', 'control_response_invalid', response.status);
    }
    return parseResponse(response.status, payload);
  } catch (error) {
    if (error instanceof BrainCoreControlError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new BrainCoreControlError('Brain Core control is unavailable.', 'control_request_timeout');
    throw new BrainCoreControlError('Brain Core control is unavailable.', 'control_request_failed');
  } finally {
    clearTimeout(timeout);
  }
}
