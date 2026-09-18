import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

import {writeRawCapture} from '../src/capture/capture.mjs';
import {
  approveReviewCapture,
  getReviewCapture,
  listReviewQueue,
  rejectReviewCapture,
  resolveDestination,
} from '../src/review/review.mjs';

const cliPath = path.resolve('src/cli/cli.mjs');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-review-'));
}

function capture(root, content = 'A durable lesson worth reviewing.') {
  return writeRawCapture({root, content, sourceType: 'test', provenance: 'review-test'});
}

function runCli(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {encoding: 'utf8'});
}

test('review queue lists and shows raw unreviewed captures', () => {
  const root = makeRoot();
  const created = capture(root);
  const queue = listReviewQueue({root});
  assert.equal(queue.length, 1);
  assert.equal(queue[0].captureId, created.captureId);
  assert.match(queue[0].preview, /durable lesson/);

  const shown = getReviewCapture({root, captureId: created.captureId});
  assert.equal(shown.status, 'raw');
  assert.equal(shown.authority, 'unreviewed');
  assert.equal(shown.content, 'A durable lesson worth reviewing.');
});

test('approval requires an explicit durable destination, archives the source, and writes an audit receipt', () => {
  const root = makeRoot();
  const created = capture(root);
  const result = approveReviewCapture({
    root,
    captureId: created.captureId,
    destination: 'knowledge/testing/approved-note.md',
    reviewedAt: '2026-09-17T12:00:00.000Z',
  });

  assert.equal(result.decision, 'approved');
  assert.equal(result.destination, 'knowledge/testing/approved-note.md');
  assert.equal(fs.readFileSync(path.join(root, result.destination), 'utf8'), 'A durable lesson worth reviewing.\n');
  assert.equal(fs.existsSync(path.join(root, created.relativePath)), false);
  assert.equal(fs.existsSync(path.join(root, result.archivedSource)), true);
  const receipt = fs.readFileSync(path.join(root, result.receipt), 'utf8');
  assert.match(receipt, /decision: "approved"/);
  assert.match(receipt, /knowledge\/testing\/approved-note\.md/);
  assert.equal(listReviewQueue({root}).length, 0);
});

test('approval may use human-edited content instead of copying the raw capture verbatim', () => {
  const root = makeRoot();
  const created = capture(root, 'rough raw note');
  const result = approveReviewCapture({
    root,
    captureId: created.captureId,
    destination: 'projects/example/decision.md',
    content: 'Reviewed and edited durable decision.',
  });
  assert.equal(fs.readFileSync(path.join(root, result.destination), 'utf8'), 'Reviewed and edited durable decision.\n');
});

test('review destinations are exact-path and limited to documented durable roots', () => {
  const root = makeRoot();
  assert.throws(() => resolveDestination(root, ''), /missing_destination/);
  assert.throws(() => resolveDestination(root, '/tmp/out.md'), /invalid_destination/);
  assert.throws(() => resolveDestination(root, '../knowledge/out.md'), /invalid_destination/);
  assert.throws(() => resolveDestination(root, 'inbox/processed/out.md'), /invalid_destination/);
  assert.throws(() => resolveDestination(root, 'system/out.md'), /invalid_destination/);
  assert.throws(() => resolveDestination(root, 'knowledge/out.txt'), /invalid_destination/);
  assert.equal(resolveDestination(root, 'resources/source-note.md').relative, 'resources/source-note.md');
});

test('existing durable destination is never overwritten and capture stays queued', () => {
  const root = makeRoot();
  const created = capture(root);
  const destination = path.join(root, 'knowledge', 'existing.md');
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, 'existing truth\n');

  assert.throws(() => approveReviewCapture({root, captureId: created.captureId, destination: 'knowledge/existing.md'}), /destination_exists/);
  assert.equal(fs.readFileSync(destination, 'utf8'), 'existing truth\n');
  assert.equal(listReviewQueue({root})[0].captureId, created.captureId);
});

test('rejection archives rather than deletes and writes a review receipt', () => {
  const root = makeRoot();
  const created = capture(root);
  const result = rejectReviewCapture({
    root,
    captureId: created.captureId,
    reason: 'Not useful enough to preserve as durable memory.',
    reviewedAt: '2026-09-17T12:05:00.000Z',
  });

  assert.equal(result.decision, 'rejected');
  assert.equal(fs.existsSync(path.join(root, created.relativePath)), false);
  assert.equal(fs.existsSync(path.join(root, result.archivedSource)), true);
  const receipt = fs.readFileSync(path.join(root, result.receipt), 'utf8');
  assert.match(receipt, /decision: "rejected"/);
  assert.match(receipt, /Not useful enough/);
  assert.equal(listReviewQueue({root}).length, 0);
});

test('CLI exposes list, show, approve, and reject review primitives', () => {
  const root = makeRoot();
  const first = capture(root, 'first review item');
  const second = capture(root, 'second review item');

  const listed = runCli(['review', 'list', '--root', root]);
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(JSON.parse(listed.stdout).items.length, 2);

  const shown = runCli(['review', 'show', first.captureId, '--root', root]);
  assert.equal(shown.status, 0, shown.stderr);
  assert.equal(JSON.parse(shown.stdout).capture.content, 'first review item');

  const approved = runCli(['review', 'approve', first.captureId, '--root', root, '--destination', 'knowledge/approved-via-cli.md', '--content', 'edited via CLI']);
  assert.equal(approved.status, 0, approved.stderr);
  assert.equal(fs.readFileSync(path.join(root, 'knowledge', 'approved-via-cli.md'), 'utf8'), 'edited via CLI\n');

  const rejected = runCli(['review', 'reject', second.captureId, '--root', root, '--reason', 'duplicate']);
  assert.equal(rejected.status, 0, rejected.stderr);
  assert.equal(JSON.parse(rejected.stdout).decision, 'rejected');
  assert.equal(listReviewQueue({root}).length, 0);
});
