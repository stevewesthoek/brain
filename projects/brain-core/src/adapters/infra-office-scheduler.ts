import fs from 'node:fs';
import { realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type InfraSchedulerJobStatus = 'success' | 'failed' | 'timeout' | 'running' | 'skipped' | 'disabled' | 'blocked' | 'never-run';
export type InfraSchedulerHealth = 'healthy' | 'warning' | 'failed' | 'disabled';

type RegistryJob = {
  id: string; name: string; description: string; owner: string; entrypoint: string; fixedArguments: string[]; dependencies: string[];
  scheduleType: string; schedule: string; lifecycle: string; mode: string; authority: string; networkAccess: string;
  credentialSensitive: boolean; destructive: boolean; mindWrite: boolean; timeoutSeconds: number; retries: number; concurrency: string;
  idempotency: string; receipt: string; outputArtifacts: string[]; policyReason: string; runbook: string; tags: string[];
  humanAction: string; reviewCategory: 'ACTIVE' | 'BLOCKED' | 'NEEDS REVIEW' | 'OBSOLETE'; evidenceState: string; externalActivation: string;
};
type Registry = { registryVersion: string; authority: string; scheduler: { id: string; name: string; launchMechanism: string; launchAgentLabel: string; timezone: string; scheduleType: string; schedule: string; hour: number; minute: number; runAtLoad: boolean; bootstrap: string; runner: string; stateDirectory: string; logDirectory: string; latestReport: string }; jobs: RegistryJob[] };

export interface InfraSchedulerJob {
  key: string; id: string; label: string; name: string; description: string; owner: string; planned: true; enabled: boolean; executed: boolean;
  status: InfraSchedulerJobStatus; lifecycle: string; mode: string; entrypoint: string; fixedArguments: string[]; dependencies: string[];
  scheduleType: string; schedule: string; authority: string; networkAccess: string; credentialSensitive: boolean; destructive: boolean;
  mindWrite: boolean; timeoutSeconds: number; retries: number; concurrency: string; idempotency: string; exitCode: number | null;
  durationSeconds: number | null; lastRunAt: string | null; nextRunAt: string | null; latestError: string | null; errorMessage: string | null;
  artifacts: string[]; artifactPaths: string[]; receiptPath: string; skippedReason: string | null; trigger: string | null;
  policyReason: string; runbook: string; tags: string[]; humanAction: string; reviewCategory: 'ACTIVE' | 'BLOCKED' | 'NEEDS REVIEW' | 'OBSOLETE'; evidenceState: string; recentHistory: Array<Record<string, unknown>>;
}

export interface InfraSchedulerReport { available: boolean; path: string; summary: string; generatedAt: string | null; failureCount: number; }
export interface InfraSchedulerStatus {
  status: 'ok' | 'not-configured' | 'error'; displayName: string; health: InfraSchedulerHealth; launchMechanism: string; launchAgentLabel: string;
  timezone: string; scheduleType: string; schedule: string; runAtLoad: boolean; launch: Record<string, unknown>; manifest: Record<string, unknown>;
  lock: Record<string, unknown>; lastRun: Record<string, unknown> | null; latestOverallResult: Record<string, unknown> | null; nextRunAt: string | null;
  counts: Record<string, number>; jobs: InfraSchedulerJob[]; history: Array<Record<string, unknown>>; totalJobs: number; plannedJobs: number;
  executedJobs: number; runningJobs: number; successfulJobs: number; failedJobs: number; timeoutJobs: number; neverRunJobs: number;
  skippedJobs: number; blockedJobs: number; disabledJobs: number; report: InfraSchedulerReport; error?: string;
}

const REPO_ROOT = process.env.BRAIN_SCHEDULER_REPO_ROOT ? path.resolve(process.env.BRAIN_SCHEDULER_REPO_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const STATE_DIR = process.env.OFFICE_SCHEDULER_STATE_DIR ? path.resolve(process.env.OFFICE_SCHEDULER_STATE_DIR) : path.join(os.homedir(), '.local', 'state', 'office-scheduler');
const REPORT_PATH = process.env.OFFICE_SCHEDULER_REPORT_FILE ? path.resolve(process.env.OFFICE_SCHEDULER_REPORT_FILE) : path.join(REPO_ROOT, 'runtime', 'local', 'office-scheduler', 'latest-run.md');
const MANIFEST_PATH = process.env.BRAIN_SCHEDULER_MANIFEST_PATH ? path.resolve(process.env.BRAIN_SCHEDULER_MANIFEST_PATH) : path.join(REPO_ROOT, 'operations', 'specs', 'typed-scheduler-jobs.json');
const INSTALLED_PLIST = process.env.BRAIN_SCHEDULER_INSTALLED_PLIST ? path.resolve(process.env.BRAIN_SCHEDULER_INSTALLED_PLIST) : path.join(os.homedir(), 'Library/LaunchAgents/com.office.nightly-scheduler.plist');

function readJson(filePath: string): unknown | null { try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; } }
function readText(filePath: string): string { try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; } }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function redact(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  let output = String(value);
  for (const [key, secret] of Object.entries(process.env)) if (secret && secret.length >= 4 && /(secret|token|password|api[_-]?key|private[_-]?key|credential)/i.test(key)) output = output.split(secret).join('[REDACTED]');
  return output.replace(/(authorization\s*[:=]\s*bearer\s+)[^\s,;]+/gi, '$1[REDACTED]').replace(/((?:api[_-]?key|token|secret|password|private[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[REDACTED]').slice(0, 1000);
}

function registryError(): InfraSchedulerStatus {
  const fallbackReport: InfraSchedulerReport = { available: false, path: REPORT_PATH, summary: 'scheduler manifest unavailable', generatedAt: null, failureCount: 0 };
  return {
    status: 'error', displayName: 'Brain Scheduler', health: 'failed', launchMechanism: 'macOS launchd LaunchAgent', launchAgentLabel: 'com.office.nightly-scheduler',
    timezone: 'Europe/Lisbon', scheduleType: 'daily', schedule: 'daily at 03:00 Europe/Lisbon', runAtLoad: true, launch: { configured: false },
    manifest: { path: MANIFEST_PATH, valid: false, jobCount: 0 }, lock: { present: false, held: false, stale: false }, lastRun: null, latestOverallResult: null,
    nextRunAt: null, counts: {}, jobs: [], history: [], totalJobs: 0, plannedJobs: 0, executedJobs: 0, runningJobs: 0, successfulJobs: 0, failedJobs: 0,
    timeoutJobs: 0, neverRunJobs: 0, skippedJobs: 0, blockedJobs: 0, disabledJobs: 0, report: fallbackReport, error: 'Canonical Brain Scheduler manifest could not be read.'
  };
}

function loadRegistry(): { registry: Registry; error: null } | { registry: null; error: InfraSchedulerStatus } {
  const parsed = readJson(MANIFEST_PATH);
  if (!isRecord(parsed) || !isRecord(parsed.scheduler) || !Array.isArray(parsed.jobs)) return { registry: null, error: registryError() };
  const registry = parsed as unknown as Registry;
  const scheduler = registry.scheduler;
  const validLifecycle = new Set(['active', 'manual-only', 'policy-blocked', 'disabled', 'deprecated']);
  const validSchedule = new Set(['daily', 'event-driven', 'manual', 'disabled']);
  const requiredJobFields = ['id', 'name', 'description', 'owner', 'entrypoint', 'fixedArguments', 'dependencies', 'scheduleType', 'schedule', 'lifecycle', 'mode', 'authority', 'networkAccess', 'credentialSensitive', 'destructive', 'mindWrite', 'timeoutSeconds', 'retries', 'concurrency', 'idempotency', 'receipt', 'outputArtifacts', 'policyReason', 'runbook', 'tags', 'humanAction', 'reviewCategory', 'evidenceState', 'externalActivation'];
  if (registry.registryVersion !== '2.0.0' || registry.authority !== 'canonical-job-registry' || registry.jobs.length === 0 || scheduler.id !== 'brain-scheduler' || scheduler.launchAgentLabel !== 'com.office.nightly-scheduler' || scheduler.timezone !== 'Europe/Lisbon' || scheduler.hour !== 3 || scheduler.minute !== 0 || scheduler.runAtLoad !== true) return { registry: null, error: registryError() };
  const ids = new Set<string>();
  const invalid = registry.jobs.some((job) => {
    const unknownJob = job as unknown as Record<string, unknown>;
    if (!isRecord(unknownJob) || requiredJobFields.some((field) => unknownJob[field] === undefined) || typeof job.id !== 'string' || ids.has(job.id)) return true;
    ids.add(job.id);
    if (!validLifecycle.has(job.lifecycle) || !validSchedule.has(job.scheduleType) || !['ACTIVE', 'BLOCKED', 'NEEDS REVIEW', 'OBSOLETE'].includes(job.reviewCategory) || !Array.isArray(job.fixedArguments) || !Array.isArray(job.dependencies) || !Array.isArray(job.outputArtifacts) || !Array.isArray(job.tags)) return true;
    if (job.lifecycle === 'active' && (job.mode === 'disabled' || job.credentialSensitive || job.destructive || job.mindWrite || job.networkAccess === 'external-write-capable' || !['brain', 'mind-read-only'].includes(job.authority) || !['report-only', 'dry-run-report-only'].includes(job.mode))) return true;
    return false;
  });
  if (invalid || registry.jobs.some((job) => job.dependencies.some((dependency) => !ids.has(dependency)))) return { registry: null, error: registryError() };
  return { registry, error: null };
}

function lisbonParts(date: Date): Record<string, string> {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date).map((part) => [part.type, part.value]));
}
function lisbonOffsetMs(date: Date): number {
  const value = new Intl.DateTimeFormat('en', { timeZone: 'Europe/Lisbon', timeZoneName: 'longOffset' }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = value.match(/GMT([+-])(\d{2}):?(\d{2})?/); if (!match) return 0;
  return (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) * 60_000;
}
function localDateTime(date: string, hour: number, minute: number): Date {
  const parts = date.split('-').map(Number); const year = parts[0] ?? 1970; const month = parts[1] ?? 1; const day = parts[2] ?? 1; const approximate = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(approximate - lisbonOffsetMs(new Date(approximate)));
}
function nextDailyRunAt(now: Date, hour = 3, minute = 0): string {
  const parts = lisbonParts(now); const today = localDateTime(`${parts.year}-${parts.month}-${parts.day}`, hour, minute);
  if (today.getTime() > now.getTime()) return today.toISOString();
  const next = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + 1));
  return localDateTime(next.toISOString().slice(0, 10), hour, minute).toISOString();
}
function parseTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null; const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function parseLegacyTimestamp(value: string | undefined): string | null {
  if (!value) return null; const iso = parseTimestamp(value); if (iso) return iso;
  const parsed = new Date(`${value.replace(/ (WEST|WET|CEST|CET)$/, '')} GMT+0000`); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function readLegacyState(jobId: string): Record<string, string> {
  const parsed: Record<string, string> = {}; for (const line of readText(path.join(STATE_DIR, `${jobId}.last`)).split('\n')) { const index = line.indexOf('='); if (index > 0) parsed[line.slice(0, index)] = line.slice(index + 1); }
  return parsed;
}
function activePid(): { present: boolean; held: boolean; stale: boolean; pid: number | null; currentJobId: string | null } {
  const lockDir = path.join(STATE_DIR, 'nightly.lock'); const present = fs.existsSync(lockDir); if (!present) return { present, held: false, stale: false, pid: null, currentJobId: null };
  const pid = Number.parseInt(readText(path.join(lockDir, 'pid')).trim(), 10); let held = false;
  if (Number.isInteger(pid) && pid > 0) { try { process.kill(pid, 0); held = true; } catch { held = false; } }
  return { present, held, stale: !held, pid: Number.isInteger(pid) ? pid : null, currentJobId: readText(path.join(lockDir, 'current_job')).trim() || null };
}
function lifecycleDefault(job: RegistryJob): { status: InfraSchedulerJobStatus; reason: string | null } {
  if (job.lifecycle === 'policy-blocked') return { status: 'blocked', reason: 'policy-blocked' };
  if (job.lifecycle === 'disabled' || job.lifecycle === 'deprecated') return { status: 'disabled', reason: job.lifecycle };
  if (job.lifecycle === 'manual-only') return { status: 'skipped', reason: 'manual-only' };
  return { status: 'never-run', reason: null };
}
function recentHistory(jobId: string, history: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const matches: Array<Record<string, unknown>> = [];
  for (const item of history) {
    if (item.jobId === jobId) matches.push(item);
    if (Array.isArray(item.receipts)) for (const receipt of item.receipts) if (isRecord(receipt) && receipt.jobId === jobId) matches.push({ runAt: item.endedAt ?? item.createdAt ?? null, trigger: item.trigger ?? null, overallStatus: item.status ?? null, ...receipt });
  }
  return matches.slice(-10);
}
function buildJob(job: RegistryJob, history: Array<Record<string, unknown>>, lock: ReturnType<typeof activePid>, now: Date): InfraSchedulerJob {
  const receiptValue = readJson(path.join(STATE_DIR, 'receipts', `${job.id}.json`)); const receipt = isRecord(receiptValue) ? receiptValue : null;
  const legacy = readLegacyState(job.id); const fallback = lifecycleDefault(job); const isRunning = lock.held && lock.currentJobId === job.id;
  const status = isRunning ? 'running' : job.lifecycle !== 'active' ? fallback.status : (receipt?.status as InfraSchedulerJobStatus | undefined) ?? (legacy.status === 'never' ? 'never-run' : (legacy.status as InfraSchedulerJobStatus | undefined) ?? 'never-run');
  const lastRunAt = parseTimestamp(receipt?.endedAt) ?? parseLegacyTimestamp(legacy.updated_at_lisbon);
  const nextRunAt = job.lifecycle === 'active' && job.scheduleType === 'daily' ? nextDailyRunAt(now) : null;
  const durationValue = receipt?.durationSeconds ?? (legacy.duration_seconds ? Number(legacy.duration_seconds) : null);
  const exitValue = receipt?.exitCode ?? (legacy.exit_code ? Number(legacy.exit_code) : null);
  const error = redact(receipt?.errorMessage ?? legacy.error_message);
  const artifactPaths = Array.isArray(receipt?.artifacts) ? receipt.artifacts.filter((item): item is string => typeof item === 'string') : job.outputArtifacts;
  return {
    key: job.id, id: job.id, label: job.name, name: job.name, description: job.description, owner: job.owner, planned: true, enabled: job.lifecycle === 'active', executed: Boolean(lastRunAt) || ['success', 'failed', 'timeout', 'running'].includes(status),
    status, lifecycle: job.lifecycle, mode: job.mode, entrypoint: job.entrypoint, fixedArguments: job.fixedArguments, dependencies: job.dependencies,
    scheduleType: job.scheduleType, schedule: job.schedule, authority: job.authority, networkAccess: job.networkAccess, credentialSensitive: job.credentialSensitive,
    destructive: job.destructive, mindWrite: job.mindWrite, timeoutSeconds: job.timeoutSeconds, retries: job.retries, concurrency: job.concurrency, idempotency: job.idempotency,
    exitCode: typeof exitValue === 'number' && Number.isFinite(exitValue) ? exitValue : null, durationSeconds: typeof durationValue === 'number' && Number.isFinite(durationValue) ? durationValue : null,
    lastRunAt, nextRunAt, latestError: error, errorMessage: error, artifacts: job.outputArtifacts, artifactPaths, receiptPath: path.join(STATE_DIR, 'receipts', `${job.id}.json`),
    skippedReason: isRunning ? null : (receipt?.skippedReason as string | undefined) ?? fallback.reason, trigger: (receipt?.trigger as string | undefined) ?? null,
    policyReason: job.policyReason, runbook: job.runbook, tags: job.tags, humanAction: job.humanAction, reviewCategory: job.reviewCategory, evidenceState: job.evidenceState, recentHistory: recentHistory(job.id, history),
  };
}

function readHistory(): Array<Record<string, unknown>> { return readText(path.join(STATE_DIR, 'history.jsonl')).split('\n').filter(Boolean).slice(-20).map((line) => readJsonLine(line)).filter(isRecord); }
function readJsonLine(line: string): unknown { try { return JSON.parse(line); } catch { return null; } }
function readReport(): InfraSchedulerReport {
  const content = readText(REPORT_PATH); if (!content) return { available: false, path: REPORT_PATH, summary: 'scheduler report unavailable', generatedAt: null, failureCount: 0 };
  const generatedAt = content.match(/^Generated at:\s*(.+)$/m)?.[1] ?? null; const failureCount = (content.match(/\| `(?:failed|timeout)` \|/g) ?? []).length;
  return { available: true, path: REPORT_PATH, summary: `${generatedAt ?? 'scheduler report present'} · ${failureCount ? `failures: ${failureCount}` : 'no failed scheduler jobs'}`, generatedAt, failureCount };
}
function launchEvidence(registry: Registry): Record<string, unknown> {
  const source = path.join(REPO_ROOT, 'operations/system-configs/launchagents/com.office.nightly-scheduler.plist'); const installed = INSTALLED_PLIST;
  let sameTarget = false; try { sameTarget = realpathSync(source) === realpathSync(installed); } catch { sameTarget = false; }
  return { sourcePath: source, installedPath: installed, sourceExists: fs.existsSync(source), installedExists: fs.existsSync(installed), matchesSource: sameTarget, label: registry.scheduler.launchAgentLabel, calendar: registry.scheduler.schedule, runAtLoad: registry.scheduler.runAtLoad };
}

export async function getInfraOfficeScheduler(): Promise<InfraSchedulerStatus> {
  const loaded = loadRegistry(); if (!loaded.registry) return loaded.error;
  const registry = loaded.registry; const now = new Date(); const lock = activePid(); const history = readHistory(); const jobs = registry.jobs.map((job) => buildJob(job, history, lock, now));
  const latestValue = readJson(path.join(STATE_DIR, 'scheduler-latest.json')); const latest = isRecord(latestValue) ? latestValue : null; const launch = launchEvidence(registry); const report = readReport();
  const lifecycleCounts = Object.fromEntries(['active', 'manual-only', 'policy-blocked', 'disabled', 'deprecated'].map((key) => [key, registry.jobs.filter((job) => job.lifecycle === key).length])) as Record<string, number>;
  const counts: Record<string, number> = { total: jobs.length, ...lifecycleCounts, executed: jobs.filter((job) => job.executed).length, running: jobs.filter((job) => job.status === 'running').length, successful: jobs.filter((job) => job.status === 'success').length, failed: jobs.filter((job) => job.status === 'failed').length, timeout: jobs.filter((job) => job.status === 'timeout').length, skipped: jobs.filter((job) => job.status === 'skipped').length, blocked: jobs.filter((job) => job.status === 'blocked').length, neverRun: jobs.filter((job) => job.status === 'never-run').length };
  const activeFailures = jobs.some((job) => job.lifecycle === 'active' && ['failed', 'timeout'].includes(job.status)); const missingActiveReceipts = jobs.some((job) => job.lifecycle === 'active' && !fs.existsSync(job.receiptPath));
  const failed = !launch.sourceExists || !launch.installedExists || (launch.installedExists && !launch.matchesSource) || lock.stale || latest?.status === 'failed';
  const warning = !failed && (activeFailures || missingActiveReceipts || (counts['policy-blocked'] ?? 0) > 0 || !report.available);
  const health: InfraSchedulerHealth = failed ? 'failed' : warning ? 'warning' : 'healthy';
  const lastRun = latest ? { status: latest.status, startedAt: latest.startedAt ?? null, endedAt: latest.endedAt ?? null, durationSeconds: typeof latest.startedAt === 'string' && typeof latest.endedAt === 'string' ? Math.max(0, Math.round((new Date(latest.endedAt).getTime() - new Date(latest.startedAt).getTime()) / 1000)) : null, trigger: latest.trigger ?? null, failedJobIds: latest.failedJobIds ?? [] } : null;
  return {
    status: health === 'failed' ? 'error' : registry.jobs.length === 0 ? 'not-configured' : 'ok', displayName: registry.scheduler.name, health,
    launchMechanism: registry.scheduler.launchMechanism, launchAgentLabel: registry.scheduler.launchAgentLabel, timezone: registry.scheduler.timezone, scheduleType: registry.scheduler.scheduleType,
    schedule: registry.scheduler.schedule, runAtLoad: registry.scheduler.runAtLoad, launch, manifest: { path: MANIFEST_PATH, valid: true, version: registry.registryVersion, authority: registry.authority, jobCount: registry.jobs.length, lifecycleCounts },
    lock, lastRun, latestOverallResult: latest, nextRunAt: nextDailyRunAt(now, registry.scheduler.hour, registry.scheduler.minute), counts, jobs, history,
    totalJobs: jobs.length, plannedJobs: jobs.filter((job) => job.planned).length, executedJobs: counts.executed ?? 0, runningJobs: counts.running ?? 0, successfulJobs: counts.successful ?? 0, failedJobs: counts.failed ?? 0,
    timeoutJobs: counts.timeout ?? 0, neverRunJobs: counts.neverRun ?? 0, skippedJobs: counts.skipped ?? 0, blockedJobs: counts.blocked ?? 0, disabledJobs: (counts.disabled ?? 0) + (counts.deprecated ?? 0), report,
    ...(failed ? { error: 'Brain Scheduler launch or latest-run evidence is not healthy.' } : {}),
  };
}
