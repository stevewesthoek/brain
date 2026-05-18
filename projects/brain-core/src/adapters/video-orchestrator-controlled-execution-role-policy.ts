import type {
  BrainCoreVideoControlledExecutionRolePolicy,
  BrainCoreVideoControlledExecutionRolePolicyResponse,
} from '../types/api.js';

const safety: BrainCoreVideoControlledExecutionRolePolicy['safety'] = {
  readOnly: true,
  policyDesignOnly: true,
  policyExists: false,
  policyEnforced: false,
  roleVerificationEnabled: false,
  authenticatesOperator: false,
  createsSession: false,
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

export function readVideoControlledExecutionRolePolicy(): BrainCoreVideoControlledExecutionRolePolicyResponse {
  const roles = [
    {
      name: 'viewer',
      description: 'Read dashboard and design endpoints only, no approvals',
      canView: true,
      canRequestApproval: false,
      canIssueFirstApproval: false,
      canIssueSecondApproval: false,
      canExecute: false,
      canPublish: false,
      canDecommission: false,
    },
    {
      name: 'developer',
      description: 'Can inspect design endpoints only, no approval authority',
      canView: true,
      canRequestApproval: false,
      canIssueFirstApproval: false,
      canIssueSecondApproval: false,
      canExecute: false,
      canPublish: false,
      canDecommission: false,
    },
    {
      name: 'maintainer',
      description: 'Future candidate for first approval only, no execution authority',
      canView: true,
      canRequestApproval: true,
      canIssueFirstApproval: false,
      canIssueSecondApproval: false,
      canExecute: false,
      canPublish: false,
      canDecommission: false,
    },
    {
      name: 'admin',
      description: 'Future candidate for second approval, still no execution without all gates',
      canView: true,
      canRequestApproval: true,
      canIssueFirstApproval: false,
      canIssueSecondApproval: false,
      canExecute: false,
      canPublish: false,
      canDecommission: false,
    },
  ];

  const privilegeRequirements = [
    'canView: read-only dashboard access',
    'canRequestApproval: request approval for a candidate (future)',
    'canIssueFirstApproval: approve a request (future, not enabled)',
    'canIssueSecondApproval: issue second approval (future, not enabled)',
    'canExecute: execute an approved plan (future, not enabled)',
    'canPublish: publish results to platforms (future, not enabled)',
    'canDecommission: decommission STB (future, not enabled)',
  ];

  const missingPolicyRequirements = [
    'No operator identity source to determine role',
    'No role assignment source (where do roles come from?)',
    'No privilege enforcement mechanism',
    'No audit attribution enforcement for role-based actions',
    'No second-approval authority verification',
    'No role-based rate limiting or action quotas',
    'No role-based context isolation',
  ];

  const blockers = [
    'No policy exists yet',
    'No operator identity source',
    'No role assignment mechanism',
    'No privilege enforcement',
    'No operator authentication system',
    'No role verification system',
    'No approval authority verification',
    'Role policy is design-only and disabled',
    'Second approval cannot proceed without verified role policy',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-operator-identity-protocol',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-disabled-gate',
    '/video-orchestrator/controlled-execution-policy-boundary',
    '/video-orchestrator/controlled-execution-risk-register',
  ];

  return {
    policy: {
      id: 'video-orchestrator-controlled-execution-role-policy',
      generatedAt: new Date().toISOString(),
      version: 'phase-5i',
      status: 'blocked',
      policyExists: false,
      policyEnforced: false,
      roleVerificationEnabled: false,
      secondApprovalAllowed: false,
      executionEnabled: false,
      executable: false,
      summary: {
        roleCount: roles.length,
        privilegeRequirementCount: privilegeRequirements.length,
        missingRequirementCount: missingPolicyRequirements.length,
        blockerCount: blockers.length,
      },
      roles,
      privilegeRequirements,
      missingPolicyRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep role policy read-only; do not enforce roles or create approval paths.',
      safety,
    },
  };
}
