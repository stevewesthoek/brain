import type {
  BrainCoreMindPreviewPolicy,
  BrainCoreExecutionPlan,
  BrainCoreExecutionReadiness,
} from '../types/api.js';

const CANDIDATE_KINDS = [
  'scheduler-run-mind-steward-dry-run',
  'scheduler-run-mind-steward-inbox-dry-run',
  'scheduler-run-mind-steward-inbox-classifier-dry-run',
  'scheduler-run-mind-steward-inbox-queue-dry-run',
  'scheduler-run-graphify-preflight-mind',
  'scheduler-run-graphify-preflight-brain',
  'scheduler-run-graphify-update-mind-blocked',
  'scheduler-run-graphify-update-brain-blocked',
  'scheduler-run-graphify-update-mind',
  'scheduler-run-graphify-update-brain',
  'scheduler-run-graphify-full-brain-selector-preview',
  'scheduler-run-graphify-full-mind-selector-preview',
  'scheduler-run-graphify-critical-rebuild-brain-selector-preview',
  'scheduler-run-graphify-critical-rebuild-mind-selector-preview',
] as const;
const MIND_STEWARD_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION';
const MIND_STEWARD_INBOX_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION';
const MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION';
const MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION';

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

export function isMindStewardDryRunExecutionFlagEnabled(): boolean {
  return process.env[MIND_STEWARD_DRY_RUN_EXECUTION_FLAG]?.trim().toLowerCase() === 'true';
}

export function isMindStewardInboxDryRunExecutionFlagEnabled(): boolean {
  return process.env[MIND_STEWARD_INBOX_DRY_RUN_EXECUTION_FLAG]?.trim().toLowerCase() === 'true';
}

export function isMindStewardInboxClassifierDryRunExecutionFlagEnabled(): boolean {
  return process.env[MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION_FLAG]?.trim().toLowerCase() === 'true';
}

export function isMindStewardInboxQueueDryRunExecutionFlagEnabled(): boolean {
  return process.env[MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION_FLAG]?.trim().toLowerCase() === 'true';
}

export function getMindStewardDryRunExecutionFlagName(): typeof MIND_STEWARD_DRY_RUN_EXECUTION_FLAG {
  return MIND_STEWARD_DRY_RUN_EXECUTION_FLAG;
}

export function getMindStewardInboxDryRunExecutionFlagName(): typeof MIND_STEWARD_INBOX_DRY_RUN_EXECUTION_FLAG {
  return MIND_STEWARD_INBOX_DRY_RUN_EXECUTION_FLAG;
}

export function getMindStewardInboxClassifierDryRunExecutionFlagName(): typeof MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION_FLAG {
  return MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION_FLAG;
}

export function getMindStewardInboxQueueDryRunExecutionFlagName(): typeof MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION_FLAG {
  return MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION_FLAG;
}

export function listExecutionPlans(): BrainCoreExecutionPlan[] {
  return [
    createMindStewardDryRunPlan(),
    createMindStewardInboxDryRunPlan(),
    createMindStewardInboxClassifierDryRunPlan(),
    createMindStewardInboxQueueDryRunPlan(),
    createGraphifyPlan(
      'scheduler-run-graphify-preflight-mind',
      'Run report-only Graphify preflight for Mind.',
      'bash tools/scripts/graphify-orchestrator-report.sh preflight-mind',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-preflight-brain',
      'Run report-only Graphify preflight for Brain.',
      'bash tools/scripts/graphify-orchestrator-report.sh preflight-brain',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-update-mind-blocked',
      'Validate guarded Graphify update path for Mind without enabling execution.',
      'bash tools/scripts/graphify-orchestrator-report.sh update-mind-blocked',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-update-brain-blocked',
      'Validate guarded Graphify update path for Brain without enabling execution.',
      'bash tools/scripts/graphify-orchestrator-report.sh update-brain-blocked',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-update-mind',
      'Execute controlled Graphify incremental update for Mind repository.',
      'bash tools/scripts/graphify-orchestrator-report.sh update-mind',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-update-brain',
      'Execute controlled Graphify incremental update for Brain repository.',
      'bash tools/scripts/graphify-orchestrator-report.sh update-brain',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-full-brain-selector-preview',
      'Report-only: Preview which AI model would be used for full semantic build of Brain. Does not execute Graphify full rebuild.',
      'bash tools/scripts/graphify-orchestrator-report.sh full-brain-selector-preview',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-full-mind-selector-preview',
      'Report-only: Preview which AI model would be used for full semantic build of Mind. Does not execute Graphify full rebuild.',
      'bash tools/scripts/graphify-orchestrator-report.sh full-mind-selector-preview',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-critical-rebuild-brain-selector-preview',
      'Report-only: Preview which AI model would be used for critical rebuild of Brain. Does not execute Graphify critical rebuild.',
      'bash tools/scripts/graphify-orchestrator-report.sh critical-rebuild-brain-selector-preview',
    ),
    createGraphifyPlan(
      'scheduler-run-graphify-critical-rebuild-mind-selector-preview',
      'Report-only: Preview which AI model would be used for critical rebuild of Mind. Does not execute Graphify critical rebuild.',
      'bash tools/scripts/graphify-orchestrator-report.sh critical-rebuild-mind-selector-preview',
    ),
  ];
}

