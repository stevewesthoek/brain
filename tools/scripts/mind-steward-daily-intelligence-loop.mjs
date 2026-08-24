import fs from 'node:fs';
import path from 'node:path';

const WORKFLOW_STATES = ['new', 'reviewing', 'accepted', 'rejected', 'deferred', 'archived'];

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) return { value: null, path: filePath, present: false };
  return { value: JSON.parse(fs.readFileSync(filePath, 'utf8')), path: filePath, present: true };
}

export function loadDailyIntelligenceInputs(repoRoot = process.cwd()) {
  const root = path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'unified-review');
  const briefing = readJsonIfPresent(path.join(root, 'briefing-latest.json'));
  const workflow = readJsonIfPresent(path.join(root, 'workflow-latest.json'));
  const promotionsRoot = path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'promotions');
  const promotions = fs.existsSync(promotionsRoot)
    ? fs.readdirSync(promotionsRoot).filter((name) => name.endsWith('.json')).sort().map((name) => readJsonIfPresent(path.join(promotionsRoot, name)).value)
    : [];
  return { briefing, workflow, promotions, source_paths: [briefing.path, workflow.path, promotionsRoot], real_inputs_present: briefing.present || workflow.present || promotions.length > 0 };
}

function countStates(items) {
  return Object.fromEntries(WORKFLOW_STATES.map((state) => [state, items.filter((item) => item.state === state).length]));
}

function hasConflict(item) {
  const values = Array.isArray(item.source?.uncertainty) ? item.source.uncertainty : [item.source?.uncertainty];
  return values.some((value) => /conflict|contradict/i.test(String(value)));
}

function actionFor(item) {
  if (item.state === 'new' || item.state === 'reviewing') return 'review';
  if (item.state === 'deferred') return 'review';
  if (item.state === 'accepted') return 'prepare promotion';
  return 'archive';
}

export function buildDailyIntelligenceLoop({ briefing = null, workflow = null, promotions = [], generatedAt = briefing?.generated_at ?? workflow?.generated_at ?? new Date().toISOString(), sourcePaths = [] } = {}) {
  const workflowItems = workflow?.items ?? [];
  const promotionItems = promotions.filter(Boolean);
  const attention = workflowItems.filter((item) => !['rejected', 'archived'].includes(item.state) || item.source?.freshness === 'stale').map((item) => ({
    review_id: item.review_id,
    source: item.source.source_reference,
    reason: item.source.freshness === 'stale' ? 'stale evidence requires review' : `workflow state is ${item.state}`,
    confidence: item.source.confidence,
    freshness: item.source.freshness,
    uncertainty: item.source.uncertainty,
    review_context: item.review_context ?? null,
    mind_impact: item.source.mind_impact ?? null,
    brain_impact: item.source.brain_impact ?? null,
    requires_human_decision: true,
    available_action: actionFor(item),
    evidence_references: item.source.evidence_references,
  })).sort((a, b) => `${a.available_action}\u0000${a.source}\u0000${a.review_id}`.localeCompare(`${b.available_action}\u0000${b.source}\u0000${b.review_id}`));
  const state = countStates(workflowItems);
  const staleItems = workflowItems.filter((item) => item.source?.freshness === 'stale');
  const conflicts = workflowItems.filter(hasConflict);
  return {
    loop_version: '1.0.0',
    generated_at: generatedAt,
    source: 'infinite-brain-operational-daily-loop',
    source_paths: sourcePaths,
    real_inputs_present: Boolean(briefing || workflow || promotionItems.length),
    current_state: {
      pending_reviews: state.new + state.reviewing,
      accepted_items: state.accepted,
      deferred_items: state.deferred,
      promotion_candidates: promotionItems.filter((item) => ['promotion_candidate', 'awaiting_confirmation', 'approved_for_promotion'].includes(item.state)).length,
      unresolved_conflicts: conflicts.length,
      stale_items: staleItems.length,
      workflow_states: state,
    },
    attention_queue: attention,
    promotion_actions: promotionItems.filter((item) => ['promotion_candidate', 'awaiting_confirmation', 'approved_for_promotion'].includes(item.state)).map((item) => ({ promotion_id: item.promotion_id, source: item.source.source_reference, state: item.state, available_action: item.state === 'promotion_candidate' ? 'prepare promotion' : 'review', rollback_reference: item.rollback_reference })),
    limitations: ['no automatic scheduling', 'no automatic promotion', 'no canonical Mind or Brain writes', 'no provider calls', 'no new intelligence sources'],
    invariants: {
      writes_to_mind: false,
      writes_to_brain_canonical: false,
      automatic_scheduling: false,
      automatic_promotion: false,
      provider_calls: false,
      new_storage_authority: false,
    },
  };
}

export function renderDailyIntelligenceLoop(loop) {
  const state = loop.current_state;
  const lines = ['# Infinite Brain Daily Intelligence Loop', '', `Generated: ${loop.generated_at}`, `Real runtime inputs present: ${loop.real_inputs_present}`, '', '## Current state', '', `- Pending reviews: ${state.pending_reviews}`, `- Accepted items: ${state.accepted_items}`, `- Deferred items: ${state.deferred_items}`, `- Promotion candidates: ${state.promotion_candidates}`, `- Unresolved conflicts: ${state.unresolved_conflicts}`, `- Stale items: ${state.stale_items}`, '', '## Human attention', ''];
  for (const item of loop.attention_queue) lines.push(`### ${item.review_id}`, '', `- Source: ${item.source}`, `- Why: ${item.reason}`, `- Confidence: ${item.confidence}; freshness: ${item.freshness}; uncertainty: ${Array.isArray(item.uncertainty) ? item.uncertainty.join('; ') : item.uncertainty}`, `- Review context: ${item.review_context?.attention_summary ?? 'advisory context not supplied'}`, `- Mind impact: ${item.mind_impact}; Brain impact: ${item.brain_impact}; requires human decision: ${item.requires_human_decision}`, `- Available action: ${item.available_action}`, `- Evidence: ${item.evidence_references.join(', ') || 'source reference only'}`, '');
  if (!loop.attention_queue.length) lines.push('_No current workflow items require attention._', '');
  lines.push('## Promotion preparation', '');
  for (const item of loop.promotion_actions) lines.push(`- ${item.promotion_id}: ${item.state}; action: ${item.available_action}; source: ${item.source}; rollback: ${item.rollback_reference}`, '');
  if (!loop.promotion_actions.length) lines.push('_No active promotion candidates._', '');
  lines.push('This is a read-only operating view. It does not schedule, decide, promote, execute, or write canonical state.', '');
  return `${lines.join('\n')}\n`;
}

export function writeDailyIntelligenceLoop({ loop, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'daily-loop'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_daily_loop_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(resolved, 'latest.json');
  const markdownPath = path.join(resolved, 'latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(loop, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(markdownPath, renderDailyIntelligenceLoop(loop), { mode: 0o600 });
  return { jsonPath, markdownPath };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const repoRoot = process.cwd();
  const inputs = loadDailyIntelligenceInputs(repoRoot);
  const loop = buildDailyIntelligenceLoop({ briefing: inputs.briefing.value, workflow: inputs.workflow.value, promotions: inputs.promotions, sourcePaths: inputs.source_paths });
  const outputs = writeDailyIntelligenceLoop({ loop, repoRoot });
  process.stdout.write(`${outputs.markdownPath}\n`);
}
