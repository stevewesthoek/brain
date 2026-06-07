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

export interface BrainCoreAiModelSelectorHealthMatrixModel {
  provider_id: string;
  provider_type: string;
  model_id: string;
  model_key: string;
  label: string;
  enabled: boolean;
  selectable: boolean;
  status: string;
  capabilities: string[];
  roles: string[];
  region?: string | null;
  last_checked_at?: number | null;
  probe: {
    status: string;
    checked_at?: number | null;
    error?: unknown;
    response_preview?: string;
  };
  outcome: Record<string, unknown>;
  cost: {
    input_per_1m?: number | null;
    output_per_1m?: number | null;
  };
  provider_healthy?: boolean;
  rate_limited?: boolean;
  loaded?: boolean;
}

export interface BrainCoreAiModelSelectorHealthMatrix {
  id: 'ai-model-selector-health-matrix';
  generated_at: string;
  status: string;
  probe_mode: string;
  selector: {
    service: string;
    port: number;
    provider_count: number;
    model_count: number;
    selectable_model_count: number;
  };
  policy: {
    selection_endpoint: string;
    health_matrix_endpoint: string;
    consumers_use_selector: boolean;
    consumer_provider_probes_allowed: boolean;
  };
  providers: unknown[];
  models: BrainCoreAiModelSelectorHealthMatrixModel[];
  error?: string;
}

export interface BrainCoreLocalAppSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'unknown' | 'disabled' | 'running' | 'stopped';
  source: 'placeholder' | 'runtime-report';
  actionsSupported: boolean;
}

export type BrainCoreLocalAppDashboardStatus = 'available' | 'partial' | 'unavailable';
export type BrainCoreLocalAppHealth = 'healthy' | 'warning' | 'error' | 'unknown';
export type BrainCoreLocalAppSource = 'brain-core' | 'infrastructure-config' | 'unknown';
export type BrainCoreLocalAppActionPolicyStatus = 'disabled' | 'planned' | 'enabled';
export type BrainCoreLocalAppActionExecutionPath = 'none' | 'brain-core-allowlisted-action';
export type BrainCoreLocalAppReadinessStatus = 'not-ready' | 'ready';

export interface BrainCoreLocalAppDashboardItem {
  id: string;
  name: string;
  label: string;
  category: string;
  status: 'running' | 'stopped' | 'unknown' | 'unavailable';
  health: BrainCoreLocalAppHealth;
  url?: string;
  port?: number;
  servicePorts?: number[];
  databasePort?: number;
  containerName?: string;
  containerStatus?: 'running' | 'stopped' | 'unknown';
  source: BrainCoreLocalAppSource;
  managed: boolean;
  startSupported: boolean;
  stopSupported: boolean;
  restartSupported: boolean;
  actionEnabled: boolean;
  actionDisabledReason: string;
  actionDisabledReasons?: Partial<Record<BrainCoreLocalAppAction, string>>;
  lastCheckedAt: string;
  notes: string;
}

export interface BrainCoreLocalAppActionPolicy {
  status: BrainCoreLocalAppActionPolicyStatus;
  executionPath: BrainCoreLocalAppActionExecutionPath;
  requiresConfirmation: true;
  requiresAllowlist: true;
  pluginExecutesShell: false;
  arbitraryCommandAllowed: false;
  safeActions: Array<'start' | 'stop' | 'restart'>;
  blockedActions: Array<'start' | 'stop' | 'restart' | 'custom-command'>;
}

export interface BrainCoreLocalAppSafety {
  readOnlyDashboard: true;
  pluginExecutesShell: false;
  arbitraryCommandExecution: false;
  exposesSecrets: false;
  exposesEnv: false;
  platformWrites: false;
  mindWrites: false;
  destructiveActions: false;
  startStopControlsEnabled: boolean;
}

export interface BrainCoreLocalAppsDashboardResponse {
  id: 'local-apps-dashboard';
  status: BrainCoreLocalAppDashboardStatus;
  appCount: number;
  runningCount: number;
  stoppedCount: number;
  unknownCount: number;
  managedCount: number;
  unmanagedCount: number;
  apps: BrainCoreLocalAppDashboardItem[];
  actionPolicy: BrainCoreLocalAppActionPolicy;
  safety: BrainCoreLocalAppSafety;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreLocalAppActionReadinessCriterion {
  id: string;
  label: string;
  satisfied: boolean;
  detail: string;
}

export interface BrainCoreLocalAppActionReadinessResponse {
  id: 'local-apps-action-readiness';
  status: BrainCoreLocalAppReadinessStatus;
  ready: boolean;
  criteria: BrainCoreLocalAppActionReadinessCriterion[];
  satisfiedCount: number;
  unsatisfiedCount: number;
  blockers: string[];
  safety: BrainCoreLocalAppSafety;
  nextSafeStep: string;
}

export type BrainCoreLocalAppAction = 'start' | 'stop' | 'restart';
export type BrainCoreLocalAppServiceType = 'web' | 'agent' | 'relay' | 'worker' | 'scheduler' | 'api' | 'database' | 'other';
export type BrainCoreLocalAppOnboardingStatus = 'registered' | 'missing' | 'planned';
export type BrainCoreLocalAppOrchestratorStatusValue = 'available' | 'partial' | 'unavailable';
export type BrainCoreLocalAppActionPlanStatus = 'disabled' | 'ready';

export interface BrainCoreLocalAppActionPolicy {
  status: 'disabled' | 'planned' | 'enabled';
  executionPath: 'none' | 'brain-core-allowlisted-action';
  requiresConfirmation: true;
  requiresAllowlist: true;
  pluginExecutesShell: false;
  arbitraryCommandAllowed: false;
  safeActions: BrainCoreLocalAppAction[];
  blockedActions: Array<BrainCoreLocalAppAction | 'custom-command'>;
}

export interface BrainCoreLocalAppServiceActionPolicy extends BrainCoreLocalAppActionPolicy {}

export interface BrainCoreLocalAppServiceDefinition {
  id: string;
  label: string;
  type: BrainCoreLocalAppServiceType;
  port?: number;
  healthUrl?: string;
  required: boolean;
  startOrder: number;
  stopOrder: number;
  status: 'running' | 'stopped' | 'unknown' | 'unavailable';
  actionPolicy: BrainCoreLocalAppServiceActionPolicy;
}

export interface BrainCoreLocalAppDatabaseDefinition {
  id: string;
  type: 'postgres' | 'mysql' | 'redis' | 'sqlite' | 'other';
  orbStackManaged: boolean;
  engine?: string;
  name?: string;
  containerName?: string;
  hostPort?: number;
  containerPort?: number;
  status: 'running' | 'stopped' | 'unknown' | 'unavailable';
  actionPolicy: BrainCoreLocalAppServiceActionPolicy;
}

export interface BrainCoreLocalAppDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  category: 'brain-core' | 'local-app' | 'dashboard' | 'operations' | 'video' | 'research' | 'other';
  repoPathSummary?: string;
  appPort?: number;
  appUrl?: string;
  healthUrl?: string;
  managed: boolean;
  services: BrainCoreLocalAppServiceDefinition[];
  database?: BrainCoreLocalAppDatabaseDefinition;
  docsRef: string;
  onboardingStatus: BrainCoreLocalAppOnboardingStatus;
  actionPolicy: BrainCoreLocalAppActionPolicy;
  startCommand?: string;
  stopCommand?: string;
  restartCommand?: string;
  commandWorkdir?: string;
  commandPathPrepend?: string[];
  lifecycleNotes?: string;
  startupTimeoutMs?: number;
}

export interface BrainCoreLocalAppActionStep {
  id: string;
  label: string;
  detail: string;
}

export interface BrainCoreLocalAppActionPlan {
  appId: string;
  action: BrainCoreLocalAppAction;
  status: BrainCoreLocalAppActionPlanStatus;
  reason: string;
  steps: BrainCoreLocalAppActionStep[];
  requiresConfirmation: true;
  pluginExecutesShell: false;
  arbitraryCommandAllowed: false;
  allowlistRequired: true;
  auditRequired: true;
  canExecuteNow: boolean;
}

export interface BrainCoreLocalAppActionResultStep {
  id: string;
  label: string;
  type: 'database' | 'service' | 'validation' | 'health-check' | 'report';
  status: 'success' | 'failed' | 'not_executable' | 'blocked' | 'skipped';
  message: string;
}

export interface BrainCoreLocalAppPortCheck {
  port: number;
  kind: 'app' | 'service' | 'database';
  status: 'free' | 'occupied_known' | 'occupied_unknown' | 'healthy' | 'unhealthy' | 'unknown';
  label?: string;
  message?: string;
}

export interface BrainCoreLocalAppActionSafety {
  pluginExecutesShell: false;
  arbitraryCommandAllowed: false;
  commandOverrideAccepted: false;
  canonicalAppIdRequired: true;
  allowlistedDefinitionRequired: boolean;
  allowlistedApp: boolean;
  allowlistedAction: boolean;
  exposesSecrets: false;
}

export type BrainCoreLocalAppManagedProcessStrategy = 'repo-npm-dev' | 'repo-npm-start';

export interface BrainCoreLocalAppManagedProcessRecord {
  appId: string;
  action: 'start';
  pid: number;
  startedAt: string;
  cwdSummary: string;
  strategy: BrainCoreLocalAppManagedProcessStrategy;
  commandLabel: string;
}

export interface BrainCoreLocalAppActionResult {
  id: string;
  appId: string;
  action: BrainCoreLocalAppAction;
  status: 'accepted' | 'running' | 'success' | 'failed' | 'not_executable' | 'blocked' | 'not_found';
  ok: boolean;
  message: string;
  errorCode?: string;
  error?: string;
  startedAt: string;
  endedAt: string;
  finishedAt: string;
  durationMs: number;
  nextPollMs: number;
  steps: BrainCoreLocalAppActionResultStep[];
  portChecks?: BrainCoreLocalAppPortCheck[];
  safety: BrainCoreLocalAppActionSafety;
  nextState: 'running' | 'stopped' | 'unknown';
}

export interface BrainCoreLocalAppActionAuditStatus {
  status: 'enabled' | 'disabled' | 'error';
  path: string;
  persistedResultCount: number;
  lastPersistedAt?: string;
  lastError?: string;
  safety: {
    pluginExecutesShell: false;
    arbitraryCommandAllowed: false;
    commandOverrideAccepted: false;
    exposesSecrets: false;
    writesToMind: false;
    writesOperationsConfig: false;
  };
}

export interface BrainCoreLocalAppActionStatusResponse {
  id: 'local-apps-actions-status';
  inFlight: BrainCoreLocalAppActionResult[];
  recentResults: BrainCoreLocalAppActionResult[];
  lastErrorByApp: Record<string, BrainCoreLocalAppActionResult>;
  locks: Array<{ appId: string; action: BrainCoreLocalAppAction; startedAt: string }>;
  managedProcesses: BrainCoreLocalAppManagedProcessRecord[];
  audit: BrainCoreLocalAppActionAuditStatus;
  safety: {
    pluginExecutesShell: false;
    arbitraryCommandAllowed: false;
    commandOverrideAccepted: false;
    exposesSecrets: false;
  };
}

export type BrainCoreLocalAppActionEnablementCategory =
  | 'missing-command'
  | 'missing-repo-local-script'
  | 'unsafe-command-shape'
  | 'missing-working-directory'
  | 'missing-helper'
  | 'dynamic-stop-after-brain-core-start'
  | 'manual-only'
  | 'not-yet-allowlisted'
  | 'other';

export interface BrainCoreLocalAppActionEnablementBacklogItem {
  appId: string;
  appName: string;
  action: BrainCoreLocalAppAction;
  enabled: false;
  reason: string;
  category: BrainCoreLocalAppActionEnablementCategory;
  commandSummary?: string | undefined;
  repoPathSummary?: string | undefined;
  recommendedChange: string;
  risk: 'low' | 'medium' | 'high';
  canBeAutoFixed: false;
  requiresHumanReview: true;
}

export interface BrainCoreLocalAppActionEnablementBacklogCategory {
  id: BrainCoreLocalAppActionEnablementCategory;
  label: string;
  count: number;
  nextSafeStep: string;
}

export interface BrainCoreLocalAppActionEnablementBacklogResponse {
  id: 'local-apps-action-enablement-backlog';
  generatedAt: string;
  totalActionCount: number;
  enabledActionCount: number;
  disabledActionCount: number;
  appsWithDisabledActions: number;
  categories: BrainCoreLocalAppActionEnablementBacklogCategory[];
  items: BrainCoreLocalAppActionEnablementBacklogItem[];
  safety: {
    readOnly: true;
    pluginExecutesShell: false;
    arbitraryCommandAllowed: false;
    modifiesRegistry: false;
    writesOperationsConfig: false;
    exposesSecrets: false;
    exposesEnv: false;
    enablesActions: false;
  };
  nextSafeStep: string;
}

export type BrainCoreLocalAppReachabilityStatus =
  | 'reachable'
  | 'unreachable'
  | 'unknown'
  | 'not-configured'
  | 'stale';

export interface BrainCoreLocalAppOperationalReadinessFreshness {
  source: 'live-check' | 'not-checked';
  maxAgeMs: number;
  ageMs?: number;
  fresh: boolean;
}

export interface BrainCoreLocalAppOperationalReadinessSafety {
  readOnly: true;
  pluginExecutesShell: false;
  arbitraryCommandAllowed: false;
  exposesSecrets: false;
  writesToMind: false;
  performsLifecycleAction: false;
}

export interface BrainCoreLocalAppOperationalReadinessLastAction {
  action: BrainCoreLocalAppAction;
  status: string;
  ok: boolean;
  endedAt?: string;
  message: string;
}

export interface BrainCoreLocalAppOperationalReadinessItem {
  appId: string;
  appName: string;
  appUrl?: string;
  healthUrl?: string;
  port?: number;
  status: BrainCoreLocalAppReachabilityStatus;
  httpStatus?: number;
  checkedAt?: string;
  durationMs?: number;
  message: string;
  actionEnabled: boolean;
  startSupported: boolean;
  stopSupported: boolean;
  restartSupported: boolean;
  lastAction?: BrainCoreLocalAppOperationalReadinessLastAction;
  freshness: BrainCoreLocalAppOperationalReadinessFreshness;
  safety: BrainCoreLocalAppOperationalReadinessSafety;
}

export interface BrainCoreLocalAppsOperationalReadinessResponse {
  id: 'local-apps-operational-readiness';
  generatedAt: string;
  appCount: number;
  reachableCount: number;
  unreachableCount: number;
  unknownCount: number;
  notConfiguredCount: number;
  staleCount: number;
  items: BrainCoreLocalAppOperationalReadinessItem[];
  totalCheckDurationMs: number;
  safety: BrainCoreLocalAppOperationalReadinessSafety;
}

export type BrainCoreLocalAppOperatorSummaryItemStatus = 'ok' | 'attention' | 'blocked' | 'unknown';

export interface BrainCoreLocalAppOperatorSummaryDisabledAction {
  action: BrainCoreLocalAppAction;
  reason: string;
  category?: string;
}

export interface BrainCoreLocalAppOperatorSummaryNextAction {
  label: string;
  kind:
    | 'none'
    | 'start'
    | 'stop'
    | 'restart'
    | 'inspect-health'
    | 'configure-health-url'
    | 'add-lifecycle-script'
    | 'manual-review';
  reason: string;
  executable: boolean;
}

export interface BrainCoreLocalAppOperatorSummaryFreshness {
  checkedAt?: string;
  fresh: boolean;
  source: 'operational-readiness' | 'dashboard' | 'backlog' | 'action-status';
}

export interface BrainCoreLocalAppOperatorSummaryLastAction {
  action: BrainCoreLocalAppAction;
  status: string;
  ok: boolean;
  endedAt?: string;
  message: string;
}

export interface BrainCoreLocalAppOperatorSummaryItem {
  appId: string;
  appName: string;
  status: BrainCoreLocalAppOperatorSummaryItemStatus;
  reachabilityStatus: BrainCoreLocalAppReachabilityStatus;
  actionEnabled: boolean;
  supportedActions: BrainCoreLocalAppAction[];
  disabledActions: BrainCoreLocalAppOperatorSummaryDisabledAction[];
  lastAction?: BrainCoreLocalAppOperatorSummaryLastAction;
  nextRecommendedAction: BrainCoreLocalAppOperatorSummaryNextAction;
  freshness: BrainCoreLocalAppOperatorSummaryFreshness;
}

export interface BrainCoreLocalAppOperatorTopAttentionItem {
  appId: string;
  appName: string;
  status: string;
  reason: string;
  nextRecommendedAction: string;
}

export interface BrainCoreLocalAppOperatorSummarySafety {
  readOnly: true;
  pluginExecutesShell: false;
  arbitraryCommandAllowed: false;
  exposesSecrets: false;
  writesToMind: false;
  performsLifecycleAction: false;
}

export interface BrainCoreLocalAppsOperatorSummaryResponse {
  id: 'local-apps-operator-summary';
  generatedAt: string;
  appCount: number;
  executableActionCount: number;
  disabledActionCount: number;
  reachableCount: number;
  unreachableCount: number;
  notConfiguredCount: number;
  staleCount: number;
  attentionCount: number;
  items: BrainCoreLocalAppOperatorSummaryItem[];
  topAttentionItems: BrainCoreLocalAppOperatorTopAttentionItem[];
  safety: BrainCoreLocalAppOperatorSummarySafety;
}

export interface BrainCoreLocalAppOrchestratorStatus {
  id: 'local-apps-orchestrator';
  status: BrainCoreLocalAppOrchestratorStatusValue;
  appCount: number;
  serviceCount: number;
  databaseCount: number;
  managedCount: number;
  definitions: BrainCoreLocalAppDefinition[];
  actionPolicy: BrainCoreLocalAppActionPolicy;
  safety: BrainCoreLocalAppSafety;
  nextSafeStep: string;
}

