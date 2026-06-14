import {
  assertValidMaintenanceFindingDecisionDocument,
  type MaintenanceFindingDecision,
  type MaintenanceFindingDecisionDocument,
} from './finding-decision-store.js';

export interface RecordMaintenanceFindingDecisionInput {
  document: MaintenanceFindingDecisionDocument;
  decision: MaintenanceFindingDecision;
  updatedAt: string;
}

export interface RecordMaintenanceFindingDecisionResult {
  document: MaintenanceFindingDecisionDocument;
  operation: 'created' | 'replaced';
  replacedFindingId: string | null;
}

function canonicalTimestamp(value: string, field: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`${field} must be an ISO timestamp.`);
  }

  const canonical = new Date(timestamp).toISOString();
  if (canonical !== value) {
    throw new Error(`${field} must be a canonical ISO timestamp.`);
  }

  return canonical;
}

function compareDecisionOrder(
  left: MaintenanceFindingDecision,
  right: MaintenanceFindingDecision,
): number {
  return left.deduplicationKey.localeCompare(right.deduplicationKey)
    || left.reviewedAt.localeCompare(right.reviewedAt)
    || left.findingId.localeCompare(right.findingId);
}

export function recordMaintenanceFindingDecision(
  input: RecordMaintenanceFindingDecisionInput,
): RecordMaintenanceFindingDecisionResult {
  assertValidMaintenanceFindingDecisionDocument(input.document);
  canonicalTimestamp(input.updatedAt, 'updatedAt');

  const singleDecisionDocument: MaintenanceFindingDecisionDocument = {
    schemaVersion: input.document.schemaVersion,
    sourceRepo: 'mind',
    updatedAt: input.updatedAt,
    decisions: [input.decision],
  };
  assertValidMaintenanceFindingDecisionDocument(singleDecisionDocument);

  if (input.decision.reviewedAt > input.updatedAt) {
    throw new Error('Decision reviewedAt cannot be later than document updatedAt.');
  }

  const existingIndex = input.document.decisions.findIndex(
    (decision) => decision.deduplicationKey === input.decision.deduplicationKey,
  );

  const decisions = input.document.decisions.map((decision) => ({ ...decision }));
  let operation: RecordMaintenanceFindingDecisionResult['operation'] = 'created';
  let replacedFindingId: string | null = null;

  if (existingIndex >= 0) {
    const existing = decisions[existingIndex]!;
    if (input.decision.reviewedAt < existing.reviewedAt) {
      throw new Error('Cannot replace a finding decision with an older review timestamp.');
    }

    operation = 'replaced';
    replacedFindingId = existing.findingId;
    decisions[existingIndex] = { ...input.decision };
  } else {
    const conflictingFinding = decisions.find(
      (decision) => decision.findingId === input.decision.findingId,
    );
    if (conflictingFinding) {
      throw new Error(
        `Finding ID already belongs to another deduplication key: ${input.decision.findingId}`,
      );
    }

    decisions.push({ ...input.decision });
  }

  decisions.sort(compareDecisionOrder);

  const document: MaintenanceFindingDecisionDocument = {
    schemaVersion: input.document.schemaVersion,
    sourceRepo: 'mind',
    updatedAt: input.updatedAt,
    decisions,
  };
  assertValidMaintenanceFindingDecisionDocument(document);

  return {
    document,
    operation,
    replacedFindingId,
  };
}
