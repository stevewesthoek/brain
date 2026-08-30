#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { spawn as defaultSpawn } from 'node:child_process';
import { loadAndValidateRegistry } from '../scheduler/registry.mjs';

const ROOT_DIR = path.resolve(import.meta.dirname, '../..');
const DEFAULT_STATE_DIR = path.join(os.homedir(), '.local', 'state', 'office-scheduler');
const DEFAULT_LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'office-scheduler');
const DEFAULT_REPORT = path.join(ROOT_DIR, 'runtime', 'local', 'office-scheduler', 'latest-run.md');
const MAX_OUTPUT = 4000;
const MAX_HISTORY = 100;

function envPath(env, name, fallback) {
  return env[name] && env[name].trim() ? path.resolve(env[name]) : fallback;
}

function pathsFor(env = process.env) {
  return {
    stateDir: envPath(env, 'OFFICE_SCHEDULER_STATE_DIR', DEFAULT_STATE_DIR),
    logDir: envPath(env, 'OFFICE_SCHEDULER_LOG_DIR', DEFAULT_LOG_DIR),
    reportPath: envPath(env, 'OFFICE_SCHEDULER_REPORT_FILE', DEFAULT_REPORT),
  };
}

function ensureDir(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* best effort on non-POSIX test filesystems */ }
}

function writeAtomic(filePath, content, mode = 0o600) {
  ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, content, { mode });
  try { fs.chmodSync(temporary, mode); } catch { /* best effort */ }
  fs.renameSync(temporary, filePath);
}

function writeJson(filePath, value) {
  writeAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function appendLog(filePath, line) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, `${line}\n`, { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(filePath, 0o600); } catch { /* best effort */ }
}

function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return fallback; }
}

function readText(filePath, fallback = '') {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return fallback; }
}

function lisbonParts(date) {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  }).formatToParts(date);
  return Object.fromEntries(formatted.map((part) => [part.type, part.value]));
}

function lisbonDate(date) {
  const parts = lisbonParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function lisbonOffsetMs(date) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Lisbon', timeZoneName: 'longOffset' }).formatToParts(date);
  const value = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = value.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return (match[1] === '+' ? 1 : -1) * minutes * 60_000;
}

function localDateUtc(dateString, hour, minute) {
  const [year, month, day] = dateString.split('-').map(Number);
  const approximate = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(approximate - lisbonOffsetMs(new Date(approximate)));
}

function nextDailyRunAt(now, hour = 3, minute = 0) {
  const parts = lisbonParts(now);
  const today = localDateUtc(`${parts.year}-${parts.month}-${parts.day}`, hour, minute);
  if (today.getTime() > now.getTime()) return today.toISOString();
  const nextLocalDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
  const dateString = nextLocalDate.toISOString().slice(0, 10);
  return localDateUtc(dateString, hour, minute).toISOString();
}

function redactionSecrets(env = process.env) {
  return Object.entries(env)
    .filter(([key, value]) => /(secret|token|password|api[_-]?key|private[_-]?key|credential)/i.test(key) && value && value.length >= 4)
    .map(([, value]) => value)
    .sort((a, b) => b.length - a.length);
}

