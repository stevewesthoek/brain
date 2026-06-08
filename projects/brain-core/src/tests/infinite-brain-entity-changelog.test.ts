/**
 * Tests for Infinite Brain Runtime — Entity Changelog Adapter
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import {
  logMutation,
  getRecentMutations,
  filterMutations,
  getChangelogStats,
} from '../adapters/infinite-brain/entity-changelog.js';
import type { EntityMutation } from '../adapters/infinite-brain/types.js';

test('Entity Changelog - validation', async () => {
  const invalidMutation: any = {
    timestamp: 'invalid-timestamp',
    entityId: 'test-123',
    entityType: 'Decision',
    action: 'created',
    author: 'system',
    sourceJob: 'test-job',
    diffSummary: 'Test',
  };

  try {
    await logMutation(invalidMutation);
    assert.fail('Should have thrown on invalid timestamp');
  } catch (error) {
    assert.match(String(error), /Invalid timestamp/);
  }
});

test('Entity Changelog - invalid action', async () => {
  const invalidMutation: any = {
    timestamp: new Date().toISOString(),
    entityId: 'test-123',
    entityType: 'Decision',
    action: 'invalid-action',
    author: 'system',
    sourceJob: 'test-job',
    diffSummary: 'Test',
  };

  try {
    await logMutation(invalidMutation);
    assert.fail('Should have thrown on invalid action');
  } catch (error) {
    assert.match(String(error), /Invalid action/);
  }
});

test('Entity Changelog - empty changelog', async () => {
  const recent = await getRecentMutations(10);
  assert.equal(Array.isArray(recent), true);

  const stats = await getChangelogStats();
  assert.equal(stats.totalMutations >= 0, true);
});
