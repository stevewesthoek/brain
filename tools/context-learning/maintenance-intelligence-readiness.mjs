import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const BLOCKING = new Set(['stale', 'superseded', 'contradicted', 'unknown']);
function refs(values) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value))].sort(); }
function finding(domain, category, sourceRefs, reason, options = {}) {
  const payload = { domain, category, source_refs: refs(sourceRefs), reason, authority_owner: options.authority_owner ?? 'brain', confidence: Number.isFinite(options.confidence) ? options.confidence : 0.7, freshness: options.freshness ?? 'unknown', impact: options.impact ?? 'operational', mind_review_required: options.mind_review_required ?? false, evidence: refs(options.evidence ?? sourceRefs), uncertainty: options.uncertainty ?? 'requires_human_interpretation', action: 'report_only' };
  return { finding_id: `maintenance-${stableJsonHash(payload).slice(0, 24)}`, ...payload };
}

export function analyzeMaintenanceIntelligence({ observations = [], knowledgeFindings = [], continuity = [], calibration = null, patterns = null, maxFindings = 100 } = {}) {
  if (![observations, knowledgeFindings, continuity].every(Array.isArray) || !Number.isInteger(maxFindings) || maxFindings < 1 || maxFindings > 500) throw new Error('maintenance_inputs_invalid');
  const findings = [];
  for (const observation of observations) {
    const freshness = observation.freshness ?? 'unknown';
    if (BLOCKING.has(freshness) || freshness === 'review_due') findings.push(finding('knowledge_health', freshness === 'review_due' ? 'review_due_source' : 'stale_source', [observation.source_ref, ...(observation.evidence_refs ?? [])], `observation freshness is ${freshness}`, { freshness, authority_owner: observation.authority_owner, confidence: observation.confidence, impact: observation.mind_impact === 'requires_review' ? 'mind' : 'operational', mind_review_required: observation.mind_impact === 'requires_review' }));
    if (!observation.navigation_ref && observation.source_ref) findings.push(finding('context_health', 'missing_navigation_path', [observation.source_ref], 'observation has no navigation reference', { freshness, evidence: observation.evidence_refs }));
    if (observation.mind_impact === 'requires_review' || observation.authority_owner === 'mind') findings.push(finding('context_health', 'mind_impact_review', [observation.source_ref, ...(observation.evidence_refs ?? [])], 'observation may affect Mind meaning or priorities and requires Mind review', { freshness, authority_owner: 'mind', confidence: observation.confidence, impact: 'mind', mind_review_required: true, evidence: observation.evidence_refs }));
  }
  for (const item of knowledgeFindings) findings.push(finding('knowledge_health', item.category ?? 'knowledge_finding', [item.finding_id, ...(item.source_refs ?? [])], item.reason ?? 'existing lifecycle finding', { authority_owner: item.authority_owner, confidence: item.confidence, freshness: item.freshness, impact: item.impact_classification ?? 'operational', mind_review_required: item.mind_impact === 'requires_review', evidence: item.evidence }));
  for (const item of continuity) {
    if (item.status === 'BLOCKED' || item.fail_closed) findings.push(finding('session_continuity_health', item.reason ?? 'continuity_failure', item.details, 'continuity projection failed closed', { freshness: 'unknown', confidence: 0.95, evidence: item.details, uncertainty: 'source_requires_review' }));
    if (item.metrics?.missing_information_count > 0 || item.metrics?.ambiguity_count > 0) findings.push(finding('session_continuity_health', 'continuity_friction', [item.continuity_id], 'continuation package reports missing information or ambiguity', { freshness: 'fresh', confidence: 0.8, evidence: [item.continuity_id] }));
  }
  if (calibration?.summary) {
    if (calibration.summary.false_positives_explicit > 0) findings.push(finding('evolution_loop_health', 'false_positive_recommendations', calibration.signals?.flatMap((signal) => signal.evidence_refs) ?? [], 'calibration recorded explicit false positives', { confidence: 0.95, freshness: 'fresh', evidence: calibration.signals?.map((signal) => signal.signal_id) }));
    if (calibration.summary.decisions?.deferred > 0) findings.push(finding('evolution_loop_health', 'deferred_improvements', calibration.signals?.map((signal) => signal.signal_id) ?? [], 'calibration recorded deferred improvements', { confidence: 0.85, freshness: 'fresh' }));
  }
  if (patterns?.patterns?.length) findings.push(finding('evolution_loop_health', 'recurring_maintenance_pattern', patterns.patterns.flatMap((pattern) => [pattern.pattern_id, ...pattern.evidence_refs]), 'existing pattern discovery produced recurring signals for human review', { confidence: 0.8, freshness: 'fresh' }));
  const bounded = findings.sort((left, right) => left.finding_id.localeCompare(right.finding_id)).slice(0, maxFindings);
  return { schema_version: VERSION, mode: 'REPORT_ONLY_MAINTENANCE_INTELLIGENCE', generated_at: new Date().toISOString(), findings: bounded, summary: { finding_count: bounded.length, domains: [...new Set(bounded.map((item) => item.domain))].sort(), mind_review_required: bounded.filter((item) => item.mind_review_required).length, canonical_promotions: 0, writes_performed: 0, providers_called: 0, proposals_created: 0 }, safety: { report_only: true, writes_performed: 0, providers_called: 0, canonical_updates: 0, automatic_actions: 0 } };
}
