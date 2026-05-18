import type {
  BrainCoreVideoControlledExecutionApprovalPayloadField,
  BrainCoreVideoControlledExecutionApprovalPayloadSchema,
  BrainCoreVideoControlledExecutionApprovalPayloadSchemaResponse,
  BrainCoreVideoControlledExecutionApprovalPayloadSection,
} from '../types/api.js';
import { readVideoControlledExecutionPolicyBoundary } from './video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoControlledExecutionPreflightChecklist } from './video-orchestrator-controlled-execution-preflight-checklist.js';
import { readVideoControlledExecutionRiskRegister } from './video-orchestrator-controlled-execution-risk-register.js';
import { readVideoOperatorDecisionQueue } from './video-orchestrator-operator-decision-queue.js';
import { readVideoRoadmapCheckpoint } from './video-orchestrator-roadmap-checkpoint.js';
import { readVideoPreviewCompletionIndex } from './video-orchestrator-preview-completion-index.js';

const safety: BrainCoreVideoControlledExecutionApprovalPayloadField['safety'] = {
  readOnly: true,
  createsApproval: false,
  registersAction: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

function field(input: Omit<BrainCoreVideoControlledExecutionApprovalPayloadField, 'safety'>): BrainCoreVideoControlledExecutionApprovalPayloadField {
  return { ...input, safety };
}

function section(
  input: Omit<BrainCoreVideoControlledExecutionApprovalPayloadSection, 'safety'>,
): BrainCoreVideoControlledExecutionApprovalPayloadSection {
  return { ...input, safety };
}

export function readVideoControlledExecutionApprovalPayloadSchema(): BrainCoreVideoControlledExecutionApprovalPayloadSchemaResponse {
  const roadmap = readVideoRoadmapCheckpoint().checkpoint;
  const preview = readVideoPreviewCompletionIndex().index;
  const operatorQueue = readVideoOperatorDecisionQueue().queue;
  const boundary = readVideoControlledExecutionPolicyBoundary().boundary;
  const preflight = readVideoControlledExecutionPreflightChecklist().checklist;
  const riskRegister = readVideoControlledExecutionRiskRegister().register;

  const sections: BrainCoreVideoControlledExecutionApprovalPayloadSection[] = [
    section({
      id: 'payload-candidate-scope',
      label: 'Candidate scope',
      status: 'blocked',
      fields: [
        field({
          id: 'candidateStoryId',
          label: 'Candidate story ID',
          required: true,
          status: 'missing',
          fieldType: 'string',
          description: 'The single future story candidate that could be considered for controlled execution.',
          blockers: ['No candidate story has been approved'],
        }),
        field({
          id: 'sourceEpisodeId',
          label: 'Source episode ID',
          required: true,
          status: 'missing',
          fieldType: 'string',
          description: 'The source episode or content reference that the candidate story belongs to.',
          blockers: ['No source episode has been selected'],
        }),
        field({
          id: 'scopeType',
          label: 'Scope type',
          required: true,
          status: 'defined',
          fieldType: 'enum',
          description: 'The only permitted scope is a single-story-only controlled execution.',
          allowedValues: ['single-story-only'],
          blockers: [],
        }),
        field({
          id: 'batchExecution',
          label: 'Batch execution',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Batch execution must remain false.',
          allowedValues: ['false'],
          blockers: [],
        }),
      ],
      blockers: ['No candidate story selection exists', 'Batch execution is not permitted'],
    }),
    section({
      id: 'payload-operator-decision-references',
      label: 'Operator decision references',
      status: 'blocked',
      fields: [
        field({
          id: 'operatorDecisionQueueId',
          label: 'Operator decision queue ID',
          required: true,
          status: 'defined',
          fieldType: 'operator-decision-reference',
          description: 'Reference to the operator decision queue that informs controlled execution design.',
          blockers: [],
        }),
        field({
          id: 'selectedDecisionIds',
          label: 'Selected decision IDs',
          required: true,
          status: 'missing',
          fieldType: 'array',
          description: 'Decision IDs that must be explicitly selected before any future approval can be created.',
          blockers: ['No selected decision IDs exist'],
        }),
        field({
          id: 'operatorConfirmationRequired',
          label: 'Operator confirmation required',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Operator confirmation must be true for any future approval payload.',
          allowedValues: ['true'],
          blockers: [],
        }),
      ],
      blockers: operatorQueue.blockers,
    }),
    section({
      id: 'payload-evidence-references',
      label: 'Evidence references',
      status: 'defined',
      fields: [
        field({
          id: 'roadmapCheckpointEndpoint',
          label: 'Roadmap checkpoint endpoint',
          required: true,
          status: 'defined',
          fieldType: 'evidence-reference',
          description: 'Reference to the roadmap checkpoint endpoint that proves preview-only coverage.',
          blockers: [],
        }),
        field({
          id: 'readinessIndexEndpoint',
          label: 'Readiness index endpoint',
          required: true,
          status: 'defined',
          fieldType: 'evidence-reference',
          description: 'Reference to the controlled execution readiness index endpoint.',
          blockers: [],
        }),
        field({
          id: 'preflightChecklistEndpoint',
          label: 'Preflight checklist endpoint',
          required: true,
          status: 'defined',
          fieldType: 'evidence-reference',
          description: 'Reference to the controlled execution preflight checklist endpoint.',
          blockers: [],
        }),
        field({
          id: 'riskRegisterEndpoint',
          label: 'Risk register endpoint',
          required: true,
          status: 'defined',
          fieldType: 'evidence-reference',
          description: 'Reference to the controlled execution risk register endpoint.',
          blockers: [],
        }),
        field({
          id: 'rollbackChecklistEndpoint',
          label: 'Rollback checklist endpoint',
          required: true,
          status: 'defined',
          fieldType: 'evidence-reference',
          description: 'Reference to the rollback and cleanup checklist endpoint.',
          blockers: [],
        }),
        field({
          id: 'comparisonSchemaEndpoint',
          label: 'Comparison schema endpoint',
          required: true,
          status: 'defined',
          fieldType: 'evidence-reference',
          description: 'Reference to the comparison schema design endpoint.',
          blockers: [],
        }),
        field({
          id: 'previewCompletionEndpoint',
          label: 'Preview completion endpoint',
          required: true,
          status: 'defined',
          fieldType: 'evidence-reference',
          description: 'Reference to the preview completion index endpoint.',
          blockers: [],
        }),
      ],
      blockers: [],
    }),
    section({
      id: 'payload-safety-invariants',
      label: 'Safety invariants',
      status: 'defined',
      fields: [
        field({ id: 'executesStb', label: 'Executes STB', required: true, status: 'defined', fieldType: 'boolean', description: 'Must remain false.', allowedValues: ['false'], blockers: [] }),
        field({ id: 'executesVideo', label: 'Executes Video', required: true, status: 'defined', fieldType: 'boolean', description: 'Must remain false.', allowedValues: ['false'], blockers: [] }),
        field({ id: 'writesFiles', label: 'Writes files', required: true, status: 'defined', fieldType: 'boolean', description: 'Must remain false.', allowedValues: ['false'], blockers: [] }),
        field({ id: 'rendersVideo', label: 'Renders video', required: true, status: 'defined', fieldType: 'boolean', description: 'Must remain false.', allowedValues: ['false'], blockers: [] }),
        field({ id: 'publishesContent', label: 'Publishes content', required: true, status: 'defined', fieldType: 'boolean', description: 'Must remain false.', allowedValues: ['false'], blockers: [] }),
        field({ id: 'decommissionsStb', label: 'Decommissions STB', required: true, status: 'defined', fieldType: 'boolean', description: 'Must remain false.', allowedValues: ['false'], blockers: [] }),
        field({ id: 'writesToMind', label: 'Writes to Mind', required: true, status: 'defined', fieldType: 'boolean', description: 'Must remain false.', allowedValues: ['false'], blockers: [] }),
      ],
      blockers: ['Execution remains disabled', 'No runtime write path exists'],
    }),
    section({
      id: 'payload-expiry-audit',
      label: 'Expiry and audit',
      status: 'blocked',
      fields: [
        field({
          id: 'requestedAt',
          label: 'Requested at',
          required: true,
          status: 'missing',
          fieldType: 'timestamp',
          description: 'Timestamp for a future approval request.',
          blockers: ['No approval request can be created yet'],
        }),
        field({
          id: 'expiresAt',
          label: 'Expires at',
          required: true,
          status: 'missing',
          fieldType: 'timestamp',
          description: 'Expiry timestamp for an approval request or approval record.',
          blockers: ['No approval record exists'],
        }),
        field({
          id: 'durableAuditRequired',
          label: 'Durable audit required',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Durable audit is required for any future approval flow.',
          allowedValues: ['true'],
          blockers: [],
        }),
        field({
          id: 'auditEventTypes',
          label: 'Audit event types',
          required: true,
          status: 'missing',
          fieldType: 'array',
          description: 'Audit event types that must be persisted for future approval lifecycle events.',
          blockers: ['No audit event model is defined for approval execution'],
        }),
      ],
      blockers: ['No durable approval audit exists', 'No approval lifecycle exists'],
    }),
    section({
      id: 'payload-blockers',
      label: 'Blockers',
      status: 'blocked',
      fields: [
        field({
          id: 'approvalCreationBlocked',
          label: 'Approval creation blocked',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Approval creation remains blocked.',
          allowedValues: ['true'],
          blockers: [],
        }),
        field({
          id: 'actionRegistrationBlocked',
          label: 'Action registration blocked',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Action registration remains blocked.',
          allowedValues: ['true'],
          blockers: [],
        }),
        field({
          id: 'executionBlocked',
          label: 'Execution blocked',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Execution remains blocked.',
          allowedValues: ['true'],
          blockers: [],
        }),
        field({
          id: 'rollbackPolicyBlocked',
          label: 'Rollback policy blocked',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Rollback policy remains blocked until operator review is complete.',
          allowedValues: ['true'],
          blockers: [],
        }),
        field({
          id: 'artifactSandboxBlocked',
          label: 'Artifact sandbox blocked',
          required: true,
          status: 'defined',
          fieldType: 'boolean',
          description: 'Artifact sandbox approval remains blocked.',
          allowedValues: ['true'],
          blockers: [],
        }),
      ],
      blockers: [
        ...preflight.blockers,
        ...riskRegister.blockers,
        ...boundary.blockers,
        ...roadmap.blockers,
        ...preview.blockers,
      ],
    }),
  ];

  const fields = sections.flatMap(section => section.fields);
  const requiredFieldCount = fields.filter(field => field.required).length;
  const blockedFieldCount = fields.filter(field => field.status === 'blocked').length;
  const missingFieldCount = fields.filter(field => field.status === 'missing').length;
  const blockers = sections.flatMap(section => section.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const schema: BrainCoreVideoControlledExecutionApprovalPayloadSchema = {
    id: 'video-orchestrator-controlled-execution-approval-payload-schema',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canCreateApproval: false,
    canRegisterAction: false,
    canExecute: false,
    sections,
    summary: {
      totalSections: sections.length,
      totalFields: fields.length,
      requiredFieldCount,
      blockedFieldCount,
      missingFieldCount,
    },
    blockers,
    nextSafeStep: 'Keep the approval payload schema read-only until Phase 5C preflight validation is designed.',
    safety: {
      readOnly: true,
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
