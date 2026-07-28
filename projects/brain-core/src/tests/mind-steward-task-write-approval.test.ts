import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { MindStewardTaskProposalOnlyRecord } from '../adapters/mind-steward-task-proposal.js';
import {
  evaluateTaskWriteApprovalGate,
  type MindStewardTaskWriteApprovalEvidence,
} from '../adapters/mind-steward-task-write-approval.js';
import { validateKanbanRoundTripFixture } from '../adapters/mind-steward-kanban-round-trip-fixture.js';
import { runTasksWriterDisabled } from '../adapters/infinite-brain-writers/writer-tasks.js';

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function taskProposal(): MindStewardTaskProposalOnlyRecord {
  return {
    proposalId: 'task-proposal-only-approved-fixture',
    status: 'ready',
    outcomeId: 'reviewed-outcome-task-fixture',
    capturePath: 'inbox/new/task-capture.md',
    title: 'Follow up with ProChat onboarding checklist',
    summary: 'Prepare a reviewed task suggestion from the capture.',
    sourceLinks: [
      {
        type: 'capture',
        path: 'inbox/new/task-capture.md',
        summary: 'Source capture for task proposal.',
      },
    ],
    reviewSurface: 'wiki/log.md',
    protectedKanbanPath: 'kanban.md',
    proposalOnly: true,
    executionAllowed: false,
    blockers: [],
    safety: {
      writesToMind: false,
      writesKanban: false,
      createsTaskRecord: false,
      mutatesExistingTask: false,
      requiresLosslessSyncBeforeWrite: true,
      requiresExplicitApprovalBeforeWrite: true,
    },
  };
}

function roundTripReport() {
  return validateKanbanRoundTripFixture({
    source: 'kanban.md',
    columns: [
      { name: 'Backlog', cardCount: 1 },
      { name: 'Done', cardCount: 1 },
    ],
    pluginSettingsRaw: `%% kanban:settings
\`\`\`
{"kanban-plugin":"board"}
\`\`\`
%%`,
    cards: [
      {
        column: 'Backlog',
        line: 4,
        checked: false,
        title: 'Save to mind improvements #p3 #you',
        raw: '- [ ] Save to mind improvements #p3 #you',
        tags: ['#p3', '#you'],
        completedAt: null,
        subtasks: [
          {
            line: 5,
            checked: true,
            title: 'Normalize producer tags output ✅ 2026-06-10',
            raw: '  - [x] Normalize producer tags output ✅ 2026-06-10',
            tags: [],
            completedAt: '2026-06-10',
          },
        ],
      },
      {
        column: 'Done',
        line: 10,
        checked: true,
        title: 'Ship Save to Mind deployment ✅ 2026-06-01',
        raw: '- [x] Ship Save to Mind deployment ✅ 2026-06-01',
        tags: [],
        completedAt: '2026-06-01',
        subtasks: [],
      },
    ],
  });
}

function approval(
  proposalId = taskProposal().proposalId,
  candidateMarkdown = roundTripReport().candidateMarkdown ?? '',
): MindStewardTaskWriteApprovalEvidence {
  const beforeHash = 'a'.repeat(64);
  return {
    approvalId: 'task-write-approval-20260618T121500Z',
    proposalId,
    approvedBy: 'Steve',
    approvedAt: '2026-06-18T12:15:00Z',
    reason: 'Approve replacing kanban.md from the lossless candidate after reviewing the exact diff.',
    approvedOperation: 'replace-kanban-from-lossless-candidate',
    targetPath: 'kanban.md',
    expectedBeforeSha256: beforeHash,
    backupPath: 'runtime/local/mind-steward/kanban-backups/kanban-20260618T121500Z.md',
    backupSha256: beforeHash,
    candidateMarkdownSha256: sha256(candidateMarkdown),
    maxFilesChanged: 1,
    manualKanbanWriteConfirm: true,
  };
}

