export interface BrainCoreStatus {
  service: 'brain-core';
  mode: 'read-only';
  ok: boolean;
  startedAt: string;
  uptimeSeconds: number;
  version: string;
  host: string;
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

export interface BrainCoreSkillSummary {
  id: string;
  name: string;
  sourcePath: string;
  status: 'indexed' | 'placeholder';
}

export interface BrainCoreRepoSummary {
  alias: string;
  path: string;
  exists: boolean;
  handoffPath?: string;
  handoffExists: boolean;
  source: 'env' | 'placeholder';
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

export type BrainCoreHealth = 'ok' | 'warning' | 'error' | 'unknown';

export type BrainCoreLifecycleStatus = 'operational' | 'partial' | 'planned' | 'legacy' | 'migrating' | 'blocked' | 'unknown';

export type BrainCoreCurrentRole = 'primary' | 'legacy' | 'future' | 'supporting';

export interface BrainCoreOrchestratorSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'unknown' | 'disabled';
  source: 'placeholder';
  actionsSupported: boolean;
  health?: BrainCoreHealth;
  lifecycle?: BrainCoreLifecycleStatus;
  role?: BrainCoreCurrentRole;
  description?: string;
}

export interface BrainCorePipelineMigration {
  sourcePipelineId?: string;
  targetPipelineId?: string;
  parityStatus?: 'ready' | 'in-progress' | 'blocked' | 'not-applicable';
  decommissionBlocked?: boolean;
}

export interface BrainCorePipelineSummary {
  id: string;
  name: string;
  status: BrainCoreLifecycleStatus;
  health: BrainCoreHealth;
  role: BrainCoreCurrentRole;
  description: string;
  stages?: string[];
  migration?: BrainCorePipelineMigration;
}

export interface BrainCoreProjectSummary {
  id: string;
  name: string;
  category: 'content' | 'infrastructure' | 'operations' | 'research' | 'other';
  status: BrainCoreLifecycleStatus;
  health: BrainCoreHealth;
  orchestratorIds?: string[];
  pipelineIds?: string[];
  platformIds?: string[];
}

export interface BrainCorePlatformSummary {
  id: string;
  name: string;
  category: 'social' | 'video' | 'storage' | 'local' | 'development' | 'other';
  status: BrainCoreLifecycleStatus;
  health: BrainCoreHealth;
  projectIds?: string[];
  pipelineIds?: string[];
}

export interface BrainCoreStbPipelineStatus {
  id: 'stb-pipeline-status';
  pipelineId: 'stb-daily-pipeline';
  projectId: 'says-the-bible';
  source: 'runtime-file' | 'probot-status' | 'static-registry' | 'unavailable';
  status: 'operational' | 'stale' | 'error' | 'unknown';
  health: BrainCoreHealth;
  lastRunAt?: string;
  lastRunAgeHours?: number;
  queueCount?: number;
  failureCount?: number;
  currentItem?: string;
  summary: string;
  evidence: Array<{ label: string; path?: string; value: string }>;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export interface BrainCoreVideoOrchestratorStatus {
  id: 'video-orchestrator-status';
  orchestratorId: 'video-orchestrator';
  pipelineId: 'video-upload-pipeline';
  status: 'operational' | 'partial' | 'planned' | 'blocked' | 'unknown';
  health: BrainCoreHealth;
  moduleProgress: { total: number; implemented: number; partial: number; planned: number; blocked: number; percent: number };
  modules: Array<{ id: string; name: string; status: 'implemented' | 'partial' | 'planned' | 'blocked' | 'unknown'; summary: string }>;
  supportedProjects: string[];
  supportedPlatforms: string[];
  queueCount?: number;
  lastRunAt?: string;
  summary: string;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export interface BrainCoreStbVideoMigrationStatus {
  id: 'stb-to-video-migration-status';
  sourcePipelineId: 'stb-daily-pipeline';
  targetPipelineId: 'video-upload-pipeline';
  status: 'mapping' | 'partial' | 'dual-run' | 'ready' | 'complete' | 'blocked';
  health: BrainCoreHealth;
  parityPercent: number;
  decommissionBlocked: true;
  nextSafeTask: string;
  modules: Array<{ stbConcept: string; videoModule: string; status: 'mapped' | 'partial' | 'planned' | 'blocked'; validation: string }>;
  summary: string;
  blockers: string[];
}

export type BrainCorePostOrchestratorStatus = 'planned' | 'partial' | 'ready' | 'blocked' | 'disabled';

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

export interface BrainCoreAgentSummary {
  id: string;
  name: string;
  role: 'orchestrator' | 'executor' | 'researcher' | 'maintainer' | 'reviewer' | 'dashboard' | 'unknown';
  status: 'available' | 'planned' | 'external' | 'blocked' | 'unknown';
  health: BrainCoreHealth;
  owner: 'brain-core' | 'model-router' | 'external-tool' | 'planned';
  description: string;
  relatedOrchestratorId?: string;
  skills: string[];
  actions: { canRun: boolean; canRequestRun: boolean; requiresApproval: boolean };
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

export interface BrainCoreCapabilitySummary {
  readEndpoints: string[];
  approvalRequestEndpoints: string[];
  executableActionsEnabled: false;
  approvalAuditPersistenceSupported: boolean;
  runtimeReportsSupported: boolean;
  runtimeReportEndpoint: '/runtime/reports';
  modelRouterReportSupported: boolean;
  obsidianPluginInstalled: boolean;
  liveSchedulerVerified: boolean;
  mindWorkspace: {
    legacyTaskMigrationStatus: 'completed' | 'pending' | 'skipped';
    legacyTaskMigrationCommit?: string;
    cleanupInventory: string;
    workspaceIsolationRunbook: string;
    remainingKnownDirtyCategories: string[];
  };
  brainConsole: {
    scaffoldStatus: 'validated' | 'pending' | 'blocked';
    installedInMindVault: false;
    projectPath: string;
    packageStatus?: 'buildable' | 'pending' | 'blocked';
    manualInstallRequired?: true;
  };
  probot: {
    thinClientStatus: 'wired' | 'pending' | 'blocked';
    commandAliasesEnabled: boolean;
    actionsEnabled: false;
  };
  executionGate: {
    executionEnabled: false;
    modelRouterDryRunExecutionFlagEnabled: boolean;
    modelRouterDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';
    candidateActionKinds: string[];
    readinessEndpoint: '/execution/readiness';
    plansEndpoint: '/execution/plans';
    firstCandidate: 'scheduler-run-model-router-dry-run';
  };
  notes: string[];
}

export interface BrainCoreApprovalSummary {
  id: string;
  kind: string;
  status: 'placeholder' | 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  source: 'placeholder' | 'memory';
}

export interface BrainCoreApprovalPreview {
  kind: string;
  summary: string;
  wouldExecute: boolean;
  requiresApproval: true;
  writesToMind: false;
  externalSideEffects: false;
  commands: string[];
}

export interface BrainCoreExecutionGatePolicy {
  executionEnabled: boolean;
  executionGate: 'disabled-until-explicit-enable' | 'enabled-for-model-router-dry-run';
  requiresDurableAudit: true;
  requiresRollbackPlan: true;
}

export type BrainCoreApprovalStoreStatus = 'memory' | 'available' | 'invalid' | 'unsafe';

export interface BrainCoreApprovalRecord {
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  reason?: string;
  message?: string;
  id: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  executed: boolean;
  execution?: BrainCoreApprovalExecutionSummary;
  preview: BrainCoreApprovalPreview;
  policy: BrainCoreExecutionGatePolicy;
  source: 'memory' | 'json';
  ageMinutes?: number;
  expired?: boolean;
}

export interface BrainCoreApprovalStoreSummary {
  enabled: boolean;
  status: BrainCoreApprovalStoreStatus;
  path: string;
  recordCount: number;
  writesToMind: false;
  executableActions: false;
}

export interface BrainCoreApprovalExecutionSummary {
  status: 'ok' | 'error' | 'blocked';
  command: 'bash tools/scripts/model-router-dry-run-report.sh';
  outputPath?: string;
  exitCode?: number;
  message: string;
  writesToMind: false;
  externalSideEffects: false;
}

export interface BrainCoreExecutionPlanStep {
  id: string;
  description: string;
  commandPreview: string;
  willRunNow: false;
}

export interface BrainCoreMindPreviewPolicySummary {
  status: 'preview-only';
  firstProposedAction: 'model-router-update-current-context';
  firstProposedTarget: 'router/current.md';
  writesToMind: false;
  externalSideEffects: false;
  applyRouteEnabled: false;
  allowedTargets: string[];
  blockedPrefixes: string[];
  requiredGates: string[];
}

export interface BrainCoreExecutionPlan {
  kind: 'scheduler-run-model-router-dry-run';
  candidate: true;
  executionEnabled: false;
  modelRouterDryRunExecutionFlagEnabled: boolean;
  modelRouterDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';
  wouldExecute: false;
  executed: false;
  riskLevel: 'low';
  writesToMind: false;
  externalSideEffects: false;
  requiresApproval: true;
  requiresDurableApprovalStore: true;
  requiresDurableAudit: true;
  requiresRollbackPlan: true;
  rollbackPlan: string;
  summary: string;
  mindPreviewPolicy: BrainCoreMindPreviewPolicySummary;
  steps: BrainCoreExecutionPlanStep[];
}

export interface BrainCoreMindPreviewPolicyDocument {
  path: string;
  description: string;
}

export interface BrainCoreMindPreviewPolicy {
  status: 'preview-only';
  firstProposedAction: 'model-router-update-current-context';
  firstProposedTarget: 'router/current.md';
  applyRouteEnabled: false;
  writesToMind: false;
  externalSideEffects: false;
  allowedTargets: string[];
  blockedPrefixes: string[];
  requiredGates: string[];
  docs: BrainCoreMindPreviewPolicyDocument[];
}

export interface BrainCoreMindPreviewSummary {
  id: string;
  actionKind: 'model-router-update-current-context';
  targetPath: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  allowedRoot: boolean;
  blockedRoot: boolean;
  writesToMind: false;
  externalSideEffects: false;
}

export interface BrainCoreMindPreviewDetail extends BrainCoreMindPreviewSummary {
  operation: 'patch' | 'overwrite' | 'create';
  oldHash: string | null;
  newHash: string;
  lineCountBefore: number;
  lineCountAfter: number;
  maxLines: number | null;
  unifiedDiff: string;
  policyReasons: string[];
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

export interface BrainCoreExecutionReadiness {
  executionEnabled: false;
  modelRouterDryRunExecutionFlagEnabled: boolean;
  modelRouterDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';
  candidateCount: number;
  readyCandidateCount: number;
  blockers: string[];
  writesToMind: false;
  executableActions: false;
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

export interface BrainCoreActionReadiness {
  status: 'ready' | 'blocked';
  blockers: string[];
  executionWillWriteToMind: false;
  executionWillApplyChanges: false;
  executionKind: 'report-only' | 'unknown';
  latestApprovalStatus?: 'pending' | 'approved' | 'rejected' | 'expired';
  latestApprovalId?: string;
  latestRequestAgeMinutes?: number;
  latestPreviewReportPath?: string;
  latestPreviewReportAgeMinutes?: number;
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
  readiness?: BrainCoreActionReadiness;
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

export interface BrainCoreActionRequestResult {
  approval?: BrainCoreApprovalSummary;
  preview?: BrainCoreApprovalPreview;
  policy?: BrainCoreExecutionGatePolicy;
  accepted: boolean;
  executed: false;
  message: string;
}

export interface BrainCoreApprovalDecisionResult {
  approval: BrainCoreApprovalSummary;
  preview?: BrainCoreApprovalPreview;
  policy?: BrainCoreExecutionGatePolicy;
  execution?: BrainCoreApprovalExecutionSummary;
  accepted: true;
  executed: boolean;
  message: string;
}

export interface BrainCoreApprovalAuditEvent {
  id: string;
  approvalId: string;
  event: 'requested' | 'approved' | 'rejected' | 'missing' | 'executed';
  kind: string;
  createdAt: string;
  persisted: boolean;
  executed: boolean;
  execution?: BrainCoreApprovalExecutionSummary;
  source: 'memory' | 'jsonl';
}

export interface BrainCoreErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type BrainCoreRuntimeReportId = 'model-router' | 'approval-audit' | 'video' | 'local-apps';

export type BrainCoreRuntimeReportStatus = 'available' | 'missing' | 'invalid';

export interface BrainCoreRuntimeReportSummary {
  id: BrainCoreRuntimeReportId;
  status: BrainCoreRuntimeReportStatus;
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

export interface BrainCoreRoutes {
  '/status': BrainCoreStatus;
  '/sessions': {
    sessions: BrainCoreSessionSummary[];
  };
  '/skills': {
    skills: BrainCoreSkillSummary[];
  };
  '/repos': {
    repos: BrainCoreRepoSummary[];
  };
  '/scheduler/status': BrainCoreSchedulerStatus;
  '/scheduler/latest-run': BrainCoreSchedulerStatus;
  '/scheduler/jobs': {
    jobs: BrainCoreSchedulerJobSummary[];
  };
  '/local-apps': {
    apps: BrainCoreLocalAppSummary[];
  };
  '/video/status': BrainCoreVideoStatus;
  '/video/queue': {
    queue: BrainCoreVideoQueueItem[];
  };
  '/approvals': {
    approvals: BrainCoreApprovalSummary[];
  };
  '/approvals/store': BrainCoreApprovalStoreSummary;
  '/execution/plans': {
    plans: BrainCoreExecutionPlan[];
  };
  '/execution/mind-preview-policy': BrainCoreMindPreviewPolicy;
  '/execution/mind-previews': {
    previews: BrainCoreMindPreviewSummary[];
  };
  '/execution/mind-previews/latest': {
    preview?: BrainCoreMindPreviewDetail;
    status: 'empty' | 'available';
  };
  '/execution/mind-previews/:id': {
    preview: BrainCoreMindPreviewDetail;
  };
  '/execution/readiness': BrainCoreExecutionReadiness;
  '/execution/plans/:kind': {
    plan?: BrainCoreExecutionPlan;
  };
  '/orchestrators': {
    orchestrators: BrainCoreOrchestratorSummary[];
  };
  '/orchestrators/:id': {
    orchestrator: BrainCoreOrchestratorSummary;
  };
  '/pipelines': {
    pipelines: BrainCorePipelineSummary[];
  };
  '/pipelines/:id': {
    pipeline: BrainCorePipelineSummary;
  };
  '/projects': {
    projects: BrainCoreProjectSummary[];
  };
  '/platforms': {
    platforms: BrainCorePlatformSummary[];
  };
  '/stb/status': BrainCoreStbPipelineStatus;
  '/video-orchestrator/status': BrainCoreVideoOrchestratorStatus;
  '/stb-video-migration/status': BrainCoreStbVideoMigrationStatus;
  '/agents': {
    agents: BrainCoreAgentSummary[];
  };
  '/agents/:id': {
    agent: BrainCoreAgentSummary;
  };
  '/capabilities': BrainCoreCapabilitySummary;
  '/approvals/audit': {
    events: BrainCoreApprovalAuditEvent[];
  };
  '/runtime/reports': {
    reports: BrainCoreRuntimeReportSummary[];
  };
  '/actions/request': BrainCoreActionRequestResult;
  '/scheduler/jobs/:id/request-run': BrainCoreActionRequestResult;
  '/skills/profile': BrainCoreActionRequestResult;
  '/sessions/:id/resume': BrainCoreActionRequestResult;
  '/local-apps/:id/start': BrainCoreActionRequestResult;
  '/local-apps/:id/stop': BrainCoreActionRequestResult;
  '/local-apps/:id/restart': BrainCoreActionRequestResult;
  '/approvals/:id/approve': BrainCoreApprovalDecisionResult;
  '/approvals/:id/reject': BrainCoreApprovalDecisionResult;
  '/actions': {
    actions: BrainCoreActionSummary[];
  };
  '/actions/:id': {
    action: BrainCoreActionSummary;
  };
  '/actions/:id/request-approval': BrainCoreActionRequest;
}
