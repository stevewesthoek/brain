import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validateExactPathWikiApproval,
  type ProposalApprovalRecord,
  type ProposalRecord,
} from '../adapters/infinite-brain-proposal-application-planner.js';

const proposal: ProposalRecord = {
  proposalId: 'proposal-wiki-1',
  category: 'wiki-writing',
  title: 'Update canonical wiki page',
  summary: 'Apply an approved bounded wiki update.',
  sourcePaths: ['system/reports/maintenance-latest.json'],
  proposedAction: 'Update the approved section.',
  confidence: 0.95,
  riskLevel: 'medium',
  writesToMindIfApproved: true,
};

function validApproval(overrides: Partial<ProposalApprovalRecord> = {}): ProposalApprovalRecord {
  return {
    proposalId: proposal.proposalId,
    decision: 'approved',
    approvalId: 'mind-approval-20260617-test',
    sourceReportId: 'report-1',
    sourceRepo: 'mind',
    sourceCommit: '0123456789abcdef0123456789abcdef01234567',
    approvedBy: 'human-reviewer',
    approvedAt: '2026-06-17T12:00:00Z',
    expiresAt: '2026-06-18T12:00:00Z',
    action: 'update',
    reason: 'Approved bounded wiki update.',
    targets: [
      {
        path: 'wiki/example.md',
        expectedBeforeHash: 'a'.repeat(64),
        destinationPath: null,
        allowedSections: ['Approved section'],
        contentIntent: 'Replace only the approved section with reviewed content.',
      },
    ],
    ...overrides,
  };
}

test('accepts a complete exact-path wiki update approval', () => {
  const errors = validateExactPathWikiApproval(
    proposal,
    validApproval(),
    new Date('2026-06-17T13:00:00Z'),
  );

  assert.deepEqual(errors, []);
});

test('rejects broad, traversing, and non-wiki targets', () => {
  const invalidTargets = [
    'wiki/',
    'wiki/**/*.md',
    'wiki/../live/status.md',
    'live/status.md',
  ];

  for (const targetPath of invalidTargets) {
    const approval = validApproval({
      targets: [{
        path: targetPath,
        expectedBeforeHash: 'a'.repeat(64),
        destinationPath: null,
        allowedSections: [],
        contentIntent: 'Bounded update.',
      }],
    });

    const errors = validateExactPathWikiApproval(
      proposal,
      approval,
      new Date('2026-06-17T13:00:00Z'),
    );

    assert(errors.includes(`invalid-wiki-target:${targetPath}`));
  }
});

test('rejects expired approvals and update targets without a before hash', () => {
  const approval = validApproval({
    expiresAt: '2026-06-17T12:30:00Z',
    targets: [{
      path: 'wiki/example.md',
      expectedBeforeHash: null,
      destinationPath: null,
      allowedSections: ['Approved section'],
      contentIntent: 'Bounded update.',
    }],
  });

  const errors = validateExactPathWikiApproval(
    proposal,
    approval,
    new Date('2026-06-17T13:00:00Z'),
  );

  assert(errors.includes('approval-expired'));
  assert(errors.includes('expected-before-hash-required:wiki/example.md'));
});

test('allows create only when the before hash is null', () => {
  const approval = validApproval({
    action: 'create',
    targets: [{
      path: 'wiki/new-page.md',
      expectedBeforeHash: null,
      destinationPath: null,
      allowedSections: [],
      contentIntent: 'Create the approved canonical page.',
    }],
  });

  const errors = validateExactPathWikiApproval(
    proposal,
    approval,
    new Date('2026-06-17T13:00:00Z'),
  );

  assert.deepEqual(errors, []);
});
