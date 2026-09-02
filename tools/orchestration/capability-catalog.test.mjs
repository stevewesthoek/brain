import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createCapabilityCatalog, validateCapabilityDescriptors } from './capability-catalog.mjs';
import { loadJson, validateJsonSchema } from '../context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const schema = loadJson(path.join(repoRoot, 'operations/specs/orchestrator-capability-descriptor-v2.schema.json'));

test('catalog projects all source skills and canonical utility adapters', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const metrics = catalog.metrics();
  assert.equal(metrics.skillDescriptorCount, 137);
  assert.ok(metrics.supplementalDescriptorCount >= 19);
  assert.ok(metrics.cliDescriptorCount >= 1);
  assert.ok(metrics.runbookDescriptorCount >= 1);
  assert.ok(metrics.descriptorCount >= 137);
  assert.ok(catalog.descriptors.some((descriptor) => descriptor.capabilityId === 'skill.code'));
  assert.ok(catalog.descriptors.some((descriptor) => descriptor.capabilityId === 'skill.bible-research'));
  assert.ok(catalog.descriptors.some((descriptor) => descriptor.capabilityId === 'adapter.context-broker'));
  assert.ok(catalog.descriptors.some((descriptor) => descriptor.capabilityId === 'mcp.codebase-memory'));
  assert.ok(catalog.descriptors.every((descriptor) => !descriptor.sourceRef.endsWith('projects/brain-core/src/adapters/orchestrators.ts')));
  assert.deepEqual(validateCapabilityDescriptors(catalog.descriptors), []);
});

test('every descriptor satisfies v2 schema and has field-level provenance', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  for (const descriptor of catalog.descriptors) {
    assert.deepEqual(validateJsonSchema(schema, descriptor), [], descriptor.capabilityId);
    for (const field of ['schemaVersion', 'capabilityId', 'kind', 'role', 'label', 'sourceRef', 'sourceRevision', 'profileRefs', 'intents', 'domains', 'triggers', 'excludes', 'inputSchemaRefs', 'outputSchemaRefs', 'requiredContextScopes', 'contextCost', 'stateModel', 'sideEffects', 'riskClass', 'confirmationClass', 'qualityGateRefs', 'failureModes', 'continuity', 'composition', 'health', 'freshness']) {
      assert.ok(descriptor.fieldProvenance[field], `${descriptor.capabilityId}: missing provenance for ${field}`);
    }
  }
});

test('LIST reads compact metadata only and INSPECT reads only the selected exact source', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const before = catalog.metrics();
  const listed = catalog.list({ query: 'Romans textual context', maxItems: 10 });
  assert.equal(listed.telemetry.fullBodyReadsDuringList, 0);
  assert.equal(catalog.metrics().fullBodyReads, before.fullBodyReads);
  assert.ok(listed.descriptors.length > 0);
  assert.ok(listed.descriptors.every((descriptor) => !Object.hasOwn(descriptor, 'instructions')));

  const inspected = catalog.inspect({ capabilityId: 'skill.bible-research', includeInstructions: true });
  assert.equal(inspected.found, true);
  assert.equal(inspected.instructionsIncluded, true);
  assert.equal(inspected.source.exactPath, path.join(repoRoot, 'ai/skills/custom/bible-research/SKILL.md'));
  assert.match(inspected.instructions, /Bible|scripture|Scripture/i);
  assert.equal(catalog.metrics().fullBodyReads, before.fullBodyReads + 1);
});

test('catalog order and source projection are deterministic', () => {
  const left = createCapabilityCatalog({ repoRoot });
  const right = createCapabilityCatalog({ repoRoot });
  assert.deepEqual(left.descriptors, right.descriptors);
  assert.deepEqual(left.reconciliation, right.reconciliation);
  assert.deepEqual(left.list({ query: 'code', maxItems: 20 }), right.list({ query: 'code', maxItems: 20 }));
});

test('reconciliation makes profile and consumer drift explicit after Phase 5 repairs', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const codes = new Set(catalog.reconciliation.issues.map((issue) => issue.code));
  assert.equal(codes.has('duplicate_profile_entry'), false);
  assert.equal(codes.has('profile_no_source'), false);
  assert.equal(codes.has('profile_source_divergence'), false);
  assert.ok(codes.has('stale_projection'));
  assert.ok(codes.has('consumer_projection_divergence'));
  assert.deepEqual(catalog.profileHealth.default.unresolved, []);
  assert.deepEqual(catalog.profileHealth.research.unresolved, []);
  assert.deepEqual(catalog.profileHealth.video.unresolved, []);
  assert.deepEqual(catalog.profileHealth.deploy.unresolved, []);
  assert.deepEqual(catalog.profileHealth.power.unresolved, []);
  assert.deepEqual(catalog.profileHealth['full-current'].duplicates, []);
  assert.ok(catalog.profileHealth.research.allowlistedUnavailable.some((entry) => entry.name === 'gemini'));
  assert.ok(catalog.profileHealth['full-current'].allowlistedUnavailable.some((entry) => entry.name === 'brain-nightly-scheduler-new-job'));
  assert.equal(fs.existsSync(path.join(repoRoot, 'operations/system-configs/gemini/antigravity/skills')), true);
  assert.equal(fs.existsSync(path.join(repoRoot, 'operations/system-configs/kiro/skills')), false);
});

test('descriptor reconciliation rejects invalid schema, role/kind, risk/confirmation, revisions, and health claims', () => {
  const catalog = createCapabilityCatalog({ repoRoot });
  const broken = JSON.parse(JSON.stringify(catalog.descriptors.find((descriptor) => descriptor.capabilityId === 'skill.code')));
  broken.schemaVersion = '1.0.0';
  broken.kind = 'not-a-kind';
  broken.role = 'not-a-role';
  broken.riskClass = 'not-a-risk';
  broken.confirmationClass = 'not-a-confirmation';
  broken.sourceRef = '';
  broken.sourceRevision = 'unavailable';
  broken.stateModel.sourcePresent = false;
  broken.health = 'healthy';
  const errors = validateCapabilityDescriptors([broken]);
  for (const expected of ['invalid schemaVersion', 'invalid kind', 'invalid role', 'invalid riskClass', 'invalid confirmationClass', 'missing sourceRef', 'missing source revision', 'unavailable source marked healthy']) assert.ok(errors.some((error) => error.includes(expected)), expected);
});
