import { createHash } from 'node:crypto';
import type { MindWikiHealthFinding } from './wiki-health.js';
import { describeMindPath, isCanonicalActivePath, isRegisteredCompatibilityRead } from './path-registry.js';
import { MIND_MAINTENANCE_POLICY } from '../../../operations/specs/infinite-brain-boundary-contracts.js';

export type MindMaintenancePreviewActionKind =
  | 'create-missing-wiki-log'
  | 'update-wiki-index-link'
  | 'add-source-trace-placeholder'
  | 'review-stale-capture'
  | 'review-failed-capture'
  | 'review-oversized-wiki-page'
  | 'review-orphan-wiki-page'
  | 'review-stale-claim'
  | 'review-broken-link'
  | 'no-op-info';

export type MindMaintenancePreviewRisk = 'low' | 'medium' | 'high';
export type MindMaintenancePreviewOperation = 'none' | 'create' | 'patch' | 'review';

export interface MindMaintenancePreviewAction {
  id: string;
  kind: MindMaintenancePreviewActionKind;
  targetPath: string;
  sourceFindingId: string;
  title: string;
  summary: string;
  recommendation: string;
  risk: MindMaintenancePreviewRisk;
  proposedOperation: MindMaintenancePreviewOperation;
  requiresApproval: boolean;
  blockedBy: string[];
  writesToMind: false;
  externalSideEffects: false;
}

export interface MindMaintenancePreviewQueue {
  kind: 'mind-maintenance-preview-queue';
  createdAt: string;
  source: 'wiki-health';
  actions: MindMaintenancePreviewAction[];
  summary: {
    total: number;
    lowRiskCount: number;
    mediumRiskCount: number;
    highRiskCount: number;
    approvalRequiredCount: number;
    blockedCount: number;
  };
  writesToMind: false;
  externalSideEffects: false;
}

const BLOCKED_PATHS_PREFIXES = MIND_MAINTENANCE_POLICY.blockedPrefixes;
const BLOCKED_PATHS_EXACT = MIND_MAINTENANCE_POLICY.blockedExactPaths;

function isPathBlocked(targetPath: string): boolean {
  // Check exact paths
  if (BLOCKED_PATHS_EXACT.includes(targetPath)) {
    return true;
  }

  // Check suffixes
  if (targetPath.endsWith('.env') || targetPath.includes('.env.')) {
    return true;
  }

  // Check traversal
  if (targetPath.includes('..') || targetPath.startsWith('/')) {
    return true;
  }

  // Check prefixes
  for (const prefix of BLOCKED_PATHS_PREFIXES) {
    if (targetPath.startsWith(prefix)) {
      return true;
    }
  }

  // Every Mind path must be registry-classified. Only the registered proposal
  // ledger may appear as a compatibility review item; all other compatibility
  // paths and unknown paths fail closed.
  const entry = describeMindPath(targetPath);
  if (!entry) return true;
  if (!isCanonicalActivePath(targetPath)) {
    return !(targetPath === 'wiki/log.md' && isRegisteredCompatibilityRead(targetPath));
  }

  return false;
}

function createActionId(kind: MindMaintenancePreviewActionKind, targetPath: string, findingId: string): string {
  const input = `${kind}:${targetPath}:${findingId}`;
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 12);
  return `action-${hash}`;
}

