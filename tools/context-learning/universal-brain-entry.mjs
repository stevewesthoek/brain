import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
function fail(code) { throw new Error(`brain_entry:${code}`); }
function bounded(values, limit) { return Array.isArray(values) ? values.slice(0, limit) : []; }

export function buildUniversalBrainEntry({ brainRevision = 'unknown', operatingView = null, continuity = null, authorityRegistry = null, capabilities = [], navigation = {}, maxItems = 20 } = {}) {
  if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > 100) fail('invalid_bound');
  if (!authorityRegistry?.registryId || !Array.isArray(authorityRegistry.entries)) fail('authority_registry_required');
  const brainEntrypoints = navigation.brain ?? ['AGENTS.md', '00-start-here.md', '00-current-context.md', '00-memory-map.md', 'README.md', 'CLAUDE.md'];
  const mindEntrypoints = navigation.mind ?? ['/Users/Office/Repos/stevewesthoek/mind/system/agent-context/AGENTS.md', '/Users/Office/Repos/stevewesthoek/mind/system/agent-context/00-start-here.md'];
  const contextEntrypoints = navigation.context ?? ['operations/specs/context-learning/broker-contracts-v1.schema.json', 'operations/specs/context-learning/observation-projection-v1.schema.json', 'tools/context-learning/operating-loop.mjs'];
  const sessionEntrypoints = navigation.session ?? ['operations/specs/context-learning/session-continuity.v1.schema.json', 'operations/specs/context-learning/session-continuity-policy.md', '.ai/current.md', '.ai/handoffs/'];
  const identity = { brain_revision: brainRevision, authority_registry: authorityRegistry.registryId, navigation: { brain: brainEntrypoints, mind: mindEntrypoints, context: contextEntrypoints, session: sessionEntrypoints } };
  const observations = operatingView?.current_state?.observations ?? { count: 0, ids: [], freshness: [] };
  const conflicts = bounded(operatingView?.current_state?.conflicts ?? [], maxItems);
  const contexts = bounded(operatingView?.decision_state?.pending_contexts ?? [], maxItems);
  const entry = {
    schema_version: VERSION,
    mode: 'READ_ONLY_UNIVERSAL_ENTRY',
    entry_id: `brain-entry-${stableJsonHash(identity).slice(0, 24)}`,
    identity: { brain_revision: brainRevision, contract_version: VERSION, authority_registry: authorityRegistry.registryId, provider_neutral: true },
    navigation: { brain_authority: brainEntrypoints, mind_authority: mindEntrypoints, context: contextEntrypoints, session_continuity: sessionEntrypoints, capabilities: bounded(capabilities, maxItems) },
    current_state: { operating_view_id: operatingView?.view_id ?? null, observations: { count: observations.count ?? 0, ids: bounded(observations.ids, maxItems), freshness: bounded(observations.freshness, maxItems) }, conflicts, continuity: continuity?.selection ?? operatingView?.current_state?.active_continuity ?? { status: 'unknown', resume_allowed: false } },
    session_state: { selection: continuity?.selection ?? null, candidates: bounded(continuity?.candidates ?? [], maxItems), conflicts: bounded(continuity?.conflicts ?? [], maxItems), automatic_takeover: false },
    decision_awareness: { pending_contexts: contexts, review_boundaries: bounded(operatingView?.decision_state?.review_boundaries ?? [], maxItems) },
    evolution_awareness: { prepared_transactions: bounded(operatingView?.evolution_state?.prepared_transactions ?? [], maxItems), validation_status: bounded(operatingView?.evolution_state?.validation_status ?? [], maxItems), learning_receipts: bounded(operatingView?.evolution_state?.learning_receipts ?? [], maxItems) },
    authority_boundaries: { brain: 'Brain owns AI-system knowledge, operational policy, validation, and bounded execution rules.', mind: 'Mind owns human meaning, priorities, strategy, commitments, and personal/business context.', source: 'authority registry; no authority is granted by this entry point' },
    safety: { execution_authority: false, mutation_authority: false, automatic_resume: false, automatic_takeover: false, providers_called: 0, writes_performed: 0 }
  };
  if (JSON.stringify(entry).length > maxItems * 10000) fail('bounded_output_exceeded');
  return entry;
}
