import type {
  BrainCoreExecutionPlan,
  BrainCoreExecutionReadiness,
} from '../types/api.js';

const CANDIDATE_KINDS = ['scheduler-run-model-router-dry-run'] as const;
const MODEL_ROUTER_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';

export type BrainCoreExecutionCandidateKind = typeof CANDIDATE_KINDS[number];

export function isModelRouterDryRunExecutionFlagEnabled(): boolean {
  return process.env[MODEL_ROUTER_DRY_RUN_EXECUTION_FLAG]?.trim().toLowerCase() === 'true';
}

export function getModelRouterDryRunExecutionFlagName(): typeof MODEL_ROUTER_DRY_RUN_EXECUTION_FLAG {
  return MODEL_ROUTER_DRY_RUN_EXECUTION_FLAG;
}

export function listExecutionPlans(): BrainCoreExecutionPlan[] {
  return [createModelRouterDryRunPlan()];
}

export function getExecutionPlan(kind: string): BrainCoreExecutionPlan | undefined {
  return listExecutionPlans().find((plan) => plan.kind === kind);
}

export function getExecutionReadiness(): BrainCoreExecutionReadiness {
  const modelRouterDryRunExecutionFlagEnabled = isModelRouterDryRunExecutionFlagEnabled();
  const blockers = [
    'durable approval store not proven for this request',
    'durable audit not proven for this request',
    'approved approval record not proven for this request',
    'manual operator approval UX not verified',
    'rollback drill not performed',
  ];

  if (!modelRouterDryRunExecutionFlagEnabled) {
    blockers.unshift('execution feature flag disabled');
  }

  return {
    executionEnabled: false,
    modelRouterDryRunExecutionFlagEnabled,
    modelRouterDryRunExecutionFlagName: getModelRouterDryRunExecutionFlagName(),
    candidateCount: listExecutionPlans().length,
    readyCandidateCount: 0,
    blockers,
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
    modelRouterDryRunExecutionFlagEnabled: isModelRouterDryRunExecutionFlagEnabled(),
    modelRouterDryRunExecutionFlagName: getModelRouterDryRunExecutionFlagName(),
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
