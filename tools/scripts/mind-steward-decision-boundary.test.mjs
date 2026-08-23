import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createDecisionArtifact, writeDecisionArtifact } from './mind-steward-decision-boundary.mjs';

const item = {
  source_file: 'mind/inbox/new/note.md',
  ingestion_id: 'ingestion:test',
  source_hash: 'sha256:test',
};

test('accepted creates only a promotion candidate', () => {
  const artifact = createDecisionArtifact({ reviewItem: item, decision: 'accepted', decidedAt: '2026-08-23T12:00:00Z', reviewer: 'human' });
  assert.equal(artifact.outcome.kind, 'promotion_candidate');
  assert.equal(artifact.outcome.status, 'candidate_only');
  assert.equal(artifact.writes_to_mind, false);
  assert.equal(artifact.writes_to_brain_canonical, false);
  assert.equal(artifact.automatic_promotion, false);
});

test('rejected, deferred, and archived preserve reasons and traceable outcomes', () => {
  for (const decision of ['rejected', 'deferred', 'archived']) {
    const artifact = createDecisionArtifact({ reviewItem: item, decision, decidedAt: '2026-08-23T12:00:00Z', reviewer: 'human', reason: `reason-${decision}` });
    assert.equal(artifact.decision, decision);
    assert.equal(artifact.reason, `reason-${decision}`);
    assert.equal(artifact.provenance_preserved, true);
    assert.equal(artifact.source.source_hash, item.source_hash);
  }
});

test('invalid or unreasoned decisions fail closed', () => {
  assert.throws(() => createDecisionArtifact({ reviewItem: item, decision: 'accepted', reviewer: 'human' }), /decidedAt is required/);
  assert.throws(() => createDecisionArtifact({ reviewItem: item, decision: 'rejected', decidedAt: '2026-08-23T12:00:00Z', reviewer: 'human' }), /reason is required/);
  assert.throws(() => createDecisionArtifact({ reviewItem: item, decision: 'promote', decidedAt: '2026-08-23T12:00:00Z', reviewer: 'human' }), /decision must be/);
});

test('decision artifact writes only to Brain runtime-local state', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-decision-'));
  fs.mkdirSync(path.join(root, 'runtime', 'local', 'mind-steward'), { recursive: true });
  const artifact = createDecisionArtifact({ reviewItem: item, decision: 'deferred', decidedAt: '2026-08-23T12:00:00Z', reviewer: 'human', reason: 'later' });
  const filePath = writeDecisionArtifact({ artifact, repoRoot: root });
  assert.ok(filePath.startsWith(path.join(root, 'runtime', 'local', 'mind-steward')));
  assert.equal(JSON.parse(fs.readFileSync(filePath, 'utf8')).writes_to_mind, false);
  assert.throws(() => writeDecisionArtifact({ artifact, repoRoot: root, outputRoot: path.join(root, 'outside') }), /unsafe_decision_output/);
});
