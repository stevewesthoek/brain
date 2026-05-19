import type {
  BrainCoreVideoProviderDisabledOrchestrationFacade,
  BrainCoreVideoProviderDisabledOrchestrationFacadeResponse,
} from '../types/api.js';

const composedScaffoldRefs = [
  'provider-request-wrapper-scaffold',
  'provider-wrapper-validation-harness',
  'credential-reference-scaffold',
  'provider-request-envelope-scaffold',
  'provider-response-envelope-scaffold',
  'provider-request-wrapper-inert-shell',
  'credential-reference-validator',
  'provider-response-redaction-skeleton',
  'provider-audit-event-types',
];

const methodSurface = {
  describePipeline: {
    blocked: true,
    reason: 'Provider pipeline execution blocked in wrapper-scaffolding-only phase',
  },
  validateEnvelopeOnly: {
    blocked: true,
    reason: 'Envelope validation read-only without provider execution',
  },
  redactFixtureOnly: {
    blocked: true,
    reason: 'Redaction fixture-only without raw provider output access',
  },
  describeAuditEventOnly: {
    blocked: true,
    reason: 'Audit event description only without persistence',
  },
  attemptProviderCallDisabled: {
    blocked: true,
    reason: 'All provider calls disabled in this phase',
  },
} as const;

const blockedActions = [
  { action: 'provider call', code: 'provider_call_blocked' },
  { action: 'credential access', code: 'credential_access_blocked' },
  { action: 'network access', code: 'network_access_blocked' },
  { action: 'env read', code: 'env_read_blocked' },
  { action: 'artifact write', code: 'artifact_write_blocked' },
];

const safety: BrainCoreVideoProviderDisabledOrchestrationFacade['safety'] = {
  readOnlyStatusEndpoint: true,
  disabledFacadeOnly: true,
  orchestrationExecutionEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  envReadEnabled: false,
  networkAccessEnabled: false,
  promptGenerationEnabled: false,
  imageGenerationEnabled: false,
  rawProviderOutputAccessEnabled: false,
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

const blockers = [
  'No explicit provider call approval',
  'No credential access framework',
  'No network access configuration',
  'Orchestration execution blocked in wrapper-scaffolding-only phase',
  'Raw provider output access blocked',
  'Artifact persistence disabled',
  'Audit persistence disabled',
];

export function createVideoProviderDisabledOrchestrationFacade(): BrainCoreVideoProviderDisabledOrchestrationFacade {
  return {
    id: 'video-orchestrator-provider-disabled-orchestration-facade',
    status: 'facade-disabled',
    phase: 'provider-disabled-orchestration-facade',
    approvedScope: 'wrapper-scaffolding-only',
    composedScaffoldRefs,
    methodSurface: {
      describePipeline: methodSurface.describePipeline,
      validateEnvelopeOnly: methodSurface.validateEnvelopeOnly,
      redactFixtureOnly: methodSurface.redactFixtureOnly,
      describeAuditEventOnly: methodSurface.describeAuditEventOnly,
      attemptProviderCallDisabled: methodSurface.attemptProviderCallDisabled,
    },
    blockedActionResults: blockedActions.map((ba) => ({
      action: ba.action,
      providerCallBlocked: true,
      credentialAccessBlocked: true,
      networkAccessBlocked: true,
      executionBlocked: true,
    })),
    summary: {
      facadeCount: 1,
      composedScaffoldCount: 9,
      blockedMethodCount: 5,
      providerCallCount: 0,
      credentialAccessCount: 0,
      networkAccessCount: 0,
      executionCount: 0,
    },
    safety,
    blockers,
    nextSafeStep: 'Keep orchestration disabled; await explicit approval before provider wrapper execution enablement.',
  };
}

export function readVideoProviderDisabledOrchestrationFacadeStatus(): BrainCoreVideoProviderDisabledOrchestrationFacadeResponse {
  return {
    facade: createVideoProviderDisabledOrchestrationFacade(),
  };
}
