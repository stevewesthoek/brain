import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {writeRawCapture} from '../src/capture/capture.mjs';
import {routeNotificationAction, drainNotificationActions} from '../src/notifications/action-router.mjs';
import {createRequestStore} from '../src/notifications/request-store.mjs';
import {computeProposalHash, createDecisionRequest, createReviewReadyCaptureRequest} from '../src/review/decision-request.mjs';

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-notification-route-'));
}

function proposalFor(captureId, overrides = {}) {
  const proposal = {
    id: 'proposal-1',
    version: '1',
    content: 'A durable approved note.',
    destination: 'knowledge/notification-approved.md',
    source: captureId,
    provenance: 'notification-test',
    ...overrides,
  };
  return {...proposal, hash: computeProposalHash(proposal)};
}

function proposalRequest(captureId, proposal = proposalFor(captureId)) {
  return createDecisionRequest({
    kind: 'approve-reject-proposal',
    requestId: 'request-proposal-1',
    captureId,
    proposalId: proposal.id,
    source: {type: 'proposal', provenance: 'notification-test'},
    proposal,
  });
}

test('Review opens an isolated deep-link interface and leaves the request pending', async () => {
  const store = createRequestStore({root: tempRoot()});
  const request = createReviewReadyCaptureRequest({captureId: '44444444-4444-4444-8444-444444444444'});
  store.put(request);
  const opened = [];
  const result = await routeNotificationAction({store, requestId: request.requestId, action: 'review', openDeepLink: (link) => { opened.push(link); return {opened: false, deepLink: link}; }});
  assert.equal(result.status, 'review-opened');
  assert.deepEqual(opened, [request.deepLink]);
  assert.equal(store.load(request.requestId).state, 'pending');
});

test('Reject routes through the existing review pathway and is idempotent', async () => {
  const root = tempRoot();
  const capture = writeRawCapture({root, content: 'reject this capture', sourceType: 'test', provenance: 'notification-test'});
  const store = createRequestStore({root: path.join(root, '.notifications')});
  const request = createReviewReadyCaptureRequest({captureId: capture.captureId});
  store.put(request);
  const first = await routeNotificationAction({store, root, requestId: request.requestId, action: 'reject'});
  const second = await routeNotificationAction({store, root, requestId: request.requestId, action: 'reject'});
  assert.equal(first.status, 'resolved');
  assert.equal(first.state, 'resolved-rejected');
  assert.equal(second.status, 'already_resolved');
  assert.equal(fs.existsSync(path.join(root, capture.relativePath)), false);
});

test('Approve revalidates the immutable proposal and invokes the existing review pathway', async () => {
  const root = tempRoot();
  const capture = writeRawCapture({root, content: 'raw capture', sourceType: 'test', provenance: 'notification-test'});
  const store = createRequestStore({root: path.join(root, '.notifications')});
  const request = proposalRequest(capture.captureId);
  store.put(request);
  const first = await routeNotificationAction({store, root, requestId: request.requestId, action: 'approve'});
  const second = await routeNotificationAction({store, root, requestId: request.requestId, action: 'approve'});
  assert.equal(first.status, 'resolved');
  assert.equal(first.state, 'resolved-approved');
  assert.equal(second.status, 'already_resolved');
  assert.equal(fs.readFileSync(path.join(root, request.proposal.destination), 'utf8'), `${request.proposal.content}\n`);
});

