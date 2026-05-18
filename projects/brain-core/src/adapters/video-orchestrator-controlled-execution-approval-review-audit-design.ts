import type {
  BrainCoreVideoControlledExecutionApprovalReviewAudit,
  BrainCoreVideoControlledExecutionApprovalReviewAuditResponse,
} from '../types/api.js';
import { readVideoControlledExecutionRuntimeSandboxBoundaryDesign } from './video-orchestrator-controlled-execution-runtime-sandbox-boundary-design.js';

const safety: BrainCoreVideoControlledExecutionApprovalReviewAudit['safety'] = {
  readOnly: true,
  reviewDesignOnly: true,
  auditCaptureEnabled: false,
  approvalReviewEnabled: false,
  approvalCreationEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
  persistsAuditEvent: false,
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

export function readVideoControlledExecutionApprovalReviewAudit(): BrainCoreVideoControlledExecutionApprovalReviewAuditResponse {
  const sandboxBoundary = readVideoControlledExecutionRuntimeSandboxBoundaryDesign().boundary;

  const reviewFields = [
    'reviewId',
    'candidateStoryId',
    'sourceEpisodeId',
    'reviewerOperatorIdPlaceholder',
    'reviewerRolePlaceholder',
    'approvalStage',
    'reviewedEvidenceRefs',
    'decision',
    'rationale',
    'createdAt',
    'expiresAt',
    'invalidatedAt',
  ];

  const reviewRules = [
    'Review is design-only',
    'No approval is created from review',
    'No approval is executed',
    'No audit event is persisted',
    'No execution is authorized by review',
    'Review invalidates on candidate/story/hash/risk/policy changes',
    'Review cannot enable execution, publishing, STB mutation, or Mind writes',
  ];

  const missingRequirements = [
    'No review persistence store',
    'No review ID generator',
    'No review validation logic',
    'No approval creation endpoint',
    'No audit event persistence',
    'No reviewer identity verification',
    'No role-based review authorization',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-operator-decision-snapshot-design',
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
    '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-policy-boundary',
  ];

  const blockers = [
    ...sandboxBoundary.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    review: {
      id: 'video-orchestrator-controlled-execution-approval-review-audit-design',
      generatedAt: new Date().toISOString(),
      version: 'phase-5p',
      status: 'blocked',
      reviewDesignExists: false,
      auditCaptureEnabled: false,
      approvalReviewEnabled: false,
      approvalCreationEnabled: false,
      approvalExecutionEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        reviewFieldCount: reviewFields.length,
        reviewRuleCount: reviewRules.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      reviewFields,
      reviewRules,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep approval review design read-only; do not create approvals or persist audit events.',
      safety,
    },
  };
}
