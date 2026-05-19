import type {
  BrainCoreVideoCredentialStoreImplementationBoundaryPlan,
  BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry,
  BrainCoreVideoCredentialStoreImplementationBoundaryPlanResponse,
} from '../types/api.js';

const proposedReferenceModel = [
  'providerClass',
  'credentialRefIdPlaceholder',
  'credentialScope',
  'credentialPolicyVersion',
  'rotationPolicyRef',
  'revocationPolicyRef',
  'auditRefPlaceholder',
  'createdAtPlaceholder',
  'expiresAtPlaceholder',
] as const;

const allowedFutureReferenceFields = [
  'credentialRefId',
  'providerClass',
  'scope',
  'policyVersion',
  'createdAt',
  'expiresAt',
  'rotatedAt',
  'revokedAt',
  'auditRef',
] as const;

const disallowedStoredFields = [
  'raw API key',
  'raw OAuth token',
  'OAuth refresh token',
  'private key',
  'cookie',
  'password',
  '.env dump',
  'filesystem credential path',
  'plaintext provider secret',
  'platform account secret',
  'unredacted credential metadata',
  'Mind vault path',
  'STB artifact path',
] as const;

const storageBoundaryRules = [
  'store references only, never raw secrets',
  'redact all credential-like values',
  'no .env reads',
  'no filesystem credential discovery',
  'no Mind vault credential storage',
  'no STB artifact credential storage',
  'no provider account IDs in dashboard responses',
  'no raw credential display in Brain Console',
  'credential store unavailable in this phase',
] as const;

const accessBoundaryRules = [
  'no access without explicit user approval',
  'no access without provider request wrapper approval',
  'no access without prompt review approval',
  'no access without output redaction policy',
  'no access without audit reference',
  'no access during this phase',
] as const;

const safety: BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry['safety'] = {
  readOnly: true,
  implementationBoundaryOnly: true,
  credentialStoreImplemented: false,
  credentialAccessEnabled: false,
  credentialPersistenceEnabled: false,
  rawCredentialDisplayEnabled: false,
  envReadEnabled: false,
  keychainAccessEnabled: false,
  filesystemCredentialAccessEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  networkAccessEnabled: false,
  filesystemAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry, 'safety'>,
): BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry {
  return { ...input, safety };
}