test('task write approval gate accepts explicit approval for canonical kanban.md without writing Mind', () => {
  const proposal = taskProposal();
  const roundTrip = roundTripReport();
  const targetApproval = approval(proposal.proposalId, roundTrip.candidateMarkdown ?? '');
  targetApproval.targetPath = 'kanban.md';
  const report = evaluateTaskWriteApprovalGate({
    proposal,
    roundTripReport: roundTrip,
    approval: targetApproval,
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.canRequestTaskWrite, true);
  assert.equal(report.targetPath, 'kanban.md');
  assert.equal(report.safety.writesToMind, false);
  assert.equal(report.safety.writesKanban, false);
});

test('task write approval gate accepts explicit approval without writing Kanban', () => {
  const proposal = taskProposal();
  const roundTrip = roundTripReport();
  const report = evaluateTaskWriteApprovalGate({
    proposal,
    roundTripReport: roundTrip,
    approval: approval(proposal.proposalId, roundTrip.candidateMarkdown ?? ''),
  });

  assert.equal(report.status, 'ready');
  assert.equal(report.canRequestTaskWrite, true);
  assert.equal(report.approvalRequired, true);
  assert.equal(report.targetPath, 'kanban.md');
  assert.equal(report.blockers.length, 0);
  assert(report.checks.every(check => check.status === 'pass'));
  assert.equal(report.safety.writesToMind, false);
  assert.equal(report.safety.writesKanban, false);
  assert.equal(report.safety.executesWrite, false);
  assert.equal(report.safety.exactPathOnly, true);
  assert.equal(report.safety.maxFilesChanged, 1);
  assert.equal(report.safety.requiresHumanApproval, true);
  assert.equal(report.safety.requiresLosslessRoundTrip, true);
  assert.equal(report.safety.requiresBackup, true);
});

test('task write approval gate blocks missing approval evidence', () => {
  const report = evaluateTaskWriteApprovalGate({
    proposal: taskProposal(),
    roundTripReport: roundTripReport(),
    approval: null,
  });

  assert.equal(report.status, 'blocked');
  assert.equal(report.canRequestTaskWrite, false);
  assert(report.blockers.includes('explicitHumanApprovalRequired'));
  assert.equal(report.safety.writesKanban, false);
});

test('task write approval gate blocks broad or non-task write targets', () => {
  const proposal = taskProposal();
  const roundTrip = roundTripReport();
  const report = evaluateTaskWriteApprovalGate({
    proposal,
    roundTripReport: roundTrip,
    approval: {
      ...approval(proposal.proposalId, roundTrip.candidateMarkdown ?? ''),
      targetPath: 'live/tasks.md',
      maxFilesChanged: 2,
    },
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('exactKanbanTargetRequired'));
  assert(report.blockers.includes('singleKanbanFileWriteScopeRequired'));
  assert.equal(report.safety.exactPathOnly, true);
});

test('task write approval gate blocks failed lossless round-trip evidence', () => {
  const proposal = taskProposal();
  const blockedRoundTrip = validateKanbanRoundTripFixture({
    source: 'kanban.md',
    columns: [{ name: 'Backlog', cardCount: 2 }],
    cards: [
      {
        column: 'Backlog',
        line: 4,
        checked: false,
        title: 'One task',
        raw: '- [ ] One task',
        tags: [],
        completedAt: null,
        subtasks: [],
      },
    ],
  });
  const report = evaluateTaskWriteApprovalGate({
    proposal,
    roundTripReport: blockedRoundTrip,
    approval: approval(proposal.proposalId, blockedRoundTrip.candidateMarkdown ?? ''),
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('readyLosslessRoundTripRequired'));
  assert.equal(report.canRequestTaskWrite, false);
});

test('task write approval gate blocks candidate hash and backup mismatches', () => {
  const proposal = taskProposal();
  const roundTrip = roundTripReport();
  const report = evaluateTaskWriteApprovalGate({
    proposal,
    roundTripReport: roundTrip,
    approval: {
      ...approval(proposal.proposalId, roundTrip.candidateMarkdown ?? ''),
      candidateMarkdownSha256: 'b'.repeat(64),
      backupPath: 'kanban.md',
      backupSha256: 'c'.repeat(64),
    },
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('candidateMarkdownHashMismatch'));
  assert(report.blockers.includes('kanbanBackupEvidenceRequired'));
});

test('task write approval gate blocks proposal mismatch and missing manual confirmation', () => {
  const proposal = taskProposal();
  const roundTrip = roundTripReport();
  const report = evaluateTaskWriteApprovalGate({
    proposal,
    roundTripReport: roundTrip,
    approval: {
      ...approval('different-proposal', roundTrip.candidateMarkdown ?? ''),
      manualKanbanWriteConfirm: false,
    },
  });

  assert.equal(report.status, 'blocked');
  assert(report.blockers.includes('approvalProposalMismatch'));
  assert(report.blockers.includes('manualKanbanWriteConfirmationRequired'));
});

test('task write approval gate does not unblock the disabled task writer', async () => {
  const writerResult = await runTasksWriterDisabled({
    dryRunId: 'task-write-approval-test',
    applicationPlanId: 'task-write-approval-plan',
    category: 'task-extraction',
  });

  assert.equal(writerResult.status, 'blocked');
  assert.equal(writerResult.canWrite, false);
  assert.equal(writerResult.wroteToMind, false);
  assert.equal(writerResult.safety.writesToMind, false);
  assert(writerResult.blockers.some(blocker => blocker.includes('Task schema/write gate not yet approved')));
});
