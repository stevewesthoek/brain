import type {
  BrainCoreVideoControlledExecutionValidatorImplementationPlan,
  BrainCoreVideoControlledExecutionValidatorImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionSecondApprovalCreationImplementationPlan } from './video-orchestrator-controlled-execution-second-approval-creation-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionValidatorImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  validatorExecutionEnabled: false,
  dryRunEnabled: false,
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

export function readVideoControlledExecutionValidatorImplementationPlan(): BrainCoreVideoControlledExecutionValidatorImplementationPlanResponse {
  const secondApprovalCreation = readVideoControlledExecutionSecondApprovalCreationImplementationPlan().plan;

  const requiredInputs = [
    'candidateStoryId',
    'sourceEpisodeId',
    'preflightValidatorSchemaRef',
    'storyFixturesRef',
    'planningFixturesRef',
    'lockStatusRef',
    'complianceRulesRef',
  ];

  const validationRules = [
    'verify preflight validator schema approved',
    'verify story fixtures exist',
    'verify planning fixtures exist',
    'verify candidate lock exists',
    'verify compliance rules loaded',
    'verify dry-run produces no real output',
    'verify validation report is read-only',
    'verify no persistence of validation results',
  ];

  const outputRecordShape = [
    'validationReportId',
    'candidateStoryId',
    'validationRuleCount',
    'passedRuleCount',
    'blockedRuleCount',
    'errors[]',
    'warnings[]',
    'readOnly',
    'reportGeneratedAt',
  ];

  const implementationGates = [
    'validator schema definition and approval',
    'dry-run framework design and approval',
    'fixtures loading framework',
    'compliance rules engine',
    'report generation framework',
    'approval store implementation',
    'first approval creation implementation',
    'second approval creation implementation',
  ];

  const blockingRequirements = [
    'no approved validator schema',
    'no approved dry-run framework',
    'no approved fixtures loading',
    'no approved compliance rules',
    'no approved report generation',
    'no approved read-only report storage',
    'no persistence policy',
    'no explicit approval to implement validators',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-preflight-validator-schema',
    '/video-orchestrator/controlled-execution-first-approval-creation-implementation-plan',
    '/video-orchestrator/controlled-execution-second-approval-creation-implementation-plan',
    '/video-orchestrator/controlled-execution-candidate-story-lock-design',
    '/video-orchestrator/controlled-execution-approval-store-implementation-plan',
  ];

  const blockers = [
    ...secondApprovalCreation.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-validator-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6f',
      status: 'not-ready',
      planExists: false,
      validatorExecutionEnabled: false,
      dryRunEnabled: false,
      persistenceEnabled: false,
      approvalCreationEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        requiredInputCount: requiredInputs.length,
        validationRuleCount: validationRules.length,
        outputRecordFieldCount: outputRecordShape.length,
        blockerCount: blockers.length,
        implementationGateCount: implementationGates.length,
      },
      requiredInputs,
      validationRules,
      outputRecordShape,
      implementationGates,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create execution-plan implementation plan before enabling any validator execution or approval creation.',
      safety,
    },
  };
}
