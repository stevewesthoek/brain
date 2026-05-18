import type {
  BrainCoreVideoControlledExecutionFeatureFlagRolloutPlan,
  BrainCoreVideoControlledExecutionFeatureFlagRolloutPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionImplementationReadinessCheckpoint } from './video-orchestrator-controlled-execution-implementation-readiness-checkpoint.js';

const safety: BrainCoreVideoControlledExecutionFeatureFlagRolloutPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  featureFlagFrameworkEnabled: false,
  flagEvaluationEnabled: false,
  rolloutExecutionEnabled: false,
  implementationExecutionEnabled: false,
  featureFlagsEnabled: false,
  persistenceEnabled: false,
  approvalCreationEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
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

export function readVideoControlledExecutionFeatureFlagRolloutPlan(): BrainCoreVideoControlledExecutionFeatureFlagRolloutPlanResponse {
  const checkpoint = readVideoControlledExecutionImplementationReadinessCheckpoint().checkpoint;

  const proposedFlags = [
    'controlledExecution.enabled',
    'controlledExecution.approvalCreation.enabled',
    'controlledExecution.firstApproval.enabled',
    'controlledExecution.secondApproval.enabled',
    'controlledExecution.validatorExecution.enabled',
    'controlledExecution.candidateLockPersistence.enabled',
    'controlledExecution.auditPersistence.enabled',
    'controlledExecution.sandboxProvisioning.enabled',
    'controlledExecution.runner.enabled',
    'controlledExecution.consoleControls.enabled',
  ];

  const rolloutPhases = [
    'design freeze',
    'feature flag config schema review',
    'read-only console visibility',
    'approval creation dry-run only',
    'validator implementation dry-run only',
    'candidate lock persistence dry-run only',
    'audit persistence dry-run only',
    'sandbox provisioning dry-run only',
    'runner dry-run only',
    'execution still blocked until explicit approval',
  ];

  const gatingRules = [
    'every flag defaults false',
    'no flag enables execution alone',
    'runner requires all previous flags plus explicit second approval',
    'publishing and decommission remain separately blocked',
    'flags must be local-only and auditable',
    'rollback path required before any flag can be enabled',
  ];

  const blockingRequirements = [
    'no approved feature flag framework',
    'no approved persistence policy',
    'no approved validator implementation',
    'no approved sandbox policy',
    'no approved rollback policy',
    'no explicit execution approval',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-implementation-readiness-checkpoint',
    '/video-orchestrator/controlled-execution-disabled-gate',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
    '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design',
  ];

  const blockers = [
    ...checkpoint.blockingRequirements,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-feature-flag-rollout-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6b',
      status: 'not-ready',
      planExists: false,
      featureFlagFrameworkEnabled: false,
      flagEvaluationEnabled: false,
      rolloutExecutionEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        rolloutPhaseCount: rolloutPhases.length,
        featureFlagCount: proposedFlags.length,
        blockerCount: blockers.length,
        requiredApprovalCount: blockingRequirements.length,
      },
      proposedFlags,
      rolloutPhases,
      gatingRules,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create approval store implementation plan before enabling any feature flag framework.',
      safety,
    },
  };
}
