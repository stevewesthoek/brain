import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { loadJson, validateJsonSchema } from '../context-learning/context-learning-core.mjs';
import {
  createBindingCandidate,
  createObservationAdapter,
  planCandidateAdmission,
  runObservationAdapter,
  validateCandidateContract,
} from './observation-core.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const candidateSchema = loadJson(path.join(root, 'operations/specs/infrastructure-candidate-v1.schema.json'));
const now = '2026-09-05T00:00:00Z';

function bindingCandidate({ state = 'candidate', classification = 'USER-PROPOSED', observedTargetRef = null } = {}) {
  return createBindingCandidate({
    candidateId: 'candidate:openai.personal.01.cli-binding',
    relationshipKind: 'account_runtime_profile',
    subjectRef: 'runtime_profile:openai.personal.01.cli',
    targetRef: 'account:openai.personal.01',
    state,
    observedTargetRef,
    evidence: { isolation: 'confirmed' },
    observedAt: now,
    provenanceClassification: classification,
    provenanceEvidenceRefs: ['user-confirmation:openai.personal.01'],
  });
}

test('account/profile binding candidates reuse the normal schema and remain non-secret', () => {
  const candidate = bindingCandidate();
  assert.deepEqual(validateJsonSchema(candidateSchema.$defs.candidate, candidate, candidateSchema), []);
  assert.deepEqual(validateCandidateContract(candidate, { schema: candidateSchema }), []);
  const plan = planCandidateAdmission({ candidate, now });
  assert.equal(plan.decision, 'remain_candidate');
  assert.ok(plan.reasons.includes('binding_not_verified'));
  assert.equal(plan.executionEnabled, false);
  assert.equal(plan.containsSecrets, false);
  assert.equal(Object.hasOwn(candidate, 'token'), false);
});

test('provider-verified binding can be admitted only after the evidence state changes', () => {
  const candidate = bindingCandidate({ state: 'confirmed', classification: 'OBSERVED-VERIFIED' });
  assert.deepEqual(validateCandidateContract(candidate, { schema: candidateSchema }), []);
  const plan = planCandidateAdmission({ candidate, now });
  assert.equal(plan.decision, 'admit');
  assert.deepEqual(plan.actualEffects, []);
});

test('a user assertion cannot masquerade as a provider-verified binding', async () => {
  const candidate = bindingCandidate({ state: 'confirmed', classification: 'USER-PROPOSED' });
  assert.ok(validateCandidateContract(candidate, { schema: candidateSchema }).some((error) => error.includes('confirmed binding requires')));
  const adapter = createObservationAdapter({
    observerId: 'binding-test-observer',
    adapterKind: 'synthetic-binding',
    discover: async () => ({ candidates: [candidate], observations: [] }),
    observe: async () => candidate,
    verifyRelationship: async () => ({ state: 'unknown' }),
  });
  await assert.rejects(() => runObservationAdapter(adapter, { candidateSchema }), /confirmed binding requires/);
});

test('conflicting account/profile binding is rejected by shared admission', () => {
  const candidate = bindingCandidate({ state: 'conflicted', classification: 'OBSERVED-VERIFIED' });
  assert.deepEqual(validateCandidateContract(candidate, { schema: candidateSchema }), []);
  const plan = planCandidateAdmission({ candidate, now });
  assert.equal(plan.decision, 'reject');
  assert.ok(plan.reasons.includes('conflict_detected'));
});

test('wrong-account binding evidence cannot be admitted', () => {
  const candidate = bindingCandidate({ state: 'conflicted', classification: 'OBSERVED-VERIFIED', observedTargetRef: 'account:openai.personal.02' });
  assert.deepEqual(validateCandidateContract(candidate, { schema: candidateSchema }), []);
  const plan = planCandidateAdmission({ candidate, now });
  assert.equal(plan.decision, 'reject');
  assert.ok(plan.reasons.includes('conflict_detected'));
});
