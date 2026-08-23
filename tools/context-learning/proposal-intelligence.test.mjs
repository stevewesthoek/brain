import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareLifecycleProposals } from './proposal-intelligence.mjs';

function finding(overrides = {}) {
  return {
    finding_id: 'lifecycle-abc123', category: 'stale_information', source_refs: ['operations/runbooks/example.md'],
    evidence: ['freshness_evaluator'], freshness: 'stale', confidence: 0.8, impact_classification: 'brain',
    mind_impact: 'none', relationship_refs: [], privacy_class: 'internal', action: 'review_only', ...overrides
  };
}

test('prepares Decision Core-compatible proposals without writing or approving', () => {
  const report = prepareLifecycleProposals({ findings: [finding()] });
  const proposal = report.proposals[0];
  assert.match(proposal.proposalId, /^prop-lifecycle-[a-f0-9]{24}$/);
  assert.equal(proposal.originatingFindingId, 'lifecycle-abc123');
  assert.deepEqual(proposal.sourcePaths, ['operations/runbooks/example.md']);
  assert.equal(proposal.requiresApproval, true);
  assert.equal(proposal.safetyMode, 'report-only');
  assert.equal(proposal.executionBlocked, true);
  assert.equal(proposal.applied, false);
  assert.equal(report.summary.approvals_requested, 0);
  assert.equal(report.summary.canonical_updates, 0);
});

test('preserves Mind impact and requires Mind-aware review without approving it', () => {
  const report = prepareLifecycleProposals({ findings: [finding({
    finding_id: 'lifecycle-mind-001', category: 'contradiction', source_refs: ['mind/preferences/example.md'],
    mind_impact: 'requires_review', impact_classification: 'mind', privacy_class: 'sensitive'
  })] });
  const proposal = report.proposals[0];
  assert.equal(proposal.authorityOwner, 'mind');
  assert.equal(proposal.mindImpact, 'requires_review');
  assert.equal(proposal.writesToMindIfApproved, true);
  assert.equal(proposal.requiredReviewBoundary.includes('Mind-aware review'), true);
  assert.equal(proposal.riskLevel, 'high');
});

test('duplicate findings are safely deduplicated and output is deterministic', () => {
  const inputs = [finding(), finding({ evidence: ['freshness_evaluator', 'report:second'] }), finding({ finding_id: 'lifecycle-other', category: 'retrieval_gap', source_refs: ['operations/README.md'] })];
  const first = prepareLifecycleProposals({ findings: inputs });
  const second = prepareLifecycleProposals({ findings: inputs });
  assert.deepEqual(first, second);
  assert.equal(first.proposals.length, 2);
  assert.equal(first.summary.duplicate_findings_suppressed, 1);
});

test('invalid or executable findings fail closed', () => {
  assert.throws(() => prepareLifecycleProposals({ findings: [finding({ action: 'apply' })] }), /not_review_only/);
  assert.throws(() => prepareLifecycleProposals({ findings: [finding({ finding_id: undefined })] }), /invalid_lifecycle_finding/);
});