export function getExecutionPlan(kind: string): BrainCoreExecutionPlan | undefined {
  return listExecutionPlans().find((plan) => plan.kind === kind);
}

export function getExecutionReadiness(): BrainCoreExecutionReadiness {
  const mindStewardDryRunExecutionFlagEnabled = isMindStewardDryRunExecutionFlagEnabled();
  const mindStewardInboxDryRunExecutionFlagEnabled = isMindStewardInboxDryRunExecutionFlagEnabled();
  const mindStewardInboxClassifierDryRunExecutionFlagEnabled = isMindStewardInboxClassifierDryRunExecutionFlagEnabled();
  const mindStewardInboxQueueDryRunExecutionFlagEnabled = isMindStewardInboxQueueDryRunExecutionFlagEnabled();
  const blockers = [
    'durable approval store not proven for this request',
    'durable audit not proven for this request',
    'approved approval record not proven for this request',
    'manual operator approval UX not verified',
    'rollback drill not performed',
  ];

  if (!mindStewardDryRunExecutionFlagEnabled) {
    blockers.unshift('execution feature flag disabled');
  }

  return {
    executionEnabled: false,
    mindStewardDryRunExecutionFlagEnabled,
    mindStewardDryRunExecutionFlagName: getMindStewardDryRunExecutionFlagName(),
    mindStewardInboxDryRunExecutionFlagEnabled,
    mindStewardInboxDryRunExecutionFlagName: getMindStewardInboxDryRunExecutionFlagName(),
    mindStewardInboxClassifierDryRunExecutionFlagEnabled,
    mindStewardInboxClassifierDryRunExecutionFlagName: getMindStewardInboxClassifierDryRunExecutionFlagName(),
    mindStewardInboxQueueDryRunExecutionFlagEnabled,
    mindStewardInboxQueueDryRunExecutionFlagName: getMindStewardInboxQueueDryRunExecutionFlagName(),
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

export function getMindPreviewPolicy(): BrainCoreMindPreviewPolicy {
  return {
    status: 'preview-only',
    firstProposedAction: 'mind-steward-update-current-context',
    firstProposedTarget: 'router/current.md',
    applyRouteEnabled: false,
    writesToMind: false,
    externalSideEffects: false,
    allowedTargets: [...MIND_PREVIEW_ALLOWED_TARGETS],
    blockedPrefixes: [...MIND_PREVIEW_BLOCKED_PREFIXES],
    requiredGates: [...MIND_PREVIEW_REQUIRED_GATES],
    docs: [
      {
        path: 'operations/specs/1779034874780-mind-steward-mind-write-apply-policy.md',
        description: 'Draft apply policy defining approval gates, rollback, and audit requirements.',
      },
      {
        path: 'docs/system/1779034841996-obsidian-mind-steward-handoff.md',
        description: 'Roadmap continuation handoff documenting the current preview-only state.',
      },
    ],
  };
}

function createMindStewardDryRunPlan(): BrainCoreExecutionPlan {
  return {
    kind: 'scheduler-run-mind-steward-dry-run',
    candidate: true,
    executionEnabled: false,
    mindStewardDryRunExecutionFlagEnabled: isMindStewardDryRunExecutionFlagEnabled(),
    mindStewardDryRunExecutionFlagName: getMindStewardDryRunExecutionFlagName(),
    wouldExecute: false,
    executed: false,
    riskLevel: 'low',
    writesToMind: false,
    externalSideEffects: false,
    requiresApproval: true,
    requiresDurableApprovalStore: true,
    requiresDurableAudit: true,
    requiresRollbackPlan: true,
    rollbackPlan: 'Remove generated runtime/local/mind-steward report files if needed; no Mind content is changed.',
    summary: 'Report-only mind-steward dry-run candidate. Safe first execution-gate target remains disabled.',
    mindPreviewPolicy: {
      status: 'preview-only',
      firstProposedAction: 'mind-steward-update-current-context',
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
        id: 'validate-mind-steward',
        description: 'Run mind-steward CI',
        commandPreview: 'npm run --prefix projects/mind-steward ci',
        willRunNow: false,
      },
      {
        id: 'write-runtime-report',
        description: 'Run report-only mind-steward dry-run helper',
        commandPreview: 'bash tools/scripts/mind-steward-dry-run-report.sh',
        willRunNow: false,
      },
    ],
  };
}

function createMindStewardInboxDryRunPlan(): BrainCoreExecutionPlan {
  return {
    kind: 'scheduler-run-mind-steward-inbox-dry-run',
    candidate: true,
    executionEnabled: false,
    mindStewardDryRunExecutionFlagEnabled: isMindStewardDryRunExecutionFlagEnabled(),
    mindStewardDryRunExecutionFlagName: getMindStewardDryRunExecutionFlagName(),
    mindStewardInboxDryRunExecutionFlagEnabled: isMindStewardInboxDryRunExecutionFlagEnabled(),
    mindStewardInboxDryRunExecutionFlagName: getMindStewardInboxDryRunExecutionFlagName(),
    wouldExecute: false,
    executed: false,
    riskLevel: 'low',
    writesToMind: false,
    externalSideEffects: false,
    requiresApproval: true,
    requiresDurableApprovalStore: true,
    requiresDurableAudit: true,
    requiresRollbackPlan: true,
    rollbackPlan: 'Remove generated runtime/local/mind-steward inbox report files if needed; no Mind content is changed.',
    summary: 'Report-only Mind Steward inbox dry-run candidate. Safe preflight surface for capture arrival analysis stays disabled.',
    mindPreviewPolicy: {
      status: 'preview-only',
      firstProposedAction: 'mind-steward-update-current-context',
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
        id: 'inspect-inbox',
        description: 'Inspect Mind capture inbox safely without writes',
        commandPreview: 'bash tools/scripts/mind-steward-inbox-dry-run-report.sh',
        willRunNow: false,
      },
    ],
  };
}

