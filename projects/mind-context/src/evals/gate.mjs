import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadEvaluationCorpus} from './corpus.mjs';

function defaultOutputDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../out/eval');
}

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function latestBenchmarkFiles(outDir = defaultOutputDir()) {
  const entries = fs.existsSync(outDir)
    ? fs.readdirSync(outDir).filter((entry) => /^benchmark-\d{4}-\d{2}-\d{2}T/.test(entry) && entry.endsWith('.json')).sort()
    : [];
  if (entries.length < 2) throw new Error('insufficient_benchmark_outputs');
  return {
    baselinePath: path.join(outDir, entries[entries.length - 2]),
    candidatePath: path.join(outDir, entries[entries.length - 1]),
  };
}

function normalizeCaseSnapshot(caseResult) {
  const pack = caseResult?.pack ?? {};
  const sources = Array.isArray(pack.sources) ? pack.sources : [];
  return {
    caseId: caseResult.caseId,
    precision: Number(caseResult.precision ?? 0),
    recall: Number(caseResult.recall ?? 0),
    forbiddenViolations: Number(caseResult.forbiddenViolations ?? 0),
    outOfScopeViolations: Number(caseResult.outOfScopeViolations ?? 0),
    privacyViolations: Number(caseResult.privacyViolations ?? 0),
    authorityMatch: Number(caseResult.authorityMatch ?? 0),
    freshnessMatch: Number(caseResult.freshnessMatch ?? 0),
    citationCompleteness: Number(caseResult.citationCompleteness ?? 0),
    conflictPreservation: Number(caseResult.conflictPreservation ?? 0),
    unknownPreservation: Number(caseResult.unknownPreservation ?? 0),
    budgetCompliance: Number(caseResult.budgetCompliance ?? 0),
    tokenEstimate: Number(caseResult.tokenEstimate ?? 0),
    latencyMs: Number(caseResult.latencyMs ?? 0),
    selectedSourceIds: Array.isArray(caseResult.selectedSourceIds) ? caseResult.selectedSourceIds : sources.map((source) => source.sourceId),
    expectedSourceIds: Array.isArray(caseResult.expectedSourceIds) ? caseResult.expectedSourceIds : [],
    sources,
    conflicts: Array.isArray(pack.conflicts) ? pack.conflicts : [],
    unknowns: Array.isArray(pack.unknowns) ? pack.unknowns : [],
    budget: pack.budget ?? {},
    truncation: pack.truncation ?? {truncated: false, reason: null},
    safetyWarnings: Array.isArray(pack.safetyWarnings) ? pack.safetyWarnings : [],
  };
}

function compareMetricDelta(baseline, candidate, key) {
  const left = Number(baseline?.[key] ?? 0);
  const right = Number(candidate?.[key] ?? 0);
  return Number((right - left).toFixed(4));
}

function buildFailure(reason, details = {}) {
  return {...details, reason};
}

