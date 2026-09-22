import { createHash } from 'node:crypto';
import type { AgentModeJarvisUserResponseRecord, AgentModeSqliteStateStore } from './sqlite-state-store.js';

export const JARVIS_USER_RESPONSE_SCHEMA_VERSION = 'agent-mode.jarvis-user-response.v1' as const;
export const JARVIS_USER_RESPONSE_SPEAKER_ROLE = 'jarvis' as const;
export const MAX_JARVIS_USER_RESPONSE_LENGTH = 2_000;
export const MAX_JARVIS_RESPONSE_REF_LENGTH = 256;

export type JarvisUserResponsePublicationV1 = {
  schemaVersion: typeof JARVIS_USER_RESPONSE_SCHEMA_VERSION;
  rootGoalId: string;
  taskId: string;
  jarvisAgentId: 'agent:jarvis';
  speakerRole: typeof JARVIS_USER_RESPONSE_SPEAKER_ROLE;
  sourceResultRef: string;
  text: string;
  createdAt: string;
};

export type JarvisUserResponseV1 = {
  schemaVersion: typeof JARVIS_USER_RESPONSE_SCHEMA_VERSION;
  responseId: string;
  rootGoalId: string;
  taskId: string;
  jarvisAgentId: 'agent:jarvis';
  speakerRole: typeof JARVIS_USER_RESPONSE_SPEAKER_ROLE;
  sourceResultRef: string;
  status: 'published';
  text: string;
  textHash: string;
  createdAt: string;
};

export type JarvisUserResponseResult =
  | { outcome: 'accepted' | 'duplicate'; response: JarvisUserResponseV1 }
  | { outcome: 'denied'; reasonCode: JarvisUserResponseReasonCode };

export type JarvisUserResponseReasonCode =
  | 'JARVIS_RESPONSE_INVALID'
  | 'JARVIS_RESPONSE_OWNER_INVALID'
  | 'JARVIS_RESPONSE_SOURCE_INVALID'
  | 'JARVIS_RESPONSE_SOURCE_UNAVAILABLE'
  | 'JARVIS_RESPONSE_CONFLICT'
  | 'JARVIS_RESPONSE_UNAVAILABLE';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function validId(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function exactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === allowed.length && keys.every((key, index) => key === [...allowed].sort()[index]);
}

export function canonicalJarvisUserResponseText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

export function deriveJarvisUserResponseTextHash(text: string): string {
  return digest(canonicalJarvisUserResponseText(text));
}

export function deriveJarvisUserResponseId(input: Pick<JarvisUserResponsePublicationV1, 'rootGoalId' | 'taskId' | 'sourceResultRef'>): string {
  return `jarvis-user-response:sha256:${digest({ schemaVersion: JARVIS_USER_RESPONSE_SCHEMA_VERSION, responseVersion: 1, rootGoalId: input.rootGoalId, taskId: input.taskId, sourceResultRef: input.sourceResultRef })}`;
}

export function jarvisUserResponseMaterialHash(response: Pick<JarvisUserResponseV1, 'schemaVersion' | 'responseId' | 'rootGoalId' | 'taskId' | 'jarvisAgentId' | 'speakerRole' | 'sourceResultRef' | 'status' | 'textHash'>): string {
  return digest({ schemaVersion: response.schemaVersion, responseId: response.responseId, rootGoalId: response.rootGoalId, taskId: response.taskId, jarvisAgentId: response.jarvisAgentId, speakerRole: response.speakerRole, sourceResultRef: response.sourceResultRef, status: response.status, textHash: response.textHash });
}

