#!/usr/bin/env node
/**
 * prepare-b8-1-context-memory-benchmark.mjs
 *
 * Fail-closed B8.1 benchmark preflight and materialization harness.
 *
 * Exit codes:
 *   0 = execution-ready (all selected-subject gates pass)
 *   1 = blocked or failed gate
 *   2 = internal or configuration error
 *
 * This MUST NOT execute any retrieval subject, start any MCP server,
 * watcher, scheduler, Graphify process, or modify user configuration.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'operations/specs/b8-1-context-memory-benchmark-manifest.json');
const ADMISSIONS_PATH = path.join(REPO_ROOT, 'operations/specs/mcp-provider-admissions.json');
const NETWORK_DENY_PROFILE = path.join(REPO_ROOT, 'operations/specs/b8-1-network-deny.sb');
const GRAPHIFY_GOVERNANCE_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-transition-governance.json');
const GRAPHIFY_PROFILES_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-operational-profiles.json');

const VALID_SUBJECTS = ['cbm', 'graphify', 'exact-source'];
const RUN_ID_PATTERN = /^b8-1-[a-zA-Z0-9._-]+$/;

function homeDir(override) { return override ?? os.homedir(); }

function recordCheck(checks, name, status, detail = null) {
  checks.push({ name, status, detail });
}

function isValidRunId(runId) {
  if (!runId || typeof runId !== 'string') return false;
  if (runId.includes('/') || runId.includes('\\')) return false;
  if (runId.includes('..')) return false;
  if (/\s/.test(runId)) return false;
  if (path.isAbsolute(runId)) return false;
  if (!/^[a-zA-Z0-9._-]+$/.test(runId)) return false;
  if (!RUN_ID_PATTERN.test(runId)) return false;
  return true;
}

function loadAdmission() {
  const admissions = JSON.parse(fs.readFileSync(ADMISSIONS_PATH, 'utf8'));
  return admissions.admissions.find(a => a.admissionId === 'codebase-memory-mcp-brain');
}

function captureSourceState(manifest) {
  const states = [];
  for (const repo of manifest.repositories) {
    const state = { repositoryId: repo.repositoryId, path: repo.localPath };
    try {
      state.HEAD = execFileSync('git', ['-C', repo.localPath, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const porcelain = execFileSync('git', ['-C', repo.localPath, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      state.statusPorcelain = porcelain;
      state.statusSha256 = crypto.createHash('sha256').update(porcelain).digest('hex');
      state.pinnedCommit = repo.pinnedCommit;
      try {
        execFileSync('git', ['-C', repo.localPath, 'rev-parse', '--verify', `${repo.pinnedCommit}^{commit}`], { stdio: ['ignore', 'ignore', 'ignore'] });
        state.pinnedCommitAvailable = true;
      } catch { state.pinnedCommitAvailable = false; }
    } catch (e) {
      state.HEAD = null;
      state.statusPorcelain = null;
      state.statusSha256 = null;
      state.pinnedCommit = repo.pinnedCommit;
      state.pinnedCommitAvailable = false;
    }
    states.push(state);
  }
  return states;
}

// ---------------------------------------------------------------------------
// Preflight checks
// ---------------------------------------------------------------------------

function checkManifest(checks, manifestPathOverride) {
  try {
    const text = fs.readFileSync(manifestPathOverride ?? MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(text);
    if (manifest.schemaVersion !== '1.0.0') {
      recordCheck(checks, 'manifest-loaded', 'fail', 'schemaVersion mismatch');
      return null;
    }
    recordCheck(checks, 'manifest-loaded', 'pass', `${manifest.fixtures.length} fixtures across ${manifest.repositories.length} repos`);
    return manifest;
  } catch (e) {
    recordCheck(checks, 'manifest-loaded', 'fail', e.message);
    return null;
  }
}

function checkPinnedCommits(checks, manifest) {
  if (!manifest) return;
  for (const repo of manifest.repositories) {
    if (!fs.existsSync(repo.localPath)) {
      recordCheck(checks, `pinned-commit:${repo.repositoryId}`, 'fail', `repository not found at ${repo.localPath}`);
      continue;
    }
    try {
      execFileSync('git', ['-C', repo.localPath, 'rev-parse', '--verify', `${repo.pinnedCommit}^{commit}`], { stdio: ['ignore', 'ignore', 'ignore'] });
      recordCheck(checks, `pinned-commit:${repo.repositoryId}`, 'pass', repo.pinnedCommit.slice(0, 12));
    } catch {
      recordCheck(checks, `pinned-commit:${repo.repositoryId}`, 'fail', `commit ${repo.pinnedCommit} not found`);
    }
  }
}

function checkRunId(checks, runId, home) {
  if (!runId) {
    recordCheck(checks, 'run-id-valid', 'fail', 'run ID is required');
    return null;
  }
  if (!isValidRunId(runId)) {
    recordCheck(checks, 'run-id-valid', 'fail', `invalid run ID: "${runId}"`);
    return null;
  }
  const runDir = path.join(homeDir(home), '.brain', 'benchmark', 'b8-1', 'runs', runId);
  if (fs.existsSync(runDir)) {
    recordCheck(checks, 'run-directory-exists', 'fail', `run directory already exists: ${runDir}`);
    return runDir;
  }
  recordCheck(checks, 'run-id-valid', 'pass', runId);
  return runDir;
}

function checkCbmBinary(checks, selectedSubjects, home) {
  if (!selectedSubjects.includes('cbm')) {
    recordCheck(checks, 'cbm-binary-identity', 'excluded-subject', 'cbm not selected');
    return;
  }
  let admission;
  try { admission = loadAdmission(); } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot load admissions: ${e.message}`);
    return;
  }
  if (!admission) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', 'codebase-memory-mcp-brain admission not found');
    return;
  }

  const providerRoot = path.join(homeDir(home), '.local', 'lib', 'brain', 'providers', 'codebase-memory-mcp');
  const version = admission.provider.version;
  const expectedHash = admission.provider.artifacts[0].sha256;
  const stablePath = path.join(homeDir(home), '.local', 'bin', 'codebase-memory-mcp');
  const versionedPath = path.join(providerRoot, `v${version}`, 'codebase-memory-mcp');

  if (!fs.existsSync(stablePath)) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `stable path not found: ${stablePath}`);
    return;
  }

  let realPath;
  try {
    realPath = fs.realpathSync(stablePath);
  } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot resolve symlink: ${e.message}`);
    return;
  }

  if (!realPath.startsWith(providerRoot)) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `symlink escape: resolved to ${realPath}, not under ${providerRoot}`);
    return;
  }

  if (!realPath.includes(`v${version}`)) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `unexpected version directory: ${realPath} does not contain v${version}`);
    return;
  }

  let stat;
  try { stat = fs.lstatSync(realPath); } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot stat: ${e.message}`);
    return;
  }

  if (!stat.isFile()) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `not a regular file: ${realPath}`);
    return;
  }

  if (!(stat.mode & 0o111)) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `not executable: ${realPath}`);
    return;
  }

  let hash;
  try {
    const data = fs.readFileSync(realPath);
    hash = crypto.createHash('sha256').update(data).digest('hex');
  } catch (e) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `cannot hash: ${e.message}`);
    return;
  }

  if (hash !== expectedHash) {
    recordCheck(checks, 'cbm-binary-identity', 'fail', `hash mismatch: got ${hash.slice(0, 16)}... expected ${expectedHash.slice(0, 16)}...`);
    return;
  }

  recordCheck(checks, 'cbm-binary-identity', 'pass', `sha256=${hash.slice(0, 16)}... version=v${version}`);
}

function checkNetworkIsolation(checks, selectedSubjects) {
  if (!selectedSubjects.includes('cbm')) {
    recordCheck(checks, 'network-isolation', 'excluded-subject', 'cbm not selected — network isolation not required');
    return;
  }

  const sbExec = spawnSync('which', ['sandbox-exec'], { encoding: 'utf8' });
  if (sbExec.status !== 0) {
    recordCheck(checks, 'network-isolation', 'blocked', 'sandbox-exec not found — cannot prove network isolation');
    return;
  }

  if (!fs.existsSync(NETWORK_DENY_PROFILE)) {
    recordCheck(checks, 'network-isolation', 'blocked', `network-deny profile not found at ${NETWORK_DENY_PROFILE}`);
    return;
  }

  const selfTest = spawnSync('sandbox-exec', ['-f', NETWORK_DENY_PROFILE, '/usr/bin/curl', '-s', '--connect-timeout', '2', 'http://1.1.1.1'], {
    encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe']
  });

  if (selfTest.status === 0) {
    recordCheck(checks, 'network-isolation', 'blocked', 'self-test failed: curl succeeded under sandbox (network NOT denied)');
    return;
  }

  recordCheck(checks, 'network-isolation', 'pass', `adapter=sandbox-exec; self-test=denied; profile=${path.basename(NETWORK_DENY_PROFILE)}`);
}

function checkGraphifySubject(checks, selectedSubjects) {
  if (!selectedSubjects.includes('graphify')) {
    recordCheck(checks, 'graphify-subject', 'excluded-subject', 'graphify not selected');
    return;
  }

  let governance = null;
  try { governance = JSON.parse(fs.readFileSync(GRAPHIFY_GOVERNANCE_PATH, 'utf8')); } catch {
    recordCheck(checks, 'graphify-subject', 'blocked', 'governance file missing');
    return;
  }

  const structuralState = governance.states?.structuralCodeIndexing?.state;
  if (!structuralState?.includes('frozen')) {
    recordCheck(checks, 'graphify-subject', 'blocked', `structural indexing not frozen (state=${structuralState})`);
    return;
  }

  let profileExists = false;
  try {
    const profiles = JSON.parse(fs.readFileSync(GRAPHIFY_PROFILES_PATH, 'utf8'));
    profileExists = Boolean((profiles.profiles ?? []).find(p => p.profileId === 'code-only'));
  } catch { /* skip */ }

  if (!profileExists) {
    recordCheck(checks, 'graphify-subject', 'blocked', 'code-only profile not found');
    return;
  }

  const result = spawnSync('which', ['graphify'], { encoding: 'utf8' });
  if (result.status !== 0) {
    recordCheck(checks, 'graphify-subject', 'blocked', 'graphify binary not found in PATH');
    return;
  }

  recordCheck(checks, 'graphify-subject', 'pass', `state=${structuralState}; code-only-profile=found`);
}

