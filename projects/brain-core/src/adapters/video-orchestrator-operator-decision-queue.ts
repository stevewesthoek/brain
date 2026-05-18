import type {
  BrainCoreVideoOperatorDecisionQueue,
  BrainCoreVideoOperatorDecisionQueueItem,
  BrainCoreVideoOperatorDecisionQueueResponse,
} from '../types/api.js';
import { readControlledDualRunRequestDesign } from './stb-video-controlled-dual-run-request.js';
import { readVideoArtifactSandboxDesign } from './video-orchestrator-artifact-sandbox-design.js';
import { readVideoComparisonSchemaDesign } from './video-orchestrator-comparison-schema-design.js';
import { readVideoReleaseCandidateReadiness } from './video-orchestrator-release-candidate-readiness.js';
import { readVideoRollbackCleanupChecklist } from './video-orchestrator-rollback-cleanup-checklist.js';

const safety: BrainCoreVideoOperatorDecisionQueueItem['safety'] = {
  readOnly: true,
  createsApproval: false,
  registersAction: false,
  executesStb: false,
  executesVideo: false,
  rendersVideo: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function decision(
  input: Omit<BrainCoreVideoOperatorDecisionQueueItem, 'requiredBeforeExecution' | 'safety'>,
): BrainCoreVideoOperatorDecisionQueueItem {
  return {
    ...input,
    requiredBeforeExecution: true,
    safety,
  };
}

export function readVideoOperatorDecisionQueue(): BrainCoreVideoOperatorDecisionQueueResponse {
  const controlledDualRun = readControlledDualRunRequestDesign().design;
  const artifactSandbox = readVideoArtifactSandboxDesign().sandbox;
  const comparisonSchema = readVideoComparisonSchemaDesign().schema;
  const rollbackCleanup = readVideoRollbackCleanupChecklist().checklist;
  const releaseCandidate = readVideoReleaseCandidateReadiness().snapshot;

  const decisions: BrainCoreVideoOperatorDecisionQueueItem[] = [
    decision({
      id: 'decision-candidate-selection-policy',
      label: 'Approve candidate selection policy',
      category: 'candidate-selection',
      status: 'decision-required',
      priority: 'high',
      evidence: [
        `Controlled dual-run request status: ${controlledDualRun.status}`,
        'Candidate story selection is required before controlled execution design.',
      ],
      blockers: [
        'Candidate selection policy not approved',
        'Candidate review criteria not accepted by operator',
      ],
      nextSafeStep: 'Review and approve candidate selection policy in a future approval-policy design pass.',
    }),
    decision({
      id: 'decision-rollback-cleanup-policy',
      label: 'Approve rollback/cleanup policy',
      category: 'rollback-cleanup',
      status: rollbackCleanup.summary.blockedCount > 0 || rollbackCleanup.summary.missingCount > 0 ? 'blocked' : 'decision-required',
      priority: 'high',
      evidence: [
        `Rollback/cleanup checklist status: ${rollbackCleanup.status}`,
        `Rollback/cleanup blocked items: ${rollbackCleanup.summary.blockedCount}`,
      ],
      blockers: rollbackCleanup.blockers,
      nextSafeStep: rollbackCleanup.nextSafeStep,
    }),
    decision({
      id: 'decision-artifact-sandbox-policy',
      label: 'Approve artifact sandbox policy',
      category: 'artifact-sandbox',
      status: artifactSandbox.summary.blockedCount > 0 || artifactSandbox.summary.missingCount > 0 ? 'blocked' : 'decision-required',
      priority: 'high',
      evidence: [
        `Artifact sandbox status: ${artifactSandbox.status}`,
        `Sandbox boundaries: ${artifactSandbox.summary.boundaryCount}`,
      ],
      blockers: artifactSandbox.blockers,
      nextSafeStep: artifactSandbox.nextSafeStep,
    }),
    decision({
      id: 'decision-comparison-schema',
      label: 'Approve comparison schema',
      category: 'comparison-schema',
      status: comparisonSchema.summary.blockedCount > 0 || comparisonSchema.summary.missingCount > 0 ? 'blocked' : 'decision-required',
      priority: 'medium',
      evidence: [
        `Comparison schema status: ${comparisonSchema.status}`,
        `Comparison schema fields: ${comparisonSchema.summary.totalFields}`,
      ],
      blockers: comparisonSchema.blockers,
      nextSafeStep: comparisonSchema.nextSafeStep,
    }),
    decision({
      id: 'decision-release-candidate-criteria',
      label: 'Approve release candidate criteria',
      category: 'release-candidate',
      status: releaseCandidate.summary.blockedCount > 0 || releaseCandidate.summary.missingCount > 0 ? 'blocked' : 'decision-required',
      priority: 'high',
      evidence: [
        `Release-candidate readiness status: ${releaseCandidate.status}`,
        `Release-candidate readiness percent: ${releaseCandidate.readinessPercent}`,
      ],
      blockers: releaseCandidate.blockers,
      nextSafeStep: releaseCandidate.nextSafeStep,
    }),
    decision({
      id: 'decision-controlled-execution-design',
      label: 'Decide whether to design controlled execution',
      category: 'controlled-execution',
      status: 'not-ready',
      priority: 'medium',
      evidence: [
        'Execution remains disabled across current Video Orchestrator gates.',
        'This queue does not create approval or execution records.',
      ],
      blockers: [
        'Operator decisions above are unresolved',
        'No controlled execution policy has been approved',
        'No executable action is registered',
      ],
      nextSafeStep: 'Resolve policy decisions before designing controlled execution.',
    }),
  ];

  const decisionRequiredCount = decisions.filter(entry => entry.status === 'decision-required').length;
  const blockedCount = decisions.filter(entry => entry.status === 'blocked' || entry.status === 'not-ready').length;
  const highPriorityCount = decisions.filter(entry => entry.priority === 'high').length;
  const blockers = decisions.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const queue: BrainCoreVideoOperatorDecisionQueue = {
    id: 'video-orchestrator-operator-decision-queue',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canCreateApproval: false,
    executableActionRegistered: false,
    decisions,
    summary: {
      totalDecisions: decisions.length,
      decisionRequiredCount,
      blockedCount,
      highPriorityCount,
    },
    blockers,
    nextSafeStep: 'Review operator decisions without creating approvals or execution actions.',
    safety: {
      readOnly: true,
      createsApproval: false,
      registersAction: false,
      executesStb: false,
      executesVideo: false,
      rendersVideo: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { queue };
}
