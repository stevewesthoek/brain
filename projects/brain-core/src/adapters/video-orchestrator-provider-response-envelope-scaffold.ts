import type {
  BrainCoreVideoProviderResponseEnvelopeScaffold,
  BrainCoreVideoProviderResponseEnvelopeScaffoldResponse,
} from '../types/api.js';

const allowedFields = [
  'requestId',
  'providerClass',
  'status',
  'redactedSummaryOnly',
  'policy refs',
  'audit refs',
  'error category',
] as const;

const prohibitedFields = [
  'raw provider response',
  'raw generated files',
  'raw prompt text',
  'raw credentials',
  'API keys',
  'OAuth tokens',
  'private keys',
  '.env values',
  'filesystem paths',
  'Mind vault paths',
  'STB artifact paths',
  'platform upload payloads',
  'unredacted logs',
] as const;

const safety: BrainCoreVideoProviderResponseEnvelopeScaffold['safety'] = {
  readOnlyStatusEndpoint: true,
  responseEnvelopeScaffoldingOnly: true,
  rawProviderOutputAccessEnabled: false,
  redactedManifestCreationEnabled: false,
  artifactPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  networkAccessEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
  postRoutesAdded: false,
  brainConsoleMutationControlsEnabled: false,
};

export function readVideoProviderResponseEnvelopeScaffold(): BrainCoreVideoProviderResponseEnvelopeScaffoldResponse {
  return {
    envelope: {
      id: 'video-orchestrator-provider-response-envelope-scaffold',
      status: 'scaffolded-disabled',
      phase: 'provider-response-envelope-scaffolding-only',
      responseEnvelopeShape: {
        requestId: 'request id',
        providerClass: 'provider class',
        status: 'status',
        redactedSummaryOnly: true,
        outputRedactionPolicyRef: 'output redaction policy ref',
        artifactManifestRefPlaceholder: 'artifact manifest ref placeholder',
        auditRefPlaceholder: 'audit ref placeholder',
        errorCategoryPlaceholder: 'error category placeholder',
        noRawProviderOutput: true,
      },
      allowedFields: [...allowedFields],
      prohibitedFields: [...prohibitedFields],
      validationRules: [
        'response envelope is inert and cannot carry raw output',
        'requestId is required',
        'providerClass is required',
        'status is required',
        'redactedSummaryOnly must be true',
        'outputRedactionPolicyRef is required',
        'artifactManifestRefPlaceholder is required',
        'auditRefPlaceholder is required',
        'errorCategoryPlaceholder is required',
        'noRawProviderOutput must be true',
      ],
      disabledCapabilities: [
        { capability: 'raw provider output access', enabled: false as const },
        { capability: 'redacted manifest creation', enabled: false as const },
        { capability: 'artifact persistence', enabled: false as const },
        { capability: 'audit persistence', enabled: false as const },
        { capability: 'provider calls', enabled: false as const },
        { capability: 'credential access', enabled: false as const },
        { capability: 'network access', enabled: false as const },
        { capability: 'filesystem access', enabled: false as const },
      ],
      summary: {
        responseEnvelopeShapeCount: 1,
        rawOutputAccessCount: 0,
        redactedManifestCreatedCount: 0,
        artifactPersistedCount: 0,
        auditPersistedCount: 0,
        providerCallCount: 0,
      },
      safety,
      blockers: [
        'raw provider output remains blocked',
        'artifact persistence remains blocked',
        'audit persistence remains blocked',
        'Brain Console remains read-only',
      ],
      nextSafeStep: 'Await explicit approval before any provider response envelope implementation beyond inert scaffolding.',
    },
  };
}
