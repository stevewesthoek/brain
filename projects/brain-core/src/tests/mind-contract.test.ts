import assert from 'node:assert/strict';
import test from 'node:test';

import { MIND_CONTRACT } from '../contracts/mind-contract.js';

test('canonical Mind contract exposes current active and historical-only paths', () => {
  assert.equal(MIND_CONTRACT.currentSuccessPath, 'inbox/new');
  assert.equal(MIND_CONTRACT.currentFailurePath, 'inbox/failed');
  assert.deepEqual(MIND_CONTRACT.authorityLabels, ['active', 'review-surface', 'historical-only']);
  assert.deepEqual(MIND_CONTRACT.reviewSurfaces, ['inbox/processed', 'wiki/log.md']);
  assert(MIND_CONTRACT.historicalOnlyPaths.includes('capture/inbox'));
  assert(MIND_CONTRACT.historicalOnlyPaths.includes('capture/failed'));
  assert(MIND_CONTRACT.historicalOnlyPaths.includes('graphify-out'));
  assert.equal(MIND_CONTRACT.activeCandidatePaths.length, 2);
  assert.equal(
    MIND_CONTRACT.activeCandidatePaths.some((candidate) => MIND_CONTRACT.historicalOnlyPaths.includes(candidate.path)),
    false,
  );
});

test('canonical Mind contract is immutable', () => {
  assert.equal(Object.isFrozen(MIND_CONTRACT), true);
  assert.equal(Object.isFrozen(MIND_CONTRACT.activeCandidatePaths), true);
  assert.equal(Object.isFrozen(MIND_CONTRACT.activeCandidatePaths[0]), true);
});