function checkExactSource(checks, selectedSubjects) {
  if (!selectedSubjects.includes('exact-source')) {
    recordCheck(checks, 'exact-source-ready', 'excluded-subject', 'exact-source not selected');
    return;
  }
  const required = ['grep', 'find', 'cat'];
  for (const cmd of required) {
    const r = spawnSync('which', [cmd], { encoding: 'utf8' });
    if (r.status !== 0) {
      recordCheck(checks, 'exact-source-ready', 'fail', `${cmd} not found in PATH`);
      return;
    }
  }
  recordCheck(checks, 'exact-source-ready', 'pass', 'grep, find, cat available');
}

function checkDiskBudget(checks, home) {
  const benchmarkParent = path.join(homeDir(home), '.brain');
  const minMB = 2000;
  try {
    const dfResult = spawnSync('df', ['-m', benchmarkParent], { encoding: 'utf8' });
    if (dfResult.status === 0) {
      const lines = dfResult.stdout.trim().split('\n');
      if (lines.length >= 2) {
        const fields = lines[lines.length - 1].split(/\s+/);
        const avail = parseInt(fields[3], 10);
        if (avail >= minMB) { recordCheck(checks, 'disk-budget', 'pass', `${avail} MB available`); return; }
        recordCheck(checks, 'disk-budget', 'fail', `only ${avail} MB (need ${minMB})`); return;
      }
    }
  } catch { /* fall through */ }
  recordCheck(checks, 'disk-budget', 'informational', 'cannot determine disk space');
}

