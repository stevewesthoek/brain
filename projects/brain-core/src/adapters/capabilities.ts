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
    runtimeReportsSupported: true,
    runtimeReportEndpoint: '/runtime/reports',
    modelRouterReportSupported: true,
    obsidianPluginInstalled: false,
    liveSchedulerVerified: false,
    mindWorkspace: {
      legacyTaskMigrationStatus: 'completed',
      legacyTaskMigrationCommit: '12495d4',
      cleanupInventory: 'operations/reports/mind-dirty-state-inventory-2026-05-18.md',
      workspaceIsolationRunbook: 'operations/runbooks/mind-workspace-isolation.md',
      remainingKnownDirtyCategories: [
        '.obsidian/community-plugins.json',
        '.obsidian/plugins/custom-sort/',
        '.obsidian/plugins/ghostty-terminal/',
        '.obsidian/plugins/obsidian-icon-folder/',
      ],
    },
    brainConsole: {
      scaffoldStatus: 'validated',
      installedInMindVault: false,
      projectPath: 'projects/brain-console-obsidian',
      packageStatus: 'buildable',
      manualInstallRequired: true,
    },
    probot: {
      thinClientStatus: 'wired',
      commandAliasesEnabled: true,
      actionsEnabled: false,
    },
    executionGate: {
      executionEnabled: false,
      candidateActionKinds: ['scheduler-run-model-router-dry-run'],
      readinessEndpoint: '/execution/readiness',
      plansEndpoint: '/execution/plans',
      firstCandidate: 'scheduler-run-model-router-dry-run',
    },
    notes: [
      'Brain Core is local-only by default.',
      'Approval request endpoints record intent and audit events but do not execute actions.',
      'Scheduler, video, local-app, and orchestrator adapters remain placeholders until live read-only sources are validated.',
      'Approval audit persistence is supported only through a safe runtime JSONL path outside Mind, .env, .git, node_modules, dist, and build.',
      'Runtime reports are read-only and report-only; they summarize Brain-owned runtime state without storing it in Mind.',
    ],
  };
}
