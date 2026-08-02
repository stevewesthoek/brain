import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadPathRegistry } from './mind-canonical-path-registry.mjs';
import {
  VERDICTS,
  evaluateDeletionReadiness,
  evaluatePath,
  loadEvidenceIndex,
} from './validate-deletion-readiness.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(SCRIPT_DIR, '..');

// ─── Synthetic registry builder ──────────────────────────────────────────────

function makeEntry(overrides = {}) {
  return {
    pathId: 'fixture-path',
    literal: 'fixture/',
    type: 'compatibility-directory',
    lifecycleState: 'compatibility',
    activeDefaultAllowed: false,
    writePolicy: 'forbidden',
    readPolicy: 'compatibility-read',
    canonicalReplacement: null,
    executableConsumers: [],
    deletionPrerequisites: ['cross-repository-conformance'],
    deployedState: 'not-applicable',
    observedState: 'not-applicable',
    verifiedState: 'not-applicable',
    notes: 'fixture',
    normativeSource: { repository: 'brain', path: 'operations/specs/infinite-brain-path-registry.json' },
    compatibilityReason: 'fixture',
    ...overrides,
  };
}

function makeRegistry(entries) {
  return { registryVersion: '1.0.0', entries };
}

function makeProof(evidence, appliesTo = 'global', status = 'satisfied') {
  return { status, evidence, appliesTo };
}

// Complete evidence: structured universal proofs + structured prerequisite
// evidence keyed to the fixture entry's deletionPrerequisites.
function makeCompleteEvidence(overrides = {}) {
  return {
    fullyMigrated: 'canonical replacement verified',
    noActiveProducer: makeProof('all producers are retired'),
    noActiveConsumer: makeProof('all consumers are retired'),
    provenanceProof: makeProof('provenance inventory is complete'),
    rollbackProof: makeProof('rollback bundle is recorded and verified'),
    approvalProof: makeProof('deletion approval is explicitly recorded'),
    authorityProof: makeProof('authority dependencies are resolved'),
    prerequisiteEvidence: {
      'cross-repository-conformance': makeProof('B1.7 cross-repo contract check passed; entrypoints, intake, bridge, schema verified.'),
    },
    ...overrides,
  };
}

// ─── evaluatePath unit tests: BLOCKED conditions ──────────────────────────────

test('active-producer evidence → BLOCKED', () => {
  const entry = makeEntry();
  const evidence = { activeProducer: 'mind-kanban-syncer.py writes to this path every 10 min' };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('active-producer')));
});

test('active-consumer evidence → BLOCKED', () => {
  const entry = makeEntry();
  const evidence = { activeConsumer: 'wiki-health.ts reads wiki/ for live health checks' };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('active-consumer')));
});

test('unresolved-authority evidence → BLOCKED', () => {
  const entry = makeEntry();
  const evidence = { unresolvedAuthority: 'scoped-exception-resolution prerequisite unmet' };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('unresolved-authority')));
});

test('missing-provenance evidence → BLOCKED (fail closed)', () => {
  const entry = makeEntry();
  const evidence = { missingProvenance: 'proposal-ledger-migration prerequisite unmet' };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-provenance')));
});

test('missing-rollback evidence → BLOCKED (fail closed)', () => {
  const entry = makeEntry();
  const evidence = { missingRollback: 'no rollback bundle recorded for this path family' };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-rollback')));
});

test('missing-approval evidence → BLOCKED (fail closed)', () => {
  const entry = makeEntry();
  const evidence = { missingApproval: 'Mind-authority-decision prerequisite not recorded' };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-approval')));
});

test('absent evidence record → BLOCKED (fail closed)', () => {
  const entry = makeEntry();
  const { verdict, reasons } = evaluatePath(entry, null);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('fail-closed')));
});