export function redact(value, env = process.env) {
  let output = String(value ?? '');
  for (const secret of redactionSecrets(env)) output = output.split(secret).join('[REDACTED]');
  return output
    .replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]')
    .replace(/((?:api[_-]?key|token|secret|password|private[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]')
    .slice(0, MAX_OUTPUT);
}

function nowFrom(env) {
  const candidate = env.BRAIN_SCHEDULER_NOW;
  const date = candidate ? new Date(candidate) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid BRAIN_SCHEDULER_NOW: ${candidate}`);
  return date;
}

function isForceRun(env) {
  return env.FORCE_RUN === '1' || env.BRAIN_SCHEDULER_FORCE_RUN === '1';
}

function isDryRun(env) {
  return env.BRAIN_SCHEDULER_DRY_RUN === '1';
}

function assertDryRunIsolation(env, paths) {
  if (!isDryRun(env)) return;
  const missing = ['OFFICE_SCHEDULER_STATE_DIR', 'OFFICE_SCHEDULER_LOG_DIR', 'OFFICE_SCHEDULER_REPORT_FILE']
    .filter((name) => !(env[name] && env[name].trim()));
  if (missing.length > 0) {
    throw new Error(`dry-run-requires-isolated-paths: ${missing.join(', ')}`);
  }
  if (paths.stateDir === DEFAULT_STATE_DIR || paths.logDir === DEFAULT_LOG_DIR || paths.reportPath === DEFAULT_REPORT) {
    throw new Error('dry-run-requires-isolated-paths: production scheduler path supplied');
  }
}

function parseKeyValueState(filePath) {
  const values = {};
  for (const line of readText(filePath).split('\n')) {
    const separator = line.indexOf('=');
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

function writeCompatibilityState(filePath, receipt, env) {
  const values = [
    `status=${receipt.status}`,
    `exit_code=${receipt.exitCode ?? ''}`,
    `duration_seconds=${receipt.durationSeconds ?? ''}`,
    `updated_at_lisbon=${lisbonParts(new Date(receipt.endedAt ?? receipt.createdAt)).year}-${lisbonParts(new Date(receipt.endedAt ?? receipt.createdAt)).month}-${lisbonParts(new Date(receipt.endedAt ?? receipt.createdAt)).day} ${lisbonParts(new Date(receipt.endedAt ?? receipt.createdAt)).hour}:${lisbonParts(new Date(receipt.endedAt ?? receipt.createdAt)).minute}:${lisbonParts(new Date(receipt.endedAt ?? receipt.createdAt)).second}`,
    `error_message=${redact(receipt.errorMessage ?? '', env).replace(/[\r\n=]/g, ' ')}`,
  ];
  writeAtomic(filePath, `${values.join('\n')}\n`);
}

function statusForLifecycle(job) {
  if (job.lifecycle === 'policy-blocked') return { status: 'blocked', skippedReason: 'policy-blocked' };
  if (job.lifecycle === 'disabled' || job.lifecycle === 'deprecated') return { status: 'disabled', skippedReason: job.lifecycle };
  if (job.lifecycle === 'manual-only') return { status: 'skipped', skippedReason: 'manual-only' };
  return null;
}

function baseReceipt(job, now, env, extra = {}) {
  return {
    schemaVersion: '1.0.0',
    jobId: job.id,
    jobName: job.name,
    createdAt: now.toISOString(),
    startedAt: null,
    endedAt: null,
    status: 'never-run',
    exitCode: null,
    durationSeconds: null,
    trigger: env.BRAIN_SCHEDULER_TRIGGER || 'launchd',
    mode: job.mode,
    lifecycle: job.lifecycle,
    errorMessage: null,
    output: null,
    artifacts: job.outputArtifacts,
    ...extra,
  };
}

function commandForJob(job) {
  const entrypoint = path.resolve(ROOT_DIR, job.entrypoint);
  if (job.entrypoint.endsWith('.mjs') || job.entrypoint.endsWith('.js')) return { command: process.execPath, args: [entrypoint, ...job.fixedArguments] };
  if (job.entrypoint.endsWith('.sh')) return { command: '/bin/bash', args: [entrypoint, ...job.fixedArguments] };
  throw new Error(`${job.id}: unsupported active entrypoint ${job.entrypoint}`);
}

function runChild(job, { now, env, paths, spawnImpl = defaultSpawn }) {
  return new Promise((resolve) => {
    const started = new Date();
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (status, exitCode, errorMessage = null) => {
      if (settled) return;
      settled = true;
      const ended = new Date();
      const durationSeconds = Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000));
      const output = redact([stdout, stderr].filter(Boolean).join('\n'), env);
      const receipt = {
        schemaVersion: '1.0.0', jobId: job.id, jobName: job.name, createdAt: now.toISOString(),
        startedAt: started.toISOString(), endedAt: ended.toISOString(), status, exitCode,
        durationSeconds, trigger: env.BRAIN_SCHEDULER_TRIGGER || 'launchd', mode: job.mode,
        lifecycle: job.lifecycle, errorMessage: errorMessage ? redact(errorMessage, env) : null,
        output: output || null, artifacts: job.outputArtifacts,
      };
      ensureDir(paths.logDir);
      writeAtomic(path.join(paths.logDir, `${job.id}.log`), `${output}\n`);
      resolve({ receipt });
    };
    let child;
    try {
      const { command, args } = commandForJob(job);
      child = spawnImpl(command, args, { cwd: ROOT_DIR, env: { ...env, BRAIN_SCHEDULER_JOB_ID: job.id }, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout?.on('data', (chunk) => { stdout = `${stdout}${chunk}`.slice(-MAX_OUTPUT); });
      child.stderr?.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-MAX_OUTPUT); });
      const timer = setTimeout(() => {
        try { child.kill('SIGTERM'); } catch { /* child may have already exited */ }
        finish('timeout', null, `Job exceeded timeout of ${job.timeoutSeconds}s.`);
      }, job.timeoutSeconds * 1000);
      child.on('error', (error) => { clearTimeout(timer); finish('failed', null, `Could not start job: ${error.message}`); });
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        if (settled) return;
        if (code === 0) finish('success', 0);
        else finish('failed', typeof code === 'number' ? code : null, signal ? `Job terminated by ${signal}.` : `Job exited with code ${code ?? 'unknown'}.`);
      });
    } catch (error) {
      finish('failed', null, error instanceof Error ? error.message : String(error));
    }
  });
}

function runGuard(registry, now, env, paths) {
  const force = isForceRun(env);
  const parts = lisbonParts(now);
  const hour = Number(parts.hour) % 24;
  if (!force && hour < registry.scheduler.hour) return { status: 'skipped', reason: 'before-lisbon-schedule' };
  const statePath = path.join(paths.stateDir, 'last_completed_lisbon_date');
  if (!fs.existsSync(statePath)) return null;
  const raw = readText(statePath);
  const lastCompleted = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastCompleted)) return { status: 'blocked', reason: 'invalid-last-completed-state' };
  const [year, month, day] = lastCompleted.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return { status: 'blocked', reason: 'invalid-last-completed-state' };
  if (lastCompleted > lisbonDate(now)) return { status: 'blocked', reason: 'invalid-last-completed-state' };
  if (!force && lastCompleted === lisbonDate(now)) return { status: 'skipped', reason: 'already-completed-for-lisbon-day' };
  return null;
}

function manifestIdentity(manifestPath) {
  const resolved = path.resolve(manifestPath);
  const relative = path.relative(ROOT_DIR, resolved);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : resolved;
}

function appendHistory(filePath, entry) {
  const lines = readText(filePath).split('\n').filter(Boolean);
  lines.push(JSON.stringify(entry));
  writeAtomic(filePath, `${lines.slice(-MAX_HISTORY).join('\n')}\n`);
}

export function renderSchedulerReport(registry, { stateDir, reportPath, now = new Date() }) {
  const overall = readJson(path.join(stateDir, 'scheduler-latest.json'));
  const rows = registry.jobs.map((job) => {
    const receipt = readJson(path.join(stateDir, 'receipts', `${job.id}.json`));
    const state = receipt ?? (fs.existsSync(path.join(stateDir, `${job.id}.last`)) ? parseKeyValueState(path.join(stateDir, `${job.id}.last`)) : null);
    const status = receipt?.status ?? state?.status ?? (job.lifecycle === 'policy-blocked' ? 'blocked' : job.lifecycle === 'disabled' || job.lifecycle === 'deprecated' ? 'disabled' : 'never-run');
    const lastRun = receipt?.endedAt ?? null;
    return `| ${job.name} | \`${job.lifecycle}\` | \`${status}\` | ${lastRun ?? '—'} | ${receipt?.durationSeconds ?? state?.duration_seconds ?? '—'} |`;
  });
  const content = [
    '# Brain Scheduler Latest Run', '',
    `Generated at: ${now.toISOString()}`,
    `Schedule: ${registry.scheduler.schedule}`,
    `Overall status: \`${overall?.status ?? 'never-run'}\``,
    `Trigger: ${overall?.trigger ?? 'unknown'}`, '',
    '| Job | Lifecycle | Result | Ended | Duration (s) |',
    '| --- | --- | --- | --- | --- |',
    ...rows, '',
    'This report is observational. Scheduler control and job enablement are not exposed here.', '',
  ].join('\n');
  writeAtomic(reportPath, `${content}\n`);
  return content;
}

