import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const CLIENTS = new Set(['claude', 'codex', 'workbench', 'future-agent']);
const STALE = new Set(['stale', 'superseded', 'contradicted', 'unknown']);
function gate(id, passed, detail) { return { id, passed, detail }; }

export function evaluateUniversalActivationGates({ entry = null, consumption = null, conformance = null, session = null, client = 'future-agent' } = {}) {
  if (!CLIENTS.has(client)) throw new Error('brain_activation_gates:unknown_client');
  const entryChecks = [
    gate('entry_available', Boolean(entry), 'universal entry must be available'),
    gate('entry_contract', entry?.mode === 'READ_ONLY_UNIVERSAL_ENTRY', 'entry contract mode must match'),
    gate('entry_revision', Boolean(entry?.identity?.brain_revision), 'Brain revision must be present'),
    gate('authority_available', Boolean(entry?.identity?.authority_registry && entry?.authority_boundaries?.source), 'authority registry and source must be visible')
  ];
  const freshness = consumption?.bootstrap?.operating_status?.freshness ?? [];
  const contextChecks = [
    gate('bounded_bootstrap', consumption?.retrieval?.immediate?.length > 0 && consumption?.retrieval?.untouched?.includes('secrets'), 'bootstrap is bounded and secrets remain untouched'),
    gate('freshness', freshness.every((state) => !STALE.has(state)), 'freshness must not be stale, superseded, contradicted, or unknown'),
    gate('conflicts_visible', Array.isArray(consumption?.bootstrap?.operating_status?.conflicts), 'conflicts must be visible'),
    gate('progressive_retrieval', consumption?.retrieval?.on_demand?.length > 0, 'deeper context is on demand')
  ];
  const sessionChecks = [
    gate('session_identity', Boolean(session?.session_id && session?.repository && session?.worktree && session?.branch), 'session must bind identity and location'),
    gate('revision_consistency', Boolean(session?.brain_revision && entry?.identity?.brain_revision === session.brain_revision), 'session and entry Brain revisions must match'),
    gate('session_conflicts', Array.isArray(session?.conflicts) && session.conflicts.length === 0, 'session conflicts must be absent'),
    gate('confirmation_required', session?.confirmation_required === true, 'future mutation requires explicit confirmation')
  ];
  const clientChecks = [
    gate('consumer_only', conformance?.conformant === true && conformance?.authority?.client_grants_authority === false, 'client must remain a consumer'),
    gate('local_runtime_separation', conformance?.safety?.configuration_changed === false, 'client configuration remains outside this gate'),
    gate('reversible', true, 'activation design requires disable and fallback paths')
  ];
  const rollbackChecks = [
    gate('disable_defined', true, 'disable means stop consuming the entry and restore the prior client path'),
    gate('fallback_defined', true, 'unavailable or stale entry falls back without silent takeover'),
    gate('no_automatic_activation', true, 'this evaluator never activates a client')
  ];
  const groups = { entry: entryChecks, context: contextChecks, session: sessionChecks, client: clientChecks, rollback: rollbackChecks };
  const allPassed = Object.values(groups).flat().every(({ passed }) => passed);
  return {
    schema_version: VERSION,
    mode: 'READ_ONLY_UNIVERSAL_ACTIVATION_GATE_EVALUATION',
    evaluation_id: `brain-activation-gates-${stableJsonHash({ client, groups }).slice(0, 24)}`,
    client,
    status: allPassed ? 'ready_for_separate_authorization' : 'blocked',
    activation_authorized: false,
    fail_closed: !allPassed,
    gates: groups,
    rollback: { disable: 'stop consumer and restore prior client path', unavailable_entry: 'do not bootstrap; surface unavailable state', stale_context: 'do not resume or mutate; require refresh/review' },
    safety: { activation_performed: false, configuration_changed: false, execution_authority: false, mutation_authority: false, providers_called: 0, writes_performed: 0 }
  };
}
