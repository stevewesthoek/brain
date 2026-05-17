import { requestAction } from './actions.js';
import type {
  BrainCoreActionKind,
  BrainCoreActionRisk,
  BrainCoreActionStatus,
  BrainCoreActionSafety,
  BrainCoreActionSummary,
  BrainCoreActionRequest,
  BrainCoreActionRequestResult,
} from '../types/api.js';

const SAFE_ZERO: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: false,
  mutatesRuntime: false,
  touchesStb: false,
  touchesVideo: false,
  requiresHumanReview: false,
};

const SHELL_EXECUTION: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: true,
  mutatesRuntime: false,
  touchesStb: false,
  touchesVideo: false,
  requiresHumanReview: true,
};

const BLOCKED_HUMAN_REVIEW: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: false,
  mutatesRuntime: false,
  touchesStb: false,
  touchesVideo: false,
  requiresHumanReview: true,
};

const FUTURE_HIGH_RISK: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: false,
  mutatesRuntime: true,
  touchesStb: false,
  touchesVideo: false,
  requiresHumanReview: true,
};

const MIND_WRITE_RISK: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: false,
  mutatesRuntime: true,
  touchesStb: false,
  touchesVideo: false,
  requiresHumanReview: true,
};

const STB_EXECUTION_RISK: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: true,
  mutatesRuntime: true,
  touchesStb: true,
  touchesVideo: false,
  requiresHumanReview: true,
};

const VIDEO_EXECUTION_RISK: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: true,
  mutatesRuntime: true,
  touchesStb: false,
  touchesVideo: true,
  requiresHumanReview: true,
};

const APP_LIFECYCLE_RISK: BrainCoreActionSafety = {
  writesToMind: false,
  executesShell: true,
  mutatesRuntime: true,
  touchesStb: false,
  touchesVideo: false,
  requiresHumanReview: true,
};

const ACTIONS_REGISTRY: BrainCoreActionSummary[] = [
  {
    id: 'model-router-dry-run',
    kind: 'model-router-dry-run',
    label: 'Model Router Dry Run',
    description: 'Generate model-router context report without applying changes. Request approval does not execute; approval allows report-only dry-run if gates pass (env flag disabled by default).',
    targetType: 'agent',
    targetId: 'model-router',
    status: 'approval-required',
    risk: 'low',
    requiresApproval: true,
    canRequestApproval: true,
    canExecuteNow: false,
    reason: 'Request approval creates pending approval record only (does not execute). Approval delegates to existing guarded execution path. Output: Brain-owned runtime/local/model-router. Apply/write disabled.',
    safety: SHELL_EXECUTION,
  },

  {
    id: 'stb-status-refresh',
    kind: 'stb-status-refresh',
    label: 'STB Status Refresh',
    description: 'Read-only refresh of Says the Bible pipeline status',
    targetType: 'pipeline',
    targetId: 'stb-daily-pipeline',
    status: 'available',
    risk: 'low',
    requiresApproval: false,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Status endpoint is read-only. No execution or approval needed.',
    safety: SAFE_ZERO,
  },

  {
    id: 'video-status-refresh',
    kind: 'video-status-refresh',
    label: 'Video Orchestrator Status Refresh',
    description: 'Read-only refresh of video orchestrator module progress',
    targetType: 'orchestrator',
    targetId: 'video-orchestrator',
    status: 'available',
    risk: 'low',
    requiresApproval: false,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Status endpoint is read-only. No execution or approval needed.',
    safety: SAFE_ZERO,
  },

  {
    id: 'stb-video-migration-review',
    kind: 'stb-video-migration-review',
    label: 'STB → Video Migration Review',
    description: 'Read-only review of STB-to-video migration parity status',
    targetType: 'system',
    targetId: 'stb-to-video-migration',
    status: 'available',
    risk: 'low',
    requiresApproval: false,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Review endpoint is read-only. No execution or approval needed.',
    safety: SAFE_ZERO,
  },

  {
    id: 'agent-readiness-review',
    kind: 'agent-readiness-review',
    label: 'Agent Readiness Review',
    description: 'Read-only review of autonomous agent execution readiness',
    targetType: 'system',
    targetId: 'agents',
    status: 'available',
    risk: 'low',
    requiresApproval: false,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Readiness check endpoint is read-only. No execution or approval needed.',
    safety: SAFE_ZERO,
  },

  {
    id: 'local-app-start',
    kind: 'local-app-start',
    label: 'Local App Start',
    description: 'Start a local development application',
    targetType: 'local-app',
    targetId: 'local-app-*',
    status: 'planned',
    risk: 'medium',
    requiresApproval: true,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Application lifecycle management planned for Phase 5. Not implemented in this slice.',
    safety: APP_LIFECYCLE_RISK,
  },

  {
    id: 'local-app-stop',
    kind: 'local-app-stop',
    label: 'Local App Stop',
    description: 'Stop a local development application',
    targetType: 'local-app',
    targetId: 'local-app-*',
    status: 'planned',
    risk: 'medium',
    requiresApproval: true,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Application lifecycle management planned for Phase 5. Not implemented in this slice.',
    safety: APP_LIFECYCLE_RISK,
  },

  {
    id: 'local-app-restart',
    kind: 'local-app-restart',
    label: 'Local App Restart',
    description: 'Restart a local development application',
    targetType: 'local-app',
    targetId: 'local-app-*',
    status: 'planned',
    risk: 'medium',
    requiresApproval: true,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Application lifecycle management planned for Phase 5. Not implemented in this slice.',
    safety: APP_LIFECYCLE_RISK,
  },

  {
    id: 'orchestrator-run',
    kind: 'orchestrator-run',
    label: 'Orchestrator Run',
    description: 'Execute an orchestrator directly',
    targetType: 'orchestrator',
    targetId: 'orchestrator-*',
    status: 'blocked',
    risk: 'high',
    requiresApproval: true,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Direct orchestrator execution is blocked. Use model-router for safe dry-runs only.',
    safety: BLOCKED_HUMAN_REVIEW,
  },

  {
    id: 'pipeline-dry-run',
    kind: 'pipeline-dry-run',
    label: 'Pipeline Dry-Run',
    description: 'Execute a pipeline in dry-run/test mode',
    targetType: 'pipeline',
    targetId: 'pipeline-*',
    status: 'blocked',
    risk: 'high',
    requiresApproval: true,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Pipeline dry-run capability blocked. Use model-router dry-run for safe analysis only.',
    safety: BLOCKED_HUMAN_REVIEW,
  },

  {
    id: 'mind-write-apply',
    kind: 'mind-write-apply',
    label: 'Mind Write / Apply',
    description: 'Apply previewed changes to Mind workspace',
    targetType: 'mind',
    targetId: 'mind-vault',
    status: 'blocked',
    risk: 'high',
    requiresApproval: true,
    canRequestApproval: false,
    canExecuteNow: false,
    reason: 'Mind write capability blocked. Requires roadmap advancement with full policy implementation.',
    safety: MIND_WRITE_RISK,
  },
];

