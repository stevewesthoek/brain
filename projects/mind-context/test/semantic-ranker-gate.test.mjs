import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEvaluationCorpus, summarizeMetrics} from '../src/evals/index.mjs';
import {compareSemanticRankerRuns} from '../src/evals/gate.mjs';

const corpus = loadEvaluationCorpus();

function makeCase(testCase, overrides = {}) {
  const sourceId = `${testCase.caseId}-source`;
  const pack = {
    sources: [
      {
        sourceId,
        path: `${testCase.caseId}.md`,
        authority: 'supporting',
        citation: `citation:${sourceId}`,
        sha256: 'a'.repeat(64),
        freshness: 'fresh',
        scope: testCase.allowedScopes[0] ?? 'fixtures/test',
        untrusted: false,
      },
    ],
    conflicts: overrides.conflicts ?? [{field: 'status', leftSourceId: sourceId, rightSourceId: `${sourceId}-b`}],
    unknowns: overrides.unknowns ?? (testCase.expectedUnknowns?.length ? [...testCase.expectedUnknowns] : []),
    budget: overrides.budget ?? {maxItems: 3, maxTokens: 300, usedItems: 1, usedTokens: 10},
    truncation: {truncated: false, reason: null},
    safetyWarnings: [],
    privacyClassification: overrides.privacyClassification ?? testCase.privacyClassification,
    freshness: 'fresh',
  };
  return {
    caseId: testCase.caseId,
    precision: overrides.precision ?? 1,
    recall: overrides.recall ?? 1,
    forbiddenViolations: overrides.forbiddenViolations ?? 0,
    outOfScopeViolations: overrides.outOfScopeViolations ?? 0,
    privacyViolations: overrides.privacyViolations ?? 0,
    authorityMatch: overrides.authorityMatch ?? 1,
    freshnessMatch: overrides.freshnessMatch ?? 1,
    citationCompleteness: overrides.citationCompleteness ?? 1,
    conflictPreservation: overrides.conflictPreservation ?? pack.conflicts.length,
    unknownPreservation: overrides.unknownPreservation ?? pack.unknowns.length,
    budgetCompliance: overrides.budgetCompliance ?? 1,
    tokenEstimate: overrides.tokenEstimate ?? 10,
    latencyMs: overrides.latencyMs ?? 1,
    selectedSourceIds: overrides.selectedSourceIds ?? [sourceId],
    expectedSourceIds: [...(testCase.expectedSources ?? [])],
    pack,
    testCase,
  };
}

function makeRun({runId, cases, rankerId = 'lexical-baseline', deterministic = true, corpusVersion = corpus.version, schemaVersion = '1.0.0', metricDefinitionVersion = '1.0.0', modelSuppliedAuthority = false} = {}) {
  return {
    runId,
    schemaVersion,
    metricDefinitionVersion,
    rankerId,
    rankerConfiguration: {kind: 'lexical', deterministic, modelSuppliedAuthority},
    deterministic,
    generatedAt: '2026-07-16T18:30:06.978Z',
    corpusVersion,
    registryVersion: '1.0.0',
    packageVersion: '1.0.0',
    summary: summarizeMetrics(cases),
    cases,
  };
}

function makeBaselineAndCandidate(options = {}) {
  const cases = corpus.cases.map((testCase) => makeCase(testCase, options.caseOverrides?.[testCase.caseId]));
  const baseline = makeRun({runId: 'baseline', cases});
  const candidateCases = corpus.cases.map((testCase) => makeCase(testCase, options.candidateOverrides?.[testCase.caseId] ?? options.caseOverrides?.[testCase.caseId]));
  const candidate = makeRun({runId: 'candidate', cases: candidateCases});
  return {baseline, candidate};
}

test('equal candidate passes', () => {
  const {baseline, candidate} = makeBaselineAndCandidate();
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, true);
  assert.equal(result.decision, 'pass');
});

test('clearly better candidate passes', () => {
  const {baseline, candidate} = makeBaselineAndCandidate({
    caseOverrides: {
      'exact-known': {precision: 0.2},
    },
    candidateOverrides: {
      'exact-known': {precision: 0.9},
    },
  });
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, true);
  assert(result.aggregateDeltas.precisionDelta > 0);
});

test('worse precision candidate fails according to configured threshold', () => {
  const {baseline, candidate} = makeBaselineAndCandidate({
    caseOverrides: {
      'exact-known': {precision: 0.8},
    },
    candidateOverrides: {
      'exact-known': {precision: 0.6},
    },
  });
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus, precisionDropThreshold: 0.05});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('exact-known:precision_regression'));
});

test('privacy regression fails regardless of average precision', () => {
  const {baseline, candidate} = makeBaselineAndCandidate({
    candidateOverrides: {
      'privacy-sensitive': {privacyViolations: 1},
    },
  });
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('privacy-sensitive:privacy_regression'));
});

test('forbidden-source regression fails', () => {
  const {baseline, candidate} = makeBaselineAndCandidate({
    candidateOverrides: {
      'forbidden-source': {forbiddenViolations: 1},
    },
  });
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('forbidden-source:forbidden_source_regression'));
});

test('citation regression fails', () => {
  const {baseline, candidate} = makeBaselineAndCandidate({
    candidateOverrides: {
      'missing-citation': {citationCompleteness: 0, selectedSourceIds: ['missing-citation-source']},
    },
  });
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('missing-citation:citation_regression'));
});

test('conflict suppression fails', () => {
  const {baseline, candidate} = makeBaselineAndCandidate({
    baselineOverrides: {
      'contradictory': {conflictPreservation: 2},
    },
    candidateOverrides: {
      'contradictory': {conflictPreservation: 0, conflicts: []},
    },
  });
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('contradictory:conflict_suppression'));
});

test('unknown suppression fails', () => {
  const {baseline, candidate} = makeBaselineAndCandidate({
    baselineOverrides: {
      'expected-unknown': {unknownPreservation: 1, unknowns: ['missing-record']},
    },
    candidateOverrides: {
      'expected-unknown': {unknownPreservation: 0, unknowns: []},
    },
  });
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('expected-unknown:unknown_suppression'));
});

test('incompatible corpus version fails', () => {
  const {baseline, candidate} = makeBaselineAndCandidate();
  candidate.corpusVersion = '2.0.0';
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('corpus_version_mismatch'));
});

test('missing case fails', () => {
  const {baseline, candidate} = makeBaselineAndCandidate();
  candidate.cases.pop();
  candidate.summary = summarizeMetrics(candidate.cases);
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.some((reason) => reason.startsWith('missing_case:')));
});

test('non-deterministic candidate fails', () => {
  const {baseline, candidate} = makeBaselineAndCandidate();
  candidate.deterministic = false;
  candidate.rankerConfiguration.deterministic = false;
  const result = compareSemanticRankerRuns({baselineRun: baseline, candidateRun: candidate, corpus});
  assert.equal(result.passed, false);
  assert(result.reasons.includes('candidate_nondeterministic'));
});
