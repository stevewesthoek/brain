/**
 * Infinite Brain Writer Stubs Tests
 * Verify all category-specific writers are blocked and return disabled status
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  runAtomizationWriterDisabled,
  runMetadataWriterDisabled,
  runEdgesWriterDisabled,
  runWikiWriterDisabled,
  runTasksWriterDisabled,
  runCleanupWriterDisabled,
} from '../adapters/infinite-brain-writers/index.js';
import { evaluateWriterStubAvailability, executeInfiniteBrainProposalPlanDisabled } from '../adapters/infinite-brain-proposal-executor.js';

const mockInput = {
  dryRunId: 'dry-run-test',
  applicationPlanId: 'plan-test',
  category: 'atomization' as const,
};

test('Atomization writer returns blocked', async () => {
  const result = await runAtomizationWriterDisabled(mockInput);
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'atomization');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
  assert.equal(result.safety.writesToMind, false);
  assert.equal(result.safety.canWrite, false);
  assert(Array.isArray(result.blockers));
  assert(result.blockers.length > 0);
});

test('Metadata writer returns blocked', async () => {
  const result = await runMetadataWriterDisabled({ ...mockInput, category: 'entity-metadata' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'entity-metadata');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Edges writer returns blocked', async () => {
  const result = await runEdgesWriterDisabled({ ...mockInput, category: 'edge-review' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'edge-review');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Wiki writer returns blocked', async () => {
  const result = await runWikiWriterDisabled({ ...mockInput, category: 'wiki-writing' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'wiki-writing');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Tasks writer returns blocked', async () => {
  const result = await runTasksWriterDisabled({ ...mockInput, category: 'task-extraction' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'task-extraction');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
});

test('Cleanup writer returns blocked with destructive-disabled messaging', async () => {
  const result = await runCleanupWriterDisabled({ ...mockInput, category: 'cleanup' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.category, 'cleanup');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.executionBlocked, true);
  // Cleanup should have explicit destructive-disabled messaging
  assert(result.blockers.some(b => b.includes('DESTRUCTIVE')));
});

test('All writers have safety invariants correct', async () => {
  const writers = [
    await runAtomizationWriterDisabled(mockInput),
    await runMetadataWriterDisabled({ ...mockInput, category: 'entity-metadata' }),
    await runEdgesWriterDisabled({ ...mockInput, category: 'edge-review' }),
    await runWikiWriterDisabled({ ...mockInput, category: 'wiki-writing' }),
    await runTasksWriterDisabled({ ...mockInput, category: 'task-extraction' }),
    await runCleanupWriterDisabled({ ...mockInput, category: 'cleanup' }),
  ];

  for (const writer of writers) {
    assert.equal(writer.ok, false, `${writer.category}: ok must be false`);
    assert.equal(writer.status, 'blocked', `${writer.category}: status must be blocked`);
    assert.equal(writer.canWrite, false, `${writer.category}: canWrite must be false`);
    assert.equal(writer.wroteToMind, false, `${writer.category}: wroteToMind must be false`);
    assert.equal(writer.applied, false, `${writer.category}: applied must be false`);
    assert.equal(writer.executionBlocked, true, `${writer.category}: executionBlocked must be true`);
    assert.equal(writer.safety.writesToMind, false, `${writer.category}: safety.writesToMind must be false`);
    assert.equal(writer.safety.canWrite, false, `${writer.category}: safety.canWrite must be false`);
    assert.equal(writer.safety.deletesFiles, false, `${writer.category}: safety.deletesFiles must be false`);
    assert.equal(writer.safety.movesFiles, false, `${writer.category}: safety.movesFiles must be false`);
    assert.equal(writer.filesCreated.length, 0, `${writer.category}: filesCreated must be empty`);
    assert.equal(writer.filesModified.length, 0, `${writer.category}: filesModified must be empty`);
    assert.equal(writer.filesDeleted.length, 0, `${writer.category}: filesDeleted must be empty`);
  }
});

test('Writer stub availability shows all blocked', () => {
  const availability = evaluateWriterStubAvailability();
  assert.equal(availability.length, 6);

  for (const stub of availability) {
    assert.equal(stub.available, false);
    assert(stub.blockerCount > 0, `${stub.category}: should have blockers`);
    assert(stub.blockers.length > 0, `${stub.category}: blockers list should not be empty`);
  }

  // Verify cleanup is destructive-disabled
  const cleanupStub = availability.find(s => s.category === 'cleanup');
  assert(cleanupStub, 'Cleanup stub should exist');
  assert(cleanupStub.blockers.some(b => b.includes('DESTRUCTIVE')));
});

test('Disabled executor remains blocked with writer stubs', () => {
  const result = executeInfiniteBrainProposalPlanDisabled('dry-run-id', 5);

  assert.equal(result.ok, false);
  assert.equal(result.status, 'blocked');
  assert.equal(result.canExecute, false);
  assert.equal(result.executed, false);
  assert.equal(result.appliedSteps, 0);
  assert.equal(result.safety.writesToMind, false);
  assert.equal(result.safety.executionBlocked, true);
});