export interface BrainCoreLocalAppOnboardingChecklist {
  id: 'local-apps-onboarding-checklist';
  status: 'available' | 'partial' | 'unavailable';
  requiredFields: string[];
  onboardingSteps: string[];
  standards: string[];
  portPolicy: {
    appPort: string;
    servicePorts: string;
    databasePorts: string;
  };
  databasePolicy: {
    orbStackManaged: boolean;
    optional: boolean;
    requiredWhenNeeded: boolean;
  };
  servicePolicy: {
    oneOrMoreServicesAllowed: boolean;
    orderedLifecycle: boolean;
    healthChecked: boolean;
  };
  docsPolicy: {
    docsRefRequired: boolean;
    onboardingNotesRequired: boolean;
    actionPlanRequired: boolean;
  };
  safety: BrainCoreLocalAppSafety;
  nextSafeStep: string;
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

export interface BrainCoreCredentialEntry {
  key: string;
  label: string;
  type: 'app_id' | 'secret' | 'token' | 'board_id' | 'api_key' | 'url' | 'other';
  required: boolean;
  hint?: string;
  isSet: boolean;
  hasPlaceholder: boolean;
}

export interface BrainCoreCredentialPlatform {
  platformId: string;
  platformName: string;
  credentials: BrainCoreCredentialEntry[];
  allRequiredSet: boolean;
}

export interface BrainCoreCredentialListResponse {
  projectId: string;
  envFilePath: string;
  platforms: BrainCoreCredentialPlatform[];
  summary: {
    totalRequired: number;
    totalRequiredSet: number;
    totalOptional: number;
    totalOptionalSet: number;
  };
}

export interface BrainCoreCredentialSetResult {
  ok: boolean;
  projectId: string;
  key: string;
  action?: 'created' | 'updated';
  error?: string;
}

export interface BrainCoreCredentialRevokeResult {
  ok: boolean;
  projectId: string;
  key: string;
  action?: 'revoked';
  error?: string;
}

export interface BrainCoreInfraCredentialSetResult {
  ok: boolean;
  key: string;
  action?: 'created' | 'updated';
  error?: string;
}

export interface BrainCoreYouTubeOAuthUrlResult {
  ok: boolean;
  account: string;
  url?: string;
  error?: string;
}

export interface BrainCoreYouTubeOAuthExchangeResult {
  ok: boolean;
  account: string;
  error?: string;
}

export interface BrainCoreInfraCredentialEntry {
  key: string;
  label: string;
  type: 'app_id' | 'secret' | 'token' | 'board_id' | 'api_key' | 'url' | 'other';
  required: boolean;
  storage: 'env_file' | 'plist' | 'keychain';
  isSet: boolean;
  hasPlaceholder: boolean;
  hint?: string;
}

export interface BrainCoreInfraCredentialGroup {
  platformId: string;
  platformName: string;
  credentials: BrainCoreInfraCredentialEntry[];
  allRequiredSet: boolean;
}

export interface BrainCoreProjectCredentialEntry extends BrainCoreCredentialEntry {
  storage: 'env_file' | 'plist' | 'keychain';
}

export interface BrainCoreProjectCredentialPlatform {
  platformId: string;
  platformName: string;
  platformCategory: 'social' | 'infra';
  credentials: BrainCoreProjectCredentialEntry[];
  allRequiredSet: boolean;
}

export interface BrainCoreCredentialCatalogProject {
  projectId: string;
  displayName: string;
  envFilePath: string;
  platforms: BrainCoreProjectCredentialPlatform[];
}

export interface BrainCoreCredentialCatalogResponse {
  projects: BrainCoreCredentialCatalogProject[];
  infra: BrainCoreInfraCredentialGroup[];
  availablePlatforms: Array<{ platformId: string; platformName: string; platformCategory: 'social' | 'infra' }>;
}

export interface BrainCoreUserProjectEntry {
  projectId: string;
  displayName: string;
  repoPath: string;
  envFileName: string;
  platforms: string[];
}

export interface BrainCoreRegisterProjectResult {
  ok: boolean;
  projectId?: string;
  error?: string;
}

export interface BrainCoreDeleteProjectResult {
  ok: boolean;
  projectId?: string;
  error?: string;
}

export interface BrainCoreStbPipelineStatus {
  id: 'stb-pipeline-status';
  pipelineId: 'stb-daily-pipeline';
  projectId: 'says-the-bible';
  source: 'runtime-file' | 'static-registry' | 'unavailable';
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

export interface BrainCoreVideoIntakeSource {
  id: string;
  source: 'stb-fixture' | 'manual-fixture' | 'runtime-evidence';
  stbSlug?: string;
  title: string;
  durationTargetMinutes: number;
  platformTargets: string[];
  status: 'available' | 'blocked';
  evidence: string[];
}

export interface BrainCoreVideoIntakePlan {
  id: string;
  sourceId: string;
  projectId: string;
  title: string;
  status: 'preview-ready' | 'blocked';
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoOrchestratorIntakeResponse {
  id: 'video-orchestrator-intake';
  generatedAt: string;
  version: string;
  sources: BrainCoreVideoIntakeSource[];
  plans: BrainCoreVideoIntakePlan[];
  summary: {
    sourceCount: number;
    planCount: number;
    availableCount: number;
    blockedCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
}

export interface BrainCoreVideoResearchBrief {
  id: string;
  intakePlanId: string;
  sourceId: string;
  title: string;
  status: 'preview-ready' | 'blocked';
  generatedAt: string;
  theologicalTheme?: string;
  narrativeSummary?: string;
  researchedPassages: Array<{ book: string; chapter: number; verses: string; title?: string }>;
  keyBiblicalConcepts: string[];
  estimatedReadTime?: number;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
}

export interface BrainCoreVideoResearchQuestion {
  sequence: number;
  question: string;
  expectedAnswerLength: 'brief' | 'medium' | 'detailed';
  relatedPassages: string[];
}

export interface BrainCoreVideoResearchSource {
  id: string;
  type: 'bible-passage' | 'commentary' | 'theological-note';
  reference: string;
  summary: string;
  relevance: 'primary' | 'supporting' | 'contextual';
  stbEvidence?: { testedAt: string; matchesStbResearch: boolean };
}

export interface BrainCoreVideoOrchestratorResearchResponse {
  id: string;
  generatedAt: string;
  version: string;
  intakePlan: {
    id: string;
    title: string;
    durationTargetMinutes: number;
    platforms: string[];
  };
  researchBrief: BrainCoreVideoResearchBrief;
  questions: BrainCoreVideoResearchQuestion[];
  sources: BrainCoreVideoResearchSource[];
  summary: {
    passageCount: number;
    questionCount: number;
    sourceCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  validation?: {
    dualRunStatus: 'passed' | 'in-progress';
    stbResearchMatches: boolean;
    passageSelectionParity: number;
    testedAt?: string;
  };
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoResearchListResponse {
  id: 'video-orchestrator-research';
  generatedAt: string;
  version: string;
  briefs: BrainCoreVideoResearchBrief[];
  summary: {
    total: number;
    readyCount: number;
    blockedCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
}

export interface BrainCoreVideoScriptSection {
  sequence: number;
  name: string;
  contentType: 'narration' | 'passage' | 'visual-cue' | 'transition';
  estimatedDurationSeconds: number;
  keyPoints: string[];
  sampleNarration?: string;
}

export interface BrainCoreVideoScriptOutline {
  id: string;
  intakePlanId: string;
  researchId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'generated' | 'blocked';
  sections: BrainCoreVideoScriptSection[];
  totalEstimatedSeconds: number;
  formatConfirm: boolean;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoScriptNarrationSection {
  sequence: number;
  sectionName: string;
  type: 'intro' | 'body' | 'passage' | 'application' | 'outro';
  narration: string;
  passageReference?: { book: string; chapter: number; verses: string; text?: string };
  timingNotes?: string;
  visualCues?: string[];
}

export interface BrainCoreVideoScriptDraft {
  id: string;
  intakePlanId: string;
  outlineId: string;
  researchId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'generated' | 'blocked';
  sections: BrainCoreVideoScriptNarrationSection[];
  metadata: {
    wordCount: number;
    estimatedNarrationMinutes: number;
    tone: 'devotional' | 'educational' | 'story' | 'mixed';
    targetAudience: 'bedtime-story' | 'family' | 'faith-focused';
    speakerNotes: string;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoScriptPlan {
  id: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'available' | 'blocked';
  outline: BrainCoreVideoScriptOutline;
  draft: BrainCoreVideoScriptDraft;
  nextStage: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  blockers: string[];
}

export interface BrainCoreVideoScriptResponse {
  id: string;
  generatedAt: string;
  version: string;
  type: 'outline' | 'draft' | 'plan';
  intakePlan: {
    id: string;
    title: string;
    durationTargetMinutes: number;
    platforms: string[];
  };
  outline?: BrainCoreVideoScriptOutline;
  draft?: BrainCoreVideoScriptDraft;
  plan?: BrainCoreVideoScriptPlan;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoScriptListResponse {
  id: 'video-orchestrator-script';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoScriptPlan[];
  summary: {
    total: number;
    availableCount: number;
    blockedCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
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
    readOnly: true;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssetPlan {
  id: string;
  intakePlanId: string;
  researchId?: string;
  scriptId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  requirements: BrainCoreVideoAssetRequirement[];
  summary: {
    totalRequirements: number;
    thumbnailCount: number;
    sceneVisualCount: number;
    platformDerivativeCount: number;
    blockedCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssetPlanListResponse {
  id: 'video-orchestrator-asset-plan';
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssetPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoAssetPlan;
  upstream: {
    intakePlanId: string;
    researchId?: string;
    scriptId?: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoDesignPlanSummary {
  totalSpecs: number;
  plannedCount: number;
  blockedCount: number;
  platformLayoutCount: number;
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
  summary: BrainCoreVideoDesignPlanSummary;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoDesignPlanListResponse {
  id: 'video-orchestrator-design-plan';
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVoiceoverPlanSummary {
  totalSegments: number;
  plannedCount: number;
  blockedCount: number;
  estimatedDurationSeconds: number;
  estimatedDurationMinutes: number;
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
  summary: BrainCoreVideoVoiceoverPlanSummary;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVoiceoverPlanListResponse {
  id: 'video-orchestrator-voiceover-plan';
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
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
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlatformItem {
  id: string;
  platform: 'youtube' | 'facebook' | 'pinterest' | 'blog' | 'generic';
  status: 'planned' | 'blocked';
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  tagPlaceholders: string[];
  categoryPlaceholder?: string;
  locale: string;
  requiredAssets: string[];
  complianceChecklist: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlan {
  id: string;
  intakePlanId: string;
  researchId?: string;
  scriptPlanId?: string;
  assetPlanId?: string;
  assemblyPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  platforms: BrainCoreVideoMetadataPlatformItem[];
  summary: {
    totalPlatforms: number;
    plannedCount: number;
    blockedCount: number;
    requiredAssetCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlanListResponse {
  id: 'video-orchestrator-metadata-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoMetadataPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalPlatformItems: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoMetadataPlan;
  upstream: {
    researchId?: string;
    scriptPlanId?: string;
    assetPlanId?: string;
    assemblyPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepChecklistItem {
  id: string;
  label: string;
  status: 'planned' | 'blocked' | 'missing';
  category: 'metadata' | 'asset' | 'assembly' | 'policy' | 'platform' | 'manual-review';
  placeholder: string;
  blockers: string[];
  safety: {
    readOnly: true;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlatform {
  id: string;
  platform: 'youtube' | 'facebook' | 'pinterest' | 'blog' | 'generic';
  status: 'planned' | 'blocked';
  checklist: BrainCoreVideoPublishingPrepChecklistItem[];
  requiredArtifactRefs: string[];
  requiredMetadataRefs: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlan {
  id: string;
  intakePlanId: string;
  metadataPlanId?: string;
  assemblyPlanId?: string;
  assetPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  platforms: BrainCoreVideoPublishingPrepPlatform[];
  summary: {
    totalPlatforms: number;
    plannedCount: number;
    blockedCount: number;
    checklistItemCount: number;
    missingItemCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlanListResponse {
  id: 'video-orchestrator-publishing-prep';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoPublishingPrepPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalPlatforms: number;
    totalChecklistItems: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoPublishingPrepPlan;
  upstream: {
    metadataPlanId?: string;
    assemblyPlanId?: string;
    assetPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackageItem {
  id: string;
  label: string;
  kind: 'metadata-bundle' | 'asset-reference' | 'assembly-reference' | 'publishing-checklist' | 'manual-review' | 'platform-note' | 'validation-note';
  status: 'planned' | 'blocked' | 'missing';
  placeholder: string;
  sourceRef?: string;
  blockers: string[];
  safety: {
    readOnly: true;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackage {
  id: string;
  intakePlanId: string;
  publishingPrepPlanId?: string;
  metadataPlanId?: string;
  assemblyPlanId?: string;
  assetPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  items: BrainCoreVideoManualExportPackageItem[];
  summary: {
    totalItems: number;
    plannedCount: number;
    blockedCount: number;
    missingCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackageListResponse {
  id: 'video-orchestrator-manual-export-package';
  generatedAt: string;
  version: string;
  packages: BrainCoreVideoManualExportPackage[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalItems: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackageDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  package: BrainCoreVideoManualExportPackage;
  upstream: {
    publishingPrepPlanId?: string;
    metadataPlanId?: string;
    assemblyPlanId?: string;
    assetPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoParityMatrixEntry {
  id: string;
  stbStage: string;
  stbStageIndex: number;
  videoModule: string;
  videoModuleIndex: number;
  status: 'mapped' | 'partial' | 'planned' | 'blocked';
  deterministic: boolean;
  skipCondition?: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  validationStatus: 'not-tested' | 'preview-only' | 'tested' | 'blocked';
  validationEvidence?: string[];
  blockerReason?: string;
}

export interface BrainCoreStbVideoParityMatrix {
  id: 'stb-video-parity-matrix';
  generatedAt: string;
  version: string;
  sourcePipelineId: 'stb-daily-pipeline';
  targetPipelineId: 'video-upload-pipeline';
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
  risksAndMitigations: Array<{ risk: string; mitigation: string; priority: 'critical' | 'high' | 'medium' | 'low' }>;
  nextSteps: string[];
}

export interface BrainCoreStbVideoDualRunValidation {
  entryId: string;
  stbStage: string;
  videoModule: string;
  status: 'not-started' | 'in-progress' | 'passed' | 'failed' | 'blocked';
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
  sourcePipelineId: 'stb-daily-pipeline';
  targetPipelineId: 'video-upload-pipeline';
  executesStb: boolean;
  executesVideo: boolean;
  status: 'not-started' | 'in-progress' | 'partial-passed' | 'ready' | 'blocked' | 'decommissioned';
  health: BrainCoreHealth;
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

export interface BrainCoreStbVideoDualRunEvidenceItem {
  id: string;
  label: string;
  source: 'stb-status' | 'stb-parity' | 'video-planning' | 'manual-export-package' | 'runtime-status' | 'fixture';
  status: 'available' | 'missing' | 'blocked';
  value: string;
  blockers: string[];
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoDualRunEvidenceStage {
  id: string;
  stage: 'intake' | 'research' | 'script' | 'asset-plan' | 'design-plan' | 'voiceover-plan' | 'visuals-plan' | 'assembly-plan' | 'metadata-plan' | 'publishing-prep' | 'manual-export-package';
  status: 'evidence-available' | 'evidence-partial' | 'blocked' | 'missing';
  stbEvidence: BrainCoreStbVideoDualRunEvidenceItem[];
  videoEvidence: BrainCoreStbVideoDualRunEvidenceItem[];
  comparison: {
    hasStbEvidence: boolean;
    hasVideoEvidence: boolean;
    parityReady: boolean;
    notes: string[];
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoDualRunEvidenceReport {
  id: 'stb-video-dual-run-evidence';
  generatedAt: string;
  status: 'not-ready' | 'evidence-partial' | 'candidate-ready' | 'blocked';
  stages: BrainCoreStbVideoDualRunEvidenceStage[];
  summary: {
    totalStages: number;
    evidenceAvailableCount: number;
    partialCount: number;
    blockedCount: number;
    missingCount: number;
    parityReadyCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoDualRunEvidenceResponse {
  evidence: BrainCoreStbVideoDualRunEvidenceReport;
}

export interface BrainCoreVideoProductionGateItem {
  id: string;
  label: string;
  category: 'planning-chain' | 'dual-run-evidence' | 'rendering-export' | 'publishing-platform' | 'safety-approval';
  status: 'ready' | 'blocked' | 'in-progress';
  severity: 'critical' | 'high' | 'medium' | 'info';
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    exportsArtifact: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoProductionGateSection {
  id: string;
  label: string;
  category: 'planning-chain' | 'dual-run-evidence' | 'rendering-export' | 'publishing-platform' | 'safety-approval';
  items: BrainCoreVideoProductionGateItem[];
  summary: {
    total: number;
    ready: number;
    blocked: number;
    inProgress: number;
  };
  blockerReason?: string;
}

export interface BrainCoreVideoProductionGateChecklist {
  id: 'video-production-gate';
  generatedAt: string;
  status: 'ready' | 'in-progress' | 'blocked' | 'not-ready';
  readinessPercent: number;
  sections: BrainCoreVideoProductionGateSection[];
  summary: {
    totalItems: number;
    readyItems: number;
    blockedItems: number;
    inProgressItems: number;
  };
  blockers: string[];
  criticalBlockers: string[];
  nextSafeStep: string;
  requiredApprovals: string[];
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    exportsArtifact: false;
    publishesContent: false;
    decommissionsStb: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoProductionGateResponse {
  gate: BrainCoreVideoProductionGateChecklist;
}

export interface BrainCoreControlledDualRunRequestRequirement {
  id: string;
  label: string;
  category: 'candidate' | 'preflight' | 'approval' | 'rollback' | 'evidence' | 'execution-policy' | 'safety';
  status: 'satisfied' | 'blocked' | 'missing' | 'not-applicable';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreControlledDualRunRequestLifecycleStep {
  id: string;
  sequence: number;
  label: string;
  status: 'planned' | 'blocked';
  description: string;
  requiredBeforeExecution: boolean;
  blockers: string[];
  safety: {
    readOnly: true;
    createsApproval: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreControlledDualRunRequestDesign {
  id: 'controlled-dual-run-request-design';
  generatedAt: string;
  status: 'design-only' | 'blocked' | 'ready-for-policy-review';
  canRequestApproval: false;
  canExecute: false;
  requirements: BrainCoreControlledDualRunRequestRequirement[];
  lifecycle: BrainCoreControlledDualRunRequestLifecycleStep[];
  summary: {
    totalRequirements: number;
    satisfiedCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    executableActionRegistered: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreControlledDualRunRequestDesignResponse {
  design: BrainCoreControlledDualRunRequestDesign;
}

export interface BrainCoreVideoRenderExportPolicyItem {
  id: string;
  label: string;
  category:
    | 'rendering'
    | 'export'
    | 'artifact'
    | 'sandbox'
    | 'output-path'
    | 'approval'
    | 'cleanup'
    | 'rollback'
    | 'safety';
  status: 'satisfied' | 'blocked' | 'missing' | 'not-applicable';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    rendersVideo: false;
    callsFfmpeg: false;
    writesFiles: false;
    createsDownload: false;
    createsApproval: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoRenderExportPolicySection {
  id: string;
  title: string;
  status: 'passed' | 'blocked' | 'missing' | 'partial';
  items: BrainCoreVideoRenderExportPolicyItem[];
  summary: {
    total: number;
    satisfied: number;
    blocked: number;
    missing: number;
  };
}

export interface BrainCoreVideoRenderExportPolicy {
  id: 'video-orchestrator-render-export-policy';
  generatedAt: string;
  status: 'policy-only' | 'blocked' | 'ready-for-review';
  canRender: false;
  canExport: false;
  executableActionRegistered: false;
  sections: BrainCoreVideoRenderExportPolicySection[];
  summary: {
    totalItems: number;
    satisfiedCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    rendersVideo: false;
    callsFfmpeg: false;
    writesFiles: false;
    createsDownload: false;
    createsApproval: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoRenderExportPolicyResponse {
  policy: BrainCoreVideoRenderExportPolicy;
}

export interface BrainCoreVideoApprovalPolicyRequirement {
  id: string;
  label: string;
  category: 'operator-approval' | 'durable-audit' | 'rollback' | 'scope' | 'evidence' | 'execution-gate' | 'safety';
  status: 'satisfied' | 'blocked' | 'missing' | 'not-applicable';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoApprovalPolicyLifecycleStep {
  id: string;
  sequence: number;
  label: string;
  status: 'planned' | 'blocked';
  requiredBeforeExecution: boolean;
  blockers: string[];
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoApprovalPolicyDesign {
  id: 'video-orchestrator-approval-policy-design';
  generatedAt: string;
  status: 'policy-only' | 'blocked' | 'ready-for-review';
  canCreateApproval: false;
  canRegisterAction: false;
  canExecute: false;
  requirements: BrainCoreVideoApprovalPolicyRequirement[];
  lifecycle: BrainCoreVideoApprovalPolicyLifecycleStep[];
  summary: {
    totalRequirements: number;
    satisfiedCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    executableActionRegistered: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoApprovalPolicyDesignResponse {
  policy: BrainCoreVideoApprovalPolicyDesign;
}

export interface BrainCoreVideoArtifactSandboxPolicyItem {
  id: string;
  label: string;
  category:
    | 'allowed-artifact'
    | 'blocked-artifact'
    | 'storage-boundary'
    | 'output-path'
    | 'retention-cleanup'
    | 'validation'
    | 'safety';
  status: 'defined' | 'blocked' | 'missing' | 'not-applicable';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsDirectory: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    createsDownload: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoArtifactSandboxBoundary {
  id: string;
  label: string;
  scope: 'repo-local-placeholder' | 'runtime-placeholder' | 'operator-provided' | 'blocked';
  status: 'planned' | 'blocked';
  allowedArtifactKinds: string[];
  blockedArtifactKinds: string[];
  pathPolicy: {
    allowedRootPlaceholder: string;
    requiresRelativePaths: true;
    forbidsTraversal: true;
    forbidsAbsolutePaths: true;
    validatesExtensions: true;
  };
  blockers: string[];
  safety: {
    readOnly: true;
    createsDirectory: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    createsDownload: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoArtifactSandboxDesign {
  id: 'video-orchestrator-artifact-sandbox-design';
  generatedAt: string;
  status: 'design-only' | 'blocked' | 'ready-for-review';
  canCreateSandbox: false;
  canWriteFiles: false;
  canCleanup: false;
  executableActionRegistered: false;
  policyItems: BrainCoreVideoArtifactSandboxPolicyItem[];
  boundaries: BrainCoreVideoArtifactSandboxBoundary[];
  summary: {
    totalPolicyItems: number;
    definedCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
    boundaryCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsDirectory: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    createsDownload: false;
    createsApproval: false;
    executableActionRegistered: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoArtifactSandboxDesignResponse {
  sandbox: BrainCoreVideoArtifactSandboxDesign;
}

export interface BrainCoreVideoControlledDryRunStep {
  id: string;
  sequence: number;
  label: string;
  stage: 'candidate' | 'preflight' | 'stb-read' | 'video-plan-read' | 'comparison-preview' | 'evidence-preview' | 'operator-review';
  status: 'planned' | 'blocked';
  requiredBeforeExecution: boolean;
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    writesFiles: false;
    createsApproval: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledDryRunDesign {
  id: 'video-orchestrator-controlled-dry-run-design';
  generatedAt: string;
  status: 'design-only' | 'blocked' | 'ready-for-review';
  canExecuteDryRun: false;
  canReadStbOutputs: false;
  canReadVideoOutputs: false;
  canWriteEvidence: false;
  executableActionRegistered: false;
  steps: BrainCoreVideoControlledDryRunStep[];
  summary: {
    totalSteps: number;
    plannedCount: number;
    blockedCount: number;
    requiredBeforeExecutionCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    callsFfmpeg: false;
    writesFiles: false;
    createsApproval: false;
    executableActionRegistered: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledDryRunDesignResponse {
  dryRun: BrainCoreVideoControlledDryRunDesign;
}

export interface BrainCoreVideoRollbackCleanupChecklistItem {
  id: string;
  label: string;
  category: 'rollback' | 'cleanup' | 'retention' | 'audit' | 'operator-review' | 'safety';
  status: 'planned' | 'blocked' | 'missing' | 'not-applicable';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    deletesFiles: false;
    writesFiles: false;
    executesCleanup: false;
    executesRollback: false;
    createsApproval: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoRollbackCleanupChecklist {
  id: 'video-orchestrator-rollback-cleanup-checklist';
  generatedAt: string;
  status: 'checklist-only' | 'blocked' | 'ready-for-review';
  canRollback: false;
  canCleanup: false;
  canDeleteFiles: false;
  executableActionRegistered: false;
  items: BrainCoreVideoRollbackCleanupChecklistItem[];
  summary: {
    totalItems: number;
    plannedCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    deletesFiles: false;
    writesFiles: false;
    executesCleanup: false;
    executesRollback: false;
    createsApproval: false;
    executableActionRegistered: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoRollbackCleanupChecklistResponse {
  checklist: BrainCoreVideoRollbackCleanupChecklist;
}

export interface BrainCoreVideoComparisonSchemaField {
  id: string;
  label: string;
  category: 'metadata' | 'script' | 'timing' | 'visuals' | 'audio' | 'publishing' | 'safety';
  status: 'defined' | 'blocked' | 'missing' | 'not-applicable';
  comparisonMode: 'exact' | 'semantic' | 'range' | 'manual-review' | 'not-available';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    readsGeneratedArtifacts: false;
    executesComparison: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsApproval: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoComparisonSchemaDesign {
  id: 'video-orchestrator-comparison-schema-design';
  generatedAt: string;
  status: 'schema-only' | 'blocked' | 'ready-for-review';
  canCompareOutputs: false;
  canReadGeneratedArtifacts: false;
  canWriteEvidence: false;
  executableActionRegistered: false;
  fields: BrainCoreVideoComparisonSchemaField[];
  summary: {
    totalFields: number;
    definedCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    readsGeneratedArtifacts: false;
    executesComparison: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsApproval: false;
    executableActionRegistered: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoComparisonSchemaDesignResponse {
  schema: BrainCoreVideoComparisonSchemaDesign;
}

export interface BrainCoreVideoFixtureComparisonPreviewItem {
  id: string;
  schemaFieldId: string;
  label: string;
  status: 'preview-available' | 'blocked' | 'not-applicable';
  fixtureSource: 'planning-fixture' | 'stb-evidence-summary' | 'video-plan-summary' | 'none';
  comparisonMode: 'exact' | 'semantic' | 'range' | 'manual-review' | 'not-available';
  previewResult: 'matches-fixture' | 'requires-manual-review' | 'blocked' | 'not-run';
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    comparesRealOutputs: false;
    readsGeneratedArtifacts: false;
    executesStb: false;
    executesVideo: false;
    writesEvidence: false;
    createsApproval: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoFixtureComparisonPreview {
  id: 'video-orchestrator-fixture-comparison-preview';
  generatedAt: string;
  status: 'preview-only' | 'blocked' | 'ready-for-review';
  canCompareRealOutputs: false;
  canReadGeneratedArtifacts: false;
  canWriteEvidence: false;
  executableActionRegistered: false;
  items: BrainCoreVideoFixtureComparisonPreviewItem[];
  summary: {
    totalItems: number;
    previewAvailableCount: number;
    blockedCount: number;
    manualReviewCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    comparesRealOutputs: false;
    readsGeneratedArtifacts: false;
    executesStb: false;
    executesVideo: false;
    writesEvidence: false;
    createsApproval: false;
    executableActionRegistered: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoFixtureComparisonPreviewResponse {
  preview: BrainCoreVideoFixtureComparisonPreview;
}

export interface BrainCoreVideoProductionCutoverGateItem {
  id: string;
  label: string;
  category: 'planning-chain' | 'dual-run' | 'comparison' | 'approval' | 'rollback' | 'publishing' | 'decommission' | 'safety';
  status: 'passed' | 'blocked' | 'missing' | 'not-applicable';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    marksProductionReady: false;
    switchesTraffic: false;
    decommissionsStb: false;
    executesStb: false;
    executesVideo: false;
    publishesContent: false;
    createsApproval: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoProductionCutoverGate {
  id: 'video-orchestrator-production-cutover-gate';
  generatedAt: string;
  status: 'gate-only' | 'blocked' | 'ready-for-review';
  canCutover: false;
  canMarkProductionReady: false;
  canDecommissionStb: false;
  executableActionRegistered: false;
  items: BrainCoreVideoProductionCutoverGateItem[];
  summary: {
    totalItems: number;
    passedCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    marksProductionReady: false;
    switchesTraffic: false;
    decommissionsStb: false;
    executesStb: false;
    executesVideo: false;
    publishesContent: false;
    createsApproval: false;
    executableActionRegistered: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoProductionCutoverGateResponse {
  gate: BrainCoreVideoProductionCutoverGate;
}

export interface BrainCoreVideoReleaseCandidateReadinessItem {
  id: string;
  label: string;
  status: 'ready' | 'blocked' | 'missing';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    marksReleaseCandidate: false;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    publishesContent: false;
    createsApproval: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoReleaseCandidateReadinessSnapshot {
  id: 'video-orchestrator-release-candidate-readiness';
  generatedAt: string;
  status: 'snapshot-only' | 'blocked' | 'ready-for-review';
  readinessPercent: number;
  canMarkReleaseCandidate: false;
  executableActionRegistered: false;
  items: BrainCoreVideoReleaseCandidateReadinessItem[];
  summary: {
    totalItems: number;
    readyCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    marksReleaseCandidate: false;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    publishesContent: false;
    createsApproval: false;
    executableActionRegistered: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoReleaseCandidateReadinessResponse {
  snapshot: BrainCoreVideoReleaseCandidateReadinessSnapshot;
}

export interface BrainCoreVideoOperatorDecisionQueueItem {
  id: string;
  label: string;
  category:
    | 'candidate-selection'
    | 'rollback-cleanup'
    | 'artifact-sandbox'
    | 'comparison-schema'
    | 'release-candidate'
    | 'controlled-execution';
  status: 'decision-required' | 'blocked' | 'not-ready';
  priority: 'high' | 'medium' | 'low';
  requiredBeforeExecution: true;
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoOperatorDecisionQueue {
  id: 'video-orchestrator-operator-decision-queue';
  generatedAt: string;
  status: 'queue-only' | 'blocked';
  canCreateApproval: false;
  executableActionRegistered: false;
  decisions: BrainCoreVideoOperatorDecisionQueueItem[];
  summary: {
    totalDecisions: number;
    decisionRequiredCount: number;
    blockedCount: number;
    highPriorityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoOperatorDecisionQueueResponse {
  queue: BrainCoreVideoOperatorDecisionQueue;
}

export interface BrainCoreVideoControlledExecutionPolicyBoundaryItem {
  id: string;
  label: string;
  category:
    | 'action-registration'
    | 'approval-execution'
    | 'runtime-isolation'
    | 'artifact-write'
    | 'platform-publishing'
    | 'stb-decommission'
    | 'human-decision';
  status: 'blocked' | 'missing' | 'not-applicable';
  severity: 'blocking' | 'warning' | 'info';
  mustBeTrueBeforeAllowed: string[];
  currentBlockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    canRegisterAction: false;
    canCreateApproval: false;
    canExecute: false;
    canWriteFiles: false;
    canPublish: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPolicyBoundary {
  id: 'video-orchestrator-controlled-execution-policy-boundary';
  generatedAt: string;
  status: 'boundary-only' | 'blocked';
  canRegisterAction: false;
  canCreateApproval: false;
  canExecute: false;
  canWriteFiles: false;
  canPublish: false;
  canDecommissionStb: false;
  sections: BrainCoreVideoControlledExecutionPolicyBoundaryItem[];
  summary: {
    totalSections: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    canRegisterAction: false;
    canCreateApproval: false;
    canExecute: false;
    canWriteFiles: false;
    canPublish: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPolicyBoundaryResponse {
  boundary: BrainCoreVideoControlledExecutionPolicyBoundary;
}

export interface BrainCoreVideoControlledExecutionReadinessIndexItem {
  id: string;
  label: string;
  category:
    | 'production-gate'
    | 'execution-boundary'
    | 'operator-decision'
    | 'release-candidate'
    | 'cutover'
    | 'rollback'
    | 'artifact-sandbox'
    | 'comparison'
    | 'render-export'
    | 'approval-policy'
    | 'safety';
  status: 'ready' | 'blocked' | 'missing' | 'not-applicable';
  severity: 'info' | 'warning' | 'blocking';
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    canExecute: false;
    canRegisterAction: false;
    canCreateApproval: false;
    canRender: false;
    canExport: false;
    canPublish: false;
    canMarkReleaseCandidate: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionReadinessIndex {
  id: 'video-orchestrator-controlled-execution-readiness-index';
  generatedAt: string;
  status: 'blocked' | 'design-only' | 'ready-for-review';
  readinessPercent: number;
  canExecute: false;
  canRegisterAction: false;
  canCreateApproval: false;
  canRender: false;
  canExport: false;
  canPublish: false;
  canMarkReleaseCandidate: false;
  canDecommissionStb: false;
  executableActionRegistered: false;
  items: BrainCoreVideoControlledExecutionReadinessIndexItem[];
  summary: {
    totalItems: number;
    readyCount: number;
    blockedCount: number;
    missingCount: number;
    blockingSeverityCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    canExecute: false;
    canRegisterAction: false;
    canCreateApproval: false;
    canRender: false;
    canExport: false;
    canPublish: false;
    canMarkReleaseCandidate: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionReadinessIndexResponse {
  index: BrainCoreVideoControlledExecutionReadinessIndex;
}

export interface BrainCoreVideoRoadmapCheckpointPhase {
  id: string;
  label: string;
  group:
    | 'planning-chain'
    | 'policy-gates'
    | 'console-visibility'
    | 'operator-review'
    | 'future-execution'
    | 'production';
  status: 'complete' | 'blocked' | 'planned' | 'requires-approval';
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    createsApproval: false;
    registersAction: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoRoadmapCheckpoint {
  id: 'video-orchestrator-roadmap-checkpoint';
  generatedAt: string;
  status: 'checkpoint-only' | 'blocked' | 'ready-for-review';
  completedPhaseCount: number;
  blockedPhaseCount: number;
  approvalRequiredCount: number;
  phases: BrainCoreVideoRoadmapCheckpointPhase[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    createsApproval: false;
    registersAction: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoRoadmapCheckpointResponse {
  checkpoint: BrainCoreVideoRoadmapCheckpoint;
}

export interface BrainCoreVideoOperatorReviewPacketSection {
  id: string;
  label: string;
  status: 'included' | 'blocked' | 'missing';
  sourceEndpoint: string;
  summary: string;
  blockers: string[];
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoOperatorReviewPacket {
  id: 'video-orchestrator-operator-review-packet';
  generatedAt: string;
  status: 'review-packet-only' | 'blocked' | 'ready-for-review';
  canCreateApproval: false;
  canExecute: false;
  canMarkReviewed: false;
  sections: BrainCoreVideoOperatorReviewPacketSection[];
  summary: {
    totalSections: number;
    includedCount: number;
    blockedCount: number;
    missingCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoOperatorReviewPacketResponse {
  packet: BrainCoreVideoOperatorReviewPacket;
}

export interface BrainCoreVideoPreviewCompletionIndexItem {
  id: string;
  label: string;
  category: 'planning' | 'policy' | 'dashboard' | 'review' | 'execution-blocker' | 'production-blocker' | 'safety';
  status: 'complete' | 'blocked' | 'requires-approval';
  evidence: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    createsApproval: false;
    registersAction: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPreviewCompletionIndex {
  id: 'video-orchestrator-preview-completion-index';
  generatedAt: string;
  status: 'preview-complete' | 'execution-blocked';
  previewComplete: true;
  executionBlocked: true;
  readinessPercent: number;
  items: BrainCoreVideoPreviewCompletionIndexItem[];
  summary: {
    totalItems: number;
    completeCount: number;
    blockedCount: number;
    approvalRequiredCount: number;
  };
  blockers: string[];
  nextMacroPhase: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    createsApproval: false;
    registersAction: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPreviewCompletionIndexResponse {
  index: BrainCoreVideoPreviewCompletionIndex;
}

export interface BrainCoreVideoControlledExecutionPreflightChecklistItem {
  id: string;
  label: string;
  status: 'blocked' | 'missing' | 'planned' | 'not-applicable';
  evidence: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    canPassPreflight: false;
    canCreateApproval: false;
    canRegisterAction: false;
    canExecute: false;
    canWriteFiles: false;
    canPublish: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPreflightChecklist {
  id: 'video-orchestrator-controlled-execution-preflight-checklist';
  generatedAt: string;
  status: 'blocked' | 'ready-for-review';
  canPassPreflight: false;
  canCreateApproval: false;
  canRegisterAction: false;
  canExecute: false;
  canWriteFiles: false;
  canPublish: false;
  canDecommissionStb: false;
  items: BrainCoreVideoControlledExecutionPreflightChecklistItem[];
  summary: {
    totalItems: number;
    blockedCount: number;
    missingCount: number;
    plannedCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    canPassPreflight: false;
    canCreateApproval: false;
    canRegisterAction: false;
    canExecute: false;
    canWriteFiles: false;
    canPublish: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPreflightChecklistResponse {
  checklist: BrainCoreVideoControlledExecutionPreflightChecklist;
}

export interface BrainCoreVideoControlledExecutionRiskItem {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'blocking';
  likelihood: 'low' | 'medium' | 'high';
  category:
    | 'stb-mutation'
    | 'file-write'
    | 'cleanup'
    | 'approval'
    | 'platform-posting'
    | 'model-drift'
    | 'process-failure'
    | 'comparison'
    | 'rollback'
    | 'operator-confusion';
  status: 'blocked' | 'watch' | 'planned';
  mitigations: string[];
  blockers: string[];
  owner: 'operator' | 'system' | 'future-policy';
  safety: {
    readOnly: true;
    canAcceptRisk: false;
    canExecuteMitigation: false;
    canCreateApproval: false;
    canRegisterAction: false;
    canExecute: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionRiskRegister {
  id: 'video-orchestrator-controlled-execution-risk-register';
  generatedAt: string;
  status: 'blocked' | 'ready-for-review';
  canAcceptRisk: false;
  canExecuteMitigation: false;
  risks: BrainCoreVideoControlledExecutionRiskItem[];
  summary: {
    totalRisks: number;
    blockingCount: number;
    highCount: number;
    mediumCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    canAcceptRisk: false;
    canExecuteMitigation: false;
    canCreateApproval: false;
    canRegisterAction: false;
    canExecute: false;
    canDecommissionStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionRiskRegisterResponse {
  register: BrainCoreVideoControlledExecutionRiskRegister;
}

export interface BrainCoreVideoControlledExecutionApprovalPayloadField {
  id: string;
  label: string;
  required: boolean;
  status: 'defined' | 'blocked' | 'missing';
  fieldType:
    | 'string'
    | 'boolean'
    | 'enum'
    | 'array'
    | 'object'
    | 'timestamp'
    | 'evidence-reference'
    | 'operator-decision-reference';
  description: string;
  allowedValues?: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionApprovalPayloadSection {
  id: string;
  label: string;
  status: 'defined' | 'blocked' | 'missing';
  fields: BrainCoreVideoControlledExecutionApprovalPayloadField[];
  blockers: string[];
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionApprovalPayloadSchema {
  id: 'video-orchestrator-controlled-execution-approval-payload-schema';
  generatedAt: string;
  status: 'schema-only' | 'blocked' | 'ready-for-review';
  canCreateApproval: false;
  canRegisterAction: false;
  canExecute: false;
  sections: BrainCoreVideoControlledExecutionApprovalPayloadSection[];
  summary: {
    totalSections: number;
    totalFields: number;
    requiredFieldCount: number;
    blockedFieldCount: number;
    missingFieldCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionApprovalPayloadSchemaResponse {
  schema: BrainCoreVideoControlledExecutionApprovalPayloadSchema;
}

export interface BrainCoreVideoControlledExecutionPreflightValidationRule {
  id: string;
  label: string;
  category:
    | 'candidate'
    | 'approval-payload'
    | 'operator-decision'
    | 'sandbox'
    | 'rollback'
    | 'comparison'
    | 'risk'
    | 'safety'
    | 'execution-boundary';
  status: 'defined' | 'blocked' | 'missing';
  severity: 'info' | 'warning' | 'blocking';
  dataSources: string[];
  failureCodes: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    runsValidator: false;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPreflightFailureCode {
  code: string;
  label: string;
  severity: 'warning' | 'blocking';
  description: string;
  remediation: string;
  safety: {
    readOnly: true;
    runsValidator: false;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPreflightValidatorSchema {
  id: 'video-orchestrator-controlled-execution-preflight-validator-schema';
  generatedAt: string;
  status: 'schema-only' | 'blocked' | 'ready-for-review';
  canRunValidator: false;
  canCreateApproval: false;
  canRegisterAction: false;
  canExecute: false;
  rules: BrainCoreVideoControlledExecutionPreflightValidationRule[];
  failureCodes: BrainCoreVideoControlledExecutionPreflightFailureCode[];
  summary: {
    totalRules: number;
    definedRules: number;
    blockedRules: number;
    missingRules: number;
    failureCodeCount: number;
    blockingFailureCodeCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    runsValidator: false;
    createsApproval: false;
    registersAction: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPreflightValidatorSchemaResponse {
  schema: BrainCoreVideoControlledExecutionPreflightValidatorSchema;
}

export interface BrainCoreVideoControlledExecutionPlanStubCandidateScope {
  scopeType: 'single-story-only';
  candidateStoryId?: string;
  sourceEpisodeId?: string;
  approvedCandidatePresent: false;
}

export interface BrainCoreVideoControlledExecutionPlanStubStep {
  id: string;
  label: string;
  status: 'blocked' | 'planned' | 'not-applicable';
  description: string;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoControlledExecutionPlanStub {
  id: 'video-orchestrator-controlled-execution-plan-stub';
  generatedAt: string;
  version: string;
  status: 'blocked' | 'disabled';
  createsExecutionPlan: false;
  executionPlanExecutable: false;
  candidateScope: BrainCoreVideoControlledExecutionPlanStubCandidateScope;
  planSteps: BrainCoreVideoControlledExecutionPlanStubStep[];
  requiredInputs: string[];
  missingInputs: string[];
  evidenceReferences: string[];
  blockers: string[];
  summary: {
    totalSteps: number;
    plannedSteps: number;
    blockedSteps: number;
    missingInputs: number;
    requiredInputs: number;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    createsApproval: false;
    registersAction: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPlanStubResponse {
  plan: BrainCoreVideoControlledExecutionPlanStub;
}

export interface BrainCoreVideoControlledExecutionApprovalRequestDesign {
  id: 'video-orchestrator-controlled-execution-approval-request-design';
  generatedAt: string;
  version: 'phase-5e';
  status: 'blocked' | 'disabled';
  approvalRequestEnabled: false;
  createsApproval: false;
  registersAction: false;
  executable: false;
  summary: {
    totalRequiredPreconditions: number;
    missingPreconditionsCount: number;
    blockerCount: number;
  };
  requestShape: {
    candidateStoryId: string;
    sourceEpisodeId: string;
    scopeType: 'single-story-only';
    selectedDecisionIds: string[];
    evidenceReferences: string[];
    requestedBy: string;
    expiresAt: string;
    rollbackRequirement: string;
    dryRunOnly: boolean;
  };
  requiredPreconditions: string[];
  missingPreconditions: string[];
  blockers: string[];
  evidenceReferences: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    approvalRequestOnly: true;
    createsApproval: false;
    registersAction: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionApprovalRequestDesignResponse {
  design: BrainCoreVideoControlledExecutionApprovalRequestDesign;
}

export interface BrainCoreVideoControlledExecutionDisabledGate {
  id: 'video-orchestrator-controlled-execution-disabled-gate';
  generatedAt: string;
  version: 'phase-5f';
  status: 'blocked' | 'disabled';
  executionEnabled: false;
  secondApprovalRequired: true;
  secondApprovalPolicyExists: false;
  executable: false;
  summary: {
    gateCount: number;
    disabledReasonCount: number;
    requiredBeforeExecutionCount: number;
    blockerCount: number;
  };
  gateChain: string[];
  disabledReasons: string[];
  requiredBeforeExecution: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    approvalRequestOnly: false;
    createsApproval: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    requiresSecondApproval: true;
    secondApprovalPolicyExists: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionDisabledGateResponse {
  gate: BrainCoreVideoControlledExecutionDisabledGate;
}

export interface BrainCoreVideoControlledExecutionSecondApprovalPolicy {
  id: 'video-orchestrator-controlled-execution-second-approval-policy';
  generatedAt: string;
  version: 'phase-5g';
  status: 'blocked' | 'disabled';
  policyExists: false;
  policyAccepted: false;
  secondApprovalCreationEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    policyCount: number;
    policySectionCount: number;
    requiredEvidenceCount: number;
    missingEvidenceCount: number;
    blockerCount: number;
  };
  policySections: string[];
  requiredEvidence: string[];
  missingEvidence: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    policyDesignOnly: true;
    policyExists: false;
    policyAccepted: false;
    createsApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionSecondApprovalPolicyResponse {
  policy: BrainCoreVideoControlledExecutionSecondApprovalPolicy;
}

export interface BrainCoreVideoControlledExecutionOperatorIdentityProtocol {
  id: 'video-orchestrator-controlled-execution-operator-identity-protocol';
  generatedAt: string;
  version: 'phase-5h';
  status: 'blocked' | 'disabled';
  protocolExists: false;
  identityVerificationEnabled: false;
  operatorAuthenticated: false;
  secondApprovalAllowed: false;
  executionEnabled: false;
  executable: false;
  summary: {
    requirementCount: number;
    missingRequirementCount: number;
    verificationStepCount: number;
    blockerCount: number;
  };
  identityRequirements: string[];
  missingRequirements: string[];
  verificationSteps: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    protocolDesignOnly: true;
    protocolExists: false;
    identityVerificationEnabled: false;
    authenticatesOperator: false;
    createsSession: false;
    createsApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionOperatorIdentityProtocolResponse {
  protocol: BrainCoreVideoControlledExecutionOperatorIdentityProtocol;
}

export interface BrainCoreVideoControlledExecutionRole {
  name: string;
  description: string;
  canView: boolean;
  canRequestApproval: boolean;
  canIssueFirstApproval: boolean;
  canIssueSecondApproval: boolean;
  canExecute: boolean;
  canPublish: boolean;
  canDecommission: boolean;
}

export interface BrainCoreVideoControlledExecutionRolePolicy {
  id: 'video-orchestrator-controlled-execution-role-policy';
  generatedAt: string;
  version: 'phase-5i';
  status: 'blocked' | 'disabled';
  policyExists: false;
  policyEnforced: false;
  roleVerificationEnabled: false;
  secondApprovalAllowed: false;
  executionEnabled: false;
  executable: false;
  summary: {
    roleCount: number;
    privilegeRequirementCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  roles: BrainCoreVideoControlledExecutionRole[];
  privilegeRequirements: string[];
  missingPolicyRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    policyDesignOnly: true;
    policyExists: false;
    policyEnforced: false;
    roleVerificationEnabled: false;
    authenticatesOperator: false;
    createsSession: false;
    createsApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionRolePolicyResponse {
  policy: BrainCoreVideoControlledExecutionRolePolicy;
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

export type BrainCorePostEventType =
  | 'github-commit'
  | 'pr-merged'
  | 'release-published'
  | 'repo-launch'
  | 'product-milestone'
  | 'mrr-milestone'
  | 'github-achievement'
  | 'video-rendered'
  | 'blog-published'
  | 'research-summary'
  | 'manual-request';

export type BrainCorePostEventSource =
  | 'github'
  | 'video-orchestrator'
  | 'manual'
  | 'analytics'
  | 'internal'
  | 'blog'
  | 'product';

export interface BrainCorePostEventFixture {
  id: string;
  source: BrainCorePostEventSource;
  eventType: BrainCorePostEventType;
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

export type BrainCorePostPlanStatus = 'planned-preview' | 'blocked' | 'unsupported' | 'requires-approval';

export interface BrainCorePostDraftPlan {
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
  status: BrainCorePostPlanStatus;
  blockers: string[];
  nextSafeStep: string;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
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
}

export interface BrainCorePostDryRunPlan {
  id: string;
  event: BrainCorePostEventFixture;
  generatedAt: string;
  status: 'preview' | 'blocked';
  drafts: BrainCorePostDraftPlan[];
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

export type BrainCorePostDraftReviewStatus = 'review-ready' | 'approval-requested' | 'blocked' | 'disabled';
export type BrainCorePostDraftReviewRisk = 'low' | 'medium' | 'high';

export interface BrainCorePostDraftReviewItem {
  id: string;
  draftPlanId: string;
  eventId: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  title: string;
  format: BrainCorePostDraftFixture['format'];
  copyPreview: string;
  status: BrainCorePostDraftReviewStatus;
  risk: BrainCorePostDraftReviewRisk;
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

export type BrainCorePostPipelineStepId =
  | 'event'
  | 'dry-run'
  | 'review'
  | 'schedule-preview'
  | 'analytics-feedback'
  | 'readiness';

export type BrainCorePostPipelineStepStatus =
  | 'available'
  | 'preview'
  | 'blocked'
  | 'disabled'
  | 'missing';

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
  source:
    | 'event'
    | 'dry-run'
    | 'review'
    | 'schedule-preview'
    | 'analytics'
    | 'publishing'
    | 'security'
    | 'contracts';
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
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    summary: string;
  }>;
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
  summary: {
    itemCount: number;
    blockedCount: number;
    warningCount: number;
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

export interface BrainCoreAgentSummary {
  id: string;
  name: string;
  role: 'orchestrator' | 'executor' | 'researcher' | 'maintainer' | 'reviewer' | 'dashboard' | 'unknown';
  status: 'available' | 'planned' | 'external' | 'blocked' | 'unknown';
  health: BrainCoreHealth;
  owner: 'brain-core' | 'mind-steward' | 'external-tool' | 'planned';
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

export type BrainCoreAgentTaskStatus =
  | 'pending'
  | 'planned'
  | 'waiting_approval'
  | 'running'
  | 'blocked'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface BrainCoreAgentTaskSummary {
  taskId: string;
  title: string;
  status: BrainCoreAgentTaskStatus;
  dependsOn: string[];
  role: string;
  capabilityIds: string[];
  aiTaskType: string;
  approvalRequired: boolean;
  notes: string;
}

export interface BrainCoreAgentTaskGraphSummary {
  id: 'agent-task-graph';
  generatedAt: string;
  source: 'derived' | 'snapshot';
  status: 'read-only' | 'snapshot';
  taskCount: number;
  completedCount: number;
  blockedCount: number;
  pendingCount: number;
  tasks: BrainCoreAgentTaskSummary[];
  nextSafeStep: string;
  persistence: {
    enabled: boolean;
    path: string;
    loadedFromDisk: boolean;
  };
}

export interface BrainCoreAgentTaskStateStepSummary {
  taskId: string;
  status: BrainCoreAgentTaskStatus;
  startedAt?: string;
  completedAt?: string;
  selectedExecutorId?: string;
  selectedProviderId?: string;
  selectedModel?: string;
  note?: string;
}

export interface BrainCoreAgentTaskStateSummary {
  id: 'agent-task-state';
  generatedAt: string;
  source: 'derived' | 'snapshot';
  status: 'read-only' | 'snapshot';
  runId?: string;
  taskGraphId: 'agent-task-graph';
  currentTaskId?: string;
  resumedTaskId?: string;
  lastCompletedTaskId?: string;
  stepCount: number;
  steps: BrainCoreAgentTaskStateStepSummary[];
  nextSafeStep: string;
  persistence: {
    enabled: boolean;
    path: string;
    loadedFromDisk: boolean;
  };
}

export interface BrainCoreAgentExecutorPlanStepSummary {
  taskId: string;
  executorId: string;
  providerId: string;
  model?: string;
  reason: string;
  source: 'derived' | 'snapshot';
}

export interface BrainCoreAgentExecutorPlanSummary {
  id: 'agent-executor-plan';
  generatedAt: string;
  source: 'derived' | 'snapshot';
  status: 'read-only' | 'snapshot';
  taskGraphId: 'agent-task-graph';
  taskStateId: 'agent-task-state';
  stepCount: number;
  steps: BrainCoreAgentExecutorPlanStepSummary[];
  nextSafeStep: string;
  persistence: {
    enabled: boolean;
    path: string;
    loadedFromDisk: boolean;
  };
}

export interface BrainCoreAgentApprovalGateSummary {
  id: 'agent-approval-gates';
  generatedAt: string;
  source: 'derived' | 'snapshot';
  status: 'read-only' | 'snapshot';
  approvalStoreEnabled: boolean;
  approvalStoreStatus: BrainCoreApprovalStoreStatus;
  approvalStorePath: string;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  expiredCount: number;
  supportedApprovalKinds: string[];
  blockedApprovalKinds: string[];
  nextSafeStep: string;
  persistence: {
    enabled: boolean;
    path: string;
    loadedFromDisk: boolean;
  };
}

export interface BrainCoreAgentConsoleSummary {
  id: 'agent-console';
  generatedAt: string;
  source: 'derived' | 'snapshot';
  status: 'read-only' | 'snapshot';
  ledger: BrainCoreAgentLedgerSummary;
  taskGraph: BrainCoreAgentTaskGraphSummary;
  taskState: BrainCoreAgentTaskStateSummary;
  executorPlan: BrainCoreAgentExecutorPlanSummary;
  approvalGates: BrainCoreAgentApprovalGateSummary;
  activeRunCount: number;
  blockedRunCount: number;
  plannedRunCount: number;
  approvalPendingCount: number;
  executorSelectionCount: number;
  nextSafeStep: string;
  persistence: {
    enabled: boolean;
    path: string;
    loadedFromDisk: boolean;
  };
}

export type BrainCoreBudgetStatus = 'ok' | 'warning' | 'throttled' | 'blocked';
export type BrainCoreRouteSurface = 'ollama-m4pro' | 'ollama-m1' | 'codex-cli' | 'claude-bedrock';

export interface BrainCoreAgentCostLineItem {
  taskId: string;
  taskType: string;
  surface: BrainCoreRouteSurface;
  providerId: string;
  model?: string;
  estimatedTokens: number;
  estimatedCostUsd: number;
  routingReason: string;
  escalationReason?: string;
}

export interface BrainCoreAgentCostBudgetSummary {
  status: BrainCoreBudgetStatus;
  currency: 'USD';
  window: 'session' | 'day' | 'week' | 'month';
  thresholdUsd: number;
  spentUsd: number;
  remainingUsd: number;
  warningAtUsd: number;
  throttleAtUsd: number;
  blockAtUsd: number;
}

export interface BrainCoreAgentCostSummary {
  id: 'agent-cost-summary';
  generatedAt: string;
  source: 'derived' | 'snapshot';
  status: 'read-only' | 'snapshot';
  totalEstimatedUsd: number;
  todayEstimatedUsd: number;
  weekEstimatedUsd: number;
  monthEstimatedUsd: number;
  cheapestRouteCount: number;
  escalatedRouteCount: number;
  localRouteCount: number;
  subscriptionRouteCount: number;
  paidRouteCount: number;
  budget: BrainCoreAgentCostBudgetSummary;
  topExpensiveTasks: BrainCoreAgentCostLineItem[];
  routeHistory: BrainCoreAgentCostLineItem[];
  nextSafeStep: string;
  persistence: {
    enabled: boolean;
    path: string;
    loadedFromDisk: boolean;
  };
}

export interface BrainCoreAgentLedgerSummary {
  id: 'agent-ledger';
  generatedAt: string;
  source: 'derived' | 'snapshot';
  status: 'read-only' | 'snapshot';
  runCount: number;
  eventCount: number;
  taskCount: number;
  approvalCount: number;
  runs: BrainCoreAgentRunSummary[];
  events: BrainCoreAgentEventSummary[];
  taskGraph: BrainCoreAgentTaskGraphSummary;
  approvalIds: string[];
  nextSafeStep: string;
  persistence: {
    enabled: boolean;
    path: string;
    loadedFromDisk: boolean;
  };
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
  mindStewardReportSupported: boolean;
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
  executionGate: {
    executionEnabled: false;
    mindStewardDryRunExecutionFlagEnabled: boolean;
    mindStewardDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION';
    mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
    mindStewardInboxDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION';
    mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
    mindStewardInboxClassifierDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION';
    mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
    mindStewardInboxQueueDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION';
    candidateActionKinds: string[];
    readinessEndpoint: '/execution/readiness';
    plansEndpoint: '/execution/plans';
    firstCandidate: 'scheduler-run-mind-steward-dry-run';
  };
  notes: string[];
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
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostQaStatusResponse {
  qaStatus: BrainCorePostQaStatus;
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
  executionGate:
    | 'disabled-until-explicit-enable'
    | 'enabled-for-mind-steward-dry-run'
    | 'enabled-for-mind-steward-inbox-dry-run'
    | 'enabled-for-mind-steward-inbox-classifier-dry-run'
    | 'enabled-for-mind-steward-inbox-queue-dry-run';
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
  command:
    | 'bash tools/scripts/mind-steward-dry-run-report.sh'
    | 'bash tools/scripts/mind-steward-inbox-dry-run-report.sh'
    | 'bash tools/scripts/mind-steward-inbox-classifier-dry-run-report.sh'
    | 'bash tools/scripts/mind-steward-inbox-queue-dry-run-report.sh';
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
  firstProposedAction: 'mind-steward-update-current-context';
  firstProposedTarget: 'router/current.md';
  writesToMind: false;
  externalSideEffects: false;
  applyRouteEnabled: false;
  allowedTargets: string[];
  blockedPrefixes: string[];
  requiredGates: string[];
}

export interface BrainCoreExecutionPlan {
  kind:
    | 'scheduler-run-mind-steward-dry-run'
    | 'scheduler-run-mind-steward-inbox-dry-run'
    | 'scheduler-run-mind-steward-inbox-classifier-dry-run'
    | 'scheduler-run-mind-steward-inbox-queue-dry-run';
  candidate: true;
  executionEnabled: false;
  mindStewardDryRunExecutionFlagEnabled: boolean;
  mindStewardDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION';
  mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
  mindStewardInboxDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION';
  mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
  mindStewardInboxClassifierDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION';
  mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
  mindStewardInboxQueueDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION';
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
  firstProposedAction: 'mind-steward-update-current-context';
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
  actionKind: 'mind-steward-update-current-context';
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
  mindStewardDryRunExecutionFlagEnabled: boolean;
  mindStewardDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MIND_STEWARD_DRY_RUN_EXECUTION';
  mindStewardInboxDryRunExecutionFlagEnabled?: boolean;
  mindStewardInboxDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_DRY_RUN_EXECUTION';
  mindStewardInboxClassifierDryRunExecutionFlagEnabled?: boolean;
  mindStewardInboxClassifierDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_CLASSIFIER_DRY_RUN_EXECUTION';
  mindStewardInboxQueueDryRunExecutionFlagEnabled?: boolean;
  mindStewardInboxQueueDryRunExecutionFlagName?: 'BRAIN_CORE_ENABLE_MIND_STEWARD_INBOX_QUEUE_DRY_RUN_EXECUTION';
  candidateCount: number;
  readyCandidateCount: number;
  blockers: string[];
  writesToMind: false;
  executableActions: false;
}

export type BrainCoreActionKind =
  | 'mind-steward-dry-run'
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

export type BrainCoreRuntimeReportId = 'mind-steward' | 'approval-audit' | 'video' | 'local-apps';

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
  '/ai-model-selector/health-matrix': BrainCoreAiModelSelectorHealthMatrix;
  '/local-apps': {
    apps: BrainCoreLocalAppSummary[];
  };
  '/local-apps/dashboard': BrainCoreLocalAppsDashboardResponse;
  '/local-apps/action-readiness': BrainCoreLocalAppActionReadinessResponse;
  '/local-apps/action-enablement-backlog': BrainCoreLocalAppActionEnablementBacklogResponse;
  '/local-apps/orchestrator': BrainCoreLocalAppOrchestratorStatus;
  '/local-apps/onboarding-checklist': BrainCoreLocalAppOnboardingChecklist;
  '/local-apps/action-plans': {
    plans: BrainCoreLocalAppActionPlan[];
  };
  '/local-apps/:id/action-plan/:action': BrainCoreLocalAppActionPlan;
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
  '/video-orchestrator/intake': BrainCoreVideoOrchestratorIntakeResponse;
  '/video-orchestrator/intake/:id': BrainCoreVideoIntakePlan;
  '/stb-video-migration/status': BrainCoreStbVideoMigrationStatus;
  '/stb-video/parity-matrix': BrainCoreStbVideoParityMatrix;
  '/stb-video/dual-run-status': BrainCoreStbVideoDualRunStatus;
  '/video-orchestrator/production-gate': BrainCoreVideoProductionGateResponse;
  '/video-orchestrator/render-export-policy': BrainCoreVideoRenderExportPolicyResponse;
  '/video-orchestrator/approval-policy-design': BrainCoreVideoApprovalPolicyDesignResponse;
  '/video-orchestrator/artifact-sandbox-design': BrainCoreVideoArtifactSandboxDesignResponse;
  '/video-orchestrator/controlled-dry-run-design': BrainCoreVideoControlledDryRunDesignResponse;
  '/video-orchestrator/rollback-cleanup-checklist': BrainCoreVideoRollbackCleanupChecklistResponse;
  '/video-orchestrator/comparison-schema-design': BrainCoreVideoComparisonSchemaDesignResponse;
  '/video-orchestrator/fixture-comparison-preview': BrainCoreVideoFixtureComparisonPreviewResponse;
  '/video-orchestrator/production-cutover-gate': BrainCoreVideoProductionCutoverGateResponse;
  '/video-orchestrator/release-candidate-readiness': BrainCoreVideoReleaseCandidateReadinessResponse;
  '/video-orchestrator/operator-decision-queue': BrainCoreVideoOperatorDecisionQueueResponse;
  '/video-orchestrator/controlled-execution-policy-boundary': BrainCoreVideoControlledExecutionPolicyBoundaryResponse;
  '/video-orchestrator/controlled-execution-readiness-index': BrainCoreVideoControlledExecutionReadinessIndexResponse;
  '/video-orchestrator/roadmap-checkpoint': BrainCoreVideoRoadmapCheckpointResponse;
  '/video-orchestrator/operator-review-packet': BrainCoreVideoOperatorReviewPacketResponse;
  '/video-orchestrator/preview-completion-index': BrainCoreVideoPreviewCompletionIndexResponse;
  '/video-orchestrator/controlled-execution-preflight-checklist': BrainCoreVideoControlledExecutionPreflightChecklistResponse;
  '/video-orchestrator/controlled-execution-risk-register': BrainCoreVideoControlledExecutionRiskRegisterResponse;
  '/video-orchestrator/controlled-execution-approval-payload-schema': BrainCoreVideoControlledExecutionApprovalPayloadSchemaResponse;
  '/video-orchestrator/controlled-execution-approval-request-design': BrainCoreVideoControlledExecutionApprovalRequestDesignResponse;
  '/video-orchestrator/controlled-execution-disabled-gate': BrainCoreVideoControlledExecutionDisabledGateResponse;
  '/video-orchestrator/controlled-execution-preflight-validator-schema': BrainCoreVideoControlledExecutionPreflightValidatorSchemaResponse;
  '/video-orchestrator/design-provider-enablement-readiness-index': BrainCoreVideoDesignProviderEnablementReadinessIndexResponse;
  '/video-orchestrator/provider-integration-final-planning-checkpoint': BrainCoreVideoProviderIntegrationFinalPlanningCheckpointResponse;
  '/video-orchestrator/provider-request-wrapper-implementation-plan': BrainCoreVideoProviderRequestWrapperImplementationPlanResponse;
  '/video-orchestrator/credential-store-implementation-boundary-plan': BrainCoreVideoCredentialStoreImplementationBoundaryPlanResponse;
  '/video-orchestrator/prompt-review-ux-implementation-plan': BrainCoreVideoPromptReviewUxImplementationPlanResponse;
  '/stb-video/controlled-dual-run-request': BrainCoreControlledDualRunRequestDesignResponse;
  '/agents': {
    agents: BrainCoreAgentSummary[];
  };
  '/agents/:id': {
    agent: BrainCoreAgentSummary;
  };
  '/agent-task-graph': BrainCoreAgentTaskGraphSummary;
  '/agent-ledger': BrainCoreAgentLedgerSummary;
  '/agent-task-state': BrainCoreAgentTaskStateSummary;
  '/agent-executor-plan': BrainCoreAgentExecutorPlanSummary;
  '/agent-approval-gates': BrainCoreAgentApprovalGateSummary;
  '/agent-console': BrainCoreAgentConsoleSummary;
  '/agent-cost-summary': BrainCoreAgentCostSummary;
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
  '/local-apps/:id/start': BrainCoreLocalAppActionResult;
  '/local-apps/:id/stop': BrainCoreLocalAppActionResult;
  '/local-apps/:id/restart': BrainCoreLocalAppActionResult;
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


export interface BrainCoreVideoControlledExecutionFirstApprovalEligibleRole {
  role: 'viewer' | 'developer' | 'maintainer' | 'admin';
  canIssueFirstApproval: false;
  reason: string;
}

export interface BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicy {
  id: 'video-orchestrator-controlled-execution-first-approval-authority-policy';
  generatedAt: string;
  version: 'phase-5j';
  status: 'blocked' | 'disabled';
  policyExists: false;
  policyAccepted: false;
  firstApprovalAuthorityEnabled: false;
  firstApprovalCreationEnabled: false;
  secondApprovalRequired: true;
  secondApprovalAllowed: false;
  executionEnabled: false;
  executable: false;
  summary: {
    authorityRequirementCount: number;
    eligibleRoleCount: number;
    rolesAllowedToIssueFirstApproval: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  authorityRequirements: string[];
  eligibleRoles: BrainCoreVideoControlledExecutionFirstApprovalEligibleRole[];
  approvalScope: {
    scopeType: 'single-story-only';
    permitsExecution: false;
    permitsPublishing: false;
    permitsStbMutation: false;
    permitsMindWrites: false;
    requiresSecondApprovalBeforeExecution: true;
  };
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    policyDesignOnly: true;
    policyExists: false;
    policyAccepted: false;
    authorityVerificationEnabled: false;
    authenticatesOperator: false;
    createsSession: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicyResponse {
  policy: BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicy;
}



export interface BrainCoreVideoControlledExecutionFirstApprovalAuditExpiryModel {
  id: 'video-orchestrator-controlled-execution-first-approval-audit-expiry-model';
  generatedAt: string;
  version: 'phase-5k';
  status: 'blocked' | 'disabled';
  modelExists: false;
  auditPersistenceEnabled: false;
  expiryEnforcementEnabled: false;
  firstApprovalCreationEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    auditFieldCount: number;
    expiryRuleCount: number;
    invalidationRuleCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  auditFields: string[];
  expiryRules: string[];
  invalidationRules: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    modelDesignOnly: true;
    auditPersistenceEnabled: false;
    expiryEnforcementEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionFirstApprovalAuditExpiryModelResponse {
  model: BrainCoreVideoControlledExecutionFirstApprovalAuditExpiryModel;
}

export interface BrainCoreVideoControlledExecutionCandidateStoryLock {
  id: 'video-orchestrator-controlled-execution-candidate-story-lock';
  generatedAt: string;
  version: 'phase-5l';
  status: 'blocked' | 'disabled';
  lockExists: false;
  lockPersistenceEnabled: false;
  lockEnforcementEnabled: false;
  lockCreationEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    lockFieldCount: number;
    lockRuleCount: number;
    invalidationTriggerCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  lockFields: string[];
  lockRules: string[];
  invalidationTriggers: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    lockDesignOnly: true;
    lockPersistenceEnabled: false;
    lockEnforcementEnabled: false;
    createsLock: false;
    persistsLock: false;
    enforcesLock: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionCandidateStoryLockResponse {
  lock: BrainCoreVideoControlledExecutionCandidateStoryLock;
}

export interface BrainCoreVideoControlledExecutionPreflightEvidenceHashDesign {
  id: 'video-orchestrator-controlled-execution-preflight-evidence-hash-design';
  generatedAt: string;
  version: 'phase-5m';
  status: 'blocked' | 'disabled';
  hashDesignExists: false;
  hashComputationEnabled: false;
  evidencePersistenceEnabled: false;
  readsGeneratedArtifacts: false;
  validatorExecutionEnabled: false;
  lockEnforcementEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    hashInputCount: number;
    hashRuleCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  hashInputs: string[];
  hashRules: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    hashDesignOnly: true;
    hashComputationEnabled: false;
    evidencePersistenceEnabled: false;
    readsGeneratedArtifacts: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionPreflightEvidenceHashDesignResponse {
  design: BrainCoreVideoControlledExecutionPreflightEvidenceHashDesign;
}

export interface BrainCoreVideoControlledExecutionOperatorDecisionSnapshot {
  id: 'video-orchestrator-controlled-execution-operator-decision-snapshot-design';
  generatedAt: string;
  version: 'phase-5n';
  status: 'blocked' | 'disabled';
  snapshotDesignExists: false;
  snapshotPersistenceEnabled: false;
  decisionQueueMutationEnabled: false;
  approvalCreationEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    decisionFieldCount: number;
    snapshotRuleCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  decisionFields: string[];
  snapshotRules: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    snapshotDesignOnly: true;
    snapshotPersistenceEnabled: false;
    decisionQueueMutationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionOperatorDecisionSnapshotResponse {
  snapshot: BrainCoreVideoControlledExecutionOperatorDecisionSnapshot;
}

export interface BrainCoreVideoControlledExecutionRuntimeSandboxBoundary {
  id: 'video-orchestrator-controlled-execution-runtime-sandbox-boundary-design';
  generatedAt: string;
  version: 'phase-5o';
  status: 'blocked' | 'disabled';
  sandboxDesignExists: false;
  sandboxProvisioningEnabled: false;
  sandboxExecutionEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    boundaryRuleCount: number;
    requiredPolicyCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  sandboxBoundaryRules: string[];
  requiredBeforeSandbox: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    sandboxDesignOnly: true;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionRuntimeSandboxBoundaryResponse {
  boundary: BrainCoreVideoControlledExecutionRuntimeSandboxBoundary;
}

export interface BrainCoreVideoControlledExecutionApprovalReviewAudit {
  id: 'video-orchestrator-controlled-execution-approval-review-audit-design';
  generatedAt: string;
  version: 'phase-5p';
  status: 'blocked' | 'disabled';
  reviewDesignExists: false;
  auditCaptureEnabled: false;
  approvalReviewEnabled: false;
  approvalCreationEnabled: false;
  approvalExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    reviewFieldCount: number;
    reviewRuleCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  reviewFields: string[];
  reviewRules: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    reviewDesignOnly: true;
    auditCaptureEnabled: false;
    approvalReviewEnabled: false;
    approvalCreationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    persistsAuditEvent: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionApprovalReviewAuditResponse {
  review: BrainCoreVideoControlledExecutionApprovalReviewAudit;
}

export interface BrainCoreVideoControlledExecutionImmutableAuditTrailSchema {
  id: 'video-orchestrator-controlled-execution-immutable-audit-trail-schema';
  generatedAt: string;
  version: 'phase-5q';
  status: 'blocked' | 'disabled';
  schemaExists: false;
  auditTrailPersistenceEnabled: false;
  immutableStoreEnabled: false;
  appendOnlyWriteEnabled: false;
  approvalCreationEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    eventTypeCount: number;
    recordFieldCount: number;
    immutabilityRuleCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  auditEventTypes: string[];
  auditRecordFields: string[];
  immutabilityRules: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    schemaDesignOnly: true;
    auditTrailPersistenceEnabled: false;
    immutableStoreEnabled: false;
    appendOnlyWriteEnabled: false;
    hashComputationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionImmutableAuditTrailSchemaResponse {
  schema: BrainCoreVideoControlledExecutionImmutableAuditTrailSchema;
}

export interface BrainCoreVideoControlledExecutionAuditComplianceEvidencePacket {
  id: 'video-orchestrator-controlled-execution-audit-compliance-evidence-packet-design';
  generatedAt: string;
  version: 'phase-5r';
  status: 'blocked' | 'disabled';
  packetDesignExists: false;
  packetGenerationEnabled: false;
  evidenceCollectionEnabled: false;
  auditTrailPersistenceEnabled: false;
  approvalCreationEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    packetSectionCount: number;
    complianceRuleCount: number;
    missingRequirementCount: number;
    blockerCount: number;
  };
  packetSections: string[];
  complianceRules: string[];
  missingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    packetDesignOnly: true;
    packetGenerationEnabled: false;
    evidenceCollectionEnabled: false;
    auditTrailPersistenceEnabled: false;
    readsGeneratedArtifacts: false;
    hashComputationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    runsValidator: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionAuditComplianceEvidencePacketResponse {
  packet: BrainCoreVideoControlledExecutionAuditComplianceEvidencePacket;
}

export interface BrainCoreVideoControlledExecutionImplementationReadinessCheckpoint {
  id: 'video-orchestrator-controlled-execution-implementation-readiness-checkpoint';
  generatedAt: string;
  version: 'phase-6a';
  status: 'not-ready' | 'ready';
  designPhaseComplete: true;
  implementationPlanningEnabled: true;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    completedDesignPhaseCount: number;
    blockingRequirementCount: number;
    requiredImplementationPlanCount: number;
    safetyBoundaryCount: number;
  };
  completedDesignPhases: string[];
  requiredImplementationPlans: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    checkpointOnly: true;
    designPhaseComplete: true;
    implementationPlanningEnabled: true;
    implementationExecutionEnabled: false;
    featureFlagsEnabled: false;
    persistenceEnabled: false;
    approvalCreationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionImplementationReadinessCheckpointResponse {
  checkpoint: BrainCoreVideoControlledExecutionImplementationReadinessCheckpoint;
}

export interface BrainCoreVideoControlledExecutionFeatureFlagRolloutPlan {
  id: 'video-orchestrator-controlled-execution-feature-flag-rollout-plan';
  generatedAt: string;
  version: 'phase-6b';
  status: 'not-ready' | 'ready';
  planExists: false;
  featureFlagFrameworkEnabled: false;
  flagEvaluationEnabled: false;
  rolloutExecutionEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    rolloutPhaseCount: number;
    featureFlagCount: number;
    blockerCount: number;
    requiredApprovalCount: number;
  };
  proposedFlags: string[];
  rolloutPhases: string[];
  gatingRules: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    featureFlagFrameworkEnabled: false;
    flagEvaluationEnabled: false;
    rolloutExecutionEnabled: false;
    implementationExecutionEnabled: false;
    featureFlagsEnabled: false;
    persistenceEnabled: false;
    approvalCreationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionFeatureFlagRolloutPlanResponse {
  plan: BrainCoreVideoControlledExecutionFeatureFlagRolloutPlan;
}

export interface BrainCoreVideoControlledExecutionApprovalStoreImplementationPlan {
  id: 'video-orchestrator-controlled-execution-approval-store-implementation-plan';
  generatedAt: string;
  version: 'phase-6c';
  status: 'not-ready' | 'ready';
  planExists: false;
  approvalStoreEnabled: false;
  persistenceEnabled: false;
  approvalCreationEnabled: false;
  approvalExecutionEnabled: false;
  expiryEnforcementEnabled: false;
  revocationEnabled: false;
  auditLinkingEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    schemaSectionCount: number;
    lifecycleStateCount: number;
    blockerCount: number;
    requiredPolicyCount: number;
  };
  proposedSchema: string[];
  lifecycleStates: string[];
  storageRequirements: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    approvalStoreEnabled: false;
    persistenceEnabled: false;
    approvalCreationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    expiryEnforcementEnabled: false;
    revocationEnabled: false;
    auditLinkingEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionApprovalStoreImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionApprovalStoreImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionFirstApprovalCreationImplementationPlan {
  id: 'video-orchestrator-controlled-execution-first-approval-creation-implementation-plan';
  generatedAt: string;
  version: 'phase-6d';
  status: 'not-ready' | 'ready';
  planExists: false;
  firstApprovalCreationEnabled: false;
  approvalCreationEnabled: false;
  approvalStoreEnabled: false;
  persistenceEnabled: false;
  operatorVerificationEnabled: false;
  roleEnforcementEnabled: false;
  scopeValidationEnabled: false;
  evidenceCaptureEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    requiredInputCount: number;
    validationStepCount: number;
    outputRecordFieldCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  requiredInputs: string[];
  validationSteps: string[];
  outputRecordShape: string[];
  implementationGates: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    firstApprovalCreationEnabled: false;
    approvalCreationEnabled: false;
    approvalStoreEnabled: false;
    persistenceEnabled: false;
    operatorVerificationEnabled: false;
    roleEnforcementEnabled: false;
    scopeValidationEnabled: false;
    evidenceCaptureEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    expiryEnforcementEnabled: false;
    revocationEnabled: false;
    auditLinkingEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionFirstApprovalCreationImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionFirstApprovalCreationImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionSecondApprovalCreationImplementationPlan {
  id: 'video-orchestrator-controlled-execution-second-approval-creation-implementation-plan';
  generatedAt: string;
  version: 'phase-6e';
  status: 'not-ready' | 'ready';
  planExists: false;
  secondApprovalCreationEnabled: false;
  firstApprovalCreationEnabled: false;
  approvalCreationEnabled: false;
  approvalStoreEnabled: false;
  persistenceEnabled: false;
  operatorVerificationEnabled: false;
  roleEnforcementEnabled: false;
  firstApprovalRequired: true;
  firstApprovalVerificationEnabled: false;
  scopeValidationEnabled: false;
  evidenceCaptureEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    requiredInputCount: number;
    validationStepCount: number;
    outputRecordFieldCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  requiredInputs: string[];
  validationSteps: string[];
  outputRecordShape: string[];
  implementationGates: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    secondApprovalCreationEnabled: false;
    firstApprovalCreationEnabled: false;
    approvalCreationEnabled: false;
    approvalStoreEnabled: false;
    persistenceEnabled: false;
    operatorVerificationEnabled: false;
    roleEnforcementEnabled: false;
    firstApprovalVerificationEnabled: false;
    scopeValidationEnabled: false;
    evidenceCaptureEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    expiryEnforcementEnabled: false;
    revocationEnabled: false;
    auditLinkingEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionSecondApprovalCreationImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionSecondApprovalCreationImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionValidatorImplementationPlan {
  id: 'video-orchestrator-controlled-execution-validator-implementation-plan';
  generatedAt: string;
  version: 'phase-6f';
  status: 'not-ready' | 'ready';
  planExists: false;
  validatorExecutionEnabled: false;
  dryRunEnabled: false;
  persistenceEnabled: false;
  approvalCreationEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    requiredInputCount: number;
    validationRuleCount: number;
    outputRecordFieldCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  requiredInputs: string[];
  validationRules: string[];
  outputRecordShape: string[];
  implementationGates: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    validatorExecutionEnabled: false;
    dryRunEnabled: false;
    persistenceEnabled: false;
    approvalCreationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    expiryEnforcementEnabled: false;
    revocationEnabled: false;
    auditLinkingEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionValidatorImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionValidatorImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionExecutionPlanImplementationPlan {
  id: 'video-orchestrator-controlled-execution-execution-plan-implementation-plan';
  generatedAt: string;
  version: 'phase-6g';
  status: 'not-ready' | 'ready';
  planExists: false;
  executionPlanEnabled: false;
  planExecutionEnabled: false;
  persistenceEnabled: false;
  approvalCreationEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    requiredInputCount: number;
    executionPlanStepCount: number;
    outputRecordFieldCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  requiredInputs: string[];
  executionPlanSteps: string[];
  outputRecordShape: string[];
  implementationGates: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    executionPlanEnabled: false;
    planExecutionEnabled: false;
    persistenceEnabled: false;
    approvalCreationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    expiryEnforcementEnabled: false;
    revocationEnabled: false;
    auditLinkingEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionExecutionPlanImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionExecutionPlanImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionRollbackCleanupImplementationPlan {
  id: 'video-orchestrator-controlled-execution-rollback-cleanup-implementation-plan';
  generatedAt: string;
  version: 'phase-6h';
  status: 'not-ready' | 'ready';
  planExists: false;
  rollbackAcceptanceEnabled: false;
  cleanupExecutionEnabled: false;
  rollbackExecutionEnabled: false;
  artifactDeletionEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    rollbackRequirementCount: number;
    cleanupStepCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  rollbackRequirements: string[];
  cleanupPlanSteps: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    rollbackAcceptanceEnabled: false;
    cleanupExecutionEnabled: false;
    rollbackExecutionEnabled: false;
    artifactDeletionEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionRollbackCleanupImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionRollbackCleanupImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionSandboxProvisioningImplementationPlan {
  id: 'video-orchestrator-controlled-execution-sandbox-provisioning-implementation-plan';
  generatedAt: string;
  version: 'phase-6i';
  status: 'not-ready' | 'ready';
  planExists: false;
  sandboxProvisioningEnabled: false;
  sandboxCreationEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    sandboxRequirementCount: number;
    boundaryRuleCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  sandboxRequirements: string[];
  boundaryRules: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    sandboxProvisioningEnabled: false;
    sandboxCreationEnabled: false;
    sandboxExecutionEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionSandboxProvisioningImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionSandboxProvisioningImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionSandboxExecutionImplementationPlan {
  id: 'video-orchestrator-controlled-execution-sandbox-execution-implementation-plan';
  generatedAt: string;
  version: 'phase-6j';
  status: 'not-ready' | 'ready';
  planExists: false;
  sandboxExecutionEnabled: false;
  runnerExecutionEnabled: false;
  dryRunExecutionEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    executionPreconditionCount: number;
    runnerBoundaryRuleCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  executionPreconditions: string[];
  runnerBoundaryRules: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    sandboxExecutionEnabled: false;
    runnerExecutionEnabled: false;
    dryRunExecutionEnabled: false;
    sandboxProvisioningEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionSandboxExecutionImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionSandboxExecutionImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan {
  id: 'video-orchestrator-controlled-execution-sandbox-teardown-recovery-implementation-plan';
  generatedAt: string;
  version: 'phase-6k';
  status: 'not-ready' | 'ready';
  planExists: false;
  sandboxTeardownEnabled: false;
  recoveryExecutionEnabled: false;
  cleanupExecutionEnabled: false;
  artifactDeletionEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    teardownRequirementCount: number;
    recoveryStepCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  teardownRequirements: string[];
  recoverySteps: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    sandboxTeardownEnabled: false;
    recoveryExecutionEnabled: false;
    cleanupExecutionEnabled: false;
    artifactDeletionEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionSandboxTeardownRecoveryImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionArtifactPolicyImplementationPlan {
  id: 'video-orchestrator-controlled-execution-artifact-policy-implementation-plan';
  generatedAt: string;
  version: 'phase-6l';
  status: 'not-ready' | 'ready';
  planExists: false;
  artifactPolicyEnabled: false;
  artifactGenerationEnabled: false;
  artifactPersistenceEnabled: false;
  artifactExportEnabled: false;
  renderingEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    artifactRequirementCount: number;
    artifactBoundaryRuleCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  artifactRequirements: string[];
  artifactBoundaryRules: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    artifactPolicyEnabled: false;
    artifactGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    artifactExportEnabled: false;
    renderingEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionArtifactPolicyImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionArtifactPolicyImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionSTBProtectionDecommissionPreventionPlan {
  id: 'video-orchestrator-controlled-execution-stb-protection-decommission-prevention-plan';
  generatedAt: string;
  version: 'phase-6m';
  status: 'not-ready' | 'ready';
  planExists: false;
  stbProtectionEnabled: false;
  decommissionPreventionEnabled: false;
  stbMutationEnabled: false;
  decommissionEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    protectionRequirementCount: number;
    decommissionGuardCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  protectionRequirements: string[];
  decommissionGuards: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    stbProtectionEnabled: false;
    decommissionPreventionEnabled: false;
    stbMutationEnabled: false;
    decommissionEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionSTBProtectionDecommissionPreventionPlanResponse {
  plan: BrainCoreVideoControlledExecutionSTBProtectionDecommissionPreventionPlan;
}

export interface BrainCoreVideoControlledExecutionImplementationCompletionReadinessCheckpoint {
  id: 'video-orchestrator-controlled-execution-implementation-completion-readiness-checkpoint';
  generatedAt: string;
  version: 'phase-6n';
  status: 'not-ready' | 'ready';
  planningPhaseComplete: false;
  completedPlanningPhaseCount: number;
  requiredPlanningPhaseCount: number;
  remainingPlanningPhaseCount: number;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  completedPlanningPhases: string[];
  remainingPlanningPhases: string[];
  readinessBlockers: string[];
  evidenceReferences: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    checkpointOnly: true;
    planningPhaseComplete: false;
    implementationExecutionEnabled: false;
    featureFlagsEnabled: false;
    persistenceEnabled: false;
    approvalCreationEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    artifactGenerationEnabled: false;
    stbProtectionEnabled: false;
    decommissionPreventionEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionImplementationCompletionReadinessCheckpointResponse {
  checkpoint: BrainCoreVideoControlledExecutionImplementationCompletionReadinessCheckpoint;
}

export interface BrainCoreVideoControlledExecutionOperatorUXConsoleControlsImplementationPlan {
  id: 'video-orchestrator-controlled-execution-operator-ux-console-controls-implementation-plan';
  generatedAt: string;
  version: 'phase-6o';
  status: 'not-ready' | 'ready';
  planExists: false;
  consoleControlsEnabled: false;
  mutationControlsEnabled: false;
  approvalButtonsEnabled: false;
  executionButtonsEnabled: false;
  operatorConfirmationEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    consoleSurfaceCount: number;
    operatorConfirmationCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  consoleSurfaces: string[];
  operatorConfirmationRequirements: string[];
  consoleControlRules: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    consoleControlsEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    executionButtonsEnabled: false;
    operatorConfirmationEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    artifactGenerationEnabled: false;
    artifactExportEnabled: false;
    renderingEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionOperatorUXConsoleControlsImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionOperatorUXConsoleControlsImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionSecurityReviewThreatModelingImplementationPlan {
  id: 'video-orchestrator-controlled-execution-security-review-threat-modeling-implementation-plan';
  generatedAt: string;
  version: 'phase-6p';
  status: 'not-ready' | 'ready';
  planExists: false;
  securityReviewEnabled: false;
  threatModelingEnabled: false;
  securityAuditEnabled: false;
  vulnerabilityAssessmentEnabled: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    securityReviewCount: number;
    threatModelCount: number;
    securityRequirementCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  securityReviewRequirements: string[];
  threatModelRequirements: string[];
  securityRequirements: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    securityReviewEnabled: false;
    threatModelingEnabled: false;
    securityAuditEnabled: false;
    vulnerabilityAssessmentEnabled: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    artifactGenerationEnabled: false;
    artifactExportEnabled: false;
    renderingEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionSecurityReviewThreatModelingImplementationPlanResponse {
  plan: BrainCoreVideoControlledExecutionSecurityReviewThreatModelingImplementationPlan;
}

export interface BrainCoreVideoControlledExecutionImplementationApprovalPacketStartGate {
  id: 'video-orchestrator-controlled-execution-implementation-approval-packet-start-gate';
  generatedAt: string;
  version: 'phase-6q';
  status: 'not-ready' | 'ready';
  planExists: false;
  approvalPacketComplete: false;
  allPlanningPhasesApproved: false;
  readyForPhase7Execution: false;
  approvalPacketSignatureRequired: false;
  implementationExecutionEnabled: false;
  executionEnabled: false;
  executable: false;
  summary: {
    approvalPacketSectionCount: number;
    approvalRequirementCount: number;
    gateCriteriaCount: number;
    blockerCount: number;
    implementationGateCount: number;
  };
  approvalPacketSections: string[];
  approvalRequirements: string[];
  gateCriteria: string[];
  blockingRequirements: string[];
  evidenceReferences: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    planDesignOnly: true;
    approvalPacketComplete: false;
    allPlanningPhasesApproved: false;
    readyForPhase7Execution: false;
    approvalPacketSignatureRequired: false;
    implementationExecutionEnabled: false;
    createsApproval: false;
    createsFirstApproval: false;
    createsSecondApproval: false;
    approvalExecutionEnabled: false;
    featureFlagsEnabled: false;
    flagEvaluationEnabled: false;
    persistenceEnabled: false;
    validatorExecutionEnabled: false;
    lockPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    sandboxProvisioningEnabled: false;
    sandboxExecutionEnabled: false;
    artifactGenerationEnabled: false;
    artifactExportEnabled: false;
    renderingEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    credentialAccessEnabled: false;
    registersAction: false;
    registersAllowlist: false;
    createsExecutionPlan: false;
    executionPlanExecutable: false;
    executionEnabled: false;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    deletesFiles: false;
    rendersVideo: false;
    exportsArtifacts: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoControlledExecutionImplementationApprovalPacketStartGateResponse {
  gate: BrainCoreVideoControlledExecutionImplementationApprovalPacketStartGate;
}

export type BrainCoreVideoThumbnailPlanStatus = 'planned' | 'blocked' | 'ready-read-only';

export interface BrainCoreVideoThumbnailDesignVariant {
  id: string;
  label: string;
  status: BrainCoreVideoThumbnailPlanStatus;
  hypothesis: string;
  textOverlay: string;
  generatedAsset: false;
}

export interface BrainCoreVideoThumbnailDesignComposition {
  layout: string;
  foreground: string;
  background: string;
  textOverlay: string;
  safeArea: string;
}

export interface BrainCoreVideoThumbnailDesignSafety {
  readOnly: true;
  designOnly: true;
  callsExternalAI: false;
  generatesImages: false;
  rendersVideo: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  executesStb: false;
  executesVideo: false;
}

export interface BrainCoreVideoThumbnailDesignPlan {
  id: string;
  storyId: string;
  sourcePlanId: string;
  title: string;
  status: 'blocked';
  designIntent: string;
  composition: BrainCoreVideoThumbnailDesignComposition;
  variants: BrainCoreVideoThumbnailDesignVariant[];
  safety: BrainCoreVideoThumbnailDesignSafety;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoThumbnailDesignPlanResponse {
  id: 'video-orchestrator-thumbnail-design-plan';
  status: 'blocked';
  phase: 'thumbnail-design-plan-read-only';
  generatedAt: string;
  summary: {
    planCount: number;
    variantCount: number;
    blockedCount: number;
    generatedAssetCount: 0;
  };
  plans: BrainCoreVideoThumbnailDesignPlan[];
  safety: BrainCoreVideoThumbnailDesignSafety;
  blockers: string[];
  nextSafeStep: string;
}

export type BrainCoreVOStudioPlatformId = 'youtube' | 'youtube-shorts' | 'tiktok' | 'pinterest' | 'facebook' | 'linkedin';
export type BrainCoreVOStudioStatus = 'ready-read-only' | 'partial' | 'blocked';

export interface BrainCoreVOStudioFormatSpec {
  id: string;
  label: string;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5' | '2:3';
  width: number;
  height: number;
  safeZones: string[];
}

export interface BrainCoreVOStudioProject {
  id: string;
  name: string;
  status: BrainCoreVOStudioStatus;
  brandProfileId: string;
  defaultPipelineProfileId: string;
  platformAccountIds: string[];
  summary: string;
}

export interface BrainCoreVOStudioBrandProfile {
  id: string;
  projectId: string;
  name: string;
  tone: string;
  colorTokens: string[];
  typography: string[];
  thumbnailRules: string[];
}

export interface BrainCoreVOStudioPlatformSpec {
  id: BrainCoreVOStudioPlatformId;
  label: string;
  publishMode: 'direct-disabled' | 'manual-package' | 'limited-adapter';
  formats: BrainCoreVOStudioFormatSpec[];
  capabilityNotes: string[];
}

export interface BrainCoreVOStudioPlatformAccount {
  id: string;
  projectId: string;
  platform: BrainCoreVOStudioPlatformId;
  handle: string;
  status: 'active' | 'manual-only' | 'blocked';
  credentialState: 'connected' | 'missing' | 'manual';
  adapterStatus: 'disabled' | 'manual-package' | 'ready-read-only';
  quotaState: 'unknown' | 'ok' | 'limited';
  schedulerPolicy: string;
  enabledPipelineProfileIds: string[];
  capabilities: string[];
}

export interface BrainCoreVOStudioPipelineStage {
  id: string;
  label: string;
  status: 'enabled' | 'approval-gated' | 'manual-only' | 'disabled';
}

export interface BrainCoreVOStudioPipelineProfile {
  id: string;
  projectId: string;
  name: string;
  status: BrainCoreVOStudioStatus;
  targetPlatforms: BrainCoreVOStudioPlatformId[];
  enabledStages: BrainCoreVOStudioPipelineStage[];
  approvalRules: string[];
  scheduleWindows: string[];
  fallbackBehavior: string;
}

export interface BrainCoreVOStudioArtifactVariant {
  id: string;
  kind: 'video' | 'thumbnail' | 'metadata' | 'captions' | 'manual-package';
  platform: BrainCoreVOStudioPlatformId;
  formatId: string;
  status: 'planned' | 'preview-ready' | 'blocked';
  sourceTemplateId: string;
}

export interface BrainCoreVOStudioPostingTarget {
  id: string;
  platformAccountId: string;
  platform: BrainCoreVOStudioPlatformId;
  mode: 'manual-package' | 'direct-disabled';
  status: 'draft' | 'approval-required' | 'blocked';
  approvalRequired: boolean;
}

export interface BrainCoreVOStudioContentItem {
  id: string;
  projectId: string;
  sourceSlug: string;
  title: string;
  status: 'draft' | 'package-preview' | 'blocked';
  canonicalSource: string;
  pipelineProfileId: string;
  packageId: string;
  platformTargets: BrainCoreVOStudioPostingTarget[];
  artifactVariants: BrainCoreVOStudioArtifactVariant[];
}

export interface BrainCoreVOStudioProductionPackage {
  id: string;
  contentItemId: string;
  projectId: string;
  status: 'preview-ready' | 'blocked';
  packageType: 'manual-fallback';
  variants: BrainCoreVOStudioArtifactVariant[];
  postingTargets: BrainCoreVOStudioPostingTarget[];
  approvals: Array<{ id: string; label: string; status: 'required' | 'blocked' | 'not-requested' }>;
  auditEvents: Array<{ id: string; event: string; at: string; actor: string }>;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVOStudioAnalyticsSummary {
  id: 'video-orchestrator-analytics-summary';
  status: BrainCoreVOStudioStatus;
  generatedAt: string;
  kpis: Array<{ label: string; value: string; detail: string }>;
  byPlatform: Array<{ platform: BrainCoreVOStudioPlatformId; accountCount: number; publishedCount: number; scheduledCount: number; failedCount: number }>;
}

export interface BrainCoreVOStudioListResponse<T> {
  id: string;
  generatedAt: string;
  items: T[];
  summary: Record<string, number | string | boolean>;
  safety: {
    readOnly: true;
    writesFiles: false;
    publishesContent: false;
    schedulesPost: false;
    callsPlatformApi: false;
    writesToMind: false;
  };
  nextSafeStep: string;
}


export type BrainCoreVideoArchiveLoggingPlanStatus = 'planned' | 'blocked';

export interface BrainCoreVideoArchiveLoggingRecordShape {
  recordType: string;
  identityFields: string[];
  evidenceFields: string[];
  auditFields: string[];
  retentionPolicy: string;
}

export interface BrainCoreVideoArchiveLoggingCheck {
  id: string;
  label: string;
  status: BrainCoreVideoArchiveLoggingPlanStatus;
  required: boolean;
  description: string;
}

export interface BrainCoreVideoArchiveLoggingSafety {
  readOnly: true;
  designOnly: true;
  archiveWritesEnabled: false;
  auditPersistenceEnabled: false;
  runtimeLogIngestEnabled: false;
  deletesFiles: false;
  movesFiles: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  decommissionsStb: false;
  executesStb: false;
  executesVideo: false;
}

export interface BrainCoreVideoArchiveLoggingPlan {
  id: string;
  storyId: string;
  sourcePlanIds: string[];
  title: string;
  status: 'blocked';
  archiveIntent: string;
  recordShape: BrainCoreVideoArchiveLoggingRecordShape;
  loggingChecks: BrainCoreVideoArchiveLoggingCheck[];
  safety: BrainCoreVideoArchiveLoggingSafety;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoArchiveLoggingPlanResponse {
  id: 'video-orchestrator-archive-logging-plan';
  status: 'blocked';
  phase: 'archive-logging-plan-read-only';
  generatedAt: string;
  summary: {
    planCount: number;
    recordShapeCount: number;
    loggingCheckCount: number;
    blockedCount: number;
    persistedRecordCount: 0;
  };
  plans: BrainCoreVideoArchiveLoggingPlan[];
  safety: BrainCoreVideoArchiveLoggingSafety;
  blockers: string[];
  nextSafeStep: string;
}


export type BrainCoreVideoDesignProviderClass = 'image-generation' | 'layout-rendering' | 'brand-compliance';

export interface BrainCoreVideoDesignProviderOutputPolicy {
  allowedFutureOutputs: string[];
  disallowedOutputs: string[];
  retention: string;
}

export interface BrainCoreVideoDesignProviderBoundarySafety {
  readOnly: true;
  boundaryDesignOnly: true;
  providerConfigured: false;
  providerCallsEnabled: false;
  promptGenerationEnabled: false;
  imageGenerationEnabled: false;
  artifactPersistenceEnabled: false;
  credentialAccessEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  executesVideo: false;
}

export interface BrainCoreVideoDesignProviderBoundaryPlan {
  id: string;
  providerClass: BrainCoreVideoDesignProviderClass;
  status: 'blocked';
  purpose: string;
  allowedFutureInputs: string[];
  disallowedInputs: string[];
  outputPolicy: BrainCoreVideoDesignProviderOutputPolicy;
  requiredGates: string[];
  safety: BrainCoreVideoDesignProviderBoundarySafety;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoDesignProviderBoundaryPlanResponse {
  id: 'video-orchestrator-design-provider-boundary-plan';
  status: 'blocked';
  phase: 'design-provider-boundary-plan-read-only';
  generatedAt: string;
  summary: {
    boundaryCount: number;
    blockedCount: number;
    providerConfiguredCount: 0;
    providerCallCount: 0;
    artifactPersistenceCount: 0;
  };
  boundaries: BrainCoreVideoDesignProviderBoundaryPlan[];
  safety: BrainCoreVideoDesignProviderBoundarySafety;
  blockers: string[];
  nextSafeStep: string;
}

export type BrainCoreVideoDesignProviderCredentialIsolationClass =
  | 'image-generation-provider'
  | 'layout-rendering-provider'
  | 'brand-compliance-provider';

export interface BrainCoreVideoDesignProviderCredentialIsolationSafety {
  readOnly: true;
  credentialIsolationDesignOnly: true;
  providerConfigured: false;
  providerCallsEnabled: false;
  credentialAccessEnabled: false;
  secretMaterialStored: false;
  rawCredentialDisplayEnabled: false;
  envReadEnabled: false;
  filesystemCredentialAccessEnabled: false;
  networkAccessEnabled: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  executesVideo: false;
}

export interface BrainCoreVideoDesignProviderCredentialIsolationPlan {
  id: string;
  providerClass: BrainCoreVideoDesignProviderCredentialIsolationClass;
  status: 'blocked';
  purpose: string;
  credentialReferenceModel: string;
  allowedFutureCredentialReferenceFields: string[];
  disallowedFields: string[];
  redactionRequirements: string[];
  operatorApprovalGates: string[];
  auditRequirements: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: BrainCoreVideoDesignProviderCredentialIsolationSafety;
}

export interface BrainCoreVideoDesignProviderCredentialIsolationPlanResponse {
  id: 'video-orchestrator-design-provider-credential-isolation-plan';
  status: 'blocked';
  phase: 'design-provider-credential-isolation-plan-read-only';
  generatedAt: string;
  summary: {
    planCount: number;
    blockedCount: number;
    credentialConfiguredCount: 0;
    credentialAccessCount: 0;
    secretMaterialStoredCount: 0;
    providerCallCount: 0;
  };
  plans: BrainCoreVideoDesignProviderCredentialIsolationPlan[];
  safety: BrainCoreVideoDesignProviderCredentialIsolationSafety;
  blockers: string[];
  nextSafeStep: string;
}

export type BrainCoreVideoDesignProviderPromptReviewProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoDesignProviderPromptReviewPolicySafety {
  readOnly: true;
  promptReviewDesignOnly: true;
  promptGenerationEnabled: false;
  promptApprovalEnabled: false;
  approvedPromptPersistenceEnabled: false;
  providerConfigured: false;
  providerCallsEnabled: false;
  credentialAccessEnabled: false;
  rawCredentialDisplayEnabled: false;
  envReadEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  executesVideo: false;
}

export interface BrainCoreVideoDesignProviderPromptReviewPolicyPlan {
  id: string;
  providerClass: BrainCoreVideoDesignProviderPromptReviewProviderClass;
  promptCategory: string;
  status: 'blocked';
  purpose: string;
  allowedFuturePromptInputs: string[];
  disallowedPromptInputs: string[];
  requiredHumanReviewChecks: string[];
  redactionRequirements: string[];
  theologicalContentSafetyRequirements: string[];
  operatorApprovalGates: string[];
  auditRequirements: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: BrainCoreVideoDesignProviderPromptReviewPolicySafety;
}

export interface BrainCoreVideoDesignProviderPromptReviewPolicyPlanResponse {
  id: 'video-orchestrator-design-provider-prompt-review-policy-plan';
  status: 'blocked';
  phase: 'design-provider-prompt-review-policy-plan-read-only';
  generatedAt: string;
  summary: {
    policyCount: number;
    blockedCount: number;
    promptGenerationCount: 0;
    providerCallCount: 0;
    approvedPromptCount: 0;
    persistedPromptCount: 0;
  };
  policies: BrainCoreVideoDesignProviderPromptReviewPolicyPlan[];
  safety: BrainCoreVideoDesignProviderPromptReviewPolicySafety;
  blockers: string[];
  nextSafeStep: string;
}

export type BrainCoreVideoArtifactSandboxProviderHandoffProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoArtifactSandboxProviderHandoffSafety {
  readOnly: true;
  handoffDesignOnly: true;
  providerConfigured: false;
  providerCallsEnabled: false;
  artifactManifestCreationEnabled: false;
  artifactPersistenceEnabled: false;
  sandboxWriteEnabled: false;
  sandboxReadEnabled: false;
  credentialAccessEnabled: false;
  rawArtifactAccessEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  executesVideo: false;
}

export interface BrainCoreVideoArtifactSandboxProviderHandoffPlan {
  id: string;
  providerClass: BrainCoreVideoArtifactSandboxProviderHandoffProviderClass;
  handoffCategory: string;
  status: 'blocked';
  purpose: string;
  allowedFutureHandoffInputs: string[];
  disallowedHandoffInputs: string[];
  proposedManifestFields: string[];
  proposedSandboxBoundaryChecks: string[];
  redactionRequirements: string[];
  requiredApprovalGates: string[];
  auditRequirements: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: BrainCoreVideoArtifactSandboxProviderHandoffSafety;
}

export interface BrainCoreVideoArtifactSandboxProviderHandoffPlanResponse {
  id: 'video-orchestrator-artifact-sandbox-provider-handoff-plan';
  status: 'blocked';
  phase: 'artifact-sandbox-provider-handoff-plan-read-only';
  generatedAt: string;
  summary: {
    handoffPlanCount: number;
    blockedCount: number;
    providerConfiguredCount: 0;
    providerCallCount: 0;
    artifactPersistedCount: 0;
    sandboxWriteCount: 0;
    manifestCreatedCount: 0;
  };
  handoffPlans: BrainCoreVideoArtifactSandboxProviderHandoffPlan[];
  safety: BrainCoreVideoArtifactSandboxProviderHandoffSafety;
  blockers: string[];
  nextSafeStep: string;
}

export type BrainCoreVideoProviderOutputRedactionProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderOutputRedactionSafety {
  readOnly: true;
  redactionPolicyDesignOnly: true;
  providerConfigured: false;
  providerCallsEnabled: false;
  rawProviderOutputAccessEnabled: false;
  redactedManifestCreationEnabled: false;
  artifactPersistenceEnabled: false;
  auditPersistenceEnabled: false;
  credentialAccessEnabled: false;
  rawCredentialDisplayEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  executesVideo: false;
}

export interface BrainCoreVideoProviderOutputRedactionPolicyPlan {
  id: string;
  providerClass: BrainCoreVideoProviderOutputRedactionProviderClass;
  outputCategory: string;
  status: 'blocked';
  purpose: string;
  allowedFutureOutputSummaryFields: string[];
  disallowedRawOutputFields: string[];
  redactionRules: string[];
  proposedRedactedManifestFields: string[];
  auditReferenceRequirements: string[];
  operatorReviewGates: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: BrainCoreVideoProviderOutputRedactionSafety;
}

export interface BrainCoreVideoProviderOutputRedactionPolicyPlanResponse {
  id: 'video-orchestrator-provider-output-redaction-policy-plan';
  status: 'blocked';
  phase: 'provider-output-redaction-policy-plan-read-only';
  generatedAt: string;
  summary: {
    policyCount: number;
    blockedCount: number;
    redactedManifestCreatedCount: 0;
    rawOutputAccessCount: 0;
    providerCallCount: 0;
    artifactPersistedCount: 0;
    auditPersistedCount: 0;
  };
  policies: BrainCoreVideoProviderOutputRedactionPolicyPlan[];
  safety: BrainCoreVideoProviderOutputRedactionSafety;
  blockers: string[];
  nextSafeStep: string;
}

export type BrainCoreVideoDesignProviderComplianceChecklistProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoDesignProviderComplianceChecklistSafety {
  readOnly: true;
  complianceChecklistDesignOnly: true;
  complianceEvaluationEnabled: false;
  complianceRecordPersistenceEnabled: false;
  providerConfigured: false;
  providerCallsEnabled: false;
  rawProviderOutputAccessEnabled: false;
  credentialAccessEnabled: false;
  auditPersistenceEnabled: false;
  filesystemAccessEnabled: false;
  networkAccessEnabled: false;
  writesFiles: false;
  publishesContent: false;
  writesToMind: false;
  executesVideo: false;
}

export interface BrainCoreVideoDesignProviderComplianceChecklistPlan {
  id: string;
  providerClass: BrainCoreVideoDesignProviderComplianceChecklistProviderClass;
  checklistCategory: string;
  status: 'blocked';
  purpose: string;
  requiredChecks: string[];
  blockedChecks: string[];
  evidenceReferencesRequiredBeforeFutureProviderEnablement: string[];
  disallowedComplianceEvidenceSources: string[];
  operatorReviewGates: string[];
  auditRequirements: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: BrainCoreVideoDesignProviderComplianceChecklistSafety;
}

export interface BrainCoreVideoDesignProviderComplianceChecklistPlanResponse {
  id: 'video-orchestrator-design-provider-compliance-checklist-plan';
  status: 'blocked';
  phase: 'design-provider-compliance-checklist-plan-read-only';
  generatedAt: string;
  summary: {
    checklistCount: number;
    blockedCount: number;
    requiredCheckCount: number;
    passedCheckCount: 0;
    persistedComplianceRecordCount: 0;
    providerCallCount: 0;
    auditPersistedCount: 0;
  };
  checklists: BrainCoreVideoDesignProviderComplianceChecklistPlan[];
  safety: BrainCoreVideoDesignProviderComplianceChecklistSafety;
  blockers: string[];
  nextSafeStep: string;
}

export type BrainCoreVideoDesignProviderEnablementReadinessProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoDesignProviderEnablementReadinessIndexEntry {
  providerClass: BrainCoreVideoDesignProviderEnablementReadinessProviderClass;
  status: 'blocked';
  readinessPercent: 0;
  requiredPlanningSurfaces: string[];
  completedPlanningSurfaceRefs: string[];
  missingImplementationGates: string[];
  blockingReasons: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    readinessIndexOnly: true;
    providerImplementationApproved: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoDesignProviderEnablementReadinessIndex {
  id: 'video-orchestrator-design-provider-enablement-readiness-index';
  generatedAt: string;
  status: 'blocked';
  readinessPercent: 0;
  providerClassCount: 3;
  blockedCount: 3;
  readyCount: 0;
  averageReadinessPercent: 0;
  providerConfiguredCount: 0;
  providerCallCount: 0;
  executionEnabledCount: 0;
  entries: BrainCoreVideoDesignProviderEnablementReadinessIndexEntry[];
  summary: {
    providerClassCount: 3;
    blockedCount: 3;
    readyCount: 0;
    averageReadinessPercent: 0;
    providerConfiguredCount: 0;
    providerCallCount: 0;
    executionEnabledCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    readinessIndexOnly: true;
    providerImplementationApproved: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoDesignProviderEnablementReadinessIndexResponse {
  index: BrainCoreVideoDesignProviderEnablementReadinessIndex;
}

export type BrainCoreVideoProviderIntegrationFinalPlanningCheckpointProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderIntegrationFinalPlanningCheckpointEntry {
  providerClass: BrainCoreVideoProviderIntegrationFinalPlanningCheckpointProviderClass;
  status: 'blocked';
  planningComplete: true;
  implementationApproved: false;
  implementationEligible: false;
  completedPlanningSurfaceRefs: string[];
  requiredExplicitApprovals: string[];
  implementationStartBlockers: string[];
  firstImplementationPhaseRecommendation: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    checkpointOnly: true;
    planningComplete: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderIntegrationFinalPlanningCheckpoint {
  id: 'video-orchestrator-provider-integration-final-planning-checkpoint';
  generatedAt: string;
  status: 'blocked';
  providerClassCount: 3;
  planningCompleteCount: 3;
  implementationApprovedCount: 0;
  implementationEligibleCount: 0;
  blockedCount: 3;
  providerConfiguredCount: 0;
  providerCallCount: 0;
  executionEnabledCount: 0;
  entries: BrainCoreVideoProviderIntegrationFinalPlanningCheckpointEntry[];
  summary: {
    providerClassCount: 3;
    planningCompleteCount: 3;
    implementationApprovedCount: 0;
    implementationEligibleCount: 0;
    blockedCount: 3;
    providerConfiguredCount: 0;
    providerCallCount: 0;
    executionEnabledCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    checkpointOnly: true;
    planningComplete: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderIntegrationFinalPlanningCheckpointResponse {
  checkpoint: BrainCoreVideoProviderIntegrationFinalPlanningCheckpoint;
}

export type BrainCoreVideoProviderRequestWrapperImplementationPlanProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderRequestWrapperImplementationPlanEntry {
  providerClass: BrainCoreVideoProviderRequestWrapperImplementationPlanProviderClass;
  status: 'blocked';
  implementationPlanOnly: true;
  wrapperPurpose: string;
  proposedFutureRequestShape: string[];
  proposedFutureResponseShape: string[];
  requestValidationSteps: string[];
  failureModes: string[];
  timeoutPolicy: string;
  retryPolicy: string;
  redactionRequirements: string[];
  auditRequirements: string[];
  requiredPreImplementationApprovals: string[];
  implementationBlockers: string[];
  firstSafeImplementationSlice: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationPlanOnly: true;
    providerRequestWrapperImplemented: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    rawProviderOutputAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderRequestWrapperImplementationPlan {
  id: 'video-orchestrator-provider-request-wrapper-implementation-plan';
  generatedAt: string;
  status: 'blocked';
  planCount: 3;
  blockedCount: 3;
  implementationPlanOnlyCount: 3;
  providerConfiguredCount: 0;
  providerCallCount: 0;
  networkAccessCount: 0;
  credentialAccessCount: 0;
  rawOutputAccessCount: 0;
  entries: BrainCoreVideoProviderRequestWrapperImplementationPlanEntry[];
  summary: {
    planCount: 3;
    blockedCount: 3;
    implementationPlanOnlyCount: 3;
    providerConfiguredCount: 0;
    providerCallCount: 0;
    networkAccessCount: 0;
    credentialAccessCount: 0;
    rawOutputAccessCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationPlanOnly: true;
    providerRequestWrapperImplemented: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    rawProviderOutputAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderRequestWrapperImplementationPlanResponse {
  plan: BrainCoreVideoProviderRequestWrapperImplementationPlan;
}

export type BrainCoreVideoCredentialStoreImplementationBoundaryProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry {
  providerClass: BrainCoreVideoCredentialStoreImplementationBoundaryProviderClass;
  status: 'blocked';
  implementationBoundaryOnly: true;
  credentialStorePurpose: string;
  proposedReferenceModel: string[];
  allowedFutureReferenceFields: string[];
  disallowedStoredFields: string[];
  storageBoundaryRules: string[];
  accessBoundaryRules: string[];
  rotationAndRevocationPlan: string;
  auditRequirements: string[];
  failureModes: string[];
  requiredPreImplementationApprovals: string[];
  implementationBlockers: string[];
  firstSafeImplementationSlice: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationBoundaryOnly: true;
    credentialStoreImplemented: false;
    credentialAccessEnabled: false;
    credentialPersistenceEnabled: false;
    rawCredentialDisplayEnabled: false;
    envReadEnabled: false;
    keychainAccessEnabled: false;
    filesystemCredentialAccessEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoCredentialStoreImplementationBoundaryPlan {
  id: 'video-orchestrator-credential-store-implementation-boundary-plan';
  generatedAt: string;
  status: 'blocked';
  boundaryCount: 3;
  blockedCount: 3;
  implementationBoundaryOnlyCount: 3;
  credentialStoreImplementedCount: 0;
  credentialAccessCount: 0;
  credentialPersistedCount: 0;
  envReadCount: 0;
  keychainAccessCount: 0;
  providerCallCount: 0;
  entries: BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry[];
  summary: {
    boundaryCount: 3;
    blockedCount: 3;
    implementationBoundaryOnlyCount: 3;
    credentialStoreImplementedCount: 0;
    credentialAccessCount: 0;
    credentialPersistedCount: 0;
    envReadCount: 0;
    keychainAccessCount: 0;
    providerCallCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationBoundaryOnly: true;
    credentialStoreImplemented: false;
    credentialAccessEnabled: false;
    credentialPersistenceEnabled: false;
    rawCredentialDisplayEnabled: false;
    envReadEnabled: false;
    keychainAccessEnabled: false;
    filesystemCredentialAccessEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoCredentialStoreImplementationBoundaryPlanResponse {
  plan: BrainCoreVideoCredentialStoreImplementationBoundaryPlan;
}

export type BrainCoreVideoPromptReviewUxImplementationPlanProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoPromptReviewUxImplementationPlanEntry {
  providerClass: BrainCoreVideoPromptReviewUxImplementationPlanProviderClass;
  status: 'blocked';
  implementationPlanOnly: true;
  uxPurpose: string;
  proposedReviewStates: string[];
  proposedReadOnlyFields: string[];
  proposedFutureEditableFields: string[];
  prohibitedControls: string[];
  requiredGuardrails: string[];
  operatorConfirmationCopy: string;
  auditRequirements: string[];
  failureModes: string[];
  requiredPreImplementationApprovals: string[];
  implementationBlockers: string[];
  firstSafeImplementationSlice: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationPlanOnly: true;
    promptReviewUxImplemented: false;
    editableUiEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    promptApprovalEnabled: false;
    promptPersistenceEnabled: false;
    providerCallButtonsEnabled: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    rawCredentialDisplayEnabled: false;
    rawPromptCopyEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoPromptReviewUxImplementationPlan {
  id: 'video-orchestrator-prompt-review-ux-implementation-plan';
  generatedAt: string;
  status: 'blocked';
  planCount: 3;
  blockedCount: 3;
  implementationPlanOnlyCount: 3;
  editableUiEnabledCount: 0;
  promptApprovalEnabledCount: 0;
  providerCallButtonCount: 0;
  promptPersistedCount: 0;
  entries: BrainCoreVideoPromptReviewUxImplementationPlanEntry[];
  summary: {
    planCount: 3;
    blockedCount: 3;
    implementationPlanOnlyCount: 3;
    editableUiEnabledCount: 0;
    promptApprovalEnabledCount: 0;
    providerCallButtonCount: 0;
    promptPersistedCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationPlanOnly: true;
    promptReviewUxImplemented: false;
    editableUiEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    promptApprovalEnabled: false;
    promptPersistenceEnabled: false;
    providerCallButtonsEnabled: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    rawCredentialDisplayEnabled: false;
    rawPromptCopyEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoPromptReviewUxImplementationPlanResponse {
  plan: BrainCoreVideoPromptReviewUxImplementationPlan;
}

export type BrainCoreVideoProviderAuditPersistenceBoundaryProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry {
  providerClass: BrainCoreVideoProviderAuditPersistenceBoundaryProviderClass;
  status: 'blocked';
  implementationBoundaryOnly: true;
  auditPurpose: string;
  proposedAuditEventTypes: string[];
  proposedAuditRecordShape: string[];
  allowedFutureAuditFields: string[];
  disallowedAuditFields: string[];
  retentionRules: string[];
  appendOnlyRules: string[];
  redactionRequirements: string[];
  requiredPreImplementationApprovals: string[];
  implementationBlockers: string[];
  firstSafeImplementationSlice: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationBoundaryOnly: true;
    auditPersistenceImplemented: false;
    auditRecordCreationEnabled: false;
    auditAppendEnabled: false;
    auditMutationEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    rawProviderOutputAccessEnabled: false;
    credentialAccessEnabled: false;
    promptPersistenceEnabled: false;
    artifactPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderAuditPersistenceBoundaryPlan {
  id: 'video-orchestrator-provider-audit-persistence-boundary-plan';
  generatedAt: string;
  status: 'blocked';
  boundaryCount: 3;
  blockedCount: 3;
  implementationBoundaryOnlyCount: 3;
  auditPersistenceImplementedCount: 0;
  auditRecordCreatedCount: 0;
  auditAppendEnabledCount: 0;
  providerCallCount: 0;
  rawOutputAccessCount: 0;
  entries: BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry[];
  summary: {
    boundaryCount: 3;
    blockedCount: 3;
    implementationBoundaryOnlyCount: 3;
    auditPersistenceImplementedCount: 0;
    auditRecordCreatedCount: 0;
    auditAppendEnabledCount: 0;
    providerCallCount: 0;
    rawOutputAccessCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    implementationBoundaryOnly: true;
    auditPersistenceImplemented: false;
    auditRecordCreationEnabled: false;
    auditAppendEnabled: false;
    auditMutationEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    rawProviderOutputAccessEnabled: false;
    credentialAccessEnabled: false;
    promptPersistenceEnabled: false;
    artifactPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderAuditPersistenceBoundaryPlanResponse {
  plan: BrainCoreVideoProviderAuditPersistenceBoundaryPlan;
}

export type BrainCoreVideoProviderWrapperSecurityReviewPlanProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderWrapperSecurityReviewPlanEntry {
  providerClass: BrainCoreVideoProviderWrapperSecurityReviewPlanProviderClass;
  status: 'blocked';
  implementationBoundaryOnly: true;
  securityReviewPlanOnly: true;
  reviewPurpose: string;
  threatCategories: string[];
  requiredEvidence: string[];
  prohibitedImplementationPatterns: string[];
  requiredManualReviewChecks: string[];
  requiredAutomatedReviewChecks: string[];
  approvalGates: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    securityReviewPlanOnly: true;
    securityReviewCompleted: false;
    providerImplementationApproved: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    rawProviderOutputAccessEnabled: false;
    securityScanExecutionEnabled: false;
    automatedReviewExecutionEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderWrapperSecurityReviewPlan {
  id: 'video-orchestrator-provider-wrapper-security-review-plan';
  generatedAt: string;
  status: 'blocked';
  reviewPlanCount: 3;
  blockedCount: 3;
  securityReviewCompletedCount: 0;
  providerImplementationApprovedCount: 0;
  providerCallCount: 0;
  mutationControlCount: 0;
  postRouteCount: 0;
  entries: BrainCoreVideoProviderWrapperSecurityReviewPlanEntry[];
  summary: {
    reviewPlanCount: 3;
    blockedCount: 3;
    securityReviewCompletedCount: 0;
    providerImplementationApprovedCount: 0;
    providerCallCount: 0;
    mutationControlCount: 0;
    postRouteCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    securityReviewPlanOnly: true;
    securityReviewCompleted: false;
    providerImplementationApproved: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    rawProviderOutputAccessEnabled: false;
    securityScanExecutionEnabled: false;
    automatedReviewExecutionEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderWrapperSecurityReviewPlanResponse {
  plan: BrainCoreVideoProviderWrapperSecurityReviewPlan;
}

export type BrainCoreVideoProviderImplementationPhaseStartGateProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderImplementationPhaseStartGateEntry {
  providerClass: BrainCoreVideoProviderImplementationPhaseStartGateProviderClass;
  status: 'blocked';
  startGateOnly: true;
  planningSequenceComplete: true;
  implementationApproved: false;
  implementationEligible: false;
  completedPlanningRefs: string[];
  remainingApprovalRequirements: string[];
  implementationStartBlockers: string[];
  explicitApprovalChecklist: string[];
  firstImplementationPhaseAllowedOnlyAfterApproval: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    startGateOnly: true;
    planningSequenceComplete: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderImplementationPhaseStartGate {
  id: 'video-orchestrator-provider-implementation-phase-start-gate';
  generatedAt: string;
  status: 'blocked';
  gateCount: 3;
  planningSequenceCompleteCount: 3;
  implementationApprovedCount: 0;
  implementationEligibleCount: 0;
  blockedCount: 3;
  providerConfiguredCount: 0;
  providerCallCount: 0;
  credentialAccessCount: 0;
  networkAccessCount: 0;
  executionEnabledCount: 0;
  entries: BrainCoreVideoProviderImplementationPhaseStartGateEntry[];
  summary: {
    gateCount: 3;
    planningSequenceCompleteCount: 3;
    implementationApprovedCount: 0;
    implementationEligibleCount: 0;
    blockedCount: 3;
    providerConfiguredCount: 0;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
    executionEnabledCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    startGateOnly: true;
    planningSequenceComplete: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderImplementationPhaseStartGateResponse {
  gate: BrainCoreVideoProviderImplementationPhaseStartGate;
}

export type BrainCoreVideoProviderImplementationReadinessDashboardSummaryProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry {
  providerClass: BrainCoreVideoProviderImplementationReadinessDashboardSummaryProviderClass;
  status: 'blocked';
  planningComplete: true;
  implementationApproved: false;
  implementationEligible: false;
  planningSurfaceCount: number;
  completedPlanningSurfaceCount: number;
  blockedGateCount: number;
  remainingApprovalCount: number;
  dashboardHighlights: string[];
  operatorWarnings: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    dashboardSummaryOnly: true;
    planningComplete: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderImplementationReadinessDashboardSummary {
  id: 'video-orchestrator-provider-implementation-readiness-dashboard-summary';
  generatedAt: string;
  status: 'blocked';
  providerClassCount: 3;
  planningCompleteCount: 3;
  implementationApprovedCount: 0;
  implementationEligibleCount: 0;
  blockedGateCount: 3;
  providerConfiguredCount: 0;
  providerCallCount: 0;
  credentialAccessCount: 0;
  mutationControlCount: 0;
  entries: BrainCoreVideoProviderImplementationReadinessDashboardSummaryEntry[];
  summary: {
    providerClassCount: 3;
    planningCompleteCount: 3;
    implementationApprovedCount: 0;
    implementationEligibleCount: 0;
    blockedGateCount: 3;
    providerConfiguredCount: 0;
    providerCallCount: 0;
    credentialAccessCount: 0;
    mutationControlCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    dashboardSummaryOnly: true;
    planningComplete: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderImplementationReadinessDashboardSummaryResponse {
  dashboard: BrainCoreVideoProviderImplementationReadinessDashboardSummary;
}

export type BrainCoreVideoProviderImplementationApprovalPacketProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderImplementationApprovalPacketEntry {
  providerClass: BrainCoreVideoProviderImplementationApprovalPacketProviderClass;
  status: 'blocked';
  approvalPacketOnly: true;
  implementationApproved: false;
  implementationEligible: false;
  packetSections: string[];
  evidenceRefs: string[];
  requiredApprovalStatements: string[];
  nonApprovalStatements: string[];
  implementationRestrictions: string[];
  rollbackAndStopConditions: string[];
  operatorDecisionSummary: {
    decisionRequired: true;
    currentDecision: 'not-approved';
    acceptableNextDecision: 'approve-wrapper-scaffolding-only';
    unacceptableDecisions: string[];
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    approvalPacketOnly: true;
    implementationApproved: false;
    implementationEligible: false;
    approvalRecordCreated: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderImplementationApprovalPacket {
  id: 'video-orchestrator-provider-implementation-approval-packet';
  generatedAt: string;
  status: 'blocked';
  packetCount: 3;
  implementationApprovedCount: 0;
  implementationEligibleCount: 0;
  decisionRequiredCount: 3;
  providerCallCount: 0;
  credentialAccessCount: 0;
  networkAccessCount: 0;
  mutationControlCount: 0;
  entries: BrainCoreVideoProviderImplementationApprovalPacketEntry[];
  summary: {
    packetCount: 3;
    implementationApprovedCount: 0;
    implementationEligibleCount: 0;
    decisionRequiredCount: 3;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
    mutationControlCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    approvalPacketOnly: true;
    implementationApproved: false;
    implementationEligible: false;
    approvalRecordCreated: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderImplementationApprovalPacketResponse {
  packet: BrainCoreVideoProviderImplementationApprovalPacket;
}

export type BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryProviderClass =
  | 'image-generation'
  | 'layout-rendering'
  | 'brand-compliance';

export interface BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry {
  providerClass: BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryProviderClass;
  status: 'blocked';
  consoleReviewOnly: true;
  approvalPacketRef: 'video-orchestrator-provider-implementation-approval-packet';
  currentDecision: 'not-approved';
  acceptableNextDecision: 'approve-wrapper-scaffolding-only';
  unacceptableDecisions: string[];
  reviewHighlights: string[];
  reviewWarnings: string[];
  requiredOperatorAcknowledgements: string[];
  blockedControls: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    consoleReviewOnly: true;
    approvalRecordCreated: false;
    implementationApproved: false;
    implementationEligible: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderApprovalPacketConsoleReviewSummary {
  id: 'video-orchestrator-provider-approval-packet-console-review-summary';
  generatedAt: string;
  status: 'blocked';
  reviewCount: 3;
  decisionRequiredCount: 3;
  approvalRecordCreatedCount: 0;
  implementationApprovedCount: 0;
  implementationEligibleCount: 0;
  mutationControlCount: 0;
  providerCallCount: 0;
  credentialAccessCount: 0;
  entries: BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryEntry[];
  summary: {
    reviewCount: 3;
    decisionRequiredCount: 3;
    approvalRecordCreatedCount: 0;
    implementationApprovedCount: 0;
    implementationEligibleCount: 0;
    mutationControlCount: 0;
    providerCallCount: 0;
    credentialAccessCount: 0;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    consoleReviewOnly: true;
    approvalRecordCreated: false;
    implementationApproved: false;
    implementationEligible: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryResponse {
  summary: BrainCoreVideoProviderApprovalPacketConsoleReviewSummary;
}

export type BrainCoreVideoProviderPlanningSurfaceIndexId =
  | 'design-provider-boundary-plan'
  | 'design-provider-credential-isolation-plan'
  | 'design-provider-prompt-review-policy-plan'
  | 'artifact-sandbox-provider-handoff-plan'
  | 'provider-output-redaction-policy-plan'
  | 'design-provider-compliance-checklist-plan'
  | 'design-provider-enablement-readiness-index'
  | 'provider-integration-final-planning-checkpoint'
  | 'provider-request-wrapper-implementation-plan'
  | 'credential-store-implementation-boundary-plan'
  | 'prompt-review-ux-implementation-plan'
  | 'provider-audit-persistence-boundary-plan'
  | 'provider-wrapper-security-review-plan'
  | 'provider-implementation-phase-start-gate'
  | 'provider-implementation-readiness-dashboard-summary'
  | 'provider-implementation-approval-packet'
  | 'provider-approval-packet-console-review-summary';

export interface BrainCoreVideoProviderPlanningSurfaceIndexEntry {
  id: BrainCoreVideoProviderPlanningSurfaceIndexId;
  endpoint: string;
  phaseRole: string;
  status: 'blocked';
  visibleInBrainConsole: boolean;
  implementationEnables: false;
  providerCallsEnabled: false;
  credentialAccessEnabled: false;
  mutationControlsEnabled: false;
  summary: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    indexOnly: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderPlanningSurfaceIndex {
  id: 'video-orchestrator-provider-planning-surface-index';
  generatedAt: string;
  status: 'blocked';
  surfaceCount: 17;
  blockedCount: 17;
  visibleInBrainConsoleCount: number;
  implementationEnabledCount: 0;
  providerCallEnabledCount: 0;
  credentialAccessEnabledCount: 0;
  mutationControlEnabledCount: 0;
  pendingApprovalPhrase: 'approve-wrapper-scaffolding-only';
  entries: BrainCoreVideoProviderPlanningSurfaceIndexEntry[];
  summary: {
    surfaceCount: 17;
    blockedCount: 17;
    visibleInBrainConsoleCount: number;
    implementationEnabledCount: 0;
    providerCallEnabledCount: 0;
    credentialAccessEnabledCount: 0;
    mutationControlEnabledCount: 0;
    pendingApprovalPhrase: 'approve-wrapper-scaffolding-only';
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    indexOnly: true;
    implementationApproved: false;
    implementationEligible: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    complianceEvaluationEnabled: false;
    mutationControlsEnabled: false;
    approvalButtonsEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
}

export interface BrainCoreVideoProviderPlanningSurfaceIndexResponse {
  index: BrainCoreVideoProviderPlanningSurfaceIndex;
}

export interface BrainCoreVideoProviderRequestWrapperScaffoldProviderClass {
  providerClass: 'image-generation' | 'layout-rendering' | 'brand-compliance';
  wrapperScaffolded: true;
  callableWrapper: false;
  providerCallsEnabled: false;
  credentialAccessEnabled: false;
  networkAccessEnabled: false;
  artifactWriteEnabled: false;
  auditPersistenceEnabled: false;
}

export interface BrainCoreVideoProviderRequestWrapperScaffoldRequest {
  providerClass: 'image-generation' | 'layout-rendering' | 'brand-compliance';
  sourcePlanId: string;
  promptReviewPolicyId: string;
  credentialIsolationPlanId: string;
  artifactSandboxHandoffPlanId: string;
  outputRedactionPolicyId: string;
  complianceChecklistId: string;
  operatorApprovalRef: string;
  auditRefPlaceholder: string;
  requestIdPlaceholder: string;
}

export interface BrainCoreVideoProviderRequestWrapperScaffoldResponseShape {
  requestId: string;
  status: string;
  providerClass: string;
  redactedSummaryOnly: true;
  providerCallBlocked: true;
  executionBlocked: true;
  redactionPolicyId: string;
  auditRefPlaceholder: string;
  errorCategoryPlaceholder: string;
  noRawProviderOutput: true;
}

export interface BrainCoreVideoProviderRequestWrapperScaffoldValidationResult {
  valid: boolean;
  providerCallBlocked: true;
  executionBlocked: true;
  missingFields: string[];
  blockedReasons: string[];
}

export interface BrainCoreVideoProviderRequestWrapperScaffold {
  id: 'video-orchestrator-provider-request-wrapper-scaffold';
  status: 'scaffolded-disabled';
  phase: 'provider-request-wrapper-scaffolding-only';
  implementationApprovedScope: 'wrapper-scaffolding-only';
  providerClassCount: 3;
  wrapperScaffoldedCount: 3;
  callableWrapperCount: 0;
  providerConfiguredCount: 0;
  providerCallCount: 0;
  credentialAccessCount: 0;
  networkAccessCount: 0;
  artifactWriteCount: 0;
  auditPersistedCount: 0;
  providerClasses: BrainCoreVideoProviderRequestWrapperScaffoldProviderClass[];
  requestShape: {
    providerClass: string;
    sourcePlanId: string;
    promptReviewPolicyId: string;
    credentialIsolationPlanId: string;
    artifactSandboxHandoffPlanId: string;
    outputRedactionPolicyId: string;
    complianceChecklistId: string;
    operatorApprovalRef: string;
    auditRefPlaceholder: string;
    requestIdPlaceholder: string;
  };
  responseShape: BrainCoreVideoProviderRequestWrapperScaffoldResponseShape;
  validationRules: string[];
  disabledCapabilities: Array<{ capability: string; enabled: false }>;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnlyStatusEndpoint: true;
    wrapperScaffoldingOnly: true;
    callableWrapperImplemented: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    envReadEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
}

export interface BrainCoreVideoProviderRequestWrapperScaffoldResponse {
  scaffold: BrainCoreVideoProviderRequestWrapperScaffold;
}

export interface BrainCoreVideoProviderWrapperValidationHarnessFixtureResult {
  fixtureId: string;
  providerClass: 'image-generation' | 'layout-rendering' | 'brand-compliance' | 'unsupported-provider';
  expectedOutcome: string;
  valid: boolean;
  missingFields: string[];
  unsafeFields: string[];
  providerCallBlocked: true;
  executionBlocked: true;
  notes: string;
}

export interface BrainCoreVideoProviderWrapperValidationHarness {
  fixtureCount: number;
  passedFixtureCount: number;
  blockedFixtureCount: number;
  providerCallCount: 0;
  credentialAccessCount: 0;
  networkAccessCount: 0;
  fileWriteCount: 0;
  fixtureResults: BrainCoreVideoProviderWrapperValidationHarnessFixtureResult[];
  safety: {
    readOnlyStatusEndpoint: true;
    validationHarnessOnly: true;
    providerWrapperCallable: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    envReadEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderWrapperValidationHarnessResponse {
  harness: {
    id: 'video-orchestrator-provider-wrapper-validation-harness';
    status: 'harness-ready-disabled';
    phase: 'provider-wrapper-validation-harness-only';
    implementationApprovedScope: 'wrapper-scaffolding-only';
  } & BrainCoreVideoProviderWrapperValidationHarness;
}

export interface BrainCoreVideoCredentialReferenceScaffold {
  id: 'video-orchestrator-credential-reference-scaffold';
  status: 'scaffolded-disabled';
  phase: 'credential-reference-scaffolding-only';
  implementationApprovedScope: 'wrapper-scaffolding-only';
  providerClasses: Array<'image-generation' | 'layout-rendering' | 'brand-compliance'>;
  referenceShape: {
    credentialRefId: string;
    providerClass: string;
    scope: string;
    policyVersion: string;
    createdAtPlaceholder: string;
    expiresAtPlaceholder: string;
    rotatedAtPlaceholder: string;
    revokedAtPlaceholder: string;
    auditRefPlaceholder: string;
  };
  validationRules: string[];
  disabledCapabilities: Array<{ capability: string; enabled: false }>;
  summary: {
    providerClassCount: 3;
    referenceShapeCount: 1;
    credentialAccessCount: 0;
    credentialPersistedCount: 0;
    envReadCount: 0;
    keychainAccessCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    credentialReferenceScaffoldingOnly: true;
    credentialAccessEnabled: false;
    credentialPersistenceEnabled: false;
    rawCredentialDisplayEnabled: false;
    envReadEnabled: false;
    keychainAccessEnabled: false;
    filesystemCredentialAccessEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoCredentialReferenceScaffoldResponse {
  scaffold: BrainCoreVideoCredentialReferenceScaffold;
}

export interface BrainCoreVideoProviderRequestEnvelopeScaffold {
  id: 'video-orchestrator-provider-request-envelope-scaffold';
  status: 'scaffolded-disabled';
  phase: 'provider-request-envelope-scaffolding-only';
  envelopeShape: {
    requestIdPlaceholder: string;
    providerClass: string;
    sourcePlanId: string;
    requestWrapperScaffoldRef: string;
    credentialReferenceRef: string;
    promptReviewPolicyRef: string;
    promptReviewUxRef: string;
    artifactSandboxHandoffRef: string;
    outputRedactionPolicyRef: string;
    complianceChecklistRef: string;
    auditRefPlaceholder: string;
    createdAtPlaceholder: string;
  };
  requiredReferences: Array<
    | 'provider-request-wrapper-scaffold'
    | 'provider-wrapper-validation-harness'
    | 'credential-reference-scaffold'
    | 'design-provider-prompt-review-policy-plan'
    | 'prompt-review-ux-implementation-plan'
    | 'artifact-sandbox-provider-handoff-plan'
    | 'provider-output-redaction-policy-plan'
    | 'design-provider-compliance-checklist-plan'
    | 'provider-audit-persistence-boundary-plan'
  >;
  validationRules: string[];
  disabledCapabilities: Array<{ capability: string; enabled: false }>;
  summary: {
    envelopeShapeCount: 1;
    supportedProviderClassCount: 3;
    sendableEnvelopeCount: 0;
    providerCallCount: 0;
    networkAccessCount: 0;
    credentialAccessCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    requestEnvelopeScaffoldingOnly: true;
    sendableEnvelopeImplemented: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderRequestEnvelopeScaffoldResponse {
  envelope: BrainCoreVideoProviderRequestEnvelopeScaffold;
}

export interface BrainCoreVideoProviderResponseEnvelopeScaffold {
  id: 'video-orchestrator-provider-response-envelope-scaffold';
  status: 'scaffolded-disabled';
  phase: 'provider-response-envelope-scaffolding-only';
  responseEnvelopeShape: {
    requestId: string;
    providerClass: string;
    status: string;
    redactedSummaryOnly: true;
    outputRedactionPolicyRef: string;
    artifactManifestRefPlaceholder: string;
    auditRefPlaceholder: string;
    errorCategoryPlaceholder: string;
    noRawProviderOutput: true;
  };
  allowedFields: string[];
  prohibitedFields: string[];
  validationRules: string[];
  disabledCapabilities: Array<{ capability: string; enabled: false }>;
  summary: {
    responseEnvelopeShapeCount: 1;
    rawOutputAccessCount: 0;
    redactedManifestCreatedCount: 0;
    artifactPersistedCount: 0;
    auditPersistedCount: 0;
    providerCallCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    responseEnvelopeScaffoldingOnly: true;
    rawProviderOutputAccessEnabled: false;
    redactedManifestCreationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderResponseEnvelopeScaffoldResponse {
  envelope: BrainCoreVideoProviderResponseEnvelopeScaffold;
}

export interface BrainCoreVideoProviderScaffoldingIntegrationSummary {
  id: 'video-orchestrator-provider-scaffolding-integration-summary';
  status: 'scaffolded-disabled';
  phase: 'provider-scaffolding-integration-summary';
  scaffoldCount: 5;
  implementedScaffoldRefs: Array<
    | 'provider-request-wrapper-scaffold'
    | 'provider-wrapper-validation-harness'
    | 'credential-reference-scaffold'
    | 'provider-request-envelope-scaffold'
    | 'provider-response-envelope-scaffold'
  >;
  blockedCapabilities: string[];
  nextSafeImplementationSlices: string[];
  summary: {
    scaffoldCount: 5;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
    postRouteCount: 0;
    mutationControlCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    integrationSummaryOnly: true;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    envReadEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    rawProviderOutputAccessEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderScaffoldingIntegrationSummaryResponse {
  summary: BrainCoreVideoProviderScaffoldingIntegrationSummary;
}

export interface BrainCoreVideoProviderRequestWrapperInertShell {
  id: 'video-orchestrator-provider-request-wrapper-inert-shell';
  status: 'scaffolded-disabled';
  phase: 'provider-request-wrapper-inert-class-shell';
  implementationApprovedScope: 'wrapper-scaffolding-only';
  className: 'VideoProviderRequestWrapperInertShell';
  supportedProviderClasses: Array<'image-generation' | 'layout-rendering' | 'brand-compliance'>;
  methodSurface: Array<'describeCapabilities' | 'validateRequestShape' | 'sendRequest'>;
  blockedMethodResults: Array<{ method: 'describeCapabilities' | 'validateRequestShape' | 'sendRequest'; providerCallBlocked: true; executionBlocked: true }>;
  summary: {
    shellClassCount: 1;
    supportedProviderClassCount: 3;
    callableProviderMethodCount: 0;
    blockedMethodCount: number;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    inertShellOnly: true;
    providerCallMethodsImplemented: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    envReadEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderRequestWrapperInertShellResponse {
  shell: BrainCoreVideoProviderRequestWrapperInertShell;
}

export interface BrainCoreVideoCredentialReferenceValidatorInput {
  [key: string]: unknown;
  credentialRefId: string;
  providerClass: 'image-generation' | 'layout-rendering' | 'brand-compliance';
  scope: string;
  policyVersion: string;
  createdAtPlaceholder: string;
  expiresAtPlaceholder: string;
  rotatedAtPlaceholder: string;
  revokedAtPlaceholder: string;
  auditRefPlaceholder: string;
}

export interface BrainCoreVideoCredentialReferenceValidatorFixture {
  fixtureId: string;
  input: Partial<BrainCoreVideoCredentialReferenceValidatorInput> & Record<string, unknown>;
  expectedOutcome: string;
  notes: string;
}

export interface BrainCoreVideoCredentialReferenceValidatorFixtureResult {
  valid: boolean;
  missingFields: string[];
  unsafeFields: string[];
  providerCallBlocked: true;
  executionBlocked: true;
  credentialAccessBlocked: true;
  envReadBlocked: true;
  keychainAccessBlocked: true;
}

export interface BrainCoreVideoCredentialReferenceValidator {
  id: 'video-orchestrator-credential-reference-validator';
  status: 'scaffolded-disabled';
  phase: 'credential-reference-validator';
  implementationApprovedScope: 'wrapper-scaffolding-only';
  validatorCount: 1;
  fixtureCount: number;
  validFixtureCount: number;
  blockedFixtureCount: number;
  credentialAccessCount: 0;
  envReadCount: 0;
  keychainAccessCount: 0;
    fixtureResults: Array<BrainCoreVideoCredentialReferenceValidatorFixtureResult & {
      fixtureId: string;
      providerClass?: string;
      expectedOutcome: string;
      notes: string;
  }>;
  safety: {
    readOnlyStatusEndpoint: true;
    pureValidatorOnly: true;
    credentialAccessEnabled: false;
    credentialPersistenceEnabled: false;
    rawCredentialDisplayEnabled: false;
    envReadEnabled: false;
    keychainAccessEnabled: false;
    filesystemCredentialAccessEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    networkAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoCredentialReferenceValidatorResponse {
  validator: BrainCoreVideoCredentialReferenceValidator;
}

export interface BrainCoreVideoProviderResponseRedactionSkeletonFixtureResult {
  fixtureId: string;
  expectedOutcome: string;
  rawOutputAccessBlocked: true;
  redacted: Record<string, unknown>;
  notes: string;
}

export interface BrainCoreVideoProviderResponseRedactionSkeleton {
  id: 'video-orchestrator-provider-response-redaction-skeleton';
  status: 'scaffolded-disabled';
  phase: 'provider-response-redaction-skeleton';
  implementationApprovedScope: 'wrapper-scaffolding-only';
  redactionFunctionCount: 1;
  fixtureCount: number;
  redactedFixtureCount: number;
  rawOutputAccessCount: 0;
  redactedManifestCreatedCount: 0;
  artifactPersistedCount: 0;
  auditPersistedCount: 0;
  fixtureResults: BrainCoreVideoProviderResponseRedactionSkeletonFixtureResult[];
  safety: {
    readOnlyStatusEndpoint: true;
    pureRedactionSkeletonOnly: true;
    rawProviderOutputAccessEnabled: false;
    redactedManifestCreationEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderResponseRedactionSkeletonResponse {
  skeleton: BrainCoreVideoProviderResponseRedactionSkeleton;
}

export interface BrainCoreVideoProviderAuditEventTypes {
  id: 'video-orchestrator-provider-audit-event-types';
  status: 'scaffolded-disabled';
  phase: 'provider-audit-event-type-definitions';
  eventTypes: Array<
    | 'provider_request_scaffold_validated'
    | 'credential_reference_validated'
    | 'request_envelope_validated'
    | 'response_envelope_redacted'
    | 'provider_call_blocked'
    | 'credential_access_blocked'
    | 'audit_persistence_blocked'
  >;
  eventShape: {
    eventType: string;
    providerClass: string;
    sourcePlanId: string;
    requestIdPlaceholder: string;
    redactedSummaryOnly: true;
    policyVersion: string;
    auditRefPlaceholder: string;
    createdAtPlaceholder: string;
    noRawProviderOutput: true;
  };
  prohibitedFields: string[];
  summary: {
    eventTypeCount: 7;
    auditPersistenceCount: 0;
    auditAppendCount: 0;
    rawOutputAccessCount: 0;
    credentialAccessCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    eventTypeDefinitionsOnly: true;
    auditPersistenceEnabled: false;
    auditAppendEnabled: false;
    auditMutationEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    rawProviderOutputAccessEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderAuditEventTypesResponse {
  audit: BrainCoreVideoProviderAuditEventTypes;
}

export interface BrainCoreVideoProviderDisabledOrchestrationFacade {
  id: 'video-orchestrator-provider-disabled-orchestration-facade';
  status: 'facade-disabled';
  phase: 'provider-disabled-orchestration-facade';
  approvedScope: 'wrapper-scaffolding-only';
  composedScaffoldRefs: string[];
  methodSurface: {
    describePipeline: { blocked: true; reason: string };
    validateEnvelopeOnly: { blocked: true; reason: string };
    redactFixtureOnly: { blocked: true; reason: string };
    describeAuditEventOnly: { blocked: true; reason: string };
    attemptProviderCallDisabled: { blocked: true; reason: string };
  };
  blockedActionResults: Array<{
    action: string;
    providerCallBlocked: true;
    credentialAccessBlocked: true;
    networkAccessBlocked: true;
    executionBlocked: true;
  }>;
  summary: {
    facadeCount: 1;
    composedScaffoldCount: 9;
    blockedMethodCount: 5;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
    executionCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    disabledFacadeOnly: true;
    orchestrationExecutionEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    envReadEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    rawProviderOutputAccessEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderDisabledOrchestrationFacadeResponse {
  facade: BrainCoreVideoProviderDisabledOrchestrationFacade;
}

export interface BrainCoreVideoProviderCapabilityPolicy {
  capability:
    | 'provider-call'
    | 'credential-access'
    | 'env-read'
    | 'network-access'
    | 'prompt-generation'
    | 'image-generation'
    | 'raw-output-access'
    | 'artifact-write'
    | 'audit-persist'
    | 'brain-console-mutation-control'
    | 'post-route'
    | 'publishing'
    | 'decommissioning';
  allowed: false;
  reason: string;
  requiresExplicitApproval: true;
}

export interface BrainCoreVideoProviderCapabilityPolicyEvaluator {
  id: 'video-orchestrator-provider-capability-policy-evaluator';
  status: 'facade-disabled';
  phase: 'provider-capability-policy-evaluator';
  capabilities: BrainCoreVideoProviderCapabilityPolicy[];
  summary: {
    evaluatorCount: 1;
    capabilityCount: 13;
    allowedCapabilityCount: 0;
    deniedCapabilityCount: 13;
    providerCallAllowedCount: 0;
    credentialAccessAllowedCount: 0;
    networkAccessAllowedCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    purePolicyEvaluatorOnly: true;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    envReadEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    rawProviderOutputAccessEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    mutationControlsEnabled: false;
    postRoutesAdded: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
  };
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderCapabilityPolicyEvaluatorResponse {
  evaluator: BrainCoreVideoProviderCapabilityPolicyEvaluator;
}

export interface BrainCoreVideoProviderBlockedActionLedgerEntry {
  blockedActionIdPlaceholder: string;
  actionType:
    | 'provider_call_blocked'
    | 'credential_access_blocked'
    | 'env_read_blocked'
    | 'network_access_blocked'
    | 'prompt_generation_blocked'
    | 'image_generation_blocked'
    | 'raw_output_access_blocked'
    | 'artifact_write_blocked'
    | 'audit_persist_blocked'
    | 'mutation_control_blocked'
    | 'post_route_blocked';
  providerClass: string;
  sourcePlanId: string;
  blockedReason: string;
  requiredApproval: string;
  policyVersion: string;
  redactedSummaryOnly: true;
  createdAtPlaceholder: string;
  auditRefPlaceholder: string;
  noRawProviderOutput: true;
  noCredentials: true;
}

export interface BrainCoreVideoProviderBlockedActionLedgerTypes {
  id: 'video-orchestrator-provider-blocked-action-ledger-types';
  status: 'facade-disabled';
  phase: 'provider-blocked-action-ledger-types';
  blockedActionTypes: BrainCoreVideoProviderBlockedActionLedgerEntry['actionType'][];
  ledgerEntryShape: BrainCoreVideoProviderBlockedActionLedgerEntry;
  summary: {
    blockedActionTypeCount: 11;
    ledgerPersistenceCount: 0;
    appendEnabledCount: 0;
    mutationEnabledCount: 0;
    rawOutputAccessCount: 0;
    credentialAccessCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    ledgerTypeDefinitionsOnly: true;
    ledgerPersistenceEnabled: false;
    ledgerAppendEnabled: false;
    ledgerMutationEnabled: false;
    providerConfigured: false;
    providerCallsEnabled: false;
    rawProviderOutputAccessEnabled: false;
    credentialAccessEnabled: false;
    networkAccessEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderBlockedActionLedgerTypesResponse {
  ledger: BrainCoreVideoProviderBlockedActionLedgerTypes;
}

export interface BrainCoreVideoProviderDisabledOrchestrationIntegrationSummary {
  id: 'video-orchestrator-provider-disabled-orchestration-integration-summary';
  status: 'facade-disabled';
  phase: 'provider-disabled-orchestration-integration-summary';
  integratedRefs: string[];
  blockedCapabilities: string[];
  nextSafeImplementationSlices: string[];
  summary: {
    integratedRefCount: 8;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
    ledgerPersistCount: 0;
    postRouteCount: 0;
    mutationControlCount: 0;
  };
  safety: {
    readOnlyStatusEndpoint: true;
    integrationSummaryOnly: true;
    providerConfigured: false;
    providerCallsEnabled: false;
    credentialAccessEnabled: false;
    envReadEnabled: false;
    networkAccessEnabled: false;
    promptGenerationEnabled: false;
    imageGenerationEnabled: false;
    rawProviderOutputAccessEnabled: false;
    artifactPersistenceEnabled: false;
    auditPersistenceEnabled: false;
    ledgerPersistenceEnabled: false;
    filesystemAccessEnabled: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    executesVideo: false;
    postRoutesAdded: false;
    brainConsoleMutationControlsEnabled: false;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderDisabledOrchestrationIntegrationSummaryResponse {
  summary: BrainCoreVideoProviderDisabledOrchestrationIntegrationSummary;
}

export interface BrainCoreVideoProviderBlockedActionRecorderSkeleton {
  id: 'video-orchestrator-provider-blocked-action-recorder-skeleton';
  status: 'scaffolded-disabled';
  phase: 'blocked-action-recorder-skeleton-without-persistence';
  approvedScope: 'wrapper-scaffolding-only';
  fixtureCount: number;
  recordedFixtureCount: number;
  persistedRecordCount: 0;
  appendCount: 0;
  externalMutationCount: 0;
  fixtureResults: Array<{
    actionType: string;
    providerClass: string;
    sourcePlanId: string;
    persisted: false;
    appended: false;
    externalMutation: false;
    providerCallBlocked: true;
    credentialAccessBlocked: true;
    networkAccessBlocked: true;
    executionBlocked: true;
    redactedSummaryOnly: true;
  }>;
  summary: {
    fixtureCount: number;
    recordedCount: number;
    persistedCount: 0;
    appendCount: 0;
    mutationCount: 0;
  };
  safety: Record<string, boolean>;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderBlockedActionRecorderSkeletonResponse {
  skeleton: BrainCoreVideoProviderBlockedActionRecorderSkeleton;
}

export interface BrainCoreVideoProviderFixtureOrchestrationTestsSummary {
  id: 'video-orchestrator-provider-fixture-orchestration-tests-summary';
  status: 'scaffolded-disabled';
  phase: 'provider-fixture-orchestration-tests-summary';
  fixtureSuites: string[];
  summary: {
    fixtureSuiteCount: number;
    fixtureCount: number;
    passedFixtureCount: 0;
    blockedFixtureCount: number;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
    persistenceCount: 0;
  };
  safety: Record<string, boolean>;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderFixtureOrchestrationTestsSummaryResponse {
  summary: BrainCoreVideoProviderFixtureOrchestrationTestsSummary;
}

export interface BrainCoreVideoProviderSafetyRegressionIndex {
  id: 'video-orchestrator-provider-safety-regression-index';
  status: 'scaffolded-disabled';
  phase: 'provider-safety-regression-index';
  indexedModules: string[];
  forbiddenPatterns: string[];
  forbiddenCapabilities: string[];
  expectedDisabledFlags: string[];
  summary: {
    indexedModuleCount: number;
    forbiddenPatternCount: 10;
    forbiddenCapabilityCount: 14;
    expectedDisabledFlagCount: number;
    expectedProviderCallCount: 0;
    expectedCredentialAccessCount: 0;
    expectedNetworkAccessCount: 0;
    expectedWriteCount: 0;
  };
  safety: Record<string, boolean>;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderSafetyRegressionIndexResponse {
  index: BrainCoreVideoProviderSafetyRegressionIndex;
}

export interface BrainCoreVideoProviderScaffoldingCompletionCheckpoint {
  id: 'video-orchestrator-provider-scaffolding-completion-checkpoint';
  status: 'scaffolded-disabled';
  phase: 'provider-scaffolding-completion-checkpoint';
  completedScaffoldRefs: string[];
  remainingBlockedCapabilities: string[];
  nextSafeImplementationSlices: string[];
  implementationNotApprovedFor: string[];
  summary: {
    completedScaffoldCount: 17;
    remainingBlockedCapabilityCount: 14;
    nextSafeSliceCount: number;
    providerCallCount: 0;
    credentialAccessCount: 0;
    networkAccessCount: 0;
    persistenceCount: 0;
    mutationControlCount: 0;
  };
  safety: Record<string, boolean>;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCoreVideoProviderScaffoldingCompletionCheckpointResponse {
  checkpoint: BrainCoreVideoProviderScaffoldingCompletionCheckpoint;
}

// ─── Infrastructure adapters ──────────────────────────────────────────────────

export interface BrainCoreInfraDokployApp {
  project: string;
  environment: string;
  name: string;
  status: string;
}

export interface BrainCoreInfraDokployCompose {
  project: string;
  environment: string;
  name: string;
  status: string;
}

export interface BrainCoreInfraDokployResponse {
  status: 'ok' | 'not-configured' | 'error';
  apps: BrainCoreInfraDokployApp[];
  compose: BrainCoreInfraDokployCompose[];
  totalApps: number;
  totalCompose: number;
  appsByStatus: Record<string, number>;
  composeByStatus: Record<string, number>;
  error?: string;
}

export interface BrainCoreInfraTunnel {
  id: string;
  name: string;
  status: string;
  hostnames: Array<{ hostname: string; service: string; online: boolean | null }>;
}

export interface BrainCoreInfraTunnelsResponse {
  status: 'ok' | 'not-configured' | 'error';
  tunnels: BrainCoreInfraTunnel[];
  error?: string;
}

export type BrainCoreInfraSchedulerJobStatus = 'success' | 'failed' | 'timeout' | 'never' | 'running';

export interface BrainCoreInfraSchedulerJob {
  key: string;
  label: string;
  planned: true;
  executed: boolean;
  status: BrainCoreInfraSchedulerJobStatus;
  exitCode: number | null;
  durationSeconds: number | null;
  lastRunAt: string | null;
  nextRunAt: string;
  errorMessage: string | null;
}

export interface BrainCoreInfraSchedulerReport {
  available: boolean;
  path: string;
  summary: string;
  generatedAt: string | null;
  failureCount: number;
}

export interface BrainCoreInfraSchedulerResponse {
  status: 'ok' | 'not-configured' | 'error';
  jobs: BrainCoreInfraSchedulerJob[];
  totalJobs: number;
  plannedJobs: number;
  executedJobs: number;
  runningJobs: number;
  successfulJobs: number;
  failedJobs: number;
  timeoutJobs: number;
  neverRunJobs: number;
  nextRunAt: string;
  report: BrainCoreInfraSchedulerReport;
  error?: string;
}

export interface BrainCoreInfraDomain {
  name: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
}

export interface BrainCoreInfraDomainsResponse {
  status: 'ok' | 'not-configured' | 'error';
  domains: BrainCoreInfraDomain[];
  error?: string;
}

export interface BrainCoreInfraNewRelicHost {
  name: string;
  reporting: boolean;
  alertSeverity: string | null;
  online: boolean | null;
  lastSeenAt: string | null;
}

export interface BrainCoreInfraNewRelicSynthetic {
  name: string;
  reporting: boolean;
  alertSeverity: string | null;
  monitorId?: string;
  online: boolean | null;
  lastCheckAt: string | null;
  lastResult: string | null;
  lastError: string | null;
}

export interface BrainCoreInfraNewRelicResponse {
  status: 'ok' | 'not-configured' | 'error';
  hosts: BrainCoreInfraNewRelicHost[];
  synthetics: BrainCoreInfraNewRelicSynthetic[];
  error?: string;
}

export interface BrainCoreInfraUmamiWebsite {
  id: string;
  name: string;
  domain: string;
  active: number;
  pageviews: number;
  visitors: number;
  visits: number;
  bounceRate: number;
  error?: string;
}

export interface BrainCoreInfraUmamiResponse {
  status: 'ok' | 'not-configured' | 'error';
  websites: BrainCoreInfraUmamiWebsite[];
  error?: string;
}

export interface BrainCoreInfraGoogleAdsResponse {
  status: 'ok' | 'not-configured' | 'error';
  lastSync: string | null;
  dailyBudgetUSD: number;
  targetBudgetUSD: number;
  percentOfTarget: number;
  dayOfMonth: number;
  daysInMonth: number;
  lastMetricsDate: string | null;
  pendingMutations: number;
  mutationStatsByStatus: Record<string, number>;
  error?: string;
}

export interface BrainCoreInfraStripeAccount {
  profileName: string;
  displayName: string;
  liveAvailableAmount: number | null;
  livePendingAmount: number | null;
  liveCurrency: string | null;
  testAvailableAmount: number | null;
  testPendingAmount: number | null;
  error?: string;
}

export interface BrainCoreInfraStripeResponse {
  status: 'ok' | 'not-configured' | 'error';
  accounts: BrainCoreInfraStripeAccount[];
  error?: string;
}

export interface BrainCoreInfraStudioTopic {
  id: string;
  title: string;
  trendScore: number;
  source: string;
  createdAt: string;
}

export interface BrainCoreInfraStudioScript {
  id: string;
  title: string;
  format: string;
  estimatedDurationMinutes: number;
  createdAt: string;
}

export interface BrainCoreInfraStudioBatch {
  batchId: string;
  topic: string;
  stage: string;
  stages: Record<string, { completed: boolean; inProgress: boolean }>;
  errors: string[];
}

export interface BrainCoreInfraStudioAccount {
  id: string;
  platform: string;
  name: string;
  status: string;
  lastPost: string | null;
}

export interface BrainCoreInfraViralFlowSummary {
  accountCount: number;
  accounts: BrainCoreInfraStudioAccount[];
  activeTopicCount: number;
  recentTopics: BrainCoreInfraStudioTopic[];
  recentScripts: BrainCoreInfraStudioScript[];
  activeBatch: BrainCoreInfraStudioBatch | null;
  performance: {
    totalVideos: number;
    totalViews: number;
    avgEngagementRate: number;
    topVideos: Array<{ title: string; views: number; platform: string }>;
  };
  lastUpdated: string;
}

export interface BrainCoreInfraVideoOrchestratorAccountEntry {
  platform: string;
  count: number;
  postedToday: number;
}

export interface BrainCoreInfraVideoOrchestratorSummary {
  databaseStatus: string;
  totalVideos: number;
  totalAccounts: number;
  pendingJobs: number;
  runningJobs: number;
  failedJobs7d: number;
  completedPackages: number;
  completionRate: number;
  accountSummary?: BrainCoreInfraVideoOrchestratorAccountEntry[];
  error?: string;
}

export interface BrainCoreInfraStudioResponse {
  status: 'ok' | 'not-configured' | 'partial' | 'error';
  viralFlow: BrainCoreInfraViralFlowSummary | null;
  videoOrchestrator: BrainCoreInfraVideoOrchestratorSummary | null;
  error?: string;
}

export interface BrainCoreInfraVOQueueDepth {
  pending: number;
  running: number;
  failed: number;
  dead?: number;
}

export interface BrainCoreInfraVONormalizeJob {
  jobId: string;
  status: string;
  inputPath: string;
  outputDir: string;
  formats: string[];
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  outputFiles: string[];
}

export interface BrainCoreInfraVONormalizeHistoryResponse {
  ok: boolean;
  jobs: BrainCoreInfraVONormalizeJob[];
  totalCount: number;
  error?: string;
}

export interface BrainCoreInfraVOManualPostingJob {
  jobId: string;
  platform: string;
  accountHandle: string;
  title: string;
  videoPath: string;
  instructionsPath: string;
  status: string;
  createdAt: string;
  hasInstructions: boolean;
}

export interface BrainCoreInfraVOManualQueueResponse {
  ok: boolean;
  jobs: BrainCoreInfraVOManualPostingJob[];
  totalCount: number;
  error?: string;
}

export interface BrainCoreInfraVOWorkerConfig {
  n8nWebhookUrl: string;
  n8nWebhookConfigured: boolean;
  cfAccessConfigured: boolean;
  cfAccessClientIdPresent: boolean;
  cfAccessClientSecretPresent: boolean;
  n8nReachable: boolean | null;
  n8nReachableError: string | null;
  youtubeOauthConfigured: boolean;
  youtubeOauthAccounts: string[];
}

export interface BrainCoreInfraVOWorkerConfigResponse {
  ok: boolean;
  config: BrainCoreInfraVOWorkerConfig | null;
  manualActionsRequired: string[];
  error?: string;
}

export interface BrainCoreInfraVORecentPost {
  jobId: string;
  platform: string;
  accountHandle: string;
  title: string;
  postedAt: string;
  pipelineState: string;
}

export interface BrainCoreInfraVOAnalyticsSnapshot {
  totalViews7d: number;
  avgEngagement7d: number;
  topPlatform: string;
}

export interface BrainCoreInfraVOStatusResponse {
  ok: boolean;
  queueDepth?: BrainCoreInfraVOQueueDepth;
  jobsByType?: Record<string, number>;
  activeAccounts?: number;
  accountsByPlatform?: Record<string, number>;
  recentPosts?: BrainCoreInfraVORecentPost[];
  analyticsSnapshot?: BrainCoreInfraVOAnalyticsSnapshot;
  lastJobAt?: string | null;
  error?: string;
}

export interface BrainCoreInfraVOAccountStat {
  accountId: string;
  accountHandle: string;
  platform: string;
  totalJobs30d: number;
  succeededJobs30d: number;
  failedJobs30d: number;
  successRate30d: number | null;
  lastJobAt: string | null;
  lastSucceededAt: string | null;
  lastAdapterMode: string | null;
}

export interface BrainCoreInfraVOAccountStatsResponse {
  ok: boolean;
  stats: BrainCoreInfraVOAccountStat[];
  error?: string;
}

export interface BrainCoreInfraVOReadinessCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'warn' | 'unknown';
  detail: string;
}

export interface BrainCoreInfraVOReadinessResponse {
  ok: boolean;
  status: 'ready' | 'partial' | 'blocked';
  readinessScore: number;
  checks: BrainCoreInfraVOReadinessCheck[];
  passCount: number;
  failCount: number;
  warnCount: number;
  manualActionsRequired: string[];
  error?: string;
}

// ─── Storage Cleanup ──────────────────────────────────────────────────────────

export interface InfraVOStorageStats {
  ok: boolean;
  status: string;
  dirs_scanned: number;
  total_files: number;
  total_bytes: number;
  oldest_job_age_seconds: number;
  eligible_for_cleanup_30d: boolean;
}

export interface InfraVOStorageCleanupRequest {
  retention_days?: number;
  dry_run?: boolean;
}

export interface InfraVOStorageCleanupCandidate {
  job_id: string;
  completed_at: string | null;
  output_dir: string;
  size_bytes: number;
  archive_path?: string;
}

export interface InfraVOStorageCleanupResponse {
  ok: boolean;
  status: string;
  retention_days: number;
  dry_run: boolean;
  candidate_count: number;
  archived_count: number;
  candidates: InfraVOStorageCleanupCandidate[];
}

// ─── Agent Orchestrator ───────────────────────────────────────────────────────

export type AgentOrchestratorExecutorType = 'gemini' | 'claude' | 'codex' | 'bash' | 'n8n';
export type AgentOrchestratorTaskType =
  | 'ai_analysis'
  | 'ai_generation'
  | 'code_change'
  | 'file_operation'
  | 'external_api_call'
  | 'approval_gate';
export type AgentOrchestratorTaskStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked';
export type AgentOrchestratorPlanStatus =
  | 'planning'
  | 'executing'
  | 'completed'
  | 'failed';

export interface AgentOrchestratorTask {
  id: string;
  description: string;
  type: AgentOrchestratorTaskType;
  dependencies: string[];
  status: AgentOrchestratorTaskStatus;
  executorType: AgentOrchestratorExecutorType;
  prompt?: string;
  result?: unknown;
  error?: string;
}

export interface AgentOrchestratorPlan {
  id: string;
  projectId: string;
  goal: string;
  tasks: AgentOrchestratorTask[];
  createdAt: string;
  completedAt?: string;
  status: AgentOrchestratorPlanStatus;
  approvalGates: string[];
}

export interface AgentOrchestratorRunRecord {
  taskId: string;
  outcome: 'completed' | 'failed';
  data: unknown;
  timestamp: string;
}

export interface AgentOrchestratorApprovalDecision {
  id: number;
  planId: string;
  taskId: string;
  approved: boolean;
  approvedBy: string | undefined;
  approvedAt: string;
}

export interface AgentOrchestratorExecuteResult {
  ok: boolean;
  results: Array<[string, unknown]>;
  errors: Array<[string, string]>;
  ledger: AgentOrchestratorRunRecord[];
}

export interface AgentOrchestratorPlanResponse {
  ok: true;
  plan: AgentOrchestratorPlan;
}

export interface AgentOrchestratorApprovalResponse {
  ok: true;
}

// ── Video Orchestrator Metadata ───────────────────────────────────────────────

/**
 * Input type for the video orchestrator metadata generator.
 * Mirrors VideoOrchestratorMetadataInput in the adapter — kept here for
 * cross-adapter type safety and API contract documentation.
 */
export interface VideoOrchestratorMetadataInput {
  projectId: string;
  contentItemId: string;
  title?: string;
  description?: string;
  targetPlatforms?: Array<'youtube' | 'tiktok' | 'instagram' | 'facebook' | 'linkedin' | 'bluesky'>;
  templateId?: string;
}

/**
 * Per-platform capability descriptor returned by the platform-specs endpoint.
 */
export interface PlatformSpec {
  platform: string;
  max_description: number;
  max_hashtags: number;
  adapter_status: 'manual_only' | 'partially_supported' | 'fully_supported';
}
