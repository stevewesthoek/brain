import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  buildOnboardingBacklog,
  candidateFromObservation,
  createObservationAdapter,
  planCandidateAdmission,
  validateObservationContract,
} from './observation-core.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'operations/specs/infrastructure-observation-v1.schema.json'), 'utf8'));
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'operations/fixtures/infrastructure-runtime-observation-synthetic-v1.json'), 'utf8'));

test('observation adapter contract requires all three generic seams', () => {
  assert.throws(() => createObservationAdapter({ observerId: 'synthetic', adapterKind: 'runtime', discover: () => ({}) }), /requires discover/);
  const adapter = createObservationAdapter({
    observerId: 'synthetic',
    adapterKind: 'runtime',
    discover: () => ({}),
    observe: () => null,
    verifyRelationship: () => ({ state: 'unknown' }),
  });
  assert.deepEqual(adapter.capabilities, ['discover', 'observe', 'verify_relationship']);
});

test('generic observations retain app custody, Brain custody, dependency, and isolation evidence', () => {
  const alpha = fixture.observations[0];
  const beta = fixture.observations[1];
  assert.deepEqual(validateObservationContract({ observation: alpha, schema }), []);
  assert.deepEqual(validateObservationContract({ observation: beta, schema }), []);
  assert.equal(alpha.identityBindingEvidence.custody, 'application');
  assert.equal(beta.identityBindingEvidence.custody, 'orchestrator');
  assert.equal(beta.dependencyEvidence.dependencies[0].resourceRef, 'database:beta-store');
  assert.deepEqual(alpha.isolationEvidence.boundaryRefs, ['boundary:synthetic-alpha']);
  assert.deepEqual(beta.isolationEvidence.boundaryRefs, ['boundary:synthetic-beta']);
});

test('admission planner admits clean candidates and fails closed on unknown or conflicting evidence', () => {
  const candidates = fixture.observations.map((observation) => candidateFromObservation(observation, {
    proposedResourceId: observation.resourceId,
    resourceKind: observation.runtimeIdentity.runtimeKind,
  }));
  const decisions = candidates.map((candidate) => planCandidateAdmission({ candidate, now: '2026-09-05T00:00:00Z' }));
  assert.deepEqual(Object.fromEntries(decisions.map((plan) => [plan.candidateId, plan.decision])), {
    'candidate:synthetic-alpha-consumer': 'admit',
    'candidate:synthetic-beta-consumer': 'admit',
    'candidate:synthetic-gamma-consumer': 'remain_candidate',
    'candidate:synthetic-delta-consumer': 'reject',
  });
  assert.equal(decisions.find((plan) => plan.candidateId.endsWith('delta-consumer')).executionPerformed, false);
});

test('raw access metadata is rejected even when the value is redacted in the test', () => {
  const invalid = { ...fixture.observations[0], access_token: 'REDACTED_TEST_SENTINEL' };
  const errors = validateObservationContract({ observation: invalid, schema, label: 'negative' });
  assert.ok(errors.some((error) => error.includes('forbidden raw-access field')));
});

test('canonical backlog is explicit and bounded by resource identity', () => {
  const backlog = buildOnboardingBacklog({
    catalog: { resources: [{ resourceId: 'service:unknown', resourceClass: 'service' }], relations: [] },
    now: '2026-09-05T00:00:00Z',
  });
  assert.equal(backlog.items.length, 1);
  assert.equal(backlog.items[0].status, 'governance_unknown');
  assert.ok(backlog.items[0].reasons.includes('owner_unknown'));
  assert.equal(backlog.executionEnabled, false);
});
