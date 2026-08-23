import { stableJsonHash } from './context-learning-core.mjs';

const PROPOSAL_VERSION = '1.0.0';

function strings(value = []) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [])].sort();
}

function text(value, fallback) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function validateFinding(finding) {
  const required = ['finding_id', 'category', 'source_refs', 'evidence', 'freshness', 'confidence', 'impact_classification', 'mind_impact', 'privacy_class'];
  const missing = required.filter((field) => finding?.[field] === undefined);
  if (missing.length > 0) throw new Error(`invalid_lifecycle_finding:${missing.join(',')}`);
  if (finding.action && finding.action !== 'review_only') throw new Error('lifecycle_finding_not_review_only');
}

function riskFor(finding) {
  if (finding.mind_impact === 'requires_review' || finding.privacy_class === 'restricted') return 'high';
  if (finding.category === 'contradiction' || finding.freshness === 'superseded') return 'medium';
  return 'low';
}

function proposalFor(finding, index) {
  const canonicalTargets = strings(finding.source_refs).filter((ref) => !ref.startsWith('report:') && !ref.startsWith('evt-'));
  const authorityOwner = finding.mind_impact === 'requires_review' ? 'mind' : finding.impact_classification === 'brain' ? 'brain' : 'evidence';
  const risk = riskFor(finding);
  const alternatives = [
    'Defer review and retain the current canonical source unchanged.',
    'Reject the finding after source and relationship review.'
  ];
  if (finding.category === 'duplicate_information') alternatives.push('Keep both records until authority and meaning are explicitly reconciled.');
  if (finding.category === 'contradiction') alternatives.push('Collect additional evidence before deciding which source, if any, should change.');

  const identity = { finding_id: finding.finding_id, category: finding.category, source_refs: strings(finding.source_refs) };
  const proposalId = `prop-lifecycle-${stableJsonHash(identity).slice(0, 24)}`;
  return {
    proposalId,
    schemaVersion: PROPOSAL_VERSION,
    category: `knowledge-lifecycle-${finding.category}`,
    title: `Review ${finding.category.replaceAll('_', ' ')} finding ${finding.finding_id}`,
    summary: `Evaluate a report-only lifecycle finding before considering any canonical change.`,
    originatingFindingId: finding.finding_id,
    sourceReferences: strings(finding.source_refs).map((path) => ({ path, role: 'provenance' })),
    sourcePaths: strings(finding.source_refs),
    evidenceRefs: strings(finding.evidence),
    canonicalTargets,
    authorityOwner,
    confidence: Number.isFinite(finding.confidence) ? finding.confidence : 0.5,
    expectedBenefit: `Improve knowledge freshness, consistency, relationship coverage, or retrieval quality after human review.`,
    riskLevel: risk,
    risk,
    alternatives,
    mindImpact: finding.mind_impact,
    requiredReviewBoundary: finding.mind_impact === 'requires_review'
      ? 'Mind-aware review is required before any interpretation or change involving meaning, priorities, strategy, or importance.'
      : 'Brain/Decision Core review is required; no change is authorized by this proposal.',
    freshness: finding.freshness,
    privacyClass: finding.privacy_class,
    priority: finding.mind_impact === 'requires_review' ? 'high' : 'normal',
    proposedAction: `Review evidence for ${finding.finding_id}; do not apply automatically.`,
    recommendedAction: `Review ${finding.finding_id} through the existing Decision Core workflow.`,
    whyNow: `The lifecycle analyzer identified a ${finding.category} condition with ${finding.freshness} freshness.`,
    consequenceOfDelay: 'The existing canonical source remains unchanged while review is deferred.',
    requiresApproval: true,
    writesToMindIfApproved: authorityOwner === 'mind',
    safetyMode: 'report-only',
    executionBlocked: true,
    applied: false,
    status: 'proposed',
    sourceIndex: index
  };
}

export function prepareLifecycleProposals({ findings = [] } = {}) {
  if (!Array.isArray(findings)) throw new Error('findings_array_required');
  const unique = new Map();
  findings.forEach((finding, index) => {
    validateFinding(finding);
    const proposal = proposalFor(finding, index);
    const existing = unique.get(proposal.originatingFindingId);
    if (!existing || proposal.proposalId < existing.proposalId) unique.set(proposal.originatingFindingId, proposal);
  });
  const proposals = [...unique.values()]
    .map(({ sourceIndex, ...proposal }) => proposal)
    .sort((left, right) => left.proposalId.localeCompare(right.proposalId));
  return {
    schema_version: PROPOSAL_VERSION,
    mode: 'REPORT_ONLY_PREPARATION',
    decision_core: { queue: 'existing-infinite-brain-proposals', approval_store: 'existing-infinite-brain-proposal-approval-store', writes_performed: 0 },
    proposals,
    summary: {
      finding_count: findings.length,
      proposal_count: proposals.length,
      duplicate_findings_suppressed: findings.length - proposals.length,
      mind_review_count: proposals.filter((proposal) => proposal.mindImpact === 'requires_review').length,
      execution_blocked: true,
      approvals_requested: 0,
      canonical_updates: 0
    }
  };
}
