import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildConversationEvidenceReport, createConversationEvidence, createConversationEvidenceAdapter, extractConversationCandidates, ingestConversationEvidence, readConversationEvidenceFile, readSessionMetadata, writeConversationEvidence } from './mind-steward-conversation-evidence.mjs';

const session = { provider: 'codex', session_id: 'session-1', repository: 'brain', workspace: 'brain-main', transcript_read: false };

test('creates bounded candidate evidence with session provenance', () => {
  const envelope = createConversationEvidence({ session: { ...session, timestamp: '2026-08-23T11:00:00Z', freshness: 'fresh' }, asOf: '2026-08-23T12:00:00Z', candidates: [{ category: 'decision', statement: 'Use the existing review boundary.', confidence: 0.8 }] });
  assert.equal(envelope.envelope.identity.source_type, 'codex_session');
  assert.equal(envelope.envelope.content.metadata.transcript_read, false);
  assert.equal(envelope.candidate_insights[0].category, 'decision');
  assert.equal(envelope.envelope.governance.privacy_classification, 'restricted');
  assert.equal(envelope.envelope.governance.review_required, true);
  assert.equal(envelope.writes_to_mind, false);
  assert.equal(envelope.automatic_promotion, false);
  assert.equal(envelope.candidate_insights[0].source_session_id, 'session-1');
  assert.equal(envelope.candidate_insights[0].repository, 'brain');
  assert.equal(envelope.candidate_insights[0].freshness, 'fresh');
});

test('supports Claude, Codex, and Workbench metadata references without automatic scanning', () => {
  for (const provider of ['claude', 'codex', 'workbench']) {
    const metadata = readSessionMetadata({ provider });
    assert.equal(metadata.provider, provider);
    assert.equal(metadata.transcript_read, false);
  }
});

test('rejects transcript dumping, invalid providers, and unbounded candidates', () => {
  assert.throws(() => createConversationEvidence({ session: { ...session, transcript_read: true } }), /full_transcript/);
  assert.throws(() => createConversationEvidence({ session: { provider: 'unknown', session_id: 'x' } }), /supported provider/);
  assert.throws(() => createConversationEvidence({ session, candidates: [{ category: 'decision', statement: 'x'.repeat(1001) }] }), /bounded/);
  assert.throws(() => extractConversationCandidates({ session, records: [{ messages: ['private transcript'] }] }), /raw_transcript/);
  const redacted = createConversationEvidence({ session, candidates: [{ category: 'decision', statement: `Use api_key=${['super', 'secret-value'].join('-')}` }] });
  assert.equal(redacted.candidate_insights[0].statement, `Use ${'api' + '_key'}=[REDACTED_SECRET]`);
  assert.equal(redacted.candidate_insights[0].redactions, 1);
  assert.throws(() => createConversationEvidence({ session, candidates: [{ category: 'decision', statement: 'Use the review boundary.', repository: 'other-repo' }] }), /conflicting_repository/);
});

test('extracts only bounded structured candidate records and preserves stale status', () => {
  const candidates = extractConversationCandidates({ session: { ...session, timestamp: '2026-08-20T12:00:00Z', freshness: 'stale' }, records: [{ category: 'lesson', statement: 'Keep review decisions separate.', confidence: 0.7 }] });
  assert.equal(candidates[0].category, 'lesson');
  assert.equal(candidates[0].freshness, 'stale');
  assert.equal(candidates[0].actor, 'human');
  assert.equal(candidates[0].claim_type, 'user_statement');
  assert.match(candidates[0].event_id, /^event:conversation-/);
});

test('expands bounded decision and outcome signals while attaching context', () => {
  const candidates = extractConversationCandidates({ session, records: [{ signals: { decision: 'Keep human review authoritative.', validated_solution: 'Focused tests pass.', unresolved_question: 'Should discovery remain deferred?' }, context: { repository: 'brain', reason: 'benchmark correction' } }] });
  assert.deepEqual(candidates.map(candidate => candidate.category), ['decision', 'validation', 'unresolved_question']);
  assert.match(candidates[0].statement, /reason: benchmark correction/);
  assert.equal(candidates[1].context.repository, 'brain');
});

test('rejects restricted privacy classes before evidence creation', () => {
  assert.throws(() => extractConversationCandidates({ session, records: [{ category: 'lesson', statement: 'Private personal detail.', privacy_classification: 'personal' }] }), /restricted_conversation/);
  assert.throws(() => createConversationEvidence({ session, candidates: [{ category: 'lesson', statement: 'Credential context.', privacy_classification: 'restricted' }] }), /restricted_conversation/);
});

