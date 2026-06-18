import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCaptureClassificationOutput } from '../adapters/mind-steward-capture-classification.js';

test('normalizes sampled classifier output into reviewable capture classifications', () => {
  const output = normalizeCaptureClassificationOutput({
    job: 'mind-steward-inbox-classifier-dry-run',
    mode: 'classifier-dry-run-report-only',
    status: 'ok',
    selectorTaskType: 'mind_capture_classification',
    selector: {
      status: 'selected',
      providerId: 'local-ollama',
      model: 'qwen2.5:14b',
    },
    inbox: {
      sampledFiles: [
        {
          name: 'capture-a.md',
          sizeBytes: 42,
          modifiedAt: '2026-06-18T12:00:00Z',
          preview: '# Capture A\n\nUseful raw idea.',
        },
      ],
      skippedFiles: [],
    },
  }, new Date('2026-06-18T12:10:00Z'));

  assert.equal(output.schemaVersion, '1.0');
  assert.equal(output.normalizedAt, '2026-06-18T12:10:00.000Z');
  assert.equal(output.summary.readyForReview, 1);
  assert.equal(output.safety.writesToMind, false);
  assert.equal(output.safety.movesCaptures, false);
  assert.equal(output.safety.writesKanban, false);
  assert.equal(output.classifications[0]?.type, 'capture-classification');
  assert.equal(output.classifications[0]?.status, 'ready-for-review');
  assert.equal(output.classifications[0]?.capturePath, 'capture/inbox/capture-a.md');
  assert.equal(output.classifications[0]?.proposedSummary, 'Capture A');
  assert.deepEqual(output.classifications[0]?.proposedTags, []);
  assert.equal(output.classifications[0]?.recommendedDestination, null);
  assert.equal(output.classifications[0]?.requiresApproval, true);
  assert.equal(output.classifications[0]?.selectorStatus, 'selected');
  assert.equal(output.classifications[0]?.selectorProviderId, 'local-ollama');
  assert.equal(output.classifications[0]?.selectorModel, 'qwen2.5:14b');
});

test('normalizes skipped classifier files as reviewable skipped records', () => {
  const output = normalizeCaptureClassificationOutput({
    job: 'mind-steward-inbox-classifier-dry-run',
    mode: 'classifier-dry-run-report-only',
    status: 'ok',
    selectorTaskType: 'mind_capture_classification',
    selector: { status: 'selected' },
    inbox: {
      sampledFiles: [],
      skippedFiles: [
        {
          name: 'large.md',
          sizeBytes: 3_000_000,
          modifiedAt: '2026-06-18T12:00:00Z',
          reason: 'larger-than-2mb',
        },
      ],
    },
  });

  assert.equal(output.summary.skipped, 1);
  assert.equal(output.classifications[0]?.status, 'skipped');
  assert.equal(output.classifications[0]?.capturePath, 'capture/inbox/large.md');
  assert.deepEqual(output.classifications[0]?.blockers, ['larger-than-2mb']);
  assert.deepEqual(output.classifications[0]?.evidence, [
    { kind: 'skip-reason', value: 'larger-than-2mb' },
  ]);
});

test('blocks unsafe capture names without inventing destination proposals', () => {
  const output = normalizeCaptureClassificationOutput({
    status: 'ok',
    selector: { status: 'selected' },
    inbox: {
      sampledFiles: [
        {
          name: '../escape.md',
          preview: 'Unsafe path',
        },
      ],
      skippedFiles: [],
    },
  });

  assert.equal(output.summary.blocked, 1);
  assert.equal(output.classifications[0]?.status, 'blocked');
  assert.equal(output.classifications[0]?.capturePath, null);
  assert(output.classifications[0]?.blockers.includes('invalidCaptureName'));
  assert.equal(output.classifications[0]?.recommendedDestination, null);
});

test('blocked classifier reports remain normalized and visible', () => {
  const output = normalizeCaptureClassificationOutput({
    job: 'mind-steward-inbox-classifier-dry-run',
    mode: 'classifier-dry-run-report-only',
    status: 'blocked',
    message: 'Selector runtime is missing.',
    selectorTaskType: 'mind_capture_classification',
    selector: { status: 'blocked' },
    inbox: {
      sampledFiles: [
        {
          name: 'capture-a.md',
          preview: 'Still visible for review.',
        },
      ],
      skippedFiles: [],
    },
  });

  assert.deepEqual(output.blockers, ['Selector runtime is missing.']);
  assert.equal(output.sourceStatus, 'blocked');
  assert.equal(output.classifications[0]?.capturePath, 'capture/inbox/capture-a.md');
  assert.equal(output.safety.normalizedOnly, true);
});

test('empty classifier reports produce a top-level blocker', () => {
  const output = normalizeCaptureClassificationOutput({
    status: 'ok',
    inbox: {
      sampledFiles: [],
      skippedFiles: [],
    },
  });

  assert.equal(output.summary.total, 0);
  assert(output.blockers.includes('noClassifierFileEntries'));
  assert.equal(output.safety.deletesCaptures, false);
});
