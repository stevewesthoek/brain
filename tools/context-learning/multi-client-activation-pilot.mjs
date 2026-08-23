import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';
import { consumeUniversalBrainEntry } from './universal-entry-consumer.mjs';
import { validateUniversalEntryConformance } from './universal-entry-conformance.mjs';
import { evaluateUniversalActivationGates } from './universal-activation-gates.mjs';
import { stableJsonHash } from './context-learning-core.mjs';

const CLIENTS = ['claude', 'codex', 'workbench'];

export function runMultiClientActivationPilot({ brainRevision = 'multi-client-revision', enabled = true, maxItems = 10, sessions = {} } = {}) {
  if (!enabled) return { mode: 'READ_ONLY_MULTI_CLIENT_ACTIVATION_PILOT', enabled: false, clients: {}, rollback: { disabled: true, action: 'stop all bounded consumers; no client configuration changed' }, safety: { writes_performed: 0, providers_called: 0, execution_authority: false, mutation_authority: false, automatic_resume: false, automatic_takeover: false } };
  const authorityRegistry = { registryId: 'brain-authority-v1', entries: [{ id: 'brain', owner: 'brain' }, { id: 'mind', owner: 'mind' }] };
  const entry = buildUniversalBrainEntry({ brainRevision, authorityRegistry, maxItems });
  const clients = Object.fromEntries(CLIENTS.map((client) => {
    const consumption = consumeUniversalBrainEntry({ entry, environment: client, maxItems });
    const conformance = validateUniversalEntryConformance({ consumption, client });
    const session = sessions[client] ?? { session_id: `multi-client-${client}`, repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: brainRevision, conflicts: [], confirmation_required: true };
    const gates = evaluateUniversalActivationGates({ entry, consumption, conformance, session, client });
    return [client, {
      activation_state: gates.status === 'ready_for_separate_authorization' ? 'LIVE_BOUNDED_READ_ONLY' : 'BLOCKED',
      conformance: conformance.conformant,
      gate_status: gates.status,
      bootstrap_bytes: JSON.stringify(consumption.bootstrap).length,
      freshness_visible: Array.isArray(consumption.bootstrap.operating_status.freshness),
      conflicts_visible: Array.isArray(consumption.bootstrap.operating_status.conflicts),
      authority_visible: Boolean(consumption.bootstrap.authority_boundaries.source),
      shared_entry_id: entry.entry_id,
      activation_authorized: false,
      safety: { execution_authority: false, mutation_authority: false, automatic_resume: false, automatic_takeover: false, writes_performed: 0, providers_called: 0 }
    }];
  }));
  return {
    mode: 'READ_ONLY_MULTI_CLIENT_ACTIVATION_PILOT',
    enabled: true,
    pilot_id: `multi-client-${stableJsonHash({ brainRevision, clients: Object.keys(clients), entry: entry.entry_id }).slice(0, 24)}`,
    entry: { id: entry.entry_id, version: entry.schema_version, brain_revision: brainRevision },
    clients,
    shared_contract: { same_entry: new Set(Object.values(clients).map((client) => client.shared_entry_id)).size === 1, provider_neutral: entry.identity.provider_neutral, context_broker_navigation: true },
    rollback: { state: 'AVAILABLE', action: 'rerun with enabled=false; restore each client prior context path; no client configuration changed' },
    safety: { execution_authority: false, mutation_authority: false, automatic_resume: false, automatic_takeover: false, writes_performed: 0, providers_called: 0, configuration_changed: false }
  };
}
