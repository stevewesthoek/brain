import type { BrainConsoleViewState } from './view.js';
import type { BrainCoreStatus, BrainCoreRuntimeReportSummary } from './client.js';

export type ConnectionStatus = 'online' | 'degraded' | 'offline';
export type AttentionLevel = 'clear' | 'watch' | 'review' | 'blocked';

export interface DashboardSnapshot {
  connectionStatus: ConnectionStatus;
  attentionLevel: AttentionLevel;
  attentionScore: number;
  brainCoreOnline: boolean;
  wikiHealthOk: boolean;
  wikiHealthWarnings: number;
  wikiHealthErrors: number;
  maintenanceCount: number;
  approvalsCount: number;
  schedulerHealthy: boolean;
  nextAction: string;
  refreshedAt?: Date;
  brainCoreUrl: string;
  orchestratorCount: number;
  pipelineCount: number;
  projectCount: number;
  platformCount: number;
  legacySystemCount: number;
  migrationBlockedCount: number;
  stbPipelineSummary?: { status?: string; health: string; daysStale: number };
  videoOrchestratorSummary?: { status?: string; health: string };
  stbToVideoMigrationSummary?: { parityStatus?: string; blocked: boolean };
  saysTheBibleProjectSummary?: { status?: string; health: string; platformCount: number };
  probotLegacySummary?: { status?: string; health: string };
  stbLiveStatusSummary?: { source: string; status: string; health: string; ageHours?: number };
  videoModuleProgressSummary?: { percent: number; implemented: number; partial: number; planned: number };
  migrationParitySummary?: { percent: number; mappedCount: number; totalCount: number };
  agentCount: number;
  externalExecutorCount: number;
  plannedAgentCount: number;
  blockedAgentCount: number;
  modelRouterAgentSummary?: { status: string; health: string };
  claudeCodexExecutorSummary?: { count: number };
  actionCount: number;
  requestableActionCount: number;
  blockedActionCount: number;
  plannedActionCount: number;
  approvalRequiredActionCount: number;
}