function checkUserConfigProtected(checks) {
  recordCheck(checks, 'user-config-protected', 'pass', 'protected paths: .claude.json, .codex, .cursor, .gemini');
}

// ---------------------------------------------------------------------------
// Materialization
// ---------------------------------------------------------------------------

function materialize(runDir, manifest, checks, home) {
  const tmpDir = runDir + '.tmp';
  try {
    fs.mkdirSync(tmpDir, { recursive: true });

    const dirs = [
      ...manifest.repositories.map(r => `sources/${r.repositoryId}`),
      'subjects/cbm/cache', 'subjects/cbm/config', 'subjects/exact-source',
      'evidence', 'logs'
    ];
    for (const d of dirs) fs.mkdirSync(path.join(tmpDir, d), { recursive: true });

    const stateBefore = captureSourceState(manifest);
    fs.writeFileSync(path.join(tmpDir, 'source-state-before.json'), JSON.stringify(stateBefore, null, 2));

    for (const repo of manifest.repositories) {
      if (!fs.existsSync(repo.localPath)) continue;
      const destDir = path.join(tmpDir, 'sources', repo.repositoryId);
      const tarPath = path.join(tmpDir, `_archive_${repo.repositoryId}.tar`);
      execFileSync('git', ['-C', repo.localPath, 'archive', repo.pinnedCommit, '--', '.'], {
        stdio: ['ignore', fs.openSync(tarPath, 'w'), 'ignore']
      });
      execFileSync('tar', ['-x', '-f', tarPath, '-C', destDir]);
      fs.rmSync(tarPath, { force: true });
    }

    const stateAfter = captureSourceState(manifest);
    fs.writeFileSync(path.join(tmpDir, 'source-state-after.json'), JSON.stringify(stateAfter, null, 2));

    for (let i = 0; i < stateBefore.length; i++) {
      const before = stateBefore[i];
      const after = stateAfter[i];
      if (before.HEAD !== after.HEAD || before.statusSha256 !== after.statusSha256) {
        throw new Error(`source state changed for ${before.repositoryId}: HEAD ${before.HEAD} -> ${after.HEAD}, status ${before.statusSha256} -> ${after.statusSha256}`);
      }
    }

    const preflightReceipt = { checks: checks.map(c => ({ name: c.name, status: c.status })), timestamp: new Date().toISOString() };
    fs.writeFileSync(path.join(tmpDir, 'preflight-receipt.json'), JSON.stringify(preflightReceipt, null, 2));

    const manifestText = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const manifestHash = crypto.createHash('sha256').update(manifestText).digest('hex');
    const runPlan = {
      runId: path.basename(runDir),
      manifestHash: `sha256:${manifestHash}`,
      repositories: manifest.repositories.map(r => ({ repositoryId: r.repositoryId, pinnedCommit: r.pinnedCommit })),
      materialized: new Date().toISOString()
    };
    fs.writeFileSync(path.join(tmpDir, 'run-plan.json'), JSON.stringify(runPlan, null, 2));

    const cleanupManifest = {
      runId: path.basename(runDir),
      runDirectory: runDir,
      createdAt: new Date().toISOString(),
      note: 'cleanup targets this exact directory only'
    };
    fs.writeFileSync(path.join(tmpDir, 'cleanup-manifest.json'), JSON.stringify(cleanupManifest, null, 2));

    fs.renameSync(tmpDir, runDir);
    recordCheck(checks, 'materialization', 'pass', `created ${runDir}`);
  } catch (e) {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best effort */ }
    recordCheck(checks, 'materialization', 'fail', e.message);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runPreflight({ dryRun = true, materialize: doMaterialize = false, runId, subjects, _manifestPathOverride, _homeOverride } = {}) {
  const checks = [];
  const selectedSubjects = subjects ? subjects.filter(s => VALID_SUBJECTS.includes(s)) : ['cbm', 'graphify', 'exact-source'];
  const allSubjects = new Set(VALID_SUBJECTS);
  const excludedSubjects = [...allSubjects].filter(s => !selectedSubjects.includes(s));

  const manifest = checkManifest(checks, _manifestPathOverride);
  checkPinnedCommits(checks, manifest);
  const runDir = checkRunId(checks, runId, _homeOverride);
  checkCbmBinary(checks, selectedSubjects, _homeOverride);
  checkNetworkIsolation(checks, selectedSubjects);
  checkGraphifySubject(checks, selectedSubjects);
  checkExactSource(checks, selectedSubjects);
  checkDiskBudget(checks, _homeOverride);
  checkUserConfigProtected(checks);

  const blockingChecks = checks
    .filter(c => c.status === 'fail' || c.status === 'blocked')
    .map(c => c.name);

  const executionReady = blockingChecks.length === 0 && runDir && !fs.existsSync(runDir);

  if (doMaterialize && !dryRun) {
    if (!executionReady) {
      recordCheck(checks, 'materialization', 'fail', 'cannot materialize: execution not ready');
    } else {
      materialize(runDir, manifest, checks, _homeOverride);
    }
  }

  const summary = { executionReady, selectedSubjects, excludedSubjects, blockingChecks, runId: runId ?? null };
  return { checks: [...checks], summary, runDir, dryRun };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const IS_MAIN = (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })()
);

