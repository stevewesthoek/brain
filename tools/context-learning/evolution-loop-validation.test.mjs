import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { loadJson, stableJsonHash } from './context-learning-core.mjs';
import { prepareLifecycleProposals } from './proposal-intelligence.mjs';
import { analyzeKnowledgeLifecycle } from './knowledge-lifecycle-analysis.mjs';
import { validateEvolutionLoop } from './evolution-loop-validation.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const contracts = loadJson(path.join(root, 'operations/specs/context-learning/contracts-v1.schema.json'));
const authorityRegistry = loadJson(path.join(root, 'operations/specs/context-learning/authority-registry.v1.json'));
const observationSchema = loadJson(path.join(root, 'operations/specs/context-learning/observation-projection-v1.schema.json'));
const now = new Date('2026-08-23T12:00:00Z');

function atom() {
  return { schemaVersion: '1.0.0', atomId: 'atom-skill-loop-001', kind: 'skill', canonicalOwner: 'brain', canonicalRef: 'ai/skills/loop.md', summary: 'Loop skill', authority: 'approved-operational', observedAt: '2026-08-20T00:00:00Z', validFrom: '2026-08-20T00:00:00Z', validTo: '2026-08-22T00:00:00Z', lastConfirmedAt: '2026-08-20T00:00:00Z', reviewAfter: null, freshnessClass: 'changing', sensitivity: 'internal', sourceEvidenceRefs: ['evt-loop-001'], supersedes: [], supersededBy: [], contradicts: [], relatedTo: [], tags: ['loop'], contentHash: 'a'.repeat(64), transactionId: null };
}

function args() {
  const source = { sourceKind: 'runtime_observation', sourceRef: 'ai/skills/loop.md', authorityKind: 'runtime_observation', observedAt: '2026-08-23T11:00:00Z', sourceRevision: 'rev-loop-001', evidenceRefs: ['evt-loop-001'], relationshipRefs: [], freshness: 'fresh', confidence: 0.7, privacyClass: 'internal' };
  const findingInput = { observationSources: [source], atoms: [atom()], relations: [], sourceRefs: ['evt-loop-001'], now, authorityRegistry, contractSchema: contracts, observationSchema };
  return findingInput;
}

function validArgs() {
  const base = args();
  const lifecycleFinding = analyzeKnowledgeLifecycle({ atoms: base.atoms, relations: base.relations, sourceRefs: base.sourceRefs, now, authorityRegistry, contractSchema: contracts }).findings[0];
  const proposal = prepareLifecycleProposals({ findings: [lifecycleFinding] }).proposals[0];
  const hash = stableJsonHash(proposal);
  return { ...base, approval: { proposalId: proposal.proposalId, decision: 'approved', proposalHash: hash }, expectedProposalHash: hash, findingId: lifecycleFinding.finding_id, authority: { owner: 'brain', clear: true }, scope: [{ repository: 'brain', operation: 'patch', target: 'ai/skills/loop.md' }], expectedMindRevision: 'mind-rev-001', expectedBrainRevision: 'brain-rev-001', validationPlan: ['check exact target hash'], rollbackRefs: ['receipt:loop-rollback'] };
}

test('validates the complete report-only chain and preserves continuity', () => {
  const result = validateEvolutionLoop(validArgs());
  assert.equal(result.valid, true);
  assert.deepEqual(result.stages, { observation: true, lifecycle_finding: true, proposal: true, decision_core_reference: true, evolution_preparation: true, validation_receipt_projection: true });
  assert.equal(result.continuity.freshness, 'stale');
  assert.equal(result.continuity.confidence, 0.7);
  assert.ok(result.continuity.provenance_refs.includes('evt-loop-001'));
  assert.ok(result.continuity.rollback_refs.includes('receipt:loop-rollback'));
  assert.equal(result.boundary.providers_called, 0);
  assert.equal(result.boundary.writes_performed, 0);
});

test('chain validation is deterministic and does not mutate inputs', () => {
  const input = validArgs();
  const before = JSON.stringify(input);
  const first = validateEvolutionLoop(input);
  const second = validateEvolutionLoop(input);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), before);
});

test('approval hash or provenance gaps fail closed', () => {
  assert.throws(() => validateEvolutionLoop({ ...validArgs(), expectedProposalHash: 'wrong' }), /proposal_hash_mismatch/);
  assert.throws(() => validateEvolutionLoop({ ...validArgs(), authority: { owner: 'unknown', clear: false } }), /authority_unclear/);
});
