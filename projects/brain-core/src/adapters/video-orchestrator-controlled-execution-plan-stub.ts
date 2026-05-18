import type {
  BrainCoreVideoControlledExecutionPlanStub,
  BrainCoreVideoControlledExecutionPlanStubResponse,
  BrainCoreVideoControlledExecutionPlanStubStep,
} from '../types/api.js';
import { readVideoControlledExecutionApprovalPayloadSchema } from './video-orchestrator-controlled-execution-approval-payload-schema.js';
import { readVideoControlledExecutionPreflightValidatorSchema } from './video-orchestrator-controlled-execution-preflight-validator-schema.js';
import { readVideoControlledExecutionPreflightChecklist } from './video-orchestrator-controlled-execution-preflight-checklist.js';
import { readVideoControlledExecutionRiskRegister } from './video-orchestrator-controlled-execution-risk-register.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';

const safety: BrainCoreVideoControlledExecutionPlanStub['safety'] = {
  readOnly: true,
  createsApproval: false,
  registersAction: false,
  runsValidator: false,
  createsExecutionPlan: false,
  executionPlanExecutable: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function step(input: Omit<BrainCoreVideoControlledExecutionPlanStubStep, 'status'>): BrainCoreVideoControlledExecutionPlanStubStep {
  return { ...input, status: 'blocked' };
}

export function readVideoControlledExecutionPlanStub(): BrainCoreVideoControlledExecutionPlanStubResponse {
  const approvalPayload = readVideoControlledExecutionApprovalPayloadSchema().schema;
  const preflightValidator = readVideoControlledExecutionPreflightValidatorSchema().schema;
  const preflightChecklist = readVideoControlledExecutionPreflightChecklist().checklist;
  const riskRegister = readVideoControlledExecutionRiskRegister().register;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;

  const planSteps: BrainCoreVideoControlledExecutionPlanStubStep[] = [
    step({
      id: 'plan-load-approved-candidate',
      label: 'Load approved candidate',
      description: 'Load a single approved candidate story into the future execution boundary.',
      blockers: ['No approved candidate exists'],
      nextSafeStep: 'Keep candidate selection design-only.',
    }),
    step({
      id: 'plan-verify-approval-payload',
      label: 'Verify approval payload',
      description: 'Verify that the approval payload schema is complete before any approval request can exist.',
      blockers: approvalPayload.blockers,
      nextSafeStep: 'Keep approval payload schema read-only.',
    }),
    step({
      id: 'plan-run-preflight-validator',
      label: 'Run preflight validator',
      description: 'Run the future validator only after it exists and remains disabled for now.',
      blockers: preflightValidator.blockers,
      nextSafeStep: 'Keep the validator schema blocked.',
    }),
    step({
      id: 'plan-prepare-runtime-sandbox',
      label: 'Prepare runtime-local sandbox',
      description: 'Prepare a runtime-local sandbox without writing to Mind, STB, or repositories.',
      blockers: preflightChecklist.blockers,
      nextSafeStep: 'Keep sandbox policy design-only.',
    }),
    step({
      id: 'plan-produce-memory-dry-run',
      label: 'Produce in-memory dry-run report',
      description: 'Produce a dry-run report in memory only, with no file output or rendering.',
      blockers: riskRegister.blockers,
      nextSafeStep: 'Keep dry-run planning preview-only.',
    }),
    step({
      id: 'plan-compare-stb-fixture',
      label: 'Compare against STB fixture',
      description: 'Compare planned output against STB fixture data without mutating STB.',
      blockers: boundary.blockers,
      nextSafeStep: 'Keep STB protected.',
    }),
    step({
      id: 'plan-return-blocked-result',
      label: 'Return blocked/not-ready result',
      description: 'Return a blocked result because execution remains disabled.',
      blockers: operatorQueue.blockers,
      nextSafeStep: operatorQueue.nextSafeStep,
    }),
  ];

  const requiredInputs = [
    'Approved candidate story ID',
    'Approved approval payload schema',
    'Approved preflight validator schema',
    'Approved preflight checklist',
    'Approved risk register',
    'Operator-selected decision references',
  ];

  const missingInputs = [
    'No approved candidate story ID',
    'No executable approval payload',
    'No runnable validator',
    'No runtime sandbox approval',
    'No execution permission',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-approval-payload-schema',
    '/video-orchestrator/controlled-execution-preflight-validator-schema',
    '/video-orchestrator/controlled-execution-preflight-checklist',
    '/video-orchestrator/controlled-execution-risk-register',
    '/video-orchestrator/operator-decision-queue',
    '/video-orchestrator/controlled-execution-policy-boundary',
  ];

  const blockers = [
    ...approvalPayload.blockers,
    ...preflightValidator.blockers,
    ...preflightChecklist.blockers,
    ...riskRegister.blockers,
    ...operatorQueue.blockers,
    ...boundary.blockers,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  const plan: BrainCoreVideoControlledExecutionPlanStub = {
    id: 'video-orchestrator-controlled-execution-plan-stub',
    generatedAt: new Date().toISOString(),
    version: 'phase-5d',
    status: 'blocked',
    createsExecutionPlan: false,
    executionPlanExecutable: false,
    candidateScope: {
      scopeType: 'single-story-only',
      approvedCandidatePresent: false,
    },
    planSteps,
    requiredInputs,
    missingInputs,
    evidenceReferences,
    blockers,
    summary: {
      totalSteps: planSteps.length,
      plannedSteps: 0,
      blockedSteps: planSteps.length,
      missingInputs: missingInputs.length,
      requiredInputs: requiredInputs.length,
    },
    nextSafeStep: 'Keep the plan stub disabled until Phase 5E approval-request-only design exists.',
    safety,
  };

  return { plan };
}