export function listActionSummaries(): BrainCoreActionSummary[] {
  return [...ACTIONS_REGISTRY].map((action) => enrichActionWithReadiness(action));
}

export function getActionSummary(id: string): BrainCoreActionSummary | undefined {
  const action = ACTIONS_REGISTRY.find((a) => a.id === id);
  return action ? enrichActionWithReadiness(action) : undefined;
}

function enrichActionWithReadiness(action: BrainCoreActionSummary): BrainCoreActionSummary {
  if (action.kind !== 'model-router-dry-run') {
    return action;
  }

  const blockers: string[] = [];
  const flagEnabled = process.env.BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION === 'true';
  if (!flagEnabled) {
    blockers.push('BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION not enabled');
  }

  const readiness: import('../types/api.js').BrainCoreActionReadiness = {
    status: blockers.length === 0 ? 'ready' : 'blocked',
    blockers,
    executionWillWriteToMind: false,
    executionWillApplyChanges: false,
    executionKind: 'report-only',
  };

  return {
    ...action,
    readiness,
  };
}

export async function requestActionApprovalById(id: string): Promise<BrainCoreActionRequest> {
  const action = getActionSummary(id);

  if (!action) {
    return {
      id: `action-request-invalid-${id}`,
      actionId: id,
      requestedAt: new Date().toISOString(),
      status: 'invalid',
      summary: `Action ${id} not found in registry.`,
      executionDidRun: false,
      safety: BLOCKED_HUMAN_REVIEW,
    };
  }

  if (!action.canRequestApproval) {
    return {
      id: `action-request-blocked-${id}`,
      actionId: id,
      requestedAt: new Date().toISOString(),
      status: 'blocked',
      summary: `Action ${action.label} cannot request approval: ${action.reason}`,
      executionDidRun: false,
      safety: action.safety,
    };
  }

  if (action.status === 'planned' || action.status === 'blocked') {
    return {
      id: `action-request-blocked-${id}`,
      actionId: id,
      requestedAt: new Date().toISOString(),
      status: 'blocked',
      summary: `Action ${action.label} is ${action.status}. ${action.reason}`,
      executionDidRun: false,
      safety: action.safety,
    };
  }

  const requestKind = mapActionKindToApprovalRequestKind(action.kind);
  const result: BrainCoreActionRequestResult = {
    ...requestAction(requestKind),
    executed: false,
  };

  return {
    id: result.approval?.id ?? `action-request-pending-${id}`,
    actionId: id,
    requestedAt: new Date().toISOString(),
    status: result.accepted ? 'requested' : 'invalid',
    summary: result.message,
    approvalId: result.approval?.id,
    executionDidRun: false,
    safety: action.safety,
  };
}

function mapActionKindToApprovalRequestKind(kind: BrainCoreActionKind): string {
  switch (kind) {
    case 'model-router-dry-run':
      return 'scheduler-run-model-router-dry-run';
    case 'stb-status-refresh':
    case 'video-status-refresh':
    case 'stb-video-migration-review':
    case 'agent-readiness-review':
    case 'local-app-start':
    case 'local-app-stop':
    case 'local-app-restart':
    case 'orchestrator-run':
    case 'pipeline-dry-run':
    case 'mind-write-apply':
    default:
      return `custom-${kind}`;
  }
}
