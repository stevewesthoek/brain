import type {
  BrainCoreVideoOperatorReviewPacket,
  BrainCoreVideoOperatorReviewPacketResponse,
  BrainCoreVideoOperatorReviewPacketSection,
} from '../types/api.js';
import { readVideoRoadmapCheckpoint } from './video-orchestrator-roadmap-checkpoint.js';
import { readVideoControlledExecutionReadinessIndex } from './video-orchestrator-controlled-execution-readiness-index.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoProductionCutoverGate } from './video-orchestrator-production-cutover-gate.js';
import { readVideoReleaseCandidateReadiness } from './video-orchestrator-release-candidate-readiness.js';
import { readVideoRollbackCleanupChecklist } from './video-orchestrator-rollback-cleanup-checklist.js';
import { readVideoFixtureComparisonPreview } from './video-orchestrator-fixture-comparison-preview.js';

const safety: BrainCoreVideoOperatorReviewPacketSection['safety'] = {
  readOnly: true,
  createsApproval: false,
  registersAction: false,
  executesStb: false,
  executesVideo: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function section(input: Omit<BrainCoreVideoOperatorReviewPacketSection, 'safety'>): BrainCoreVideoOperatorReviewPacketSection {
  return { ...input, safety };
}

export function readVideoOperatorReviewPacket(): BrainCoreVideoOperatorReviewPacketResponse {
  const roadmap = readVideoRoadmapCheckpoint().checkpoint;
  const readinessIndex = readVideoControlledExecutionReadinessIndex().index;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const cutoverGate = readVideoProductionCutoverGate().gate;
  const releaseCandidate = readVideoReleaseCandidateReadiness().snapshot;
  const rollbackChecklist = readVideoRollbackCleanupChecklist().checklist;
  const comparisonPreview = readVideoFixtureComparisonPreview().preview;

  const sections: BrainCoreVideoOperatorReviewPacketSection[] = [
    section({
      id: 'packet-roadmap',
      label: 'Roadmap checkpoint',
      status: 'included',
      sourceEndpoint: '/video-orchestrator/roadmap-checkpoint',
      summary: `Completed phases: ${roadmap.completedPhaseCount}; blocked phases: ${roadmap.blockedPhaseCount}.`,
      blockers: roadmap.blockers,
    }),
    section({
      id: 'packet-readiness-index',
      label: 'Controlled execution readiness index',
      status: 'included',
      sourceEndpoint: '/video-orchestrator/controlled-execution-readiness-index',
      summary: `Readiness percent: ${readinessIndex.readinessPercent}; blocked items: ${readinessIndex.summary.blockedCount}.`,
      blockers: readinessIndex.blockers,
    }),
    section({
      id: 'packet-operator-queue',
      label: 'Operator decision queue',
      status: 'blocked',
      sourceEndpoint: '/video-orchestrator/operator-decision-queue',
      summary: `Decision-required count: ${operatorQueue.summary.decisionRequiredCount}; high-priority count: ${operatorQueue.summary.highPriorityCount}.`,
      blockers: operatorQueue.blockers,
    }),
    section({
      id: 'packet-cutover-gate',
      label: 'Production cutover gate',
      status: 'included',
      sourceEndpoint: '/video-orchestrator/production-cutover-gate',
      summary: `Status: ${cutoverGate.status}; blocked items: ${cutoverGate.summary.blockedCount}.`,
      blockers: cutoverGate.blockers,
    }),
    section({
      id: 'packet-release-candidate',
      label: 'Release candidate readiness',
      status: 'missing',
      sourceEndpoint: '/video-orchestrator/release-candidate-readiness',
      summary: `Status: ${releaseCandidate.status}; readiness percent: ${releaseCandidate.readinessPercent}.`,
      blockers: releaseCandidate.blockers,
    }),
    section({
      id: 'packet-rollback-checklist',
      label: 'Rollback and cleanup checklist',
      status: 'included',
      sourceEndpoint: '/video-orchestrator/rollback-cleanup-checklist',
      summary: `Blocked items: ${rollbackChecklist.summary.blockedCount}; missing items: ${rollbackChecklist.summary.missingCount}.`,
      blockers: rollbackChecklist.blockers,
    }),
    section({
      id: 'packet-comparison-preview',
      label: 'Fixture comparison preview',
      status: 'included',
      sourceEndpoint: '/video-orchestrator/fixture-comparison-preview',
      summary: `Preview status: ${comparisonPreview.status}; manual review count: ${comparisonPreview.summary.manualReviewCount}.`,
      blockers: comparisonPreview.blockers,
    }),
  ];

  const includedCount = sections.filter(item => item.status === 'included').length;
  const blockedCount = sections.filter(item => item.status === 'blocked').length;
  const missingCount = sections.filter(item => item.status === 'missing').length;
  const blockers = sections.flatMap(item => item.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const packet: BrainCoreVideoOperatorReviewPacket = {
    id: 'video-orchestrator-operator-review-packet',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canCreateApproval: false,
    canExecute: false,
    canMarkReviewed: false,
    sections,
    summary: {
      totalSections: sections.length,
      includedCount,
      blockedCount,
      missingCount,
    },
    blockers,
    nextSafeStep: 'Review the packet without creating approvals or execution actions.',
    safety: {
      readOnly: true,
      createsApproval: false,
      registersAction: false,
      executesStb: false,
      executesVideo: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { packet };
}
