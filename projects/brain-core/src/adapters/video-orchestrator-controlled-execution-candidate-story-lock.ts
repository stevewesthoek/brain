import type {
  BrainCoreVideoControlledExecutionCandidateStoryLock,
  BrainCoreVideoControlledExecutionCandidateStoryLockResponse,
} from '../types/api.js';
import { readVideoControlledExecutionFirstApprovalAuditExpiryModel } from './video-orchestrator-controlled-execution-first-approval-audit-expiry-model.js';

const safety: BrainCoreVideoControlledExecutionCandidateStoryLock['safety'] = {
  readOnly: true,
  lockDesignOnly: true,
  lockPersistenceEnabled: false,
  lockEnforcementEnabled: false,
  createsLock: false,
  persistsLock: false,
  enforcesLock: false,
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

export function readVideoControlledExecutionCandidateStoryLock(): BrainCoreVideoControlledExecutionCandidateStoryLockResponse {
  const auditModel = readVideoControlledExecutionFirstApprovalAuditExpiryModel().model;

  const lockFields = [
    'candidateStoryId',
    'sourceEpisodeId',
    'contentHash',
    'planningHash',
    'preflightEvidenceHash',
    'lockedByOperatorId',
    'lockedByOperatorRole',
    'lockedAt',
    'expiresAt',
    'invalidatedAt',
    'invalidationReason',
  ];

  const lockRules = [
    'Candidate story lock must be created before first-approval can be issued',
    'Lock enforces candidate/story immutability during approval window',
    'Lock creation requires valid preflight evidence hash',
    'Lock cannot be released or modified during active approvals',
    'Lock cannot authorize execution, publishing, STB mutation, or Mind writes',
    'Lock expiry is separate from and shorter than approval expiry',
    'Locked candidate prevents any execution until lock is invalidated or expired',
  ];

  const invalidationTriggers = [
    'Candidate story changed (content hash mismatch)',
    'Planning changed (planning hash mismatch)',
    'Preflight evidence changed (evidence hash mismatch)',
    'Operator identity policy changed',
    'Operator role policy changed',
    'Lock expired naturally',
    'Lock manually revoked by authorized operator',
    'Approval revoked or expired',
  ];

  const missingRequirements = [
    'No durable candidate/story lock store',
    'No lock ID generator',
    'No lock creation endpoint',
    'No lock validation endpoint',
    'No lock expiry enforcement path',
    'No content hash calculator',
    'No planning hash calculator',
    'No preflight evidence hash calculator',
    'No lock revocation model',
    'No concurrent lock conflict detection',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model',
    '/video-orchestrator/controlled-execution-first-approval-authority-policy',
    '/video-orchestrator/controlled-execution-role-policy',
    '/video-orchestrator/controlled-execution-operator-identity-protocol',
    '/video-orchestrator/controlled-execution-second-approval-policy',
    '/video-orchestrator/controlled-execution-disabled-gate',
  ];

  const blockers = [
    ...auditModel.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    lock: {
      id: 'video-orchestrator-controlled-execution-candidate-story-lock',
      generatedAt: new Date().toISOString(),
      version: 'phase-5l',
      status: 'blocked',
      lockExists: false,
      lockPersistenceEnabled: false,
      lockEnforcementEnabled: false,
      lockCreationEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        lockFieldCount: lockFields.length,
        lockRuleCount: lockRules.length,
        invalidationTriggerCount: invalidationTriggers.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      lockFields,
      lockRules,
      invalidationTriggers,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep candidate/story lock design read-only; do not create, persist, or enforce locks.',
      safety,
    },
  };
}
