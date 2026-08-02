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
        path: 'knowledge/example.md',
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

test('accepts target knowledge and faith paths during Mind folder migration', () => {
  const approval = validApproval({
    targets: [
      {
        path: 'knowledge/example.md',
        expectedBeforeHash: 'a'.repeat(64),
        destinationPath: null,
        allowedSections: ['Approved section'],
        contentIntent: 'Update reviewed knowledge.',
      },
      {
        path: 'faith/studies/romans/overview.md',
        expectedBeforeHash: 'b'.repeat(64),
        destinationPath: null,
        allowedSections: ['Approved section'],
        contentIntent: 'Update reviewed faith study.',
      },
    ],
  });

  const errors = validateExactPathWikiApproval(
    proposal,
    approval,
    new Date('2026-06-17T13:00:00Z'),
  );

  assert.deepEqual(errors, []);
});

test('allows create only when the before hash is null', () => {
  const approval = validApproval({
    action: 'create',
    targets: [{
      path: 'knowledge/new-page.md',
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




test('accepts valid preserved source references', () => {
  const reference = {
    path: 'resources/research/example.md',
    location: '## Evidence',
    summary: 'Supports the approved wiki update.',
  };
  const proposalWithReference: ProposalRecord = { ...proposal, sourceReferences: [reference] };
  const errors = validateExactPathWikiApproval(
    proposalWithReference,
    validApproval({ sourceReferences: [reference] }),
    new Date('2026-06-17T13:00:00Z'),
  );
  assert.deepEqual(errors, []);
});

test('rejects invalid source-reference paths', () => {
  const invalidPaths = [
    'sources/',
    'sources/**/*.md',
    'sources/../wiki/example.md',
    '/sources/example.md',
    'sources\\example.md',
    'wiki/example.md',
    'sources/example.txt',
  ];

  for (const sourcePath of invalidPaths) {
    const errors = validateExactPathWikiApproval(
      proposal,
      validApproval({
        sourceReferences: [{
          path: sourcePath,
          location: '## Evidence',
          summary: 'Supporting evidence.',
        }],
      }),
      new Date('2026-06-17T13:00:00Z'),
    );
    assert(errors.includes(`invalid-source-reference-path:${sourcePath}`));
  }
});

test('rejects source references with missing location or summary', () => {
  const missingLocation = validateExactPathWikiApproval(
    proposal,
    validApproval({
      sourceReferences: [{ path: 'sources/example.md', location: ' ', summary: 'Evidence.' }],
    }),
    new Date('2026-06-17T13:00:00Z'),
  );
  assert(missingLocation.includes('source-reference-location-required:sources/example.md'));

  const missingSummary = validateExactPathWikiApproval(
    proposal,
    validApproval({
      sourceReferences: [{ path: 'sources/example.md', location: '## Evidence', summary: ' ' }],
    }),
    new Date('2026-06-17T13:00:00Z'),
  );
  assert(missingSummary.includes('source-reference-summary-required:sources/example.md'));
});

test('rejects removal of an existing source reference without replacement approval', () => {
  const existingReference = {
    path: 'sources/existing.md',
    location: 'lines 10-20',
    summary: 'Existing supporting evidence.',
  };
  const errors = validateExactPathWikiApproval(
    { ...proposal, sourceReferences: [existingReference] },
    validApproval({ sourceReferences: [] }),
    new Date('2026-06-17T13:00:00Z'),
  );
  assert(errors.includes('existing-source-reference-must-be-preserved:sources/existing.md'));
});

test('accepts explicitly approved replacement source references', () => {
  const errors = validateExactPathWikiApproval(
    {
      ...proposal,
      sourceReferences: [{
        path: 'resources/old.md',
        location: '## Old evidence',
        summary: 'Previously approved evidence.',
      }],
    },
    validApproval({
      replaceSourceReferences: true,
      sourceReferences: [{
        path: 'resources/new.md',
        location: '## New evidence',
        summary: 'Explicit approved replacement evidence.',
      }],
    }),
    new Date('2026-06-17T13:00:00Z'),
  );
  assert.deepEqual(errors, []);
});
