import { getExecutionCandidateKinds, getExecutionReadiness } from './execution-plans.js';
import type { BrainCoreCapabilitySummary } from '../types/api.js';

export const READ_ENDPOINTS = [
  '/status',
  '/health/projection',
  '/projections/health',
  '/projections/topology',
  '/projections/services',
  '/projections/contracts',
  '/projections/status',
  '/projections/capabilities',
  '/projections/runtime-state',
  '/projections/ingestion',
  '/projections/review',
  '/projections/intelligence',
  '/projections/calibration',
  '/projections/learning',
  '/projections/evolution',
  '/projections/promotion',
  '/projections/transactions',
  '/projections/receipts',
  '/sessions',
  '/skills',
  '/repos',
  '/orchestrators',
  '/scheduler/status',
  '/scheduler/latest-run',
  '/scheduler/jobs',
  '/local-apps',
  '/infra/status',
  '/infra/catalog',
  '/infra/topology',
  '/infra/health',
  '/infra/incidents',
  '/infra/backups',
  '/infra/credentials/status',
  '/infra/safety',
  '/infra/action-receipts',
  '/infra/capabilities',
  '/infra/doctor',
  '/infra/resources/:id',
  '/infra/resources/:id/relations',
  '/infra/dokploy',
  '/infra/monitoring',
  '/infra/scheduler',
  '/infra/tunnels',
  '/video/status',
  '/video/queue',
  '/approvals',
  '/approvals/audit',
  '/capabilities',
  '/execution/on-demand-runs',
] as const;

export const APPROVAL_REQUEST_ENDPOINTS = [
  '/actions/request',
  '/execution/on-demand-runs/:kind/request',
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
  const executionReadiness = getExecutionReadiness();

  return {
    readEndpoints: [...READ_ENDPOINTS],
    approvalRequestEndpoints: [...APPROVAL_REQUEST_ENDPOINTS],
    executableActionsEnabled: false,
    approvalAuditPersistenceSupported: true,
    runtimeReportsSupported: true,
    runtimeReportEndpoint: '/runtime/reports',
    mindStewardReportSupported: true,
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
      projectPath: 'projects/brain-console',
      packageStatus: 'buildable',
      manualInstallRequired: true,
    },
    executionGate: {
      executionEnabled: false,
      mindStewardDryRunExecutionFlagEnabled: executionReadiness.mindStewardDryRunExecutionFlagEnabled,
      mindStewardDryRunExecutionFlagName: executionReadiness.mindStewardDryRunExecutionFlagName,
      candidateActionKinds: getExecutionCandidateKinds(),
      workflowFeatureFlags: executionReadiness.workflowFeatureFlags,
      featureFlaggedWorkflowCount: executionReadiness.featureFlaggedWorkflowCount,
      enabledWorkflowFeatureFlagCount: executionReadiness.enabledWorkflowFeatureFlagCount,
      readinessEndpoint: '/execution/readiness',
      plansEndpoint: '/execution/plans',
      firstCandidate: 'scheduler-run-mind-steward-dry-run',
      ...(typeof executionReadiness.mindStewardInboxDryRunExecutionFlagEnabled === 'boolean'
        ? { mindStewardInboxDryRunExecutionFlagEnabled: executionReadiness.mindStewardInboxDryRunExecutionFlagEnabled }
        : {}),
      ...(executionReadiness.mindStewardInboxDryRunExecutionFlagName
        ? { mindStewardInboxDryRunExecutionFlagName: executionReadiness.mindStewardInboxDryRunExecutionFlagName }
        : {}),
      ...(typeof executionReadiness.mindStewardInboxClassifierDryRunExecutionFlagEnabled === 'boolean'
        ? {
            mindStewardInboxClassifierDryRunExecutionFlagEnabled:
              executionReadiness.mindStewardInboxClassifierDryRunExecutionFlagEnabled,
          }
        : {}),
      ...(executionReadiness.mindStewardInboxClassifierDryRunExecutionFlagName
        ? {
            mindStewardInboxClassifierDryRunExecutionFlagName:
              executionReadiness.mindStewardInboxClassifierDryRunExecutionFlagName,
          }
        : {}),
      ...(typeof executionReadiness.mindStewardInboxQueueDryRunExecutionFlagEnabled === 'boolean'
        ? {
            mindStewardInboxQueueDryRunExecutionFlagEnabled:
              executionReadiness.mindStewardInboxQueueDryRunExecutionFlagEnabled,
          }
        : {}),
      ...(executionReadiness.mindStewardInboxQueueDryRunExecutionFlagName
        ? { mindStewardInboxQueueDryRunExecutionFlagName: executionReadiness.mindStewardInboxQueueDryRunExecutionFlagName }
        : {}),
    },
    notes: [
      'Brain Core is local-only by default.',
      'Approval request endpoints record intent and audit events but do not execute actions.',
      'Scheduler, video, local-app, and orchestrator adapters remain placeholders until live read-only sources are validated.',
      'Brain Core also exposes approved, feature-flagged, report-only Mind Steward inbox dry-run, inbox classifier dry-run, and inbox queue dry-run preflights.',
      'Approval audit persistence is supported only through a safe runtime JSONL path outside Mind, .env, .git, node_modules, dist, and build.',
      'Runtime reports are read-only and report-only; they summarize Brain-owned runtime state without storing it in Mind.',
    ],
  };
}
