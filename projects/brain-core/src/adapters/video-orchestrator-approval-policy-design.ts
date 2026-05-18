import type {
  BrainCoreVideoApprovalPolicyDesign,
  BrainCoreVideoApprovalPolicyDesignResponse,
  BrainCoreVideoApprovalPolicyLifecycleStep,
  BrainCoreVideoApprovalPolicyRequirement,
} from '../types/api.js';
import { readControlledDualRunRequestDesign } from './stb-video-controlled-dual-run-request.js';
import { readVideoRenderExportPolicy } from './video-orchestrator-render-export-policy.js';
import { readVideoProductionGate } from './video-orchestrator-production-gate.js';

const safety: BrainCoreVideoApprovalPolicyRequirement['safety'] = {
  readOnly: true,
  createsApproval: false,
  registersAction: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  publishesContent: false,
  writesToMind: false,
};

function requirement(input: Omit<BrainCoreVideoApprovalPolicyRequirement, 'safety'>): BrainCoreVideoApprovalPolicyRequirement {
  return { ...input, safety };
}

function lifecycle(input: Omit<BrainCoreVideoApprovalPolicyLifecycleStep, 'safety'>): BrainCoreVideoApprovalPolicyLifecycleStep {
  return { ...input, safety };
}

export function readVideoApprovalPolicyDesign(): BrainCoreVideoApprovalPolicyDesignResponse {
  const productionGate = readVideoProductionGate().gate;
  const dualRunRequest = readControlledDualRunRequestDesign().design;
  const renderPolicy = readVideoRenderExportPolicy().policy;

  const requirements: BrainCoreVideoApprovalPolicyRequirement[] = [
    requirement({
      id: 'approval-policy-human-operator-required',
      label: 'Human operator approval policy required',
      category: 'operator-approval',
      status: 'missing',
      severity: 'blocking',
      evidence: [`Controlled dual-run request status: ${dualRunRequest.status}`],
      blockers: ['No operator approval policy is approved for dual-run, render, export, or publishing.'],
      nextSafeStep: 'Draft operator approval policy before any executable action registration.',
    }),
    requirement({
      id: 'approval-policy-durable-audit-required',
      label: 'Durable audit requirement documented',
      category: 'durable-audit',
      status: 'blocked',
      severity: 'blocking',
      evidence: ['Existing approval system supports audit records for limited safe actions.'],
      blockers: ['No dual-run audit schema exists; no render/export approval audit policy exists.'],
      nextSafeStep: 'Define durable audit fields for future controlled execution without enabling execution.',
    }),
    requirement({
      id: 'approval-policy-rollback-required',
      label: 'Rollback plan required before execution',
      category: 'rollback',
      status: 'missing',
      severity: 'blocking',
      evidence: ['Production gate lists rollback and cleanup blockers.'],
      blockers: ['Rollback procedure is not specified for dual-run, render, or export failures.'],
      nextSafeStep: 'Design rollback checklist and cleanup policy as read-only policy artifacts.',
    }),
    requirement({
      id: 'approval-policy-scope-limited',
      label: 'Execution scope must stay limited',
      category: 'scope',
      status: 'satisfied',
      severity: 'info',
      evidence: [
        'Current modules are read-only planning modules.',
        'No executable action is registered for video dual-run, render, export, or publishing.',
      ],
      blockers: [],
      nextSafeStep: 'Keep future approvals scoped to one candidate story and one disabled dry-run design.',
    }),
    requirement({
      id: 'approval-policy-evidence-required',
      label: 'Evidence requirements must be attached to approval',
      category: 'evidence',
      status: 'blocked',
      severity: 'blocking',
      evidence: [`Production gate status: ${productionGate.status}`, `Render/export policy status: ${renderPolicy.status}`],
      blockers: ['No approval payload format links production gate, render policy, and dual-run evidence together.'],
      nextSafeStep: 'Define approval payload evidence references without creating approval records.',
    }),
    requirement({
      id: 'approval-policy-execution-gate-disabled',
      label: 'Execution gates remain disabled',
      category: 'execution-gate',
      status: 'satisfied',
      severity: 'info',
      evidence: ['canCreateApproval=false', 'canRegisterAction=false', 'canExecute=false'],
      blockers: [],
      nextSafeStep: 'Do not enable execution until policy, audit, rollback, and sandbox are approved.',
    }),
    requirement({
      id: 'approval-policy-stb-protected',
      label: 'STB remains protected source of truth',
      category: 'safety',
      status: 'satisfied',
      severity: 'info',
      evidence: ['STB execution and decommission remain blocked in all current policy modules.'],
      blockers: [],
      nextSafeStep: 'Preserve STB as source of truth through future dual-run validation.',
    }),
  ];

  const lifecycleSteps: BrainCoreVideoApprovalPolicyLifecycleStep[] = [
    lifecycle({
      id: 'policy-step-select-candidate',
      sequence: 1,
      label: 'Select one candidate story for policy review',
      status: 'planned',
      requiredBeforeExecution: true,
      blockers: [],
    }),
    lifecycle({
      id: 'policy-step-attach-evidence',
      sequence: 2,
      label: 'Attach production gate, render policy, and dual-run evidence',
      status: 'blocked',
      requiredBeforeExecution: true,
      blockers: ['Approval evidence payload format not defined.'],
    }),
    lifecycle({
      id: 'policy-step-review-rollback',
      sequence: 3,
      label: 'Review rollback and cleanup plan',
      status: 'blocked',
      requiredBeforeExecution: true,
      blockers: ['Rollback and cleanup plan missing.'],
    }),
    lifecycle({
      id: 'policy-step-register-action',
      sequence: 4,
      label: 'Register executable action only after explicit approval policy',
      status: 'blocked',
      requiredBeforeExecution: true,
      blockers: ['Executable action registration intentionally disabled.'],
    }),
  ];

  const blockedCount = requirements.filter(item => item.status === 'blocked').length;
  const missingCount = requirements.filter(item => item.status === 'missing').length;
  const satisfiedCount = requirements.filter(item => item.status === 'satisfied').length;
  const blockingSeverityCount = requirements.filter(item => item.severity === 'blocking').length;

  const policy: BrainCoreVideoApprovalPolicyDesign = {
    id: 'video-orchestrator-approval-policy-design',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canCreateApproval: false,
    canRegisterAction: false,
    canExecute: false,
    requirements,
    lifecycle: lifecycleSteps,
    summary: {
      totalRequirements: requirements.length,
      satisfiedCount,
      blockedCount,
      missingCount,
      blockingSeverityCount,
    },
    blockers: requirements.flatMap(item => item.blockers),
    nextSafeStep: 'Define rollback and durable audit policy before any executable approval/action design.',
    safety: {
      readOnly: true,
      createsApproval: false,
      executableActionRegistered: false,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { policy };
}