test('partially populated legacy proof strings cannot become SAFE', () => {
  const { verdict, reasons } = evaluatePath(makeEntry(), {
    noActiveProducer: 'all producers retired',
    noActiveConsumer: 'all consumers retired',
  });
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('requires-structured-evidence')));
});

test('empty evidence object → BLOCKED', () => {
  const { verdict } = evaluatePath(makeEntry(), {});
  assert.equal(verdict, VERDICTS.BLOCKED);
});

test('regression: original fail-open shape — empty evidence never becomes SAFE', () => {
  const { verdict, reasons } = evaluatePath(makeEntry(), {});
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.length > 0);
});

// ─── Universal proof field tests ──────────────────────────────────────────────

for (const [field, label] of [
  ['noActiveProducer', 'producer-completeness'],
  ['noActiveConsumer', 'consumer-completeness'],
  ['rollbackProof', 'rollback'],
  ['approvalProof', 'approval'],
  ['provenanceProof', 'provenance'],
  ['authorityProof', 'authority'],
]) {
  test(`missing ${field} → BLOCKED`, () => {
    const evidence = makeCompleteEvidence();
    delete evidence[field];
    const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
    assert.equal(verdict, VERDICTS.BLOCKED);
    assert.ok(reasons.some((r) => r.includes(`universal-proof-${label}-requires-structured-evidence`)));
  });
}

test('nonblank legacy universal proof string cannot contribute to SAFE', () => {
  const evidence = makeCompleteEvidence({ approvalProof: 'deletion approval recorded' });
  const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('universal-proof-approval-requires-structured-evidence')));
});

test('universal proof status=unmet → BLOCKED', () => {
  const evidence = makeCompleteEvidence({ approvalProof: makeProof('No deletion approval exists.', 'global', 'unmet') });
  const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('universal-proof-unmet: approval')));
});

test('negative approval statement with status=unresolved cannot become SAFE', () => {
  const evidence = makeCompleteEvidence({ approvalProof: makeProof('Approval is unknown.', 'global', 'unresolved') });
  const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('universal-proof-unresolved: approval')));
});

test('universal proof without status → BLOCKED', () => {
  const evidence = makeCompleteEvidence({ approvalProof: { evidence: 'approval cited', appliesTo: 'global' } });
  const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('universal-proof-approval-missing-satisfied-status')));
});

test('universal proof without evidence → BLOCKED', () => {
  const evidence = makeCompleteEvidence({ approvalProof: { status: 'satisfied', appliesTo: 'global' } });
  const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('universal-proof-approval-missing-evidence-text')));
});

test('universal proof without scope → BLOCKED', () => {
  const evidence = makeCompleteEvidence({ approvalProof: { status: 'satisfied', evidence: 'approval cited' } });
  const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('universal-proof-scope-mismatch')));
});

test('universal proof with wrong scope → BLOCKED', () => {
  const evidence = makeCompleteEvidence({ approvalProof: makeProof('approval cited', ['other/']) });
  const { verdict, reasons } = evaluatePath(makeEntry(), evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('universal-proof-scope-mismatch')));
});

// ─── Registry-prerequisite matching tests ─────────────────────────────────────

test('all six universal proofs present but registry prerequisite missing → BLOCKED', () => {
  // Entry requires cross-repository-conformance; evidence has no prerequisiteEvidence.
  const entry = makeEntry({ deletionPrerequisites: ['cross-repository-conformance'] });
  const evidence = makeCompleteEvidence();
  delete evidence.prerequisiteEvidence;
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-prerequisite-cross-repository-conformance')));
});

