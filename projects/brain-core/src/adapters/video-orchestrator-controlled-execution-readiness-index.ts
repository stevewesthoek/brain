import type {
  BrainCoreVideoControlledExecutionReadinessIndex,
  BrainCoreVideoControlledExecutionReadinessIndexItem,
  BrainCoreVideoControlledExecutionReadinessIndexResponse,
} from '../types/api.js';
import { readVideoApprovalPolicyDesign } from './video-orchestrator-approval-policy-design.js';
import { readVideoArtifactSandboxDesign } from './video-orchestrator-artifact-sandbox-design.js';
import { readVideoComparisonSchemaDesign } from './video-orchestrator-comparison-schema-design.js';
import { readVideoFixtureComparisonPreview } from './video-orchestrator-fixture-comparison-preview.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoProductionCutoverGate } from './video-orchestrator-production-cutover-gate.js';
import { readVideoProductionGate } from './video-orchestrator-production-gate.js';
import { readVideoReleaseCandidateReadiness } from './video-orchestrator-release-candidate-readiness.js';
import { readVideoRenderExportPolicy } from './video-orchestrator-render-export-policy.js';
import { readVideoRollbackCleanupChecklist } from './video-orchestrator-rollback-cleanup-checklist.js';

const safety: BrainCoreVideoControlledExecutionReadinessIndexItem['safety'] = {
  readOnly: true,
  canExecute: false,
  canRegisterAction: false,
  canCreateApproval: false,
  canRender: false,
  canExport: false,
  canPublish: false,
  canMarkReleaseCandidate: false,
  canDecommissionStb: false,
  writesToMind: false,
};

function item(
  input: Omit<BrainCoreVideoControlledExecutionReadinessIndexItem, 'safety'>,
): BrainCoreVideoControlledExecutionReadinessIndexItem {
  return { ...input, safety };
}

function summarizeBlocked(status: string): 'blocked' | 'missing' | 'not-applicable' {
  return status === 'missing' ? 'missing' : 'blocked';
}

