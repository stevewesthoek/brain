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
  postOrchestratorStatus?: string;
  postOrchestratorModuleCount: number;
  postOrchestratorBlockedCount: number;
  postOrchestratorContractCount: number;
  postOrchestratorIntegrationCount: number;
  postFlowCount: number;
  postDraftFixtureCount: number;
  postEventFixtureCount: number;
  postDryRunDraftCount: number;
  postDryRunStatus?: string;
  postDryRunBlockedCount: number;
  postDryRunNextSafeStep: string;
  postDryRunPublishingEnabled: boolean;
  postDryRunSchedulingEnabled: boolean;
  postDryRunExecutionEnabled: boolean;
  postReviewQueueItemCount: number;
  postReviewQueueApprovalRequestedCount: number;
  postReviewQueueBlockedCount: number;
  postReviewQueueStatus?: string;
  postReviewQueueNextSafeStep: string;
  postReviewQueuePublishingEnabled: boolean;
  postReviewQueueSchedulingEnabled: boolean;
  postReviewQueueExecutionEnabled: boolean;
  postSchedulePreviewItemCount: number;
  postSchedulePreviewApprovalRequestedCount: number;
  postSchedulePreviewBlockedCount: number;
  postSchedulePreviewStatus?: string;
  postSchedulePreviewNextSafeStep: string;
  postSchedulePreviewPublishingEnabled: boolean;
  postSchedulePreviewSchedulingEnabled: boolean;
  postSchedulePreviewExecutionEnabled: boolean;
  postAnalyticsFixtureCount: number;
  postAnalyticsPlatformCount: number;
  postAnalyticsExternalApiCallsEnabled: boolean;
  postAnalyticsNextSafeStep: string;
  postPipelineStepCount: number;
  postPipelineBlockerCount: number;
  postPipelineApprovalRequiredCount: number;
  postPipelineNextSafeStep: string;
  postReadinessScore: number;
  postReadinessGrade?: string;
  postReadinessBlockerCount: number;
  postReadinessStatus?: string;
  postReadinessNextSafeStep: string;
  postPlatformPolicyCount: number;
  postPlatformPolicyBlockedCount: number;
  postPlatformPolicyHighRiskCount: number;
  postDecommissionItemCount: number;
  postDecommissionBlockedCount: number;
  postDecommissionReadyCount: number;
  postDecommissionOverallStatus?: string;
  postDecommissionStarted: boolean;
  postOperatorGuidanceItemCount: number;
  postOperatorGuidanceBlockedCount: number;
  postOperatorGuidanceWarningCount: number;
  postOperatorGuidanceNextSafeStep: string;
  postManualExportItemCount: number;
  postManualExportStatus?: string;
  postManualExportWritesFiles: boolean;
  postManualExportWritesExternalPlatform: boolean;
  postManualExportWritesToMind: boolean;
  postManualExportDownloadsFile: boolean;
  postManualExportCopiesToClipboard: boolean;
  postManualExportPublishingEnabled: boolean;
  postManualExportSchedulingEnabled: boolean;
  postManualExportExecutionEnabled: boolean;
  postManualExportNextSafeStep: string;
  postManualExportTitle?: string;
  postManualExportPreviewOnly: boolean;
  postManualExportItemPreviewCount: number;
  postManualExportPackageStatus?: string;
  postManualExportPackageId?: string;
  postPlatformCount: number;
  postPublishingDisabledCount: number;
  socialProofFlowStatus?: string;
  growthOptimizationFlowStatus?: string;
  xPostFlowStatus?: string;
  githubPostFlowStatus?: string;
  linkedinPostFlowStatus?: string;
  postPublishingEnabled: boolean;
  postSchedulingEnabled: boolean;
  postNextSafeStep: string;
  postRecoveryCount: number;
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
  agentRunCount: number;
  agentRunBlockedCount: number;
  agentRunPlannedCount: number;
  recoveryItemCount: number;
  recoveryItemErrorCount: number;
  recoveryItemWarningCount: number;
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

  const postOrchestratorStatus = state.postOrchestratorStatus?.status;
  const postOrchestratorModuleCount = state.postOrchestratorStatus?.modules?.length ?? 0;
  const postOrchestratorBlockedCount = (state.postOrchestratorStatus?.modules ?? []).filter((module) => module.status === 'blocked').length;
  const postOrchestratorContractCount = state.postOrchestratorStatus ? 8 : 0;
  const postOrchestratorIntegrationCount = state.postOrchestratorStatus ? 3 : 0;
  const postFlowCount = state.postOrchestratorStatus ? 8 : 0;
  const postDraftFixtureCount = state.postOrchestratorDrafts?.drafts?.length ?? 0;
  const postEventFixtureCount = state.postOrchestratorEvents?.events?.length ?? 0;
  const postDryRunDraftCount = state.postOrchestratorDryRun?.plan?.drafts?.length ?? 0;
  const postDryRunStatus = state.postOrchestratorDryRun?.plan?.status;
  const postDryRunBlockedCount = (state.postOrchestratorDryRun?.plan?.blockers ?? []).length;
  const postDryRunNextSafeStep = state.postOrchestratorDryRun?.plan?.nextSafeStep ?? 'Select an event fixture to preview.';
  const postDryRunPublishingEnabled = Boolean(state.postOrchestratorDryRun?.plan?.safety.publishingEnabled);
  const postDryRunSchedulingEnabled = Boolean(state.postOrchestratorDryRun?.plan?.safety.schedulingEnabled);
  const postDryRunExecutionEnabled = Boolean(state.postOrchestratorDryRun?.plan?.safety.executionEnabled);
  const postReviewQueueItemCount = state.postOrchestratorReviewQueue?.queue?.itemCount ?? 0;
  const postReviewQueueApprovalRequestedCount = state.postOrchestratorReviewQueue?.queue?.approvalRequestedCount ?? 0;
  const postReviewQueueBlockedCount = state.postOrchestratorReviewQueue?.queue?.blockedCount ?? 0;
  const postReviewQueueStatus = state.postOrchestratorReviewQueue?.queue?.status;
  const postReviewQueueNextSafeStep = state.postOrchestratorReviewQueue?.queue?.items.find((item) => item.canRequestApproval)?.nextSafeStep ?? 'Select a review item to request approval.';
  const postReviewQueuePublishingEnabled = Boolean(state.postOrchestratorReviewQueue?.queue?.safety.publishingEnabled);
  const postReviewQueueSchedulingEnabled = Boolean(state.postOrchestratorReviewQueue?.queue?.safety.schedulingEnabled);
  const postReviewQueueExecutionEnabled = Boolean(state.postOrchestratorReviewQueue?.queue?.safety.executionEnabled);
  const postSchedulePreviewItemCount = state.postOrchestratorSchedulePreview?.queue?.itemCount ?? 0;
  const postSchedulePreviewApprovalRequestedCount = state.postOrchestratorSchedulePreview?.queue?.approvalRequestedCount ?? 0;
  const postSchedulePreviewBlockedCount = state.postOrchestratorSchedulePreview?.queue?.blockedCount ?? 0;
  const postSchedulePreviewStatus = state.postOrchestratorSchedulePreview?.queue?.status;
  const postSchedulePreviewNextSafeStep = state.postOrchestratorSchedulePreview?.queue?.items.find((item) => item.canRequestApproval)?.nextSafeStep ?? 'Select a schedule preview item to request review.';
  const postSchedulePreviewPublishingEnabled = Boolean(state.postOrchestratorSchedulePreview?.queue?.safety.publishingEnabled);
  const postSchedulePreviewSchedulingEnabled = Boolean(state.postOrchestratorSchedulePreview?.queue?.safety.schedulingEnabled);
  const postSchedulePreviewExecutionEnabled = Boolean(state.postOrchestratorSchedulePreview?.queue?.safety.executionEnabled);
  const postAnalyticsFixtureCount = state.postOrchestratorAnalytics?.analytics?.length ?? 0;
  const postAnalyticsPlatformCount = new Set(state.postOrchestratorAnalytics?.analytics?.map((item) => item.platform) ?? []).size;
  const postAnalyticsExternalApiCallsEnabled = Boolean(state.postOrchestratorAnalytics?.analytics?.some((item) => item.safety.callsExternalAnalyticsApi));
  const postAnalyticsNextSafeStep = postAnalyticsFixtureCount > 0
    ? 'Review fixture analytics and keep all external analytics calls disabled.'
    : 'Add fixture analytics summaries before extending feedback loops.';
  const postPipelineStepCount = state.postOrchestratorPipeline?.pipeline?.steps?.length ?? 0;
  const postPipelineBlockerCount = state.postOrchestratorPipeline?.pipeline?.totals.blockerCount ?? 0;
  const postPipelineApprovalRequiredCount = state.postOrchestratorPipeline?.pipeline?.totals.approvalRequiredCount ?? 0;
  const postPipelineNextSafeStep = state.postOrchestratorPipeline?.pipeline?.nextSafeStep ?? 'Review the pipeline summary.';
  const postReadinessScore = state.postOrchestratorReadiness?.readiness?.score ?? 0;
  const postReadinessGrade = state.postOrchestratorReadiness?.readiness?.grade;
  const postReadinessBlockerCount = state.postOrchestratorReadiness?.readiness?.blockers?.length ?? 0;
  const postReadinessStatus = state.postOrchestratorReadiness?.readiness?.status;
  const postReadinessNextSafeStep = state.postOrchestratorReadiness?.readiness?.nextSafeStep ?? 'Review the readiness score.';
  const postPlatformPolicyCount = state.postOrchestratorPlatformPolicies?.policies?.length ?? 0;
  const postPlatformPolicyBlockedCount = state.postOrchestratorPlatformPolicies?.policies?.filter((policy) => policy.status === 'blocked' || policy.riskLevel === 'blocked')?.length ?? 0;
  const postPlatformPolicyHighRiskCount = state.postOrchestratorPlatformPolicies?.policies?.filter((policy) => policy.riskLevel === 'high')?.length ?? 0;
  const postDecommissionItemCount = state.postOrchestratorDecommissionReadiness?.items?.length ?? 0;
  const postDecommissionBlockedCount = state.postOrchestratorDecommissionReadiness?.items?.filter((item) => item.status === 'blocked')?.length ?? 0;
  const postDecommissionReadyCount = state.postOrchestratorDecommissionReadiness?.items?.filter((item) => item.status === 'ready-for-review' || item.status === 'approved')?.length ?? 0;
  const postDecommissionOverallStatus = state.postOrchestratorDecommissionReadiness?.overall?.status;
  const postDecommissionStarted = state.postOrchestratorDecommissionReadiness?.overall?.decommissionStarted ?? false;
  const postOperatorGuidanceItemCount = state.postOrchestratorOperatorGuidance?.items?.length ?? 0;
  const postOperatorGuidanceBlockedCount = state.postOrchestratorOperatorGuidance?.items?.filter((item) => item.severity === 'blocked').length ?? 0;
  const postOperatorGuidanceWarningCount = state.postOrchestratorOperatorGuidance?.items?.filter((item) => item.severity === 'warning').length ?? 0;
  const postOperatorGuidanceNextSafeStep = state.postOrchestratorOperatorGuidance?.summary?.nextSafeStep ?? 'Review operator guidance.';
  const postManualExportItemCount = state.postOrchestratorManualExportPackage?.package?.itemCount ?? 0;
  const postManualExportStatus = state.postOrchestratorManualExportPackage?.package?.status;
  const postManualExportWritesFiles = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.writesFiles);
  const postManualExportWritesExternalPlatform = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.writesExternalPlatform);
  const postManualExportWritesToMind = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.writesToMind);
  const postManualExportDownloadsFile = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.downloadsFile);
  const postManualExportCopiesToClipboard = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.copiesToClipboard);
  const postManualExportPublishingEnabled = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.publishingEnabled);
  const postManualExportSchedulingEnabled = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.schedulingEnabled);
  const postManualExportExecutionEnabled = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.executionEnabled);
  const postManualExportNextSafeStep = state.postOrchestratorManualExportPackage?.package?.nextSafeStep ?? 'Review manual export preview.';
  const postManualExportTitle = state.postOrchestratorManualExportPackage?.package?.title;
  const postManualExportPreviewOnly = Boolean(state.postOrchestratorManualExportPackage?.package?.safety.previewOnly);
  const postManualExportItemPreviewCount = state.postOrchestratorManualExportPackage?.package?.items?.length ?? 0;
  const postManualExportPackageStatus = state.postOrchestratorManualExportPackage?.package?.status;
  const postManualExportPackageId = state.postOrchestratorManualExportPackage?.package?.id;  const postPlatformCount = (state.postOrchestratorFlows?.flows ?? []).filter((flow) => flow.platform !== 'internal').length;
  const postPublishingDisabledCount = (state.postOrchestratorFlows?.flows ?? []).filter((flow) => flow.publishingEnabled === false).length;
  const postPublishingEnabled = Boolean(state.postOrchestratorStatus?.publishingEnabled);
  const postSchedulingEnabled = Boolean(state.postOrchestratorStatus?.schedulingEnabled);
  const postNextSafeStep = state.postOrchestratorStatus?.nextSafeStep ?? 'Review the read-only Post Orchestrator scaffold.';
  const postRecoveryCount = state.recoveryItems?.filter((item) => item.id.startsWith('post-') || item.id.includes('proofly') || item.id.includes('xgrow')).length ?? 0;
  const socialProofFlowStatus = 'contract-defined';
  const growthOptimizationFlowStatus = 'contract-defined';
  const xPostFlowStatus = 'stubbed';
  const githubPostFlowStatus = 'planned';
  const linkedinPostFlowStatus = 'stubbed';

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

  // Agent run analysis (Phase 4G)
  const agentRunCount = (state.agentRuns ?? []).length;
  const agentRunBlockedCount = (state.agentRuns ?? []).filter(r => r.status === 'blocked').length;
  const agentRunPlannedCount = (state.agentRuns ?? []).filter(r => r.status === 'planned').length;

  // Recovery item analysis (Phase 4G)
  const recoveryItemCount = (state.recoveryItems ?? []).length;
  const recoveryItemErrorCount = (state.recoveryItems ?? []).filter(i => i.severity === 'error').length;
  const recoveryItemWarningCount = (state.recoveryItems ?? []).filter(i => i.severity === 'warning').length;

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
    postOrchestratorStatus,
    postOrchestratorModuleCount,
    postOrchestratorBlockedCount,
    postOrchestratorContractCount,
    postOrchestratorIntegrationCount,
    postFlowCount,
    postDraftFixtureCount,
    postEventFixtureCount,
    postDryRunDraftCount,
    postDryRunStatus,
    postDryRunBlockedCount,
    postDryRunNextSafeStep,
    postDryRunPublishingEnabled,
    postDryRunSchedulingEnabled,
    postDryRunExecutionEnabled,
    postReviewQueueItemCount,
    postReviewQueueApprovalRequestedCount,
    postReviewQueueBlockedCount,
    postReviewQueueStatus,
    postReviewQueueNextSafeStep,
    postReviewQueuePublishingEnabled,
    postReviewQueueSchedulingEnabled,
    postReviewQueueExecutionEnabled,
    postSchedulePreviewItemCount,
    postSchedulePreviewApprovalRequestedCount,
    postSchedulePreviewBlockedCount,
    postSchedulePreviewStatus,
    postSchedulePreviewNextSafeStep,
    postSchedulePreviewPublishingEnabled,
    postSchedulePreviewSchedulingEnabled,
    postSchedulePreviewExecutionEnabled,
    postAnalyticsFixtureCount,
    postAnalyticsPlatformCount,
    postAnalyticsExternalApiCallsEnabled,
    postAnalyticsNextSafeStep,
    postPipelineStepCount,
    postPipelineBlockerCount,
    postPipelineApprovalRequiredCount,
    postPipelineNextSafeStep,
    postReadinessScore,
    postReadinessGrade,
    postReadinessBlockerCount,
    postReadinessStatus,
    postReadinessNextSafeStep,
    postPlatformPolicyCount,
    postPlatformPolicyBlockedCount,
    postPlatformPolicyHighRiskCount,
    postDecommissionItemCount,
    postDecommissionBlockedCount,
    postDecommissionReadyCount,
    postDecommissionOverallStatus,
    postDecommissionStarted,
    postOperatorGuidanceItemCount,
    postOperatorGuidanceBlockedCount,
    postOperatorGuidanceWarningCount,
    postOperatorGuidanceNextSafeStep,
    postManualExportItemCount,
    postManualExportStatus,
    postManualExportWritesFiles,
    postManualExportWritesExternalPlatform,
    postManualExportWritesToMind,
    postManualExportDownloadsFile,
    postManualExportCopiesToClipboard,
    postManualExportPublishingEnabled,
    postManualExportSchedulingEnabled,
    postManualExportExecutionEnabled,
    postManualExportNextSafeStep,
    postManualExportTitle,
    postManualExportPreviewOnly,
    postManualExportItemPreviewCount,
    postManualExportPackageStatus,
    postManualExportPackageId,
    postPlatformCount,
    postPublishingDisabledCount,
    socialProofFlowStatus,
    growthOptimizationFlowStatus,
    xPostFlowStatus,
    githubPostFlowStatus,
    linkedinPostFlowStatus,
    postPublishingEnabled,
    postSchedulingEnabled,
    postNextSafeStep,
    postRecoveryCount,
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
    agentRunCount,
    agentRunBlockedCount,
    agentRunPlannedCount,
    recoveryItemCount,
    recoveryItemErrorCount,
    recoveryItemWarningCount,
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
