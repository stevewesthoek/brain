import fs from 'node:fs';
import path from 'node:path';

import { validateJsonSchema } from './context-learning/context-learning-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'operations/specs/infrastructure-automation-admission-v1.schema.json'), 'utf8'));
const errors = [];

const valid = {
  schemaVersion: '1.0.0',
  proposalId: 'proposal:test-001',
  resourceIds: ['host:test'],
  policyRevision: 'policy:1.0.0',
  healthEvidence: { freshness: 'fresh' },
  provenance: [{ source: 'test', readOnly: true }],
  riskClass: 'low-risk-reversible',
  decision: 'proposed',
  rollbackExpectation: {},
  receiptId: 'receipt:test-001',
  lifecycle: { state: 'proposed' }
};

errors.push(...validateJsonSchema(schema, valid, schema, '$'));

const invalid = { ...valid };
delete invalid.provenance;
if (validateJsonSchema(schema, invalid, schema, '$').length === 0) errors.push('missing provenance must fail');

if (valid.decision === 'executed') errors.push('automation admission must not define execution state');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Infrastructure automation admission validation passed');