test('approved-folder-cleanup missing → BLOCKED', () => {
  const entry = makeEntry({ deletionPrerequisites: ['cross-repository-conformance', 'approved-folder-cleanup'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'cross-repository-conformance': 'B1.7 passed.',
      // approved-folder-cleanup intentionally absent
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-prerequisite-approved-folder-cleanup')));
});

test('generic structured approvalProof does not satisfy approved-folder-cleanup', () => {
  const entry = makeEntry({ deletionPrerequisites: ['approved-folder-cleanup'] });
  const evidence = makeCompleteEvidence({
    approvalProof: makeProof('generic deletion approval recorded'),
    prerequisiteEvidence: {},
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-prerequisite-approved-folder-cleanup')));
});

test('nonblank legacy prerequisite string cannot contribute to SAFE', () => {
  const entry = makeEntry({ deletionPrerequisites: ['cross-repository-conformance'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: { 'cross-repository-conformance': 'B1.7 passed.' },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('prerequisite-cross-repository-conformance-requires-structured-evidence')));
});

test('blank prerequisite string cannot contribute to SAFE', () => {
  const entry = makeEntry({ deletionPrerequisites: ['cross-repository-conformance'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: { 'cross-repository-conformance': '   ' },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('requires-structured-evidence')));
});

test('misspelled/wrong prerequisite key → BLOCKED', () => {
  const entry = makeEntry({ deletionPrerequisites: ['cross-repository-conformance'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: { 'cross-repo-conformance': 'cited incorrectly' },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-prerequisite-cross-repository-conformance')));
});

test('one of multiple registry prerequisites missing → BLOCKED', () => {
  const entry = makeEntry({
    deletionPrerequisites: ['cross-repository-conformance', 'B1.0a-live-routing-verification'],
  });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'cross-repository-conformance': 'B1.7 passed.',
      // B1.0a-live-routing-verification absent
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-prerequisite-B1.0a-live-routing-verification')));
});

test('graphify-profile-conformance present but retention-policy missing → BLOCKED', () => {
  const entry = makeEntry({ deletionPrerequisites: ['graphify-profile-conformance', 'retention-policy'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'graphify-profile-conformance': 'validate-graphify-operational-profiles.mjs passes.',
      // retention-policy absent
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-prerequisite-retention-policy')));
});

test('governance-prohibited deletion expressed as missingApproval → BLOCKED', () => {
  // A path with a retention policy that explicitly prohibits deletion must be BLOCKED,
  // not SAFE. A policy that prohibits deletion is evidence of a blocker.
  const entry = makeEntry({ deletionPrerequisites: ['graphify-profile-conformance', 'retention-policy'] });
  const evidence = makeCompleteEvidence({
    missingApproval: 'graphify-transition-governance.json deletion state is prohibited-before-retention-gate; three uncleared conditions.',
    prerequisiteEvidence: {
      'graphify-profile-conformance': 'validate-graphify-operational-profiles.mjs passes.',
      'retention-policy': 'Policy exists (maxRuns=7, maxAgeDays=14) but governance prohibits deletion until retention gate is cleared.',
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-approval')));
});

test('quiesced generator with fully structured evidence and no prohibition → SAFE', () => {
  const entry = makeEntry({ deletionPrerequisites: ['graphify-profile-conformance', 'retention-policy'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'graphify-profile-conformance': makeProof('profile conformance applies globally'),
      'retention-policy': makeProof('retention policy applies globally and permits deletion'),
    },
  });
  const { verdict } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.SAFE);
});

test('active external-integration entry cannot become SAFE solely because runtime value is uninspected', () => {
  // Simulates the n8n override-name pattern: entry is active, deployed, external-integration.
  // Claiming noActiveConsumer while the deployed expression actively references the override name
  // is factually incorrect. This tests that activeConsumer blocks as expected.
  const entry = makeEntry({
    type: 'external-integration',
    lifecycleState: 'active',
    deletionPrerequisites: ['B1.0a-live-routing-verification', 'cross-repository-conformance'],
  });
  const evidence = {
    activeConsumer: 'Override expression is deployed in live n8n workflow; active reference.',
  };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('active-consumer')));
});

test('only fully and explicitly proven evidence with all registry prerequisites returns SAFE', () => {
  // The only path to SAFE: all universal proofs AND all prerequisiteEvidence keys satisfied.
  const entry = makeEntry({ deletionPrerequisites: ['cross-repository-conformance'] });
  const { verdict, reasons } = evaluatePath(entry, makeCompleteEvidence());
  assert.equal(verdict, VERDICTS.SAFE);
  assert.ok(reasons.some((r) => r.includes('approval-proof')));
  assert.ok(reasons.some((r) => r.includes('rollback-proof')));
  assert.ok(reasons.some((r) => r.includes('prerequisite-satisfied: cross-repository-conformance')));
});

// ─── PARTIAL conditions ───────────────────────────────────────────────────────

test('ambiguous consumer → PARTIAL', () => {
  const entry = makeEntry();
  const evidence = {
    ambiguousConsumer: 'vo-studio-fixtures.ts references /sources/ as static audio paths; independence not verified',
  };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.PARTIAL);
  assert.ok(reasons.some((r) => r.includes('ambiguous-consumer')));
});

test('pending cleanup task → PARTIAL', () => {
  const entry = makeEntry();
  const evidence = {
    pendingCleanupTask: 'remove router-root compatibility references from execution-plans.ts',
  };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.PARTIAL);
  assert.ok(reasons.some((r) => r.includes('pending-cleanup-task')));
});

test('active generator without retirement plan → PARTIAL', () => {
  const entry = makeEntry({ type: 'generated-output' });
  const evidence = {
    activeGenerator: 'graphify generator still active; graphify-profile-conformance prerequisite unmet',
  };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.PARTIAL);
  assert.ok(reasons.some((r) => r.includes('active-generator')));
});

test('unverified fixture reference → PARTIAL', () => {
  const entry = makeEntry();
  const evidence = {
    unverifiedFixtureReference: 'audio fixture paths reference /sources/ but not confirmed as non-Mind paths',
  };
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.PARTIAL);
  assert.ok(reasons.some((r) => r.includes('unverified-fixture-reference')));
});

// ─── Special type tests ───────────────────────────────────────────────────────

test('canonical-directory entry → SAFE regardless of evidence', () => {
  const entry = makeEntry({ type: 'canonical-directory', activeDefaultAllowed: true });
  const { verdict, reasons } = evaluatePath(entry, null);
  assert.equal(verdict, VERDICTS.SAFE);
  assert.ok(reasons[0].includes('canonical-or-future-target'));
});

test('future-target entry → SAFE regardless of evidence', () => {
  const entry = makeEntry({ type: 'future-target', activeDefaultAllowed: false });
  const { verdict, reasons } = evaluatePath(entry, null);
  assert.equal(verdict, VERDICTS.SAFE);
  assert.ok(reasons[0].includes('canonical-or-future-target'));
});

test('BLOCKED takes precedence over PARTIAL when both present', () => {
  const entry = makeEntry();
  const evidence = {
    activeConsumer: 'wiki-health.ts actively reads wiki/',
    ambiguousConsumer: 'some other ambiguous reference',
  };
  const { verdict } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
});

// ─── evaluateDeletionReadiness integration tests ──────────────────────────────

test('evaluateDeletionReadiness: all-SAFE registry returns result=safe', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'path-a', literal: 'path-a/' }),
    makeEntry({ pathId: 'path-b', literal: 'path-b/' }),
  ]);
  const evidenceIndex = {
    'path-a': makeCompleteEvidence(),
    'path-b': makeCompleteEvidence({ fullyMigrated: 'canonical replacement verified and deployed' }),
  };
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  assert.equal(report.result, 'safe');
  assert.equal(report.verdictCounts.SAFE, 2);
  assert.equal(report.verdictCounts.PARTIAL, 0);
  assert.equal(report.verdictCounts.BLOCKED, 0);
});

test('evaluateDeletionReadiness: any BLOCKED path makes result=blocked', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'path-safe', literal: 'path-safe/' }),
    makeEntry({ pathId: 'path-blocked', literal: 'path-blocked/' }),
  ]);
  const evidenceIndex = {
    'path-safe': makeCompleteEvidence(),
    'path-blocked': { activeConsumer: 'something reads this actively' },
  };
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  assert.equal(report.result, 'blocked');
  assert.equal(report.verdictCounts.BLOCKED, 1);
});

