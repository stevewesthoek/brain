import type {
  BrainCoreVideoCredentialReferenceScaffold,
  BrainCoreVideoCredentialReferenceScaffoldResponse,
} from '../types/api.js';

const providerClasses = ['image-generation', 'layout-rendering', 'brand-compliance'] as const;

const referenceShape: BrainCoreVideoCredentialReferenceScaffold['referenceShape'] = {
  credentialRefId: 'opaque credential reference id',
  providerClass: 'supported provider class',
  scope: 'credential scope',
  policyVersion: 'policy version',
  createdAtPlaceholder: 'created at placeholder',
  expiresAtPlaceholder: 'expires at placeholder',
  rotatedAtPlaceholder: 'rotated at placeholder',
  revokedAtPlaceholder: 'revoked at placeholder',
  auditRefPlaceholder: 'audit ref placeholder',
};

const validationRules = [
  'providerClass must be supported',
  'credentialRefId must be opaque',
  'no raw credential values allowed',
  'no API keys allowed',
  'no OAuth tokens allowed',
  'no private keys allowed',
  'no .env values allowed',
  'no filesystem credential paths allowed',
  'no Mind vault paths allowed',
  'no STB artifact paths allowed',
  'credential access is blocked in this scaffold phase',
] as const;

const disabledCapabilities = [
  'credential access',
  'credential persistence',
  'raw credential display',
  'env reads',
  'keychain access',
  'filesystem credential access',
  'provider configuration',
  'provider calls',
  'network access',
  'file writes',
  'publishing',
  'Mind writes',
  'Video execution',
  'POST routes',
  'Brain Console mutation controls',
] as const;

const safety: BrainCoreVideoCredentialReferenceScaffold['safety'] = {
  readOnlyStatusEndpoint: true,
  credentialReferenceScaffoldingOnly: true,
  credentialAccessEnabled: false,
  credentialPersistenceEnabled: false,
  rawCredentialDisplayEnabled: false,
  envReadEnabled: false,
  keychainAccessEnabled: false,
  filesystemCredentialAccessEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  networkAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
  postRoutesAdded: false,
  brainConsoleMutationControlsEnabled: false,
};

export function readVideoCredentialReferenceScaffold(): BrainCoreVideoCredentialReferenceScaffoldResponse {
  return {
    scaffold: {
      id: 'video-orchestrator-credential-reference-scaffold',
      status: 'scaffolded-disabled',
      phase: 'credential-reference-scaffolding-only',
      implementationApprovedScope: 'wrapper-scaffolding-only',
      providerClasses: [...providerClasses],
      referenceShape,
      validationRules: [...validationRules],
      disabledCapabilities: disabledCapabilities.map((capability) => ({ capability, enabled: false as const })),
      summary: {
        providerClassCount: 3,
        referenceShapeCount: 1,
        credentialAccessCount: 0,
        credentialPersistedCount: 0,
        envReadCount: 0,
        keychainAccessCount: 0,
      },
      safety,
      blockers: [
        'credential access remains blocked',
        'credential persistence remains blocked',
        'environment reads remain blocked',
        'Brain Console remains read-only',
      ],
      nextSafeStep: 'Await explicit approval before any credential reference implementation beyond inert scaffolding.',
    },
  };
}
