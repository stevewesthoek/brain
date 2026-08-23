import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const TYPES = new Set(['successful_retrieval', 'failed_retrieval', 'stale_context', 'missing_navigation', 'handoff_success', 'continuity_failure', 'stale_session', 'session_conflict', 'accepted_finding', 'rejected_finding', 'prioritization_useful', 'false_positive', 'false_negative', 'uncertainty_calibrated', 'user_correction', 'repeated_failure', 'missing_capability', 'manual_work']);
function refs(values) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value))].sort(); }
function category(type) { if (['successful_retrieval', 'failed_retrieval', 'stale_context', 'missing_navigation'].includes(type)) return 'context_effectiveness'; if (['handoff_success', 'continuity_failure', 'stale_session', 'session_conflict'].includes(type)) return 'continuity_effectiveness'; if (['accepted_finding', 'rejected_finding', 'prioritization_useful', 'false_positive', 'false_negative', 'uncertainty_calibrated'].includes(type)) return 'intelligence_usefulness'; return 'operational_friction'; }

export function analyzeIntelligenceFeedback({ events = [], maxSignals = 100 } = {}) {
  if (!Array.isArray(events) || !Number.isInteger(maxSignals) || maxSignals < 1 || maxSignals > 500) throw new Error('learning_feedback_inputs_invalid');
  const groups = new Map();
  for (const event of events.slice(0, maxSignals * 10)) {
    if (!event?.capability_id || !TYPES.has(event.type)) continue;
    const key = `${event.capability_id}:${category(event.type)}`;
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  const signals = [...groups.entries()].map(([key, group]) => {
    const [capability, signalCategory] = key.split(':');
    const types = [...new Set(group.map((event) => event.type))].sort();
    const mindReview = group.some((event) => event.mind_review_required === true);
    const uncertainty = group.some((event) => event.uncertainty === 'unknown' || event.evidence_complete === false) ? 'evidence_incomplete' : 'requires_human_interpretation';
    const evidence = refs(group.flatMap((event) => event.evidence_refs ?? []));
    const payload = { capability, signalCategory, types, evidence, count: group.length };
    return { learning_signal_id: `learning-${stableJsonHash(payload).slice(0, 24)}`, affected_capability: capability, category: signalCategory, source_evidence: evidence, timeframe: refs(group.map((event) => event.timeframe ?? 'unknown')), event_types: types, event_count: group.length, confidence: Number((group.reduce((sum, event) => sum + (Number.isFinite(event.confidence) ? event.confidence : 0.5), 0) / group.length).toFixed(4)), uncertainty, mind_impact: mindReview ? 'possible' : 'none', mind_review_required: mindReview, recommended_improvement_area: types.join(', '), explanation: `Observed ${group.length} ${signalCategory} event(s) for ${capability}; this is evidence for future human review, not a decision or change request.`, action: 'report_only' };
  }).sort((left, right) => left.learning_signal_id.localeCompare(right.learning_signal_id)).slice(0, maxSignals);
  return { schema_version: VERSION, mode: 'REPORT_ONLY_INTELLIGENCE_FEEDBACK_LEARNING', signals, summary: { signal_count: signals.length, categories: [...new Set(signals.map((signal) => signal.category))].sort(), mind_review_required: signals.filter((signal) => signal.mind_review_required).length, learning_promotions: 0, canonical_updates: 0, decisions_created: 0, proposals_created: 0 }, safety: { report_only: true, writes_performed: 0, providers_called: 0, clients_changed: false, automatic_learning: false, model_training: false } };
}
