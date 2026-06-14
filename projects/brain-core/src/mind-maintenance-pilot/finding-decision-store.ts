import type { MaintenanceReviewRecord, MaintenanceValidationIssue } from './types.js';

export const MAINTENANCE_DECISION_SCHEMA_VERSION = '1.0' as const;
export const maintenanceDecisionValues = ['accepted', 'dismissed', 'resolved'] as const;
export type MaintenanceDecisionValue = (typeof maintenanceDecisionValues)[number];

export interface MaintenanceFindingDecision {
  findingId: string;
  deduplicationKey: string;
  sourceReportId: string;
  sourceCommit: string;
  reviewedBy: string;
  reviewedAt: string;
  decision: MaintenanceDecisionValue;
  reason: string;
  nextAction: string;
  resolutionRef: string | null;
  suppressionUntil: string | null;
}

export interface MaintenanceFindingDecisionDocument {
  schemaVersion: typeof MAINTENANCE_DECISION_SCHEMA_VERSION;
  sourceRepo: 'mind';
  updatedAt: string;
  decisions: MaintenanceFindingDecision[];
}

export type MaintenanceFindingDecisionValidationResult =
  | { ok: true; value: MaintenanceFindingDecisionDocument }
  | { ok: false; issues: MaintenanceValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp) && new Date(timestamp).toISOString() === value;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateDecision(
  value: unknown,
  path: string,
  issues: MaintenanceValidationIssue[],
): value is MaintenanceFindingDecision {
  if (!isRecord(value)) {
    issues.push({ path, message: 'Decision must be an object.' });
    return false;
  }

  const requiredStrings: Array<keyof MaintenanceFindingDecision> = [
    'findingId',
    'deduplicationKey',
    'sourceReportId',
    'sourceCommit',
    'reviewedBy',
    'reason',
  ];

  for (const field of requiredStrings) {
    if (!isNonEmptyString(value[field])) {
      issues.push({ path: `${path}.${field}`, message: `${field} must be a non-empty string.` });
    }
  }

  if (!isIsoTimestamp(value.reviewedAt)) {
    issues.push({ path: `${path}.reviewedAt`, message: 'reviewedAt must be a canonical ISO timestamp.' });
  }

  if (!maintenanceDecisionValues.includes(value.decision as MaintenanceDecisionValue)) {
    issues.push({ path: `${path}.decision`, message: 'decision must be accepted, dismissed, or resolved.' });
  }

  if (typeof value.nextAction !== 'string') {
    issues.push({ path: `${path}.nextAction`, message: 'nextAction must be a string.' });
  }

  if (value.resolutionRef !== null && !isNonEmptyString(value.resolutionRef)) {
    issues.push({ path: `${path}.resolutionRef`, message: 'resolutionRef must be null or a non-empty string.' });
  }

  if (value.suppressionUntil !== null && !isIsoDate(value.suppressionUntil)) {
    issues.push({ path: `${path}.suppressionUntil`, message: 'suppressionUntil must be null or an ISO date.' });
  }

  if (value.decision === 'accepted' && !isNonEmptyString(value.nextAction)) {
    issues.push({ path: `${path}.nextAction`, message: 'Accepted findings require a next action.' });
  }

  if (value.decision === 'dismissed' && value.resolutionRef !== null) {
    issues.push({ path: `${path}.resolutionRef`, message: 'Dismissed findings cannot have a resolution reference.' });
  }

  if (value.decision === 'resolved' && !isNonEmptyString(value.resolutionRef)) {
    issues.push({ path: `${path}.resolutionRef`, message: 'Resolved findings require a resolution reference.' });
  }

  return issues.every((issue) => !issue.path.startsWith(path));
}

export function validateMaintenanceFindingDecisionDocument(
  value: unknown,
): MaintenanceFindingDecisionValidationResult {
  const issues: MaintenanceValidationIssue[] = [];

  if (!isRecord(value)) {
    return { ok: false, issues: [{ path: '$', message: 'Decision document must be an object.' }] };
  }

  if (value.schemaVersion !== MAINTENANCE_DECISION_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', message: 'Unsupported decision schema version.' });
  }

  if (value.sourceRepo !== 'mind') {
    issues.push({ path: 'sourceRepo', message: 'sourceRepo must be mind.' });
  }

  if (!isIsoTimestamp(value.updatedAt)) {
    issues.push({ path: 'updatedAt', message: 'updatedAt must be a canonical ISO timestamp.' });
  }

  if (!Array.isArray(value.decisions)) {
    issues.push({ path: 'decisions', message: 'decisions must be an array.' });
  } else {
    const findingIds = new Set<string>();
    const deduplicationKeys = new Set<string>();

    value.decisions.forEach((decision, index) => {
      const decisionPath = `decisions[${index}]`;
      validateDecision(decision, decisionPath, issues);

      if (!isRecord(decision)) return;

      if (isNonEmptyString(decision.findingId)) {
        if (findingIds.has(decision.findingId)) {
          issues.push({ path: `${decisionPath}.findingId`, message: 'findingId must be unique.' });
        }
        findingIds.add(decision.findingId);
      }

      if (isNonEmptyString(decision.deduplicationKey)) {
        if (deduplicationKeys.has(decision.deduplicationKey)) {
          issues.push({
            path: `${decisionPath}.deduplicationKey`,
            message: 'deduplicationKey must be unique.',
          });
        }
        deduplicationKeys.add(decision.deduplicationKey);
      }
    });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: value as unknown as MaintenanceFindingDecisionDocument };
}

export function assertValidMaintenanceFindingDecisionDocument(
  value: unknown,
): asserts value is MaintenanceFindingDecisionDocument {
  const result = validateMaintenanceFindingDecisionDocument(value);
  if (!result.ok) {
    const summary = result.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
    throw new Error(`Invalid maintenance finding decision document: ${summary}`);
  }
}

export function toMaintenanceReviewRecord(
  decision: MaintenanceFindingDecision,
): MaintenanceReviewRecord {
  return {
    reviewedBy: decision.reviewedBy,
    reviewedAt: decision.reviewedAt,
    decision: decision.decision,
    reason: decision.reason,
    nextAction: decision.nextAction,
    resolutionRef: decision.resolutionRef,
  };
}
