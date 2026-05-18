import type {
  BrainCoreVideoPreviewCompletionIndex,
  BrainCoreVideoPreviewCompletionIndexItem,
  BrainCoreVideoPreviewCompletionIndexResponse,
} from '../types/api.js';
import { readVideoControlledExecutionReadinessIndex } from './video-orchestrator-controlled-execution-readiness-index.js';
import { readVideoOperatorReviewPacket } from './video-orchestrator-operator-review-packet.js';
import { readVideoRoadmapCheckpoint } from './video-orchestrator-roadmap-checkpoint.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoProductionCutoverGate } from './video-orchestrator-production-cutover-gate.js';

const safety: BrainCoreVideoPreviewCompletionIndexItem['safety'] = {
  readOnly: true,
  executesStb: false,
  executesVideo: false,
  createsApproval: false,
  registersAction: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function item(input: Omit<BrainCoreVideoPreviewCompletionIndexItem, 'safety'>): BrainCoreVideoPreviewCompletionIndexItem {
  return { ...input, safety };
}

export function readVideoPreviewCompletionIndex(): BrainCoreVideoPreviewCompletionIndexResponse {
  const roadmap = readVideoRoadmapCheckpoint().checkpoint;
  const reviewPacket = readVideoOperatorReviewPacket().packet;
  const readinessIndex = readVideoControlledExecutionReadinessIndex().index;
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const cutoverGate = readVideoProductionCutoverGate().gate;

  const items: BrainCoreVideoPreviewCompletionIndexItem[] = [
    item({
      id: 'preview-planning',
      label: 'Planning chain is complete',
      category: 'planning',
      status: 'complete',
      evidence: ['Planning modules exist from intake through manual export package.'],
      blockers: [],
    }),
    item({
      id: 'preview-policy',
      label: 'Policy chain is complete as design-only',
      category: 'policy',
      status: 'complete',
      evidence: ['Policy and gate summaries exist as read-only modules.'],
      blockers: [],
    }),
    item({
      id: 'preview-dashboard',
      label: 'Dashboard visibility covers core readiness cards',
      category: 'dashboard',
      status: 'complete',
      evidence: ['Brain Console shows policy chain, boundary, readiness index, roadmap checkpoint, and review packet.'],
      blockers: [],
    }),
    item({
      id: 'preview-review',
      label: 'Operator review packet is complete',
      category: 'review',
      status: 'complete',
      evidence: [`Review packet status: ${reviewPacket.status}`],
      blockers: [],
    }),
    item({
      id: 'preview-execution-blocker',
      label: 'Real execution remains blocked',
      category: 'execution-blocker',
      status: 'blocked',
      evidence: [`Readiness index status: ${readinessIndex.status}`, 'Execution remains disabled across all current policy gates.'],
      blockers: readinessIndex.blockers,
    }),
    item({
      id: 'preview-production-blocker',
      label: 'Production remains blocked',
      category: 'production-blocker',
      status: 'blocked',
      evidence: [`Cutover gate status: ${cutoverGate.status}`, `Roadmap status: ${roadmap.status}`],
      blockers: [...cutoverGate.blockers, ...roadmap.blockers],
    }),
    item({
      id: 'preview-safety',
      label: 'Safety invariants remain enforced',
      category: 'safety',
      status: 'requires-approval',
      evidence: [
        'No approval creation',
        'No action registration',
        'No render/export',
        'No publishing',
        'No STB decommission',
      ],
      blockers: [...operatorQueue.blockers, ...boundary.blockers],
    }),
  ];

  const completeCount = items.filter(entry => entry.status === 'complete').length;
  const blockedCount = items.filter(entry => entry.status === 'blocked').length;
  const approvalRequiredCount = items.filter(entry => entry.status === 'requires-approval').length;
  const blockers = items.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);
  const readinessPercent = Math.round((completeCount / items.length) * 100);

  const index: BrainCoreVideoPreviewCompletionIndex = {
    id: 'video-orchestrator-preview-completion-index',
    generatedAt: new Date().toISOString(),
    status: 'execution-blocked',
    previewComplete: true,
    executionBlocked: true,
    readinessPercent,
    items,
    summary: {
      totalItems: items.length,
      completeCount,
      blockedCount,
      approvalRequiredCount,
    },
    blockers,
    nextMacroPhase: 'Phase 5 - Explicit operator-approved controlled execution design',
    nextSafeStep: 'Keep preview-only modules visible and do not unlock execution, approval, or publication paths.',
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

  return { index };
}
