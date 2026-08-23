import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  loadJson,
  validateJsonSchema
} from './context-learning-core.mjs';
import { projectObservation, projectObservations } from './observation-projection.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const authorityRegistry = loadJson(path.join(repoRoot, 'operations/specs/context-learning/authority-registry.v1.json'));
const schema = loadJson(path.join(repoRoot, 'operations/specs/context-learning/observation-projection-v1.schema.json'));
const fixtures = loadJson(path.join(repoRoot, 'operations/fixtures/context-learning-observation-fixtures-v1.json'));
const now = new Date('2026-08-23T12:00:00Z');

test('fixtures produce schema-valid observations with preserved provenance', () => {
  const observations = projectObservations(fixtures.fixtures.map((fixture) => fixture.source), { authorityRegistry, now });
  assert.equal(observations.length, fixtures.fixtures.length);
  for (const observation of observations) {
    assert.deepEqual(validateJsonSchema(schema, observation, schema), []);
    assert.ok(observation.source_ref);
    assert.ok(observation.source_revision);
    assert.ok(observation.evidence_refs.length >= 1);
    assert.match(observation.fingerprint, /^[a-f0-9]{64}$/);
  }
});

test('authority ownership is resolved from the existing registry and unknown authority fails closed', () => {
  const observation = projectObservation(fixtures.fixtures[0].source, { authorityRegistry, now });
  assert.equal(observation.authority_kind, 'runtime_observation');
  assert.equal(observation.authority_owner, 'evidence');
  assert.equal(observation.canonical, false);

  assert.throws(
    () => projectObservation({ ...fixtures.fixtures[0].source, authorityKind: 'invented_authority' }, { authorityRegistry, now }),
    /unknown_authority_kind/
  );
});

test('freshness uses existing evaluator semantics and fails closed to unknown when absent', () => {
  const stale = projectObservation(fixtures.fixtures[2].source, { authorityRegistry, now });
  assert.equal(stale.freshness, 'stale');

  const reviewDue = projectObservation({
    ...fixtures.fixtures[0].source,
    freshnessInput: { freshnessClass: 'changing', reviewAfter: '2026-08-23T11:00:00Z' }
  }, { authorityRegistry, now });
  assert.equal(reviewDue.freshness, 'review_due');

  const unknown = projectObservation({ ...fixtures.fixtures[0].source, freshnessInput: undefined, freshness: undefined }, { authorityRegistry, now });
  assert.equal(unknown.freshness, 'unknown');
});

test('Mind-impact classification distinguishes Brain-local, possible, and required review', () => {
  const brainLocal = projectObservation(fixtures.fixtures[0].source, { authorityRegistry, now });
  assert.equal(brainLocal.mind_impact, 'none');

  const possible = projectObservation(fixtures.fixtures[2].source, { authorityRegistry, now });
  assert.equal(possible.mind_impact, 'possible');

  const mindContext = projectObservation(fixtures.fixtures[1].source, { authorityRegistry, now });
  assert.equal(mindContext.mind_impact, 'requires_review');
});

test('projection is deterministic, idempotent, sorted, and does not mutate or write', () => {
  const input = structuredClone(fixtures.fixtures.map((fixture) => fixture.source));
  const before = structuredClone(input);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'observation-projection-'));
  try {
    const first = projectObservations(input, { authorityRegistry, now });
    const second = projectObservations(input, { authorityRegistry, now });
    assert.deepEqual(first, second);
    assert.deepEqual(input, before);
    assert.deepEqual(fs.readdirSync(tempRoot), []);
    assert.deepEqual(first.map((item) => item.observation_id), [...first].map((item) => item.observation_id).sort());
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('relationship references are preserved and raw/secret payloads are rejected', () => {
  const observation = projectObservation(fixtures.fixtures[0].source, { authorityRegistry, now });
  assert.deepEqual(observation.relationship_refs, ['rel-validation-001']);

  assert.throws(
    () => projectObservation({ ...fixtures.fixtures[0].source, transcript: 'raw conversation' }, { authorityRegistry, now }),
    /raw_or_secret_payload/
  );
  assert.throws(
    () => projectObservation({ ...fixtures.fixtures[0].source, credentials: { token: 'secret' } }, { authorityRegistry, now }),
    /raw_or_secret_payload/
  );
});
