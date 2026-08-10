#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { verifyPlan } from './lib/b8-1-v2-plan-digest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json');
const MANIFEST_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json');
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b));
const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * fraction) - 1)];

export function validateEvidenceObjects({ evidence, plan, manifest, preflightReceiptPath, checkFilesystem = true }) {
  const errors = [];
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!validate(evidence)) errors.push(...(validate.errors ?? []).map(error => `schema ${error.instancePath}: ${error.message}`));
  const planValidation = verifyPlan(plan); if (!planValidation.valid) errors.push(...planValidation.errors.map(error => `plan: ${error}`));
  if (evidence.runId !== plan.runId || evidence.planSha256 !== plan.planSha256) errors.push('evidence run/plan identity mismatch');
  if (!preflightReceiptPath || !fs.existsSync(preflightReceiptPath) || evidence.preflightReceiptHash !== `sha256:${sha256(preflightReceiptPath)}`) errors.push('preflight receipt identity mismatch');
  else {
    const receipt = JSON.parse(fs.readFileSync(preflightReceiptPath));
    if (receipt.runId !== plan.runId || receipt.planSha256 !== plan.planSha256) errors.push('preflight receipt is not bound to the approved plan');
  }
  if (evidence.manifestHash !== `sha256:${plan.manifest?.sha256}` || plan.manifest?.sha256 !== sha256(MANIFEST_PATH)) errors.push('manifest identity mismatch');
  if (JSON.stringify(evidence.selectedSubjects) !== JSON.stringify(plan.selectedSubjects) || evidence.excludedSubjects.length !== 0 || evidence.partialEvidence !== false) errors.push('subject/evidence policy mismatch');
  const binary = evidence.subjectBinaryIdentity?.cbm;
  if (!binary || binary.stablePath !== plan.provider?.stablePath || binary.resolvedPath !== plan.provider?.resolvedPath || binary.sha256 !== plan.provider?.sha256 || binary.version !== plan.provider?.version) errors.push('provider identity mismatch');
  const isolation = evidence.networkIsolationProof;
  if (isolation?.adapterIdentity?.sha256 !== plan.sandbox?.adapterSha256 || isolation?.runtimeIdentity?.sha256 !== plan.runtime?.sha256 || isolation?.childIdentity?.sha256 !== plan.provider?.sha256 || isolation?.profileSha256 !== plan.sandbox?.profileSha256) errors.push('isolation identity mismatch');
  const requiredRepositories = manifest.repositories.map(repository => repository.repositoryId).sort();
  const pinned = Object.keys(evidence.pinnedRepositoryCommits ?? {}).sort();
  if (JSON.stringify(pinned) !== JSON.stringify(requiredRepositories)) errors.push('pinned repository set mismatch');
  for (const sourcePin of plan.sourcePins ?? []) {
    const actual = evidence.pinnedRepositoryCommits?.[sourcePin.repositoryId];
    if (actual?.repositoryId !== sourcePin.repositoryId || actual?.commit !== sourcePin.commit) errors.push(`${sourcePin.repositoryId}: source pin mismatch`);
  }
  const coverageIds = Object.keys(evidence.coverageEvidence ?? {}).sort();
  const lifecycleIds = Object.keys(evidence.lifecycleMetrics ?? {}).sort();
  if (JSON.stringify(coverageIds) !== JSON.stringify(requiredRepositories)) errors.push('coverage repository set mismatch');
  if (JSON.stringify(lifecycleIds) !== JSON.stringify(requiredRepositories)) errors.push('lifecycle repository set mismatch');
  let aggregateEligible = 0; let aggregateIndexed = 0; let totalServiceRss = 0;
  for (const repositoryId of requiredRepositories) {
    const coverage = evidence.coverageEvidence?.[repositoryId];
    if (!coverage) continue;
    if (coverage.indexedCount + coverage.unindexedCount !== coverage.eligibleCount || coverage.unindexedFiles.length !== coverage.unindexedCount || !close(coverage.coverageRatio, coverage.eligibleCount ? coverage.indexedCount / coverage.eligibleCount : 1)) errors.push(`${repositoryId}: inconsistent coverage evidence`);
    if (coverage.coverageRatio < manifest.coveragePolicy.minimumPerRepositoryCoverage || coverage.unknownCount !== 0) errors.push(`${repositoryId}: coverage gate failed`);
    aggregateEligible += coverage.eligibleCount; aggregateIndexed += coverage.indexedCount;
    const lifecycle = evidence.lifecycleMetrics?.[repositoryId]; if (!lifecycle) continue;
    const samples = lifecycle.steadyState.refreshSamplesMs; const statistics = lifecycle.steadyState.refreshStatistics;
    const expectedStats = { minimum: Math.min(...samples), median: percentile(samples, 0.5), p95: percentile(samples, 0.95), maximum: Math.max(...samples) };
    if (!Object.entries(expectedStats).every(([key, value]) => close(statistics[key], value))) errors.push(`${repositoryId}: refresh statistics mismatch`);
    const budget = manifest.resourceBudget;
    if (lifecycle.coldStart.wallMs > budget.coldStart.maximumIndexingTimeMsPerRepository || lifecycle.coldStart.peakRssMiB > budget.coldStart.maximumPeakRssMiB || lifecycle.coldStart.peakCpuPercent > budget.coldStart.maximumPeakCpuPercent
      || statistics.p95 > budget.steadyState.maximumRefreshP95Ms || statistics.maximum > budget.steadyState.maximumRefreshMs || lifecycle.steadyState.refreshPeakRssMiB > budget.steadyState.maximumRefreshPeakRssMiB || lifecycle.steadyState.refreshPeakCpuPercent > budget.steadyState.maximumRefreshPeakCpuPercent
      || lifecycle.steadyState.idleRssMiB > budget.steadyState.maximumIdleRssMiB || lifecycle.steadyState.idleCpuPercent > budget.steadyState.maximumIdleCpuPercent || lifecycle.indexBytes > budget.capacity.maximumIndexBytesPerRepository) errors.push(`${repositoryId}: lifecycle gate failed`);
    totalServiceRss += lifecycle.steadyState.totalServiceRssMiB;
  }
  if (!aggregateEligible || aggregateIndexed / aggregateEligible < manifest.coveragePolicy.minimumAggregateCoverage) errors.push('aggregate coverage gate failed');
  if (totalServiceRss > manifest.resourceBudget.capacity.maximumTotalServiceRssMiB) errors.push('total service RSS gate failed');
  const runIds = (evidence.runResults ?? []).map(run => run.repetition);
  if (evidence.runResults?.length !== manifest.rehearsalPolicy.requiredPassingRuns || new Set(runIds).size !== runIds.length || runIds.some((id, index) => id !== index + 1)) errors.push('run-result identity/cardinality mismatch');
  const headroom = 1 - manifest.rehearsalPolicy.requiredHeadroomRatio; let computedPassingRuns = 0;
  const refreshByRepository = Object.fromEntries(requiredRepositories.map(id => [id, []]));
  for (const run of evidence.runResults ?? []) {
    const runRepositoryIds = Object.keys(run.repositories ?? {}).sort(); let runPassed = JSON.stringify(runRepositoryIds) === JSON.stringify(requiredRepositories)
      && run.startCapacity.freeMemoryPercent >= manifest.resourceBudget.basis.minimumStartFreeMemoryPercent
      && run.startCapacity.freeDiskBytes >= manifest.resourceBudget.basis.minimumStartFreeDiskBytes;
    let runServiceRss = 0;
    for (const repositoryId of requiredRepositories) {
      const result = run.repositories?.[repositoryId]; if (!result) { runPassed = false; continue; }
      refreshByRepository[repositoryId].push(result.steadyState.refreshMs); runServiceRss += result.steadyState.totalServiceRssMiB;
      const budget = manifest.resourceBudget;
      runPassed &&= result.coverageRatio >= manifest.coveragePolicy.minimumPerRepositoryCoverage && result.unknownCount === 0
        && result.fileAccuracy >= manifest.acceptancePolicy.minimumIndexedFixtureFileAccuracy && result.lineAccuracy >= manifest.acceptancePolicy.minimumIndexedFixtureLineAccuracy
        && result.meanReciprocalRank >= manifest.retrievalPolicy.minimumMeanReciprocalRank && result.setOutcomeAccuracy >= manifest.acceptancePolicy.minimumSetOutcomeAccuracy
        && result.callerCalleeF1 >= manifest.acceptancePolicy.minimumCallerCalleeF1 && result.exactSourceAccuracy === 1 && result.fallbackAccuracy === 1
        && result.coldStart.wallMs <= budget.coldStart.maximumIndexingTimeMsPerRepository * headroom
        && result.coldStart.peakRssMiB <= budget.coldStart.maximumPeakRssMiB * headroom && result.coldStart.peakCpuPercent <= budget.coldStart.maximumPeakCpuPercent * headroom
        && result.steadyState.refreshMs <= budget.steadyState.maximumRefreshP95Ms * headroom
        && result.steadyState.refreshPeakRssMiB <= budget.steadyState.maximumRefreshPeakRssMiB * headroom && result.steadyState.refreshPeakCpuPercent <= budget.steadyState.maximumRefreshPeakCpuPercent * headroom
        && result.steadyState.idleRssMiB <= budget.steadyState.maximumIdleRssMiB * headroom && result.steadyState.idleCpuPercent <= budget.steadyState.maximumIdleCpuPercent * headroom
        && result.indexBytes <= budget.capacity.maximumIndexBytesPerRepository * headroom;
    }
    runPassed &&= runServiceRss <= manifest.resourceBudget.capacity.maximumTotalServiceRssMiB * headroom;
    if (run.allGatesPassed !== runPassed) errors.push(`run ${run.repetition}: allGatesPassed mismatch`);
    if (runPassed) computedPassingRuns += 1;
  }
  for (const repositoryId of requiredRepositories) {
    const samples = evidence.lifecycleMetrics?.[repositoryId]?.steadyState?.refreshSamplesMs ?? [];
    if (JSON.stringify(samples) !== JSON.stringify(refreshByRepository[repositoryId])) errors.push(`${repositoryId}: lifecycle refresh samples do not match run results`);
  }
  const fallbackIds = Object.keys(evidence.fallbackProbes ?? {}).sort();
  if (JSON.stringify(fallbackIds) !== JSON.stringify(requiredRepositories)) errors.push('fallback probe repository set mismatch');
  for (const repositoryId of requiredRepositories) {
    const probe = evidence.fallbackProbes?.[repositoryId]; const coverage = evidence.coverageEvidence?.[repositoryId]; if (!probe || !coverage) continue;
    if (!coverage.unindexedFiles.includes(probe.expectedFile) || !probe.exactSourceCandidates.includes(probe.expectedFile) || probe.targetIndexed !== false || probe.cbmStructuralCredit !== 0 || probe.exactSourcePassed !== true || JSON.stringify(coverage.fallbackFixtureIds) !== JSON.stringify([probe.fixtureId])) errors.push(`${repositoryId}: fallback probe is not bound to unindexed coverage`);
  }
  const expectedFixtureKeys = manifest.fixtures.flatMap(fixture => plan.selectedSubjects.map(subject => `${subject}:${fixture.fixtureId}`)).sort();
  const actualFixtureKeys = (evidence.fixtureResults ?? []).map(result => `${result.subject}:${result.fixtureId}`).sort();
  if (new Set(actualFixtureKeys).size !== actualFixtureKeys.length || JSON.stringify(actualFixtureKeys) !== JSON.stringify(expectedFixtureKeys)) errors.push('fixture/subject coverage mismatch');
  for (const result of evidence.fixtureResults ?? []) {
    const authority = manifest.fixtures.find(fixture => fixture.fixtureId === result.fixtureId);
    if (!authority || result.retrievalPattern !== (authority.retrievalPattern ?? authority.verification.fileName)) errors.push(`${result.subject}:${result.fixtureId}: retrieval authority mismatch`);
    if (result.subject === 'cbm' && result.targetIndexed && authority?.scoringType !== 'count-match' && !(Number.isInteger(result.targetRank) && result.targetRank >= 1 && result.targetRank <= manifest.retrievalPolicy.maximumCandidates)) errors.push(`${result.subject}:${result.fixtureId}: invalid target rank`);
    if (authority && (Number.isInteger(authority.expectedLine) ? typeof result.lineCorrect !== 'boolean' : result.lineCorrect !== null)) errors.push(`${result.subject}:${result.fixtureId}: line applicability mismatch`);
  }
  const cbmResults = (evidence.fixtureResults ?? []).filter(result => result.subject === 'cbm');
  for (const authority of manifest.fixtures) {
    const cbm = cbmResults.find(result => result.fixtureId === authority.fixtureId);
    const exact = (evidence.fixtureResults ?? []).find(result => result.subject === 'exact-source' && result.fixtureId === authority.fixtureId);
    const coverage = evidence.coverageEvidence?.[authority.repositoryId]; const fallbackRequired = Boolean(authority.expectedFile && coverage?.unindexedFiles.includes(authority.expectedFile));
    if (cbm && (cbm.targetIndexed !== !fallbackRequired || cbm.fallbackRequired !== fallbackRequired)) errors.push(`cbm:${authority.fixtureId}: fallback applicability mismatch`);
    if (!exact || exact.fileCorrect !== true || (Number.isInteger(authority.expectedLine) && exact.lineCorrect !== true) || exact.fallbackRequired !== fallbackRequired || exact.targetIndexed !== !fallbackRequired || (authority.scoringType === 'set-match' && exact.setAccuracy !== 1)) errors.push(`exact-source:${authority.fixtureId}: exact-source/fallback evidence failed`);
  }
  const indexed = cbmResults.filter(result => result.targetIndexed); const lines = indexed.filter(result => result.lineCorrect !== null);
  const sets = indexed.filter(result => result.setAccuracy !== undefined); const structural = indexed.filter(result => result.callerPrecision !== undefined || result.calleePrecision !== undefined);
  const fileAccuracy = indexed.length ? indexed.filter(result => result.fileCorrect).length / indexed.length : 0;
  const lineAccuracy = lines.length ? lines.filter(result => result.lineCorrect).length / lines.length : 0;
  const setAccuracy = sets.length ? sets.reduce((sum, result) => sum + result.setAccuracy, 0) / sets.length : 1;
  const ranked = indexed.filter(result => manifest.fixtures.find(fixture => fixture.fixtureId === result.fixtureId)?.scoringType !== 'count-match');
  const meanReciprocalRank = ranked.length ? ranked.reduce((sum, result) => sum + (result.targetRank ? 1 / result.targetRank : 0), 0) / ranked.length : 0;
  const f1 = structural.length ? structural.reduce((sum, result) => {
    const caller = result.callerPrecision + result.callerRecall ? 2 * result.callerPrecision * result.callerRecall / (result.callerPrecision + result.callerRecall) : 0;
    const callee = result.calleePrecision + result.calleeRecall ? 2 * result.calleePrecision * result.calleeRecall / (result.calleePrecision + result.calleeRecall) : 0;
    return sum + caller + callee;
  }, 0) / (structural.length * 2) : 0;
  const reported = evidence.subjectMetrics?.cbm?.retrievalAccuracy;
  if (!close(reported?.fileAccuracy, fileAccuracy) || !close(reported?.lineAccuracy, lineAccuracy) || !close(reported?.meanReciprocalRank, meanReciprocalRank) || (reported?.setAccuracy !== undefined && !close(reported.setAccuracy, setAccuracy)) || (reported?.callerCalleeF1 !== undefined && !close(reported.callerCalleeF1, f1))) errors.push('CBM retrieval metrics mismatch fixture evidence');
  const exactResults = (evidence.fixtureResults ?? []).filter(result => result.subject === 'exact-source'); const exactLines = exactResults.filter(result => result.lineCorrect !== null);
  const exactFileAccuracy = exactResults.length ? exactResults.filter(result => result.fileCorrect).length / exactResults.length : 0; const exactLineAccuracy = exactLines.length ? exactLines.filter(result => result.lineCorrect).length / exactLines.length : 0;
  const exactReported = evidence.subjectMetrics?.['exact-source']?.retrievalAccuracy;
  if (!close(exactReported?.fileAccuracy, exactFileAccuracy) || !close(exactReported?.lineAccuracy, exactLineAccuracy) || exactFileAccuracy !== 1 || exactLineAccuracy !== 1) errors.push('exact-source metrics mismatch or failure');
  const acceptance = evidence.acceptanceSummary;
  if (acceptance?.passingRuns !== computedPassingRuns || computedPassingRuns !== manifest.rehearsalPolicy.requiredPassingRuns || acceptance?.requiredPassingRuns !== manifest.rehearsalPolicy.requiredPassingRuns || !close(acceptance?.meanReciprocalRank, meanReciprocalRank) || !close(acceptance?.setOutcomeAccuracy, setAccuracy)
    || !close(acceptance?.callerCalleeF1, f1) || acceptance?.fallbackAccuracy !== 1 || acceptance?.headroomSatisfied !== true || acceptance?.allGatesPassed !== true
    || fileAccuracy < manifest.acceptancePolicy.minimumIndexedFixtureFileAccuracy || lineAccuracy < manifest.acceptancePolicy.minimumIndexedFixtureLineAccuracy || meanReciprocalRank < manifest.retrievalPolicy.minimumMeanReciprocalRank || setAccuracy < manifest.acceptancePolicy.minimumSetOutcomeAccuracy || f1 < manifest.acceptancePolicy.minimumCallerCalleeF1) errors.push('acceptance summary mismatch or gate failure');
  if ((evidence.violations ?? []).length !== 0 || evidence.cleanupStatus?.removed !== true || evidence.cleanupStatus?.runDirectory !== plan.plannedCanonicalRunPath || (checkFilesystem && fs.existsSync(plan.plannedCanonicalRunPath))) errors.push('violations or cleanup incomplete');
  return { valid: errors.length === 0, errors };
}

function args() { return Object.fromEntries(process.argv.slice(2).map(arg => { const index = arg.indexOf('='); return index < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, index), arg.slice(index + 1)]; })); }
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  const options = args();
  if (!options.evidence || !options.plan || !options['preflight-receipt']) throw new Error('required: --evidence=<path> --plan=<path> --preflight-receipt=<path>');
  const result = validateEvidenceObjects({ evidence: JSON.parse(fs.readFileSync(options.evidence)), plan: JSON.parse(fs.readFileSync(options.plan)), manifest: JSON.parse(fs.readFileSync(MANIFEST_PATH)), preflightReceiptPath: path.resolve(options['preflight-receipt']) });
  console.log(`b8-1-v2-evidence-valid=${result.valid}`); if (!result.valid) console.log(result.errors.join('\n')); process.exitCode = result.valid ? 0 : 1;
}
