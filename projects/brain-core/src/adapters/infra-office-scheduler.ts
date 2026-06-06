import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type InfraOfficeSchedulerJobStatus = 'success' | 'failed' | 'timeout' | 'never' | 'running';

export interface InfraOfficeSchedulerJob {
  key: string;
  label: string;
  planned: true;
  executed: boolean;
  status: InfraOfficeSchedulerJobStatus;
  exitCode: number | null;
  durationSeconds: number | null;
  lastRunAt: string | null;
  nextRunAt: string;
  errorMessage: string | null;
}

export interface InfraOfficeSchedulerReport {
  available: boolean;
  path: string;
  summary: string;
  generatedAt: string | null;
  failureCount: number;
}

export interface InfraOfficeSchedulerStatus {
  status: 'ok' | 'not-configured' | 'error';
  jobs: InfraOfficeSchedulerJob[];
  totalJobs: number;
  plannedJobs: number;
  executedJobs: number;
  runningJobs: number;
  successfulJobs: number;
  failedJobs: number;
  timeoutJobs: number;
  neverRunJobs: number;
  nextRunAt: string;
  report: InfraOfficeSchedulerReport;
  error?: string;
}

const SCHEDULER_JOB_ORDER: Array<{ key: string; label: string }> = [
  { key: 'stb-pipeline-batch', label: 'STB Pipeline' },
  { key: 'n8n-backup', label: 'n8n Backup' },
  { key: 'claude-session-cleanup', label: 'Claude Cleanup' },
  { key: 'ing-bank-statement-download', label: 'ING Bank Statement' },
  { key: 'dance-of-life-sync', label: 'Dance of Life (1) Download' },
  { key: 'bible-studies-pipeline', label: 'Dance of Life (2) Transcribe' },
  { key: 'gemini-cleanup', label: 'Gemini Cleanup' },
  { key: 'graphify-nightly', label: 'Graphify Nightly' },
  { key: 'skill-prune', label: 'Skill Prune' },
];

const STATE_DIR = path.join(os.homedir(), '.local', 'state', 'office-scheduler');
const LOG_DIR = path.join(os.homedir(), 'Library', 'Logs', 'office-scheduler');
const REPORT_PATH = path.resolve(process.cwd(), '../..', 'runtime', 'local', 'office-scheduler', 'latest-run.md');

function readJsonLinesFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    return fs.readFileSync(filePath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

function readRunningJobKey(): string | null {
  const lockPidFile = path.join(STATE_DIR, 'nightly.lock', 'pid');
  try {
    const pid = parseInt(fs.readFileSync(lockPidFile, 'utf8').trim(), 10);
    if (Number.isNaN(pid)) return null;
    try {
      process.kill(pid, 0);
    } catch {
      return null;
    }

    const logLines = readJsonLinesFile(path.join(LOG_DIR, 'nightly.log'));
    for (let i = logLines.length - 1; i >= 0; i--) {
      const match = logLines[i]?.match(/starting job=(\S+)/);
      if (!match?.[1]) continue;
      const jobKey = match[1];
      const finished = logLines.slice(i + 1).some((line) => line.includes(`finished job=${jobKey}`));
      if (!finished) return jobKey;
      break;
    }
  } catch {
    return null;
  }
  return null;
}

function nextSchedulerRunAt(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Lisbon',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(lookup.year ?? '2026');
  const month = Number(lookup.month ?? '01');
  const day = Number(lookup.day ?? '01');
  const hour = Number(lookup.hour ?? '0');
  const nextDay = hour >= 3 ? day + 1 : day;
  return new Date(Date.UTC(year, month - 1, nextDay, 3, 0, 0)).toISOString();
}

function readReport(): InfraOfficeSchedulerReport {
  if (!fs.existsSync(REPORT_PATH)) {
    return {
      available: false,
      path: REPORT_PATH,
      summary: 'scheduler report unavailable',
      generatedAt: null,
      failureCount: 0,
    };
  }

  try {
    const content = fs.readFileSync(REPORT_PATH, 'utf8');
    const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
    const generatedLine = lines.find((line) => line.startsWith('Generated at:'));
    const failureCount = lines.filter((line) => line.includes('| `failed` |')).length;
    const summary = generatedLine
      ? `${generatedLine.replace('Generated at: ', '')}${failureCount > 0 ? ` · failures: ${failureCount}` : ' · no failed scheduler jobs'}`
      : failureCount > 0
        ? `scheduler report present · failures: ${failureCount}`
        : 'scheduler report present';

    return {
      available: true,
      path: REPORT_PATH,
      summary,
      generatedAt: generatedLine ? generatedLine.replace('Generated at: ', '') : null,
      failureCount,
    };
  } catch {
    return {
      available: false,
      path: REPORT_PATH,
      summary: 'scheduler report unreadable',
      generatedAt: null,
      failureCount: 0,
    };
  }
}

function parseStateFile(filePath: string): Record<string, string> {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed: Record<string, string> = {};
  for (const line of raw.trim().split('\n')) {
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    parsed[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return parsed;
}

function parseLastRunAt(value: string | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/ (WEST|WET|CEST|CET)$/, '');
  const parsed = new Date(`${cleaned} GMT+0000`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildJobState(key: string, label: string, runningKey: string | null): InfraOfficeSchedulerJob {
  const stateFile = path.join(STATE_DIR, `${key}.last`);

  if (!fs.existsSync(stateFile)) {
    return {
      key,
      label,
      planned: true,
      executed: false,
      status: runningKey === key ? 'running' : 'never',
      exitCode: null,
      durationSeconds: null,
      lastRunAt: null,
      nextRunAt: nextSchedulerRunAt(),
      errorMessage: null,
    };
  }

  try {
    const parsed = parseStateFile(stateFile);
    const status = (runningKey === key ? 'running' : (parsed.status ?? 'failed')) as InfraOfficeSchedulerJobStatus;
    return {
      key,
      label,
      planned: true,
      executed: status !== 'never',
      status,
      exitCode: parsed.exit_code !== undefined ? Number.parseInt(parsed.exit_code, 10) : null,
      durationSeconds: parsed.duration_seconds !== undefined ? Number.parseInt(parsed.duration_seconds, 10) : null,
      lastRunAt: parseLastRunAt(parsed.updated_at_lisbon),
      nextRunAt: nextSchedulerRunAt(),
      errorMessage: parsed.error_message?.trim() || null,
    };
  } catch {
    return {
      key,
      label,
      planned: true,
      executed: false,
      status: runningKey === key ? 'running' : 'failed',
      exitCode: null,
      durationSeconds: null,
      lastRunAt: null,
      nextRunAt: nextSchedulerRunAt(),
      errorMessage: 'Scheduler state file exists but could not be parsed.',
    };
  }
}

export async function getInfraOfficeScheduler(): Promise<InfraOfficeSchedulerStatus> {
  try {
    const runningKey = readRunningJobKey();
    const jobs = SCHEDULER_JOB_ORDER.map(({ key, label }) => buildJobState(key, label, runningKey));
    const report = readReport();
    const totalJobs = jobs.length;
    const plannedJobs = jobs.filter((job) => job.planned).length;
    const executedJobs = jobs.filter((job) => job.executed).length;
    const runningJobs = jobs.filter((job) => job.status === 'running').length;
    const successfulJobs = jobs.filter((job) => job.status === 'success').length;
    const failedJobs = jobs.filter((job) => job.status === 'failed').length;
    const timeoutJobs = jobs.filter((job) => job.status === 'timeout').length;
    const neverRunJobs = jobs.filter((job) => job.status === 'never').length;
    const configured = report.available || jobs.some((job) => job.status !== 'never');

    return {
      status: configured ? 'ok' : 'not-configured',
      jobs,
      totalJobs,
      plannedJobs,
      executedJobs,
      runningJobs,
      successfulJobs,
      failedJobs,
      timeoutJobs,
      neverRunJobs,
      nextRunAt: nextSchedulerRunAt(),
      report,
    };
  } catch (error) {
    return {
      status: 'error',
      jobs: [],
      totalJobs: 0,
      plannedJobs: 0,
      executedJobs: 0,
      runningJobs: 0,
      successfulJobs: 0,
      failedJobs: 0,
      timeoutJobs: 0,
      neverRunJobs: 0,
      nextRunAt: nextSchedulerRunAt(),
      report: {
        available: false,
        path: REPORT_PATH,
        summary: 'scheduler report unavailable',
        generatedAt: null,
        failureCount: 0,
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