function mapFindingToAction(finding: MindWikiHealthFinding): MindMaintenancePreviewAction | null {
  // Block unsafe paths
  if (isPathBlocked(finding.path)) {
    return null;
  }

  let kind: MindMaintenancePreviewActionKind;
  let title: string;
  let summary: string;
  let recommendation: string;
  let risk: MindMaintenancePreviewRisk;
  let operation: MindMaintenancePreviewOperation;
  let requiresApproval: boolean;
  let blockedBy: string[] = [];

  switch (finding.id) {
    case 'missing-required-file': {
      if (finding.path === 'wiki/log.md') {
        kind = 'no-op-info';
        title = 'Review registered wiki/log.md compatibility ledger';
        summary = 'wiki/log.md is a registered compatibility proposal ledger, not a write default.';
        recommendation = 'Review its deletion prerequisites; do not create or write it from this preview.';
        risk = 'low';
        operation = 'review';
        requiresApproval = false;
      } else {
        return null;
      }
      break;
    }

    case 'empty-sources-index': return null;

    case 'stale-capture-inbox': {
      kind = 'review-stale-capture';
      title = `Review stale capture: ${finding.path}`;
      summary = `Capture at ${finding.path} is older than 7 days.`;
      recommendation = 'Review the capture to determine whether it belongs in canonical projects, knowledge, resources, or history.';
      risk = 'medium';
      operation = 'review';
      requiresApproval = false;
      break;
    }

    case 'stale-failed-capture': {
      kind = 'review-failed-capture';
      title = `Review failed capture: ${finding.path}`;
      summary = `Failed capture at ${finding.path} is older than 3 days.`;
      recommendation = 'Review whether to retry the capture, fix the root cause, or discard it.';
      risk = 'medium';
      operation = 'review';
      requiresApproval = false;
      break;
    }

    case 'oversized-wiki-page': {
      kind = 'review-oversized-wiki-page';
      title = `Review oversized wiki page: ${finding.path}`;
      summary = `${finding.path} exceeds the 500-line wiki page target.`;
      recommendation = 'Split the page into smaller, linked pages or move subtopics to separate wiki files for better discoverability.';
      risk = 'medium';
      operation = 'review';
      requiresApproval = false;
      break;
    }

    case 'orphan-wiki-page': {
      kind = 'review-orphan-wiki-page';
      title = `Review orphan wiki page: ${finding.path}`;
      summary = `${finding.path} is not referenced from wiki/index.md.`;
      recommendation = 'Link the page from its canonical index if it is meant to be discoverable, or move it to history if it is outdated.';
      risk = 'low';
      operation = 'review';
      requiresApproval = false;
      break;
    }

    case 'missing-source-trace': {
      kind = 'add-source-trace-placeholder';
      title = `Add source trace to: ${finding.path}`;
      summary = `${finding.path} does not contain a source trace marker.`;
      recommendation = 'Add a brief source or capture link when the page is compiled from evidence. This helps with attribution and validation.';
      risk = 'low';
      operation = 'patch';
      requiresApproval = true;
      break;
    }

    default:
      // Unknown finding type -> no-op info
      kind = 'no-op-info';
      title = `Info: ${finding.message}`;
      summary = finding.message;
      recommendation = finding.recommendation;
      risk = 'low';
      operation = 'none';
      requiresApproval = false;
      break;
  }

  const id = createActionId(kind, finding.path, finding.id);

  return {
    id,
    kind,
    targetPath: finding.path,
    sourceFindingId: finding.id,
    title,
    summary,
    recommendation,
    risk,
    proposedOperation: operation,
    requiresApproval,
    blockedBy,
    writesToMind: false,
    externalSideEffects: false,
  };
}

export function createMindMaintenancePreviewQueueFromFindings(
  findings: MindWikiHealthFinding[],
  now = new Date(),
): MindMaintenancePreviewQueue {
  const actions: MindMaintenancePreviewAction[] = [];

  for (const finding of findings) {
    const action = mapFindingToAction(finding);
    if (action) {
      actions.push(action);
    }
  }

  const summary = {
    total: actions.length,
    lowRiskCount: actions.filter((a) => a.risk === 'low').length,
    mediumRiskCount: actions.filter((a) => a.risk === 'medium').length,
    highRiskCount: actions.filter((a) => a.risk === 'high').length,
    approvalRequiredCount: actions.filter((a) => a.requiresApproval).length,
    blockedCount: actions.filter((a) => a.blockedBy.length > 0).length,
  };

  return {
    kind: 'mind-maintenance-preview-queue',
    createdAt: now.toISOString(),
    source: 'wiki-health',
    actions,
    summary,
    writesToMind: false,
    externalSideEffects: false,
  };
}
