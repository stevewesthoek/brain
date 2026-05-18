import type {
  BrainCoreVideoControlledDryRunDesign,
  BrainCoreVideoControlledDryRunDesignResponse,
  BrainCoreVideoControlledDryRunStep,
} from '../types/api.js';
import { readStbVideoDualRunEvidence } from './stb-video-dual-run-evidence.js';
import { readVideoApprovalPolicyDesign } from './video-orchestrator-approval-policy-design.js';
import { readVideoArtifactSandboxDesign } from './video-orchestrator-artifact-sandbox-design.js';
import { readVideoRenderExportPolicy } from './video-orchestrator-render-export-policy.js';

const safety: BrainCoreVideoControlledDryRunStep['safety'] = {
  readOnly: true,
  executesStb: false,
  executesVideo: false,
  rendersVideo: false,
  writesFiles: false,
  createsApproval: false,
  publishesContent: false,
  writesToMind: false,
};

function step(input: Omit<BrainCoreVideoControlledDryRunStep, 'safety'>): BrainCoreVideoControlledDryRunStep {
  return { ...input, safety };
}

export function readVideoControlledDryRunDesign(): BrainCoreVideoControlledDryRunDesignResponse {
  const evidence = readStbVideoDualRunEvidence().evidence;
  const renderPolicy = readVideoRenderExportPolicy().policy;
  const approvalPolicy = readVideoApprovalPolicyDesign().policy;
  const sandbox = readVideoArtifactSandboxDesign().sandbox;

  const steps: BrainCoreVideoControlledDryRunStep[] = [
    step({
      id: 'dry-run-step-candidate-selection',
      sequence: 1,
      label: 'Select one candidate story for dry-run review',
      stage: 'candidate',
      status: 'blocked',
      requiredBeforeExecution: true,
      evidence: [`Dual-run evidence status: ${evidence.status}`, `Evidence stages: ${evidence.summary.totalStages}`],
      blockers: ['Candidate selection policy remains blocked in controlled dual-run request design.'],
    }),
    step({
      id: 'dry-run-step-preflight-policies',
      sequence: 2,
      label: 'Evaluate policy preflight gates',
      stage: 'preflight',
      status: 'blocked',
      requiredBeforeExecution: true,
      evidence: [
        `Render/export policy status: ${renderPolicy.status}`,
        `Approval policy status: ${approvalPolicy.status}`,
        `Artifact sandbox status: ${sandbox.status}`,
      ],
      blockers: [
        'Render/export policy remains blocked for execution.',
        'Approval policy cannot create approvals.',
        'Artifact sandbox cannot create directories or write files.',
      ],
    }),
    step({
      id: 'dry-run-step-stb-read',
      sequence: 3,
      label: 'Read STB source-of-truth evidence only',
      stage: 'stb-read',
      status: 'planned',
      requiredBeforeExecution: true,
      evidence: ['STB is source of truth; dry-run design does not execute or mutate STB.'],
      blockers: [],
    }),
    step({
      id: 'dry-run-step-video-plan-read',
      sequence: 4,
      label: 'Read Video planning chain evidence only',
      stage: 'video-plan-read',
      status: 'planned',
      requiredBeforeExecution: true,
      evidence: ['Video planning chain is available through read-only modules from intake through manual export package.'],
      blockers: [],
    }),
    step({
      id: 'dry-run-step-comparison-preview',
      sequence: 5,
      label: 'Preview comparison fields without executing outputs',
      stage: 'comparison-preview',
      status: 'blocked',
      requiredBeforeExecution: true,
      evidence: ['Comparison preview is design-only; no STB or Video outputs are generated.'],
      blockers: ['No output comparison tooling exists.', 'No real dual-run execution exists.', 'No rendered/video output artifacts exist.'],
    }),
    step({
      id: 'dry-run-step-evidence-preview',
      sequence: 6,
      label: 'Preview evidence bundle without writing files',
      stage: 'evidence-preview',
      status: 'blocked',
      requiredBeforeExecution: true,
      evidence: [`Artifact sandbox canWriteFiles=${sandbox.canWriteFiles}`, 'Evidence bundle remains API response only.'],
      blockers: ['No evidence write policy exists.', 'No artifact sandbox output root is approved.'],
    }),
    step({
      id: 'dry-run-step-operator-review',
      sequence: 7,
      label: 'Operator reviews design before any future execution route',
      stage: 'operator-review',
      status: 'blocked',
      requiredBeforeExecution: true,
      evidence: [`Approval policy canCreateApproval=${approvalPolicy.canCreateApproval}`],
      blockers: ['No operator approval workflow exists for dry-run execution.'],
    }),
  ];

  const plannedCount = steps.filter(item => item.status === 'planned').length;
  const blockedCount = steps.filter(item => item.status === 'blocked').length;
  const requiredBeforeExecutionCount = steps.filter(item => item.requiredBeforeExecution).length;
  const blockers = steps.flatMap(item => item.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const dryRun: BrainCoreVideoControlledDryRunDesign = {
    id: 'video-orchestrator-controlled-dry-run-design',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canExecuteDryRun: false,
    canReadStbOutputs: false,
    canReadVideoOutputs: false,
    canWriteEvidence: false,
    executableActionRegistered: false,
    steps,
    summary: {
      totalSteps: steps.length,
      plannedCount,
      blockedCount,
      requiredBeforeExecutionCount,
    },
    blockers,
    nextSafeStep: 'Define rollback/cleanup checklist and comparison schema before any controlled dry-run execution implementation.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      rendersVideo: false,
      callsFfmpeg: false,
      writesFiles: false,
      createsApproval: false,
      executableActionRegistered: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { dryRun };
}
