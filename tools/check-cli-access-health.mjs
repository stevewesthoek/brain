#!/usr/bin/env node

/**
 * Redacted, read-only health check for every CLI in operations/CLI-MANIFEST.md.
 *
 * This separates PATH availability from provider authentication/session health.
 * It never prints child stdout/stderr, credential values, account IDs, or tokens.
 * It can write a metadata-only snapshot under runtime/local/infrastructure/ and
 * can optionally raise one macOS notification for attention-required results.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildCapabilityInventory } from './discover-capabilities.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY_PATH = path.join(ROOT, 'operations/specs/cli-access-health.json');
const SNAPSHOT_PATH = path.join(ROOT, 'runtime/local/infrastructure/cli-access-health.json');
const NOTIFICATION_STATE_PATH = path.join(ROOT, 'runtime/local/infrastructure/cli-access-health-notification.json');
const args = new Set(process.argv.slice(2));
const writeSnapshot = args.has('--write');
const notify = args.has('--notify');
const jsonOutput = args.has('--json');
const timeoutDefaultMs = 15000;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function expandHome(filePath) {
  return filePath?.startsWith('~/') ? path.join(os.homedir(), filePath.slice(2)) : filePath;
}

function commandPath(name) {
  return spawnSync('/usr/bin/which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).stdout.trim();
}

function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

function runProbe(command, probeArgs, { envFile, timeoutMs = timeoutDefaultMs, runner } = {}) {
  const expandedEnvFile = expandHome(envFile);
  if (expandedEnvFile && !fs.existsSync(expandedEnvFile)) {
    return Promise.resolve({ status: 'needs_configuration', exitCode: null, timedOut: false, envFilePresent: false });
  }

  const env = { ...process.env };
  const fileEnv = parseEnvFile(expandedEnvFile);
  if (fileEnv) Object.assign(env, fileEnv);
  if (runner) return Promise.resolve(runner(command, probeArgs, { env, timeoutMs }));

  return new Promise((resolve) => {
    const child = spawn(command, probeArgs, { env, stdio: ['ignore', 'ignore', 'ignore'] });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
    child.once('error', () => {
      clearTimeout(timer);
      resolve({ status: 'spawn_error', exitCode: null, timedOut: false, envFilePresent: !expandedEnvFile || Boolean(fileEnv) });
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      resolve({ status: code === 0 ? 'pass' : (timedOut ? 'timeout' : 'fail'), exitCode: code, timedOut, envFilePresent: !expandedEnvFile || Boolean(fileEnv) });
    });
  });
}

function accepted(result, policy) {
  return result.status === 'pass' || (policy.acceptableExitCodes ?? [0]).includes(result.exitCode);
}

async function inspectCli(record, registry, { runner } = {}) {
  const policy = { ...(registry.default ?? {}), ...(registry.overrides?.[record.name] ?? {}) };
  const resolvedPath = commandPath(record.name);
  const installed = Boolean(resolvedPath);
  const base = {
    cli: record.name,
    path: resolvedPath || null,
    installed,
    probeClass: policy.probeClass ?? 'unknown',
    authMode: policy.authMode ?? 'unknown',
    credentialReference: policy.credentialReference ?? null,
    overall: installed ? 'not_tested' : 'needs_attention',
    probe: null,
    auth: { status: policy.authMode === 'not_applicable' ? 'not_applicable' : 'not_tested' },
    note: policy.note ?? null,
  };

  if (!installed) return base;
  if (policy.probe === null) return base;

  const probe = await runProbe(record.name, policy.probe ?? [], { envFile: policy.envFile, runner });
  base.probe = { status: accepted(probe, policy) ? 'pass' : probe.status, exitCode: probe.exitCode, timedOut: probe.timedOut };

  if (policy.profiles) {
    const profileResults = [];
    for (const profile of policy.profiles) {
      if (profile.enabled === false) {
        profileResults.push({ name: profile.name, label: profile.label, required: false, status: 'disabled', exitCode: null, timedOut: false });
        continue;
      }
      const result = await runProbe(record.name, profile.probe, { envFile: policy.envFile, runner });
      profileResults.push({ name: profile.name, label: profile.label, required: profile.required === true, status: accepted(result, policy) ? 'pass' : result.status, exitCode: result.exitCode, timedOut: result.timedOut });
    }
    const enabledProfiles = profileResults.filter((profile) => profile.status !== 'disabled');
    const required = enabledProfiles.filter((profile) => profile.required);
    const optional = enabledProfiles.filter((profile) => !profile.required);
    base.auth = {
      status: required.every((profile) => profile.status === 'pass')
        ? (optional.every((profile) => profile.status === 'pass') ? 'ready' : 'degraded')
        : 'needs_user_action',
      profiles: profileResults,
    };
  } else if (policy.authMode === 'not_applicable') {
    base.auth = { status: 'not_applicable' };
  } else if (policy.authMode === 'delegated') {
    base.auth = { status: 'delegated' };
  } else {
    base.auth = { status: accepted(probe, policy) ? 'ready' : 'needs_user_action' };
  }

  const probeOkay = base.probe.status === 'pass';
  const authOkay = ['ready', 'not_applicable', 'delegated'].includes(base.auth.status);
  base.overall = probeOkay && authOkay ? 'ready' : 'needs_attention';
  return base;
}

export async function buildHealthReport({ inventory = buildCapabilityInventory(), registry = readJson(REGISTRY_PATH), runner } = {}) {
  const records = inventory.capabilities.filter((record) => record.kind === 'cli');
  const results = [];
  for (const record of records) results.push(await inspectCli(record, registry, { runner }));
  const summary = {
    total: results.length,
    installed: results.filter((result) => result.installed).length,
    ready: results.filter((result) => result.overall === 'ready').length,
    needsAttention: results.filter((result) => result.overall === 'needs_attention').length,
    notTested: results.filter((result) => result.overall === 'not_tested').length,
  };
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), source: 'operations/CLI-MANIFEST.md', summary, results };
}

function writeSnapshotFile(report) {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(SNAPSHOT_PATH, 0o600);
}

function notifyAttention(report) {
  if (!notify) return;

  const attention = report.results
    .filter((result) => result.overall === 'needs_attention')
    .map((result) => ({
      cli: result.cli,
      overall: result.overall,
      probe: result.probe?.status ?? 'not_tested',
      auth: result.auth.status,
      profiles: result.auth.profiles?.map((profile) => ({ name: profile.name, status: profile.status })) ?? [],
    }));
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify(attention)).digest('hex');
  let previous = null;
  try {
    previous = JSON.parse(fs.readFileSync(NOTIFICATION_STATE_PATH, 'utf8'));
  } catch {
    // First run or an unavailable local state file: notify and then establish it.
  }
  if (previous?.fingerprint === fingerprint) return;

  const message = attention.length > 0
    ? `${attention.length} of ${report.summary.total} CLI checks need attention`
    : 'All safely probeable CLI checks are ready';
  const result = spawnSync('/usr/bin/osascript', ['-e', `display notification ${JSON.stringify(message)} with title "Brain CLI access health"`], { stdio: 'ignore' });
  if (result.status !== 0) return;

  fs.mkdirSync(path.dirname(NOTIFICATION_STATE_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(NOTIFICATION_STATE_PATH, `${JSON.stringify({ schemaVersion: 1, fingerprint, needsAttention: attention.length, updatedAt: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(NOTIFICATION_STATE_PATH, 0o600);
}

function printReport(report) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(`Brain CLI access health\n`);
  process.stdout.write(`total=${report.summary.total} installed=${report.summary.installed} ready=${report.summary.ready} needs_attention=${report.summary.needsAttention} not_tested=${report.summary.notTested}\n`);
  for (const result of report.results) {
    const profileText = result.auth.profiles ? ` profiles=${result.auth.profiles.map((profile) => `${profile.label}:${profile.status}`).join(',')}` : '';
    process.stdout.write(`${result.cli}\t${result.overall}\tprobe=${result.probe?.status ?? 'not_tested'}\tauth=${result.auth.status}${profileText}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await buildHealthReport();
  if (writeSnapshot) writeSnapshotFile(report);
  notifyAttention(report);
  printReport(report);
  process.exitCode = report.summary.needsAttention > 0 ? 1 : 0;
}
