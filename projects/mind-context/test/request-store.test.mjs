import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {createProcessingFailureRequest, createReviewReadyCaptureRequest} from '../src/review/decision-request.mjs';
import {createRequestStore} from '../src/notifications/request-store.mjs';

const CAPTURE_ID = '33333333-3333-4333-8333-333333333333';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-notification-store-'));
}

test('request store persists validated requests atomically with restrictive permissions', () => {
  const root = tempRoot();
  const store = createRequestStore({root});
  const request = createReviewReadyCaptureRequest({captureId: CAPTURE_ID});
  const record = store.put(request);
  assert.equal(record.state, 'pending');
  assert.deepEqual(store.load(request.requestId).request, request);
  assert.equal(fs.statSync(store.requestsRoot).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(store.requestsRoot, `${request.requestId}.json`)).mode & 0o777, 0o600);
});

test('expired requests become terminal and cannot be replayed', () => {
  let now = 1_000;
  const store = createRequestStore({root: tempRoot(), now: () => now, ttlMs: 100});
  const request = createProcessingFailureRequest({requestId: 'failure-expiry', createdAt: new Date(now).toISOString()});
  store.put(request);
  now = 2_000;
  assert.equal(store.load(request.requestId).state, 'expired');
  assert.equal(store.load(request.requestId).state, 'expired');
});

test('symlinked request store and request files fail closed', () => {
  const root = tempRoot();
  const target = path.join(root, 'real-store');
  fs.mkdirSync(target);
  const link = path.join(root, 'linked-store');
  fs.symlinkSync(target, link, 'dir');
  assert.throws(() => createRequestStore({root: link}), /unsafe_request_store/);

  const store = createRequestStore({root: path.join(root, 'safe-store')});
  const request = createReviewReadyCaptureRequest({captureId: CAPTURE_ID});
  store.put(request);
  const requestFile = path.join(store.requestsRoot, `${request.requestId}.json`);
  fs.unlinkSync(requestFile);
  fs.symlinkSync(path.join(root, 'outside.json'), requestFile);
  assert.throws(() => store.load(request.requestId), /unsafe_request_file/);
});

test('oversized stored requests are rejected before deserialization', () => {
  const store = createRequestStore({root: tempRoot()});
  const requestId = 'oversized-request';
  fs.writeFileSync(path.join(store.requestsRoot, `${requestId}.json`), 'x'.repeat(2 * 1024 * 1024 + 1));
  assert.throws(() => store.load(requestId), /decision_request_too_large/);
});

test('action events are bounded, keyed by request ID, and removable', () => {
  const store = createRequestStore({root: tempRoot()});
  const event = store.writeAction({requestId: 'request-1', action: 'review', eventId: 'event-1'});
  assert.deepEqual(store.listActions(), [event]);
  store.removeAction(event.eventId);
  assert.deepEqual(store.listActions(), []);
  assert.throws(() => store.writeAction({requestId: 'request-1', action: 'unknown'}), /invalid_decision_action/);
});

test('request claims serialize concurrent drainers and recover stale locks', async () => {
  const store = createRequestStore({root: tempRoot()});
  const request = createReviewReadyCaptureRequest({captureId: CAPTURE_ID});
  store.put(request);
  let release;
  const first = store.withClaim(request.requestId, async (record) => {
    await new Promise((resolve) => { release = resolve; });
    return record.requestId;
  });
  await new Promise((resolve) => setImmediate(resolve));
  const second = await store.withClaim(request.requestId, async () => 'should-not-run');
  assert.equal(second.claimed, false);
  release();
  assert.equal((await first).value, request.requestId);

  const lock = path.join(store.requestsRoot, `${request.requestId}.lock`);
  fs.writeFileSync(lock, 'stale', {mode: 0o600});
  const old = new Date(Date.now() - 120_000);
  fs.utimesSync(lock, old, old);
  const recovered = await store.withClaim(request.requestId, async () => 'recovered');
  assert.equal(recovered.value, 'recovered');
});

test('malformed action events fail closed', () => {
  const store = createRequestStore({root: tempRoot()});
  fs.writeFileSync(path.join(store.actionsRoot, 'action-malformed.json'), '{not-json');
  assert.throws(() => store.listActions(), /invalid_stored_request/);
});
