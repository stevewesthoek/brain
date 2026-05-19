import type { IncomingMessage, ServerResponse } from 'node:http';
import { decideApproval, getApprovalRecord, getApprovalStoreSummary, listApprovalAuditEvents, requestAction, getApprovalAuditEvents } from '../adapters/actions.js';
import { getExecutionPlan, getExecutionReadiness, getMindPreviewPolicy, listExecutionPlans } from '../adapters/execution-plans.js';
import { listApprovals } from '../adapters/approvals.js';
import { getCapabilities } from '../adapters/capabilities.js';
import { getOrchestrator, listOrchestrators } from '../adapters/orchestrators.js';
import { getPipeline, listPipelines } from '../adapters/pipelines.js';
import { getProject, listProjects } from '../adapters/projects.js';
import { getPlatform, listPlatforms } from '../adapters/platforms.js';
import {
  readPostOrchestratorDraftFixtures,
  readPostDraftReviewQueue,
  readPostOrchestratorContracts,
  readPostOrchestratorDryRunPlan,
  readPostOrchestratorEventFixtures,
  readPostOrchestratorFlowFixtures,
  readPostOrchestratorIntegrations,
  readPostOrchestratorRecovery,
  readPostOrchestratorStatus,
  readPostOrchestratorOverview,
  readPostAnalyticsFixtures,
  readPostDecommissionReadiness,
  readPostAcceptanceChecklist,
  readPostMigrationParityReport,
  readPostRoadmapCheckpoint,
  readPostPlatformPolicies,
  readPostManualExportPackage,
  readPostOperatorGuidance,
  readPostPipelineSummary,
  readPostSchedulePreviewQueue,
  readPostReadinessScore,
  readPostQaStatus,
  requestPostDraftReviewApproval,
  requestPostSchedulePreviewApproval,
} from '../adapters/post-orchestrator.js';
import {
  listLocalApps,
  readLocalAppsActionPlan,
  readLocalAppsActionPlans,
  readLocalAppsActionReadiness,
  readLocalAppsDashboard,
  readLocalAppsOnboardingChecklist,
  readLocalAppsOrchestratorStatus,
} from '../adapters/local-apps.js';
import { readProBotDashboardParity } from '../adapters/probot-dashboard-parity.js';
import { readProBotSessionsParity } from '../adapters/probot-sessions-parity.js';
import { readProBotLocalAppsParity } from '../adapters/probot-local-apps-parity.js';
import { readProBotSchedulerParity } from '../adapters/probot-scheduler-parity.js';
import { readProBotStudioParity } from '../adapters/probot-studio-parity.js';
import { readProBotExternalAdminParity } from '../adapters/probot-external-admin-parity.js';
import { readProBotDecommissionReadiness } from '../adapters/probot-decommission-readiness.js';
import { readProBotExternalAdminSafeMetadata } from '../adapters/probot-external-admin-safe-metadata.js';
import { readProBotFeatureParityMatrix } from '../adapters/probot-feature-parity-matrix.js';
import { readProBotPhaseOutChecklist } from '../adapters/probot-phase-out-checklist.js';
import {
  listMindPreviewSummaries,
  readLatestMindPreviewDetail,
  readMindPreviewDetailById,
} from '../adapters/preview-artifacts.js';
import {
  listMaintenancePreviewSummaries,
  readLatestMaintenancePreviewDetail,
  readMaintenancePreviewDetailById,
} from '../adapters/maintenance-previews.js';
import { listRuntimeReports } from '../adapters/runtime-reports.js';
import { listRepos } from '../adapters/repos.js';
import { getSchedulerLatestRun, getSchedulerStatus, listSchedulerJobs } from '../adapters/scheduler.js';
import { listSessions } from '../adapters/sessions.js';
import { listSkills } from '../adapters/skills.js';
import { getVideoStatus, listVideoQueue } from '../adapters/video.js';
import { getStbPipelineStatus } from '../adapters/stb-status.js';
import { getVideoOrchestratorStatus } from '../adapters/video-orchestrator-status.js';
import { getVideoOrchestratorIntake, getVideoOrchestratorIntakePlan } from '../adapters/video-orchestrator-intake.js';
import { getVideoOrchestratorResearch, getVideoOrchestratorResearchPlan } from '../adapters/video-orchestrator-research.js';
import { getVideoOrchestratorScript, getVideoOrchestratorScriptPlan } from '../adapters/video-orchestrator-script.js';
import { readVideoAssetPlans, readVideoAssetPlan } from '../adapters/video-orchestrator-asset-plan.js';
import { readVideoDesignPlans, readVideoDesignPlan } from '../adapters/video-orchestrator-design-plan.js';
import { readVideoVoiceoverPlans, readVideoVoiceoverPlan } from '../adapters/video-orchestrator-voiceover-plan.js';
import { readVideoVisualsPlans, readVideoVisualsPlan } from '../adapters/video-orchestrator-visuals-plan.js';
import { readVideoAssemblyPlans, readVideoAssemblyPlan } from '../adapters/video-orchestrator-assembly-plan.js';
import { readVideoMetadataPlans, readVideoMetadataPlan } from '../adapters/video-orchestrator-metadata-plan.js';
import { readVideoPublishingPrepPlans, readVideoPublishingPrepPlan } from '../adapters/video-orchestrator-publishing-prep.js';
import { readVideoThumbnailDesignPlans, readVideoThumbnailDesignPlan } from '../adapters/video-orchestrator-thumbnail-design-plan.js';
import { readVideoArchiveLoggingPlans, readVideoArchiveLoggingPlan } from '../adapters/video-orchestrator-archive-logging-plan.js';
import { readVideoDesignProviderBoundaryPlans, readVideoDesignProviderBoundaryPlan } from '../adapters/video-orchestrator-design-provider-boundary-plan.js';
import { readVideoDesignProviderCredentialIsolationPlans, readVideoDesignProviderCredentialIsolationPlan } from '../adapters/video-orchestrator-design-provider-credential-isolation-plan.js';
import { readVideoDesignProviderPromptReviewPolicyPlans, readVideoDesignProviderPromptReviewPolicyPlan } from '../adapters/video-orchestrator-design-provider-prompt-review-policy-plan.js';
import { readVideoArtifactSandboxProviderHandoffPlans, readVideoArtifactSandboxProviderHandoffPlan } from '../adapters/video-orchestrator-artifact-sandbox-provider-handoff-plan.js';
import { readVideoProviderOutputRedactionPolicyPlans, readVideoProviderOutputRedactionPolicyPlan } from '../adapters/video-orchestrator-provider-output-redaction-policy-plan.js';
import { readVideoDesignProviderComplianceChecklistPlans, readVideoDesignProviderComplianceChecklistPlan } from '../adapters/video-orchestrator-design-provider-compliance-checklist-plan.js';
import { readVideoDesignProviderEnablementReadinessIndex, readVideoDesignProviderEnablementReadinessIndexEntry } from '../adapters/video-orchestrator-design-provider-enablement-readiness-index.js';
import { readVideoProviderIntegrationFinalPlanningCheckpoint, readVideoProviderIntegrationFinalPlanningCheckpointEntry } from '../adapters/video-orchestrator-provider-integration-final-planning-checkpoint.js';
import { readVideoProviderRequestWrapperImplementationPlan, readVideoProviderRequestWrapperImplementationPlanEntry } from '../adapters/video-orchestrator-provider-request-wrapper-implementation-plan.js';
import { readVideoCredentialStoreImplementationBoundaryPlan, readVideoCredentialStoreImplementationBoundaryPlanEntry } from '../adapters/video-orchestrator-credential-store-implementation-boundary-plan.js';
import { readVideoPromptReviewUxImplementationPlan, readVideoPromptReviewUxImplementationPlanEntry } from '../adapters/video-orchestrator-prompt-review-ux-implementation-plan.js';
import { readVideoProviderAuditPersistenceBoundaryPlan, readVideoProviderAuditPersistenceBoundaryPlanEntry } from '../adapters/video-orchestrator-provider-audit-persistence-boundary-plan.js';
import { readVideoProviderWrapperSecurityReviewPlan, readVideoProviderWrapperSecurityReviewPlanEntry } from '../adapters/video-orchestrator-provider-wrapper-security-review-plan.js';
import { readVideoProviderImplementationPhaseStartGate, readVideoProviderImplementationPhaseStartGateEntry } from '../adapters/video-orchestrator-provider-implementation-phase-start-gate.js';
import { readVideoProviderImplementationReadinessDashboardSummary, readVideoProviderImplementationReadinessDashboardSummaryEntry } from '../adapters/video-orchestrator-provider-implementation-readiness-dashboard-summary.js';
import { readVideoProviderImplementationApprovalPacket, readVideoProviderImplementationApprovalPacketEntry } from '../adapters/video-orchestrator-provider-implementation-approval-packet.js';
import { readVideoProviderApprovalPacketConsoleReviewSummary, readVideoProviderApprovalPacketConsoleReviewSummaryEntry } from '../adapters/video-orchestrator-provider-approval-packet-console-review-summary.js';
import { readVideoProviderPlanningSurfaceIndex } from '../adapters/video-orchestrator-provider-planning-surface-index.js';
import { readVideoProviderRequestWrapperScaffold } from '../adapters/video-orchestrator-provider-request-wrapper-scaffold.js';
import { readVideoProviderWrapperValidationHarness } from '../adapters/video-orchestrator-provider-wrapper-validation-harness.js';
import { readVideoCredentialReferenceScaffold } from '../adapters/video-orchestrator-credential-reference-scaffold.js';
import { readVideoProviderRequestEnvelopeScaffold } from '../adapters/video-orchestrator-provider-request-envelope-scaffold.js';
import { readVideoProviderResponseEnvelopeScaffold } from '../adapters/video-orchestrator-provider-response-envelope-scaffold.js';
import { readVideoProviderScaffoldingIntegrationSummary } from '../adapters/video-orchestrator-provider-scaffolding-integration-summary.js';
import { readVideoProviderRequestWrapperInertShellStatus } from '../adapters/video-orchestrator-provider-request-wrapper-inert-shell.js';
import { readVideoCredentialReferenceValidatorStatus } from '../adapters/video-orchestrator-credential-reference-validator.js';
import { readVideoProviderResponseRedactionSkeletonStatus } from '../adapters/video-orchestrator-provider-response-redaction-skeleton.js';
import { readVideoProviderAuditEventTypes } from '../adapters/video-orchestrator-provider-audit-event-types.js';
import { readVideoProviderDisabledOrchestrationFacadeStatus } from '../adapters/video-orchestrator-provider-disabled-orchestration-facade.js';
import { readVideoProviderCapabilityPolicyEvaluatorStatus } from '../adapters/video-orchestrator-provider-capability-policy-evaluator.js';
import { readVideoProviderBlockedActionLedgerTypes } from '../adapters/video-orchestrator-provider-blocked-action-ledger-types.js';
import { readVideoProviderDisabledOrchestrationIntegrationSummary } from '../adapters/video-orchestrator-provider-disabled-orchestration-integration-summary.js';
import { readVideoProviderBlockedActionRecorderSkeletonStatus } from '../adapters/video-orchestrator-provider-blocked-action-recorder-skeleton.js';
import { readVideoProviderFixtureOrchestrationTestsSummary } from '../adapters/video-orchestrator-provider-fixture-orchestration-tests-summary.js';
import { readVideoProviderSafetyRegressionIndex } from '../adapters/video-orchestrator-provider-safety-regression-index.js';
import { readVideoProviderScaffoldingCompletionCheckpoint } from '../adapters/video-orchestrator-provider-scaffolding-completion-checkpoint.js';
import { readVideoManualExportPackages, readVideoManualExportPackage } from '../adapters/video-orchestrator-manual-export-package.js';
import { getStbVideoMigrationStatus } from '../adapters/stb-video-migration.js';
import { getStbVideoParityMatrix, getStbVideoDualRunStatus } from '../adapters/stb-video-parity.js';
import { readStbVideoDualRunEvidence } from '../adapters/stb-video-dual-run-evidence.js';
import { readVideoProductionGate } from '../adapters/video-orchestrator-production-gate.js';
import { readControlledDualRunRequestDesign } from '../adapters/stb-video-controlled-dual-run-request.js';
import { readVideoRenderExportPolicy } from '../adapters/video-orchestrator-render-export-policy.js';
import { readVideoApprovalPolicyDesign } from '../adapters/video-orchestrator-approval-policy-design.js';
import { readVideoArtifactSandboxDesign } from '../adapters/video-orchestrator-artifact-sandbox-design.js';
import { readVideoControlledDryRunDesign } from '../adapters/video-orchestrator-controlled-dry-run-design.js';
import { readVideoRollbackCleanupChecklist } from '../adapters/video-orchestrator-rollback-cleanup-checklist.js';
import { readVideoComparisonSchemaDesign } from '../adapters/video-orchestrator-comparison-schema-design.js';
import { readVideoFixtureComparisonPreview } from '../adapters/video-orchestrator-fixture-comparison-preview.js';
import { readVideoProductionCutoverGate } from '../adapters/video-orchestrator-production-cutover-gate.js';
import { readVideoReleaseCandidateReadiness } from '../adapters/video-orchestrator-release-candidate-readiness.js';
import { readVideoOperatorDecisionQueue } from '../adapters/video-orchestrator-operator-decision-queue.js';
import { readVideoControlledExecutionPolicyBoundary } from '../adapters/video-orchestrator-controlled-execution-policy-boundary.js';
import { readVideoControlledExecutionReadinessIndex } from '../adapters/video-orchestrator-controlled-execution-readiness-index.js';
import { readVideoControlledExecutionApprovalPayloadSchema } from '../adapters/video-orchestrator-controlled-execution-approval-payload-schema.js';
import { readVideoControlledExecutionApprovalRequestDesign } from '../adapters/video-orchestrator-controlled-execution-approval-request-design.js';
import { readVideoControlledExecutionDisabledGate } from '../adapters/video-orchestrator-controlled-execution-disabled-gate.js';
import { readVideoControlledExecutionPreflightValidatorSchema } from '../adapters/video-orchestrator-controlled-execution-preflight-validator-schema.js';
import { readVideoControlledExecutionPlanStub } from '../adapters/video-orchestrator-controlled-execution-plan-stub.js';
import { readVideoRoadmapCheckpoint } from '../adapters/video-orchestrator-roadmap-checkpoint.js';
import { readVideoOperatorReviewPacket } from '../adapters/video-orchestrator-operator-review-packet.js';
import { readVideoPreviewCompletionIndex } from '../adapters/video-orchestrator-preview-completion-index.js';
import { readVideoControlledExecutionPreflightChecklist } from '../adapters/video-orchestrator-controlled-execution-preflight-checklist.js';
import { readVideoControlledExecutionRiskRegister } from '../adapters/video-orchestrator-controlled-execution-risk-register.js';
import { readVideoControlledExecutionSecondApprovalPolicy } from '../adapters/video-orchestrator-controlled-execution-second-approval-policy.js';
import { readVideoControlledExecutionOperatorIdentityProtocol } from '../adapters/video-orchestrator-controlled-execution-operator-identity-protocol.js';
import { readVideoControlledExecutionRolePolicy } from '../adapters/video-orchestrator-controlled-execution-role-policy.js';
import { readVideoControlledExecutionFirstApprovalAuthorityPolicy } from '../adapters/video-orchestrator-controlled-execution-first-approval-authority-policy.js';
import { readVideoControlledExecutionFirstApprovalAuditExpiryModel } from '../adapters/video-orchestrator-controlled-execution-first-approval-audit-expiry-model.js';
import { readVideoControlledExecutionCandidateStoryLock } from '../adapters/video-orchestrator-controlled-execution-candidate-story-lock.js';
import { readVideoControlledExecutionPreflightEvidenceHashDesign } from '../adapters/video-orchestrator-controlled-execution-preflight-evidence-hash-design.js';
import { readVideoControlledExecutionOperatorDecisionSnapshotDesign } from '../adapters/video-orchestrator-controlled-execution-operator-decision-snapshot-design.js';
import { readVideoControlledExecutionRuntimeSandboxBoundaryDesign } from '../adapters/video-orchestrator-controlled-execution-runtime-sandbox-boundary-design.js';
import { readVideoControlledExecutionApprovalReviewAudit } from '../adapters/video-orchestrator-controlled-execution-approval-review-audit-design.js';
import { readVideoControlledExecutionImmutableAuditTrailSchema } from '../adapters/video-orchestrator-controlled-execution-immutable-audit-trail-schema.js';
import { readVideoControlledExecutionAuditComplianceEvidencePacket } from '../adapters/video-orchestrator-controlled-execution-audit-compliance-evidence-packet-design.js';
import { readVideoControlledExecutionImplementationReadinessCheckpoint } from '../adapters/video-orchestrator-controlled-execution-implementation-readiness-checkpoint.js';
import { readVideoControlledExecutionFeatureFlagRolloutPlan } from '../adapters/video-orchestrator-controlled-execution-feature-flag-rollout-plan.js';
import { readVideoControlledExecutionApprovalStoreImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-approval-store-implementation-plan.js';
import { readVideoControlledExecutionFirstApprovalCreationImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-first-approval-creation-implementation-plan.js';
import { readVideoControlledExecutionSecondApprovalCreationImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-second-approval-creation-implementation-plan.js';
import { readVideoControlledExecutionValidatorImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-validator-implementation-plan.js';
import { readVideoControlledExecutionExecutionPlanImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-execution-plan-implementation-plan.js';
import { readVideoControlledExecutionRollbackCleanupImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-rollback-cleanup-implementation-plan.js';
import { readVideoControlledExecutionSandboxProvisioningImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-sandbox-provisioning-implementation-plan.js';
import { readVideoControlledExecutionSandboxExecutionImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-sandbox-execution-implementation-plan.js';
import { readVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-sandbox-teardown-recovery-implementation-plan.js';
import { readVideoControlledExecutionArtifactPolicyImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-artifact-policy-implementation-plan.js';
import { readVideoControlledExecutionSTBProtectionDecommissionPreventionPlan } from '../adapters/video-orchestrator-controlled-execution-stb-protection-decommission-prevention-plan.js';
import { readVideoControlledExecutionImplementationCompletionReadinessCheckpoint } from '../adapters/video-orchestrator-controlled-execution-implementation-completion-readiness-checkpoint.js';
import { readVideoControlledExecutionOperatorUXConsoleControlsImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-operator-ux-console-controls-implementation-plan.js';
import { readVideoControlledExecutionSecurityReviewThreatModelingImplementationPlan } from '../adapters/video-orchestrator-controlled-execution-security-review-threat-modeling-implementation-plan.js';
import { readVideoControlledExecutionImplementationApprovalPacketStartGate } from '../adapters/video-orchestrator-controlled-execution-implementation-approval-packet-start-gate.js';
import { getAgent, listAgents } from '../adapters/agents.js';
import { getActionSummary, listActionSummaries, requestActionApprovalById } from '../adapters/action-registry.js';
import { listAgentRuns, getAgentRun, listAgentEvents, listRecoveryItems, getRecoveryItem } from '../adapters/agent-runs.js';
import { createStatusAdapter } from '../adapters/status.js';
import { isLocalRequest } from '../security/localhost.js';
import { redactingJsonReplacer } from '../security/redaction.js';
import type { BrainCoreErrorResponse } from '../types/api.js';

const getStatus = createStatusAdapter({
  startedAt: new Date(),
  version: '0.1.0',
});

export async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, {
      error: {
        code: 'forbidden_non_local_request',
        message: 'Brain Core Phase 1 only accepts localhost requests.',
      },
    } satisfies BrainCoreErrorResponse);
    return;
  }

  const method = request.method || 'GET';
  const url = new URL(request.url || '/', 'http://127.0.0.1');

  if (method === 'POST') {
    routePostRequest(url, response);
    return;
  }

  if (method !== 'GET') {
    sendJson(response, 405, {
      error: {
        code: 'method_not_allowed',
        message: 'Brain Core supports GET plus approval-aware POST request/decision endpoints only.',
      },
    } satisfies BrainCoreErrorResponse);
    return;
  }

  switch (url.pathname) {
    case '/status':
      sendJson(response, 200, getStatus());
      return;
    case '/sessions':
      sendJson(response, 200, { sessions: listSessions() });
      return;
    case '/skills':
      sendJson(response, 200, { skills: listSkills() });
      return;
    case '/repos':
      sendJson(response, 200, { repos: listRepos() });
      return;
    case '/orchestrators':
      sendJson(response, 200, { orchestrators: listOrchestrators() });
      return;
    case '/pipelines':
      sendJson(response, 200, { pipelines: listPipelines() });
      return;
    case '/projects':
      sendJson(response, 200, { projects: listProjects() });
      return;
    case '/platforms':
      sendJson(response, 200, { platforms: listPlatforms() });
      return;
    case '/post-orchestrator/status':
      sendJson(response, 200, readPostOrchestratorStatus());
      return;
    case '/post-orchestrator/overview':
      sendJson(response, 200, readPostOrchestratorOverview());
      return;
    case '/post-orchestrator/contracts':
      sendJson(response, 200, readPostOrchestratorContracts());
      return;
    case '/post-orchestrator/flows':
      sendJson(response, 200, readPostOrchestratorFlowFixtures());
      return;
    case '/post-orchestrator/drafts':
      sendJson(response, 200, readPostOrchestratorDraftFixtures());
      return;
    case '/post-orchestrator/events':
      sendJson(response, 200, readPostOrchestratorEventFixtures());
      return;
    case '/post-orchestrator/integrations':
      sendJson(response, 200, readPostOrchestratorIntegrations());
      return;
    case '/post-orchestrator/recovery':
      sendJson(response, 200, readPostOrchestratorRecovery());
      return;
    case '/post-orchestrator/analytics':
      sendJson(response, 200, readPostAnalyticsFixtures());
      return;
    case '/post-orchestrator/platform-policies':
      sendJson(response, 200, readPostPlatformPolicies());
      return;
    case '/post-orchestrator/decommission-readiness':
      sendJson(response, 200, readPostDecommissionReadiness());
      return;
    case '/post-orchestrator/operator-guidance':
      sendJson(response, 200, readPostOperatorGuidance());
      return;
    case '/post-orchestrator/acceptance-checklist':
      sendJson(response, 200, readPostAcceptanceChecklist());
      return;
    case '/post-orchestrator/migration-parity':
      sendJson(response, 200, readPostMigrationParityReport());
      return;
    case '/post-orchestrator/roadmap-checkpoint':
      sendJson(response, 200, readPostRoadmapCheckpoint());
      return;
    case '/post-orchestrator/qa-status':
      sendJson(response, 200, readPostQaStatus());
      return;
    case '/post-orchestrator/pipeline':
      sendJson(response, 400, {
        error: {
          code: 'missing_event_id',
          message: 'Pipeline summary requires /post-orchestrator/pipeline/:eventId.',
        },
      } satisfies BrainCoreErrorResponse);
      return;
    case '/post-orchestrator/readiness':
      sendJson(response, 400, {
        error: {
          code: 'missing_event_id',
          message: 'Readiness requires /post-orchestrator/readiness/:eventId.',
        },
      } satisfies BrainCoreErrorResponse);
      return;
    case '/post-orchestrator/manual-export':
      sendJson(response, 400, {
        error: {
          code: 'missing_event_id',
          message: 'Manual export requires /post-orchestrator/manual-export/:eventId.',
        },
      } satisfies BrainCoreErrorResponse);
      return;
    case '/post-orchestrator/review-queue':
      sendJson(response, 400, {
        error: {
          code: 'missing_event_id',
          message: 'Review queue requires /post-orchestrator/review-queue/:eventId.',
        },
      } satisfies BrainCoreErrorResponse);
      return;
    case '/post-orchestrator/schedule-preview':
      sendJson(response, 400, {
        error: {
          code: 'missing_event_id',
          message: 'Schedule preview requires /post-orchestrator/schedule-preview/:eventId.',
        },
      } satisfies BrainCoreErrorResponse);
      return;
    case '/stb/status':
      sendJson(response, 200, getStbPipelineStatus());
      return;
    case '/video-orchestrator/status':
      sendJson(response, 200, getVideoOrchestratorStatus());
      return;
    case '/video-orchestrator/intake':
      sendJson(response, 200, getVideoOrchestratorIntake());
      return;
    case '/video-orchestrator/thumbnail-design':
      sendJson(response, 200, readVideoThumbnailDesignPlans());
      return;
    case '/video-orchestrator/archive-logging-plan':
      sendJson(response, 200, readVideoArchiveLoggingPlans());
      return;
    case '/video-orchestrator/design-provider-boundary-plan':
      sendJson(response, 200, readVideoDesignProviderBoundaryPlans());
      return;
    case '/video-orchestrator/design-provider-credential-isolation-plan':
      sendJson(response, 200, readVideoDesignProviderCredentialIsolationPlans());
      return;
    case '/video-orchestrator/design-provider-prompt-review-policy-plan':
      sendJson(response, 200, readVideoDesignProviderPromptReviewPolicyPlans());
      return;
    case '/video-orchestrator/artifact-sandbox-provider-handoff-plan':
      sendJson(response, 200, readVideoArtifactSandboxProviderHandoffPlans());
      return;
    case '/video-orchestrator/provider-output-redaction-policy-plan':
      sendJson(response, 200, readVideoProviderOutputRedactionPolicyPlans());
      return;
    case '/video-orchestrator/design-provider-compliance-checklist-plan':
      sendJson(response, 200, readVideoDesignProviderComplianceChecklistPlans());
      return;
    case '/video-orchestrator/design-provider-enablement-readiness-index':
      sendJson(response, 200, readVideoDesignProviderEnablementReadinessIndex());
      return;
    case '/video-orchestrator/provider-integration-final-planning-checkpoint':
      sendJson(response, 200, readVideoProviderIntegrationFinalPlanningCheckpoint());
      return;
    case '/video-orchestrator/provider-request-wrapper-implementation-plan':
      sendJson(response, 200, readVideoProviderRequestWrapperImplementationPlan());
      return;
    case '/video-orchestrator/credential-store-implementation-boundary-plan':
      sendJson(response, 200, readVideoCredentialStoreImplementationBoundaryPlan());
      return;
    case '/video-orchestrator/prompt-review-ux-implementation-plan':
      sendJson(response, 200, readVideoPromptReviewUxImplementationPlan());
      return;
    case '/video-orchestrator/provider-audit-persistence-boundary-plan':
      sendJson(response, 200, readVideoProviderAuditPersistenceBoundaryPlan());
      return;
    case '/video-orchestrator/provider-wrapper-security-review-plan':
      sendJson(response, 200, readVideoProviderWrapperSecurityReviewPlan());
      return;
    case '/video-orchestrator/provider-implementation-phase-start-gate':
      sendJson(response, 200, readVideoProviderImplementationPhaseStartGate());
      return;
    case '/video-orchestrator/provider-implementation-readiness-dashboard-summary':
      sendJson(response, 200, readVideoProviderImplementationReadinessDashboardSummary());
      return;
    case '/video-orchestrator/provider-implementation-approval-packet':
      sendJson(response, 200, readVideoProviderImplementationApprovalPacket());
      return;
    case '/video-orchestrator/provider-approval-packet-console-review-summary':
      sendJson(response, 200, readVideoProviderApprovalPacketConsoleReviewSummary());
      return;
    case '/video-orchestrator/provider-planning-surface-index':
      sendJson(response, 200, readVideoProviderPlanningSurfaceIndex());
      return;
    case '/video-orchestrator/provider-request-wrapper-scaffold':
      sendJson(response, 200, readVideoProviderRequestWrapperScaffold());
      return;
    case '/video-orchestrator/provider-wrapper-validation-harness':
      sendJson(response, 200, readVideoProviderWrapperValidationHarness());
      return;
    case '/video-orchestrator/credential-reference-scaffold':
      sendJson(response, 200, readVideoCredentialReferenceScaffold());
      return;
    case '/video-orchestrator/provider-request-envelope-scaffold':
      sendJson(response, 200, readVideoProviderRequestEnvelopeScaffold());
      return;
    case '/video-orchestrator/provider-response-envelope-scaffold':
      sendJson(response, 200, readVideoProviderResponseEnvelopeScaffold());
      return;
    case '/video-orchestrator/provider-scaffolding-integration-summary':
      sendJson(response, 200, readVideoProviderScaffoldingIntegrationSummary());
      return;
    case '/video-orchestrator/provider-request-wrapper-inert-shell':
      sendJson(response, 200, readVideoProviderRequestWrapperInertShellStatus());
      return;
    case '/video-orchestrator/credential-reference-validator':
      sendJson(response, 200, readVideoCredentialReferenceValidatorStatus());
      return;
    case '/video-orchestrator/provider-response-redaction-skeleton':
      sendJson(response, 200, readVideoProviderResponseRedactionSkeletonStatus());
      return;
    case '/video-orchestrator/provider-audit-event-types':
      sendJson(response, 200, readVideoProviderAuditEventTypes());
      return;
    case '/video-orchestrator/provider-disabled-orchestration-facade':
      sendJson(response, 200, readVideoProviderDisabledOrchestrationFacadeStatus());
      return;
    case '/video-orchestrator/provider-capability-policy-evaluator':
      sendJson(response, 200, readVideoProviderCapabilityPolicyEvaluatorStatus());
      return;
    case '/video-orchestrator/provider-blocked-action-ledger-types':
      sendJson(response, 200, readVideoProviderBlockedActionLedgerTypes());
      return;
    case '/video-orchestrator/provider-disabled-orchestration-integration-summary':
      sendJson(response, 200, readVideoProviderDisabledOrchestrationIntegrationSummary());
      return;
    case '/video-orchestrator/provider-blocked-action-recorder-skeleton':
      sendJson(response, 200, readVideoProviderBlockedActionRecorderSkeletonStatus());
      return;
    case '/video-orchestrator/provider-fixture-orchestration-tests-summary':
      sendJson(response, 200, readVideoProviderFixtureOrchestrationTestsSummary());
      return;
    case '/video-orchestrator/provider-safety-regression-index':
      sendJson(response, 200, readVideoProviderSafetyRegressionIndex());
      return;
    case '/video-orchestrator/provider-scaffolding-completion-checkpoint':
      sendJson(response, 200, readVideoProviderScaffoldingCompletionCheckpoint());
      return;
    case '/stb-video-migration/status':
      sendJson(response, 200, getStbVideoMigrationStatus());
      return;
    case '/stb-video/parity-matrix':
      sendJson(response, 200, getStbVideoParityMatrix());
      return;
    case '/stb-video/dual-run-status':
      sendJson(response, 200, getStbVideoDualRunStatus());
      return;
    case '/stb-video/dual-run-evidence':
      sendJson(response, 200, readStbVideoDualRunEvidence());
      return;
    case '/stb-video/controlled-dual-run-request':
      sendJson(response, 200, readControlledDualRunRequestDesign());
      return;
    case '/agents':
      sendJson(response, 200, { agents: listAgents() });
      return;
    case '/agent-runs':
      sendJson(response, 200, { runs: listAgentRuns() });
      return;
    case '/agent-events':
      sendJson(response, 200, { events: listAgentEvents() });
      return;
    case '/approval-audit':
      sendJson(response, 200, { events: listApprovalAuditEvents() });
      return;
    case '/recovery':
      sendJson(response, 200, { items: listRecoveryItems() });
      return;
    case '/capabilities':
      sendJson(response, 200, getCapabilities());
      return;
    case '/scheduler/status':
      sendJson(response, 200, getSchedulerStatus());
      return;
    case '/scheduler/latest-run':
      sendJson(response, 200, getSchedulerLatestRun());
      return;
    case '/scheduler/jobs':
      sendJson(response, 200, { jobs: listSchedulerJobs() });
      return;
    case '/local-apps':
      sendJson(response, 200, { apps: listLocalApps() });
      return;
    case '/local-apps/dashboard':
      sendJson(response, 200, await readLocalAppsDashboard());
      return;
    case '/local-apps/action-readiness':
      sendJson(response, 200, readLocalAppsActionReadiness());
      return;
    case '/local-apps/orchestrator':
      sendJson(response, 200, readLocalAppsOrchestratorStatus());
      return;
    case '/local-apps/onboarding-checklist':
      sendJson(response, 200, readLocalAppsOnboardingChecklist());
      return;
    case '/local-apps/action-plans':
      sendJson(response, 200, readLocalAppsActionPlans());
      return;
    case '/probot/dashboard-parity':
      sendJson(response, 200, readProBotDashboardParity());
      return;
    case '/probot/sessions-parity':
      sendJson(response, 200, readProBotSessionsParity());
      return;
    case '/probot/local-apps-parity':
      sendJson(response, 200, readProBotLocalAppsParity());
      return;
    case '/probot/scheduler-parity':
      sendJson(response, 200, readProBotSchedulerParity());
      return;
    case '/probot/studio-parity':
      sendJson(response, 200, readProBotStudioParity());
      return;
    case '/probot/external-admin-parity':
      sendJson(response, 200, readProBotExternalAdminParity());
      return;
    case '/probot/decommission-readiness':
      sendJson(response, 200, readProBotDecommissionReadiness());
      return;
    case '/probot/external-admin-safe-metadata':
      sendJson(response, 200, readProBotExternalAdminSafeMetadata());
      return;
    case '/probot/feature-parity-matrix':
      sendJson(response, 200, readProBotFeatureParityMatrix());
      return;
    case '/probot/phase-out-checklist':
      sendJson(response, 200, readProBotPhaseOutChecklist());
      return;
    case '/video/status':
      sendJson(response, 200, getVideoStatus());
      return;
    case '/video/queue':
      sendJson(response, 200, { queue: listVideoQueue() });
      return;
    case '/actions':
      sendJson(response, 200, { actions: listActionSummaries() });
      return;
    case '/approvals':
      sendJson(response, 200, { approvals: listApprovals() });
      return;
    case '/approvals/store':
      sendJson(response, 200, getApprovalStoreSummary());
      return;
    case '/execution/plans':
      sendJson(response, 200, { plans: listExecutionPlans() });
      return;
    case '/execution/readiness':
      sendJson(response, 200, getExecutionReadiness());
      return;
    case '/execution/mind-preview-policy':
      sendJson(response, 200, getMindPreviewPolicy());
      return;
    case '/execution/mind-previews':
      sendJson(response, 200, { previews: listMindPreviewSummaries() });
      return;
    case '/execution/mind-previews/latest':
      {
        const preview = readLatestMindPreviewDetail();
        sendJson(response, 200, preview ? { status: 'available', preview } : { status: 'empty' });
        return;
      }
    case '/execution/maintenance-previews':
      sendJson(response, 200, { previews: listMaintenancePreviewSummaries() });
      return;
    case '/execution/maintenance-previews/latest':
      {
        const preview = readLatestMaintenancePreviewDetail();
        sendJson(response, 200, preview ? { status: 'available', preview } : { status: 'empty' });
        return;
      }
    case '/approvals/audit':
      sendJson(response, 200, { events: listApprovalAuditEvents() });
      return;
    case '/runtime/reports':
      sendJson(response, 200, { reports: listRuntimeReports() });
      return;
    case '/runtime/reports/model-router':
      {
        const reports = listRuntimeReports();
        const mrReport = reports.find((r) => r.id === 'model-router');
        if (!mrReport) {
          sendJson(response, 200, { report: { exists: false, status: 'unknown' } });
          return;
        }

        // Extract safe metadata from wiki health if available
        const wikiHealth = mrReport.wikiHealth
          ? {
              ok: mrReport.wikiHealth.ok,
              errorCount: mrReport.wikiHealth.errorCount,
              warningCount: mrReport.wikiHealth.warningCount,
            }
          : undefined;

        sendJson(response, 200, {
          report: {
            exists: mrReport.status === 'available',
            status: mrReport.status,
            latestRunStatus: mrReport.latestRunStatus,
            path: mrReport.path,
            message: mrReport.message,
            writesToMind: false,
            externalSideEffects: false,
            applyEnabled: false,
            wikiHealth,
          },
        });
        return;
      }
    default:
      {
        // Check for approval detail route
        const approvalMatch = /^\/approvals\/([^/]+)$/.exec(url.pathname);
        if (approvalMatch) {
          const approval = getApprovalRecord(approvalMatch[1] ?? '');
          if (approval) {
            const auditEvents = getApprovalAuditEvents(approval.id);
            sendJson(response, 200, { approval, auditEvents });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Approval not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const actionMatch = /^\/actions\/([^/]+)$/.exec(url.pathname);
        if (actionMatch) {
          const action = getActionSummary(actionMatch[1] ?? '');
          if (action) {
            sendJson(response, 200, { action });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Action not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const orchestratorMatch = /^\/orchestrators\/([^/]+)$/.exec(url.pathname);
        if (orchestratorMatch) {
          const orchestrator = getOrchestrator(orchestratorMatch[1] ?? '');
          if (orchestrator) {
            sendJson(response, 200, { orchestrator });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Orchestrator not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const pipelineMatch = /^\/pipelines\/([^/]+)$/.exec(url.pathname);
        if (pipelineMatch) {
          const pipeline = getPipeline(pipelineMatch[1] ?? '');
          if (pipeline) {
            sendJson(response, 200, { pipeline });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Pipeline not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const agentMatch = /^\/agents\/([^/]+)$/.exec(url.pathname);
        if (agentMatch) {
          const agent = getAgent(agentMatch[1] ?? '');
          if (agent) {
            sendJson(response, 200, { agent });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Agent not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const agentRunMatch = /^\/agent-runs\/([^/]+)$/.exec(url.pathname);
        if (agentRunMatch) {
          const run = getAgentRun(agentRunMatch[1] ?? '');
          if (run) {
            sendJson(response, 200, { run });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Agent run not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const executionPlanMatch = /^\/execution\/plans\/([^/]+)$/.exec(url.pathname);
        if (executionPlanMatch) {
          const plan = getExecutionPlan(executionPlanMatch[1] ?? '');
          if (plan) {
            sendJson(response, 200, { plan });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Execution plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const previewMatch = /^\/execution\/mind-previews\/([^/]+)$/.exec(url.pathname);
        if (previewMatch) {
          const preview = readMindPreviewDetailById(previewMatch[1] ?? '');
          if (preview) {
            sendJson(response, 200, { preview });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Mind preview artifact not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
        const maintenancePreviewMatch = /^\/execution\/maintenance-previews\/([^/]+)$/.exec(url.pathname);
        if (maintenancePreviewMatch) {
          const preview = readMaintenancePreviewDetailById(maintenancePreviewMatch[1] ?? '');
          if (preview) {
            sendJson(response, 200, { preview });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Maintenance preview queue not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const recoveryItemMatch = /^\/recovery\/([^/]+)$/.exec(url.pathname);
        if (recoveryItemMatch) {
          const item = getRecoveryItem(recoveryItemMatch[1] ?? '');
          if (item) {
            sendJson(response, 200, { item });
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Recovery item not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }
      }
      {
        const dryRunMatch = /^\/post-orchestrator\/dry-run\/([^/]+)$/.exec(url.pathname);
        if (dryRunMatch) {
          sendJson(response, 200, readPostOrchestratorDryRunPlan(decodeURIComponent(dryRunMatch[1] ?? '')));
          return;
        }
        const reviewQueueMatch = /^\/post-orchestrator\/review-queue\/([^/]+)$/.exec(url.pathname);
        if (reviewQueueMatch) {
          sendJson(response, 200, readPostDraftReviewQueue(decodeURIComponent(reviewQueueMatch[1] ?? '')));
          return;
        }
        const schedulePreviewMatch = /^\/post-orchestrator\/schedule-preview\/([^/]+)$/.exec(url.pathname);
        if (schedulePreviewMatch) {
          sendJson(response, 200, readPostSchedulePreviewQueue(decodeURIComponent(schedulePreviewMatch[1] ?? '')));
          return;
        }
        const pipelineMatch = /^\/post-orchestrator\/pipeline\/([^/]+)$/.exec(url.pathname);
        if (pipelineMatch) {
          sendJson(response, 200, readPostPipelineSummary(decodeURIComponent(pipelineMatch[1] ?? '')));
          return;
        }
        const readinessMatch = /^\/post-orchestrator\/readiness\/([^/]+)$/.exec(url.pathname);
        if (readinessMatch) {
          sendJson(response, 200, readPostReadinessScore(decodeURIComponent(readinessMatch[1] ?? '')));
          return;
        }
        const manualExportMatch = /^\/post-orchestrator\/manual-export\/([^/]+)$/.exec(url.pathname);
        if (manualExportMatch) {
          sendJson(response, 200, readPostManualExportPackage(decodeURIComponent(manualExportMatch[1] ?? '')));
          return;
        }

        const credentialIsolationMatch = /^\/video-orchestrator\/design-provider-credential-isolation-plan\/([^/]+)$/.exec(url.pathname);
        if (credentialIsolationMatch) {
          const plan = readVideoDesignProviderCredentialIsolationPlan(decodeURIComponent(credentialIsolationMatch[1] ?? ''));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator design provider credential isolation plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const promptReviewMatch = /^\/video-orchestrator\/design-provider-prompt-review-policy-plan\/([^/]+)$/.exec(url.pathname);
        if (promptReviewMatch) {
          const policy = readVideoDesignProviderPromptReviewPolicyPlan(decodeURIComponent(promptReviewMatch[1] ?? ''));
          if (policy) {
            sendJson(response, 200, policy);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator design provider prompt review policy not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const handoffMatch = /^\/video-orchestrator\/artifact-sandbox-provider-handoff-plan\/([^/]+)$/.exec(url.pathname);
        if (handoffMatch) {
          const plan = readVideoArtifactSandboxProviderHandoffPlan(decodeURIComponent(handoffMatch[1] ?? ''));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator artifact sandbox provider handoff plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const redactionMatch = /^\/video-orchestrator\/provider-output-redaction-policy-plan\/([^/]+)$/.exec(url.pathname);
        if (redactionMatch) {
          const policy = readVideoProviderOutputRedactionPolicyPlan(decodeURIComponent(redactionMatch[1] ?? ''));
          if (policy) {
            sendJson(response, 200, policy);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider output redaction policy not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const complianceChecklistMatch = /^\/video-orchestrator\/design-provider-compliance-checklist-plan\/([^/]+)$/.exec(url.pathname);
        if (complianceChecklistMatch) {
          const checklist = readVideoDesignProviderComplianceChecklistPlan(decodeURIComponent(complianceChecklistMatch[1] ?? ''));
          if (checklist) {
            sendJson(response, 200, checklist);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator design provider compliance checklist not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const designProviderBoundaryMatch = /^\/video-orchestrator\/design-provider-boundary-plan\/([^/]+)$/.exec(url.pathname);
        if (designProviderBoundaryMatch) {
          const plan = readVideoDesignProviderBoundaryPlan(decodeURIComponent(designProviderBoundaryMatch[1] ?? ''));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator design provider boundary plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const archiveLoggingMatch = /^\/video-orchestrator\/archive-logging-plan\/([^/]+)$/.exec(url.pathname);
        if (archiveLoggingMatch) {
          const plan = readVideoArchiveLoggingPlan(decodeURIComponent(archiveLoggingMatch[1] ?? ''));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator archive/logging plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const thumbnailDesignMatch = /^\/video-orchestrator\/thumbnail-design\/([^/]+)$/.exec(url.pathname);
        if (thumbnailDesignMatch) {
          const plan = readVideoThumbnailDesignPlan(decodeURIComponent(thumbnailDesignMatch[1] ?? ''));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator thumbnail design plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const intakeMatch = /^\/video-orchestrator\/intake\/([^/]+)$/.exec(url.pathname);
        if (intakeMatch) {
          const plan = getVideoOrchestratorIntakePlan(decodeURIComponent(intakeMatch[1] ?? ''));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator intake plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/research') {
          sendJson(response, 200, getVideoOrchestratorResearch());
          return;
        }

        const researchMatch = /^\/video-orchestrator\/research\/([^/]+)$/.exec(url.pathname);
        if (researchMatch) {
          const brief = getVideoOrchestratorResearchPlan(decodeURIComponent(researchMatch[1] ?? ''));
          if (brief) {
            sendJson(response, 200, brief);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator research plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/script') {
          sendJson(response, 200, getVideoOrchestratorScript());
          return;
        }

        const scriptMatch = /^\/video-orchestrator\/script\/([^/]+)$/.exec(url.pathname);
        if (scriptMatch) {
          const scriptPlan = getVideoOrchestratorScriptPlan(decodeURIComponent(scriptMatch[1] ?? ''));
          if (scriptPlan) {
            sendJson(response, 200, scriptPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator script plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/asset-plan') {
          sendJson(response, 200, readVideoAssetPlans());
          return;
        }

        const assetPlanMatch = /^\/video-orchestrator\/asset-plan\/([^/]+)$/.exec(url.pathname);
        if (assetPlanMatch) {
          const assetPlan = readVideoAssetPlan(decodeURIComponent(assetPlanMatch[1] ?? ''));
          if (assetPlan) {
            sendJson(response, 200, assetPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator asset plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/design-plan') {
          sendJson(response, 200, readVideoDesignPlans());
          return;
        }

        const designPlanMatch = /^\/video-orchestrator\/design-plan\/([^/]+)$/.exec(url.pathname);
        if (designPlanMatch) {
          const designPlan = readVideoDesignPlan(decodeURIComponent(designPlanMatch[1] ?? ''));
          if (designPlan) {
            sendJson(response, 200, designPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator design plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/voiceover-plan') {
          sendJson(response, 200, readVideoVoiceoverPlans());
          return;
        }

        const voiceoverPlanMatch = /^\/video-orchestrator\/voiceover-plan\/([^/]+)$/.exec(url.pathname);
        if (voiceoverPlanMatch) {
          const voiceoverPlan = readVideoVoiceoverPlan(decodeURIComponent(voiceoverPlanMatch[1] ?? ''));
          if (voiceoverPlan) {
            sendJson(response, 200, voiceoverPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator voiceover plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/visuals-plan') {
          sendJson(response, 200, readVideoVisualsPlans());
          return;
        }

        const visualsPlanMatch = /^\/video-orchestrator\/visuals-plan\/([^/]+)$/.exec(url.pathname);
        if (visualsPlanMatch) {
          const visualsPlan = readVideoVisualsPlan(decodeURIComponent(visualsPlanMatch[1] ?? ''));
          if (visualsPlan) {
            sendJson(response, 200, visualsPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator visuals plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/assembly-plan') {
          sendJson(response, 200, readVideoAssemblyPlans());
          return;
        }

        const assemblyPlanMatch = /^\/video-orchestrator\/assembly-plan\/([^/]+)$/.exec(url.pathname);
        if (assemblyPlanMatch) {
          const assemblyPlan = readVideoAssemblyPlan(decodeURIComponent(assemblyPlanMatch[1] ?? ''));
          if (assemblyPlan) {
            sendJson(response, 200, assemblyPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator assembly plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/metadata-plan') {
          sendJson(response, 200, readVideoMetadataPlans());
          return;
        }

        const metadataPlanMatch = /^\/video-orchestrator\/metadata-plan\/([^/]+)$/.exec(url.pathname);
        if (metadataPlanMatch) {
          const metadataPlan = readVideoMetadataPlan(decodeURIComponent(metadataPlanMatch[1] ?? ''));
          if (metadataPlan) {
            sendJson(response, 200, metadataPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator metadata plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/publishing-prep') {
          sendJson(response, 200, readVideoPublishingPrepPlans());
          return;
        }

        const publishingPrepMatch = /^\/video-orchestrator\/publishing-prep\/([^/]+)$/.exec(url.pathname);
        if (publishingPrepMatch) {
          const publishingPrepPlan = readVideoPublishingPrepPlan(decodeURIComponent(publishingPrepMatch[1] ?? ''));
          if (publishingPrepPlan) {
            sendJson(response, 200, publishingPrepPlan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator publishing prep plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/manual-export-package') {
          sendJson(response, 200, readVideoManualExportPackages());
          return;
        }

        const videoManualExportMatch = /^\/video-orchestrator\/manual-export-package\/([^/]+)$/.exec(url.pathname);
        if (videoManualExportMatch) {
          const manualExportPackage = readVideoManualExportPackage(decodeURIComponent(videoManualExportMatch[1] ?? ''));
          if (manualExportPackage) {
            sendJson(response, 200, manualExportPackage);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator manual export package not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        if (url.pathname === '/video-orchestrator/production-gate') {
          sendJson(response, 200, readVideoProductionGate());
          return;
        }

        if (url.pathname === '/video-orchestrator/render-export-policy') {
          sendJson(response, 200, readVideoRenderExportPolicy());
          return;
        }

        if (url.pathname === '/video-orchestrator/approval-policy-design') {
          sendJson(response, 200, readVideoApprovalPolicyDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/artifact-sandbox-design') {
          sendJson(response, 200, readVideoArtifactSandboxDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-dry-run-design') {
          sendJson(response, 200, readVideoControlledDryRunDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/rollback-cleanup-checklist') {
          sendJson(response, 200, readVideoRollbackCleanupChecklist());
          return;
        }

        if (url.pathname === '/video-orchestrator/comparison-schema-design') {
          sendJson(response, 200, readVideoComparisonSchemaDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/fixture-comparison-preview') {
          sendJson(response, 200, readVideoFixtureComparisonPreview());
          return;
        }

        if (url.pathname === '/video-orchestrator/production-cutover-gate') {
          sendJson(response, 200, readVideoProductionCutoverGate());
          return;
        }

        if (url.pathname === '/video-orchestrator/release-candidate-readiness') {
          sendJson(response, 200, readVideoReleaseCandidateReadiness());
          return;
        }

        if (url.pathname === '/video-orchestrator/operator-decision-queue') {
          sendJson(response, 200, readVideoOperatorDecisionQueue());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-policy-boundary') {
          sendJson(response, 200, readVideoControlledExecutionPolicyBoundary());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-readiness-index') {
          sendJson(response, 200, readVideoControlledExecutionReadinessIndex());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-approval-payload-schema') {
          sendJson(response, 200, readVideoControlledExecutionApprovalPayloadSchema());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-approval-request-design') {
          sendJson(response, 200, readVideoControlledExecutionApprovalRequestDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-disabled-gate') {
          sendJson(response, 200, readVideoControlledExecutionDisabledGate());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-preflight-validator-schema') {
          sendJson(response, 200, readVideoControlledExecutionPreflightValidatorSchema());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-plan-stub') {
          sendJson(response, 200, readVideoControlledExecutionPlanStub());
          return;
        }

        if (url.pathname === '/video-orchestrator/roadmap-checkpoint') {
          sendJson(response, 200, readVideoRoadmapCheckpoint());
          return;
        }

        if (url.pathname === '/video-orchestrator/operator-review-packet') {
          sendJson(response, 200, readVideoOperatorReviewPacket());
          return;
        }

        if (url.pathname === '/video-orchestrator/preview-completion-index') {
          sendJson(response, 200, readVideoPreviewCompletionIndex());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-preflight-checklist') {
          sendJson(response, 200, readVideoControlledExecutionPreflightChecklist());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-risk-register') {
          sendJson(response, 200, readVideoControlledExecutionRiskRegister());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-second-approval-policy') {
          sendJson(response, 200, readVideoControlledExecutionSecondApprovalPolicy());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-operator-identity-protocol') {
          sendJson(response, 200, readVideoControlledExecutionOperatorIdentityProtocol());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-role-policy') {
          sendJson(response, 200, readVideoControlledExecutionRolePolicy());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-first-approval-authority-policy') {
          sendJson(response, 200, readVideoControlledExecutionFirstApprovalAuthorityPolicy());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-first-approval-audit-expiry-model') {
          sendJson(response, 200, readVideoControlledExecutionFirstApprovalAuditExpiryModel());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-candidate-story-lock') {
          sendJson(response, 200, readVideoControlledExecutionCandidateStoryLock());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-preflight-evidence-hash-design') {
          sendJson(response, 200, readVideoControlledExecutionPreflightEvidenceHashDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-operator-decision-snapshot-design') {
          sendJson(response, 200, readVideoControlledExecutionOperatorDecisionSnapshotDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-runtime-sandbox-boundary-design') {
          sendJson(response, 200, readVideoControlledExecutionRuntimeSandboxBoundaryDesign());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-approval-review-audit-design') {
          sendJson(response, 200, readVideoControlledExecutionApprovalReviewAudit());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-immutable-audit-trail-schema') {
          sendJson(response, 200, readVideoControlledExecutionImmutableAuditTrailSchema());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design') {
          sendJson(response, 200, readVideoControlledExecutionAuditComplianceEvidencePacket());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-implementation-readiness-checkpoint') {
          sendJson(response, 200, readVideoControlledExecutionImplementationReadinessCheckpoint());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-feature-flag-rollout-plan') {
          sendJson(response, 200, readVideoControlledExecutionFeatureFlagRolloutPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-approval-store-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionApprovalStoreImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-first-approval-creation-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionFirstApprovalCreationImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-second-approval-creation-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionSecondApprovalCreationImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-validator-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionValidatorImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-execution-plan-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionExecutionPlanImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionRollbackCleanupImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionSandboxProvisioningImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-sandbox-execution-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionSandboxExecutionImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-sandbox-teardown-recovery-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionSandboxTeardownRecoveryImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-artifact-policy-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionArtifactPolicyImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-stb-protection-decommission-prevention-plan') {
          sendJson(response, 200, readVideoControlledExecutionSTBProtectionDecommissionPreventionPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-implementation-completion-readiness-checkpoint') {
          sendJson(response, 200, readVideoControlledExecutionImplementationCompletionReadinessCheckpoint());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-operator-ux-console-controls-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionOperatorUXConsoleControlsImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-security-review-threat-modeling-implementation-plan') {
          sendJson(response, 200, readVideoControlledExecutionSecurityReviewThreatModelingImplementationPlan());
          return;
        }

        if (url.pathname === '/video-orchestrator/controlled-execution-implementation-approval-packet-start-gate') {
          sendJson(response, 200, readVideoControlledExecutionImplementationApprovalPacketStartGate());
          return;
        }
        const enablementReadinessMatch = /^\/video-orchestrator\/design-provider-enablement-readiness-index\/([^/]+)$/.exec(url.pathname);
        const providerClass = enablementReadinessMatch?.[1] ?? '';
        if (providerClass.length > 0) {
          const entry = readVideoDesignProviderEnablementReadinessIndexEntry(decodeURIComponent(providerClass));
          if (entry) {
            sendJson(response, 200, entry);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator design provider enablement readiness entry not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const finalPlanningMatch = /^\/video-orchestrator\/provider-integration-final-planning-checkpoint\/([^/]+)$/.exec(url.pathname);
        const finalPlanningProviderClass = finalPlanningMatch?.[1] ?? '';
        if (finalPlanningProviderClass.length > 0) {
          const checkpoint = readVideoProviderIntegrationFinalPlanningCheckpointEntry(decodeURIComponent(finalPlanningProviderClass));
          if (checkpoint) {
            sendJson(response, 200, checkpoint);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider integration final planning checkpoint not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const wrapperPlanMatch = /^\/video-orchestrator\/provider-request-wrapper-implementation-plan\/([^/]+)$/.exec(url.pathname);
        const wrapperProviderClass = wrapperPlanMatch?.[1] ?? '';
        if (wrapperProviderClass.length > 0) {
          const plan = readVideoProviderRequestWrapperImplementationPlanEntry(decodeURIComponent(wrapperProviderClass));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider request wrapper implementation plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const credentialBoundaryMatch = /^\/video-orchestrator\/credential-store-implementation-boundary-plan\/([^/]+)$/.exec(url.pathname);
        const credentialBoundaryProviderClass = credentialBoundaryMatch?.[1] ?? '';
        if (credentialBoundaryProviderClass.length > 0) {
          const boundary = readVideoCredentialStoreImplementationBoundaryPlanEntry(decodeURIComponent(credentialBoundaryProviderClass));
          if (boundary) {
            sendJson(response, 200, boundary);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator credential store implementation boundary plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const promptReviewUxMatch = /^\/video-orchestrator\/prompt-review-ux-implementation-plan\/([^/]+)$/.exec(url.pathname);
        const promptReviewUxProviderClass = promptReviewUxMatch?.[1] ?? '';
        if (promptReviewUxProviderClass.length > 0) {
          const plan = readVideoPromptReviewUxImplementationPlanEntry(decodeURIComponent(promptReviewUxProviderClass));
          if (plan) {
            sendJson(response, 200, plan);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator prompt review UX implementation plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const auditBoundaryMatch = /^\/video-orchestrator\/provider-audit-persistence-boundary-plan\/([^/]+)$/.exec(url.pathname);
        const auditBoundaryProviderClass = auditBoundaryMatch?.[1] ?? '';
        if (auditBoundaryProviderClass.length > 0) {
          const boundary = readVideoProviderAuditPersistenceBoundaryPlanEntry(decodeURIComponent(auditBoundaryProviderClass));
          if (boundary) {
            sendJson(response, 200, boundary);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider audit persistence boundary plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const securityReviewMatch = /^\/video-orchestrator\/provider-wrapper-security-review-plan\/([^/]+)$/.exec(url.pathname);
        const securityReviewProviderClass = securityReviewMatch?.[1] ?? '';
        if (securityReviewProviderClass.length > 0) {
          const review = readVideoProviderWrapperSecurityReviewPlanEntry(decodeURIComponent(securityReviewProviderClass));
          if (review) {
            sendJson(response, 200, review);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider wrapper security review plan not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const startGateMatch = /^\/video-orchestrator\/provider-implementation-phase-start-gate\/([^/]+)$/.exec(url.pathname);
        const startGateProviderClass = startGateMatch?.[1] ?? '';
        if (startGateProviderClass.length > 0) {
          const gate = readVideoProviderImplementationPhaseStartGateEntry(decodeURIComponent(startGateProviderClass));
          if (gate) {
            sendJson(response, 200, gate);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider implementation phase start gate not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const readinessDashboardMatch = /^\/video-orchestrator\/provider-implementation-readiness-dashboard-summary\/([^/]+)$/.exec(url.pathname);
        const readinessDashboardProviderClass = readinessDashboardMatch?.[1] ?? '';
        if (readinessDashboardProviderClass.length > 0) {
          const summary = readVideoProviderImplementationReadinessDashboardSummaryEntry(decodeURIComponent(readinessDashboardProviderClass));
          if (summary) {
            sendJson(response, 200, summary);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider implementation readiness dashboard summary not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const approvalPacketMatch = /^\/video-orchestrator\/provider-implementation-approval-packet\/([^/]+)$/.exec(url.pathname);
        const approvalPacketProviderClass = approvalPacketMatch?.[1] ?? '';
        if (approvalPacketProviderClass.length > 0) {
          const packet = readVideoProviderImplementationApprovalPacketEntry(decodeURIComponent(approvalPacketProviderClass));
          if (packet) {
            sendJson(response, 200, packet);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider implementation approval packet not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const reviewSummaryMatch = /^\/video-orchestrator\/provider-approval-packet-console-review-summary\/([^/]+)$/.exec(url.pathname);
        const reviewSummaryProviderClass = reviewSummaryMatch?.[1] ?? '';
        if (reviewSummaryProviderClass.length > 0) {
          const summary = readVideoProviderApprovalPacketConsoleReviewSummaryEntry(decodeURIComponent(reviewSummaryProviderClass));
          if (summary) {
            sendJson(response, 200, summary);
            return;
          }
          sendJson(response, 404, {
            error: {
              code: 'not_found',
              message: 'Video Orchestrator provider approval packet console review summary not found.',
            },
          } satisfies BrainCoreErrorResponse);
          return;
        }

        const localAppPlanMatch = /^\/local-apps\/([^/]+)\/action-plan\/([^/]+)$/.exec(url.pathname);
        if (localAppPlanMatch) {
          const appId = decodeURIComponent(localAppPlanMatch[1] ?? '');
          const action = decodeURIComponent(localAppPlanMatch[2] ?? '');
          if (appId.length > 0 && action.length > 0) {
            sendJson(response, 200, readLocalAppsActionPlan(appId, action));
            return;
          }
        }
      }

      sendJson(response, 404, {
        error: {
          code: 'not_found',
          message: 'Route not found. Available routes: /status, /sessions, /skills, /repos, /orchestrators, /orchestrators/:id, /pipelines, /pipelines/:id, /projects, /platforms, /post-orchestrator/status, /post-orchestrator/contracts, /post-orchestrator/flows, /post-orchestrator/drafts, /post-orchestrator/events, /post-orchestrator/dry-run/:eventId, /post-orchestrator/integrations, /post-orchestrator/recovery, /post-orchestrator/platform-policies, /post-orchestrator/decommission-readiness, /post-orchestrator/operator-guidance, /post-orchestrator/manual-export/:eventId, /post-orchestrator/acceptance-checklist, /post-orchestrator/migration-parity, /post-orchestrator/roadmap-checkpoint, /post-orchestrator/pipeline/:eventId, /post-orchestrator/readiness/:eventId, /stb/status, /video-orchestrator/status, /video-orchestrator/intake, /video-orchestrator/intake/:id, /video-orchestrator/research, /video-orchestrator/research/:id, /video-orchestrator/script, /video-orchestrator/script/:id, /video-orchestrator/asset-plan, /video-orchestrator/asset-plan/:id, /video-orchestrator/design-plan, /video-orchestrator/design-plan/:id, /video-orchestrator/voiceover-plan, /video-orchestrator/voiceover-plan/:id, /video-orchestrator/visuals-plan, /video-orchestrator/visuals-plan/:id, /video-orchestrator/assembly-plan, /video-orchestrator/assembly-plan/:id, /video-orchestrator/metadata-plan, /video-orchestrator/metadata-plan/:id, /video-orchestrator/publishing-prep, /video-orchestrator/publishing-prep/:id, /video-orchestrator/manual-export-package, /video-orchestrator/manual-export-package/:id, /video-orchestrator/production-gate, /video-orchestrator/render-export-policy, /video-orchestrator/approval-policy-design, /video-orchestrator/artifact-sandbox-design, /video-orchestrator/controlled-dry-run-design, /video-orchestrator/rollback-cleanup-checklist, /video-orchestrator/comparison-schema-design, /video-orchestrator/fixture-comparison-preview, /video-orchestrator/production-cutover-gate, /video-orchestrator/release-candidate-readiness, /video-orchestrator/operator-decision-queue, /video-orchestrator/controlled-execution-policy-boundary, /video-orchestrator/controlled-execution-readiness-index, /video-orchestrator/controlled-execution-approval-payload-schema, /video-orchestrator/controlled-execution-preflight-validator-schema, /video-orchestrator/controlled-execution-plan-stub, /video-orchestrator/roadmap-checkpoint, /video-orchestrator/controlled-execution-approval-request-design, /video-orchestrator/operator-review-packet, /video-orchestrator/preview-completion-index, /video-orchestrator/controlled-execution-preflight-checklist, /video-orchestrator/controlled-execution-risk-register, /video-orchestrator/controlled-execution-second-approval-policy, /video-orchestrator/controlled-execution-operator-identity-protocol, /video-orchestrator/controlled-execution-role-policy, /video-orchestrator/controlled-execution-first-approval-authority-policy, /video-orchestrator/controlled-execution-first-approval-audit-expiry-model, /video-orchestrator/controlled-execution-candidate-story-lock, /video-orchestrator/controlled-execution-preflight-evidence-hash-design, /video-orchestrator/controlled-execution-operator-decision-snapshot-design, /video-orchestrator/controlled-execution-runtime-sandbox-boundary-design, /video-orchestrator/controlled-execution-approval-review-audit-design, /video-orchestrator/controlled-execution-immutable-audit-trail-schema, /video-orchestrator/controlled-execution-audit-compliance-evidence-packet-design, /video-orchestrator/controlled-execution-implementation-readiness-checkpoint, /video-orchestrator/controlled-execution-feature-flag-rollout-plan, /video-orchestrator/controlled-execution-approval-store-implementation-plan, /video-orchestrator/controlled-execution-first-approval-creation-implementation-plan, /video-orchestrator/controlled-execution-second-approval-creation-implementation-plan, /video-orchestrator/controlled-execution-validator-implementation-plan, /video-orchestrator/controlled-execution-execution-plan-implementation-plan, /video-orchestrator/controlled-execution-rollback-cleanup-implementation-plan, /video-orchestrator/controlled-execution-sandbox-provisioning-implementation-plan, /video-orchestrator/controlled-execution-sandbox-execution-implementation-plan, /video-orchestrator/controlled-execution-sandbox-teardown-recovery-implementation-plan, /video-orchestrator/controlled-execution-artifact-policy-implementation-plan, /video-orchestrator/controlled-execution-stb-protection-decommission-prevention-plan, /video-orchestrator/controlled-execution-implementation-completion-readiness-checkpoint, /video-orchestrator/controlled-execution-operator-ux-console-controls-implementation-plan, /video-orchestrator/controlled-execution-security-review-threat-modeling-implementation-plan, /video-orchestrator/controlled-execution-implementation-approval-packet-start-gate, /stb-video-migration/status, /stb-video/parity-matrix, /stb-video/dual-run-status, /stb-video/dual-run-evidence, /stb-video/controlled-dual-run-request, /agents, /agents/:id, /agent-runs, /agent-runs/:id, /agent-events, /approval-audit, /recovery, /recovery/:id, /actions, /actions/:id, /capabilities, /scheduler/status, /scheduler/latest-run, /scheduler/jobs, /local-apps, /local-apps/dashboard, /local-apps/action-readiness, /video/status, /video/queue, /approvals, /approvals/:id, /approvals/store, /runtime/reports, /runtime/reports/model-router, /execution/plans, /execution/plans/:kind, /execution/mind-preview-policy, /execution/mind-previews, /execution/mind-previews/latest, /execution/mind-previews/:id, /execution/maintenance-previews, /execution/maintenance-previews/latest, /execution/maintenance-previews/:id, /execution/readiness.',
        },
      } satisfies BrainCoreErrorResponse);
      return;
    }
}

function routePostRequest(url: URL, response: ServerResponse): void {
  if (url.pathname === '/actions/request') {
    const kind = url.searchParams.get('kind') || 'manual-request';
    sendJson(response, 202, requestAction(kind));
    return;
  }

  const reviewApprovalMatch = /^\/post-orchestrator\/review-queue\/([^/]+)\/request-approval$/.exec(url.pathname);
  if (reviewApprovalMatch) {
    const result = requestPostDraftReviewApproval(decodeURIComponent(reviewApprovalMatch[1] ?? ''));
    sendJson(response, result.status === 'requested' ? 202 : 400, result);
    return;
  }

  const scheduleApprovalMatch = /^\/post-orchestrator\/schedule-preview\/([^/]+)\/request-approval$/.exec(url.pathname);
  if (scheduleApprovalMatch) {
    const result = requestPostSchedulePreviewApproval(decodeURIComponent(scheduleApprovalMatch[1] ?? ''));
    sendJson(response, result.status === 'requested' ? 202 : 400, result);
    return;
  }

  const actionRequestMatch = /^\/actions\/([^/]+)\/request-approval$/.exec(url.pathname);
  if (actionRequestMatch) {
    void (async () => {
      const actionRequest = await requestActionApprovalById(actionRequestMatch[1] ?? '');
      sendJson(response, actionRequest.status === 'requested' ? 202 : 400, actionRequest);
    })();
    return;
  }

  const requestKind = getApprovalRequestKind(url);
  if (requestKind) {
    sendJson(response, 202, requestAction(requestKind));
    return;
  }

  const approvalMatch = /^\/approvals\/([^/]+)\/(approve|reject)$/.exec(url.pathname);
  if (approvalMatch) {
    const approvalId = approvalMatch[1] ?? '';
    const decision = approvalMatch[2] === 'approve' ? 'approve' : 'reject';
    sendJson(response, 200, decideApproval(approvalId, decision));
    return;
  }

  sendJson(response, 404, {
    error: {
      code: 'not_found',
      message: 'POST route not found. Available POST routes: /actions/request, /actions/:id/request-approval, /scheduler/jobs/:id/request-run, /skills/profile, /sessions/:id/resume, /local-apps/:id/start|stop|restart, /approvals/:id/approve, /approvals/:id/reject.',
    },
  } satisfies BrainCoreErrorResponse);
}

function getApprovalRequestKind(url: URL): string | undefined {
  const schedulerMatch = /^\/scheduler\/jobs\/([^/]+)\/request-run$/.exec(url.pathname);
  if (schedulerMatch) {
    return `scheduler-run-${schedulerMatch[1] ?? 'unknown'}`;
  }

  if (url.pathname === '/skills/profile') {
    return `skill-profile-${url.searchParams.get('profile') || 'default'}`;
  }

  const sessionMatch = /^\/sessions\/([^/]+)\/resume$/.exec(url.pathname);
  if (sessionMatch) {
    return `session-resume-${sessionMatch[1] ?? 'unknown'}`;
  }

  const localAppMatch = /^\/local-apps\/([^/]+)\/(start|stop|restart)$/.exec(url.pathname);
  if (localAppMatch) {
    return `local-app-${localAppMatch[2] ?? 'action'}-${localAppMatch[1] ?? 'unknown'}`;
  }

  return undefined;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body, redactingJsonReplacer, 2);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`${payload}\n`);
}
