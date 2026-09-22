import { createHash } from 'node:crypto';
import type { AgentModeSqliteStateStore } from './sqlite-state-store.js';
import {
  canonicalJarvisTaskInputText,
  type JarvisReadableResultV1,
  type JarvisTaskInputV1,
  validateJarvisReadableResult,
  validateJarvisTaskInput,
} from './jarvis-response-sources.js';
import { JarvisUserResponseService, type JarvisUserResponseV1 } from './jarvis-user-response.js';

export const JARVIS_RESPONSE_FINALIZATION_SCHEMA_VERSION = 'agent-mode.jarvis-response-finalization.v1' as const;
export const MAX_JARVIS_RESPONSE_GENERATION_CONTEXT_LENGTH = 12_000;

export type JarvisResponseFinalizationRequestV1 = {
  schemaVersion: typeof JARVIS_RESPONSE_FINALIZATION_SCHEMA_VERSION;
  rootGoalId: string;
  taskId: string;
  sourceResultRef: string;
  operationId: string;
  requestedAt: string;
};

export type JarvisResponseFinalizationOutcome =
  | 'PUBLISHED'
  | 'ALREADY_PUBLISHED'
  | 'NOT_READY'
  | 'SOURCE_UNAVAILABLE'
  | 'INPUT_UNAVAILABLE'
  | 'GENERATION_FAILED'
  | 'CANCELLED'
  | 'EXPIRED';

export type JarvisResponseFinalizationReasonCode =
  | 'PUBLISHED'
  | 'ALREADY_PUBLISHED'
  | 'REQUEST_INVALID'
  | 'ROOT_NOT_FOUND'
  | 'ROOT_MISMATCH'
  | 'ROOT_NOT_COMPLETED'
  | 'INPUT_UNAVAILABLE'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_NOT_SUCCESSFUL'
  | 'SOURCE_CONTENT_INVALID'
  | 'GENERATION_CONTEXT_EXCEEDED'
  | 'GENERATION_FAILED'
  | 'RESPONSE_CONFLICT'
  | 'ROOT_CANCELLED'
  | 'PLAN_EXPIRED';

export type JarvisResponseFinalizationResult = {
  outcome: JarvisResponseFinalizationOutcome;
  reasonCode: JarvisResponseFinalizationReasonCode;
  rootGoalId: string;
  operationId: string;
  response: JarvisUserResponseV1 | null;
};

export type JarvisReadableResultPublicationResult =
  | { outcome: 'published' | 'duplicate'; result: JarvisReadableResultV1 }
  | { outcome: 'denied' | 'conflict'; reasonCode: string };

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

function exactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

export function deriveJarvisResponseFinalizationOperationId(input: Pick<JarvisResponseFinalizationRequestV1, 'rootGoalId' | 'taskId' | 'sourceResultRef'>): string {
  return `jarvis-response-finalization:sha256:${digest({ schemaVersion: JARVIS_RESPONSE_FINALIZATION_SCHEMA_VERSION, rootGoalId: input.rootGoalId, taskId: input.taskId, sourceResultRef: input.sourceResultRef })}`;
}

export function validateJarvisResponseFinalizationRequest(input: JarvisResponseFinalizationRequestV1): JarvisResponseFinalizationReasonCode | null {
  if (!input || typeof input !== 'object' || !exactKeys(input, ['schemaVersion', 'rootGoalId', 'taskId', 'sourceResultRef', 'operationId', 'requestedAt'])
    || input.schemaVersion !== JARVIS_RESPONSE_FINALIZATION_SCHEMA_VERSION
    || !validId(input.rootGoalId) || !validId(input.taskId)
    || !/^organization-final-result:sha256:[a-f0-9]{64}$/u.test(input.sourceResultRef)
    || input.operationId !== deriveJarvisResponseFinalizationOperationId(input)
    || !Number.isFinite(Date.parse(input.requestedAt))) return 'REQUEST_INVALID';
  return null;
}

function safeGenerationText(input: string): string | null {
  const text = canonicalJarvisTaskInputText(input);
  if (!text || text.length > 4_000 || /[\u0000-\u001f\u007f]/u.test(text)) return null;
  return text;
}

function generateDeterministicJarvisText(input: JarvisTaskInputV1, result: JarvisReadableResultV1): string {
  const request = safeGenerationText(input.text);
  if (!request) throw new Error('invalid generation input');
  const facts = [...result.facts].sort((a, b) => a.factId.localeCompare(b.factId));
  const factText = facts.map((fact) => fact.text.trim()).join(' ');
  const summaryTarget = /\bsummar(?:y|ize|ise)\b(?:\s+the)?\s+(.+?)(?:[?.!]|$)/iu.exec(request)?.[1]?.trim();
  const lead = summaryTarget ? `Here is the completed summary of ${summaryTarget.replace(/[.?!]+$/u, '')}:` : 'The requested work is complete:';
  const text = `${lead} ${factText}`.trim().replace(/\s+/gu, ' ');
  if (!text || text.length > 2_000 || /[\u0000-\u001f\u007f]/u.test(text) || /(?:organization-final-result|k4:evidence|sha256:)/iu.test(text)) throw new Error('generated Jarvis text is not user-facing');
  return text;
}

/** Publishes the bounded business facts that a future Jarvis response may read. */
export class JarvisReadableResultService {
  constructor(private readonly store: AgentModeSqliteStateStore) {}

