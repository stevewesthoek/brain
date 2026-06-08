/**
 * Infinite Brain Operator Approval Gate
 * Records explicit operator approval intent for a future execution attempt
 * This phase: approval-record-only, execution remains blocked
 *
 * Input: operator name, decision, reason
 * Output: runtime/local/infinite-brain/operator-approval-latest.json
 *
 * Safety: canExecute: false, executionEnabled: false, applied: false, writesToMind: false
 * Important: Even if decision is approved, executionEnabled and canExecute remain false.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_OPERATOR_APPROVAL_RELATIVE_PATH = 'runtime/local/infinite-brain/operator-approval-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export type OperatorApprovalDecision = 'approved' | 'rejected' | 'needs-review';

export interface OperatorApprovalSafety {
  writesToMind: boolean;
  appliesProposals: boolean;
  canExecute: boolean;
  executionEnabled: boolean;
  applied: boolean;
  approvalRecordOnly: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
}

export interface OperatorApprovalRecord {
  approvalId: string;
  generatedAt: string;
  operator: string;
  decision: OperatorApprovalDecision;
  reason: string;
  dryRunReportId: string | null;
  readinessReportId: string | null;
  scope: 'execution-approval-intent';
  executionEnabled: boolean;
  canExecute: boolean;
  applied: boolean;
  writesToMind: boolean;
  expiresAt?: string;
  requiredNextGates: string[];
  safety: OperatorApprovalSafety;
}

function getOperatorApprovalPath(): string {
  const envPath = process.env.IBR_OPERATOR_APPROVAL_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_OPERATOR_APPROVAL_RELATIVE_PATH);
}

function generateApprovalId(
  operator: string,
  decision: OperatorApprovalDecision,
  dryRunReportId: string | null,
  readinessReportId: string | null,
  reason: string
): string {
  const input = [operator, decision, dryRunReportId || 'no-dry-run', readinessReportId || 'no-readiness', reason]
    .join('|');

  const hash = crypto
    .createHash('sha256')
    .update(input)
    .digest('hex')
    .substring(0, 12);

  return `approval-${hash}`;
}

function generateSafetyBlock(): OperatorApprovalSafety {
  return {
    writesToMind: false,
    appliesProposals: false,
    canExecute: false,
    executionEnabled: false,
    applied: false,
    approvalRecordOnly: true,
    continuousRuntime: false,
    modelCalls: false,
  };
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function generateOperatorApprovalRecord(
  operator: string,
  decision: OperatorApprovalDecision,
  reason: string,
  dryRunReportId?: string,
  readinessReportId?: string
): OperatorApprovalRecord {
  const approvalId = generateApprovalId(
    operator,
    decision,
    dryRunReportId || null,
    readinessReportId || null,
    reason
  );

  // Required next gates for execution (approval alone doesn't enable execution)
  const requiredNextGates = [
    'deletion-sync-verification',
    'allowlisted-writer-deployment',
    'post-write-verification',
  ];

  return {
    approvalId,
    generatedAt: new Date().toISOString(),
    operator,
    decision,
    reason,
    dryRunReportId: dryRunReportId || null,
    readinessReportId: readinessReportId || null,
    scope: 'execution-approval-intent',
    executionEnabled: false,
    canExecute: false,
    applied: false,
    writesToMind: false,
    requiredNextGates,
    safety: generateSafetyBlock(),
  };
}

export function writeOperatorApprovalRecord(record: OperatorApprovalRecord): boolean {
  try {
    const approvalPath = getOperatorApprovalPath();
    const approvalDir = path.dirname(approvalPath);
    fs.mkdirSync(approvalDir, { recursive: true });
    fs.writeFileSync(approvalPath, `${JSON.stringify(record, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readOperatorApprovalRecord(): OperatorApprovalRecord | null {
  const approvalPath = getOperatorApprovalPath();
  return readJsonSafely<OperatorApprovalRecord>(approvalPath);
}

export function readOperatorApprovalSummary(): {
  available: boolean;
  generatedAt?: string;
  operator?: string;
  decision?: OperatorApprovalDecision;
  executionEnabled?: boolean;
  canExecute?: boolean;
  applied?: boolean;
  writesToMind?: boolean;
  approvalRecordOnly?: boolean;
} {
  const record = readOperatorApprovalRecord();
  if (!record) {
    return { available: false };
  }

  return {
    available: true,
    generatedAt: record.generatedAt,
    operator: record.operator,
    decision: record.decision,
    executionEnabled: record.executionEnabled,
    canExecute: record.canExecute,
    applied: record.applied,
    writesToMind: record.writesToMind,
    approvalRecordOnly: record.safety.approvalRecordOnly,
  };
}
