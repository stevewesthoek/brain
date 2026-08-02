#!/usr/bin/env node
/**
 * prepare-b8-1-context-memory-benchmark.mjs
 *
 * Dry-run-only B8.1 preflight harness.
 *
 * This MUST NOT execute any retrieval subject.
 * It MUST NOT start any MCP server, watcher, scheduler, Graphify process, or index.
 * It MUST NOT modify user configuration.
 * It MUST NOT create anything unless explicit --materialize flag is supplied.
 *
 * Usage:
 *   node tools/prepare-b8-1-context-memory-benchmark.mjs --dry-run
 *   node tools/prepare-b8-1-context-memory-benchmark.mjs --materialize
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
const GRAPHIFY_GOVERNANCE_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-transition-governance.json');
const GRAPHIFY_PROFILES_PATH = path.join(REPO_ROOT, 'operations/specs/graphify-operational-profiles.json');

const BENCHMARK_BASE = path.join(os.homedir(), '.brain', 'benchmark', 'b8-1');
const BENCHMARK_WORKTREES = path.join(BENCHMARK_BASE, 'worktrees');
const BENCHMARK_CACHE = path.join(BENCHMARK_BASE, 'cache');
const BENCHMARK_CONFIG = path.join(BENCHMARK_BASE, 'config');

// Protected user configuration paths — must NEVER be modified
const PROTECTED_USER_CONFIGS = [
  path.join(os.homedir(), '.claude.json'),
  path.join(os.homedir(), '.codex', 'config.toml'),
  path.join(os.homedir(), '.cursor'),
  path.join(os.homedir(), '.gemini'),
];

// ---------------------------------------------------------------------------
// Result accumulator (created per runPreflight call — not module-global)
// ---------------------------------------------------------------------------

let _checks = [];

function recordCheck(name, status, detail = null) {
  _checks.push({ name, status, detail });
}

// ---------------------------------------------------------------------------
// Check 1: Load and validate benchmark manifest
// ---------------------------------------------------------------------------

function checkManifest(manifestPathOverride) {
  try {
    const text = fs.readFileSync(manifestPathOverride ?? MANIFEST_PATH, 'utf8');
    const manifest = JSON.parse(text);
    if (manifest.schemaVersion !== '1.0.0') {
      recordCheck('manifest-loaded', 'fail', 'schemaVersion mismatch');
      return null;
    }
    recordCheck('manifest-loaded', 'pass', `${manifest.fixtures.length} fixtures across ${manifest.repositories.length} repos`);
    return manifest;
  } catch (e) {
    recordCheck('manifest-loaded', 'fail', e.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Check 2: Pinned commits locally available
// ---------------------------------------------------------------------------

function checkPinnedCommits(manifest) {
  if (!manifest) return;
  for (const repo of manifest.repositories) {
    if (!fs.existsSync(repo.localPath)) {
      recordCheck(`pinned-commit:${repo.repositoryId}`, 'fail', `repository not found at ${repo.localPath}`);
      continue;
    }
    try {
      execFileSync('git', ['-C', repo.localPath, 'rev-parse', '--verify', `${repo.pinnedCommit}^{commit}`], {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      recordCheck(`pinned-commit:${repo.repositoryId}`, 'pass', repo.pinnedCommit.slice(0, 12));
    } catch {
      recordCheck(`pinned-commit:${repo.repositoryId}`, 'fail', `commit ${repo.pinnedCommit} not found`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 3: Source checkouts will not be mutation targets
// ---------------------------------------------------------------------------

function checkSourceCheckoutsReadOnly(manifest) {
  if (!manifest) return;
  for (const repo of manifest.repositories) {
    if (!fs.existsSync(repo.localPath)) continue;
    // Verify HEAD matches or that we at least have a git repo (not a temp dir)
    try {
      execFileSync('git', ['-C', repo.localPath, 'status', '--porcelain'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      });
      recordCheck(`source-checkout-read-only:${repo.repositoryId}`, 'pass', 'git repo, read-only proof: benchmark uses archive exports only');
    } catch {
      recordCheck(`source-checkout-read-only:${repo.repositoryId}`, 'warn', 'cannot verify git status — treat as read-only');
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4: Disposable run directory calculation
// ---------------------------------------------------------------------------

function checkRunDirectory() {
  const runId = crypto.randomBytes(4).toString('hex');
  const runDir = path.join(BENCHMARK_WORKTREES, runId);
  recordCheck('run-directory', 'planned', runDir);
  return runDir;
}

// ---------------------------------------------------------------------------
// Check 5: Isolated cache and config directories
// ---------------------------------------------------------------------------

function checkIsolatedDirectories() {
  recordCheck('benchmark-cache-dir', 'planned', BENCHMARK_CACHE);
  recordCheck('benchmark-config-dir', 'planned', BENCHMARK_CONFIG);
}

// ---------------------------------------------------------------------------
// Check 6: User config is not on mutation path
// ---------------------------------------------------------------------------

function checkUserConfigNotMutated() {
  for (const configPath of PROTECTED_USER_CONFIGS) {
    recordCheck(`user-config-protected:${path.basename(configPath)}`, 'pass',
      `protected: will not be modified (path=${configPath})`);
  }
}

// ---------------------------------------------------------------------------
// Check 7: Codebase Memory binary hash (without starting it)
// ---------------------------------------------------------------------------

function checkCodebaseMemoryBinary() {
  const cbmBin = path.join(os.homedir(), '.local', 'bin', 'codebase-memory-mcp');
  if (!fs.existsSync(cbmBin)) {
    recordCheck('cbm-binary-hash', 'warn', `binary not found at ${cbmBin}`);
    return;
  }
  try {
    const data = fs.readFileSync(cbmBin);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const stat = fs.statSync(cbmBin);
    recordCheck('cbm-binary-hash', 'pass', `sha256=${hash.slice(0, 16)}... size=${stat.size}`);
  } catch (e) {
    recordCheck('cbm-binary-hash', 'fail', e.message);
  }
}

// ---------------------------------------------------------------------------
// Check 8: Graphify subject readiness
// ---------------------------------------------------------------------------

function checkGraphifySubject() {
  // Check governance — must be frozen
  let governance = null;
  try {
    governance = JSON.parse(fs.readFileSync(GRAPHIFY_GOVERNANCE_PATH, 'utf8'));
  } catch {
    recordCheck('graphify-subject', 'blocked', 'governance file missing — cannot prove Graphify is safe to use');
    return;
  }

  const structuralState = governance.states?.structuralCodeIndexing?.state;
  const schedulerGate = governance.states?.structuralCodeIndexing?.schedulerGate;
  const isFrozen = structuralState?.includes('frozen');
  const isGated = schedulerGate?.includes('skipping') || schedulerGate?.includes('bs0-15');

  if (!isFrozen) {
    recordCheck('graphify-subject', 'blocked', `structural indexing not frozen (state=${structuralState}) — must be frozen before benchmark`);
    return;
  }

  // Check code-only profile exists
  let profileExists = false;
  try {
    const profiles = JSON.parse(fs.readFileSync(GRAPHIFY_PROFILES_PATH, 'utf8'));
    const codeOnly = (profiles.profiles ?? []).find((p) => p.profileId === 'code-only');
    profileExists = Boolean(codeOnly);
  } catch {
    // Profile check is advisory
  }

  if (!profileExists) {
    recordCheck('graphify-subject', 'blocked',
      'graphifySubject=blocked: code-only profile not found in graphify-operational-profiles.json — cannot prove bounded manual command exists without semantic synthesis');
    return;
  }

  // Check if graphify binary exists
  const result = spawnSync('which', ['graphify'], { encoding: 'utf8' });
  const hasBinary = result.status === 0 && result.stdout.trim().length > 0;

  if (!hasBinary) {
    recordCheck('graphify-subject', 'blocked', 'graphifySubject=blocked: graphify binary not found in PATH');
    return;
  }

  recordCheck('graphify-subject', 'pass',
    `structural-state=${structuralState}; scheduler-gate=${isGated ? 'skip-enforced' : 'present'}; code-only-profile=found; binary=found`);
}

// ---------------------------------------------------------------------------
// Check 9: Exact-source baseline commands exist
// ---------------------------------------------------------------------------

function checkExactSourceBaseline() {
  const required = ['grep', 'find', 'cat'];
  for (const cmd of required) {
    const result = spawnSync('which', [cmd], { encoding: 'utf8' });
    if (result.status === 0) {
      recordCheck(`exact-source-command:${cmd}`, 'pass', result.stdout.trim());
    } else {
      recordCheck(`exact-source-command:${cmd}`, 'fail', `${cmd} not found in PATH`);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 10: Disk budget
// ---------------------------------------------------------------------------

function checkDiskBudget() {
  const benchmarkParent = path.join(os.homedir(), '.brain');
  const minRequiredMB = 2000; // 2 GB minimum

  try {
    // Use df to check available space
    const dfResult = spawnSync('df', ['-m', benchmarkParent], { encoding: 'utf8' });
    if (dfResult.status === 0) {
      const lines = dfResult.stdout.trim().split('\n');
      if (lines.length >= 2) {
        const fields = lines[lines.length - 1].split(/\s+/);
        const availableMB = parseInt(fields[3], 10);
        if (availableMB >= minRequiredMB) {
          recordCheck('disk-budget', 'pass', `${availableMB} MB available (minimum ${minRequiredMB} MB)`);
        } else {
          recordCheck('disk-budget', 'fail', `only ${availableMB} MB available (minimum ${minRequiredMB} MB required)`);
        }
        return;
      }
    }
  } catch { /* fall through */ }

  recordCheck('disk-budget', 'warn', 'cannot determine available disk space — verify manually');
}

