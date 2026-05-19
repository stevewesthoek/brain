import type {
  BrainCoreProBotDecommissionReadinessCriteria,
  BrainCoreProBotDecommissionReadinessResponse,
} from '../types/api.js';

const criteria: BrainCoreProBotDecommissionReadinessCriteria[] = [
  {
    id: 'inventory-complete',
    label: 'All ProBot tabs inventoried',
    satisfied: true,
    description: 'All 11 ProBot tabs (Sessions, Dokploy, New Relic, Scheduler, Analytics, Google Ads, Stripe, Domains, Tunnels, Local Apps, Studio) are documented.',
    requiresUserApproval: false,
  },
  {
    id: 'core-endpoints-exist',
    label: 'Brain Core read-only endpoints exist for kept/redesigned features',
    satisfied: true,
    description: 'Sessions, Local Apps, Scheduler, Video Orchestrator, and Post Orchestrator all have safe Brain Core endpoints.',
    requiresUserApproval: false,
  },
  {
    id: 'console-cards-exist',
    label: 'Brain Console cards exist for kept/redesigned features',
    satisfied: true,
    description: 'Overview, Apps, Pipelines, and Posts sections show all kept/redesigned features.',
    requiresUserApproval: false,
  },
  {
    id: 'external-classified',
    label: 'External features explicitly classified',
    satisfied: true,
    description: 'Dokploy, New Relic, Analytics, Google Ads, Stripe, Domains, Tunnels all marked legacy-admin-only.',
    requiresUserApproval: false,
  },
  {
    id: 'no-secrets-exposed',
    label: 'No secrets exposed in Brain Console',
    satisfied: true,
    description: 'All safety checks pass: no OAuth, credentials, financial data, or raw logs visible.',
    requiresUserApproval: false,
  },
  {
    id: 'no-mutations-added',
    label: 'No mutation controls added',
    satisfied: true,
    description: 'Brain Console remains read-only; no start/stop/execute/approve buttons added.',
    requiresUserApproval: false,
  },
  {
    id: 'obsidian-verified',
    label: 'User verified active Obsidian install',
    satisfied: false,
    description: 'User must confirm build marker is visible and Brain Console loads correctly in active vault.',
    requiresUserApproval: true,
  },
  {
    id: 'phase-out-period',
    label: 'Phase-out period completed (90 days)',
    satisfied: false,
    description: 'ProBot must remain fully operational for 90 days after Brain Console reaches feature parity.',
    requiresUserApproval: true,
  },
  {
    id: 'user-approval',
    label: 'Explicit user decommission approval',
    satisfied: false,
    description: 'User must explicitly approve ProBot decommission in writing.',
    requiresUserApproval: true,
  },
];

export function readProBotDecommissionReadiness(): BrainCoreProBotDecommissionReadinessResponse {
  const satisfiedCount = criteria.filter(c => c.satisfied).length;
  const unsatisfiedCount = criteria.length - satisfiedCount;

  const blockers: string[] = [];
  criteria.forEach(c => {
    if (!c.satisfied) {
      blockers.push(c.label);
    }
  });

  return {
    id: 'probot-decommission-readiness',
    status: 'not-ready',
    ready: false,
    criteria,
    satisfiedCriteriaCount: satisfiedCount,
    unsatisfiedCriteriaCount: unsatisfiedCount,
    blockers,
    safety: {
      readOnly: true,
      exposesSecrets: false,
      exposesCredentials: false,
      exposesOAuth: false,
      exposesStripeFinancialData: false,
      exposesGoogleAdsSpendData: false,
      exposesAccountIds: false,
      exposesRawLogs: false,
      mutationControlsEnabled: false,
      shellExecutionEnabled: false,
      platformWritesEnabled: false,
      mindWritesEnabled: false,
      publishingEnabled: false,
      decommissionEnabled: false,
    },
    nextSafeStep: 'Keep ProBot fully operational. Brain Console is ready to replace it, but formal phase-out period and user approval required before decommission.',
  };
}
