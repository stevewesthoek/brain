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
  'scheduler-run-mind-steward-large-file-nightly-fallback',
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
  'scheduler-run-infinite-brain-report-only-pipeline',
] as const;
const MIND_STEWARD_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION';
const MIND_STEWARD_INBOX_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION';
const MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION';
const MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION_FLAG = 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION';
const EXECUTION_KILL_SWITCH_FLAG = 'BRAIN_CORE_EXECUTION_KILL_SWITCH';
const WORKFLOW_FEATURE_FLAG_DEFINITIONS: Record<BrainCoreExecutionCandidateKind, {
  flagName: string;
  mode: 'report-only' | 'blocked-until-implementation';
}> = {
  'scheduler-run-mind-steward-dry-run': {
    flagName: MIND_STEWARD_DRY_RUN_EXECUTION_FLAG,
    mode: 'report-only',
  },
  'scheduler-run-mind-steward-inbox-dry-run': {
    flagName: MIND_STEWARD_INBOX_DRY_RUN_EXECUTION_FLAG,
    mode: 'report-only',
  },
  'scheduler-run-mind-steward-inbox-classifier-dry-run': {
    flagName: MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION_FLAG,
    mode: 'report-only',
  },
  'scheduler-run-mind-steward-inbox-queue-dry-run': {
    flagName: MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION_FLAG,
    mode: 'report-only',
  },
  'scheduler-run-mind-steward-large-file-nightly-fallback': {
    flagName: 'BRAIN_CORE_ENABLE_LARGE_FILE_NIGHTLY_FALLBACK_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-preflight-mind': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_PREFLIGHT_MIND_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-preflight-brain': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_PREFLIGHT_BRAIN_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-update-mind-blocked': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_UPDATE_MIND_BLOCKED_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-update-brain-blocked': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_UPDATE_BRAIN_BLOCKED_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-update-mind': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_UPDATE_MIND_EXECUTION',
    mode: 'blocked-until-implementation',
  },
  'scheduler-run-graphify-update-brain': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_UPDATE_BRAIN_EXECUTION',
    mode: 'blocked-until-implementation',
  },
  'scheduler-run-graphify-full-brain-selector-preview': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_FULL_BRAIN_SELECTOR_PREVIEW_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-full-mind-selector-preview': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_FULL_MIND_SELECTOR_PREVIEW_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-critical-rebuild-brain-selector-preview': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_CRITICAL_REBUILD_BRAIN_SELECTOR_PREVIEW_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-graphify-critical-rebuild-mind-selector-preview': {
    flagName: 'BRAIN_CORE_ENABLE_GRAPHIFY_CRITICAL_REBUILD_MIND_SELECTOR_PREVIEW_EXECUTION',
    mode: 'report-only',
  },
  'scheduler-run-infinite-brain-report-only-pipeline': {
    flagName: 'BRAIN_CORE_ENABLE_INFINITE_BRAIN_REPORT_ONLY_PIPELINE_EXECUTION',
    mode: 'report-only',
  },
};

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

function isFlagEnabled(flagName: string): boolean {
  return process.env[flagName]?.trim().toLowerCase() === 'true';
}

export function isMindStewardDryRunExecutionFlagEnabled(): boolean {
  return isFlagEnabled(MIND_STEWARD_DRY_RUN_EXECUTION_FLAG);
}

export function isMindStewardInboxDryRunExecutionFlagEnabled(): boolean {
  return isFlagEnabled(MIND_STEWARD_INBOX_DRY_RUN_EXECUTION_FLAG);
}

export function isMindStewardInboxClassifierDryRunExecutionFlagEnabled(): boolean {
  return isFlagEnabled(MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION_FLAG);
}