export function compareSemanticRankerRuns({baselineRun, candidateRun, corpus, precisionDropThreshold = 0}) {
  const reasons = [];
  const summary = {baseline: baselineRun?.summary ?? {}, candidate: candidateRun?.summary ?? {}};
  const corpusVersion = corpus?.version ?? 'unknown';
  if (!baselineRun || !candidateRun) throw new Error('missing_benchmark_run');
  if (baselineRun.schemaVersion !== candidateRun.schemaVersion) reasons.push('schema_version_mismatch');
  if (baselineRun.schemaVersion !== '1.0.0') reasons.push('unsupported_schema_version');
  if (baselineRun.corpusVersion !== corpusVersion || candidateRun.corpusVersion !== corpusVersion) reasons.push('corpus_version_mismatch');
  if (baselineRun.metricDefinitionVersion !== candidateRun.metricDefinitionVersion) reasons.push('metric_definition_mismatch');
  if (baselineRun.deterministic !== true) reasons.push('baseline_nondeterministic');
  if (candidateRun.deterministic !== true) reasons.push('candidate_nondeterministic');
  if (candidateRun.modelSuppliedAuthority === true || candidateRun.rankerConfiguration?.modelSuppliedAuthority === true) reasons.push('undeclared_model_authority');
  if (!candidateRun.rankerId) reasons.push('missing_candidate_ranker_identity');
  if (!candidateRun.rankerConfiguration || typeof candidateRun.rankerConfiguration !== 'object') reasons.push('missing_candidate_configuration');

  const expectedCaseIds = (corpus?.cases ?? []).map((testCase) => testCase.caseId);
  const baselineCaseIds = new Set((baselineRun?.cases ?? []).map((item) => item.caseId));
  const candidateCaseIds = new Set((candidateRun?.cases ?? []).map((item) => item.caseId));
  if (baselineCaseIds.size !== expectedCaseIds.length || candidateCaseIds.size !== expectedCaseIds.length) reasons.push('missing_case_ids');
  for (const caseId of expectedCaseIds) {
    if (!baselineCaseIds.has(caseId) || !candidateCaseIds.has(caseId)) reasons.push(`missing_case:${caseId}`);
  }

  const baselineCases = new Map((baselineRun?.cases ?? []).map((item) => [item.caseId, normalizeCaseSnapshot(item)]));
  const candidateCases = new Map((candidateRun?.cases ?? []).map((item) => [item.caseId, normalizeCaseSnapshot(item)]));
  const perCase = [];
  for (const testCase of corpus?.cases ?? []) {
    const baselineCase = baselineCases.get(testCase.caseId);
    const candidateCase = candidateCases.get(testCase.caseId);
    if (!baselineCase || !candidateCase) {
      perCase.push({caseId: testCase.caseId, passed: false, reasons: ['missing_case']});
      continue;
    }
    const deltas = {
      precisionDelta: compareMetricDelta(baselineCase, candidateCase, 'precision'),
      requiredSourceRecallDelta: compareMetricDelta(baselineCase, candidateCase, 'recall'),
      topKPrecisionDelta: compareMetricDelta(baselineCase, candidateCase, 'precision'),
      privacyViolationDelta: compareMetricDelta(baselineCase, candidateCase, 'privacyViolations'),
      forbiddenSourceViolationDelta: compareMetricDelta(baselineCase, candidateCase, 'forbiddenViolations'),
      outOfScopeViolationDelta: compareMetricDelta(baselineCase, candidateCase, 'outOfScopeViolations'),
      citationCompletenessDelta: compareMetricDelta(baselineCase, candidateCase, 'citationCompleteness'),
      conflictPreservationDelta: compareMetricDelta(baselineCase, candidateCase, 'conflictPreservation'),
      unknownPreservationDelta: compareMetricDelta(baselineCase, candidateCase, 'unknownPreservation'),
      budgetComplianceDelta: compareMetricDelta(baselineCase, candidateCase, 'budgetCompliance'),
    };
    const caseReasons = [];
    if (deltas.privacyViolationDelta > 0) caseReasons.push('privacy_regression');
    if (deltas.forbiddenSourceViolationDelta > 0) caseReasons.push('forbidden_source_regression');
    if (deltas.outOfScopeViolationDelta > 0) caseReasons.push('out_of_scope_regression');
    if (deltas.citationCompletenessDelta < 0) caseReasons.push('citation_regression');
    if (deltas.conflictPreservationDelta < 0) caseReasons.push('conflict_suppression');
    if (deltas.unknownPreservationDelta < 0) caseReasons.push('unknown_suppression');
    if (candidateCase.budgetCompliance <= 0) caseReasons.push('budget_noncompliance');
    if (candidateCase.precision + precisionDropThreshold < baselineCase.precision) caseReasons.push('precision_regression');
    if (!candidateCase.selectedSourceIds.length && (testCase.citationBehavior === 'required')) {
      caseReasons.push('citation_missing');
    }
    perCase.push({
      caseId: testCase.caseId,
      passed: caseReasons.length === 0,
      reasons: caseReasons,
      baseline: baselineCase,
      candidate: candidateCase,
      deltas,
    });
    reasons.push(...caseReasons.map((reason) => `${testCase.caseId}:${reason}`));
  }

  const aggregateDeltas = {
    precisionDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'precision'),
    requiredSourceRecallDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'recall'),
    topKPrecisionDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'precision'),
    privacyViolationDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'privacyViolations'),
    forbiddenSourceViolationDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'forbiddenViolations'),
    outOfScopeViolationDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'outOfScopeViolations'),
    citationCompletenessDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'citationCompleteness'),
    conflictPreservationDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'conflictPreservation'),
    unknownPreservationDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'unknownPreservation'),
    budgetComplianceDelta: compareMetricDelta(baselineRun.summary, candidateRun.summary, 'budgetCompliance'),
  };

  if (aggregateDeltas.privacyViolationDelta > 0) reasons.push('privacy_regression');
  if (aggregateDeltas.forbiddenSourceViolationDelta > 0) reasons.push('forbidden_source_regression');
  if (aggregateDeltas.outOfScopeViolationDelta > 0) reasons.push('out_of_scope_regression');
  if (aggregateDeltas.citationCompletenessDelta < 0) reasons.push('citation_regression');
  if (aggregateDeltas.conflictPreservationDelta < 0) reasons.push('conflict_suppression');
  if (aggregateDeltas.unknownPreservationDelta < 0) reasons.push('unknown_suppression');
  if (aggregateDeltas.precisionDelta < -precisionDropThreshold) reasons.push('precision_regression');
  if (candidateRun.summary?.cases !== baselineRun.summary?.cases) reasons.push('summary_case_mismatch');
  if (candidateRun.summary?.cases !== expectedCaseIds.length || baselineRun.summary?.cases !== expectedCaseIds.length) reasons.push('ground_truth_case_mismatch');

  const comparable = reasons.every((reason) => !/mismatch|missing|unsupported|nondeterministic|authority/.test(reason));
  return {
    decision: reasons.length === 0 ? 'pass' : 'fail',
    passed: reasons.length === 0,
    comparable,
    corpusVersion,
    schemaVersion: baselineRun.schemaVersion,
    metricDefinitionVersion: baselineRun.metricDefinitionVersion,
    candidateRankerId: candidateRun.rankerId,
    candidateConfiguration: candidateRun.rankerConfiguration,
    summary,
    aggregateDeltas,
    perCase,
    reasons: [...new Set(reasons)],
  };
}

