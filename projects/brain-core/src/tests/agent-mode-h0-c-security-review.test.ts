import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA,
  H0_LIVE_ACCEPTANCE_CLASSIFICATIONS,
  H0_LIVE_ACCEPTANCE_MATRIX,
  H0_SECURITY_REVIEW_SURFACES,
  createH0SecurityReview,
  evaluateSecurityReleaseReview,
  validateSecurityReleaseReview,
} from './fixtures/agent-mode-security-release-review.js';
import { HARDENING_COVERAGE_MATRIX } from './fixtures/agent-mode-hardening-harness.js';

test('H0-C review contract is versioned, closed, bounded, and covers every live-required class', () => {
  assert.equal(AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA, 'agent-mode.security-release-review.v1');
  assert.equal(H0_LIVE_ACCEPTANCE_MATRIX.length, 10);
  assert.equal(new Set(H0_LIVE_ACCEPTANCE_MATRIX.map((entry) => entry.faultClass)).size, 10);
  assert.deepEqual(
    H0_LIVE_ACCEPTANCE_MATRIX.map((entry) => entry.faultClass).sort(),
    HARDENING_COVERAGE_MATRIX.filter((entry) => entry.liveAcceptanceRequired).map((entry) => entry.faultClass).sort(),
  );
  assert.ok(H0_LIVE_ACCEPTANCE_MATRIX.every((entry) => H0_LIVE_ACCEPTANCE_CLASSIFICATIONS.includes(entry.classification)));
  assert.ok(H0_LIVE_ACCEPTANCE_MATRIX.every((entry) => entry.evidenceRefs.length > 0 && entry.evidenceRefs.length <= 64));
  assert.equal(H0_LIVE_ACCEPTANCE_MATRIX.filter((entry) => entry.liveStatus === 'blocked').length, 2);
  assert.equal(H0_LIVE_ACCEPTANCE_MATRIX.filter((entry) => entry.liveStatus === 'not_run').length, 2);
  assert.equal(H0_LIVE_ACCEPTANCE_MATRIX.filter((entry) => entry.liveStatus === 'live_pass').length, 6);
});

test('security review validates current-build identity and all bounded trust-boundary surfaces', () => {
  const review = createH0SecurityReview('c9b73dfd');
  assert.deepEqual(evaluateSecurityReleaseReview(review), { schemaVersion: AGENT_MODE_SECURITY_RELEASE_REVIEW_SCHEMA, status: 'PASS', reasons: [] });
  assert.deepEqual(review.reviewedSurfaces, [...H0_SECURITY_REVIEW_SURFACES]);
});

test('security review rejects unknown fields, sensitive evidence references, and incomplete review coverage', () => {
  const review = createH0SecurityReview('c9b73dfd');
  assert.throws(() => validateSecurityReleaseReview({ ...review, extraAuthority: 'ignored' }), /closed/);
  assert.throws(() => validateSecurityReleaseReview({ ...review, reviewedSurfaces: review.reviewedSurfaces.slice(1) }), /coverage/);
  assert.throws(() => validateSecurityReleaseReview({ ...review, findings: [{ findingId: 'finding:secret', severity: 'NOTE', status: 'closed', evidenceRefs: ['secret:fixture'] }] }), /finding/);
});

test('security review cannot convert an open high finding or missing review into a pass', () => {
  const review = createH0SecurityReview('c9b73dfd');
  const high = validateSecurityReleaseReview({ ...review, findings: [{ findingId: 'finding:high', severity: 'HIGH', status: 'open', evidenceRefs: ['h0c:high'] }] });
  assert.equal(evaluateSecurityReleaseReview(high).status, 'FAIL');
  const missing = validateSecurityReleaseReview({ ...review, status: 'not_run' });
  assert.equal(evaluateSecurityReleaseReview(missing).status, 'BLOCKED');
});
