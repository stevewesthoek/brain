import type {
  BrainCoreAgentContextPackRef,
  BrainCoreAgentEvidencePacketRef,
  BrainCoreTaskReferenceFreshness,
  BrainCoreTaskReferenceStatus,
} from '../types/agent-task-references.js';

type RecordValue = Record<string, unknown>;

const statuses = new Set<BrainCoreTaskReferenceStatus>([
  'persisted',
  'available_by_ref',
  'not_persisted',
  'unavailable',
  'stale',
  'missing',
]);
const freshnessValues = new Set<BrainCoreTaskReferenceFreshness>([
  'fresh',
  'stale',
  'mixed',
  'unknown',
  'unavailable',
]);

function asRecord(value: unknown): RecordValue | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function status(value: unknown): BrainCoreTaskReferenceStatus {
  return typeof value === 'string' && statuses.has(value as BrainCoreTaskReferenceStatus)
    ? value as BrainCoreTaskReferenceStatus
    : 'available_by_ref';
}

function freshness(value: unknown): BrainCoreTaskReferenceFreshness {
  return typeof value === 'string' && freshnessValues.has(value as BrainCoreTaskReferenceFreshness)
    ? value as BrainCoreTaskReferenceFreshness
    : 'unknown';
}

function packetId(candidate: RecordValue): string | null {
  return asText(candidate.packetId)
    ?? asText(candidate.refId)
    ?? asText(candidate.packId)
    ?? asText(candidate.contextPackId)
    ?? asText(candidate.evidencePacketId);
}

export function normalizeContextPackRef(value: unknown): BrainCoreAgentContextPackRef | null {
  const candidate = asRecord(value);
  const id = candidate ? packetId(candidate) : null;
  if (!candidate || !id) return null;
  const selectedItemCount = typeof candidate.selectedItemCount === 'number' && Number.isInteger(candidate.selectedItemCount)
    ? candidate.selectedItemCount
    : undefined;
  return {
    packetId: id,
    type: 'context-pack',
    revision: asText(candidate.revision ?? candidate.sourceRevision),
    source: asText(candidate.source ?? candidate.sourcePath),
    freshness: freshness(candidate.freshness),
    status: status(candidate.status),
    authority: asText(candidate.authority ?? candidate.authorityOwner),
    locator: asText(candidate.locator ?? candidate.storageRef ?? candidate.ref),
    createdAt: asText(candidate.createdAt),
    updatedAt: asText(candidate.updatedAt),
    ...(selectedItemCount === undefined ? {} : { selectedItemCount }),
  };
}

export function normalizeEvidencePacketRef(value: unknown): BrainCoreAgentEvidencePacketRef | null {
  const candidate = asRecord(value);
  const id = candidate ? packetId(candidate) : null;
  if (!candidate || !id) return null;
  const evidenceIds = asStringArray(candidate.evidenceIds)
    ?? (asText(candidate.evidenceId) ? [asText(candidate.evidenceId)!] : undefined);
  return {
    packetId: id,
    type: 'evidence-packet',
    revision: asText(candidate.revision ?? candidate.sourceRevision),
    source: asText(candidate.source ?? candidate.sourcePath),
    freshness: freshness(candidate.freshness),
    status: status(candidate.status),
    authority: asText(candidate.authority ?? candidate.authorityOwner),
    locator: asText(candidate.locator ?? candidate.storageRef ?? candidate.ref),
    createdAt: asText(candidate.createdAt),
    updatedAt: asText(candidate.updatedAt),
    ...(evidenceIds ? { evidenceIds } : {}),
    relation: asText(candidate.relation ?? candidate.edgeType),
  };
}

export function normalizeContextPackRefs(value: unknown): BrainCoreAgentContextPackRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(normalizeContextPackRef).filter((ref): ref is BrainCoreAgentContextPackRef => ref !== null);
}

export function normalizeEvidencePacketRefs(value: unknown): BrainCoreAgentEvidencePacketRef[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.map(normalizeEvidencePacketRef).filter((ref): ref is BrainCoreAgentEvidencePacketRef => ref !== null);
}

export function normalizeTaskReferenceFields(value: RecordValue): RecordValue {
  const normalized: RecordValue = { ...value };
  const contextPackRefs = normalizeContextPackRefs(value.contextPackRefs);
  const evidencePacketRefs = normalizeEvidencePacketRefs(value.evidencePacketRefs);
  if (contextPackRefs !== undefined) normalized.contextPackRefs = contextPackRefs;
  if (evidencePacketRefs !== undefined) normalized.evidencePacketRefs = evidencePacketRefs;
  return normalized;
}
