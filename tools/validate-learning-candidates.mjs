#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { loadJson, validateJsonSchema } from './context-learning/context-learning-core.mjs';

const repoRoot = path.resolve(import.meta.dirname, '..');
const inputPath = process.argv[2];
if (!inputPath) throw new Error('usage: node tools/validate-learning-candidates.mjs <report.json>');
const schema = loadJson(path.join(repoRoot, 'operations/specs/infinite-brain-learning-candidate.v1.schema.json'));
const report = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
const errors = validateJsonSchema(schema, report, schema, '$');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
if (report.invariants?.report_only !== true || report.invariants?.writes_to_mind !== false || report.invariants?.writes_to_brain_canonical !== false || report.invariants?.ikhp_canonical_mutation !== false || report.invariants?.automatic_promotion !== false) throw new Error('learning candidate report violates report-only invariant');
console.log(`learning-candidates-valid candidates=${report.candidate_count} relations=${report.relation_candidate_count ?? report.relations.length}`);
