import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadJson } from '../context-learning/context-learning-core.mjs';
import {
  REQUIRED_RELATION_CLASSES,
  REQUIRED_RESOURCE_CLASSES,
  loadAndValidateReferenceCatalog,
  validateCatalogBundle,
} from './catalog-core.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const schema = loadJson(path.join(root, 'operations/specs/infrastructure-catalog-v1.schema.json'));
const alternate = loadJson(path.join(root, 'operations/fixtures/infrastructure-catalog-alternate-v1.json'));
const now = new Date('2026-08-16T20:00:00Z');
const clone = (value) => JSON.parse(JSON.stringify(value));

test('reference catalog passes integrity validation while surfacing stale provenance as warnings', () => {
  const result = loadAndValidateReferenceCatalog(root, now);
  assert.deepEqual(result.errors, []);
  assert.ok(result.counts.resources >= REQUIRED_RESOURCE_CLASSES.length);
  assert.ok(result.counts.relations >= 20);
  assert.equal(result.mappingSources, 11);
  assert.ok(result.counts.staleWarnings > 0);
});

test('alternate fixture is source-neutral and covers every public resource and relation class', () => {
  const result = validateCatalogBundle({ schema, bundle: alternate, now, label: '.alternate-test' });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(new Set(alternate.resources.map((resource) => resource.resourceClass)), new Set(REQUIRED_RESOURCE_CLASSES));
  for (const relationClass of REQUIRED_RELATION_CLASSES) assert.ok(alternate.relations.some((relation) => relation.relationClass === relationClass));
});

test('duplicate resource IDs and competing canonical owners fail closed', () => {
  const fixture = clone(alternate);
  const duplicate = clone(fixture.resources[0]);
  duplicate.canonicalOwnerRef = 'fixture:other-owner';
  fixture.resources.push(duplicate);
  const result = validateCatalogBundle({ schema, bundle: fixture, now, label: '.duplicate' });
  assert.ok(result.errors.some((error) => error.includes('duplicate-resource-id')));
  assert.ok(result.errors.some((error) => error.includes('competing-canonical-owner')));
});

test('unresolved relation targets fail closed', () => {
  const fixture = clone(alternate);
  fixture.relations[0].targetId = 'host:missing-node';
  const result = validateCatalogBundle({ schema, bundle: fixture, now, label: '.missing-target' });
  assert.ok(result.errors.some((error) => error.includes('unresolved-relation-target')));
});

test('contradictory duplicate topology facts fail closed', () => {
  const fixture = clone(alternate);
  const duplicate = clone(fixture.relations[0]);
  duplicate.relationId = 'relation:portal-runs-edge-conflict';
  duplicate.state = 'historical';
  fixture.relations.push(duplicate);
  const result = validateCatalogBundle({ schema, bundle: fixture, now, label: '.conflict' });
  assert.ok(result.errors.some((error) => error.includes('contradictory-topology-fact')));
});

test('missing provenance and invalid freshness chronology fail validation', () => {
  const fixture = clone(alternate);
  delete fixture.resources[0].provenance;
  fixture.resources[1].provenance.freshnessDeadline = '2026-01-01T00:00:00Z';
  const result = validateCatalogBundle({ schema, bundle: fixture, now, label: '.provenance' });
  assert.ok(result.errors.some((error) => error.includes('missing required property provenance') || error.includes('missing provenance')));
  assert.ok(result.errors.some((error) => error.includes('freshnessDeadline precedes verifiedAt')));
});

test('raw access-bearing fields and unsafe inline store references are rejected', () => {
  const fixture = clone(alternate);
  const rawFieldName = ['to', 'ken'].join('');
  fixture.credentialReferences[0][rawFieldName] = 'redacted-placeholder';
  fixture.credentialReferences[0].secretStoreRef = 'inline-material-placeholder';
  const result = validateCatalogBundle({ schema, bundle: fixture, now, label: '.access-safety' });
  assert.ok(result.errors.some((error) => error.includes('unexpected property token') || error.includes('forbidden raw-access field')));
  assert.ok(result.errors.some((error) => error.includes('opaque reference/path')));
});

test('resource ID prefix must match its declared resource class', () => {
  const fixture = clone(alternate);
  fixture.resources[0].resourceId = 'service:edge-node';
  const result = validateCatalogBundle({ schema, bundle: fixture, now, label: '.id-class' });
  assert.ok(result.errors.some((error) => error.includes('resource-id-class-mismatch')));
});
