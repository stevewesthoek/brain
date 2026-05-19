import type {
  BrainCoreVideoCredentialReferenceValidator,
  BrainCoreVideoCredentialReferenceValidatorFixture,
  BrainCoreVideoCredentialReferenceValidatorFixtureResult,
  BrainCoreVideoCredentialReferenceValidatorInput,
  BrainCoreVideoCredentialReferenceValidatorResponse,
} from '../types/api.js';

const supportedProviderClasses = ['image-generation', 'layout-rendering', 'brand-compliance'] as const;

const forbiddenKeyPatterns = [
  'apikey',
  'api_key',
  'oauth',
  'token',
  'privatekey',
  'private_key',
  'cookie',
  'password',
  'secret',
  'env',
  'path',
  'vault',
  'artifact',
] as const;

const forbiddenValuePatterns = [
  /^sk-[A-Za-z0-9]{12,}$/,
  /^ya29\.[A-Za-z0-9._-]+$/,
  /BEGIN [A-Z ]+PRIVATE KEY/,
  /Bearer\s+[A-Za-z0-9._-]+/,
  /(^|[^\w])\/[^\s]+/,
  /\.env\b/,
  /mind\/vault/i,
  /stb\/artifact/i,
] as const;

const fixtureDefinitions: BrainCoreVideoCredentialReferenceValidatorFixture[] = [
  {
    fixtureId: 'valid-image-generation',
    input: {
      credentialRefId: 'cred-ref-image-generation',
      providerClass: 'image-generation',
      scope: 'provider-access',
      policyVersion: 'v1',
      createdAtPlaceholder: 'created-at',
      expiresAtPlaceholder: 'expires-at',
      rotatedAtPlaceholder: 'rotated-at',
      revokedAtPlaceholder: 'revoked-at',
      auditRefPlaceholder: 'audit-ref',
    },
    expectedOutcome: 'valid-opaque-reference',
    notes: 'valid-shaped image-generation credential reference',
  },
  {
    fixtureId: 'valid-layout-rendering',
    input: {
      credentialRefId: 'cred-ref-layout-rendering',
      providerClass: 'layout-rendering',
      scope: 'provider-access',
      policyVersion: 'v1',
      createdAtPlaceholder: 'created-at',
      expiresAtPlaceholder: 'expires-at',
      rotatedAtPlaceholder: 'rotated-at',
      revokedAtPlaceholder: 'revoked-at',
      auditRefPlaceholder: 'audit-ref',
    },
    expectedOutcome: 'valid-opaque-reference',
    notes: 'valid-shaped layout-rendering credential reference',
  },
  {
    fixtureId: 'valid-brand-compliance',
    input: {
      credentialRefId: 'cred-ref-brand-compliance',
      providerClass: 'brand-compliance',
      scope: 'provider-access',
      policyVersion: 'v1',
      createdAtPlaceholder: 'created-at',
      expiresAtPlaceholder: 'expires-at',
      rotatedAtPlaceholder: 'rotated-at',
      revokedAtPlaceholder: 'revoked-at',
      auditRefPlaceholder: 'audit-ref',
    },
    expectedOutcome: 'valid-opaque-reference',
    notes: 'valid-shaped brand-compliance credential reference',
  },
  {
    fixtureId: 'missing-required-fields',
    input: {
      providerClass: 'image-generation',
    },
    expectedOutcome: 'missing-required-fields',
    notes: 'missing required fields credential reference',
  },
  {
    fixtureId: 'unsupported-provider-class',
    input: {
      credentialRefId: 'cred-ref-unsupported',
      providerClass: 'unsupported-provider',
      scope: 'provider-access',
      policyVersion: 'v1',
      createdAtPlaceholder: 'created-at',
      expiresAtPlaceholder: 'expires-at',
      rotatedAtPlaceholder: 'rotated-at',
      revokedAtPlaceholder: 'revoked-at',
      auditRefPlaceholder: 'audit-ref',
    } as unknown as Record<string, unknown>,
    expectedOutcome: 'unsupported-provider-class',
    notes: 'unsupported provider class credential reference',
  },
  {
    fixtureId: 'unsafe-secret-value',
    input: {
      credentialRefId: 'sk-very-secret-token',
      providerClass: 'layout-rendering',
      scope: 'provider-access',
      policyVersion: 'v1',
      createdAtPlaceholder: 'created-at',
      expiresAtPlaceholder: 'expires-at',
      rotatedAtPlaceholder: 'rotated-at',
      revokedAtPlaceholder: 'revoked-at',
      auditRefPlaceholder: 'audit-ref',
      apiKey: 'abc123',
    } as Record<string, unknown>,
    expectedOutcome: 'unsafe-secret-value',
    notes: 'unsafe secret-like credential reference',
  },
];