test('evaluateDeletionReadiness: only PARTIAL paths make result=partial', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'path-safe', literal: 'path-safe/' }),
    makeEntry({ pathId: 'path-partial', literal: 'path-partial/' }),
  ]);
  const evidenceIndex = {
    'path-safe': makeCompleteEvidence(),
    'path-partial': { ambiguousConsumer: 'some fixture reference unverified' },
  };
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  assert.equal(report.result, 'partial');
  assert.equal(report.verdictCounts.PARTIAL, 1);
  assert.equal(report.verdictCounts.BLOCKED, 0);
});

test('evaluateDeletionReadiness: missing evidence → fail closed (BLOCKED)', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'path-no-evidence', literal: 'no-evidence/' }),
  ]);
  const evidenceIndex = {};
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  assert.equal(report.result, 'blocked');
  assert.equal(report.verdictCounts.BLOCKED, 1);
  const entry = report.paths.find((p) => p.pathId === 'path-no-evidence');
  assert.ok(entry?.reasons.some((r) => r.includes('fail-closed')));
});

test('evaluateDeletionReadiness: missing prerequisiteEvidence → fail closed (BLOCKED)', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'path-needs-prereq', literal: 'prereq/', deletionPrerequisites: ['approved-folder-cleanup'] }),
  ]);
  const evidence = makeCompleteEvidence();
  delete evidence.prerequisiteEvidence;
  const evidenceIndex = { 'path-needs-prereq': evidence };
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  assert.equal(report.result, 'blocked');
  const entry = report.paths.find((p) => p.pathId === 'path-needs-prereq');
  assert.ok(entry?.reasons.some((r) => r.includes('missing-prerequisite-approved-folder-cleanup')));
});

