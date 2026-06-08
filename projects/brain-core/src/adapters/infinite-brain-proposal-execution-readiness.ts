/**
 * Infinite Brain Proposal Execution Readiness
 * Determines whether execution of approved proposals would be allowed
 * This phase: readiness-check only, execution always blocked
 *
 * Input:
 *   - runtime/local/infinite-brain/proposal-application-plan-latest.json
 *
 * Output:
 *   - runtime/local/infinite-brain/proposal-execution-readiness-latest.json
 *
 * Safety: canExecute: false, executionBlocked: true, preview-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const DEFAULT_READINESS_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-execution-readiness-latest.json';
const PLAN_REPORT_RELATIVE_PATH = 'runtime/local/infinite-brain/proposal-application-plan-latest.json';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BRAIN_ROOT = path.resolve(MODULE_DIR, '..', '..', '..', '..');

export interface ExecutionReadinessCheck {
  checkId: string;
  label: string;
  status: 'pass' | 'fail' | 'blocked' | 'not-applicable';
  reason: string;
  requiredForExecution: boolean;
}

export interface ExecutionReadinessSafety {
  writesToMind: boolean;
  appliesProposals: boolean;
  canExecute: boolean;
  executionBlocked: boolean;
  previewOnly: boolean;
  continuousRuntime: boolean;
  modelCalls: boolean;
}

export interface ExecutionReadinessReport {
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
  safety: ExecutionReadinessSafety;
}

interface ApplicationPlanStep {
  stepId: string;
  proposalId: string;
  executionBlocked: boolean;
  applied: boolean;
  rollbackRequired: boolean;
  [key: string]: unknown;
}

interface ApplicationPlan {
  planId: string;
  status: string;
  totalApprovedProposals: number;
  totalPlannedSteps: number;
  steps: ApplicationPlanStep[];
  safety: {
    writesToMind: boolean;
    appliesProposals: boolean;
    executionBlocked: boolean;
    previewOnly: boolean;
  };
}

function getDefaultReadinessPath(): string {
  const envPath = process.env.IBR_PROPOSAL_EXECUTION_READINESS_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, DEFAULT_READINESS_RELATIVE_PATH);
}

function getPlanPath(): string {
  const envPath = process.env.IBR_PROPOSAL_APPLICATION_PLAN_PATH;
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(BRAIN_ROOT, envPath);
  }
  return path.resolve(BRAIN_ROOT, PLAN_REPORT_RELATIVE_PATH);
}

function readJsonSafely<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

function generateReportId(planId: string | null, checks: ExecutionReadinessCheck[]): string {
  const checkIds = checks.map(c => c.checkId).sort();
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      planId: planId || 'no-plan',
      checkIds,
    }))
    .digest('hex')
    .substring(0, 12);
  return `readiness-${hash}`;
}

function generateSafetyBlock(): ExecutionReadinessSafety {
  return {
    writesToMind: false,
    appliesProposals: false,
    canExecute: false,
    executionBlocked: true,
    previewOnly: true,
    continuousRuntime: false,
    modelCalls: false,
  };
}

function performReadinessChecks(plan: ApplicationPlan | null): ExecutionReadinessCheck[] {
  const checks: ExecutionReadinessCheck[] = [];
  let checkIndex = 0;

  // Check 1: Plan exists
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Plan exists',
    status: plan ? 'pass' : 'fail',
    reason: plan ? 'Application plan found' : 'No application plan available',
    requiredForExecution: true,
  });

  // Check 2: Plan is preview-only
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Plan is preview-only',
    status: plan?.status === 'preview-only' ? 'pass' : 'fail',
    reason: plan?.status === 'preview-only'
      ? 'Plan marked as preview-only'
      : 'Plan not marked as preview-only',
    requiredForExecution: true,
  });

  // Check 3: Execution blocked flag
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Execution blocked flag set',
    status: plan?.safety.executionBlocked ? 'blocked' : 'fail',
    reason: plan?.safety.executionBlocked
      ? 'Execution is blocked by design'
      : 'Execution block not enforced',
    requiredForExecution: true,
  });

  // Check 4: No applied steps
  const appliedSteps = plan?.steps.filter(s => s.applied) || [];
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'No steps already applied',
    status: appliedSteps.length === 0 ? 'pass' : 'fail',
    reason: appliedSteps.length === 0
      ? 'No steps marked as applied'
      : `${appliedSteps.length} steps already applied`,
    requiredForExecution: true,
  });

  // Check 5: No Mind write gate
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Mind write gate available',
    status: 'blocked',
    reason: 'Mind write coordination not yet implemented. Execution blocked until iOS sync safety verified.',
    requiredForExecution: true,
  });

  // Check 6: Rollback plans present
  const stepsWithRollback = plan?.steps.filter(s => s.rollbackRequired).length || 0;
  const totalSteps = plan?.totalPlannedSteps || 0;
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Rollback plans present',
    status: stepsWithRollback === totalSteps || totalSteps === 0 ? 'pass' : 'fail',
    reason: stepsWithRollback === totalSteps || totalSteps === 0
      ? 'All mutable steps have rollback plans'
      : `Only ${stepsWithRollback}/${totalSteps} steps have rollback plans`,
    requiredForExecution: true,
  });

  // Check 7: iOS sync safety available
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'iOS sync safety available',
    status: 'blocked',
    reason: 'iOS sync coordination layer not yet implemented. Mind writes remain blocked.',
    requiredForExecution: true,
  });

  // Check 8: Allowlisted writer available
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Allowlisted writer available',
    status: 'blocked',
    reason: 'Execution writer not yet implemented. Proposal application layer not available.',
    requiredForExecution: true,
  });

  // Check 9: Operator approval present
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Operator approval gate',
    status: 'blocked',
    reason: 'Execution approval gate not yet implemented. Execution blocked by default.',
    requiredForExecution: true,
  });

  // Check 10: Dry-run validation present
  checks.push({
    checkId: `check-${checkIndex++}`,
    label: 'Dry-run validation available',
    status: 'not-applicable',
    reason: 'Dry-run validation planned for future phase. Currently not applicable.',
    requiredForExecution: false,
  });

  return checks;
}

export function generateExecutionReadinessReport(): ExecutionReadinessReport {
  const planPath = getPlanPath();
  const plan = readJsonSafely<ApplicationPlan>(planPath);

  const checks = performReadinessChecks(plan);
  const blockedChecks = checks.filter(c => c.status === 'blocked' && c.requiredForExecution);
  const failedChecks = checks.filter(c => c.status === 'fail' && c.requiredForExecution);
  const blockers = [
    ...blockedChecks.map(c => c.label),
    ...failedChecks.map(c => c.label),
  ];

  const totalSteps = plan?.totalPlannedSteps || 0;
  const executableSteps = 0; // Always zero in this phase
  const blockedSteps = totalSteps - executableSteps;

  return {
    reportId: generateReportId(plan?.planId || null, checks),
    generatedAt: new Date().toISOString(),
    applicationPlanId: plan?.planId || null,
    status: 'blocked',
    canExecute: false,
    totalSteps,
    executableSteps,
    blockedSteps,
    blockers,
    checks,
    safety: generateSafetyBlock(),
  };
}

export function writeExecutionReadinessReport(report: ExecutionReadinessReport): boolean {
  try {
    const readinessPath = getDefaultReadinessPath();
    const readinessDir = path.dirname(readinessPath);
    fs.mkdirSync(readinessDir, { recursive: true });
    fs.writeFileSync(readinessPath, `${JSON.stringify(report, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

export function readExecutionReadinessReport(): ExecutionReadinessReport | null {
  const readinessPath = getDefaultReadinessPath();
  return readJsonSafely<ExecutionReadinessReport>(readinessPath);
}

export function readExecutionReadinessSummary(): {
  available: boolean;
  generatedAt: string | null;
  canExecute: boolean;
  totalSteps: number;
  blockedSteps: number;
  blockerCount: number;
  executionBlocked: boolean;
  safety: ExecutionReadinessSafety;
} | null {
  const report = readExecutionReadinessReport();
  if (!report) {
    return null;
  }

  return {
    available: true,
    generatedAt: report.generatedAt,
    canExecute: report.canExecute,
    totalSteps: report.totalSteps,
    blockedSteps: report.blockedSteps,
    blockerCount: report.blockers.length,
    executionBlocked: true,
    safety: report.safety,
  };
}
