import type {
  BrainCoreVideoProviderBlockedActionLedgerEntry,
  BrainCoreVideoProviderBlockedActionLedgerTypes,
  BrainCoreVideoProviderBlockedActionLedgerTypesResponse,
} from '../types/api.js';

const blockedActionTypes = [
  'provider_call_blocked',
  'credential_access_blocked',
  'env_read_blocked',
  'network_access_blocked',
  'prompt_generation_blocked',
  'image_generation_blocked',
  'raw_output_access_blocked',
  'artifact_write_blocked',
  'audit_persist_blocked',
  'mutation_control_blocked',
  'post_route_blocked',
] as const;

const ledgerEntryShapeFixture: BrainCoreVideoProviderBlockedActionLedgerEntry = {
  blockedActionIdPlaceholder: 'blocked-action-{provider-class}-{timestamp}',
  actionType: 'provider_call_blocked',
  providerClass: '{provider-class}',
  sourcePlanId: '{source-plan-id}',
  blockedReason: 'Action blocked by wrapper-scaffolding-only policy',
  requiredApproval: 'Explicit approval required to enable this action',
  policyVersion: 'wrapper-scaffolding-only-v1',
  redactedSummaryOnly: true,
  createdAtPlaceholder: '{created-at-iso}',
  auditRefPlaceholder: '{audit-ref}',
  noRawProviderOutput: true,
  noCredentials: true,
};

const safety: BrainCoreVideoProviderBlockedActionLedgerTypes['safety'] = {
  readOnlyStatusEndpoint: true,
  ledgerTypeDefinitionsOnly: true,
  ledgerPersistenceEnabled: false,
  ledgerAppendEnabled: false,
  ledgerMutationEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  rawProviderOutputAccessEnabled: false,
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

const blockers = [
  'Ledger persistence not implemented in wrapper-scaffolding-only phase',
  'Ledger append operations disabled',
  'Ledger mutations disabled',
  'All action types remain blocked until explicit approval',
];

export function readVideoProviderBlockedActionLedgerTypes(): BrainCoreVideoProviderBlockedActionLedgerTypesResponse {
  const ledger: BrainCoreVideoProviderBlockedActionLedgerTypes = {
    id: 'video-orchestrator-provider-blocked-action-ledger-types',
    status: 'facade-disabled',
    phase: 'provider-blocked-action-ledger-types',
    blockedActionTypes: [...blockedActionTypes],
    ledgerEntryShape: ledgerEntryShapeFixture,
    summary: {
      blockedActionTypeCount: blockedActionTypes.length,
      ledgerPersistenceCount: 0,
      appendEnabledCount: 0,
      mutationEnabledCount: 0,
      rawOutputAccessCount: 0,
      credentialAccessCount: 0,
    },
    safety,
    blockers,
    nextSafeStep: 'Keep ledger persistence disabled; type definitions ready for future audit event implementation.',
  };

  return { ledger };
}
