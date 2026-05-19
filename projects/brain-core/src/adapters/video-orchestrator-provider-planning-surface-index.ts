import type {
  BrainCoreVideoProviderPlanningSurfaceIndex,
  BrainCoreVideoProviderPlanningSurfaceIndexEntry,
  BrainCoreVideoProviderPlanningSurfaceIndexResponse,
} from '../types/api.js';

const surfaceOrder = [
  ['design-provider-boundary-plan', '/video-orchestrator/design-provider-boundary-plan', 'design boundary'],
  ['design-provider-credential-isolation-plan', '/video-orchestrator/design-provider-credential-isolation-plan', 'credential isolation'],
  ['design-provider-prompt-review-policy-plan', '/video-orchestrator/design-provider-prompt-review-policy-plan', 'prompt review policy'],
  ['artifact-sandbox-provider-handoff-plan', '/video-orchestrator/artifact-sandbox-provider-handoff-plan', 'artifact sandbox handoff'],
  ['provider-output-redaction-policy-plan', '/video-orchestrator/provider-output-redaction-policy-plan', 'output redaction policy'],
  ['design-provider-compliance-checklist-plan', '/video-orchestrator/design-provider-compliance-checklist-plan', 'compliance checklist'],
  ['design-provider-enablement-readiness-index', '/video-orchestrator/design-provider-enablement-readiness-index', 'readiness index'],
  ['provider-integration-final-planning-checkpoint', '/video-orchestrator/provider-integration-final-planning-checkpoint', 'final planning checkpoint'],
  ['provider-request-wrapper-implementation-plan', '/video-orchestrator/provider-request-wrapper-implementation-plan', 'wrapper implementation plan'],
  ['credential-store-implementation-boundary-plan', '/video-orchestrator/credential-store-implementation-boundary-plan', 'credential store boundary'],
  ['prompt-review-ux-implementation-plan', '/video-orchestrator/prompt-review-ux-implementation-plan', 'prompt review UX plan'],
  ['provider-audit-persistence-boundary-plan', '/video-orchestrator/provider-audit-persistence-boundary-plan', 'audit persistence boundary'],
  ['provider-wrapper-security-review-plan', '/video-orchestrator/provider-wrapper-security-review-plan', 'wrapper security review'],
  ['provider-implementation-phase-start-gate', '/video-orchestrator/provider-implementation-phase-start-gate', 'implementation start gate'],
  ['provider-implementation-readiness-dashboard-summary', '/video-orchestrator/provider-implementation-readiness-dashboard-summary', 'readiness dashboard summary'],
  ['provider-implementation-approval-packet', '/video-orchestrator/provider-implementation-approval-packet', 'implementation approval packet'],
  ['provider-approval-packet-console-review-summary', '/video-orchestrator/provider-approval-packet-console-review-summary', 'approval packet console review summary'],
] as const;

const safety: BrainCoreVideoProviderPlanningSurfaceIndexEntry['safety'] = {
  readOnly: true,
  indexOnly: true,
  implementationApproved: false,
  implementationEligible: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  networkAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  complianceEvaluationEnabled: false,
  mutationControlsEnabled: false,
  approvalButtonsEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(input: Omit<BrainCoreVideoProviderPlanningSurfaceIndexEntry, 'safety'>): BrainCoreVideoProviderPlanningSurfaceIndexEntry {
  return { ...input, safety };
}

export function readVideoProviderPlanningSurfaceIndex(): BrainCoreVideoProviderPlanningSurfaceIndexResponse {
  const entries: BrainCoreVideoProviderPlanningSurfaceIndexEntry[] = surfaceOrder.map(([id, endpoint, phaseRole]) =>
    entry({
      id,
      endpoint,
      phaseRole,
      status: 'blocked',
      visibleInBrainConsole: true,
      implementationEnables: false,
      providerCallsEnabled: false,
      credentialAccessEnabled: false,
      mutationControlsEnabled: false,
      summary: `${phaseRole} is read-only, blocked, and cannot enable implementation.`,
      nextSafeStep: 'Await explicit approval phrase: approve-wrapper-scaffolding-only.',
    }),
  );

  const surfaceCount: 17 = 17;
  const blockedCount: 17 = 17;
  const visibleInBrainConsoleCount: 17 = 17;
  const implementationEnabledCount: 0 = 0;
  const providerCallEnabledCount: 0 = 0;
  const credentialAccessEnabledCount: 0 = 0;
  const mutationControlEnabledCount: 0 = 0;

  const index: BrainCoreVideoProviderPlanningSurfaceIndex = {
    id: 'video-orchestrator-provider-planning-surface-index',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    surfaceCount,
    blockedCount,
    visibleInBrainConsoleCount,
    implementationEnabledCount,
    providerCallEnabledCount,
    credentialAccessEnabledCount,
    mutationControlEnabledCount,
    pendingApprovalPhrase: 'approve-wrapper-scaffolding-only',
    entries,
    summary: {
      surfaceCount,
      blockedCount,
      visibleInBrainConsoleCount,
      implementationEnabledCount,
      providerCallEnabledCount,
      credentialAccessEnabledCount,
      mutationControlEnabledCount,
      pendingApprovalPhrase: 'approve-wrapper-scaffolding-only',
    },
    blockers: [
      'implementation remains blocked',
      'provider calls remain blocked',
      'credentials remain inaccessible',
      'Brain Console remains read-only',
    ],
    nextSafeStep: 'Await explicit approval phrase: approve-wrapper-scaffolding-only.',
    safety,
  };

  return { index };
}