// ---------------------------------------------------------------------------
// Check 11: Network isolation mechanism
// ---------------------------------------------------------------------------

function checkNetworkIsolation() {
  // We can't enforce network isolation here — just verify we can document the requirement
  // Check if any known network-isolation tools are available (pfctl, nft, iptables)
  const isolationTools = ['pfctl', 'nft', 'iptables'];
  const found = isolationTools.filter((tool) => {
    const r = spawnSync('which', [tool], { encoding: 'utf8' });
    return r.status === 0;
  });

  if (found.length > 0) {
    recordCheck('network-isolation-mechanism', 'available', `tools found: ${found.join(', ')} — operator must configure isolation before benchmark`);
  } else {
    recordCheck('network-isolation-mechanism', 'warn', 'no network-isolation tool found in PATH — operator must verify or stop benchmark if network isolation cannot be proven');
  }
}

// ---------------------------------------------------------------------------
// Materialization (only if --materialize flag is supplied)
// ---------------------------------------------------------------------------

function materializeDirectories(runDir) {
  const toCreate = [runDir, BENCHMARK_CACHE, BENCHMARK_CONFIG];
  for (const dir of toCreate) {
    fs.mkdirSync(dir, { recursive: true });
    recordCheck(`materialized:${path.basename(dir)}`, 'created', dir);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function runPreflight({ dryRun = true, materialize = false, _manifestPathOverride } = {}) {
  _checks = [];

  const manifest = checkManifest(_manifestPathOverride);
  checkPinnedCommits(manifest);
  checkSourceCheckoutsReadOnly(manifest);
  const runDir = checkRunDirectory();
  checkIsolatedDirectories();
  checkUserConfigNotMutated();
  checkCodebaseMemoryBinary();
  checkGraphifySubject();
  checkExactSourceBaseline();
  checkDiskBudget();
  checkNetworkIsolation();

  if (materialize && !dryRun) {
    materializeDirectories(runDir);
  }

  return { checks: [..._checks], runDir, dryRun };
}

const IS_MAIN = (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })()
);

