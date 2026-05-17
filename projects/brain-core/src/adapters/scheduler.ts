import fs from 'node:fs';
import path from 'node:path';
import type { BrainCoreSchedulerJobSummary, BrainCoreSchedulerStatus } from '../types/api.js';

interface ModelRouterRuntimeReport {
  job?: string;
  status?: string;
  message?: string;
  endedAtLisbon?: string;
  durationSeconds?: number;
  mode?: string;
  writesToMind?: boolean;
  executableActions?: boolean;
}

export function getSchedulerStatus(): BrainCoreSchedulerStatus {
  const report = readModelRouterRuntimeReport();

  if (report) {
    return toRuntimeSchedulerStatus(report, 'Scheduler runtime report is available from the model-router dry-run job.');
  }

  return {
    status: 'placeholder',
    enabled: false,
    latestRunStatus: 'unknown',
    source: 'placeholder',
    message: 'Scheduler adapter has no runtime report yet. The Office Nightly Scheduler integration should generate runtime/local/model-router/latest.json after the next report-only run.',
  };
}

export function getSchedulerLatestRun(): BrainCoreSchedulerStatus {
  const report = readModelRouterRuntimeReport();

  if (report) {
    return toRuntimeSchedulerStatus(report, report.message || 'Latest model-router dry-run report loaded.');
  }

  return {
    status: 'placeholder',
    enabled: false,
    latestRunStatus: 'unknown',
    source: 'placeholder',
    message: 'Latest scheduler run metadata is not available yet. Brain Core did not find the model-router runtime report.',
  };
}

export function listSchedulerJobs(): BrainCoreSchedulerJobSummary[] {
  const report = readModelRouterRuntimeReport();
  const reportStatus = report ? toJobStatus(report.status) : 'placeholder';

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
      id: 'model-router-dry-run',
      name: 'Model-router dry-run report',
      status: reportStatus,
      mutationRequired: false,
    },
  ];
}

function readModelRouterRuntimeReport(): ModelRouterRuntimeReport | undefined {
  const reportPath = getModelRouterReportPath();

  if (!fs.existsSync(reportPath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as ModelRouterRuntimeReport;
  } catch {
    return {
      status: 'failed',
      message: 'Model-router runtime report exists but could not be parsed.',
    };
  }
}

function getModelRouterReportPath(): string {
  const configuredPath = process.env.BRAIN_CORE_MODEL_ROUTER_REPORT_PATH;

  if (configuredPath && !configuredPath.includes('..')) {
    return path.resolve(configuredPath);
  }

  return path.resolve(process.cwd(), '../..', 'runtime/local/model-router/latest.json');
}

function toRuntimeSchedulerStatus(
  report: ModelRouterRuntimeReport,
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
  if (status === 'success') {
    return 'ok';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'unknown';
}

function toJobStatus(status: string | undefined): BrainCoreSchedulerJobSummary['status'] {
  if (status === 'success') {
    return 'placeholder';
  }

  if (status === 'failed') {
    return 'unknown';
  }

  return 'placeholder';
}
