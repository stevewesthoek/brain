import type { BrainCoreCapabilitySummary } from '../types/api.js';

export const READ_ENDPOINTS = [
  '/status',
  '/sessions',
  '/skills',
  '/repos',
  '/orchestrators',
  '/scheduler/status',
  '/scheduler/latest-run',
  '/scheduler/jobs',
  '/local-apps',
  '/video/status',
  '/video/queue',
  '/approvals',
  '/approvals/audit',
  '/capabilities',
] as const;

export const APPROVAL_REQUEST_ENDPOINTS = [
  '/actions/request',
  '/scheduler/jobs/:id/request-run',
  '/skills/profile',
  '/sessions/:id/resume',
  '/local-apps/:id/start',
  '/local-apps/:id/stop',
  '/local-apps/:id/restart',
  '/approvals/:id/approve',
  '/approvals/:id/reject',
] as const;

export function getCapabilities(): BrainCoreCapabilitySummary {
  return {
    readEndpoints: [...READ_ENDPOINTS],
    approvalRequestEndpoints: [...APPROVAL_REQUEST_ENDPOINTS],
    executableActionsEnabled: false,
    approvalAuditPersistenceSupported: true,
    modelRouterReportSupported: true,
    obsidianPluginInstalled: false,
    liveSchedulerVerified: false,
    notes: [
      'Brain Core is local-only by default.',
      'Approval request endpoints record intent and audit events but do not execute actions.',
      'Scheduler, video, local-app, and orchestrator adapters remain placeholders until live read-only sources are validated.',
      'Approval audit persistence is supported only through a safe runtime JSONL path outside Mind, .env, .git, node_modules, dist, and build.',
    ],
  };
}
