import fs from 'node:fs';
import path from 'node:path';
import { getExecutionKillSwitch } from './execution-plans.js';
import type { BrainCoreSchedulerJobSummary, BrainCoreSchedulerStatus } from '../types/api.js';

interface MindStewardRuntimeReport {
  job?: string;
  status?: string;
  message?: string;
  endedAtLisbon?: string;
  durationSeconds?: number;
  mode?: string;
  trigger?: string;
  manualSuccess?: boolean;
  writesToMind?: boolean;
  executableActions?: boolean;
}

const MIND_STEWARD_RUNTIME_REPORT_PATH = 'latest.json';
const MIND_STEWARD_INBOX_RUNTIME_REPORT_PATH = 'inbox-latest.json';
const MIND_STEWARD_INBOX_CLASSIFIER_RUNTIME_REPORT_PATH = 'inbox-classifier-latest.json';
const MIND_STEWARD_INBOX_QUEUE_RUNTIME_REPORT_PATH = 'inbox-queue-latest.json';
const GRAPHIFY_MIND_RUNTIME_REPORT_PATH = 'mind-knowledge-latest.json';
const GRAPHIFY_BRAIN_RUNTIME_REPORT_PATH = 'brain-runtime-latest.json';
const INFINITE_BRAIN_PIPELINE_RUNTIME_REPORT_PATH = '../infinite-brain/pipeline-latest.json';

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

