import assert from 'node:assert/strict';
import test from 'node:test';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {createNotifier, macOSActionNotifier, macOSNotifier, notificationCategory} from '../src/notifications/notifier.mjs';
import {computeProposalHash, createDecisionRequest, createReviewReadyCaptureRequest} from '../src/review/decision-request.mjs';
import {createRequestStore} from '../src/notifications/request-store.mjs';

const CAPTURE_ID = '22222222-2222-4222-8222-222222222222';

test('unsupported environments use a console fallback without private source details', () => {
  const lines = [];
  const notifier = createNotifier({platform: 'linux', emit: (line) => lines.push(line)});
  const result = notifier.notify(createReviewReadyCaptureRequest({captureId: CAPTURE_ID}));
  assert.equal(result.kind, 'console');
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Evermind capture ready for review/);
  assert.doesNotMatch(lines[0], /drop-folder|\/Users\//);
  assert.match(lines[0], new RegExp(`evermind://capture/${CAPTURE_ID}`));
});

test('macOS notifier uses the native osascript boundary and retains action metadata', () => {
  const calls = [];
  const notifier = macOSNotifier({execute: (file, args) => {
    calls.push({file, args});
    return {status: 0};
  }});
  const result = notifier.notify(createReviewReadyCaptureRequest({captureId: CAPTURE_ID}));
  assert.equal(result.kind, 'macos-legacy');
  assert.deepEqual(result.actions, ['review', 'reject']);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].file, '/usr/bin/osascript');
  assert.match(calls[0].args[1], /display notification/);
});

test('action-capable macOS adapter persists a privacy-safe request and generates only allowed actions', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-notifier-test-'));
  const store = createRequestStore({root});
  const calls = [];
  const notifier = macOSActionNotifier({
    helperPath: '/tmp/EvermindNotificationHelper.app',
    requestStore: store,
    helperAvailable: () => true,
    execute: (file, args) => { calls.push({file, args}); return {status: 0}; },
  });
  const request = createReviewReadyCaptureRequest({captureId: CAPTURE_ID});
  const result = notifier.notify(request);
  assert.equal(notifier.supportsActions, true);
  assert.deepEqual(result.category, notificationCategory(request));
  assert.deepEqual(result.actions, ['review', 'reject']);
  assert.equal(calls.length, 1);
  assert.doesNotMatch(calls[0].args.join(' '), /Raw|drop-folder|private proposal content/);
  assert.equal(calls[0].args.includes(request.requestId), true);

  const proposal = {id: 'proposal-notify', version: '1', content: 'private proposal content', destination: 'knowledge/proposal.md', source: 'capture', provenance: 'test'};
  const complete = createDecisionRequest({
    kind: 'approve-reject-proposal',
    requestId: 'request-complete',
    proposalId: proposal.id,
    source: {type: 'proposal', provenance: 'test'},
    proposal: {...proposal, hash: computeProposalHash(proposal)},
  });
  assert.deepEqual(notifier.notify(complete).actions, ['approve', 'review', 'reject']);
  assert.doesNotMatch(JSON.stringify(result), /private proposal content/);
});

test('native adapter is unavailable unless the helper is available', () => {
  const notifier = createNotifier({platform: 'darwin', helperPath: '/tmp/missing-evermind-helper.app', helperAvailable: () => false, execute: () => ({status: 0})});
  assert.equal(notifier.supportsActions, false);
  assert.equal(notifier.kind, 'macos-legacy');
});

test('native helper failure falls back to AppleScript before console', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'evermind-notifier-fallback-'));
  const store = createRequestStore({root});
  const calls = [];
  const notifier = createNotifier({
    platform: 'darwin',
    helperPath: '/tmp/EvermindNotificationHelper.app',
    requestStore: store,
    helperAvailable: () => true,
    executeHelper: () => { throw new Error('helper unavailable'); },
    execute: (file) => { calls.push(file); return {status: 0}; },
  });
  const result = notifier.notify(createReviewReadyCaptureRequest({captureId: CAPTURE_ID}));
  assert.equal(result.kind, 'macos-legacy');
  assert.deepEqual(calls, ['/usr/bin/osascript']);
});

test('macOS notification failure falls back to console output', () => {
  const lines = [];
  const notifier = createNotifier({
    platform: 'darwin',
    helperPath: '/tmp/missing-evermind-helper.app',
    helperAvailable: () => false,
    execute: () => { throw new Error('osascript unavailable'); },
    emit: (line) => lines.push(line),
  });
  const result = notifier.notify(createReviewReadyCaptureRequest({captureId: CAPTURE_ID}));
  assert.equal(result.kind, 'console');
  assert.equal(lines.length, 1);
});
