#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const schemaPath = path.join(repoRoot, 'operations/specs/infinite-brain-conversation-evidence.v1.schema.json');
const inputPath = process.argv[2];
if (!inputPath) throw new Error('usage: node tools/validate-conversation-evidence.mjs <report.json>');
const schema = loadJson(schemaPath);
const report = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
const errors = validateJsonSchema(schema, report, schema, '$');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (report.invariants?.writes_to_mind !== false || report.invariants?.writes_to_brain_canonical !== false || report.invariants?.ikhp_canonical_mutation !== false) {
  throw new Error('conversation evidence report violates report-only invariant');
}
console.log(`conversation-evidence-valid events=${report.evidence_count} duplicates=${report.duplicate_count} redactions=${report.redactions ?? 0}`);
