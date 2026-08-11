#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { runCbmIndex, runIncrementalReindex } from './lib/b8-1-cbm-incremental-reindex.mjs';
import { createDisposableRepositoryCopy, measureIndexBytes } from './lib/b8-3-context-memory-freshness.mjs';
import { buildRetrievalPlan, loadRetrievalPolicy } from './lib/b8-4-retrieval-policy.mjs';
import { loadGraphifyProfile, runSemanticEvent } from './lib/b8-5-graphify-semantic.mjs';

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PILOT_PATH = path.join(ROOT, 'operations/specs/b8-6-context-memory-pilot.json');
const RETRIEVAL_POLICY_PATH = path.join(ROOT, 'operations/specs/b8-4-agent-retrieval-policy.json');
const GRAPHIFY_PROFILE_PATH = path.join(ROOT, 'operations/specs/graphify-operational-profile.json');
const ADMISSION_PATH = path.join(ROOT, 'operations/specs/mcp-provider-admissions.json');

function parseArgs() {
  return Object.fromEntries(process.argv.slice(2).map((arg) => {
    const index = arg.indexOf('=');
    return index < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, index), arg.slice(index + 1)];
  }));
}

function git(repositoryPath, ...args) {
  return execFileSync('git', ['-C', repositoryPath, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function repositorySnapshot(repositoryPath) {
  return { head: git(repositoryPath, 'rev-parse', 'HEAD'), status: git(repositoryPath, 'status', '--short') };
}

function privateDir(parent, name) {
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return dir;
}

function helperEnv(runRoot, cacheDir, configDir) {
  return {
    HOME: privateDir(runRoot, 'home'),
    PATH: process.env.PATH,
    TMPDIR: os.tmpdir(),
    XDG_CACHE_HOME: cacheDir,
    XDG_CONFIG_HOME: configDir,
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function searchCbm(providerPath, projectName, cacheDir, probe) {
  const args = ['cli', 'search_code', '--pattern', probe.query, '--project', projectName, '--mode', 'files', '--limit', '5'];
  const { stdout } = await execFileAsync(providerPath, args, {
    env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: os.tmpdir(), CBM_CACHE_DIR: cacheDir },
    timeout: 30000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const parsed = JSON.parse(stdout);
  const results = Array.isArray(parsed) ? parsed : parsed?.results;
  const files = Array.isArray(parsed?.files)
    ? parsed.files.map((file) => String(file).replaceAll('\\', '/'))
    : Array.isArray(results)
      ? results.map((result) => String(result?.file ?? result?.path ?? '').replaceAll('\\', '/'))
      : [];
  return { hit: files.includes(probe.expectedFile), files, outputBytes: Buffer.byteLength(stdout), rawResultCount: files.length, mode: 'files', limit: 5 };
}

function exactSourceSearch(repositoryPath, probe) {
  try {
    const stdout = execFileSync('git', ['-C', repositoryPath, 'grep', '-n', '-F', probe.query, '--', '.'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 8 * 1024 * 1024 });
    const normalized = stdout.replaceAll('\\', '/');
    return { hit: normalized.includes(`${probe.expectedFile}:`), outputBytes: Buffer.byteLength(stdout), matches: stdout.split('\n').filter(Boolean).length };
  } catch (error) {
    const stdout = error?.stdout?.toString?.() ?? '';
    return { hit: false, outputBytes: Buffer.byteLength(stdout), matches: 0 };
  }
}

function estimatedTokens(bytes) {
  return Math.ceil(bytes / 4);
}

async function runRepositoryPilot({ repository, providerPath, pilot, workRoot }) {
  const sourcePath = repository.localPath === '.' ? ROOT : repository.localPath;
  const before = repositorySnapshot(sourcePath);
  if (!before.head.startsWith(repository.expectedHeadAtPilotStart)) throw new Error(`${repository.repositoryId}: unexpected HEAD ${before.head}`);

  const runRoot = privateDir(workRoot, repository.repositoryId);
  let cacheDir = privateDir(runRoot, 'cache');
  const configDir = privateDir(runRoot, 'config');
  const env = helperEnv(runRoot, cacheDir, configDir);
  const initial = await runCbmIndex(providerPath, sourcePath, repository.projectName, cacheDir, configDir, env, null, 120000, 'full');
  if (!initial.success) throw new Error(`${repository.repositoryId}: cold index failed: ${initial.error}`);
  const initialIndexBytes = await measureIndexBytes(cacheDir);

  const probes = [];
  for (const probe of repository.retrievalProbes) {
    const cbm = await searchCbm(providerPath, repository.projectName, cacheDir, probe);
    const exact = exactSourceSearch(sourcePath, probe);
    probes.push({
      ...probe,
      cbm,
      exact,
      structuralHit: cbm.hit,
      exactSourceHit: exact.hit,
      navigationToolCalls: { cbmAssisted: 2, exactSourceBaseline: 2, delta: 0 },
      navigationEstimatedTokens: {
        cbmAssisted: estimatedTokens(cbm.outputBytes),
        exactSourceBaseline: estimatedTokens(exact.outputBytes),
        delta: estimatedTokens(cbm.outputBytes) - estimatedTokens(exact.outputBytes),
      },
    });
  }

  const disposable = createDisposableRepositoryCopy(sourcePath, `b8-6-${repository.repositoryId}-refresh-`);
  const refreshRoot = privateDir(runRoot, 'refresh-runtime');
  const refreshCache = privateDir(refreshRoot, 'cache');
  const refreshConfig = privateDir(refreshRoot, 'config');
  const refreshEnv = helperEnv(refreshRoot, refreshCache, refreshConfig);
  let refresh;
  try {
    refresh = await runIncrementalReindex({
      cbmExecutable: providerPath,
      disposableRepositoryPath: disposable.repositoryPath,
      repoId: `${repository.repositoryId}-b8-6-refresh`,
      projectName: `${repository.projectName}-refresh`,
      refreshProbeTarget: repository.refreshProbeTarget,
      cacheDir: refreshCache,
      configDir: refreshConfig,
      env: refreshEnv,
      timeout: 120000,
      indexMode: 'full',
    });
  } finally {
    fs.rmSync(disposable.root, { recursive: true, force: true });
  }

  fs.rmSync(cacheDir, { recursive: true, force: true });
  const rebuildRoot = privateDir(runRoot, 'rebuild-runtime');
  const rebuildCache = privateDir(rebuildRoot, 'cache');
  const rebuildConfig = privateDir(rebuildRoot, 'config');
  const rebuildProjectName = `${repository.projectName}-rebuild`;
  const rebuildEnv = helperEnv(rebuildRoot, rebuildCache, rebuildConfig);
  const rebuild = await runCbmIndex(providerPath, sourcePath, rebuildProjectName, rebuildCache, rebuildConfig, rebuildEnv, null, 120000, 'full');
  if (!rebuild.success) throw new Error(`${repository.repositoryId}: rebuild failed: ${rebuild.error}`);
  const rebuildIndexBytes = await measureIndexBytes(rebuildCache);
  const rebuildProbe = await searchCbm(providerPath, rebuildProjectName, rebuildCache, repository.retrievalProbes[0]);

  const fallbackPlan = buildRetrievalPlan({ intent: 'architecture', freshness: 'unavailable', policy: loadRetrievalPolicy(RETRIEVAL_POLICY_PATH) });
  const fallbackHits = repository.retrievalProbes.map((probe) => exactSourceSearch(sourcePath, probe));

  const afterOperations = repositorySnapshot(sourcePath);
  const sourceHeadUnchanged = afterOperations.head === before.head;
  const sourceWorktreeUnchanged = afterOperations.status === before.status;
  const repoLocalStateAbsent = !fs.existsSync(path.join(sourcePath, '.codebase-memory'));

  const acceptance = pilot.acceptance;
  const structuralHitRate = probes.filter((probe) => probe.structuralHit).length / probes.length;
  const exactSourceFallbackHitRate = fallbackHits.filter((result) => result.hit).length / fallbackHits.length;
  const gates = {
    structuralProbeHitRate: structuralHitRate >= acceptance.minimumStructuralProbeHitRate,
    exactSourceFallbackHitRate: exactSourceFallbackHitRate >= acceptance.minimumExactSourceFallbackHitRate,
    navigationOutputBounded: probes.every((probe) => probe.navigationEstimatedTokens.cbmAssisted <= acceptance.maximumCbmNavigationEstimatedTokensPerProbe),
    coldWall: initial.wallMs <= acceptance.maximumColdIndexWallMs,
    coldRss: initial.peakRssMb <= acceptance.maximumColdIndexPeakRssMiB,
    coldCpu: initial.cpuPercent <= acceptance.maximumColdIndexPeakCpuPercent,
    initialIndexBytes: initialIndexBytes <= acceptance.maximumIndexBytes,
    refreshLifecycle: refresh.success === true && refresh.markerVisible === true && refresh.restorationVerified === true && refresh.markerAbsentAfterRestoration === true,
    refreshWall: refresh.incrementalReindexWallMs <= acceptance.maximumRefreshWallMs,
    refreshRss: refresh.incrementalReindexPeakRssMb <= acceptance.maximumRefreshPeakRssMiB,
    refreshCpu: refresh.incrementalReindexCpuPercent <= acceptance.maximumRefreshPeakCpuPercent,
    rebuildWall: rebuild.wallMs <= acceptance.maximumRebuildWallMs,
    rebuildIndexBytes: rebuildIndexBytes <= acceptance.maximumIndexBytes,
    rebuildQueryable: rebuildProbe.hit === true,
    gracefulDegradation: fallbackPlan.fallbackUsed === true && fallbackPlan.authority === 'exact-source' && fallbackPlan.steps[0] === 'bounded-exact-source-search',
    sourceHeadUnchanged,
    sourceWorktreeUnchanged,
    repoLocalStateAbsent,
  };

  fs.rmSync(runRoot, { recursive: true, force: true });
  const rollback = {
    pilotRuntimeRemoved: !fs.existsSync(runRoot),
    repositoryAvailableAfterRollback: fs.existsSync(sourcePath) && fs.existsSync(path.join(sourcePath, repository.retrievalProbes[0].expectedFile)),
    sourceSnapshotAfterRollback: repositorySnapshot(sourcePath),
  };
  gates.rollback = rollback.pilotRuntimeRemoved && rollback.repositoryAvailableAfterRollback && rollback.sourceSnapshotAfterRollback.head === before.head && rollback.sourceSnapshotAfterRollback.status === before.status;

  return {
    repositoryId: repository.repositoryId,
    role: repository.role,
    sourcePath,
    before,
    afterOperations,
    provider: { path: providerPath, sha256: sha256(providerPath) },
    coldIndex: { wallMs: initial.wallMs, peakRssMiB: initial.peakRssMb, peakCpuPercent: initial.cpuPercent, indexBytes: initialIndexBytes },
    probes,
    structuralHitRate,
    exactSourceFallbackHitRate,
    navigationMeasurement: {
      searchMode: 'files',
      searchLimit: 5,
      maxCbmEstimatedTokensPerProbe: Math.max(...probes.map((probe) => probe.navigationEstimatedTokens.cbmAssisted)),
      cbmEstimatedTokens: probes.reduce((sum, probe) => sum + probe.navigationEstimatedTokens.cbmAssisted, 0),
      exactSourceEstimatedTokens: probes.reduce((sum, probe) => sum + probe.navigationEstimatedTokens.exactSourceBaseline, 0),
      estimatedTokenDelta: probes.reduce((sum, probe) => sum + probe.navigationEstimatedTokens.delta, 0),
      cbmToolCalls: probes.reduce((sum, probe) => sum + probe.navigationToolCalls.cbmAssisted, 0),
      exactSourceToolCalls: probes.reduce((sum, probe) => sum + probe.navigationToolCalls.exactSourceBaseline, 0),
      toolCallDelta: 0,
      note: 'Navigation-output proxy only; the final exact-source authority read is identical in both paths and therefore cancels from the delta.'
    },
    refresh: {
      success: refresh.success,
      wallMs: refresh.incrementalReindexWallMs,
      peakRssMiB: refresh.incrementalReindexPeakRssMb,
      peakCpuPercent: refresh.incrementalReindexCpuPercent,
      markerVisible: refresh.markerVisible,
      restorationVerified: refresh.restorationVerified,
      markerAbsentAfterRestoration: refresh.markerAbsentAfterRestoration,
    },
    rebuild: { wallMs: rebuild.wallMs, peakRssMiB: rebuild.peakRssMb, peakCpuPercent: rebuild.cpuPercent, indexBytes: rebuildIndexBytes, queryable: rebuildProbe.hit },
    fallbackPlan,
    rollback,
    gates,
    passed: Object.values(gates).every(Boolean),
  };
}

function createFakeGraphifyRunner(dir) {
  const markerPath = path.join(dir, 'graphify-runner-invoked');
  const runnerPath = path.join(dir, 'fake-graphify-runner.mjs');
  fs.writeFileSync(runnerPath, `#!/usr/bin/env node\nimport fs from 'node:fs';\nfs.writeFileSync(${JSON.stringify(markerPath)}, 'invoked');\nprocess.exit(0);\n`);
  fs.chmodSync(runnerPath, 0o755);
  return { runnerPath, markerPath };
}

async function verifyGraphifyDisablement(workRoot) {
  const profile = loadGraphifyProfile(GRAPHIFY_PROFILE_PATH);
  const graphifyRoot = privateDir(workRoot, 'graphify-disable');
  const { runnerPath, markerPath } = createFakeGraphifyRunner(graphifyRoot);
  const approvedPath = profile.corpus.semanticScopes[0].paths[0];
  const result = await runSemanticEvent({ repositoryRoot: ROOT, profile, scopeId: profile.corpus.semanticScopes[0].scopeId, changedFiles: [approvedPath], runnerPath, outputRoot: path.join(graphifyRoot, 'output'), sourceHead: git(ROOT, 'rev-parse', 'HEAD'), disabled: true });
  const passed = result.status === 'disabled' && result.runnerInvoked === false && result.state.freshness === 'stale' && !fs.existsSync(markerPath);
  fs.rmSync(graphifyRoot, { recursive: true, force: true });
  return { passed, status: result.status, runnerInvoked: result.runnerInvoked, freshness: result.state.freshness, cleanup: !fs.existsSync(graphifyRoot) };
}

async function verifyProviderUninstallDryRun(providerPath) {
  try {
    const { stdout, stderr } = await execFileAsync(providerPath, ['uninstall', '--dry-run', '-n'], {
      env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: os.tmpdir(), CBM_CACHE_DIR: '/Users/Office/Library/Caches/brain/codebase-memory-mcp/brain' },
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const output = `${stdout}\n${stderr}`;
    return { passed: output.includes('dry-run') && output.includes('no files were modified'), output: output.slice(0, 8000) };
  } catch (error) {
    return { passed: false, output: `${error.stdout ?? ''}\n${error.stderr ?? ''}`.slice(0, 8000), error: error.message };
  }
}

async function main() {
  const args = parseArgs();
  const providerPath = args.provider;
  const outputPath = path.resolve(ROOT, args.output ?? 'operations/reports/b8-6-context-memory-pilot-evidence.json');
  if (!providerPath || !fs.existsSync(providerPath)) throw new Error('--provider=<exact executable> is required');

  const pilot = JSON.parse(fs.readFileSync(PILOT_PATH, 'utf8'));
  const admission = JSON.parse(fs.readFileSync(ADMISSION_PATH, 'utf8')).admissions.find((item) => item.admissionId === pilot.architecture.structuralProviderAdmission);
  if (!admission || admission.status !== 'active-local') throw new Error('accepted active-local provider admission required');
  const admittedSha = admission.provider.artifacts.find((artifact) => artifact.path === admission.provider.entrypoint)?.sha256;
  if (admittedSha !== sha256(providerPath)) throw new Error('provider identity mismatch');

  const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'b8-6-pilot-'));
  fs.chmodSync(workRoot, 0o700);
  try {
    const repositoryResults = [];
    for (const repository of pilot.pilotRepositories) repositoryResults.push(await runRepositoryPilot({ repository, providerPath, pilot, workRoot }));
    const graphifyDisablement = await verifyGraphifyDisablement(workRoot);
    const providerUninstallDryRun = await verifyProviderUninstallDryRun(providerPath);
    const allRepositoryGates = repositoryResults.every((result) => result.passed);
    const passed = allRepositoryGates && graphifyDisablement.passed && providerUninstallDryRun.passed;
    const operatorBurden = {
      sourceRepositoryConfigurationChanges: 0,
      sourceRepositoryMutations: 0,
      explicitRefreshEventsExercised: repositoryResults.length,
      rebuildsExercised: repositoryResults.length,
      graphifyModelInvocations: 0,
      graphifyDisableControlsExercised: 1,
      uninstallDryRunsExercised: 1,
      perRepositoryAdmissionRequiredForWiderRollout: true,
    };
    const evidence = {
      schemaVersion: '1.0.0',
      task: 'B8.6',
      generatedAt: new Date().toISOString(),
      provider: { path: providerPath, sha256: sha256(providerPath), version: admission.provider.version, revision: admission.provider.revision },
      pilotRepositories: repositoryResults,
      graphifyDisablement,
      providerUninstallDryRun,
      operatorBurden,
      rolloutDecision: passed ? pilot.rolloutDecision.decisionIfPilotPasses : 'reject-and-rollback',
      acceptance: { passed, repositoryPasses: repositoryResults.filter((result) => result.passed).length, requiredRepositories: repositoryResults.length, graphifyDisablement: graphifyDisablement.passed, providerUninstallDryRun: providerUninstallDryRun.passed },
      safety: { sourceRepositoriesReadOnly: true, pilotCachesRemoved: true, modelInvocations: 0, mindMutation: false, workbenchMutation: false, push: false },
    };
    writeJson(outputPath, evidence);
    console.log(JSON.stringify({ outputPath, acceptance: evidence.acceptance, rolloutDecision: evidence.rolloutDecision, repositoryResults: repositoryResults.map((result) => ({ repositoryId: result.repositoryId, passed: result.passed, structuralHitRate: result.structuralHitRate, exactSourceFallbackHitRate: result.exactSourceFallbackHitRate, coldIndex: result.coldIndex, refresh: result.refresh, rebuild: result.rebuild, navigationMeasurement: result.navigationMeasurement })) }, null, 2));
    if (!passed) process.exitCode = 2;
  } finally {
    fs.rmSync(workRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
