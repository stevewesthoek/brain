import type {
  BrainCoreVideoProductionCutoverGate,
  BrainCoreVideoProductionCutoverGateItem,
  BrainCoreVideoProductionCutoverGateResponse,
} from '../types/api.js';
import { readVideoProductionGate } from './video-orchestrator-production-gate.js';
import { readVideoFixtureComparisonPreview } from './video-orchestrator-fixture-comparison-preview.js';
import { readVideoRollbackCleanupChecklist } from './video-orchestrator-rollback-cleanup-checklist.js';

const safety: BrainCoreVideoProductionCutoverGateItem['safety'] = {
  readOnly: true,
  marksProductionReady: false,
  switchesTraffic: false,
  decommissionsStb: false,
  executesStb: false,
  executesVideo: false,
  publishesContent: false,
  createsApproval: false,
  writesToMind: false,
};

function item(input: Omit<BrainCoreVideoProductionCutoverGateItem, 'safety'>): BrainCoreVideoProductionCutoverGateItem {
  return { ...input, safety };
}

export function readVideoProductionCutoverGate(): BrainCoreVideoProductionCutoverGateResponse {
  const productionGate = readVideoProductionGate().gate;
  const comparisonPreview = readVideoFixtureComparisonPreview().preview;
  const rollbackChecklist = readVideoRollbackCleanupChecklist().checklist;

  const items: BrainCoreVideoProductionCutoverGateItem[] = [
    item({
      id: 'cutover-planning-chain-present',
      label: 'Planning chain exists',
      category: 'planning-chain',
      status: 'passed',
      severity: 'info',
      evidence: ['Planning modules exist from intake through manual export package.'],
      blockers: [],
    }),
    item({
      id: 'cutover-production-gate-blocked',
      label: 'Production gate is not ready',
      category: 'safety',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Production gate status: ${productionGate.status}`],
      blockers: productionGate.criticalBlockers,
    }),
    item({
      id: 'cutover-dual-run-not-executed',
      label: 'Dual-run has not executed',
      category: 'dual-run',
      status: 'blocked',
      severity: 'blocking',
      evidence: ['Dual-run evidence is read-only and parityReady=false.'],
      blockers: ['No controlled dual-run execution exists', 'No STB/video output pair exists'],
    }),
    item({
      id: 'cutover-comparison-preview-only',
      label: 'Comparison is fixture-preview only',
      category: 'comparison',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Fixture comparison preview status: ${comparisonPreview.status}`],
      blockers: ['No real output comparison exists', 'Generated artifact reads are disabled'],
    }),
    item({
      id: 'cutover-approval-missing',
      label: 'Cutover approval policy is missing',
      category: 'approval',
      status: 'missing',
      severity: 'blocking',
      evidence: ['No approval route or action exists for cutover.'],
      blockers: ['No cutover approval workflow exists', 'No executable action registered'],
    }),
    item({
      id: 'cutover-rollback-blocked',
      label: 'Rollback/cleanup is checklist-only',
      category: 'rollback',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Rollback checklist canRollback=${rollbackChecklist.canRollback}`, `Rollback checklist canCleanup=${rollbackChecklist.canCleanup}`],
      blockers: rollbackChecklist.blockers,
    }),
    item({
      id: 'cutover-publishing-disabled',
      label: 'Publishing remains disabled',
      category: 'publishing',
      status: 'blocked',
      severity: 'blocking',
      evidence: ['No platform API calls or publishing routes are enabled.'],
      blockers: ['Publishing execution disabled', 'Scheduling disabled', 'Platform policy incomplete'],
    }),
    item({
      id: 'cutover-stb-decommission-blocked',
      label: 'STB decommission blocked',
      category: 'decommission',
      status: 'blocked',
      severity: 'blocking',
      evidence: ['STB remains source of truth and decommissionsStb=false.'],
      blockers: ['No parity proof', 'No rollback plan', 'No explicit user approval'],
    }),
  ];

  const passedCount = items.filter(entry => entry.status === 'passed').length;
  const blockedCount = items.filter(entry => entry.status === 'blocked').length;
  const missingCount = items.filter(entry => entry.status === 'missing').length;
  const blockingSeverityCount = items.filter(entry => entry.severity === 'blocking').length;
  const blockers = items.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const gate: BrainCoreVideoProductionCutoverGate = {
    id: 'video-orchestrator-production-cutover-gate',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canCutover: false,
    canMarkProductionReady: false,
    canDecommissionStb: false,
    executableActionRegistered: false,
    items,
    summary: {
      totalItems: items.length,
      passedCount,
      blockedCount,
      missingCount,
      blockingSeverityCount,
    },
    blockers,
    nextSafeStep: 'Keep STB primary; next safe work is Brain Console visibility for the policy/gate chain or explicit user decision on controlled execution policy.',
    safety: {
      readOnly: true,
      marksProductionReady: false,
      switchesTraffic: false,
      decommissionsStb: false,
      executesStb: false,
      executesVideo: false,
      publishesContent: false,
      createsApproval: false,
      executableActionRegistered: false,
      writesToMind: false,
    },
  };

  return { gate };
}
