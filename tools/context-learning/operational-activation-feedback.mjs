import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const STATES = new Set(['available', 'activated', 'pilot', 'disabled', 'review_required']);
const DEFAULT_CAPABILITIES = [
  ['universal-entry-consumption', 'activated'],
  ['multi-client-bounded-context', 'activated'],
  ['session-continuity-inspection', 'activated'],
  ['observation-analysis', 'available'],
  ['maintenance-intelligence', 'available'],
  ['prioritization-intelligence', 'available']
];

export function projectOperationalActivation({ capabilities = null, events = [], enabled = true, maxItems = 100 } = {}) {
  if (!Array.isArray(events) || !Number.isInteger(maxItems) || maxItems < 1 || maxItems > 500) throw new Error('operational_feedback_inputs_invalid');
  if (!enabled) return { schema_version: VERSION, mode: 'REPORT_ONLY_OPERATIONAL_ACTIVATION', enabled: false, capabilities: [], feedback: { event_count: 0 }, rollback: { disabled: true, action: 'stop projection; no persistent feedback state exists' }, safety: { writes_performed: 0, providers_called: 0, automatic_actions: 0, authority_changed: false } };
  const source = capabilities ?? DEFAULT_CAPABILITIES.map(([id, state]) => ({ capability_id: id, state }));
  if (!Array.isArray(source) || source.some((item) => !item?.capability_id || !STATES.has(item.state))) throw new Error('operational_capability_state_invalid');
  const inventory = source.slice(0, maxItems).map((item) => ({ capability_id: item.capability_id, state: item.state, clients: item.clients ?? ['claude', 'codex', 'workbench'], reversible: true, autonomous: false }));
  const counts = new Map(inventory.map((item) => [item.capability_id, { invocations: 0, useful: 0, failed_retrievals: 0, stale_context_events: 0, continuity_failures: 0, false_positive_findings: 0, mind_review_required: false }]));
  for (const event of events.slice(0, maxItems * 10)) {
    if (!event?.capability_id || !counts.has(event.capability_id)) continue;
    const count = counts.get(event.capability_id);
    if (event.type === 'invocation') count.invocations += 1;
    if (event.useful === true) count.useful += 1;
    if (event.type === 'failed_retrieval') count.failed_retrievals += 1;
    if (event.type === 'stale_context') count.stale_context_events += 1;
    if (event.type === 'continuity_failure') count.continuity_failures += 1;
    if (event.type === 'false_positive_finding') count.false_positive_findings += 1;
    if (event.mind_review_required === true) count.mind_review_required = true;
  }
  const feedback = Object.fromEntries([...counts.entries()].sort().map(([id, metrics]) => [id, { ...metrics, usefulness_rate: metrics.invocations ? Number((metrics.useful / metrics.invocations).toFixed(4)) : null }]));
  return { schema_version: VERSION, mode: 'REPORT_ONLY_OPERATIONAL_ACTIVATION', activation_authority: false, enabled: true, capabilities: inventory, feedback: { event_count: Math.min(events.length, maxItems * 10), by_capability: feedback, source: 'supplied aggregate usage events only' }, clients: { claude: 'bounded_consumer', codex: 'bounded_consumer', workbench: 'bounded_consumer' }, rollback: { disabled: false, action: 'disable projection; restore prior client context paths; no persistent state is changed' }, safety: { writes_performed: 0, providers_called: 0, automatic_actions: 0, authority_changed: false, automatic_resume: false, automatic_takeover: false } , projection_id: `ops-feedback-${stableJsonHash({ inventory, feedback }).slice(0, 24)}` };
}
