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
  type MindStewardReviewedOutcomeType,
} from '../adapters/mind-steward-reviewed-outcome.js';
import { createOriginalCaptureAfterApprovalPlan } from '../adapters/mind-steward-original-capture-after-approval.js';

function createFixture() {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-original-after-approval-'));
  const mindRoot = path.join(tempDir, 'mind');
  const capturePath = path.join(mindRoot, 'capture', 'inbox', 'prochat-offer.md');
  mkdirSync(path.dirname(capturePath), { recursive: true });
  mkdirSync(path.join(mindRoot, 'wiki'), { recursive: true });
  writeFileSync(capturePath, '# ProChat Offer\n\nNotes about ProChat QA memory positioning and onboarding.\n');
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

function reviewedOutcomeFor(
  fixture: ReturnType<typeof createFixture>,
  outcome: MindStewardReviewedOutcomeType,
  kind?: MindStewardDestinationKind,
) {
  return createReviewedCaptureOutcome({
    classification: fixture.classification,
    sourceRecord: fixture.sourceRecord,
    destinationProposal: kind ? destinationProposalFor(fixture, kind) : null,
    outcome,
    review: {
      reviewedBy: 'Steve',
      reviewedAt: '2026-06-18T12:10:00Z',
      reason: 'Reviewed capture lifecycle outcome.',
    },
    taskProposal: outcome === 'create-task-proposal'
      ? { title: 'Review ProChat offer', summary: 'Turn the capture into a reviewed task suggestion.' }
      : null,
  });
}

test('retains original capture in inbox as source evidence for live, wiki, and task outcomes', () => {
  const fixture = createFixture();
  try {
    for (const [outcomeType, kind] of [
      ['promote-live', 'live'],
      ['compile-wiki', 'wiki'],
      ['create-task-proposal', undefined],
    ] as const) {
      const outcome = reviewedOutcomeFor(fixture, outcomeType, kind);
      const plan = createOriginalCaptureAfterApprovalPlan(outcome, fixture.sourceRecord);

      assert.equal(plan.status, 'ready', outcomeType);
      assert.equal(plan.originalCaptureAction, 'retain-in-inbox-as-source-evidence');
      assert.equal(plan.visibleCaptureState, 'approved-retained');
      assert.equal(plan.allowedMoveOperation, null);
      assert.equal(plan.sourceContentSha256, fixture.sourceRecord.originalCapture.contentSha256);
      assert.equal(plan.safety.movesCaptures, false);
      assert.equal(plan.safety.deletesCaptures, false);
      assert.equal(plan.safety.requiresSeparateExactPathApprovalForMove, false);
    }
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('defines source routing and archive outcomes as pending separate exact-path move approval', () => {
  const fixture = createFixture();
  try {
    const sourceOutcome = reviewedOutcomeFor(fixture, 'route-sources', 'sources');
    const sourcePlan = createOriginalCaptureAfterApprovalPlan(sourceOutcome, fixture.sourceRecord);
    assert.equal(sourcePlan.status, 'ready');
    assert.equal(sourcePlan.originalCaptureAction, 'route-original-to-sources-after-separate-exact-path-approval');
    assert.equal(sourcePlan.visibleCaptureState, 'approved-source-routing-pending');
    assert.equal(sourcePlan.allowedMoveOperation, 'source-routing');
    assert.equal(sourcePlan.destinationPath, 'sources/research/prochat-offer.md');
    assert.equal(sourcePlan.safety.requiresSeparateExactPathApprovalForMove, true);

    const archiveOutcome = reviewedOutcomeFor(fixture, 'archive', 'archive');
    const archivePlan = createOriginalCaptureAfterApprovalPlan(archiveOutcome, fixture.sourceRecord);
    assert.equal(archivePlan.status, 'ready');
    assert.equal(archivePlan.originalCaptureAction, 'archive-original-after-separate-exact-path-approval');
    assert.equal(archivePlan.visibleCaptureState, 'approved-archive-routing-pending');
    assert.equal(archivePlan.allowedMoveOperation, 'supersede-archive');
    assert.equal(archivePlan.destinationPath, 'archive/captures/prochat-offer.md');
    assert.equal(archivePlan.safety.movesCaptures, false);
    assert.equal(archivePlan.safety.requiresSeparateExactPathApprovalForMove, true);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('leaves rejected captures in inbox without move or delete', () => {
  const fixture = createFixture();
  try {
    const outcome = reviewedOutcomeFor(fixture, 'reject-leave-in-inbox');
    const plan = createOriginalCaptureAfterApprovalPlan(outcome, fixture.sourceRecord);

    assert.equal(plan.status, 'ready');
    assert.equal(plan.originalCaptureAction, 'leave-rejected-capture-in-inbox');
    assert.equal(plan.visibleCaptureState, 'rejected-left-in-inbox');
    assert.equal(plan.allowedMoveOperation, null);
    assert.equal(plan.destinationPath, null);
    assert.equal(plan.safety.movesCaptures, false);
    assert.equal(plan.safety.deletesCaptures, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('blocks original capture plan when reviewed outcome is not ready', () => {
  const fixture = createFixture();
  try {
    const outcome = createReviewedCaptureOutcome({
      classification: fixture.classification,
      sourceRecord: fixture.sourceRecord,
      destinationProposal: destinationProposalFor(fixture, 'wiki'),
      outcome: 'promote-live',
      review: {
        reviewedBy: 'Steve',
        reviewedAt: '2026-06-18T12:10:00Z',
        reason: 'Mismatched destination should block.',
      },
    });
    const plan = createOriginalCaptureAfterApprovalPlan(outcome, fixture.sourceRecord);

    assert.equal(outcome.status, 'blocked');
    assert.equal(plan.status, 'blocked');
    assert(plan.blockers.includes('reviewedOutcomeMustBeReady'));
    assert.equal(plan.originalCaptureAction, null);
    assert.equal(plan.safety.movesCaptures, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('blocks original capture plan when source record is missing or mismatched', () => {
  const fixture = createFixture();
  try {
    const outcome = reviewedOutcomeFor(fixture, 'archive', 'archive');
    const missingPlan = createOriginalCaptureAfterApprovalPlan(outcome, null);
    assert.equal(missingPlan.status, 'blocked');
    assert(missingPlan.blockers.includes('sourceRecordRequired'));

    const mismatchedPlan = createOriginalCaptureAfterApprovalPlan(outcome, {
      ...fixture.sourceRecord,
      recordId: 'different-source-record',
    });
    assert.equal(mismatchedPlan.status, 'blocked');
    assert(mismatchedPlan.blockers.includes('sourceRecordIdMismatch'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});
