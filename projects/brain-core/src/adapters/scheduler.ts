import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreSchedulerJobSummary, BrainCoreSchedulerStatus } from '../types/api.js';

interface MindStewardRuntimeReport {
  job?: string;
  status?: string;
  message?: string;
  endedAtLisbon?: string;
  durationSeconds?: number;
  mode?: string;
  writesToMind?: boolean;
  executableActions?: boolean;
}

const MIND_STEWARD_RUNTIME_REPORT_PATH = 'latest.json';
const MIND_STEWARD_INBOX_RUNTIME_REPORT_PATH = 'inbox-latest.json';
const MIND_STEWARD_INBOX_CLASSIFIER_RUNTIME_REPORT_PATH = 'inbox-classifier-latest.json';
const MIND_STEWARD_INBOX_QUEUE_RUNTIME_REPORT_PATH = 'inbox-queue-latest.json';

export function getSchedulerStatus(): BrainCoreSchedulerStatus {
  const report = readMindStewardRuntimeReport(MIND_STEWARD_RUNTIME_REPORT_PATH);

  if (report) {
    return toRuntimeSchedulerStatus(report, 'Scheduler runtime report is available from the mind-steward dry-run job.');
  }

  return {
    status: 'placeholder',
    enabled: false,
    latestRunStatus: 'unknown',
    source: 'placeholder',
    message: 'Scheduler adapter has no runtime report yet. The Office Nightly Scheduler integration should generate runtime/local/mind-steward/latest.json after the next report-only run.',
  };
}

export function getSchedulerLatestRun(): BrainCoreSchedulerStatus {
  const report = readMindStewardRuntimeReport(MIND_STEWARD_RUNTIME_REPORT_PATH);

  if (report) {
    return toRuntimeSchedulerStatus(report, report.message || 'Latest mind-steward dry-run report loaded.');
  }

  return {
    status: 'placeholder',
    enabled: false,
    latestRunStatus: 'unknown',
    source: 'placeholder',
    message: 'Latest scheduler run metadata is not available yet. Brain Core did not find the mind-steward runtime report.',
  };
}

export function listSchedulerJobs(): BrainCoreSchedulerJobSummary[] {
  const report = readMindStewardRuntimeReport(MIND_STEWARD_RUNTIME_REPORT_PATH);
  const reportStatus = report ? toJobStatus(report.status) : 'placeholder';
  const inboxReport = readMindStewardRuntimeReport(MIND_STEWARD_INBOX_RUNTIME_REPORT_PATH);
  const inboxReportStatus = inboxReport ? toJobStatus(inboxReport.status) : 'placeholder';
  const inboxClassifierReport = readMindStewardRuntimeReport(MIND_STEWARD_INBOX_CLASSIFIER_RUNTIME_REPORT_PATH);
  const inboxClassifierReportStatus = inboxClassifierReport ? toJobStatus(inboxClassifierReport.status) : 'placeholder';
  const inboxQueueReport = readMindStewardRuntimeReport(MIND_STEWARD_INBOX_QUEUE_RUNTIME_REPORT_PATH);
  const inboxQueueReportStatus = inboxQueueReport ? toJobStatus(inboxQueueReport.status) : 'placeholder';

  return [
    {
      id: 'mind-compile-loop',
      name: 'Mind compile loop',
      status: 'placeholder',
      mutationRequired: true,
    },
    {
      id: 'mind-memory-loop',
      name: 'Mind memory loop',
      status: 'placeholder',
      mutationRequired: true,
    },
    {
      id: 'mind-hygiene-loop',
      name: 'Mind hygiene loop',
      status: 'placeholder',
      mutationRequired: true,
    },
    {
      id: 'mind-drift-error-loop',
      name: 'Mind drift/error loop',
      status: 'placeholder',
      mutationRequired: false,
    },
    {
      id: 'mind-steward-dry-run',
      name: 'Mind Steward dry-run report',
      status: reportStatus,
      mutationRequired: false,
    },
    {
      id: 'mind-steward-inbox-dry-run',
      name: 'Mind Steward inbox dry-run report',
      status: inboxReportStatus,
      mutationRequired: false,
    },
    {
      id: 'mind-steward-inbox-classifier-dry-run',
      name: 'Mind Steward inbox classifier dry-run report',
      status: inboxClassifierReportStatus,
      mutationRequired: false,
    },
    {
      id: 'mind-steward-inbox-queue-dry-run',
      name: 'Mind Steward inbox queue dry-run report',
      status: inboxQueueReportStatus,
      mutationRequired: false,
    },
  ];
}

function readMindStewardRuntimeReport(reportFileName: string): MindStewardRuntimeReport | undefined {
  const reportPath = getMindStewardReportPath();

  const resolvedReportPath = path.resolve(path.dirname(reportPath), reportFileName);

  if (!fs.existsSync(resolvedReportPath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(resolvedReportPath, 'utf8')) as MindStewardRuntimeReport;
  } catch {
    return {
      status: 'failed',
      message: 'Mind Steward runtime report exists but could not be parsed.',
    };
  }
}

function getMindStewardReportPath(): string {
  const configuredPath = process.env.BRAIN_CORE_MIND_STEWARD_REPORT_PATH;

  if (configuredPath && !configuredPath.includes('..')) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), '../..', 'runtime/local/mind-steward/latest.json');
}

function toRuntimeSchedulerStatus(
  report: MindStewardRuntimeReport,
  fallbackMessage: string,
): BrainCoreSchedulerStatus {
  const status = toLatestRunStatus(report.status);
  const result: BrainCoreSchedulerStatus = {
    status: 'runtime-report',
    enabled: true,
    latestRunStatus: status,
    source: 'runtime-report',
    message: report.message || fallbackMessage,
  };

  if (report.endedAtLisbon) {
    result.latestRunAt = report.endedAtLisbon;
  }

  return result;
}

function toLatestRunStatus(status: string | undefined): 'ok' | 'failed' | 'unknown' {
  if (status === 'success' || status === 'ok') {
    return 'ok';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'unknown';
}

function toJobStatus(status: string | undefined): BrainCoreSchedulerJobSummary['status'] {
  if (status === 'success' || status === 'ok') {
    return 'ok';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'placeholder';
}
