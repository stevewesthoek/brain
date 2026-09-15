import 'server-only';

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { jarvisTextIntakeResponseSchema } from './braincore-schemas';

const PROTOCOL_VERSION = 'brain-service-auth-v1' as const;
const INTAKE_SCHEMA_VERSION = 'agent-mode.jarvis-text-intake.v1' as const;
const MAX_TEXT_LENGTH = 4_000;
const REQUEST_TIMEOUT_MS = 10_000;

export type BrainCoreJarvisIntakeRequest = { requestId?: string; operatorId: string; source: 'typed' | 'voice'; text: string; voiceRequestId?: string; now?: string | number | Date; fetchImpl?: typeof fetch };

export class BrainCoreJarvisIntakeError extends Error {
  constructor(readonly code: string, readonly status?: number) { super('Jarvis intake is unavailable.'); this.name = 'BrainCoreJarvisIntakeError'; }
}

function timestamp(value: BrainCoreJarvisIntakeRequest['now']): string {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : Date.now();
  if (!Number.isFinite(ms)) throw new BrainCoreJarvisIntakeError('timestamp_invalid');
  return new Date(ms).toISOString();
}

function serviceIdentity(): { serviceId: string; secret: string } {
  const serviceId = process.env.BRAIN_CORE_SERVICE_ID;
  const secret = process.env.BRAIN_CORE_SERVICE_SECRET;
  if (!serviceId || !secret) throw new BrainCoreJarvisIntakeError('service_identity_unavailable');
  return { serviceId, secret };
}

function deriveIntakeId(input: BrainCoreJarvisIntakeRequest): string {
  const requestId = input.voiceRequestId ?? input.requestId;
  if (!requestId || requestId.length === 0 || requestId.length > 128) throw new BrainCoreJarvisIntakeError('request_id_invalid');
  return `intake:jarvis:sha256:${createHash('sha256').update(JSON.stringify({ domain: 'agent-mode.jarvis-intake-request.v1', requestId, source: input.source }), 'utf8').digest('hex')}`;
}

export async function brainCoreJarvisIntakeRequest(input: BrainCoreJarvisIntakeRequest) {
  if (!input.operatorId || input.operatorId.length > 128 || !['typed', 'voice'].includes(input.source) || typeof input.text !== 'string' || input.text.trim().length === 0 || input.text.trim().replace(/\s+/gu, ' ').length > MAX_TEXT_LENGTH) throw new BrainCoreJarvisIntakeError('intake_body_invalid');
  const { serviceId, secret } = serviceIdentity();
  const requestTimestamp = timestamp(input.now);
  const requestId = input.requestId ?? input.voiceRequestId ?? randomUUID();
  const body = { schemaVersion: INTAKE_SCHEMA_VERSION, intakeId: deriveIntakeId(input), source: input.source, operatorId: input.operatorId, text: input.text };
  const bodyText = JSON.stringify(body);
  const contentSha256 = createHash('sha256').update(bodyText, 'utf8').digest('hex');
  const canonical = JSON.stringify({ protocolVersion: PROTOCOL_VERSION, serviceId, method: 'POST', pathname: '/agent-mode/jarvis/intake', requestId, timestamp: requestTimestamp, contentSha256 });
  const signature = createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
  const baseUrl = (process.env.BRAIN_CORE_URL ?? process.env.NEXT_PUBLIC_BRAIN_CORE_URL ?? 'http://localhost:4877').replace(/\/$/u, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await (input.fetchImpl ?? fetch)(`${baseUrl}/agent-mode/jarvis/intake`, { method: 'POST', signal: controller.signal, headers: { 'content-type': 'application/json', 'x-brain-auth-version': PROTOCOL_VERSION, 'x-brain-service-id': serviceId, 'x-brain-request-id': requestId, 'x-brain-request-timestamp': requestTimestamp, 'x-brain-content-sha256': contentSha256, 'x-brain-signature': signature }, body: bodyText });
    let payload: unknown;
    try { payload = await response.json(); } catch { throw new BrainCoreJarvisIntakeError('intake_response_invalid', response.status); }
    const parsed = jarvisTextIntakeResponseSchema.safeParse(payload);
    if (!parsed.success) throw new BrainCoreJarvisIntakeError('intake_response_invalid', response.status);
    if (!parsed.data.ok) throw new BrainCoreJarvisIntakeError(parsed.data.result.reasonCode, response.status);
    return parsed.data;
  } catch (error) {
    if (error instanceof BrainCoreJarvisIntakeError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') throw new BrainCoreJarvisIntakeError('intake_request_timeout');
    throw new BrainCoreJarvisIntakeError('intake_request_failed');
  } finally { clearTimeout(timeout); }
}
