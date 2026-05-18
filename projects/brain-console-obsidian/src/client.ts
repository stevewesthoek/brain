export interface BrainCoreStatus {
  service: 'brain-core';
  mode: 'read-only';
  ok: boolean;
  startedAt?: string;
  uptimeSeconds?: number;
  version?: string;
  host?: string;
}

export interface BrainCoreCapabilitySummary {
  readEndpoints: string[];
  approvalRequestEndpoints: string[];
  executableActionsEnabled: boolean;
  approvalAuditPersistenceSupported: boolean;
  runtimeReportsSupported: boolean;
  runtimeReportEndpoint: string;
  modelRouterReportSupported: boolean;
  obsidianPluginInstalled: boolean;
  liveSchedulerVerified: boolean;
  mindWorkspace?: {
    legacyTaskMigrationStatus?: string;
    legacyTaskMigrationCommit?: string;
    cleanupInventory?: string;
    workspaceIsolationRunbook?: string;
    remainingKnownDirtyCategories?: string[];
  };
  brainConsole?: {
    scaffoldStatus?: string;
    installedInMindVault?: boolean;
    projectPath?: string;
    packageStatus?: string;
    manualInstallRequired?: boolean;
  };
  probot?: {
    thinClientStatus?: string;
    commandAliasesEnabled?: boolean;
    actionsEnabled?: boolean;
  };
  executionGate?: {
    executionEnabled?: boolean;
    modelRouterDryRunExecutionFlagEnabled?: boolean;
    modelRouterDryRunExecutionFlagName?: string;
    candidateActionKinds?: string[];
    readinessEndpoint?: string;
    plansEndpoint?: string;
    firstCandidate?: string;
  };
  notes: string[];
}

export type BrainCoreRuntimeReportId = 'model-router' | 'approval-audit' | 'video' | 'local-apps';

export interface BrainCoreRuntimeReportSummary {
  id: BrainCoreRuntimeReportId;
  status: 'available' | 'missing' | 'invalid';
  path: string;
  latestRunStatus: 'ok' | 'failed' | 'unknown';
  message: string;
  writesToMind: false;
  executableActions: false;
  wikiHealth?: {
    status: 'available' | 'unavailable';
    ok: boolean;
    errorCount: number;
    warningCount: number;
  };
}

export interface BrainCoreModelRouterReportDetail {
  exists: boolean;
  status: 'available' | 'missing' | 'invalid';
  latestRunStatus?: 'ok' | 'failed' | 'unknown';
  path?: string;
  message?: string;
  writesToMind: false;
  externalSideEffects: false;
  applyEnabled: false;
  wikiHealth?: {
    ok: boolean;
    errorCount: number;
    warningCount: number;
  };
}

export interface BrainCoreSchedulerStatus {
  status: 'not-configured' | 'placeholder' | 'runtime-report';
  enabled: boolean;
  latestRunAt?: string;
  latestRunStatus?: 'ok' | 'failed' | 'unknown';
  source: 'placeholder' | 'runtime-report';
  message: string;
}

export interface BrainCoreSchedulerJobSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'disabled' | 'unknown' | 'ok' | 'failed';
  mutationRequired: boolean;
}

export interface BrainCoreSessionSummary {
  id: string;
  tool: 'claude' | 'codex' | 'gemini' | 'unknown';
  repo?: string;
  title: string;
  updatedAt?: string;
  age?: string;
  intent?: string;
  score?: number;
  source: 'placeholder' | 'adapter';
}

export interface BrainCoreRepoSummary {
  alias: string;
  path: string;
  exists: boolean;
  handoffPath?: string;
  handoffExists: boolean;
  source: 'env' | 'placeholder';
}

export interface BrainCoreLocalAppSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'unknown' | 'disabled' | 'running' | 'stopped';
  source: 'placeholder' | 'runtime-report';
  actionsSupported: boolean;
}

export interface BrainCoreVideoStatus {
  status: 'placeholder' | 'not-configured' | 'ok' | 'failed' | 'unknown';
  enabled: boolean;
  queueDepth: number;
  latestRunAt?: string;
  source: 'placeholder' | 'runtime-report';
  message: string;
}

export interface BrainCoreVideoQueueItem {
  id: string;
  title: string;
  status: 'placeholder' | 'queued' | 'running' | 'failed' | 'done';
  source: 'placeholder' | 'runtime-report';
}

export interface BrainCoreOrchestratorSummary {
  id: string;
  name: string;
  status: string;
  source?: string;
  actionsSupported: boolean;
  health?: string;
  lifecycle?: string;
  role?: string;
  description?: string;
}

export interface BrainCorePipelineMigration {
  sourcePipelineId?: string;
  targetPipelineId?: string;
  parityStatus?: string;
  decommissionBlocked?: boolean;
}

export interface BrainCorePipelineSummary {
  id: string;
  name: string;
  status: string;
  health: string;
  role: string;
  description: string;
  stages?: string[];
  migration?: BrainCorePipelineMigration;
}

export interface BrainCoreProjectSummary {
  id: string;
  name: string;
  category: string;
  status: string;
  health: string;
  orchestratorIds?: string[];
  pipelineIds?: string[];
  platformIds?: string[];
}

