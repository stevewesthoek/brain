import type {
  BrainCoreVideoControlledExecutionSandboxExecutionImplementationPlan,
  BrainCoreVideoControlledExecutionSandboxExecutionImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionSandboxProvisioningImplementationPlan } from './video-orchestrator-controlled-execution-sandbox-provisioning-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionSandboxExecutionImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  sandboxExecutionEnabled: false,
  runnerExecutionEnabled: false,
  dryRunExecutionEnabled: false,
  sandboxProvisioningEnabled: false,
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

export function readVideoControlledExecutionSandboxExecutionImplementationPlan(): BrainCoreVideoControlledExecutionSandboxExecutionImplementationPlanResponse {
  const sandboxProvisioning = readVideoControlledExecutionSandboxProvisioningImplementationPlan().plan;

  const executionPreconditions = [
    'feature flag framework approved',
    'approval store approved',
    'first approval valid',
    'second approval valid',
    'candidate/story lock valid',
    'preflight validator approved',
    'execution plan approved',
    'rollback acceptance approved',
    'sandbox provisioning approved',
    'audit compliance packet approved',
  ];

  const runnerBoundaryRules = [
    'runner cannot execute shell text',
    'runner cannot accept arbitrary paths',
    'runner cannot write to source repo',
    'runner cannot write to Mind',
    'runner cannot mutate STB',
    'runner cannot publish',
    'runner cannot access credentials',
    'runner cannot use network by default',
    'runner must produce report-only result until explicit execution approval',
  ];

  const blockingRequirements = [
    'no approved sandbox provisioning implementation',
    'no approved runner allowlist wrapper',
    'no approved validator implementation',
    'no approved execution plan activation',
    'no approved rollback policy',
    'no approved audit persistence',
    'no explicit approval to execute in sandbox',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan',
    '/video-orchestrator/controlled-execution-execution-plan-implementation-plan',
    '/video-orchestrator/controlled-execution-validator-implementation-plan',
    '/video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan',
    '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design',
  ];

  const blockers = [
    ...sandboxProvisioning.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-sandbox-execution-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6j',
      status: 'not-ready',
      planExists: false,
      sandboxExecutionEnabled: false,
      runnerExecutionEnabled: false,
      dryRunExecutionEnabled: false,
      filesystemAccessEnabled: false,
      networkAccessEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        executionPreconditionCount: executionPreconditions.length,
        runnerBoundaryRuleCount: runnerBoundaryRules.length,
        blockerCount: blockers.length,
        implementationGateCount: evidenceReferences.length,
      },
      executionPreconditions,
      runnerBoundaryRules,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create sandbox teardown and recovery implementation plan before enabling sandbox execution.',
      safety,
    },
  };
}
