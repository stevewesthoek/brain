import type {
  BrainCoreVideoControlledExecutionImmutableAuditTrailSchema,
  BrainCoreVideoControlledExecutionImmutableAuditTrailSchemaResponse,
} from '../types/api.js';
import { readVideoControlledExecutionApprovalReviewAudit } from './video-orchestrator-controlled-execution-approval-review-audit-design.js';

const safety: BrainCoreVideoControlledExecutionImmutableAuditTrailSchema['safety'] = {
  readOnly: true,
  schemaDesignOnly: true,
  auditTrailPersistenceEnabled: false,
  immutableStoreEnabled: false,
  appendOnlyWriteEnabled: false,
  hashComputationEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
  registersAction: false,
  registersAllowlist: false,
  runsValidator: false,
  createsExecutionPlan: false,
  executionPlanExecutable: false,
  executionEnabled: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  rendersVideo: false,
  exportsArtifacts: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

export function readVideoControlledExecutionImmutableAuditTrailSchema(): BrainCoreVideoControlledExecutionImmutableAuditTrailSchemaResponse {
  const reviewAudit = readVideoControlledExecutionApprovalReviewAudit().review;

  const auditEventTypes = [
    'candidate_lock_reviewed',
    'preflight_evidence_reviewed',
    'first_approval_reviewed',
    'second_approval_policy_reviewed',
    'sandbox_boundary_reviewed',
    'execution_denied',
    'approval_expired',
    'approval_invalidated',
  ];

  const auditRecordFields = [
    'eventId',
    'eventType',
    'candidateStoryId',
    'sourceEpisodeId',
    'operatorIdPlaceholder',
    'operatorRolePlaceholder',
    'policyVersion',
    'evidenceHashPlaceholder',
    'previousRecordHashPlaceholder',
    'recordHashPlaceholder',
    'createdAt',
    'expiresAt',
    'invalidatedAt',
  ];

  const immutabilityRules = [
    'Append-only design only',
    'No writes enabled',
    'No persistence enabled',
    'No hash computation over real files',
    'No approval creation',
    'No execution',
    'No external network access',
    'No Mind writes',
    'All records immutable once created',
  ];

  const missingRequirements = [
    'No immutable audit trail store',
    'No append-only write mechanism',
    'No hash chain validation',
    'No event persistence path',
    'No record invalidation mechanism',
    'No concurrent event conflict detection',
    'No audit trail integrity verification',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-approval-review-audit-design',
    '/video-orchestrator/controlled-execution-preflight-evidence-hash-design',
    '/video-orchestrator/controlled-execution-candidate-story-lock-design',
    '/video-orchestrator/controlled-execution-policy-boundary',
  ];

  const blockers = [
    ...reviewAudit.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    schema: {
      id: 'video-orchestrator-controlled-execution-immutable-audit-trail-schema',
      generatedAt: new Date().toISOString(),
      version: 'phase-5q',
      status: 'blocked',
      schemaExists: false,
      auditTrailPersistenceEnabled: false,
      immutableStoreEnabled: false,
      appendOnlyWriteEnabled: false,
      approvalCreationEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        eventTypeCount: auditEventTypes.length,
        recordFieldCount: auditRecordFields.length,
        immutabilityRuleCount: immutabilityRules.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      auditEventTypes,
      auditRecordFields,
      immutabilityRules,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep immutable audit trail schema read-only; do not persist audit events or enable writes.',
      safety,
    },
  };
}
