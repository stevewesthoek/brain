import type {
  BrainCoreVideoControlledExecutionRuntimeSandboxBoundary,
  BrainCoreVideoControlledExecutionRuntimeSandboxBoundaryResponse,
} from '../types/api.js';
import { readVideoControlledExecutionPreflightEvidenceHashDesign } from './video-orchestrator-controlled-execution-preflight-evidence-hash-design.js';

const safety: BrainCoreVideoControlledExecutionRuntimeSandboxBoundary['safety'] = {
  readOnly: true,
  sandboxDesignOnly: true,
  sandboxProvisioningEnabled: false,
  sandboxExecutionEnabled: false,
  filesystemAccessEnabled: false,
  networkAccessEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
  registersAction: false,
  registersAllowlist: false,
  runsValidator: false,
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

export function readVideoControlledExecutionRuntimeSandboxBoundaryDesign(): BrainCoreVideoControlledExecutionRuntimeSandboxBoundaryResponse {
  const hashDesign = readVideoControlledExecutionPreflightEvidenceHashDesign().design;

  const sandboxBoundaryRules = [
    'No real sandbox provisioned or executed',
    'No filesystem writes or access beyond read-only schema references',
    'No network calls or remote execution',
    'No STB execution or Video execution',
    'No rendering, export, or artifact generation',
    'No publishing or external system mutations',
    'No Mind writes or remote persistence',
    'Sandbox execution remains blocked until explicit second approval and policy acceptance',
  ];

  const requiredBeforeSandbox = [
    'Accepted second approval policy',
    'Accepted role policy and identity verification',
    'Operator identity protocol implementation',
    'Candidate/story lock enforcement',
    'Preflight evidence hash validation',
    'Rollback cleanup policy and implementation',
    'Execution plan safety verification',
  ];

  const missingRequirements = [
    'No sandbox provisioning engine',
    'No sandbox execution runtime',
    'No filesystem isolation implementation',
    'No network isolation implementation',
    'No process isolation implementation',
    'No sandbox cleanup/rollback mechanism',
    'No concurrent sandbox conflict detection',
    'No sandbox audit logging',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-disabled-gate',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-candidate-story-lock-design',
    '/video-orchestrator/controlled-execution-preflight-evidence-hash-design',
    '/video-orchestrator/rollback-cleanup-checklist',
  ];

  const blockers = [
    ...hashDesign.blockers,
    ...missingRequirements,
    ...requiredBeforeSandbox,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    boundary: {
      id: 'video-orchestrator-controlled-execution-runtime-sandbox-boundary-design',
      generatedAt: new Date().toISOString(),
      version: 'phase-5o',
      status: 'blocked',
      sandboxDesignExists: false,
      sandboxProvisioningEnabled: false,
      sandboxExecutionEnabled: false,
      filesystemAccessEnabled: false,
      networkAccessEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        boundaryRuleCount: sandboxBoundaryRules.length,
        requiredPolicyCount: requiredBeforeSandbox.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      sandboxBoundaryRules,
      requiredBeforeSandbox,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep runtime sandbox design read-only; do not provision, execute, or access filesystem/network.',
      safety,
    },
  };
}
