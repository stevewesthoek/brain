import type {
  BrainCoreVideoControlledExecutionSandboxProvisioningImplementationPlan,
  BrainCoreVideoControlledExecutionSandboxProvisioningImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionRollbackCleanupImplementationPlan } from './video-orchestrator-controlled-execution-rollback-cleanup-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionSandboxProvisioningImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  sandboxProvisioningEnabled: false,
  sandboxCreationEnabled: false,
  sandboxExecutionEnabled: false,
  filesystemAccessEnabled: false,
  networkAccessEnabled: false,
  credentialAccessEnabled: false,
  implementationExecutionEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
  persistenceEnabled: false,
  validatorExecutionEnabled: false,
  lockPersistenceEnabled: false,
  auditPersistenceEnabled: false,
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

export function readVideoControlledExecutionSandboxProvisioningImplementationPlan(): BrainCoreVideoControlledExecutionSandboxProvisioningImplementationPlanResponse {
  const rollbackCleanup = readVideoControlledExecutionRollbackCleanupImplementationPlan().plan;

  const sandboxRequirements = [
    'runtime-local only',
    'no source repo writes',
    'no Mind writes',
    'no STB writes',
    'no platform API writes',
    'no credential access',
    'no network access by default',
    'no generated artifact writes until artifact policy exists',
    'audit metadata only, no raw logs',
  ];

  const boundaryRules = [
    'sandbox cannot be provisioned until second approval exists',
    'sandbox cannot authorize execution',
    'sandbox cannot create approvals',
    'sandbox cannot persist audit trails',
    'sandbox cannot write files',
    'sandbox cannot access credentials',
    'sandbox cannot call platform APIs',
    'sandbox cannot decommission STB',
  ];

  const blockingRequirements = [
    'no approved sandbox policy',
    'no approved safe runtime path policy',
    'no approved filesystem isolation policy',
    'no approved network isolation policy',
    'no approved credential isolation policy',
    'no approved cleanup lifecycle',
    'no explicit approval to provision sandbox',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
    '/video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan',
    '/video-orchestrator/controlled-execution-execution-plan-implementation-plan',
    '/video-orchestrator/controlled-execution-second-approval-creation-implementation-plan',
    '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design',
  ];

  const blockers = [
    ...rollbackCleanup.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-sandbox-provisioning-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6i',
      status: 'not-ready',
      planExists: false,
      sandboxProvisioningEnabled: false,
      sandboxCreationEnabled: false,
      filesystemAccessEnabled: false,
      networkAccessEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        sandboxRequirementCount: sandboxRequirements.length,
        boundaryRuleCount: boundaryRules.length,
        blockerCount: blockers.length,
        implementationGateCount: evidenceReferences.length,
      },
      sandboxRequirements,
      boundaryRules,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create sandbox execution implementation plan before enabling sandbox provisioning.',
      safety,
    },
  };
}
