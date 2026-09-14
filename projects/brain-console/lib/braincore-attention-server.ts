import 'server-only';

import { createHmac, randomUUID } from 'node:crypto';
import { agentModeAttentionProjectionSchema, agentModeNotificationReadResponseSchema, operatorSessionErrorResponseSchema, type AgentModeAttentionProjection } from './braincore-schemas';
import { brainServiceContentSha256, signBrainServiceRequest, BRAIN_SERVICE_AUTH_PROTOCOL_VERSION } from '../../brain-core/src/security/brain-service-auth';

const REQUEST_TIMEOUT_MS = 10_000;

export class BrainCoreAttentionError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super('Brain Core attention request was not applied.');
    this.name = 'BrainCoreAttentionError';
  }
}

function serviceIdentity(): { serviceId: string; secret: string } {
  const serviceId = process.env.BRAIN_CORE_SERVICE_ID;
  const secret = process.env.BRAIN_CORE_SERVICE_SECRET;
  if (!serviceId || !secret) throw new BrainCoreAttentionError('service_identity_unavailable', 503);
  return { serviceId, secret };
}

async function requestCore(pathname: string, method: 'GET' | 'POST', body: Record<string, string> | undefined, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const { serviceId, secret } = serviceIdentity();
  const bodyText = body ? JSON.stringify(body) : '';
  const requestId = `brain-console:attention:${randomUUID()}`;
  const timestamp = new Date().toISOString();
  const contentSha256 = brainServiceContentSha256(bodyText);
  const signature = signBrainServiceRequest({ serviceId, secret, method, pathname: pathname.split('?')[0] ?? pathname, requestId, timestamp, contentSha256 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const baseUrl = (process.env.BRAIN_CORE_URL ?? process.env.NEXT_PUBLIC_BRAIN_CORE_URL ?? 'http://localhost:4877').replace(/\/$/u, '');
    const response = await fetchImpl(`${baseUrl}${pathname}`, {
      method, signal: controller.signal,
      headers: { 'content-type': 'application/json', 'x-brain-auth-version': BRAIN_SERVICE_AUTH_PROTOCOL_VERSION, 'x-brain-service-id': serviceId, 'x-brain-request-id': requestId, 'x-brain-request-timestamp': timestamp, 'x-brain-content-sha256': contentSha256, 'x-brain-signature': signature },
      ...(body ? { body: bodyText } : {}),
    });
    const text = await response.text();
    let payload: unknown;
    try { payload = text ? JSON.parse(text) : null; } catch { throw new BrainCoreAttentionError('attention_response_invalid', response.status); }
    if (!response.ok) {
      const error = operatorSessionErrorResponseSchema.safeParse(payload);
      throw new BrainCoreAttentionError(error.success ? error.data.error.code : 'attention_request_rejected', response.status);
    }
    return payload;
  } catch (error) {
    if (error instanceof BrainCoreAttentionError) throw error;
    throw new BrainCoreAttentionError('attention_request_failed', 503);
  } finally { clearTimeout(timeout); }
}

export async function brainCoreAttentionRequest(operatorId: string, fetchImpl?: typeof fetch): Promise<AgentModeAttentionProjection> {
  if (!operatorId || operatorId.length > 128) throw new BrainCoreAttentionError('operator_identity_invalid', 400);
  const payload = await requestCore(`/agent-mode/notifications?operatorId=${encodeURIComponent(operatorId)}`, 'GET', undefined, fetchImpl);
  const parsed = agentModeAttentionProjectionSchema.safeParse(payload);
  if (!parsed.success) throw new BrainCoreAttentionError('attention_response_invalid', 502);
  return parsed.data;
}

export async function brainCoreMarkNotificationRead(notificationId: string, operatorId: string, fetchImpl?: typeof fetch) {
  if (!notificationId || notificationId.length > 256 || notificationId.includes('/')) throw new BrainCoreAttentionError('notification_id_invalid', 400);
  if (!operatorId || operatorId.length > 128) throw new BrainCoreAttentionError('operator_identity_invalid', 400);
  const payload = await requestCore(`/agent-mode/notifications/${encodeURIComponent(notificationId)}/read`, 'POST', { schemaVersion: 'agent-mode-notification-read-v1', operatorId }, fetchImpl);
  const parsed = agentModeNotificationReadResponseSchema.safeParse(payload);
  if (!parsed.success) throw new BrainCoreAttentionError('attention_response_invalid', 502);
  return parsed.data;
}
