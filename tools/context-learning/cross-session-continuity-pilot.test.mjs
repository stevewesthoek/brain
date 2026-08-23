import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCrossSessionContinuity } from './cross-session-continuity-pilot.mjs';

const base = { session_id: 'source-session', environment: 'claude', repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: 'revision-1', objective: 'Continue the bounded Brain task.', completed_work: ['Entry contract validated.'], pending_work: ['Review continuation context.'], blockers: [], decisions: ['No automatic takeover.'], changed_files: ['operations/specs/context-learning/session-continuity-policy.md'], validation_evidence: ['report:continuity-001'], handoff: { continuation_point: 'Begin Codex review.', next_action: 'Load the cited context only.' }, freshness: { state: 'fresh', source_revision: 'session-source-1' }, conflicts: [] };
const target = { environment: 'codex', repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: 'revision-1' };
const repo = { repository: 'brain', worktree: 'brain-main', branch: 'main', head_revision: 'revision-1' };

test('projects bounded Claude-to-Codex continuation with usefulness metrics', () => {
  const result = buildCrossSessionContinuity({ source: base, target, repositoryState: repo });
  assert.equal(result.status, 'READY_READ_ONLY');
  assert.equal(result.source_session.environment, 'claude');
  assert.equal(result.target_session.environment, 'codex');
  assert.equal(result.continuation.confirmation_required, true);
  assert.equal(result.metrics.missing_information_count, 0);
  assert.ok(result.metrics.context_bytes > 0);
  assert.equal(result.safety.transcripts_ingested, 0);
  assert.equal(result.safety.writes_performed, 0);
});

test('stale, superseded, mismatched, and incomplete sources fail closed', () => {
  assert.equal(buildCrossSessionContinuity({ source: { ...base, freshness: { state: 'stale' } }, target, repositoryState: repo }).reason, 'source_session_not_fresh');
  assert.equal(buildCrossSessionContinuity({ source: { ...base, superseded: true }, target, repositoryState: repo }).reason, 'source_session_superseded');
  assert.equal(buildCrossSessionContinuity({ source: { ...base, brain_revision: 'old' }, target, repositoryState: repo }).reason, 'source_revision_stale');
  assert.equal(buildCrossSessionContinuity({ source: { ...base, validation_evidence: [] }, target, repositoryState: repo }).reason, 'incomplete_validation_evidence');
});

test('conflicting repository binding and disable path are safe', () => {
  const conflict = buildCrossSessionContinuity({ source: base, target: { ...target, branch: 'feature/other' }, repositoryState: repo });
  const disabled = buildCrossSessionContinuity({ source: base, target, repositoryState: repo, enabled: false });
  assert.equal(conflict.status, 'BLOCKED');
  assert.equal(disabled.status, 'DISABLED');
  assert.equal(disabled.safety.sessions_merged, 0);
});
