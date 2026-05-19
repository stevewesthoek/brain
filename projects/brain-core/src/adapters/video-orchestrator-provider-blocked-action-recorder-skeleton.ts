import type {
  BrainCoreVideoProviderBlockedActionRecorderSkeleton,
  BrainCoreVideoProviderBlockedActionRecorderSkeletonResponse,
} from '../types/api.js';

const fixtureActionTypes = [
  'provider_call_blocked',
  'credential_access_blocked',
  'env_read_blocked',
  'network_access_blocked',
  'prompt_generation_blocked',
  'image_generation_blocked',
  'raw_output_access_blocked',
  'artifact_write_blocked',
  'audit_persist_blocked',
  'ledger_persist_blocked',
  'mutation_control_blocked',
  'post_route_blocked',
] as const;

export interface BlockedActionFixtureInput {
  actionType: (typeof fixtureActionTypes)[number];
  providerClass: string;
  sourcePlanId: string;
}

export interface BlockedActionFixtureResult {
  actionType: string;
  providerClass: string;
  sourcePlanId: string;
  persisted: false;
  appended: false;
  externalMutation: false;
  providerCallBlocked: true;
  credentialAccessBlocked: true;
  networkAccessBlocked: true;
  executionBlocked: true;
  redactedSummaryOnly: true;
}

const safety: BrainCoreVideoProviderBlockedActionRecorderSkeleton['safety'] = {
  readOnlyStatusEndpoint: true,
  pureRecorderSkeletonOnly: true,
  persistenceEnabled: false,
  appendEnabled: false,
  externalMutationEnabled: false,
  ledgerPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  credentialAccessEnabled: false,
  envReadEnabled: false,
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
  'No persistence layer configured for blocked actions',
  'No append operations implemented',
  'All provider calls remain blocked in wrapper-scaffolding-only phase',
  'External mutation disabled for safety',
  'Ledger persistence disabled',
  'Audit persistence disabled',
];

const fixtureDefaults: BlockedActionFixtureResult[] = fixtureActionTypes.map((actionType) => ({
  actionType,
  providerClass: 'fixture-provider',
  sourcePlanId: 'fixture-plan',
  persisted: false as const,
  appended: false as const,
  externalMutation: false as const,
  providerCallBlocked: true as const,
  credentialAccessBlocked: true as const,
  networkAccessBlocked: true as const,
  executionBlocked: true as const,
  redactedSummaryOnly: true as const,
}));

export function recordVideoProviderBlockedActionFixture(
  input: BlockedActionFixtureInput,
): BlockedActionFixtureResult {
  return {
    actionType: input.actionType,
    providerClass: input.providerClass,
    sourcePlanId: input.sourcePlanId,
    persisted: false,
    appended: false,
    externalMutation: false,
    providerCallBlocked: true,
    credentialAccessBlocked: true,
    networkAccessBlocked: true,
    executionBlocked: true,
    redactedSummaryOnly: true,
  };
}

export function readVideoProviderBlockedActionRecorderSkeletonStatus(): BrainCoreVideoProviderBlockedActionRecorderSkeletonResponse {
  return {
    skeleton: {
      id: 'video-orchestrator-provider-blocked-action-recorder-skeleton',
      status: 'scaffolded-disabled',
      phase: 'blocked-action-recorder-skeleton-without-persistence',
      approvedScope: 'wrapper-scaffolding-only',
      fixtureCount: fixtureActionTypes.length,
      recordedFixtureCount: fixtureDefaults.length,
      persistedRecordCount: 0,
      appendCount: 0,
      externalMutationCount: 0,
      fixtureResults: fixtureDefaults,
      summary: {
        fixtureCount: fixtureActionTypes.length,
        recordedCount: fixtureDefaults.length,
        persistedCount: 0,
        appendCount: 0,
        mutationCount: 0,
      },
      safety,
      blockers,
      nextSafeStep: 'Fixture expansion for all action types; no persistence implementation until explicit approval.',
    },
  };
}
