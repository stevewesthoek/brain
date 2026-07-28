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
  type MindStewardDestinationKind,
} from '../adapters/mind-steward-destination-proposal.js';
import {
  createReviewedCaptureOutcome,
  type MindStewardReviewedOutcomeReview,
  type MindStewardReviewedOutcomeType,
} from '../adapters/mind-steward-reviewed-outcome.js';

const REVIEW: MindStewardReviewedOutcomeReview = {
  reviewedBy: 'Steve',
  reviewedAt: '2026-06-18T12:10:00Z',
  reason: 'Reviewed capture lifecycle outcome.',
};

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
  }, new Date('2026-06-18T12:00:00Z'), {
    captureInboxPath: 'inbox/new',
  });
  const classification = output.classifications[0];
  assert(classification);
  return classification;
}

function createFixture() {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-reviewed-outcome-'));
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
  return { tempDir, classification, sourceRecord, duplicateSearch };
}

function destinationProposalFor(
  fixture: ReturnType<typeof createFixture>,
  kind: MindStewardDestinationKind,
) {
  const pathByKind: Partial<Record<MindStewardDestinationKind, string>> = {
    live: 'live/projects/prochat/offer.md',
    wiki: 'wiki/organisations/prochat/offer.md',
    sources: 'sources/research/prochat-offer.md',
    archive: 'archive/captures/prochat-offer.md',
    knowledge: 'knowledge/organisations/prochat/offer.md',
  };
  return createSingleDestinationProposal({
    classification: fixture.classification,
    sourceRecord: fixture.sourceRecord,
    duplicateSearch: fixture.duplicateSearch,
    candidates: [
      {
        kind,
        destinationPath: pathByKind[kind]!,
        confidence: 0.92,
        rationale: `Reviewed destination for ${kind}.`,
        evidence: ['human-reviewed destination candidate'],
      },
    ],
  });
}

test('supports all reviewed capture outcomes without executing writes', () => {
  const fixture = createFixture();
  try {
    const cases: Array<{
      outcome: MindStewardReviewedOutcomeType;
      kind?: MindStewardDestinationKind;
      expectedStatus: 'ready' | 'blocked';
      expectedDestination: string | null;
      expectedBlocker?: string;
    }> = [
      { outcome: 'promote-live', kind: 'live', expectedStatus: 'blocked', expectedDestination: null, expectedBlocker: 'destinationProposalNotReady' },
      { outcome: 'compile-wiki', kind: 'wiki', expectedStatus: 'blocked', expectedDestination: null, expectedBlocker: 'destinationProposalNotReady' },
      { outcome: 'route-sources', kind: 'sources', expectedStatus: 'blocked', expectedDestination: null, expectedBlocker: 'destinationProposalNotReady' },
      { outcome: 'archive', kind: 'archive', expectedStatus: 'blocked', expectedDestination: null, expectedBlocker: 'destinationProposalNotReady' },
      { outcome: 'create-task-proposal', expectedStatus: 'ready', expectedDestination: null },
      { outcome: 'reject-leave-in-inbox', expectedStatus: 'ready', expectedDestination: null },
    ];

    for (const item of cases) {
      const outcome = createReviewedCaptureOutcome({
        classification: fixture.classification,
        sourceRecord: fixture.sourceRecord,
        destinationProposal: item.kind ? destinationProposalFor(fixture, item.kind) : null,
        outcome: item.outcome,
        review: REVIEW,
        taskProposal: item.outcome === 'create-task-proposal'
          ? { title: 'Review ProChat offer', summary: 'Turn the capture into a reviewed task suggestion.' }
          : null,
      });

      assert.equal(outcome.status, item.expectedStatus, item.outcome);
      assert.equal(outcome.destinationPath, item.expectedDestination, item.outcome);
      if (item.expectedBlocker) {
        assert(outcome.blockers.includes(item.expectedBlocker), item.outcome);
      }
      assert.equal(outcome.safety.writesToMind, false);
      assert.equal(outcome.safety.writesKanban, false);
      assert.equal(outcome.safety.movesCaptures, false);
      assert.equal(outcome.safety.deletesCaptures, false);
      assert.equal(outcome.safety.executesOutcome, false);
      assert.equal(outcome.safety.requiresHumanApprovalForExecution, true);
    }
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('blocks reviewed outcome when human review metadata is incomplete', () => {
  const fixture = createFixture();
  try {
    const outcome = createReviewedCaptureOutcome({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      destinationProposal: destinationProposalFor(fixture, 'wiki'),
      outcome: 'compile-wiki',
      review: { reviewedBy: '', reviewedAt: '', reason: '' },
    });

    assert.equal(outcome.status, 'blocked');
    assert(outcome.blockers.includes('reviewerRequired'));
    assert(outcome.blockers.includes('reviewedAtRequired'));
    assert(outcome.blockers.includes('reviewReasonRequired'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('blocks reviewed destination outcome when destination kind does not match outcome', () => {
  const fixture = createFixture();
  try {
    const outcome = createReviewedCaptureOutcome({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      destinationProposal: destinationProposalFor(fixture, 'knowledge'),
      outcome: 'promote-live',
      review: REVIEW,
    });

    assert.equal(outcome.status, 'blocked');
    assert(outcome.blockers.includes('destinationKindMismatch'));
    assert.equal(outcome.destinationPath, 'knowledge/organisations/prochat/offer.md');
    assert.equal(outcome.safety.executesOutcome, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('blocks task proposal outcome when task draft is incomplete', () => {
  const fixture = createFixture();
  try {
    const outcome = createReviewedCaptureOutcome({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      destinationProposal: null,
      outcome: 'create-task-proposal',
      review: REVIEW,
      taskProposal: { title: '', summary: '' },
    });

    assert.equal(outcome.status, 'blocked');
    assert(outcome.blockers.includes('taskProposalTitleRequired'));
    assert(outcome.blockers.includes('taskProposalSummaryRequired'));
    assert.equal(outcome.safety.writesKanban, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('blocks reviewed outcome when source preservation is missing', () => {
  const fixture = createFixture();
  try {
    const outcome = createReviewedCaptureOutcome({
      classification: fixture.classification,
      sourceRecord: null,
      destinationProposal: destinationProposalFor(fixture, 'archive'),
      outcome: 'archive',
      review: REVIEW,
    });

    assert.equal(outcome.status, 'blocked');
    assert(outcome.blockers.includes('captureSourcePreservationRequired'));
    assert.equal(outcome.safety.movesCaptures, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