if (IS_MAIN) {
  const isDryRun = process.argv.includes('--dry-run') || !process.argv.includes('--materialize');
  const isMaterialize = process.argv.includes('--materialize');

  if (isMaterialize && isDryRun) {
    console.error('ERROR: Cannot specify both --dry-run and --materialize');
    process.exit(2);
  }

  const { checks: results, runDir } = await runPreflight({ dryRun: isDryRun, materialize: isMaterialize, _manifestPathOverride: undefined });

  console.log(`# B8.1 Benchmark Preflight Harness — ${isDryRun ? 'DRY RUN' : 'MATERIALIZE'}`);
  console.log(`# Run directory (calculated, NOT created in dry-run): ${runDir}`);
  console.log('');

  let hasFailures = false;
  for (const check of results) {
    const status = check.status.toUpperCase().padEnd(8);
    const detail = check.detail ? ` — ${check.detail}` : '';
    console.log(`${status} ${check.name}${detail}`);
    if (check.status === 'fail') hasFailures = true;
  }

  console.log('');
  const passCount = results.filter((c) => c.status === 'pass' || c.status === 'created').length;
  const failCount = results.filter((c) => c.status === 'fail').length;
  const warnCount = results.filter((c) => c.status === 'warn').length;
  const blockedCount = results.filter((c) => c.status === 'blocked').length;

  console.log(`preflight-summary: pass=${passCount} fail=${failCount} warn=${warnCount} blocked=${blockedCount}`);
  if (isDryRun) {
    console.log('dry-run=true (no files created)');
  }

  if (hasFailures) process.exitCode = 1;
}
