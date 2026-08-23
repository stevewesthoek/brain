import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { loadJson, validateJsonSchema } from './context-learning-core.mjs';
import { analyzeKnowledgeLifecycle } from './knowledge-lifecycle-analysis.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const contracts = loadJson(path.join(repoRoot, 'operations/specs/context-learning/contracts-v1.schema.json'));
const registry = loadJson(path.join(repoRoot, 'operations/specs/context-learning/authority-registry.v1.json'));
const now = new Date('2026-08-23T12:00:00Z');

function atom(overrides = {}) {
  return {
    schemaVersion: '1.0.0', atomId: 'atom-skill-001', kind: 'skill', canonicalOwner: 'brain',
    canonicalRef: 'ai/skills/example.md', summary: 'Bounded example skill.', authority: 'approved-operational',
    observedAt: '2026-08-20T10:00:00Z', validFrom: '2026-08-20T10:00:00Z', validTo: null,
    lastConfirmedAt: '2026-08-20T10:00:00Z', reviewAfter: '2026-09-01T00:00:00Z', freshnessClass: 'stable',
    sensitivity: 'internal', sourceEvidenceRefs: ['report:example'], supersedes: [], supersededBy: [],
    contradicts: [], relatedTo: [], tags: ['example'], contentHash: 'a'.repeat(64), transactionId: null,
    ...overrides
  };
}

function relation(overrides = {}) {
  return {
    schemaVersion: '1.0.0', relationId: 'rel-example-001', fromAtomId: 'atom-skill-001', toAtomId: 'atom-skill-002',
    type: 'supports', strength: 0.8, evidenceRefs: ['report:example'], lastConfirmedAt: '2026-08-20T10:00:00Z',
    contentHash: 'b'.repeat(64), ...overrides
  };
}

function analyze(atoms, relations = [], options = {}) {
  return analyzeKnowledgeLifecycle({
    atoms, relations, now, contractSchema: contracts,
    authorityRegistry: registry, sourceRefs: ['report:example'], ...options
  });
}

test('lifecycle findings preserve provenance, privacy, Mind impact, and report-only semantics', () => {
  const report = analyze([atom({ atomId: 'atom-preference-001', kind: 'preference', canonicalOwner: 'mind', canonicalRef: 'mind/preferences/example.md', authority: 'human', sensitivity: 'sensitive', contentHash: 'c'.repeat(64) })]);
  assert.ok(report.findings.some((item) => item.category === 'missing_relationship'));
  assert.ok(report.findings.every((item) => item.source_refs.length > 0));
  assert.ok(report.findings.every((item) => item.privacy_class === 'sensitive'));
  assert.ok(report.findings.every((item) => item.mind_impact === 'requires_review'));
  assert.equal(report.summary.writes_performed, 0);
  assert.equal(report.summary.canonical_updates, 0);
  assert.equal(JSON.stringify(report).includes('Bounded example'), false);
});

test('stale, duplicate, contradictory, missing-reference, and retrieval-gap findings are deterministic', () => {
  const first = atom({ atomId: 'atom-skill-001', validTo: '2026-08-22T00:00:00Z', contentHash: 'd'.repeat(64), sourceEvidenceRefs: ['missing:report'] });
  const second = atom({ atomId: 'atom-skill-002', contentHash: 'd'.repeat(64), contradicts: ['atom-skill-001'], sourceEvidenceRefs: [] });
  const firstReport = analyze([first, second]);
  const secondReport = analyze([first, second]);
  assert.deepEqual(firstReport, secondReport);
  assert.ok(firstReport.findings.some((item) => item.category === 'stale_information'));
  assert.ok(firstReport.findings.some((item) => item.category === 'duplicate_information'));
  assert.ok(firstReport.findings.some((item) => item.category === 'contradiction'));
  assert.ok(firstReport.findings.some((item) => item.category === 'outdated_reference'));
  assert.ok(firstReport.findings.some((item) => item.category === 'retrieval_gap'));
});

test('relationship evidence suppresses weak-connection finding and remains source-backed', () => {
  const report = analyze([atom(), atom({ atomId: 'atom-skill-002', contentHash: 'e'.repeat(64) })], [relation()]);
  const firstFindings = report.findings.filter((item) => item.atom_id === 'atom-skill-001');
  assert.equal(firstFindings.some((item) => item.category === 'missing_relationship'), false);
  assert.ok(firstFindings.every((item) => item.evidence.length > 0));
});

test('invalid or raw payload inputs fail closed without creating lifecycle state', () => {
  assert.throws(() => analyze([atom({ summary: 'secret', content: 'raw' })]), /invalid_lifecycle_inputs/);
  assert.throws(() => analyze([atom({ canonicalOwner: 'mind' })]), /invalid_lifecycle_inputs/);
  assert.deepEqual(validateJsonSchema(contracts.$defs.knowledgeAtom, atom(), contracts), []);
});
