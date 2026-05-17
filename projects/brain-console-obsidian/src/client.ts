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
  notes: string[];
}

export type BrainCoreRuntimeReportId = 'model-router' | 'approval-audit' | 'video';

export interface BrainCoreRuntimeReportSummary {
  id: BrainCoreRuntimeReportId;
  status: 'available' | 'missing' | 'invalid';
  path: string;
  latestRunStatus: 'ok' | 'failed' | 'unknown';
  message: string;
  writesToMind: false;
  executableActions: false;
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

export interface BrainCoreApprovalSummary {
  id: string;
  kind: string;
  status: 'placeholder' | 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  source: 'placeholder' | 'memory';
}

export interface BrainCoreApprovalStoreSummary {
  enabled: boolean;
  status: 'memory' | 'available' | 'invalid' | 'unsafe';
  path: string;
  recordCount: number;
  writesToMind: false;
  executableActions: false;
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
}

interface HttpResult<T> {
  value?: T;
  error?: string;
}

const REQUEST_TIMEOUT_MS = 1_500;

export async function readBrainConsoleSnapshot(baseUrl: string): Promise<BrainConsoleSnapshot> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const [status, capabilities, runtimeReports, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore] = await Promise.all([
    fetchJson<BrainCoreStatus>(normalizedBaseUrl, '/status'),
    fetchJson<BrainCoreCapabilitySummary>(normalizedBaseUrl, '/capabilities'),
    fetchJson<{ reports?: BrainCoreRuntimeReportSummary[] }>(normalizedBaseUrl, '/runtime/reports'),
    fetchJson<BrainCoreSchedulerStatus>(normalizedBaseUrl, '/scheduler/status'),
    fetchJson<{ jobs?: BrainCoreSchedulerJobSummary[] }>(normalizedBaseUrl, '/scheduler/jobs'),
    fetchJson<{ sessions?: BrainCoreSessionSummary[] }>(normalizedBaseUrl, '/sessions'),
    fetchJson<{ repos?: BrainCoreRepoSummary[] }>(normalizedBaseUrl, '/repos'),
    fetchJson<{ approvals?: BrainCoreApprovalSummary[] }>(normalizedBaseUrl, '/approvals'),
    fetchJson<BrainCoreApprovalStoreSummary>(normalizedBaseUrl, '/approvals/store'),
  ]);
  const [videoStatus, videoQueue, localApps] = await Promise.all([
    readBrainCoreVideoStatus(normalizedBaseUrl),
    readBrainCoreVideoQueue(normalizedBaseUrl),
    readBrainCoreLocalApps(normalizedBaseUrl),
  ]);

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

export async function readBrainCoreVideoStatus(baseUrl: string): Promise<HttpResult<BrainCoreVideoStatus>> {
  return fetchJson<BrainCoreVideoStatus>(normalizeBaseUrl(baseUrl), '/video/status');
}

export async function readBrainCoreVideoQueue(baseUrl: string): Promise<HttpResult<{ queue?: BrainCoreVideoQueueItem[] }>> {
  return fetchJson<{ queue?: BrainCoreVideoQueueItem[] }>(normalizeBaseUrl(baseUrl), '/video/queue');
}

export async function readBrainCoreLocalApps(baseUrl: string): Promise<HttpResult<{ apps?: BrainCoreLocalAppSummary[] }>> {
  return fetchJson<{ apps?: BrainCoreLocalAppSummary[] }>(normalizeBaseUrl(baseUrl), '/local-apps');
}

async function fetchJson<T>(baseUrl: string, pathname: string): Promise<HttpResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    return { value: (await response.json()) as T };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(rawValue: string): string {
  return rawValue.replace(/\/+$/g, '');
}