export function loadBenchmarkRun(filePath) {
  return loadJson(filePath);
}

export function runSemanticRankerGate({
  baselinePath,
  candidatePath,
  corpusPath,
  precisionDropThreshold = 0,
} = {}) {
  const corpus = loadEvaluationCorpus(corpusPath);
  const baselineResolved = baselinePath ?? latestBenchmarkFiles().baselinePath;
  const candidateResolved = candidatePath ?? latestBenchmarkFiles().candidatePath;
  const baselineRun = loadBenchmarkRun(baselineResolved);
  const candidateRun = loadBenchmarkRun(candidateResolved);
  const result = compareSemanticRankerRuns({baselineRun, candidateRun, corpus, precisionDropThreshold});
  return {
    ...result,
    baselinePath: baselineResolved,
    candidatePath: candidateResolved,
    corpusPath: corpusPath ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../operations/fixtures/retrieval-evaluation-corpus-v1.json'),
  };
}

function formatOutput(result, format) {
  if (format === 'markdown') {
    return [
      '# Semantic Ranker Gate',
      '',
      `- Decision: ${result.decision}`,
      `- Passed: ${result.passed}`,
      `- Corpus version: ${result.corpusVersion}`,
      `- Schema version: ${result.schemaVersion}`,
      `- Metric definition version: ${result.metricDefinitionVersion}`,
      `- Candidate ranker: ${result.candidateRankerId}`,
      `- Precision delta: ${result.aggregateDeltas.precisionDelta}`,
      `- Recall delta: ${result.aggregateDeltas.requiredSourceRecallDelta}`,
      `- Privacy delta: ${result.aggregateDeltas.privacyViolationDelta}`,
      `- Forbidden delta: ${result.aggregateDeltas.forbiddenSourceViolationDelta}`,
      `- Out-of-scope delta: ${result.aggregateDeltas.outOfScopeViolationDelta}`,
      `- Citation delta: ${result.aggregateDeltas.citationCompletenessDelta}`,
      `- Conflict delta: ${result.aggregateDeltas.conflictPreservationDelta}`,
      `- Unknown delta: ${result.aggregateDeltas.unknownPreservationDelta}`,
      `- Budget delta: ${result.aggregateDeltas.budgetComplianceDelta}`,
      `- Reasons: ${result.reasons.join(', ') || 'none'}`,
    ].join('\n');
  }
  return JSON.stringify(result, null, 2);
}

async function main(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [flag, inline] = token.split('=', 2);
    const key = flag.slice(2);
    const value = inline ?? argv[++i];
    args[key] = value ?? true;
  }
  const format = String(args.format ?? 'json').toLowerCase();
  try {
    const result = runSemanticRankerGate({
      baselinePath: args.baseline,
      candidatePath: args.candidate,
      corpusPath: args.corpus,
      precisionDropThreshold: Number.parseFloat(args['precision-drop-threshold'] ?? '0') || 0,
    });
    process.stdout.write(`${formatOutput(result, format)}\n`);
    process.exitCode = result.passed ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${String(error?.message ?? error)}\n`);
    process.exitCode = 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
