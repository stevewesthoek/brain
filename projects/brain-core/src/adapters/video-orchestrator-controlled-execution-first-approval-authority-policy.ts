import type {
  BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicy,
  BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicyResponse,
} from '../types/api.js';
import { readVideoControlledExecutionRolePolicy } from './video-orchestrator-controlled-execution-role-policy.js';
import { readVideoControlledExecutionOperatorIdentityProtocol } from './video-orchestrator-controlled-execution-operator-identity-protocol.js';
import { readVideoControlledExecutionSecondApprovalPolicy } from './video-orchestrator-controlled-execution-second-approval-policy.js';

const safety: BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicy['safety'] = {
  readOnly: true,
  policyDesignOnly: true,
  policyExists: false,
  policyAccepted: false,
  authorityVerificationEnabled: false,
  authenticatesOperator: false,
  createsSession: false,
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

export function readVideoControlledExecutionFirstApprovalAuthorityPolicy(): BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicyResponse {
  const rolePolicy = readVideoControlledExecutionRolePolicy().policy;
  const operatorIdentity = readVideoControlledExecutionOperatorIdentityProtocol().protocol;
  const secondApprovalPolicy = readVideoControlledExecutionSecondApprovalPolicy().policy;

  const authorityRequirements = [
    'Operator identity protocol must exist and authenticate a local operator',
    'Role policy must exist and assign an allowed first-approval role',
    'First approval scope must be limited to one candidate story',
    'First approval must not authorize execution or publishing',
    'First approval must require a later second approval before execution',
    'First approval must include audit attribution and expiry metadata',
    'First approval must preserve STB protection and no-decommission guarantees',
  ];

  const eligibleRoles: BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicy['eligibleRoles'] = [
    {
      role: 'viewer',
      canIssueFirstApproval: false,
      reason: 'Viewer is read-only and cannot request or issue approvals.',
    },
    {
      role: 'developer',
      canIssueFirstApproval: false,
      reason: 'Developer can inspect design endpoints only; approval authority is not enabled.',
    },
    {
      role: 'maintainer',
      canIssueFirstApproval: false,
      reason: 'Maintainer is a future first-approval candidate, but the policy is not accepted.',
    },
    {
      role: 'admin',
      canIssueFirstApproval: false,
      reason: 'Admin is a future approval candidate, but first approval remains disabled.',
    },
  ];

  const approvalScope: BrainCoreVideoControlledExecutionFirstApprovalAuthorityPolicy['approvalScope'] = {
    scopeType: 'single-story-only' as const,
    permitsExecution: false,
    permitsPublishing: false,
    permitsStbMutation: false,
    permitsMindWrites: false,
    requiresSecondApprovalBeforeExecution: true,
  };

  const missingRequirements = [
    'No first-approval authority policy exists',
    'No accepted role policy exists',
    'No operator identity verification exists',
    'No first-approval audit model exists',
    'No expiry policy exists for first approvals',
    'No enforcement path exists for first-approval authority',
    'No approved candidate story lock exists',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-role-policy',
    '/video-orchestrator/controlled-execution-operator-identity-protocol',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-disabled-gate',
    '/video-orchestrator/controlled-execution-approval-request-design',
    '/video-orchestrator/controlled-execution-policy-boundary',
  ];

  const blockers = [
    ...rolePolicy.blockers,
    ...operatorIdentity.blockers,
    ...secondApprovalPolicy.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    policy: {
      id: 'video-orchestrator-controlled-execution-first-approval-authority-policy',
      generatedAt: new Date().toISOString(),
      version: 'phase-5j',
      status: 'blocked',
      policyExists: false,
      policyAccepted: false,
      firstApprovalAuthorityEnabled: false,
      firstApprovalCreationEnabled: false,
      secondApprovalRequired: true,
      secondApprovalAllowed: false,
      executionEnabled: false,
      executable: false,
      summary: {
        authorityRequirementCount: authorityRequirements.length,
        eligibleRoleCount: eligibleRoles.length,
        rolesAllowedToIssueFirstApproval: eligibleRoles.filter(role => role.canIssueFirstApproval).length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      authorityRequirements,
      eligibleRoles,
      approvalScope,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep first-approval authority policy read-only; do not create approvals or execution paths.',
      safety,
    },
  };
}