export function validateJarvisUserResponsePublication(input: JarvisUserResponsePublicationV1): JarvisUserResponseReasonCode | null {
  if (!exactKeys(input, ['schemaVersion', 'rootGoalId', 'taskId', 'jarvisAgentId', 'speakerRole', 'sourceResultRef', 'text', 'createdAt'])
    || input.schemaVersion !== JARVIS_USER_RESPONSE_SCHEMA_VERSION
    || !validId(input.rootGoalId) || !validId(input.taskId)
    || input.jarvisAgentId !== 'agent:jarvis' || input.speakerRole !== JARVIS_USER_RESPONSE_SPEAKER_ROLE
    || typeof input.sourceResultRef !== 'string' || input.sourceResultRef.length === 0 || input.sourceResultRef.length > MAX_JARVIS_RESPONSE_REF_LENGTH
    || !/^organization-final-result:sha256:[a-f0-9]{64}$/u.test(input.sourceResultRef)
    || typeof input.text !== 'string' || canonicalJarvisUserResponseText(input.text).length === 0
    || canonicalJarvisUserResponseText(input.text).length > MAX_JARVIS_USER_RESPONSE_LENGTH
    || /[\u0000-\u001f\u007f]/u.test(input.text) || !validTimestamp(input.createdAt)) {
    return input.jarvisAgentId !== 'agent:jarvis' || input.speakerRole !== JARVIS_USER_RESPONSE_SPEAKER_ROLE ? 'JARVIS_RESPONSE_OWNER_INVALID'
      : input.sourceResultRef && !/^organization-final-result:sha256:[a-f0-9]{64}$/u.test(input.sourceResultRef) ? 'JARVIS_RESPONSE_SOURCE_INVALID'
        : 'JARVIS_RESPONSE_INVALID';
  }
  return null;
}

/**
 * The response boundary accepts text only from a future Jarvis response
 * producer. It does not generate text from worker output or call a model.
 */
export class JarvisUserResponseService {
  constructor(private readonly store: AgentModeSqliteStateStore) {}

  publish(input: JarvisUserResponsePublicationV1): JarvisUserResponseResult {
    const invalid = validateJarvisUserResponsePublication(input);
    if (invalid) return { outcome: 'denied', reasonCode: invalid };
    const response: JarvisUserResponseV1 = {
      schemaVersion: JARVIS_USER_RESPONSE_SCHEMA_VERSION,
      responseId: deriveJarvisUserResponseId(input),
      rootGoalId: input.rootGoalId,
      taskId: input.taskId,
      jarvisAgentId: input.jarvisAgentId,
      speakerRole: input.speakerRole,
      sourceResultRef: input.sourceResultRef,
      status: 'published',
      text: canonicalJarvisUserResponseText(input.text),
      textHash: deriveJarvisUserResponseTextHash(input.text),
      createdAt: input.createdAt,
    };
    try {
      const persisted = this.store.recordJarvisUserResponse({
        ...response,
        materialHash: jarvisUserResponseMaterialHash(response),
      });
      if (persisted.result !== 'created' && persisted.result !== 'duplicate') return { outcome: 'denied', reasonCode: 'JARVIS_RESPONSE_CONFLICT' };
      return { outcome: persisted.result === 'created' ? 'accepted' : 'duplicate', response: persisted.response };
    } catch (error) {
      if (error instanceof Error && error.message === 'Jarvis response source is unavailable') return { outcome: 'denied', reasonCode: 'JARVIS_RESPONSE_SOURCE_UNAVAILABLE' };
      if (error instanceof Error && error.message === 'Jarvis response owner is invalid') return { outcome: 'denied', reasonCode: 'JARVIS_RESPONSE_OWNER_INVALID' };
      return { outcome: 'denied', reasonCode: 'JARVIS_RESPONSE_UNAVAILABLE' };
    }
  }
}

export function responseRecordFromPublication(input: JarvisUserResponsePublicationV1): JarvisUserResponseV1 {
  const invalid = validateJarvisUserResponsePublication(input);
  if (invalid) throw new Error(invalid);
  return {
    schemaVersion: JARVIS_USER_RESPONSE_SCHEMA_VERSION,
    responseId: deriveJarvisUserResponseId(input),
    rootGoalId: input.rootGoalId,
    taskId: input.taskId,
    jarvisAgentId: input.jarvisAgentId,
    speakerRole: input.speakerRole,
    sourceResultRef: input.sourceResultRef,
    status: 'published',
    text: canonicalJarvisUserResponseText(input.text),
    textHash: deriveJarvisUserResponseTextHash(input.text),
    createdAt: input.createdAt,
  };
}

export type { AgentModeJarvisUserResponseRecord };
