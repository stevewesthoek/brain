import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeContextPackRef,
  normalizeEvidencePacketRef,
  normalizeTaskReferenceFields,
} from '../adapters/agent-task-references.js';

const contextFixture = {
  packId: 'pack-task-with-both',
  sourceRevision: 'brain-rev-17',
  sourcePath: 'operations/specs/context-pack.schema.json',
  freshness: 'fresh',
  status: 'persisted',
  authority: 'canonical',
  storageRef: 'context-packs/pack-task-with-both.json',
  createdAt: '2026-09-04T08:00:00.000Z',
  updatedAt: '2026-09-04T08:01:00.000Z',
  selectedItemCount: 3,
};

const evidenceFixture = {
  evidencePacketId: 'evidence-task-with-both',
  revision: 'evidence-rev-4',
  source: 'brain evidence ledger',
  freshness: 'stale',
  status: 'stale',
  authorityOwner: 'evidence',
  locator: 'evidence-packets/evidence-task-with-both.json',
  createdAt: '2026-09-03T08:00:00.000Z',
  updatedAt: '2026-09-04T07:00:00.000Z',
  evidenceIds: ['ev-1', 'ev-2'],
  edgeType: 'supports',
};

test('normalizes Context Pack aliases into a bounded stable reference', () => {
  const reference = normalizeContextPackRef(contextFixture);
  assert.deepEqual(reference, {
    packetId: 'pack-task-with-both',
    type: 'context-pack',
    revision: 'brain-rev-17',
    source: 'operations/specs/context-pack.schema.json',
    freshness: 'fresh',
    status: 'persisted',
    authority: 'canonical',
    locator: 'context-packs/pack-task-with-both.json',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:01:00.000Z',
    selectedItemCount: 3,
  });
});

test('normalizes Evidence Packet aliases and preserves provenance linkage', () => {
  const reference = normalizeEvidencePacketRef(evidenceFixture);
  assert.equal(reference?.packetId, 'evidence-task-with-both');
  assert.equal(reference?.type, 'evidence-packet');
  assert.equal(reference?.status, 'stale');
  assert.deepEqual(reference?.evidenceIds, ['ev-1', 'ev-2']);
  assert.equal(reference?.relation, 'supports');
});

test('legacy tasks and malformed refs remain safe and explicit', () => {
  const legacy = { taskId: 'legacy', title: 'Legacy task' };
  assert.deepEqual(normalizeTaskReferenceFields(legacy), legacy);
  assert.equal(normalizeContextPackRef({ status: 'missing' }), null);
  assert.deepEqual(normalizeTaskReferenceFields({
    taskId: 'missing',
    contextPackRefs: [{ packetId: 'ctx-missing', status: 'missing', freshness: 'unknown' }],
  }).contextPackRefs, [{
    packetId: 'ctx-missing',
    type: 'context-pack',
    revision: null,
    source: null,
    freshness: 'unknown',
    status: 'missing',
    authority: null,
    locator: null,
    createdAt: null,
    updatedAt: null,
  }]);
});

test('task reference normalization keeps Context Pack and Evidence Packet sets distinct', () => {
  const task = normalizeTaskReferenceFields({
    taskId: 'both',
    contextPackRefs: [contextFixture],
    evidencePacketRefs: [evidenceFixture],
  });
  assert.equal((task.contextPackRefs as unknown[]).length, 1);
  assert.equal((task.evidencePacketRefs as unknown[]).length, 1);
  assert.equal((task.contextPackRefs as Array<{ type: string }>)[0]!.type, 'context-pack');
  assert.equal((task.evidencePacketRefs as Array<{ type: string }>)[0]!.type, 'evidence-packet');
});
