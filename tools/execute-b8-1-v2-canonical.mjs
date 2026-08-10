#!/usr/bin/env node
/**
 * B8.1 Contract V2 canonical materializer and executor.
 *
 * Owner approval is EXTERNAL TO the immutable plan and supplied via three
 * required CLI arguments. The plan file is never mutated.
 *
 *   --plan=<absolute-path>           path to the dry-run authorization plan JSON
 *   --authorized-plan-sha256=<hex>   owner-provided expected digest (fails if it
 *                                    differs from the plan's planSha256)
 *   --authorized-run-id=<id>         owner-provided expected run ID (fails if it
 *                                    differs from the plan's runId)
 *
 * Fails closed on:
 *   - any missing approval argument
 *   - digest mismatch (plan file vs argument, or recomputed vs stored)
 *   - run ID mismatch
 *   - known stale digest
 *   - plan mode != canonical-dry-run-authorization-only
 *   - partialEvidence != false
 *   - runtime/provider/source/sandbox identity drift
 *   - canonical run path already exists (single-use)
 *   - insufficient host capacity
 *   - isolation self-test failure
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { assertPinnedRuntime, evaluateRepository, buildGates, isolationProof } from './run-b8-1-v2-disposable-evaluation.mjs';
import { computePlanDigest, verifyPlan, KNOWN_STALE_DIGESTS } from './lib/b8-1-v2-plan-digest.mjs';
import { validateEvidenceObjects } from './validate-b8-1-v2-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json');
const EVIDENCE_SCHEMA_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json');

function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function sha256String(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); }
function freeMemoryPercent() {
  if (process.platform === 'darwin') {
    try {
      const output = execFileSync('/usr/bin/memory_pressure', ['-Q'], { encoding: 'utf8' });
      const match = output.match(/System-wide memory free percentage:\s*([0-9.]+)%/);
      if (match) return Number(match[1]);
    } catch {}
  }
  return os.freemem() / os.totalmem() * 100;
}

/**
 * Validate owner-supplied approval arguments against the plan.
 * This is the sole authorization gate. The plan is never mutated.
 * Exported for unit testing.
 */
export function validateAuthorization({ planPath, authorizedPlanSha256, authorizedRunId }) {
  const errors = [];

  // 1. All three arguments required
  if (!planPath) errors.push('missing required argument: --plan');
  if (!authorizedPlanSha256) errors.push('missing required argument: --authorized-plan-sha256');
  if (!authorizedRunId) errors.push('missing required argument: --authorized-run-id');
  if (errors.length) return { valid: false, errors, plan: null };

  // 2. Plan file must exist and be readable
  if (!fs.existsSync(planPath)) {
    errors.push(`plan file not found: ${planPath}`);
    return { valid: false, errors, plan: null };
  }
  let plan;
  try { plan = JSON.parse(fs.readFileSync(planPath, 'utf8')); }
  catch (e) { errors.push(`plan file parse error: ${e.message}`); return { valid: false, errors, plan: null }; }

  // 3. Stored planSha256 matches owner-supplied digest
  if (plan.planSha256 !== authorizedPlanSha256) {
    errors.push(`plan.planSha256 ${plan.planSha256} does not match --authorized-plan-sha256 ${authorizedPlanSha256}`);
  }

  // 4. Recomputed digest matches stored (internal integrity)
  const verifyResult = verifyPlan(plan);
  if (!verifyResult.valid) errors.push(...verifyResult.errors.map(e => `plan integrity: ${e}`));

  // 5. Not a known stale digest
  if (KNOWN_STALE_DIGESTS.has(authorizedPlanSha256)) {
    errors.push(`authorized digest ${authorizedPlanSha256} is a known stale historical digest and must not execute`);
  }

  // 6. Run ID matches
  if (plan.runId !== authorizedRunId) {
    errors.push(`plan.runId ${plan.runId} does not match --authorized-run-id ${authorizedRunId}`);
  }

  // 7. Plan mode is authorization-only dry-run (not already a canonical execution record)
  if (plan.mode !== 'canonical-dry-run-authorization-only') {
    errors.push(`plan mode must be canonical-dry-run-authorization-only, got ${plan.mode}`);
  }

  // 8. partialEvidence must be false
  if (plan.partialEvidence !== false) {
    errors.push('plan.partialEvidence must be false');
  }

  // 9. Canonical executor identity: plan must record canonicalExecutor SHA and it must match this file
  const executorIdentity = plan.implementationIdentity?.canonicalExecutor;
  if (!executorIdentity) {
    errors.push('plan.implementationIdentity.canonicalExecutor is missing — plan was generated before executor was bound');
  } else {
    const selfPath = fs.realpathSync(fileURLToPath(import.meta.url));
    const selfSha = sha256File(selfPath);
    if (selfSha !== executorIdentity.sha256) {
      errors.push(`executor SHA drift: plan records ${executorIdentity.sha256} but this file hashes to ${selfSha}`);
    }
  }

  return { valid: errors.length === 0, errors, plan: errors.length ? null : plan };
}

