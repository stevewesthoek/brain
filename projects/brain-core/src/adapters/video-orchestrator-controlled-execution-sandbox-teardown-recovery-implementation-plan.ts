import type {
  BrainCoreVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan,
  BrainCoreVideoControlledExecutionSandboxTeardownRecoveryImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionSandboxExecutionImplementationPlan } from './video-orchestrator-controlled-execution-sandbox-execution-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  sandboxTeardownEnabled: false,
  recoveryExecutionEnabled: false,
  cleanupExecutionEnabled: false,
  artifactDeletionEnabled: false,
  implementationExecutionEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
  persistenceEnabled: false,
  validatorExecutionEnabled: false,
  lockPersistenceEnabled: false,
  auditPersistenceEnabled: false,
  sandboxProvisioningEnabled: false,
  sandboxExecutionEnabled: false,
  filesystemAccessEnabled: false,
  networkAccessEnabled: false,
  credentialAccessEnabled: false,
  registersAction: false,
  registersAllowlist: false,
  createsExecutionPlan: false,
  executionPlanExecutable: false,
  executionEnabled: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  deletesFiles: false,
  rendersVideo: false,
  exportsArtifacts: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

export function readVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan(): BrainCoreVideoControlledExecutionSandboxTeardownRecoveryImplementationPlanResponse {
  const sandboxExecution = readVideoControlledExecutionSandboxExecutionImplementationPlan().plan;

  const teardownRequirements = [
    'teardown is runtime-local only',
    'teardown cannot touch source repo paths',
    'teardown cannot touch Mind paths',
    'teardown cannot touch STB paths',
    'teardown cannot delete source assets',
    'teardown cannot publish or unpublish',
    'teardown must produce report-only summary first',
    'teardown must preserve audit references',
  ];

  const recoverySteps = [
    'detect incomplete sandbox execution',
    'identify runtime-local temporary state',
    'verify safe teardown boundary',
    'verify no source repo paths included',
    'verify no Mind paths included',
    'verify no STB paths included',
    'prepare recovery report only',
    'block actual teardown and recovery execution',
  ];

  const blockingRequirements = [
    'no approved sandbox teardown policy',
    'no approved runtime-local path policy',
    'no approved recovery UX',
    'no approved audit persistence',
    'no approved cleanup lifecycle',
    'no explicit approval to execute teardown or recovery',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-sandbox-execution-implementation-plan',
    '/video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan',
    '/video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan',
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
    '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design',
  ];

  const blockers = [
    ...sandboxExecution.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-sandbox-teardown-recovery-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6k',
      status: 'not-ready',
      planExists: false,
      sandboxTeardownEnabled: false,
      recoveryExecutionEnabled: false,
      cleanupExecutionEnabled: false,
      artifactDeletionEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        teardownRequirementCount: teardownRequirements.length,
        recoveryStepCount: recoverySteps.length,
        blockerCount: blockers.length,
        implementationGateCount: evidenceReferences.length,
      },
      teardownRequirements,
      recoverySteps,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create artifact policy implementation plan before enabling sandbox teardown or recovery.',
      safety,
    },
  };
}
