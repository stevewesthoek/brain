#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDisposableRepositoryCopy, loadFreshnessContract, runExplicitRefresh } from './lib/b8-3-context-memory-freshness.mjs';
import { runIncrementalReindex } from './lib/b8-1-cbm-incremental-reindex.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT_PATH = path.join(ROOT, 'operations/specs/b8-3-context-memory-freshness.json');
const ADMISSION_PATH = path.join(ROOT, 'operations/specs/mcp-provider-admissions.json');

function parseArgs() {
  return Object.fromEntries(process.argv.slice(2).map((arg) => {
    const index = arg.indexOf('=');
    return index < 0 ? [arg.replace(/^--/, ''), true] : [arg.slice(2, index), arg.slice(index + 1)];
  }));
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function percentile(values, fraction) {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)];
}

function summary(values) {
  return { min: Math.min(...values), median: percentile(values, 0.5), p95: percentile(values, 0.95), max: Math.max(...values) };
}

function makePrivateDir(parent, name) {
  const dir = path.join(parent, name);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.chmodSync(dir, 0o700);
  return dir;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function main() {
  const args = parseArgs();
  const providerPath = args.provider;
  const outputPath = path.resolve(ROOT, args.output ?? 'operations/reports/b8-3-context-memory-acceptance.json');
  const repetitions = Number(args.repetitions ?? 5);
  if (!providerPath || !fs.existsSync(providerPath)) throw new Error('--provider=<exact executable> is required');
  if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10) throw new Error('repetitions must be 1..10');

  const contract = loadFreshnessContract(CONTRACT_PATH);
  const admissionRegistry = JSON.parse(fs.readFileSync(ADMISSION_PATH, 'utf8'));
  const admission = admissionRegistry.admissions.find((item) => item.admissionId === contract.providerAdmissionId);
  if (!admission || admission.status !== 'active-local') throw new Error('B8.2 provider admission is not active-local');
  const expectedProviderSha = admission.provider.artifacts.find((artifact) => artifact.path === admission.provider.entrypoint)?.sha256;
  const actualProviderSha = sha256(providerPath);
  if (!expectedProviderSha || expectedProviderSha !== actualProviderSha) throw new Error('provider SHA does not match admitted binary');

  const inventory = contract.repositoryInventory[0];
  const policy = contract.freshnessPolicy;
  const headroom = 1 - policy.requiredHeadroomRatio;
  const limits = {
    changedSourceToQueryableMs: policy.nominalMaximumChangedSourceToQueryableMs * headroom,
    refreshPeakRssMiB: policy.nominalMaximumRefreshPeakRssMiB * headroom,
    refreshPeakCpuPercent: policy.nominalMaximumRefreshPeakCpuPercent * headroom,
    indexBytes: policy.nominalMaximumIndexBytes * headroom,
  };

  const baseline = await runExplicitRefresh({
    providerPath,
    repositoryPath: ROOT,
    projectName: inventory.projectName,
    cacheDir: inventory.cacheDir,
    contract,
    timeoutMs: 120000,
  });
  if (baseline.failed) throw new Error(`Brain baseline refresh failed: ${baseline.error}`);

  const results = [];
  for (let repetition = 1; repetition <= repetitions; repetition += 1) {
    const disposable = createDisposableRepositoryCopy(ROOT, `b8-3-r${repetition}-`);
    const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), `b8-3-runtime-r${repetition}-`));
    try {
      fs.chmodSync(runRoot, 0o700);
      const cacheDir = makePrivateDir(runRoot, 'cache');
      const configDir = makePrivateDir(runRoot, 'config');
      const homeDir = makePrivateDir(runRoot, 'home');
      const projectName = `brain-b8-3-r${repetition}`;
      const result = await runIncrementalReindex({
        cbmExecutable: providerPath,
        disposableRepositoryPath: disposable.repositoryPath,
        repoId: `brain-b8-3-r${repetition}`,
        projectName,
        refreshProbeTarget: inventory.refreshProbeTarget,
        cacheDir,
        configDir,
        env: {
          HOME: homeDir,
          PATH: process.env.PATH,
          TMPDIR: os.tmpdir(),
          XDG_CACHE_HOME: cacheDir,
          XDG_CONFIG_HOME: configDir,
        },
        timeout: 120000,
        indexMode: 'full',
      });
      const gates = {
        lifecycle: result.success === true && result.markerVisible === true && result.restorationVerified === true && result.markerAbsentAfterRestoration === true,
        latency: Number.isFinite(result.incrementalReindexWallMs) && result.incrementalReindexWallMs <= limits.changedSourceToQueryableMs,
        refreshRss: Number.isFinite(result.incrementalReindexPeakRssMb) && result.incrementalReindexPeakRssMb <= limits.refreshPeakRssMiB,
        refreshCpu: Number.isFinite(result.incrementalReindexCpuPercent) && result.incrementalReindexCpuPercent <= limits.refreshPeakCpuPercent,
        indexBytes: Number.isFinite(result.cacheBytes) && result.cacheBytes <= limits.indexBytes,
      };
      results.push({ repetition, result, gates, passed: Object.values(gates).every(Boolean) });
    } finally {
      fs.rmSync(disposable.root, { recursive: true, force: true });
      fs.rmSync(runRoot, { recursive: true, force: true });
    }
  }

  const passingRuns = results.filter((item) => item.passed).length;
  const acceptance = {
    requiredPassingRuns: Math.min(policy.requiredPassingRuns, repetitions),
    passingRuns,
    passed: passingRuns === Math.min(policy.requiredPassingRuns, repetitions),
    limits,
    summaries: {
      refreshWallMs: summary(results.map((item) => item.result.incrementalReindexWallMs)),
      refreshPeakRssMiB: summary(results.map((item) => item.result.incrementalReindexPeakRssMb)),
      refreshPeakCpuPercent: summary(results.map((item) => item.result.incrementalReindexCpuPercent)),
      indexBytes: summary(results.map((item) => item.result.cacheBytes)),
    },
  };

  const evidence = {
    schemaVersion: '1.0.0',
    task: 'B8.3',
    generatedAt: new Date().toISOString(),
    provider: { path: providerPath, sha256: actualProviderSha, version: admission.provider.version, revision: admission.provider.revision },
    inventory,
    baseline: { refreshed: baseline.refreshed, skippedUnchanged: baseline.skippedUnchanged, durationMs: baseline.durationMs, state: baseline.state },
    repetitions: results,
    acceptance,
  };
  writeJson(outputPath, evidence);
  console.log(JSON.stringify({ outputPath, acceptance }, null, 2));
  if (!acceptance.passed) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
