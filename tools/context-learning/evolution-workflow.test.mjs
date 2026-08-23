import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { loadJson, stableJsonHash, validateJsonSchema } from './context-learning-core.mjs';
import { prepareApprovedEvolution } from './evolution-workflow.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const contracts = loadJson(path.join(root, 'operations/specs/context-learning/contracts-v1.schema.json'));

function proposal(overrides = {}) {
  return {
    proposalId: 'prop-lifecycle-001', originatingFindingId: 'lifecycle-stale-001', requiresApproval: true,
    executionBlocked: true, mindImpact: 'none', evidenceRefs: ['freshness_evaluator'], sourcePaths: ['operations/runbooks/example.md'],
    ...overrides
  };
}

function input(overrides = {}) {
  const candidate = proposal(overrides.proposal);
  const hash = stableJsonHash(candidate);
  return {
    proposal: candidate, approval: { proposalId: candidate.proposalId, decision: 'approved', proposalHash: hash },
    expectedProposalHash: hash, authority: { owner: 'brain', clear: true }, scope: [{ repository: 'brain', operation: 'patch', target: 'operations/runbooks/example.md' }],
    expectedMindRevision: 'mind-rev-001', expectedBrainRevision: 'brain-rev-001', validationPlan: ['validate exact target hash', 'run documentation checks'],
    rollbackRefs: ['receipt:rollback-001'], now: new Date('2026-08-23T12:00:00Z'), contractSchema: contracts, ...overrides
  };
}

test('prepares a schema-valid bounded transaction and learning receipt without execution', () => {
  const result = prepareApprovedEvolution(input());
  assert.deepEqual(validateJsonSchema(contracts.$defs.learningTransaction, result.transaction, contracts), []);
  assert.equal(result.transaction.state, 'prepared');
  assert.equal(result.learning_receipt.executionPerformed, false);
  assert.equal(result.boundary.execution_enabled, false);
  assert.equal(result.boundary.writes_performed, 0);
  assert.equal(result.boundary.approval_record_mutated, false);
});

test('Mind-impact changes fail closed without Mind-aware review', () => {
  assert.throws(() => prepareApprovedEvolution(input({ proposal: proposal({ mindImpact: 'requires_review' }) })), /mind_review_required/);
  const result = prepareApprovedEvolution(input({ proposal: proposal({ mindImpact: 'requires_review' }), authority: { owner: 'mind', clear: true } }));
  assert.equal(result.transaction.state, 'prepared');
});

test('approval, hash, scope, validation, and rollback boundaries fail closed', () => {
  assert.throws(() => prepareApprovedEvolution(input({ approval: { proposalId: 'prop-lifecycle-001', decision: 'deferred', proposalHash: 'x' }, expectedProposalHash: 'x' })), /approved_decision_required/);
  assert.throws(() => prepareApprovedEvolution(input({ expectedProposalHash: 'wrong' })), /proposal_hash_mismatch/);
  assert.throws(() => prepareApprovedEvolution(input({ scope: [] })), /bounded_scope_required/);
  assert.throws(() => prepareApprovedEvolution(input({ rollbackRefs: [] })), /rollback_references_required/);
  assert.throws(() => prepareApprovedEvolution(input({ validationPlan: [] })), /validation_plan_required/);
});

test('preparation is deterministic and does not mutate inputs', () => {
  const args = input();
  const before = JSON.stringify(args);
  const first = prepareApprovedEvolution(args);
  const second = prepareApprovedEvolution(args);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(args), before);
});
