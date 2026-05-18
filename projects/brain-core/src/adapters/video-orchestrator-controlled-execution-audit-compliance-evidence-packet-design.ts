import type {
  BrainCoreVideoControlledExecutionAuditComplianceEvidencePacket,
  BrainCoreVideoControlledExecutionAuditComplianceEvidencePacketResponse,
} from '../types/api.js';
import { readVideoControlledExecutionImmutableAuditTrailSchema } from './video-orchestrator-controlled-execution-immutable-audit-trail-schema.js';

const safety: BrainCoreVideoControlledExecutionAuditComplianceEvidencePacket['safety'] = {
  readOnly: true,
  packetDesignOnly: true,
  packetGenerationEnabled: false,
  evidenceCollectionEnabled: false,
  auditTrailPersistenceEnabled: false,
  readsGeneratedArtifacts: false,
  hashComputationEnabled: false,
  createsApproval: false,
  createsFirstApproval: false,
  createsSecondApproval: false,
  approvalExecutionEnabled: false,
  registersAction: false,
  registersAllowlist: false,
  runsValidator: false,
  createsExecutionPlan: false,
  executionPlanExecutable: false,
  executionEnabled: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  rendersVideo: false,
  exportsArtifacts: false,
  publishesContent: false,
  decommissionsStb: false,
  writesToMind: false,
};

export function readVideoControlledExecutionAuditComplianceEvidencePacket(): BrainCoreVideoControlledExecutionAuditComplianceEvidencePacketResponse {
  const auditTrail = readVideoControlledExecutionImmutableAuditTrailSchema().schema;

  const packetSections = [
    'candidate story lock evidence',
    'preflight evidence hash design',
    'operator decision snapshot',
    'approval review design',
    'immutable audit trail schema',
    'runtime sandbox boundary',
    'rollback cleanup checklist',
    'risk register',
    'policy boundary',
  ];

  const complianceRules = [
    'Packet is design-only',
    'No packet is generated',
    'No evidence is collected from files',
    'No audit trail is persisted',
    'No approval is created',
    'No execution is authorized',
    'No publishing or decommissioning allowed',
    'Packet references schema versions only, never real artifacts',
  ];

  const missingRequirements = [
    'No packet generation engine',
    'No evidence collection mechanism',
    'No evidence aggregation path',
    'No compliance report generation',
    'No packet persistence store',
    'No integrity verification mechanism',
    'No compliance auditor access control',
    'No evidence retention policy enforcement',
  ];

  const evidenceReferences = [
    '/video-orchestrator/controlled-execution-immutable-audit-trail-schema',
    '/video-orchestrator/controlled-execution-approval-review-audit-design',
    '/video-orchestrator/controlled-execution-operator-decision-snapshot-design',
    '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design',
    '/video-orchestrator/controlled-execution-risk-register',
  ];

  const blockers = [
    ...auditTrail.blockers,
    ...missingRequirements,
  ].filter((blocker, index, all) => all.indexOf(blocker) === index);

  return {
    packet: {
      id: 'video-orchestrator-controlled-execution-audit-compliance-evidence-packet-design',
      generatedAt: new Date().toISOString(),
      version: 'phase-5r',
      status: 'blocked',
      packetDesignExists: false,
      packetGenerationEnabled: false,
      evidenceCollectionEnabled: false,
      auditTrailPersistenceEnabled: false,
      approvalCreationEnabled: false,
      executionEnabled: false,
      executable: false,
      summary: {
        packetSectionCount: packetSections.length,
        complianceRuleCount: complianceRules.length,
        missingRequirementCount: missingRequirements.length,
        blockerCount: blockers.length,
      },
      packetSections,
      complianceRules,
      missingRequirements,
      evidenceReferences,
      blockers,
      nextSafeStep: 'Keep audit compliance evidence packet design read-only; do not generate packets or collect evidence.',
      safety,
    },
  };
}
