import type {
  BrainCoreVideoProviderRequestWrapperImplementationPlan,
  BrainCoreVideoProviderRequestWrapperImplementationPlanEntry,
  BrainCoreVideoProviderRequestWrapperImplementationPlanResponse,
} from '../types/api.js';

const proposedFutureRequestShape = [
  'providerClass',
  'sourcePlanId',
  'promptReviewPolicyId',
  'credentialIsolationPlanId',
  'artifactSandboxHandoffPlanId',
  'outputRedactionPolicyId',
  'complianceChecklistId',
  'operatorApprovalRef',
  'auditRefPlaceholder',
  'requestIdPlaceholder',
] as const;

const proposedFutureResponseShape = [
  'requestId',
  'status',
  'redactedSummaryOnly',
  'providerClass',
  'redactionPolicyId',
  'auditRefPlaceholder',
  'artifactManifestRefPlaceholder',
  'errorCategoryPlaceholder',
  'noRawProviderOutput: true',
] as const;

const requestValidationSteps = [
  'verify explicit implementation approval',
  'verify credential isolation boundary',
  'verify prompt review approval',
  'verify artifact sandbox boundary',
  'verify output redaction policy',
  'verify compliance checklist',
  'verify audit reference availability',
  'verify no raw credential fields',
  'verify no arbitrary shell text',
  'verify no publishing command',
  'block provider call in this phase',
] as const;

const failureModes = [
  'missing approval',
  'missing credential boundary',
  'missing prompt review',
  'missing artifact sandbox handoff',
  'missing redaction policy',
  'missing compliance checklist',
  'timeout',
  'provider unavailable',
  'unsafe output category',
  'audit reference unavailable',
] as const;

const safety: BrainCoreVideoProviderRequestWrapperImplementationPlanEntry['safety'] = {
  readOnly: true,
  implementationPlanOnly: true,
  providerRequestWrapperImplemented: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  networkAccessEnabled: false,
  rawProviderOutputAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  complianceEvaluationEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoProviderRequestWrapperImplementationPlanEntry, 'safety'>,
): BrainCoreVideoProviderRequestWrapperImplementationPlanEntry {
  return { ...input, safety };
}

