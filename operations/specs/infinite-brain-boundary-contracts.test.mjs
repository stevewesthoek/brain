import assert from 'node:assert/strict';
import test from 'node:test';

import {
  EXACT_SCOPE_APPROVAL_POLICY,
  MIND_CONTRACT,
  MIND_CANONICAL_PATHS,
  MIND_MAINTENANCE_POLICY,
  MIND_PATH_POLICY,
  MIND_PREVIEW_POLICY,
  SECRET_SURFACE_POLICY,
} from './infinite-brain-boundary-contracts.js';

test('boundary contract exposes canonical paths and shared policy lists', () => {
  assert.equal(MIND_CANONICAL_PATHS.inboxNew, 'inbox/new/');
  assert.equal(MIND_CANONICAL_PATHS.kanban, 'kanban.md');
  assert.equal(MIND_CONTRACT.currentSuccessPath, 'inbox/new');
  assert.equal(MIND_CONTRACT.currentFailurePath, 'inbox/failed');
  assert.deepEqual(MIND_CONTRACT.authorityLabels, ['active', 'review-surface', 'historical-only']);
  assert.deepEqual(MIND_CONTRACT.reviewSurfaces, ['inbox/processed', 'wiki/log.md']);
  assert(MIND_CONTRACT.historicalOnlyPaths.includes('capture/inbox'));
  assert(MIND_CONTRACT.historicalOnlyPaths.includes('graphify-out'));
  assert.equal(MIND_CONTRACT.activeCandidatePaths.length, 2);
  assert.ok(MIND_PATH_POLICY.blockedPrefixes.includes('runtime/'));
  assert.ok(MIND_PATH_POLICY.generatedPrefixes.includes('system/generated/graph/'));
  assert.equal(MIND_PREVIEW_POLICY.allowedTargets[0], 'system/agent-context/current.md');
  assert.deepEqual(MIND_MAINTENANCE_POLICY.blockedExactPaths, ['.env']);
  assert.ok(EXACT_SCOPE_APPROVAL_POLICY.forbiddenModelFields.includes('approvedAt'));
  assert.match(['api', 'key=[REDACTED]'].join('_'), SECRET_SURFACE_POLICY.keyPattern);
});
