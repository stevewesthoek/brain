import type {
  BrainCoreExecutionPlan,
  BrainCoreExecutionReadiness,
} from '../types/api.js';

const CANDIDATE_KINDS = ['scheduler-run-model-router-dry-run'] as const;

export type BrainCoreExecutionCandidateKind = typeof CANDIDATE_KINDS[number];

export function listExecutionPlans(): BrainCoreExecutionPlan[] {
  return [createModelRouterDryRunPlan()];
}

export function getExecutionPlan(kind: string): BrainCoreExecutionPlan | undefined {
  return listExecutionPlans().find((plan) => plan.kind === kind);
}

export function getExecutionReadiness(): BrainCoreExecutionReadiness {
  return {
    executionEnabled: false,
    candidateCount: listExecutionPlans().length,
    readyCandidateCount: 0,
    blockers: [
      'execution disabled globally',
      'manual operator approval UX not verified',
      'rollback drill not performed',
    ],
    writesToMind: false,
    executableActions: false,
  };
}

export function getExecutionCandidateKinds(): BrainCoreExecutionCandidateKind[] {
  return [...CANDIDATE_KINDS];
}

export function getExecutionPlanPreview(kind: string): string | undefined {
  const plan = getExecutionPlan(kind);
  return plan?.summary;
}

function createModelRouterDryRunPlan(): BrainCoreExecutionPlan {
  return {
    kind: 'scheduler-run-model-router-dry-run',
    candidate: true,
    executionEnabled: false,
    wouldExecute: false,
    executed: false,
    riskLevel: 'low',
    writesToMind: false,
    externalSideEffects: false,
    requiresApproval: true,
    requiresDurableApprovalStore: true,
    requiresDurableAudit: true,
    requiresRollbackPlan: true,
    rollbackPlan: 'Remove generated runtime/local/model-router report files if needed; no Mind content is changed.',
    summary: 'Report-only model-router dry-run candidate. Safe first execution-gate target remains disabled.',
    steps: [
      {
        id: 'validate-model-router',
        description: 'Run model-router CI',
        commandPreview: 'npm run --prefix projects/model-router ci',
        willRunNow: false,
      },
      {
        id: 'write-runtime-report',
        description: 'Run report-only model-router dry-run helper',
        commandPreview: 'bash tools/scripts/model-router-dry-run-report.sh',
        willRunNow: false,
      },
    ],
  };
}
