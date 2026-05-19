import {
  validateVideoProviderRequestWrapperScaffoldRequest,
} from './video-orchestrator-provider-request-wrapper-scaffold.js';
import type {
  BrainCoreVideoProviderRequestWrapperScaffoldRequest,
  BrainCoreVideoProviderWrapperValidationHarness,
  BrainCoreVideoProviderWrapperValidationHarnessFixtureResult,
  BrainCoreVideoProviderWrapperValidationHarnessResponse,
} from '../types/api.js';

const fixtureRequests: Array<{
  fixtureId: string;
  providerClass: BrainCoreVideoProviderRequestWrapperScaffoldRequest['providerClass'] | 'unsupported-provider';
  request: {
    providerClass?: BrainCoreVideoProviderRequestWrapperScaffoldRequest['providerClass'] | 'unsupported-provider';
    sourcePlanId?: string;
    promptReviewPolicyId?: string;
    credentialIsolationPlanId?: string;
    artifactSandboxHandoffPlanId?: string;
    outputRedactionPolicyId?: string;
    complianceChecklistId?: string;
    operatorApprovalRef?: string;
    auditRefPlaceholder?: string;
    requestIdPlaceholder?: string;
  } & Record<string, unknown>;
  expectedOutcome: string;
  notes: string;
}> = [
  {
    fixtureId: 'valid-image-generation',
    providerClass: 'image-generation',
    request: {
      providerClass: 'image-generation',
      sourcePlanId: 'source-plan',
      promptReviewPolicyId: 'prompt-review-policy',
      credentialIsolationPlanId: 'credential-isolation-plan',
      artifactSandboxHandoffPlanId: 'artifact-sandbox-handoff-plan',
      outputRedactionPolicyId: 'output-redaction-policy',
      complianceChecklistId: 'compliance-checklist',
      operatorApprovalRef: 'operator-approval',
      auditRefPlaceholder: 'audit-ref',
      requestIdPlaceholder: 'request-id',
    },
    expectedOutcome: 'valid-shaped',
    notes: 'valid-shaped image-generation request',
  },
  {
    fixtureId: 'valid-layout-rendering',
    providerClass: 'layout-rendering',
    request: {
      providerClass: 'layout-rendering',
      sourcePlanId: 'source-plan',
      promptReviewPolicyId: 'prompt-review-policy',
      credentialIsolationPlanId: 'credential-isolation-plan',
      artifactSandboxHandoffPlanId: 'artifact-sandbox-handoff-plan',
      outputRedactionPolicyId: 'output-redaction-policy',
      complianceChecklistId: 'compliance-checklist',
      operatorApprovalRef: 'operator-approval',
      auditRefPlaceholder: 'audit-ref',
      requestIdPlaceholder: 'request-id',
    },
    expectedOutcome: 'valid-shaped',
    notes: 'valid-shaped layout-rendering request',
  },
  {
    fixtureId: 'valid-brand-compliance',
    providerClass: 'brand-compliance',
    request: {
      providerClass: 'brand-compliance',
      sourcePlanId: 'source-plan',
      promptReviewPolicyId: 'prompt-review-policy',
      credentialIsolationPlanId: 'credential-isolation-plan',
      artifactSandboxHandoffPlanId: 'artifact-sandbox-handoff-plan',
      outputRedactionPolicyId: 'output-redaction-policy',
      complianceChecklistId: 'compliance-checklist',
      operatorApprovalRef: 'operator-approval',
      auditRefPlaceholder: 'audit-ref',
      requestIdPlaceholder: 'request-id',
    },
    expectedOutcome: 'valid-shaped',
    notes: 'valid-shaped brand-compliance request',
  },
  {
    fixtureId: 'missing-required-fields',
    providerClass: 'image-generation',
    request: { providerClass: 'image-generation' },
    expectedOutcome: 'missing-required-fields',
    notes: 'missing required fields request',
  },
  {
    fixtureId: 'unsupported-provider-class',
    providerClass: 'unsupported-provider',
    request: {
      providerClass: 'unsupported-provider',
      sourcePlanId: 'source-plan',
      promptReviewPolicyId: 'prompt-review-policy',
      credentialIsolationPlanId: 'credential-isolation-plan',
      artifactSandboxHandoffPlanId: 'artifact-sandbox-handoff-plan',
      outputRedactionPolicyId: 'output-redaction-policy',
      complianceChecklistId: 'compliance-checklist',
      operatorApprovalRef: 'operator-approval',
      auditRefPlaceholder: 'audit-ref',
      requestIdPlaceholder: 'request-id',
    },
    expectedOutcome: 'unsupported-provider-class',
    notes: 'unsupported provider class request',
  },
  {
    fixtureId: 'unsafe-field',
    providerClass: 'image-generation',
    request: {
      providerClass: 'image-generation',
      sourcePlanId: 'source-plan',
      promptReviewPolicyId: 'prompt-review-policy',
      credentialIsolationPlanId: 'credential-isolation-plan',
      artifactSandboxHandoffPlanId: 'artifact-sandbox-handoff-plan',
      outputRedactionPolicyId: 'output-redaction-policy',
      complianceChecklistId: 'compliance-checklist',
      operatorApprovalRef: 'operator-approval',
      auditRefPlaceholder: 'audit-ref',
      requestIdPlaceholder: 'request-id',
      rawProviderOutput: 'secret payload',
    },
    expectedOutcome: 'unsafe-field',
    notes: 'unsafe field request',
  },
  {
    fixtureId: 'extra-credential-like-field',
    providerClass: 'layout-rendering',
    request: {
      providerClass: 'layout-rendering',
      sourcePlanId: 'source-plan',
      promptReviewPolicyId: 'prompt-review-policy',
      credentialIsolationPlanId: 'credential-isolation-plan',
      artifactSandboxHandoffPlanId: 'artifact-sandbox-handoff-plan',
      outputRedactionPolicyId: 'output-redaction-policy',
      complianceChecklistId: 'compliance-checklist',
      operatorApprovalRef: 'operator-approval',
      auditRefPlaceholder: 'audit-ref',
      requestIdPlaceholder: 'request-id',
      apiKey: 'abc123',
    },
    expectedOutcome: 'unsafe-field',
    notes: 'credential-like unsafe field request',
  },
];

