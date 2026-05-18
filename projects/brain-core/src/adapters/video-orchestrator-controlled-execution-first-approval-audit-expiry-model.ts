import type {
  BrainCoreVideoControlledExecutionFirstApprovalAuditExpiryModel,
  BrainCoreVideoControlledExecutionFirstApprovalAuditExpiryModelResponse,
} from '../types/api.js';
import { readVideoControlledExecutionFirstApprovalAuthorityPolicy } from './video-orchestrator-controlled-execution-first-approval-authority-policy.js';

const safety: BrainCoreVideoControlledExecutionFirstApprovalAuditExpiryModel['safety'] = {
  readOnly: true,
  modelDesignOnly: true,
  auditPersistenceEnabled: false,
  expiryEnforcementEnabled: false,
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

export function readVideoControlledExecutionFirstApprovalAuditExpiryModel(): BrainCoreVideoControlledExecutionFirstApprovalAuditExpiryModelResponse {
  const authorityPolicy = readVideoControlledExecutionFirstApprovalAuthorityPolicy().policy;

  const auditFields = [
    'firstApprovalId placeholder',
    'candidateStoryId',
    'sourceEpisodeId',
    'operatorId placeholder',
    'operatorRole placeholder',
    'authorityPolicyVersion',
    'approvalScopeHash placeholder',
    'createdAt placeholder',
    'expiresAt placeholder',
    'revokedAt placeholder',
    'decisionTrace references',
  ];

  const expiryRules = [
    'First approval must expire before any execution window can open',
    'Expiry must be bounded and shorter than second-approval validity',
    'Expired first approvals must not be renewable automatically',
    'Expiry cannot authorize execution, rendering, publishing, or writes',
    'Any candidate/story change invalidates the first approval',
    'Any policy version change invalidates the first approval',
  ];

  const invalidationRules = [
    'Candidate story changed',
    'Operator identity changed',
    'Operator role changed',
    'Preflight evidence changed',
    'Second-approval policy changed',
    'Role policy changed',
    'STB protection status changed',
    'Approval expired or was revoked',
  ];

  const missingRequirements = [
    'No durable first-approval audit store',
    'No first-approval ID generator',
    'No expiry clock or enforcement path',
    'No revocation model',
    'No candidate/story lock hash',
    'No policy version hash',
    'No operator attribution enforcement',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-first-approval-authority-policy',
    '/video-orchestrator/controlled-execution-role-policy',
    '/video-orchestrator/controlled-execution-operator-identity-protocol',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-disabled-gate',
  ];

  const blockers = [
    ...authorityPolicy.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    model: {
      id: 'video-orchestrator-controlled-execution-first-approval-audit-expiry-model',
      generatedAt: new Date().toISOString(),
      version: 'phase-5k',
      status: 'blocked',
      modelExists: false,
      auditPersistenceEnabled: false,
      expiryEnforcementEnabled: false,
      firstApprovalCreationEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        auditFieldCount: auditFields.length,
        expiryRuleCount: expiryRules.length,
        invalidationRuleCount: invalidationRules.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      auditFields,
      expiryRules,
      invalidationRules,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep first-approval audit/expiry model read-only; do not persist approvals or enable expiry enforcement.',
      safety,
    },
  };
}
