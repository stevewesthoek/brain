import {
  toMaintenanceReviewRecord,
  type MaintenanceFindingDecision,
  type MaintenanceFindingDecisionDocument,
} from './finding-decision-store.js';
import type { MaintenanceFinding } from './types.js';

export interface ApplyMaintenanceFindingDecisionsInput {
  findings: readonly MaintenanceFinding[];
  decisions: MaintenanceFindingDecisionDocument;
  reportDate: string;
}

export interface ApplyMaintenanceFindingDecisionsResult {
  findings: MaintenanceFinding[];
  suppressedFindings: MaintenanceFinding[];
  unmatchedDecisions: MaintenanceFindingDecision[];
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function cloneFinding(finding: MaintenanceFinding): MaintenanceFinding {
  return {
    ...finding,
    paths: [...finding.paths],
    matchedEvidence: finding.matchedEvidence.map((evidence) => ({ ...evidence })),
    comparisonEvidence: finding.comparisonEvidence.map((evidence) => ({ ...evidence })),
    review: finding.review ? { ...finding.review } : null,
  };
}

function isSuppressed(
  decision: MaintenanceFindingDecision,
  reportDate: string,
): boolean {
  return decision.decision === 'dismissed'
    && decision.suppressionUntil !== null
    && reportDate <= decision.suppressionUntil;
}

export function applyMaintenanceFindingDecisions(
  input: ApplyMaintenanceFindingDecisionsInput,
): ApplyMaintenanceFindingDecisionsResult {
  if (!isIsoDate(input.reportDate)) {
    throw new Error(`Decision application requires an ISO report date: ${input.reportDate}`);
  }

  const decisionsByKey = new Map(
    input.decisions.decisions.map((decision) => [decision.deduplicationKey, decision]),
  );
  const matchedKeys = new Set<string>();
  const findings: MaintenanceFinding[] = [];
  const suppressedFindings: MaintenanceFinding[] = [];

  for (const sourceFinding of input.findings) {
    const finding = cloneFinding(sourceFinding);
    const decision = decisionsByKey.get(finding.deduplicationKey);

    if (!decision) {
      findings.push(finding);
      continue;
    }

    matchedKeys.add(decision.deduplicationKey);

    if (decision.decision === 'accepted') {
      finding.status = 'accepted';
      finding.review = toMaintenanceReviewRecord(decision);
      finding.suppressionUntil = null;
      findings.push(finding);
      continue;
    }

    if (isSuppressed(decision, input.reportDate)) {
      finding.status = 'dismissed';
      finding.review = toMaintenanceReviewRecord(decision);
      finding.suppressionUntil = decision.suppressionUntil;
      suppressedFindings.push(finding);
      continue;
    }

    // Expired dismissals and resolved findings represent a new recurrence.
    // Keep them visible and open rather than silently inheriting an old decision.
    finding.status = 'open';
    finding.review = null;
    finding.suppressionUntil = null;
    findings.push(finding);
  }

  return {
    findings,
    suppressedFindings,
    unmatchedDecisions: input.decisions.decisions
      .filter((decision) => !matchedKeys.has(decision.deduplicationKey))
      .map((decision) => ({ ...decision })),
  };
}
