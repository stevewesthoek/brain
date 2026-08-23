import { buildUniversalBrainEntry } from './universal-brain-entry.mjs';
import { consumeUniversalBrainEntry } from './universal-entry-consumer.mjs';
import { validateUniversalEntryConformance } from './universal-entry-conformance.mjs';
import { evaluateUniversalActivationGates } from './universal-activation-gates.mjs';

const CLIENT = 'codex';

export function prepareCodexActivationReadiness({ brainRevision = 'unknown', session = null, maxItems = 10 } = {}) {
  const authorityRegistry = { registryId: 'brain-authority-v1', entries: [{ id: 'brain', owner: 'brain' }, { id: 'mind', owner: 'mind' }] };
  const entry = buildUniversalBrainEntry({ brainRevision, authorityRegistry, maxItems });
  const consumption = consumeUniversalBrainEntry({ entry, environment: CLIENT, maxItems });
  const conformance = validateUniversalEntryConformance({ consumption, client: CLIENT });
  const gates = evaluateUniversalActivationGates({ entry, consumption, conformance, session, client: CLIENT });
  const continuation = session && gates.status !== 'blocked' ? {
    session_id: session.session_id,
    repository: session.repository,
    worktree: session.worktree,
    branch: session.branch,
    brain_revision: entry.identity.brain_revision,
    context_pointers: consumption.bootstrap.navigation,
    freshness: consumption.bootstrap.operating_status.freshness,
    authority: consumption.bootstrap.authority_boundaries,
    next_action: 'Codex may retrieve referenced context after explicit confirmation; no automatic resume.',
    confirmation_required: true
  } : null;
  return {
    mode: 'READ_ONLY_CODEX_ACTIVATION_READINESS',
    client: CLIENT,
    activation_state: gates.status === 'ready_for_separate_authorization' ? 'READY_NOT_ACTIVATED' : 'BLOCKED',
    entry_version: entry.schema_version,
    entry_revision: entry.identity.brain_revision,
    freshness: consumption.bootstrap.operating_status.freshness,
    conformance: { conformant: conformance.conformant, fail_closed: conformance.fail_closed },
    gates: { status: gates.status, fail_closed: gates.fail_closed },
    continuation,
    rollback: { state: 'AVAILABLE', action: 'disable Codex consumption and restore the prior Codex session path; no Codex configuration is changed by this module' },
    limitations: ['read-only readiness only', 'no automatic resume', 'no transcript ingestion', 'no Codex memory store', 'no configuration or authority change'],
    safety: { codex_configuration_changed: false, automatic_resume: false, writes_performed: 0, providers_called: 0, execution_authority: false, mutation_authority: false }
  };
}
