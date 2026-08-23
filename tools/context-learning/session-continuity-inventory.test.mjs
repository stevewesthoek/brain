import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadJson, validateJsonSchema } from './context-learning-core.mjs';
import { inventorySessionContinuity } from './session-continuity-inventory.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const schema = loadJson(path.join(repoRoot, 'operations/specs/context-learning/session-continuity.v1.schema.json'));
const now = new Date('2026-08-23T12:00:00Z');

function gitSnapshot(root, overrides = {}) {
  return {
    repository: 'brain',
    worktree: root,
    branch: 'main',
    head: 'a'.repeat(40),
    dirty_paths: [],
    ...overrides
  };
}

function validRecord(root, overrides = {}) {
  return {
    schema_version: '1.0.0',
    session_id: 'session-phase1-001',
    initiative_id: 'mru0',
    repository: 'brain',
    worktree: root,
    branch: 'main',
    base_revision: 'a'.repeat(40),
    brain_revision: 'a'.repeat(40),
    timestamps: {
      created_at: '2026-08-23T10:00:00Z',
      updated_at: '2026-08-23T11:00:00Z',
      last_handoff_at: '2026-08-23T11:00:00Z'
    },
    environment_history: [
      { environment_id: 'claude', entered_at: '2026-08-23T10:00:00Z', exited_at: '2026-08-23T11:00:00Z', role: 'orchestration' }
    ],
    objective: {
      goal: 'Validate session continuity foundation.',
      active_initiative: 'mru0',
      current_packet: 'mru0-p2.5-phase1',
      scope: ['read-only inventory'],
      completion_state: 'paused'
    },
    state: {
      completed_work: [{ summary: 'Contract exists.', references: ['operations/specs/context-learning/session-continuity.v1.schema.json'] }],
      pending_work: [{ summary: 'Run inventory tests.', references: ['tools/context-learning/session-continuity-inventory.test.mjs'] }],
      blockers: [],
      decisions: [{ summary: 'No automatic resume.', status: 'approved', references: ['operations/specs/context-learning/session-continuity-policy.md'] }],
      assumptions: [],
      rejected_paths: []
    },
    artifacts: {
      changed_files: [{ path: 'session-state.md', change: 'modified' }],
      commits: [{ revision: 'a'.repeat(40), message: 'checkpoint', references: [] }],
      validations: [{ name: 'session contract', result: 'passed', observed_at: '2026-08-23T11:30:00Z', references: ['operations/specs/context-learning/session-continuity.v1.schema.json'] }],
      reports: [{ path: 'report.md', kind: 'validation' }],
      acceptance_evidence: []
    },
    handoff: {
      previous_environment: 'claude',
      current_environment: 'claude',
      next_environment: 'codex',
      continuation_point: 'Continue with the read-only inventory.',
      next_action: 'Run the focused session continuity tests.',
      confirmation_required: true
    },
    freshness: {
      source_revision: 'b'.repeat(64),
      repository_revision: 'a'.repeat(40),
      state: 'fresh',
      confidence: 1,
      supersedes: [],
      conflicts: []
    },
    ...overrides
  };
}

function setupRoot(records = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-continuity-'));
  fs.mkdirSync(path.join(root, '.ai', 'handoffs'), { recursive: true });
  fs.mkdirSync(path.join(root, 'operations', 'specs', 'context-learning'), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, 'operations/specs/context-learning/session-continuity.v1.schema.json'), path.join(root, 'operations/specs/context-learning/session-continuity.v1.schema.json'));
  fs.writeFileSync(path.join(root, 'session-state.md'), '# session\n');
  fs.writeFileSync(path.join(root, 'report.md'), '# report\n');
  fs.writeFileSync(path.join(root, '.ai', 'current.md'), '# Current Handoff\n\n## Repo\nbrain (main)\n\n## Goal\nSee transcript\n');
  records.forEach((record, index) => fs.writeFileSync(path.join(root, '.ai', 'handoffs', `session-${index}.json`), `${JSON.stringify(record, null, 2)}\n`));
  return root;
}

