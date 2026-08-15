import path from 'node:path';
import process from 'node:process';
import {
  loadJson,
  resolveClrPaths,
  validateAuthorityRegistry,
  validateJsonSchema,
  validateRetentionInvariants
} from './context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const paths = resolveClrPaths(repoRoot);
const schema = loadJson(paths.contracts);
const registry = loadJson(paths.authorityRegistry);
const retention = loadJson(paths.retentionProfile);

const requiredDefs = [
  'knowledgeAtom',
  'relation',
  'evidenceEvent',
  'decisionItem',
  'learningTransaction',
  'contextPack',
  'retentionProfile',
  'authorityRegistry'
];

const errors = [];
for (const definition of requiredDefs) {
  if (!schema.$defs?.[definition]) errors.push(`schema definition missing: ${definition}`);
}

if (schema.$schema !== 'https://json-schema.org/draft/2020-12/schema') {
  errors.push('contracts schema must declare JSON Schema Draft 2020-12');
}
if (!schema.$id) errors.push('contracts schema requires stable $id');

errors.push(...validateJsonSchema(schema.$defs.authorityRegistry, registry, schema, '$.authorityRegistry'));
errors.push(...validateAuthorityRegistry(registry));
errors.push(...validateJsonSchema(schema.$defs.retentionProfile, retention, schema, '$.retentionProfile'));
errors.push(...validateRetentionInvariants(retention));

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  `context-learning-contracts-valid schema=${schema.$id} definitions=${requiredDefs.length} authorityKinds=${registry.entries.length} storageClasses=${retention.storageClasses.length}`
);
