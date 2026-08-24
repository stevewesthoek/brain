import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const STATES = ['new', 'reviewing', 'accepted', 'rejected', 'deferred', 'archived'];
const DECISIONS = new Set(['accepted', 'rejected', 'deferred', 'archived']);

function workflowId(item) {
  if (!item?.review_id || !item.source_reference) throw new Error('review identity is required');
  return item.review_id;
}

function sourceSnapshot(item) {
  return {
    source_reference: item.source_reference,
    evidence_references: item.briefing?.supporting_evidence ?? item.provenance?.evidence_references ?? [],
    ingestion_or_review_id: item.ingestion_id ?? item.review_id,
    timestamp: item.timestamp ?? null,
    source_hash: item.source_hash ?? null,
    authority_owner: item.authority_owner ?? null,
    freshness: item.freshness ?? 'unknown',
    confidence: item.confidence ?? null,
    uncertainty: item.uncertainty ?? [],
    repository_evidence: item.repository_evidence ?? [],
  };
}

function actionId(item, state, at, reviewer) {
  return `review-action:${crypto.createHash('sha256').update(`${item.review_id}|${state}|${at}|${reviewer}`).digest('hex').slice(0, 24)}`;
}

export function createReviewWorkflowItem(item, previous = null) {
  const reviewId = workflowId(item);
  const prior = previous?.review_id === reviewId ? previous : null;
  return {
    schema_version: '1.0.0',
    review_id: reviewId,
    state: prior?.state ?? 'new',
    source: sourceSnapshot(item),
    review_context: item.briefing ?? null,
    history: prior?.history ?? [],
    unresolved: prior ? !['accepted', 'rejected', 'archived'].includes(prior.state) : true,
    evidence_preserved: true,
    writes_to_mind: false,
    writes_to_brain_canonical: false,
    automatic_promotion: false,
    provider_calls: false,
  };
}

export function buildReviewWorkflow({ briefing, previous = [] } = {}) {
  if (!briefing?.attention_queue || !Array.isArray(briefing.attention_queue)) throw new Error('unified briefing attention_queue is required');
  const previousById = new Map();
  for (const record of previous) {
    if (previousById.has(record.review_id)) throw new Error(`duplicate prior review: ${record.review_id}`);
    previousById.set(record.review_id, record);
  }
  const seen = new Set();
  const items = briefing.attention_queue.map((entry) => {
    const id = workflowId(entry);
    if (seen.has(id)) throw new Error(`duplicate review item: ${id}`);
    seen.add(id);
    return createReviewWorkflowItem(entry, previousById.get(id));
  });
  return {
    workflow_version: '1.0.0',
    generated_at: briefing.generated_at,
    source: briefing.source,
    items,
    counts: Object.fromEntries(STATES.map((state) => [state, items.filter((item) => item.state === state).length])),
    invariants: {
      writes_to_mind: false,
      writes_to_brain_canonical: false,
      automatic_promotion: false,
      automatic_decisions: false,
      provider_calls: false,
      new_storage_authority: false,
    },
  };
}

export function transitionReviewItem(item, { state, reason, decidedAt, reviewer, sourceReference } = {}) {
  if (!STATES.includes(state)) throw new Error(`invalid review state: ${state}`);
  if (!decidedAt) throw new Error('decision timestamp is required');
  if (!reviewer) throw new Error('reviewer is required');
  if (sourceReference !== item.source.source_reference) throw new Error('decision source reference must match review source');
  if (DECISIONS.has(state) && !reason) throw new Error(`reason is required for ${state}`);
  const action = {
    action_id: actionId(item.source, state, decidedAt, reviewer),
    state,
    reason: reason ?? null,
    decided_at: decidedAt,
    reviewer,
    source_reference: sourceReference,
  };
  return {
    ...item,
    state,
    history: [...item.history, action],
    unresolved: !['accepted', 'rejected', 'archived'].includes(state),
  };
}

export function applyReviewAction(workflow, { reviewId, state, reason, decidedAt, reviewer, sourceReference } = {}) {
  const item = workflow.items.find((candidate) => candidate.review_id === reviewId);
  if (!item) throw new Error(`unknown review item: ${reviewId}`);
  return {
    ...workflow,
    items: workflow.items.map((candidate) => candidate.review_id === reviewId
      ? transitionReviewItem(candidate, { state, reason, decidedAt, reviewer, sourceReference })
      : candidate),
    counts: Object.fromEntries(STATES.map((candidateState) => [candidateState, workflow.items.filter((candidate) => (candidate.review_id === reviewId ? state : candidate.state) === candidateState).length])),
  };
}

export function renderReviewWorkflow(workflow) {
  const lines = ['# Infinite Brain Unified Review Workflow', '', `Generated: ${workflow.generated_at}`, '', '- Workflow state is not canonical knowledge.', '- Evidence is retained; every terminal decision requires an explicit human reason.', '- Writes to Mind: false; writes to Brain canonical: false; automatic promotion: false', ''];
  for (const item of workflow.items) {
    lines.push(`## ${item.review_id}`, '', `- State: **${item.state}**`, `- Source: ${item.source.source_reference}`, `- Evidence: ${item.source.evidence_references.join(', ') || 'source reference only'}`, `- Freshness: ${item.source.freshness}; confidence: ${item.source.confidence}; uncertainty: ${Array.isArray(item.source.uncertainty) ? item.source.uncertainty.join('; ') : item.source.uncertainty}`, `- History entries: ${item.history.length}`, `- Unresolved: ${item.unresolved}`, '');
  }
  return `${lines.join('\n')}\n`;
}

export function writeReviewWorkflow({ workflow, repoRoot = process.cwd(), outputRoot } = {}) {
  const resolved = path.resolve(outputRoot ?? path.join(repoRoot, 'runtime', 'local', 'mind-steward', 'unified-review'));
  const allowed = path.resolve(repoRoot, 'runtime', 'local', 'mind-steward');
  if (resolved !== allowed && !resolved.startsWith(`${allowed}${path.sep}`)) throw new Error('unsafe_review_workflow_output');
  fs.mkdirSync(resolved, { recursive: true, mode: 0o700 });
  const jsonPath = path.join(resolved, 'workflow-latest.json');
  const markdownPath = path.join(resolved, 'workflow-latest.md');
  fs.writeFileSync(jsonPath, `${JSON.stringify(workflow, null, 2)}\n`, { mode: 0o600 });
  fs.writeFileSync(markdownPath, renderReviewWorkflow(workflow), { mode: 0o600 });
  return { jsonPath, markdownPath };
}
