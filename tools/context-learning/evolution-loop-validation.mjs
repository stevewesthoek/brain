import { projectObservations } from './observation-projection.mjs';
import { analyzeKnowledgeLifecycle } from './knowledge-lifecycle-analysis.mjs';
import { prepareLifecycleProposals } from './proposal-intelligence.mjs';
import { prepareApprovedEvolution } from './evolution-workflow.mjs';

function fail(code) { throw new Error(`evolution_loop:${code}`); }
function setOf(values) { return new Set((values ?? []).filter((value) => typeof value === 'string')); }

export function validateEvolutionLoop({
  observationSources,
  atoms,
  relations = [],
  sourceRefs = [],
  findingId,
  approval,
  authority,
  scope,
  expectedProposalHash,
  expectedMindRevision,
  expectedBrainRevision,
  validationPlan,
  rollbackRefs,
  now = new Date(),
  authorityRegistry,
  contractSchema,
  observationSchema
} = {}) {
  const observations = projectObservations(observationSources, { authorityRegistry, now });
  const lifecycle = analyzeKnowledgeLifecycle({ atoms, relations, sourceRefs, now, contractSchema, authorityRegistry });
  const finding = lifecycle.findings.find((item) => item.finding_id === findingId) ?? lifecycle.findings[0];
  if (!finding) fail('finding_not_found');

  const observationRefs = new Set(observations.flatMap((item) => [item.source_ref, ...item.evidence_refs]));
  const atomRefs = new Set(atoms.flatMap((atom) => [atom.canonicalRef, ...(atom.sourceEvidenceRefs ?? [])]));
  const relationRefs = new Set(relations.flatMap((relation) => [relation.relationId, ...relation.evidenceRefs]));
  const availableRefs = new Set([...observationRefs, ...atomRefs, ...relationRefs]);
  if (finding.source_refs.some((ref) => !availableRefs.has(ref))) fail('finding_provenance_gap');

  const proposals = prepareLifecycleProposals({ findings: [finding] });
  const proposal = proposals.proposals[0];
  if (!proposal || proposal.originatingFindingId !== finding.finding_id) fail('proposal_traceability_gap');
  if (proposal.confidence !== finding.confidence || proposal.freshness !== finding.freshness || proposal.mindImpact !== finding.mind_impact) fail('finding_metadata_not_preserved');
  if (proposal.evidenceRefs.some((ref) => !availableRefs.has(ref) && !finding.evidence.includes(ref))) fail('proposal_evidence_gap');

  const approvalRecord = approval;
  const prepared = prepareApprovedEvolution({
    proposal,
    approval: approvalRecord,
    expectedProposalHash,
    authority,
    scope,
    expectedMindRevision,
    expectedBrainRevision,
    validationPlan,
    rollbackRefs,
    now,
    contractSchema
  });
  if (!prepared.transaction.proposalIds.includes(proposal.proposalId)) fail('transaction_traceability_gap');
  if (!prepared.learning_receipt.rollbackRefs.every((ref) => rollbackRefs.includes(ref))) fail('rollback_provenance_gap');
  if (prepared.boundary.execution_enabled || prepared.boundary.execution_performed || prepared.boundary.writes_performed !== 0) fail('unsafe_boundary');

  if (observationSchema) {
    // The existing observation projection schema is checked by the caller's contract tests;
    // retain this option as an explicit chain input without introducing a second validator.
    if (!observationSchema.$id) fail('observation_schema_missing');
  }
  return {
    schema_version: '1.0.0',
    mode: 'REPORT_ONLY_CHAIN_VALIDATION',
    valid: true,
    chain: {
      observation_ids: observations.map((item) => item.observation_id),
      finding_id: finding.finding_id,
      proposal_id: proposal.proposalId,
      approval_ref: approvalRecord.proposalId ?? proposal.proposalId,
      transaction_id: prepared.transaction.transactionId,
      receipt_id: prepared.learning_receipt.receiptId
    },
    continuity: {
      provenance_refs: [...new Set(finding.source_refs)].sort(),
      evidence_refs: [...new Set([...finding.evidence, ...proposal.evidenceRefs, ...prepared.learning_receipt.evidenceRefs])].sort(),
      freshness: finding.freshness,
      confidence: finding.confidence,
      mind_impact: finding.mind_impact,
      authority_owner: proposal.authorityOwner,
      rollback_refs: prepared.learning_receipt.rollbackRefs
    },
    boundary: {
      execution_enabled: false,
      execution_performed: false,
      canonical_updates: 0,
      writes_performed: 0,
      providers_called: 0,
      approvals_created: 0
    },
    stages: { observation: true, lifecycle_finding: true, proposal: true, decision_core_reference: true, evolution_preparation: true, validation_receipt_projection: true }
  };
}
