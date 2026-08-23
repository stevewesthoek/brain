import { prepareCodexActivationReadiness } from './codex-activation-readiness.mjs';

export function runCodexLiveConsumptionPilot({ source = null, session = null, enabled = true, maxItems = 10 } = {}) {
  if (!enabled) return { mode: 'READ_ONLY_CODEX_LIVE_CONSUMPTION_PILOT', client: 'codex', live_consumed: false, disabled: true, rollback: { disabled: true, action: 'stop consumption; no Codex state changed' }, safety: { writes_performed: 0, providers_called: 0, codex_configuration_changed: false } };
  if (!source?.head_revision || !source?.repository || !source?.worktree || !source?.branch) return { mode: 'READ_ONLY_CODEX_LIVE_CONSUMPTION_PILOT', client: 'codex', live_consumed: false, activation_state: 'BLOCKED', fail_closed: true, reason: 'verified_source_identity_required', safety: { writes_performed: 0, providers_called: 0, codex_configuration_changed: false } };
  const readiness = prepareCodexActivationReadiness({ brainRevision: source.head_revision, session, maxItems });
  const pointers = readiness.continuation?.context_pointers ?? {};
  const pointerCount = Object.values(pointers).reduce((count, values) => count + (Array.isArray(values) ? values.length : 0), 0);
  const live = readiness.activation_state === 'READY_NOT_ACTIVATED';
  return {
    mode: 'READ_ONLY_CODEX_LIVE_CONSUMPTION_PILOT',
    client: 'codex',
    live_consumed: live,
    activation_state: live ? 'LIVE_BOUNDED_READ_ONLY' : 'BLOCKED',
    entry_version: readiness.entry_version,
    entry_revision: readiness.entry_revision,
    source: { repository: source.repository, worktree: source.worktree, branch: source.branch, head_revision: source.head_revision, dirty_item_count: source.dirty_item_count ?? 0 },
    metrics: { bootstrap_bytes: JSON.stringify(readiness.continuation ?? {}).length, context_pointer_count: pointerCount, freshness_visible: Array.isArray(readiness.freshness), authority_visible: Boolean(readiness.continuation?.authority?.source), full_repository_loaded: false, transcripts_loaded: false, secrets_loaded: false },
    continuity: { session_id: readiness.continuation?.session_id ?? null, repository_bound: readiness.continuation?.repository === source.repository, worktree_bound: readiness.continuation?.worktree === source.worktree, revision_compatible: readiness.continuation?.brain_revision === source.head_revision, conflicts_visible: readiness.gates.status !== 'blocked' },
    failure_behavior: live ? 'none' : 'fail_closed',
    rollback: { state: 'AVAILABLE', action: 'rerun with enabled=false; restore prior Codex session path; no Codex configuration changed' },
    limitations: ['bounded read-only pilot', 'no automatic resume or merge', 'no transcript ingestion', 'no Codex memory store', 'no provider calls'],
    safety: { writes_performed: 0, providers_called: 0, codex_configuration_changed: false, automatic_resume: false, execution_authority: false, mutation_authority: false }
  };
}
