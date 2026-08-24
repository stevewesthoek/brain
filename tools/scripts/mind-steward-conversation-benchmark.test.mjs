import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { extractConversationCandidates } from './mind-steward-conversation-evidence.mjs';

const benchmark = JSON.parse(fs.readFileSync(new URL('../../operations/specs/infinite-brain-conversation-intelligence-benchmark.json', import.meta.url), 'utf8'));
const session = { provider: 'codex', session_id: 'benchmark-session', repository: 'example/repository', workspace: 'example/repository', timestamp: '2026-08-24T16:00:00Z', freshness: 'fresh', transcript_read: false };

test('benchmark fixture has six capture and two exclusion cases', () => {
  assert.equal(benchmark.cases.length, 8);
  assert.equal(benchmark.cases.filter(caseItem => caseItem.expected === 'capture').length, 6);
  assert.equal(benchmark.cases.filter(caseItem => caseItem.expected === 'exclude').length, 2);
  assert.equal(benchmark.raw_transcripts_included, false);
  assert.equal(benchmark.provider_calls, false);
});

test('bounded structured signals cover benchmark capture taxonomy', () => {
  const records = [
    { signals: { architecture: 'Protected deployment boundary.' } },
    { signals: { validated_solution: 'Root cause and repair were validated.' } },
    { signals: { changed_behavior: 'Existing review workflow now carries context.' } },
    { signals: { tradeoff: 'Repository-owned continuity beats hosted history authority.' } },
    { signals: { unresolved_question: 'Should the next validation run after repair?' } },
    { signals: { decision: 'Reject the shortcut because it bypasses review.' } },
  ];
  const candidates = extractConversationCandidates({ session, records });
  assert.equal(candidates.length, 6);
  assert.deepEqual(candidates.map(candidate => candidate.category), ['architecture', 'validation', 'improvement', 'decision', 'unresolved_question', 'decision']);
});

test('benchmark negative cases remain excluded by the bounded input contract', () => {
  assert.throws(() => extractConversationCandidates({ session, records: [{ category: 'temporary_noise', statement: 'progress chatter' }] }), /unsupported_candidate_category/);
  assert.throws(() => extractConversationCandidates({ session, records: [{ category: 'lesson', statement: 'credential payload', privacy_classification: 'restricted' }] }), /restricted_conversation/);
});
