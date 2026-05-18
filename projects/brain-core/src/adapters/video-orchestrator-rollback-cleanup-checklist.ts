import type {
  BrainCoreVideoRollbackCleanupChecklist,
  BrainCoreVideoRollbackCleanupChecklistItem,
  BrainCoreVideoRollbackCleanupChecklistResponse,
} from '../types/api.js';
import { readVideoArtifactSandboxDesign } from './video-orchestrator-artifact-sandbox-design.js';
import { readVideoControlledDryRunDesign } from './video-orchestrator-controlled-dry-run-design.js';

const safety: BrainCoreVideoRollbackCleanupChecklistItem['safety'] = {
  readOnly: true,
  deletesFiles: false,
  writesFiles: false,
  executesCleanup: false,
  executesRollback: false,
  createsApproval: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function item(input: Omit<BrainCoreVideoRollbackCleanupChecklistItem, 'safety'>): BrainCoreVideoRollbackCleanupChecklistItem {
  return { ...input, safety };
}

export function readVideoRollbackCleanupChecklist(): BrainCoreVideoRollbackCleanupChecklistResponse {
  const sandbox = readVideoArtifactSandboxDesign().sandbox;
  const dryRun = readVideoControlledDryRunDesign().dryRun;

  const items: BrainCoreVideoRollbackCleanupChecklistItem[] = [
    item({
      id: 'rollback-candidate-scope',
      label: 'Rollback scope limited to one future candidate story',
      category: 'rollback',
      status: 'planned',
      severity: 'warning',
      evidence: ['Future rollback must be scoped to one candidate story and one sandbox boundary.'],
      blockers: ['Candidate selection policy remains blocked.'],
      nextSafeStep: 'Define candidate selection policy before execution design.',
    }),
    item({
      id: 'rollback-no-runtime-state-change',
      label: 'Runtime state rollback is not executable',
      category: 'rollback',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Controlled dry-run canExecuteDryRun=${dryRun.canExecuteDryRun}`],
      blockers: ['No controlled dry-run execution exists', 'No runtime state mutations are allowed'],
      nextSafeStep: 'Keep rollback as checklist-only until explicit execution policy exists.',
    }),
    item({
      id: 'cleanup-no-file-delete',
      label: 'File cleanup/delete is disabled',
      category: 'cleanup',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Artifact sandbox canCleanup=${sandbox.canCleanup}`, `Artifact sandbox canWriteFiles=${sandbox.canWriteFiles}`],
      blockers: ['No generated artifact directory exists', 'No delete policy exists', 'No cleanup action is registered'],
      nextSafeStep: 'Define retention and cleanup policy before any file-producing module exists.',
    }),
    item({
      id: 'retention-policy-missing',
      label: 'Retention policy is missing',
      category: 'retention',
      status: 'missing',
      severity: 'blocking',
      evidence: ['Sandbox design documents retention/cleanup as missing.'],
      blockers: ['No retention period approved', 'No artifact lifecycle policy exists'],
      nextSafeStep: 'Specify retention durations for future sandbox artifacts without creating files.',
    }),
    item({
      id: 'audit-record-required',
      label: 'Rollback audit record requirement',
      category: 'audit',
      status: 'blocked',
      severity: 'blocking',
      evidence: ['Approval policy remains policy-only and cannot create approvals.'],
      blockers: ['No rollback audit schema exists', 'No executable approval exists'],
      nextSafeStep: 'Define audit fields for rollback/cleanup decisions before action registration.',
    }),
    item({
      id: 'operator-review-required',
      label: 'Operator review required before cleanup execution',
      category: 'operator-review',
      status: 'planned',
      severity: 'warning',
      evidence: ['Operator review is a planned gate in controlled dry-run design.'],
      blockers: ['No operator approval workflow exists.'],
      nextSafeStep: 'Keep operator review as read-only checklist until approval workflow exists.',
    }),
    item({
      id: 'safety-stb-protected',
      label: 'STB protected from rollback/decommission',
      category: 'safety',
      status: 'planned',
      severity: 'info',
      evidence: ['All current video policy modules set decommissionsStb=false.'],
      blockers: [],
      nextSafeStep: 'Preserve STB as source of truth through parity validation.',
    }),
  ];

  const plannedCount = items.filter(entry => entry.status === 'planned').length;
  const blockedCount = items.filter(entry => entry.status === 'blocked').length;
  const missingCount = items.filter(entry => entry.status === 'missing').length;
  const blockingSeverityCount = items.filter(entry => entry.severity === 'blocking').length;
  const blockers = items.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const checklist: BrainCoreVideoRollbackCleanupChecklist = {
    id: 'video-orchestrator-rollback-cleanup-checklist',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canRollback: false,
    canCleanup: false,
    canDeleteFiles: false,
    executableActionRegistered: false,
    items,
    summary: {
      totalItems: items.length,
      plannedCount,
      blockedCount,
      missingCount,
      blockingSeverityCount,
    },
    blockers,
    nextSafeStep: 'Implement comparison schema design before any controlled dry-run implementation; keep rollback/cleanup checklist read-only.',
    safety: {
      readOnly: true,
      deletesFiles: false,
      writesFiles: false,
      executesCleanup: false,
      executesRollback: false,
      createsApproval: false,
      executableActionRegistered: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { checklist };
}