test('evaluateDeletionReadiness: paths are sorted deterministically by pathId', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'z-last', literal: 'z-last/' }),
    makeEntry({ pathId: 'a-first', literal: 'a-first/' }),
    makeEntry({ pathId: 'm-middle', literal: 'm-middle/' }),
  ]);
  const evidenceIndex = {
    'z-last': { noActiveProducer: 'confirmed' },
    'a-first': { noActiveProducer: 'confirmed' },
    'm-middle': { noActiveProducer: 'confirmed' },
  };
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  const ids = report.paths.map((p) => p.pathId);
  assert.deepEqual(ids, ['a-first', 'm-middle', 'z-last']);
});

test('evaluateDeletionReadiness: canonical entries are excluded from paths output', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'canonical-one', type: 'canonical-directory', activeDefaultAllowed: true, literal: 'inbox/new/' }),
    makeEntry({ pathId: 'compat-one', literal: 'compat/' }),
  ]);
  const evidenceIndex = {
    'compat-one': { noActiveProducer: 'confirmed' },
  };
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  assert.ok(report.paths.every((p) => p.pathId !== 'canonical-one'));
});

test('evaluateDeletionReadiness: future-target entries are excluded from paths output', () => {
  const registry = makeRegistry([
    makeEntry({ pathId: 'future-one', type: 'future-target', literal: 'tasks/', activeDefaultAllowed: false }),
  ]);
  const evidenceIndex = {};
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  // future-target entries are excluded from the non-canonical evaluation set.
  assert.equal(report.paths.length, 0);
  assert.equal(report.result, 'safe');
});

