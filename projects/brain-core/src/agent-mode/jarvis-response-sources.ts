import { createHash } from 'node:crypto';

export const JARVIS_TASK_INPUT_SCHEMA_VERSION = 'agent-mode.jarvis-task-input.v1' as const;
export const JARVIS_READABLE_RESULT_SCHEMA_VERSION = 'agent-mode.jarvis-readable-result.v1' as const;
export const JARVIS_TASK_INPUT_RETENTION_CLASS = 'root-lifecycle' as const;
export const JARVIS_READABLE_RESULT_OWNER = 'brain' as const;
export const JARVIS_READABLE_RESULT_TYPE = 'organization-summary' as const;
export const MAX_JARVIS_TASK_INPUT_LENGTH = 4_000;
export const MAX_JARVIS_READABLE_FACTS = 16;
export const MAX_JARVIS_READABLE_FACT_TEXT_LENGTH = 512;
export const MAX_JARVIS_READABLE_RESULT_LENGTH = 8_000;
export const MAX_JARVIS_READABLE_EVIDENCE_REFS = 64;

export type JarvisTaskInputV1 = {
  schemaVersion: typeof JARVIS_TASK_INPUT_SCHEMA_VERSION;
  rootGoalId: string;
  taskId: string;
  jarvisAgentId: 'agent:jarvis';
  source: 'typed' | 'voice';
  text: string;
  contentHash: string;
  retentionClass: typeof JARVIS_TASK_INPUT_RETENTION_CLASS;
  createdAt: string;
};

export type JarvisReadableResultFactV1 = {
  factId: string;
  workItemKey: string;
  text: string;
  evidenceRefs: readonly string[];
};

export type JarvisReadableResultV1 = {
  schemaVersion: typeof JARVIS_READABLE_RESULT_SCHEMA_VERSION;
  resultRef: string;
  rootGoalId: string;
  taskId: string;
  owner: typeof JARVIS_READABLE_RESULT_OWNER;
  resultType: typeof JARVIS_READABLE_RESULT_TYPE;
  facts: readonly JarvisReadableResultFactV1[];
  contentHash: string;
  createdAt: string;
};

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

function validRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/u.test(value);
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function exactKeys(value: object, allowed: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function safeText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value);
}

export function canonicalJarvisTaskInputText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

export function deriveJarvisTaskInputContentHash(text: string): string {
  return digest(canonicalJarvisTaskInputText(text));
}

export function jarvisReadableFactsMaterial(facts: readonly JarvisReadableResultFactV1[]): unknown {
  return [...facts].sort((a, b) => a.factId.localeCompare(b.factId)).map((fact) => ({
    factId: fact.factId,
    workItemKey: fact.workItemKey,
    text: fact.text,
    evidenceRefs: [...fact.evidenceRefs].sort(),
  }));
}

export function deriveJarvisReadableResultContentHash(input: Pick<JarvisReadableResultV1, 'schemaVersion' | 'resultRef' | 'rootGoalId' | 'taskId' | 'owner' | 'resultType' | 'facts'>): string {
  return digest({ schemaVersion: input.schemaVersion, resultRef: input.resultRef, rootGoalId: input.rootGoalId, taskId: input.taskId, owner: input.owner, resultType: input.resultType, facts: jarvisReadableFactsMaterial(input.facts) });
}

export function validateJarvisTaskInput(input: JarvisTaskInputV1): string | null {
  if (!exactKeys(input, ['schemaVersion', 'rootGoalId', 'taskId', 'jarvisAgentId', 'source', 'text', 'contentHash', 'retentionClass', 'createdAt'])
    || input.schemaVersion !== JARVIS_TASK_INPUT_SCHEMA_VERSION || !validId(input.rootGoalId) || !validId(input.taskId)
    || input.jarvisAgentId !== 'agent:jarvis' || !['typed', 'voice'].includes(input.source)
    || !safeText(input.text, MAX_JARVIS_TASK_INPUT_LENGTH) || canonicalJarvisTaskInputText(input.text).length > MAX_JARVIS_TASK_INPUT_LENGTH
    || input.contentHash !== deriveJarvisTaskInputContentHash(input.text) || input.retentionClass !== JARVIS_TASK_INPUT_RETENTION_CLASS
    || !validTimestamp(input.createdAt)) return 'JARVIS_TASK_INPUT_INVALID';
  return null;
}

export function validateJarvisReadableResult(input: JarvisReadableResultV1): string | null {
  if (!input || typeof input !== 'object') return 'JARVIS_READABLE_RESULT_INVALID';
  const candidate = input as unknown as Record<string, unknown>;
  const facts = Array.isArray(candidate.facts) ? candidate.facts as JarvisReadableResultFactV1[] : [];
  const evidenceRefs = facts.flatMap((fact) => Array.isArray(fact?.evidenceRefs) ? fact.evidenceRefs : []);
  if (!exactKeys(input, ['schemaVersion', 'resultRef', 'rootGoalId', 'taskId', 'owner', 'resultType', 'facts', 'contentHash', 'createdAt'])
    || input.schemaVersion !== JARVIS_READABLE_RESULT_SCHEMA_VERSION || !/^organization-final-result:sha256:[a-f0-9]{64}$/u.test(input.resultRef)
    || !validId(input.rootGoalId) || !validId(input.taskId) || input.owner !== JARVIS_READABLE_RESULT_OWNER
    || input.resultType !== JARVIS_READABLE_RESULT_TYPE || facts.length === 0 || facts.length > MAX_JARVIS_READABLE_FACTS
    || new Set(facts.map((fact) => fact?.factId)).size !== facts.length || new Set(facts.map((fact) => fact?.workItemKey)).size !== facts.length
    || facts.some((fact: JarvisReadableResultFactV1) => !fact || typeof fact !== 'object' || !exactKeys(fact, ['factId', 'workItemKey', 'text', 'evidenceRefs']) || !validId(fact.factId) || !validId(fact.workItemKey)
      || !safeText(fact.text, MAX_JARVIS_READABLE_FACT_TEXT_LENGTH) || !Array.isArray(fact.evidenceRefs) || fact.evidenceRefs.length === 0
      || fact.evidenceRefs.length > 4 || new Set(fact.evidenceRefs).size !== fact.evidenceRefs.length || fact.evidenceRefs.some((ref: string) => !validRef(ref)))
    || evidenceRefs.length > MAX_JARVIS_READABLE_EVIDENCE_REFS || JSON.stringify(input).length > MAX_JARVIS_READABLE_RESULT_LENGTH
    || input.contentHash !== deriveJarvisReadableResultContentHash(input) || !validTimestamp(input.createdAt)) return 'JARVIS_READABLE_RESULT_INVALID';
  return null;
}
