import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const CLIENTS = new Set(['claude', 'claude-code', 'codex', 'workbench', 'future-agent']);
const REQUIRED_IMMEDIATE = ['identity', 'authority_boundaries', 'navigation', 'operating_status', 'continuity'];
const REQUIRED_UNTOUCHED = ['full_repository', 'full_conversations', 'secrets', 'client_configuration'];

function check(id, passed, detail) { return { id, passed, detail }; }

export function validateUniversalEntryConformance({ consumption = null, client = 'future-agent' } = {}) {
  if (!CLIENTS.has(client)) throw new Error('brain_entry_conformance:unknown_client');
  if (!consumption) return { schema_version: VERSION, mode: 'READ_ONLY_CLIENT_CONFORMANCE', client, conformant: false, fail_closed: true, checks: [check('consumption_available', false, 'consumption_output_required')] };

  const checks = [
    check('consumption_mode', consumption.mode === 'READ_ONLY_ENTRY_CONSUMPTION', 'read-only consumption mode required'),
    check('provider_neutral', consumption.bootstrap?.identity?.provider_neutral === true, 'provider-neutral identity required'),
    check('brain_revision', Boolean(consumption.bootstrap?.identity?.brain_revision), 'Brain revision must be visible'),
    check('authority_boundaries', Boolean(consumption.bootstrap?.authority_boundaries?.source) && consumption.authority?.grants === false, 'authority is cited and not granted'),
    check('bounded_navigation', ['brain_authority', 'mind_authority', 'context', 'session_continuity'].every((key) => Array.isArray(consumption.bootstrap?.navigation?.[key])), 'navigation must be bounded arrays'),
    check('progressive_retrieval', REQUIRED_IMMEDIATE.every((key) => consumption.retrieval?.immediate?.includes(key)) && REQUIRED_UNTOUCHED.every((key) => consumption.retrieval?.untouched?.includes(key)), 'bootstrap and untouched boundaries must be explicit'),
    check('freshness_visible', Array.isArray(consumption.bootstrap?.operating_status?.freshness), 'freshness must be visible'),
    check('no_authority_escalation', consumption.safety?.execution_authority === false && consumption.safety?.mutation_authority === false, 'execution and mutation authority remain false'),
    check('no_automatic_takeover', consumption.safety?.automatic_resume === false && consumption.safety?.automatic_takeover === false, 'automatic resume/takeover remain false'),
    check('no_external_activity', consumption.safety?.providers_called === 0 && consumption.safety?.writes_performed === 0, 'no provider calls or writes')
  ];
  const conformant = checks.every(({ passed }) => passed);
  return {
    schema_version: VERSION,
    mode: 'READ_ONLY_CLIENT_CONFORMANCE',
    conformance_id: `brain-conformance-${stableJsonHash({ client, checks }).slice(0, 24)}`,
    client,
    client_role: client === 'workbench' ? 'context_and_execution_boundary_only' : 'context_consumer_adapter_only',
    conformant,
    fail_closed: !conformant,
    checks,
    authority: { brain_is_source_of_truth: true, client_grants_authority: false },
    safety: { configuration_changed: false, activation_performed: false, providers_called: 0, writes_performed: 0 }
  };
}

export function validateUniversalEntryFailureConformance({ consumption = null } = {}) {
  const failClosed = Boolean(consumption?.fail_closed) && consumption?.safety?.execution_authority === false && consumption?.safety?.mutation_authority === false;
  return { schema_version: VERSION, mode: 'READ_ONLY_FAILURE_CONFORMANCE', conformant: failClosed, fail_closed: !failClosed, no_mutation: failClosed, reason: consumption?.reason ?? consumption?.warnings ?? 'failure_output_required' };
}
