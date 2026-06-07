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
