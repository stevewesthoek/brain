import { createHash } from 'node:crypto';
import path from 'node:path';
import { EXACT_SCOPE_APPROVAL_POLICY } from '../../../../operations/specs/infinite-brain-boundary-contracts.js';

export type ApprovalSection = { startLine: number; endLine: number };
export type ExactScopeFile = { path: string; beforeHash: string | null; sections: ApprovalSection[] };
export type RollbackRequirement = { required: true; strategy: 'restore-before-content'; beforeHash: string | null };
export type ExactScopeApproval = {
  approvalId: string;
  approvedBy: string;
  approvedAt: string;
  expiresAt: string;
  idempotencyKey: string;
  files: ExactScopeFile[];
  rollback: Record<string, RollbackRequirement>;
};
export type ExactScopeProposal = {
  requestId: string;
  idempotencyKey: string;
  changes: Array<{ path: string; beforeHash: string | null; afterContent: string; sections: ApprovalSection[] }>;
  rollbackRequired: true;
  modelSupplied?: Record<string, unknown>;
};
export type ExactScopeReceipt = {
  status: 'applied' | 'idempotent-replay';
  approvalId: string;
  idempotencyKey: string;
  scopeHash: string;
  files: Array<{ path: string; beforeHash: string | null; afterHash: string; sections: ApprovalSection[]; rollback: RollbackRequirement }>;
};

export class ExactScopeApprovalError extends Error {
  constructor(public readonly code: string) { super(code); }
}

const FORBIDDEN_MODEL_FIELDS = new Set(EXACT_SCOPE_APPROVAL_POLICY.forbiddenModelFields);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  return JSON.stringify(value);
};

function normalizeRepositoryPath(input: string): string {
  if (!input || input.includes('\\')) throw new ExactScopeApprovalError('invalid_path');
  const normalized = path.posix.normalize(input);
  if (normalized !== input || normalized.startsWith('../') || normalized.startsWith('/') || normalized === '..') throw new ExactScopeApprovalError('path_scope_mismatch');
  return normalized;
}

function validateSections(requested: ApprovalSection[], allowed: ApprovalSection[]): void {
  if (requested.length === 0) throw new ExactScopeApprovalError('missing_section_scope');
  for (const section of requested) {
    if (!Number.isInteger(section.startLine) || !Number.isInteger(section.endLine) || section.startLine < 1 || section.endLine < section.startLine) throw new ExactScopeApprovalError('invalid_section_scope');
    if (!allowed.some((candidate) => section.startLine >= candidate.startLine && section.endLine <= candidate.endLine)) throw new ExactScopeApprovalError('section_scope_mismatch');
  }
}

export function validateExactScopeApproval(approval: ExactScopeApproval, proposal: ExactScopeProposal, now = new Date()): string {
  if (!approval.approvalId || !approval.approvedBy) throw new ExactScopeApprovalError('missing_trusted_approval_identity');
  if (Date.parse(approval.expiresAt) <= now.getTime()) throw new ExactScopeApprovalError('approval_expired');
  if (proposal.idempotencyKey !== approval.idempotencyKey) throw new ExactScopeApprovalError('idempotency_scope_mismatch');
  if (proposal.rollbackRequired !== true) throw new ExactScopeApprovalError('rollback_required');
  for (const key of Object.keys(proposal.modelSupplied ?? {})) if (FORBIDDEN_MODEL_FIELDS.has(key)) throw new ExactScopeApprovalError('model_supplied_authorization');
  if (proposal.changes.length !== approval.files.length) throw new ExactScopeApprovalError('file_scope_mismatch');
  const approvedByPath = new Map(approval.files.map((file) => [normalizeRepositoryPath(file.path), file]));
  for (const change of proposal.changes) {
    const requestedPath = normalizeRepositoryPath(change.path);
    const allowed = approvedByPath.get(requestedPath);
    if (!allowed) throw new ExactScopeApprovalError('file_scope_mismatch');
    if (change.beforeHash !== allowed.beforeHash) throw new ExactScopeApprovalError('before_hash_mismatch');
    validateSections(change.sections, allowed.sections);
    const rollback = approval.rollback[requestedPath];
    if (!rollback || rollback.required !== true || rollback.strategy !== EXACT_SCOPE_APPROVAL_POLICY.rollbackStrategy || rollback.beforeHash !== allowed.beforeHash) throw new ExactScopeApprovalError('rollback_scope_mismatch');
  }
  return sha256(canonicalJson({ approvalId: approval.approvalId, idempotencyKey: approval.idempotencyKey, files: approval.files, rollback: approval.rollback }));
}

export function previewExactScopeApply(approval: ExactScopeApproval, proposal: ExactScopeProposal, now = new Date()) {
  const scopeHash = validateExactScopeApproval(approval, proposal, now);
  return { approvalId: approval.approvalId, idempotencyKey: proposal.idempotencyKey, scopeHash, changes: proposal.changes.map((change) => ({ path: change.path, afterHash: sha256(change.afterContent), sections: change.sections })) };
}

export function applyExactScopeFixture(input: { approval: ExactScopeApproval; proposal: ExactScopeProposal; contents: Map<string, string>; consumed: Map<string, ExactScopeReceipt>; now?: Date }): ExactScopeReceipt {
  const preview = previewExactScopeApply(input.approval, input.proposal, input.now);
  const existing = input.consumed.get(input.proposal.idempotencyKey);
  if (existing) {
    if (existing.scopeHash !== preview.scopeHash || existing.files.some((file, index) => file.afterHash !== preview.changes[index]?.afterHash)) throw new ExactScopeApprovalError('idempotency_conflict');
    return { ...existing, status: 'idempotent-replay' };
  }
  if ([...input.consumed.values()].some((receipt) => receipt.approvalId === input.approval.approvalId)) throw new ExactScopeApprovalError('approval_replay');
  const files = input.proposal.changes.map((change) => {
    const current = input.contents.get(change.path) ?? null;
    const currentHash = current === null ? null : sha256(current);
    if (currentHash !== change.beforeHash) throw new ExactScopeApprovalError('repository_state_changed');
    input.contents.set(change.path, change.afterContent);
    return { path: change.path, beforeHash: change.beforeHash, afterHash: sha256(change.afterContent), sections: change.sections, rollback: input.approval.rollback[change.path]! };
  });
  const receipt: ExactScopeReceipt = { status: 'applied', approvalId: input.approval.approvalId, idempotencyKey: input.proposal.idempotencyKey, scopeHash: preview.scopeHash, files };
  input.consumed.set(input.proposal.idempotencyKey, receipt);
  return receipt;
}

export const hashExactScopeContent = sha256;
