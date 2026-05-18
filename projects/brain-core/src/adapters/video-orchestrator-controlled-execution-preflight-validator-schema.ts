import type {
  BrainCoreVideoControlledExecutionApprovalPayloadSchema,
  BrainCoreVideoControlledExecutionPreflightFailureCode,
  BrainCoreVideoControlledExecutionPreflightValidationRule,
  BrainCoreVideoControlledExecutionPreflightValidatorSchema,
  BrainCoreVideoControlledExecutionPreflightValidatorSchemaResponse,
} from '../types/api.js';
import { readVideoControlledExecutionApprovalPayloadSchema } from './video-orchestrator-controlled-execution-approval-payload-schema.js';
import { readVideoControlledExecutionPreflightChecklist } from './video-orchestrator-controlled-execution-preflight-checklist.js';
import { readVideoControlledExecutionRiskRegister } from './video-orchestrator-controlled-execution-risk-register.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';

const safety: BrainCoreVideoControlledExecutionPreflightValidationRule['safety'] = {
  readOnly: true,
  runsValidator: false,
  createsApproval: false,
  registersAction: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function rule(input: Omit<BrainCoreVideoControlledExecutionPreflightValidationRule, 'safety'>): BrainCoreVideoControlledExecutionPreflightValidationRule {
  return { ...input, safety };
}

function failureCode(input: Omit<BrainCoreVideoControlledExecutionPreflightFailureCode, 'safety'>): BrainCoreVideoControlledExecutionPreflightFailureCode {
  return {
    ...input,
    safety: {
      readOnly: true,
      runsValidator: false,
      createsApproval: false,
      registersAction: false,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };
}

export function readVideoControlledExecutionPreflightValidatorSchema(): BrainCoreVideoControlledExecutionPreflightValidatorSchemaResponse {
  const approvalPayload = readVideoControlledExecutionApprovalPayloadSchema().schema;
  const checklist = readVideoControlledExecutionPreflightChecklist().checklist;
  const riskRegister = readVideoControlledExecutionRiskRegister().register;
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;

  const rules: BrainCoreVideoControlledExecutionPreflightValidationRule[] = [
    rule({
      id: 'validator-candidate-scope',
      label: 'Candidate scope is single-story only',
      category: 'candidate',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['approval payload schema'],
      failureCodes: ['CANDIDATE_SCOPE_MISSING'],
      blockers: ['No approved candidate story exists'],
    }),
    rule({
      id: 'validator-approval-payload',
      label: 'Approval payload is complete',
      category: 'approval-payload',
      status: approvalPayload.summary.blockedFieldCount > 0 || approvalPayload.summary.missingFieldCount > 0 ? 'blocked' : 'defined',
      severity: 'blocking',
      dataSources: ['approval payload schema'],
      failureCodes: ['APPROVAL_PAYLOAD_INCOMPLETE'],
      blockers: approvalPayload.blockers,
    }),
    rule({
      id: 'validator-operator-decision',
      label: 'Operator decisions are selected',
      category: 'operator-decision',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['operator decision queue'],
      failureCodes: ['OPERATOR_DECISION_MISSING'],
      blockers: operatorQueue.blockers,
    }),
    rule({
      id: 'validator-sandbox',
      label: 'Sandbox policy is reviewed',
      category: 'sandbox',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['preflight checklist', 'controlled execution boundary'],
      failureCodes: ['SANDBOX_POLICY_BLOCKED'],
      blockers: checklist.blockers,
    }),
    rule({
      id: 'validator-rollback',
      label: 'Rollback checklist is reviewed',
      category: 'rollback',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['preflight checklist'],
      failureCodes: ['ROLLBACK_POLICY_BLOCKED'],
      blockers: checklist.blockers.filter(blocker => blocker.toLowerCase().includes('rollback')),
    }),
    rule({
      id: 'validator-comparison',
      label: 'Comparison schema is available',
      category: 'comparison',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['controlled execution boundary'],
      failureCodes: ['COMPARISON_SCHEMA_BLOCKED'],
      blockers: boundary.blockers,
    }),
    rule({
      id: 'validator-risk',
      label: 'Risk register is reviewed',
      category: 'risk',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['risk register'],
      failureCodes: ['RISK_REGISTER_BLOCKED'],
      blockers: riskRegister.blockers,
    }),
    rule({
      id: 'validator-execution-boundary',
      label: 'Execution boundary blocks execution',
      category: 'execution-boundary',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['controlled execution boundary'],
      failureCodes: ['EXECUTION_BOUNDARY_BLOCKED'],
      blockers: boundary.blockers,
    }),
    rule({
      id: 'validator-stb-protection',
      label: 'STB remains protected',
      category: 'safety',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['roadmap checkpoint', 'preflight checklist'],
      failureCodes: ['STB_PROTECTION_REQUIRED'],
      blockers: ['STB remains source of truth'],
    }),
    rule({
      id: 'validator-publishing-disabled',
      label: 'Publishing remains disabled',
      category: 'safety',
      status: 'blocked',
      severity: 'blocking',
      dataSources: ['preflight checklist'],
      failureCodes: ['PUBLISHING_DISABLED'],
      blockers: ['Publishing is disabled across the preview-only arc'],
    }),
  ];

  const failureCodes = [
    failureCode({
      code: 'CANDIDATE_SCOPE_MISSING',
      label: 'Candidate scope missing',
      severity: 'blocking',
      description: 'No approved single-story candidate exists for controlled execution.',
      remediation: 'Approve the first candidate story in a future design-only step.',
    }),
    failureCode({
      code: 'APPROVAL_PAYLOAD_INCOMPLETE',
      label: 'Approval payload incomplete',
      severity: 'blocking',
      description: 'The approval payload schema is missing required fields or evidence references.',
      remediation: 'Complete the approval payload schema before any approval request exists.',
    }),
    failureCode({
      code: 'OPERATOR_DECISION_MISSING',
      label: 'Operator decision missing',
      severity: 'blocking',
      description: 'Required operator decisions are unresolved.',
      remediation: 'Resolve operator decisions without creating approvals.',
    }),
    failureCode({
      code: 'SANDBOX_POLICY_BLOCKED',
      label: 'Sandbox policy blocked',
      severity: 'blocking',
      description: 'Sandbox policy is not yet approved for controlled execution.',
      remediation: 'Keep sandbox policy design-only.',
    }),
    failureCode({
      code: 'ROLLBACK_POLICY_BLOCKED',
      label: 'Rollback policy blocked',
      severity: 'blocking',
      description: 'Rollback policy is not yet approved for controlled execution.',
      remediation: 'Keep rollback policy read-only.',
    }),
    failureCode({
      code: 'COMPARISON_SCHEMA_BLOCKED',
      label: 'Comparison schema blocked',
      severity: 'blocking',
      description: 'Comparison schema is not yet accepted for validator use.',
      remediation: 'Keep comparison schema preview-only.',
    }),
    failureCode({
      code: 'RISK_REGISTER_BLOCKED',
      label: 'Risk register blocked',
      severity: 'blocking',
      description: 'Risk register acceptance is not yet available for execution.',
      remediation: 'Keep the risk register design-only.',
    }),
    failureCode({
      code: 'EXECUTION_BOUNDARY_BLOCKED',
      label: 'Execution boundary blocked',
      severity: 'blocking',
      description: 'Execution boundary still forbids execution.',
      remediation: 'Keep execution disabled.',
    }),
    failureCode({
      code: 'STB_PROTECTION_REQUIRED',
      label: 'STB protection required',
      severity: 'blocking',
      description: 'STB must remain protected as source of truth.',
      remediation: 'Do not design decommission until explicitly approved.',
    }),
    failureCode({
      code: 'PUBLISHING_DISABLED',
      label: 'Publishing disabled',
      severity: 'blocking',
      description: 'Publishing remains disabled.',
      remediation: 'Do not enable publishing.',
    }),
  ];

  const totalRules = rules.length;
  const definedRules = rules.filter(rule => rule.status === 'defined').length;
  const blockedRules = rules.filter(rule => rule.status === 'blocked').length;
  const missingRules = rules.filter(rule => rule.status === 'missing').length;
  const blockingFailureCodeCount = failureCodes.filter(code => code.severity === 'blocking').length;
  const blockers = [
    ...approvalPayload.blockers,
    ...checklist.blockers,
    ...riskRegister.blockers,
    ...boundary.blockers,
    ...operatorQueue.blockers,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  const schema: BrainCoreVideoControlledExecutionPreflightValidatorSchema = {
    id: 'video-orchestrator-controlled-execution-preflight-validator-schema',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canRunValidator: false,
    canCreateApproval: false,
    canRegisterAction: false,
    canExecute: false,
    rules,
    failureCodes,
    summary: {
      totalRules,
      definedRules,
      blockedRules,
      missingRules,
      failureCodeCount: failureCodes.length,
      blockingFailureCodeCount,
    },
    blockers,
    nextSafeStep: 'Keep the preflight validator schema read-only until Phase 5D execution-plan stub is designed.',
    safety: {
      readOnly: true,
      runsValidator: false,
      createsApproval: false,
      registersAction: false,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { schema };
}