  publish(result: JarvisReadableResultV1): JarvisReadableResultPublicationResult {
    const invalid = validateJarvisReadableResult(result);
    if (invalid) return { outcome: 'denied', reasonCode: invalid };
    const persisted = this.store.recordJarvisReadableResult(result);
    if (persisted.result === 'created') return { outcome: 'published', result: persisted.resultRecord };
    if (persisted.result === 'duplicate') return { outcome: 'duplicate', result: persisted.resultRecord };
    if ('reasonCode' in persisted) return { outcome: persisted.result, reasonCode: persisted.reasonCode };
    return { outcome: 'denied', reasonCode: 'JARVIS_READABLE_RESULT_UNAVAILABLE' };
  }
}

/**
 * Brain-owned deterministic response producer. It consumes only durable,
 * Jarvis-readable input/result seams and publishes through the response
 * service; it never accepts caller-provided answer text or model authority.
 */
export class JarvisResponseFinalizer {
  private readonly responseService: JarvisUserResponseService;

  constructor(private readonly store: AgentModeSqliteStateStore) {
    this.responseService = new JarvisUserResponseService(store);
  }

  finalize(request: JarvisResponseFinalizationRequestV1): JarvisResponseFinalizationResult {
    const invalid = validateJarvisResponseFinalizationRequest(request);
    if (invalid) return { outcome: 'NOT_READY', reasonCode: invalid, rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    const existing = this.store.getJarvisUserResponseForRoot(request.rootGoalId);
    if (existing) {
      return existing.sourceResultRef === request.sourceResultRef
        ? { outcome: 'ALREADY_PUBLISHED', reasonCode: 'ALREADY_PUBLISHED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: existing }
        : { outcome: 'NOT_READY', reasonCode: 'RESPONSE_CONFLICT', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    }
    const plan = this.store.listOrganizationPlans().find((candidate) => candidate.rootGoalId === request.rootGoalId);
    if (!plan) return { outcome: 'NOT_READY', reasonCode: 'ROOT_NOT_FOUND', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    if (plan.status === 'cancelled') return { outcome: 'CANCELLED', reasonCode: 'ROOT_CANCELLED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    if (plan.status === 'expired' || Date.parse(request.requestedAt) >= Date.parse(plan.deadline)) return { outcome: 'EXPIRED', reasonCode: 'PLAN_EXPIRED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    const finalResult = this.store.getOrganizationFinalResult(plan.organizationPlanId);
    if (!finalResult || finalResult.organizationFinalResultId !== request.sourceResultRef) return { outcome: 'SOURCE_UNAVAILABLE', reasonCode: 'SOURCE_UNAVAILABLE', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    if (finalResult.rootGoalId !== request.rootGoalId || finalResult.supervisorAgentId !== 'agent:jarvis' || request.taskId !== request.rootGoalId) return { outcome: 'NOT_READY', reasonCode: 'ROOT_MISMATCH', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    if (finalResult.status !== 'succeeded' || plan.status !== 'completed') return { outcome: 'NOT_READY', reasonCode: 'ROOT_NOT_COMPLETED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    const taskInput = this.store.getJarvisTaskInput(request.taskId);
    if (!taskInput) return { outcome: 'INPUT_UNAVAILABLE', reasonCode: 'INPUT_UNAVAILABLE', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    const inputInvalid = validateJarvisTaskInput(taskInput);
    if (inputInvalid || taskInput.rootGoalId !== request.rootGoalId || taskInput.taskId !== request.taskId || taskInput.jarvisAgentId !== 'agent:jarvis') return { outcome: 'INPUT_UNAVAILABLE', reasonCode: 'INPUT_UNAVAILABLE', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    const readableResult = this.store.getJarvisReadableResult(request.sourceResultRef);
    if (!readableResult) return { outcome: 'SOURCE_UNAVAILABLE', reasonCode: 'SOURCE_UNAVAILABLE', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    if (validateJarvisReadableResult(readableResult) || readableResult.rootGoalId !== request.rootGoalId || readableResult.taskId !== request.taskId) return { outcome: 'SOURCE_UNAVAILABLE', reasonCode: 'SOURCE_CONTENT_INVALID', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    const generationContext = canonical({ request: safeGenerationText(taskInput.text), facts: readableResult.facts.map((fact) => ({ factId: fact.factId, workItemKey: fact.workItemKey, text: fact.text })) });
    if (generationContext.length > MAX_JARVIS_RESPONSE_GENERATION_CONTEXT_LENGTH) return { outcome: 'GENERATION_FAILED', reasonCode: 'GENERATION_CONTEXT_EXCEEDED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
    let text: string;
    try { text = generateDeterministicJarvisText(taskInput, readableResult); } catch { return { outcome: 'GENERATION_FAILED', reasonCode: 'GENERATION_FAILED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null }; }
    const published = this.responseService.publish({ schemaVersion: 'agent-mode.jarvis-user-response.v1', rootGoalId: request.rootGoalId, taskId: request.taskId, jarvisAgentId: 'agent:jarvis', speakerRole: 'jarvis', sourceResultRef: request.sourceResultRef, text, createdAt: request.requestedAt });
    if (published.outcome === 'accepted') return { outcome: 'PUBLISHED', reasonCode: 'PUBLISHED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: published.response };
    if (published.outcome === 'duplicate') return { outcome: 'ALREADY_PUBLISHED', reasonCode: 'ALREADY_PUBLISHED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: published.response };
    const publicationReason = 'reasonCode' in published ? published.reasonCode : 'JARVIS_RESPONSE_UNAVAILABLE';
    return { outcome: 'NOT_READY', reasonCode: publicationReason === 'JARVIS_RESPONSE_SOURCE_UNAVAILABLE' ? 'SOURCE_UNAVAILABLE' : publicationReason === 'JARVIS_RESPONSE_CONFLICT' ? 'RESPONSE_CONFLICT' : 'GENERATION_FAILED', rootGoalId: request.rootGoalId, operationId: request.operationId, response: null };
  }
}
