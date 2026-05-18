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

export interface BrainCorePostEventFixture {
  id: string;
  source: 'github' | 'video-orchestrator' | 'manual' | 'analytics' | 'internal' | 'blog' | 'product';
  eventType: 'github-commit' | 'pr-merged' | 'release-published' | 'repo-launch' | 'product-milestone' | 'mrr-milestone' | 'github-achievement' | 'video-rendered' | 'blog-published' | 'research-summary' | 'manual-request';
  occurredAt: string;
  projectId: string;
  title: string;
  payloadSummary: string;
  priority: 'low' | 'normal' | 'high';
  suggestedPlatforms: BrainCorePostPlatform[];
  suggestedFlowIds: string[];
  safety: {
    fixtureOnly: true;
    readsExternalPlatform: false;
    writesExternalPlatform: false;
    writesToMind: false;
    containsSecrets: false;
  };
}

export interface BrainCorePostDryRunPlan {
  id: string;
  event: BrainCorePostEventFixture;
  generatedAt: string;
  status: 'preview' | 'blocked';
  drafts: Array<{
    id: string;
    eventId: string;
    flowId: string;
    platform: BrainCorePostPlatform;
    title: string;
    format: BrainCorePostDraftFixture['format'];
    copyPreview: string;
    assetFlowRequired: boolean;
    optimizationFlowRequired: boolean;
    approvalRequired: true;
    status: 'planned-preview' | 'blocked' | 'unsupported' | 'requires-approval';
    blockers: string[];
    nextSafeStep: string;
    safety: {
      dryRunOnly: true;
      generatedFromFixture: true;
      publishingEnabled: false;
      schedulingEnabled: false;
      executionEnabled: false;
      writesExternalPlatform: false;
      writesToMind: false;
      usesCookies: false;
      usesPlaywright: false;
    };
  }>;
  unsupportedFlowIds: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    dryRunOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
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

export interface BrainCorePostEventFixturesResponse {
  events: BrainCorePostEventFixture[];
}

export interface BrainCorePostDryRunPlanResponse {
  plan: BrainCorePostDryRunPlan;
}

export interface BrainCorePostDraftReviewItem {
  id: string;
  draftPlanId: string;
  eventId: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  title: string;
  format: BrainCorePostDraftFixture['format'];
  copyPreview: string;
  status: 'review-ready' | 'approval-requested' | 'blocked' | 'disabled';
  risk: 'low' | 'medium' | 'high';
  approvalRequired: true;
  approvalId?: string;
  canRequestApproval: boolean;
  canApproveForPublishing: false;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    reviewOnly: true;
    dryRunOnly: true;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
    callsExternalAI: false;
  };
}

