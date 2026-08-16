import path from 'node:path';
import process from 'node:process';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';
import { BROKER_OPERATIONS } from './context-learning/context-broker.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const schemaPath = path.join(repoRoot, 'operations/specs/context-learning/broker-contracts-v1.schema.json');
const fixturePath = path.join(repoRoot, 'operations/fixtures/context-learning-broker-fixtures-v1.json');
const schema = loadJson(schemaPath);
const fixtures = loadJson(fixturePath);

const requiredDefs = [
  'brokerRequest',
  'contextProviderDescriptor',
  'retrievalProviderDescriptor',
  'capabilityDescriptor',
  'contextItem',
  'healthResponse',
  'bootstrapEnvelope',
  'contextPack',
  'explainResponse',
  'alignmentEvidence',
  'alignmentResult',
  'capabilityListResponse',
  'capabilityInspectResponse',
  'decisionStatusResponse',
  'learnStatusResponse'
];

const expectedOperations = [
  'health',
  'bootstrap',
  'resolve',
  'explain',
  'align',
  'capabilities_list',
  'capabilities_inspect',
  'decisions_status',
  'learn_status'
];

const errors = [];
if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') errors.push('broker schema must declare JSON Schema Draft 2020-12');
if (!schema.$id) errors.push('broker schema requires stable $id');
for (const name of requiredDefs) if (!schema.$defs?.[name]) errors.push(`missing broker schema definition: ${name}`);
if (JSON.stringify(BROKER_OPERATIONS) !== JSON.stringify(expectedOperations)) errors.push('broker operation surface changed unexpectedly');

for (const [profileName, profile] of Object.entries({ referenceProfile: fixtures.referenceProfile, alternateProfile: fixtures.alternateProfile })) {
  for (const [index, provider] of (profile.contextProviders ?? []).entries()) {
    errors.push(...validateJsonSchema(schema.$defs.contextProviderDescriptor, { schemaVersion: '1.0.0', ...provider }, schema, `$.${profileName}.contextProviders[${index}]`));
  }
  for (const [index, provider] of (profile.retrievalProviders ?? []).entries()) {
    errors.push(...validateJsonSchema(schema.$defs.retrievalProviderDescriptor, { schemaVersion: '1.0.0', ...provider }, schema, `$.${profileName}.retrievalProviders[${index}]`));
  }
  for (const provider of profile.capabilityProviders ?? []) {
    if (!provider.providerId || !provider.providerKind || !provider.sourceRevision) errors.push(`${profileName}: incomplete capability provider descriptor`);
  }
}

const alternateText = JSON.stringify(fixtures.alternateProfile).toLowerCase();
for (const forbidden of ['steve', '/users/office', 'macbook', 'obsidian', 'brain-reference', 'mind-reference']) {
  if (alternateText.includes(forbidden)) errors.push(`alternate provider fixture contains forbidden reference-profile coupling: ${forbidden}`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`context-learning-broker-contracts-valid schema=${schema.$id} definitions=${requiredDefs.length} operations=${BROKER_OPERATIONS.length} profiles=2`);