test('forged, unsafe, or stale Approve actions fail closed and fall back to Review', async () => {
  const root = tempRoot();
  const capture = writeRawCapture({root, content: 'raw capture', sourceType: 'test', provenance: 'notification-test'});
  const store = createRequestStore({root: path.join(root, '.notifications')});
  const unsafe = proposalRequest(capture.captureId, proposalFor(capture.captureId, {destination: '../outside.md'}));
  store.put(unsafe);
  const opened = [];
  const result = await routeNotificationAction({store, root, requestId: unsafe.requestId, action: 'approve', openDeepLink: (link) => { opened.push(link); return link; }});
  assert.equal(result.status, 'failed-review-required');
  assert.equal(result.failureCode, 'approve_requires_immutable_proposal');
  assert.deepEqual(opened, [unsafe.deepLink]);
  assert.equal(fs.existsSync(path.join(root, 'outside.md')), false);

  const missing = await routeNotificationAction({store, root, requestId: unsafe.requestId, action: 'approve', openDeepLink: () => null});
  assert.equal(missing.status, 'failed-review-required');
  assert.equal(store.load(unsafe.requestId).state, 'pending');
});

test('drain routes durable native action events once', async () => {
  const root = tempRoot();
  const capture = writeRawCapture({root, content: 'drain me', sourceType: 'test', provenance: 'notification-test'});
  const store = createRequestStore({root: path.join(root, '.notifications')});
  const request = createReviewReadyCaptureRequest({captureId: capture.captureId});
  store.put(request);
  store.writeAction({requestId: request.requestId, action: 'reject', eventId: 'event-drain-1'});
  const first = await drainNotificationActions({store, root});
  const second = await drainNotificationActions({store, root});
  assert.equal(first[0].result.state, 'resolved-rejected');
  assert.deepEqual(second, []);
});

test('two drainers cannot execute the same approval concurrently', async () => {
  const store = createRequestStore({root: tempRoot()});
  const request = proposalRequest('capture-concurrency');
  store.put(request);
  let executions = 0;
  let release;
  const execute = {
    approve: async () => {
      executions += 1;
      await new Promise((resolve) => { release = resolve; });
      return {decision: 'approved', receipt: 'fixture-receipt'};
    },
  };
  const first = routeNotificationAction({store, requestId: request.requestId, action: 'approve', execute});
  await new Promise((resolve) => setImmediate(resolve));
  const second = await routeNotificationAction({store, requestId: request.requestId, action: 'approve', execute});
  assert.equal(second.status, 'already_processing');
  release();
  const result = await first;
  assert.equal(result.state, 'resolved-approved');
  assert.equal(executions, 1);
  assert.equal((await routeNotificationAction({store, requestId: request.requestId, action: 'approve', execute})).status, 'already_resolved');
});

test('a concurrent drainer leaves the action event for retry until the claimant finishes', async () => {
  const store = createRequestStore({root: tempRoot()});
  const request = proposalRequest('capture-drain-race');
  store.put(request);
  store.writeAction({requestId: request.requestId, action: 'approve', eventId: 'event-drain-race'});
  let release;
  const execute = {
    approve: async () => new Promise((resolve) => { release = () => resolve({decision: 'approved'}); }),
  };
  const first = drainNotificationActions({store, execute});
  await new Promise((resolve) => setImmediate(resolve));
  const second = await drainNotificationActions({store, execute});
  assert.equal(second[0].result.status, 'already_processing');
  assert.equal(store.listActions().length, 1);
  release();
  await first;
  assert.deepEqual(store.listActions(), []);
  store.writeAction({requestId: request.requestId, action: 'approve', eventId: 'event-drain-race-replay'});
  const retry = await drainNotificationActions({store, execute});
  assert.equal(retry[0].result.status, 'already_resolved');
  assert.deepEqual(store.listActions(), []);
});

test('missing requests and unsupported actions fail closed', async () => {
  const store = createRequestStore({root: tempRoot()});
  await assert.rejects(() => routeNotificationAction({store, requestId: 'missing-request', action: 'review'}), /request_not_found/);
  const request = createReviewReadyCaptureRequest({captureId: '55555555-5555-4555-8555-555555555555'});
  store.put(request);
  const result = await routeNotificationAction({store, requestId: request.requestId, action: 'approve', openDeepLink: () => null});
  assert.equal(result.status, 'failed-review-required');
  assert.equal(result.failureCode, 'approve_requires_immutable_proposal');
});
