import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const FRESHNESS = { superseded: 1, contradicted: 1, stale: 0.9, review_due: 0.7, fresh: 0.2, unknown: null };
const IMPACT = { safety: 1, operational: 0.7, mind: 0.5, both: 0.8 };
function bounded(value, fallback = 0.5) { return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback; }
function refs(values) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value))].sort(); }

export function prioritizeMaintenanceFindings({ findings = [], maxFindings = 100 } = {}) {
  if (!Array.isArray(findings) || !Number.isInteger(maxFindings) || maxFindings < 1 || maxFindings > 500) throw new Error('prioritization_inputs_invalid');
  const prioritized = findings.map((item) => {
    const unknownAuthority = !['brain', 'mind', 'both'].includes(item.authority_owner);
    const freshnessFactor = FRESHNESS[item.freshness] ?? null;
    const factors = { impact: IMPACT[item.impact] ?? 0.5, confidence: bounded(item.confidence), freshness_urgency: freshnessFactor ?? 0, evidence_quality: bounded(item.evidence?.length ? 0.8 : 0.2), historical_usefulness: bounded(item.historical_usefulness), attention_cost: bounded(item.attention_cost, 0.5) };
    const score = unknownAuthority || freshnessFactor === null ? 0 : Number(((factors.impact * 0.3 + factors.confidence * 0.2 + factors.freshness_urgency * 0.2 + factors.evidence_quality * 0.15 + factors.historical_usefulness * 0.1 + (1 - factors.attention_cost) * 0.05)).toFixed(4));
    const payload = { finding_id: item.finding_id, score, factors, unknownAuthority };
    return { priority_id: `priority-${stableJsonHash(payload).slice(0, 24)}`, source_finding_ref: item.finding_id, source_refs: refs(item.source_refs), authority_owner: unknownAuthority ? 'unknown' : item.authority_owner, evidence: refs(item.evidence), confidence: bounded(item.confidence), freshness: item.freshness ?? 'unknown', impact: item.impact ?? 'unknown', mind_review_required: item.mind_review_required === true || item.authority_owner === 'mind' || item.authority_owner === 'both', uncertainty: unknownAuthority || freshnessFactor === null ? 'authority_or_freshness_unknown' : (item.uncertainty ?? 'requires_human_interpretation'), impact_factors: factors, advisory_score: score, priority_band: score >= 0.75 ? 'high_advisory' : score >= 0.45 ? 'medium_advisory' : 'low_advisory', rationale: unknownAuthority ? 'not prioritized because authority is unknown; human review required' : `advisory score reflects impact, confidence, freshness, evidence, historical usefulness, and attention cost; it does not infer human importance`, action: 'report_only' };
  }).sort((a, b) => b.advisory_score - a.advisory_score || a.priority_id.localeCompare(b.priority_id)).slice(0, maxFindings);
  return { schema_version: VERSION, mode: 'REPORT_ONLY_MAINTENANCE_PRIORITIZATION', prioritization_authority: false, findings: prioritized, summary: { finding_count: prioritized.length, high_advisory: prioritized.filter((item) => item.priority_band === 'high_advisory').length, mind_review_required: prioritized.filter((item) => item.mind_review_required).length, canonical_updates: 0, decisions_created: 0, proposals_created: 0, writes_performed: 0, providers_called: 0 }, safety: { report_only: true, ranking_is_advisory: true, writes_performed: 0, providers_called: 0, automatic_actions: 0, human_priorities_changed: false } };
}