function createMindStewardInboxClassifierDryRunPlan(): BrainCoreExecutionPlan {
  return {
    kind: 'scheduler-run-mind-steward-inbox-classifier-dry-run',
    candidate: true,
    executionEnabled: false,
    mindStewardDryRunExecutionFlagEnabled: isMindStewardDryRunExecutionFlagEnabled(),
    mindStewardDryRunExecutionFlagName: getMindStewardDryRunExecutionFlagName(),
    mindStewardInboxDryRunExecutionFlagEnabled: isMindStewardInboxDryRunExecutionFlagEnabled(),
    mindStewardInboxDryRunExecutionFlagName: getMindStewardInboxDryRunExecutionFlagName(),
    mindStewardInboxClassifierDryRunExecutionFlagEnabled: isMindStewardInboxClassifierDryRunExecutionFlagEnabled(),
    mindStewardInboxClassifierDryRunExecutionFlagName: getMindStewardInboxClassifierDryRunExecutionFlagName(),
    wouldExecute: false,
    executed: false,
    riskLevel: 'low',
    writesToMind: false,
    externalSideEffects: false,
    requiresApproval: true,
    requiresDurableApprovalStore: true,
    requiresDurableAudit: true,
    requiresRollbackPlan: true,
    rollbackPlan: 'Remove generated runtime/local/mind-steward classifier report files if needed; no Mind content is changed.',
    summary: 'Report-only Mind Steward inbox classifier dry-run candidate. Selector-backed preflight stays disabled and does not classify captures permanently.',
    mindPreviewPolicy: {
      status: 'preview-only',
      firstProposedAction: 'mind-steward-update-current-context',
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
        id: 'inspect-inbox',
        description: 'Inspect Mind capture inbox safely without writes',
        commandPreview: 'bash tools/scripts/mind-steward-inbox-dry-run-report.sh',
        willRunNow: false,
      },
      {
        id: 'select-classifier',
        description: 'Run selector-backed classifier preflight in report-only mode',
        commandPreview: 'bash tools/scripts/mind-steward-inbox-classifier-dry-run-report.sh',
        willRunNow: false,
      },
    ],
  };
}

