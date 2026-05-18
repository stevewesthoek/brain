import type {
  BrainCoreVideoControlledExecutionApprovalStoreImplementationPlan,
  BrainCoreVideoControlledExecutionApprovalStoreImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionFeatureFlagRolloutPlan } from './video-orchestrator-controlled-execution-feature-flag-rollout-plan.js';

const safety: BrainCoreVideoControlledExecutionApprovalStoreImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  approvalStoreEnabled: false,
  persistenceEnabled: false,
  approvalCreationEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
  expiryEnforcementEnabled: false,
  revocationEnabled: false,
  auditLinkingEnabled: false,
  featureFlagsEnabled: false,
  flagEvaluationEnabled: false,
  validatorExecutionEnabled: false,
  lockPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  sandboxProvisioningEnabled: false,
  registersAction: false,
  registersAllowlist: false,
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

export function readVideoControlledExecutionApprovalStoreImplementationPlan(): BrainCoreVideoControlledExecutionApprovalStoreImplementationPlanResponse {
  const flagRollout = readVideoControlledExecutionFeatureFlagRolloutPlan().plan;

  const proposedSchema = [
    'approvalId',
    'approvalType',
    'candidateStoryId',
    'sourceEpisodeId',
    'operatorIdPlaceholder',
    'operatorRolePlaceholder',
    'approvalScopeHash',
    'preflightEvidenceHash',
    'policyVersion',
    'status',
    'createdAt',
    'expiresAt',
    'revokedAt',
    'invalidatedAt',
    'auditTrailRef',
  ];

  const lifecycleStates = [
    'draft_design_only',
    'requested_not_persisted',
    'first_approval_pending',
    'first_approval_blocked',
    'second_approval_pending',
    'second_approval_blocked',
    'expired',
    'revoked',
    'invalidated',
    'execution_still_disabled',
  ];

  const storageRequirements = [
    'local-only storage policy required',
    'safe path policy required',
    'append-only audit link required',
    'expiry enforcement policy required',
    'revocation policy required',
    'corruption recovery policy required',
    'backup/restore policy required',
  ];

  const blockingRequirements = [
    'no approved persistence policy',
    'no approved safe storage path',
    'no approved expiry enforcement policy',
    'no approved revocation policy',
    'no approved audit link policy',
    'no approved corruption recovery policy',
    'no explicit approval to implement storage',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-feature-flag-rollout-plan',
    '/video-orchestrator/controlled-execution-implementation-readiness-checkpoint',
    '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model',
    '/video-orchestrator/controlled-execution-immutable-audit-trail-schema',
    '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design',
  ];

  const blockers = [
    ...flagRollout.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-approval-store-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6c',
      status: 'not-ready',
      planExists: false,
      approvalStoreEnabled: false,
      persistenceEnabled: false,
      approvalCreationEnabled: false,
      approvalExecutionEnabled: false,
      expiryEnforcementEnabled: false,
      revocationEnabled: false,
      auditLinkingEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        schemaSectionCount: proposedSchema.length,
        lifecycleStateCount: lifecycleStates.length,
        blockerCount: blockers.length,
        requiredPolicyCount: storageRequirements.length,
      },
      proposedSchema,
      lifecycleStates,
      storageRequirements,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create first-approval creation implementation plan before enabling any approval store or persistence.',
      safety,
    },
  };
}
