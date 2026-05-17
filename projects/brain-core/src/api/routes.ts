import type { IncomingMessage, ServerResponse } from 'node:http';
import { decideApproval, listApprovalAuditEvents, requestAction } from '../adapters/actions.js';
import { listApprovals } from '../adapters/approvals.js';
import { getCapabilities } from '../adapters/capabilities.js';
import { listOrchestrators } from '../adapters/orchestrators.js';
import { listLocalApps } from '../adapters/local-apps.js';
import { listRuntimeReports } from '../adapters/runtime-reports.js';
import { listRepos } from '../adapters/repos.js';
import { getSchedulerLatestRun, getSchedulerStatus, listSchedulerJobs } from '../adapters/scheduler.js';
import { listSessions } from '../adapters/sessions.js';
import { listSkills } from '../adapters/skills.js';
import { getVideoStatus, listVideoQueue } from '../adapters/video.js';
import { createStatusAdapter } from '../adapters/status.js';
import { isLocalRequest } from '../security/localhost.js';
import { redactingJsonReplacer } from '../security/redaction.js';
import type { BrainCoreErrorResponse } from '../types/api.js';

const getStatus = createStatusAdapter({
  startedAt: new Date(),
  version: '0.1.0',
});

export async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, {
      error: {
        code: 'forbidden_non_local_request',
        message: 'Brain Core Phase 1 only accepts localhost requests.',
      },
    } satisfies BrainCoreErrorResponse);
    return;
  }

  const method = request.method || 'GET';
  const url = new URL(request.url || '/', 'http://127.0.0.1');

  if (method === 'POST') {
    routePostRequest(url, response);
    return;
  }

  if (method !== 'GET') {
    sendJson(response, 405, {
      error: {
        code: 'method_not_allowed',
        message: 'Brain Core supports GET plus approval-aware POST request/decision endpoints only.',
      },
    } satisfies BrainCoreErrorResponse);
    return;
  }

  switch (url.pathname) {
    case '/status':
      sendJson(response, 200, getStatus());
      return;
    case '/sessions':
      sendJson(response, 200, { sessions: listSessions() });
      return;
    case '/skills':
      sendJson(response, 200, { skills: listSkills() });
      return;
    case '/repos':
      sendJson(response, 200, { repos: listRepos() });
      return;
    case '/orchestrators':
      sendJson(response, 200, { orchestrators: listOrchestrators() });
      return;
    case '/capabilities':
      sendJson(response, 200, getCapabilities());
      return;
    case '/scheduler/status':
      sendJson(response, 200, getSchedulerStatus());
      return;
    case '/scheduler/latest-run':
      sendJson(response, 200, getSchedulerLatestRun());
      return;
    case '/scheduler/jobs':
      sendJson(response, 200, { jobs: listSchedulerJobs() });
      return;
    case '/local-apps':
      sendJson(response, 200, { apps: listLocalApps() });
      return;
    case '/video/status':
      sendJson(response, 200, getVideoStatus());
      return;
    case '/video/queue':
      sendJson(response, 200, { queue: listVideoQueue() });
      return;
    case '/approvals':
      sendJson(response, 200, { approvals: listApprovals() });
      return;
    case '/approvals/audit':
      sendJson(response, 200, { events: listApprovalAuditEvents() });
      return;
    case '/runtime/reports':
      sendJson(response, 200, { reports: listRuntimeReports() });
      return;
    default:
      sendJson(response, 404, {
        error: {
          code: 'not_found',
          message: 'Route not found. Available routes: /status, /sessions, /skills, /repos, /orchestrators, /capabilities, /scheduler/status, /scheduler/latest-run, /scheduler/jobs, /local-apps, /video/status, /video/queue, /approvals, /approvals/audit, /runtime/reports.',
        },
      } satisfies BrainCoreErrorResponse);
  }
}

function routePostRequest(url: URL, response: ServerResponse): void {
  if (url.pathname === '/actions/request') {
    const kind = url.searchParams.get('kind') || 'manual-request';
    sendJson(response, 202, requestAction(kind));
    return;
  }

  const requestKind = getApprovalRequestKind(url);
  if (requestKind) {
    sendJson(response, 202, requestAction(requestKind));
    return;
  }

  const approvalMatch = /^\/approvals\/([^/]+)\/(approve|reject)$/.exec(url.pathname);
  if (approvalMatch) {
    const approvalId = approvalMatch[1] ?? '';
    const decision = approvalMatch[2] === 'approve' ? 'approve' : 'reject';
    sendJson(response, 200, decideApproval(approvalId, decision));
    return;
  }

  sendJson(response, 404, {
    error: {
      code: 'not_found',
      message: 'POST route not found. Available POST routes: /actions/request, /scheduler/jobs/:id/request-run, /skills/profile, /sessions/:id/resume, /local-apps/:id/start|stop|restart, /approvals/:id/approve, /approvals/:id/reject.',
    },
  } satisfies BrainCoreErrorResponse);
}

function getApprovalRequestKind(url: URL): string | undefined {
  const schedulerMatch = /^\/scheduler\/jobs\/([^/]+)\/request-run$/.exec(url.pathname);
  if (schedulerMatch) {
    return `scheduler-run-${schedulerMatch[1] ?? 'unknown'}`;
  }

  if (url.pathname === '/skills/profile') {
    return `skill-profile-${url.searchParams.get('profile') || 'default'}`;
  }

  const sessionMatch = /^\/sessions\/([^/]+)\/resume$/.exec(url.pathname);
  if (sessionMatch) {
    return `session-resume-${sessionMatch[1] ?? 'unknown'}`;
  }

  const localAppMatch = /^\/local-apps\/([^/]+)\/(start|stop|restart)$/.exec(url.pathname);
  if (localAppMatch) {
    return `local-app-${localAppMatch[2] ?? 'action'}-${localAppMatch[1] ?? 'unknown'}`;
  }

  return undefined;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body, redactingJsonReplacer, 2);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`${payload}\n`);
}
