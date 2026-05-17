export interface BrainCoreStatusResponse {
  service: 'brain-core';
  mode: 'read-only';
  ok: boolean;
  startedAt: string;
  uptimeSeconds: number;
  version: string;
  host: string;
}

export interface BrainCoreCapabilitiesResponse {
  executableActionsEnabled: boolean;
  runtimeReportsSupported?: boolean;
}

export interface BrainCoreRuntimeReportSummary {
  id: string;
  status: 'available' | 'missing' | 'invalid';
  latestRunStatus: 'ok' | 'failed' | 'unknown';
}

export interface BrainCoreVideoStatusResponse {
  status: 'placeholder' | 'not-configured' | 'ok' | 'failed' | 'unknown';
  enabled: boolean;
  queueDepth: number;
  latestRunAt?: string;
  source?: 'placeholder' | 'runtime-report';
  message: string;
}

export interface BrainCoreVideoQueueResponse {
  queue: Array<{ id: string; title: string; status: string; source?: string }>;
}

export interface BrainCoreLocalAppsResponse {
  apps: Array<{ id: string; name: string; status: string; actionsSupported: boolean; source?: string }>;
}

export interface BrainCoreRuntimeReportsResponse {
  reports: BrainCoreRuntimeReportSummary[];
}

export interface BrainCoreSessionsResponse {
  sessions: Array<{ id: string }>;
}

export interface BrainCoreSchedulerJobsResponse {
  jobs: Array<{ id: string; status?: string }>;
}

export interface BrainCoreApprovalsResponse {
  approvals: Array<{ id: string; status?: string }>;
}

export interface BrainCoreStatusSummary {
  available: boolean;
  line: string;
}

export interface BrainCoreCapabilitySummary {
  available: boolean;
  executableActionsEnabled: boolean;
  runtimeReportsSupported: boolean;
  line: string;
}

export interface BrainCoreRuntimeReportsSummary {
  available: boolean;
  reports: BrainCoreRuntimeReportSummary[];
  line: string;
}

export interface BrainCoreVideoSummary {
  available: boolean;
  status: string;
  queueDepth: number;
  line: string;
}

export interface BrainCoreLocalAppsSummary {
  available: boolean;
  count: number;
  line: string;
}

export interface BrainCoreSessionsSummary {
  available: boolean;
  count: number;
  line: string;
}

export interface BrainCoreSchedulerJobsSummary {
  available: boolean;
  count: number;
  line: string;
}

export interface BrainCoreApprovalsSummary {
  available: boolean;
  count: number;
  line: string;
}

export async function readBrainCoreStatus(baseUrl: string): Promise<BrainCoreStatusSummary> {
  const response = await readBrainCoreStatusResponse(baseUrl);
  if (!response) {
    return { available: false, line: 'Brain Core: unavailable' };
  }
  return {
    available: true,
    line: `Brain Core: ${response.ok ? 'ok' : 'not ok'} · ${response.mode} · ${response.host}`,
  };
}

export async function readBrainCoreStatusLine(baseUrl: string): Promise<string> {
  return (await readBrainCoreStatus(baseUrl)).line;
}

export async function readBrainCoreCapabilities(baseUrl: string): Promise<BrainCoreCapabilitySummary> {
  const response = await readJson<BrainCoreCapabilitiesResponse>(baseUrl, '/capabilities');
  if (!response) {
    return { available: false, executableActionsEnabled: false, runtimeReportsSupported: false, line: 'Brain Core capabilities: unavailable' };
  }
  return {
    available: true,
    executableActionsEnabled: response.executableActionsEnabled,
    runtimeReportsSupported: response.runtimeReportsSupported === true,
    line: `Brain Core capabilities: executableActionsEnabled=${response.executableActionsEnabled} runtimeReportsSupported=${response.runtimeReportsSupported === true}`,
  };
}

export async function readBrainCoreRuntimeReports(baseUrl: string): Promise<BrainCoreRuntimeReportsSummary> {
  const response = await readJson<BrainCoreRuntimeReportsResponse>(baseUrl, '/runtime/reports');
  if (!response) {
    return { available: false, reports: [], line: 'Brain Core runtime reports: unavailable' };
  }
  return {
    available: true,
    reports: response.reports,
    line: `Brain Core runtime reports: ${response.reports.map((report) => `${report.id}=${report.status}`).join(', ')}`,
  };
}

export async function readBrainCoreVideo(baseUrl: string): Promise<BrainCoreVideoSummary> {
  const response = await readJson<BrainCoreVideoStatusResponse>(baseUrl, '/video/status');
  if (!response) {
    return { available: false, status: 'unavailable', queueDepth: 0, line: 'Brain Core video: unavailable' };
  }
  return {
    available: true,
    status: response.status,
    queueDepth: response.queueDepth,
    line: `Brain Core video: ${response.status} · queueDepth=${response.queueDepth}`,
  };
}

export async function readBrainCoreLocalApps(baseUrl: string): Promise<BrainCoreLocalAppsSummary> {
  const response = await readJson<BrainCoreLocalAppsResponse>(baseUrl, '/local-apps');
  if (!response) {
    return { available: false, count: 0, line: 'Brain Core local apps: unavailable' };
  }
  return {
    available: true,
    count: response.apps.length,
    line: `Brain Core local apps: ${response.apps.length}`,
  };
}

export async function readBrainCoreSessions(baseUrl: string): Promise<BrainCoreSessionsSummary> {
  const response = await readJson<BrainCoreSessionsResponse>(baseUrl, '/sessions');
  if (!response) {
    return { available: false, count: 0, line: 'Brain Core sessions: unavailable' };
  }
  return {
    available: true,
    count: response.sessions.length,
    line: `Brain Core sessions: ${response.sessions.length}`,
  };
}

export async function readBrainCoreSchedulerJobs(baseUrl: string): Promise<BrainCoreSchedulerJobsSummary> {
  const response = await readJson<BrainCoreSchedulerJobsResponse>(baseUrl, '/scheduler/jobs');
  if (!response) {
    return { available: false, count: 0, line: 'Brain Core scheduler jobs: unavailable' };
  }
  return {
    available: true,
    count: response.jobs.length,
    line: `Brain Core scheduler jobs: ${response.jobs.length}`,
  };
}

export async function readBrainCoreApprovals(baseUrl: string): Promise<BrainCoreApprovalsSummary> {
  const response = await readJson<BrainCoreApprovalsResponse>(baseUrl, '/approvals');
  if (!response) {
    return { available: false, count: 0, line: 'Brain Core approvals: unavailable' };
  }
  return {
    available: true,
    count: response.approvals.length,
    line: `Brain Core approvals: ${response.approvals.length}`,
  };
}

async function readBrainCoreStatusResponse(baseUrl: string): Promise<BrainCoreStatusResponse | undefined> {
  return readJson(baseUrl, '/status');
}

async function readJson<T>(baseUrl: string, pathname: string): Promise<T | undefined> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);

  try {
    const response = await fetch(`${normalizedBaseUrl}${pathname}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) return undefined;
    return (await response.json()) as T;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}
