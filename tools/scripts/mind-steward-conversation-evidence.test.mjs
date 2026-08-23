import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createConversationEvidence, readSessionMetadata, writeConversationEvidence } from './mind-steward-conversation-evidence.mjs';

const session = { provider: 'codex', session_id: 'session-1', repository: 'brain', workspace: 'brain-main', transcript_read: false };

test('creates bounded candidate evidence with session provenance', () => {
  const envelope = createConversationEvidence({ session, asOf: '2026-08-23T12:00:00Z', candidates: [{ category: 'decision', statement: 'Use the existing review boundary.', confidence: 0.8 }] });
  assert.equal(envelope.envelope.identity.source_type, 'codex_session');
  assert.equal(envelope.envelope.content.metadata.transcript_read, false);
  assert.equal(envelope.candidate_insights[0].category, 'decision');
  assert.equal(envelope.envelope.governance.privacy_classification, 'restricted');
  assert.equal(envelope.envelope.governance.review_required, true);
  assert.equal(envelope.writes_to_mind, false);
  assert.equal(envelope.automatic_promotion, false);
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
});
