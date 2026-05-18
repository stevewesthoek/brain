import type {
  BrainCoreVideoControlledExecutionSTBProtectionDecommissionPreventionPlan,
  BrainCoreVideoControlledExecutionSTBProtectionDecommissionPreventionPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionArtifactPolicyImplementationPlan } from './video-orchestrator-controlled-execution-artifact-policy-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionSTBProtectionDecommissionPreventionPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  stbProtectionEnabled: false,
  decommissionPreventionEnabled: false,
  stbMutationEnabled: false,
  decommissionEnabled: false,
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

export function readVideoControlledExecutionSTBProtectionDecommissionPreventionPlan(): BrainCoreVideoControlledExecutionSTBProtectionDecommissionPreventionPlanResponse {
  const artifactPolicy = readVideoControlledExecutionArtifactPolicyImplementationPlan().plan;

  const protectionRequirements = [
    'STB remains operational source of truth until explicit cutover approval',
    'controlled execution cannot mutate STB state',
    'controlled execution cannot delete STB artifacts',
    'controlled execution cannot disable STB schedules',
    'controlled execution cannot alter STB publishing',
    'controlled execution cannot mark STB deprecated',
    'controlled execution must preserve rollback to STB',
    'controlled execution must preserve dual-run evidence',
  ];

  const decommissionGuards = [
    'no decommission without Brain Core parity',
    'no decommission without Brain Console parity',
    'no decommission without dual-run validation',
    'no decommission without user approval',
    'no decommission without archive plan',
    'no decommission without rollback plan',
    'no decommission without post-cutover monitoring',
    'no decommission from controlled execution path',
  ];

  const blockingRequirements = [
    'no approved STB protection policy implementation',
    'no approved decommission prevention guard implementation',
    'no approved cutover policy',
    'no approved dual-run parity acceptance',
    'no approved archive plan',
    'no approved rollback-to-STB plan',
    'no explicit decommission approval',
  ];

  const evidenceReferences = [
    '/stb/status',
    '/stb-video-migration/status',
    '/stb-video/dual-run-evidence',
    '/video-orchestrator/production-cutover-gate',
    '/video-orchestrator/controlled-execution-artifact-policy-implementation-plan',
    '/video-orchestrator/controlled-execution-disabled-gate',
  ];

  const blockers = [
    ...artifactPolicy.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-stb-protection-decommission-prevention-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6m',
      status: 'not-ready',
      planExists: false,
      stbProtectionEnabled: false,
      decommissionPreventionEnabled: false,
      stbMutationEnabled: false,
      decommissionEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        protectionRequirementCount: protectionRequirements.length,
        decommissionGuardCount: decommissionGuards.length,
        blockerCount: blockers.length,
        implementationGateCount: evidenceReferences.length,
      },
      protectionRequirements,
      decommissionGuards,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create implementation completion readiness checkpoint before enabling any controlled execution implementation.',
      safety,
    },
  };
}
