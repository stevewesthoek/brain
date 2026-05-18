import type {
  BrainCoreVideoControlledExecutionDisabledGate,
  BrainCoreVideoControlledExecutionDisabledGateResponse,
} from '../types/api.js';
import { readVideoControlledExecutionApprovalPayloadSchema } from './video-orchestrator-controlled-execution-approval-payload-schema.js';
import { readVideoControlledExecutionPreflightValidatorSchema } from './video-orchestrator-controlled-execution-preflight-validator-schema.js';
import { readVideoControlledExecutionPlanStub } from './video-orchestrator-controlled-execution-plan-stub.js';
import { readVideoControlledExecutionApprovalRequestDesign } from './video-orchestrator-controlled-execution-approval-request-design.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoControlledExecutionRiskRegister } from './video-orchestrator-controlled-execution-risk-register.js';

const safety: BrainCoreVideoControlledExecutionDisabledGate['safety'] = {
  readOnly: true,
  approvalRequestOnly: false,
  createsApproval: false,
  registersAction: false,
  registersAllowlist: false,
  runsValidator: false,
  createsExecutionPlan: false,
  executionPlanExecutable: false,
  executionEnabled: false,
  requiresSecondApproval: true,
  secondApprovalPolicyExists: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  rendersVideo: false,
  exportsArtifacts: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

export function readVideoControlledExecutionDisabledGate(): BrainCoreVideoControlledExecutionDisabledGateResponse {
  const approvalPayload = readVideoControlledExecutionApprovalPayloadSchema().schema;
  const validatorSchema = readVideoControlledExecutionPreflightValidatorSchema().schema;
  const planStub = readVideoControlledExecutionPlanStub().plan;
  const approvalRequestDesign = readVideoControlledExecutionApprovalRequestDesign().design;
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;
  const riskRegister = readVideoControlledExecutionRiskRegister().register;

  const gateChain = [
    'approval payload schema',
    'preflight validator schema',
    'execution plan stub',
    'approval request design',
    'explicit second approval gate',
    'execution runner disabled',
  ];

  const disabledReasons = [
    'No second approval policy accepted',
    'No action registration',
    'No allowlist wrapper',
    'No runnable validator',
    'No executable plan',
    'No runtime sandbox approval',
    'No artifact output policy',
    'No STB/video execution permission',
  ];

  const requiredBeforeExecution = [
    'Explicit second approval policy',
    'Allowlisted runner design',
    'Validator implementation approval',
    'Runtime-local sandbox approval',
    'Rollback/cleanup acceptance',
    'Dual-run comparison acceptance',
    'Operator confirmation',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-approval-payload-schema',
    '/video-orchestrator/controlled-execution-preflight-validator-schema',
    '/video-orchestrator/controlled-execution-plan-stub',
    '/video-orchestrator/controlled-execution-approval-request-design',
    '/video-orchestrator/controlled-execution-policy-boundary',
    '/video-orchestrator/controlled-execution-risk-register',
  ];

  const blockers = [
    ...approvalPayload.blockers,
    ...validatorSchema.blockers,
    ...planStub.blockers,
    ...approvalRequestDesign.blockers,
    ...boundary.blockers,
    ...riskRegister.blockers,
    ...disabledReasons,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    gate: {
      id: 'video-orchestrator-controlled-execution-disabled-gate',
      generatedAt: new Date().toISOString(),
      version: 'phase-5f',
      status: 'blocked',
      executionEnabled: false,
      secondApprovalRequired: true,
      secondApprovalPolicyExists: false,
      executable: false,
      summary: {
        gateCount: gateChain.length,
        disabledReasonCount: disabledReasons.length,
        requiredBeforeExecutionCount: requiredBeforeExecution.length,
        blockerCount: blockers.length,
      },
      gateChain,
      disabledReasons,
      requiredBeforeExecution,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep execution disabled; define second-approval policy as a separate future design-only phase.',
      safety,
    },
  };
}