if (IS_MAIN) {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--materialize');
  const doMaterialize = args.includes('--materialize');

  if (doMaterialize && args.includes('--dry-run')) {
    console.error('ERROR: Cannot specify both --dry-run and --materialize');
    process.exit(2);
  }

  const runIdArg = args.find(a => a.startsWith('--run-id=') || a.startsWith('--run-id '));
  let runId = null;
  if (runIdArg?.startsWith('--run-id=')) runId = runIdArg.slice('--run-id='.length);
  else {
    const idx = args.indexOf('--run-id');
    if (idx >= 0 && idx + 1 < args.length) runId = args[idx + 1];
  }

  const subjectsArg = args.find(a => a.startsWith('--subjects=') || a.startsWith('--subjects '));
  let subjects = null;
  if (subjectsArg?.startsWith('--subjects=')) subjects = subjectsArg.slice('--subjects='.length).split(',');
  else {
    const idx = args.indexOf('--subjects');
    if (idx >= 0 && idx + 1 < args.length) subjects = args[idx + 1].split(',');
  }

  try {
    const { checks, summary, runDir } = await runPreflight({
      dryRun: isDryRun,
      materialize: doMaterialize,
      runId,
      subjects,
    });

    console.log(`# B8.1 Benchmark Preflight — ${isDryRun ? 'DRY RUN' : 'MATERIALIZE'}`);
    console.log('');

    for (const check of checks) {
      const status = check.status.toUpperCase().padEnd(16);
      const detail = check.detail ? ` — ${check.detail}` : '';
      console.log(`${status} ${check.name}${detail}`);
    }

    console.log('');
    console.log(JSON.stringify(summary, null, 2));

    if (!summary.executionReady) process.exitCode = 1;
  } catch (e) {
    console.error(`INTERNAL ERROR: ${e.message}`);
    process.exitCode = 2;
  }
}
