import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const BLOCKING_FRESHNESS = new Set(['stale', 'superseded', 'contradicted', 'unknown']);

function bounded(values, limit) { return Array.isArray(values) ? values.slice(0, limit) : []; }
function unavailable(reason) {
  return {
    schema_version: VERSION,
    mode: 'FAIL_CLOSED_UNIVERSAL_ENTRY_CONSUMPTION',
    status: 'unavailable',
    fail_closed: true,
    reason,
    safety: { execution_authority: false, mutation_authority: false, automatic_resume: false, providers_called: 0, writes_performed: 0 }
  };
}

export function consumeUniversalBrainEntry({ entry = null, environment = 'provider-neutral', maxItems = 10 } = {}) {
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 50) throw new Error('brain_entry_consumer:invalid_bound');
  if (!entry) return unavailable('entry_unavailable');
  if (entry.mode !== 'READ_ONLY_UNIVERSAL_ENTRY') return unavailable('unsupported_entry');
  if (entry.identity?.provider_neutral !== true) return unavailable('provider_neutrality_required');
  if (!entry.identity?.brain_revision || !entry.identity?.authority_registry) return unavailable('unknown_authority');
  if (!entry.authority_boundaries?.source || !entry.navigation?.brain_authority?.length || !entry.navigation?.context?.length) return unavailable('incomplete_authority_navigation');

  const continuity = entry.current_state?.continuity ?? entry.session_state?.selection ?? { status: 'unknown', resume_allowed: false };
  const conflicts = bounded([...(entry.current_state?.conflicts ?? []), ...(entry.session_state?.conflicts ?? [])], maxItems);
  const freshness = bounded(entry.current_state?.observations?.freshness ?? [], maxItems);
  const stale = freshness.some((state) => BLOCKING_FRESHNESS.has(state));
  const sessionConflict = conflicts.length > 0 || ['conflict', 'ambiguous'].includes(continuity.status);
  const status = stale || sessionConflict ? 'blocked' : 'ready';
  const warnings = [];
  if (stale) warnings.push('freshness_requires_review');
  if (sessionConflict) warnings.push('session_conflict_requires_review');
  if (continuity.status === 'unknown') warnings.push('continuity_unknown');

  const output = {
    schema_version: VERSION,
    mode: 'READ_ONLY_ENTRY_CONSUMPTION',
    consumption_id: `brain-consumption-${stableJsonHash({ entry_id: entry.entry_id, environment, status }).slice(0, 24)}`,
    status,
    fail_closed: status !== 'ready',
    adapter_environment: environment,
    bootstrap: {
      identity: { brain_revision: entry.identity.brain_revision, contract_version: entry.identity.contract_version, provider_neutral: true },
      authority_boundaries: entry.authority_boundaries,
      navigation: {
        brain_authority: bounded(entry.navigation.brain_authority, maxItems),
        mind_authority: bounded(entry.navigation.mind_authority, maxItems),
        context: bounded(entry.navigation.context, maxItems),
        session_continuity: bounded(entry.navigation.session_continuity, maxItems)
      },
      operating_status: { operating_view_id: entry.current_state?.operating_view_id ?? null, freshness, conflicts },
      continuity: { selection: continuity, automatic_takeover: false }
    },
    retrieval: {
      immediate: ['identity', 'authority_boundaries', 'navigation', 'operating_status', 'continuity'],
      on_demand: ['observations', 'capabilities', 'decision_awareness', 'evolution_awareness'],
      untouched: ['full_repository', 'full_conversations', 'secrets', 'client_configuration']
    },
    warnings,
    authority: { source: entry.authority_boundaries.source, grants: false },
    safety: { execution_authority: false, mutation_authority: false, automatic_resume: false, automatic_takeover: false, providers_called: 0, writes_performed: 0 }
  };
  if (JSON.stringify(output).length > maxItems * 12000) throw new Error('brain_entry_consumer:bounded_output_exceeded');
  return output;
}
