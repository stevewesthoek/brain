import type {
  BrainCoreVideoControlledExecutionPolicyBoundary,
  BrainCoreVideoControlledExecutionPolicyBoundaryItem,
  BrainCoreVideoControlledExecutionPolicyBoundaryResponse,
} from '../types/api.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoProductionCutoverGate } from './video-orchestrator-production-cutover-gate.js';
import { readVideoRenderExportPolicy } from './video-orchestrator-render-export-policy.js';

const safety: BrainCoreVideoControlledExecutionPolicyBoundaryItem['safety'] = {
  readOnly: true,
  canRegisterAction: false,
  canCreateApproval: false,
  canExecute: false,
  canWriteFiles: false,
  canPublish: false,
  canDecommissionStb: false,
  writesToMind: false,
};

function item(
  input: Omit<BrainCoreVideoControlledExecutionPolicyBoundaryItem, 'safety'>,
): BrainCoreVideoControlledExecutionPolicyBoundaryItem {
  return { ...input, safety };
}

export function readVideoControlledExecutionPolicyBoundary(): BrainCoreVideoControlledExecutionPolicyBoundaryResponse {
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const cutoverGate = readVideoProductionCutoverGate().gate;
  const renderExportPolicy = readVideoRenderExportPolicy().policy;

  const sections: BrainCoreVideoControlledExecutionPolicyBoundaryItem[] = [
    item({
      id: 'boundary-action-registration',
      label: 'Action registration boundary',
      category: 'action-registration',
      status: 'blocked',
      severity: 'blocking',
      mustBeTrueBeforeAllowed: [
        'Operator decision queue is resolved',
        'Action scope is documented',
        'Action allowlist policy is approved',
        'Execution readiness tests exist',
      ],
      currentBlockers: [
        'No action-registry entry exists',
        'No allowlist entry exists',
        'Operator decisions remain unresolved',
      ],
      nextSafeStep: 'Keep action registration blocked until operator decisions and allowlist policy are approved.',
    }),
    item({
      id: 'boundary-approval-execution',
      label: 'Approval execution boundary',
      category: 'approval-execution',
      status: 'blocked',
      severity: 'blocking',
      mustBeTrueBeforeAllowed: [
        'Approval policy specifies exact execution scope',
        'Human operator approval flow is durable and auditable',
        'Approval cannot execute without all preflight gates passing',
      ],
      currentBlockers: [
        'No executable approval exists',
        'Approval policy remains design-only',
        'Operator decision queue is blocked',
      ],
      nextSafeStep: 'Define approval execution preconditions without creating approvals.',
    }),
    item({
      id: 'boundary-runtime-isolation',
      label: 'Runtime isolation boundary',
      category: 'runtime-isolation',
      status: 'missing',
      severity: 'blocking',
      mustBeTrueBeforeAllowed: [
        'Runtime isolation design is approved',
        'Execution has explicit timeout and resource limits',
        'No broad shell execution is possible',
        'Runtime logs are redacted and scoped',
      ],
      currentBlockers: [
        'No runtime isolation policy exists',
        'No controlled execution runtime exists',
        'No execution plan is registered',
      ],
      nextSafeStep: 'Design runtime isolation boundary as read-only policy.',
    }),
    item({
      id: 'boundary-artifact-write',
      label: 'Artifact write/render/export boundary',
      category: 'artifact-write',
      status: 'blocked',
      severity: 'blocking',
      mustBeTrueBeforeAllowed: [
        'Artifact sandbox policy is approved',
        'Output path policy is approved',
        'Rollback and cleanup policy is approved',
        'Render/export runner policy is approved',
      ],
      currentBlockers: [
        `Render/export policy status: ${renderExportPolicy.status}`,
        'File writes remain disabled',
        'No output path is approved',
      ],
      nextSafeStep: renderExportPolicy.nextSafeStep,
    }),
    item({
      id: 'boundary-platform-publishing',
      label: 'Platform publishing boundary',
      category: 'platform-publishing',
      status: 'blocked',
      severity: 'blocking',
      mustBeTrueBeforeAllowed: [
        'Release candidate is approved',
        'Platform policy review passes',
        'Dry-run evidence validates payload shape',
        'Explicit publishing approval is recorded',
      ],
      currentBlockers: [
        'Publishing remains disabled',
        'No platform API calls are enabled',
        'No upload/schedule action exists',
      ],
      nextSafeStep: 'Keep platform publishing out of scope until production gates are ready.',
    }),
    item({
      id: 'boundary-stb-decommission',
      label: 'STB decommission boundary',
      category: 'stb-decommission',
      status: 'not-applicable',
      severity: 'blocking',
      mustBeTrueBeforeAllowed: [
        'Video Orchestrator has real dual-run parity',
        'Production cutover has succeeded',
        'Rollback has been tested',
        'User explicitly approves decommission discussion',
      ],
      currentBlockers: [
        `Production cutover status: ${cutoverGate.status}`,
        'STB remains source of truth',
        'Decommission discussion is premature',
      ],
      nextSafeStep: cutoverGate.nextSafeStep,
    }),
    item({
      id: 'boundary-human-operator-decision',
      label: 'Human operator decision boundary',
      category: 'human-decision',
      status: 'blocked',
      severity: 'blocking',
      mustBeTrueBeforeAllowed: [
        'Operator decision queue is reviewed',
        'High-priority decisions are resolved',
        'Policy owners accept unresolved risk',
      ],
      currentBlockers: operatorQueue.blockers,
      nextSafeStep: operatorQueue.nextSafeStep,
    }),
  ];

  const blockedCount = sections.filter(section => section.status === 'blocked').length;
  const missingCount = sections.filter(section => section.status === 'missing').length;
  const blockingSeverityCount = sections.filter(section => section.severity === 'blocking').length;
  const blockers = sections.flatMap(section => section.currentBlockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const boundary: BrainCoreVideoControlledExecutionPolicyBoundary = {
    id: 'video-orchestrator-controlled-execution-policy-boundary',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canRegisterAction: false,
    canCreateApproval: false,
    canExecute: false,
    canWriteFiles: false,
    canPublish: false,
    canDecommissionStb: false,
    sections,
    summary: {
      totalSections: sections.length,
      blockedCount,
      missingCount,
      blockingSeverityCount,
    },
    blockers,
    nextSafeStep: 'Keep execution disabled while defining policy boundaries and resolving operator decisions.',
    safety: {
      readOnly: true,
      canRegisterAction: false,
      canCreateApproval: false,
      canExecute: false,
      canWriteFiles: false,
      canPublish: false,
      canDecommissionStb: false,
      writesToMind: false,
    },
  };

  return { boundary };
}
