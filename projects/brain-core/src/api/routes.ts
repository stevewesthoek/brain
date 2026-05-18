import type { IncomingMessage, ServerResponse } from 'node:http';
import { decideApproval, getApprovalRecord, getApprovalStoreSummary, listApprovalAuditEvents, requestAction, getApprovalAuditEvents } from '../adapters/actions.js';
import { getExecutionPlan, getExecutionReadiness, getMindPreviewPolicy, listExecutionPlans } from '../adapters/execution-plans.js';
import { listApprovals } from '../adapters/approvals.js';
import { getCapabilities } from '../adapters/capabilities.js';
import { getOrchestrator, listOrchestrators } from '../adapters/orchestrators.js';
import { getPipeline, listPipelines } from '../adapters/pipelines.js';
import { getProject, listProjects } from '../adapters/projects.js';
import { getPlatform, listPlatforms } from '../adapters/platforms.js';
import {
  readPostOrchestratorDraftFixtures,
  readPostOrchestratorContracts,
  readPostOrchestratorDryRunPlan,
  readPostOrchestratorEventFixtures,
  readPostOrchestratorFlowFixtures,
  readPostOrchestratorIntegrations,
  readPostOrchestratorRecovery,
  readPostOrchestratorStatus,
} from '../adapters/post-orchestrator.js';
import { listLocalApps } from '../adapters/local-apps.js';
import {
  listMindPreviewSummaries,
  readLatestMindPreviewDetail,
  readMindPreviewDetailById,
} from '../adapters/preview-artifacts.js';
import {
  listMaintenancePreviewSummaries,
  readLatestMaintenancePreviewDetail,
  readMaintenancePreviewDetailById,
} from '../adapters/maintenance-previews.js';
import { listRuntimeReports } from '../adapters/runtime-reports.js';
import { listRepos } from '../adapters/repos.js';
import { getSchedulerLatestRun, getSchedulerStatus, listSchedulerJobs } from '../adapters/scheduler.js';
import { listSessions } from '../adapters/sessions.js';
import { listSkills } from '../adapters/skills.js';
import { getVideoStatus, listVideoQueue } from '../adapters/video.js';
import { getStbPipelineStatus } from '../adapters/stb-status.js';
import { getVideoOrchestratorStatus } from '../adapters/video-orchestrator-status.js';
import { getStbVideoMigrationStatus } from '../adapters/stb-video-migration.js';
import { getAgent, listAgents } from '../adapters/agents.js';
import { getActionSummary, listActionSummaries, requestActionApprovalById } from '../adapters/action-registry.js';
import { listAgentRuns, getAgentRun, listAgentEvents, listRecoveryItems, getRecoveryItem } from '../adapters/agent-runs.js';
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
    case '/pipelines':
      sendJson(response, 200, { pipelines: listPipelines() });
      return;
    case '/projects':
      sendJson(response, 200, { projects: listProjects() });
      return;
    case '/platforms':
      sendJson(response, 200, { platforms: listPlatforms() });
      return;
    case '/post-orchestrator/status':
      sendJson(response, 200, readPostOrchestratorStatus());
      return;
    case '/post-orchestrator/contracts':
      sendJson(response, 200, readPostOrchestratorContracts());
      return;
    case '/post-orchestrator/flows':
      sendJson(response, 200, readPostOrchestratorFlowFixtures());
      return;
    case '/post-orchestrator/drafts':
      sendJson(response, 200, readPostOrchestratorDraftFixtures());
      return;
    case '/post-orchestrator/events':
      sendJson(response, 200, readPostOrchestratorEventFixtures());
      return;
    case '/post-orchestrator/integrations':
      sendJson(response, 200, readPostOrchestratorIntegrations());
      return;
    case '/post-orchestrator/recovery':
      sendJson(response, 200, readPostOrchestratorRecovery());
      return;
    case '/stb/status':
      sendJson(response, 200, getStbPipelineStatus());
      return;
    case '/video-orchestrator/status':
      sendJson(response, 200, getVideoOrchestratorStatus());
      return;
    case '/stb-video-migration/status':
      sendJson(response, 200, getStbVideoMigrationStatus());
      return;
    case '/agents':
      sendJson(response, 200, { agents: listAgents() });
      return;
    case '/agent-runs':
      sendJson(response, 200, { runs: listAgentRuns() });
      return;
    case '/agent-events':
      sendJson(response, 200, { events: listAgentEvents() });
      return;
    case '/approval-audit':
      sendJson(response, 200, { events: listApprovalAuditEvents() });
      return;
    case '/recovery':
      sendJson(response, 200, { items: listRecoveryItems() });
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
    case '/actions':
      sendJson(response, 200, { actions: listActionSummaries() });
      return;
    case '/approvals':
      sendJson(response, 200, { approvals: listApprovals() });
      return;
    case '/approvals/store':
      sendJson(response, 200, getApprovalStoreSummary());
      return;
    case '/execution/plans':
      sendJson(response, 200, { plans: listExecutionPlans() });
      return;
    case '/execution/readiness':
      sendJson(response, 200, getExecutionReadiness());
      return;
    case '/execution/mind-preview-policy':
      sendJson(response, 200, getMindPreviewPolicy());
      return;
    case '/execution/mind-previews':
      sendJson(response, 200, { previews: listMindPreviewSummaries() });
      return;
    case '/execution/mind-previews/latest':
      {
        const preview = readLatestMindPreviewDetail();
        sendJson(response, 200, preview ? { status: 'available', preview } : { status: 'empty' });
        return;
      }
    case '/execution/maintenance-previews':
      sendJson(response, 200, { previews: listMaintenancePreviewSummaries() });
      return;
    case '/execution/maintenance-previews/latest':
      {
        const preview = readLatestMaintenancePreviewDetail();
        sendJson(response, 200, preview ? { status: 'available', preview } : { status: 'empty' });
        return;
      }
    case '/approvals/audit':
      sendJson(response, 200, { events: listApprovalAuditEvents() });
      return;
    case '/runtime/reports':
      sendJson(response, 200, { reports: listRuntimeReports() });
      return;
    case '/runtime/reports/model-router':
      {
        const reports = listRuntimeReports();
        const mrReport = reports.find((r) => r.id === 'model-router');
        if (!mrReport) {
          sendJson(response, 200, { report: { exists: false, status: 'unknown' } });
          return;
        }

        // Extract safe metadata from wiki health if available
        const wikiHealth = mrReport.wikiHealth
          ? {
              ok: mrReport.wikiHealth.ok,
              errorCount: mrReport.wikiHealth.errorCount,
              warningCount: mrReport.wikiHealth.warningCount,
            }
          : undefined;

        sendJson(response, 200, {
          report: {
            exists: mrReport.status === 'available',
            status: mrReport.status,
            latestRunStatus: mrReport.latestRunStatus,
            path: mrReport.path,
            message: mrReport.message,
            writesToMind: false,
            externalSideEffects: false,
            applyEnabled: false,
            wikiHealth,
          },
        });
        return;
      }
    default:
      {
        // Check for approval detail route
        const approvalMatch = /^\/approvals\/([^/]+)$/.exec(url.pathname);
        if (approvalMatch) {
          const approval = getApprovalRecord(approvalMatch[1] ?? '');
          if (approval) {
            const auditEvents = getApprovalAuditEvents(approval.id);
            sendJson(response, 200, { approval, auditEvents });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Approval not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const actionMatch = /^\/actions\/([^/]+)$/.exec(url.pathname);
        if (actionMatch) {
          const action = getActionSummary(actionMatch[1] ?? '');
          if (action) {
            sendJson(response, 200, { action });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Action not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const orchestratorMatch = /^\/orchestrators\/([^/]+)$/.exec(url.pathname);
        if (orchestratorMatch) {
          const orchestrator = getOrchestrator(orchestratorMatch[1] ?? '');
          if (orchestrator) {
            sendJson(response, 200, { orchestrator });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Orchestrator not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const pipelineMatch = /^\/pipelines\/([^/]+)$/.exec(url.pathname);
        if (pipelineMatch) {
          const pipeline = getPipeline(pipelineMatch[1] ?? '');
          if (pipeline) {
            sendJson(response, 200, { pipeline });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Pipeline not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const agentMatch = /^\/agents\/([^/]+)$/.exec(url.pathname);
        if (agentMatch) {
          const agent = getAgent(agentMatch[1] ?? '');
          if (agent) {
            sendJson(response, 200, { agent });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Agent not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const agentRunMatch = /^\/agent-runs\/([^/]+)$/.exec(url.pathname);
        if (agentRunMatch) {
          const run = getAgentRun(agentRunMatch[1] ?? '');
          if (run) {
            sendJson(response, 200, { run });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Agent run not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const executionPlanMatch = /^\/execution\/plans\/([^/]+)$/.exec(url.pathname);
        if (executionPlanMatch) {
          const plan = getExecutionPlan(executionPlanMatch[1] ?? '');
          if (plan) {
            sendJson(response, 200, { plan });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Execution plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const previewMatch = /^\/execution\/mind-previews\/([^/]+)$/.exec(url.pathname);
        if (previewMatch) {
          const preview = readMindPreviewDetailById(previewMatch[1] ?? '');
          if (preview) {
            sendJson(response, 200, { preview });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Mind preview artifact not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const maintenancePreviewMatch = /^\/execution\/maintenance-previews\/([^/]+)$/.exec(url.pathname);
        if (maintenancePreviewMatch) {
          const preview = readMaintenancePreviewDetailById(maintenancePreviewMatch[1] ?? '');
          if (preview) {
            sendJson(response, 200, { preview });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Maintenance preview queue not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const recoveryItemMatch = /^\/recovery\/([^/]+)$/.exec(url.pathname);
        if (recoveryItemMatch) {
          const item = getRecoveryItem(recoveryItemMatch[1] ?? '');
          if (item) {
            sendJson(response, 200, { item });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Recovery item not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
      }
      {
        const dryRunMatch = /^\/post-orchestrator\/dry-run\/([^/]+)$/.exec(url.pathname);
        if (dryRunMatch) {
          sendJson(response, 200, readPostOrchestratorDryRunPlan(decodeURIComponent(dryRunMatch[1] ?? '')));
          return;
        }
      }

      sendJson(response, 404, {
        error: {
          code: 'not_found',
          message: 'Route not found. Available routes: /status, /sessions, /skills, /repos, /orchestrators, /orchestrators/:id, /pipelines, /pipelines/:id, /projects, /platforms, /post-orchestrator/status, /post-orchestrator/contracts, /post-orchestrator/flows, /post-orchestrator/drafts, /post-orchestrator/events, /post-orchestrator/dry-run/:eventId, /post-orchestrator/integrations, /post-orchestrator/recovery, /stb/status, /video-orchestrator/status, /stb-video-migration/status, /agents, /agents/:id, /agent-runs, /agent-runs/:id, /agent-events, /approval-audit, /recovery, /recovery/:id, /actions, /actions/:id, /capabilities, /scheduler/status, /scheduler/latest-run, /scheduler/jobs, /local-apps, /video/status, /video/queue, /approvals, /approvals/:id, /approvals/store, /runtime/reports, /runtime/reports/model-router, /execution/plans, /execution/plans/:kind, /execution/mind-preview-policy, /execution/mind-previews, /execution/mind-previews/latest, /execution/mind-previews/:id, /execution/maintenance-previews, /execution/maintenance-previews/latest, /execution/maintenance-previews/:id, /execution/readiness.',
        },
      } satisfies BrainCoreErrorResponse);
      return;
  }
}

function routePostRequest(url: URL, response: ServerResponse): void {
  if (url.pathname === '/actions/request') {
    const kind = url.searchParams.get('kind') || 'manual-request';
    sendJson(response, 202, requestAction(kind));
    return;
  }

  const actionRequestMatch = /^\/actions\/([^/]+)\/request-approval$/.exec(url.pathname);
  if (actionRequestMatch) {
    void (async () => {
      const actionRequest = await requestActionApprovalById(actionRequestMatch[1] ?? '');
      sendJson(response, actionRequest.status === 'requested' ? 202 : 400, actionRequest);
    })();
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
      message: 'POST route not found. Available POST routes: /actions/request, /actions/:id/request-approval, /scheduler/jobs/:id/request-run, /skills/profile, /sessions/:id/resume, /local-apps/:id/start|stop|restart, /approvals/:id/approve, /approvals/:id/reject.',
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
