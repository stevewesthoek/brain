import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {cleanupArtifacts, planArtifactCleanup} from '../src/intake/artifact-retention.mjs';

function makeDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeReceipt(root, {captureId, reviewedAt, decision = 'approved'}) {
  const dir = path.join(root, 'inbox', 'processed');
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, `${captureId}.md`), [
    '---',
    `capture_id: ${JSON.stringify(captureId)}`,
    `reviewed_at: ${JSON.stringify(reviewedAt)}`,
    `decision: ${JSON.stringify(decision)}`,
    '---',
    '',
    '# Evermind review receipt',
    '',
  ].join('\n'));
}

function writeArtifact(artifactRoot, captureId, name = 'original.bin', bytes = 128) {
  const dir = path.join(artifactRoot, captureId);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, name), Buffer.alloc(bytes, 7));
  return dir;
}

test('cleanup retains unreviewed artifacts regardless of age', () => {
  const root = makeDir('evermind-retention-root-');
  const artifactRoot = makeDir('evermind-retention-artifacts-');
  const id = '11111111-1111-4111-8111-111111111111';
  writeArtifact(artifactRoot, id);

  const plan = planArtifactCleanup({root, artifactRoot, retentionDays: 7, now: new Date('2026-09-17T12:00:00.000Z')});
  assert.equal(plan.eligible.length, 0);
  assert.equal(plan.retained[0].reason, 'not_reviewed');
  assert.equal(fs.existsSync(path.join(artifactRoot, id)), true);
});

test('cleanup retains reviewed artifacts during the seven-day grace period', () => {
  const root = makeDir('evermind-retention-root-');
  const artifactRoot = makeDir('evermind-retention-artifacts-');
  const id = '22222222-2222-4222-8222-222222222222';
  writeArtifact(artifactRoot, id);
  writeReceipt(root, {captureId: id, reviewedAt: '2026-09-15T12:00:00.000Z'});

  const plan = planArtifactCleanup({root, artifactRoot, retentionDays: 7, now: new Date('2026-09-17T12:00:00.000Z')});
  assert.equal(plan.eligible.length, 0);
  assert.equal(plan.retained[0].reason, 'within_grace_period');
});

test('dry-run reports eligible artifacts but does not delete them', () => {
  const root = makeDir('evermind-retention-root-');
  const artifactRoot = makeDir('evermind-retention-artifacts-');
  const receiptRoot = makeDir('evermind-retention-receipts-');
  const id = '33333333-3333-4333-8333-333333333333';
  writeArtifact(artifactRoot, id, 'video.mp4', 1024);
  writeReceipt(root, {captureId: id, reviewedAt: '2026-09-01T12:00:00.000Z'});

  const result = cleanupArtifacts({
    root,
    artifactRoot,
    receiptRoot,
    retentionDays: 7,
    now: new Date('2026-09-17T12:00:00.000Z'),
  });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.eligible.length, 1);
  assert.equal(result.removed.length, 0);
  assert.equal(result.bytesEligible, 1024);
  assert.equal(fs.existsSync(path.join(artifactRoot, id)), true);
  assert.equal(fs.existsSync(result.receiptFile), true);
});

test('apply deletes only artifacts whose reviewed grace period has expired', () => {
  const root = makeDir('evermind-retention-root-');
  const artifactRoot = makeDir('evermind-retention-artifacts-');
  const receiptRoot = makeDir('evermind-retention-receipts-');
  const expired = '44444444-4444-4444-8444-444444444444';
  const fresh = '55555555-5555-4555-8555-555555555555';
  const unreviewed = '66666666-6666-4666-8666-666666666666';
  writeArtifact(artifactRoot, expired, 'old.mov', 256);
  writeArtifact(artifactRoot, fresh, 'fresh.pdf', 256);
  writeArtifact(artifactRoot, unreviewed, 'pending.pdf', 256);
  writeReceipt(root, {captureId: expired, reviewedAt: '2026-09-01T12:00:00.000Z'});
  writeReceipt(root, {captureId: fresh, reviewedAt: '2026-09-15T12:00:00.000Z', decision: 'rejected'});

  const result = cleanupArtifacts({
    root,
    artifactRoot,
    receiptRoot,
    retentionDays: 7,
    now: new Date('2026-09-17T12:00:00.000Z'),
    apply: true,
  });

  assert.equal(result.removed.length, 1);
  assert.equal(result.removed[0].captureId, expired);
  assert.equal(fs.existsSync(path.join(artifactRoot, expired)), false);
  assert.equal(fs.existsSync(path.join(artifactRoot, fresh)), true);
  assert.equal(fs.existsSync(path.join(artifactRoot, unreviewed)), true);
});

test('unrecognized artifact directories are never auto-deleted', () => {
  const root = makeDir('evermind-retention-root-');
  const artifactRoot = makeDir('evermind-retention-artifacts-');
  fs.mkdirSync(path.join(artifactRoot, 'manual-files'));
  fs.writeFileSync(path.join(artifactRoot, 'manual-files', 'keep.txt'), 'keep');

  const plan = planArtifactCleanup({root, artifactRoot, retentionDays: 7, now: new Date('2026-09-17T12:00:00.000Z')});
  assert.equal(plan.eligible.length, 0);
  assert.equal(plan.retained[0].reason, 'unrecognized_artifact_directory');
  assert.equal(fs.existsSync(path.join(artifactRoot, 'manual-files', 'keep.txt')), true);
});

test('reviewed artifact symlinks cannot escape the artifact root', () => {
  const root = makeDir('evermind-retention-root-');
  const artifactRoot = makeDir('evermind-retention-artifacts-');
  const outside = makeDir('evermind-retention-outside-');
  const id = '77777777-7777-4777-8777-777777777777';
  writeReceipt(root, {captureId: id, reviewedAt: '2026-09-01T12:00:00.000Z'});
  fs.symlinkSync(outside, path.join(artifactRoot, id));
  assert.throws(() => planArtifactCleanup({root, artifactRoot, retentionDays: 7, now: new Date('2026-09-17T12:00:00.000Z')}), /unsafe_artifact_directory/);
  assert.equal(fs.readdirSync(outside).length, 0);
});