function createMindStewardInboxQueueDryRunPlan(): BrainCoreExecutionPlan {
  return {
    kind: 'scheduler-run-mind-steward-inbox-queue-dry-run',
    candidate: true,
    executionEnabled: false,
    mindStewardDryRunExecutionFlagEnabled: isMindStewardDryRunExecutionFlagEnabled(),
    mindStewardDryRunExecutionFlagName: getMindStewardDryRunExecutionFlagName(),
    mindStewardInboxDryRunExecutionFlagEnabled: isMindStewardInboxDryRunExecutionFlagEnabled(),
    mindStewardInboxDryRunExecutionFlagName: getMindStewardInboxDryRunExecutionFlagName(),
    mindStewardInboxClassifierDryRunExecutionFlagEnabled: isMindStewardInboxClassifierDryRunExecutionFlagEnabled(),
    mindStewardInboxClassifierDryRunExecutionFlagName: getMindStewardInboxClassifierDryRunExecutionFlagName(),
    mindStewardInboxQueueDryRunExecutionFlagEnabled: isMindStewardInboxQueueDryRunExecutionFlagEnabled(),
    mindStewardInboxQueueDryRunExecutionFlagName: getMindStewardInboxQueueDryRunExecutionFlagName(),
    wouldExecute: false,
    executed: false,
    riskLevel: 'low',
    writesToMind: false,
    externalSideEffects: false,
    requiresApproval: true,
    requiresDurableApprovalStore: true,
    requiresDurableAudit: true,
    requiresRollbackPlan: true,
    rollbackPlan: 'Remove generated runtime/local/mind-steward inbox queue report files if needed; no Mind content is changed.',
    summary: 'Report-only Mind Steward inbox queue dry-run candidate. Queue/throttle preflight stays disabled and does not process captures.',
    mindPreviewPolicy: {
      status: 'preview-only',
      firstProposedAction: 'mind-steward-update-current-context',
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
        id: 'inspect-inbox-queue',
        description: 'Build report-only queue/throttle candidate list from Mind inbox',
        commandPreview: 'bash tools/scripts/mind-steward-inbox-queue-dry-run-report.sh',
        willRunNow: false,
      },
    ],
  };
}



function createGraphifyPlan(
  kind: BrainCoreExecutionPlan['kind'],
  summary: string,
  commandPreview: string,
): BrainCoreExecutionPlan {
  return {
    kind,
    candidate: true,
    executionEnabled: false,
    mindStewardDryRunExecutionFlagEnabled: isMindStewardDryRunExecutionFlagEnabled(),
    mindStewardDryRunExecutionFlagName: getMindStewardDryRunExecutionFlagName(),
    wouldExecute: false,
    executed: false,
    riskLevel: 'low',
    writesToMind: false,
    externalSideEffects: false,
    requiresApproval: true,
    requiresDurableApprovalStore: true,
    requiresDurableAudit: true,
    requiresRollbackPlan: true,
    rollbackPlan: 'Remove generated runtime/local/graphify report files if needed; no Mind content is changed.',
    summary,
    mindPreviewPolicy: {
      status: 'preview-only',
      firstProposedAction: 'mind-steward-update-current-context',
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
        id: 'run-graphify-orchestrator-report',
        description: summary,
        commandPreview,
        willRunNow: false,
      },
    ],
  };
}