export function readVideoControlledExecutionReadinessIndex(): BrainCoreVideoControlledExecutionReadinessIndexResponse {
  const productionGate = readVideoProductionGate().gate;
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const releaseCandidate = readVideoReleaseCandidateReadiness().snapshot;
  const cutoverGate = readVideoProductionCutoverGate().gate;
  const rollbackChecklist = readVideoRollbackCleanupChecklist().checklist;
  const artifactSandbox = readVideoArtifactSandboxDesign().sandbox;
  const comparisonPreview = readVideoComparisonSchemaDesign().schema;
  const fixtureComparisonPreview = readVideoFixtureComparisonPreview().preview;
  const renderPolicy = readVideoRenderExportPolicy().policy;
  const approvalPolicy = readVideoApprovalPolicyDesign().policy;

  const items: BrainCoreVideoControlledExecutionReadinessIndexItem[] = [
    item({
      id: 'index-production-gate',
      label: 'Production gate remains blocked',
      category: 'production-gate',
      status: summarizeBlocked(productionGate.status),
      severity: 'blocking',
      evidence: [`Production gate status: ${productionGate.status}`, `Ready items: ${productionGate.summary.readyItems}`],
      blockers: productionGate.criticalBlockers,
    }),
    item({
      id: 'index-execution-boundary',
      label: 'Controlled execution boundary is policy-only',
      category: 'execution-boundary',
      status: summarizeBlocked(boundary.status),
      severity: 'blocking',
      evidence: [`Boundary status: ${boundary.status}`, `Boundary sections: ${boundary.summary.totalSections}`],
      blockers: boundary.blockers,
    }),
    item({
      id: 'index-operator-decision',
      label: 'Operator decisions remain unresolved',
      category: 'operator-decision',
      status: summarizeBlocked(operatorQueue.status),
      severity: 'blocking',
      evidence: [`Operator decision queue status: ${operatorQueue.status}`, `High priority decisions: ${operatorQueue.summary.highPriorityCount}`],
      blockers: operatorQueue.blockers,
    }),
    item({
      id: 'index-release-candidate',
      label: 'Release candidate marking remains blocked',
      category: 'release-candidate',
      status: summarizeBlocked(releaseCandidate.status),
      severity: 'blocking',
      evidence: [`Release candidate readiness status: ${releaseCandidate.status}`, `Readiness percent: ${releaseCandidate.readinessPercent}`],
      blockers: releaseCandidate.blockers,
    }),
    item({
      id: 'index-cutover',
      label: 'Production cutover remains blocked',
      category: 'cutover',
      status: summarizeBlocked(cutoverGate.status),
      severity: 'blocking',
      evidence: [`Cutover gate status: ${cutoverGate.status}`, `Blocked items: ${cutoverGate.summary.blockedCount}`],
      blockers: cutoverGate.blockers,
    }),
    item({
      id: 'index-rollback',
      label: 'Rollback and cleanup remain design-only',
      category: 'rollback',
      status: summarizeBlocked(rollbackChecklist.status),
      severity: 'blocking',
      evidence: [`Rollback checklist status: ${rollbackChecklist.status}`, `Blocked items: ${rollbackChecklist.summary.blockedCount}`],
      blockers: rollbackChecklist.blockers,
    }),
    item({
      id: 'index-artifact-sandbox',
      label: 'Artifact sandbox remains blocked',
      category: 'artifact-sandbox',
      status: summarizeBlocked(artifactSandbox.status),
      severity: 'blocking',
      evidence: [`Artifact sandbox status: ${artifactSandbox.status}`, `Boundary count: ${artifactSandbox.summary.boundaryCount}`],
      blockers: artifactSandbox.blockers,
    }),
    item({
      id: 'index-comparison',
      label: 'Comparison remains fixture-preview only',
      category: 'comparison',
      status: summarizeBlocked(comparisonPreview.status),
      severity: 'blocking',
      evidence: [
        `Comparison schema status: ${comparisonPreview.status}`,
        `Fixture comparison preview status: ${fixtureComparisonPreview.status}`,
        `Manual review count: ${fixtureComparisonPreview.summary.manualReviewCount}`,
      ],
      blockers: [...comparisonPreview.blockers, ...fixtureComparisonPreview.blockers],
    }),
    item({
      id: 'index-render-export',
      label: 'Render/export remains blocked',
      category: 'render-export',
      status: summarizeBlocked(renderPolicy.status),
      severity: 'blocking',
      evidence: [`Render/export policy status: ${renderPolicy.status}`, `Executable action registered: ${renderPolicy.executableActionRegistered}`],
      blockers: renderPolicy.blockers,
    }),
    item({
      id: 'index-approval-policy',
      label: 'Approval policy remains blocked',
      category: 'approval-policy',
      status: summarizeBlocked(approvalPolicy.status),
      severity: 'blocking',
      evidence: [`Approval policy status: ${approvalPolicy.status}`, `Can create approval: ${approvalPolicy.canCreateApproval}`],
      blockers: approvalPolicy.blockers,
    }),
    item({
      id: 'index-safety',
      label: 'Safety invariants remain enforced',
      category: 'safety',
      status: 'not-applicable',
      severity: 'info',
      evidence: [
        'Execution disabled',
        'Action registration disabled',
        'Approval creation disabled',
        'Publishing disabled',
        'STB decommission blocked',
      ],
      blockers: [],
    }),
  ];

  const readyCount = items.filter(entry => entry.status === 'ready').length;
  const blockedCount = items.filter(entry => entry.status === 'blocked').length;
  const missingCount = items.filter(entry => entry.status === 'missing').length;
  const blockingSeverityCount = items.filter(entry => entry.severity === 'blocking').length;
  const blockers = items.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);
  const readinessPercent = Math.round((readyCount / items.length) * 100);

  const index: BrainCoreVideoControlledExecutionReadinessIndex = {
    id: 'video-orchestrator-controlled-execution-readiness-index',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    readinessPercent,
    canExecute: false,
    canRegisterAction: false,
    canCreateApproval: false,
    canRender: false,
    canExport: false,
    canPublish: false,
    canMarkReleaseCandidate: false,
    canDecommissionStb: false,
    executableActionRegistered: false,
    items,
    summary: {
      totalItems: items.length,
      readyCount,
      blockedCount,
      missingCount,
      blockingSeverityCount,
    },
    blockers,
    nextSafeStep: 'Keep execution disabled while all policy, sandbox, comparison, cutover, and approval boundaries remain design-only.',
    safety: {
      readOnly: true,
      canExecute: false,
      canRegisterAction: false,
      canCreateApproval: false,
      canRender: false,
      canExport: false,
      canPublish: false,
      canMarkReleaseCandidate: false,
      canDecommissionStb: false,
      writesToMind: false,
    },
  };

  return { index };
}
