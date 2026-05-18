import type {
  BrainCoreVideoRoadmapCheckpoint,
  BrainCoreVideoRoadmapCheckpointPhase,
  BrainCoreVideoRoadmapCheckpointResponse,
} from '../types/api.js';
import { readVideoControlledExecutionReadinessIndex } from './video-orchestrator-controlled-execution-readiness-index.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoProductionCutoverGate } from './video-orchestrator-production-cutover-gate.js';
import { readVideoReleaseCandidateReadiness } from './video-orchestrator-release-candidate-readiness.js';

const safety: BrainCoreVideoRoadmapCheckpointPhase['safety'] = {
  readOnly: true,
  executesStb: false,
  executesVideo: false,
  createsApproval: false,
  registersAction: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function phase(input: Omit<BrainCoreVideoRoadmapCheckpointPhase, 'safety'>): BrainCoreVideoRoadmapCheckpointPhase {
  return { ...input, safety };
}

export function readVideoRoadmapCheckpoint(): BrainCoreVideoRoadmapCheckpointResponse {
  const readinessIndex = readVideoControlledExecutionReadinessIndex().index;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const releaseCandidate = readVideoReleaseCandidateReadiness().snapshot;
  const cutoverGate = readVideoProductionCutoverGate().gate;

  const phases: BrainCoreVideoRoadmapCheckpointPhase[] = [
    phase({
      id: 'phase-planning-chain',
      label: 'Planning chain through manual export package',
      group: 'planning-chain',
      status: 'complete',
      evidence: ['Planning modules exist from intake through manual export package.'],
      blockers: [],
      nextSafeStep: 'Keep planning modules read-only while policy phases remain blocked.',
    }),
    phase({
      id: 'phase-policy-gates',
      label: 'Policy and gate chain',
      group: 'policy-gates',
      status: 'complete',
      evidence: ['Production gate, render/export policy, approval policy, sandbox, dry-run, rollback, comparison, cutover, readiness, operator queue, execution boundary, and readiness index exist.'],
      blockers: [],
      nextSafeStep: 'Keep policy and gate modules read-only.',
    }),
    phase({
      id: 'phase-console-visibility',
      label: 'Brain Console visibility for policy chain',
      group: 'console-visibility',
      status: 'complete',
      evidence: ['Console cards exist for production gate, readiness, operator queue, execution boundary, and readiness index.'],
      blockers: [],
      nextSafeStep: 'Keep console visibility read-only.',
    }),
    phase({
      id: 'phase-operator-review',
      label: 'Operator review remains required',
      group: 'operator-review',
      status: 'requires-approval',
      evidence: [`Operator queue status: ${operatorQueue.status}`, `Approval required count: ${operatorQueue.summary.decisionRequiredCount}`],
      blockers: operatorQueue.blockers,
      nextSafeStep: operatorQueue.nextSafeStep,
    }),
    phase({
      id: 'phase-future-execution',
      label: 'Controlled execution implementation remains future work',
      group: 'future-execution',
      status: 'blocked',
      evidence: [`Readiness index status: ${readinessIndex.status}`, `Readiness percent: ${readinessIndex.readinessPercent}`],
      blockers: readinessIndex.blockers,
      nextSafeStep: readinessIndex.nextSafeStep,
    }),
    phase({
      id: 'phase-production-blockers',
      label: 'Production remains blocked',
      group: 'production',
      status: 'blocked',
      evidence: [`Release candidate readiness status: ${releaseCandidate.status}`, `Cutover gate status: ${cutoverGate.status}`],
      blockers: [...releaseCandidate.blockers, ...cutoverGate.blockers],
      nextSafeStep: 'Keep production blocked until explicit operator approval and execution policy exist.',
    }),
  ];

  const completedPhaseCount = phases.filter(item => item.status === 'complete').length;
  const blockedPhaseCount = phases.filter(item => item.status === 'blocked').length;
  const approvalRequiredCount = phases.filter(item => item.status === 'requires-approval').length;
  const blockers = phases.flatMap(item => item.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const checkpoint: BrainCoreVideoRoadmapCheckpoint = {
    id: 'video-orchestrator-roadmap-checkpoint',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    completedPhaseCount,
    blockedPhaseCount,
    approvalRequiredCount,
    phases,
    blockers,
    nextSafeStep: 'Keep roadmap progress preview-only; no execution path is unlocked.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      createsApproval: false,
      registersAction: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { checkpoint };
}