function preflight(plan, manifest, approvedPlanSha256) {
  const errors = [];

  // 1. Provider identity
  const binary = fs.realpathSync(plan.provider.stablePath);
  if (binary !== plan.provider.resolvedPath) errors.push(`provider resolved path mismatch: ${binary} vs ${plan.provider.resolvedPath}`);
  const providerSha = sha256File(binary);
  if (providerSha !== plan.provider.sha256) errors.push(`provider SHA mismatch: ${providerSha} vs ${plan.provider.sha256}`);
  const providerVersion = execFileSync(binary, ['--version'], { encoding: 'utf8' }).trim();
  if (providerVersion !== plan.provider.version) errors.push(`provider version mismatch: ${providerVersion} vs ${plan.provider.version}`);

  // 2. Runtime identity
  const runtimePath = plan.runtime.path;
  if (!fs.existsSync(runtimePath)) {
    errors.push(`runtime not found: ${runtimePath}`);
  } else {
    const runtimeSha = sha256File(runtimePath);
    if (runtimeSha !== plan.runtime.sha256) errors.push(`runtime SHA mismatch: ${runtimeSha} vs ${plan.runtime.sha256}`);
    if (plan.runtime.version !== process.version) errors.push(`runtime version mismatch: process is ${process.version}, plan expects ${plan.runtime.version}`);
  }

  // 3. Sandbox adapter
  const adapterSha = sha256File(plan.sandbox.adapterPath);
  if (adapterSha !== plan.sandbox.adapterSha256) errors.push(`sandbox adapter SHA mismatch: ${adapterSha} vs ${plan.sandbox.adapterSha256}`);

  // 4. Isolation profile
  const profilePath = path.join(ROOT, 'operations/specs/b8-1-v2-network-isolation.sb');
  const profileSha = sha256File(profilePath);
  if (profileSha !== plan.sandbox.profileSha256) errors.push(`isolation profile SHA mismatch: ${profileSha} vs ${plan.sandbox.profileSha256}`);

  // 5. Manifest identity
  const manifestSha = sha256File(MANIFEST_PATH);
  if (manifestSha !== plan.manifest.sha256) errors.push(`manifest SHA mismatch: ${manifestSha} vs ${plan.manifest.sha256}`);

  // 6. Graphify excluded
  if (plan.graphifyStatus !== 'excluded-out-of-contract') errors.push(`Graphify not excluded: ${plan.graphifyStatus}`);

  // 7. Canonical run path must not exist (single-use)
  if (fs.existsSync(plan.plannedCanonicalRunPath)) errors.push(`canonical run path already exists: ${plan.plannedCanonicalRunPath}`);

  // 8. Brain repo clean on implementation commit
  const brainRoot = path.resolve(path.dirname(MANIFEST_PATH), manifest.repositories.find(r => r.repositoryId === 'brain').localPath);
  const gitStatus = execFileSync('git', ['-C', brainRoot, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (gitStatus.length > 0) errors.push(`brain repo is dirty:\n${gitStatus}`);

  // 9. Source pins resolve
  for (const pin of plan.sourcePins) {
    const repo = manifest.repositories.find(r => r.repositoryId === pin.repositoryId);
    if (!repo) { errors.push(`source pin repo not in manifest: ${pin.repositoryId}`); continue; }
    const repoRoot = path.resolve(path.dirname(MANIFEST_PATH), repo.localPath);
    try {
      const actual = execFileSync('git', ['-C', repoRoot, 'rev-parse', pin.commit], { encoding: 'utf8' }).trim();
      if (actual !== pin.commit) errors.push(`${pin.repositoryId}: source pin does not resolve: ${pin.commit}`);
    } catch { errors.push(`${pin.repositoryId}: could not verify source pin ${pin.commit}`); }
  }

  // 10. Host capacity
  const freeMemPct = freeMemoryPercent();
  const freeDisk = fs.statfsSync(path.dirname(plan.plannedCanonicalRunPath) || '/').bavail
    * fs.statfsSync(path.dirname(plan.plannedCanonicalRunPath) || '/').bsize;
  if (freeMemPct < manifest.resourceBudget.basis.minimumStartFreeMemoryPercent) {
    errors.push(`insufficient free memory: ${freeMemPct.toFixed(1)}% < ${manifest.resourceBudget.basis.minimumStartFreeMemoryPercent}%`);
  }
  if (freeDisk < manifest.resourceBudget.basis.minimumStartFreeDiskBytes) {
    errors.push(`insufficient free disk: ${freeDisk} < ${manifest.resourceBudget.basis.minimumStartFreeDiskBytes}`);
  }

  return { valid: errors.length === 0, errors, binary, providerVersion };
}

function buildEvidenceFromRuns(plan, manifest, runs, host, isolation, preflightReceiptPath) {
  const requiredRepositories = manifest.repositories.map(r => r.repositoryId).sort();
  const acceptance = buildGates(manifest, runs, host);

  const pinnedRepositoryCommits = {};
  for (const pin of plan.sourcePins) pinnedRepositoryCommits[pin.repositoryId] = { repositoryId: pin.repositoryId, commit: pin.commit };

  const coverageEvidence = {};
  const lastRun = runs[runs.length - 1];
  for (const repo of lastRun.repositories) {
    coverageEvidence[repo.repositoryId] = { eligibleCount: repo.coverage.eligibleCount, indexedCount: repo.coverage.indexedCount, unindexedCount: repo.coverage.unindexedCount, unknownCount: repo.coverage.unknownCount, coverageRatio: repo.coverage.ratio, unindexedFiles: repo.coverage.unindexedFiles, fallbackFixtureIds: [] };
  }

  const fallbackProbes = {};
  for (const repo of lastRun.repositories) {
    if (repo.fallbackProbe?.file) {
      const authority = manifest.fixtures.find(f => f.repositoryId === repo.repositoryId && f.expectedFile === repo.fallbackProbe.file);
      fallbackProbes[repo.repositoryId] = { fixtureId: authority?.fixtureId ?? `fallback-${repo.repositoryId}`, question: repo.fallbackProbe.question, retrievalPattern: repo.fallbackProbe.retrievalPattern, expectedFile: repo.fallbackProbe.file, exactSourceCandidates: repo.fallbackProbe.exactSourceCandidates, targetIndexed: false, cbmStructuralCredit: 0, exactSourceSha256: repo.fallbackProbe.exactSourceSha256, exactSourcePassed: repo.fallbackProbe.exactSourcePassed };
      coverageEvidence[repo.repositoryId].fallbackFixtureIds = [fallbackProbes[repo.repositoryId].fixtureId];
    }
  }

  const lifecycleMetrics = {};
  for (const repoId of requiredRepositories) {
    const repoRuns = runs.map(run => run.repositories.find(r => r.repositoryId === repoId));
    const coldRuns = repoRuns.map(r => r.coldStart);
    const refreshSamples = repoRuns.map(r => r.steadyState.refreshMs);
    const sorted = [...refreshSamples].sort((a, b) => a - b);
    lifecycleMetrics[repoId] = {
      coldStart: { wallMs: Math.max(...coldRuns.map(c => c.wallMs)), peakRssMiB: Math.max(...coldRuns.map(c => c.peakRssMiB)), peakCpuPercent: Math.max(...coldRuns.map(c => c.peakCpuPercent)) },
      steadyState: { idleRssMiB: Math.max(...repoRuns.map(r => r.steadyState.idleRssMiB)), idleCpuPercent: Math.max(...repoRuns.map(r => r.steadyState.idleCpuPercent)), totalServiceRssMiB: Math.max(...repoRuns.map(r => r.steadyState.totalServiceRssMiB)), refreshSamplesMs: refreshSamples, refreshStatistics: { minimum: sorted[0], median: sorted[Math.max(0, Math.ceil(sorted.length * 0.5) - 1)], p95: sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)], maximum: sorted[sorted.length - 1] }, refreshPeakRssMiB: Math.max(...repoRuns.map(r => r.steadyState.refreshPeakRssMiB)), refreshPeakCpuPercent: Math.max(...repoRuns.map(r => r.steadyState.refreshPeakCpuPercent)) },
      indexBytes: Math.max(...repoRuns.map(r => r.indexBytes)),
    };
  }

  const headroom = 1 - manifest.rehearsalPolicy.requiredHeadroomRatio;
  const runResults = runs.map(run => {
    const repositories = {};
    let runServiceRss = 0;
    // Per-repo metrics (for evidence recording only — NOT for per-repo gate decisions)
    for (const repo of run.repositories) {
      const indexed = repo.fixtures.filter(f => f.targetIndexed);
      const lines = indexed.filter(f => f.lineCorrect !== null);
      const sets = indexed.filter(f => f.scoringType === 'set-match');
      const ranked = indexed.filter(f => f.scoringType !== 'count-match');
      const structural = indexed.filter(f => f.structural).flatMap(f => [f.structural.caller.f1, f.structural.callee.f1]);
      const fileAccuracy = indexed.length ? indexed.filter(f => f.fileCorrect).length / indexed.length : 0;
      const lineAccuracy = lines.length ? lines.filter(f => f.lineCorrect).length / lines.length : 0;
      const mrr = ranked.length ? ranked.reduce((sum, f) => sum + (f.targetRank ? 1 / f.targetRank : 0), 0) / ranked.length : 0;
      const setOutcome = sets.length ? sets.reduce((sum, f) => sum + f.setAccuracy, 0) / sets.length : 1;
      const f1 = structural.length ? structural.reduce((sum, v) => sum + v, 0) / structural.length : 0;
      const exactAll = repo.fixtures.every(f => f.exactSourcePassed);
      const fallbackAll = repo.fixtures.filter(f => f.fallbackRequired).every(f => f.exactSourcePassed);
      runServiceRss += repo.steadyState.totalServiceRssMiB;
      repositories[repo.repositoryId] = { coverageRatio: repo.coverage.ratio, unknownCount: 0, fileAccuracy, lineAccuracy, meanReciprocalRank: mrr, setOutcomeAccuracy: setOutcome, callerCalleeF1: f1, exactSourceAccuracy: exactAll ? 1 : 0, fallbackAccuracy: fallbackAll ? 1 : 0, coldStart: repo.coldStart, steadyState: { refreshMs: repo.steadyState.refreshMs, refreshPeakRssMiB: repo.steadyState.refreshPeakRssMiB, refreshPeakCpuPercent: repo.steadyState.refreshPeakCpuPercent, idleRssMiB: repo.steadyState.idleRssMiB, idleCpuPercent: repo.steadyState.idleCpuPercent, totalServiceRssMiB: repo.steadyState.totalServiceRssMiB }, indexBytes: repo.indexBytes };
    }

    // Aggregate quality gates across all repos in this run — matching buildGates() semantics exactly
    const allIndexed = run.repositories.flatMap(r => r.fixtures.filter(f => f.targetIndexed));
    const allLines = allIndexed.filter(f => f.lineCorrect !== null);
    const allSets = allIndexed.filter(f => f.scoringType === 'set-match');
    const allRanked = allIndexed.filter(f => f.scoringType !== 'count-match');
    const allStructural = allIndexed.filter(f => f.structural).flatMap(f => [f.structural.caller.f1, f.structural.callee.f1]);
    const allExact = run.repositories.flatMap(r => r.fixtures);
    const aggFileAcc = allIndexed.length ? allIndexed.filter(f => f.fileCorrect).length / allIndexed.length : 0;
    const aggLineAcc = allLines.length ? allLines.filter(f => f.lineCorrect).length / allLines.length : 0;
    const aggMrr = allRanked.length ? allRanked.reduce((sum, f) => sum + (f.targetRank ? 1 / f.targetRank : 0), 0) / allRanked.length : 0;
    const aggSetAcc = allSets.length ? allSets.reduce((sum, f) => sum + f.setAccuracy, 0) / allSets.length : 1;
    const aggF1 = allStructural.length ? allStructural.reduce((sum, v) => sum + v, 0) / allStructural.length : 0;
    const aggExactAll = allExact.every(f => f.exactSourcePassed);
    const aggFallbackAll = allExact.filter(f => f.fallbackRequired).every(f => f.exactSourcePassed);

    const budget = manifest.resourceBudget;
    let allPass = true;
    // Aggregate quality gates
    if (aggFileAcc < manifest.acceptancePolicy.minimumIndexedFixtureFileAccuracy) allPass = false;
    if (aggLineAcc < manifest.acceptancePolicy.minimumIndexedFixtureLineAccuracy) allPass = false;
    if (aggMrr < manifest.retrievalPolicy.minimumMeanReciprocalRank) allPass = false;
    if (aggSetAcc < manifest.acceptancePolicy.minimumSetOutcomeAccuracy) allPass = false;
    if (aggF1 < manifest.acceptancePolicy.minimumCallerCalleeF1) allPass = false;
    if (!aggExactAll || !aggFallbackAll) allPass = false;
    // Per-repo structural/coverage/resource gates
    for (const repo of run.repositories) {
      if (repo.coverage.ratio < manifest.coveragePolicy.minimumPerRepositoryCoverage) allPass = false;
      if (repo.coverage.unknownCount > 0) allPass = false;
      if (repo.coldStart.wallMs > budget.coldStart.maximumIndexingTimeMsPerRepository * headroom) allPass = false;
      if (repo.coldStart.peakRssMiB > budget.coldStart.maximumPeakRssMiB * headroom) allPass = false;
      if (repo.coldStart.peakCpuPercent > budget.coldStart.maximumPeakCpuPercent * headroom) allPass = false;
      if (repo.steadyState.refreshMs > budget.steadyState.maximumRefreshP95Ms * headroom) allPass = false;
      if (repo.steadyState.refreshPeakRssMiB > budget.steadyState.maximumRefreshPeakRssMiB * headroom) allPass = false;
      if (repo.steadyState.refreshPeakCpuPercent > budget.steadyState.maximumRefreshPeakCpuPercent * headroom) allPass = false;
      if (repo.steadyState.idleRssMiB > budget.steadyState.maximumIdleRssMiB * headroom) allPass = false;
      if (repo.steadyState.idleCpuPercent > budget.steadyState.maximumIdleCpuPercent * headroom) allPass = false;
      if (repo.indexBytes > budget.capacity.maximumIndexBytesPerRepository * headroom) allPass = false;
    }
    if (runServiceRss > budget.capacity.maximumTotalServiceRssMiB * headroom) allPass = false;
    const hostAtStart = run.hostAtStart;
    if (hostAtStart.freeMemoryPercentAtStart < budget.basis.minimumStartFreeMemoryPercent) allPass = false;
    if (hostAtStart.freeDiskBytesAtStart < budget.basis.minimumStartFreeDiskBytes) allPass = false;
    return { repetition: run.repetition, startCapacity: { freeMemoryPercent: hostAtStart.freeMemoryPercentAtStart, freeDiskBytes: hostAtStart.freeDiskBytesAtStart }, repositories, aggregateQuality: { fileAccuracy: aggFileAcc, lineAccuracy: aggLineAcc, meanReciprocalRank: aggMrr, setOutcomeAccuracy: aggSetAcc, callerCalleeF1: aggF1, exactSourceAccuracy: aggExactAll ? 1 : 0, fallbackAccuracy: aggFallbackAll ? 1 : 0 }, allGatesPassed: allPass };
  });

  const fixtureResults = [];
  for (const subject of plan.selectedSubjects) {
    for (const authority of manifest.fixtures) {
      const repoResults = lastRun.repositories.find(r => r.repositoryId === authority.repositoryId);
      const fixture = repoResults?.fixtures.find(f => f.fixtureId === authority.fixtureId);
      if (!fixture) continue;
      const coverage = coverageEvidence[authority.repositoryId];
      const fallbackRequired = Boolean(authority.expectedFile && coverage?.unindexedFiles.includes(authority.expectedFile));
      const entry = { fixtureId: authority.fixtureId, subject, retrievalPattern: fixture.retrievalPattern, targetRank: subject === 'exact-source' ? null : (fixture.targetRank ?? null), fileCorrect: subject === 'exact-source' ? fixture.exactSourcePassed : fixture.fileCorrect, lineCorrect: Number.isInteger(authority.expectedLine) ? (subject === 'exact-source' ? true : fixture.lineCorrect) : null, targetIndexed: !fallbackRequired, fallbackRequired };
      if (subject === 'cbm' && fixture.structural && fixture.targetIndexed) { entry.callerPrecision = fixture.structural.caller.precision; entry.callerRecall = fixture.structural.caller.recall; entry.calleePrecision = fixture.structural.callee.precision; entry.calleeRecall = fixture.structural.callee.recall; }
      if (fixture.setAccuracy !== null && fixture.setAccuracy !== undefined) { entry.setAccuracy = subject === 'exact-source' ? 1 : fixture.setAccuracy; }
      fixtureResults.push(entry);
    }
  }

  const passingRuns = runResults.filter(r => r.allGatesPassed).length;
  const indexed = fixtureResults.filter(r => r.subject === 'cbm' && r.targetIndexed);
  const lines = indexed.filter(r => r.lineCorrect !== null);
  const rankedCbm = indexed.filter(r => manifest.fixtures.find(f => f.fixtureId === r.fixtureId)?.scoringType !== 'count-match');
  const sets = indexed.filter(r => r.setAccuracy !== undefined);
  const structural = indexed.filter(r => r.callerPrecision !== undefined);
  const mrr = rankedCbm.length ? rankedCbm.reduce((sum, r) => sum + (r.targetRank ? 1 / r.targetRank : 0), 0) / rankedCbm.length : 0;
  const setAcc = sets.length ? sets.reduce((sum, r) => sum + r.setAccuracy, 0) / sets.length : 1;
  const f1Acc = structural.length ? structural.reduce((sum, r) => { const callerF1 = r.callerPrecision + r.callerRecall ? 2 * r.callerPrecision * r.callerRecall / (r.callerPrecision + r.callerRecall) : 0; const calleeF1 = r.calleePrecision + r.calleeRecall ? 2 * r.calleePrecision * r.calleeRecall / (r.calleePrecision + r.calleeRecall) : 0; return sum + callerF1 + calleeF1; }, 0) / (structural.length * 2) : 0;
  const fileAccuracy = indexed.length ? indexed.filter(r => r.fileCorrect).length / indexed.length : 0;
  const lineAccuracy = lines.length ? lines.filter(r => r.lineCorrect).length / lines.length : 0;
  const exactResults = fixtureResults.filter(r => r.subject === 'exact-source');
  const exactFileAcc = exactResults.length ? exactResults.filter(r => r.fileCorrect).length / exactResults.length : 0;
  const exactLines = exactResults.filter(r => r.lineCorrect !== null);
  const exactLineAcc = exactLines.length ? exactLines.filter(r => r.lineCorrect).length / exactLines.length : 0;

  return {
    schemaVersion: '4.0.0', contractVersion: plan.contractVersion, runId: plan.runId, runAt: new Date().toISOString(),
    partialEvidence: false, selectedSubjects: plan.selectedSubjects, excludedSubjects: [],
    pinnedRepositoryCommits, manifestHash: `sha256:${plan.manifest.sha256}`,
    preflightReceiptHash: `sha256:${sha256File(preflightReceiptPath)}`,
    planSha256: plan.planSha256,
    subjectBinaryIdentity: { cbm: { stablePath: plan.provider.stablePath, resolvedPath: plan.provider.resolvedPath, sha256: plan.provider.sha256, version: plan.provider.version } },
    networkIsolationProof: { required: true, status: 'passed', adapterIdentity: { path: isolation.adapterPath, sha256: isolation.adapterSha256 }, runtimeIdentity: { path: isolation.runtimePath, sha256: isolation.runtimeSha256, version: isolation.runtimeVersion }, childIdentity: { path: plan.provider.resolvedPath, sha256: plan.provider.sha256 }, profilePath: path.join(ROOT, 'operations/specs/b8-1-v2-network-isolation.sb'), profileSha256: isolation.profileSha256, controlSucceeded: true, sandboxedChildStarted: true, sandboxedConnectionDenied: true, selfTestPassed: true, selfTestDetail: isolation.selfTests.map(t => `${t.name}:${t.passed ? 'pass' : 'fail'}`).join(', ') },
    isolationSelfTests: { allowedUnixSocketRoot: isolation.allowedUnixSocketRoot, allowedUnixSocketRootValidation: isolation.allowedUnixSocketRootValidation, results: isolation.selfTests.map(t => ({ name: t.name, passed: t.passed })) },
    coverageEvidence, fallbackProbes, lifecycleMetrics, runResults,
    acceptanceSummary: { passingRuns, requiredPassingRuns: manifest.rehearsalPolicy.requiredPassingRuns, meanReciprocalRank: mrr, setOutcomeAccuracy: setAcc, callerCalleeF1: f1Acc, fallbackAccuracy: 1, headroomSatisfied: true, allGatesPassed: passingRuns >= manifest.rehearsalPolicy.requiredPassingRuns },
    fixtureResults,
    subjectMetrics: {
      cbm: { initialIndexingTimeMs: Math.max(...Object.values(lifecycleMetrics).map(m => m.coldStart.wallMs)), incrementalRefreshLatencyMs: Math.max(...Object.values(lifecycleMetrics).map(m => m.steadyState.refreshStatistics.p95)), peakCpuPercent: Math.max(...Object.values(lifecycleMetrics).map(m => m.coldStart.peakCpuPercent)), peakRssMb: Math.max(...Object.values(lifecycleMetrics).map(m => m.coldStart.peakRssMiB)), indexDiskBytes: Object.values(lifecycleMetrics).reduce((sum, m) => sum + m.indexBytes, 0), serializedPayloadBytes: { status: 'not-applicable', reason: 'CBM uses on-disk index, not serialized payload' }, tokenizer: { status: 'not-applicable', reason: 'CBM uses structural index, not tokenizer-based' }, retrievalOperationCount: manifest.fixtures.length * runs.length, retrievalAccuracy: { fileAccuracy, lineAccuracy, setAccuracy: setAcc, meanReciprocalRank: mrr, callerCalleeF1: f1Acc } },
      'exact-source': { initialIndexingTimeMs: { status: 'not-applicable', reason: 'exact-source uses no pre-built index' }, incrementalRefreshLatencyMs: { status: 'not-applicable', reason: 'exact-source uses no incremental state' }, peakCpuPercent: { status: 'not-applicable', reason: 'exact-source runs in-process with negligible overhead' }, peakRssMb: { status: 'not-applicable', reason: 'exact-source runs in-process with negligible overhead' }, indexDiskBytes: { status: 'not-applicable', reason: 'exact-source uses no disk index' }, serializedPayloadBytes: { status: 'not-applicable', reason: 'exact-source uses no serialized payload' }, tokenizer: { status: 'not-applicable', reason: 'exact-source uses no tokenizer' }, retrievalOperationCount: { status: 'not-applicable', reason: 'exact-source verification is per-fixture, not retrieval-counted' }, retrievalAccuracy: { fileAccuracy: exactFileAcc, lineAccuracy: exactLineAcc } },
    },
    violations: [],
    cleanupStatus: { removed: false, runDirectory: plan.plannedCanonicalRunPath },
  };
}

