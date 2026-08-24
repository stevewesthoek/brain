import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildReviewSession, enrichGitHubIngestion, recordDailyReviewDecision, recordDailyReviewDecisions } from './mind-steward-daily-review.mjs';
import { buildGitHubRepositoryEvidence } from './mind-steward-github-repository-evidence.mjs';

function workflow() {
  return {
    items: [{
      review_id: 'review:source:1', state: 'new', history: [],
      source: { source_reference: 'mind/inbox/new/a.md', evidence_references: ['a.md'], source_hash: 'sha256:a', ingestion_or_review_id: 'ingestion:a', timestamp: 'fixed', authority_owner: 'external-source', confidence: 1, freshness: 'fresh', uncertainty: ['review required'] },
    }],
    counts: { new: 1, reviewing: 0, accepted: 0, rejected: 0, deferred: 0, archived: 0 },
  };
}

test('builds a bounded review session from existing workflow state', () => {
  const session = buildReviewSession({ workflow: workflow(), readiness: { status: 'ready', usable_for_daily_review: true }, calibration: { signals: { missing_provenance_items: 0 } }, generatedAt: 'fixed' });
  assert.equal(session.pending.length, 1);
  assert.equal(session.pending[0].ingestion_id, 'ingestion:a');
  assert.deepEqual(session.pending[0].decision_options, ['accepted', 'rejected', 'deferred', 'archived']);
  assert.equal(session.invariants.automatic_promotion, false);
});

test('enriches GitHub evidence only through the explicit opt-in helper', async () => {
  const github = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one' });
  const ingestion = { envelopes: [{ content: { github_repository_evidence: [github] } }], failures: [] };
  const enriched = await enrichGitHubIngestion({
    ingestion,
    generatedAt: '2026-08-24T12:00:00Z',
    fetchImpl: async (url) => url.endsWith('/releases/latest') ? { ok: false, status: 404, async json() { return {}; } } : { ok: true, status: 200, async json() { return { stargazers_count: 7 }; } },
  });
  assert.equal(enriched.envelopes[0].content.github_repository_evidence[0].metadata.stars.value, 7);
  assert.equal(enriched.envelopes[0].content.github_repository_evidence[0].fit_assessment.disposition.advisory_only, true);
  assert.equal(enriched.envelopes[0].content.github_repository_evidence[0].review_required, true);
});

test('keeps documentation enrichment behind its explicit opt-in boundary', async () => {
  const github = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one' });
  const ingestion = { envelopes: [{ content: { github_repository_evidence: [github] } }], failures: [] };
  const enriched = await enrichGitHubIngestion({ ingestion, includeDocumentation: true, systemCapabilities: [], fetchImpl: async (url) => {
    if (url.endsWith('/readme')) return { ok: true, status: 200, async json() { return { content: Buffer.from('# Example\n\nA documented tool.').toString('base64') }; } };
    if (url.endsWith('/releases/latest')) return { ok: false, status: 404, async json() { return {}; } };
    return { ok: true, status: 200, async json() { return { description: 'A documented tool for context', language: 'TypeScript' }; } };
  } });
  assert.equal(enriched.envelopes[0].content.github_repository_evidence[0].documentation_status, 'available');
  assert.equal(enriched.envelopes[0].content.github_repository_evidence[0].fit_assessment.evidence_quality.documentation_status, 'available');
});

test('keeps architecture enrichment behind its explicit opt-in boundary', async () => {
  const github = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one' });
  const ingestion = { envelopes: [{ content: { github_repository_evidence: [github] } }], failures: [] };
  const enriched = await enrichGitHubIngestion({ ingestion, includeArchitecture: true, systemCapabilities: [], fetchImpl: async (url) => {
    if (url.endsWith('/readme')) return { ok: true, status: 200, async json() { return { content: Buffer.from('# Example\n\nA documented tool.\n\n## Architecture\n- API\n\n## Deployment\n- Docker').toString('base64') }; } };
    if (url.endsWith('/releases/latest')) return { ok: false, status: 404, async json() { return {}; } };
    return { ok: true, status: 200, async json() { return { description: 'A documented tool for context', language: 'TypeScript' }; } };
  } });
  const item = enriched.envelopes[0].content.github_repository_evidence[0];
  assert.equal(item.architecture_status, 'available');
  assert.deepEqual(item.fit_assessment.purpose.architecture.components, ['API']);
  assert.equal(item.fit_assessment.evidence_quality.architecture_status, 'available');
});

test('records an explicit human decision without canonical mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-review-'));
  const workflowRoot = path.join(root, 'runtime', 'local', 'mind-steward', 'unified-review');
  fs.mkdirSync(workflowRoot, { recursive: true });
  fs.writeFileSync(path.join(workflowRoot, 'workflow-latest.json'), `${JSON.stringify(workflow())}\n`);
  const session = recordDailyReviewDecision({ repoRoot: root, reviewId: 'review:source:1', state: 'deferred', reason: 'needs Mind context', reviewer: 'human', sourceReference: 'mind/inbox/new/a.md', decidedAt: 'fixed' });
  assert.equal(session.pending[0].review_id, 'review:source:1');
  assert.equal(JSON.parse(fs.readFileSync(path.join(workflowRoot, 'workflow-latest.json'), 'utf8')).items[0].state, 'deferred');
  assert.equal(session.invariants.writes_to_mind, false);
});

