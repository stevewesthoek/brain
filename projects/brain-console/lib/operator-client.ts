import { z } from 'zod';
import { agentModeNotificationReadResponseSchema, agentModeAttentionProjectionSchema, operatorSessionErrorResponseSchema, operatorSessionResponseSchema, agentModeControlResponseSchema, jarvisTextIntakeResponseSchema, jarvisTranscriptionResponseSchema } from './braincore-schemas';

export class OperatorClientError extends Error {
  constructor(readonly code: string, readonly status?: number) {
    super('Operator control request was not applied.');
    this.name = 'OperatorClientError';
  }
}
async function parseResponse(response: Response, schema: z.ZodTypeAny): Promise<unknown> {
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new OperatorClientError('operator_response_invalid', response.status);
  }
  const parsed = schema.safeParse(payload);
  if (parsed.success) return parsed.data;
  const error = operatorSessionErrorResponseSchema.safeParse(payload);
  if (error.success) throw new OperatorClientError(error.data.error.code, response.status);
  throw new OperatorClientError('operator_response_invalid', response.status);
}

export async function operatorRequest<TSchema extends z.ZodTypeAny>(path: string, schema: TSchema, init?: RequestInit): Promise<z.output<TSchema>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(init?.headers ?? {}) },
    });
  } catch {
    throw new OperatorClientError('operator_request_failed');
  }
  return parseResponse(response, schema) as Promise<z.output<TSchema>>;
}

export function readOperatorSession() {
  return operatorRequest('/api/operator/session', operatorSessionResponseSchema);
}

export function submitOperatorControl(path: string, body: unknown, csrfToken: string) {
  return operatorRequest(path, agentModeControlResponseSchema, {
    method: 'POST',
    headers: { 'x-brain-console-csrf': csrfToken },
    body: JSON.stringify(body),
  });
}

export function readOperatorAttention() {
  return operatorRequest('/api/agent-mode/notifications', agentModeAttentionProjectionSchema);
}

export function markOperatorNotificationRead(notificationId: string, csrfToken: string) {
  return operatorRequest(`/api/agent-mode/notifications/${encodeURIComponent(notificationId)}/read`, agentModeNotificationReadResponseSchema, {
    method: 'POST',
    headers: { 'x-brain-console-csrf': csrfToken },
  });
}

export function submitJarvisIntake(input: { requestId: string; source: 'typed' | 'voice'; text: string; csrfToken: string }) {
  return operatorRequest('/api/agent-mode/jarvis/intake', jarvisTextIntakeResponseSchema, {
    method: 'POST',
    headers: { 'x-brain-console-csrf': input.csrfToken },
    body: JSON.stringify({ requestId: input.requestId, source: input.source, text: input.text }),
  });
}

export function transcribeJarvisAudio(input: { requestId: string; audio: Blob; csrfToken: string }) {
  const body = new FormData();
  body.append('voiceRequestId', input.requestId);
  body.append('audio', input.audio, 'recording.wav');
  return operatorRequest('/api/agent-mode/jarvis/transcribe', jarvisTranscriptionResponseSchema, { method: 'POST', headers: { 'x-brain-console-csrf': input.csrfToken }, body });
}
