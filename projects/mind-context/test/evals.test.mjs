import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEvaluationCorpus} from '../src/evals/corpus.mjs';
import {loadEvaluationSources} from '../src/evals/sources.mjs';
import {calculateCaseMetrics, summarizeMetrics} from '../src/evals/metrics.mjs';
import {runEvaluationBenchmark} from '../src/evals/benchmark.mjs';
import {buildContextPack} from '../src/index.mjs';

test('evaluation corpus loads and validates', () => {
  const corpus = loadEvaluationCorpus();
  assert.equal(corpus.version, '1.0.0');
  assert.equal(corpus.cases.length, 12);
});

test('evaluation sources load with existing paths', () => {
  const sources = loadEvaluationSources();
  assert(sources.some((source) => source.sourceId === 'canonical-owner'));
  assert(sources.every((source) => source.path.endsWith('.md')));
});

test('evaluation metrics summarize case results', () => {
  const sources = loadEvaluationSources();
  const corpus = loadEvaluationCorpus();
  const testCase = corpus.cases.find((item) => item.caseId === 'exact-known');
  const pack = buildContextPack({
    queryId: testCase.caseId,
    query: testCase.question,
    scopes: testCase.allowedScopes,
    sources,
    maxItems: testCase.budgetBehavior.maxItems,
    maxTokens: testCase.budgetBehavior.maxTokens,
  });
  const metrics = calculateCaseMetrics({testCase, pack, elapsedMs: 1.25});
  const summary = summarizeMetrics([metrics]);
  assert.equal(metrics.caseId, 'exact-known');
  assert.equal(summary.cases, 1);
  assert.equal(summary.recall >= 0, true);
});

test('benchmark writes timestamped json and markdown', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-context-benchmark-'));
  const result = runEvaluationBenchmark({outDir, write: true});
  assert.equal(result.summary.cases, 12);
  assert(fs.existsSync(result.outputs.json));
  assert(fs.existsSync(result.outputs.markdown));
  const json = JSON.parse(fs.readFileSync(result.outputs.json, 'utf8'));
  assert.equal(json.summary.cases, 12);
});
