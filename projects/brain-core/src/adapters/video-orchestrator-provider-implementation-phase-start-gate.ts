import type {
  BrainCoreVideoProviderImplementationPhaseStartGate,
  BrainCoreVideoProviderImplementationPhaseStartGateEntry,
  BrainCoreVideoProviderImplementationPhaseStartGateResponse,
} from '../types/api.js';

const completedPlanningRefs = [
  'design-provider-boundary-plan',
  'design-provider-credential-isolation-plan',
  'design-provider-prompt-review-policy-plan',
  'artifact-sandbox-provider-handoff-plan',
  'provider-output-redaction-policy-plan',
  'design-provider-compliance-checklist-plan',
  'design-provider-enablement-readiness-index',
  'provider-integration-final-planning-checkpoint',
  'provider-request-wrapper-implementation-plan',
  'credential-store-implementation-boundary-plan',
  'prompt-review-ux-implementation-plan',
  'provider-audit-persistence-boundary-plan',
  'provider-wrapper-security-review-plan',
] as const;

const remainingApprovalRequirements = [
  'explicit user approval to begin provider implementation',
  'security review accepted',
  'credential boundary accepted',
  'prompt review UX accepted',
  'audit persistence boundary accepted',
  'artifact sandbox handoff accepted',
  'output redaction policy accepted',
  'rollback and cleanup plan accepted',
  'Brain Console mutation controls still disabled unless separately approved',
] as const;

const implementationStartBlockers = [
  'implementation not approved',
  'provider calls not approved',
  'credential access not approved',
  'network access not approved',
  'prompt generation not approved',
  'artifact persistence not approved',
  'audit persistence not approved',
  'Brain Console approval controls not approved',
  'security review not accepted by user',
] as const;

const explicitApprovalChecklist = [
  'I approve beginning provider implementation planning-to-code transition',
  'I approve implementing provider request wrapper without provider calls',
  'I approve keeping credentials inaccessible until a separate credential phase',
  'I approve keeping provider calls disabled',
  'I approve keeping artifact writes disabled',
  'I approve keeping audit persistence disabled',
  'I approve keeping Brain Console mutation controls disabled',
] as const;

const safety: BrainCoreVideoProviderImplementationPhaseStartGateEntry['safety'] = {
  readOnly: true,
  startGateOnly: true,
  planningSequenceComplete: true,
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

function entry(
  input: Omit<BrainCoreVideoProviderImplementationPhaseStartGateEntry, 'safety'>,
): BrainCoreVideoProviderImplementationPhaseStartGateEntry {
  return { ...input, safety };
}

export function readVideoProviderImplementationPhaseStartGate(): BrainCoreVideoProviderImplementationPhaseStartGateResponse {
  const entries: BrainCoreVideoProviderImplementationPhaseStartGateEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      startGateOnly: true,
      planningSequenceComplete: true,
      implementationApproved: false,
      implementationEligible: false,
      completedPlanningRefs: [...completedPlanningRefs],
      remainingApprovalRequirements: [...remainingApprovalRequirements],
      implementationStartBlockers: [...implementationStartBlockers],
      explicitApprovalChecklist: [...explicitApprovalChecklist],
      firstImplementationPhaseAllowedOnlyAfterApproval: 'Provider request wrapper scaffolding only, still no provider calls.',
      nextSafeStep: 'Keep the provider implementation start gate blocked until explicit approval is granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      startGateOnly: true,
      planningSequenceComplete: true,
      implementationApproved: false,
      implementationEligible: false,
      completedPlanningRefs: [...completedPlanningRefs],
      remainingApprovalRequirements: [...remainingApprovalRequirements],
      implementationStartBlockers: [...implementationStartBlockers],
      explicitApprovalChecklist: [...explicitApprovalChecklist],
      firstImplementationPhaseAllowedOnlyAfterApproval: 'Provider request wrapper scaffolding only, still no provider calls.',
      nextSafeStep: 'Keep the provider implementation start gate blocked until explicit approval is granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      startGateOnly: true,
      planningSequenceComplete: true,
      implementationApproved: false,
      implementationEligible: false,
      completedPlanningRefs: [...completedPlanningRefs],
      remainingApprovalRequirements: [...remainingApprovalRequirements],
      implementationStartBlockers: [...implementationStartBlockers],
      explicitApprovalChecklist: [...explicitApprovalChecklist],
      firstImplementationPhaseAllowedOnlyAfterApproval: 'Provider request wrapper scaffolding only, still no provider calls.',
      nextSafeStep: 'Keep the provider implementation start gate blocked until explicit approval is granted.',
    }),
  ];

  const gateCount: 3 = 3;
  const planningSequenceCompleteCount: 3 = 3;
  const implementationApprovedCount: 0 = 0;
  const implementationEligibleCount: 0 = 0;
  const blockedCount: 3 = 3;
  const providerConfiguredCount: 0 = 0;
  const providerCallCount: 0 = 0;
  const credentialAccessCount: 0 = 0;
  const networkAccessCount: 0 = 0;
  const executionEnabledCount: 0 = 0;

  const gate: BrainCoreVideoProviderImplementationPhaseStartGate = {
    id: 'video-orchestrator-provider-implementation-phase-start-gate',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    gateCount,
    planningSequenceCompleteCount,
    implementationApprovedCount,
    implementationEligibleCount,
    blockedCount,
    providerConfiguredCount,
    providerCallCount,
    credentialAccessCount,
    networkAccessCount,
    executionEnabledCount,
    entries,
    summary: {
      gateCount,
      planningSequenceCompleteCount,
      implementationApprovedCount,
      implementationEligibleCount,
      blockedCount,
      providerConfiguredCount,
      providerCallCount,
      credentialAccessCount,
      networkAccessCount,
      executionEnabledCount,
    },
    blockers: entries.flatMap((entry) => entry.implementationStartBlockers),
    nextSafeStep: 'Await explicit approval before provider implementation. First implementation phase should be provider request wrapper scaffolding only, still no provider calls.',
    safety,
  };

  return { gate };
}

export function readVideoProviderImplementationPhaseStartGateEntry(providerClass: string): BrainCoreVideoProviderImplementationPhaseStartGateEntry | undefined {
  return readVideoProviderImplementationPhaseStartGate().gate.entries.find((entry) => entry.providerClass === providerClass);
}
