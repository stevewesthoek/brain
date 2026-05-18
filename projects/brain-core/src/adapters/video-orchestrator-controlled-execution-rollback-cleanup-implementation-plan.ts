import type {
  BrainCoreVideoControlledExecutionRollbackCleanupImplementationPlan,
  BrainCoreVideoControlledExecutionRollbackCleanupImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionExecutionPlanImplementationPlan } from './video-orchestrator-controlled-execution-execution-plan-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionRollbackCleanupImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  rollbackAcceptanceEnabled: false,
  cleanupExecutionEnabled: false,
  rollbackExecutionEnabled: false,
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

export function readVideoControlledExecutionRollbackCleanupImplementationPlan(): BrainCoreVideoControlledExecutionRollbackCleanupImplementationPlanResponse {
  const executionPlan = readVideoControlledExecutionExecutionPlanImplementationPlan().plan;

  const rollbackRequirements = [
    'operator accepts rollback before any future execution',
    'rollback scope is single-story only',
    'rollback cannot mutate STB',
    'rollback cannot delete source assets',
    'rollback cannot write to Mind',
    'rollback cannot publish or unpublish',
    'rollback must preserve audit trail references',
    'rollback must leave execution disabled unless all gates pass',
  ];

  const cleanupPlanSteps = [
    'identify runtime-local temporary artifacts',
    'identify generated preview artifacts',
    'verify artifact sandbox boundary',
    'verify no source repo paths included',
    'verify no Mind paths included',
    'verify no STB paths included',
    'prepare cleanup report only',
    'block actual cleanup execution',
  ];

  const blockingRequirements = [
    'no approved artifact sandbox policy',
    'no approved safe cleanup path policy',
    'no approved rollback acceptance UX',
    'no approved audit persistence',
    'no approved sandbox lifecycle',
    'no explicit approval to execute cleanup',
  ];

  const evidenceReferences = [
    '/video-orchestrator/rollback-cleanup-checklist',
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
    '/video-orchestrator/controlled-execution-execution-plan-implementation-plan',
    '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design',
    '/video-orchestrator/controlled-execution-implementation-readiness-checkpoint',
  ];

  const blockers = [
    ...executionPlan.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-rollback-cleanup-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6h',
      status: 'not-ready',
      planExists: false,
      rollbackAcceptanceEnabled: false,
      cleanupExecutionEnabled: false,
      rollbackExecutionEnabled: false,
      artifactDeletionEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        rollbackRequirementCount: rollbackRequirements.length,
        cleanupStepCount: cleanupPlanSteps.length,
        blockerCount: blockers.length,
        implementationGateCount: evidenceReferences.length,
      },
      rollbackRequirements,
      cleanupPlanSteps,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create sandbox provisioning implementation plan before enabling rollback or cleanup execution.',
      safety,
    },
  };
}
