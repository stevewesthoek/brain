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

export interface BrainCoreOrchestratorSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'unknown' | 'disabled';
  source: 'placeholder';
  actionsSupported: boolean;
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
  notes: string[];
}

export interface BrainCoreApprovalSummary {
  id: string;
  kind: string;
  status: 'placeholder' | 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  source: 'placeholder' | 'memory';
}

export interface BrainCoreActionRequestResult {
  approval?: BrainCoreApprovalSummary;
  accepted: boolean;
  executed: false;
  message: string;
}

export interface BrainCoreApprovalDecisionResult {
  approval: BrainCoreApprovalSummary;
  accepted: true;
  executed: false;
  message: string;
}

export interface BrainCoreApprovalAuditEvent {
  id: string;
  approvalId: string;
  event: 'requested' | 'approved' | 'rejected' | 'missing';
  kind: string;
  createdAt: string;
  persisted: boolean;
  executed: false;
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
  '/orchestrators': {
    orchestrators: BrainCoreOrchestratorSummary[];
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
}