export interface BrainCorePlatformSummary {
  id: string;
  name: string;
  category: string;
  status: string;
  health: string;
  projectIds?: string[];
  pipelineIds?: string[];
}

export type BrainCorePostOrchestratorStatus =
  | 'planned'
  | 'partial'
  | 'ready'
  | 'blocked'
  | 'disabled';

export type BrainCorePostProviderStatus =
  | 'not-integrated'
  | 'planned'
  | 'contract-defined'
  | 'stubbed'
  | 'ready'
  | 'blocked';

export type BrainCorePostContractStatus = 'draft' | 'defined' | 'validated' | 'implemented' | 'blocked';

export interface BrainCorePostOrchestratorModule {
  id: string;
  name: string;
  internalName?: string;
  legacySource?: 'proofly' | 'xgrow';
  status: BrainCorePostOrchestratorStatus;
  summary: string;
  owner: 'brain' | 'proofly' | 'xgrow' | 'platform' | 'external';
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCorePostOrchestratorContract {
  id: string;
  name: string;
  status: BrainCorePostContractStatus;
  version: string;
  owner: 'brain' | 'proofly' | 'xgrow';
  summary: string;
  fields: string[];
  implementedInBrain: boolean;
  implementedInProvider: boolean;
  executionEnabled: false;
}

export interface BrainCorePostOrchestratorIntegration {
  id: string;
  provider: 'proofly' | 'xgrow' | 'brain' | 'platform';
  legacySource?: 'proofly' | 'xgrow';
  name: string;
  internalName?: string;
  status: BrainCorePostProviderStatus;
  role: string;
  summary: string;
  contractIds: string[];
  executionEnabled: false;
  publishingEnabled: false;
  schedulingEnabled: false;
  safety: {
    readsSecrets: false;
    usesCookies: boolean;
    usesPlaywright: boolean;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresApproval: boolean;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCorePostOrchestratorRecoveryItem {
  id: string;
  severity: 'info' | 'warning' | 'error';
  source: 'brain' | 'proofly' | 'xgrow' | 'platform' | 'contract';
  title: string;
  summary: string;
  blocker: string;
  nextSafeStep: string;
  canAutoFix: false;
  executionEnabled: false;
}

export type BrainCorePostPlatform = 'x' | 'github' | 'linkedin' | 'facebook' | 'youtube' | 'blog' | 'internal';
export type BrainCorePostFlowStatus = 'stubbed' | 'planned' | 'blocked' | 'ready-read-only' | 'disabled';
export type BrainCorePostDraftStatus = 'fixture' | 'preview' | 'requires-approval' | 'blocked' | 'disabled';

export interface BrainCorePostFlowFixture {
  id: string;
  name: string;
  platform: BrainCorePostPlatform;
  status: BrainCorePostFlowStatus;
  summary: string;
  eventTypes: string[];
  outputFormats: string[];
  usesSocialProofAssetFlow: boolean;
  usesGrowthOptimizationFlow: boolean;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCorePostDraftFixture {
  id: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  sourceEventType: string;
  title: string;
  copyPreview: string;
  format: 'single-post' | 'thread' | 'carousel' | 'release-note' | 'short-video-caption' | 'blog-summary';
  status: BrainCorePostDraftStatus;
  approvalRequired: true;
  assetFlowRequired: boolean;
  optimizationFlowRequired: boolean;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  safety: {
    generatedFromFixture: true;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
  };
}

export interface BrainCorePostOrchestratorStatusResponse {
  id: 'post-orchestrator';
  name: 'Post Orchestrator';
  status: BrainCorePostOrchestratorStatus;
  summary: string;
  phase: 'P1-read-only-status-scaffold';
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  socialProofFlowLabel: string;
  growthOptimizationFlowLabel: string;
  modules: BrainCorePostOrchestratorModule[];
  nextSafeStep: string;
  updatedAt: string;
}

export interface BrainCorePostOrchestratorContractsResponse {
  contracts: BrainCorePostOrchestratorContract[];
}

export interface BrainCorePostOrchestratorIntegrationsResponse {
  integrations: BrainCorePostOrchestratorIntegration[];
}

export interface BrainCorePostOrchestratorRecoveryResponse {
  items: BrainCorePostOrchestratorRecoveryItem[];
}

export interface BrainCorePostFlowFixturesResponse {
  flows: BrainCorePostFlowFixture[];
}

export interface BrainCorePostDraftFixturesResponse {
  drafts: BrainCorePostDraftFixture[];
}

export interface BrainCoreStbPipelineStatus {
  id: 'stb-pipeline-status';
  pipelineId: 'stb-daily-pipeline';
  projectId: 'says-the-bible';
  source: string;
  status: string;
  health: string;
  lastRunAt?: string;
  lastRunAgeHours?: number;
  summary: string;
  evidence: Array<{ label: string; path?: string; value: string }>;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export interface BrainCoreVideoOrchestratorStatus {
  id: 'video-orchestrator-status';
  orchestratorId: 'video-orchestrator';
  pipelineId: string;
  status: string;
  health: string;
  moduleProgress: { total: number; implemented: number; partial: number; planned: number; percent: number };
  modules: Array<{ id: string; name: string; status: string; summary: string }>;
  supportedProjects: string[];
  supportedPlatforms: string[];
  summary: string;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export interface BrainCoreStbVideoMigrationStatus {
  id: 'stb-to-video-migration-status';
  sourcePipelineId: string;
  targetPipelineId: string;
  status: string;
  health: string;
  parityPercent: number;
  decommissionBlocked: boolean;
  nextSafeTask: string;
  modules: Array<{ stbConcept: string; videoModule: string; status: string }>;
  summary: string;
  blockers: string[];
}

export interface BrainCoreAgentSummary {
  id: string;
  name: string;
  role: string;
  status: string;
  health: string;
  owner: string;
  description: string;
  relatedOrchestratorId?: string;
  skills: string[];
  actions: { canRun: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export type BrainCoreActionKind =
  | 'model-router-dry-run'
  | 'stb-status-refresh'
  | 'video-status-refresh'
  | 'stb-video-migration-review'
  | 'agent-readiness-review'
  | 'local-app-start'
  | 'local-app-stop'
  | 'local-app-restart'
  | 'orchestrator-run'
  | 'pipeline-dry-run'
  | 'mind-write-apply';

export type BrainCoreActionRisk = 'low' | 'medium' | 'high' | 'blocked';

export type BrainCoreActionStatus =
  | 'available'
  | 'approval-required'
  | 'planned'
  | 'blocked'
  | 'disabled';

export interface BrainCoreActionSafety {
  writesToMind: boolean;
  executesShell: boolean;
  mutatesRuntime: boolean;
  touchesStb: boolean;
  touchesVideo: boolean;
  requiresHumanReview: boolean;
}

export interface BrainCoreActionSummary {
  id: string;
  kind: BrainCoreActionKind;
  label: string;
  description: string;
  targetType: 'system' | 'agent' | 'orchestrator' | 'pipeline' | 'project' | 'platform' | 'mind' | 'local-app';
  targetId: string;
  status: BrainCoreActionStatus;
  risk: BrainCoreActionRisk;
  requiresApproval: boolean;
  canRequestApproval: boolean;
  canExecuteNow: false;
  reason: string;
  safety: BrainCoreActionSafety;
}

export interface BrainCoreActionRequest {
  id: string;
  actionId: string;
  requestedAt: string;
  status: 'requested' | 'blocked' | 'invalid';
  summary: string;
  approvalId?: string | undefined;
  executionDidRun: false;
  safety: BrainCoreActionSafety;
}

export interface BrainCoreApprovalSummary {
  id: string;
  kind: string;
  status: 'placeholder' | 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  source: 'placeholder' | 'memory';
}

export interface BrainCoreApprovalDetail {
  id: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: string;
  expiresAt?: string;
  ageMinutes?: number;
  expired?: boolean;
  requestedBy: string;
  reason?: string;
  message?: string;
}

export interface BrainCoreApprovalStoreSummary {
  enabled: boolean;
  status: 'memory' | 'available' | 'invalid' | 'unsafe';
  path: string;
  recordCount: number;
  writesToMind: false;
  executableActions: false;
}

export interface BrainCoreAgentRunSummary {
  id: string;
  agentId: string;
  title: string;
  kind: string;
  status: 'queued' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled' | 'planned' | 'unknown';
  startedAt?: string;
  completedAt?: string;
  ageMinutes?: number;
  durationSeconds?: number;
  targetType: string;
  targetId: string;
  source: 'approval' | 'scheduler' | 'placeholder';
  summary: string;
  relatedApprovalId?: string;
  relatedActionId?: string;
  relatedReportId?: string;
  relatedPipelineId?: string;
  blockers: string[];
  safety: {
    writesToMind: false;
    executesShell: boolean;
    mutatesRuntime: boolean;
    requiresApproval: boolean;
    executionEnabled: false;
  };
}

export interface BrainCoreAgentEventSummary {
  id: string;
  runId?: string;
  agentId?: string;
  type: 'requested' | 'approved' | 'rejected' | 'executed' | 'failed' | 'blocked' | 'unknown';
  createdAt: string;
  status: 'pending' | 'completed' | 'failed' | 'unknown';
  summary: string;
  severity: 'info' | 'warning' | 'error';
  relatedApprovalId?: string;
  relatedActionId?: string;
  relatedReportId?: string;
}

export interface BrainCoreRecoveryItemSummary {
  id: string;
  severity: 'info' | 'warning' | 'error';
  source: 'action' | 'approval' | 'report' | 'stb' | 'video' | 'scheduler' | 'maintenance' | 'system';
  title: string;
  summary: string;
  blocker: string;
  nextSafeStep: string;
  relatedActionId?: string;
  relatedApprovalId?: string;
  relatedEndpoint?: string;
  safety: {
    canAutoFix: false;
    requiresApproval: boolean;
    writesToMind: false;
  };
}

export interface BrainCoreExecutionPlanStep {
  id: string;
  description: string;
  commandPreview: string;
  willRunNow: false;
}

export interface BrainCoreExecutionPlan {
  kind: string;
  candidate: boolean;
  executionEnabled: false;
  modelRouterDryRunExecutionFlagEnabled?: boolean;
  modelRouterDryRunExecutionFlagName?: string;
  wouldExecute: false;
  executed: false;
  riskLevel: 'low' | 'medium' | 'high';
  writesToMind: false;
  externalSideEffects: false;
  requiresApproval: true;
  requiresDurableApprovalStore: true;
  requiresDurableAudit: true;
  requiresRollbackPlan: true;
  rollbackPlan: string;
  summary: string;
  steps: BrainCoreExecutionPlanStep[];
}

export interface BrainCoreExecutionReadiness {
  executionEnabled: false;
  modelRouterDryRunExecutionFlagEnabled?: boolean;
  modelRouterDryRunExecutionFlagName?: string;
  candidateCount: number;
  readyCandidateCount: number;
  blockers: string[];
  writesToMind: false;
  executableActions: false;
}

export interface BrainCoreMindPreviewPolicy {
  status: 'preview-only';
  firstProposedAction: string;
  firstProposedTarget: string;
  applyRouteEnabled: boolean;
  writesToMind: boolean;
  externalSideEffects: boolean;
  allowedTargets: string[];
  blockedPrefixes: string[];
  requiredGates: string[];
  docs: Array<{ path: string; description: string }>;
}

export interface BrainCoreMindPreviewSummary {
  id: string;
  actionKind: string;
  targetPath: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  allowedRoot: boolean;
  blockedRoot: boolean;
  writesToMind: false;
  externalSideEffects: false;
}

export interface BrainCoreMaintenancePreviewSummary {
  queueId: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  actionCount: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  approvalRequiredCount: number;
  writesToMind: false;
  externalSideEffects: false;
}

export interface BrainCoreMaintenancePreviewDetail extends BrainCoreMaintenancePreviewSummary {
  topActions: Array<{
    kind: string;
    title: string;
    risk: string;
  }>;
}

export interface BrainConsoleSnapshot {
  status?: BrainCoreStatus;
  capabilities?: BrainCoreCapabilitySummary;
  runtimeReports?: BrainCoreRuntimeReportSummary[];
  videoStatus?: BrainCoreVideoStatus;
  videoQueue?: BrainCoreVideoQueueItem[];
  localApps?: BrainCoreLocalAppSummary[];
  schedulerStatus?: BrainCoreSchedulerStatus;
  schedulerJobs?: BrainCoreSchedulerJobSummary[];
  sessions?: BrainCoreSessionSummary[];
  repos?: BrainCoreRepoSummary[];
  approvals?: BrainCoreApprovalSummary[];
  approvalStore?: BrainCoreApprovalStoreSummary;
  executionPlans?: BrainCoreExecutionPlan[];
  executionReadiness?: BrainCoreExecutionReadiness;
  mindPreviewPolicy?: BrainCoreMindPreviewPolicy;
  mindPreviews?: BrainCoreMindPreviewSummary[];
  orchestrators?: BrainCoreOrchestratorSummary[];
  pipelines?: BrainCorePipelineSummary[];
  projects?: BrainCoreProjectSummary[];
  platforms?: BrainCorePlatformSummary[];
  postOrchestratorStatus?: BrainCorePostOrchestratorStatusResponse;
  stbStatus?: BrainCoreStbPipelineStatus;
  videoOrchestratorStatus?: BrainCoreVideoOrchestratorStatus;
  stbVideoMigrationStatus?: BrainCoreStbVideoMigrationStatus;
  agents?: BrainCoreAgentSummary[];
}

export interface HttpResult<T> {
  value?: T;
  error?: string;
  detail?: string;
  url?: string;
  status?: number;
  responseTimeMs?: number;
}

export interface EndpointError {
  pathname: string;
  error?: string;
  detail?: string;
  status?: number;
  url?: string;
}

const REQUEST_TIMEOUT_MS = 1_500;

// Track which URL worked (for localhost/127 fallback diagnostics)
let lastWorkingUrl: string | null = null;

export async function readBrainConsoleSnapshot(baseUrl: string): Promise<BrainConsoleSnapshot & { endpointErrors?: EndpointError[] }> {
  let normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const endpointErrors: EndpointError[] = [];

  const [status, capabilities, runtimeReports, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, stbStatus, videoOrchestratorStatus, stbVideoMigrationStatus, agents] = await Promise.all([
    fetchJson<BrainCoreStatus>(normalizedBaseUrl, '/status'),
    fetchJson<BrainCoreCapabilitySummary>(normalizedBaseUrl, '/capabilities'),
    fetchJson<{ reports?: BrainCoreRuntimeReportSummary[] }>(normalizedBaseUrl, '/runtime/reports'),
    fetchJson<BrainCoreSchedulerStatus>(normalizedBaseUrl, '/scheduler/status'),
    fetchJson<{ jobs?: BrainCoreSchedulerJobSummary[] }>(normalizedBaseUrl, '/scheduler/jobs'),
    fetchJson<{ sessions?: BrainCoreSessionSummary[] }>(normalizedBaseUrl, '/sessions'),
    fetchJson<{ repos?: BrainCoreRepoSummary[] }>(normalizedBaseUrl, '/repos'),
    fetchJson<{ approvals?: BrainCoreApprovalSummary[] }>(normalizedBaseUrl, '/approvals'),
    fetchJson<BrainCoreApprovalStoreSummary>(normalizedBaseUrl, '/approvals/store'),
    fetchJson<{ plans?: BrainCoreExecutionPlan[] }>(normalizedBaseUrl, '/execution/plans'),
    fetchJson<BrainCoreExecutionReadiness>(normalizedBaseUrl, '/execution/readiness'),
    fetchJson<BrainCoreMindPreviewPolicy>(normalizedBaseUrl, '/execution/mind-preview-policy'),
    fetchJson<{ previews?: BrainCoreMindPreviewSummary[] }>(normalizedBaseUrl, '/execution/mind-previews'),
    fetchJson<{ orchestrators?: BrainCoreOrchestratorSummary[] }>(normalizedBaseUrl, '/orchestrators'),
    fetchJson<{ pipelines?: BrainCorePipelineSummary[] }>(normalizedBaseUrl, '/pipelines'),
    fetchJson<{ projects?: BrainCoreProjectSummary[] }>(normalizedBaseUrl, '/projects'),
    fetchJson<{ platforms?: BrainCorePlatformSummary[] }>(normalizedBaseUrl, '/platforms'),
    fetchJson<BrainCoreStbPipelineStatus>(normalizedBaseUrl, '/stb/status'),
    fetchJson<BrainCoreVideoOrchestratorStatus>(normalizedBaseUrl, '/video-orchestrator/status'),
    fetchJson<BrainCoreStbVideoMigrationStatus>(normalizedBaseUrl, '/stb-video-migration/status'),
    fetchJson<{ agents?: BrainCoreAgentSummary[] }>(normalizedBaseUrl, '/agents'),
  ]);

  // Collect endpoint errors for diagnostics
  const endpointPairs: Array<[string, any]> = [
    ['/status', status],
    ['/capabilities', capabilities],
    ['/runtime/reports', runtimeReports],
    ['/scheduler/status', schedulerStatus],
    ['/scheduler/jobs', schedulerJobs],
    ['/sessions', sessions],
    ['/repos', repos],
    ['/approvals', approvals],
    ['/approvals/store', approvalStore],
    ['/execution/plans', executionPlans],
    ['/execution/readiness', executionReadiness],
    ['/execution/mind-preview-policy', mindPreviewPolicy],
    ['/execution/mind-previews', mindPreviews],
    ['/orchestrators', orchestrators],
    ['/pipelines', pipelines],
    ['/projects', projects],
    ['/platforms', platforms],
    ['/stb/status', stbStatus],
    ['/video-orchestrator/status', videoOrchestratorStatus],
    ['/stb-video-migration/status', stbVideoMigrationStatus],
    ['/agents', agents],
  ];

  endpointPairs.forEach(([pathname, result]) => {
    if ((result as any).error) {
      endpointErrors.push({
        pathname,
        error: (result as any).error,
        detail: (result as any).detail,
        status: (result as any).status,
        url: (result as any).url,
      });
    }
  });

  const [videoStatus, videoQueue, localApps] = await Promise.all([
    readBrainCoreVideoStatus(normalizedBaseUrl),
    readBrainCoreVideoQueue(normalizedBaseUrl),
    readBrainCoreLocalApps(normalizedBaseUrl),
  ]);

  const videoPairs: Array<[string, any]> = [
    ['/video/status', videoStatus],
    ['/video/queue', videoQueue],
    ['/local-apps', localApps],
  ];

  videoPairs.forEach(([pathname, result]) => {
    if ((result as any).error) {
      endpointErrors.push({
        pathname,
        error: (result as any).error,
        detail: (result as any).detail,
        status: (result as any).status,
        url: (result as any).url,
      });
    }
  });

  return {
    status: status.value,
    capabilities: capabilities.value,
    runtimeReports: runtimeReports.value?.reports,
    videoStatus: videoStatus.value,
    videoQueue: videoQueue.value?.queue,
    localApps: localApps.value?.apps,
    schedulerStatus: schedulerStatus.value,
    schedulerJobs: schedulerJobs.value?.jobs,
    sessions: sessions.value?.sessions,
    repos: repos.value?.repos,
    approvals: approvals.value?.approvals,
    approvalStore: approvalStore.value,
    executionPlans: executionPlans.value?.plans,
    executionReadiness: executionReadiness.value,
    mindPreviewPolicy: mindPreviewPolicy.value,
    mindPreviews: mindPreviews.value?.previews,
    orchestrators: orchestrators.value?.orchestrators,
    pipelines: pipelines.value?.pipelines,
    projects: projects.value?.projects,
    platforms: platforms.value?.platforms,
    stbStatus: stbStatus.value,
    videoOrchestratorStatus: videoOrchestratorStatus.value,
    stbVideoMigrationStatus: stbVideoMigrationStatus.value,
    agents: agents.value?.agents,
    endpointErrors: endpointErrors.length > 0 ? endpointErrors : undefined,
  };
}

export async function readBrainCoreStatus(baseUrl: string): Promise<HttpResult<BrainCoreStatus>> {
  return fetchJson<BrainCoreStatus>(normalizeBaseUrl(baseUrl), '/status');
}

export async function readBrainCoreCapabilities(baseUrl: string): Promise<HttpResult<BrainCoreCapabilitySummary>> {
  return fetchJson<BrainCoreCapabilitySummary>(normalizeBaseUrl(baseUrl), '/capabilities');
}

export async function readBrainCoreRuntimeReports(
  baseUrl: string,
): Promise<HttpResult<{ reports?: BrainCoreRuntimeReportSummary[] }>> {
  return fetchJson<{ reports?: BrainCoreRuntimeReportSummary[] }>(normalizeBaseUrl(baseUrl), '/runtime/reports');
}

export async function readBrainCoreSchedulerStatus(
  baseUrl: string,
): Promise<HttpResult<BrainCoreSchedulerStatus>> {
  return fetchJson<BrainCoreSchedulerStatus>(normalizeBaseUrl(baseUrl), '/scheduler/status');
}

export async function readBrainCoreSchedulerJobs(
  baseUrl: string,
): Promise<HttpResult<{ jobs?: BrainCoreSchedulerJobSummary[] }>> {
  return fetchJson<{ jobs?: BrainCoreSchedulerJobSummary[] }>(normalizeBaseUrl(baseUrl), '/scheduler/jobs');
}

export async function readBrainCoreSessions(baseUrl: string): Promise<HttpResult<{ sessions?: BrainCoreSessionSummary[] }>> {
  return fetchJson<{ sessions?: BrainCoreSessionSummary[] }>(normalizeBaseUrl(baseUrl), '/sessions');
}

export async function readBrainCoreRepos(baseUrl: string): Promise<HttpResult<{ repos?: BrainCoreRepoSummary[] }>> {
  return fetchJson<{ repos?: BrainCoreRepoSummary[] }>(normalizeBaseUrl(baseUrl), '/repos');
}

export async function readBrainCoreApprovals(baseUrl: string): Promise<HttpResult<{ approvals?: BrainCoreApprovalSummary[] }>> {
  return fetchJson<{ approvals?: BrainCoreApprovalSummary[] }>(normalizeBaseUrl(baseUrl), '/approvals');
}

export async function readBrainCoreApprovalStore(baseUrl: string): Promise<HttpResult<BrainCoreApprovalStoreSummary>> {
  return fetchJson<BrainCoreApprovalStoreSummary>(normalizeBaseUrl(baseUrl), '/approvals/store');
}

export async function readBrainCoreExecutionPlans(
  baseUrl: string,
): Promise<HttpResult<{ plans?: BrainCoreExecutionPlan[] }>> {
  return fetchJson<{ plans?: BrainCoreExecutionPlan[] }>(normalizeBaseUrl(baseUrl), '/execution/plans');
}

export async function readBrainCoreExecutionReadiness(
  baseUrl: string,
): Promise<HttpResult<BrainCoreExecutionReadiness>> {
  return fetchJson<BrainCoreExecutionReadiness>(normalizeBaseUrl(baseUrl), '/execution/readiness');
}

export async function readBrainCoreMindPreviewPolicy(
  baseUrl: string,
): Promise<HttpResult<BrainCoreMindPreviewPolicy>> {
  return fetchJson<BrainCoreMindPreviewPolicy>(normalizeBaseUrl(baseUrl), '/execution/mind-preview-policy');
}

export async function readBrainCoreMindPreviews(
  baseUrl: string,
): Promise<HttpResult<{ previews?: BrainCoreMindPreviewSummary[] }>> {
  return fetchJson<{ previews?: BrainCoreMindPreviewSummary[] }>(normalizeBaseUrl(baseUrl), '/execution/mind-previews');
}

export async function readBrainCoreVideoStatus(baseUrl: string): Promise<HttpResult<BrainCoreVideoStatus>> {
  return fetchJson<BrainCoreVideoStatus>(normalizeBaseUrl(baseUrl), '/video/status');
}

export async function readBrainCoreVideoQueue(baseUrl: string): Promise<HttpResult<{ queue?: BrainCoreVideoQueueItem[] }>> {
  return fetchJson<{ queue?: BrainCoreVideoQueueItem[] }>(normalizeBaseUrl(baseUrl), '/video/queue');
}

export async function readBrainCoreLocalApps(baseUrl: string): Promise<HttpResult<{ apps?: BrainCoreLocalAppSummary[] }>> {
  return fetchJson<{ apps?: BrainCoreLocalAppSummary[] }>(normalizeBaseUrl(baseUrl), '/local-apps');
}

export async function readBrainCoreOrchestrators(
  baseUrl: string,
): Promise<HttpResult<{ orchestrators?: BrainCoreOrchestratorSummary[] }>> {
  return fetchJson<{ orchestrators?: BrainCoreOrchestratorSummary[] }>(normalizeBaseUrl(baseUrl), '/orchestrators');
}

export async function readBrainCorePipelines(
  baseUrl: string,
): Promise<HttpResult<{ pipelines?: BrainCorePipelineSummary[] }>> {
  return fetchJson<{ pipelines?: BrainCorePipelineSummary[] }>(normalizeBaseUrl(baseUrl), '/pipelines');
}

export async function readBrainCoreProjects(
  baseUrl: string,
): Promise<HttpResult<{ projects?: BrainCoreProjectSummary[] }>> {
  return fetchJson<{ projects?: BrainCoreProjectSummary[] }>(normalizeBaseUrl(baseUrl), '/projects');
}

export async function readBrainCorePlatforms(
  baseUrl: string,
): Promise<HttpResult<{ platforms?: BrainCorePlatformSummary[] }>> {
  return fetchJson<{ platforms?: BrainCorePlatformSummary[] }>(normalizeBaseUrl(baseUrl), '/platforms');
}

export async function readBrainCorePostOrchestratorStatus(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostOrchestratorStatusResponse>> {
  return fetchJson<BrainCorePostOrchestratorStatusResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/status');
}

export async function readBrainCorePostOrchestratorFlows(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostFlowFixturesResponse>> {
  return fetchJson<BrainCorePostFlowFixturesResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/flows');
}

export async function readBrainCorePostOrchestratorDrafts(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostDraftFixturesResponse>> {
  return fetchJson<BrainCorePostDraftFixturesResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/drafts');
}

export async function readBrainCorePostOrchestratorContracts(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostOrchestratorContractsResponse>> {
  return fetchJson<BrainCorePostOrchestratorContractsResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/contracts');
}

export async function readBrainCorePostOrchestratorIntegrations(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostOrchestratorIntegrationsResponse>> {
  return fetchJson<BrainCorePostOrchestratorIntegrationsResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/integrations');
}

export async function readBrainCorePostOrchestratorRecovery(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostOrchestratorRecoveryResponse>> {
  return fetchJson<BrainCorePostOrchestratorRecoveryResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/recovery');
}

export async function readBrainCoreStbStatus(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreStbPipelineStatus>> {
  return fetchJson<import('./client.js').BrainCoreStbPipelineStatus>(normalizeBaseUrl(baseUrl), '/stb/status');
}

export async function readBrainCoreVideoOrchestratorStatus(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoOrchestratorStatus>> {
  return fetchJson<import('./client.js').BrainCoreVideoOrchestratorStatus>(normalizeBaseUrl(baseUrl), '/video-orchestrator/status');
}

export async function readBrainCoreStbVideoMigrationStatus(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreStbVideoMigrationStatus>> {
  return fetchJson<import('./client.js').BrainCoreStbVideoMigrationStatus>(normalizeBaseUrl(baseUrl), '/stb-video-migration/status');
}

export async function readBrainCoreAgents(
  baseUrl: string,
): Promise<HttpResult<{ agents?: BrainCoreAgentSummary[] }>> {
  return fetchJson<{ agents?: BrainCoreAgentSummary[] }>(normalizeBaseUrl(baseUrl), '/agents');
}

export async function readBrainCoreActions(
  baseUrl: string,
): Promise<HttpResult<{ actions?: BrainCoreActionSummary[] }>> {
  return fetchJson<{ actions?: BrainCoreActionSummary[] }>(normalizeBaseUrl(baseUrl), '/actions');
}

export async function readBrainCoreAction(
  baseUrl: string,
  id: string,
): Promise<HttpResult<{ action?: BrainCoreActionSummary }>> {
  return fetchJson<{ action?: BrainCoreActionSummary }>(normalizeBaseUrl(baseUrl), `/actions/${id}`);
}

export async function readBrainCoreAgentRuns(
  baseUrl: string,
): Promise<HttpResult<{ runs?: BrainCoreAgentRunSummary[] }>> {
  return fetchJson<{ runs?: BrainCoreAgentRunSummary[] }>(normalizeBaseUrl(baseUrl), '/agent-runs');
}

export async function readBrainCoreAgentEvents(
  baseUrl: string,
): Promise<HttpResult<{ events?: BrainCoreAgentEventSummary[] }>> {
  return fetchJson<{ events?: BrainCoreAgentEventSummary[] }>(normalizeBaseUrl(baseUrl), '/agent-events');
}

export async function readBrainCoreRecoveryItems(
  baseUrl: string,
): Promise<HttpResult<{ items?: BrainCoreRecoveryItemSummary[] }>> {
  return fetchJson<{ items?: BrainCoreRecoveryItemSummary[] }>(normalizeBaseUrl(baseUrl), '/recovery');
}

export async function readBrainCoreApprovalDetail(
  baseUrl: string,
  approvalId: string,
): Promise<HttpResult<{ approval?: BrainCoreApprovalDetail }>> {
  return fetchJson<{ approval?: BrainCoreApprovalDetail }>(normalizeBaseUrl(baseUrl), `/approvals/${approvalId}`);
}

export async function readBrainCoreModelRouterReportDetail(
  baseUrl: string,
): Promise<HttpResult<{ report?: BrainCoreModelRouterReportDetail }>> {
  return fetchJson<{ report?: BrainCoreModelRouterReportDetail }>(normalizeBaseUrl(baseUrl), '/runtime/reports/model-router');
}

export async function readBrainCoreMaintenancePreviewDetail(
  baseUrl: string,
  previewId: string,
): Promise<HttpResult<{ preview?: BrainCoreMaintenancePreviewDetail }>> {
  return fetchJson<{ preview?: BrainCoreMaintenancePreviewDetail }>(normalizeBaseUrl(baseUrl), `/execution/maintenance-previews/${previewId}`);
}

export async function requestBrainCoreActionApproval(
  baseUrl: string,
  id: string,
): Promise<HttpResult<BrainCoreActionRequest>> {
  const url = `${normalizeBaseUrl(baseUrl)}/actions/${id}/request-approval`;
  const startTime = performance.now();

  if (!requestUrlFn) {
    return {
      error: 'Obsidian requestUrl not initialized',
      url,
    };
  }

  try {
    const response = await Promise.race([
      requestUrlFn({
        url,
        method: 'POST',
        headers: { accept: 'application/json' },
        throw: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('request timeout')), REQUEST_TIMEOUT_MS)
      ),
    ]);

    const responseTimeMs = Math.round(performance.now() - startTime);

    if (response.status < 200 || response.status >= 300) {
      const detail = response.text ? response.text.slice(0, 200) : undefined;
      return {
        error: `HTTP ${response.status}`,
        status: response.status,
        detail,
        url,
        responseTimeMs,
      };
    }

    const body = JSON.parse(response.text ?? '{}') as Partial<BrainCoreActionRequest>;
    return {
      status: response.status,
      value: body as BrainCoreActionRequest,
      url,
      responseTimeMs,
    };
  } catch (err) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    const detail =
      err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);

    const fallbackUrl = tryGetFallbackLocalUrl(url);
    if (fallbackUrl && isLocalTestUrl(url)) {
      const baseUrlFallback = fallbackUrl.replace(/\/actions\/.*$/, '');
      return requestBrainCoreActionApproval(baseUrlFallback, id);
    }

    return {
      error: detail,
      url,
      responseTimeMs,
    };
  }
}

// Import requestUrl from obsidian at runtime (to avoid bundling issues, it's imported in main.ts)
let requestUrlFn: any = null;

export function setRequestUrl(fn: any): void {
  requestUrlFn = fn;
}

async function fetchJson<T>(baseUrl: string, pathname: string): Promise<HttpResult<T>> {
  const url = `${baseUrl}${pathname}`;
  const startTime = performance.now();

  if (!requestUrlFn) {
    return {
      error: 'Obsidian requestUrl not initialized',
      url,
    };
  }

  try {
    const response = await Promise.race([
      requestUrlFn({
        url,
        method: 'GET',
        headers: { accept: 'application/json' },
        throw: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('request timeout')), REQUEST_TIMEOUT_MS)
      ),
    ]);

    const responseTimeMs = Math.round(performance.now() - startTime);

    if (response.status < 200 || response.status >= 300) {
      const detail = response.text ? response.text.slice(0, 200) : undefined;
      return {
        error: `HTTP ${response.status}`,
        status: response.status,
        detail,
        url,
        responseTimeMs,
      };
    }

    let parsed: T;
    try {
      parsed = JSON.parse(response.text) as T;
    } catch {
      return {
        error: 'invalid JSON response',
        detail: response.text?.slice(0, 100),
        url,
        responseTimeMs,
      };
    }

    return { value: parsed, url, responseTimeMs };
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - startTime);
    const errorMsg = error instanceof Error ? error.message : 'request failed';

    // On timeout or connection error, try fallback URL (only for localhost/127)
    if (
      (errorMsg.includes('timeout') || errorMsg.includes('connection')) &&
      isLocalTestUrl(baseUrl)
    ) {
      const fallbackUrl = tryGetFallbackLocalUrl(baseUrl);
      if (fallbackUrl && fallbackUrl !== baseUrl) {
        return fetchJsonWithFallback<T>(fallbackUrl, pathname, responseTimeMs);
      }
    }

    return {
      error: errorMsg,
      url,
      responseTimeMs,
    };
  }
}

async function fetchJsonWithFallback<T>(
  fallbackUrl: string,
  pathname: string,
  firstAttemptMs: number
): Promise<HttpResult<T>> {
  try {
    const response = await Promise.race([
      requestUrlFn({
        url: `${fallbackUrl}${pathname}`,
        method: 'GET',
        headers: { accept: 'application/json' },
        throw: false,
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('request timeout')), REQUEST_TIMEOUT_MS)
      ),
    ]);

    if (response.status < 200 || response.status >= 300) {
      return { error: `HTTP ${response.status}`, url: `${fallbackUrl}${pathname}` };
    }

    const parsed = JSON.parse(response.text) as T;
    return {
      value: parsed,
      url: `${fallbackUrl}${pathname} (fallback)`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'fallback request failed',
      url: `${fallbackUrl}${pathname}`,
    };
  }
}

function isLocalTestUrl(url: string): boolean {
  return (
    url.includes('localhost:4877') ||
    url.includes('127.0.0.1:4877') ||
    url.includes('localhost:4878') ||
    url.includes('127.0.0.1:4878')
  );
}

function tryGetFallbackLocalUrl(baseUrl: string): string | null {
  if (baseUrl.includes('localhost:')) {
    return baseUrl.replace('localhost:', '127.0.0.1:');
  }
  if (baseUrl.includes('127.0.0.1:')) {
    return baseUrl.replace('127.0.0.1:', 'localhost:');
  }
  return null;
}

function normalizeBaseUrl(rawValue: string): string {
  return rawValue.replace(/\/+$/g, '');
}