test('session file access is restricted to the provider-owned session root', () => {
  assert.throws(() => readSessionMetadata({ provider: 'codex', sessionPath: '/tmp/session.jsonl' }), /unsafe_session_path/);
});

test('writes evidence only to Brain runtime-local state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conversation-evidence-'));
  fs.mkdirSync(path.join(root, 'runtime', 'local', 'mind-steward'), { recursive: true });
  const envelope = createConversationEvidence({ session, asOf: '2026-08-23T12:00:00Z' });
  const filePath = writeConversationEvidence({ envelope, repoRoot: root });
  assert.ok(filePath.startsWith(path.join(root, 'runtime', 'local', 'mind-steward')));
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).writes_to_mind, false);
  assert.equal(readConversationEvidenceFile({ filePath, repoRoot: root }).identity.source_type, 'codex_session');
  assert.throws(() => readConversationEvidenceFile({ filePath: path.join(root, 'outside.json'), repoRoot: root }), /unsafe_conversation_input/);
  const tampered = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  tampered.candidate_insights = [{ category: 'decision', statement: `api_key=${'secret' + '-value'}`, source_session_id: 'other-session' }];
  fs.writeFileSync(filePath, `${JSON.stringify(tampered)}\n`);
  assert.throws(() => readConversationEvidenceFile({ filePath, repoRoot: root }), /conflicting_session/);
});

test('adapter contract is bounded, provider-neutral, and watermarkable', () => {
  const adapter = createConversationEvidenceAdapter({ provider: 'claude' });
  assert.deepEqual(adapter.health(), { adapter_id: 'mind-steward-conversation-evidence-v2', provider: 'claude', supported: true, bounded: true, raw_transcript_reads: false, provider_calls: false, report_only: true });
  assert.equal(adapter.discover_since({ watermark: '2026-08-24T00:00:00Z', records: [{ observed_at: '2026-08-23T23:59:00Z' }, { observed_at: '2026-08-24T00:01:00Z' }] }).length, 1);
  assert.equal(adapter.verify_source({ content: 'raw transcript' }), false);
});

test('classifies actors and routes infrastructure evidence to IKHP without writes', () => {
  const result = ingestConversationEvidence({
    session: { ...session, timestamp: '2026-09-01T12:00:00Z' },
    asOf: '2026-09-02T12:00:00Z',
    records: [
      { category: 'lesson', statement: 'The review boundary is explicit.', actor: 'human' },
      { category: 'validation', statement: 'The service is healthy.', actor: 'assistant', claim_key: 'service-x-health', polarity: 'positive' },
      { category: 'validation', statement: 'The service is unavailable.', actor: 'tool', claim_key: 'service-x-health', polarity: 'negative' },
    ],
  });
  assert.equal(result.events[0].claim_type, 'user_statement');
  assert.equal(result.events[1].claim_type, 'assistant_statement');
  assert.equal(result.events[2].claim_type, 'tool_observation');
  assert.equal(result.report.infrastructure_evidence.length, 2);
  assert.equal(result.report.infrastructure_evidence[0].routing_target, 'ikhp:evidence-candidate');
  assert.equal(result.report.contradictions.length, 1);
  assert.equal(result.report.invariants.ikhp_canonical_mutation, false);
  assert.equal(result.report.invariants.writes_to_mind, false);
});

test('deduplicates repeated events and marks stale evidence without resolving it', () => {
  const first = ingestConversationEvidence({ session, asOf: '2026-09-01T00:00:00Z', records: [{ category: 'validation', statement: 'The service is healthy.', actor: 'tool', claim_key: 'service-health', polarity: 'positive', observed_at: '2026-07-01T00:00:00Z' }] });
  const second = ingestConversationEvidence({ session, asOf: '2026-09-01T00:00:00Z', existingEvents: first.events, records: [{ category: 'validation', statement: 'The service is healthy.', actor: 'tool', claim_key: 'service-health', polarity: 'positive', observed_at: '2026-07-01T00:00:00Z' }] });
  assert.equal(second.report.evidence_count, 1);
  assert.equal(second.report.duplicate_count, 1);
  assert.equal(second.report.stale_evidence.length, 1);
  assert.equal(second.checkpoint.event_count, 1);
});
