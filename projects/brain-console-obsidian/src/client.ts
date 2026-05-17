export interface BrainConsoleClientSummary {
  status: string;
  sessions: string;
  repos: string;
  orchestrators: string;
  capabilities: string;
  scheduler: string;
  localApps: string;
  video: string;
  approvals: string;
  runtimeReports: string;
}

interface BrainCoreJsonResponse {
  ok?: boolean;
  executableActionsEnabled?: boolean;
  reports?: Array<{ id?: string; status?: string }>;
  sessions?: unknown[];
  approvals?: unknown[];
  jobs?: unknown[];
}

export async function readBrainConsoleSummary(baseUrl: string): Promise<BrainConsoleClientSummary> {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const [status, sessions, repos, orchestrators, capabilities, scheduler, localApps, video, approvals, runtimeReports] = await Promise.all([
    readLine(normalizedBaseUrl, '/status', 'Brain Core unavailable'),
    readLine(normalizedBaseUrl, '/sessions', 'Brain Core sessions unavailable'),
    readLine(normalizedBaseUrl, '/repos', 'Brain Core repos unavailable'),
    readLine(normalizedBaseUrl, '/orchestrators', 'Brain Core orchestrators unavailable'),
    readLine(normalizedBaseUrl, '/capabilities', 'Brain Core capabilities unavailable'),
    readLine(normalizedBaseUrl, '/scheduler/status', 'Brain Core scheduler unavailable'),
    readLine(normalizedBaseUrl, '/local-apps', 'Brain Core local apps unavailable'),
    readLine(normalizedBaseUrl, '/video/status', 'Brain Core video unavailable'),
    readLine(normalizedBaseUrl, '/approvals', 'Brain Core approvals unavailable'),
    readLine(normalizedBaseUrl, '/runtime/reports', 'Brain Core runtime reports unavailable'),
  ]);

  return {
    status,
    sessions,
    repos,
    orchestrators,
    capabilities,
    scheduler,
    localApps,
    video,
    approvals,
    runtimeReports,
  };
}

async function readLine(baseUrl: string, pathname: string, fallback: string): Promise<string> {
  const response = await readJson(baseUrl, pathname);
  if (!response) {
    return fallback;
  }

  if (pathname === '/status') {
    return `status: ${String(response.ok ?? false)}`;
  }

  if (pathname === '/capabilities') {
    return `capabilities: executableActionsEnabled=${String(response.executableActionsEnabled ?? false)}`;
  }

  if (pathname === '/runtime/reports') {
    const reports = Array.isArray(response.reports) ? response.reports : [];
    return `runtime-reports: ${
      reports
        .map((report) => `${String(report.id ?? 'unknown')}=${String(report.status ?? 'unknown')}`)
        .join(', ') || 'none'
    }`;
  }

  if (Array.isArray(response.sessions)) {
    return `${pathname.slice(1)}: ${response.sessions.length}`;
  }
  if (Array.isArray(response.approvals)) {
    return `${pathname.slice(1)}: ${response.approvals.length}`;
  }
  if (Array.isArray(response.jobs)) {
    return `${pathname.slice(1)}: ${response.jobs.length}`;
  }

  return `${pathname.slice(1)}: ok`;
}

async function readJson(baseUrl: string, pathname: string): Promise<BrainCoreJsonResponse | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_000);

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return undefined;
    }

    return (await response.json()) as BrainCoreJsonResponse;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeBaseUrl(rawValue: string): string {
  return rawValue.replace(/\/+$/g, '');
}
