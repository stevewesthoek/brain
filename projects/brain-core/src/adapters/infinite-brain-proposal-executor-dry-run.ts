/**
 * Infinite Brain Proposal Executor Dry-Run
 * Generates dry-run report describing what would execute if execution were allowed
 * This phase: dry-run contract only, no execution, no writes to Mind
 *
 * Input:
 *   - runtime/local/infinite-brain/proposal-application-plan-latest.json
 *   - runtime/local/infinite-brain/proposal-execution-readiness-latest.json
 *
 * Output:
 *   - runtime/local/infinite-brain/proposal-executor-dry-run-latest.json
 *
 * Safety: canExecute: false, dryRunOnly: true, executionBlocked: true, writesToMind: false
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_DRY_RUN_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-executor-dry-run-latest.json';
const PLAN_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-application-plan-latest.json';
const READINESS_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-execution-readiness-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export interface ExecutorDryRunValidationCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'fail' | 'uncertain';
  reason: string;
}

export interface ExecutorDryRunOperation {
  operationId: string;
  stepId: string;
  proposalId: string;
  category: string;
  operationType: string;
  targetPathsPreview: string[];
  wouldWriteToMind: boolean;
  wouldDeleteFiles: boolean;
  wouldMoveFiles: boolean;
  dryRunOnly: boolean;
  executionBlocked: boolean;
  applied: boolean;
  rollbackPreview: string;
  validationChecks: ExecutorDryRunValidationCheck[];
}

export interface ExecutorDryRunSafety {
  writesToMind: boolean;
  appliesProposals: boolean;
  canExecute: boolean;
  dryRunOnly: boolean;
  executionBlocked: boolean;
  deletesFiles: boolean;
  movesFiles: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
}

export interface ExecutorDryRunReport {
  reportId: string;
  generatedAt: string;
  applicationPlanId: string | null;
  readinessReportId: string | null;
  status: 'blocked' | 'dry-run-ready';
  canExecute: boolean;
  wouldExecuteSteps: number;
  blockedSteps: number;
  operations: ExecutorDryRunOperation[];
  blockers: string[];
  safety: ExecutorDryRunSafety;
}

interface ApplicationPlanStep {
  stepId: string;
  proposalId: string;
  category: string;
  proposedAction: string;
  sourcePaths: string[];
  targetPathsPreview: string[];
  wouldWriteToMind: boolean;
  requiresApproval: boolean;
  executionBlocked: boolean;
  applied: boolean;
  rollbackRequired: boolean;
  rollbackPlanPreview: string;
  riskLevel: string;
  confidence: number;
  reason: string;
}

interface ApplicationPlan {
  planId: string;
  status: string;
  totalApprovedProposals: number;
  totalPlannedSteps: number;
  steps: ApplicationPlanStep[];
  safety: Record<string, unknown>;
}

interface ExecutionReadinessCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'fail' | 'blocked' | 'not-applicable';
  reason: string;
  requiredForExecution: boolean;
}

interface ExecutionReadinessReport {
  reportId: string;
  generatedAt: string;
  applicationPlanId: string | null;
  status: 'blocked';
  canExecute: boolean;
  totalSteps: number;
  executableSteps: number;
  blockedSteps: number;
  blockers: string[];
  checks: ExecutionReadinessCheck[];
  safety: Record<string, unknown>;
}

function getDefaultDryRunPath(): string {
  const envPath = process.env.IBR_PROPOSAL_EXECUTOR_DRY_RUN_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_DRY_RUN_RELATIVE_PATH);
}

function getPlanPath(): string {
  const envPath = process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, PLAN_REPORT_RELATIVE_PATH);
}

function getReadinessPath(): string {
  const envPath = process.env.IBR_PROPOSAL_EXECUTION_READINESS_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, READINESS_REPORT_RELATIVE_PATH);
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function generateOperationId(stepId: string, category: string): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${stepId}-${category}`)
    .digest('hex')
    .substring(0, 12);
  return `op-${hash}`;
}

function generateReportId(planId: string | null, readinessId: string | null, steps: ApplicationPlanStep[]): string {
  const stepIds = (steps || []).map(s => s.stepId).sort();
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      planId: planId || 'no-plan',
      readinessId: readinessId || 'no-readiness',
      stepIds,
    }))
    .digest('hex')
    .substring(0, 12);
  return `dryrun-${hash}`;
}

function mapOperationType(category: string): string {
  switch (category) {
    case 'atomization':
      return 'preview_atomic_note_creation';
    case 'entity-metadata':
      return 'preview_metadata_update';
    case 'edge-review':
      return 'preview_edge_review';
    case 'cleanup':
      return 'preview_cleanup_review';
    case 'wiki-writing':
      return 'preview_wiki_page_creation';
    case 'task-extraction':
      return 'preview_task_creation';
    default:
      return 'preview_manual_review';
  }
}

function generateSafetyBlock(): ExecutorDryRunSafety {
  return {
    writesToMind: false,
    appliesProposals: false,
    canExecute: false,
    dryRunOnly: true,
    executionBlocked: true,
    deletesFiles: false,
    movesFiles: false,
    continuousRuntime: false,
    modelCalls: false,
  };
}

export function generateExecutorDryRunReport(): ExecutorDryRunReport {
  const planPath = getPlanPath();
  const readinessPath = getReadinessPath();

  const plan = readJsonSafely<ApplicationPlan>(planPath);
  const readiness = readJsonSafely<ExecutionReadinessReport>(readinessPath);

  const operations: ExecutorDryRunOperation[] = [];
  const blockers: string[] = [];

  if (plan && plan.steps) {
    for (const step of plan.steps) {
      const operationId = generateOperationId(step.stepId, step.category);

      operations.push({
        operationId,
        stepId: step.stepId,
        proposalId: step.proposalId,
        category: step.category,
        operationType: mapOperationType(step.category),
        targetPathsPreview: step.targetPathsPreview,
        wouldWriteToMind: step.wouldWriteToMind,
        wouldDeleteFiles: false,
        wouldMoveFiles: false,
        dryRunOnly: true,
        executionBlocked: true,
        applied: false,
        rollbackPreview: step.rollbackPlanPreview,
        validationChecks: [
          {
            checkId: 'validate-0',
            label: 'Target paths exist or are creatable',
            status: 'uncertain',
            reason: 'Validation deferred to execution phase',
          },
          {
            checkId: 'validate-1',
            label: 'No conflicts with existing files',
            status: 'uncertain',
            reason: 'Validation deferred to execution phase',
          },
        ],
      });
    }
  }

  if (readiness && readiness.blockers) {
    blockers.push(...readiness.blockers);
  }

  const totalSteps = plan?.totalPlannedSteps || 0;
  const blockedSteps = totalSteps; // All steps blocked in dry-run phase
  const wouldExecuteSteps = 0; // No execution in dry-run

  const status = readiness?.canExecute === false ? 'blocked' : 'dry-run-ready';

  return {
    reportId: generateReportId(plan?.planId || null, readiness?.reportId || null, plan?.steps || []),
    generatedAt: new Date().toISOString(),
    applicationPlanId: plan?.planId || null,
    readinessReportId: readiness?.reportId || null,
    status,
    canExecute: false,
    wouldExecuteSteps,
    blockedSteps,
    operations,
    blockers,
    safety: generateSafetyBlock(),
  };
}

export function writeExecutorDryRunReport(report: ExecutorDryRunReport): boolean {
  try {
    const dryRunPath = getDefaultDryRunPath();
    const dryRunDir = path.dirname(dryRunPath);
    fs.mkdirSync(dryRunDir, { recursive: true });
    fs.writeFileSync(dryRunPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readExecutorDryRunReport(): ExecutorDryRunReport | null {
  const dryRunPath = getDefaultDryRunPath();
  return readJsonSafely<ExecutorDryRunReport>(dryRunPath);
}

export function readExecutorDryRunSummary(): {
  available: boolean;
  generatedAt: string | null;
  status: string | null;
  canExecute: boolean;
  wouldExecuteSteps: number;
  blockedSteps: number;
  operationCount: number;
  blockerCount: number;
  dryRunOnly: boolean;
  executionBlocked: boolean;
  safety: ExecutorDryRunSafety;
} | null {
  const report = readExecutorDryRunReport();
  if (!report) {
    return null;
  }

  return {
    available: true,
    generatedAt: report.generatedAt,
    status: report.status,
    canExecute: report.canExecute,
    wouldExecuteSteps: report.wouldExecuteSteps,
    blockedSteps: report.blockedSteps,
    operationCount: report.operations.length,
    blockerCount: report.blockers.length,
    dryRunOnly: true,
    executionBlocked: true,
    safety: report.safety,
  };
}
