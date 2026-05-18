import type {
  BrainCoreVideoReleaseCandidateReadinessItem,
  BrainCoreVideoReleaseCandidateReadinessResponse,
  BrainCoreVideoReleaseCandidateReadinessSnapshot,
} from '../types/api.js';
import { readVideoProductionGate } from './video-orchestrator-production-gate.js';
import { readVideoProductionCutoverGate } from './video-orchestrator-production-cutover-gate.js';
import { readVideoFixtureComparisonPreview } from './video-orchestrator-fixture-comparison-preview.js';

const safety: BrainCoreVideoReleaseCandidateReadinessItem['safety'] = {
  readOnly: true,
  marksReleaseCandidate: false,
  executesStb: false,
  executesVideo: false,
  rendersVideo: false,
  publishesContent: false,
  createsApproval: false,
  writesToMind: false,
};

function item(input: Omit<BrainCoreVideoReleaseCandidateReadinessItem, 'safety'>): BrainCoreVideoReleaseCandidateReadinessItem {
  return { ...input, safety };
}

export function readVideoReleaseCandidateReadiness(): BrainCoreVideoReleaseCandidateReadinessResponse {
  const productionGate = readVideoProductionGate().gate;
  const cutoverGate = readVideoProductionCutoverGate().gate;
  const comparisonPreview = readVideoFixtureComparisonPreview().preview;

  const items: BrainCoreVideoReleaseCandidateReadinessItem[] = [
    item({
      id: 'rc-planning-chain-ready',
      label: 'Planning chain complete enough for review',
      status: 'ready',
      severity: 'info',
      evidence: ['Video planning modules exist from intake through manual export package.'],
      blockers: [],
    }),
    item({
      id: 'rc-production-gate-blocked',
      label: 'Production gate still blocked',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Production gate status: ${productionGate.status}`],
      blockers: productionGate.criticalBlockers,
    }),
    item({
      id: 'rc-cutover-gate-blocked',
      label: 'Cutover gate still blocked',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Cutover gate status: ${cutoverGate.status}`],
      blockers: cutoverGate.blockers,
    }),
    item({
      id: 'rc-comparison-preview-only',
      label: 'Comparison is fixture-preview only',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Fixture comparison preview status: ${comparisonPreview.status}`],
      blockers: ['No real output comparison exists', 'No generated artifact reads are enabled'],
    }),
    item({
      id: 'rc-no-release-candidate-action',
      label: 'No release-candidate action registered',
      status: 'missing',
      severity: 'blocking',
      evidence: ['No POST route or action exists to mark release-candidate status.'],
      blockers: ['Release-candidate marking policy is not approved', 'No executable action registered'],
    }),
    item({
      id: 'rc-stb-protected',
      label: 'STB remains protected source of truth',
      status: 'ready',
      severity: 'info',
      evidence: ['All current gates keep decommissionsStb=false.'],
      blockers: [],
    }),
  ];

  const readyCount = items.filter(entry => entry.status === 'ready').length;
  const blockedCount = items.filter(entry => entry.status === 'blocked').length;
  const missingCount = items.filter(entry => entry.status === 'missing').length;
  const blockingSeverityCount = items.filter(entry => entry.severity === 'blocking').length;
  const blockers = items.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);
  const readinessPercent = Math.round((readyCount / items.length) * 100);

  const snapshot: BrainCoreVideoReleaseCandidateReadinessSnapshot = {
    id: 'video-orchestrator-release-candidate-readiness',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    readinessPercent,
    canMarkReleaseCandidate: false,
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
    nextSafeStep: 'Keep Video Orchestrator out of release-candidate status until real dual-run evidence, output comparison, rollback policy, and explicit approval exist.',
    safety: {
      readOnly: true,
      marksReleaseCandidate: false,
      executesStb: false,
      executesVideo: false,
      rendersVideo: false,
      publishesContent: false,
      createsApproval: false,
      executableActionRegistered: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { snapshot };
}
