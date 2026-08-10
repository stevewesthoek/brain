#!/usr/bin/env node
/** Prepare a Contract V2 canonical DRY-RUN plan. Never materializes or executes. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { assertPinnedRuntime, buildGates, isolationProof, validateDiagnosticReport } from './run-b8-1-v2-disposable-evaluation.mjs';
import { PLAN_VERSION, CONTRACT_VERSION, computePlanDigest, verifyPlan } from './lib/b8-1-v2-plan-digest.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = {
  plan: 'operations/specs/b8-1-v2-context-memory-benchmark-plan.md',
  manifest: 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json',
  manifestSchema: 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.schema.json',
  evidenceSchema: 'operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json',
  isolationProfile: 'operations/specs/b8-1-v2-network-isolation.sb',
  isolationHelper: 'tools/lib/b8-1-v2-isolation-probe.mjs',
  evaluator: 'tools/run-b8-1-v2-disposable-evaluation.mjs',
  contractValidator: 'tools/validate-b8-1-v2-contract.mjs',
  evidenceValidator: 'tools/validate-b8-1-v2-evidence.mjs',
  preparer: 'tools/prepare-b8-1-v2-authorization.mjs',
  digest: 'tools/lib/b8-1-v2-plan-digest.mjs',
};
function hashFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function isStrictDescendant(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative.length > 0 && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
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
function identity() { return Object.fromEntries(Object.entries(artifacts).map(([name, relPath]) => [name, { repoRelPath: relPath, sha256: hashFile(path.join(ROOT, relPath)) }])); }
function parseArgs() { return Object.fromEntries(process.argv.slice(2).map(arg => { const i = arg.indexOf('='); return i < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, i), arg.slice(i + 1)]; })); }
function checkSchema(schemaPath, dataPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath)); const data = dataPath ? JSON.parse(fs.readFileSync(dataPath)) : null;
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (data && !validate(data)) throw new Error(`schema validation failed: ${JSON.stringify(validate.errors)}`);
}

async function main() {
  assertPinnedRuntime();
  const args = parseArgs();
  if (!args['run-id'] || !args.provider || !args['rehearsal-report'] || !args.output) throw new Error('required: --run-id=... --provider=... --rehearsal-report=... --output=...');
  if (!/^b8-1-v2-[a-zA-Z0-9._-]+$/.test(args['run-id']) || args['run-id'].includes('..')) throw new Error('invalid V2 run ID');
  const output = path.resolve(args.output);
  const reportsRoot = path.join(ROOT, 'operations/reports');
  const reportsStat = fs.lstatSync(reportsRoot);
  if (reportsStat.isSymbolicLink() || !reportsStat.isDirectory() || fs.realpathSync(reportsRoot) !== reportsRoot) throw new Error('operations/reports must be a physical directory');
  if (!isStrictDescendant(reportsRoot, output) || path.dirname(output) !== reportsRoot) throw new Error('dry-run plan output must be a direct child of operations/reports');
  if (fs.existsSync(output)) throw new Error(`dry-run plan output already exists: ${output}`);
  const canonicalRoot = path.join(os.homedir(), '.brain/benchmark/b8-1/runs', args['run-id']);
  if (fs.existsSync(canonicalRoot)) throw new Error(`canonical run path already exists: ${canonicalRoot}`);
  const manifestPath = path.join(ROOT, artifacts.manifest); const manifestSchemaPath = path.join(ROOT, artifacts.manifestSchema); const evidenceSchemaPath = path.join(ROOT, artifacts.evidenceSchema);
  checkSchema(manifestSchemaPath, manifestPath); checkSchema(evidenceSchemaPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath));
  const reportPath = path.resolve(args['rehearsal-report']); const report = JSON.parse(fs.readFileSync(reportPath));
  const diagnosticsRoot = '/Users/Office/.brain/benchmark/b8-1/diagnostics';
  const reportParent = path.dirname(reportPath); const reportGrandparent = path.dirname(reportParent);
  if (reportGrandparent !== diagnosticsRoot || path.basename(reportPath) !== 'evaluation-report.json') throw new Error('rehearsal report must be an evaluation-report.json in a direct diagnostic run directory');
  if (fs.realpathSync(reportParent) !== reportParent || fs.lstatSync(reportParent).isSymbolicLink()) throw new Error('rehearsal report parent must be a physical diagnostic directory');
  if (report.contractVersion !== CONTRACT_VERSION || report.diagnosticOnly !== true || report.canonicalAuthority !== false) throw new Error('rehearsal report is not Contract V2 diagnostic evidence');
  if (report.manifestSha256 !== hashFile(manifestPath)) throw new Error('rehearsal report manifest identity is stale');
  if (report.implementationIdentity?.evaluatorSha256 !== hashFile(path.join(ROOT, artifacts.evaluator))) throw new Error('rehearsal report evaluator identity is stale');
  if (report.implementationIdentity?.contractValidatorSha256 !== hashFile(path.join(ROOT, artifacts.contractValidator))) throw new Error('rehearsal report contract-validator identity is stale');
  if (report.acceptance?.passed !== true) throw new Error('rehearsal report did not pass every V2 gate');
  const diagnosticValidation = validateDiagnosticReport(manifest, report);
  if (!diagnosticValidation.valid) throw new Error(`rehearsal report semantic validation failed: ${diagnosticValidation.errors.join('; ')}`);
  if (report.repetitions?.length !== manifest.rehearsalPolicy.requiredPassingRuns) throw new Error('rehearsal report must contain exactly the required passing runs');
  const requiredRepositories = manifest.repositories.map(repository => repository.repositoryId).sort();
  const selectedRepositories = [...new Set(report.selectedRepositories ?? [])].sort();
  if (JSON.stringify(selectedRepositories) !== JSON.stringify(requiredRepositories)) throw new Error('rehearsal report does not cover exactly all pinned repositories');
  const repetitionIds = report.repetitions.map(run => run.repetition);
  if (new Set(repetitionIds).size !== repetitionIds.length || repetitionIds.some((id, index) => id !== index + 1)) throw new Error('rehearsal repetition identities are not sequential and unique');
  for (const run of report.repetitions) {
    const runRepositories = [...new Set((run.repositories ?? []).map(repository => repository.repositoryId))].sort();
    if (JSON.stringify(runRepositories) !== JSON.stringify(requiredRepositories)) throw new Error(`rehearsal repetition ${run.repetition} does not cover exactly all pinned repositories`);
  }
  if (report.repetitionReceipts?.length !== report.repetitions.length) throw new Error('rehearsal report is missing per-run receipts');
  for (const [index, receipt] of report.repetitionReceipts.entries()) {
    const expectedPath = path.join(reportParent, `rehearsal-r${index + 1}.json`);
    if (receipt.repetition !== index + 1 || receipt.path !== expectedPath || fs.lstatSync(expectedPath).isSymbolicLink() || !fs.lstatSync(expectedPath).isFile()) throw new Error(`invalid rehearsal receipt ${index + 1}`);
    if (receipt.sha256 !== hashFile(expectedPath)) throw new Error(`rehearsal receipt ${index + 1} identity mismatch`);
    if (JSON.stringify(JSON.parse(fs.readFileSync(expectedPath))) !== JSON.stringify(report.repetitions[index])) throw new Error(`rehearsal receipt ${index + 1} does not match the consolidated report`);
  }
  const recomputedAcceptance = buildGates(manifest, report.repetitions, report.host);
  if (!recomputedAcceptance.passed || recomputedAcceptance.metrics.passingRuns !== manifest.rehearsalPolicy.requiredPassingRuns) throw new Error('recomputed rehearsal acceptance does not prove all required passing runs');
  if (JSON.stringify(recomputedAcceptance) !== JSON.stringify(report.acceptance)) throw new Error('rehearsal acceptance summary is stale or inconsistent with raw repetitions');
  const provider = fs.realpathSync(args.provider); const providerHash = hashFile(provider); const providerVersion = execFileSync(provider, ['--version'], { encoding: 'utf8' }).trim();
  if (report.provider.path !== provider || report.provider.sha256 !== providerHash || report.provider.version !== providerVersion) throw new Error('provider identity does not match rehearsal evidence');
  if (report.provider.indexMode !== manifest.providerContract.requiredIndexMode) throw new Error('provider index mode does not match manifest');
  const stablePath = path.join(os.homedir(), '.local/bin/codebase-memory-mcp');
  if (!fs.lstatSync(stablePath).isSymbolicLink()) throw new Error('installed stable provider path must remain a symlink');
  if (fs.realpathSync(stablePath) !== provider) throw new Error('selected provider must be the unchanged installed stable target');
  const isolation = await isolationProof(); if (!isolation.passed) throw new Error('fresh four-control isolation proof failed');
  const sourcePins = manifest.repositories.map(repository => {
    const repoRoot = path.resolve(path.dirname(manifestPath), repository.localPath);
    execFileSync('git', ['-C', repoRoot, 'cat-file', '-e', `${repository.pinnedCommit}^{commit}`]);
    return { repositoryId: repository.repositoryId, commit: repository.pinnedCommit };
  });
  const freeDisk = fs.statfsSync(path.dirname(output)); const host = { memoryBytes: os.totalmem(), logicalCpuCount: os.cpus().length, freeMemoryPercent: freeMemoryPercent(), freeDiskBytes: freeDisk.bavail * freeDisk.bsize };
  if (host.freeMemoryPercent < manifest.resourceBudget.basis.minimumStartFreeMemoryPercent) throw new Error('insufficient free memory for authorization preflight');
  if (host.freeDiskBytes < manifest.resourceBudget.basis.minimumStartFreeDiskBytes) throw new Error('insufficient free disk for authorization preflight');
  const brainHead = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const checks = [
    'manifest-schema-valid', 'evidence-schema-compiles', 'source-pins-resolve', 'provider-identity-matches-rehearsal',
    'provider-full-mode-bound', 'five-of-five-rehearsals-pass', 'coverage-known-and-gated', 'fallback-accuracy-one',
    'caller-callee-f1-gated', 'lifecycle-budgets-pass-with-headroom', 'four-isolation-controls-pass',
    'graphify-out-of-contract', 'implementation-paths-exclude-mind', 'canonical-run-path-absent', 'dry-run-only',
  ].map(name => ({ name, status: 'pass' }));
  const plan = {
    planVersion: PLAN_VERSION, contractVersion: CONTRACT_VERSION, runId: args['run-id'], mode: 'canonical-dry-run-authorization-only',
    canonicalMaterializationAuthorized: false, canonicalExecutionAuthorized: false,
    selectedSubjects: ['cbm', 'exact-source'], graphifyStatus: 'excluded-out-of-contract', partialEvidence: false,
    manifest: { repoRelPath: artifacts.manifest, sha256: hashFile(manifestPath) },
    manifestSchema: { repoRelPath: artifacts.manifestSchema, sha256: hashFile(manifestSchemaPath) },
    evidenceSchema: { repoRelPath: artifacts.evidenceSchema, sha256: hashFile(evidenceSchemaPath) },
    architecture: { retrievalPolicy: manifest.retrievalPolicy, coveragePolicy: manifest.coveragePolicy, structuralTruthContract: manifest.structuralTruthContract, acceptancePolicy: manifest.acceptancePolicy, resourceBudget: manifest.resourceBudget, rehearsalPolicy: manifest.rehearsalPolicy, isolationPolicy: manifest.isolationPolicy },
    provider: { stablePath, resolvedPath: provider, version: providerVersion, sha256: providerHash, indexMode: manifest.providerContract.requiredIndexMode, persistence: false, autoWatch: false },
    runtime: { path: isolation.runtimePath, version: isolation.runtimeVersion, sha256: isolation.runtimeSha256 },
    sandbox: { adapterPath: isolation.adapterPath, adapterSha256: isolation.adapterSha256, profileSha256: isolation.profileSha256, helperSha256: isolation.helperSha256, allowedUnixSocketRoot: isolation.allowedUnixSocketRoot, allowedUnixSocketRootValidation: isolation.allowedUnixSocketRootValidation, selfTests: isolation.selfTests.map(test => ({ name: test.name, passed: test.passed })) },
    sourcePins, implementationIdentity: identity(), brainImplementationCommit: brainHead,
    rehearsalEvidence: { path: reportPath, sha256: hashFile(reportPath), repetitions: report.repetitions.length, repetitionReceipts: report.repetitionReceipts, metrics: report.acceptance.metrics, gates: report.acceptance.gates },
    host, plannedCanonicalRunPath: canonicalRoot, checks,
  };
  plan.planSha256 = computePlanDigest(plan); plan.createdAt = new Date().toISOString();
  const verified = verifyPlan(plan); if (!verified.valid) throw new Error(verified.errors.join('; '));
  fs.writeFileSync(output, `${JSON.stringify(plan, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: 'B8.1 V2 READY — AWAITING OWNER APPROVAL', output, runId: plan.runId, planSha256: plan.planSha256, blockers: 0, materialized: false, executed: false }, null, 2));
}
main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
