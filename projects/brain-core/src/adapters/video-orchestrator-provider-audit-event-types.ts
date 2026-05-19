import type {
  BrainCoreVideoProviderAuditEventTypes,
  BrainCoreVideoProviderAuditEventTypesResponse,
} from '../types/api.js';

const eventTypes = [
  'provider_request_scaffold_validated',
  'credential_reference_validated',
  'request_envelope_validated',
  'response_envelope_redacted',
  'provider_call_blocked',
  'credential_access_blocked',
  'audit_persistence_blocked',
] as const;

const prohibitedFields = [
  'raw provider response',
  'raw prompt text',
  'raw credentials',
  'API keys',
  'OAuth tokens',
  'private keys',
  '.env dumps',
  'filesystem paths',
  'Mind vault paths',
  'STB artifact paths',
  'unredacted logs',
] as const;

const safety: BrainCoreVideoProviderAuditEventTypes['safety'] = {
  readOnlyStatusEndpoint: true,
  eventTypeDefinitionsOnly: true,
  auditPersistenceEnabled: false,
  auditAppendEnabled: false,
  auditMutationEnabled: false,
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

export function readVideoProviderAuditEventTypes(): BrainCoreVideoProviderAuditEventTypesResponse {
  return {
    audit: {
      id: 'video-orchestrator-provider-audit-event-types',
      status: 'scaffolded-disabled',
      phase: 'provider-audit-event-type-definitions',
      eventTypes: [...eventTypes],
      eventShape: {
        eventType: 'event type',
        providerClass: 'provider class',
        sourcePlanId: 'source plan id',
        requestIdPlaceholder: 'request id placeholder',
        redactedSummaryOnly: true,
        policyVersion: 'policy version',
        auditRefPlaceholder: 'audit ref placeholder',
        createdAtPlaceholder: 'created at placeholder',
        noRawProviderOutput: true,
      },
      prohibitedFields: [...prohibitedFields],
      summary: {
        eventTypeCount: 7,
        auditPersistenceCount: 0,
        auditAppendCount: 0,
        rawOutputAccessCount: 0,
        credentialAccessCount: 0,
      },
      safety,
      nextSafeStep: 'Await explicit approval before any audit event persistence or append implementation.',
    },
  };
}
