import type {
  BrainCoreVideoControlledExecutionFirstApprovalCreationImplementationPlan,
  BrainCoreVideoControlledExecutionFirstApprovalCreationImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionApprovalStoreImplementationPlan } from './video-orchestrator-controlled-execution-approval-store-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionFirstApprovalCreationImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  firstApprovalCreationEnabled: false,
  approvalCreationEnabled: false,
  approvalStoreEnabled: false,
  persistenceEnabled: false,
  operatorVerificationEnabled: false,
  roleEnforcementEnabled: false,
  scopeValidationEnabled: false,
  evidenceCaptureEnabled: false,
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

export function readVideoControlledExecutionFirstApprovalCreationImplementationPlan(): BrainCoreVideoControlledExecutionFirstApprovalCreationImplementationPlanResponse {
  const approvalStore = readVideoControlledExecutionApprovalStoreImplementationPlan().plan;

  const requiredInputs = [
    'candidateStoryId',
    'sourceEpisodeId',
    'operatorIdentity',
    'operatorRole',
    'candidateStoryLockRef',
    'preflightEvidenceHashRef',
    'operatorDecisionSnapshotRef',
    'approvalStorePolicyRef',
    'auditTrailSchemaRef',
    'rationale',
  ];

  const validationSteps = [
    'verify feature flag framework approved',
    'verify approval store plan approved',
    'verify operator identity protocol approved',
    'verify role policy approved',
    'verify candidate/story lock exists',
    'verify preflight evidence hash exists',
    'verify operator decision snapshot exists',
    'verify approval scope is single-story only',
    'verify approval does not authorize execution',
    'verify second approval remains required',
    'verify no concurrent approvals exist',
    'verify immutable audit trail policy exists',
  ];

  const outputRecordShape = [
    'approvalId',
    'approvalType: first_approval',
    'status: first_approval_pending',
    'candidateStoryId',
    'sourceEpisodeId',
    'operatorIdPlaceholder',
    'operatorRolePlaceholder',
    'scopeHashPlaceholder',
    'evidenceHashPlaceholder',
    'createdAt',
    'expiresAt',
    'invalidatedAt',
    'invalidationReason',
    'auditTrailRef',
  ];

  const implementationGates = [
    'feature flag rollout plan',
    'approval store implementation plan',
    'operator identity implementation plan',
    'role policy enforcement implementation plan',
    'candidate/story lock persistence plan',
    'immutable audit trail persistence plan',
  ];

  const blockingRequirements = [
    'no approved feature flag framework',
    'no approved approval store implementation',
    'no approved operator verification implementation',
    'no approved role enforcement implementation',
    'no approved candidate/story lock persistence',
    'no approved audit persistence',
    'no approved concurrency check',
    'no explicit approval to create first approvals',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-approval-store-implementation-plan',
    '/video-orchestrator/controlled-execution-feature-flag-rollout-plan',
    '/video-orchestrator/controlled-execution-first-approval-authority-policy',
    '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model',
    '/video-orchestrator/controlled-execution-candidate-story-lock-design',
    '/video-orchestrator/controlled-execution-preflight-evidence-hash-design',
    '/video-orchestrator/controlled-execution-operator-decision-snapshot-design',
    '/video-orchestrator/controlled-execution-immutable-audit-trail-schema',
  ];

  const blockers = [
    ...approvalStore.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-first-approval-creation-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6d',
      status: 'not-ready',
      planExists: false,
      firstApprovalCreationEnabled: false,
      approvalCreationEnabled: false,
      approvalStoreEnabled: false,
      persistenceEnabled: false,
      operatorVerificationEnabled: false,
      roleEnforcementEnabled: false,
      scopeValidationEnabled: false,
      evidenceCaptureEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        requiredInputCount: requiredInputs.length,
        validationStepCount: validationSteps.length,
        outputRecordFieldCount: outputRecordShape.length,
        blockerCount: blockers.length,
        implementationGateCount: implementationGates.length,
      },
      requiredInputs,
      validationSteps,
      outputRecordShape,
      implementationGates,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create second-approval creation implementation plan before enabling any approval creation.',
      safety,
    },
  };
}
