import type {
  BrainCoreVideoControlledExecutionOperatorDecisionSnapshot,
  BrainCoreVideoControlledExecutionOperatorDecisionSnapshotResponse,
} from '../types/api.js';
import { readVideoControlledExecutionPreflightEvidenceHashDesign } from './video-orchestrator-controlled-execution-preflight-evidence-hash-design.js';

const safety: BrainCoreVideoControlledExecutionOperatorDecisionSnapshot['safety'] = {
  readOnly: true,
  snapshotDesignOnly: true,
  snapshotPersistenceEnabled: false,
  decisionQueueMutationEnabled: false,
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

export function readVideoControlledExecutionOperatorDecisionSnapshotDesign(): BrainCoreVideoControlledExecutionOperatorDecisionSnapshotResponse {
  const hashDesign = readVideoControlledExecutionPreflightEvidenceHashDesign().design;

  const decisionFields = [
    'decisionId',
    'decisionType',
    'candidateStoryId',
    'sourceEpisodeId',
    'operatorIdPlaceholder',
    'operatorRolePlaceholder',
    'selectedValue',
    'rationale',
    'createdAt',
    'expiresAt',
    'invalidatedAt',
    'invalidationReason',
  ];

  const snapshotRules = [
    'Read-only decision capture design only',
    'No queue mutation or decision persistence',
    'No decision persistence store',
    'No approval creation from snapshot',
    'No execution from snapshot',
    'Snapshot invalidates when candidate/story/hash/risk/policy changes',
    'Snapshot cannot enable execution, publishing, STB mutation, or Mind writes',
  ];

  const missingRequirements = [
    'No decision snapshot persistence store',
    'No decision ID generator',
    'No snapshot validation logic',
    'No queue mutation endpoint',
    'No decision expiry enforcement',
    'No audit storage for decisions',
    'No concurrent decision conflict detection',
  ];

  const evidenceReferences = [
    '/video-orchestrator/operator-decision-queue',
    '/video-orchestrator/controlled-execution-preflight-evidence-hash-design',
    '/video-orchestrator/controlled-execution-candidate-story-lock-design',
    '/video-orchestrator/controlled-execution-risk-register',
    '/video-orchestrator/controlled-execution-policy-boundary',
  ];

  const blockers = [
    ...hashDesign.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    snapshot: {
      id: 'video-orchestrator-controlled-execution-operator-decision-snapshot-design',
      generatedAt: new Date().toISOString(),
      version: 'phase-5n',
      status: 'blocked',
      snapshotDesignExists: false,
      snapshotPersistenceEnabled: false,
      decisionQueueMutationEnabled: false,
      approvalCreationEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        decisionFieldCount: decisionFields.length,
        snapshotRuleCount: snapshotRules.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      decisionFields,
      snapshotRules,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep operator decision snapshot design read-only; do not persist decisions or mutate queue.',
      safety,
    },
  };
}