export function getMindStewardSchedulerStatus() {
  const reportDefinitions = [
    { key: 'dryRun', fileName: MIND_STEWARD_RUNTIME_REPORT_PATH },
    { key: 'inbox', fileName: MIND_STEWARD_INBOX_RUNTIME_REPORT_PATH },
    { key: 'classifier', fileName: MIND_STEWARD_INBOX_CLASSIFIER_RUNTIME_REPORT_PATH },
    { key: 'queue', fileName: MIND_STEWARD_INBOX_QUEUE_RUNTIME_REPORT_PATH },
  ] as const;

  const reports = Object.fromEntries(
    reportDefinitions.map(({ key, fileName }) => {
      const report = readMindStewardRuntimeReport(fileName);
      return [
        key,
        {
          available: Boolean(report),
          fileName,
          status: report?.status ?? 'missing',
          message: report?.message ?? null,
          mode: report?.mode ?? null,
          writesToMind: report?.writesToMind ?? null,
          executableActions: report?.executableActions ?? null,
          endedAtLisbon: report?.endedAtLisbon ?? null,
          durationSeconds: report?.durationSeconds ?? null,
        },
      ];
    }),
  );

  const availableCount = Object.values(reports).filter(report => report.available).length;

  return {
    status: availableCount === 0 ? 'missing' : availableCount === reportDefinitions.length ? 'ok' : 'partial',
    source: 'runtime/local/mind-steward',
    reportCount: reportDefinitions.length,
    availableCount,
    reports,
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
  const graphifyMindReport = readGraphifyRuntimeReport(GRAPHIFY_MIND_RUNTIME_REPORT_PATH);
  const graphifyMindReportStatus = graphifyMindReport ? toJobStatus(graphifyMindReport.status) : 'placeholder';
  const graphifyBrainReport = readGraphifyRuntimeReport(GRAPHIFY_BRAIN_RUNTIME_REPORT_PATH);
  const graphifyBrainReportStatus = graphifyBrainReport ? toJobStatus(graphifyBrainReport.status) : 'placeholder';
  const infiniteBrainReport = readGraphifyRuntimeReport(INFINITE_BRAIN_PIPELINE_RUNTIME_REPORT_PATH);
  const infiniteBrainReportStatus = infiniteBrainReport ? toJobStatus(infiniteBrainReport.status) : 'placeholder';

  return [
    withSchedulerManualSuccessGate({
      id: 'mind-compile-loop',
      name: 'Mind compile loop',
      status: 'placeholder',
      mutationRequired: true,
    }),
    withSchedulerManualSuccessGate({
      id: 'mind-memory-loop',
      name: 'Mind memory loop',
      status: 'placeholder',
      mutationRequired: true,
    }),
    withSchedulerManualSuccessGate({
      id: 'mind-hygiene-loop',
      name: 'Mind hygiene loop',
      status: 'placeholder',
      mutationRequired: true,
    }),
    withSchedulerManualSuccessGate({
      id: 'mind-drift-error-loop',
      name: 'Mind drift/error loop',
      status: 'placeholder',
      mutationRequired: false,
    }),
    withSchedulerManualSuccessGate({
      id: 'mind-steward-dry-run',
      name: 'Mind Steward dry-run report',
      status: reportStatus,
      mutationRequired: false,
    }, report, 'scheduler-run-mind-steward-dry-run'),
    withSchedulerManualSuccessGate({
      id: 'mind-maintenance-report-only',
      name: 'Mind maintenance report-only review',
      status: reportStatus,
      mutationRequired: false,
    }, report, 'scheduler-run-mind-steward-dry-run'),
    withSchedulerManualSuccessGate({
      id: 'mind-steward-inbox-dry-run',
      name: 'Mind Steward inbox dry-run report',
      status: inboxReportStatus,
      mutationRequired: false,
    }, inboxReport, 'scheduler-run-mind-steward-inbox-dry-run'),
    withSchedulerManualSuccessGate({
      id: 'mind-steward-inbox-classifier-dry-run',
      name: 'Mind Steward inbox classifier dry-run report',
      status: inboxClassifierReportStatus,
      mutationRequired: false,
    }, inboxClassifierReport, 'scheduler-run-mind-steward-inbox-classifier-dry-run'),
    withSchedulerManualSuccessGate({
      id: 'mind-steward-inbox-queue-dry-run',
      name: 'Mind Steward inbox queue dry-run report',
      status: inboxQueueReportStatus,
      mutationRequired: false,
    }, inboxQueueReport, 'scheduler-run-mind-steward-inbox-queue-dry-run'),
    withSchedulerManualSuccessGate({
      id: 'mind-steward-large-file-nightly-fallback',
      name: 'Mind Steward large-file nightly fallback',
      status: 'placeholder',
      mutationRequired: false,
    }, undefined, 'scheduler-run-mind-steward-large-file-nightly-fallback'),
    withSchedulerManualSuccessGate({
      id: 'graphify-preflight-mind',
      name: 'Graphify Mind preflight report',
      status: graphifyMindReportStatus,
      mutationRequired: false,
    }, graphifyMindReport, 'scheduler-run-graphify-preflight-mind'),
    withSchedulerManualSuccessGate({
      id: 'graphify-preflight-brain',
      name: 'Graphify Brain preflight report',
      status: graphifyBrainReportStatus,
      mutationRequired: false,
    }, graphifyBrainReport, 'scheduler-run-graphify-preflight-brain'),
    withSchedulerManualSuccessGate({
      id: 'graphify-update-mind-blocked',
      name: 'Graphify Mind guarded update blocked report',
      status: graphifyMindReportStatus,
      mutationRequired: false,
    }, graphifyMindReport, 'scheduler-run-graphify-update-mind-blocked'),
    withSchedulerManualSuccessGate({
      id: 'graphify-update-brain-blocked',
      name: 'Graphify Brain guarded update blocked report',
      status: graphifyBrainReportStatus,
      mutationRequired: false,
    }, graphifyBrainReport, 'scheduler-run-graphify-update-brain-blocked'),
    withSchedulerManualSuccessGate({
      id: 'infinite-brain-report-only-pipeline',
      name: 'Infinite Brain report-only pipeline',
      status: infiniteBrainReportStatus,
      mutationRequired: false,
    }, infiniteBrainReport, 'scheduler-run-infinite-brain-report-only-pipeline'),
  ];
}

function withSchedulerManualSuccessGate(
  job: Pick<BrainCoreSchedulerJobSummary, 'id' | 'name' | 'status' | 'mutationRequired'>,
  report?: Pick<MindStewardRuntimeReport, 'status' | 'trigger' | 'manualSuccess'>,
  workflowKind?: string,
): BrainCoreSchedulerJobSummary {
  const manualSuccessProven = Boolean(report && toJobStatus(report.status) === 'ok' && (report.manualSuccess === true || report.trigger === 'on-demand'));
  const killSwitch = getExecutionKillSwitch();
  const blockers: string[] = [];
  if (killSwitch.enabled) blockers.push('executionKillSwitchEnabled');
  if (!workflowKind) blockers.push('schedulerWorkflowNotMappedToOnDemandRun');
  if (job.mutationRequired) blockers.push('schedulerJobRequiresFutureApprovedMutationPolicy');
  if (!manualSuccessProven) blockers.push('manualOnDemandSuccessRequiredBeforeScheduling');

  return {
    ...job,
    ...(workflowKind ? { workflowKind } : {}),
    manualSuccessRequired: true,
    manualSuccessProven,
    schedulerEligible: blockers.length === 0,
    schedulerEnabled: false,
    blockers,
    safety: {
      writesToMind: false,
      createsSchedulerJob: false,
      startsBackgroundDaemon: false,
      requiresManualSuccessBeforeScheduling: true,
    },
  };
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

function readGraphifyRuntimeReport(reportFileName: string): { status?: string; trigger?: string; manualSuccess?: boolean } | undefined {
  const resolvedReportPath = path.resolve(process.cwd(), '../..', 'runtime/local/graphify', reportFileName);

  if (!fs.existsSync(resolvedReportPath)) {
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(resolvedReportPath, 'utf8')) as { status?: string; trigger?: string; manualSuccess?: boolean };
  } catch {
    return { status: 'failed' };
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
  if (status === 'success' || status === 'ok' || status === 'execution-blocked') {
    return 'ok';
  }

  if (status === 'failed') {
    return 'failed';
  }

  return 'placeholder';
}
