import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  evaluateFreshness,
  loadJson,
  resolveClrPaths,
  validateAtomAuthority,
  validateAuthorityRegistry,
  validateJsonSchema,
  validateRetentionInvariants
} from './context-learning-core.mjs';
import { inventorySharedMemory } from './inventory-shared-memory.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const paths = resolveClrPaths(repoRoot);
const schema = loadJson(paths.contracts);
const registry = loadJson(paths.authorityRegistry);
const retention = loadJson(paths.retentionProfile);

function atom(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    atomId: 'atom-preference-001',
    kind: 'preference',
    canonicalOwner: 'mind',
    canonicalRef: 'knowledge/preferences/working-style.md',
    summary: 'Prefer bounded exact context over broad context dumps.',
    authority: 'human',
    observedAt: '2026-08-15T10:00:00Z',
    validFrom: '2026-08-15T10:00:00Z',
    validTo: null,
    lastConfirmedAt: '2026-08-15T10:00:00Z',
    reviewAfter: '2026-09-15T10:00:00Z',
    freshnessClass: 'changing',
    sensitivity: 'internal',
    sourceEvidenceRefs: ['evt-session-001'],
    supersedes: [],
    supersededBy: [],
    contradicts: [],
    relatedTo: [],
    tags: ['context'],
    contentHash: 'a'.repeat(64),
    transactionId: null,
    ...overrides
  };
}

test('all CLR1 schema definitions exist and validate representative fixtures', () => {
  const definitions = [
    'knowledgeAtom',
    'relation',
    'evidenceEvent',
    'decisionItem',
    'learningTransaction',
    'contextPack',
    'retentionProfile',
    'authorityRegistry'
  ];
  for (const name of definitions) assert.ok(schema.$defs?.[name], `${name} should exist`);

  assert.deepEqual(validateJsonSchema(schema.$defs.knowledgeAtom, atom(), schema), []);
  assert.match(
    validateJsonSchema(schema.$defs.knowledgeAtom, { ...atom(), contentHash: 'not-a-hash' }, schema).join('\n'),
    /does not match pattern/
  );
  assert.deepEqual(validateJsonSchema(schema.$defs.authorityRegistry, registry, schema), []);
  assert.deepEqual(validateJsonSchema(schema.$defs.retentionProfile, retention, schema), []);
});

test('authority registry has no duplicate or ownership contradictions', () => {
  assert.deepEqual(validateAuthorityRegistry(registry), []);
});

test('authority rules reject parallel human truth and wrong Brain ownership', () => {
  assert.deepEqual(validateAtomAuthority(atom(), registry), []);

  const wrongPreference = atom({ canonicalOwner: 'brain', canonicalRef: 'operations/preferences.md' });
  assert.match(validateAtomAuthority(wrongPreference, registry).join('\n'), /must belong to mind/);

  const wrongSkill = atom({
    atomId: 'atom-skill-001',
    kind: 'skill',
    canonicalOwner: 'mind',
    canonicalRef: 'knowledge/skills.md',
    authority: 'approved-operational'
  });
  assert.match(validateAtomAuthority(wrongSkill, registry).join('\n'), /must belong to brain/);
});

test('freshness evaluator handles due, stale, superseded, contradicted, and unknown states deterministically', () => {
  const now = new Date('2026-08-15T12:00:00Z');
  assert.equal(evaluateFreshness(atom({ reviewAfter: '2026-08-16T00:00:00Z' }), now), 'fresh');
  assert.equal(evaluateFreshness(atom({ reviewAfter: '2026-08-15T11:00:00Z' }), now), 'review_due');
  assert.equal(evaluateFreshness(atom({ validTo: '2026-08-15T11:00:00Z', reviewAfter: null }), now), 'stale');
  assert.equal(evaluateFreshness(atom({ supersededBy: ['atom-preference-002'] }), now), 'superseded');
  assert.equal(evaluateFreshness(atom({ contradicts: ['atom-preference-002'] }), now), 'contradicted');
  assert.equal(evaluateFreshness(atom({ freshnessClass: 'unknown', reviewAfter: null }), now), 'unknown');
});

test('retention invariants and schema reject unbounded non-canonical storage', () => {
  assert.deepEqual(validateRetentionInvariants(retention), []);

  const unsafe = structuredClone(retention);
  unsafe.storageClasses.push({
    classId: 'unsafe-derived-store',
    canonical: false,
    rebuildable: true,
    retentionMode: 'referenced',
    compactionStrategy: 'dedupe',
    boundedGrowthRequired: true,
    notes: 'Deliberately missing any size, item, TTL, lifecycle, source, or rebuild bound.'
  });
  assert.match(validateRetentionInvariants(unsafe).join('\n'), /no explicit or lifecycle bound/);
});

test('shared-memory inventory is deterministic, aggregate-only, and performs zero mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'clr-memory-inventory-'));
  try {
    fs.writeFileSync(path.join(root, 'MEMORY.md'), '# Memory Index\n');
    fs.writeFileSync(path.join(root, 'user_preferences_001.md'), '---\nid: mem-user-001\ntype: user\n---\nprivate content\n');
    fs.writeFileSync(path.join(root, 'feedback_git_001.md'), '---\nid: mem-feedback-001\ntype: feedback\n---\nprivate content\n');
    fs.writeFileSync(path.join(root, 'facts.jsonl'), '{"id":"fact-001","valid_to":null,"object":"private"}\n');

    const first = inventorySharedMemory(root);
    const second = inventorySharedMemory(root);

    assert.equal(first.mode, 'REPORT_ONLY');
    assert.equal(first.writesAttempted, 0);
    assert.equal(first.rawContentIncluded, false);
    assert.equal(first.filenamesIncluded, false);
    assert.equal(first.mutated, false);
    assert.equal(second.mutated, false);
    assert.equal(first.inventoryDigest, second.inventoryDigest);
    assert.equal(first.sourceFingerprintBefore, first.sourceFingerprintAfter);
    assert.equal(first.classCounts['mind-candidate'], 1);
    assert.equal(first.classCounts['brain-candidate'], 1);
    assert.equal(first.classCounts['derived-hot-recall'], 1);
    assert.equal(first.facts.total, 1);
    assert.equal(first.facts.active, 1);

    const serialized = JSON.stringify(first);
    assert.equal(serialized.includes('private content'), false);
    assert.equal(serialized.includes('user_preferences_001.md'), false);
    assert.equal(serialized.includes('feedback_git_001.md'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
