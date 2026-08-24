import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { attachEvidencePreviews, buildEvidencePreview } from './mind-steward-evidence-preview.mjs';

function makeItem({ sourceReference = 'mind/inbox/new/example.md', content = 'Evidence body', sourceHash, reviewId = 'review:example:1' } = {}) {
  const hash = sourceHash ?? `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
  return {
    review_id: reviewId,
    state: 'new',
    source: {
      source_reference: sourceReference,
      source_hash: hash,
      ingestion_or_review_id: 'ingestion:example:1',
      evidence_references: [sourceReference, hash],
      authority_owner: 'external-source',
      freshness: 'fresh',
      confidence: 1,
      uncertainty: ['meaning requires human review'],
    },
  };
}

function fixture(content = 'Evidence body') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evidence-preview-'));
  const sourceDir = path.join(root, 'inbox', 'new');
  fs.mkdirSync(sourceDir, { recursive: true });
  const sourcePath = path.join(sourceDir, 'example.md');
  fs.writeFileSync(sourcePath, content);
  return { root, sourcePath, item: makeItem({ content }) };
}

test('builds a bounded preview with matching provenance and hash', () => {
  const { root, item } = fixture('0123456789');
  const preview = buildEvidencePreview(item, { mindRoot: root, now: new Date(), maxChars: 5 });
  assert.equal(preview.status, 'available');
  assert.equal(preview.content_preview, '01234');
  assert.equal(preview.truncated, true);
  assert.equal(preview.source_hash, item.source.source_hash);
  assert.equal(preview.ingestion_id, item.source.ingestion_or_review_id);
  assert.equal(preview.safety.writes_to_mind, false);
});

test('reports unavailable source without weakening provenance', () => {
  const preview = buildEvidencePreview(makeItem(), { mindRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'missing-source-')) });
  assert.equal(preview.status, 'unavailable');
  assert.equal(preview.reason, 'source_unavailable');
  assert.equal(preview.content_preview, null);
  assert.equal(preview.source_hash.startsWith('sha256:'), true);
});

test('reports stale source without hiding bounded content', () => {
  const { root, sourcePath, item } = fixture();
  const old = Date.now() - 10_000;
  fs.utimesSync(sourcePath, old / 1000, old / 1000);
  const preview = buildEvidencePreview(item, { mindRoot: root, now: new Date(), staleAfterMs: 1_000 });
  assert.equal(preview.status, 'available');
  assert.equal(preview.freshness, 'stale');
  assert.equal(preview.reason, 'source exceeds preview freshness window');
});

test('fails closed on invalid provenance and hash mismatch', () => {
  const { root, item } = fixture();
  assert.equal(buildEvidencePreview({ ...item, source: { ...item.source, source_hash: 'not-a-hash' } }, { mindRoot: root }).reason, 'invalid_provenance');
  assert.equal(buildEvidencePreview({ ...item, source: { ...item.source, source_hash: `sha256:${'0'.repeat(64)}` } }, { mindRoot: root }).reason, 'source_hash_mismatch');
});

test('rejects duplicate identities and preserves empty runtime state', () => {
  assert.deepEqual(attachEvidencePreviews({ items: [] }, { mindRoot: '/nonexistent' }).items, []);
  const item = makeItem();
  assert.throws(() => attachEvidencePreviews({ items: [item, item] }, { mindRoot: '/nonexistent' }), /duplicate review identity/);
});
