import type {
  BrainCoreVideoProviderAuditPersistenceBoundaryPlan,
  BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry,
  BrainCoreVideoProviderAuditPersistenceBoundaryPlanResponse,
} from '../types/api.js';

const proposedAuditEventTypes = [
  'provider_request_planned',
  'prompt_review_completed',
  'credential_reference_checked',
  'provider_request_blocked',
  'provider_response_redacted',
  'artifact_handoff_reviewed',
  'compliance_check_reviewed',
] as const;

const proposedAuditRecordShape = [
  'auditEventIdPlaceholder',
  'providerClass',
  'eventType',
  'sourcePlanId',
  'operatorReviewRefPlaceholder',
  'credentialIsolationPlanRef',
  'promptReviewPolicyRef',
  'outputRedactionPolicyRef',
  'complianceChecklistRef',
  'timestampPlaceholder',
  'policyVersion',
  'redactedSummaryOnly',
] as const;

const allowedFutureAuditFields = [
  'auditEventId',
  'providerClass',
  'eventType',
  'sourcePlanId',
  'policyVersion',
  'redactedSummary',
  'operatorReviewRef',
  'createdAt',
  'expiresAt',
  'integrityHashPlaceholder',
] as const;

const disallowedAuditFields = [
  'raw provider response',
  'raw prompt text',
  'raw credentials',
  'API keys',
  'OAuth tokens',
  'private keys',
  '.env dumps',
  'filesystem paths outside approved sandbox',
  'Mind vault paths',
  'STB artifact paths',
  'platform upload payloads',
  'generated media files',
  'unredacted logs',
  'arbitrary shell output',
] as const;

const retentionRules = [
  'no persistence in this phase',
  'future records must be append-only',
  'future records must be redacted before persistence',
  'future records must include policy version',
  'future records must include expiry or retention class',
  'future records must be linked to operator review ref',
  'future records must not include raw provider output',
] as const;

const appendOnlyRules = [
  'no record mutation after append',
  'correction by follow-up event only',
  'no delete through provider audit API',
  'no overwrite through provider audit API',
  'no Mind note mutation',
  'no archive write in this phase',
] as const;

const safety: BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry['safety'] = {
  readOnly: true,
  implementationBoundaryOnly: true,
  auditPersistenceImplemented: false,
  auditRecordCreationEnabled: false,
  auditAppendEnabled: false,
  auditMutationEnabled: false,
  providerConfigured: false,
  providerCallsEnabled: false,
  rawProviderOutputAccessEnabled: false,
  credentialAccessEnabled: false,
  promptPersistenceEnabled: false,
  artifactPersistenceEnabled: false,
  filesystemAccessEnabled: false,
  networkAccessEnabled: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
  executesVideo: false,
};

function entry(
  input: Omit<BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry, 'safety'>,
): BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry {
  return { ...input, safety };
}