export function isMindStewardInboxQueueDryRunExecutionFlagEnabled(): boolean {
  return isFlagEnabled(MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION_FLAG);
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

export function isExecutionKillSwitchEnabled(): boolean {
  return isFlagEnabled(EXECUTION_KILL_SWITCH_FLAG);
}

export function getExecutionKillSwitchFlagName(): typeof EXECUTION_KILL_SWITCH_FLAG {
  return EXECUTION_KILL_SWITCH_FLAG;
}

export function getExecutionKillSwitch() {
  return {
    flagName: EXECUTION_KILL_SWITCH_FLAG,
    enabled: isExecutionKillSwitchEnabled(),
    blocksOnDemandRequests: true,
    blocksApprovedExecution: true,
    blocksSchedulerEligibility: true,
    writesToMind: false,
  } as const;
}

export function getWorkflowFeatureFlag(kind: BrainCoreExecutionCandidateKind) {
  const definition = WORKFLOW_FEATURE_FLAG_DEFINITIONS[kind];
  return {
    workflowId: kind,
    flagName: definition.flagName,
    enabled: isFlagEnabled(definition.flagName),
    requiredForExecution: true,
    defaultEnabled: false,
    mode: definition.mode,
    writesToMind: false,
    externalSideEffects: false,
  } as const;
}

export function getWorkflowFeatureFlagForKind(kind: string) {
  return isExecutionCandidateKind(kind) ? getWorkflowFeatureFlag(kind) : undefined;
}

export function listWorkflowFeatureFlags() {
  return CANDIDATE_KINDS.map(getWorkflowFeatureFlag);
}

export function isWorkflowFeatureFlagEnabled(kind: string): boolean {
  return getWorkflowFeatureFlagForKind(kind)?.enabled === true;
}

export function listExecutionPlans(): BrainCoreExecutionPlan[] {
  return [
    createMindStewardDryRunPlan(),
    createMindStewardInboxDryRunPlan(),
    createMindStewardInboxClassifierDryRunPlan(),
    createMindStewardInboxQueueDryRunPlan(),
    createLargeFileNightlyFallbackPlan(),
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
    createInfiniteBrainPipeline(),
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
  const workflowFeatureFlags = listWorkflowFeatureFlags();
  const enabledWorkflowFeatureFlagCount = workflowFeatureFlags.filter(flag => flag.enabled).length;
  const killSwitch = getExecutionKillSwitch();
  const blockers = [
    'durable approval store not proven for this request',
    'durable audit not proven for this request',
    'approved approval record not proven for this request',
    'manual operator approval UX not verified',
    'rollback drill not performed',
  ];

  if (enabledWorkflowFeatureFlagCount === 0) {
    blockers.unshift('execution feature flag disabled');
  }
  if (killSwitch.enabled) {
    blockers.unshift('execution kill switch enabled');
  }

  return {
    executionEnabled: false,
    killSwitch,
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
    workflowFeatureFlags,
    featureFlaggedWorkflowCount: workflowFeatureFlags.length,
    enabledWorkflowFeatureFlagCount,
    blockers,
    writesToMind: false,
    executableActions: false,
  };
}

export function getExecutionCandidateKinds(): BrainCoreExecutionCandidateKind[] {
  return [...CANDIDATE_KINDS];
}

function isExecutionCandidateKind(kind: string): kind is BrainCoreExecutionCandidateKind {
  return CANDIDATE_KINDS.includes(kind as BrainCoreExecutionCandidateKind);
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
    workflowFeatureFlag: getWorkflowFeatureFlag('scheduler-run-mind-steward-dry-run'),
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
    workflowFeatureFlag: getWorkflowFeatureFlag('scheduler-run-mind-steward-inbox-dry-run'),
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
    workflowFeatureFlag: getWorkflowFeatureFlag('scheduler-run-mind-steward-inbox-classifier-dry-run'),
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
    workflowFeatureFlag: getWorkflowFeatureFlag('scheduler-run-mind-steward-inbox-queue-dry-run'),
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

function createLargeFileNightlyFallbackPlan(): BrainCoreExecutionPlan {
  return {
    kind: 'scheduler-run-mind-steward-large-file-nightly-fallback',
    candidate: true,
    workflowFeatureFlag: getWorkflowFeatureFlag('scheduler-run-mind-steward-large-file-nightly-fallback'),
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
    rollbackPlan: 'Remove generated runtime/local/mind-steward large-file report files if needed; no Mind content is changed.',
    summary: 'Report-only large-file nightly fallback candidate. Processes blocked large files in a bounded nightly window without continuous processing.',
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
        id: 'inspect-large-file-queue',
        description: 'Build report-only large-file nightly fallback plan from blocked queue items',
        commandPreview: 'GET /scheduler/continuous-processing/large-file-fallback/plan',
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
    workflowFeatureFlag: getWorkflowFeatureFlag(kind),
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

function createInfiniteBrainPipeline(): BrainCoreExecutionPlan {
  return {
    kind: 'scheduler-run-infinite-brain-report-only-pipeline',
    candidate: true,
    workflowFeatureFlag: getWorkflowFeatureFlag('scheduler-run-infinite-brain-report-only-pipeline'),
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
    rollbackPlan: 'Remove generated runtime/local/infinite-brain report files if needed; no Mind content is changed.',
    summary: 'Report-only Infinite Brain pipeline candidate. Atomizer, classifier, edge inference, relationship audit, and insights stay disabled.',
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
        id: 'run-infinite-brain-pipeline',
        description: 'Run report-only Infinite Brain pipeline',
        commandPreview: 'npm run ibr:pipeline:dry-run',
        willRunNow: false,
      },
    ],
  };
}
