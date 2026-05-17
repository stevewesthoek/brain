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

export interface BrainCoreRuntimeReportsResponse {
  reports: BrainCoreRuntimeReportSummary[];
}

export interface BrainCoreSessionsResponse {
  sessions: Array<{ id: string }>;
}

export async function readBrainCoreStatusLine(baseUrl: string): Promise<string> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);

  try {
    const response = await fetch(`${normalizedBaseUrl}/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return `Brain Core: unavailable (${response.status})`;
    }

    const body = (await response.json()) as Partial<BrainCoreStatusResponse>;
    if (body.service !== 'brain-core') {
      return 'Brain Core: unexpected response';
    }

    return `Brain Core: ${body.ok ? 'ok' : 'not ok'} · ${body.mode ?? 'unknown'} · ${body.host ?? 'unknown host'}`;
  } catch {
    return 'Brain Core: unavailable';
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBrainCoreCapabilities(baseUrl: string): Promise<BrainCoreCapabilitiesResponse | undefined> {
  return readJson(baseUrl, '/capabilities');
}

export async function readBrainCoreRuntimeReports(
  baseUrl: string,
): Promise<BrainCoreRuntimeReportsResponse | undefined> {
  return readJson(baseUrl, '/runtime/reports');
}

export async function readBrainCoreSessions(baseUrl: string): Promise<BrainCoreSessionsResponse | undefined> {
  return readJson(baseUrl, '/sessions');
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
