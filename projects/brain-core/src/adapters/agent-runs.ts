import { listApprovalAuditEvents } from './actions.js';
import { listApprovals } from './approvals.js';
import { listActionSummaries } from './action-registry.js';
import { listAgents } from './agents.js';
import { listRuntimeReports } from './runtime-reports.js';
import { listMaintenancePreviewSummaries } from './maintenance-previews.js';
import { getSchedulerStatus, listSchedulerJobs } from './scheduler.js';
import { getStbPipelineStatus } from './stb-status.js';
import { getVideoOrchestratorStatus } from './video-orchestrator-status.js';
import type {
  BrainCoreAgentRunSummary,
  BrainCoreAgentEventSummary,
  BrainCoreRecoveryItemSummary,
} from '../types/api.js';

export type { BrainCoreAgentRunSummary, BrainCoreAgentEventSummary, BrainCoreRecoveryItemSummary };

export function listAgentRuns(): BrainCoreAgentRunSummary[] {
  const runs: BrainCoreAgentRunSummary[] = [];
  const approvalsSummary = listApprovals();
  const agents = listAgents();
  const actions = listActionSummaries();
  const agentMap = new Map(agents.map(a => [a.id, a]));
  const actionMap = new Map(actions.map(a => [a.id, a]));

  // Add agent runs from approvals
  for (const approval of (approvalsSummary || []).slice(0, 50)) {
    const action = actionMap.get(approval.kind);
    const agent = agentMap.get('model-router-agent');

    const statusEnum: BrainCoreAgentRunSummary['status'] = mapApprovalStatusToRunStatus(approval.status) as any;
    const now = new Date();
    const baseTime = approval.expiresAt || now.toISOString();

    const run: BrainCoreAgentRunSummary = {
      id: `run-${approval.id}`,
      agentId: agent?.id || 'unknown',
      title: action?.label || approval.kind,
      kind: approval.kind,
      status: statusEnum,
      startedAt: baseTime,
      targetType: action?.targetType || 'system',
      targetId: approval.kind.includes('scheduler') ? 'model-router-dry-run' : 'brain-core',
      source: 'approval',
      summary: buildRunSummary(approval, action),
      relatedApprovalId: approval.id,
      relatedActionId: approval.kind,
      blockers: approval.status === 'pending' ? ['Awaiting approval'] : [],
      safety: {
        writesToMind: false,
        executesShell: false,
        mutatesRuntime: false,
        requiresApproval: true,
        executionEnabled: false,
      },
    };

    if (approval.status !== 'pending') {
      run.completedAt = baseTime;
    }

    runs.push(run);
  }

  // Add external executor placeholders (Claude Code, Codex)
  runs.push({
    id: 'run-claude-code-executor-external',
    agentId: 'claude-code-executor',
    title: 'Claude Code Session',
    kind: 'external-claude-code',
    status: 'planned',
    startedAt: new Date().toISOString(),
    targetType: 'agent',
    targetId: 'claude-code-executor',
    source: 'placeholder',
    summary: 'External Claude Code executor. No in-app execution visible.',
    blockers: ['External tool; no Brain Core integration'],
    safety: {
      writesToMind: false,
      executesShell: false,
      mutatesRuntime: false,
      requiresApproval: false,
      executionEnabled: false,
    },
  });

  runs.push({
    id: 'run-codex-executor-external',
    agentId: 'codex-executor',
    title: 'Codex Session',
    kind: 'external-codex',
    status: 'planned',
    startedAt: new Date().toISOString(),
    targetType: 'agent',
    targetId: 'codex-executor',
    source: 'placeholder',
    summary: 'External Codex executor. No in-app execution visible.',
    blockers: ['External tool; no Brain Core integration'],
    safety: {
      writesToMind: false,
      executesShell: false,
      mutatesRuntime: false,
      requiresApproval: false,
      executionEnabled: false,
    },
  });

  return runs.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

export function getAgentRun(id: string): BrainCoreAgentRunSummary | undefined {
  const runs = listAgentRuns();
  return runs.find(r => r.id === id);
}

export function listAgentEvents(): BrainCoreAgentEventSummary[] {
  const events: BrainCoreAgentEventSummary[] = [];
  const auditEvents = listApprovalAuditEvents();

  for (const auditEvent of auditEvents.slice(0, 100)) {
    const eventType: BrainCoreAgentEventSummary['type'] =
      auditEvent.event === 'missing' ? 'blocked' : auditEvent.event;

    events.push({
      id: auditEvent.id,
      runId: `run-${auditEvent.approvalId}`,
      agentId: 'model-router-agent',
      type: eventType,
      createdAt: auditEvent.createdAt,
      status: auditEvent.executed ? 'completed' : 'pending',
      summary: `Approval ${auditEvent.event}: ${auditEvent.kind}`,
      severity: auditEvent.event === 'rejected' ? 'warning' : 'info',
      relatedApprovalId: auditEvent.approvalId,
    });
  }

  return events.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listRecoveryItems(): BrainCoreRecoveryItemSummary[] {
  const items: BrainCoreRecoveryItemSummary[] = [];
  const readinessResult = getExecutionReadiness();
  const reports = listRuntimeReports();
  const scheduler = getSchedulerStatus();
  const stbStatus = getStbPipelineStatus();
  const videoStatus = getVideoOrchestratorStatus();

  // Add execution blockers
  if (readinessResult && readinessResult.blockers && readinessResult.blockers.length > 0) {
    for (const blocker of readinessResult.blockers.slice(0, 5)) {
      items.push({
        id: `recovery-exec-${items.length}`,
        severity: 'warning',
        source: 'action',
        title: 'Model-router execution blocked',
        summary: blocker,
        blocker: blocker,
        nextSafeStep: 'Check execution readiness policy or enable execution flag',
        safety: {
          canAutoFix: false,
          requiresApproval: true,
          writesToMind: false,
        },
      });
    }
  }

  // Add missing/invalid reports
  const mrReport = reports.find(r => r.id === 'model-router');
  if (!mrReport || mrReport.status !== 'available') {
    items.push({
      id: 'recovery-report-mr',
      severity: 'warning',
      source: 'report',
      title: 'Model-router report missing',
      summary: 'Latest model-router dry-run report not available',
      blocker: 'No recent report data',
      nextSafeStep: 'Request approval for model-router-dry-run action',
      relatedActionId: 'model-router-dry-run',
      safety: {
        canAutoFix: false,
        requiresApproval: true,
        writesToMind: false,
      },
    });
  }

  // Add scheduler status issues
  if (scheduler && scheduler.status === 'not-configured') {
    items.push({
      id: 'recovery-scheduler',
      severity: 'info',
      source: 'scheduler',
      title: 'Scheduler not configured',
      summary: 'Scheduler appears to not be running',
      blocker: 'Scheduler not available',
      nextSafeStep: 'Check scheduler configuration and enable if needed',
      safety: {
        canAutoFix: false,
        requiresApproval: false,
        writesToMind: false,
      },
    });
  }

  // Add STB pipeline health issues
  if (stbStatus && stbStatus.health === 'error') {
    items.push({
      id: 'recovery-stb-error',
      severity: 'error',
      source: 'stb',
      title: 'STB pipeline health error',
      summary: `STB pipeline at error state: ${stbStatus.summary}`,
      blocker: 'STB pipeline health check failed',
      nextSafeStep: 'Check STB pipeline status and runtime logs',
      relatedEndpoint: '/stb/status',
      safety: {
        canAutoFix: false,
        requiresApproval: false,
        writesToMind: false,
      },
    });
  }

  // Add video orchestrator health issues
  if (videoStatus && videoStatus.health === 'error') {
    items.push({
      id: 'recovery-video-error',
      severity: 'error',
      source: 'video',
      title: 'Video orchestrator health error',
      summary: `Video orchestrator at error state: ${videoStatus.summary}`,
      blocker: 'Video orchestrator health check failed',
      nextSafeStep: 'Check video orchestrator status and module health',
      relatedEndpoint: '/video-orchestrator/status',
      safety: {
        canAutoFix: false,
        requiresApproval: false,
        writesToMind: false,
      },
    });
  }

  return items.slice(0, 10);
}

export function getRecoveryItem(id: string): BrainCoreRecoveryItemSummary | undefined {
  const items = listRecoveryItems();
  return items.find(item => item.id === id);
}

function mapApprovalStatusToRunStatus(approvalStatus: string): string {
  switch (approvalStatus) {
    case 'pending':
      return 'blocked';
    case 'approved':
      return 'completed';
    case 'rejected':
      return 'failed';
    case 'expired':
      return 'failed';
    default:
      return 'unknown';
  }
}

function buildRunSummary(approval: any, action: any): string {
  if (approval.status === 'approved') {
    return approval.executed ? 'Approved and executed' : 'Approved, awaiting execution';
  }
  if (approval.status === 'rejected') {
    return 'Approval rejected';
  }
  if (approval.status === 'expired') {
    return 'Approval expired (24-hour window passed)';
  }
  return 'Approval request pending';
}

// Import at runtime (circular dependency management)
function getExecutionReadiness() {
  try {
    const { getExecutionReadiness } = require('./execution-plans.js');
    return getExecutionReadiness();
  } catch {
    return null;
  }
}