const safety: BrainCoreVideoProviderWrapperValidationHarness['safety'] = {
  readOnlyStatusEndpoint: true,
  validationHarnessOnly: true,
  providerWrapperCallable: false,
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

function toFixtureResult(
  fixture: (typeof fixtureRequests)[number],
): BrainCoreVideoProviderWrapperValidationHarnessFixtureResult {
  const validation = validateVideoProviderRequestWrapperScaffoldRequest(fixture.request as Partial<BrainCoreVideoProviderRequestWrapperScaffoldRequest>);
  const unsafeFields = Object.keys(fixture.request).filter((key) => ['rawProviderOutput', 'apiKey'].includes(key));
  const valid = validation.valid && unsafeFields.length === 0;

  return {
    fixtureId: fixture.fixtureId,
    providerClass: fixture.providerClass,
    expectedOutcome: fixture.expectedOutcome,
    valid,
    missingFields: validation.missingFields,
    unsafeFields,
    providerCallBlocked: validation.providerCallBlocked,
    executionBlocked: validation.executionBlocked,
    notes: fixture.notes,
  };
}

export function runVideoProviderWrapperValidationHarness(): BrainCoreVideoProviderWrapperValidationHarness {
  const fixtureResults = fixtureRequests.map((fixture) => toFixtureResult(fixture));

  return {
    fixtureCount: fixtureResults.length,
    passedFixtureCount: fixtureResults.filter((fixture) => fixture.valid).length,
    blockedFixtureCount: fixtureResults.length,
    providerCallCount: 0,
    credentialAccessCount: 0,
    networkAccessCount: 0,
    fileWriteCount: 0,
    fixtureResults,
    safety,
    blockers: [
      'provider calls remain blocked',
      'credentials remain inaccessible',
      'network access remains blocked',
      'file writes remain blocked',
    ],
    nextSafeStep: 'Await explicit approval before any provider implementation beyond inert scaffolding.',
  };
}

export function readVideoProviderWrapperValidationHarnessStatus(): BrainCoreVideoProviderWrapperValidationHarnessResponse {
  const harness = runVideoProviderWrapperValidationHarness();
  return {
    harness: {
      id: 'video-orchestrator-provider-wrapper-validation-harness',
      status: 'harness-ready-disabled',
      phase: 'provider-wrapper-validation-harness-only',
      implementationApprovedScope: 'wrapper-scaffolding-only',
      ...harness,
    },
  };
}

export const readVideoProviderWrapperValidationHarness = readVideoProviderWrapperValidationHarnessStatus;
