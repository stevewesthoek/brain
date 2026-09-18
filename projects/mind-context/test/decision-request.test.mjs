import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertDecisionActionAllowed,
  allowedDecisionActions,
  computeProposalHash,
  createDecisionRequest,
  createProcessingFailureRequest,
  createReviewReadyCaptureRequest,
  deserializeDecisionRequest,
  isOneClickApprovable,
  serializeDecisionRequest,
} from '../src/review/decision-request.mjs';

const CAPTURE_ID = '11111111-1111-4111-8111-111111111111';

test('review-ready capture requests use opaque capture deep links and never approve directly', () => {
  const request = createReviewReadyCaptureRequest({captureId: CAPTURE_ID, sourceType: 'drop-text'});
  assert.equal(request.deepLink, `evermind://capture/${CAPTURE_ID}`);
  assert.deepEqual(allowedDecisionActions(request), ['review', 'reject']);
  assert.equal(isOneClickApprovable(request), false);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.source), true);
});

test('fully specified proposal requests carry an integrity hash and allow approve', () => {
  const proposal = {
    id: 'proposal-1',
    version: '1',
    content: 'A reviewed durable fact.',
    destination: 'knowledge/approved.md',
    source: 'capture-1',
    provenance: 'local-review',
  };
  const request = createDecisionRequest({
    kind: 'approve-reject-proposal',
    requestId: 'request-1',
    proposalId: proposal.id,
    source: {type: 'proposal', provenance: 'local-review'},
    proposal: {...proposal, hash: computeProposalHash(proposal)},
  });
  assert.equal(request.deepLink, 'evermind://review/proposal-1');
  assert.equal(isOneClickApprovable(request), true);
  assert.deepEqual(allowedDecisionActions(request), ['approve', 'review', 'reject']);
  assert.equal(assertDecisionActionAllowed(request, 'approve'), 'approve');
  assert.equal(isOneClickApprovable({...request}), false);
  const roundTrip = deserializeDecisionRequest(serializeDecisionRequest(request));
  assert.deepEqual(roundTrip, request);
});

test('incomplete or unsafe proposals are review-only', () => {
  const request = createDecisionRequest({
    kind: 'approve-reject-proposal',
    requestId: 'request-2',
    proposalId: 'proposal-2',
    source: {type: 'proposal', provenance: 'local-review'},
    proposal: {id: 'proposal-2', version: '1', content: 'Needs a destination.'},
  });
  assert.equal(isOneClickApprovable(request), false);
  assert.deepEqual(allowedDecisionActions(request), ['review', 'reject']);
  assert.throws(() => assertDecisionActionAllowed(request, 'approve'), /approve_requires_immutable_proposal/);
  assert.throws(() => createDecisionRequest({
    kind: 'approve-reject-proposal',
    requestId: 'request-3',
    proposalId: 'proposal-3',
    source: {type: 'proposal', provenance: 'local-review'},
    proposal: {
      id: 'proposal-3', version: '1', content: 'Unsafe destination', destination: '../outside.md',
      source: 'capture', provenance: 'local', hash: '0'.repeat(64),
    },
  }), /proposal_hash_mismatch/);
});

test('failure and future decision cases deep-link to the review queue', () => {
  const failure = createProcessingFailureRequest({requestId: 'failure-1', errorCode: 'source_changed_during_ingest'});
  assert.equal(failure.deepLink, 'evermind://queue');
  assert.match(failure.summary, /source_changed_during_ingest/);
  const contradiction = createDecisionRequest({
    kind: 'contradiction',
    requestId: 'contradiction-1',
    source: {type: 'context', provenance: 'local-retrieval'},
  });
  assert.equal(contradiction.deepLink, 'evermind://queue');
});

test('tampered serialized proposals are rejected before notification actions are derived', () => {
  const request = createReviewReadyCaptureRequest({captureId: CAPTURE_ID});
  const serialized = serializeDecisionRequest(request).replace('review-ready-capture', 'approve-reject-proposal');
  assert.throws(() => deserializeDecisionRequest(serialized), /proposal_request_requires_proposal_id/);
});
