import type {
  BrainCoreExecutionPlan,
  BrainCoreExecutionReadiness,
} from '../types/api.js';

const CANDIDATE_KINDS = ['scheduler-run-model-router-dry-run'] as const;
const MODEL_ROUTER_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';

const MIND_PREVIEW_ALLOWED_TARGETS = [
  'router/current.md',
  'capture/inbox/',
  'capture/failed/',
  'live/tasks.md',
  'live/projects.md',
  'live/decisions.md',
  'sources/index.md',
  'wiki/index.md',
] as const;

const MIND_PREVIEW_BLOCKED_PREFIXES = [
  '.git/',
  '.obsidian/',
  'node_modules/',
  'dist/',
  'build/',
  'coverage/',
  'runtime/',
  'logs/',
  '01-inbox/',
  '02-strategy/',
  '03-projects/',
  '04-tasks/',
  '05-areas/',
  '06-resources/',
  '07-templates/',
  '08-archive/',
  'archive/old/',
] as const;

const MIND_PREVIEW_REQUIRED_GATES = [
  'localhost-only request',
  'exact action kind allowlist',
  'durable approval store under Brain runtime/local',
  'durable approval audit under Brain runtime/local',
  'fresh preview hash referenced by approval',
  'target path inside allowed preview target list',
  'target path outside blocked roots',
  'single-file apply only after future explicit approval',
  'post-apply validation and rollback notes before mutation',
] as const;

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
    mindPreviewPolicy: {
      status: 'preview-only',
      firstProposedAction: 'model-router-update-current-context',
      firstProposedTarget: 'router/current.md',
      writesToMind: false,
      externalSideEffects: false,
      applyRouteEnabled: false,
      allowedTargets: [...MIND_PREVIEW_ALLOWED_TARGETS],
      blockedPrefixes: [...MIND_PREVIEW_BLOCKED_PREFIXES],
      requiredGates: [...MIND_PREVIEW_REQUIRED_GATES],
    },
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
