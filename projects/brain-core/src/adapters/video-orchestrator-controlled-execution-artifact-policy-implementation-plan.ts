import type {
  BrainCoreVideoControlledExecutionArtifactPolicyImplementationPlan,
  BrainCoreVideoControlledExecutionArtifactPolicyImplementationPlanResponse,
} from '../types/api.js';
import { readVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan } from './video-orchestrator-controlled-execution-sandbox-teardown-recovery-implementation-plan.js';

const safety: BrainCoreVideoControlledExecutionArtifactPolicyImplementationPlan['safety'] = {
  readOnly: true,
  planDesignOnly: true,
  artifactPolicyEnabled: false,
  artifactGenerationEnabled: false,
  artifactPersistenceEnabled: false,
  artifactExportEnabled: false,
  renderingEnabled: false,
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

export function readVideoControlledExecutionArtifactPolicyImplementationPlan(): BrainCoreVideoControlledExecutionArtifactPolicyImplementationPlanResponse {
  const sandboxTeardown = readVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan().plan;

  const artifactRequirements = [
    'artifact policy must be runtime-local only',
    'no source repo writes',
    'no Mind writes',
    'no STB writes',
    'no platform API writes',
    'no credential access',
    'no publishable artifacts until publishing policy exists',
    'no generated artifact writes until explicit artifact sandbox policy exists',
    'audit metadata only, no raw secret/log dumps',
  ];

  const artifactBoundaryRules = [
    'artifact generation cannot authorize execution',
    'artifact export cannot authorize publishing',
    'artifact persistence cannot write to source repo',
    'artifact persistence cannot write to Mind',
    'artifacts cannot mutate STB',
    'artifacts cannot contain credentials',
    'artifacts cannot be published or uploaded',
    'artifacts cannot decommission STB',
  ];

  const blockingRequirements = [
    'no approved artifact sandbox policy',
    'no approved safe output path policy',
    'no approved artifact retention policy',
    'no approved artifact redaction policy',
    'no approved publishing boundary policy',
    'no explicit approval to generate or persist artifacts',
  ];

  const evidenceReferences = [
    '/video-orchestrator/render-export-policy',
    '/video-orchestrator/artifact-sandbox-design',
    '/video-orchestrator/controlled-execution-sandbox-teardown-recovery-implementation-plan',
    '/video-orchestrator/controlled-execution-sandbox-execution-implementation-plan',
    '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design',
  ];

  const blockers = [
    ...sandboxTeardown.blockers,
    ...blockingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    plan: {
      id: 'video-orchestrator-controlled-execution-artifact-policy-implementation-plan',
      generatedAt: new Date().toISOString(),
      version: 'phase-6l',
      status: 'not-ready',
      planExists: false,
      artifactPolicyEnabled: false,
      artifactGenerationEnabled: false,
      artifactPersistenceEnabled: false,
      artifactExportEnabled: false,
      renderingEnabled: false,
      implementationExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        artifactRequirementCount: artifactRequirements.length,
        artifactBoundaryRuleCount: artifactBoundaryRules.length,
        blockerCount: blockers.length,
        implementationGateCount: evidenceReferences.length,
      },
      artifactRequirements,
      artifactBoundaryRules,
      blockingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Create STB protection and decommission prevention plan before enabling artifact generation or export.',
      safety,
    },
  };
}
