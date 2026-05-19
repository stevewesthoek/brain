import type {
  BrainCoreProBotPhaseOutChecklistResponse,
  BrainCoreProBotPhaseOutChecklistItem,
} from '../types/api.js';

const items: BrainCoreProBotPhaseOutChecklistItem[] = [
  {
    id: 'probot-tabs-inventoried',
    label: 'All ProBot tabs inventoried',
    satisfied: true,
    description: '11 tabs mapped in feature parity matrix',
    requiresUserApproval: false,
  },
  {
    id: 'brain-core-endpoints-created',
    label: 'Brain Core read-only endpoints exist for kept/redesigned tabs',
    satisfied: true,
    description: '6 endpoints created: sessions, local-apps, scheduler, studio, external-admin, decommission-readiness',
    requiresUserApproval: false,
  },
  {
    id: 'brain-console-cards-created',
    label: 'Brain Console cards exist for kept/redesigned tabs',
    satisfied: true,
    description: '7 cards in ProBot Migration dashboard: command center, sessions, local-apps, scheduler, studio, external-admin, decommission-readiness',
    requiresUserApproval: false,
  },
  {
    id: 'external-admin-classified',
    label: 'External admin tabs classified (legacy-only or metadata-only)',
    satisfied: true,
    description: '7 external integrations classified with safe metadata decisions',
    requiresUserApproval: false,
  },
  {
    id: 'secrets-excluded',
    label: 'Secrets and credentials intentionally excluded from Brain Console',
    satisfied: true,
    description: 'API keys, OAuth tokens, cookies, account IDs, credentials not exposed',
    requiresUserApproval: false,
  },
  {
    id: 'financial-data-excluded',
    label: 'Stripe and Google Ads financial/account data intentionally excluded',
    satisfied: true,
    description: 'Stripe charges, customer IDs, tokens blocked. Google Ads spend data, account IDs blocked.',
    requiresUserApproval: false,
  },
  {
    id: 'no-mutation-controls',
    label: 'No mutation controls, approval buttons, or shell execution in Brain Console',
    satisfied: true,
    description: 'Read-only only. No POST routes. No direct commands.',
    requiresUserApproval: false,
  },
  {
    id: 'obsidian-plugin-installed',
    label: 'Active Obsidian plugin installed with current build marker',
    satisfied: true,
    description: 'Build marker probot-decommission-gap-closure-2026-05-19-01 in active vault',
    requiresUserApproval: false,
  },
  {
    id: 'user-visual-verification',
    label: 'User visually verified Brain Console dashboard post-restart',
    satisfied: false,
    description: 'User must restart Obsidian and confirm ProBot Migration dashboard is visible, responsive, and all 7 cards render correctly',
    requiresUserApproval: true,
  },
  {
    id: 'observation-period',
    label: 'Phase-out observation period completed (7+ days)',
    satisfied: false,
    description: 'Brain Console must be tested in production for minimum 7 days before final phase-out',
    requiresUserApproval: true,
  },
  {
    id: 'explicit-approval',
    label: 'Explicit ProBot decommission approval received from system owner',
    satisfied: false,
    description: 'System owner must explicitly approve ProBot decommission. Decommission is NOT automatic.',
    requiresUserApproval: true,
  },
  {
    id: 'rollback-path-documented',
    label: 'Rollback path documented for ProBot restoration if needed',
    satisfied: false,
    description: 'Recovery procedures for ProBot data, ProBot service, and state restoration documented',
    requiresUserApproval: true,
  },
];

export function readProBotPhaseOutChecklist(): BrainCoreProBotPhaseOutChecklistResponse {
  const satisfiedCount = items.filter(i => i.satisfied).length;
  const unsatisfiedCount = items.filter(i => !i.satisfied).length;
  const requiresApprovalCount = items.filter(i => i.requiresUserApproval).length;

  return {
    id: 'probot-phase-out-checklist',
    status: 'not-ready',
    ready: false,
    itemCount: items.length,
    satisfiedCount,
    unsatisfiedCount,
    requiresApprovalCount,
    items,
    blockers: [
      'User visual verification of Brain Console dashboard not yet completed',
      'Observation period not yet satisfied (requires 7+ days of production use)',
      'Explicit ProBot decommission approval not yet received',
      'Rollback path documentation not yet confirmed',
      'Decommission is intentionally blocked until all approval criteria met',
    ],
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
    nextSafeStep: 'User must restart Obsidian and visually verify ProBot Migration dashboard. Then begin 7-day observation period.',
  };
}
