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
import { createReviewedCaptureOutcome } from '../adapters/mind-steward-reviewed-outcome.js';
import { createTaskProposalOnlyRecord } from '../adapters/mind-steward-task-proposal.js';
import { runTasksWriterDisabled } from '../adapters/infinite-brain-writers/writer-tasks.js';

function createTaskOutcome() {
  const tempDir = mkdtempSync(path.join('/tmp', 'mind-task-proposal-'));
  const mindRoot = path.join(tempDir, 'mind');
  const capturePath = path.join(mindRoot, 'capture', 'inbox', 'task-capture.md');
  mkdirSync(path.dirname(capturePath), { recursive: true });
  writeFileSync(capturePath, '# Task Capture\n\nFollow up with ProChat onboarding checklist.\n');
  const output = normalizeCaptureClassificationOutput({
    status: 'ok',
    selector: { status: 'selected' },
    inbox: {
      sampledFiles: [
        {
          name: 'task-capture.md',
          preview: '# Task Capture\n\nFollow up with ProChat onboarding checklist.',
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
  const outcome = createReviewedCaptureOutcome({
    classification,
    sourceRecord,
    destinationProposal: null,
    outcome: 'create-task-proposal',
    review: {
      reviewedBy: 'Steve',
      reviewedAt: '2026-06-18T12:10:00Z',
      reason: 'Capture should become a task suggestion.',
    },
    taskProposal: {
      title: 'Follow up with ProChat onboarding checklist',
      summary: 'Prepare a reviewed task suggestion from the capture.',
    },
  });
  return { tempDir, outcome };
}

test('task generation remains proposal-only with Kanban writes disabled', () => {
  const fixture = createTaskOutcome();
  try {
    const proposal = createTaskProposalOnlyRecord({ outcome: fixture.outcome });

    assert.equal(proposal.status, 'ready');
    assert.equal(proposal.title, 'Follow up with ProChat onboarding checklist');
    assert.deepEqual(proposal.sourceLinks, [{
      type: 'capture',
      path: 'capture/inbox/task-capture.md',
      summary: 'Source capture for task proposal.',
    }]);
    assert.equal(proposal.reviewSurface, 'inbox/processed');
    assert.equal(proposal.protectedKanbanPath, 'tasks.md');
    assert.equal(proposal.proposalOnly, true);
    assert.equal(proposal.executionAllowed, false);
    assert.equal(proposal.safety.writesToMind, false);
    assert.equal(proposal.safety.writesKanban, false);
    assert.equal(proposal.safety.createsTaskRecord, false);
    assert.equal(proposal.safety.mutatesExistingTask, false);
    assert.equal(proposal.safety.requiresLosslessSyncBeforeWrite, true);
    assert.equal(proposal.safety.requiresExplicitApprovalBeforeWrite, true);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('task proposal-only records can link to a reviewed decision source', () => {
  const fixture = createTaskOutcome();
  try {
    const proposal = createTaskProposalOnlyRecord({
      outcome: fixture.outcome,
      sourceLinks: [
        {
          type: 'decision',
          path: 'live/decisions.md',
          summary: 'Decision to prioritize ProChat onboarding improvements.',
        },
      ],
    });

    assert.equal(proposal.status, 'ready');
    assert.deepEqual(proposal.sourceLinks, [
      {
        type: 'capture',
        path: 'capture/inbox/task-capture.md',
        summary: 'Source capture for task proposal.',
      },
      {
        type: 'decision',
        path: 'live/decisions.md',
        summary: 'Decision to prioritize ProChat onboarding improvements.',
      },
    ]);
    assert.equal(proposal.safety.writesKanban, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('task proposal-only records accept target inbox and decision source links', () => {
  const fixture = createTaskOutcome();
  try {
    const proposal = createTaskProposalOnlyRecord({
      outcome: {
        ...fixture.outcome,
        capturePath: 'inbox/new/task-capture.md',
      },
      sourceLinks: [
        {
          type: 'decision',
          path: 'knowledge/decisions.md',
          summary: 'Target decision source for task proposal.',
        },
      ],
    });

    assert.equal(proposal.status, 'ready');
    assert.deepEqual(proposal.sourceLinks, [
      {
        type: 'capture',
        path: 'inbox/new/task-capture.md',
        summary: 'Source capture for task proposal.',
      },
      {
        type: 'decision',
        path: 'knowledge/decisions.md',
        summary: 'Target decision source for task proposal.',
      },
    ]);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('task proposal-only gate blocks proposals without source capture or decision links', () => {
  const fixture = createTaskOutcome();
  try {
    const proposal = createTaskProposalOnlyRecord({
      outcome: {
        ...fixture.outcome,
        capturePath: null,
      },
    });

    assert.equal(proposal.status, 'blocked');
    assert(proposal.blockers.includes('taskSourceLinkRequired'));
    assert.deepEqual(proposal.sourceLinks, []);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('task proposal-only gate blocks unsafe source links', () => {
  const fixture = createTaskOutcome();
  try {
    const proposal = createTaskProposalOnlyRecord({
      outcome: fixture.outcome,
      sourceLinks: [
        {
          type: 'decision',
          path: 'live/',
          summary: 'Broad destination is not a decision source.',
        },
        {
          type: 'capture',
          path: 'capture/../kanban.md',
          summary: '',
        },
      ],
    });

    assert.equal(proposal.status, 'blocked');
    assert(proposal.blockers.includes('invalidTaskSourceLink:live/'));
    assert(proposal.blockers.includes('invalidTaskSourceLink:capture/../kanban.md'));
    assert.equal(proposal.safety.writesKanban, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('task proposal-only gate blocks requested Kanban writes', () => {
  const fixture = createTaskOutcome();
  try {
    const proposal = createTaskProposalOnlyRecord({
      outcome: fixture.outcome,
      requestKanbanWrite: true,
    });

    assert.equal(proposal.status, 'blocked');
    assert.equal(proposal.executionAllowed, false);
    assert(proposal.blockers.includes('kanbanWritesDisabledUntilLosslessSync'));
    assert.equal(proposal.safety.writesKanban, false);
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('task proposal-only gate blocks non-task reviewed outcomes', () => {
  const fixture = createTaskOutcome();
  try {
    const proposal = createTaskProposalOnlyRecord({
      outcome: {
        ...fixture.outcome,
        outcome: 'reject-leave-in-inbox',
        taskProposal: null,
      },
    });

    assert.equal(proposal.status, 'blocked');
    assert(proposal.blockers.includes('createTaskProposalOutcomeRequired'));
    assert(proposal.blockers.includes('taskProposalDraftRequired'));
  } finally {
    rmSync(fixture.tempDir, { recursive: true, force: true });
  }
});

test('existing task writer remains blocked and non-writing', async () => {
  const result = await runTasksWriterDisabled({
    dryRunId: 'task-proposal-only-test',
    applicationPlanId: 'task-proposal-only-plan',
    category: 'task-extraction',
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.canWrite, false);
  assert.equal(result.wroteToMind, false);
  assert.equal(result.applied, false);
  assert.equal(result.safety.writesToMind, false);
  assert.equal(result.safety.canWrite, false);
  assert(result.blockers.some(blocker => blocker.includes('Task schema/write gate not yet approved')));
});
