import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listSchedulerJobs } from './scheduler.js';
import type {
  BrainCoreMindMaintenanceReportOnlySchedule,
  BrainCoreMindMaintenanceReportOnlyScheduleReason,
  BrainCoreSchedulerJobSummary,
} from '../types/api.js';

interface MindMaintenanceLatestReport {
  schemaVersion?: string;
  reportId?: string;
  generatedAt?: string;
  mode?: string;
  sourceRepo?: string;
  summary?: {
    findingsOpen?: number;
    detectorErrors?: number;
    filesConsidered?: number;
    findingsTotal?: number;
  };
  errors?: unknown[];
  noWritePerformed?: boolean;
}

interface MindMaintenanceScheduleOptions {
  now?: Date;
  staleAfterHours?: number;
  mindRoot?: string;
  latestReport?: MindMaintenanceLatestReport | null;
  schedulerJobs?: BrainCoreSchedulerJobSummary[];
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');
const DEFAULT_MIND_ROOT = path.resolve(BRAIN_ROOT, '..', 'mind');
const DEFAULT_STALE_AFTER_HOURS = 24;
const SCHEDULER_JOB_ID = 'mind-maintenance-report-only';

const SAFETY = {
  planOnly: true,
  reportOnly: true,
  writesToMind: false,
  writesReportsNow: false,
  executesMaintenanceNow: false,
  createsSchedulerJob: false,
  startsBackgroundDaemon: false,
  requiresApprovalForWrites: true,
  mustRunBeforeApprovedWrites: true,
} as const;

export function getMindMaintenanceReportOnlySchedule(
  options: MindMaintenanceScheduleOptions = {},
): BrainCoreMindMaintenanceReportOnlySchedule {
  const now = options.now ?? new Date();
  const staleAfterHours = options.staleAfterHours ?? DEFAULT_STALE_AFTER_HOURS;
  const mindRoot = path.resolve(options.mindRoot ?? process.env.BRAIN_CORE_MIND_MAINTENANCE_MIND_ROOT ?? DEFAULT_MIND_ROOT);
  const reportPath = path.join(mindRoot, 'system', 'reports', 'maintenance-latest.json');
  const latestReport = options.latestReport === undefined ? readLatestReport(reportPath) : options.latestReport;
  const jobs = options.schedulerJobs ?? listSchedulerJobs();
  const job = jobs.find(candidate => candidate.id === SCHEDULER_JOB_ID) ?? null;
  const analysis = analyzeLatestReport(latestReport, now, staleAfterHours);
  const scheduleRecommended = analysis.reasons.length > 0;
  const blockers = new Set<string>(analysis.reasons);
  if (!job) blockers.add('maintenanceSchedulerJobMissing');
  for (const blocker of job?.blockers ?? []) blockers.add(blocker);

  return {
    id: 'mind-maintenance-report-only-schedule',
    status: scheduleRecommended ? 'schedule-recommended' : 'fresh',
    generatedAt: now.toISOString(),
    source: 'brain-core-scheduler-plan',
    schedulerJobId: SCHEDULER_JOB_ID,
    requestEndpoint: '/api/mind-maintenance/run',
    latestReportEndpoint: '/api/mind-maintenance/latest?mindRoot=<path>',
    cadence: 'daily',
    localWindow: '03:00-07:00 Europe/Lisbon',
    staleAfterHours,
    scheduleRecommended,
    approvedWritesBlockedUntilFreshReport: scheduleRecommended,
    approvedWritesRequireHumanReview: (latestReport?.summary?.findingsOpen ?? 0) > 0,
    latestReport: latestReport
      ? {
          available: true,
          path: reportPath,
          reportId: typeof latestReport.reportId === 'string' ? latestReport.reportId : null,
          generatedAt: typeof latestReport.generatedAt === 'string' ? latestReport.generatedAt : null,
          mode: typeof latestReport.mode === 'string' ? latestReport.mode : null,
          noWritePerformed: latestReport.noWritePerformed === true,
          findingsOpen: latestReport.summary?.findingsOpen ?? 0,
          detectorErrors: latestReport.summary?.detectorErrors ?? 0,
          ageHours: analysis.ageHours,
        }
      : {
          available: false,
          path: reportPath,
          reportId: null,
          generatedAt: null,
          mode: null,
          noWritePerformed: false,
          findingsOpen: 0,
          detectorErrors: 0,
          ageHours: null,
        },
    schedulerEligible: job?.schedulerEligible ?? false,
    schedulerEnabled: false,
    manualSuccessRequired: true,
    manualSuccessProven: job?.manualSuccessProven ?? false,
    blockers: [...blockers],
    safety: SAFETY,
  };
}

function readLatestReport(reportPath: string): MindMaintenanceLatestReport | null {
  if (!fs.existsSync(reportPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8')) as MindMaintenanceLatestReport;
  } catch {
    return {
      mode: 'invalid',
      noWritePerformed: false,
    };
  }
}

function analyzeLatestReport(
  report: MindMaintenanceLatestReport | null,
  now: Date,
  staleAfterHours: number,
): { reasons: BrainCoreMindMaintenanceReportOnlyScheduleReason[]; ageHours: number | null } {
  const reasons = new Set<BrainCoreMindMaintenanceReportOnlyScheduleReason>();
  if (!report) {
    reasons.add('maintenanceReportMissing');
    return { reasons: [...reasons], ageHours: null };
  }

  if (report.mode !== 'report-only') reasons.add('maintenanceReportNotReportOnly');
  if (report.noWritePerformed !== true) reasons.add('maintenanceReportNoWriteProofMissing');
  if ((report.summary?.detectorErrors ?? 0) > 0 || (report.errors?.length ?? 0) > 0) {
    reasons.add('maintenanceDetectorErrorsVisible');
  }

  if (!report.generatedAt) {
    reasons.add('maintenanceReportTimestampMissing');
    return { reasons: [...reasons], ageHours: null };
  }

  const generatedAt = Date.parse(report.generatedAt);
  if (!Number.isFinite(generatedAt)) {
    reasons.add('maintenanceReportTimestampMissing');
    return { reasons: [...reasons], ageHours: null };
  }

  const ageHours = Math.max(0, Math.floor((now.getTime() - generatedAt) / (60 * 60 * 1000)));
  if (ageHours >= staleAfterHours) reasons.add('maintenanceReportStale');
  return { reasons: [...reasons], ageHours };
}