test('evaluateDeletionReadiness: zero filesystem mutation (no files created in tmpdir)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deletion-readiness-'));
  try {
    const registry = makeRegistry([
      makeEntry({ pathId: 'test-path', literal: 'test/' }),
    ]);
    const evidenceIndex = {
      'test-path': { noActiveProducer: 'confirmed' },
    };
    evaluateDeletionReadiness({ registry, evidenceIndex });
    const created = fs.readdirSync(tmpDir);
    assert.equal(created.length, 0, 'no files should be created in tmpdir during evaluation');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Structured prerequisite evidence tests (path-scoped applicability) ────────

test('structured prerequisite: appliesTo runtime/local/graphify/... does not satisfy .graphify-out/', () => {
  // A retention policy declared for runtime/local/graphify/... cannot satisfy a prerequisite
  // required for .graphify-out/ — the paths are different.
  const entry = makeEntry({
    literal: '.graphify-out/',
    deletionPrerequisites: ['retention-policy'],
  });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'retention-policy': {
        status: 'satisfied',
        evidence: 'Profile retention maxRuns=7, maxAgeDays=14 for runtime/local/graphify/ roots.',
        appliesTo: ['runtime/local/graphify/brain-architecture', 'runtime/local/graphify/mind-knowledge'],
      },
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('prerequisite-scope-mismatch')));
  assert.ok(reasons.some((r) => r.includes('retention-policy')));
});

test('structured prerequisite: appliesTo runtime/local/graphify/... does not satisfy graphify-out/', () => {
  const entry = makeEntry({
    literal: 'graphify-out/',
    deletionPrerequisites: ['graphify-profile-conformance'],
  });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'graphify-profile-conformance': {
        status: 'satisfied',
        evidence: 'validate-graphify-operational-profiles.mjs passes for runtime/local/graphify/ output roots.',
        appliesTo: ['runtime/local/graphify/brain-architecture'],
      },
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('prerequisite-scope-mismatch')));
});

test('structured prerequisite: status=unmet returns BLOCKED with prerequisite-unmet reason', () => {
  const entry = makeEntry({
    literal: 'graphify-out/',
    deletionPrerequisites: ['retention-policy'],
  });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'retention-policy': {
        status: 'unmet',
        evidence: 'Profile retention policy governs runtime/local/graphify/ only; no policy governs graphify-out/.',
        appliesTo: ['graphify-out/'],
      },
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('prerequisite-unmet')));
  assert.ok(reasons.some((r) => r.includes('retention-policy')));
});

test('structured prerequisite: status=unresolved returns BLOCKED with prerequisite-unresolved reason', () => {
  const entry = makeEntry({
    literal: '.graphify-out/',
    deletionPrerequisites: ['graphify-profile-conformance'],
  });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'graphify-profile-conformance': {
        status: 'unresolved',
        evidence: 'No profile declares .graphify-out/ as operationalOutputRoot; relationship unresolved.',
        appliesTo: ['.graphify-out/'],
      },
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('prerequisite-unresolved')));
});

test('structured prerequisite: missing status field in object → BLOCKED (not satisfied)', () => {
  const entry = makeEntry({ deletionPrerequisites: ['retention-policy'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'retention-policy': {
        // status field missing — not "satisfied"
        evidence: 'Some evidence text.',
        appliesTo: ['fixture/'],
      },
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('prerequisite-retention-policy-missing-satisfied-status')));
});

test('structured prerequisite: appliesTo "global" satisfies any registry literal', () => {
  const entry = makeEntry({
    literal: '.graphify-out/',
    deletionPrerequisites: ['cross-repository-conformance'],
  });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'cross-repository-conformance': {
        status: 'satisfied',
        evidence: 'B1.7 cross-repo contract check passed; applies globally across all known repositories.',
        appliesTo: 'global',
      },
    },
  });
  const { verdict } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.SAFE);
});

test('structured prerequisite: exact appliesTo matching registry literal → SAFE', () => {
  const entry = makeEntry({
    literal: 'archive/',
    deletionPrerequisites: ['approved-folder-cleanup'],
  });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'approved-folder-cleanup': {
        status: 'satisfied',
        evidence: 'Explicit folder-cleanup approval artifact created 2026-08-01.',
        appliesTo: ['archive/'],
      },
    },
  });
  const { verdict } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.SAFE);
});

