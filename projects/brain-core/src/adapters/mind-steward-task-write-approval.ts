/**
 * Explicit approval gate for future Kanban task writes.
 * This validates approval evidence only; it never writes or replaces kanban.md.
 */

import crypto from 'node:crypto';
import type { KanbanRoundTripFixtureReport } from './mind-steward-kanban-round-trip-fixture.js';
import type { MindStewardTaskProposalOnlyRecord } from './mind-steward-task-proposal.js';

export interface MindStewardTaskWriteApprovalEvidence {
  approvalId: string;
  proposalId: string;
  approvedBy: string;
  approvedAt: string;
  reason: string;
  approvedOperation: 'replace-kanban-from-lossless-candidate';
  targetPath: string;
  expectedBeforeSha256: string;
  backupPath: string;
  backupSha256: string;
  candidateMarkdownSha256: string;
  maxFilesChanged: number;
  manualKanbanWriteConfirm: boolean;
}

export interface MindStewardTaskWriteApprovalGateReport {
  status: 'ready' | 'blocked';
  canRequestTaskWrite: boolean;
  approvalRequired: true;
  proposalId: string | null;
  approvalId: string | null;
  targetPath: 'kanban.md';
  blockers: string[];
  checks: Array<{
    name: string;
    status: 'pass' | 'blocked';
    detail: string;
  }>;
  safety: {
    writesToMind: false;
    writesKanban: false;
    executesWrite: false;
    exactPathOnly: true;
    maxFilesChanged: 1;
    requiresHumanApproval: true;
    requiresLosslessRoundTrip: true;
    requiresBackup: true;
  };
}

export interface EvaluateTaskWriteApprovalGateOptions {
  proposal: MindStewardTaskProposalOnlyRecord;
  roundTripReport: KanbanRoundTripFixtureReport;
  approval: MindStewardTaskWriteApprovalEvidence | null;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

function isParseableDate(value: string): boolean {
  return value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

function isSafeBackupPath(value: string): boolean {
  return value.startsWith('runtime/local/mind-steward/kanban-backups/')
    && value.length > 'runtime/local/mind-steward/kanban-backups/'.length
    && value.endsWith('.md')
    && !value.startsWith('/')
    && !value.includes('..')
    && !value.includes('*')
    && !value.includes('?')
    && !value.includes('\\');
}

function addCheck(
  checks: MindStewardTaskWriteApprovalGateReport['checks'],
  blockers: string[],
  name: string,
  passed: boolean,
  detail: string,
  blocker: string,
): void {
  checks.push({ name, status: passed ? 'pass' : 'blocked', detail });
  if (!passed) blockers.push(blocker);
}

export function evaluateTaskWriteApprovalGate(
  options: EvaluateTaskWriteApprovalGateOptions,
): MindStewardTaskWriteApprovalGateReport {
  const blockers: string[] = [];
  const checks: MindStewardTaskWriteApprovalGateReport['checks'] = [];
  const { proposal, roundTripReport, approval } = options;

  addCheck(
    checks,
    blockers,
    'task-proposal-ready',
    proposal.status === 'ready' && proposal.proposalOnly === true && proposal.executionAllowed === false,
    `proposal=${proposal.proposalId} status=${proposal.status}`,
    'readyProposalOnlyTaskProposalRequired',
  );
  addCheck(
    checks,
    blockers,
    'lossless-round-trip-ready',
    roundTripReport.status === 'ready' && roundTripReport.checks.every(check => check.status === 'pass'),
    `roundTripStatus=${roundTripReport.status}`,
    'readyLosslessRoundTripRequired',
  );
  addCheck(
    checks,
    blockers,
    'round-trip-remains-non-writing',
    roundTripReport.safety.writesKanban === false
      && roundTripReport.safety.writesToMind === false
      && roundTripReport.safety.touchesRealKanban === false
      && roundTripReport.safety.requiresApprovalBeforeRealWrite === true,
    'round-trip report is fixture-only and requires approval',
    'nonWritingRoundTripSafetyRequired',
  );

  if (!approval) {
    checks.push({
      name: 'explicit-human-approval',
      status: 'blocked',
      detail: 'approval evidence is missing',
    });
    blockers.push('explicitHumanApprovalRequired');
  } else {
    const candidateHash = roundTripReport.candidateMarkdown ? sha256(roundTripReport.candidateMarkdown) : null;
    addCheck(
      checks,
      blockers,
      'explicit-human-approval',
      approval.approvalId.trim().length > 0
        && approval.approvedBy.trim().length > 0
        && approval.reason.trim().length > 0
        && isParseableDate(approval.approvedAt),
      `approval=${approval.approvalId}`,
      'completeHumanApprovalMetadataRequired',
    );
    addCheck(
      checks,
      blockers,
      'approval-matches-proposal',
      approval.proposalId === proposal.proposalId,
      `approvalProposal=${approval.proposalId} proposal=${proposal.proposalId}`,
      'approvalProposalMismatch',
    );
    addCheck(
      checks,
      blockers,
      'approved-operation-exact',
      approval.approvedOperation === 'replace-kanban-from-lossless-candidate',
      `operation=${approval.approvedOperation}`,
      'approvedTaskWriteOperationRequired',
    );
    addCheck(
      checks,
      blockers,
      'target-path-exact',
      approval.targetPath === 'kanban.md',
      `target=${approval.targetPath}`,
      'exactKanbanTargetRequired',
    );
    addCheck(
      checks,
      blockers,
      'candidate-hash-bound',
      candidateHash !== null && approval.candidateMarkdownSha256 === candidateHash,
      `candidateHash=${candidateHash ?? 'missing'} approvalHash=${approval.candidateMarkdownSha256}`,
      'candidateMarkdownHashMismatch',
    );
    addCheck(
      checks,
      blockers,
      'before-hash-valid',
      isSha256(approval.expectedBeforeSha256),
      `expectedBeforeSha256=${approval.expectedBeforeSha256}`,
      'expectedBeforeSha256Required',
    );
    addCheck(
      checks,
      blockers,
      'backup-evidence-valid',
      isSafeBackupPath(approval.backupPath)
        && approval.backupSha256 === approval.expectedBeforeSha256
        && isSha256(approval.backupSha256),
      `backupPath=${approval.backupPath}`,
      'kanbanBackupEvidenceRequired',
    );
    addCheck(
      checks,
      blockers,
      'single-file-scope',
      approval.maxFilesChanged === 1,
      `maxFilesChanged=${approval.maxFilesChanged}`,
      'singleKanbanFileWriteScopeRequired',
    );
    addCheck(
      checks,
      blockers,
      'manual-kanban-confirmation',
      approval.manualKanbanWriteConfirm === true,
      `manualKanbanWriteConfirm=${approval.manualKanbanWriteConfirm}`,
      'manualKanbanWriteConfirmationRequired',
    );
  }

  return {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    canRequestTaskWrite: blockers.length === 0,
    approvalRequired: true,
    proposalId: proposal.proposalId,
    approvalId: approval?.approvalId ?? null,
    targetPath: 'kanban.md',
    blockers,
    checks,
    safety: {
      writesToMind: false,
      writesKanban: false,
      executesWrite: false,
      exactPathOnly: true,
      maxFilesChanged: 1,
      requiresHumanApproval: true,
      requiresLosslessRoundTrip: true,
      requiresBackup: true,
    },
  };
}
