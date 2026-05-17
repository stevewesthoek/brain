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

export async function readBrainConsoleSummary(baseUrl: string): Promise<BrainConsoleClientSummary> {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/g, '');
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1000);

  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return fallback;
    }

    const body = (await response.json()) as Record<string, unknown>;
    if (pathname === '/status') {
      return `status: ${String(body.ok ?? false)}`;
    }
    if (pathname === '/capabilities') {
      return `capabilities: executableActionsEnabled=${String(body.executableActionsEnabled ?? false)}`;
    }
    if (pathname === '/runtime/reports') {
      const reports = Array.isArray(body.reports) ? body.reports as Array<Record<string, unknown>> : [];
      return `runtime-reports: ${reports.map((report) => `${String(report.id)}=${String(report.status)}`).join(', ') || 'none'}`;
    }
    if (Array.isArray(body.sessions)) {
      return `${pathname.slice(1)}: ${body.sessions.length}`;
    }
    if (Array.isArray(body.approvals)) {
      return `${pathname.slice(1)}: ${body.approvals.length}`;
    }
    if (Array.isArray(body.jobs)) {
      return `${pathname.slice(1)}: ${body.jobs.length}`;
    }
    return `${pathname.slice(1)}: ok`;
  } catch {
    return fallback;
  } finally {
    clearTimeout(timeout);
  }
}