export function readVideoCredentialStoreImplementationBoundaryPlan(): BrainCoreVideoCredentialStoreImplementationBoundaryPlanResponse {
  const entries: BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      implementationBoundaryOnly: true,
      credentialStorePurpose: 'Define the future credential store boundary for image-generation without storing or reading real credentials.',
      proposedReferenceModel: [...proposedReferenceModel],
      allowedFutureReferenceFields: [...allowedFutureReferenceFields],
      disallowedStoredFields: [...disallowedStoredFields],
      storageBoundaryRules: [...storageBoundaryRules],
      accessBoundaryRules: [...accessBoundaryRules],
      rotationAndRevocationPlan: 'Rotation and revocation will reference policy IDs only and remain design-only until explicit approval.',
      auditRequirements: [
        'Use audit reference placeholders only.',
        'Do not persist audit records in this phase.',
        'Any future audit surface must remain redacted and immutable.',
      ],
      failureModes: [
        'missing approval',
        'missing boundary design',
        'credential store unavailable',
        'credential boundary violation',
        'unexpected credential-like input',
        'policy reference unavailable',
      ],
      requiredPreImplementationApprovals: [
        'credential store implementation approval',
        'provider request wrapper approval',
        'prompt review approval',
        'output redaction approval',
        'audit reference approval',
      ],
      implementationBlockers: [
        'credential store is not implemented',
        'no credential access during this phase',
        'no filesystem credential discovery',
      ],
      firstSafeImplementationSlice: 'Start with a reference-model validator and blocked boundary response only after explicit approval.',
      nextSafeStep: 'Keep credential storage as a boundary plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      implementationBoundaryOnly: true,
      credentialStorePurpose: 'Define the future credential store boundary for layout-rendering without storing or reading real credentials.',
      proposedReferenceModel: [...proposedReferenceModel],
      allowedFutureReferenceFields: [...allowedFutureReferenceFields],
      disallowedStoredFields: [...disallowedStoredFields],
      storageBoundaryRules: [...storageBoundaryRules],
      accessBoundaryRules: [...accessBoundaryRules],
      rotationAndRevocationPlan: 'Rotation and revocation will reference policy IDs only and remain design-only until explicit approval.',
      auditRequirements: [
        'Use audit reference placeholders only.',
        'Do not persist audit records in this phase.',
        'Any future audit surface must remain redacted and immutable.',
      ],
      failureModes: [
        'missing approval',
        'missing boundary design',
        'credential store unavailable',
        'credential boundary violation',
        'unexpected credential-like input',
        'policy reference unavailable',
      ],
      requiredPreImplementationApprovals: [
        'credential store implementation approval',
        'provider request wrapper approval',
        'prompt review approval',
        'output redaction approval',
        'audit reference approval',
      ],
      implementationBlockers: [
        'credential store is not implemented',
        'no credential access during this phase',
        'no filesystem credential discovery',
      ],
      firstSafeImplementationSlice: 'Start with a reference-model validator and blocked boundary response only after explicit approval.',
      nextSafeStep: 'Keep credential storage as a boundary plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      implementationBoundaryOnly: true,
      credentialStorePurpose: 'Define the future credential store boundary for brand-compliance without storing or reading real credentials.',
      proposedReferenceModel: [...proposedReferenceModel],
      allowedFutureReferenceFields: [...allowedFutureReferenceFields],
      disallowedStoredFields: [...disallowedStoredFields],
      storageBoundaryRules: [...storageBoundaryRules],
      accessBoundaryRules: [...accessBoundaryRules],
      rotationAndRevocationPlan: 'Rotation and revocation will reference policy IDs only and remain design-only until explicit approval.',
      auditRequirements: [
        'Use audit reference placeholders only.',
        'Do not persist audit records in this phase.',
        'Any future audit surface must remain redacted and immutable.',
      ],
      failureModes: [
        'missing approval',
        'missing boundary design',
        'credential store unavailable',
        'credential boundary violation',
        'unexpected credential-like input',
        'policy reference unavailable',
      ],
      requiredPreImplementationApprovals: [
        'credential store implementation approval',
        'provider request wrapper approval',
        'prompt review approval',
        'output redaction approval',
        'audit reference approval',
      ],
      implementationBlockers: [
        'credential store is not implemented',
        'no credential access during this phase',
        'no filesystem credential discovery',
      ],
      firstSafeImplementationSlice: 'Start with a reference-model validator and blocked boundary response only after explicit approval.',
      nextSafeStep: 'Keep credential storage as a boundary plan only until explicit implementation approval is granted.',
    }),
  ];

  const boundaryCount: 3 = 3;
  const blockedCount: 3 = 3;
  const implementationBoundaryOnlyCount: 3 = 3;
  const credentialStoreImplementedCount: 0 = 0;
  const credentialAccessCount: 0 = 0;
  const credentialPersistedCount: 0 = 0;
  const envReadCount: 0 = 0;
  const keychainAccessCount: 0 = 0;
  const providerCallCount: 0 = 0;

  const plan: BrainCoreVideoCredentialStoreImplementationBoundaryPlan = {
    id: 'video-orchestrator-credential-store-implementation-boundary-plan',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    boundaryCount,
    blockedCount,
    implementationBoundaryOnlyCount,
    credentialStoreImplementedCount,
    credentialAccessCount,
    credentialPersistedCount,
    envReadCount,
    keychainAccessCount,
    providerCallCount,
    entries,
    summary: {
      boundaryCount,
      blockedCount,
      implementationBoundaryOnlyCount,
      credentialStoreImplementedCount,
      credentialAccessCount,
      credentialPersistedCount,
      envReadCount,
      keychainAccessCount,
      providerCallCount,
    },
    blockers: entries.flatMap(entry => entry.implementationBlockers),
    nextSafeStep: 'Keep credential storage as a boundary plan only until explicit implementation approval is granted.',
    safety,
  };

  return { plan };
}

export function readVideoCredentialStoreImplementationBoundaryPlanEntry(providerClass: string): BrainCoreVideoCredentialStoreImplementationBoundaryPlanEntry | undefined {
  return readVideoCredentialStoreImplementationBoundaryPlan().plan.entries.find(entry => entry.providerClass === providerClass);
}