export interface BrainCorePostDraftReviewQueue {
  id: string;
  status: 'preview' | 'blocked';
  generatedAt: string;
  eventId: string;
  itemCount: number;
  approvalRequestedCount: number;
  blockedCount: number;
  items: BrainCorePostDraftReviewItem[];
  safety: {
    reviewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostDraftReviewQueueResponse {
  queue: BrainCorePostDraftReviewQueue;
}

export interface BrainCorePostDraftReviewApprovalRequest {
  id: string;
  reviewItemId: string;
  approvalId?: string;
  status: 'requested' | 'blocked' | 'invalid';
  executionDidRun: false;
  summary: string;
  nextSafeStep: string;
  safety: BrainCorePostDraftReviewItem['safety'];
}

export type BrainCorePostSchedulePreviewStatus = 'preview-ready' | 'approval-requested' | 'blocked' | 'disabled';
export type BrainCorePostScheduleWindow = 'morning' | 'midday' | 'afternoon' | 'evening' | 'manual-review';

export interface BrainCorePostSchedulePreviewItem {
  id: string;
  reviewItemId: string;
  draftPlanId: string;
  eventId: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  title: string;
  scheduledWindow: BrainCorePostScheduleWindow;
  suggestedLocalTime: string;
  timezone: string;
  rationale: string;
  status: BrainCorePostSchedulePreviewStatus;
  approvalRequired: true;
  approvalId?: string;
  canRequestApproval: boolean;
  canCreateSchedulerJob: false;
  canPublish: false;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    previewOnly: true;
    writesScheduler: false;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
    callsExternalAI: false;
  };
}

export interface BrainCorePostSchedulePreviewQueue {
  id: string;
  eventId: string;
  status: 'preview' | 'blocked';
  generatedAt: string;
  itemCount: number;
  approvalRequestedCount: number;
  blockedCount: number;
  items: BrainCorePostSchedulePreviewItem[];
  safety: {
    previewOnly: true;
    schedulingEnabled: false;
    publishingEnabled: false;
    executionEnabled: false;
    writesScheduler: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostSchedulePreviewQueueResponse {
  queue: BrainCorePostSchedulePreviewQueue;
}

export interface BrainCorePostSchedulePreviewApprovalRequest {
  id: string;
  schedulePreviewItemId: string;
  approvalId?: string;
  status: 'requested' | 'blocked' | 'invalid';
  executionDidRun: false;
  summary: string;
  nextSafeStep: string;
  safety: BrainCorePostSchedulePreviewItem['safety'];
}

export type BrainCorePostAnalyticsMetric =
  | 'impressions'
  | 'clicks'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'watchSeconds'
  | 'ctr'
  | 'engagementRate';

export interface BrainCorePostAnalyticsFixture {
  id: string;
  platform: BrainCorePostPlatform;
  flowId: string;
  draftPlanId?: string;
  title: string;
  capturedAt: string;
  source: 'fixture';
  metrics: Record<BrainCorePostAnalyticsMetric, number>;
  interpretation: string;
  feedbackForFlow: string;
  safety: {
    fixtureOnly: true;
    callsExternalAnalyticsApi: false;
    readsCookies: false;
    readsSecrets: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostAnalyticsFixturesResponse {
  analytics: BrainCorePostAnalyticsFixture[];
}

export type BrainCorePostPipelineStepId = 'event' | 'dry-run' | 'review' | 'schedule-preview' | 'analytics-feedback' | 'readiness';
export type BrainCorePostPipelineStepStatus = 'available' | 'preview' | 'blocked' | 'disabled' | 'missing';

export interface BrainCorePostPipelineStepSummary {
  id: BrainCorePostPipelineStepId;
  label: string;
  status: BrainCorePostPipelineStepStatus;
  itemCount: number;
  blockedCount: number;
  approvalRequiredCount: number;
  summary: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    previewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostPipelineSummary {
  id: string;
  eventId: string;
  title: string;
  status: 'preview' | 'blocked';
  generatedAt: string;
  steps: BrainCorePostPipelineStepSummary[];
  totals: {
    draftCount: number;
    reviewItemCount: number;
    schedulePreviewItemCount: number;
    analyticsFixtureCount: number;
    blockerCount: number;
    approvalRequiredCount: number;
  };
  nextSafeStep: string;
  blockers: string[];
  safety: {
    endToEndPreviewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    callsExternalApi: false;
    callsExternalAI: false;
    usesCookies: false;
    usesPlaywright: false;
  };
}

export interface BrainCorePostPipelineSummaryResponse {
  pipeline: BrainCorePostPipelineSummary;
}

export type BrainCorePostReadinessSeverity = 'info' | 'warning' | 'error';

export interface BrainCorePostReadinessBlocker {
  id: string;
  severity: BrainCorePostReadinessSeverity;
  source: 'event' | 'dry-run' | 'review' | 'schedule-preview' | 'analytics' | 'publishing' | 'security' | 'contracts';
  title: string;
  summary: string;
  nextSafeStep: string;
  blocksPublishing: true;
  canAutoFix: false;
}

export interface BrainCorePostReadinessScore {
  id: string;
  eventId: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'blocked';
  status: 'preview' | 'blocked';
  generatedAt: string;
  blockers: BrainCorePostReadinessBlocker[];
  checks: Array<{ id: string; label: string; passed: boolean; summary: string }>;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    callsExternalApi: false;
    callsExternalAI: false;
    canAutoFix: false;
  };
}

export interface BrainCorePostReadinessScoreResponse {
  readiness: BrainCorePostReadinessScore;
}

export type BrainCorePostPlatformPolicyStatus =
  | 'not-reviewed'
  | 'review-required'
  | 'blocked'
  | 'approved-for-preview'
  | 'approved-for-manual-export'
  | 'approved-for-api-publishing';

export type BrainCorePostPlatformPublishingMode =
  | 'disabled'
  | 'manual-export-only'
  | 'api-required'
  | 'browser-automation-prohibited'
  | 'pending-security-review';

export type BrainCorePostPlatformRiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export interface BrainCorePostPlatformPolicy {
  id: string;
  platform: BrainCorePostPlatform;
  label: string;
  status: BrainCorePostPlatformPolicyStatus;
  publishingMode: BrainCorePostPlatformPublishingMode;
  riskLevel: BrainCorePostPlatformRiskLevel;
  summary: string;
  allowedInCurrentPhase: {
    fixturePreview: true;
    draftReview: true;
    schedulePreview: true;
    manualExport: boolean;
    apiPublishing: false;
    browserAutomation: false;
  };
  securityReview: {
    required: boolean;
    completed: false;
    reason: string;
    blockers: string[];
  };
  complianceNotes: string[];
  nextSafeStep: string;
  safety: {
    readsCookies: false;
    readsSecrets: false;
    usesPlaywright: false;
    writesExternalPlatform: false;
    writesToMind: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
  };
}

export interface BrainCorePostPlatformPoliciesResponse {
  policies: BrainCorePostPlatformPolicy[];
}

export type BrainCorePostDecommissionTarget =
  | 'legacy-asset-system'
  | 'legacy-growth-system'
  | 'legacy-schedulers'
  | 'legacy-publishing'
  | 'legacy-analytics';

export type BrainCorePostDecommissionStatus =
  | 'not-started'
  | 'blocked'
  | 'in-progress'
  | 'ready-for-review'
  | 'approved'
  | 'decommissioned';

export interface BrainCorePostDecommissionGate {
  id: string;
  label: string;
  passed: boolean;
  required: true;
  summary: string;
  nextSafeStep: string;
}

export interface BrainCorePostDecommissionReadinessItem {
  id: string;
  target: BrainCorePostDecommissionTarget;
  label: string;
  status: BrainCorePostDecommissionStatus;
  summary: string;
  gates: BrainCorePostDecommissionGate[];
  blockerCount: number;
  nextSafeStep: string;
  safety: {
    decommissionStarted: false;
    deletesFiles: false;
    modifiesLegacyRepo: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresExplicitUserApproval: true;
  };
}

export interface BrainCorePostDecommissionReadinessResponse {
  items: BrainCorePostDecommissionReadinessItem[];
  overall: {
    status: 'blocked' | 'not-ready' | 'ready-for-review';
    readyCount: number;
    blockedCount: number;
    decommissionStarted: false;
    nextSafeStep: string;
  };
}

export type BrainCorePostManualExportFormat = 'plain-text' | 'markdown' | 'json-preview' | 'checklist';

export interface BrainCorePostManualExportItem {
  id: string;
  eventId: string;
  draftPlanId: string;
  platform: BrainCorePostPlatform;
  title: string;
  format: BrainCorePostManualExportFormat;
  contentPreview: string;
  checklist: string[];
  reviewNotes: string[];
  status: 'preview-ready' | 'blocked';
  safety: {
    previewOnly: true;
    writesFiles: false;
    downloadsFile: false;
    copiesToClipboard: false;
    writesExternalPlatform: false;
    writesToMind: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
  };
}

export interface BrainCorePostManualExportPackage {
  id: string;
  eventId: string;
  title: string;
  generatedAt: string;
  status: 'preview' | 'blocked';
  itemCount: number;
  items: BrainCorePostManualExportItem[];
  nextSafeStep: string;
  safety: {
    previewOnly: true;
    writesFiles: false;
    downloadsFile: false;
    copiesToClipboard: false;
    writesExternalPlatform: false;
    writesToMind: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
  };
}

export interface BrainCorePostManualExportPackageResponse {
  package: BrainCorePostManualExportPackage;
}

export type BrainCorePostAcceptanceCheckStatus =
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'not-applicable';

export type BrainCorePostAcceptanceCheckCategory =
  | 'api'
  | 'dashboard'
  | 'safety'
  | 'policy'
  | 'migration'
  | 'operator'
  | 'docs';

export interface BrainCorePostAcceptanceCheck {
  id: string;
  category: BrainCorePostAcceptanceCheckCategory;
  label: string;
  status: BrainCorePostAcceptanceCheckStatus;
  required: boolean;
  summary: string;
  evidence: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesCode: false;
    writesFiles: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostAcceptanceChecklist {
  id: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  passedCount: number;
  blockedCount: number;
  failedCount: number;
  requiredCount: number;
  checks: BrainCorePostAcceptanceCheck[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    decommissionStarted: false;
  };
}

export interface BrainCorePostAcceptanceChecklistResponse {
  checklist: BrainCorePostAcceptanceChecklist;
}

export type BrainCorePostMigrationCapabilityStatus =
  | 'not-started'
  | 'preview-only'
  | 'partial'
  | 'blocked'
  | 'parity-ready';

export type BrainCorePostMigrationCapabilityArea =
  | 'asset-generation'
  | 'growth-optimization'
  | 'scheduler'
  | 'publishing'
  | 'analytics'
  | 'approval'
  | 'dashboard'
  | 'policy'
  | 'manual-export';

export interface BrainCorePostMigrationParityCapability {
  id: string;
  area: BrainCorePostMigrationCapabilityArea;
  label: string;
  status: BrainCorePostMigrationCapabilityStatus;
  summary: string;
  currentBrainSupport: string[];
  remainingGaps: string[];
  parityScore: number;
  nextSafeStep: string;
  safety: {
    previewOnly: boolean;
    modifiesLegacyRepo: false;
    decommissionStarted: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostMigrationParityReport {
  id: string;
  generatedAt: string;
  status: 'blocked' | 'in-progress' | 'preview-ready';
  overallParityScore: number;
  capabilities: BrainCorePostMigrationParityCapability[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    modifiesLegacyRepo: false;
    decommissionStarted: false;
    deletesFiles: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresExplicitUserApprovalForDecommission: true;
  };
}

export interface BrainCorePostMigrationParityReportResponse {
  report: BrainCorePostMigrationParityReport;
}

export interface BrainCorePostRoadmapCheckpointPhase {
  id: string;
  label: string;
  status: 'complete' | 'in-progress' | 'blocked' | 'not-started';
  summary: string;
  evidence: string[];
}

export interface BrainCorePostRoadmapCheckpoint {
  id: string;
  generatedAt: string;
  currentPhase: string;
  completedPhaseCount: number;
  blockedPhaseCount: number;
  phases: BrainCorePostRoadmapCheckpointPhase[];
  nextRecommendedPhase: string;
  nextPhaseRequiresUserApproval: true;
  nextPhaseSummary: string;
  safety: {
    readOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    requiresExplicitUserApprovalBeforePublishingDesign: true;
  };
}

export interface BrainCorePostRoadmapCheckpointResponse {
  checkpoint: BrainCorePostRoadmapCheckpoint;
}

export interface BrainCorePostOrchestratorOverview {
  id: 'post-orchestrator-overview';
  generatedAt: string;
  phase: 'preview-checkpoint';
  status: 'preview-ready' | 'blocked';
  summary: string;
  counts: {
    flows: number;
    eventFixtures: number;
    draftFixtures: number;
    reviewItems: number;
    schedulePreviewItems: number;
    analyticsFixtures: number;
    policyItems: number;
    decommissionItems: number;
    guidanceItems: number;
    acceptanceChecks: number;
    migrationCapabilities: number;
    roadmapPhases: number;
  };
  keyStates: {
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    decommissionStarted: false;
    externalApiCallsEnabled: false;
    externalAiCallsEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
  };
  blockers: Array<{
    id: string;
    label: string;
    severity: 'info' | 'warning' | 'blocked';
    source: 'readiness' | 'policy' | 'decommission' | 'roadmap' | 'acceptance';
    nextSafeStep: string;
  }>;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    previewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    decommissionStarted: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostOrchestratorOverviewResponse {
  overview: BrainCorePostOrchestratorOverview;
}

export type BrainCorePostOperatorGuidanceSeverity = 'info' | 'warning' | 'blocked';
export type BrainCorePostOperatorGuidanceCategory =
  | 'review'
  | 'policy'
  | 'security'
  | 'decommission'
  | 'manual-export'
  | 'readiness'
  | 'analytics'
  | 'scheduling'
  | 'publishing';

export interface BrainCorePostOperatorGuidanceStep {
  id: string;
  label: string;
  summary: string;
  completed: boolean;
  required: boolean;
  actionType: 'read' | 'review' | 'manual-check' | 'request-approval' | 'wait' | 'blocked';
  safety: {
    executesCode: false;
    writesFiles: false;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresHumanReview: boolean;
  };
}

export interface BrainCorePostOperatorGuidanceItem {
  id: string;
  title: string;
  category: BrainCorePostOperatorGuidanceCategory;
  severity: BrainCorePostOperatorGuidanceSeverity;
  summary: string;
  source: 'pipeline' | 'readiness' | 'platform-policy' | 'decommission' | 'review-queue' | 'schedule-preview' | 'analytics';
  relatedEventId?: string;
  relatedFlowId?: string;
  relatedPlatform?: BrainCorePostPlatform;
  steps: BrainCorePostOperatorGuidanceStep[];
  nextSafeStep: string;
  blocksPublishing: boolean;
  safety: {
    readOnly: true;
    autoFixEnabled: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostOperatorGuidanceResponse {
  items: BrainCorePostOperatorGuidanceItem[];
  summary: { itemCount: number; blockedCount: number; warningCount: number; nextSafeStep: string };
}

export interface BrainCorePostQaEndpointCoverageItem {
  id: string;
  endpoint: string;
  purpose: string;
  expectedInDashboard: boolean;
  status: 'covered' | 'manual-check' | 'planned';
  safety: {
    readOnly: true;
    hasPost: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostQaChecklistItem {
  id: string;
  label: string;
  status: 'manual-check';
  summary: string;
}

export interface BrainCorePostQaStatus {
  id: 'post-orchestrator-qa-status';
  generatedAt: string;
  status: 'ready-for-manual-qa' | 'needs-attention';
  endpointCount: number;
  coveredCount: number;
  manualCheckCount: number;
  endpoints: BrainCorePostQaEndpointCoverageItem[];
  checklist: BrainCorePostQaChecklistItem[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    writesExternalPlatform: false;
    writesToMind: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
  };
}

export interface BrainCorePostQaStatusResponse {
  qaStatus: BrainCorePostQaStatus;
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

export interface BrainCoreVideoIntakeSource {
  id: string;
  source: string;
  stbSlug?: string;
  title: string;
  durationTargetMinutes: number;
  platformTargets: string[];
  status: string;
  evidence: string[];
}

export interface BrainCoreVideoIntakePlan {
  id: string;
  sourceId: string;
  projectId: string;
  title: string;
  status: string;
  normalizedInputs: {
    storySlug?: string;
    title: string;
    durationTargetMinutes: number;
    platforms: string[];
    requiredStages: string[];
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoOrchestratorIntakeResponse {
  id: string;
  generatedAt: string;
  version: string;
  sources: BrainCoreVideoIntakeSource[];
  plans: BrainCoreVideoIntakePlan[];
  summary: { sourceCount: number; planCount: number; availableCount: number; blockedCount: number };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
}

export interface BrainCoreVideoResearchBrief {
  id: string;
  intakePlanId: string;
  sourceId: string;
  title: string;
  status: string;
  generatedAt: string;
  theologicalTheme?: string;
  narrativeSummary?: string;
  researchedPassages: Array<{ book: string; chapter: number; verses: string; title?: string }>;
  keyBiblicalConcepts: string[];
}

export interface BrainCoreVideoOrchestratorResearchResponse {
  id: string;
  generatedAt: string;
  version: string;
  intakePlan: { id: string; title: string; durationTargetMinutes: number; platforms: string[] };
  researchBrief: BrainCoreVideoResearchBrief;
  questions: Array<{ sequence: number; question: string; expectedAnswerLength: string; relatedPassages: string[] }>;
  sources: Array<{ id: string; type: string; reference: string; summary: string; relevance: string }>;
  summary: { passageCount: number; questionCount: number; sourceCount: number };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoResearchListResponse {
  id: string;
  generatedAt: string;
  version: string;
  briefs: BrainCoreVideoResearchBrief[];
  summary: { total: number; readyCount: number; blockedCount: number };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoScriptSection {
  sequence: number;
  name: string;
  contentType: string;
  estimatedDurationSeconds: number;
  keyPoints: string[];
  sampleNarration?: string;
}

export interface BrainCoreVideoScriptOutline {
  id: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: string;
  sections: BrainCoreVideoScriptSection[];
  totalEstimatedSeconds: number;
}

export interface BrainCoreVideoScriptPlan {
  id: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: string;
  outline: BrainCoreVideoScriptOutline;
}

export interface BrainCoreVideoScriptResponse {
  id: string;
  generatedAt: string;
  version: string;
  type: string;
  intakePlan: { id: string; title: string; durationTargetMinutes: number; platforms: string[] };
  plan?: BrainCoreVideoScriptPlan;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoScriptListResponse {
  id: string;
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoScriptPlan[];
  summary: { total: number; availableCount: number; blockedCount: number };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssetRequirement {
  id: string;
  kind: 'thumbnail' | 'title-card' | 'passage-card' | 'scene-visual' | 'b-roll' | 'platform-derivative' | 'metadata-visual';
  label: string;
  status: 'planned' | 'blocked';
  requiredForStages: string[];
  placeholder: string;
  designDependency: 'design-orchestrator' | 'manual-design' | 'none';
  blockers: string[];
  safety: {
    readOnly: boolean;
    generatesImage: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssetPlanSummary {
  totalRequirements: number;
  thumbnailCount: number;
  sceneVisualCount: number;
  platformDerivativeCount: number;
  blockedCount: number;
}

export interface BrainCoreVideoAssetPlan {
  id: string;
  intakePlanId: string;
  researchId: string;
  scriptId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'planned' | 'preview-ready' | 'blocked';
  requirements: BrainCoreVideoAssetRequirement[];
  summary: BrainCoreVideoAssetPlanSummary;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssetPlanListResponse {
  id: string;
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoAssetPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalRequirements: number;
  };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssetPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoAssetPlan;
  upstream: {
    intakePlanId: string;
    researchId: string;
    scriptId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoDesignSpec {
  id: string;
  assetRequirementId: string;
  kind: 'thumbnail-design' | 'title-card-design' | 'passage-card-design' | 'scene-style' | 'platform-layout' | 'metadata-visual-layout';
  label: string;
  status: 'planned' | 'blocked';
  placeholder: string;
  designSystem: {
    format: 'static-card' | 'overlay' | 'layout' | 'style-guide';
    aspectRatio: '16:9' | '1:1' | '9:16' | '4:5' | 'mixed';
    platformTargets: string[];
  };
  dependency: 'design-orchestrator' | 'manual-design' | 'none';
  blockers: string[];
  safety: {
    readOnly: boolean;
    generatesImage: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoDesignPlan {
  id: string;
  assetPlanId: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  specs: BrainCoreVideoDesignSpec[];
  summary: {
    totalSpecs: number;
    plannedCount: number;
    blockedCount: number;
    platformLayoutCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoDesignPlanListResponse {
  id: string;
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoDesignPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalSpecs: number;
  };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoDesignPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoDesignPlan;
  upstream: {
    assetPlanId: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVoiceoverSegment {
  id: string;
  scriptSectionId?: string;
  sequence: number;
  label: string;
  kind: 'intro' | 'body' | 'passage' | 'application' | 'outro' | 'transition';
  status: 'planned' | 'blocked';
  placeholder: string;
  estimatedDurationSeconds: number;
  voiceRequirements: {
    tone: 'calm' | 'educational' | 'story' | 'neutral';
    pacing: 'slow' | 'medium' | 'measured';
    emphasis: string[];
  };
  pronunciationNotes: string[];
  blockers: string[];
  safety: {
    readOnly: boolean;
    generatesAudio: boolean;
    callsTts: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVoiceoverPlan {
  id: string;
  scriptPlanId: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  segments: BrainCoreVideoVoiceoverSegment[];
  summary: {
    totalSegments: number;
    plannedCount: number;
    blockedCount: number;
    estimatedDurationSeconds: number;
    estimatedDurationMinutes: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesAudio: boolean;
    callsTts: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVoiceoverPlanListResponse {
  id: string;
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoVoiceoverPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalSegments: number;
    estimatedDurationMinutes: number;
  };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesAudio: boolean;
    callsTts: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVoiceoverPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoVoiceoverPlan;
  upstream: {
    scriptPlanId: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesAudio: boolean;
    callsTts: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVisualSequenceItem {
  id: string;
  voiceoverSegmentId: string;
  designSpecId: string;
  assetRequirementId: string;
  sequence: number;
  label: string;
  kind: 'scene' | 'overlay' | 'transition' | 'text-card' | 'title-card' | 'passage-card' | 'platform-crop';
  status: 'planned' | 'blocked';
  startSecond: number;
  durationSeconds: number;
  transitionType?: 'fade' | 'cut' | 'slide' | 'dissolve' | 'none';
  aspectRatio: '16:9' | '1:1' | '9:16' | '4:5' | 'mixed';
  platformTargets: string[];
  placeholder: string;
  requiredForStages: string[];
  designDependency: 'design-orchestrator' | 'manual-design' | 'none';
  blockers: string[];
  safety: {
    readOnly: boolean;
    generatesImage: boolean;
    generatesVideo: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVisualsPlanSummary {
  totalSequenceItems: number;
  plannedCount: number;
  blockedCount: number;
  estimatedTotalDurationSeconds: number;
  estimatedTotalDurationMinutes: number;
  platformTargetCount: number;
  uniqueKinds: string[];
}

export interface BrainCoreVideoVisualsPlan {
  id: string;
  projectId: string;
  title: string;
  generatedAt: string;
  voiceoverPlanId: string;
  designPlanId: string;
  assetPlanId: string;
  scriptPlanId: string;
  intakePlanId: string;
  status: 'preview-ready' | 'blocked';
  sequence: BrainCoreVideoVisualSequenceItem[];
  summary: BrainCoreVideoVisualsPlanSummary;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    generatesVideo: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVisualsPlanListResponse {
  id: 'video-orchestrator-visuals-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoVisualsPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalSequenceItems: number;
    estimatedTotalDurationMinutes: number;
  };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    generatesVideo: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoVisualsPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoVisualsPlan;
  upstream: {
    voiceoverPlanId: string;
    designPlanId: string;
    assetPlanId: string;
    scriptPlanId: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    generatesImage: boolean;
    generatesVideo: boolean;
    generatesPrompt: boolean;
    callsExternalAI: boolean;
    writesFiles: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssemblyTimelineItem {
  id: string;
  sequence: number;
  voiceoverSegmentId?: string;
  visualSequenceItemId?: string;
  assetRequirementId?: string;
  designSpecId?: string;
  kind: 'intro' | 'main-segment' | 'passage-card' | 'overlay' | 'transition' | 'outro' | 'platform-derivative';
  label: string;
  status: 'planned' | 'blocked';
  placeholder: string;
  timing: {
    startSecond: number;
    durationSeconds: number;
    endSecond: number;
  };
  sync: {
    requiresVoiceover: boolean;
    requiresVisual: boolean;
    requiresOverlay: boolean;
  };
  compositionRequirements: string[];
  blockers: string[];
  safety: {
    readOnly: boolean;
    rendersVideo: boolean;
    callsFfmpeg: boolean;
    generatesFiles: boolean;
    callsExternalAI: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssemblyPlan {
  id: string;
  intakePlanId: string;
  voiceoverPlanId?: string;
  visualsPlanId?: string;
  assetPlanId?: string;
  designPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  timeline: BrainCoreVideoAssemblyTimelineItem[];
  summary: {
    totalTimelineItems: number;
    plannedCount: number;
    blockedCount: number;
    estimatedDurationSeconds: number;
    estimatedDurationMinutes: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    rendersVideo: boolean;
    callsFfmpeg: boolean;
    generatesFiles: boolean;
    callsExternalAI: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssemblyPlanListResponse {
  id: 'video-orchestrator-assembly-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoAssemblyPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalTimelineItems: number;
    estimatedDurationMinutes: number;
  };
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    rendersVideo: boolean;
    callsFfmpeg: boolean;
    generatesFiles: boolean;
    callsExternalAI: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
}

export interface BrainCoreVideoAssemblyPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoAssemblyPlan;
  upstream: {
    voiceoverPlanId?: string;
    visualsPlanId?: string;
    assetPlanId?: string;
    designPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: boolean;
    executesStb: boolean;
    executesVideo: boolean;
    rendersVideo: boolean;
    callsFfmpeg: boolean;
    generatesFiles: boolean;
    callsExternalAI: boolean;
    publishesContent: boolean;
    writesToMind: boolean;
  };
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

export interface BrainCoreStbVideoParityMatrixEntry {
  id: string;
  stbStage: string;
  stbStageIndex: number;
  videoModule: string;
  videoModuleIndex: number;
  status: string;
  deterministic: boolean;
  skipCondition?: string;
  riskLevel: string;
  validationStatus: string;
  validationEvidence?: string[];
  blockerReason?: string;
}

export interface BrainCoreStbVideoParityMatrix {
  id: 'stb-video-parity-matrix';
  generatedAt: string;
  version: string;
  sourcePipelineId: string;
  targetPipelineId: string;
  stbStageCount: number;
  videoModuleCount: number;
  entries: BrainCoreStbVideoParityMatrixEntry[];
  summary: {
    totalEntries: number;
    mappedCount: number;
    partialCount: number;
    plannedCount: number;
    blockedCount: number;
    parityPercent: number;
    readinessScore: number;
  };
  risksAndMitigations: Array<{ risk: string; mitigation: string; priority: string }>;
  nextSteps: string[];
}

export interface BrainCoreStbVideoDualRunValidation {
  entryId: string;
  stbStage: string;
  videoModule: string;
  status: string;
  testCount: number;
  passCount: number;
  passPercent: number;
  failureReason?: string;
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  lastTestedAt?: string;
}

export interface BrainCoreStbVideoDualRunStatus {
  id: 'stb-video-dual-run-status';
  generatedAt: string;
  version: string;
  sourcePipelineId: string;
  targetPipelineId: string;
  executesStb: boolean;
  executesVideo: boolean;
  status: string;
  health: string;
  dualRunEnabled: boolean;
  validations: BrainCoreStbVideoDualRunValidation[];
  summary: {
    totalValidations: number;
    notStartedCount: number;
    inProgressCount: number;
    passedCount: number;
    failedCount: number;
    blockedCount: number;
    readinessPercent: number;
  };
  nextSafeTask: string;
  blockers: string[];
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; canRetry: boolean; requiresApproval: boolean };
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

export interface BrainCorePostSchedulePreviewItemSummary extends BrainCorePostSchedulePreviewItem {}
export interface BrainCorePostSchedulePreviewQueueSummary extends BrainCorePostSchedulePreviewQueue {}
export interface BrainCorePostSchedulePreviewApprovalRequestSummary extends BrainCorePostSchedulePreviewApprovalRequest {}
export interface BrainCorePostAnalyticsFixtureSummary extends BrainCorePostAnalyticsFixture {}
export interface BrainCorePostAnalyticsFixturesResponseSummary extends BrainCorePostAnalyticsFixturesResponse {}

export interface BrainCorePostPipelineSummarySummary extends BrainCorePostPipelineSummary {}
export interface BrainCorePostPipelineSummaryResponseSummary extends BrainCorePostPipelineSummaryResponse {}
export interface BrainCorePostReadinessScoreSummary extends BrainCorePostReadinessScore {}
export interface BrainCorePostReadinessScoreResponseSummary extends BrainCorePostReadinessScoreResponse {}

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
  postOrchestratorFlows?: BrainCorePostFlowFixturesResponse;
  postOrchestratorDrafts?: BrainCorePostDraftFixturesResponse;
  postOrchestratorEvents?: BrainCorePostEventFixturesResponse;
  postOrchestratorDryRun?: BrainCorePostDryRunPlanResponse;
  postOrchestratorReviewQueue?: BrainCorePostDraftReviewQueueResponse;
  postOrchestratorContracts?: { contracts?: BrainCorePostOrchestratorContract[] };
  postOrchestratorIntegrations?: { integrations?: BrainCorePostOrchestratorIntegration[] };
  postOrchestratorRecovery?: { items?: BrainCorePostOrchestratorRecoveryItem[] };
  postOrchestratorQaStatus?: BrainCorePostQaStatus;
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

  const [status, capabilities, runtimeReports, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, postQaStatus, stbStatus, videoOrchestratorStatus, stbVideoMigrationStatus, agents] = await Promise.all([
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
    fetchJson<BrainCorePostQaStatusResponse>(normalizedBaseUrl, '/post-orchestrator/qa-status'),
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
    ['/post-orchestrator/qa-status', postQaStatus],
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
    postOrchestratorQaStatus: postQaStatus.value?.qaStatus,
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

export async function readBrainCorePostOrchestratorEvents(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostEventFixturesResponse>> {
  return fetchJson<BrainCorePostEventFixturesResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/events');
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

export async function readBrainCorePostOrchestratorDryRun(
  baseUrl: string,
  eventId: string,
): Promise<HttpResult<BrainCorePostDryRunPlanResponse>> {
  return fetchJson<BrainCorePostDryRunPlanResponse>(normalizeBaseUrl(baseUrl), `/post-orchestrator/dry-run/${encodeURIComponent(eventId)}`);
}

export async function readBrainCorePostDraftReviewQueue(
  baseUrl: string,
  eventId: string,
): Promise<HttpResult<BrainCorePostDraftReviewQueueResponse>> {
  return fetchJson<BrainCorePostDraftReviewQueueResponse>(normalizeBaseUrl(baseUrl), `/post-orchestrator/review-queue/${encodeURIComponent(eventId)}`);
}

export async function requestBrainCorePostDraftReviewApproval(
  baseUrl: string,
  reviewItemId: string,
): Promise<HttpResult<BrainCorePostDraftReviewApprovalRequest>> {
  return fetchJson<BrainCorePostDraftReviewApprovalRequest>(
    normalizeBaseUrl(baseUrl),
    `/post-orchestrator/review-queue/${encodeURIComponent(reviewItemId)}/request-approval`,
    { method: 'POST' },
  );
}

export async function readBrainCorePostSchedulePreviewQueue(
  baseUrl: string,
  eventId: string,
): Promise<HttpResult<BrainCorePostSchedulePreviewQueueResponse>> {
  return fetchJson<BrainCorePostSchedulePreviewQueueResponse>(
    normalizeBaseUrl(baseUrl),
    `/post-orchestrator/schedule-preview/${encodeURIComponent(eventId)}`,
  );
}

export async function requestBrainCorePostSchedulePreviewApproval(
  baseUrl: string,
  schedulePreviewItemId: string,
): Promise<HttpResult<BrainCorePostSchedulePreviewApprovalRequest>> {
  return fetchJson<BrainCorePostSchedulePreviewApprovalRequest>(
    normalizeBaseUrl(baseUrl),
    `/post-orchestrator/schedule-preview/${encodeURIComponent(schedulePreviewItemId)}/request-approval`,
    { method: 'POST' },
  );
}

export async function readBrainCorePostAnalyticsFixtures(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostAnalyticsFixturesResponse>> {
  return fetchJson<BrainCorePostAnalyticsFixturesResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/analytics');
}

export async function readBrainCorePostPipelineSummary(
  baseUrl: string,
  eventId: string,
): Promise<HttpResult<BrainCorePostPipelineSummaryResponse>> {
  return fetchJson<BrainCorePostPipelineSummaryResponse>(
    normalizeBaseUrl(baseUrl),
    `/post-orchestrator/pipeline/${encodeURIComponent(eventId)}`,
  );
}

export async function readBrainCorePostReadinessScore(
  baseUrl: string,
  eventId: string,
): Promise<HttpResult<BrainCorePostReadinessScoreResponse>> {
  return fetchJson<BrainCorePostReadinessScoreResponse>(
    normalizeBaseUrl(baseUrl),
    `/post-orchestrator/readiness/${encodeURIComponent(eventId)}`,
  );
}

export async function readBrainCorePostPlatformPolicies(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostPlatformPoliciesResponse>> {
  return fetchJson<BrainCorePostPlatformPoliciesResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/platform-policies');
}

export async function readBrainCorePostDecommissionReadiness(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostDecommissionReadinessResponse>> {
  return fetchJson<BrainCorePostDecommissionReadinessResponse>(
    normalizeBaseUrl(baseUrl),
    '/post-orchestrator/decommission-readiness',
  );
}

export async function readBrainCorePostOperatorGuidance(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostOperatorGuidanceResponse>> {
  return fetchJson<BrainCorePostOperatorGuidanceResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/operator-guidance');
}

export async function readBrainCorePostManualExportPackage(
  baseUrl: string,
  eventId: string,
): Promise<HttpResult<BrainCorePostManualExportPackageResponse>> {
  return fetchJson<BrainCorePostManualExportPackageResponse>(
    normalizeBaseUrl(baseUrl),
    `/post-orchestrator/manual-export/${encodeURIComponent(eventId)}`,
  );
}

export async function readBrainCorePostAcceptanceChecklist(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostAcceptanceChecklistResponse>> {
  return fetchJson<BrainCorePostAcceptanceChecklistResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/acceptance-checklist');
}

export async function readBrainCorePostMigrationParityReport(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostMigrationParityReportResponse>> {
  return fetchJson<BrainCorePostMigrationParityReportResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/migration-parity');
}

export async function readBrainCorePostRoadmapCheckpoint(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostRoadmapCheckpointResponse>> {
  return fetchJson<BrainCorePostRoadmapCheckpointResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/roadmap-checkpoint');
}

export async function readBrainCorePostOrchestratorOverview(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostOrchestratorOverviewResponse>> {
  return fetchJson<BrainCorePostOrchestratorOverviewResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/overview');
}

export async function readBrainCorePostQaStatus(
  baseUrl: string,
): Promise<HttpResult<BrainCorePostQaStatusResponse>> {
  return fetchJson<BrainCorePostQaStatusResponse>(normalizeBaseUrl(baseUrl), '/post-orchestrator/qa-status');
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

export async function readBrainCoreVideoOrchestratorIntake(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoOrchestratorIntakeResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoOrchestratorIntakeResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/intake');
}

export async function readBrainCoreVideoOrchestratorIntakePlan(
  baseUrl: string,
  planId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoIntakePlan>> {
  return fetchJson<import('./client.js').BrainCoreVideoIntakePlan>(normalizeBaseUrl(baseUrl), `/video-orchestrator/intake/${encodeURIComponent(planId)}`);
}

export async function readBrainCoreVideoOrchestratorResearch(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoResearchListResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoResearchListResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/research');
}

export async function readBrainCoreVideoOrchestratorResearchPlan(
  baseUrl: string,
  planId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoOrchestratorResearchResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoOrchestratorResearchResponse>(normalizeBaseUrl(baseUrl), `/video-orchestrator/research/${encodeURIComponent(planId)}`);
}

export async function readBrainCoreVideoOrchestratorScript(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoScriptListResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoScriptListResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/script');
}

export async function readBrainCoreVideoOrchestratorScriptPlan(
  baseUrl: string,
  planId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoScriptResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoScriptResponse>(normalizeBaseUrl(baseUrl), `/video-orchestrator/script/${encodeURIComponent(planId)}`);
}

export async function readBrainCoreVideoOrchestratorAssetPlans(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoAssetPlanListResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoAssetPlanListResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/asset-plan');
}

export async function readBrainCoreVideoOrchestratorAssetPlan(
  baseUrl: string,
  planId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoAssetPlanDetailResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoAssetPlanDetailResponse>(normalizeBaseUrl(baseUrl), `/video-orchestrator/asset-plan/${encodeURIComponent(planId)}`);
}

export async function readBrainCoreVideoOrchestratorDesignPlans(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoDesignPlanListResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoDesignPlanListResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/design-plan');
}

export async function readBrainCoreVideoOrchestratorDesignPlan(
  baseUrl: string,
  assetPlanId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoDesignPlanDetailResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoDesignPlanDetailResponse>(normalizeBaseUrl(baseUrl), `/video-orchestrator/design-plan/${encodeURIComponent(assetPlanId)}`);
}

export async function readBrainCoreVideoOrchestratorVoiceoverPlans(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoVoiceoverPlanListResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoVoiceoverPlanListResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/voiceover-plan');
}

export async function readBrainCoreVideoOrchestratorVoiceoverPlan(
  baseUrl: string,
  scriptPlanId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoVoiceoverPlanDetailResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoVoiceoverPlanDetailResponse>(normalizeBaseUrl(baseUrl), `/video-orchestrator/voiceover-plan/${encodeURIComponent(scriptPlanId)}`);
}

export async function readBrainCoreVideoOrchestratorVisualsPlans(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoVisualsPlanListResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoVisualsPlanListResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/visuals-plan');
}

export async function readBrainCoreVideoOrchestratorVisualsPlan(
  baseUrl: string,
  voiceoverPlanId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoVisualsPlanDetailResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoVisualsPlanDetailResponse>(normalizeBaseUrl(baseUrl), `/video-orchestrator/visuals-plan/${encodeURIComponent(voiceoverPlanId)}`);
}

export async function readBrainCoreVideoOrchestratorAssemblyPlans(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoAssemblyPlanListResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoAssemblyPlanListResponse>(normalizeBaseUrl(baseUrl), '/video-orchestrator/assembly-plan');
}

export async function readBrainCoreVideoOrchestratorAssemblyPlan(
  baseUrl: string,
  voiceoverPlanId: string,
): Promise<HttpResult<import('./client.js').BrainCoreVideoAssemblyPlanDetailResponse>> {
  return fetchJson<import('./client.js').BrainCoreVideoAssemblyPlanDetailResponse>(normalizeBaseUrl(baseUrl), `/video-orchestrator/assembly-plan/${encodeURIComponent(voiceoverPlanId)}`);
}

export async function readBrainCoreStbVideoMigrationStatus(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreStbVideoMigrationStatus>> {
  return fetchJson<import('./client.js').BrainCoreStbVideoMigrationStatus>(normalizeBaseUrl(baseUrl), '/stb-video-migration/status');
}

export async function readBrainCoreStbVideoParityMatrix(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreStbVideoParityMatrix>> {
  return fetchJson<import('./client.js').BrainCoreStbVideoParityMatrix>(normalizeBaseUrl(baseUrl), '/stb-video/parity-matrix');
}

export async function readBrainCoreStbVideoDualRunStatus(
  baseUrl: string,
): Promise<HttpResult<import('./client.js').BrainCoreStbVideoDualRunStatus>> {
  return fetchJson<import('./client.js').BrainCoreStbVideoDualRunStatus>(normalizeBaseUrl(baseUrl), '/stb-video/dual-run-status');
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

async function fetchJson<T>(
  baseUrl: string,
  pathname: string,
  options: { method?: 'GET' | 'POST'; body?: string } = {},
): Promise<HttpResult<T>> {
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
        method: options.method ?? 'GET',
        headers: { accept: 'application/json' },
        ...(options.body ? { body: options.body } : {}),
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
