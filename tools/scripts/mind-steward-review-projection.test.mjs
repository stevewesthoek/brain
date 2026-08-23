import assert from 'node:assert/strict';
import test from 'node:test';

import { projectIngestionReview, renderIngestionReviewMarkdown } from './mind-steward-review-projection.mjs';

function report() {
  return {
    generated_at: '2026-08-23T12:00:00Z',
    source: 'mind/inbox/new',
    writes_to_mind: false,
    automatic_promotion: false,
    envelopes: [{
      identity: {
        ingestion_id: 'ingestion:test',
        source_reference: { ref: 'mind/inbox/new/note.md', kind: 'source', hash: 'sha256:test' },
        created_at: '2026-08-23T12:00:00Z', source_revision: 'sha256:test',
      },
      content: {
        detected_format: 'text/markdown', metadata: { filename: 'note.md' }, confidence: 0.9,
        uncertainty: ['meaning requires review'],
      },
      governance: { mind_impact: 'possible', brain_impact: 'none', privacy_classification: 'internal', freshness: 'fresh', review_required: true },
      evidence: { source_references: [{ ref: 'mind/inbox/new/note.md', kind: 'source' }] },
    }],
    failures: [{ file: 'unsupported.pdf', code: 'unsupported_file_type', message: 'unsupported' }],
  };
}

test('projection exposes per-item identity, understanding, governance, and decision state', () => {
  const projection = projectIngestionReview(report());
  assert.equal(projection.items[0].review_state, 'needs_review');
  assert.deepEqual(projection.items[0].decision_options, ['needs_review', 'accepted', 'rejected', 'deferred', 'archived']);
  assert.equal(projection.items[0].source_hash, 'sha256:test');
  assert.equal(projection.items[0].privacy, 'internal');
  assert.equal(projection.items[0].promotion_authority, 'human-approved-bounded-transaction');
  assert.equal(projection.failures[0].review_state, 'needs_review');
});

test('rendering is deterministic and explicitly non-promoting', () => {
  const projection = projectIngestionReview(report());
  const markdown = renderIngestionReviewMarkdown(projection);
  assert.equal(markdown, renderIngestionReviewMarkdown(projection));
  assert.match(markdown, /Mind Inbox Human Review/);
  assert.match(markdown, /note\.md/);
  assert.match(markdown, /unsupported\.pdf/);
  assert.match(markdown, /Review states are workflow states only/);
  assert.match(markdown, /Writes to Mind: false/);
  assert.match(markdown, /Automatic promotion: false/);
});
