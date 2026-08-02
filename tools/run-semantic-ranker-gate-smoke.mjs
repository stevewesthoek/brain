import {compareSemanticRankerRuns} from '../projects/mind-context/src/evals/index.mjs';

const corpus = {
  version: '1.0.0',
  cases: [
    {
      caseId: 'smoke-known',
      citationBehavior: 'required',
    },
  ],
};

const caseResult = {
  caseId: 'smoke-known',
  precision: 1,
  recall: 1,
  forbiddenViolations: 0,
  outOfScopeViolations: 0,
  privacyViolations: 0,
  authorityMatch: 1,
  freshnessMatch: 1,
  citationCompleteness: 1,
  conflictPreservation: 1,
  unknownPreservation: 1,
  budgetCompliance: 1,
  tokenEstimate: 0,
  latencyMs: 0,
  selectedSourceIds: ['smoke-source'],
  expectedSourceIds: ['smoke-source'],
  pack: {
    sources: [
      {
        sourceId: 'smoke-source',
        path: 'fixtures/smoke/source.md',
        citation: 'fixtures/smoke/source.md#L1',
        authority: 'canonical',
        freshness: 'fresh',
      },
    ],
    conflicts: [],
    unknowns: [],
    budget: {
      maxItems: 1,
      maxTokens: 100,
      usedItems: 1,
      usedTokens: 10,
    },
    truncation: {
      truncated: false,
      reason: null,
    },
    safetyWarnings: [],
  },
};

const baselineRun = {
  schemaVersion: '1.0.0',
  metricDefinitionVersion: '1.0.0',
  deterministic: true,
  rankerId: 'lexical-baseline',
  rankerConfiguration: {kind: 'lexical', deterministic: true},
  corpusVersion: '1.0.0',
  summary: {
    cases: 1,
    precision: 1,
    recall: 1,
    forbiddenViolations: 0,
    outOfScopeViolations: 0,
    privacyViolations: 0,
    authorityMatch: 1,
    freshnessMatch: 1,
    citationCompleteness: 1,
    conflictPreservation: 1,
    unknownPreservation: 1,
    budgetCompliance: 1,
    tokenEstimate: 0,
    latencyMs: 0,
  },
  cases: [caseResult],
};

const candidateRun = structuredClone(baselineRun);
candidateRun.rankerId = 'semantic-ranker-gate-smoke';
candidateRun.rankerConfiguration = {kind: 'smoke', deterministic: true};

const result = compareSemanticRankerRuns({baselineRun, candidateRun, corpus});
if (!result.passed || result.reasons.length > 0) {
  throw new Error(`semantic_ranker_smoke_failed:${JSON.stringify(result.reasons)}`);
}

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
