import assert from 'node:assert/strict';
import test from 'node:test';
import { detectSourceGapFindings } from '../mind-maintenance-pilot/source-gap-detector.js';
import type { LoadedMindMaintenancePilotFile } from '../mind-maintenance-pilot/pilot-file-loader.js';

function createFile(
  path: LoadedMindMaintenancePilotFile['path'] = 'wiki/organisations/prochat/brand/prochat-os-strategy.md',
): LoadedMindMaintenancePilotFile {
  return {
    path,
    absolutePath: `/tmp/mind/${path}`,
    content: '# Strategy\n',
  };
}

test('emits a finding for an exact high-impact external factual claim without provenance', () => {
  const file = createFile();
  const result = detectSourceGapFindings({
    file,
    reportDate: '2026-06-13',
    candidates: [
      {
        path: file.path,
        location: 'Market position section',
        claim: 'ProChat OS is the most widely adopted AI operating system in its market.',
        kind: 'external-factual',
        impact: 'high',
        presentedAsCurrentTruth: true,
        provenance: [],
      },
    ],
  });

  assert.equal(result.findings.length, 1);
  assert.equal(result.ambiguousCandidates.length, 0);
  assert.equal(result.excludedCandidates.length, 0);

  const finding = result.findings[0];
  assert.ok(finding);
  assert.equal(finding.type, 'source-gap');
  assert.equal(finding.status, 'open');
  assert.deepEqual(finding.paths, [file.path]);
  assert.equal(finding.matchedEvidence.length, 1);
  assert.match(finding.matchedEvidence[0]!.summary, /most widely adopted/i);
  assert.equal(finding.requiresApproval, true);
  assert.equal(finding.noWritePerformed, true);
  assert.match(finding.recommendedAction, /add a source or decision reference only if/i);
});

test('does not flag strategic choices, beliefs, product principles, or self-authored definitions', () => {
  const file = createFile();
  const result = detectSourceGapFindings({
    file,
    reportDate: '2026-06-13',
    candidates: [
      {
        path: file.path,
        location: 'Strategy',
        claim: 'ProChat OS should remain the flagship product.',
        kind: 'strategic-choice',
        impact: 'high',
        presentedAsCurrentTruth: true,
        provenance: [],
      },
      {
        path: file.path,
        location: 'Principles',
        claim: 'The product should feel calm and human-first.',
        kind: 'product-principle',
        impact: 'high',
        presentedAsCurrentTruth: true,
        provenance: [],
      },
      {
        path: file.path,
        location: 'Definition',
        claim: 'Infinite Brain means selective retrieval with preserved history.',
        kind: 'self-authored-definition',
        impact: 'high',
        presentedAsCurrentTruth: true,
        provenance: [],
      },
      {
        path: file.path,
        location: 'Conviction',
        claim: 'People deserve AI systems they can trust.',
        kind: 'personal-belief',
        impact: 'high',
        presentedAsCurrentTruth: true,
        provenance: [],
      },
    ],
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.ambiguousCandidates.length, 0);
  assert.equal(result.excludedCandidates.length, 4);
});

test('does not flag sourced, low-impact, or non-current factual claims', () => {
  const file = createFile();
  const result = detectSourceGapFindings({
    file,
    reportDate: '2026-06-13',
    candidates: [
      {
        path: file.path,
        location: 'Evidence',
        claim: 'The market grew in 2025.',
        kind: 'external-factual',
        impact: 'high',
        presentedAsCurrentTruth: true,
        provenance: ['sources/market-report.md'],
      },
      {
        path: file.path,
        location: 'Background',
        claim: 'A competitor launched a feature last year.',
        kind: 'external-factual',
        impact: 'low',
        presentedAsCurrentTruth: true,
        provenance: [],
      },
      {
        path: file.path,
        location: 'History',
        claim: 'The old roadmap once targeted Q1.',
        kind: 'external-factual',
        impact: 'high',
        presentedAsCurrentTruth: false,
        provenance: [],
      },
    ],
  });

  assert.equal(result.findings.length, 0);
  assert.equal(result.excludedCandidates.length, 3);
});

test('routes ambiguous claims for later bounded semantic review without creating findings', () => {
  const file = createFile();
  const candidate = {
    path: file.path,
    location: 'Positioning',
    claim: 'ProChat OS is becoming the standard operating layer for AI work.',
    kind: 'ambiguous' as const,
    impact: 'high' as const,
    presentedAsCurrentTruth: true,
    provenance: [],
  };

  const result = detectSourceGapFindings({
    file,
    reportDate: '2026-06-13',
    candidates: [candidate],
  });

  assert.equal(result.findings.length, 0);
  assert.deepEqual(result.ambiguousCandidates, [candidate]);
  assert.equal(result.excludedCandidates.length, 0);
});

test('requires exact candidate path, location, and claim text', () => {
  const file = createFile();

  assert.throws(
    () =>
      detectSourceGapFindings({
        file,
        reportDate: '2026-06-13',
        candidates: [
          {
            path: 'live/dashboard.md',
            location: 'Strategy',
            claim: 'A factual claim.',
            kind: 'external-factual',
            impact: 'high',
            presentedAsCurrentTruth: true,
            provenance: [],
          },
        ],
      }),
    /path must match/i,
  );

  assert.throws(
    () =>
      detectSourceGapFindings({
        file,
        reportDate: '2026-06-13',
        candidates: [
          {
            path: file.path,
            location: '',
            claim: 'A factual claim.',
            kind: 'external-factual',
            impact: 'high',
            presentedAsCurrentTruth: true,
            provenance: [],
          },
        ],
      }),
    /exact location/i,
  );

  assert.throws(
    () =>
      detectSourceGapFindings({
        file,
        reportDate: '2026-06-13',
        candidates: [
          {
            path: file.path,
            location: 'Strategy',
            claim: '   ',
            kind: 'external-factual',
            impact: 'high',
            presentedAsCurrentTruth: true,
            provenance: [],
          },
        ],
      }),
    /exact claim/i,
  );
});

test('rejects invalid report dates', () => {
  const file = createFile();

  assert.throws(
    () =>
      detectSourceGapFindings({
        file,
        reportDate: '13-06-2026',
        candidates: [],
      }),
    /ISO report date/i,
  );
});