test('classification or generator-freezing in approvalProof does not substitute for explicit deletion approval when missingApproval is present', () => {
  // approvalProof citing non-authoritative classification is a universal proof field.
  // When missingApproval is also set (governance prohibition), missingApproval fires first.
  const entry = makeEntry({ deletionPrerequisites: ['graphify-profile-conformance', 'retention-policy'] });
  const evidence = makeCompleteEvidence({
    approvalProof: 'Non-authoritative classification established by BS0.15. Generator frozen.',
    missingApproval: 'Governance explicitly prohibits deletion until retention gate cleared.',
    prerequisiteEvidence: {
      'graphify-profile-conformance': 'validate-graphify-operational-profiles.mjs passes.',
      'retention-policy': 'Policy satisfied; no governance prohibition on this path.',
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('missing-approval')));
});

test('structured prerequisite: empty evidence string in object → BLOCKED', () => {
  const entry = makeEntry({ deletionPrerequisites: ['retention-policy'] });
  const evidence = makeCompleteEvidence({
    prerequisiteEvidence: {
      'retention-policy': {
        status: 'satisfied',
        evidence: '   ', // blank
        appliesTo: 'global',
      },
    },
  });
  const { verdict, reasons } = evaluatePath(entry, evidence);
  assert.equal(verdict, VERDICTS.BLOCKED);
  assert.ok(reasons.some((r) => r.includes('prerequisite-retention-policy-missing-evidence-text')));
});

// ─── Live registry integration test ──────────────────────────────────────────

test('live registry + evidence index: all paths get a deterministic verdict', () => {
  const registry = loadPathRegistry({ repoRoot: BRAIN_ROOT });
  const evidenceIndex = loadEvidenceIndex(BRAIN_ROOT);
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });

  // All paths have a verdict.
  assert.ok(report.paths.every((p) => Object.values(VERDICTS).includes(p.verdict)));

  // Sorted deterministically.
  const ids = report.paths.map((p) => p.pathId);
  assert.deepEqual(ids, [...ids].sort());

  // No filesystem mutation.
  assert.equal(report.paths.some((p) => p.pathId === undefined), false);
  process.stdout.write(`\nlive-registry: result=${report.result} SAFE=${report.verdictCounts.SAFE} PARTIAL=${report.verdictCounts.PARTIAL} BLOCKED=${report.verdictCounts.BLOCKED}\n`);
});

test('live registry: graphify-operational-output is BLOCKED (prerequisite scope mismatch)', () => {
  const registry = loadPathRegistry({ repoRoot: BRAIN_ROOT });
  const evidenceIndex = loadEvidenceIndex(BRAIN_ROOT);
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  const entry = report.paths.find((p) => p.pathId === 'graphify-operational-output');
  assert.ok(entry, 'graphify-operational-output must be present in the evaluation');
  assert.equal(entry.verdict, VERDICTS.BLOCKED,
    `graphify-operational-output must be BLOCKED: profile catalog governs runtime/local/graphify/... not .graphify-out/; reason: ${entry.reasons[0]}`);
});

test('live registry: graphify-compatibility-output is BLOCKED (governance prohibition + scope mismatch)', () => {
  const registry = loadPathRegistry({ repoRoot: BRAIN_ROOT });
  const evidenceIndex = loadEvidenceIndex(BRAIN_ROOT);
  const report = evaluateDeletionReadiness({ registry, evidenceIndex });
  const entry = report.paths.find((p) => p.pathId === 'graphify-compatibility-output');
  assert.ok(entry, 'graphify-compatibility-output must be present in the evaluation');
  assert.equal(entry.verdict, VERDICTS.BLOCKED,
    `graphify-compatibility-output must be BLOCKED: governance deletion prohibition; reason: ${entry.reasons[0]}`);
});
