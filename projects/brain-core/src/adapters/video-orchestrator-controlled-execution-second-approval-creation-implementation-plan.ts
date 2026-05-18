import type {
  BrainCoreVideoControlledExecutionSecondApprovalCreationImplementationPlan,
  BrainCoreVideoControlledExecutionSecondApprovalCreationImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionFirstApprovalCreationImplementationPlan } from './video-orchestrator-controlled-execution-first-approval-creation-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionSecondApprovalCreationImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  secondApprovalCreationEnabled: false,
  firstApprovalCreationEnabled: false,
  approvalCreationEnabled: false,
  approvalStoreEnabled: false,
  persistenceEnabled: false,
  operatorVerificationEnabled: false,
  roleEnforcementEnabled: false,
  firstApprovalVerificationEnabled: false,
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

export function readVideoControlledExecutionSecondApprovalCreationImplementationPlan(): BrainCoreVideoControlledExecutionSecondApprovalCreationImplementationPlanResponse {
  const firstApprovalCreation = readVideoControlledExecutionFirstApprovalCreationImplementationPlan().plan;

  const requiredInputs = [
    'firstApprovalId',
    'candidateStoryId',
    'sourceEpisodeId',
    'secondOperatorIdentity',
    'secondOperatorRole',
    'candidateStoryLockRef',
    'preflightEvidenceHashRef',
    'operatorDecisionSnapshotRef',
    'approvalStorePolicyRef',
    'auditTrailSchemaRef',
    'runtimeSandboxBoundaryRef',
    'rationale',
  ];

  const validationSteps = [
    'verify feature flag framework approved',
    'verify approval store plan approved',
    'verify first approval exists and is valid',
    'verify first approval is not expired, revoked, or invalidated',
    'verify second operator differs from first operator',
    'verify second operator identity protocol approved',
    'verify second operator role policy approved',
    'verify candidate/story lock still matches first approval',
    'verify preflight evidence hash still matches first approval',
    'verify approval scope is single-story only',
    'verify second approval does not authorize execution',
    'verify execution remains disabled until runner plan is approved',
    'verify immutable audit trail policy exists',
    'verify no concurrent second approvals exist',
  ];

  const outputRecordShape = [
    'approvalId',
    'approvalType: second_approval',
    'status: second_approval_pending',
    'firstApprovalId',
    'candidateStoryId',
    'sourceEpisodeId',
    'firstOperatorIdPlaceholder',
    'secondOperatorIdPlaceholder',
    'secondOperatorRolePlaceholder',
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
    'first approval creation implementation plan',
    'operator identity implementation plan',
    'role policy enforcement implementation plan',
    'candidate/story lock persistence plan',
    'immutable audit trail persistence plan',
    'runtime sandbox boundary plan',
  ];

  const blockingRequirements = [
    'no approved feature flag framework',
    'no approved approval store implementation',
    'no approved first approval creation implementation',
    'no approved operator verification implementation',
    'no approved role enforcement implementation',
    'no approved candidate/story lock persistence',
    'no approved audit persistence',
    'no approved two-person approval policy enforcement',
    'no approved concurrency check',
    'no explicit approval to create second approvals',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-first-approval-creation-implementation-plan',
    '/video-orchestrator/controlled-execution-approval-store-implementation-plan',
    '/video-orchestrator/controlled-execution-feature-flag-rollout-plan',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-disabled-gate',
    '/video-orchestrator/controlled-execution-candidate-story-lock-design',
    '/video-orchestrator/controlled-execution-preflight-evidence-hash-design',
    '/video-orchestrator/controlled-execution-operator-decision-snapshot-design',
    '/video-orchestrator/controlled-execution-immutable-audit-trail-schema',
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
  ];

  const blockers = [
    ...firstApprovalCreation.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-second-approval-creation-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6e',
      status: 'not-ready',
      planExists: false,
      secondApprovalCreationEnabled: false,
      firstApprovalCreationEnabled: false,
      approvalCreationEnabled: false,
      approvalStoreEnabled: false,
      persistenceEnabled: false,
      operatorVerificationEnabled: false,
      roleEnforcementEnabled: false,
      firstApprovalRequired: true,
      firstApprovalVerificationEnabled: false,
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
      nextSafeStep: 'Create validator implementation plan before enabling any approval creation or execution path.',
      safety,
    },
  };
}
