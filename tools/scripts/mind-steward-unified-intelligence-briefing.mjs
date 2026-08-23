import fs from 'node:fs';
import path from 'node:path';

const GROUP_ORDER = ['urgent_review', 'important_review', 'informational', 'deferred', 'historical'];
const ACTIONS = ['review', 'accept', 'reject', 'defer', 'archive'];

function uncertaintySignals(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [String(value)] : [];
}

export function classifyBriefingGroup(item) {
  if (item.review_state === 'deferred') return 'deferred';
  if (item.review_state === 'archived') return 'historical';
  if (item.freshness === 'stale') return 'urgent_review';
  if (item.brain_impact === 'material' || item.mind_impact === 'material' || item.freshness === 'unknown' || uncertaintySignals(item.uncertainty).length > 0) return 'important_review';
  return 'informational';
}

function explanationFor(item, group) {
  const reasons = [`review_state=${item.review_state}`];
  if (item.freshness === 'stale') reasons.push('freshness=stale');
  if (item.freshness === 'unknown') reasons.push('freshness=unknown');
  if (item.mind_impact === 'material') reasons.push('mind_impact=material');
  if (item.brain_impact === 'material') reasons.push('brain_impact=material');
  if (uncertaintySignals(item.uncertainty).length > 0) reasons.push('uncertainty_present');
  return {
    group,
    why_surfaced: reasons,
    supporting_evidence: [item.source_reference, ...(item.source_hash ? [item.source_hash] : []), ...(item.provenance?.evidence_references ?? [])],
    available_actions: ACTIONS,
  };
}

function compareEntries(a, b) {
  return `${a.source_type}\u0000${a.source_reference}\u0000${a.review_id}`.localeCompare(`${b.source_type}\u0000${b.source_reference}\u0000${b.review_id}`);
}

export function buildUnifiedIntelligenceBriefing(projection, { generatedAt = projection.generated_at } = {}) {
  const groups = Object.fromEntries(GROUP_ORDER.map((group) => [group, []]));
  for (const item of projection.items) {
    const group = classifyBriefingGroup(item);
    groups[group].push({ ...item, briefing: explanationFor(item, group) });
  }
  for (const group of GROUP_ORDER) groups[group].sort(compareEntries);
  const attentionQueue = GROUP_ORDER.flatMap((group) => groups[group]);
  return {
    briefing_version: '1.0.0',
    generated_at: generatedAt,
    source: 'infinite-brain-unified-review',
    grouping_policy: 'explicit-evidence-signals-only',
    groups,
    attention_queue: attentionQueue,
    counts: Object.fromEntries(GROUP_ORDER.map((group) => [group, groups[group].length])),
    invariants: {
      writes_to_mind: false,
      writes_to_brain_canonical: false,
      automatic_prioritization_of_human_meaning: false,
      automatic_decisions: false,
      automatic_promotion: false,
      provider_calls: false,
    },
  };
}

export function renderUnifiedIntelligenceBriefing(briefing) {
  const lines = [
    '# Infinite Brain Unified Intelligence Briefing', '',
    `Generated: ${briefing.generated_at}`,
    'Grouping: explicit evidence signals only; no human-importance score is inferred.',
    '',
    '- Review only: this briefing does not execute, decide, promote, or write canonical state.',
    '- Every item retains `requires_human_decision: true`.',
    '',
  ];
  for (const group of GROUP_ORDER) {
    lines.push(`## ${group.replaceAll('_', ' ')}`, '');
    for (const item of briefing.groups[group]) {
      lines.push(`### ${item.source_type} — ${item.source_reference}`, '');
      lines.push(`- Why surfaced: ${item.briefing.why_surfaced.join(', ')}`);
      lines.push(`- Evidence: ${item.briefing.supporting_evidence.join(', ') || 'source reference only'}`);
      lines.push(`- Freshness: ${item.freshness}; confidence: ${item.confidence}; uncertainty: ${Array.isArray(item.uncertainty) ? item.uncertainty.join('; ') : item.uncertainty}`);
      lines.push(`- Mind impact: ${item.mind_impact}; Brain impact: ${item.brain_impact}; requires human decision: ${item.requires_human_decision}`);
      lines.push(`- Available actions: ${item.briefing.available_actions.join(', ')}`, '');
    }
    if (briefing.groups[group].length === 0) lines.push('_None._', '');
  }
  return `${lines.join('\n')}\n`;
}

export function writeUnifiedIntelligenceBriefing({ briefing, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'unified-review'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_unified_briefing_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(resolved, 'briefing-latest.json');
  const markdownPath = path.join(resolved, 'briefing-latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(briefing, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(markdownPath, renderUnifiedIntelligenceBriefing(briefing), { mode: 0o600 });
  return { jsonPath, markdownPath };
}
