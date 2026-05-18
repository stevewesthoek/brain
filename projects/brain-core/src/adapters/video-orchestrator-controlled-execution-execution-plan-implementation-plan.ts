import type {
  BrainCoreVideoControlledExecutionExecutionPlanImplementationPlan,
  BrainCoreVideoControlledExecutionExecutionPlanImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionValidatorImplementationPlan } from './video-orchestrator-controlled-execution-validator-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionExecutionPlanImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  executionPlanEnabled: false,
  planExecutionEnabled: false,
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

export function readVideoControlledExecutionExecutionPlanImplementationPlan(): BrainCoreVideoControlledExecutionExecutionPlanImplementationPlanResponse {
  const validator = readVideoControlledExecutionValidatorImplementationPlan().plan;

  const requiredInputs = [
    'candidateStoryId',
    'sourceEpisodeId',
    'firstApprovalId',
    'secondApprovalId',
    'validationReportRef',
    'preflightEvidenceHashRef',
    'candidateStoryLockRef',
    'runtimeSandboxBoundaryRef',
    'approvalAuditTrailRef',
  ];

  const executionPlanSteps = [
    'load validated story fixtures',
    'load planning fixtures',
    'verify approval audit trail immutable',
    'verify sandbox boundary restrictions',
    'load approved execution policy',
    'verify approval expiry window open',
    'capture pre-execution state snapshot',
    'prepare execution environment',
    'mark candidate as execution-pending',
    'stage execution without running',
  ];

  const outputRecordShape = [
    'executionPlanId',
    'candidateStoryId',
    'sourceEpisodeId',
    'planStatus: execution_planned_not_running',
    'firstApprovalId',
    'secondApprovalId',
    'validationReportRef',
    'preflightEvidenceHashRef',
    'sandboxBoundaryRef',
    'auditTrailRef',
    'preExecutionStateSnapshot',
    'createdAt',
    'expiresAt',
    'readOnly',
  ];

  const implementationGates = [
    'validator implementation plan',
    'approval store implementation',
    'first approval creation implementation',
    'second approval creation implementation',
    'immutable audit trail persistence',
    'runtime sandbox boundary implementation',
    'state snapshot framework',
    'approval expiry enforcement',
  ];

  const blockingRequirements = [
    'no approved execution plan definition',
    'no approved pre-execution snapshot framework',
    'no approved sandbox boundary enforcement',
    'no approved audit trail immutability',
    'no approved expiry enforcement',
    'no approved state capture mechanism',
    'no approved execution policy',
    'no approved lockdown mechanism to prevent unauthorized execution',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-validator-implementation-plan',
    '/video-orchestrator/controlled-execution-first-approval-creation-implementation-plan',
    '/video-orchestrator/controlled-execution-second-approval-creation-implementation-plan',
    '/video-orchestrator/controlled-execution-immutable-audit-trail-schema',
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
    '/video-orchestrator/controlled-execution-approval-store-implementation-plan',
  ];

  const blockers = [
    ...validator.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-execution-plan-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6g',
      status: 'not-ready',
      planExists: false,
      executionPlanEnabled: false,
      planExecutionEnabled: false,
      persistenceEnabled: false,
      approvalCreationEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        requiredInputCount: requiredInputs.length,
        executionPlanStepCount: executionPlanSteps.length,
        outputRecordFieldCount: outputRecordShape.length,
        blockerCount: blockers.length,
        implementationGateCount: implementationGates.length,
      },
      requiredInputs,
      executionPlanSteps,
      outputRecordShape,
      implementationGates,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create rollback acceptance and cleanup plan before enabling any execution capability.',
      safety,
    },
  };
}
