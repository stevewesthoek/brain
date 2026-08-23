import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';
import { consumeUniversalBrainEntry } from './universal-entry-consumer.mjs';
import { validateUniversalEntryConformance } from './universal-entry-conformance.mjs';
import { evaluateUniversalActivationGates } from './universal-activation-gates.mjs';

const PILOT_ENVIRONMENT = 'future-agent';

export function runUniversalActivationPilot({ enabled = true, brainRevision = 'pilot-revision', maxItems = 10 } = {}) {
  if (!enabled) return { mode: 'READ_ONLY_UNIVERSAL_ACTIVATION_PILOT', pilot_environment: PILOT_ENVIRONMENT, pilot_activated: false, disabled: true, rollback: { disabled: true, action: 'no consumption performed' }, safety: { writes_performed: 0, providers_called: 0, execution_authority: false, mutation_authority: false } };
  const authorityRegistry = { registryId: 'brain-authority-v1', entries: [{ id: 'brain', owner: 'brain' }, { id: 'mind', owner: 'mind' }] };
  const entry = buildUniversalBrainEntry({ brainRevision, authorityRegistry, maxItems });
  const consumption = consumeUniversalBrainEntry({ entry, environment: PILOT_ENVIRONMENT, maxItems });
  const conformance = validateUniversalEntryConformance({ consumption, client: PILOT_ENVIRONMENT });
  const session = { session_id: 'mru0-p3-0-pilot', repository: 'brain', worktree: 'brain-main', branch: 'main', brain_revision: brainRevision, conflicts: [], confirmation_required: true };
  const gates = evaluateUniversalActivationGates({ entry, consumption, conformance, session, client: PILOT_ENVIRONMENT });
  const bootstrapJson = JSON.stringify(consumption.bootstrap);
  return {
    mode: 'READ_ONLY_UNIVERSAL_ACTIVATION_PILOT',
    pilot_environment: PILOT_ENVIRONMENT,
    pilot_activated: gates.status === 'ready_for_separate_authorization',
    external_client_activated: false,
    gate_status: gates.status,
    activation_authorized: false,
    metrics: { bootstrap_bytes: Buffer.byteLength(bootstrapJson), immediate_fields: consumption.retrieval.immediate.length, on_demand_fields: consumption.retrieval.on_demand.length, secrets_loaded: consumption.retrieval.untouched.includes('secrets'), freshness_visible: Array.isArray(consumption.bootstrap.operating_status.freshness), authority_visible: Boolean(consumption.bootstrap.authority_boundaries.source) },
    entry_revision: entry.identity.brain_revision,
    conformance: { conformant: conformance.conformant, fail_closed: conformance.fail_closed },
    gates: { status: gates.status, fail_closed: gates.fail_closed },
    rollback: { disabled: false, action: 'rerun with enabled=false; no external client state is changed' },
    safety: { writes_performed: 0, providers_called: 0, execution_authority: false, mutation_authority: false, configuration_changed: false }
  };
}
