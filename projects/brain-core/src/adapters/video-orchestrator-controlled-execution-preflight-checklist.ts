import type {
  BrainCoreVideoControlledExecutionPreflightChecklist,
  BrainCoreVideoControlledExecutionPreflightChecklistItem,
  BrainCoreVideoControlledExecutionPreflightChecklistResponse,
} from '../types/api.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoArtifactSandboxDesign } from './video-orchestrator-artifact-sandbox-design.js';
import { readVideoRollbackCleanupChecklist } from './video-orchestrator-rollback-cleanup-checklist.js';
import { readVideoComparisonSchemaDesign } from './video-orchestrator-comparison-schema-design.js';
import { readVideoRenderExportPolicy } from './video-orchestrator-render-export-policy.js';
import { readVideoProductionCutoverGate } from './video-orchestrator-production-cutover-gate.js';

const safety: BrainCoreVideoControlledExecutionPreflightChecklistItem['safety'] = {
  readOnly: true,
  canPassPreflight: false,
  canCreateApproval: false,
  canRegisterAction: false,
  canExecute: false,
  canWriteFiles: false,
  canPublish: false,
  canDecommissionStb: false,
  writesToMind: false,
};

function item(input: Omit<BrainCoreVideoControlledExecutionPreflightChecklistItem, 'safety'>): BrainCoreVideoControlledExecutionPreflightChecklistItem {
  return { ...input, safety };
}

export function readVideoControlledExecutionPreflightChecklist(): BrainCoreVideoControlledExecutionPreflightChecklistResponse {
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const sandbox = readVideoArtifactSandboxDesign().sandbox;
  const rollback = readVideoRollbackCleanupChecklist().checklist;
  const comparison = readVideoComparisonSchemaDesign().schema;
  const renderPolicy = readVideoRenderExportPolicy().policy;
  const cutover = readVideoProductionCutoverGate().gate;

  const items: BrainCoreVideoControlledExecutionPreflightChecklistItem[] = [
    item({
      id: 'preflight-operator-queue',
      label: 'Operator decision queue reviewed',
      status: 'blocked',
      evidence: [`Operator queue status: ${operatorQueue.status}`],
      blockers: operatorQueue.blockers,
      nextSafeStep: operatorQueue.nextSafeStep,
    }),
    item({
      id: 'preflight-approval-policy',
      label: 'Approval policy approved',
      status: 'blocked',
      evidence: ['Approval policy remains design-only.'],
      blockers: ['No executable approval exists'],
      nextSafeStep: 'Keep approval policy as a read-only design artifact.',
    }),
    item({
      id: 'preflight-artifact-sandbox',
      label: 'Artifact sandbox approved',
      status: 'blocked',
      evidence: [`Sandbox status: ${sandbox.status}`],
      blockers: sandbox.blockers,
      nextSafeStep: sandbox.nextSafeStep,
    }),
    item({
      id: 'preflight-rollback-cleanup',
      label: 'Rollback cleanup approved',
      status: 'blocked',
      evidence: [`Rollback checklist status: ${rollback.status}`],
      blockers: rollback.blockers,
      nextSafeStep: rollback.nextSafeStep,
    }),
    item({
      id: 'preflight-comparison-schema',
      label: 'Comparison schema approved',
      status: 'blocked',
      evidence: [`Comparison schema status: ${comparison.status}`],
      blockers: comparison.blockers,
      nextSafeStep: 'Keep comparison schema read-only until operator review exists.',
    }),
    item({
      id: 'preflight-render-export-policy',
      label: 'Render/export policy approved',
      status: 'blocked',
      evidence: [`Render/export policy status: ${renderPolicy.status}`],
      blockers: renderPolicy.blockers,
      nextSafeStep: renderPolicy.nextSafeStep,
    }),
    item({
      id: 'preflight-controlled-boundary',
      label: 'Controlled execution boundary reviewed',
      status: 'blocked',
      evidence: [`Boundary status: ${boundary.status}`],
      blockers: boundary.blockers,
      nextSafeStep: boundary.nextSafeStep,
    }),
    item({
      id: 'preflight-production-cutover',
      label: 'Production cutover gate still blocked',
      status: 'blocked',
      evidence: [`Cutover gate status: ${cutover.status}`],
      blockers: cutover.blockers,
      nextSafeStep: cutover.nextSafeStep,
    }),
    item({
      id: 'preflight-stb-protected',
      label: 'STB protected',
      status: 'planned',
      evidence: ['STB remains source of truth across all preview-only modules.'],
      blockers: [],
      nextSafeStep: 'Keep STB protected until explicit operator approval exists.',
    }),
    item({
      id: 'preflight-publishing-disabled',
      label: 'Publishing disabled',
      status: 'blocked',
      evidence: ['Publishing remains disabled across Video Orchestrator policy modules.'],
      blockers: ['No platform publish route exists', 'No scheduling route exists'],
      nextSafeStep: 'Keep publishing disabled until post-readiness operator review.',
    }),
  ];

  const blockedCount = items.filter(entry => entry.status === 'blocked').length;
  const missingCount = items.filter(entry => entry.status === 'missing').length;
  const plannedCount = items.filter(entry => entry.status === 'planned').length;
  const blockers = items.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const checklist: BrainCoreVideoControlledExecutionPreflightChecklist = {
    id: 'video-orchestrator-controlled-execution-preflight-checklist',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canPassPreflight: false,
    canCreateApproval: false,
    canRegisterAction: false,
    canExecute: false,
    canWriteFiles: false,
    canPublish: false,
    canDecommissionStb: false,
    items,
    summary: {
      totalItems: items.length,
      blockedCount,
      missingCount,
      plannedCount,
    },
    blockers,
    nextSafeStep: 'Keep preflight as a read-only boundary until operator decisions are resolved.',
    safety: {
      readOnly: true,
      canPassPreflight: false,
      canCreateApproval: false,
      canRegisterAction: false,
      canExecute: false,
      canWriteFiles: false,
      canPublish: false,
      canDecommissionStb: false,
      writesToMind: false,
    },
  };

  return { checklist };
}
