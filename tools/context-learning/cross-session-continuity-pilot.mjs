import { stableJsonHash } from './context-learning-core.mjs';

const BLOCKING = new Set(['stale', 'superseded', 'contradicted', 'unknown']);
function blocked(reason, details = []) { return { mode: 'READ_ONLY_CROSS_SESSION_CONTINUITY', status: 'BLOCKED', fail_closed: true, reason, details, safety: { writes_performed: 0, providers_called: 0, sessions_merged: 0, sessions_closed: 0, transcripts_ingested: 0 } }; }
function list(values) { return Array.isArray(values) ? values.slice(0, 10) : []; }

export function buildCrossSessionContinuity({ source = null, target = null, repositoryState = null, enabled = true } = {}) {
  if (!enabled) return { mode: 'READ_ONLY_CROSS_SESSION_CONTINUITY', status: 'DISABLED', rollback: { disabled: true, action: 'no continuation projection performed' }, safety: { writes_performed: 0, providers_called: 0, sessions_merged: 0, sessions_closed: 0, transcripts_ingested: 0 } };
  if (!source || !target || !repositoryState) return blocked('continuity_inputs_required');
  if (!source.session_id || !source.environment || !source.objective || !source.handoff) return blocked('source_session_incomplete');
  if (!target.environment || !target.repository || !target.worktree || !target.branch) return blocked('target_session_incomplete');
  if (source.freshness && BLOCKING.has(source.freshness.state)) return blocked('source_session_not_fresh', [source.freshness.state]);
  if (source.superseded === true) return blocked('source_session_superseded');
  if (source.conflicts?.length) return blocked('source_session_conflict', list(source.conflicts));
  if (repositoryState.repository !== target.repository || repositoryState.worktree !== target.worktree || repositoryState.branch !== target.branch) return blocked('repository_binding_mismatch');
  if (source.repository !== target.repository || source.worktree !== target.worktree || source.branch !== target.branch) return blocked('cross_session_repository_mismatch');
  if (source.brain_revision !== repositoryState.head_revision) return blocked('source_revision_stale');
  if (target.brain_revision && target.brain_revision !== repositoryState.head_revision) return blocked('target_revision_mismatch');
  if (!source.validation_evidence?.length) return blocked('incomplete_validation_evidence');
  const continuation = {
    objective: source.objective,
    completed_work: list(source.completed_work),
    pending_work: list(source.pending_work),
    blockers: list(source.blockers),
    decisions: list(source.decisions),
    changed_files: list(source.changed_files),
    validation_evidence: list(source.validation_evidence),
    continuation_point: source.handoff.continuation_point,
    next_action: source.handoff.next_action,
    freshness: source.freshness ?? { state: 'fresh' },
    source_environment: source.environment,
    target_environment: target.environment,
    confirmation_required: true
  };
  return {
    mode: 'READ_ONLY_CROSS_SESSION_CONTINUITY',
    status: 'READY_READ_ONLY',
    continuity_id: `continuity-${stableJsonHash({ source: source.session_id, target: target.environment, revision: repositoryState.head_revision }).slice(0, 24)}`,
    source_session: { session_id: source.session_id, environment: source.environment },
    target_session: { environment: target.environment, repository: target.repository, worktree: target.worktree, branch: target.branch, brain_revision: repositoryState.head_revision },
    continuation,
    metrics: { context_bytes: JSON.stringify(continuation).length, relevant_reference_count: continuation.changed_files.length + continuation.validation_evidence.length, missing_information_count: 0, ambiguity_count: 0, conflict_count: 0 },
    rollback: { state: 'AVAILABLE', action: 'disable projection; no source or target session state is changed' },
    safety: { writes_performed: 0, providers_called: 0, sessions_merged: 0, sessions_closed: 0, transcripts_ingested: 0, authority_changed: false }
  };
}
