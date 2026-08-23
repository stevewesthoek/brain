import { stableJsonHash } from './context-learning-core.mjs';

const VERSION = '1.0.0';
const DECISIONS = new Set(['approved', 'rejected', 'deferred', 'needs-review']);
const USEFULNESS = new Set(['supported', 'not_supported', 'unknown']);

function fail(code) { throw new Error(`patterns:${code}`); }
function strings(values = []) { return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.length > 0))].sort(); }

function validateSignal(signal) {
  if (!signal?.signal_id || !signal.proposal_id || !signal.transaction_id) fail('signal_identity_missing');
  if (!signal.category || !DECISIONS.has(signal.decision) || !USEFULNESS.has(signal.usefulness)) fail('signal_shape_invalid');
  if (!signal.provenance?.proposal_id || signal.provenance.proposal_id !== signal.proposal_id) fail('signal_provenance_invalid');
  if (!Array.isArray(signal.evidence_refs)) fail('signal_evidence_missing');
}

function makePattern(key, signals) {
  const evidence = strings(signals.flatMap((signal) => [signal.signal_id, ...signal.evidence_refs, ...signal.provenance.validation_refs, ...signal.provenance.rollback_refs]));
  const confidences = signals.map((signal) => signal.confidence).filter((value) => Number.isFinite(value));
  const knownUsefulness = signals.filter((signal) => signal.usefulness !== 'unknown');
  const supported = knownUsefulness.filter((signal) => signal.usefulness === 'supported').length;
  const payload = { key, signal_ids: signals.map((signal) => signal.signal_id).sort(), evidence };
  return {
    pattern_id: `pattern-${stableJsonHash(payload).slice(0, 24)}`,
    pattern_key: key,
    signal_count: signals.length,
    signal_ids: payload.signal_ids,
    evidence_refs: evidence,
    decision_outcomes: Object.fromEntries([...DECISIONS].sort().map((decision) => [decision, signals.filter((signal) => signal.decision === decision).length])),
    usefulness: { supported: supported, not_supported: knownUsefulness.filter((signal) => signal.usefulness === 'not_supported').length, unknown: signals.length - knownUsefulness.length },
    confidence: { min: confidences.length ? Math.min(...confidences) : null, max: confidences.length ? Math.max(...confidences) : null, mean: confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null },
    freshness: [...new Set(signals.map((signal) => signal.freshness ?? 'unknown'))].sort(),
    mind_impact: [...new Set(signals.map((signal) => signal.mind_impact ?? 'unknown'))].sort(),
    conclusion: 'recurring_pattern_for_human_review',
    action: 'review_only'
  };
}

export function discoverPatterns({ signals = [], minimumOccurrences = 2 } = {}) {
  if (!Array.isArray(signals) || !Number.isInteger(minimumOccurrences) || minimumOccurrences < 1) fail('invalid_inputs');
  signals.forEach(validateSignal);
  const groups = new Map();
  for (const signal of signals) {
    const keys = [`category:${signal.category}`, `decision:${signal.decision}`, `usefulness:${signal.usefulness}`];
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), signal]);
  }
  const patterns = [...groups.entries()]
    .filter(([, grouped]) => grouped.length >= minimumOccurrences)
    .map(([key, grouped]) => makePattern(key, grouped))
    .sort((left, right) => left.pattern_id.localeCompare(right.pattern_id));
  return {
    schema_version: VERSION,
    mode: 'REPORT_ONLY_PATTERN_DISCOVERY',
    patterns,
    summary: { signal_count: signals.length, pattern_count: patterns.length, minimum_occurrences: minimumOccurrences, proposals_created: 0, canonical_updates: 0, writes_performed: 0, providers_called: 0 }
  };
}
