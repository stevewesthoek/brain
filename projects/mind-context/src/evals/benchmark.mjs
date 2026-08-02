import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildContextPack} from '../core/build-context-pack.mjs';
import {renderContextPackMarkdown} from '../core/render.mjs';
import {loadEvaluationCorpus} from './corpus.mjs';
import {calculateCaseMetrics, summarizeMetrics} from './metrics.mjs';
import {loadEvaluationSources} from './sources.mjs';

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function defaultOutDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../out/eval');
}

export function runEvaluationBenchmark({
  corpusPath,
  registryPath,
  outDir = defaultOutDir(),
  write = true,
  rankerId = 'lexical-baseline',
  rankerConfiguration = {kind: 'lexical', deterministic: true},
  deterministic = true,
} = {}) {
  const corpus = loadEvaluationCorpus(corpusPath);
  const sources = loadEvaluationSources(registryPath);
  const startedAt = new Date();
  const results = [];
  for (const testCase of corpus.cases) {
    const caseStarted = process.hrtime.bigint();
    const pack = buildContextPack({
      queryId: testCase.caseId,
      query: testCase.question,
      scopes: testCase.allowedScopes,
      sources,
      forbiddenSources: testCase.forbiddenSources,
      maxItems: testCase.budgetBehavior.maxItems,
      maxTokens: testCase.budgetBehavior.maxTokens,
      generatedAt: startedAt.toISOString(),
    });
    const elapsedMs = Number(process.hrtime.bigint() - caseStarted) / 1e6;
    results.push({
      ...calculateCaseMetrics({testCase, pack, elapsedMs}),
      pack,
      testCase,
    });
  }
  const summary = summarizeMetrics(results);
  const payload = {
    schemaVersion: '1.0.0',
    metricDefinitionVersion: '1.0.0',
    rankerId,
    rankerConfiguration,
    deterministic,
    generatedAt: startedAt.toISOString(),
    corpusVersion: corpus.version,
    registryVersion: '1.0.0',
    packageVersion: JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version,
    summary,
    cases: results,
  };
  if (write) {
    fs.mkdirSync(outDir, {recursive: true});
    const id = timestampId(startedAt);
    fs.writeFileSync(path.join(outDir, `benchmark-${id}.json`), `${JSON.stringify(payload, null, 2)}\n`);
    const lines = [];
    lines.push(`# Mind Context Benchmark`);
    lines.push('');
    lines.push(`- Schema version: ${payload.schemaVersion}`);
    lines.push(`- Metric definition version: ${payload.metricDefinitionVersion}`);
    lines.push(`- Ranker ID: ${payload.rankerId}`);
    lines.push(`- Deterministic: ${payload.deterministic}`);
    lines.push(`- Generated at: ${payload.generatedAt}`);
    lines.push(`- Corpus version: ${payload.corpusVersion}`);
    lines.push(`- Package version: ${payload.packageVersion}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Cases: ${summary.cases}`);
    lines.push(`- Precision: ${summary.precision}`);
    lines.push(`- Recall: ${summary.recall}`);
    lines.push(`- Forbidden violations: ${summary.forbiddenViolations}`);
    lines.push(`- Out-of-scope violations: ${summary.outOfScopeViolations}`);
    lines.push(`- Privacy violations: ${summary.privacyViolations}`);
    lines.push(`- Authority match: ${summary.authorityMatch}`);
    lines.push(`- Freshness match: ${summary.freshnessMatch}`);
    lines.push(`- Citation completeness: ${summary.citationCompleteness}`);
    lines.push(`- Conflict preservation: ${summary.conflictPreservation}`);
    lines.push(`- Unknown preservation: ${summary.unknownPreservation}`);
    lines.push(`- Budget compliance: ${summary.budgetCompliance}`);
    lines.push(`- Token estimate: ${summary.tokenEstimate}`);
    lines.push(`- Latency ms: ${summary.latencyMs}`);
    fs.writeFileSync(path.join(outDir, `benchmark-${id}.md`), `${lines.join('\n')}\n`);
    payload.outputs = {
      json: path.join(outDir, `benchmark-${id}.json`),
      markdown: path.join(outDir, `benchmark-${id}.md`),
    };
  }
  return payload;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const payload = runEvaluationBenchmark();
  process.stdout.write(`${JSON.stringify(payload.summary, null, 2)}\n`);
}