export function readVideoProviderRequestWrapperImplementationPlan(): BrainCoreVideoProviderRequestWrapperImplementationPlanResponse {
  const entries: BrainCoreVideoProviderRequestWrapperImplementationPlanEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      implementationPlanOnly: true,
      wrapperPurpose: 'Define the future wrapper contract for image-generation provider requests after explicit approval.',
      proposedFutureRequestShape: [...proposedFutureRequestShape],
      proposedFutureResponseShape: [...proposedFutureResponseShape],
      requestValidationSteps: [...requestValidationSteps],
      failureModes: [...failureModes],
      timeoutPolicy: 'Timeouts must fail closed and return a blocked wrapper design state until separate approval exists.',
      retryPolicy: 'Retries remain design-only; do not retry provider calls in this phase.',
      redactionRequirements: [
        'Redact credential-like values before any future wrapper logging.',
        'Do not expose raw provider payloads.',
        'Keep only stable internal references.',
      ],
      auditRequirements: [
        'Use reference-only audit placeholders.',
        'No audit persistence in this phase.',
        'Future audit boundaries must be immutable and redacted.',
      ],
      requiredPreImplementationApprovals: [
        'explicit implementation approval',
        'provider request wrapper design approval',
        'credential isolation boundary approval',
        'prompt review UX approval',
        'artifact sandbox handoff approval',
        'output redaction policy approval',
        'compliance checklist approval',
      ],
      implementationBlockers: [
        'provider request wrapper is not implemented',
        'provider calls remain disabled',
        'no explicit implementation approval',
      ],
      firstSafeImplementationSlice: 'Start with a request-shape validator and blocked response mapper only after separate approval.',
      nextSafeStep: 'Keep the wrapper as a plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      implementationPlanOnly: true,
      wrapperPurpose: 'Define the future wrapper contract for layout-rendering provider requests after explicit approval.',
      proposedFutureRequestShape: [...proposedFutureRequestShape],
      proposedFutureResponseShape: [...proposedFutureResponseShape],
      requestValidationSteps: [...requestValidationSteps],
      failureModes: [...failureModes],
      timeoutPolicy: 'Timeouts must fail closed and return a blocked wrapper design state until separate approval exists.',
      retryPolicy: 'Retries remain design-only; do not retry provider calls in this phase.',
      redactionRequirements: [
        'Redact credential-like values before any future wrapper logging.',
        'Do not expose raw provider payloads.',
        'Keep only stable internal references.',
      ],
      auditRequirements: [
        'Use reference-only audit placeholders.',
        'No audit persistence in this phase.',
        'Future audit boundaries must be immutable and redacted.',
      ],
      requiredPreImplementationApprovals: [
        'explicit implementation approval',
        'provider request wrapper design approval',
        'credential isolation boundary approval',
        'prompt review UX approval',
        'artifact sandbox handoff approval',
        'output redaction policy approval',
        'compliance checklist approval',
      ],
      implementationBlockers: [
        'provider request wrapper is not implemented',
        'provider calls remain disabled',
        'no explicit implementation approval',
      ],
      firstSafeImplementationSlice: 'Start with a request-shape validator and blocked response mapper only after separate approval.',
      nextSafeStep: 'Keep the wrapper as a plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      implementationPlanOnly: true,
      wrapperPurpose: 'Define the future wrapper contract for brand-compliance provider requests after explicit approval.',
      proposedFutureRequestShape: [...proposedFutureRequestShape],
      proposedFutureResponseShape: [...proposedFutureResponseShape],
      requestValidationSteps: [...requestValidationSteps],
      failureModes: [...failureModes],
      timeoutPolicy: 'Timeouts must fail closed and return a blocked wrapper design state until separate approval exists.',
      retryPolicy: 'Retries remain design-only; do not retry provider calls in this phase.',
      redactionRequirements: [
        'Redact credential-like values before any future wrapper logging.',
        'Do not expose raw provider payloads.',
        'Keep only stable internal references.',
      ],
      auditRequirements: [
        'Use reference-only audit placeholders.',
        'No audit persistence in this phase.',
        'Future audit boundaries must be immutable and redacted.',
      ],
      requiredPreImplementationApprovals: [
        'explicit implementation approval',
        'provider request wrapper design approval',
        'credential isolation boundary approval',
        'prompt review UX approval',
        'artifact sandbox handoff approval',
        'output redaction policy approval',
        'compliance checklist approval',
      ],
      implementationBlockers: [
        'provider request wrapper is not implemented',
        'provider calls remain disabled',
        'no explicit implementation approval',
      ],
      firstSafeImplementationSlice: 'Start with a request-shape validator and blocked response mapper only after separate approval.',
      nextSafeStep: 'Keep the wrapper as a plan only until explicit implementation approval is granted.',
    }),
  ];

  const planCount: 3 = 3;
  const blockedCount: 3 = 3;
  const implementationPlanOnlyCount: 3 = 3;
  const providerConfiguredCount: 0 = 0;
  const providerCallCount: 0 = 0;
  const networkAccessCount: 0 = 0;
  const credentialAccessCount: 0 = 0;
  const rawOutputAccessCount: 0 = 0;

  const plan: BrainCoreVideoProviderRequestWrapperImplementationPlan = {
    id: 'video-orchestrator-provider-request-wrapper-implementation-plan',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    planCount,
    blockedCount,
    implementationPlanOnlyCount,
    providerConfiguredCount,
    providerCallCount,
    networkAccessCount,
    credentialAccessCount,
    rawOutputAccessCount,
    entries,
    summary: {
      planCount,
      blockedCount,
      implementationPlanOnlyCount,
      providerConfiguredCount,
      providerCallCount,
      networkAccessCount,
      credentialAccessCount,
      rawOutputAccessCount,
    },
    blockers: entries.flatMap(entry => entry.implementationBlockers),
    nextSafeStep: 'Keep the provider request wrapper as a plan only until explicit implementation approval is granted.',
    safety,
  };

  return { plan };
}

export function readVideoProviderRequestWrapperImplementationPlanEntry(providerClass: string): BrainCoreVideoProviderRequestWrapperImplementationPlanEntry | undefined {
  return readVideoProviderRequestWrapperImplementationPlan().plan.entries.find(entry => entry.providerClass === providerClass);
}