test('inventory identifies current and archived candidates without selecting a resume target', () => {
  const root = setupRoot([validRecord('ROOT_PLACEHOLDER')]);
  try {
    const recordPath = path.join(root, '.ai', 'handoffs', 'session-0.json');
    const record = validRecord(root);
    fs.writeFileSync(recordPath, `${JSON.stringify(record, null, 2)}\n`);
    const report = inventorySessionContinuity({ repoRoot: root, now, gitSnapshot: gitSnapshot(root), schema });
    assert.equal(report.mode, 'READ_ONLY_INVENTORY');
    assert.equal(report.candidates.length, 2);
    assert.equal(report.selection.status, 'single_candidate');
    assert.equal(report.selection.resume_allowed, false);
    assert.ok(report.candidates.some((candidate) => candidate.source_kind === 'current_handoff' && !candidate.valid));
    assert.ok(report.candidates.some((candidate) => candidate.source_kind === 'archived_handoff' && candidate.valid));
    assert.deepEqual(validateJsonSchema(schema, record, schema), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('stale, mismatched, missing-reference, and failed-validation states fail closed', () => {
  const root = setupRoot();
  try {
    const record = validRecord(root, {
      branch: 'feature/old',
      base_revision: 'b'.repeat(40),
      brain_revision: 'b'.repeat(40),
      freshness: { source_revision: 'c'.repeat(64), repository_revision: 'b'.repeat(40), state: 'stale', confidence: 0.5, supersedes: [], conflicts: [] },
      artifacts: {
        ...validRecord(root).artifacts,
        changed_files: [{ path: 'missing.md', change: 'modified' }],
        validations: [{ name: 'old check', result: 'failed', observed_at: '2026-08-23T09:00:00Z', references: ['missing-report.md'] }]
      }
    });
    fs.writeFileSync(path.join(root, '.ai', 'handoffs', 'stale.json'), `${JSON.stringify(record, null, 2)}\n`);
    const report = inventorySessionContinuity({ repoRoot: root, now, gitSnapshot: gitSnapshot(root), schema });
    const candidate = report.candidates.find((item) => item.source_path.endsWith('stale.json'));
    assert.ok(candidate);
    assert.equal(candidate.valid, false);
    const codes = new Set(candidate.issues.map((item) => item.code));
    assert.ok(codes.has('branch_mismatch'));
    assert.ok(codes.has('base_revision_stale'));
    assert.ok(codes.has('freshness_not_fresh'));
    assert.ok(codes.has('missing_reference'));
    assert.ok(codes.has('validation_not_passed'));
    assert.equal(report.selection.resume_allowed, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('concurrent valid sessions produce an explicit conflict and no selection', () => {
  const root = setupRoot();
  try {
    const first = validRecord(root, { session_id: 'session-one' });
    const second = validRecord(root, { session_id: 'session-two', artifacts: { ...first.artifacts, changed_files: [{ path: 'other.md', change: 'modified' }] } });
    fs.writeFileSync(path.join(root, 'other.md'), '# other\n');
    fs.writeFileSync(path.join(root, '.ai', 'handoffs', 'one.json'), `${JSON.stringify(first, null, 2)}\n`);
    fs.writeFileSync(path.join(root, '.ai', 'handoffs', 'two.json'), `${JSON.stringify(second, null, 2)}\n`);
    const report = inventorySessionContinuity({ repoRoot: root, now, gitSnapshot: gitSnapshot(root), schema });
    assert.equal(report.conflicts.length, 1);
    assert.equal(report.conflicts[0].type, 'concurrent_active_sessions');
    assert.equal(report.selection.status, 'ambiguous');
    assert.equal(report.selection.resume_allowed, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('inventory is deterministic, preserves sources, and does not ingest conversation content', () => {
  const root = setupRoot([validRecord('ROOT_PLACEHOLDER')]);
  try {
    const recordPath = path.join(root, '.ai', 'handoffs', 'session-0.json');
    fs.writeFileSync(recordPath, `${JSON.stringify(validRecord(root), null, 2)}\n`);
    const before = fs.readFileSync(recordPath, 'utf8');
    const first = inventorySessionContinuity({ repoRoot: root, now, gitSnapshot: gitSnapshot(root), schema });
    const second = inventorySessionContinuity({ repoRoot: root, now, gitSnapshot: gitSnapshot(root), schema });
    assert.deepEqual(first, second);
    assert.equal(fs.readFileSync(recordPath, 'utf8'), before);
    assert.equal(JSON.stringify(first).includes('raw conversation'), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
