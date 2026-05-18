import type {
  BrainCoreVideoControlledExecutionSecondApprovalPolicy,
  BrainCoreVideoControlledExecutionSecondApprovalPolicyResponse,
} from '../types/api.js';

const safety: BrainCoreVideoControlledExecutionSecondApprovalPolicy['safety'] = {
  readOnly: true,
  policyDesignOnly: true,
  policyExists: false,
  policyAccepted: false,
  createsApproval: false,
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

export function readVideoControlledExecutionSecondApprovalPolicy(): BrainCoreVideoControlledExecutionSecondApprovalPolicyResponse {
  const policySections = [
    'Operator identity verification and role confirmation',
    'Explicit second approval scope: limited to specific video/story',
    'Candidate/story lock: no new changes after approval request',
    'Preflight validation evidence: all checks passing',
    'Runtime-local sandbox evidence: isolated execution environment',
    'Rollback/cleanup acceptance: documented recovery procedure',
    'Dual-run comparison acceptance: STB vs. Video equivalence verified',
    'Artifact/output policy acceptance: rendering/export constraints',
    'STB protection confirmation: no interference with STB pipeline',
    'Expiration and audit requirements: time-bound approval with audit trail',
  ];

  const requiredEvidence = [
    'Approval request design finalized',
    'Preflight validator schema approved',
    'Execution plan stub reviewed',
    'Policy boundary confirmed',
    'Risk register documented',
    'Operator decision queue ready',
    'Preflight checklist defined',
  ];

  const missingEvidence = [
    'Second approval policy definition',
    'Operator identity verification protocol',
    'Approval scope narrowing mechanism',
    'Story/candidate lock implementation',
    'Runtime sandbox design',
    'Rollback procedure documentation',
    'Dual-run comparison protocol',
    'Artifact output policy definition',
    'STB protection verification',
    'Audit trail design',
  ];

  const blockers = [
    'No second approval policy exists',
    'No operator identity verification protocol',
    'No approval scope narrowing implemented',
    'No candidate/story lock mechanism',
    'No runtime sandbox isolated from STB',
    'No rollback/cleanup acceptance protocol',
    'No dual-run comparison acceptance',
    'No artifact/output policy acceptance',
    'No STB protection confirmation',
    'No expiration and audit requirements',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-disabled-gate',
    '/video-orchestrator/controlled-execution-approval-request-design',
    '/video-orchestrator/controlled-execution-plan-stub',
    '/video-orchestrator/controlled-execution-preflight-validator-schema',
    '/video-orchestrator/controlled-execution-approval-payload-schema',
    '/video-orchestrator/controlled-execution-policy-boundary',
    '/video-orchestrator/controlled-execution-risk-register',
  ];

  return {
    policy: {
      id: 'video-orchestrator-controlled-execution-second-approval-policy',
      generatedAt: new Date().toISOString(),
      version: 'phase-5g',
      status: 'blocked',
      policyExists: false,
      policyAccepted: false,
      secondApprovalCreationEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        policyCount: 1,
        policySectionCount: policySections.length,
        requiredEvidenceCount: requiredEvidence.length,
        missingEvidenceCount: missingEvidence.length,
        blockerCount: blockers.length,
      },
      policySections,
      requiredEvidence,
      missingEvidence,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep second-approval policy design read-only; do not create approvals or execution paths.',
      safety,
    },
  };
}