test('projects explicit conversation evidence into the existing review workflow', async () => {
  const github = buildGitHubRepositoryEvidence({ url: 'https://github.com/a/one' });
  const conversation = {
    identity: { ingestion_id: 'ingestion:conversation-test', source_type: 'codex_session', source_reference: { ref: 'session:codex:session-test', kind: 'session', hash: 'sha256:conversation' }, created_at: '2026-08-24T12:00:00Z', source_revision: 'sha256:conversation' },
    provenance: { origin: 'codex-session-reference', capture_method: 'session_export', adapter: 'test', captured_at: '2026-08-24T11:00:00Z', authority_context: { authority_owner: 'external-source', domain: 'external', source_of_authority: { ref: 'session:codex:session-test', kind: 'session', hash: 'sha256:conversation' } } },
    content: { detected_format: 'application/session-evidence+json', extracted_content_references: [{ ref: 'session:codex:session-test', kind: 'session', hash: 'sha256:conversation' }], metadata: { transcript_read: false }, entities: [], relationships: [], confidence: 0.8, uncertainty: ['human review required'] },
    governance: { mind_impact: 'possible', brain_impact: 'possible', privacy_classification: 'restricted', freshness: 'fresh', review_required: true, promotion_authority: 'human-approved-bounded-transaction' },
    evidence: { source_references: [{ ref: 'session:codex:session-test', kind: 'session', hash: 'sha256:conversation' }], validation_references: [], extraction_confidence: 0.8, uncertainty: ['no full transcript stored'] },
    lifecycle: { state: 'ready_for_review' },
    candidate_insights: [{ candidate_id: 'candidate:test:1', category: 'decision', statement: 'Keep the review boundary human-controlled.', source_session_id: 'session-test', observed_at: '2026-08-24T11:00:00Z', repository: 'brain', freshness: 'fresh', provenance: { source: { ref: 'session:codex:session-test', kind: 'session', hash: 'sha256:conversation' }, retrieved_at: '2026-08-24T12:00:00Z' }, confidence: 0.8, uncertainty: 'requires human review' }],
  };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-review-conversation-'));
  const mindRoot = path.join(root, 'mind');
  fs.mkdirSync(path.join(mindRoot, 'inbox', 'new'), { recursive: true });
  const { runDailyReview } = await import('./mind-steward-daily-review.mjs');
  const session = await runDailyReview({ repoRoot: root, mindRoot, generatedAt: '2026-08-24T12:00:00Z', conversationEvidence: [conversation], systemCapabilities: { capabilities: [] } });
  assert.equal(session.ingestion.envelopes, 0);
  assert.equal(session.pending.length, 1);
  assert.equal(session.pending[0].source, 'session:codex:session-test');
  assert.equal(session.pending[0].requires_human_decision, true);
});

test('records a validated decision batch in one runtime-local write', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-review-batch-'));
  const workflowRoot = path.join(root, 'runtime', 'local', 'mind-steward', 'unified-review');
  fs.mkdirSync(workflowRoot, { recursive: true });
  const first = workflow().items[0];
  const second = { ...first, review_id: 'review:source:2', source: { ...first.source, source_reference: 'mind/inbox/new/b.md' } };
  const initial = { items: [first, second], counts: { new: 2, reviewing: 0, accepted: 0, rejected: 0, deferred: 0, archived: 0 } };
  fs.writeFileSync(path.join(workflowRoot, 'workflow-latest.json'), `${JSON.stringify(initial)}\n`);
  const session = recordDailyReviewDecisions({
    repoRoot: root,
    decisions: [
      { reviewId: 'review:source:1', state: 'deferred', reason: 'needs Mind context', reviewer: 'human', sourceReference: 'mind/inbox/new/a.md', decidedAt: 'fixed-1' },
      { reviewId: 'review:source:2', state: 'accepted', reason: 'retained for review', reviewer: 'human', sourceReference: 'mind/inbox/new/b.md', decidedAt: 'fixed-2' },
    ],
  });
  assert.equal(session.counts.deferred, 1);
  assert.equal(session.counts.accepted, 1);
  assert.equal(session.invariants.automatic_decisions, false);
  const saved = JSON.parse(fs.readFileSync(path.join(workflowRoot, 'workflow-latest.json'), 'utf8'));
  assert.deepEqual(saved.items.map((item) => item.state), ['deferred', 'accepted']);
});

test('rejects a malformed decision batch without partial mutation', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-review-batch-invalid-'));
  const workflowRoot = path.join(root, 'runtime', 'local', 'mind-steward', 'unified-review');
  fs.mkdirSync(workflowRoot, { recursive: true });
  const initial = workflow();
  fs.writeFileSync(path.join(workflowRoot, 'workflow-latest.json'), `${JSON.stringify(initial)}\n`);
  assert.throws(() => recordDailyReviewDecisions({
    repoRoot: root,
    decisions: [
      { reviewId: 'review:source:1', state: 'deferred', reason: 'needs context', reviewer: 'human', sourceReference: 'mind/inbox/new/a.md', decidedAt: 'fixed-1' },
      { reviewId: 'review:source:missing', state: 'accepted', reason: 'invalid', reviewer: 'human', sourceReference: 'mind/inbox/new/missing.md', decidedAt: 'fixed-2' },
    ],
  }));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(workflowRoot, 'workflow-latest.json'), 'utf8')), initial);
});
