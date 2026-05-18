import type {
  BrainCoreVideoControlledExecutionApprovalRequestDesign,
  BrainCoreVideoControlledExecutionApprovalRequestDesignResponse,
} from '../types/api.js';
import { readVideoControlledExecutionApprovalPayloadSchema } from './video-orchestrator-controlled-execution-approval-payload-schema.js';
import { readVideoControlledExecutionPreflightValidatorSchema } from './video-orchestrator-controlled-execution-preflight-validator-schema.js';
import { readVideoControlledExecutionPlanStub } from './video-orchestrator-controlled-execution-plan-stub.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoControlledExecutionRiskRegister } from './video-orchestrator-controlled-execution-risk-register.js';

const safety: BrainCoreVideoControlledExecutionApprovalRequestDesign['safety'] = {
  readOnly: true,
  approvalRequestOnly: true,
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

export function readVideoControlledExecutionApprovalRequestDesign(): BrainCoreVideoControlledExecutionApprovalRequestDesignResponse {
  const approvalPayload = readVideoControlledExecutionApprovalPayloadSchema().schema;
  const validatorSchema = readVideoControlledExecutionPreflightValidatorSchema().schema;
  const planStub = readVideoControlledExecutionPlanStub().plan;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;
  const riskRegister = readVideoControlledExecutionRiskRegister().register;

  const requiredPreconditions = [
    'Approved candidate selected',
    'Approval payload schema complete',
    'Preflight validator accepted',
    'Execution plan stub accepted',
    'Operator decisions resolved',
    'Rollback/cleanup policy accepted',
    'Sandbox policy accepted',
  ];

  const missingPreconditions = [
    'No approved candidate selected',
    'Approval payload schema remains blocked',
    'Preflight validator remains blocked',
    'Execution plan stub remains disabled',
    'Operator decisions remain unresolved',
    'Rollback/cleanup policy remains blocked',
    'Sandbox policy remains blocked',
  ];

  const requestShape = {
    candidateStoryId: '',
    sourceEpisodeId: '',
    scopeType: 'single-story-only' as const,
    selectedDecisionIds: [] as string[],
    evidenceReferences: [
      '/video-orchestrator/controlled-execution-approval-payload-schema',
      '/video-orchestrator/controlled-execution-preflight-validator-schema',
      '/video-orchestrator/controlled-execution-plan-stub',
      '/video-orchestrator/operator-decision-queue',
      '/video-orchestrator/controlled-execution-policy-boundary',
      '/video-orchestrator/controlled-execution-risk-register',
    ],
    requestedBy: 'operator-id-placeholder',
    expiresAt: '',
    rollbackRequirement: 'Explicit rollback requirement placeholder for future approval creation policy.',
    dryRunOnly: true,
  };

  const blockers = [
    ...approvalPayload.blockers,
    ...validatorSchema.blockers,
    ...planStub.blockers,
    ...operatorQueue.blockers,
    ...boundary.blockers,
    ...riskRegister.blockers,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    design: {
      id: 'video-orchestrator-controlled-execution-approval-request-design',
      generatedAt: new Date().toISOString(),
      version: 'phase-5e',
      status: 'blocked',
      approvalRequestEnabled: false,
      createsApproval: false,
      registersAction: false,
      executable: false,
      summary: {
        totalRequiredPreconditions: requiredPreconditions.length,
        missingPreconditionsCount: missingPreconditions.length,
        blockerCount: blockers.length,
      },
      requestShape,
      requiredPreconditions,
      missingPreconditions,
      blockers,
      evidenceReferences: requestShape.evidenceReferences,
      nextSafeStep: 'Keep approval request design read-only until explicit approval creation policy is accepted.',
      safety,
    },
  };
}
