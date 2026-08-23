import { stableJsonHash, validateJsonSchema } from './context-learning-core.mjs';

const VERSION = '1.0.0';

function strings(value = []) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [])].sort();
}

function fail(code) { throw new Error(`evolution_boundary:${code}`); }

function validateScope(scope) {
  if (!Array.isArray(scope) || scope.length === 0) fail('bounded_scope_required');
  for (const operation of scope) {
    if (!operation || !['mind', 'brain'].includes(operation.repository)
      || !['create', 'patch', 'replace', 'invalidate', 'relate'].includes(operation.operation)
      || typeof operation.target !== 'string' || operation.target.trim().length === 0) fail('invalid_scope');
  }
  return scope.map((operation) => ({ ...operation }));
}

export function prepareApprovedEvolution({
  proposal,
  approval,
  expectedProposalHash,
  authority,
  scope,
  expectedMindRevision,
  expectedBrainRevision,
  validationPlan,
  rollbackRefs,
  now = new Date(),
  contractSchema
} = {}) {
  if (!proposal?.proposalId || !proposal.originatingFindingId) fail('proposal_traceability_required');
  if (proposal.executionBlocked !== true || proposal.requiresApproval !== true) fail('proposal_not_approval_gated');
  if (!approval || approval.decision !== 'approved') fail('approved_decision_required');
  const proposalHash = stableJsonHash(proposal);
  if (typeof expectedProposalHash !== 'string' || expectedProposalHash !== proposalHash || approval.proposalHash !== proposalHash) fail('proposal_hash_mismatch');
  if (!authority?.clear || !['mind', 'brain'].includes(authority.owner)) fail('authority_unclear');
  if (proposal.mindImpact === 'requires_review' && authority.owner !== 'mind' && authority.mind_reviewed !== true) fail('mind_review_required');
  const plannedOperations = validateScope(scope);
  if (typeof expectedMindRevision !== 'string' || expectedMindRevision.length < 7) fail('mind_revision_required');
  if (typeof expectedBrainRevision !== 'string' || expectedBrainRevision.length < 7) fail('brain_revision_required');
  if (!Array.isArray(validationPlan) || validationPlan.length === 0 || validationPlan.some((item) => typeof item !== 'string' || item.length === 0)) fail('validation_plan_required');
  const rollback = strings(rollbackRefs);
  if (rollback.length === 0) fail('rollback_references_required');
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) fail('valid_now_required');

  const transactionId = `clr-tx-${stableJsonHash({ proposal: proposal.proposalId, approval: approval.proposalHash, scope: plannedOperations }).slice(0, 24)}`;
  const transaction = {
    schemaVersion: VERSION,
    transactionId,
    proposalIds: [proposal.proposalId],
    expectedMindRevision,
    expectedBrainRevision,
    plannedOperations,
    approvalRefs: [strings([approval.proposalId])[0] ?? proposal.proposalId, ...rollback].sort(),
    validationPlan,
    resultingMindRevision: null,
    resultingBrainRevision: null,
    receiptHash: null,
    state: 'prepared',
    createdAt: now.toISOString(),
    completedAt: null
  };
  if (contractSchema) {
    const errors = validateJsonSchema(contractSchema.$defs?.learningTransaction ?? contractSchema, transaction, contractSchema);
    if (errors.length > 0) fail(`transaction_schema_invalid:${errors.join(';')}`);
  }
  const learningReceipt = {
    receiptId: `receipt-${stableJsonHash(transaction).slice(0, 24)}`,
    transactionId,
    proposalId: proposal.proposalId,
    approvalRef: approval.proposalId ?? proposal.proposalId,
    state: 'prepared',
    executionPerformed: false,
    canonicalUpdates: 0,
    rollbackRefs: rollback,
    validationPlan: [...validationPlan],
    evidenceRefs: strings([...(proposal.evidenceRefs ?? []), ...(proposal.sourcePaths ?? []), ...rollback]),
    createdAt: now.toISOString()
  };
  return {
    schema_version: VERSION,
    mode: 'PREPARE_ONLY',
    transaction,
    learning_receipt: learningReceipt,
    boundary: {
      execution_enabled: false,
      execution_performed: false,
      canonical_updates: 0,
      writes_performed: 0,
      approval_record_mutated: false
    }
  };
}