const safety: BrainCoreVideoCredentialReferenceValidator['safety'] = {
  readOnlyStatusEndpoint: true,
  pureValidatorOnly: true,
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

function isSupportedProviderClass(providerClass: unknown): providerClass is (typeof supportedProviderClasses)[number] {
  return typeof providerClass === 'string' && supportedProviderClasses.includes(providerClass as (typeof supportedProviderClasses)[number]);
}

function isUnsafeString(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  return forbiddenValuePatterns.some((pattern) => pattern.test(value));
}

function findUnsafeFields(input: Record<string, unknown>): string[] {
  const unsafeFields = new Set<string>();

  for (const [key, value] of Object.entries(input)) {
    const normalizedKey = key.toLowerCase();
    if (forbiddenKeyPatterns.some((pattern) => normalizedKey.includes(pattern))) {
      unsafeFields.add(key);
    }
    if (isUnsafeString(value)) {
      unsafeFields.add(key);
    }
  }

  return [...unsafeFields];
}

export function validateVideoCredentialReference(
  input: Partial<BrainCoreVideoCredentialReferenceValidatorInput> & Record<string, unknown>,
): BrainCoreVideoCredentialReferenceValidatorFixtureResult {
  const requiredFields: Array<keyof BrainCoreVideoCredentialReferenceValidatorInput> = [
    'credentialRefId',
    'providerClass',
    'scope',
    'policyVersion',
    'createdAtPlaceholder',
    'expiresAtPlaceholder',
    'rotatedAtPlaceholder',
    'revokedAtPlaceholder',
    'auditRefPlaceholder',
  ];

  const missingFields = requiredFields.filter((field) => !input[field]).map(String);
  const unsafeFields = findUnsafeFields(input);
  const valid = missingFields.length === 0 && unsafeFields.length === 0 && isSupportedProviderClass(input.providerClass);

  return {
    valid,
    missingFields,
    unsafeFields,
    providerCallBlocked: true,
    executionBlocked: true,
    credentialAccessBlocked: true,
    envReadBlocked: true,
    keychainAccessBlocked: true,
  };
}

function toFixtureResult(
  fixture: BrainCoreVideoCredentialReferenceValidatorFixture,
): BrainCoreVideoCredentialReferenceValidatorResponse['validator']['fixtureResults'][number] {
  return {
    fixtureId: fixture.fixtureId,
    providerClass: String(fixture.input.providerClass ?? 'unknown'),
    expectedOutcome: fixture.expectedOutcome,
    notes: fixture.notes,
    ...validateVideoCredentialReference(fixture.input),
  };
}

export function readVideoCredentialReferenceValidatorStatus(): BrainCoreVideoCredentialReferenceValidatorResponse {
  const fixtureResults = fixtureDefinitions.map((fixture) => toFixtureResult(fixture));

  return {
    validator: {
      id: 'video-orchestrator-credential-reference-validator',
      status: 'scaffolded-disabled',
      phase: 'credential-reference-validator',
      implementationApprovedScope: 'wrapper-scaffolding-only',
      validatorCount: 1,
      fixtureCount: fixtureResults.length,
      validFixtureCount: fixtureResults.filter((fixture) => fixture.valid).length,
      blockedFixtureCount: fixtureResults.length,
      credentialAccessCount: 0,
      envReadCount: 0,
      keychainAccessCount: 0,
      fixtureResults,
      safety,
      blockers: [
        'credential access remains blocked',
        'environment reads remain blocked',
        'keychain access remains blocked',
      ],
      nextSafeStep: 'Await explicit approval before any credential reference implementation beyond inert validation.',
    },
  };
}

export const readVideoCredentialReferenceValidator = readVideoCredentialReferenceValidatorStatus;