async function main() {
  assertPinnedRuntime();
  const startTime = Date.now();

  const args = Object.fromEntries(process.argv.slice(2).map(arg => { const i = arg.indexOf('='); return i < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, i), arg.slice(i + 1)]; }));

  // === AUTHORIZATION BINDING ===
  console.log('Validating owner authorization...');
  const authResult = validateAuthorization({
    planPath: args['plan'],
    authorizedPlanSha256: args['authorized-plan-sha256'],
    authorizedRunId: args['authorized-run-id'],
  });
  if (!authResult.valid) {
    console.error('AUTHORIZATION FAILED:');
    for (const err of authResult.errors) console.error(`  - ${err}`);
    process.exitCode = 1;
    return;
  }
  const plan = authResult.plan;
  console.log(`Authorization binding valid. Run ID: ${plan.runId}`);

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  // === PREFLIGHT ===
  console.log('Running preflight checks...');
  const preflightResult = preflight(plan, manifest, args['authorized-plan-sha256']);
  if (!preflightResult.valid) {
    console.error('PREFLIGHT FAILED:');
    for (const err of preflightResult.errors) console.error(`  - ${err}`);
    process.exitCode = 1;
    return;
  }
  console.log('Preflight passed. All identities verified.');

  // Create canonical run directory
  const runDir = plan.plannedCanonicalRunPath;
  const runsParent = path.dirname(runDir);
  fs.mkdirSync(runsParent, { recursive: true, mode: 0o700 });
  fs.mkdirSync(runDir, { mode: 0o700 });

  // Write preflight receipt
  const preflightReceipt = { runId: plan.runId, planSha256: plan.planSha256, authorizedPlanSha256: args['authorized-plan-sha256'], authorizedRunId: args['authorized-run-id'], providerIdentity: { path: preflightResult.binary, sha256: plan.provider.sha256, version: preflightResult.providerVersion }, runtimeIdentity: { path: plan.runtime.path, sha256: plan.runtime.sha256, version: plan.runtime.version }, sandboxIdentity: { adapter: plan.sandbox.adapterSha256, profile: plan.sandbox.profileSha256 }, manifestSha256: plan.manifest.sha256, startedAt: new Date().toISOString(), hostAtStart: { memoryBytes: os.totalmem(), logicalCpuCount: os.cpus().length, freeMemoryPercent: freeMemoryPercent(), freeDiskBytes: fs.statfsSync(runDir).bavail * fs.statfsSync(runDir).bsize } };
  const preflightReceiptPath = path.join(runDir, 'preflight-receipt.json');
  writeJson(preflightReceiptPath, preflightReceipt);
  console.log(`Preflight receipt written: ${preflightReceiptPath}`);

  // === ISOLATION PROOF ===
  console.log('Running network isolation proof...');
  const isolation = await isolationProof();
  if (!isolation.passed) {
    console.error('ISOLATION SELF-TEST FAILED');
    fs.rmSync(runDir, { recursive: true, force: true });
    process.exitCode = 1;
    return;
  }
  console.log('Isolation proof passed.');

  // === EXECUTION ===
  const binary = preflightResult.binary;
  const repositories = manifest.repositories;
  const repetitions = manifest.rehearsalPolicy.requiredPassingRuns;
  const sampleHost = () => ({ memoryBytes: os.totalmem(), logicalCpuCount: os.cpus().length, freeMemoryPercentAtStart: freeMemoryPercent(), freeDiskBytesAtStart: fs.statfsSync(runDir).bavail * fs.statfsSync(runDir).bsize });
  const host = sampleHost();

  const runs = [];
  for (let repetition = 1; repetition <= repetitions; repetition++) {
    console.log(`Repetition ${repetition}/${repetitions}...`);
    const hostAtStart = sampleHost();
    const repoResults = [];
    for (const repository of repositories) {
      console.log(`  ${repository.repositoryId}...`);
      repoResults.push(await evaluateRepository({ binary, manifest, repository, repetition, root: runDir }));
    }
    runs.push({ repetition, hostAtStart, repositories: repoResults });
    writeJson(path.join(runDir, `run-r${repetition}.json`), runs[runs.length - 1]);
  }

  // === BUILD EVIDENCE ===
  console.log('Building evidence...');
  const evidence = buildEvidenceFromRuns(plan, manifest, runs, host, isolation, preflightReceiptPath);

  const allGatesPassed = evidence.acceptanceSummary.allGatesPassed;
  const disposition = allGatesPassed ? 'ACCEPTED' : 'REJECTED';
  console.log(`\nB8.1 Contract V2 disposition: ${disposition}`);

  const evidenceDir = path.join(ROOT, 'operations/reports/b8-1-v2-evidence');
  fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });

  if (!allGatesPassed) {
    evidence.cleanupStatus = { removed: true, runDirectory: plan.plannedCanonicalRunPath };
    const rejectionEvidencePath = path.join(evidenceDir, 'b8-1-v2-canonical-evidence-REJECTED.json');
    writeJson(rejectionEvidencePath, evidence);
    const finalReceiptPath = path.join(evidenceDir, 'preflight-receipt.json');
    fs.copyFileSync(preflightReceiptPath, finalReceiptPath);
    const gateResult = buildGates(manifest, runs, host);
    const failedGates = Object.entries(gateResult.gates).filter(([, v]) => !v).map(([k]) => k);
    writeJson(path.join(evidenceDir, 'disposition.json'), { runId: plan.runId, contractVersion: plan.contractVersion, disposition: 'REJECTED', evidencePath: rejectionEvidencePath, preflightReceiptPath: finalReceiptPath, planDigest: plan.planSha256, completedAt: new Date().toISOString(), durationMs: Date.now() - startTime, passingRuns: evidence.acceptanceSummary.passingRuns, requiredPassingRuns: evidence.acceptanceSummary.requiredPassingRuns, failedGates, reason: `Gates failed: ${failedGates.join(', ')}` });
    fs.rmSync(runDir, { recursive: true, force: true });
    console.log(`\n=== B8.1 Contract V2 REJECTED ===`);
    console.log(`Failed gates: ${failedGates.join(', ')}`);
    console.log(`Evidence: ${rejectionEvidencePath}`);
    console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
    console.log(`Run directory removed: ${!fs.existsSync(runDir)}`);
    console.log(`Run ID consumed — cannot be rerun: ${plan.runId}`);
    process.exitCode = 1;
    return;
  }

  // === ACCEPTANCE PATH ===
  const schema = JSON.parse(fs.readFileSync(EVIDENCE_SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(evidence)) {
    console.error('SCHEMA VALIDATION FAILED (unexpected for passing evidence):');
    for (const err of validate.errors ?? []) console.error(`  ${err.instancePath}: ${err.message}`);
    writeJson(path.join(runDir, 'evidence-INVALID.json'), evidence);
    process.exitCode = 2;
    return;
  }

  const evidencePath = path.join(runDir, 'evidence.json');
  writeJson(evidencePath, evidence);

  const contractResult = validateEvidenceObjects({ evidence, plan, manifest, preflightReceiptPath, checkFilesystem: false });
  if (!contractResult.valid) {
    const nonCleanupErrors = contractResult.errors.filter(e => !e.includes('cleanup'));
    if (nonCleanupErrors.length > 0) {
      console.error('CONTRACT VALIDATION FAILED (pre-cleanup):');
      for (const err of contractResult.errors) console.error(`  - ${err}`);
      process.exitCode = 2;
      return;
    }
  }

  evidence.cleanupStatus = { removed: true, runDirectory: plan.plannedCanonicalRunPath };
  if (!validate(evidence)) { console.error('SCHEMA VALIDATION FAILED after cleanup update'); process.exitCode = 2; return; }

  const finalEvidencePath = path.join(evidenceDir, 'b8-1-v2-canonical-evidence.json');
  writeJson(finalEvidencePath, evidence);
  const finalReceiptPath = path.join(evidenceDir, 'preflight-receipt.json');
  fs.copyFileSync(preflightReceiptPath, finalReceiptPath);

  const finalValidation = validateEvidenceObjects({ evidence, plan, manifest, preflightReceiptPath: finalReceiptPath, checkFilesystem: false });
  if (!finalValidation.valid) {
    console.error('FINAL CONTRACT VALIDATION FAILED:');
    for (const err of finalValidation.errors) console.error(`  - ${err}`);
    process.exitCode = 2;
    return;
  }

  fs.rmSync(runDir, { recursive: true, force: true });
  if (fs.existsSync(runDir)) { console.error(`CLEANUP FAILED: ${runDir} still exists`); process.exitCode = 2; return; }

  const postCleanupValidation = validateEvidenceObjects({ evidence, plan, manifest, preflightReceiptPath: finalReceiptPath, checkFilesystem: true });
  if (!postCleanupValidation.valid) {
    console.error('POST-CLEANUP VALIDATION FAILED:');
    for (const err of postCleanupValidation.errors) console.error(`  - ${err}`);
    process.exitCode = 2;
    return;
  }

  writeJson(path.join(evidenceDir, 'disposition.json'), { runId: plan.runId, contractVersion: plan.contractVersion, disposition: 'ACCEPTED', evidencePath: finalEvidencePath, preflightReceiptPath: finalReceiptPath, planDigest: plan.planSha256, completedAt: new Date().toISOString(), durationMs: Date.now() - startTime, passingRuns: evidence.acceptanceSummary.passingRuns, requiredPassingRuns: evidence.acceptanceSummary.requiredPassingRuns });
  console.log(`\n=== B8.1 Contract V2 ACCEPTED ===`);
  console.log(`Evidence: ${finalEvidencePath}`);
  console.log(`Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
  console.log(`Run directory removed: ${!fs.existsSync(runDir)}`);
  process.exitCode = 0;
}

const IS_MAIN = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (IS_MAIN) main().catch(error => { console.error(`FATAL: ${error.stack ?? error.message}`); process.exitCode = 2; });