export function deriveDashboardSnapshot(state: BrainConsoleViewState, brainCoreUrl: string): DashboardSnapshot {
  const brainCoreOnline = state.status?.ok === true;
  const offline = state.offline === true;

  // Connection status
  const connectionStatus: ConnectionStatus = offline
    ? 'offline'
    : !brainCoreOnline && state.warning
    ? 'degraded'
    : 'online';

  // Wiki health
  const modelRouterReport = state.runtimeReports?.find((r) => r.id === 'model-router');
  const wikiHealth = modelRouterReport?.wikiHealth;
  const wikiHealthOk = wikiHealth?.ok === true;
  const wikiHealthWarnings = wikiHealth?.warningCount ?? 0;
  const wikiHealthErrors = wikiHealth?.errorCount ?? 0;

  // Maintenance queue
  const maintenanceCount = (state.mindPreviews ?? []).filter((p) => !p.expired).length;

  // Approvals
  const approvalsCount = state.approvals?.length ?? 0;

  // Scheduler
  const schedulerHealthy = state.schedulerStatus?.latestRunStatus !== 'failed';

  // Registry counts
  const orchestratorCount = (state.orchestrators ?? []).length;
  const pipelineCount = (state.pipelines ?? []).length;
  const projectCount = (state.projects ?? []).length;
  const platformCount = (state.platforms ?? []).length;

  // Legacy and migration analysis
  const legacyOrchestratorCount = (state.orchestrators ?? []).filter(o => o.lifecycle === 'legacy').length;
  const legacySystemCount = legacyOrchestratorCount;
  const migrationBlockedCount = (state.pipelines ?? []).filter(p => p.migration?.decommissionBlocked === true).length;

  // STB pipeline summary
  const stbPipeline = (state.pipelines ?? []).find(p => p.id === 'stb-daily-pipeline');
  const stbPipelineSummary = stbPipeline ? {
    status: stbPipeline.status,
    health: stbPipeline.health,
    daysStale: 8,
  } : undefined;

  // Video orchestrator summary
  const videoOrchestrator = (state.orchestrators ?? []).find(o => o.id === 'video-orchestrator');
  const videoOrchestratorSummary = videoOrchestrator ? {
    status: videoOrchestrator.lifecycle,
    health: videoOrchestrator.health ?? 'unknown',
  } : undefined;

  // STB to Video migration summary
  const migrationPipeline = (state.pipelines ?? []).find(p => p.id === 'stb-to-video-migration');
  const stbToVideoMigrationSummary = migrationPipeline ? {
    parityStatus: migrationPipeline.migration?.parityStatus ?? 'unknown',
    blocked: migrationPipeline.migration?.decommissionBlocked === true,
  } : undefined;

  // Says the Bible project summary
  const stbProject = (state.projects ?? []).find(p => p.id === 'says-the-bible');
  const saysTheBibleProjectSummary = stbProject ? {
    status: stbProject.status,
    health: stbProject.health,
    platformCount: stbProject.platformIds?.length ?? 0,
  } : undefined;

  // ProBot legacy summary
  const probotOrchestrator = (state.orchestrators ?? []).find(o => o.id === 'probot-dashboard');
  const probotLegacySummary = probotOrchestrator ? {
    status: probotOrchestrator.lifecycle,
    health: probotOrchestrator.health ?? 'unknown',
  } : undefined;

  // Calculate attention score (0-100)
  let attentionScore = 0;
  if (offline) attentionScore = 100;
  else if (wikiHealthErrors > 0) attentionScore = 85;
  else if (stbPipeline?.health === 'error') attentionScore = 80;
  else if (migrationBlockedCount > 0) attentionScore = 70;
  else if (approvalsCount > 0 || maintenanceCount > 0) attentionScore = 50;
  else if (wikiHealthWarnings > 0 || stbPipeline?.health === 'warning') attentionScore = 30;
  else attentionScore = 10;

  // Attention level
  const attentionLevel: AttentionLevel =
    offline ? 'blocked' :
    attentionScore >= 70 ? 'review' :
    attentionScore >= 40 ? 'watch' :
    'clear';

  // Next action
  const nextAction = deriveNextAction(state, attentionLevel);

  // Live status summaries
  const stbLiveStatusSummary = state.stbStatus ? {
    source: state.stbStatus.source,
    status: state.stbStatus.status,
    health: state.stbStatus.health,
    ageHours: state.stbStatus.lastRunAgeHours,
  } : undefined;

  const videoModuleProgressSummary = state.videoOrchestratorStatus ? {
    percent: state.videoOrchestratorStatus.moduleProgress.percent,
    implemented: state.videoOrchestratorStatus.moduleProgress.implemented,
    partial: state.videoOrchestratorStatus.moduleProgress.partial,
    planned: state.videoOrchestratorStatus.moduleProgress.planned,
  } : undefined;

  const migrationParitySummary = state.stbVideoMigrationStatus ? {
    percent: state.stbVideoMigrationStatus.parityPercent,
    mappedCount: (state.stbVideoMigrationStatus.modules ?? []).filter(m => m.status === 'mapped').length,
    totalCount: state.stbVideoMigrationStatus.modules?.length ?? 0,
  } : undefined;

  // Agent analysis
  const agentCount = (state.agents ?? []).length;
  const externalExecutorCount = (state.agents ?? []).filter(a => a.owner === 'external-tool').length;
  const plannedAgentCount = (state.agents ?? []).filter(a => a.status === 'planned').length;
  const blockedAgentCount = (state.agents ?? []).filter(a => a.status === 'blocked').length;
  const modelRouterAgent = (state.agents ?? []).find(a => a.id === 'model-router-agent');
  const modelRouterAgentSummary = modelRouterAgent ? {
    status: modelRouterAgent.status,
    health: modelRouterAgent.health,
  } : undefined;
  const claudeCodexCount = (state.agents ?? []).filter(a => ['claude-code-executor', 'codex-executor'].includes(a.id)).length;
  const claudeCodexExecutorSummary = claudeCodexCount > 0 ? { count: claudeCodexCount } : undefined;

  // Action analysis
  const actionCount = (state.actions ?? []).length;
  const requestableActionCount = (state.actions ?? []).filter(a => a.canRequestApproval && a.status === 'approval-required').length;
  const blockedActionCount = (state.actions ?? []).filter(a => a.status === 'blocked').length;
  const plannedActionCount = (state.actions ?? []).filter(a => a.status === 'planned').length;
  const approvalRequiredActionCount = (state.actions ?? []).filter(a => a.requiresApproval).length;

  return {
    connectionStatus,
    attentionLevel,
    attentionScore,
    brainCoreOnline,
    wikiHealthOk,
    wikiHealthWarnings,
    wikiHealthErrors,
    maintenanceCount,
    approvalsCount,
    schedulerHealthy,
    nextAction,
    refreshedAt: new Date(),
    brainCoreUrl,
    orchestratorCount,
    pipelineCount,
    projectCount,
    platformCount,
    legacySystemCount,
    migrationBlockedCount,
    stbPipelineSummary,
    videoOrchestratorSummary,
    stbToVideoMigrationSummary,
    saysTheBibleProjectSummary,
    probotLegacySummary,
    stbLiveStatusSummary,
    videoModuleProgressSummary,
    migrationParitySummary,
    agentCount,
    externalExecutorCount,
    plannedAgentCount,
    blockedAgentCount,
    modelRouterAgentSummary,
    claudeCodexExecutorSummary,
    actionCount,
    requestableActionCount,
    blockedActionCount,
    plannedActionCount,
    approvalRequiredActionCount,
  };
}

function deriveNextAction(state: BrainConsoleViewState, level: AttentionLevel): string {
  if (state.offline) return 'Start Brain Core to load live data';

  const blockers = state.executionReadiness?.blockers ?? [];
  if (blockers.length > 0) return `Blocked: ${blockers[0]}`;

  const readyCount = state.executionReadiness?.readyCandidateCount ?? 0;
  if (readyCount > 0) return `${readyCount} candidate(s) ready`;

  if ((state.approvals ?? []).length > 0) return 'Review pending approvals';
  if ((state.mindPreviews ?? []).filter(p => !p.expired).length > 0) return 'Review maintenance queue';

  return 'System healthy, all clear';
}

export function formatRelativeTime(date: Date | string | undefined): string {
  if (!date) return 'never';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = Date.now();
  const ms = now - d.getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return `${seconds}s ago`;
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

export function safeNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getConnectionStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'online': return '#22c55e'; // green
    case 'degraded': return '#eab308'; // yellow
    case 'offline': return '#ef4444'; // red
  }
}

export function getAttentionBadgeColor(level: AttentionLevel): string {
  switch (level) {
    case 'clear': return '#22c55e';
    case 'watch': return '#eab308';
    case 'review': return '#f97316';
    case 'blocked': return '#ef4444';
  }
}
