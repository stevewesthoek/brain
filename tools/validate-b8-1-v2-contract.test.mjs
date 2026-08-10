import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { computePlanDigest, verifyPlan, PLAN_VERSION, CONTRACT_VERSION } from './lib/b8-1-v2-plan-digest.mjs';
import { buildGates, setScore, validateDiagnosticReport } from './run-b8-1-v2-disposable-evaluation.mjs';
import { validateContract } from './validate-b8-1-v2-contract.mjs';

const manifest = JSON.parse(fs.readFileSync(new URL('../operations/specs/b8-1-v2-context-memory-benchmark-manifest.json', import.meta.url)));
const schema = JSON.parse(fs.readFileSync(new URL('../operations/specs/b8-1-v2-context-memory-benchmark-manifest.schema.json', import.meta.url)));
const evidenceSchema = JSON.parse(fs.readFileSync(new URL('../operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json', import.meta.url)));

test('V2 contract validates against pinned source', () => assert.deepEqual(validateContract(), { valid: true, errors: [] }));
test('manifest schema rejects fast mode', () => {
  const changed = structuredClone(manifest); changed.providerContract.requiredIndexMode = 'fast';
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema); assert.equal(validate(changed), false);
});
test('manifest schema rejects duplicate truth entries', () => {
  const changed = structuredClone(manifest); changed.fixtures[0].expectedCallers.push(changed.fixtures[0].expectedCallers[0]);
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema); assert.equal(validate(changed), false);
});
test('manifest schema rejects structural fields on nonapplicable fixtures', () => {
  const changed = structuredClone(manifest); changed.fixtures.find(f => !f.callerCalleeApplicable).expectedCallers = [];
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema); assert.equal(validate(changed), false);
});
test('digest binds every architecture policy', () => {
  const base = { planVersion: PLAN_VERSION, contractVersion: CONTRACT_VERSION, architecture: { retrievalPolicy: manifest.retrievalPolicy, coveragePolicy: manifest.coveragePolicy, structuralTruthContract: manifest.structuralTruthContract, acceptancePolicy: manifest.acceptancePolicy, resourceBudget: manifest.resourceBudget, rehearsalPolicy: manifest.rehearsalPolicy, isolationPolicy: manifest.isolationPolicy } };
  const first = computePlanDigest(base); const changed = structuredClone(base); changed.architecture.retrievalPolicy.maximumCandidates -= 1;
  assert.notEqual(computePlanDigest(changed), first);
});
test('historical approval digests fail closed', () => {
  const plan = { planVersion: PLAN_VERSION, contractVersion: CONTRACT_VERSION, planSha256: '57156d49e4f3ab273efb791dc3e4e128a839ba10552b860ab3219ae58e8bd1d1' };
  assert.equal(verifyPlan(plan).valid, false);
});
test('unknown approval-plan fields fail closed and remain digest-bound', () => {
  const plan = { planVersion: PLAN_VERSION, contractVersion: CONTRACT_VERSION, unexpected: true };
  plan.planSha256 = computePlanDigest(plan);
  assert.equal(verifyPlan(plan).valid, false);
  const changed = { ...plan, unexpected: false };
  assert.notEqual(computePlanDigest(changed), plan.planSha256);
});
test('fuzzy set matching is one-to-one', () => {
  const score = setScore(['foo'], ['foo', 'obj.foo'], (predicted, expected) => predicted === expected || predicted.endsWith(`.${expected}`));
  assert.equal(score.precision, 0.5);
  assert.equal(score.recall, 1);
  assert.ok(score.f1 <= 1);
});
test('V2 evidence routes to subject metrics and requires all four isolation controls', () => {
  const hash = '0'.repeat(64);
  const evidence = {
    schemaVersion: '4.0.0', contractVersion: 'B8.1-V2.1', runId: 'b8-1-v2-test', partialEvidence: false,
    selectedSubjects: ['cbm', 'exact-source'], excludedSubjects: [],
    pinnedRepositoryCommits: { repo: { repositoryId: 'repo', commit: 'a'.repeat(40) } },
    manifestHash: `sha256:${hash}`, preflightReceiptHash: `sha256:${hash}`, planSha256: hash,
    subjectBinaryIdentity: { cbm: { stablePath: '/stable', resolvedPath: '/resolved', sha256: hash, version: 'v0.9.0' } },
    networkIsolationProof: { required: true, status: 'passed', adapterIdentity: { path: '/usr/bin/sandbox-exec', sha256: hash }, runtimeIdentity: { path: '/node', sha256: hash, version: 'v20' }, childIdentity: { path: '/cbm', sha256: hash }, profilePath: '/profile', profileSha256: hash, controlSucceeded: true, sandboxedChildStarted: true, sandboxedConnectionDenied: true, selfTestPassed: true },
    isolationSelfTests: { allowedUnixSocketRoot: '/private/tmp/cbm-daemon-501', allowedUnixSocketRootValidation: { ownerUid: 501, mode: '0700', directory: true, symlink: false }, results: [
      { name: 'deny-ipv4-loopback-connect', passed: true }, { name: 'deny-ipv6-loopback-connect', passed: true },
      { name: 'allow-declared-unix-socket-connect', passed: true }, { name: 'deny-outside-unix-socket-connect', passed: true },
    ] },
    coverageEvidence: { repo: { eligibleCount: 1, indexedCount: 1, unindexedCount: 0, unknownCount: 0, coverageRatio: 1, unindexedFiles: [], fallbackFixtureIds: [] } },
    fallbackProbes: { repo: { fixtureId: 'fallback-repo', question: 'Where is token defined?', retrievalPattern: 'token', expectedFile: 'src/missed.ts', exactSourceCandidates: ['src/missed.ts'], targetIndexed: false, cbmStructuralCredit: 0, exactSourceSha256: hash, exactSourcePassed: true } },
    lifecycleMetrics: { repo: { coldStart: { wallMs: 1, peakRssMiB: 1, peakCpuPercent: 1 }, steadyState: { idleRssMiB: 0, idleCpuPercent: 0, totalServiceRssMiB: 0, refreshSamplesMs: [1, 1, 1, 1, 1], refreshStatistics: { minimum: 1, median: 1, p95: 1, maximum: 1 }, refreshPeakRssMiB: 1, refreshPeakCpuPercent: 1 }, indexBytes: 1 } },
    runResults: Array.from({ length: 5 }, (_, index) => ({ repetition: index + 1, startCapacity: { freeMemoryPercent: 100, freeDiskBytes: 100 }, repositories: { repo: { coverageRatio: 1, unknownCount: 0, fileAccuracy: 1, lineAccuracy: 1, meanReciprocalRank: 1, setOutcomeAccuracy: 1, callerCalleeF1: 1, exactSourceAccuracy: 1, fallbackAccuracy: 1, coldStart: { wallMs: 1, peakRssMiB: 1, peakCpuPercent: 1 }, steadyState: { refreshMs: 1, refreshPeakRssMiB: 1, refreshPeakCpuPercent: 1, idleRssMiB: 0, idleCpuPercent: 0, totalServiceRssMiB: 0 }, indexBytes: 1 } }, allGatesPassed: true })),
    acceptanceSummary: { passingRuns: 5, requiredPassingRuns: 5, meanReciprocalRank: 1, setOutcomeAccuracy: 1, callerCalleeF1: 1, fallbackAccuracy: 1, headroomSatisfied: true, allGatesPassed: true },
    fixtureResults: [{ fixtureId: 'f', subject: 'cbm', fileCorrect: true, lineCorrect: true, targetIndexed: true, fallbackRequired: false }],
    subjectMetrics: {
      cbm: { retrievalAccuracy: { fileAccuracy: 1, lineAccuracy: 1 }, repositoryMetrics: { repo: { initialIndexingTimeMs: 1, incrementalRefreshLatencyMs: 1, indexDiskBytes: 1, refreshProbeTarget: 'src/a.ts' } } },
      'exact-source': { retrievalAccuracy: { fileAccuracy: 1, lineAccuracy: 1 } },
    },
    violations: [], cleanupStatus: { runDirectory: '/tmp/run', removed: false },
  };
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(evidenceSchema);
  assert.equal(validate(evidence), true, JSON.stringify(validate.errors));
  evidence.isolationSelfTests.results = evidence.isolationSelfTests.results.map(() => ({ name: 'allow-declared-unix-socket-connect', passed: true }));
  assert.equal(validate(evidence), false);
});
test('aggregate success cannot hide a failed independent rehearsal run', () => {
  const policy = {
    rehearsalPolicy: { minimumIndependentRuns: 2, requiredPassingRuns: 2, requiredHeadroomRatio: 0.1 },
    resourceBudget: {
      basis: { minimumStartFreeMemoryPercent: 0, minimumStartFreeDiskBytes: 0 },
      coldStart: { maximumIndexingTimeMsPerRepository: 10, maximumPeakRssMiB: 10, maximumPeakCpuPercent: 10 },
      steadyState: { maximumIdleRssMiB: 10, maximumIdleCpuPercent: 10, maximumRefreshP95Ms: 10, maximumRefreshMs: 10, maximumRefreshPeakRssMiB: 10, maximumRefreshPeakCpuPercent: 10 },
      capacity: { maximumIndexBytesPerRepository: 10, maximumTotalServiceRssMiB: 10 },
    },
    coveragePolicy: { minimumPerRepositoryCoverage: 0.9, minimumAggregateCoverage: 0.9 },
    retrievalPolicy: { minimumMeanReciprocalRank: 0.1 },
    acceptancePolicy: { minimumIndexedFixtureFileAccuracy: 0.4, minimumIndexedFixtureLineAccuracy: 0.8, minimumSetOutcomeAccuracy: 1, minimumCallerCalleeF1: 0.8 },
  };
  const repository = fileCorrect => ({
    repositoryId: 'repo', coverage: { eligibleCount: 1, indexedCount: 1, unknownCount: 0, ratio: 1 },
    coldStart: { wallMs: 1, peakRssMiB: 1, peakCpuPercent: 1 },
    steadyState: { idleRssMiB: 0, idleCpuPercent: 0, totalServiceRssMiB: 0, refreshMs: 1, refreshPeakRssMiB: 1, refreshPeakCpuPercent: 1, markerVisible: true, markerAbsentAfterRestore: true },
    indexBytes: 1, repositoryIsolation: { passed: true }, processCleanup: { passed: true }, fallbackProbe: { exactSourcePassed: true, cbmStructuralCredit: 0 },
    fixtures: [{ scoringType: 'set-match', setAccuracy: 1, targetRank: 1, targetIndexed: true, exactSourcePassed: true, fallbackRequired: false, fileCorrect, lineCorrect: true, structural: { caller: { f1: 1 }, callee: { f1: 1 } } }],
  });
  const result = buildGates(policy, [
    { repetition: 1, repositories: [repository(true)] },
    { repetition: 2, repositories: [repository(false)] },
  ], { freeMemoryPercentAtStart: 100, freeDiskBytesAtStart: 100 });
  assert.equal(result.metrics.indexedFileAccuracy, 0.5);
  assert.equal(result.metrics.passingRuns, 1);
  assert.equal(result.gates.requiredPassingRuns, false);
  assert.equal(result.passed, false);
});
test('diagnostic semantic validation rejects duplicate repository evidence', () => {
  const policy = {
    repositories: [{ repositoryId: 'repo' }],
    fixtures: [{ fixtureId: 'f', repositoryId: 'repo', scoringType: 'set-match', retrievalPattern: 'query', expectedLine: 1, callerCalleeApplicable: true }],
    rehearsalPolicy: { minimumIndependentRuns: 1, requiredPassingRuns: 1, requiredHeadroomRatio: 0.1 },
    retrievalPolicy: { maximumCandidates: 20, minimumMeanReciprocalRank: 0.1 },
    coveragePolicy: { minimumPerRepositoryCoverage: 0.9, minimumAggregateCoverage: 0.9 },
    acceptancePolicy: { minimumIndexedFixtureFileAccuracy: 0.9, minimumIndexedFixtureLineAccuracy: 0.8, minimumSetOutcomeAccuracy: 1, minimumCallerCalleeF1: 0.8 },
    resourceBudget: {
      basis: { minimumStartFreeMemoryPercent: 0, minimumStartFreeDiskBytes: 0 },
      coldStart: { maximumIndexingTimeMsPerRepository: 10, maximumPeakRssMiB: 10, maximumPeakCpuPercent: 10 },
      steadyState: { maximumIdleRssMiB: 10, maximumIdleCpuPercent: 10, maximumRefreshP95Ms: 10, maximumRefreshMs: 10, maximumRefreshPeakRssMiB: 10, maximumRefreshPeakCpuPercent: 10 },
      capacity: { maximumIndexBytesPerRepository: 10, maximumTotalServiceRssMiB: 10 },
    },
  };
  const fixture = { fixtureId: 'f', scoringType: 'set-match', retrievalPattern: 'query', retrievedFiles: ['src/a.ts'], targetRank: 1, targetIndexed: true, fallbackRequired: false, exactSource: { passed: true, located: true, contentVerified: true, candidates: ['src/a.ts'] }, exactSourcePassed: true, fileCorrect: true, lineCorrect: true, literalCorrect: null, setAccuracy: 1, structural: { caller: { f1: 1 }, callee: { f1: 1 } } };
  const repository = { repositoryId: 'repo', project: 'project', coverage: { eligibleCount: 1, indexedCount: 1, unindexedCount: 0, unknownCount: 0, ratio: 1, unindexedFiles: [] }, coldStart: { wallMs: 1, peakRssMiB: 1, peakCpuPercent: 1 }, steadyState: { idleRssMiB: 0, idleCpuPercent: 0, totalServiceRssMiB: 0, idleProvenance: { method: '/bin/ps -axo pid=,rss=,%cpu=,command=', observedProcesses: [] }, refreshMs: 1, refreshPeakRssMiB: 1, refreshPeakCpuPercent: 1, markerVisible: true, markerAbsentAfterRestore: true }, indexBytes: 1, repositoryIsolation: { passed: true, visibleProjects: ['project'] }, processCleanup: { passed: true, residualPids: [] }, fallbackProbe: { status: 'not-required-no-unindexed-files', exactSourcePassed: true, cbmStructuralCredit: 0 }, fixtures: [fixture] };
  const host = { freeMemoryPercentAtStart: 100, freeDiskBytesAtStart: 100 };
  const repetitions = [{ repetition: 1, hostAtStart: host, repositories: [repository] }];
  const report = { selectedRepositories: ['repo'], repetitions, host, acceptance: buildGates(policy, repetitions, host) };
  assert.deepEqual(validateDiagnosticReport(policy, report), { valid: true, errors: [] });
  const duplicate = structuredClone(report); duplicate.repetitions[0].repositories.push(structuredClone(repository));
  assert.equal(validateDiagnosticReport(policy, duplicate).valid, false);
});