export async function runScheduler({ env = process.env, now = nowFrom(env), spawnImpl = defaultSpawn } = {}) {
  const paths = pathsFor(env);
  assertDryRunIsolation(env, paths);
  const { registry, manifestPath } = loadAndValidateRegistry({ checkEntrypoints: true, manifestPath: env.BRAIN_SCHEDULER_MANIFEST_PATH || undefined });
  const manifest = manifestIdentity(manifestPath);
  ensureDir(paths.stateDir);
  ensureDir(paths.logDir);
  appendLog(path.join(paths.logDir, 'nightly.log'), `scheduler start=${now.toISOString()} trigger=${env.BRAIN_SCHEDULER_TRIGGER || 'launchd'}`);
  const lockDir = path.join(paths.stateDir, 'nightly.lock');
  try {
    fs.mkdirSync(lockDir, { recursive: false, mode: 0o700 });
  } catch (error) {
    const status = error?.code === 'EEXIST' ? 'running' : 'blocked';
    const overall = { schemaVersion: '1.0.0', schedulerId: registry.scheduler.id, status, reason: error?.code === 'EEXIST' ? 'lock-held' : 'lock-unavailable', createdAt: now.toISOString(), manifestPath: manifest };
    writeJson(path.join(paths.stateDir, 'scheduler-latest.json'), overall);
    appendHistory(path.join(paths.stateDir, 'history.jsonl'), overall);
    renderSchedulerReport(registry, { stateDir: paths.stateDir, reportPath: paths.reportPath, now });
    return overall;
  }
  try {
    writeAtomic(path.join(lockDir, 'pid'), `${process.pid}\n`);
    writeAtomic(path.join(lockDir, 'started_at'), `${now.toISOString()}\n`);
    const guard = runGuard(registry, now, env, paths);
    if (guard) {
      const overall = { schemaVersion: '1.0.0', schedulerId: registry.scheduler.id, status: guard.status, reason: guard.reason, createdAt: now.toISOString(), manifestPath: manifest, trigger: env.BRAIN_SCHEDULER_TRIGGER || 'launchd', executedJobIds: [] };
      writeJson(path.join(paths.stateDir, 'scheduler-latest.json'), overall);
      appendHistory(path.join(paths.stateDir, 'history.jsonl'), overall);
      renderSchedulerReport(registry, { stateDir: paths.stateDir, reportPath: paths.reportPath, now });
      return overall;
    }

    const receipts = [];
    const failed = new Set();
    for (const job of registry.jobs) {
      const lifecycleStatus = statusForLifecycle(job);
      if (lifecycleStatus) {
        const receipt = baseReceipt(job, now, env, { status: lifecycleStatus.status, skippedReason: lifecycleStatus.skippedReason });
        writeJson(path.join(paths.stateDir, 'receipts', `${job.id}.json`), receipt);
        appendLog(path.join(paths.logDir, 'nightly.log'), `skipping job=${job.id} reason=${lifecycleStatus.skippedReason}`);
        receipts.push(receipt);
        continue;
      }
      if (isDryRun(env)) {
        const receipt = baseReceipt(job, now, env, { status: 'skipped', skippedReason: 'dry_run_report_only' });
        writeJson(path.join(paths.stateDir, 'receipts', `${job.id}.json`), receipt);
        writeCompatibilityState(path.join(paths.stateDir, `${job.id}.last`), receipt, env);
        appendLog(path.join(paths.logDir, 'nightly.log'), `skipping job=${job.id} reason=dry_run_report_only`);
        receipts.push(receipt);
        continue;
      }
      const dependencyFailure = job.dependencies.find((dependency) => failed.has(dependency));
      if (dependencyFailure) {
        const receipt = baseReceipt(job, now, env, { status: 'blocked', skippedReason: `dependency-failed:${dependencyFailure}` });
        writeJson(path.join(paths.stateDir, 'receipts', `${job.id}.json`), receipt);
        appendLog(path.join(paths.logDir, 'nightly.log'), `skipping job=${job.id} reason=dependency-failed:${dependencyFailure}`);
        receipts.push(receipt);
        failed.add(job.id);
        continue;
      }
      writeAtomic(path.join(lockDir, 'current_job'), `${job.id}\n`);
      appendLog(path.join(paths.logDir, 'nightly.log'), `starting job=${job.id}`);
      const runningReceipt = baseReceipt(job, now, env, { status: 'running', startedAt: now.toISOString() });
      writeJson(path.join(paths.stateDir, 'receipts', `${job.id}.json`), runningReceipt);
      writeCompatibilityState(path.join(paths.stateDir, `${job.id}.last`), runningReceipt, env);
      const result = await runChild(job, { now, env, paths, spawnImpl });
      try { fs.unlinkSync(path.join(lockDir, 'current_job')); } catch { /* best effort */ }
      writeJson(path.join(paths.stateDir, 'receipts', `${job.id}.json`), result.receipt);
      writeCompatibilityState(path.join(paths.stateDir, `${job.id}.last`), result.receipt, env);
      appendLog(path.join(paths.logDir, 'nightly.log'), `finished job=${job.id} status=${result.receipt.status}`);
      receipts.push(result.receipt);
      if (result.receipt.status !== 'success') failed.add(job.id);
    }
    const overallStatus = receipts.some((receipt) => receipt.status === 'failed' || receipt.status === 'timeout') ? 'failed' : 'success';
    const overall = {
      schemaVersion: '1.0.0', schedulerId: registry.scheduler.id, status: overallStatus, createdAt: now.toISOString(),
      startedAt: now.toISOString(), endedAt: new Date().toISOString(), trigger: env.BRAIN_SCHEDULER_TRIGGER || 'launchd',
      dryRun: isDryRun(env), manifestPath: manifest, jobCount: registry.jobs.length,
      executedJobIds: receipts.filter((receipt) => receipt.startedAt).map((receipt) => receipt.jobId),
      failedJobIds: receipts.filter((receipt) => receipt.status === 'failed' || receipt.status === 'timeout').map((receipt) => receipt.jobId),
      receipts: receipts.map(({ jobId, status, endedAt, durationSeconds }) => ({ jobId, status, endedAt, durationSeconds })),
    };
    writeJson(path.join(paths.stateDir, 'scheduler-latest.json'), overall);
    appendHistory(path.join(paths.stateDir, 'history.jsonl'), overall);
    if (overallStatus === 'success') writeAtomic(path.join(paths.stateDir, 'last_completed_lisbon_date'), `${lisbonDate(now)}\n`);
    renderSchedulerReport(registry, { stateDir: paths.stateDir, reportPath: paths.reportPath, now });
    return overall;
  } finally {
    try { fs.rmSync(lockDir, { recursive: true, force: true }); } catch { /* leave evidence if cleanup is unavailable */ }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = process.argv.includes('--render-report')
      ? (() => { const { registry } = loadAndValidateRegistry({ checkEntrypoints: true }); const paths = pathsFor(process.env); return { status: 'report-rendered', reportPath: paths.reportPath, bytes: renderSchedulerReport(registry, { stateDir: paths.stateDir, reportPath: paths.reportPath }) .length }; })()
      : await runScheduler();
    console.log(JSON.stringify(result));
    if (result.status === 'failed' || result.status === 'blocked') process.exitCode = 1;
  } catch (error) {
    console.error(redact(error instanceof Error ? error.stack ?? error.message : String(error)));
    process.exitCode = 1;
  }
}
