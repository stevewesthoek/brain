import type {
  BrainCoreVideoProviderRequestWrapperScaffold,
  BrainCoreVideoProviderRequestWrapperScaffoldRequest,
  BrainCoreVideoProviderRequestWrapperScaffoldResponse,
  BrainCoreVideoProviderRequestWrapperScaffoldValidationResult,
} from '../types/api.js';

const supportedProviderClasses = ['image-generation', 'layout-rendering', 'brand-compliance'] as const;

const disabledCapabilities = [
  'provider calls',
  'credential access',
  'env reads',
  'network access',
  'prompt generation',
  'image generation',
  'artifact writes',
  'audit persistence',
  'Brain Console mutation controls',
  'POST routes',
  'publishing',
  'decommissioning',
] as const;

const requestShape: BrainCoreVideoProviderRequestWrapperScaffold['requestShape'] = {
  providerClass: 'supported provider class',
  sourcePlanId: 'source plan id',
  promptReviewPolicyId: 'prompt review policy id',
  credentialIsolationPlanId: 'credential isolation plan id',
  artifactSandboxHandoffPlanId: 'artifact sandbox handoff plan id',
  outputRedactionPolicyId: 'output redaction policy id',
  complianceChecklistId: 'compliance checklist id',
  operatorApprovalRef: 'operator approval ref',
  auditRefPlaceholder: 'audit ref placeholder',
  requestIdPlaceholder: 'request id placeholder',
};

const responseShape: BrainCoreVideoProviderRequestWrapperScaffold['responseShape'] = {
  requestId: 'request id',
  status: 'status',
  providerClass: 'provider class',
  redactedSummaryOnly: true,
  providerCallBlocked: true,
  executionBlocked: true,
  redactionPolicyId: 'redaction policy id',
  auditRefPlaceholder: 'audit ref placeholder',
  errorCategoryPlaceholder: 'error category placeholder',
  noRawProviderOutput: true,
};

const validationRules = [
  'providerClass must be one of supported provider classes',
  'sourcePlanId is required',
  'promptReviewPolicyId is required',
  'credentialIsolationPlanId is required',
  'artifactSandboxHandoffPlanId is required',
  'outputRedactionPolicyId is required',
  'complianceChecklistId is required',
  'operatorApprovalRef is required',
  'auditRefPlaceholder is required',
  'provider calls are blocked in this scaffold phase',
  'credentials are blocked in this scaffold phase',
  'network access is blocked in this scaffold phase',
] as const;

const safety: BrainCoreVideoProviderRequestWrapperScaffold['safety'] = {
  readOnlyStatusEndpoint: true,
  wrapperScaffoldingOnly: true,
  callableWrapperImplemented: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  envReadEnabled: false,
  networkAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
  postRoutesAdded: false,
  brainConsoleMutationControlsEnabled: false,
};

const disabledCapabilityEntries = disabledCapabilities.map((capability) => ({ capability, enabled: false as const }));

export function validateVideoProviderRequestWrapperScaffoldRequest(
  request: Partial<BrainCoreVideoProviderRequestWrapperScaffoldRequest>,
): BrainCoreVideoProviderRequestWrapperScaffoldValidationResult {
  const missingFields: string[] = [];

  if (!request.sourcePlanId) missingFields.push('sourcePlanId');
  if (!request.promptReviewPolicyId) missingFields.push('promptReviewPolicyId');
  if (!request.credentialIsolationPlanId) missingFields.push('credentialIsolationPlanId');
  if (!request.artifactSandboxHandoffPlanId) missingFields.push('artifactSandboxHandoffPlanId');
  if (!request.outputRedactionPolicyId) missingFields.push('outputRedactionPolicyId');
  if (!request.complianceChecklistId) missingFields.push('complianceChecklistId');
  if (!request.operatorApprovalRef) missingFields.push('operatorApprovalRef');
  if (!request.auditRefPlaceholder) missingFields.push('auditRefPlaceholder');

  const valid = missingFields.length === 0 && supportedProviderClasses.includes(request.providerClass as (typeof supportedProviderClasses)[number]);

  return {
    valid,
    providerCallBlocked: true,
    executionBlocked: true,
    missingFields,
    blockedReasons: [
      'provider calls are blocked in this scaffold phase',
      'credentials are blocked in this scaffold phase',
      'network access is blocked in this scaffold phase',
    ],
  };
}

export function readVideoProviderRequestWrapperScaffold(): BrainCoreVideoProviderRequestWrapperScaffoldResponse {
  const scaffold: BrainCoreVideoProviderRequestWrapperScaffold = {
    id: 'video-orchestrator-provider-request-wrapper-scaffold',
    status: 'scaffolded-disabled',
    phase: 'provider-request-wrapper-scaffolding-only',
    implementationApprovedScope: 'wrapper-scaffolding-only',
    providerClassCount: 3,
    wrapperScaffoldedCount: 3,
    callableWrapperCount: 0,
    providerConfiguredCount: 0,
    providerCallCount: 0,
    credentialAccessCount: 0,
    networkAccessCount: 0,
    artifactWriteCount: 0,
    auditPersistedCount: 0,
    providerClasses: supportedProviderClasses.map((providerClass) => ({
      providerClass,
      wrapperScaffolded: true,
      callableWrapper: false,
      providerCallsEnabled: false,
      credentialAccessEnabled: false,
      networkAccessEnabled: false,
      artifactWriteEnabled: false,
      auditPersistenceEnabled: false,
    })),
    requestShape,
    responseShape,
    validationRules: [...validationRules],
    disabledCapabilities: disabledCapabilityEntries,
    blockers: [
      'provider calls remain blocked',
      'credentials remain inaccessible',
      'network access remains blocked',
      'Brain Console remains read-only',
    ],
    nextSafeStep: 'Await explicit approval before any provider implementation beyond inert scaffolding.',
    safety,
  };

  return { scaffold };
}
