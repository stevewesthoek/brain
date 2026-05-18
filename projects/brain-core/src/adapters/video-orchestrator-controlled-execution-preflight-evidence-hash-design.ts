import type {
  BrainCoreVideoControlledExecutionPreflightEvidenceHashDesign,
  BrainCoreVideoControlledExecutionPreflightEvidenceHashDesignResponse,
} from '../types/api.js';
import { readVideoControlledExecutionCandidateStoryLock } from './video-orchestrator-controlled-execution-candidate-story-lock.js';

const safety: BrainCoreVideoControlledExecutionPreflightEvidenceHashDesign['safety'] = {
  readOnly: true,
  hashDesignOnly: true,
  hashComputationEnabled: false,
  evidencePersistenceEnabled: false,
  readsGeneratedArtifacts: false,
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

export function readVideoControlledExecutionPreflightEvidenceHashDesign(): BrainCoreVideoControlledExecutionPreflightEvidenceHashDesignResponse {
  const lockDesign = readVideoControlledExecutionCandidateStoryLock().lock;

  const hashInputs = [
    'candidateStoryId',
    'sourceEpisodeId',
    'approvalPayloadSchemaVersion',
    'preflightValidatorSchemaVersion',
    'planStubVersion',
    'candidateStoryLockVersion',
    'operatorDecisionSnapshotVersion',
    'riskRegisterVersion',
  ];

  const hashRules = [
    'Deterministic canonical JSON only',
    'No real artifact reads or file system access',
    'No file path hashing or traversal',
    'No secret material or credentials in hash input',
    'No execution output or runtime state',
    'No STB mutation or Video execution',
    'No Mind writes or remote access',
    'Hash invalidates on any candidate/story/preflight/risk/policy version change',
    'Hash must be reproducible from stored schema versions only',
  ];

  const missingRequirements = [
    'No canonical JSON serialization implementation',
    'No deterministic hash computation implementation',
    'No evidence persistence store',
    'No hash comparison/validation logic',
    'No validator execution path',
    'No lock enforcement mechanism',
    'No audit storage for hashes',
    'No timestamp binding for evidence',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-candidate-story-lock',
    '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model',
    '/video-orchestrator/controlled-execution-preflight-validator-schema',
    '/video-orchestrator/controlled-execution-risk-register',
    '/video-orchestrator/controlled-execution-policy-boundary',
  ];

  const blockers = [
    ...lockDesign.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    design: {
      id: 'video-orchestrator-controlled-execution-preflight-evidence-hash-design',
      generatedAt: new Date().toISOString(),
      version: 'phase-5m',
      status: 'blocked',
      hashDesignExists: false,
      hashComputationEnabled: false,
      evidencePersistenceEnabled: false,
      readsGeneratedArtifacts: false,
      validatorExecutionEnabled: false,
      lockEnforcementEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        hashInputCount: hashInputs.length,
        hashRuleCount: hashRules.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      hashInputs,
      hashRules,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep preflight evidence hash design read-only; do not compute hashes or persist evidence.',
      safety,
    },
  };
}
