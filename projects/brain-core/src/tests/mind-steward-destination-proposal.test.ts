import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { normalizeCaptureClassificationOutput } from '../adapters/mind-steward-capture-classification.js';
import { createCaptureSourcePreservationRecord } from '../adapters/mind-steward-capture-source-preservation.js';
import { runMindStewardDuplicateSearch } from '../adapters/mind-steward-duplicate-search.js';
import {
  createSingleDestinationProposal,
  type MindStewardDestinationCandidate,
} from '../adapters/mind-steward-destination-proposal.js';

function createClassification(name = 'prochat-offer.md') {
  const output = normalizeCaptureClassificationOutput({
    status: 'ok',
    selector: { status: 'selected' },
    inbox: {
      sampledFiles: [
        {
          name,
          preview: '# ProChat Offer\n\nNotes about ProChat QA memory positioning and onboarding.',
        },
      ],
      skippedFiles: [],
    },
  }, new Date('2026-06-18T12:00:00Z'), {
    captureInboxPath: 'inbox/new',
  });
  const classification = output.classifications[0];
  assert(classification);
  return classification;
}

function createFixture() {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-destination-proposal-'));
  const mindRoot = path.join(tempDir, 'mind');
  const capturePath = path.join(mindRoot, 'inbox', 'new', 'prochat-offer.md');
  mkdirSync(path.dirname(capturePath), { recursive: true });
  mkdirSync(path.join(mindRoot, 'wiki'), { recursive: true });
  writeFileSync(capturePath, '# ProChat Offer\n\nNotes about ProChat QA memory positioning and onboarding.\n');
  const classification = createClassification();
  const sourceRecord = createCaptureSourcePreservationRecord({
    mindRoot,
    classification,
    now: new Date('2026-06-18T12:05:00Z'),
  });
  const duplicateSearch = runMindStewardDuplicateSearch({
    mindRoot,
    classification,
    now: new Date('2026-06-18T12:06:00Z'),
  });
  return { tempDir, mindRoot, classification, sourceRecord, duplicateSearch };
}

test('selects exactly one clear destination candidate without writing Mind', () => {
  const fixture = createFixture();
  try {
    const candidates: MindStewardDestinationCandidate[] = [
      {
        kind: 'knowledge',
        destinationPath: 'knowledge/organisations/prochat/offer.md',
        confidence: 0.91,
        rationale: 'Durable knowledge about a ProChat offer belongs in wiki.',
        evidence: ['classification summary mentions ProChat offer'],
      },
      {
        kind: 'resources',
        destinationPath: 'resources/research/prochat-offer.md',
        confidence: 0.54,
        rationale: 'Could be treated as source material.',
        evidence: ['contains notes'],
      },
    ];

    const proposal = createSingleDestinationProposal({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      duplicateSearch: fixture.duplicateSearch,
      candidates,
    });

    assert.equal(proposal.status, 'ready');
    assert.equal(proposal.materialAmbiguity, false);
    assert.equal(proposal.selectedDestination?.destinationPath, 'knowledge/organisations/prochat/offer.md');
    assert.equal(proposal.ambiguousCandidates.length, 0);
    assert.equal(proposal.safety.writesToMind, false);
    assert.equal(proposal.safety.executesOutcome, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('blocks destination proposal when ambiguity is material', () => {
  const fixture = createFixture();
  try {
    const proposal = createSingleDestinationProposal({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      duplicateSearch: fixture.duplicateSearch,
      candidates: [
        {
          kind: 'knowledge',
          destinationPath: 'knowledge/organisations/prochat/offer.md',
          confidence: 0.82,
          rationale: 'May be durable knowledge.',
          evidence: ['ProChat offer notes'],
        },
        {
          kind: 'projects',
          destinationPath: 'projects/prochat/offer.md',
          confidence: 0.77,
          rationale: 'May be active project material.',
          evidence: ['ProChat offer notes'],
        },
      ],
      ambiguityDelta: 0.1,
    });

    assert.equal(proposal.status, 'ambiguous');
    assert.equal(proposal.selectedDestination, null);
    assert.equal(proposal.materialAmbiguity, true);
    assert.equal(proposal.ambiguousCandidates.length, 2);
    assert(proposal.blockers.includes('materialDestinationAmbiguity'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('requires duplicate search and source preservation before selecting a destination', () => {
  const fixture = createFixture();
  try {
    const proposal = createSingleDestinationProposal({
      classification: fixture.classification,
      sourceRecord: null,
      duplicateSearch: null,
      candidates: [
        {
          kind: 'knowledge',
          destinationPath: 'knowledge/organisations/prochat/offer.md',
          confidence: 0.91,
          rationale: 'Durable knowledge about a ProChat offer belongs in wiki.',
          evidence: ['classification summary mentions ProChat offer'],
        },
      ],
    });

    assert.equal(proposal.status, 'blocked');
    assert.equal(proposal.selectedDestination, null);
    assert(proposal.blockers.includes('captureSourcePreservationRequired'));
    assert(proposal.blockers.includes('duplicateSearchRequired'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('rejects broad or invalid destination candidates', () => {
  const fixture = createFixture();
  try {
    const proposal = createSingleDestinationProposal({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      duplicateSearch: fixture.duplicateSearch,
      candidates: [
        {
          kind: 'wiki',
          destinationPath: 'wiki/',
          confidence: 0.91,
          rationale: 'Broad folder destination should not be allowed.',
          evidence: ['invalid path'],
        },
        {
          kind: 'sources',
          destinationPath: 'sources/*.md',
          confidence: 0.86,
          rationale: 'Glob destination should not be allowed.',
          evidence: ['invalid path'],
        },
      ],
    });

    assert.equal(proposal.status, 'blocked');
    assert.equal(proposal.selectedDestination, null);
    assert(proposal.blockers.includes('destinationCandidateRequired'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('uses duplicate search candidates as a single existing-page destination when clear', () => {
  const fixture = createFixture();
  const durablePath = path.join(fixture.mindRoot, 'knowledge', 'organisations', 'prochat', 'offer.md');
  mkdirSync(path.dirname(durablePath), { recursive: true });
  writeFileSync(durablePath, '# ProChat Offer\n\nProChat QA memory positioning and onboarding plan.\n');

  try {
    const duplicateSearch = runMindStewardDuplicateSearch({
      mindRoot: fixture.mindRoot,
      classification: fixture.classification,
      searchedRoots: ['knowledge'],
      now: new Date('2026-06-18T12:06:00Z'),
    });
    const proposal = createSingleDestinationProposal({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      duplicateSearch,
    });

    assert.equal(proposal.status, 'ready');
    assert.equal(proposal.selectedDestination?.kind, 'knowledge');
    assert.equal(proposal.selectedDestination?.destinationPath, 'knowledge/organisations/prochat/offer.md');
    assert.equal(proposal.ambiguousCandidates.length, 0);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
