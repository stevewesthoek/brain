import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { normalizeCaptureClassificationOutput } from '../adapters/mind-steward-capture-classification.js';
import {
  createDurablePageProposalGate,
  runMindStewardDuplicateSearch,
} from '../adapters/mind-steward-duplicate-search.js';

function createClassification() {
  const output = normalizeCaptureClassificationOutput({
    status: 'ok',
    selector: { status: 'selected' },
    inbox: {
      sampledFiles: [
        {
          name: 'prochat-offer.md',
          preview: '# ProChat Offer\n\nNotes about ProChat QA memory positioning and onboarding.',
        },
      ],
      skippedFiles: [],
    },
  }, new Date('2026-06-18T12:00:00Z'));
  const classification = output.classifications[0];
  assert(classification);
  return classification;
}

test('duplicate search finds likely existing durable page without writing Mind', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-duplicate-search-'));
  const mindRoot = path.join(tempDir, 'mind');
  const durablePath = path.join(mindRoot, 'wiki', 'organisations', 'prochat', 'offer.md');
  mkdirSync(path.dirname(durablePath), { recursive: true });
  writeFileSync(durablePath, '# ProChat Offer\n\nProChat QA memory positioning and onboarding plan.\n');
  const before = readFileSync(durablePath, 'utf8');

  try {
    const classification = createClassification();
    const result = runMindStewardDuplicateSearch({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.equal(result.matched, true);
    assert.equal(result.candidates[0]?.path, 'wiki/organisations/prochat/offer.md');
    assert.equal(result.safety.writesToMind, false);
    assert.equal(result.safety.movesCaptures, false);
    assert.equal(readFileSync(durablePath, 'utf8'), before);

    const gate = createDurablePageProposalGate(classification, result);
    assert.equal(gate.status, 'ready');
    assert.equal(gate.canProposeDurablePage, true);
    assert.equal(gate.safety.createsDurablePage, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('durable page proposal gate blocks when duplicate search is missing', () => {
  const classification = createClassification();
  const gate = createDurablePageProposalGate(classification, null);

  assert.equal(gate.status, 'blocked');
  assert.equal(gate.canProposeDurablePage, false);
  assert(gate.blockers.includes('duplicateSearchRequired'));
  assert.equal(gate.safety.writesToMind, false);
});

test('durable page proposal gate blocks mismatched duplicate search evidence', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-duplicate-search-mismatch-'));
  const mindRoot = path.join(tempDir, 'mind');
  mkdirSync(path.join(mindRoot, 'wiki'), { recursive: true });

  try {
    const classification = createClassification();
    const result = runMindStewardDuplicateSearch({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });
    const gate = createDurablePageProposalGate(classification, {
      ...result,
      classificationId: 'different-classification',
    });

    assert.equal(gate.status, 'blocked');
    assert(gate.blockers.includes('duplicateSearchClassificationMismatch'));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('duplicate search can prove no durable candidate was found', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-duplicate-search-none-'));
  const mindRoot = path.join(tempDir, 'mind');
  const durablePath = path.join(mindRoot, 'wiki', 'unrelated.md');
  mkdirSync(path.dirname(durablePath), { recursive: true });
  writeFileSync(durablePath, '# Completely Different\n\nGardening notes.\n');

  try {
    const classification = createClassification();
    const result = runMindStewardDuplicateSearch({
      mindRoot,
      classification,
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.equal(result.matched, false);
    assert.deepEqual(result.candidates, []);
    const gate = createDurablePageProposalGate(classification, result);
    assert.equal(gate.status, 'ready');
    assert.equal(gate.canProposeDurablePage, true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('duplicate search rejects unsafe searched roots before scanning', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-duplicate-search-unsafe-root-'));
  const mindRoot = path.join(tempDir, 'mind');
  const outsidePath = path.join(tempDir, 'outside', 'prochat.md');
  mkdirSync(path.dirname(outsidePath), { recursive: true });
  writeFileSync(outsidePath, '# ProChat Offer\n\nProChat QA memory positioning and onboarding plan.\n');

  try {
    const classification = createClassification();
    const result = runMindStewardDuplicateSearch({
      mindRoot,
      classification,
      searchedRoots: ['../outside'],
      now: new Date('2026-06-18T12:05:00Z'),
    });

    assert.deepEqual(result.searchedRoots, []);
    assert.equal(result.matched, false);
    assert.deepEqual(result.candidates, []);
    assert.equal(result.safety.writesToMind, false);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