export function readVideoProviderAuditPersistenceBoundaryPlan(): BrainCoreVideoProviderAuditPersistenceBoundaryPlanResponse {
  const entries: BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry[] = [
    entry({
      providerClass: 'image-generation',
      status: 'blocked',
      implementationBoundaryOnly: true,
      auditPurpose: 'Define a future audit persistence boundary for image-generation provider activity without writing any audit records in this phase.',
      proposedAuditEventTypes: [...proposedAuditEventTypes],
      proposedAuditRecordShape: [...proposedAuditRecordShape],
      allowedFutureAuditFields: [...allowedFutureAuditFields],
      disallowedAuditFields: [...disallowedAuditFields],
      retentionRules: [...retentionRules],
      appendOnlyRules: [...appendOnlyRules],
      redactionRequirements: [
        'redact provider output before any future persistence',
        'preserve only stable references and policy versions',
        'exclude raw provider output and raw credentials',
      ],
      requiredPreImplementationApprovals: [
        'audit persistence implementation approval',
        'provider request wrapper approval',
        'prompt review UX approval',
        'credential isolation boundary approval',
        'output redaction approval',
      ],
      implementationBlockers: [
        'audit persistence is not implemented',
        'no audit record creation during this phase',
        'no raw provider output access',
      ],
      firstSafeImplementationSlice: 'Start with a redacted audit record schema and blocked append-only boundary after explicit approval.',
      nextSafeStep: 'Keep audit persistence as a boundary plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'layout-rendering',
      status: 'blocked',
      implementationBoundaryOnly: true,
      auditPurpose: 'Define a future audit persistence boundary for layout-rendering provider activity without writing any audit records in this phase.',
      proposedAuditEventTypes: [...proposedAuditEventTypes],
      proposedAuditRecordShape: [...proposedAuditRecordShape],
      allowedFutureAuditFields: [...allowedFutureAuditFields],
      disallowedAuditFields: [...disallowedAuditFields],
      retentionRules: [...retentionRules],
      appendOnlyRules: [...appendOnlyRules],
      redactionRequirements: [
        'redact provider output before any future persistence',
        'preserve only stable references and policy versions',
        'exclude raw provider output and raw credentials',
      ],
      requiredPreImplementationApprovals: [
        'audit persistence implementation approval',
        'provider request wrapper approval',
        'prompt review UX approval',
        'credential isolation boundary approval',
        'output redaction approval',
      ],
      implementationBlockers: [
        'audit persistence is not implemented',
        'no audit record creation during this phase',
        'no raw provider output access',
      ],
      firstSafeImplementationSlice: 'Start with a redacted audit record schema and blocked append-only boundary after explicit approval.',
      nextSafeStep: 'Keep audit persistence as a boundary plan only until explicit implementation approval is granted.',
    }),
    entry({
      providerClass: 'brand-compliance',
      status: 'blocked',
      implementationBoundaryOnly: true,
      auditPurpose: 'Define a future audit persistence boundary for brand-compliance provider activity without writing any audit records in this phase.',
      proposedAuditEventTypes: [...proposedAuditEventTypes],
      proposedAuditRecordShape: [...proposedAuditRecordShape],
      allowedFutureAuditFields: [...allowedFutureAuditFields],
      disallowedAuditFields: [...disallowedAuditFields],
      retentionRules: [...retentionRules],
      appendOnlyRules: [...appendOnlyRules],
      redactionRequirements: [
        'redact provider output before any future persistence',
        'preserve only stable references and policy versions',
        'exclude raw provider output and raw credentials',
      ],
      requiredPreImplementationApprovals: [
        'audit persistence implementation approval',
        'provider request wrapper approval',
        'prompt review UX approval',
        'credential isolation boundary approval',
        'output redaction approval',
      ],
      implementationBlockers: [
        'audit persistence is not implemented',
        'no audit record creation during this phase',
        'no raw provider output access',
      ],
      firstSafeImplementationSlice: 'Start with a redacted audit record schema and blocked append-only boundary after explicit approval.',
      nextSafeStep: 'Keep audit persistence as a boundary plan only until explicit implementation approval is granted.',
    }),
  ];

  const boundaryCount: 3 = 3;
  const blockedCount: 3 = 3;
  const implementationBoundaryOnlyCount: 3 = 3;
  const auditPersistenceImplementedCount: 0 = 0;
  const auditRecordCreatedCount: 0 = 0;
  const auditAppendEnabledCount: 0 = 0;
  const providerCallCount: 0 = 0;
  const rawOutputAccessCount: 0 = 0;

  const plan: BrainCoreVideoProviderAuditPersistenceBoundaryPlan = {
    id: 'video-orchestrator-provider-audit-persistence-boundary-plan',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    boundaryCount,
    blockedCount,
    implementationBoundaryOnlyCount,
    auditPersistenceImplementedCount,
    auditRecordCreatedCount,
    auditAppendEnabledCount,
    providerCallCount,
    rawOutputAccessCount,
    entries,
    summary: {
      boundaryCount,
      blockedCount,
      implementationBoundaryOnlyCount,
      auditPersistenceImplementedCount,
      auditRecordCreatedCount,
      auditAppendEnabledCount,
      providerCallCount,
      rawOutputAccessCount,
    },
    blockers: entries.flatMap((item) => item.implementationBlockers),
    nextSafeStep: 'Keep audit persistence as a boundary plan only until explicit implementation approval is granted.',
    safety,
  };

  return { plan };
}

export function readVideoProviderAuditPersistenceBoundaryPlanEntry(providerClass: string): BrainCoreVideoProviderAuditPersistenceBoundaryPlanEntry | undefined {
  return readVideoProviderAuditPersistenceBoundaryPlan().plan.entries.find((entry) => entry.providerClass === providerClass);
}
