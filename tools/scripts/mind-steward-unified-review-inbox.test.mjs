import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildUnifiedReviewInbox, renderUnifiedReviewInbox, writeUnifiedReviewInbox } from './mind-steward-unified-review-inbox.mjs';

test('combines all evidence producer classes without changing authority', () => {
  const projection = buildUnifiedReviewInbox({
    generatedAt: '2026-08-23T12:00:00Z',
    ingestion: [{ source_file: 'mind/inbox/new/a.md', source_hash: 'sha256:a', extracted_information: 'capture' }],
    pdf: [{ source_file: 'mind/inbox/new/a.pdf', source_hash: 'sha256:b', extracted_information: 'pdf text', freshness: 'fresh' }],
    conversations: [{ source_reference: { ref: 'session:codex:s1' }, source_revision: 'sha256:c', statement: 'candidate decision', authority_owner: 'external-source' }],
    maintenance: [{ file: 'maintenance/report', message: 'stale capture', confidence: 0.8 }],
    lifecycle: [{ reference: 'lifecycle:item', title: 'deferred lifecycle item' }],
    feedback: [{ reference: 'feedback:1', message: 'operator friction', brain_impact: 'possible' }],
  });
  assert.equal(projection.items.length, 6);
  assert.deepEqual(projection.review_states, ['needs_review', 'accepted', 'rejected', 'deferred', 'archived']);
  assert.ok(projection.items.every((item) => item.requires_human_decision === true));
  assert.equal(projection.invariants.automatic_decisions, false);
  assert.equal(projection.invariants.duplicate_authority, false);
});

test('rendering is deterministic and exposes impact/provenance fields', () => {
  const projection = buildUnifiedReviewInbox({ generatedAt: '2026-08-23T12:00:00Z', feedback: [{ reference: 'feedback:1', message: 'friction' }] });
  const markdown = renderUnifiedReviewInbox(projection);
  assert.equal(markdown, renderUnifiedReviewInbox(projection));
  assert.match(markdown, /Authority owner/);
  assert.match(markdown, /Mind impact/);
  assert.match(markdown, /Brain impact/);
  assert.match(markdown, /Requires human decision: true/);
  assert.match(markdown, /Automatic promotion: false/);
});

test('output is restricted to Brain runtime-local review state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unified-review-'));
  fs.mkdirSync(path.join(root, 'runtime', 'local', 'mind-steward'), { recursive: true });
  const projection = buildUnifiedReviewInbox({ feedback: [{ reference: 'feedback:1', message: 'friction' }] });
  const paths = writeUnifiedReviewInbox({ projection, repoRoot: root });
  assert.ok(paths.jsonPath.startsWith(path.join(root, 'runtime', 'local', 'mind-steward')));
  assert.equal(JSON.parse(fs.readFileSync(paths.jsonPath, 'utf8')).invariants.writes_to_mind, false);
  assert.throws(() => writeUnifiedReviewInbox({ projection, repoRoot: root, outputRoot: path.join(root, 'outside') }), /unsafe_unified_review_output/);
});
