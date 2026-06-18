import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { normalizeCaptureClassificationOutput } from '../adapters/mind-steward-capture-classification.js';
import {
  createCaptureSourcePreservationGate,
  createCaptureSourcePreservationRecord,
} from '../adapters/mind-steward-capture-source-preservation.js';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function createClassification(name = 'capture-a.md') {
  const output = normalizeCaptureClassificationOutput({
    status: 'ok',
    selector: { status: 'selected' },
    inbox: {
      sampledFiles: [
        {
          name,
          preview: '# Capture A\n\nOriginal capture source content.',
        },
      ],
      skippedFiles: [],
    },
  }, new Date('2026-06-18T12:00:00Z'));
  const classification = output.classifications[0];
  assert(classification);
  return classification;
}

test('preserves original capture source identity without writing or moving Mind files', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-capture-source-'));
  const mindRoot = path.join(tempDir, 'mind');
  const capturePath = path.join(mindRoot, 'capture', 'inbox', 'capture-a.md');
  const content = '# Capture A\n\nOriginal capture source content.\n';
  mkdirSync(path.dirname(capturePath), { recursive: true });
  writeFileSync(capturePath, content);

  try {
    const classification = createClassification();
    const record = createCaptureSourcePreservationRecord({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.equal(record.status, 'preserved');
    assert.equal(record.classificationId, classification.classificationId);
    assert.equal(record.originalCapture.path, 'capture/inbox/capture-a.md');
    assert.equal(record.originalCapture.contentSha256, sha256(content));
    assert.equal(record.retentionPolicy, 'preserve-in-place-until-approved-outcome-defined');
    assert.equal(record.safety.writesToMind, false);
    assert.equal(record.safety.movesCaptures, false);
    assert.equal(record.safety.deletesCaptures, false);
    assert.equal(record.safety.overwritesCaptures, false);
    assert.equal(readFileSync(capturePath, 'utf8'), content);

    const gate = createCaptureSourcePreservationGate(classification, record);
    assert.equal(gate.status, 'ready');
    assert.equal(gate.canContinueCaptureReview, true);
    assert.equal(gate.safety.movesCaptures, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('source preservation gate blocks when preservation evidence is missing', () => {
  const classification = createClassification();
  const gate = createCaptureSourcePreservationGate(classification, null);

  assert.equal(gate.status, 'blocked');
  assert.equal(gate.canContinueCaptureReview, false);
  assert(gate.blockers.includes('captureSourcePreservationRequired'));
  assert.equal(gate.safety.writesToMind, false);
});

test('source preservation record blocks unsafe capture paths', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-capture-source-unsafe-'));
  const mindRoot = path.join(tempDir, 'mind');
  mkdirSync(path.join(mindRoot, 'capture', 'inbox'), { recursive: true });

  try {
    const classification = createClassification('../escape.md');
    const record = createCaptureSourcePreservationRecord({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.equal(record.status, 'blocked');
    assert(record.blockers.includes('invalidOrMissingCapturePath'));
    assert.equal(record.originalCapture.contentSha256, null);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('source preservation record blocks missing original capture file', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-capture-source-missing-'));
  const mindRoot = path.join(tempDir, 'mind');
  mkdirSync(path.join(mindRoot, 'capture', 'inbox'), { recursive: true });

  try {
    const classification = createClassification();
    const record = createCaptureSourcePreservationRecord({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.equal(record.status, 'blocked');
    assert(record.blockers.includes('captureSourceUnavailable'));
    const gate = createCaptureSourcePreservationGate(classification, record);
    assert.equal(gate.status, 'blocked');
    assert.equal(gate.canContinueCaptureReview, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('source preservation gate blocks mismatched source evidence', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-capture-source-mismatch-'));
  const mindRoot = path.join(tempDir, 'mind');
  const capturePath = path.join(mindRoot, 'capture', 'inbox', 'capture-a.md');
  mkdirSync(path.dirname(capturePath), { recursive: true });
  writeFileSync(capturePath, '# Capture A\n');

  try {
    const classification = createClassification();
    const record = createCaptureSourcePreservationRecord({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });
    const gate = createCaptureSourcePreservationGate(classification, {
      ...record,
      classificationId: 'different-classification',
    });

    assert.equal(gate.status, 'blocked');
    assert(gate.blockers.includes('captureSourceClassificationMismatch'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('source preservation record blocks symlink captures', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-capture-source-symlink-'));
  const mindRoot = path.join(tempDir, 'mind');
  const inboxPath = path.join(mindRoot, 'capture', 'inbox');
  const targetPath = path.join(tempDir, 'source.md');
  const capturePath = path.join(inboxPath, 'capture-a.md');
  mkdirSync(inboxPath, { recursive: true });
  writeFileSync(targetPath, '# Capture A\n');
  symlinkSync(targetPath, capturePath);

  try {
    const classification = createClassification();
    const record = createCaptureSourcePreservationRecord({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.equal(record.status, 'blocked');
    assert(record.blockers.includes('captureSourceNotRegularFile'));
    assert.equal(record.safety.deletesCaptures, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
