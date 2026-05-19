import { ItemView } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import {
  diagnoseBrainCoreConnection,
  type BrainCoreConnectionDiagnostic,
  readBrainCoreApprovals,
  readBrainCoreApprovalDetail,
  readBrainCoreApprovalStore,
  readBrainCoreCapabilities,
  readBrainCoreLocalApps,
  readBrainCoreExecutionPlans,
  readBrainCoreExecutionReadiness,
  readBrainCoreMindPreviewPolicy,
  readBrainCoreMindPreviews,
  readBrainCoreRepos,
  readBrainCoreRuntimeReports,
  readBrainCoreModelRouterReportDetail,
  readBrainCoreSchedulerJobs,
  readBrainCoreSchedulerStatus,
  readBrainCoreSessions,
  readBrainCoreVideoQueue,
  readBrainCoreVideoStatus,
  readBrainCoreStatus,
  readBrainCoreOrchestrators,
  readBrainCorePipelines,
  readBrainCoreProjects,
  readBrainCorePlatforms,
  readBrainCorePostOrchestratorContracts,
  readBrainCorePostOrchestratorDryRun,
  readBrainCorePostOrchestratorEvents,
  readBrainCorePostOrchestratorDrafts,
  readBrainCorePostOrchestratorFlows,
  readBrainCorePostOrchestratorIntegrations,
  readBrainCorePostOrchestratorRecovery,
  readBrainCorePostOrchestratorStatus,
  readBrainCorePostOrchestratorOverview,
  readBrainCorePostPlatformPolicies,
  readBrainCorePostDraftReviewQueue,
  readBrainCorePostSchedulePreviewQueue,
  readBrainCorePostAnalyticsFixtures,
  readBrainCorePostPipelineSummary,
  readBrainCorePostReadinessScore,
  readBrainCorePostDecommissionReadiness,
  readBrainCorePostOperatorGuidance,
  readBrainCorePostManualExportPackage,
  readBrainCorePostAcceptanceChecklist,
  readBrainCorePostMigrationParityReport,
  readBrainCorePostRoadmapCheckpoint,
  readBrainCorePostQaStatus,
  readBrainCoreStbStatus,
  readBrainCoreVideoOrchestratorStatus,
  readBrainCoreVideoOrchestratorIntake,
  readBrainCoreVideoOrchestratorAssetPlans,
  readBrainCoreVideoOrchestratorDesignPlans,
  readBrainCoreVideoOrchestratorVoiceoverPlans,
  readBrainCoreVideoOrchestratorVisualsPlans,
  readBrainCoreVideoOrchestratorAssemblyPlans,
  readBrainCoreVideoOrchestratorMetadataPlans,
  readBrainCoreVideoOrchestratorPublishingPrepPlans,
  readBrainCoreVideoOrchestratorManualExportPackages,
  readBrainCoreVideoOrchestratorThumbnailDesignPlans,
  readBrainCoreVideoOrchestratorArchiveLoggingPlans,
  readBrainCoreVideoOrchestratorDesignProviderBoundaryPlans,
  readBrainCoreVideoOrchestratorDesignProviderCredentialIsolationPlans,
  readBrainCoreVideoOrchestratorDesignProviderPromptReviewPolicyPlans,
  readBrainCoreVideoOrchestratorArtifactSandboxProviderHandoffPlans,
  readBrainCoreVideoOrchestratorProviderOutputRedactionPolicyPlans,
  readBrainCoreVideoOrchestratorDesignProviderComplianceChecklistPlans,
  readBrainCoreVideoOrchestratorDesignProviderEnablementReadinessIndex,
  readBrainCoreVideoOrchestratorProviderIntegrationFinalPlanningCheckpoint,
  readBrainCoreVideoOrchestratorCredentialStoreImplementationBoundaryPlan,
  readBrainCoreVideoOrchestratorPromptReviewUxImplementationPlan,
  readBrainCoreVideoOrchestratorProviderAuditPersistenceBoundaryPlan,
  readBrainCoreVideoOrchestratorProviderWrapperSecurityReviewPlan,
  readBrainCoreVideoOrchestratorProviderImplementationPhaseStartGate,
  readBrainCoreVideoOrchestratorProviderImplementationReadinessDashboardSummary,
  readBrainCoreVideoOrchestratorProviderImplementationApprovalPacket,
  readBrainCoreVideoOrchestratorProviderApprovalPacketConsoleReviewSummary,
  readBrainCoreVideoOrchestratorProviderPlanningSurfaceIndex,
  readBrainCoreVideoOrchestratorCredentialReferenceScaffold,
  readBrainCoreVideoOrchestratorProviderRequestWrapperScaffold,
  readBrainCoreVideoOrchestratorProviderWrapperValidationHarness,
  readBrainCoreVideoOrchestratorProviderRequestEnvelopeScaffold,
  readBrainCoreVideoOrchestratorProviderResponseEnvelopeScaffold,
  readBrainCoreVideoOrchestratorProviderScaffoldingIntegrationSummary,
  readBrainCoreVideoOrchestratorProviderRequestWrapperInertShell,
  readBrainCoreVideoOrchestratorCredentialReferenceValidator,
  readBrainCoreVideoOrchestratorProviderResponseRedactionSkeleton,
  readBrainCoreVideoOrchestratorProviderAuditEventTypes,
  readBrainCoreVideoOrchestratorProviderDisabledOrchestrationFacade,
  readBrainCoreVideoOrchestratorProviderCapabilityPolicyEvaluator,
  readBrainCoreVideoOrchestratorProviderBlockedActionLedgerTypes,
  readBrainCoreVideoOrchestratorProviderDisabledOrchestrationIntegrationSummary,
  readBrainCoreStbVideoMigrationStatus,
  readBrainCoreStbVideoParityMatrix,
  readBrainCoreStbVideoDualRunStatus,
  readBrainCoreStbVideoDualRunEvidence,
  readBrainCoreVideoProductionGate,
  readBrainCoreVideoRenderExportPolicy,
  readBrainCoreVideoControlledDryRunDesign,
  readBrainCoreVideoProductionCutoverGate,
  readBrainCoreVideoReleaseCandidateReadiness,
  readBrainCoreVideoOperatorDecisionQueue,
  readBrainCoreVideoControlledExecutionPolicyBoundary,
  readBrainCoreVideoControlledExecutionReadinessIndex,
  readBrainCoreVideoRoadmapCheckpoint,
  readBrainCoreVideoOperatorReviewPacket,
  readBrainCoreVideoControlledExecutionApprovalPayloadSchema,
  readBrainCoreVideoPreviewCompletionIndex,
  readBrainCoreVideoControlledExecutionPreflightChecklist,
  readBrainCoreVideoControlledExecutionRiskRegister,
  readBrainCoreVideoControlledExecutionPreflightValidatorSchema,
  readBrainCoreVideoControlledExecutionPlanStub,
  readBrainCoreVideoControlledExecutionApprovalRequestDesign,
  readBrainCoreVideoControlledExecutionDisabledGate,
  readBrainCoreVideoControlledExecutionSecondApprovalPolicy,
  readBrainCoreVideoControlledExecutionOperatorIdentityProtocol,
  readBrainCoreVideoControlledExecutionRolePolicy,
  readBrainCoreControlledDualRunRequestDesign,
  readBrainCoreAgents,
  readBrainCoreActions,
  readBrainCoreMaintenancePreviewDetail,
  readBrainCoreAgentRuns,
  readBrainCoreAgentEvents,
  readBrainCoreRecoveryItems,
  requestBrainCoreActionApproval,
  requestBrainCorePostDraftReviewApproval,
  requestBrainCorePostSchedulePreviewApproval,
  type BrainCoreApprovalSummary,
  type BrainCoreApprovalDetail,
  type BrainCoreApprovalStoreSummary,
  type BrainCoreCapabilitySummary,
  type BrainCoreLocalAppSummary,
  type BrainCoreExecutionPlan,
  type BrainCoreExecutionReadiness,
  type BrainCoreRepoSummary,
  type BrainCoreRuntimeReportSummary,
  type BrainCoreSchedulerJobSummary,
  type BrainCoreSchedulerStatus,
  type BrainCoreSessionSummary,
  type BrainCoreVideoQueueItem,
  type BrainCoreVideoStatus,
  type BrainCoreStatus,
  type BrainCoreOrchestratorSummary,
  type BrainCorePipelineSummary,
  type BrainCoreProjectSummary,
  type BrainCorePlatformSummary,
  type BrainCoreProBotDashboardParityResponse,
  readBrainCoreProBotSessionsParity,
  readBrainCoreProBotLocalAppsParity,
  readBrainCoreProBotSchedulerParity,
  readBrainCoreProBotStudioParity,
  readBrainCoreProBotExternalAdminParity,
  readBrainCoreProBotDecommissionReadiness,
  readBrainCoreProBotExternalAdminSafeMetadata,
  readBrainCoreProBotFeatureParityMatrix,
  readBrainCoreProBotPhaseOutChecklist,
  type BrainCoreProBotSessionsParityResponse,
  type BrainCoreProBotLocalAppsParityResponse,
  type BrainCoreProBotSchedulerParityResponse,
  type BrainCoreProBotStudioParityResponse,
  type BrainCoreProBotExternalAdminParityResponse,
  type BrainCoreProBotDecommissionReadinessResponse,
  type BrainCoreProBotExternalAdminSafeMetadataResponse,
  type BrainCoreProBotFeatureParityMatrixResponse,
  type BrainCoreProBotPhaseOutChecklistResponse,
  type BrainCorePostOrchestratorContract,
  type BrainCorePostOrchestratorOverviewResponse,
  type BrainCorePostDryRunPlanResponse,
  type BrainCorePostDraftFixture,
  type BrainCorePostDraftReviewQueueResponse,
  type BrainCorePostSchedulePreviewQueueResponse,
  type BrainCorePostAnalyticsFixturesResponse,
  type BrainCorePostPipelineSummaryResponse,
  type BrainCorePostReadinessScoreResponse,
  type BrainCorePostEventFixturesResponse,
  type BrainCorePostOrchestratorIntegration,
  type BrainCorePostOrchestratorRecoveryItem,
  type BrainCorePostPlatformPolicy,
  type BrainCorePostPlatformPoliciesResponse,
  type BrainCorePostDecommissionReadinessItem,
  type BrainCorePostDecommissionReadinessResponse,
  type BrainCorePostOperatorGuidanceItem,
  type BrainCorePostOperatorGuidanceResponse,
  type BrainCorePostManualExportPackage,
  type BrainCorePostManualExportItem,
  type BrainCorePostManualExportPackageResponse,
  type BrainCorePostAcceptanceChecklist,
  type BrainCorePostAcceptanceChecklistResponse,
  type BrainCorePostMigrationParityReport,
  type BrainCorePostMigrationParityReportResponse,
  type BrainCorePostRoadmapCheckpoint,
  type BrainCorePostRoadmapCheckpointResponse,
  type BrainCorePostQaStatus,
  type BrainCorePostQaStatusResponse,
  type BrainCorePostFlowFixture,
  type BrainCorePostFlowFixturesResponse,
  type BrainCorePostDraftFixturesResponse,
  type BrainCorePostOrchestratorStatusResponse,
  type BrainCoreStbPipelineStatus,
  type BrainCoreVideoOrchestratorStatus,
  type BrainCoreVideoOrchestratorIntakeResponse,
  type BrainCoreVideoAssetPlanListResponse,
  type BrainCoreVideoDesignPlanListResponse,
  type BrainCoreVideoVoiceoverPlanListResponse,
  type BrainCoreVideoVisualsPlanListResponse,
  type BrainCoreVideoAssemblyPlanListResponse,
  type BrainCoreVideoMetadataPlanListResponse,
  type BrainCoreVideoPublishingPrepPlanListResponse,
  type BrainCoreVideoManualExportPackageListResponse,
  type BrainCoreVideoThumbnailDesignPlanResponse,
  type BrainCoreVideoArchiveLoggingPlanResponse,
  type BrainCoreVideoDesignProviderBoundaryPlanResponse,
  type BrainCoreVideoDesignProviderCredentialIsolationPlanResponse,
  type BrainCoreVideoDesignProviderPromptReviewPolicyPlanResponse,
  type BrainCoreVideoArtifactSandboxProviderHandoffPlanResponse,
  type BrainCoreVideoProviderOutputRedactionPolicyPlanResponse,
  type BrainCoreVideoDesignProviderComplianceChecklistPlanResponse,
  type BrainCoreVideoDesignProviderEnablementReadinessIndexResponse,
  type BrainCoreVideoProviderIntegrationFinalPlanningCheckpointResponse,
  type BrainCoreVideoCredentialStoreImplementationBoundaryPlanResponse,
  type BrainCoreVideoPromptReviewUxImplementationPlanResponse,
  type BrainCoreVideoProviderAuditPersistenceBoundaryPlanResponse,
  type BrainCoreVideoProviderWrapperSecurityReviewPlanResponse,
  type BrainCoreVideoProviderImplementationPhaseStartGateResponse,
  type BrainCoreVideoProviderImplementationReadinessDashboardSummaryResponse,
  type BrainCoreVideoProviderImplementationApprovalPacketResponse,
  type BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryResponse,
  type BrainCoreVideoProviderPlanningSurfaceIndexResponse,
  type BrainCoreVideoCredentialReferenceScaffoldResponse,
  type BrainCoreVideoProviderRequestWrapperScaffoldResponse,
  type BrainCoreVideoProviderWrapperValidationHarnessResponse,
  type BrainCoreVideoProviderRequestEnvelopeScaffoldResponse,
  type BrainCoreVideoProviderResponseEnvelopeScaffoldResponse,
  type BrainCoreVideoProviderScaffoldingIntegrationSummaryResponse,
  type BrainCoreVideoProviderRequestWrapperInertShellResponse,
  type BrainCoreVideoCredentialReferenceValidatorResponse,
  type BrainCoreVideoProviderResponseRedactionSkeletonResponse,
  type BrainCoreVideoProviderAuditEventTypesResponse,
  type BrainCoreVideoProviderDisabledOrchestrationFacadeResponse,
  type BrainCoreVideoProviderCapabilityPolicyEvaluatorResponse,
  type BrainCoreVideoProviderBlockedActionLedgerTypesResponse,
  type BrainCoreVideoProviderDisabledOrchestrationIntegrationSummaryResponse,
  type BrainCoreStbVideoMigrationStatus,
  type BrainCoreStbVideoParityMatrix,
  type BrainCoreStbVideoDualRunStatus,
  type BrainCoreStbVideoDualRunEvidenceResponse,
  type BrainCoreVideoProductionGateResponse,
  type BrainCoreVideoRenderExportPolicyResponse,
  type BrainCoreVideoControlledDryRunDesignResponse,
  type BrainCoreVideoProductionCutoverGateResponse,
  type BrainCoreVideoReleaseCandidateReadinessResponse,
  type BrainCoreVideoOperatorDecisionQueueResponse,
  type BrainCoreVideoControlledExecutionPolicyBoundaryResponse,
  type BrainCoreVideoControlledExecutionReadinessIndexResponse,
  type BrainCoreVideoRoadmapCheckpointResponse,
  type BrainCoreVideoOperatorReviewPacketResponse,
  type BrainCoreVideoControlledExecutionApprovalPayloadSchemaResponse,
  type BrainCoreVideoPreviewCompletionIndexResponse,
  type BrainCoreVideoControlledExecutionPreflightChecklistResponse,
  type BrainCoreVideoControlledExecutionRiskRegisterResponse,
  type BrainCoreVideoControlledExecutionPreflightValidatorSchemaResponse,
  type BrainCoreVideoControlledExecutionPlanStubResponse,
  type BrainCoreVideoControlledExecutionApprovalRequestDesignResponse,
  type BrainCoreVideoControlledExecutionDisabledGateResponse,
  type BrainCoreControlledDualRunRequestDesignResponse,
  type BrainCoreAgentSummary,
  type BrainCoreModelRouterReportDetail,
  type BrainCoreMaintenancePreviewDetail,
  type BrainCoreAgentRunSummary,
  type BrainCoreAgentEventSummary,
  type BrainCoreRecoveryItemSummary,
} from './client.js';
import {
  deriveDashboardSnapshot,
  formatRelativeTime,
  getConnectionStatusColor,
  getAttentionBadgeColor,
  type DashboardSnapshot,
} from './dashboard.js';

export type BrainConsoleSectionId = 'overview' | 'apps' | 'orchestrators' | 'pipelines' | 'projects' | 'reports' | 'posts' | 'agents' | 'recovery';

export interface BrainConsoleViewState {
  status?: BrainCoreStatus;
  capabilities?: BrainCoreCapabilitySummary;
  runtimeReports?: BrainCoreRuntimeReportSummary[];
  videoStatus?: BrainCoreVideoStatus;
  videoQueue?: BrainCoreVideoQueueItem[];
  localApps?: BrainCoreLocalAppSummary[];
  schedulerStatus?: BrainCoreSchedulerStatus;
  schedulerJobs?: BrainCoreSchedulerJobSummary[];
  sessions?: BrainCoreSessionSummary[];
  repos?: BrainCoreRepoSummary[];
  approvals?: BrainCoreApprovalSummary[];
  approvalDetail?: BrainCoreApprovalDetail;
  approvalStore?: BrainCoreApprovalStoreSummary;
  executionPlans?: BrainCoreExecutionPlan[];
  executionReadiness?: BrainCoreExecutionReadiness;
  mindPreviewPolicy?: import('./client.js').BrainCoreMindPreviewPolicy;
  mindPreviews?: import('./client.js').BrainCoreMindPreviewSummary[];
  modelRouterReportDetail?: BrainCoreModelRouterReportDetail;
  maintenancePreviewDetail?: BrainCoreMaintenancePreviewDetail;
  orchestrators?: BrainCoreOrchestratorSummary[];
  pipelines?: BrainCorePipelineSummary[];
  projects?: BrainCoreProjectSummary[];
  platforms?: BrainCorePlatformSummary[];
  probotDashboardParity?: BrainCoreProBotDashboardParityResponse;
  probotSessionsParity?: BrainCoreProBotSessionsParityResponse;
  probotLocalAppsParity?: BrainCoreProBotLocalAppsParityResponse;
  probotSchedulerParity?: BrainCoreProBotSchedulerParityResponse;
  probotStudioParity?: BrainCoreProBotStudioParityResponse;
  probotExternalAdminParity?: BrainCoreProBotExternalAdminParityResponse;
  probotDecommissionReadiness?: BrainCoreProBotDecommissionReadinessResponse;
  probotExternalAdminSafeMetadata?: BrainCoreProBotExternalAdminSafeMetadataResponse;
  probotFeatureParityMatrix?: BrainCoreProBotFeatureParityMatrixResponse;
  probotPhaseOutChecklist?: BrainCoreProBotPhaseOutChecklistResponse;
  postOrchestratorStatus?: BrainCorePostOrchestratorStatusResponse;
  postOrchestratorOverview?: BrainCorePostOrchestratorOverviewResponse;
  postOrchestratorFlows?: BrainCorePostFlowFixturesResponse;
  postOrchestratorDrafts?: BrainCorePostDraftFixturesResponse;
  postOrchestratorEvents?: BrainCorePostEventFixturesResponse;
  postOrchestratorDryRun?: BrainCorePostDryRunPlanResponse;
  postOrchestratorReviewQueue?: BrainCorePostDraftReviewQueueResponse;
  postOrchestratorSchedulePreview?: BrainCorePostSchedulePreviewQueueResponse;
  postOrchestratorAnalytics?: BrainCorePostAnalyticsFixturesResponse;
  postOrchestratorPipeline?: BrainCorePostPipelineSummaryResponse;
  postOrchestratorReadiness?: BrainCorePostReadinessScoreResponse;
  postOrchestratorContracts?: { contracts?: BrainCorePostOrchestratorContract[] };
  postOrchestratorIntegrations?: { integrations?: BrainCorePostOrchestratorIntegration[] };
  postOrchestratorRecovery?: { items?: BrainCorePostOrchestratorRecoveryItem[] };
  postOrchestratorPlatformPolicies?: BrainCorePostPlatformPoliciesResponse;
  postOrchestratorDecommissionReadiness?: BrainCorePostDecommissionReadinessResponse;
  postOrchestratorOperatorGuidance?: BrainCorePostOperatorGuidanceResponse;
  postOrchestratorManualExportPackage?: BrainCorePostManualExportPackageResponse;
  postOrchestratorAcceptanceChecklist?: BrainCorePostAcceptanceChecklistResponse;
  postOrchestratorMigrationParity?: BrainCorePostMigrationParityReportResponse;
  postOrchestratorRoadmapCheckpoint?: BrainCorePostRoadmapCheckpointResponse;
  postOrchestratorQaStatus?: BrainCorePostQaStatusResponse;
  stbStatus?: BrainCoreStbPipelineStatus;
  videoOrchestratorStatus?: BrainCoreVideoOrchestratorStatus;
  videoOrchestratorIntake?: BrainCoreVideoOrchestratorIntakeResponse;
  videoAssetPlans?: BrainCoreVideoAssetPlanListResponse;
  videoDesignPlans?: BrainCoreVideoDesignPlanListResponse;
  videoVoiceoverPlans?: BrainCoreVideoVoiceoverPlanListResponse;
  videoVisualPlans?: BrainCoreVideoVisualsPlanListResponse;
  videoAssemblyPlans?: BrainCoreVideoAssemblyPlanListResponse;
  videoMetadataPlans?: BrainCoreVideoMetadataPlanListResponse;
  videoPublishingPrepPlans?: BrainCoreVideoPublishingPrepPlanListResponse;
  videoManualExportPackages?: BrainCoreVideoManualExportPackageListResponse;
  videoThumbnailDesignPlans?: BrainCoreVideoThumbnailDesignPlanResponse;
  videoArchiveLoggingPlans?: BrainCoreVideoArchiveLoggingPlanResponse;
  videoDesignProviderBoundaryPlans?: BrainCoreVideoDesignProviderBoundaryPlanResponse;
  videoDesignProviderCredentialIsolationPlans?: BrainCoreVideoDesignProviderCredentialIsolationPlanResponse;
  videoDesignProviderPromptReviewPolicyPlans?: BrainCoreVideoDesignProviderPromptReviewPolicyPlanResponse;
  videoArtifactSandboxProviderHandoffPlans?: BrainCoreVideoArtifactSandboxProviderHandoffPlanResponse;
  videoProviderOutputRedactionPolicyPlans?: BrainCoreVideoProviderOutputRedactionPolicyPlanResponse;
  videoDesignProviderComplianceChecklistPlans?: BrainCoreVideoDesignProviderComplianceChecklistPlanResponse;
  videoDesignProviderEnablementReadinessIndex?: BrainCoreVideoDesignProviderEnablementReadinessIndexResponse;
  videoProviderIntegrationFinalPlanningCheckpoint?: BrainCoreVideoProviderIntegrationFinalPlanningCheckpointResponse;
  videoCredentialStoreImplementationBoundaryPlan?: BrainCoreVideoCredentialStoreImplementationBoundaryPlanResponse;
  videoPromptReviewUxImplementationPlan?: BrainCoreVideoPromptReviewUxImplementationPlanResponse;
  videoProviderAuditPersistenceBoundaryPlan?: BrainCoreVideoProviderAuditPersistenceBoundaryPlanResponse;
  videoProviderWrapperSecurityReviewPlan?: BrainCoreVideoProviderWrapperSecurityReviewPlanResponse;
  videoProviderImplementationPhaseStartGate?: BrainCoreVideoProviderImplementationPhaseStartGateResponse;
  videoProviderImplementationReadinessDashboardSummary?: BrainCoreVideoProviderImplementationReadinessDashboardSummaryResponse;
  videoProviderImplementationApprovalPacket?: BrainCoreVideoProviderImplementationApprovalPacketResponse;
  videoProviderApprovalPacketConsoleReviewSummary?: BrainCoreVideoProviderApprovalPacketConsoleReviewSummaryResponse;
  videoProviderPlanningSurfaceIndex?: BrainCoreVideoProviderPlanningSurfaceIndexResponse;
  videoCredentialReferenceScaffold?: BrainCoreVideoCredentialReferenceScaffoldResponse;
  videoProviderRequestWrapperScaffold?: BrainCoreVideoProviderRequestWrapperScaffoldResponse;
  videoProviderWrapperValidationHarness?: BrainCoreVideoProviderWrapperValidationHarnessResponse;
  videoProviderRequestEnvelopeScaffold?: BrainCoreVideoProviderRequestEnvelopeScaffoldResponse;
  videoProviderResponseEnvelopeScaffold?: BrainCoreVideoProviderResponseEnvelopeScaffoldResponse;
  videoProviderScaffoldingIntegrationSummary?: BrainCoreVideoProviderScaffoldingIntegrationSummaryResponse;
  videoProviderRequestWrapperInertShell?: BrainCoreVideoProviderRequestWrapperInertShellResponse;
  videoCredentialReferenceValidator?: BrainCoreVideoCredentialReferenceValidatorResponse;
  videoProviderResponseRedactionSkeleton?: BrainCoreVideoProviderResponseRedactionSkeletonResponse;
  videoProviderAuditEventTypes?: BrainCoreVideoProviderAuditEventTypesResponse;
  videoProviderDisabledOrchestrationFacade?: BrainCoreVideoProviderDisabledOrchestrationFacadeResponse;
  videoProviderCapabilityPolicyEvaluator?: BrainCoreVideoProviderCapabilityPolicyEvaluatorResponse;
  videoProviderBlockedActionLedgerTypes?: BrainCoreVideoProviderBlockedActionLedgerTypesResponse;
  videoProviderDisabledOrchestrationIntegrationSummary?: BrainCoreVideoProviderDisabledOrchestrationIntegrationSummaryResponse;
  stbVideoMigrationStatus?: BrainCoreStbVideoMigrationStatus;
  stbVideoParityMatrix?: BrainCoreStbVideoParityMatrix;
  stbVideoDualRunStatus?: BrainCoreStbVideoDualRunStatus;
  stbVideoDualRunEvidence?: BrainCoreStbVideoDualRunEvidenceResponse;
  videoProductionGate?: BrainCoreVideoProductionGateResponse;
  videoRenderExportPolicy?: BrainCoreVideoRenderExportPolicyResponse;
  videoControlledDryRunDesign?: BrainCoreVideoControlledDryRunDesignResponse;
  videoProductionCutoverGate?: BrainCoreVideoProductionCutoverGateResponse;
  videoReleaseCandidateReadiness?: BrainCoreVideoReleaseCandidateReadinessResponse;
  videoOperatorDecisionQueue?: BrainCoreVideoOperatorDecisionQueueResponse;
  videoControlledExecutionPolicyBoundary?: BrainCoreVideoControlledExecutionPolicyBoundaryResponse;
  videoControlledExecutionReadinessIndex?: BrainCoreVideoControlledExecutionReadinessIndexResponse;
  videoRoadmapCheckpoint?: BrainCoreVideoRoadmapCheckpointResponse;
  videoOperatorReviewPacket?: BrainCoreVideoOperatorReviewPacketResponse;
  videoControlledExecutionApprovalPayloadSchema?: BrainCoreVideoControlledExecutionApprovalPayloadSchemaResponse;
  videoPreviewCompletionIndex?: BrainCoreVideoPreviewCompletionIndexResponse;
  videoControlledExecutionPreflightChecklist?: BrainCoreVideoControlledExecutionPreflightChecklistResponse;
  videoControlledExecutionRiskRegister?: BrainCoreVideoControlledExecutionRiskRegisterResponse;
  videoControlledExecutionPreflightValidatorSchema?: BrainCoreVideoControlledExecutionPreflightValidatorSchemaResponse;
  videoControlledExecutionPlanStub?: BrainCoreVideoControlledExecutionPlanStubResponse;
  videoControlledExecutionApprovalRequestDesign?: BrainCoreVideoControlledExecutionApprovalRequestDesignResponse;
  videoControlledExecutionDisabledGate?: BrainCoreVideoControlledExecutionDisabledGateResponse;
  videoControlledExecutionSecondApprovalPolicy?: import('./client.js').BrainCoreVideoControlledExecutionSecondApprovalPolicyResponse;
  videoControlledExecutionOperatorIdentityProtocol?: import('./client.js').BrainCoreVideoControlledExecutionOperatorIdentityProtocolResponse;
  videoControlledExecutionRolePolicy?: import('./client.js').BrainCoreVideoControlledExecutionRolePolicyResponse;
  controlledDualRunRequestDesign?: BrainCoreControlledDualRunRequestDesignResponse;
  agents?: BrainCoreAgentSummary[];
  actions?: import('./client.js').BrainCoreActionSummary[];
  agentRuns?: import('./client.js').BrainCoreAgentRunSummary[];
  agentEvents?: import('./client.js').BrainCoreAgentEventSummary[];
  recoveryItems?: import('./client.js').BrainCoreRecoveryItemSummary[];
  warning?: string;
  offline?: boolean;
  refreshedAt?: Date;
  brainCoreUrl?: string;
  statusError?: string;
  endpointErrors?: import('./client.js').EndpointError[];
  activeSection?: BrainConsoleSectionId;
  connectionDiagnostics?: BrainCoreConnectionDiagnostic;
}

export async function loadBrainConsoleViewState(
  settings: BrainConsoleSettings = DEFAULT_BRAIN_CONSOLE_SETTINGS,
): Promise<BrainConsoleViewState> {
  const normalized = normalizeBrainCoreUrl(settings.brainCoreUrl);
  const baseUrl = normalized.value;

  const results = await Promise.allSettled([
    readBrainCoreStatus(baseUrl),
    readBrainCoreCapabilities(baseUrl),
    readBrainCoreRuntimeReports(baseUrl),
    readBrainCoreVideoStatus(baseUrl),
    readBrainCoreVideoQueue(baseUrl),
    readBrainCoreLocalApps(baseUrl),
    readBrainCoreSchedulerStatus(baseUrl),
    readBrainCoreSchedulerJobs(baseUrl),
    readBrainCoreSessions(baseUrl),
    readBrainCoreRepos(baseUrl),
    readBrainCoreApprovals(baseUrl),
    readBrainCoreApprovalStore(baseUrl),
    readBrainCoreExecutionPlans(baseUrl),
    readBrainCoreExecutionReadiness(baseUrl),
    readBrainCoreMindPreviewPolicy(baseUrl),
    readBrainCoreMindPreviews(baseUrl),
    readBrainCoreOrchestrators(baseUrl),
    readBrainCorePipelines(baseUrl),
    readBrainCoreProjects(baseUrl),
    readBrainCorePlatforms(baseUrl),
    readBrainCoreProBotDashboardParity(baseUrl),
    readBrainCoreProBotSessionsParity(baseUrl),
    readBrainCoreProBotLocalAppsParity(baseUrl),
    readBrainCoreProBotSchedulerParity(baseUrl),
    readBrainCoreProBotStudioParity(baseUrl),
    readBrainCoreProBotExternalAdminParity(baseUrl),
    readBrainCoreProBotDecommissionReadiness(baseUrl),
    readBrainCoreProBotExternalAdminSafeMetadata(baseUrl),
    readBrainCoreProBotFeatureParityMatrix(baseUrl),
    readBrainCoreProBotPhaseOutChecklist(baseUrl),
    readBrainCorePostOrchestratorStatus(baseUrl),
    readBrainCorePostOrchestratorOverview(baseUrl),
    readBrainCorePostOrchestratorFlows(baseUrl),
    readBrainCorePostOrchestratorDrafts(baseUrl),
    readBrainCorePostOrchestratorEvents(baseUrl),
    readBrainCorePostOrchestratorDryRun(baseUrl, 'github-release-event-fixture'),
    readBrainCorePostDraftReviewQueue(baseUrl, 'github-release-event-fixture'),
    readBrainCorePostSchedulePreviewQueue(baseUrl, 'github-release-event-fixture'),
    readBrainCorePostAnalyticsFixtures(baseUrl),
    readBrainCorePostPipelineSummary(baseUrl, 'github-release-event-fixture'),
    readBrainCorePostReadinessScore(baseUrl, 'github-release-event-fixture'),
    readBrainCorePostPlatformPolicies(baseUrl),
    readBrainCorePostDecommissionReadiness(baseUrl),
    readBrainCorePostOperatorGuidance(baseUrl),
    readBrainCorePostManualExportPackage(baseUrl, 'github-release-event-fixture'),
    readBrainCorePostAcceptanceChecklist(baseUrl),
    readBrainCorePostMigrationParityReport(baseUrl),
    readBrainCorePostRoadmapCheckpoint(baseUrl),
    readBrainCorePostOrchestratorContracts(baseUrl),
    readBrainCorePostOrchestratorIntegrations(baseUrl),
    readBrainCorePostOrchestratorRecovery(baseUrl),
    readBrainCorePostQaStatus(baseUrl),
    readBrainCoreStbStatus(baseUrl),
    readBrainCoreVideoOrchestratorStatus(baseUrl),
    readBrainCoreVideoOrchestratorIntake(baseUrl),
    readBrainCoreVideoOrchestratorAssetPlans(baseUrl),
    readBrainCoreVideoOrchestratorDesignPlans(baseUrl),
    readBrainCoreVideoOrchestratorVoiceoverPlans(baseUrl),
    readBrainCoreVideoOrchestratorVisualsPlans(baseUrl),
    readBrainCoreVideoOrchestratorAssemblyPlans(baseUrl),
    readBrainCoreVideoOrchestratorMetadataPlans(baseUrl),
    readBrainCoreVideoOrchestratorPublishingPrepPlans(baseUrl),
    readBrainCoreVideoOrchestratorManualExportPackages(baseUrl),
    readBrainCoreVideoOrchestratorThumbnailDesignPlans(baseUrl),
    readBrainCoreVideoOrchestratorArchiveLoggingPlans(baseUrl),
    readBrainCoreVideoOrchestratorDesignProviderBoundaryPlans(baseUrl),
    readBrainCoreVideoOrchestratorDesignProviderCredentialIsolationPlans(baseUrl),
    readBrainCoreVideoOrchestratorDesignProviderPromptReviewPolicyPlans(baseUrl),
    readBrainCoreVideoOrchestratorArtifactSandboxProviderHandoffPlans(baseUrl),
    readBrainCoreVideoOrchestratorProviderOutputRedactionPolicyPlans(baseUrl),
    readBrainCoreVideoOrchestratorDesignProviderComplianceChecklistPlans(baseUrl),
    readBrainCoreVideoOrchestratorDesignProviderEnablementReadinessIndex(baseUrl),
    readBrainCoreVideoOrchestratorProviderIntegrationFinalPlanningCheckpoint(baseUrl),
    readBrainCoreVideoOrchestratorCredentialStoreImplementationBoundaryPlan(baseUrl),
    readBrainCoreVideoOrchestratorPromptReviewUxImplementationPlan(baseUrl),
    readBrainCoreVideoOrchestratorProviderAuditPersistenceBoundaryPlan(baseUrl),
    readBrainCoreVideoOrchestratorProviderWrapperSecurityReviewPlan(baseUrl),
    readBrainCoreVideoOrchestratorProviderImplementationPhaseStartGate(baseUrl),
    readBrainCoreVideoOrchestratorCredentialReferenceScaffold(baseUrl),
    readBrainCoreVideoOrchestratorProviderRequestWrapperScaffold(baseUrl),
    readBrainCoreVideoOrchestratorProviderWrapperValidationHarness(baseUrl),
    readBrainCoreVideoOrchestratorProviderRequestEnvelopeScaffold(baseUrl),
    readBrainCoreVideoOrchestratorProviderResponseEnvelopeScaffold(baseUrl),
    readBrainCoreVideoOrchestratorProviderScaffoldingIntegrationSummary(baseUrl),
    readBrainCoreVideoOrchestratorProviderRequestWrapperInertShell(baseUrl),
    readBrainCoreVideoOrchestratorCredentialReferenceValidator(baseUrl),
    readBrainCoreVideoOrchestratorProviderResponseRedactionSkeleton(baseUrl),
    readBrainCoreVideoOrchestratorProviderAuditEventTypes(baseUrl),
    readBrainCoreVideoOrchestratorProviderDisabledOrchestrationFacade(baseUrl),
    readBrainCoreVideoOrchestratorProviderCapabilityPolicyEvaluator(baseUrl),
    readBrainCoreVideoOrchestratorProviderBlockedActionLedgerTypes(baseUrl),
    readBrainCoreVideoOrchestratorProviderDisabledOrchestrationIntegrationSummary(baseUrl),
    readBrainCoreStbVideoMigrationStatus(baseUrl),
    readBrainCoreStbVideoParityMatrix(baseUrl),
    readBrainCoreStbVideoDualRunStatus(baseUrl),
    readBrainCoreStbVideoDualRunEvidence(baseUrl),
    readBrainCoreVideoProductionGate(baseUrl),
    readBrainCoreVideoRenderExportPolicy(baseUrl),
    readBrainCoreVideoControlledDryRunDesign(baseUrl),
    readBrainCoreVideoProductionCutoverGate(baseUrl),
    readBrainCoreVideoReleaseCandidateReadiness(baseUrl),
    readBrainCoreVideoOperatorDecisionQueue(baseUrl),
    readBrainCoreVideoControlledExecutionPolicyBoundary(baseUrl),
    readBrainCoreVideoControlledExecutionReadinessIndex(baseUrl),
    readBrainCoreVideoRoadmapCheckpoint(baseUrl),
    readBrainCoreVideoOperatorReviewPacket(baseUrl),
    readBrainCoreVideoControlledExecutionApprovalPayloadSchema(baseUrl),
    readBrainCoreVideoPreviewCompletionIndex(baseUrl),
    readBrainCoreVideoControlledExecutionPreflightChecklist(baseUrl),
    readBrainCoreVideoControlledExecutionRiskRegister(baseUrl),
    readBrainCoreVideoControlledExecutionPreflightValidatorSchema(baseUrl),
    readBrainCoreVideoControlledExecutionPlanStub(baseUrl),
    readBrainCoreVideoControlledExecutionApprovalRequestDesign(baseUrl),
    readBrainCoreVideoControlledExecutionDisabledGate(baseUrl),
    readBrainCoreVideoControlledExecutionSecondApprovalPolicy(baseUrl),
    readBrainCoreVideoControlledExecutionOperatorIdentityProtocol(baseUrl),
    readBrainCoreVideoControlledExecutionRolePolicy(baseUrl),
    readBrainCoreControlledDualRunRequestDesign(baseUrl),
    readBrainCoreAgents(baseUrl),
    readBrainCoreActions(baseUrl),
    readBrainCoreModelRouterReportDetail(baseUrl),
    readBrainCoreAgentRuns(baseUrl),
    readBrainCoreAgentEvents(baseUrl),
    readBrainCoreRecoveryItems(baseUrl),
  ]);

  const settledValues = withSafeEndpointPadding(
    results.map((result) => result.status === 'fulfilled' ? result.value : { value: undefined, error: result.reason }),
    160,
  );

  const [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, probotDashboardParity, probotSessionsParity, probotLocalAppsParity, probotSchedulerParity, probotStudioParity, probotExternalAdminParity, probotDecommissionReadiness, probotExternalAdminSafeMetadata, probotFeatureParityMatrix, probotPhaseOutChecklist, postOrchestratorStatus, postOrchestratorOverview, postOrchestratorFlows, postOrchestratorDrafts, postOrchestratorEvents, postOrchestratorDryRun, postOrchestratorReviewQueue, postOrchestratorSchedulePreview, postOrchestratorAnalytics, postOrchestratorPipeline, postOrchestratorReadiness, postOrchestratorPlatformPolicies, postOrchestratorDecommissionReadiness, postOrchestratorOperatorGuidance, postOrchestratorManualExportPackage, postOrchestratorAcceptanceChecklist, postOrchestratorMigrationParity, postOrchestratorRoadmapCheckpoint, postOrchestratorContracts, postOrchestratorIntegrations, postOrchestratorRecovery, postOrchestratorQaStatus, stbStatus, videoOrchestratorStatus, videoOrchestratorIntake, videoAssetPlans, videoDesignPlans, videoVoiceoverPlans, videoVisualPlans, videoAssemblyPlans, videoMetadataPlans, videoPublishingPrepPlans, videoManualExportPackages, videoThumbnailDesignPlans, videoArchiveLoggingPlans, videoDesignProviderBoundaryPlans, videoDesignProviderCredentialIsolationPlans, videoDesignProviderPromptReviewPolicyPlans, videoArtifactSandboxProviderHandoffPlans, videoProviderOutputRedactionPolicyPlans, videoDesignProviderComplianceChecklistPlans, videoDesignProviderEnablementReadinessIndex, videoProviderIntegrationFinalPlanningCheckpoint, videoCredentialStoreImplementationBoundaryPlan, videoPromptReviewUxImplementationPlan, videoProviderAuditPersistenceBoundaryPlan, videoProviderWrapperSecurityReviewPlan, videoProviderImplementationPhaseStartGate, videoProviderImplementationReadinessDashboardSummary, videoProviderImplementationApprovalPacket, videoProviderApprovalPacketConsoleReviewSummary, videoProviderPlanningSurfaceIndex, videoCredentialReferenceScaffold, videoProviderRequestWrapperScaffold, videoProviderWrapperValidationHarness, videoProviderRequestEnvelopeScaffold, videoProviderResponseEnvelopeScaffold, videoProviderScaffoldingIntegrationSummary, videoProviderRequestWrapperInertShell, videoCredentialReferenceValidator, videoProviderResponseRedactionSkeleton, videoProviderAuditEventTypes, videoProviderDisabledOrchestrationFacade, videoProviderCapabilityPolicyEvaluator, videoProviderBlockedActionLedgerTypes, videoProviderDisabledOrchestrationIntegrationSummary, stbVideoMigrationStatus, stbVideoParityMatrix, stbVideoDualRunStatus, stbVideoDualRunEvidence, videoProductionGate, videoRenderExportPolicy, videoControlledDryRunDesign, videoProductionCutoverGate, videoReleaseCandidateReadiness, videoOperatorDecisionQueue, videoControlledExecutionPolicyBoundary, videoControlledExecutionReadinessIndex, videoRoadmapCheckpoint, videoOperatorReviewPacket, videoControlledExecutionApprovalPayloadSchema, videoPreviewCompletionIndex, videoControlledExecutionPreflightChecklist, videoControlledExecutionRiskRegister, videoControlledExecutionPreflightValidatorSchema, videoControlledExecutionPlanStub, videoControlledExecutionApprovalRequestDesign, videoControlledExecutionDisabledGate, videoControlledExecutionSecondApprovalPolicy, videoControlledExecutionOperatorIdentityProtocol, videoControlledExecutionRolePolicy, controlledDualRunRequestDesign, agents, actions, modelRouterReportDetail, agentRuns, agentEvents, recoveryItems] = settledValues as any[];

  let approvalDetail: import('./client.js').BrainCoreApprovalDetail | undefined;
  const latestApprovalId = approvals.value?.approvals?.[0]?.id;
  if (latestApprovalId) {
    const approvalDetailResult = await readBrainCoreApprovalDetail(baseUrl, latestApprovalId);
    approvalDetail = approvalDetailResult.value?.approval;
  }

  let maintenancePreviewDetail: BrainCoreMaintenancePreviewDetail | undefined;
  const latestMaintenanceId = mindPreviews.value?.previews?.[0]?.id;
  if (latestMaintenanceId) {
    const maintenanceDetailResult = await readBrainCoreMaintenancePreviewDetail(baseUrl, latestMaintenanceId);
    maintenancePreviewDetail = maintenanceDetailResult.value?.preview;
  }

  const offline = [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, probotDashboardParity, probotSessionsParity, probotLocalAppsParity, probotSchedulerParity, probotStudioParity, probotExternalAdminParity, probotDecommissionReadiness, probotExternalAdminSafeMetadata, probotFeatureParityMatrix, probotPhaseOutChecklist, postOrchestratorStatus, postOrchestratorOverview, postOrchestratorFlows, postOrchestratorDrafts, postOrchestratorEvents, postOrchestratorDryRun, postOrchestratorReviewQueue, postOrchestratorSchedulePreview, postOrchestratorAnalytics, postOrchestratorPipeline, postOrchestratorReadiness, postOrchestratorPlatformPolicies, postOrchestratorDecommissionReadiness, postOrchestratorOperatorGuidance, postOrchestratorManualExportPackage, postOrchestratorAcceptanceChecklist, postOrchestratorMigrationParity, postOrchestratorRoadmapCheckpoint, postOrchestratorContracts, postOrchestratorIntegrations, postOrchestratorRecovery, postOrchestratorQaStatus, stbStatus, videoOrchestratorStatus, videoOrchestratorIntake, videoAssetPlans, videoDesignPlans, videoVoiceoverPlans, videoVisualPlans, videoAssemblyPlans, videoMetadataPlans, videoPublishingPrepPlans, videoManualExportPackages, videoThumbnailDesignPlans, videoArchiveLoggingPlans, videoDesignProviderBoundaryPlans, stbVideoMigrationStatus, stbVideoParityMatrix, stbVideoDualRunStatus, stbVideoDualRunEvidence, videoProductionGate, videoRenderExportPolicy, videoControlledDryRunDesign, videoProductionCutoverGate, videoReleaseCandidateReadiness, videoOperatorDecisionQueue, videoControlledExecutionPolicyBoundary, videoControlledExecutionReadinessIndex, videoRoadmapCheckpoint, videoOperatorReviewPacket, videoControlledExecutionApprovalPayloadSchema, videoPreviewCompletionIndex, videoControlledExecutionPreflightChecklist, videoControlledExecutionRiskRegister, videoControlledExecutionPreflightValidatorSchema, videoControlledExecutionPlanStub, videoControlledExecutionSecondApprovalPolicy, videoControlledExecutionOperatorIdentityProtocol, videoControlledExecutionRolePolicy, controlledDualRunRequestDesign, agents, actions, agentRuns, agentEvents, recoveryItems].every(
    (result) => result.value === undefined,
  );

  // Collect endpoint errors for diagnostics
  const endpointErrors: import('./client.js').EndpointError[] = [];
  [
    { name: '/status', result: status },
    { name: '/runtime/reports', result: runtimeReports },
    { name: '/scheduler/status', result: schedulerStatus },
  ].forEach(({ name, result }) => {
    if ((result as any).error) {
      endpointErrors.push({
        pathname: name,
        error: (result as any).error,
        detail: (result as any).detail,
        status: (result as any).status,
        url: (result as any).url,
      });
    }
  });

  // Gather connection diagnostics
  const connectionDiagnostics = await diagnoseBrainCoreConnection(baseUrl);

  return {
    status: status.value,
    capabilities: capabilities.value,
    runtimeReports: runtimeReports.value?.reports,
    videoStatus: videoStatus.value,
    videoQueue: videoQueue.value?.queue,
    localApps: localApps.value?.apps,
    schedulerStatus: schedulerStatus.value,
    schedulerJobs: schedulerJobs.value?.jobs,
    sessions: sessions.value?.sessions,
    repos: repos.value?.repos,
    approvals: approvals.value?.approvals,
    approvalDetail,
    approvalStore: approvalStore.value,
    executionPlans: executionPlans.value?.plans,
    executionReadiness: executionReadiness.value,
    mindPreviewPolicy: mindPreviewPolicy.value,
    mindPreviews: mindPreviews.value?.previews,
    modelRouterReportDetail: modelRouterReportDetail.value?.report,
    maintenancePreviewDetail,
    orchestrators: orchestrators.value?.orchestrators,
    pipelines: pipelines.value?.pipelines,
    projects: projects.value?.projects,
    platforms: platforms.value?.platforms,
    probotDashboardParity: probotDashboardParity.value,
    probotSessionsParity: probotSessionsParity.value,
    probotLocalAppsParity: probotLocalAppsParity.value,
    probotSchedulerParity: probotSchedulerParity.value,
    probotStudioParity: probotStudioParity.value,
    probotExternalAdminParity: probotExternalAdminParity.value,
    probotDecommissionReadiness: probotDecommissionReadiness.value,
    probotExternalAdminSafeMetadata: probotExternalAdminSafeMetadata.value,
    probotFeatureParityMatrix: probotFeatureParityMatrix.value,
    probotPhaseOutChecklist: probotPhaseOutChecklist.value,
    postOrchestratorStatus: postOrchestratorStatus.value,
    postOrchestratorOverview: postOrchestratorOverview.value,
    postOrchestratorFlows: postOrchestratorFlows.value,
    postOrchestratorDrafts: postOrchestratorDrafts.value,
    postOrchestratorEvents: postOrchestratorEvents.value,
    postOrchestratorDryRun: postOrchestratorDryRun.value,
    postOrchestratorReviewQueue: postOrchestratorReviewQueue.value,
    postOrchestratorSchedulePreview: postOrchestratorSchedulePreview.value,
    postOrchestratorAnalytics: postOrchestratorAnalytics.value,
    postOrchestratorPipeline: postOrchestratorPipeline.value,
    postOrchestratorReadiness: postOrchestratorReadiness.value,
    postOrchestratorPlatformPolicies: postOrchestratorPlatformPolicies.value,
    postOrchestratorDecommissionReadiness: postOrchestratorDecommissionReadiness.value,
    postOrchestratorOperatorGuidance: postOrchestratorOperatorGuidance.value,
    postOrchestratorManualExportPackage: postOrchestratorManualExportPackage.value,
    postOrchestratorAcceptanceChecklist: postOrchestratorAcceptanceChecklist.value,
    postOrchestratorMigrationParity: postOrchestratorMigrationParity.value,
    postOrchestratorRoadmapCheckpoint: postOrchestratorRoadmapCheckpoint.value,
    postOrchestratorQaStatus: postOrchestratorQaStatus.value,
    postOrchestratorContracts: postOrchestratorContracts.value,
    postOrchestratorIntegrations: postOrchestratorIntegrations.value,
    postOrchestratorRecovery: postOrchestratorRecovery.value,
    stbStatus: stbStatus.value,
    videoOrchestratorStatus: videoOrchestratorStatus.value,
    videoOrchestratorIntake: videoOrchestratorIntake.value,
    videoAssetPlans: videoAssetPlans.value,
    videoDesignPlans: videoDesignPlans.value,
    videoVoiceoverPlans: videoVoiceoverPlans.value,
    videoVisualPlans: videoVisualPlans.value,
    videoAssemblyPlans: videoAssemblyPlans.value,
    videoMetadataPlans: videoMetadataPlans.value,
    videoPublishingPrepPlans: videoPublishingPrepPlans.value,
    videoManualExportPackages: videoManualExportPackages.value,
    videoThumbnailDesignPlans: videoThumbnailDesignPlans.value,
    videoArchiveLoggingPlans: videoArchiveLoggingPlans.value,
    videoDesignProviderBoundaryPlans: videoDesignProviderBoundaryPlans.value,
    videoDesignProviderCredentialIsolationPlans: videoDesignProviderCredentialIsolationPlans.value,
    videoDesignProviderPromptReviewPolicyPlans: videoDesignProviderPromptReviewPolicyPlans.value,
    videoArtifactSandboxProviderHandoffPlans: videoArtifactSandboxProviderHandoffPlans.value,
    videoProviderOutputRedactionPolicyPlans: videoProviderOutputRedactionPolicyPlans.value,
    videoDesignProviderComplianceChecklistPlans: videoDesignProviderComplianceChecklistPlans.value,
    videoDesignProviderEnablementReadinessIndex: videoDesignProviderEnablementReadinessIndex.value,
    videoProviderIntegrationFinalPlanningCheckpoint: videoProviderIntegrationFinalPlanningCheckpoint.value,
    videoCredentialStoreImplementationBoundaryPlan: videoCredentialStoreImplementationBoundaryPlan.value,
    videoPromptReviewUxImplementationPlan: videoPromptReviewUxImplementationPlan.value,
    videoProviderAuditPersistenceBoundaryPlan: videoProviderAuditPersistenceBoundaryPlan.value,
    videoProviderWrapperSecurityReviewPlan: videoProviderWrapperSecurityReviewPlan.value,
    videoProviderImplementationPhaseStartGate: videoProviderImplementationPhaseStartGate.value,
    videoProviderImplementationReadinessDashboardSummary: videoProviderImplementationReadinessDashboardSummary.value,
    videoProviderImplementationApprovalPacket: videoProviderImplementationApprovalPacket.value,
    videoProviderApprovalPacketConsoleReviewSummary: videoProviderApprovalPacketConsoleReviewSummary.value,
    videoProviderPlanningSurfaceIndex: videoProviderPlanningSurfaceIndex.value,
    videoCredentialReferenceScaffold: videoCredentialReferenceScaffold.value,
    videoProviderRequestWrapperScaffold: videoProviderRequestWrapperScaffold.value,
    videoProviderWrapperValidationHarness: videoProviderWrapperValidationHarness.value,
  videoProviderRequestEnvelopeScaffold: videoProviderRequestEnvelopeScaffold.value,
  videoProviderResponseEnvelopeScaffold: videoProviderResponseEnvelopeScaffold.value,
  videoProviderScaffoldingIntegrationSummary: videoProviderScaffoldingIntegrationSummary.value,
  videoProviderRequestWrapperInertShell: videoProviderRequestWrapperInertShell.value,
  videoCredentialReferenceValidator: videoCredentialReferenceValidator.value,
  videoProviderResponseRedactionSkeleton: videoProviderResponseRedactionSkeleton.value,
  videoProviderAuditEventTypes: videoProviderAuditEventTypes.value,
  videoProviderDisabledOrchestrationFacade: videoProviderDisabledOrchestrationFacade.value,
  videoProviderCapabilityPolicyEvaluator: videoProviderCapabilityPolicyEvaluator.value,
  videoProviderBlockedActionLedgerTypes: videoProviderBlockedActionLedgerTypes.value,
  videoProviderDisabledOrchestrationIntegrationSummary: videoProviderDisabledOrchestrationIntegrationSummary.value,
    stbVideoMigrationStatus: stbVideoMigrationStatus.value,
    stbVideoParityMatrix: stbVideoParityMatrix.value,
    stbVideoDualRunStatus: stbVideoDualRunStatus.value,
    stbVideoDualRunEvidence: stbVideoDualRunEvidence.value,
    videoProductionGate: videoProductionGate.value,
    videoRenderExportPolicy: videoRenderExportPolicy.value,
    videoControlledDryRunDesign: videoControlledDryRunDesign.value,
    videoProductionCutoverGate: videoProductionCutoverGate.value,
    videoReleaseCandidateReadiness: videoReleaseCandidateReadiness.value,
    videoOperatorDecisionQueue: videoOperatorDecisionQueue.value,
    videoControlledExecutionPolicyBoundary: videoControlledExecutionPolicyBoundary.value,
    videoControlledExecutionReadinessIndex: videoControlledExecutionReadinessIndex.value,
    videoRoadmapCheckpoint: videoRoadmapCheckpoint.value,
    videoOperatorReviewPacket: videoOperatorReviewPacket.value,
    videoControlledExecutionApprovalPayloadSchema: videoControlledExecutionApprovalPayloadSchema.value,
    videoPreviewCompletionIndex: videoPreviewCompletionIndex.value,
    videoControlledExecutionPreflightChecklist: videoControlledExecutionPreflightChecklist.value,
    videoControlledExecutionRiskRegister: videoControlledExecutionRiskRegister.value,
    videoControlledExecutionPreflightValidatorSchema: videoControlledExecutionPreflightValidatorSchema.value,
    videoControlledExecutionPlanStub: videoControlledExecutionPlanStub.value,
    videoControlledExecutionApprovalRequestDesign: videoControlledExecutionApprovalRequestDesign.value,
    videoControlledExecutionDisabledGate: videoControlledExecutionDisabledGate.value,
    videoControlledExecutionSecondApprovalPolicy: videoControlledExecutionSecondApprovalPolicy.value,
    videoControlledExecutionOperatorIdentityProtocol: videoControlledExecutionOperatorIdentityProtocol.value,
    videoControlledExecutionRolePolicy: videoControlledExecutionRolePolicy.value,
    controlledDualRunRequestDesign: controlledDualRunRequestDesign.value,
    agents: agents.value?.agents,
    actions: actions.value?.actions,
    agentRuns: agentRuns.value?.runs,
    agentEvents: agentEvents.value?.events,
    recoveryItems: recoveryItems.value?.items,
    warning: normalized.warning ?? normalized.error,
    offline,
    refreshedAt: new Date(),
    brainCoreUrl: baseUrl,
    statusError: status.error,
    endpointErrors: endpointErrors.length > 0 ? endpointErrors : undefined,
    connectionDiagnostics,
  };
}

function withSafeEndpointPadding<T>(values: T[], minimumLength: number): Array<T | { value: undefined }> {
  const padded: Array<T | { value: undefined }> = [...values];
  while (padded.length < minimumLength) {
    padded.push({ value: undefined });
  }
  return padded;
}

interface SectionTabConfig {
  id: BrainConsoleSectionId;
  label: string;
  icon: string;
}

const SECTION_TABS: SectionTabConfig[] = [
  { id: 'overview', label: 'Overview', icon: '◆' },
  { id: 'apps', label: 'Apps', icon: '■' },
  { id: 'orchestrators', label: 'Orchestrators', icon: '▲' },
  { id: 'pipelines', label: 'Pipelines', icon: '→' },
  { id: 'projects', label: 'Projects', icon: '◉' },
  { id: 'reports', label: 'Reports', icon: '📋' },
  { id: 'posts', label: 'Posts', icon: '✦' },
  { id: 'agents', label: 'Agents', icon: '◈' },
  { id: 'recovery', label: 'Recovery', icon: '⚠' },
];

export function renderBrainConsoleView(
  container: HTMLElement,
  state: BrainConsoleViewState,
  settings: BrainConsoleSettings,
  onRefresh?: () => void,
): void {
  container.empty();
  container.addClass('brain-console');

  try {
    const snapshot = deriveDashboardSnapshot(state, settings.brainCoreUrl);
    const activeSection = state.activeSection ?? 'overview';

    const shell = container.createDiv({ cls: 'brain-console__shell' });

    // Native card UI header
    renderNativeHeader(shell, state, onRefresh);

    // Main content area
    if (snapshot.connectionStatus === 'offline') {
      renderOfflineState(shell, state.brainCoreUrl || settings.brainCoreUrl, state.statusError, state.endpointErrors);
    } else {
      // Section tabs
      renderSectionTabs(shell, activeSection);

      // Active section content
      renderActiveSectionContent(shell, activeSection, state, snapshot, settings);

      // Diagnostics panel
      renderDiagnosticsPanel(shell, state);
    }
  } catch (error) {
    // Emergency fallback: render minimal safe dashboard
    container.empty();
    const fallback = container.createDiv({ cls: 'brain-console__emergency-fallback' });
    fallback.createEl('h2', { text: 'Brain Console Error' });
    fallback.createEl('p', { text: `Build: ${(window as any).BRAIN_CONSOLE_BUILD_ID || 'unknown'}` });
    fallback.createEl('p', { text: `Error: Dashboard render failed. Please restart Obsidian or click Manual refresh after Brain Core starts.` });
    if (state.brainCoreUrl || settings.brainCoreUrl) {
      fallback.createEl('p', { text: `Brain Core URL: ${state.brainCoreUrl || settings.brainCoreUrl}` });
    }
    if (error instanceof Error) {
      fallback.createEl('p', { cls: 'brain-console__error-detail', text: `Details: ${error.message}` });
    }
  }
}

function renderNativeHeader(shell: HTMLElement, state: BrainConsoleViewState, onRefresh?: () => void): void {
  const header = shell.createDiv({ cls: 'brain-console__native-header' });

  const title = header.createEl('h1', { text: 'Brain Console' });
  title.addClass('brain-console__title');

  const controls = header.createDiv({ cls: 'brain-console__header-controls' });

  const meta = header.createDiv({ cls: 'brain-console__header-meta' });
  meta.createEl('span', { cls: 'brain-console__header-meta-item', text: `Build: brain-console-main-dashboard-2026-05-19-01` });
  meta.createEl('span', { cls: 'brain-console__header-meta-item', text: `View mode: Main workspace dashboard` });
  meta.createEl('span', { cls: 'brain-console__header-meta-item', text: `Brain Core URL: ${(window as any).BRAIN_CONSOLE_SELECTED_URL || state.brainCoreUrl || 'unknown'}` });
  meta.createEl('span', { cls: 'brain-console__header-meta-item', text: `Selected URL: ${(window as any).BRAIN_CONSOLE_SELECTED_URL || state.brainCoreUrl || 'unknown'}` });

  const buildMarker = controls.createEl('span', { cls: 'brain-console__build-marker' });
  buildMarker.textContent = `Build: ${(window as any).BRAIN_CONSOLE_BUILD_ID || 'unknown'}`;

  const refreshBtn = controls.createEl('button', { text: '↻ Refresh' });
  refreshBtn.addClass('brain-console__refresh-btn');
  refreshBtn.setAttribute('type', 'button');
  if (onRefresh) {
    refreshBtn.addEventListener('click', () => onRefresh());
  }

  const online = state.status?.ok === true;
  const status = controls.createEl('span', { cls: 'brain-console__header-status' });
  status.textContent = online ? '● Online' : '○ Offline';
  status.addClass(online ? 'online' : 'offline');
}

function renderSectionTabs(shell: HTMLElement, activeSection: BrainConsoleSectionId): void {
  const tabBar = shell.createDiv({ cls: 'brain-console__section-tabs' });

  for (const tab of SECTION_TABS) {
    const btn = tabBar.createEl('button', { cls: 'brain-console__section-tab' });
    if (tab.id === activeSection) {
      btn.addClass('active');
    }
    btn.setAttribute('data-section-id', tab.id);
    btn.setAttribute('title', tab.label);
    btn.createEl('span', { cls: 'brain-console__tab-icon', text: tab.icon });
    btn.createEl('span', { cls: 'brain-console__tab-label', text: tab.label });
  }
}

function renderActiveSectionContent(
  shell: HTMLElement,
  activeSection: BrainConsoleSectionId,
  state: BrainConsoleViewState,
  snapshot: DashboardSnapshot,
  settings: BrainConsoleSettings,
): void {
  const content = shell.createDiv({ cls: 'brain-console__section-content' });

  try {
    switch (activeSection) {
      case 'overview':
        renderOverviewSection(content, state, snapshot);
        break;
      case 'apps':
        renderAppsSection(content, state, snapshot);
        break;
      case 'orchestrators':
        renderOrchestratorsSection(content, state, snapshot);
        break;
      case 'pipelines':
        renderPipelinesSection(content, state, snapshot);
        break;
      case 'projects':
        renderProjectsSection(content, state, snapshot);
        break;
      case 'reports':
        renderReportsSection(content, state, snapshot);
        break;
      case 'posts':
        renderPostOrchestratorSection(content, state, snapshot);
        break;
      case 'agents':
        renderAgentsSection(content, state, snapshot);
        break;
      case 'recovery':
        renderRecoverySection(content, state, snapshot);
        break;
    }
  } catch (error) {
    console.error(`Brain Console section ${activeSection} failed to render`, error);
    content.empty();
    const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });
    renderCard(grid, `${activeSection} unavailable`, renderSectionFallbackCard(activeSection, error));
  }
}

function renderSectionFallbackCard(sectionId: BrainConsoleSectionId, error: unknown): HTMLElement {
  const container = document.createElement('div');
  container.addClass('brain-console__card-content');
  container.createEl('p', { text: `The ${sectionId} section could not render, so Brain Console kept the dashboard alive instead of crashing.` });
  container.createEl('p', { cls: 'brain-console__detail', text: `Build: ${(window as any).BRAIN_CONSOLE_BUILD_ID || 'unknown'}` });
  container.createEl('p', { cls: 'brain-console__detail', text: 'Use Refresh after Brain Core is online. This section is read-only and no actions were executed.' });
  if (error instanceof Error) {
    container.createEl('p', { cls: 'brain-console__error-detail', text: error.message });
  }
  return container;
}

/** Helper: safely render card content, catching and displaying any exceptions */
function renderSafeCard(
  title: string,
  renderFn: () => HTMLElement,
): HTMLElement {
  try {
    return renderFn();
  } catch (error) {
    const container = document.createElement('div');
    container.className = 'brain-console__card-content brain-console__card-error';
    const errorDiv = container.createDiv();
    errorDiv.createEl('p', { text: `${title} failed to render` });
    if (error instanceof Error) {
      errorDiv.createEl('p', { cls: 'brain-console__error-detail', text: error.message });
    }
    return container;
  }
}

// Safe data accessors for defensive rendering
function safeText(value: any, fallback = 'Unavailable'): string {
  return typeof value === 'string' ? value : fallback;
}

function safeNumber(value: any, fallback = 0): number {
  return typeof value === 'number' ? value : fallback;
}

function safeArray<T>(value: T[] | undefined | null): T[] {
  return Array.isArray(value) ? value : [];
}

function safeBool(value: any, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function safeCount(items: any[] | undefined | null): number {
  return Array.isArray(items) ? items.length : 0;
}

function renderOverviewSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });
  renderCard(grid, 'Plugin Install Verification', renderInstallVerificationCard(state));

  // Connection diagnostics (always show, even if Brain Core unreachable)
  renderCard(grid, 'Brain Core Connection Diagnostics', renderBrainCoreConnectionDiagnosticsCard(state));

  // What needs attention
  renderCard(grid, 'What Needs Attention', renderWhatNeedsAttentionCard(state, snapshot));

  // Next safe step
  renderCard(grid, 'Next Safe Step', renderNextSafeStepCard(state, snapshot));

  // Production Status
  renderCard(grid, 'Production Status', renderProductionStatusCard(state));

  // ProBot Migration dashboard section (full width)
  const probotSection = grid.createDiv({ cls: 'brain-console__section-header' });
  probotSection.createEl('h2', { text: 'ProBot Migration' });
  probotSection.createEl('p', { cls: 'brain-console__section-subtitle', text: 'Read-only replacement dashboard for ProBot features.' });

  // ProBot dashboard migration parity (full width command center)
  const probotCard = grid.createDiv({ cls: 'brain-console__card brain-console__card--prominent' });
  const probotHeader = probotCard.createDiv({ cls: 'brain-console__card-header' });
  probotHeader.createEl('h3', { text: 'ProBot → Brain Console Parity: Command Center' });
  probotCard.appendChild(renderProBotDashboardParityCard(state));

  // ProBot functional parity details (6 cards)
  renderCard(grid, 'Sessions & Continuations', renderProBotSessionsParityCard(state));
  renderCard(grid, 'Local Apps', renderProBotLocalAppsParityCard(state));
  renderCard(grid, 'Scheduler', renderProBotSchedulerParityCard(state));
  renderCard(grid, 'Studio (Video/Viral Flow)', renderProBotStudioParityCard(state));
  renderCard(grid, 'External Integrations (Admin-only)', renderProBotExternalAdminParityCard(state));
  renderCard(grid, 'Decommission Readiness', renderProBotDecommissionReadinessCard(state));

  // ProBot gap-closure and phase-out details (3 cards for final readiness tracking)
  renderCard(grid, 'External Admin Safe Metadata', renderSafeCard('External Admin Safe Metadata', () => renderProBotExternalAdminSafeMetadataCard(state)));
  renderCard(grid, 'ProBot Feature Parity Matrix', renderSafeCard('ProBot Feature Parity Matrix', () => renderProBotFeatureParityMatrixCard(state)));
  renderCard(grid, 'ProBot Phase-Out Checklist', renderSafeCard('ProBot Phase-Out Checklist', () => renderProBotPhaseOutChecklistCard(state)));

  // Recent sessions/continuations
  renderCard(grid, 'Recent Sessions', renderRecentSessionsCard(state));

  // Metric counts
  renderCard(grid, 'Metrics', renderOverviewMetricsCard(snapshot));

  // Status overview
  renderCard(grid, 'Status', renderOverviewStatusCard(state));

  // Production Blockers
  renderCard(grid, 'Production Blockers', renderProductionBlockersCard(state));

  // Video Orchestrator readiness
  renderCard(grid, 'Video Readiness', renderVideoReadinessCard(state));
}

function renderAppsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Brain Core', renderBrainCoreCard(state));
  renderCard(grid, 'Scheduler', renderSchedulerCard(state));
  renderCard(grid, 'Local Apps', renderLocalAppsCard(state));
}

function renderOrchestratorsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Orchestrators', renderOrchestratorsCard(state, snapshot));

  const videoOrch = state.orchestrators?.find(o => o.id === 'video-orchestrator');
  if (videoOrch) {
    renderCard(grid, 'Video Orchestrator', renderVideoOrchestratorCard(state, snapshot));
  }
}

function renderPipelinesSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Pipelines', renderPipelinesCard(state, snapshot));
  renderCard(grid, 'Design Provider Credential Isolation', renderVideoDesignProviderCredentialIsolationPlanCard(state, snapshot));
  renderCard(grid, 'Design Provider Prompt Review', renderVideoDesignProviderPromptReviewPolicyPlanCard(state, snapshot));
  renderCard(grid, 'Artifact Sandbox Provider Handoff', renderVideoArtifactSandboxProviderHandoffPlanCard(state, snapshot));
  renderCard(grid, 'Provider Output Redaction Policy', renderVideoProviderOutputRedactionPolicyPlanCard(state, snapshot));
  renderCard(grid, 'Design Provider Compliance Checklist', renderVideoDesignProviderComplianceChecklistPlanCard(state, snapshot));
  renderCard(grid, 'Design Provider Enablement Readiness', renderVideoDesignProviderEnablementReadinessIndexCard(state, snapshot));
  renderCard(grid, 'Provider Integration Final Checkpoint', renderVideoProviderIntegrationFinalPlanningCheckpointCard(state, snapshot));
  renderCard(grid, 'Credential Store Boundary Plan', renderVideoCredentialStoreImplementationBoundaryPlanCard(state, snapshot));
  renderCard(grid, 'Prompt Review UX Plan', renderVideoPromptReviewUxImplementationPlanCard(state, snapshot));
  renderCard(grid, 'Provider Audit Persistence Boundary', renderVideoProviderAuditPersistenceBoundaryPlanCard(state, snapshot));
  renderCard(grid, 'Provider Wrapper Security Review', renderVideoProviderWrapperSecurityReviewPlanCard(state, snapshot));
  renderCard(grid, 'Provider Implementation Start Gate', renderVideoProviderImplementationPhaseStartGateCard(state, snapshot));
  renderCard(grid, 'Provider Implementation Readiness', renderVideoProviderImplementationReadinessDashboardSummaryCard(state, snapshot));
  renderCard(grid, 'Provider Implementation Approval Packet', renderVideoProviderImplementationApprovalPacketCard(state, snapshot));
  renderCard(grid, 'Provider Approval Packet Review', renderVideoProviderApprovalPacketConsoleReviewSummaryCard(state, snapshot));
  renderCard(grid, 'Provider Planning Surface Index', renderVideoProviderPlanningSurfaceIndexCard(state, snapshot));
  renderCard(grid, 'Credential Reference Scaffold', renderVideoCredentialReferenceScaffoldCard(state, snapshot));
  renderCard(grid, 'Provider Request Wrapper Scaffold', renderVideoProviderRequestWrapperScaffoldCard(state, snapshot));
  renderCard(grid, 'Provider Wrapper Validation Harness', renderVideoProviderWrapperValidationHarnessCard(state, snapshot));
  renderCard(grid, 'Provider Request Envelope Scaffold', renderVideoProviderRequestEnvelopeScaffoldCard(state, snapshot));
  renderCard(grid, 'Provider Response Envelope Scaffold', renderVideoProviderResponseEnvelopeScaffoldCard(state, snapshot));
  renderCard(grid, 'Provider Scaffolding Integration', renderVideoProviderScaffoldingIntegrationSummaryCard(state, snapshot));
  renderCard(grid, 'Provider Wrapper Inert Shell', renderVideoProviderRequestWrapperInertShellCard(state, snapshot));
  renderCard(grid, 'Credential Reference Validator', renderVideoCredentialReferenceValidatorCard(state, snapshot));
  renderCard(grid, 'Provider Response Redaction Skeleton', renderVideoProviderResponseRedactionSkeletonCard(state, snapshot));
  renderCard(grid, 'Provider Audit Event Types', renderVideoProviderAuditEventTypesCard(state, snapshot));
  renderCard(grid, 'STB Live Status', renderStbLiveStatusCard(state, snapshot));
  renderCard(grid, 'STB → Video Migration', renderMigrationStatusCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Production Gate', renderProductionGateCard(state, snapshot));
  renderCard(grid, 'Policy / Gate Chain', renderVideoPolicyGateChainCard(state, snapshot));
  renderCard(grid, 'Operator Decision Queue', renderOperatorDecisionQueueCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Boundary', renderControlledExecutionBoundaryCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Readiness', renderControlledExecutionReadinessCard(state, snapshot));
  renderCard(grid, 'Video Roadmap Checkpoint', renderVideoRoadmapCheckpointCard(state, snapshot));
  renderCard(grid, 'Operator Review Packet', renderOperatorReviewPacketCard(state, snapshot));
  renderCard(grid, 'Approval Payload Schema', renderControlledExecutionApprovalPayloadSchemaCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Plan Stub', renderControlledExecutionPlanStubCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Approval Request Design', renderControlledExecutionApprovalRequestDesignCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Disabled Gate', renderControlledExecutionDisabledGateCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Second-Approval Policy', renderControlledExecutionSecondApprovalPolicyCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Operator Identity Protocol', renderControlledExecutionOperatorIdentityProtocolCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Role Policy', renderControlledExecutionRolePolicyCard(state, snapshot));
  renderCard(grid, 'Preview Completion Index', renderPreviewCompletionIndexCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Preflight', renderControlledExecutionPreflightChecklistCard(state, snapshot));
  renderCard(grid, 'Controlled Execution Risk Register', renderControlledExecutionRiskRegisterCard(state, snapshot));
  renderCard(grid, 'Preflight Validator Schema', renderControlledExecutionPreflightValidatorSchemaCard(state, snapshot));
  renderCard(grid, 'Video Release Candidate Readiness', renderVideoReleaseCandidateReadinessCard(state, snapshot));
  renderCard(grid, 'Video Render / Export Policy', renderRenderExportPolicyCard(state, snapshot));
  renderCard(grid, 'Controlled Dual-Run Request Design', renderControlledDualRunRequestDesignCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Intake', renderVideoIntakeCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Asset Plan', renderVideoAssetPlanCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Design Plan', renderVideoDesignPlanCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Voiceover Plan', renderVideoVoiceoverPlanCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Visuals Plan', renderVideoVisualsPlanCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Assembly Plan', renderVideoAssemblyPlanCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Metadata Plan', renderVideoMetadataPlanCard(state, snapshot));
  renderCard(grid, 'Video Orchestrator Publishing Prep', renderVideoPublishingPrepCard(state, snapshot));
  renderCard(grid, 'Video Manual Export Package', renderVideoManualExportPackageCard(state, snapshot));
  renderCard(grid, 'Video Thumbnail Design Plan', renderVideoThumbnailDesignPlanCard(state, snapshot));
  renderCard(grid, 'Video Archive / Audit Logging', renderVideoArchiveLoggingPlanCard(state, snapshot));
  renderCard(grid, 'Design Provider Boundary', renderVideoDesignProviderBoundaryPlanCard(state, snapshot));
  renderCard(grid, 'STB ↔ Video Parity Matrix', renderParityMatrixCard(state, snapshot));
  renderCard(grid, 'STB ↔ Video Dual-Run Status', renderDualRunStatusCard(state, snapshot));
  renderCard(grid, 'STB ↔ Video Evidence Collection', renderDualRunEvidenceCard(state, snapshot));
}

function renderVideoPolicyGateChainCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const gateStatus = state.videoProductionGate?.gate?.status ?? 'blocked';
  const renderStatus = state.videoRenderExportPolicy?.policy?.status ?? 'blocked';
  const cutoverStatus = state.videoProductionCutoverGate?.gate?.status ?? 'Unavailable';
  const dryRunStatus = state.videoControlledDryRunDesign?.dryRun?.status ?? 'Unavailable';
  const releaseCandidateStatus = state.videoReleaseCandidateReadiness?.snapshot?.status ?? 'Unavailable';
  const controlledRequestStatus = state.controlledDualRunRequestDesign?.design?.status ?? 'blocked';
  const blockedCount = (state.videoProductionGate?.gate?.summary?.blockedItems ?? 0)
    + (state.videoRenderExportPolicy?.policy?.summary?.blockedCount ?? 0)
    + (state.videoControlledDryRunDesign?.dryRun?.summary?.blockedCount ?? 0)
    + (state.videoProductionCutoverGate?.gate?.summary?.blockedCount ?? 0)
    + (state.videoReleaseCandidateReadiness?.snapshot?.summary?.blockedCount ?? 0);

  renderCompactStatGrid(container, [
    { label: 'Release candidate', value: releaseCandidateStatus },
    { label: 'Production gate', value: gateStatus },
    { label: 'Cutover gate', value: cutoverStatus },
    { label: 'Render/export', value: renderStatus },
    { label: 'Controlled dry-run', value: dryRunStatus },
    { label: 'Dual-run request', value: controlledRequestStatus },
    { label: 'Known blockers', value: String(blockedCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  [
    'Artifact sandbox design: endpoint available, not executable',
    'Controlled dry-run design: endpoint available, no POST route',
    'Rollback/cleanup checklist: endpoint available, no deletes',
    'Comparison schema + fixture preview: endpoint available, no real artifact reads',
    'Production cutover gate: endpoint available, cutover blocked',
  ].forEach((label) => {
    list.createEl('div', { cls: 'brain-console__list-sub', text: label });
  });

  container.appendChild(renderSafetyLabel('Read-only · Execution disabled · Publishing disabled · STB protected'));
  return container;
}

function renderProjectsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Projects & Roadmaps', renderBrainnOSRoadmapsCard());
  renderCard(grid, 'Projects', renderProjectsCard(state, snapshot));
  renderCard(grid, 'Platforms', renderPlatformsCard(state, snapshot));
}

function renderReportsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Runtime Reports', renderRuntimeReportsCard(state));
  renderCard(grid, 'Wiki Health', renderWikiHealthCard(state));

  if (state.modelRouterReportDetail) {
    renderCard(grid, 'Model Router Report', renderModelRouterReportDetailCard(state.modelRouterReportDetail));
  }

  if (state.maintenancePreviewDetail) {
    renderCard(grid, 'Maintenance Preview', renderMaintenancePreviewDetailCard(state.maintenancePreviewDetail));
  }

  if (state.approvalDetail) {
    renderCard(grid, 'Approval Details', renderApprovalDetailCard(state.approvalDetail));
  }
}

function renderPostOrchestratorSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderPostGroup(grid, 'Status', [
    { title: 'Overview', render: renderPostOrchestratorOverviewCard(state) },
    { title: 'Post Orchestrator Status', render: renderPostOrchestratorStatusCard(state) },
    { title: 'Brain Console QA Status', render: renderBrainConsoleQaStatusCard(state) },
    { title: 'Visual QA Checklist', render: renderVisualQaChecklistCard(state) },
  ]);
  renderPostGroup(grid, 'Flow Preview', [
    { title: 'Platform / Post Flows', render: renderPlatformPostFlowsCard(state) },
    { title: 'Event Fixtures', render: renderPostEventFixturesCard(state) },
    { title: 'Dry-Run Plan', render: renderPostDryRunPlanCard(state) },
    { title: 'Draft Plan Rows', render: renderPostDryRunDraftRowsCard(state) },
    { title: 'Draft Fixtures / Preview Examples', render: renderDraftFixturesCard(state) },
  ]);
  renderPostGroup(grid, 'Review / Schedule', [
    { title: 'Draft Review Queue', render: renderPostDraftReviewQueueCard(state) },
    { title: 'Schedule Preview Queue', render: renderPostSchedulePreviewQueueCard(state) },
    { title: 'Manual Export Preview', render: renderPostManualExportCard(state) },
  ]);
  renderPostGroup(grid, 'Safety / Policy', [
    { title: 'Readiness / Quality Score', render: renderPostReadinessScoreCard(state) },
    { title: 'Platform Policy / Security Review', render: renderPostPlatformPolicyCard(state) },
    { title: 'Operator Guidance', render: renderPostOperatorGuidanceCard(state) },
    { title: 'Acceptance Checklist', render: renderPostAcceptanceChecklistCard(state) },
    { title: 'Safety State', render: renderSafetyStateCard(state) },
  ]);
  renderPostGroup(grid, 'Migration / Checkpoint', [
    { title: 'Migration Parity Report', render: renderPostMigrationParityReportCard(state) },
    { title: 'Decommission Readiness Matrix', render: renderPostDecommissionReadinessCard(state) },
    { title: 'Roadmap Checkpoint', render: renderPostRoadmapCheckpointCard(state) },
    { title: 'Contracts', render: renderPostContractsCard(state) },
    { title: 'Recovery / Blockers', render: renderPostRecoveryCard(state) },
    { title: 'Analytics Feedback Fixtures', render: renderPostAnalyticsFixturesCard(state) },
    { title: 'End-to-End Pipeline Summary', render: renderPostPipelineSummaryCard(state) },
  ]);
  renderCard(grid, 'Publishing Disabled', renderPublishingDisabledCard());
}

function renderPostGroup(parent: HTMLElement, title: string, cards: Array<{ title: string; render: HTMLElement }>): void {
  const section = parent.createDiv({ cls: 'brain-console__post-group' });
  section.createEl('h4', { cls: 'brain-console__post-group-title', text: title });
  const grid = section.createDiv({ cls: 'brain-console__post-group-grid' });
  for (const card of cards) {
    renderCard(grid, card.title, card.render);
  }
}

function renderAgentsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Agent View', renderAgentViewLedgerCard(state));
  renderCard(grid, 'Approval Audit Trail', renderApprovalAuditTrailCard(state));
  renderCard(grid, 'Agents (Summary)', renderAgentViewCard(state, snapshot));
}

function renderRecoverySection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Recovery / Blockers', renderRecoveryPanelCard(state));
}

function renderCommandBar(shell: HTMLElement, snapshot: DashboardSnapshot, onRefresh?: () => void): void {
  const bar = shell.createDiv({ cls: 'brain-console__command-bar' });

  // Left side: logo/label
  const left = bar.createDiv({ cls: 'brain-console__bar-left' });
  left.createEl('div', { cls: 'brain-console__logo', text: '◈ BRAIN OS' });

  // Center: connection status badge
  const center = bar.createDiv({ cls: 'brain-console__bar-center' });
  const badge = center.createEl('span', { cls: 'brain-console__status-badge' });
  badge.style.color = getConnectionStatusColor(snapshot.connectionStatus);
  badge.textContent = `● ${snapshot.connectionStatus.toUpperCase()}`;

  // Right side: build marker + refresh button + timestamp
  const right = bar.createDiv({ cls: 'brain-console__bar-right' });

  const buildMarker = right.createEl('span', {
    cls: 'brain-console__build-marker',
    text: 'brain-console-main-dashboard-2026-05-19-01'
  });

  const refreshBtn = right.createEl('button', { text: '↻ refresh' });
  refreshBtn.addClass('brain-console__btn-mini');
  if (onRefresh) {
    refreshBtn.addEventListener('click', () => onRefresh());
  }

  const timestamp = right.createEl('span', { text: formatRelativeTime(snapshot.refreshedAt) });
  timestamp.addClass('brain-console__timestamp');
}

function renderInstallVerificationCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const runtimeMarker = safeText((window as any).BRAIN_CONSOLE_BUILD_ID, 'unknown');
  const expectedMarker = 'brain-console-main-dashboard-2026-05-19-01';
  const markerOk = runtimeMarker === expectedMarker;

  renderCompactStatGrid(container, [
    { label: 'Runtime build', value: runtimeMarker },
    { label: 'Expected build', value: expectedMarker },
    { label: 'Match', value: markerOk ? 'yes' : 'no' },
  ]);

  container.createEl('p', {
    cls: 'brain-console__detail',
    text: markerOk
      ? 'The installed bundle matches the expected dashboard build.'
      : 'If this marker is stale, reload plugin or restart Obsidian.',
  });

  return container;
}

function renderStatusPills(shell: HTMLElement, state: BrainConsoleViewState): void {
  const pills = shell.createDiv({ cls: 'brain-console__pills' });

  const mrReport = state.runtimeReports?.find((r) => r.id === 'model-router');
  const brainCoreOnline = state.status?.ok === true;

  const data = [
    { label: 'Brain Core', value: brainCoreOnline ? '● online' : '○ offline' },
    { label: 'Model Router', value: mrReport ? `${mrReport.status}` : 'unknown' },
    { label: 'Scheduler', value: state.schedulerStatus?.status ?? 'unknown' },
    { label: 'Save-to-Mind', value: 'live' },
    { label: 'Approvals', value: `${state.approvals?.length ?? 0}` },
    { label: 'Maintenance', value: `${(state.mindPreviews ?? []).filter((p) => !p.expired).length}` },
  ];

  for (const pill of data) {
    const el = pills.createDiv({ cls: 'brain-console__pill' });
    el.createEl('span', { cls: 'brain-console__pill-label', text: pill.label });
    el.createEl('span', { cls: 'brain-console__pill-value', text: pill.value });
  }
}

function renderHeroPanel(shell: HTMLElement, snapshot: DashboardSnapshot, state: BrainConsoleViewState): void {
  const hero = shell.createDiv({ cls: 'brain-console__hero' });
  hero.style.borderLeftColor = getAttentionBadgeColor(snapshot.attentionLevel);

  const label = hero.createDiv({ cls: 'brain-console__hero-label', text: 'SYSTEM ATTENTION' });

  const statusRow = hero.createDiv({ cls: 'brain-console__hero-status' });
  const statusVal = statusRow.createEl('span', { text: snapshot.attentionLevel.toUpperCase() });
  statusVal.style.color = getAttentionBadgeColor(snapshot.attentionLevel);

  const scoreRow = hero.createDiv({ cls: 'brain-console__hero-score' });
  scoreRow.createEl('span', { text: 'Score' });
  scoreRow.createEl('span', { cls: 'brain-console__score-number', text: `${snapshot.attentionScore}%` });

  // Burn bar
  const burnBar = hero.createDiv({ cls: 'brain-console__burn-bar' });
  const burnFill = burnBar.createDiv({ cls: 'brain-console__burn-fill' });
  burnFill.style.width = `${snapshot.attentionScore}%`;
  burnFill.style.backgroundColor = getAttentionBadgeColor(snapshot.attentionLevel);

  const right = hero.createDiv({ cls: 'brain-console__hero-right' });
  right.createEl('div', { text: `${snapshot.approvalsCount} approvals` });
  right.createEl('div', { text: `${snapshot.maintenanceCount} queued` });
}

function renderCard(parent: HTMLElement, title: string, content: HTMLElement): void {
  const card = parent.createDiv({ cls: 'brain-console__card' });
  const header = card.createDiv({ cls: 'brain-console__card-header' });
  header.createEl('h3', { text: title });
  card.appendChild(content);
}

function renderCompactStatGrid(container: HTMLElement, rows: Array<{ label: string; value: string }>): void {
  const grid = container.createDiv({ cls: 'brain-console__stat-grid' });
  rows.forEach(({ label, value }) => {
    const stat = grid.createDiv({ cls: 'brain-console__stat' });
    stat.createEl('span', { cls: 'brain-console__stat-label', text: label });
    stat.createEl('span', { cls: 'brain-console__stat-value', text: value });
  });
}

function renderStatusChip(label: string, tone: 'success' | 'warning' | 'error' | 'default'): HTMLElement {
  const chip = document.createElement('span');
  chip.className = `brain-console__chip brain-console__chip-${tone}`;
  chip.textContent = label;
  return chip;
}

function renderSafetyLabel(text: string): HTMLElement {
  const label = document.createElement('div');
  label.className = 'brain-console__post-safe-note';
  label.textContent = text;
  return label;
}

function renderEmptyState(message: string, detail?: string): HTMLElement {
  const el = document.createElement('div');
  el.createEl('div', { cls: 'brain-console__list-note', text: message });
  if (detail) {
    el.createEl('div', { cls: 'brain-console__list-sub', text: detail });
  }
  return el;
}

function renderWikiHealthCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const mrReport = state.runtimeReports?.find((r) => r.id === 'model-router');
  if (!mrReport?.wikiHealth) {
    container.textContent = 'unavailable';
    return container;
  }

  const health = mrReport.wikiHealth;
  const metric = container.createEl('div', { cls: 'brain-console__metric', text: health.ok ? '✓ ok' : '⚠ issues' });
  if (health.ok) {
    metric.style.color = '#22c55e';
  } else {
    metric.style.color = '#ef4444';
    container.createEl('p', {
      cls: 'brain-console__detail',
      text: `${health.warningCount} warn · ${health.errorCount} err`,
    });
  }

  return container;
}

function renderRuntimeReportsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  if (!state.runtimeReports || state.runtimeReports.length === 0) {
    container.textContent = 'no reports';
    return container;
  }

  // Show model-router report with focus
  const mrReport = state.runtimeReports.find((r) => r.id === 'model-router');
  const list = container.createEl('ul', { cls: 'brain-console__list' });

  // Model-router report: show status, wiki health summary, file path
  if (mrReport) {
    const item = list.createEl('li', { text: `Model Router: ${mrReport.status}` });
    item.addClass('brain-console__list-item-highlight');

    if (mrReport.latestRunStatus === 'ok') {
      item.style.color = '#22c55e';
    } else if (mrReport.latestRunStatus === 'failed') {
      item.style.color = '#ef4444';
    }

    // Add wiki health if available
    if (mrReport.wikiHealth) {
      const wikiText = mrReport.wikiHealth.ok
        ? `Wiki: ✓ ok`
        : `Wiki: ${mrReport.wikiHealth.errorCount}e ${mrReport.wikiHealth.warningCount}w`;
      list.createEl('li', { cls: 'brain-console__list-sub', text: wikiText });
    }

    // Add message if available
    if (mrReport.message && mrReport.message !== 'Runtime report is available.') {
      list.createEl('li', { cls: 'brain-console__list-sub', text: mrReport.message });
    }
  }

  // List other reports
  const otherReports = state.runtimeReports.filter((r) => r.id !== 'model-router' && r.status === 'available');
  if (otherReports.length > 0) {
    for (const report of otherReports) {
      list.createEl('li', { cls: 'brain-console__list-note', text: `${report.id}: ${report.status}` });
    }
  }

  return container;
}

function renderMaintenanceCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const pending = (state.mindPreviews ?? []).filter((p) => !p.expired);
  if (pending.length === 0) {
    container.createEl('div', { cls: 'brain-console__metric', text: 'none' });
  } else {
    container.createEl('div', { cls: 'brain-console__metric', text: `${pending.length}` });
    if (pending[0]) {
      const date = new Date(pending[0].createdAt);
      container.createEl('p', { cls: 'brain-console__detail', text: `${formatRelativeTime(date)}` });
    }
  }

  return container;
}

function renderApprovalsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const approvals = state.approvals ?? [];
  if (approvals.length === 0) {
    container.createEl('div', { cls: 'brain-console__metric', text: 'none' });
  } else {
    container.createEl('div', { cls: 'brain-console__metric', text: `${approvals.length}` });
    const sample = approvals.slice(0, 2);
    const list = container.createEl('ul', { cls: 'brain-console__list' });
    for (const a of sample) {
      list.createEl('li', { text: `${a.kind}` });
    }
  }

  return container;
}

function renderSchedulerCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const status = state.schedulerStatus?.latestRunStatus ?? 'unknown';
  const metric = container.createEl('div', { cls: 'brain-console__metric', text: status });
  if (status === 'failed') metric.style.color = '#ef4444';
  if (status === 'ok') metric.style.color = '#22c55e';

  container.createEl('p', { cls: 'brain-console__detail', text: `${state.schedulerStatus?.latestRunAt ? formatRelativeTime(state.schedulerStatus.latestRunAt) : 'never'}` });

  return container;
}

function renderBrainCoreCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const online = state.status?.ok === true;
  const metric = container.createEl('div', { cls: 'brain-console__metric', text: online ? 'online' : 'offline' });
  if (online) metric.style.color = '#22c55e';
  else metric.style.color = '#ef4444';

  container.createEl('p', { cls: 'brain-console__detail', text: `v${state.status?.version ?? '?'}` });
  container.createEl('p', { cls: 'brain-console__detail', text: `exec: ${state.executionReadiness?.executionEnabled ? 'on' : 'off'}` });

  return container;
}

function renderNextActionCard(snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const metric = container.createEl('div', { cls: 'brain-console__metric', text: snapshot.nextAction });
  if (snapshot.attentionLevel === 'blocked') metric.style.color = '#ef4444';
  if (snapshot.attentionLevel === 'review') metric.style.color = '#f97316';
  if (snapshot.attentionLevel === 'watch') metric.style.color = '#eab308';
  if (snapshot.attentionLevel === 'clear') metric.style.color = '#22c55e';

  return container;
}

function renderWhatNeedsAttentionCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const issues: string[] = [];

  // Recovery errors
  if (snapshot.recoveryItemErrorCount > 0) {
    issues.push(`${snapshot.recoveryItemErrorCount} recovery error${snapshot.recoveryItemErrorCount > 1 ? 's' : ''}`);
  }

  // Wiki health
  if (snapshot.wikiHealthErrors > 0) {
    issues.push(`${snapshot.wikiHealthErrors} wiki error${snapshot.wikiHealthErrors > 1 ? 's' : ''}`);
  }

  // Blocked agents
  if (snapshot.agentRunBlockedCount > 0) {
    issues.push(`${snapshot.agentRunBlockedCount} blocked agent run${snapshot.agentRunBlockedCount > 1 ? 's' : ''}`);
  }

  // Migration blocked
  if (snapshot.migrationBlockedCount > 0) {
    issues.push(`${snapshot.migrationBlockedCount} migration blocked`);
  }

  // Pending approvals
  if (snapshot.approvalsCount > 0) {
    issues.push(`${snapshot.approvalsCount} approval${snapshot.approvalsCount > 1 ? 's' : ''} pending`);
  }

  // Maintenance previews
  if (snapshot.maintenanceCount > 0) {
    issues.push(`${snapshot.maintenanceCount} maintenance in queue`);
  }

  if (issues.length === 0) {
    const metric = container.createEl('div', { cls: 'brain-console__metric', text: '✓ clear' });
    metric.style.color = '#22c55e';
    container.createEl('p', { cls: 'brain-console__detail', text: 'No urgent issues detected.' });
  } else {
    const list = container.createEl('ul', { cls: 'brain-console__list' });
    issues.forEach(issue => {
      list.createEl('li', { text: issue });
    });
  }

  return container;
}

function renderNextSafeStepCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  let step = 'No action needed.';

  // Top recovery blocker
  if (snapshot.recoveryItemErrorCount > 0 && state.recoveryItems?.length) {
    const topError = state.recoveryItems.find(i => i.severity === 'error');
    if (topError?.nextSafeStep) {
      step = topError.nextSafeStep;
    } else {
      step = 'Review recovery blockers.';
    }
  } else if (snapshot.wikiHealthErrors > 0) {
    step = 'Review wiki health report.';
  } else if (snapshot.migrationBlockedCount > 0) {
    step = 'Review STB to video migration status.';
  } else if (snapshot.approvalsCount > 0) {
    step = 'Review pending approvals.';
  } else if (snapshot.maintenanceCount > 0) {
    step = 'Review maintenance queue.';
  }

  container.createEl('div', { cls: 'brain-console__metric', text: '→' });
  container.createEl('p', { cls: 'brain-console__detail', text: step });

  return container;
}

function renderOverviewMetricsCard(snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const metrics = [
    { label: 'Approvals', value: snapshot.approvalsCount },
    { label: 'Maintenance', value: snapshot.maintenanceCount },
    { label: 'Agent runs', value: snapshot.agentRunCount },
    { label: 'Recovery items', value: snapshot.recoveryItemCount },
    { label: 'Actions', value: snapshot.actionCount },
    { label: 'Reports', value: snapshot.approvalsCount > 0 ? '▸' : '○' },
  ];

  const list = container.createEl('ul', { cls: 'brain-console__list' });
  metrics.forEach(m => {
    list.createEl('li', { text: `${m.label}: ${m.value}` });
  });

  return container;
}

function renderOverviewStatusCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const online = state.status?.ok === true;
  const statusText = online ? 'online' : 'offline';
  const statusColor = online ? '#22c55e' : '#ef4444';

  const metric = container.createEl('div', { cls: 'brain-console__metric', text: statusText });
  metric.style.color = statusColor;

  container.createEl('p', { cls: 'brain-console__detail', text: `v${state.status?.version ?? '?'}` });

  const mrReport = state.runtimeReports?.find(r => r.id === 'model-router');
  if (mrReport?.wikiHealth) {
    const wikiText = mrReport.wikiHealth.ok
      ? 'Wiki: ✓ ok'
      : `Wiki: ${mrReport.wikiHealth.errorCount}e ${mrReport.wikiHealth.warningCount}w`;
    container.createEl('p', { cls: 'brain-console__detail', text: wikiText });
  }

  return container;
}

function renderProductionStatusCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  // Calculate readiness percentages
  const videoReadiness = state.videoOrchestratorStatus?.moduleProgress?.percent ?? 0;
  const stbContinuity = state.stbStatus?.status === 'ok' ? 100 : state.stbStatus?.status === 'unknown' ? 50 : 0;
  const postStatus = state.postOrchestratorStatus?.status;
  const postReadiness = postStatus === 'partial' || postStatus === 'ready' ? 60 : 40;

  const avgReadiness = Math.round((videoReadiness + stbContinuity + postReadiness) / 3);

  const metric = container.createEl('div', { cls: 'brain-console__metric', text: `${avgReadiness}%` });
  if (avgReadiness >= 75) metric.style.color = '#22c55e';
  else if (avgReadiness >= 50) metric.style.color = '#eab308';
  else metric.style.color = '#ef4444';

  const details = container.createEl('div', { cls: 'brain-console__production-details' });
  details.createEl('p', { cls: 'brain-console__detail', text: `Video: ${videoReadiness}%` });
  details.createEl('p', { cls: 'brain-console__detail', text: `STB: ${stbContinuity}%` });
  details.createEl('p', { cls: 'brain-console__detail', text: `Posts: ${postReadiness}%` });

  return container;
}

function renderProductionBlockersCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const blockers: string[] = [];

  // Check video orchestrator blockers
  if (state.videoOrchestratorStatus?.modules) {
    const blocked = state.videoOrchestratorStatus.modules.filter(m => m.status === 'blocked');
    if (blocked.length > 0) {
      blockers.push(`Video: ${blocked.length} module${blocked.length > 1 ? 's' : ''} blocked`);
    }
  }

  // Check STB status
  if (state.stbStatus?.status === 'unknown' || state.stbStatus?.status === 'failed') {
    blockers.push('STB: pipeline offline or unknown');
  }

  // Check post orchestrator blockers
  if (state.postOrchestratorStatus?.status === 'blocked') {
    blockers.push('Posts: readiness blocked');
  }

  if (state.postOrchestratorStatus?.publishingEnabled === false && state.postOrchestratorStatus?.schedulingEnabled === false) {
    blockers.push('Posts: publishing & scheduling disabled');
  }

  if (blockers.length === 0) {
    container.createEl('div', { cls: 'brain-console__list-note', text: 'No blockers detected' });
    return container;
  }

  const list = container.createEl('ul', { cls: 'brain-console__blocker-list' });
  blockers.slice(0, 5).forEach(blocker => {
    list.createEl('li', { text: blocker });
  });

  return container;
}

function renderVideoReadinessCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const videoOrch = state.videoOrchestratorStatus;
  if (!videoOrch) {
    container.createEl('div', { cls: 'brain-console__list-note', text: 'Video orchestrator status unavailable' });
    return container;
  }

  const percent = videoOrch.moduleProgress?.percent ?? 0;
  const metric = container.createEl('div', { cls: 'brain-console__metric', text: `${percent}%` });
  if (percent >= 75) metric.style.color = '#22c55e';
  else if (percent >= 50) metric.style.color = '#eab308';
  else metric.style.color = '#ef4444';

  const row = container.createEl('div', { cls: 'brain-console__row' });
  row.createEl('dt', { text: 'Implemented' });
  row.createEl('dd', { text: `${videoOrch.moduleProgress?.implemented ?? 0}/${videoOrch.moduleProgress?.total ?? 0}` });

  const row2 = container.createEl('div', { cls: 'brain-console__row' });
  row2.createEl('dt', { text: 'Blocked' });
  const blockedModules = videoOrch.modules?.filter((module) => module.status === 'blocked').length ?? 0;
  row2.createEl('dd', { text: `${blockedModules}` });

  return container;
}

function renderLocalAppsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  if (!state.localApps || state.localApps.length === 0) {
    container.createEl('div', { cls: 'brain-console__list-note', text: 'No local apps available' });
    return container;
  }

  const list = container.createEl('div', { cls: 'brain-console__app-list' });
  state.localApps.slice(0, 8).forEach(app => {
    const item = list.createDiv({ cls: 'brain-console__app-item' });

    // App name
    item.createDiv({ cls: 'brain-console__app-name', text: app.name });

    // Status badge and actions row
    const row = item.createDiv({ cls: 'brain-console__app-controls' });

    // Status badge
    const badge = row.createDiv({ cls: 'brain-console__app-status-badge' });
    badge.textContent = app.status;
    if (app.status === 'running') badge.style.color = '#22c55e';
    else if (app.status === 'stopped') badge.style.color = '#ef4444';
    else if (app.status === 'disabled') badge.style.color = '#64748b';
    else badge.style.color = '#94a3b8';

    // Action buttons (disabled)
    const actions = row.createDiv({ cls: 'brain-console__app-actions' });
    const startBtn = actions.createEl('button', { text: 'Start', cls: 'brain-console__app-btn-disabled' });
    startBtn.disabled = true;
    startBtn.title = 'Approval-gated, planned Phase 5';

    const stopBtn = actions.createEl('button', { text: 'Stop', cls: 'brain-console__app-btn-disabled' });
    stopBtn.disabled = true;
    stopBtn.title = 'Approval-gated, planned Phase 5';
  });

  if (state.localApps.length > 8) {
    list.createEl('div', { cls: 'brain-console__list-note', text: `... and ${state.localApps.length - 8} more` });
  }

  return container;
}

function renderOfflineState(
  shell: HTMLElement,
  brainCoreUrl: string,
  statusError?: string,
  endpointErrors?: import('./client.js').EndpointError[],
): void {
  const offline = shell.createDiv({ cls: 'brain-console__offline-panel' });

  offline.createEl('h2', { text: 'Connection lost' });
  offline.createEl('p', { text: 'Brain Core is not responding. Trying to reach:' });

  const urlEl = offline.createEl('code', { text: brainCoreUrl });
  urlEl.addClass('brain-console__url-display');

  // Show diagnostic error
  if (statusError) {
    offline.createEl('p', { text: `Error: ${statusError}` });
  }

  // Show first few endpoint errors
  if (endpointErrors && endpointErrors.length > 0) {
    const errorsDiv = offline.createDiv();
    errorsDiv.createEl('p', { text: 'Endpoint errors:' });
    const list = errorsDiv.createEl('ul');
    endpointErrors.slice(0, 3).forEach((err) => {
      const item = list.createEl('li');
      item.createEl('code', { text: err.pathname });
      item.appendText(` — ${err.error || 'no response'}`);
      if (err.detail) {
        item.appendText(` (${err.detail.slice(0, 50)})`);
      }
    });
  }

  offline.createEl('h3', { text: 'To recover:' });
  const steps = offline.createEl('ol');
  steps.createEl('li', { text: 'Verify Brain Core terminal is still running' });
  steps.createEl('li', { text: 'Test: curl http://localhost:4877/status' });
  steps.createEl('li', { text: 'If still offline, try: Settings → Brain Core URL → http://127.0.0.1:4877' });
  steps.createEl('li', { text: 'Click Refresh' });

  const refreshBtn = offline.createEl('button', { text: 'Refresh' });
  refreshBtn.addClass('brain-console__btn-main');
}

function renderActivityPanel(shell: HTMLElement, state: BrainConsoleViewState): void {
  const panel = shell.createDiv({ cls: 'brain-console__activity' });
  const header = panel.createDiv({ cls: 'brain-console__activity-header', text: 'Activity' });

  const activity = panel.createEl('ul', { cls: 'brain-console__activity-list' });

  if (state.sessions && state.sessions.length > 0) {
    activity.createEl('li', { text: `session: ${state.sessions[0]?.title?.slice(0, 40) ?? 'unknown'}` });
  }

  if (state.runtimeReports && state.runtimeReports.length > 0) {
    const ready = state.runtimeReports.filter((r) => r.status === 'available').length;
    activity.createEl('li', { text: `reports: ${ready}/${state.runtimeReports.length}` });
  }

  const mindPreviews = state.mindPreviews ?? [];
  if (mindPreviews.length > 0) {
    activity.createEl('li', { text: `previews: ${mindPreviews.length}` });
  }

  if (activity.children.length === 0) {
    activity.createEl('li', { text: 'all clear' });
  }
}

function renderOrchestratorsCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.orchestrators) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.orchestratorCount}` });
  list.createEl('li', { text: `Legacy: ${snapshot.legacySystemCount}` });

  const operationalCount = state.orchestrators.filter(o => o.lifecycle === 'operational').length;
  const problematicCount = state.orchestrators.filter(o => ['migrating', 'partial'].includes(o.lifecycle ?? '')).length;
  list.createEl('li', { text: `Operational: ${operationalCount}` });
  if (problematicCount > 0) {
    list.createEl('li', { text: `Needs Attention: ${problematicCount}`, cls: 'brain-console__list-warning' });
  }

  return card;
}

function renderPipelinesCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.pipelines) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.pipelineCount}` });

  const stbPipeline = state.pipelines.find(p => p.id === 'stb-daily-pipeline');
  if (stbPipeline) {
    const item = list.createEl('li', { text: `STB: ${stbPipeline.health}` });
    if (stbPipeline.health === 'error') {
      item.addClass('brain-console__list-error');
    }
  }

  if (snapshot.migrationBlockedCount > 0) {
    list.createEl('li', { text: `Migrations Blocked: ${snapshot.migrationBlockedCount}`, cls: 'brain-console__list-warning' });
  }

  return card;
}

function renderVideoDesignProviderCredentialIsolationPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoDesignProviderCredentialIsolationPlans;

  if (!data) {
    return renderEmptyState('Design provider credential isolation plan unavailable', 'Brain Core /video-orchestrator/design-provider-credential-isolation-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Plans', value: String(data.summary.planCount) },
    { label: 'Credentials configured', value: String(data.summary.credentialConfiguredCount) },
    { label: 'Credential access', value: String(data.summary.credentialAccessCount) },
    { label: 'Secret material stored', value: String(data.summary.secretMaterialStoredCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.plans.slice(0, 3).forEach((plan) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${plan.providerClass}: ${plan.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${plan.allowedFutureCredentialReferenceFields.length} allowed fields · ${plan.disallowedFields.length} disallowed fields` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No credential access · No raw secrets · No provider calls'));
  return container;
}

function renderVideoDesignProviderPromptReviewPolicyPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoDesignProviderPromptReviewPolicyPlans;

  if (!data) {
    return renderEmptyState('Design provider prompt review policy plan unavailable', 'Brain Core /video-orchestrator/design-provider-prompt-review-policy-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Policies', value: String(data.summary.policyCount) },
    { label: 'Approved prompts', value: String(data.summary.approvedPromptCount) },
    { label: 'Provider calls', value: String(data.summary.providerCallCount) },
    { label: 'Persisted prompts', value: String(data.summary.persistedPromptCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.policies.slice(0, 3).forEach((policy) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${policy.providerClass}: ${policy.promptCategory}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${policy.requiredHumanReviewChecks.length} review checks · ${policy.blockers.length} blockers` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No prompt generation · No provider calls · No writes'));
  return container;
}

function renderVideoArtifactSandboxProviderHandoffPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoArtifactSandboxProviderHandoffPlans;

  if (!data) {
    return renderEmptyState('Artifact sandbox provider handoff plan unavailable', 'Brain Core /video-orchestrator/artifact-sandbox-provider-handoff-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Handoff plans', value: String(data.summary.handoffPlanCount) },
    { label: 'Artifacts persisted', value: String(data.summary.artifactPersistedCount) },
    { label: 'Sandbox writes', value: String(data.summary.sandboxWriteCount) },
    { label: 'Manifests created', value: String(data.summary.manifestCreatedCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.handoffPlans.slice(0, 3).forEach((plan) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${plan.providerClass}: ${plan.handoffCategory}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${plan.proposedManifestFields.length} manifest fields · ${plan.blockers.length} blockers` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No artifact writes · No sandbox access · No provider calls'));
  return container;
}

function renderVideoProviderOutputRedactionPolicyPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderOutputRedactionPolicyPlans;

  if (!data) {
    return renderEmptyState('Provider output redaction policy plan unavailable', 'Brain Core /video-orchestrator/provider-output-redaction-policy-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Policies', value: String(data.summary.policyCount) },
    { label: 'Raw output access', value: String(data.summary.rawOutputAccessCount) },
    { label: 'Redacted manifests', value: String(data.summary.redactedManifestCreatedCount) },
    { label: 'Audit persisted', value: String(data.summary.auditPersistedCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.policies.slice(0, 3).forEach((policy) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${policy.providerClass}: ${policy.outputCategory}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${policy.redactionRules.length} redaction rules · ${policy.blockers.length} blockers` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No raw output access · No manifests created · No provider calls'));
  return container;
}

function renderVideoDesignProviderComplianceChecklistPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoDesignProviderComplianceChecklistPlans;

  if (!data) {
    return renderEmptyState('Design provider compliance checklist plan unavailable', 'Brain Core /video-orchestrator/design-provider-compliance-checklist-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Checklists', value: String(data.summary.checklistCount) },
    { label: 'Required checks', value: String(data.summary.requiredCheckCount) },
    { label: 'Passed checks', value: String(data.summary.passedCheckCount) },
    { label: 'Compliance records', value: String(data.summary.persistedComplianceRecordCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.checklists.slice(0, 3).forEach((checklist) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${checklist.providerClass}: ${checklist.checklistCategory}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${checklist.requiredChecks.length} required checks · ${checklist.blockers.length} blockers` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No compliance evaluation · No provider calls · No writes'));
  return container;
}

function renderVideoDesignProviderEnablementReadinessIndexCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoDesignProviderEnablementReadinessIndex;

  if (!data) {
    return renderEmptyState('Design provider enablement readiness unavailable', 'Brain Core /video-orchestrator/design-provider-enablement-readiness-index did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.index.status },
    { label: 'Provider classes', value: String(data.index.providerClassCount) },
    { label: 'Ready count', value: String(data.index.readyCount) },
    { label: 'Average readiness', value: `${data.index.averageReadinessPercent}%` },
    { label: 'Provider calls', value: String(data.index.providerCallCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.index.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.readinessPercent}% ready` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.status} · ${entry.blockingReasons.length} blocking reasons` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Provider enablement blocked · No provider calls · No execution'));
  return container;
}

function renderVideoProviderIntegrationFinalPlanningCheckpointCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderIntegrationFinalPlanningCheckpoint;

  if (!data) {
    return renderEmptyState('Provider integration final checkpoint unavailable', 'Brain Core /video-orchestrator/provider-integration-final-planning-checkpoint did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.checkpoint.status },
    { label: 'Planning complete', value: String(data.checkpoint.planningCompleteCount) },
    { label: 'Implementation approved', value: String(data.checkpoint.implementationApprovedCount) },
    { label: 'Implementation eligible', value: String(data.checkpoint.implementationEligibleCount) },
    { label: 'Provider calls', value: String(data.checkpoint.providerCallCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.checkpoint.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.planningComplete ? 'planning complete' : 'planning incomplete'} · implementation blocked` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Planning complete · Implementation blocked · No provider calls'));
  return container;
}

function renderVideoCredentialStoreImplementationBoundaryPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoCredentialStoreImplementationBoundaryPlan;

  if (!data) {
    return renderEmptyState('Credential store boundary unavailable', 'Brain Core /video-orchestrator/credential-store-implementation-boundary-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.plan.status },
    { label: 'Boundaries', value: String(data.plan.boundaryCount) },
    { label: 'Store implemented', value: String(data.plan.credentialStoreImplementedCount) },
    { label: 'Credential access', value: String(data.plan.credentialAccessCount) },
    { label: 'Credential persisted', value: String(data.plan.credentialPersistedCount) },
    { label: 'Env reads', value: String(data.plan.envReadCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.plan.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.implementationBoundaryOnly ? 'boundary only' : 'active'} · no credential access` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Store not implemented · No credential access · No env reads'));
  return container;
}

function renderVideoPromptReviewUxImplementationPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoPromptReviewUxImplementationPlan;

  if (!data) {
    return renderEmptyState('Prompt review UX plan unavailable', 'Brain Core /video-orchestrator/prompt-review-ux-implementation-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.plan.status },
    { label: 'Plans', value: String(data.plan.planCount) },
    { label: 'Editable UI', value: String(data.plan.editableUiEnabledCount) },
    { label: 'Approval buttons', value: String(data.plan.promptApprovalEnabledCount) },
    { label: 'Provider call buttons', value: String(data.plan.providerCallButtonCount) },
    { label: 'Prompt persisted', value: String(data.plan.promptPersistedCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.plan.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.implementationPlanOnly ? 'plan only' : 'active'} · no approval buttons` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No editable UI · No approval buttons · No provider calls'));
  return container;
}

function renderVideoProviderAuditPersistenceBoundaryPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderAuditPersistenceBoundaryPlan;

  if (!data) {
    return renderEmptyState('Provider audit persistence boundary unavailable', 'Brain Core /video-orchestrator/provider-audit-persistence-boundary-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.plan.status },
    { label: 'Boundaries', value: String(data.plan.boundaryCount) },
    { label: 'Audit persistence', value: String(data.plan.auditPersistenceImplementedCount) },
    { label: 'Audit records', value: String(data.plan.auditRecordCreatedCount) },
    { label: 'Audit append', value: String(data.plan.auditAppendEnabledCount) },
    { label: 'Provider calls', value: String(data.plan.providerCallCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.plan.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.implementationBoundaryOnly ? 'boundary only' : 'active'} · no audit writes` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No audit writes · No raw output · No provider calls'));
  return container;
}

function renderVideoProviderWrapperSecurityReviewPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderWrapperSecurityReviewPlan;

  if (!data) {
    return renderEmptyState('Provider wrapper security review unavailable', 'Brain Core /video-orchestrator/provider-wrapper-security-review-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.plan.status },
    { label: 'Review plans', value: String(data.plan.reviewPlanCount) },
    { label: 'Security reviews', value: String(data.plan.securityReviewCompletedCount) },
    { label: 'Provider approved', value: String(data.plan.providerImplementationApprovedCount) },
    { label: 'Provider calls', value: String(data.plan.providerCallCount) },
    { label: 'Mutation controls', value: String(data.plan.mutationControlCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.plan.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.implementationBoundaryOnly ? 'boundary only' : 'active'} · review incomplete` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Review not complete · No provider calls · No mutation controls'));
  return container;
}

function renderVideoProviderImplementationPhaseStartGateCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderImplementationPhaseStartGate;

  if (!data) {
    return renderEmptyState('Provider implementation start gate unavailable', 'Brain Core /video-orchestrator/provider-implementation-phase-start-gate did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.gate.status },
    { label: 'Gates', value: String(data.gate.gateCount) },
    { label: 'Planning complete', value: String(data.gate.planningSequenceCompleteCount) },
    { label: 'Implementation approved', value: String(data.gate.implementationApprovedCount) },
    { label: 'Implementation eligible', value: String(data.gate.implementationEligibleCount) },
    { label: 'Provider calls', value: String(data.gate.providerCallCount) },
    { label: 'Credential access', value: String(data.gate.credentialAccessCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.gate.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.startGateOnly ? 'start gate only' : 'active'} · implementation blocked` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Implementation blocked · No provider calls · No credentials'));
  return container;
}

function renderVideoProviderImplementationReadinessDashboardSummaryCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderImplementationReadinessDashboardSummary;

  if (!data) {
    return renderEmptyState('Provider implementation readiness summary unavailable', 'Brain Core /video-orchestrator/provider-implementation-readiness-dashboard-summary did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.dashboard.status },
    { label: 'Planning complete', value: String(data.dashboard.planningCompleteCount) },
    { label: 'Implementation approved', value: String(data.dashboard.implementationApprovedCount) },
    { label: 'Implementation eligible', value: String(data.dashboard.implementationEligibleCount) },
    { label: 'Provider calls', value: String(data.dashboard.providerCallCount) },
    { label: 'Credential access', value: String(data.dashboard.credentialAccessCount) },
    { label: 'Mutation controls', value: String(data.dashboard.mutationControlCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.dashboard.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.planningComplete ? 'planning complete' : 'planning incomplete'} · implementation blocked` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Planning complete · Implementation blocked · No controls'));
  return container;
}

function renderVideoProviderImplementationApprovalPacketCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderImplementationApprovalPacket;

  if (!data) {
    return renderEmptyState('Provider implementation approval packet unavailable', 'Brain Core /video-orchestrator/provider-implementation-approval-packet did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.packet.status },
    { label: 'Packets', value: String(data.packet.packetCount) },
    { label: 'Decision required', value: String(data.packet.decisionRequiredCount) },
    { label: 'Implementation approved', value: String(data.packet.implementationApprovedCount) },
    { label: 'Implementation eligible', value: String(data.packet.implementationEligibleCount) },
    { label: 'Provider calls', value: String(data.packet.providerCallCount) },
    { label: 'Credential access', value: String(data.packet.credentialAccessCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.packet.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.approvalPacketOnly ? 'approval packet only' : 'active'} · not approved` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Approval packet only · Not approved · No provider calls'));
  return container;
}

function renderVideoProviderApprovalPacketConsoleReviewSummaryCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderApprovalPacketConsoleReviewSummary;

  if (!data) {
    return renderEmptyState('Provider approval packet review summary unavailable', 'Brain Core /video-orchestrator/provider-approval-packet-console-review-summary did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.summary.status },
    { label: 'Reviews', value: String(data.summary.reviewCount) },
    { label: 'Decision required', value: String(data.summary.decisionRequiredCount) },
    { label: 'Approval records', value: String(data.summary.approvalRecordCreatedCount) },
    { label: 'Implementation approved', value: String(data.summary.implementationApprovedCount) },
    { label: 'Mutation controls', value: String(data.summary.mutationControlCount) },
    { label: 'Provider calls', value: String(data.summary.providerCallCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.summary.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.providerClass}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.currentDecision} · review only` });
  });

  container.appendChild(renderSafetyLabel('Read-only · Review only · No approval record · No controls'));
  return container;
}

function renderVideoProviderPlanningSurfaceIndexCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderPlanningSurfaceIndex;

  if (!data) {
    return renderEmptyState('Provider planning surface index unavailable', 'Brain Core /video-orchestrator/provider-planning-surface-index did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.index.status },
    { label: 'Surfaces', value: String(data.index.surfaceCount) },
    { label: 'Visible in console', value: String(data.index.visibleInBrainConsoleCount) },
    { label: 'Implementation enabled', value: String(data.index.implementationEnabledCount) },
    { label: 'Provider calls', value: String(data.index.providerCallEnabledCount) },
    { label: 'Credential access', value: String(data.index.credentialAccessEnabledCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.index.entries.slice(0, 3).forEach((entry) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${entry.id}: ${entry.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${entry.phaseRole} · read-only index` });
  });
  list.createEl('div', { cls: 'brain-console__list-sub', text: `Pending approval phrase: ${data.index.pendingApprovalPhrase}` });

  container.appendChild(renderSafetyLabel('Read-only · Index only · Implementation blocked · No provider calls'));
  return container;
}

function renderVideoProviderRequestWrapperScaffoldCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderRequestWrapperScaffold;

  if (!data) {
    return renderEmptyState('Provider request wrapper scaffold unavailable', 'Brain Core /video-orchestrator/provider-request-wrapper-scaffold did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.scaffold.status },
    { label: 'Provider classes', value: String(data.scaffold.providerClassCount) },
    { label: 'Wrapper scaffolded', value: String(data.scaffold.wrapperScaffoldedCount) },
    { label: 'Callable wrappers', value: String(data.scaffold.callableWrapperCount) },
    { label: 'Provider calls', value: String(data.scaffold.providerCallCount) },
    { label: 'Credential access', value: String(data.scaffold.credentialAccessCount) },
    { label: 'Network access', value: String(data.scaffold.networkAccessCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.scaffold.providerClasses.slice(0, 3).forEach((providerClass) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${providerClass.providerClass}: scaffolded-disabled` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: 'wrapper scaffolding only · no provider calls' });
  });

  container.appendChild(renderSafetyLabel('Scaffold only · No provider calls · No credentials · No network'));
  return container;
}

function renderVideoProviderWrapperValidationHarnessCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderWrapperValidationHarness;

  if (!data) {
    return renderEmptyState('Provider wrapper validation harness unavailable', 'Brain Core /video-orchestrator/provider-wrapper-validation-harness did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.harness.status },
    { label: 'Fixtures', value: String(data.harness.fixtureCount) },
    { label: 'Passed fixtures', value: String(data.harness.passedFixtureCount) },
    { label: 'Blocked fixtures', value: String(data.harness.blockedFixtureCount) },
    { label: 'Provider calls', value: String(data.harness.providerCallCount) },
    { label: 'Credential access', value: String(data.harness.credentialAccessCount) },
    { label: 'Network access', value: String(data.harness.networkAccessCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.harness.fixtureResults.slice(0, 3).forEach((fixture) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${fixture.fixtureId}: ${fixture.valid ? 'valid' : 'blocked'}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${fixture.providerClass} · ${fixture.expectedOutcome}` });
  });

  container.appendChild(renderSafetyLabel('Harness only · No provider calls · No credentials · No network'));
  return container;
}

function renderVideoCredentialReferenceScaffoldCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoCredentialReferenceScaffold;
  if (!data) return renderEmptyState('Credential reference scaffold unavailable', 'Brain Core /video-orchestrator/credential-reference-scaffold did not return a response.');
  renderCompactStatGrid(container, [
    { label: 'Status', value: data.scaffold.status },
    { label: 'Provider classes', value: String(data.scaffold.summary.providerClassCount) },
    { label: 'Credential access', value: String(data.scaffold.summary.credentialAccessCount) },
    { label: 'Credentials persisted', value: String(data.scaffold.summary.credentialPersistedCount) },
    { label: 'Env reads', value: String(data.scaffold.summary.envReadCount) },
  ]);
  const list = container.createDiv({ cls: 'brain-console__list' });
  data.scaffold.providerClasses.slice(0, 3).forEach((providerClass) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${providerClass}: scaffolded-disabled` });
  });
  container.appendChild(renderSafetyLabel('Scaffold only · No credential access · No env reads · No secrets'));
  return container;
}

function renderVideoProviderRequestEnvelopeScaffoldCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderRequestEnvelopeScaffold;
  if (!data) return renderEmptyState('Provider request envelope scaffold unavailable', 'Brain Core /video-orchestrator/provider-request-envelope-scaffold did not return a response.');
  renderCompactStatGrid(container, [
    { label: 'Status', value: data.envelope.status },
    { label: 'Envelope shapes', value: String(data.envelope.summary.envelopeShapeCount) },
    { label: 'Sendable envelopes', value: String(data.envelope.summary.sendableEnvelopeCount) },
    { label: 'Provider calls', value: String(data.envelope.summary.providerCallCount) },
    { label: 'Network access', value: String(data.envelope.summary.networkAccessCount) },
    { label: 'Credential access', value: String(data.envelope.summary.credentialAccessCount) },
  ]);
  const list = container.createDiv({ cls: 'brain-console__list' });
  data.envelope.requiredReferences.slice(0, 3).forEach((ref) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: ref });
  });
  container.appendChild(renderSafetyLabel('Scaffold only · Not sendable · No network · No provider calls'));
  return container;
}

function renderVideoProviderResponseEnvelopeScaffoldCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderResponseEnvelopeScaffold;
  if (!data) return renderEmptyState('Provider response envelope scaffold unavailable', 'Brain Core /video-orchestrator/provider-response-envelope-scaffold did not return a response.');
  renderCompactStatGrid(container, [
    { label: 'Status', value: data.envelope.status },
    { label: 'Response shapes', value: String(data.envelope.summary.responseEnvelopeShapeCount) },
    { label: 'Raw output access', value: String(data.envelope.summary.rawOutputAccessCount) },
    { label: 'Manifests created', value: String(data.envelope.summary.redactedManifestCreatedCount) },
    { label: 'Artifacts persisted', value: String(data.envelope.summary.artifactPersistedCount) },
    { label: 'Audit persisted', value: String(data.envelope.summary.auditPersistedCount) },
  ]);
  const list = container.createDiv({ cls: 'brain-console__list' });
  data.envelope.prohibitedFields.slice(0, 3).forEach((field) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: field });
  });
  container.appendChild(renderSafetyLabel('Scaffold only · No raw output · No artifacts · No audit writes'));
  return container;
}

function renderVideoProviderScaffoldingIntegrationSummaryCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderScaffoldingIntegrationSummary;
  if (!data) return renderEmptyState('Provider scaffolding integration summary unavailable', 'Brain Core /video-orchestrator/provider-scaffolding-integration-summary did not return a response.');
  renderCompactStatGrid(container, [
    { label: 'Status', value: data.summary.status },
    { label: 'Scaffolds', value: String(data.summary.scaffoldCount) },
    { label: 'Provider calls', value: String(data.summary.summary.providerCallCount) },
    { label: 'Credentials', value: String(data.summary.summary.credentialAccessCount) },
    { label: 'Network', value: String(data.summary.summary.networkAccessCount) },
    { label: 'Mutation controls', value: String(data.summary.summary.mutationControlCount) },
  ]);
  const list = container.createDiv({ cls: 'brain-console__list' });
  data.summary.implementedScaffoldRefs.slice(0, 3).forEach((ref) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: ref });
  });
  container.appendChild(renderSafetyLabel('Read-only · Scaffolds only · No provider calls · No controls'));
  return container;
}

function renderVideoProviderRequestWrapperInertShellCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderRequestWrapperInertShell;

  if (!data) {
    return renderEmptyState('Provider wrapper inert shell unavailable', 'Brain Core /video-orchestrator/provider-request-wrapper-inert-shell did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.shell.status },
    { label: 'Provider classes', value: String(data.shell.summary.supportedProviderClassCount) },
    { label: 'Callable methods', value: String(data.shell.summary.callableProviderMethodCount) },
    { label: 'Provider calls', value: String(data.shell.summary.providerCallCount) },
    { label: 'Credentials', value: String(data.shell.summary.credentialAccessCount) },
    { label: 'Network', value: String(data.shell.summary.networkAccessCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  list.createEl('div', { cls: 'brain-console__list-note', text: data.shell.className });
  list.createEl('div', { cls: 'brain-console__list-sub', text: `${data.shell.methodSurface.join(', ')} · ${data.shell.blockedMethodResults.length} blocked methods` });

  container.appendChild(renderSafetyLabel('Inert shell · No provider calls · No credentials · No network'));
  return container;
}

function renderVideoCredentialReferenceValidatorCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoCredentialReferenceValidator;

  if (!data) {
    return renderEmptyState('Credential reference validator unavailable', 'Brain Core /video-orchestrator/credential-reference-validator did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.validator.status },
    { label: 'Fixtures', value: String(data.validator.fixtureCount) },
    { label: 'Valid fixtures', value: String(data.validator.validFixtureCount) },
    { label: 'Blocked fixtures', value: String(data.validator.blockedFixtureCount) },
    { label: 'Credential access', value: String(data.validator.credentialAccessCount) },
    { label: 'Env reads', value: String(data.validator.envReadCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.validator.fixtureResults.slice(0, 3).forEach((fixture) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${fixture.fixtureId}: ${fixture.expectedOutcome}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${fixture.valid ? 'valid' : 'blocked'} · ${fixture.unsafeFields.length} unsafe fields` });
  });

  container.appendChild(renderSafetyLabel('Pure validator · No credential access · No env reads'));
  return container;
}

function renderVideoProviderResponseRedactionSkeletonCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderResponseRedactionSkeleton;

  if (!data) {
    return renderEmptyState('Provider response redaction skeleton unavailable', 'Brain Core /video-orchestrator/provider-response-redaction-skeleton did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.skeleton.status },
    { label: 'Fixtures', value: String(data.skeleton.fixtureCount) },
    { label: 'Redacted fixtures', value: String(data.skeleton.redactedFixtureCount) },
    { label: 'Raw output access', value: String(data.skeleton.rawOutputAccessCount) },
    { label: 'Artifacts persisted', value: String(data.skeleton.artifactPersistedCount) },
    { label: 'Audit persisted', value: String(data.skeleton.auditPersistedCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.skeleton.fixtureResults.slice(0, 3).forEach((fixture) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${fixture.fixtureId}: ${fixture.expectedOutcome}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: fixture.rawOutputAccessBlocked ? 'raw output blocked' : 'unexpected access' });
  });

  container.appendChild(renderSafetyLabel('Pure skeleton · No raw output · No writes'));
  return container;
}

function renderVideoProviderAuditEventTypesCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoProviderAuditEventTypes;

  if (!data) {
    return renderEmptyState('Provider audit event types unavailable', 'Brain Core /video-orchestrator/provider-audit-event-types did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.audit.status },
    { label: 'Event types', value: String(data.audit.summary.eventTypeCount) },
    { label: 'Audit persistence', value: String(data.audit.summary.auditPersistenceCount) },
    { label: 'Audit appends', value: String(data.audit.summary.auditAppendCount) },
    { label: 'Raw output access', value: String(data.audit.summary.rawOutputAccessCount) },
    { label: 'Credential access', value: String(data.audit.summary.credentialAccessCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.audit.eventTypes.slice(0, 3).forEach((eventType) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: eventType });
  });

  container.appendChild(renderSafetyLabel('Type definitions only · No audit writes · No provider calls'));
  return container;
}

function renderBrainnOSRoadmapsCard(): HTMLElement {
  const card = document.createElement('div');

  const heading = card.createEl('div', { cls: 'brain-console__roadmaps-heading' });
  heading.createEl('h4', { text: 'BrainOS Projects & Roadmaps', cls: 'brain-console__roadmaps-title' });
  heading.createEl('p', { text: 'Unified repo-agnostic project tracking', cls: 'brain-console__roadmaps-subtitle' });

  const content = card.createEl('div', { cls: 'brain-console__roadmaps-content' });

  const standardSection = content.createEl('div', { cls: 'brain-console__roadmaps-section' });
  standardSection.createEl('h5', { text: 'Repo Roadmap Standard', cls: 'brain-console__roadmaps-section-title' });
  const standardList = standardSection.createEl('ul', { cls: 'brain-console__roadmaps-list' });
  standardList.createEl('li', { text: 'JSON schema for project-state.json' });
  standardList.createEl('li', { text: 'Markdown templates for roadmap.md, implementation-plan.md, tasks.md' });
  standardList.createEl('li', { text: 'Safety: read-only indexing, no auto-commits, no cross-repo writes' });

  const statusSection = content.createEl('div', { cls: 'brain-console__roadmaps-section' });
  statusSection.createEl('h5', { text: 'Current Status', cls: 'brain-console__roadmaps-section-title' });
  const statusList = statusSection.createEl('ul', { cls: 'brain-console__roadmaps-list' });
  statusList.createEl('li', { text: 'Phase R1 (2026-05): Standard definition — in progress' });
  statusList.createEl('li', { text: 'Phase R2 (2026-06): Repo indexer & Brain Core API — planned' });
  statusList.createEl('li', { text: 'Phase R3 (2026-07): BuildFlow status sync — planned' });
  statusList.createEl('li', { text: 'Phase R4 (2026-08+): Optional dashboard controls — planned' });

  const prioritySection = content.createEl('div', { cls: 'brain-console__roadmaps-section' });
  prioritySection.createEl('h5', { text: 'Priority', cls: 'brain-console__roadmaps-section-title' });
  const priorityList = prioritySection.createEl('ul', { cls: 'brain-console__roadmaps-list' });
  priorityList.createEl('li', { text: 'LOW: Does not block production pipeline work' });
  priorityList.createEl('li', { text: 'Additive and optional for each repo' });
  priorityList.createEl('li', { text: 'See docs/system/brainos-project-roadmap-standard-2026-05-18.md' });

  const futureSection = content.createEl('div', { cls: 'brain-console__roadmaps-section' });
  futureSection.createEl('h5', { text: 'Future Capabilities', cls: 'brain-console__roadmaps-section-title' });
  const futureList = futureSection.createEl('ul', { cls: 'brain-console__roadmaps-list' });
  futureList.createEl('li', { text: 'Query project state across repos (R2+)' });
  futureList.createEl('li', { text: 'Visualize roadmap timelines and blockers (R3+)' });
  futureList.createEl('li', { text: 'Approval-gated task updates (R4+)' });
  futureList.createEl('li', { text: 'BuildFlow integration for controlled operations' });

  return card;
}

function renderProjectsCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.projects) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.projectCount}` });

  const stbProject = state.projects.find(p => p.id === 'says-the-bible');
  if (stbProject) {
    const item = list.createEl('li', { text: `Says the Bible: ${stbProject.health}` });
    if (stbProject.health === 'error') {
      item.addClass('brain-console__list-error');
    }
  }

  const categories = new Set(state.projects.map(p => p.category));
  list.createEl('li', { text: `Categories: ${categories.size}` });

  return card;
}

function renderPlatformsCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.platforms) {
    card.textContent = 'No data';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total: ${snapshot.platformCount}` });

  const socialCount = state.platforms.filter(p => p.category === 'social').length;
  const localCount = state.platforms.filter(p => p.category === 'local').length;
  list.createEl('li', { text: `Social: ${socialCount}` });
  list.createEl('li', { text: `Local: ${localCount}` });

  return card;
}

function renderStbLiveStatusCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.stbStatus) {
    card.textContent = 'No STB status available';
    return card;
  }

  const list = card.createEl('ul');
  const statusItem = list.createEl('li', { text: `Status: ${state.stbStatus.status}` });
  if (state.stbStatus.status === 'error') {
    statusItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Health: ${state.stbStatus.health}` });
  list.createEl('li', { text: `Source: ${state.stbStatus.source}` });

  if (state.stbStatus.lastRunAgeHours) {
    list.createEl('li', { text: `Last run: ${state.stbStatus.lastRunAgeHours}h ago` });
  }

  if (state.stbStatus.limitations.length > 0) {
    list.createEl('li', { text: `Limitations: ${state.stbStatus.limitations.length}` });
  }

  return card;
}

function renderVideoOrchestratorCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoOrchestratorStatus) {
    card.textContent = 'No video status available';
    return card;
  }

  const progress = state.videoOrchestratorStatus.moduleProgress ?? {};
  const platforms = safeArray(state.videoOrchestratorStatus.supportedPlatforms);

  const list = card.createEl('ul');
  list.createEl('li', { text: `Progress: ${safeNumber(progress.percent, 0)}%` });
  list.createEl('li', { text: `Implemented: ${safeNumber(progress.implemented, 0)}/${safeNumber(progress.total, 0)}` });

  const partialCount = safeNumber(progress.partial, 0);
  if (partialCount > 0) {
    list.createEl('li', { text: `Partial: ${partialCount}` });
  }

  const plannedCount = safeNumber(progress.planned, 0);
  if (plannedCount > 0) {
    list.createEl('li', { text: `Planned: ${plannedCount}` });
  }

  list.createEl('li', { text: `Platforms: ${safeCount(platforms)}` });

  return card;
}

function renderMigrationStatusCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.stbVideoMigrationStatus) {
    card.textContent = 'No migration status available';
    return card;
  }

  const modules = safeArray(state.stbVideoMigrationStatus.modules);
  const mappedCount = modules.filter(m => m?.status === 'mapped').length;
  const totalCount = safeCount(modules);

  const list = card.createEl('ul');
  list.createEl('li', { text: `Parity: ${safeNumber(state.stbVideoMigrationStatus.parityPercent, 0)}%` });
  list.createEl('li', { text: `Mapped modules: ${mappedCount}/${totalCount}` });

  const blockedItem = list.createEl('li', { text: `Decomm Blocked: ${safeBool(state.stbVideoMigrationStatus.decommissionBlocked) ? 'yes' : 'no'}` });
  if (safeBool(state.stbVideoMigrationStatus.decommissionBlocked)) {
    blockedItem.addClass('brain-console__list-warning');
  }

  return card;
}

function renderVideoIntakeCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoOrchestratorIntake) {
    card.textContent = 'No intake data available';
    return card;
  }

  const summary = state.videoOrchestratorIntake.summary ?? {};

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Production module` });
  list.createEl('li', { text: `Sources: ${safeNumber(summary.sourceCount, 0)}` });
  list.createEl('li', { text: `Plans: ${safeNumber(summary.planCount, 0)}` });
  list.createEl('li', { text: `Available: ${safeNumber(summary.availableCount, 0)}` });

  const blockedCount = safeNumber(summary.blockedCount, 0);
  if (blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', { text: 'Safety: read-only, no execution, no publishing' });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoAssetPlanCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoAssetPlans) {
    card.textContent = 'No asset plan data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Planning module` });
  list.createEl('li', { text: `Plans: ${state.videoAssetPlans.summary.total}` });
  list.createEl('li', { text: `Requirements: ${state.videoAssetPlans.summary.totalRequirements}` });
  list.createEl('li', { text: `Preview-Ready: ${state.videoAssetPlans.summary.previewReadyCount}` });

  if (state.videoAssetPlans.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoAssetPlans.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', { text: 'Safety: read-only, no generation, no publishing' });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoDesignPlanCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoDesignPlans) {
    card.textContent = 'No design plan data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Design planning module` });
  list.createEl('li', { text: `Plans: ${state.videoDesignPlans.summary.total}` });
  list.createEl('li', { text: `Specs: ${state.videoDesignPlans.summary.totalSpecs}` });
  list.createEl('li', { text: `Preview-Ready: ${state.videoDesignPlans.summary.previewReadyCount}` });

  if (state.videoDesignPlans.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoDesignPlans.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', { text: 'Safety: read-only, no design generation, no prompts' });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoVoiceoverPlanCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoVoiceoverPlans) {
    card.textContent = 'No voiceover plan data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Voiceover planning module` });
  list.createEl('li', { text: `Plans: ${state.videoVoiceoverPlans.summary.total}` });
  list.createEl('li', { text: `Segments: ${state.videoVoiceoverPlans.summary.totalSegments}` });
  list.createEl('li', {
    text: `Duration: ${state.videoVoiceoverPlans.summary.estimatedDurationMinutes}m total`,
  });

  if (state.videoVoiceoverPlans.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoVoiceoverPlans.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no TTS, no audio generation, structural placeholders only',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoVisualsPlanCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoVisualPlans) {
    card.textContent = 'No visuals plan data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Visuals planning module` });
  list.createEl('li', { text: `Plans: ${state.videoVisualPlans.summary.total}` });
  list.createEl('li', { text: `Sequence items: ${state.videoVisualPlans.summary.totalSequenceItems}` });
  list.createEl('li', {
    text: `Duration: ${state.videoVisualPlans.summary.estimatedTotalDurationMinutes}m total`,
  });

  if (state.videoVisualPlans.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoVisualPlans.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no image generation, no video rendering, structural placeholders only',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoAssemblyPlanCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoAssemblyPlans) {
    card.textContent = 'No assembly plan data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Assembly planning module` });
  list.createEl('li', { text: `Plans: ${state.videoAssemblyPlans.summary.total}` });
  list.createEl('li', { text: `Timeline items: ${state.videoAssemblyPlans.summary.totalTimelineItems}` });
  list.createEl('li', {
    text: `Duration: ${state.videoAssemblyPlans.summary.estimatedDurationMinutes}m total`,
  });

  if (state.videoAssemblyPlans.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoAssemblyPlans.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no video rendering, no ffmpeg, structural placeholders only',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoMetadataPlanCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoMetadataPlans) {
    card.textContent = 'No metadata plan data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Metadata planning module` });
  list.createEl('li', { text: `Plans: ${state.videoMetadataPlans.summary.total}` });
  list.createEl('li', { text: `Platform items: ${state.videoMetadataPlans.summary.totalPlatformItems}` });

  if (state.videoMetadataPlans.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoMetadataPlans.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no SEO generation, no platform API, no scheduling, no publishing, structural placeholders only',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoPublishingPrepCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoPublishingPrepPlans) {
    card.textContent = 'No publishing prep data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Publishing prep module` });
  list.createEl('li', { text: `Plans: ${state.videoPublishingPrepPlans.summary.total}` });
  list.createEl('li', { text: `Platform items: ${state.videoPublishingPrepPlans.summary.totalPlatforms}` });
  list.createEl('li', { text: `Checklist items: ${state.videoPublishingPrepPlans.summary.totalChecklistItems}` });

  if (state.videoPublishingPrepPlans.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoPublishingPrepPlans.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no platform API, no scheduling, no publishing, readiness validation only',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoManualExportPackageCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoManualExportPackages) {
    card.textContent = 'No manual export package data available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: Manual export package module` });
  list.createEl('li', { text: `Packages: ${state.videoManualExportPackages.summary.total}` });
  list.createEl('li', { text: `Items: ${state.videoManualExportPackages.summary.totalItems}` });

  if (state.videoManualExportPackages.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.videoManualExportPackages.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-warning');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no file writes, no downloads, no clipboard, no publishing',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderParityMatrixCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.stbVideoParityMatrix) {
    card.textContent = 'No parity matrix available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Parity: ${state.stbVideoParityMatrix.summary.parityPercent}%` });
  list.createEl('li', { text: `Readiness: ${state.stbVideoParityMatrix.summary.readinessScore}%` });
  list.createEl('li', { text: `Mapped: ${state.stbVideoParityMatrix.summary.mappedCount}/${state.stbVideoParityMatrix.summary.totalEntries}` });

  if (state.stbVideoParityMatrix.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${state.stbVideoParityMatrix.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-error');
  }

  if (state.stbVideoParityMatrix.risksAndMitigations.length > 0) {
    const criticalRisks = state.stbVideoParityMatrix.risksAndMitigations.filter((r: { priority: string }) => r.priority === 'critical');
    if (criticalRisks.length > 0) {
      const riskItem = list.createEl('li', { text: `Critical Risks: ${criticalRisks.length}` });
      riskItem.addClass('brain-console__list-error');
    }
  }

  return card;
}

function renderDualRunStatusCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.stbVideoDualRunStatus) {
    card.textContent = 'No dual-run status available';
    return card;
  }

  const summary = state.stbVideoDualRunStatus.summary ?? {};
  const blockers = safeArray(state.stbVideoDualRunStatus.blockers);

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${safeText(state.stbVideoDualRunStatus.status)}` });
  list.createEl('li', { text: `Readiness: ${safeNumber(summary.readinessPercent, 0)}%` });
  list.createEl('li', { text: `Passed: ${safeNumber(summary.passedCount, 0)}/${safeNumber(summary.totalValidations, 0)}` });

  const inProgressCount = safeNumber(summary.inProgressCount, 0);
  if (inProgressCount > 0) {
    const inProgressItem = list.createEl('li', {
      text: `In Progress: ${inProgressCount}`,
    });
    inProgressItem.addClass('brain-console__list-warning');
  }

  const blockedCount = safeNumber(summary.blockedCount, 0);
  if (blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-error');
  }

  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', {
      text: `Blockers: ${blockers.length}`,
    });
    blockerItem.addClass('brain-console__list-error');
  }

  return card;
}

function renderProductionGateCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoProductionGate?.gate) {
    card.textContent = 'No production gate data available';
    return card;
  }

  const gate = state.videoProductionGate.gate;
  const summary = gate.summary ?? {};
  const criticalBlockers = safeArray(gate.criticalBlockers);
  const sections = safeArray(gate.sections);

  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${safeText(gate.status)}` });
  list.createEl('li', { text: `Readiness: ${safeNumber(gate.readinessPercent, 0)}%` });
  list.createEl('li', { text: `Total items: ${safeNumber(summary.totalItems, 0)}` });
  list.createEl('li', { text: `Ready: ${safeNumber(summary.readyItems, 0)}` });

  const blockedCount = safeNumber(summary.blockedItems, 0);
  if (blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-error');
  }

  if (criticalBlockers.length > 0) {
    const criticalPreview = safeText(criticalBlockers[0], 'Unknown blocker');
    const blockerItem = list.createEl('li', {
      text: `Critical: ${criticalPreview}…`,
    });
    blockerItem.addClass('brain-console__list-error');
  }

  list.createEl('li', {
    text: `Sections: ${safeCount(sections)}`,
  });

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no rendering, no publishing, STB not decommissioned',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderControlledDualRunRequestDesignCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.controlledDualRunRequestDesign?.design) {
    card.textContent = 'No controlled dual-run request design available';
    return card;
  }

  const design = state.controlledDualRunRequestDesign.design;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${design.status}` });
  list.createEl('li', { text: `Can request approval: ${design.canRequestApproval}` });
  list.createEl('li', { text: `Can execute: ${design.canExecute}` });
  list.createEl('li', { text: `Total requirements: ${design.summary.totalRequirements}` });
  list.createEl('li', { text: `Satisfied: ${design.summary.satisfiedCount}` });

  if (design.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${design.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Lifecycle steps: ${design.lifecycle.length}` });

  if (design.blockers.length > 0) {
    const blockerPreview = design.blockers[0] ?? 'Unknown blocker';
    const blockerItem = list.createEl('li', {
      text: `Blockers: ${blockerPreview}…`,
    });
    blockerItem.addClass('brain-console__list-error');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no approval created, no execution, STB protected',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoReleaseCandidateReadinessCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoReleaseCandidateReadiness?.snapshot) {
    card.textContent = 'Unavailable';
    return card;
  }

  const snapshotData = state.videoReleaseCandidateReadiness.snapshot;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${snapshotData.status}` });
  list.createEl('li', { text: `Readiness: ${snapshotData.readinessPercent}%` });
  list.createEl('li', { text: `Ready: ${snapshotData.summary.readyCount}` });

  if (snapshotData.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', { text: `Blocked: ${snapshotData.summary.blockedCount}` });
    blockedItem.addClass('brain-console__list-error');
  }

  if (snapshotData.summary.missingCount > 0) {
    const missingItem = list.createEl('li', { text: `Missing: ${snapshotData.summary.missingCount}` });
    missingItem.addClass('brain-console__list-warning');
  }

  const blockers = snapshotData.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Next: ${snapshotData.nextSafeStep}` });

  const safetyList = list.createEl('li', {
    text: 'Safety: Read-only · No release-candidate marking · No execution · STB protected',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderOperatorDecisionQueueCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoOperatorDecisionQueue?.queue) {
    card.textContent = 'Unavailable';
    return card;
  }

  const queue = state.videoOperatorDecisionQueue.queue;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${queue.status}` });
  list.createEl('li', { text: `Decisions: ${queue.summary.totalDecisions}` });
  list.createEl('li', { text: `Decision required: ${queue.summary.decisionRequiredCount}` });

  if (queue.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', { text: `Blocked/not ready: ${queue.summary.blockedCount}` });
    blockedItem.addClass('brain-console__list-error');
  }

  const topDecisions = queue.decisions.slice(0, 3).map((decision) => `${decision.label} (${decision.status})`);
  if (topDecisions.length > 0) {
    list.createEl('li', { text: `Top decisions: ${topDecisions.join('; ')}` });
  }

  const blockers = queue.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Next: ${queue.nextSafeStep}` });

  const safetyList = list.createEl('li', {
    text: 'Safety: Read-only · No approval created · No execution · STB protected',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderControlledExecutionBoundaryCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionPolicyBoundary?.boundary) {
    card.textContent = 'Unavailable';
    return card;
  }

  const boundary = state.videoControlledExecutionPolicyBoundary.boundary;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${boundary.status}` });
  list.createEl('li', { text: `Can execute: ${boundary.canExecute}` });
  list.createEl('li', { text: `Can register action: ${boundary.canRegisterAction}` });
  list.createEl('li', { text: `Can create approval: ${boundary.canCreateApproval}` });
  list.createEl('li', { text: `Boundary items: ${boundary.summary.totalSections}` });

  if (boundary.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', { text: `Blocked: ${boundary.summary.blockedCount}` });
    blockedItem.addClass('brain-console__list-error');
  }

  const topBlockers = boundary.blockers.slice(0, 3);
  if (topBlockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${topBlockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Next: ${boundary.nextSafeStep}` });

  const safetyList = list.createEl('li', {
    text: 'Safety: Read-only · No action registration · No approval execution · STB protected',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderControlledExecutionReadinessCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionReadinessIndex?.index) {
    card.textContent = 'Unavailable';
    return card;
  }

  const index = state.videoControlledExecutionReadinessIndex.index;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${index.status}` });
  list.createEl('li', { text: `Readiness: ${index.readinessPercent}%` });
  list.createEl('li', { text: `Ready: ${index.summary.readyCount}` });
  list.createEl('li', { text: `Blocked: ${index.summary.blockedCount}` });
  list.createEl('li', { text: `Missing: ${index.summary.missingCount}` });

  const topBlockers = index.blockers.slice(0, 3);
  if (topBlockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${topBlockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Next: ${index.nextSafeStep}` });

  const safetyList = list.createEl('li', {
    text: 'Safety: Read-only · Execution disabled · Action registration disabled · STB protected',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderVideoRoadmapCheckpointCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoRoadmapCheckpoint?.checkpoint) {
    card.textContent = 'Unavailable';
    return card;
  }

  const checkpoint = state.videoRoadmapCheckpoint.checkpoint;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${checkpoint.status}` });
  list.createEl('li', { text: `Completed phases: ${checkpoint.completedPhaseCount}` });
  list.createEl('li', { text: `Blocked phases: ${checkpoint.blockedPhaseCount}` });
  list.createEl('li', { text: `Approval required: ${checkpoint.approvalRequiredCount}` });
  const blockers = checkpoint.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${checkpoint.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · Roadmap checkpoint only · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderOperatorReviewPacketCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoOperatorReviewPacket?.packet) {
    card.textContent = 'Unavailable';
    return card;
  }

  const packet = state.videoOperatorReviewPacket.packet;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${packet.status}` });
  list.createEl('li', { text: `Included sections: ${packet.summary.includedCount}` });
  list.createEl('li', { text: `Blocked sections: ${packet.summary.blockedCount}` });
  list.createEl('li', { text: `Missing sections: ${packet.summary.missingCount}` });
  const blockers = packet.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${packet.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · No approval created · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionApprovalPayloadSchemaCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionApprovalPayloadSchema?.schema) {
    card.textContent = 'Unavailable';
    return card;
  }

  const schema = state.videoControlledExecutionApprovalPayloadSchema.schema;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${schema.status}` });
  list.createEl('li', { text: `Sections: ${schema.summary.totalSections}` });
  list.createEl('li', { text: `Required fields: ${schema.summary.requiredFieldCount}` });
  list.createEl('li', { text: `Blocked or missing fields: ${schema.summary.blockedFieldCount + schema.summary.missingFieldCount}` });
  const blockers = schema.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${schema.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · No approval created · No action registration · Execution disabled' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionPlanStubCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionPlanStub?.plan) {
    card.textContent = 'Unavailable';
    return card;
  }

  const plan = state.videoControlledExecutionPlanStub.plan;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${plan.status}` });
  list.createEl('li', { text: `Plan steps: ${plan.summary.totalSteps}` });
  list.createEl('li', { text: `Blocked steps: ${plan.summary.blockedSteps}` });
  list.createEl('li', { text: `Missing inputs: ${plan.summary.missingInputs}` });
  const blockers = plan.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${plan.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · Disabled · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionApprovalRequestDesignCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionApprovalRequestDesign?.design) {
    card.textContent = 'Unavailable';
    return card;
  }

  const design = state.videoControlledExecutionApprovalRequestDesign.design;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${design.status}` });
  list.createEl('li', { text: `Approval request enabled: ${design.approvalRequestEnabled}` });
  list.createEl('li', { text: `Missing preconditions: ${design.summary.missingPreconditionsCount}` });
  list.createEl('li', { text: `Blockers: ${design.summary.blockerCount}` });
  const blockers = design.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${design.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · No approval created · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionDisabledGateCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionDisabledGate?.gate) {
    card.textContent = 'Unavailable';
    return card;
  }

  const gate = state.videoControlledExecutionDisabledGate.gate;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${gate.status}` });
  list.createEl('li', { text: `Execution enabled: ${gate.executionEnabled}` });
  list.createEl('li', { text: `Second approval required: ${gate.secondApprovalRequired}` });
  list.createEl('li', { text: `Second approval policy exists: ${gate.secondApprovalPolicyExists}` });
  list.createEl('li', { text: `Disabled reasons: ${gate.summary.disabledReasonCount}` });
  const blockers = gate.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${gate.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Execution disabled · Second approval required · No writes' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionSecondApprovalPolicyCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionSecondApprovalPolicy?.policy) {
    card.textContent = 'Unavailable';
    return card;
  }

  const policy = state.videoControlledExecutionSecondApprovalPolicy.policy;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${policy.status}` });
  list.createEl('li', { text: `Policy exists: ${policy.policyExists}` });
  list.createEl('li', { text: `Policy accepted: ${policy.policyAccepted}` });
  list.createEl('li', { text: `Second approval creation: ${policy.secondApprovalCreationEnabled}` });
  list.createEl('li', { text: `Execution enabled: ${policy.executionEnabled}` });
  list.createEl('li', { text: `Missing evidence: ${policy.summary.missingEvidenceCount}` });
  const blockers = policy.blockers.slice(0, 2);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${policy.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · No approvals · No execution · No writes' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionOperatorIdentityProtocolCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionOperatorIdentityProtocol?.protocol) {
    card.textContent = 'Unavailable';
    return card;
  }

  const protocol = state.videoControlledExecutionOperatorIdentityProtocol.protocol;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${protocol.status}` });
  list.createEl('li', { text: `Protocol exists: ${protocol.protocolExists}` });
  list.createEl('li', { text: `Identity verification enabled: ${protocol.identityVerificationEnabled}` });
  list.createEl('li', { text: `Operator authenticated: ${protocol.operatorAuthenticated}` });
  list.createEl('li', { text: `Second approval allowed: ${protocol.secondApprovalAllowed}` });
  list.createEl('li', { text: `Missing requirements: ${protocol.summary.missingRequirementCount}` });
  const blockers = protocol.blockers.slice(0, 2);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${protocol.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · No auth · No approvals · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionRolePolicyCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionRolePolicy?.policy) {
    card.textContent = 'Unavailable';
    return card;
  }

  const policy = state.videoControlledExecutionRolePolicy.policy;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${policy.status}` });
  list.createEl('li', { text: `Policy exists: ${policy.policyExists}` });
  list.createEl('li', { text: `Policy enforced: ${policy.policyEnforced}` });
  list.createEl('li', { text: `Role verification enabled: ${policy.roleVerificationEnabled}` });
  list.createEl('li', { text: `Second approval allowed: ${policy.secondApprovalAllowed}` });
  list.createEl('li', { text: `Roles defined: ${policy.summary.roleCount}` });
  list.createEl('li', { text: `Missing requirements: ${policy.summary.missingRequirementCount}` });
  const blockers = policy.blockers.slice(0, 2);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${policy.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · No role enforcement · No approvals · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderPreviewCompletionIndexCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoPreviewCompletionIndex?.index) {
    card.textContent = 'Unavailable';
    return card;
  }

  const index = state.videoPreviewCompletionIndex.index;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${index.status}` });
  list.createEl('li', { text: `Preview complete: ${index.previewComplete}` });
  list.createEl('li', { text: `Execution blocked: ${index.executionBlocked}` });
  list.createEl('li', { text: `Complete items: ${index.summary.completeCount}` });
  list.createEl('li', { text: `Blocked items: ${index.summary.blockedCount}` });
  const blockers = index.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next macro phase: ${index.nextMacroPhase}` });
  list.createEl('li', { text: `Next: ${index.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · Preview complete · Execution blocked · STB protected' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionPreflightChecklistCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionPreflightChecklist?.checklist) {
    card.textContent = 'Unavailable';
    return card;
  }

  const checklist = state.videoControlledExecutionPreflightChecklist.checklist;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${checklist.status}` });
  list.createEl('li', { text: `Can pass preflight: ${checklist.canPassPreflight}` });
  list.createEl('li', { text: `Blocked items: ${checklist.summary.blockedCount}` });
  list.createEl('li', { text: `Missing items: ${checklist.summary.missingCount}` });
  const blockers = checklist.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${checklist.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · Preflight blocked · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionRiskRegisterCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionRiskRegister?.register) {
    card.textContent = 'Unavailable';
    return card;
  }

  const register = state.videoControlledExecutionRiskRegister.register;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${register.status}` });
  list.createEl('li', { text: `Risk count: ${register.summary.totalRisks}` });
  list.createEl('li', { text: `Blocking risks: ${register.summary.blockingCount}` });
  list.createEl('li', { text: `High risks: ${register.summary.highCount}` });
  const topRisks = register.risks.slice(0, 3).map(risk => `${risk.title} (${risk.severity})`);
  if (topRisks.length > 0) {
    const riskItem = list.createEl('li', { text: `Top risks: ${topRisks.join('; ')}` });
    riskItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${register.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · Risk acceptance blocked · No execution' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderControlledExecutionPreflightValidatorSchemaCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoControlledExecutionPreflightValidatorSchema?.schema) {
    card.textContent = 'Unavailable';
    return card;
  }

  const schema = state.videoControlledExecutionPreflightValidatorSchema.schema;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${schema.status}` });
  list.createEl('li', { text: `Rules: ${schema.summary.totalRules}` });
  list.createEl('li', { text: `Blocked rules: ${schema.summary.blockedRules}` });
  list.createEl('li', { text: `Failure codes: ${schema.summary.failureCodeCount}` });
  const blockers = schema.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', { text: `Top blockers: ${blockers.join('; ')}` });
    blockerItem.addClass('brain-console__list-error');
  }
  list.createEl('li', { text: `Next: ${schema.nextSafeStep}` });
  const safetyList = list.createEl('li', { text: 'Safety: Read-only · Validator disabled · No approval created · Execution disabled' });
  safetyList.addClass('brain-console__list-info');
  return card;
}

function renderRenderExportPolicyCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.videoRenderExportPolicy?.policy) {
    card.textContent = 'No render/export policy data available';
    return card;
  }

  const policy = state.videoRenderExportPolicy.policy;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${policy.status}` });
  list.createEl('li', { text: `Can render: ${policy.canRender}` });
  list.createEl('li', { text: `Can export: ${policy.canExport}` });
  list.createEl('li', { text: `Executable action registered: ${policy.executableActionRegistered}` });
  list.createEl('li', { text: `Policy items: ${policy.summary.totalItems}` });

  if (policy.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${policy.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-error');
  }

  if (policy.summary.missingCount > 0) {
    const missingItem = list.createEl('li', {
      text: `Missing: ${policy.summary.missingCount}`,
    });
    missingItem.addClass('brain-console__list-warning');
  }

  const blockers = policy.blockers.slice(0, 3);
  if (blockers.length > 0) {
    const blockerItem = list.createEl('li', {
      text: `Top blockers: ${blockers.join('; ')}`,
    });
    blockerItem.addClass('brain-console__list-error');
  }

  list.createEl('li', { text: `Next: ${policy.nextSafeStep}` });

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, no rendering, no ffmpeg, no files, no approval created',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderDualRunEvidenceCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.stbVideoDualRunEvidence?.evidence) {
    card.textContent = 'No dual-run evidence available';
    return card;
  }

  const evidence = state.stbVideoDualRunEvidence.evidence;
  const list = card.createEl('ul');
  list.createEl('li', { text: `Status: ${evidence.status}` });
  list.createEl('li', { text: `Stages: ${evidence.summary.totalStages}` });
  list.createEl('li', { text: `Evidence available: ${evidence.summary.evidenceAvailableCount}` });
  list.createEl('li', { text: `Partial: ${evidence.summary.partialCount}` });

  if (evidence.summary.blockedCount > 0) {
    const blockedItem = list.createEl('li', {
      text: `Blocked: ${evidence.summary.blockedCount}`,
    });
    blockedItem.addClass('brain-console__list-error');
  }

  if (evidence.blockers.length > 0) {
    const blockerPreview = evidence.blockers[0] ?? 'Unknown blocker';
    const blockerItem = list.createEl('li', {
      text: `Blockers: ${blockerPreview}…`,
    });
    blockerItem.addClass('brain-console__list-error');
  }

  const safetyList = list.createEl('li', {
    text: 'Safety: read-only, STB not executed, Video not executed, no file writes',
  });
  safetyList.addClass('brain-console__list-info');

  return card;
}

function renderAgentViewCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total agents: ${snapshot.agentCount}` });
  list.createEl('li', { text: `External executors: ${snapshot.externalExecutorCount}` });

  if (snapshot.plannedAgentCount > 0) {
    list.createEl('li', { text: `Planned: ${snapshot.plannedAgentCount}` });
  }

  if (snapshot.modelRouterAgentSummary) {
    list.createEl('li', { text: `Model Router: ${snapshot.modelRouterAgentSummary.health}` });
  }

  list.createEl('li', { text: 'Agent runtime is read-only (planned)', cls: 'brain-console__list-note' });

  return card;
}

function renderActionPreviewCard(state: BrainConsoleViewState, settings: BrainConsoleSettings): HTMLElement {
  const card = document.createElement('div');

  if (!state.actions || state.actions.length === 0) {
    card.textContent = 'No actions available';
    return card;
  }

  const list = card.createEl('ul');
  list.createEl('li', { text: `Total actions: ${state.actions.length}` });

  const requestable = state.actions.filter((a) => a.canRequestApproval && a.status === 'approval-required');
  if (requestable.length > 0) {
    list.createEl('li', { text: `Requestable: ${requestable.length}`, cls: 'brain-console__list-item-highlight' });
    requestable.forEach((action) => {
      const item = list.createEl('li', { text: `  • ${action.label} (${action.risk})`, cls: 'brain-console__list-sub' });
      const btn = item.createEl('button', { text: 'Request', cls: 'brain-console__btn-mini' });
      btn.addEventListener('click', () => {
        void requestActionApproval(action.id, settings.brainCoreUrl);
      });

      // Display readiness status if available
      const readiness = (action as any).readiness;
      if (readiness) {
        if (readiness.status === 'blocked' && readiness.blockers?.length > 0) {
          const blockerText = readiness.blockers.join('; ');
          item.createEl('span', { text: ` [⚠ ${blockerText}]`, cls: 'brain-console__readiness-blocked' });
        } else if (readiness.status === 'ready') {
          item.createEl('span', { text: ' [✓ ready]', cls: 'brain-console__readiness-ready' });
        }

        // Show latest approval status if available
        if (readiness.latestApprovalStatus) {
          const statusEmoji = readiness.latestApprovalStatus === 'approved' ? '✓' :
                             readiness.latestApprovalStatus === 'rejected' ? '✗' :
                             readiness.latestApprovalStatus === 'expired' ? '⏱' : '⏳';
          const ageText = readiness.latestRequestAgeMinutes !== undefined ? ` (${readiness.latestRequestAgeMinutes}m ago)` : '';
          item.createEl('span', { text: ` ${statusEmoji} ${readiness.latestApprovalStatus}${ageText}`, cls: 'brain-console__latest-approval' });
        }

        // Show latest report availability if model-router action
        if (action.id === 'model-router-dry-run') {
          const mrReport = state.runtimeReports?.find((r) => r.id === 'model-router');
          if (mrReport && mrReport.status === 'available') {
            item.createEl('span', { text: ' 📄 report available', cls: 'brain-console__report-available' });
          }
        }
      }
    });
  }

  const blocked = state.actions.filter((a) => a.status === 'blocked');
  if (blocked.length > 0) {
    list.createEl('li', { text: `Blocked: ${blocked.length}` });
    blocked.slice(0, 2).forEach((action) => {
      const item = list.createEl('li', { text: `  • ${action.label}`, cls: 'brain-console__list-sub' });
      item.createEl('span', { text: ` — ${action.reason}`, cls: 'brain-console__block-reason' });
    });
    if (blocked.length > 2) {
      list.createEl('li', { text: `  ... and ${blocked.length - 2} more`, cls: 'brain-console__list-note' });
    }
  }

  const planned = state.actions.filter((a) => a.status === 'planned');
  if (planned.length > 0) {
    list.createEl('li', { text: `Planned: ${planned.length}` });
  }

  list.createEl('li', { text: 'Approval requests do not execute actions', cls: 'brain-console__list-note' });

  return card;
}

async function requestActionApproval(actionId: string, brainCoreUrl: string): Promise<void> {
  try {
    const result = await requestBrainCoreActionApproval(brainCoreUrl, actionId);
    if (result.error) {
      console.error(`Action request failed: ${result.error}`, result.detail);
      return;
    }
    const request = result.value;
    if (request?.status === 'requested') {
      console.log(`✓ Action approval requested: ${actionId}`);
      if (request.approvalId) {
        console.log(`  Approval ID: ${request.approvalId}`);
      }
      console.log(`  ⚠ Execution did not run (approval process only)`);
    } else if (request?.status === 'blocked') {
      console.warn(`⚠ Action request blocked: ${request.summary}`);
    } else if (request?.status === 'invalid') {
      console.error(`✗ Invalid action request: ${request.summary}`);
    }
  } catch (err) {
    console.error(`Error requesting action approval: ${err}`);
  }
}

function renderApprovalDetailCard(detail: import('./client.js').BrainCoreApprovalDetail): HTMLElement {
  const el = document.createElement('div');
  const rows = [
    { label: 'ID', value: detail.id },
    { label: 'Kind', value: detail.kind },
    { label: 'Status', value: detail.status },
    { label: 'Age', value: detail.ageMinutes !== undefined ? `${detail.ageMinutes}m` : 'unknown' },
    { label: 'Expires', value: detail.expired ? '✗ expired' : (detail.expiresAt ? 'pending' : 'never') },
    { label: 'WritesToMind', value: 'false' },
    { label: 'ApplyEnabled', value: 'false' },
  ];
  
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });
  
  return el;
}

function renderModelRouterReportDetailCard(detail: import('./client.js').BrainCoreModelRouterReportDetail): HTMLElement {
  const el = document.createElement('div');
  const rows = [
    { label: 'Exists', value: detail.exists ? 'yes' : 'no' },
    { label: 'Status', value: detail.status || 'unknown' },
    { label: 'Latest Run', value: detail.latestRunStatus || 'unknown' },
    { label: 'Wiki Health', value: detail.wikiHealth ? (detail.wikiHealth.ok ? '✓ ok' : `⚠ ${detail.wikiHealth.errorCount} errors, ${detail.wikiHealth.warningCount} warnings`) : 'unknown' },
    { label: 'WritesToMind', value: 'false' },
    { label: 'ApplyEnabled', value: 'false' },
  ];
  
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });
  
  return el;
}

function renderMaintenancePreviewDetailCard(detail: import('./client.js').BrainCoreMaintenancePreviewDetail): HTMLElement {
  const el = document.createElement('div');
  const rows = [
    { label: 'Queue ID', value: detail.queueId },
    { label: 'Actions', value: String(detail.actionCount) },
    { label: 'Risk', value: `L:${detail.lowRiskCount} M:${detail.mediumRiskCount} H:${detail.highRiskCount}` },
    { label: 'Approval Required', value: String(detail.approvalRequiredCount) },
    { label: 'Expired', value: detail.expired ? '✗ yes' : '○ no' },
    { label: 'WritesToMind', value: 'false' },
  ];
  
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });
  
  if (detail.topActions && detail.topActions.length > 0) {
    const actionsDiv = el.createDiv({ cls: 'brain-console__section' });
    actionsDiv.createEl('strong', { text: 'Top Actions:' });
    const list = actionsDiv.createEl('ul', { cls: 'brain-console__list' });
    detail.topActions.forEach(action => {
      list.createEl('li', { text: `${action.title} (${action.risk})` });
    });
  }

  return el;
}

function renderAgentViewLedgerCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');

  // Operating mode note
  const note = el.createEl('div', { cls: 'brain-console__list-note' });
  note.textContent = '● Read-only ledger · Approval-gated · Execution disabled';

  // Count summary
  const counts = el.createDiv({ cls: 'brain-console__row' });
  counts.createEl('dt', { text: 'Total Runs' });
  counts.createEl('dd', { text: `${state.agentRuns?.length ?? 0}` });

  if (state.agentRuns && state.agentRuns.length > 0) {
    const blocked = state.agentRuns.filter(r => r.status === 'blocked').length;
    const completed = state.agentRuns.filter(r => r.status === 'completed').length;

    if (blocked > 0) {
      const blockedRow = el.createDiv({ cls: 'brain-console__row' });
      blockedRow.createEl('dt', { text: 'Blocked' });
      blockedRow.createEl('dd', { text: `${blocked}`, cls: 'brain-console__list-warning' });
    }
    if (completed > 0) {
      const completedRow = el.createDiv({ cls: 'brain-console__row' });
      completedRow.createEl('dt', { text: 'Completed' });
      completedRow.createEl('dd', { text: `${completed}`, cls: 'brain-console__list-item-highlight' });
    }
  }

  // Latest runs (max 5)
  if (state.agentRuns && state.agentRuns.length > 0) {
    el.createEl('hr');
    el.createEl('strong', { text: 'Latest Runs (read-only):' });
    const list = el.createEl('ul', { cls: 'brain-console__list' });

    const maxRuns = Math.min(5, state.agentRuns.length);
    for (let i = 0; i < maxRuns; i++) {
      const run = state.agentRuns[i];
      const li = list.createEl('li');

      const title = li.createEl('strong', { text: run.title });
      li.appendText(` (${run.agentId})`);

      const details = li.createEl('div', { cls: 'brain-console__list-note' });
      const parts: string[] = [];
      parts.push(run.status);
      if (run.ageMinutes !== undefined) parts.push(`${run.ageMinutes}m old`);
      if (run.targetId) parts.push(`→ ${run.targetId}`);
      details.textContent = parts.join(' · ');

      if (run.blockers.length > 0) {
        const blocker = li.createEl('div', { cls: 'brain-console__list-warning', text: `⚠ ${run.blockers[0]}` });
      }

      // Safety chips
      const safety = li.createEl('div', { cls: 'brain-console__list-note' });
      const chips: string[] = [];
      if (!run.safety.writesToMind) chips.push('no Mind write');
      if (!run.safety.executesShell) chips.push('no shell');
      if (!run.safety.mutatesRuntime) chips.push('no runtime mutation');
      if (!run.safety.executionEnabled) chips.push('execution disabled');
      if (run.safety.requiresApproval) chips.push('approval required');
      safety.textContent = chips.join(' · ');
    }
  } else {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No agent runs available yet.' });
  }

  const footer = el.createEl('div', { cls: 'brain-console__list-note' });
  footer.innerHTML = '<em>Agent runtime is not autonomous. This view is a read-only ledger derived from approvals, reports, and status scans.</em>';

  return el;
}

function renderApprovalAuditTrailCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');

  if (!state.agentEvents || state.agentEvents.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No approval audit events available yet.' });
    return el;
  }

  // Latest audit events (max 8)
  const list = el.createEl('ul', { cls: 'brain-console__list' });
  const maxEvents = Math.min(8, state.agentEvents.length);

  for (let i = 0; i < maxEvents; i++) {
    const event = state.agentEvents[i];
    const li = list.createEl('li');

    // Event type with severity color
    const typeSpan = li.createEl('span', { cls: 'brain-console__list-item-highlight' });
    typeSpan.textContent = event.type.toUpperCase();

    if (event.severity === 'error') {
      li.classList.add('brain-console__list-error');
    } else if (event.severity === 'warning') {
      li.classList.add('brain-console__list-warning');
    }

    // Timestamp and approval ID
    const meta = li.createEl('div', { cls: 'brain-console__list-note' });
    const parts: string[] = [];
    if (event.createdAt) {
      const timeStr = formatRelativeTime(new Date(event.createdAt));
      parts.push(timeStr);
    }
    if (event.relatedApprovalId) parts.push(`#${event.relatedApprovalId}`);
    if (event.summary) parts.push(event.summary);
    meta.textContent = parts.join(' · ');
  }

  return el;
}

function renderRecoveryPanelCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');

  if (!state.recoveryItems || state.recoveryItems.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No recovery blockers detected.' });
    return el;
  }

  // Summary counts
  const errorCount = state.recoveryItems.filter(i => i.severity === 'error').length;
  const warningCount = state.recoveryItems.filter(i => i.severity === 'warning').length;

  if (errorCount > 0 || warningCount > 0) {
    const summary = el.createDiv({ cls: 'brain-console__row' });
    if (errorCount > 0) {
      const errRow = el.createDiv({ cls: 'brain-console__row' });
      errRow.createEl('dt', { text: 'Errors' });
      errRow.createEl('dd', { text: `${errorCount}`, cls: 'brain-console__list-error' });
    }
    if (warningCount > 0) {
      const warnRow = el.createDiv({ cls: 'brain-console__row' });
      warnRow.createEl('dt', { text: 'Warnings' });
      warnRow.createEl('dd', { text: `${warningCount}`, cls: 'brain-console__list-warning' });
    }
  }

  el.createEl('hr');

  // Top recovery items (max 8)
  const list = el.createEl('ul', { cls: 'brain-console__list' });
  const maxItems = Math.min(8, state.recoveryItems.length);

  for (let i = 0; i < maxItems; i++) {
    const item = state.recoveryItems[i];
    const li = list.createEl('li');

    if (item.severity === 'error') {
      li.classList.add('brain-console__list-error');
    } else if (item.severity === 'warning') {
      li.classList.add('brain-console__list-warning');
    }

    // Title
    const titleSpan = li.createEl('strong', { text: item.title });

    // Source and severity badge
    const badge = li.createEl('span', { cls: 'brain-console__list-note' });
    badge.textContent = ` [${item.source}]`;

    // Blocker
    if (item.blocker) {
      const blockerDiv = li.createEl('div', { cls: 'brain-console__list-sub', text: `⚠ ${item.blocker}` });
    }

    // Next safe step
    if (item.nextSafeStep) {
      const stepDiv = li.createEl('div', { cls: 'brain-console__list-sub', text: `→ ${item.nextSafeStep}` });
    }

    // Safety flags
    const safetyDiv = li.createEl('div', { cls: 'brain-console__list-note' });
    const safetyChips: string[] = [];
    if (!item.safety.canAutoFix) safetyChips.push('no auto-fix');
    if (!item.safety.writesToMind) safetyChips.push('no Mind write');
    safetyDiv.textContent = safetyChips.join(' · ');
  }

  return el;
}

function renderPostOrchestratorStatusCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const status = state.postOrchestratorStatus;
  const overview = state.postOrchestratorOverview?.overview;
  if (!status && !overview) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post orchestrator status available.' });
    return el;
  }

  const rows = overview
    ? [
        { label: 'Overview status', value: overview.status },
        { label: 'Flows', value: String(overview.counts.flows) },
        { label: 'Events', value: String(overview.counts.eventFixtures) },
        { label: 'Blockers', value: String(overview.blockers.length) },
        { label: 'Next safe step', value: overview.nextSafeStep },
      ]
    : [
        { label: 'Status', value: status?.status ?? 'unknown' },
        { label: 'Phase', value: status?.phase ?? 'unknown' },
        { label: 'Publishing', value: status?.publishingEnabled ? 'enabled' : 'disabled' },
        { label: 'Scheduling', value: status?.schedulingEnabled ? 'enabled' : 'disabled' },
        { label: 'Execution', value: status?.executionEnabled ? 'enabled' : 'disabled' },
        { label: 'Next safe step', value: status?.nextSafeStep ?? 'unknown' },
      ];

  renderCompactStatGrid(el, rows);
  el.appendChild(renderSafetyLabel('Publishing disabled · Scheduling disabled · Execution disabled'));

  return el;
}

function renderPostOrchestratorOverviewCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const overview = state.postOrchestratorOverview?.overview;
  if (!overview) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post orchestrator overview available.' });
    return el;
  }

  const rows = [
    { label: 'Flows', value: String(overview.counts.flows) },
    { label: 'Events', value: String(overview.counts.eventFixtures) },
    { label: 'Drafts', value: String(overview.counts.draftFixtures) },
    { label: 'Reviews', value: String(overview.counts.reviewItems) },
    { label: 'Schedules', value: String(overview.counts.schedulePreviewItems) },
    { label: 'Blockers', value: String(overview.blockers.length) },
  ];
  renderCompactStatGrid(el, rows);

  el.appendChild(renderSafetyLabel('Preview only · Publishing disabled · Scheduling disabled'));

  if (overview.blockers.length > 0) {
    const blockerList = el.createEl('ul', { cls: 'brain-console__list brain-console__blocker-list' });
    overview.blockers.slice(0, 5).forEach((blocker) => {
      blockerList.createEl('li', { text: `${blocker.label} · ${blocker.source} · ${blocker.severity}` });
      blockerList.createEl('li', { cls: 'brain-console__list-sub', text: blocker.nextSafeStep });
    });
  }

  return el;
}

function renderPlatformPostFlowsCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const status = state.postOrchestratorStatus;
  const flows = state.postOrchestratorFlows?.flows ?? [];
  if (flows.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post flow fixtures available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  flows.forEach((flow) => {
    list.createEl('li', { text: `${flow.name}: ${flow.status} · ${flow.platform} · pub:${flow.publishingEnabled ? 'on' : 'off'} · sched:${flow.schedulingEnabled ? 'on' : 'off'} · exec:${flow.executionEnabled ? 'on' : 'off'}` });
  });

  if (status?.socialProofFlowLabel) {
    el.createEl('div', { cls: 'brain-console__list-note', text: `Asset flow label: ${status.socialProofFlowLabel}` });
  }
  if (status?.growthOptimizationFlowLabel) {
    el.createEl('div', { cls: 'brain-console__list-note', text: `Optimization flow label: ${status.growthOptimizationFlowLabel}` });
  }

  return el;
}

function renderDraftFixturesCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const drafts = state.postOrchestratorDrafts?.drafts ?? [];
  if (drafts.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No draft fixtures available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  drafts.slice(0, 5).forEach((draft) => {
    list.createEl('li', {
      text: `${draft.title} · ${draft.platform} · ${draft.sourceEventType} · ${draft.format} · approval:${draft.approvalRequired ? 'yes' : 'no'} · pub:${draft.publishingEnabled ? 'on' : 'off'}`,
    });
  });

  return el;
}

function renderPostEventFixturesCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const events = state.postOrchestratorEvents?.events ?? [];
  if (events.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No event fixtures available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  events.slice(0, 5).forEach((event) => {
    list.createEl('li', {
      text: `${event.title} · ${event.source} · ${event.eventType} · platforms:${event.suggestedPlatforms.join(', ')} · fixture-only:${event.safety.fixtureOnly ? 'yes' : 'no'} · external-writes:${event.safety.writesExternalPlatform ? 'yes' : 'no'}`,
    });
  });

  return el;
}

function renderPostDryRunPlanCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const dryRun = state.postOrchestratorDryRun?.plan;
  if (!dryRun) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No dry-run plan available.' });
    return el;
  }

  const rows = [
    { label: 'Event', value: dryRun.event.title },
    { label: 'Status', value: dryRun.status },
    { label: 'Draft count', value: String(dryRun.drafts.length) },
    { label: 'Unsupported flows', value: String(dryRun.unsupportedFlowIds.length) },
    { label: 'Blockers', value: dryRun.blockers.length > 0 ? dryRun.blockers.join(' · ') : 'none' },
    { label: 'Next safe step', value: dryRun.nextSafeStep },
  ];

  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Preview only · Publishing disabled · Scheduling disabled · Execution disabled'));
  return el;
}

function renderPostDryRunDraftRowsCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const drafts = state.postOrchestratorDryRun?.plan?.drafts ?? [];
  if (drafts.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No dry-run draft rows available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  drafts.slice(0, 5).forEach((draft) => {
    list.createEl('li', {
      text: `${draft.platform} · ${draft.flowId} · ${draft.title} · ${draft.format} · ${draft.copyPreview.slice(0, 80)}${draft.copyPreview.length > 80 ? '…' : ''} · approval:${draft.approvalRequired ? 'yes' : 'no'} · pub:off · sched:off · exec:off`,
    });
  });

  return el;
}

function renderPostDraftReviewQueueCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const queue = state.postOrchestratorReviewQueue?.queue;
  if (!queue) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No review queue available.' });
    return el;
  }

  const rows = [
    { label: 'Event', value: queue.eventId },
    { label: 'Status', value: queue.status },
    { label: 'Items', value: String(queue.itemCount) },
    { label: 'Approval requested', value: String(queue.approvalRequestedCount) },
    { label: 'Blocked', value: String(queue.blockedCount) },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Review only · Publishing disabled · Scheduling disabled · Execution disabled'));

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  queue.items.slice(0, 5).forEach((item) => {
    const li = list.createEl('li');
    li.createEl('div', {
      text: `${item.title} · ${item.platform} · ${item.flowId} · ${item.format} · risk:${item.risk} · status:${item.status}`,
    });
    li.createEl('div', { cls: 'brain-console__list-sub', text: `${item.copyPreview.slice(0, 96)}${item.copyPreview.length > 96 ? '…' : ''}` });
    li.createEl('div', { cls: 'brain-console__list-note', text: `approval required: ${item.approvalRequired ? 'yes' : 'no'} · next: ${item.nextSafeStep}` });
    if (item.canRequestApproval) {
      const btn = li.createEl('button', { text: 'Request review approval', cls: 'brain-console__btn-mini' });
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const result = await requestBrainCorePostDraftReviewApproval(state.brainCoreUrl ?? '', item.id);
        const message = li.createDiv({ cls: 'brain-console__list-note' });
        if (result.value?.status === 'requested') {
          message.textContent = `approval requested · execution did not run · approvalId: ${result.value.approvalId ?? 'n/a'}`;
        } else {
          message.textContent = `blocked: ${result.value?.summary ?? result.error ?? 'unknown'}`;
        }
      });
    }
  });

  return el;
}

function renderPostSchedulePreviewQueueCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const queue = state.postOrchestratorSchedulePreview?.queue;
  if (!queue) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No schedule preview queue available.' });
    return el;
  }

  const rows = [
    { label: 'Event', value: queue.eventId },
    { label: 'Status', value: queue.status },
    { label: 'Items', value: String(queue.itemCount) },
    { label: 'Approval requested', value: String(queue.approvalRequestedCount) },
    { label: 'Blocked', value: String(queue.blockedCount) },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Preview only · No scheduler job · Publishing disabled · Execution disabled'));

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  queue.items.slice(0, 5).forEach((item) => {
    const li = list.createEl('li');
    li.createEl('div', {
      text: `${item.title} · ${item.platform} · ${item.scheduledWindow} · ${item.suggestedLocalTime} ${item.timezone} · status:${item.status}`,
    });
    li.createEl('div', { cls: 'brain-console__list-sub', text: item.rationale });
    li.createEl('div', { cls: 'brain-console__list-note', text: `approval required: ${item.approvalRequired ? 'yes' : 'no'} · next: ${item.nextSafeStep}` });
    if (item.canRequestApproval) {
      const btn = li.createEl('button', { text: 'Request schedule review', cls: 'brain-console__btn-mini' });
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const result = await requestBrainCorePostSchedulePreviewApproval(state.brainCoreUrl ?? '', item.id);
        const message = li.createDiv({ cls: 'brain-console__list-note' });
        if (result.value?.status === 'requested') {
          message.textContent = `approval requested · execution did not run · approvalId: ${result.value.approvalId ?? 'n/a'}`;
        } else {
          message.textContent = `blocked: ${result.value?.summary ?? result.error ?? 'unknown'}`;
        }
      });
    }
  });

  return el;
}

function renderPostAnalyticsFixturesCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const analytics = state.postOrchestratorAnalytics?.analytics ?? [];

  if (analytics.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No analytics fixtures available.' });
    return el;
  }

  const rows = [
    { label: 'Fixtures', value: String(analytics.length) },
    { label: 'Platforms', value: String(new Set(analytics.map((item) => item.platform)).size) },
    { label: 'External API', value: analytics.some((item) => item.safety.callsExternalAnalyticsApi) ? 'enabled' : 'disabled' },
    { label: 'Next safe step', value: 'Review fixture analytics and keep external analytics calls disabled.' },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Fixture only · No external analytics · No external writes · No Mind writes'));

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  analytics.slice(0, 5).forEach((item) => {
    const li = list.createEl('li');
    li.createEl('div', {
      text: `${item.title} · ${item.platform} · ${item.flowId} · impressions:${item.metrics.impressions} · clicks:${item.metrics.clicks} · ctr:${item.metrics.ctr}`,
    });
    li.createEl('div', { cls: 'brain-console__list-sub', text: item.interpretation });
    li.createEl('div', { cls: 'brain-console__list-note', text: item.feedbackForFlow });
  });

  return el;
}

function renderPostPipelineSummaryCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const pipeline = state.postOrchestratorPipeline?.pipeline;
  if (!pipeline) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No pipeline summary available.' });
    return el;
  }

  const rows = [
    { label: 'Event', value: pipeline.title },
    { label: 'Status', value: pipeline.status },
    { label: 'Drafts', value: String(pipeline.totals.draftCount) },
    { label: 'Review items', value: String(pipeline.totals.reviewItemCount) },
    { label: 'Schedule previews', value: String(pipeline.totals.schedulePreviewItemCount) },
    { label: 'Analytics fixtures', value: String(pipeline.totals.analyticsFixtureCount) },
    { label: 'Blockers', value: String(pipeline.totals.blockerCount) },
    { label: 'Approval required', value: String(pipeline.totals.approvalRequiredCount) },
    { label: 'Next safe step', value: pipeline.nextSafeStep },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Preview only · Publishing disabled · Scheduling disabled · Execution disabled'));

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  pipeline.steps.forEach((step) => {
    const li = list.createEl('li');
    li.createEl('div', { text: `${step.label} · ${step.status} · items:${step.itemCount} · blocked:${step.blockedCount} · approvals:${step.approvalRequiredCount}` });
    li.createEl('div', { cls: 'brain-console__list-sub', text: step.summary });
    li.createEl('div', { cls: 'brain-console__list-note', text: step.nextSafeStep });
  });

  return el;
}

function renderPostReadinessScoreCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const readiness = state.postOrchestratorReadiness?.readiness;
  if (!readiness) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No readiness score available.' });
    return el;
  }

  const rows = [
    { label: 'Score', value: String(readiness.score) },
    { label: 'Grade', value: readiness.grade },
    { label: 'Status', value: readiness.status },
    { label: 'Blockers', value: String(readiness.blockers.length) },
    { label: 'Next safe step', value: readiness.nextSafeStep },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Review only · Publishing disabled · Scheduling disabled'));

  if (readiness.blockers.length > 0) {
    const blockList = el.createEl('ul', { cls: 'brain-console__list' });
    readiness.blockers.slice(0, 5).forEach((blocker) => {
      blockList.createEl('li', { text: `${blocker.title} · ${blocker.summary}` });
    });
  }

  if (readiness.checks.length > 0) {
    const checkList = el.createEl('ul', { cls: 'brain-console__list' });
    readiness.checks.slice(0, 8).forEach((check) => {
      checkList.createEl('li', { text: `${check.label}: ${check.passed ? 'pass' : 'fail'} · ${check.summary}` });
    });
  }

  return el;
}

function renderPostPlatformPolicyCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const policies = state.postOrchestratorPlatformPolicies?.policies ?? [];
  if (policies.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No platform policies available.' });
    return el;
  }

  const rows = [
    { label: 'Policies', value: String(policies.length) },
    { label: 'Blocked / high-risk', value: String(policies.filter((policy) => policy.status === 'blocked' || policy.riskLevel === 'blocked' || policy.riskLevel === 'high').length) },
    { label: 'Next safe step', value: policies.find((policy) => policy.status === 'review-required' || policy.status === 'blocked')?.nextSafeStep ?? 'Keep platform policies review-only.' },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('No cookies · No Playwright · No external writes · Publishing disabled'));

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  policies.slice(0, 7).forEach((policy) => {
    list.createEl('li', {
      text: `${policy.label} · mode:${policy.publishingMode} · risk:${policy.riskLevel} · status:${policy.status} · next:${policy.nextSafeStep}`,
    });
  });

  return el;
}

function renderPostDecommissionReadinessCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const readiness = state.postOrchestratorDecommissionReadiness;
  if (!readiness) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No decommission readiness data available.' });
    return el;
  }

  const rows = [
    { label: 'Overall status', value: readiness.overall.status },
    { label: 'Items', value: String(readiness.items.length) },
    { label: 'Blocked', value: String(readiness.overall.blockedCount) },
    { label: 'Ready', value: String(readiness.overall.readyCount) },
    { label: 'Next safe step', value: readiness.overall.nextSafeStep },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Decommission not started · Approval required · No file deletes'));

  if (readiness.items.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    readiness.items.forEach((item) => {
      const passed = item.gates.filter((gate) => gate.passed).length;
      list.createEl('li', {
        text: `${item.label} · ${item.status} · gates:${passed}/${item.gates.length} · blockers:${item.blockerCount} · next:${item.nextSafeStep}`,
      });
    });
  }

  return el;
}

function renderPostOperatorGuidanceCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const guidance = state.postOrchestratorOperatorGuidance;
  if (!guidance) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No operator guidance available.' });
    return el;
  }

  const rows = [
    { label: 'Items', value: String(guidance.summary.itemCount) },
    { label: 'Blocked', value: String(guidance.summary.blockedCount) },
    { label: 'Warnings', value: String(guidance.summary.warningCount) },
    { label: 'Next safe step', value: guidance.summary.nextSafeStep },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Read only · No auto-fix · Publishing disabled · No external writes'));

  if (guidance.items.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    guidance.items.slice(0, 6).forEach((item) => {
      const li = list.createEl('li');
      li.createEl('div', { text: `${item.title} · ${item.category} · ${item.severity}` });
      li.createEl('div', { cls: 'brain-console__list-sub', text: item.summary });
      li.createEl('div', { cls: 'brain-console__list-note', text: item.nextSafeStep });
      li.createEl('div', { cls: 'brain-console__list-note', text: item.steps.slice(0, 2).map((step) => step.label).join(' · ') });
    });
  }

  return el;
}

function renderPostManualExportCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const packagePreview = state.postOrchestratorManualExportPackage?.package;
  if (!packagePreview) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No manual export preview available.' });
    return el;
  }

  const rows = [
    { label: 'Package', value: packagePreview.title },
    { label: 'Items', value: String(packagePreview.itemCount) },
    { label: 'Status', value: packagePreview.status },
    { label: 'Next safe step', value: packagePreview.nextSafeStep },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Preview only · No file writes · No clipboard · No publishing'));

  if (packagePreview.items.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    packagePreview.items.slice(0, 5).forEach((item) => {
      const li = list.createEl('li');
      li.createEl('div', { text: `${item.platform} · ${item.title} · ${item.format}` });
      li.createEl('div', { cls: 'brain-console__list-sub', text: `${item.contentPreview.slice(0, 96)}${item.contentPreview.length > 96 ? '…' : ''}` });
      li.createEl('div', { cls: 'brain-console__list-note', text: item.checklist.slice(0, 3).join(' · ') });
    });
  }

  return el;
}

function renderPostAcceptanceChecklistCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const checklist = state.postOrchestratorAcceptanceChecklist?.checklist;
  if (!checklist) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No acceptance checklist available.' });
    return el;
  }

  const rows = [
    { label: 'Passed', value: String(checklist.passedCount) },
    { label: 'Blocked', value: String(checklist.blockedCount) },
    { label: 'Failed', value: String(checklist.failedCount) },
    { label: 'Required', value: String(checklist.requiredCount) },
    { label: 'Next safe step', value: checklist.nextSafeStep },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Read only · Publishing disabled · Scheduling disabled · No decommission'));

  if (checklist.checks.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    checklist.checks.slice(0, 8).forEach((check) => {
      list.createEl('li', {
        text: `${check.label} · ${check.status} · required:${check.required ? 'yes' : 'no'} · ${check.summary}`,
      });
      const details = list.createEl('li', { cls: 'brain-console__list-sub', text: `evidence: ${check.evidence.slice(0, 2).join(' · ')}` });
      details.createEl('div', { cls: 'brain-console__list-note', text: check.nextSafeStep });
    });
  }

  return el;
}

function renderPostMigrationParityReportCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const report = state.postOrchestratorMigrationParity?.report;
  if (!report) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No migration parity report available.' });
    return el;
  }

  const rows = [
    { label: 'Overall score', value: String(report.overallParityScore) },
    { label: 'Status', value: report.status },
    { label: 'Blocked capabilities', value: String(report.blockers.length) },
    { label: 'Next safe step', value: report.nextSafeStep },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('No legacy repo changes · No decommission · Approval required'));

  if (report.capabilities.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    report.capabilities.slice(0, 9).forEach((capability) => {
      list.createEl('li', {
        text: `${capability.label} · ${capability.status} · score:${capability.parityScore} · ${capability.summary}`,
      });
      list.createEl('li', { cls: 'brain-console__list-sub', text: `gaps: ${capability.remainingGaps.slice(0, 2).join(' · ') || 'none'} · next: ${capability.nextSafeStep}` });
    });
  }

  return el;
}

function renderPostRoadmapCheckpointCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const checkpoint = state.postOrchestratorRoadmapCheckpoint?.checkpoint;
  if (!checkpoint) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No roadmap checkpoint available.' });
    return el;
  }

  const rows = [
    { label: 'Current phase', value: checkpoint.currentPhase },
    { label: 'Completed phases', value: String(checkpoint.completedPhaseCount) },
    { label: 'Blocked phases', value: String(checkpoint.blockedPhaseCount) },
    { label: 'Next recommended phase', value: checkpoint.nextRecommendedPhase },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Read only · Future publishing/scheduling design requires approval'));

  if (checkpoint.phases.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    checkpoint.phases.slice(0, 15).forEach((phase) => {
      list.createEl('li', {
        text: `${phase.id} · ${phase.label} · ${phase.status} · ${phase.summary}`,
      });
      list.createEl('li', { cls: 'brain-console__list-sub', text: phase.evidence.slice(0, 2).join(' · ') });
    });
  }

  return el;
}

function renderSafetyStateCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const flows = state.postOrchestratorFlows?.flows ?? [];
  const drafts = state.postOrchestratorDrafts?.drafts ?? [];
  const dryRun = state.postOrchestratorDryRun?.plan;

  const rows = [
    { label: 'Dry-run only', value: dryRun?.safety.dryRunOnly ? 'yes' : 'no' },
    { label: 'Publishing disabled', value: flows.every((flow) => flow.publishingEnabled === false) && dryRun?.safety.publishingEnabled === false ? 'yes' : 'no' },
    { label: 'Scheduling disabled', value: flows.every((flow) => flow.schedulingEnabled === false) && dryRun?.safety.schedulingEnabled === false ? 'yes' : 'no' },
    { label: 'Execution disabled', value: flows.every((flow) => flow.executionEnabled === false) && dryRun?.safety.executionEnabled === false ? 'yes' : 'no' },
    { label: 'No platform writes', value: drafts.every((draft) => draft.safety.writesExternalPlatform === false) ? 'yes' : 'no' },
    { label: 'No Mind writes', value: drafts.every((draft) => draft.safety.writesToMind === false) && dryRun?.safety.writesToMind === false ? 'yes' : 'no' },
    { label: 'No Playwright/cookies', value: drafts.every((draft) => draft.safety.usesPlaywright === false) && dryRun?.safety.usesPlaywright === false && dryRun?.safety.usesCookies === false ? 'yes' : 'no' },
  ];

  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  return el;
}

function renderBrainConsoleQaStatusCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const qa = state.postOrchestratorQaStatus?.qaStatus;
  if (!qa) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'QA status not available.' });
    return el;
  }

  const coveragePercent = qa.endpointCount > 0 ? Math.round((qa.coveredCount / qa.endpointCount) * 100) : 0;
  const rows = [
    { label: 'Status', value: qa.status },
    { label: 'Endpoints', value: `${qa.coveredCount}/${qa.endpointCount}` },
    { label: 'Coverage', value: `${coveragePercent}%` },
    { label: 'Manual checks', value: String(qa.manualCheckCount) },
    { label: 'Next safe step', value: qa.nextSafeStep || 'ready for manual QA' },
  ];
  rows.forEach(({ label, value }) => {
    const row = el.createDiv({ cls: 'brain-console__row' });
    row.createEl('dt', { text: label });
    row.createEl('dd', { text: value });
  });

  el.appendChild(renderSafetyLabel('Preview only · Publishing disabled · Scheduling disabled · Execution disabled · No external writes · No Mind writes'));

  return el;
}

function renderVisualQaChecklistCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const qa = state.postOrchestratorQaStatus?.qaStatus;

  const fallbackChecklist = [
    'Overview card visible',
    'Flow Preview group visible',
    'Review / Schedule group visible',
    'Safety / Policy group visible',
    'Migration / Checkpoint group visible',
    'Publishing disabled label visible',
    'Scheduling disabled label visible',
    'No publish/schedule/run buttons visible',
    'No legacy provider labels visible',
    'Next safe step visible',
  ];

  if (qa?.checklist && qa.checklist.length > 0) {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    qa.checklist.slice(0, 10).forEach((item) => {
      const statusIcon = item.status === 'manual-check' ? '◐' : '?';
      list.createEl('li', { text: `${statusIcon} ${item.label}` });
      if (item.summary) {
        list.createEl('li', { cls: 'brain-console__list-sub', text: item.summary });
      }
    });
  } else {
    const list = el.createEl('ul', { cls: 'brain-console__list' });
    fallbackChecklist.forEach((item) => {
      list.createEl('li', { text: `◐ ${item}` });
    });
  }

  return el;
}

function renderPostContractsCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const contracts = state.postOrchestratorContracts?.contracts ?? [];

  if (contracts.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post contracts available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  contracts.forEach((contract) => {
    list.createEl('li', {
      text: `${contract.id}: ${contract.status} · brain=${contract.implementedInBrain ? 'yes' : 'no'} · provider=${contract.implementedInProvider ? 'yes' : 'no'}`,
    });
  });

  return el;
}

function renderPostRecoveryCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const recovery = state.postOrchestratorRecovery?.items ?? [];

  if (recovery.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No post recovery items available.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  recovery.forEach((item) => {
    list.createEl('li', { text: `${item.id}: ${item.blocker}` });
  });

  return el;
}

function renderPublishingDisabledCard(): HTMLElement {
  const el = document.createElement('div');
  el.createEl('div', {
    cls: 'brain-console__post-disabled',
    text: 'Publishing is disabled. No post is scheduled or published from Brain in Phase P1.',
  });
  return el;
}


function renderRecentSessionsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const sessions = state.sessions ?? [];
  if (sessions.length === 0) {
    container.createEl('p', { cls: 'brain-console__detail', text: 'No recent sessions available.' });
    return container;
  }

  const list = container.createDiv({ cls: 'brain-console__list' });
  sessions.slice(0, 5).forEach((session) => {
    const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
    const toolBadge = row.createEl('span', { cls: 'brain-console__badge', text: session.tool });
    toolBadge.style.fontSize = '0.75rem';
    toolBadge.style.marginRight = '0.5rem';
    row.createEl('strong', { text: session.title || session.id });
    row.createEl('div', {
      cls: 'brain-console__list-sub',
      text: `${session.age ?? '?'} · ${session.repo ? session.repo.split('/').pop() : 'unknown'}`,
    });
  });

  return container;
}


function renderProBotDashboardParityCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const parity = state.probotDashboardParity;
  if (!parity) {
    return renderProBotFallbackMap(container);
  }

  renderCompactStatGrid(container, [
    { label: 'Tabs tracked', value: String(parity.summary.totalTabs) },
    { label: 'Visible', value: String(parity.summary.visibleInBrainConsoleCount) },
    { label: 'Working', value: String(parity.summary.workingInBrainConsoleCount) },
    { label: 'Partial', value: String(parity.summary.partialCount) },
    { label: 'Legacy only', value: String(parity.summary.legacyOnlyCount) },
    { label: 'Blockers', value: String(parity.summary.blockerCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  parity.tabs.forEach((tab) => {
    const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
    row.createEl('strong', { text: `${tab.probotLabel} → ${tab.brainConsoleSection}` });
    row.createEl('div', {
      cls: 'brain-console__list-sub',
      text: `${tab.status} · ${tab.decision} · visible: ${tab.visibleInBrainConsole ? 'yes' : 'no'} · working: ${tab.workingInBrainConsole ? 'yes' : 'no'}`,
    });
  });

  container.appendChild(renderSafetyLabel('Read-only · No secrets · No mutation controls · No direct shell execution'));
  return container;
}


async function readBrainCoreProBotDashboardParity(baseUrl: string): Promise<{ value?: BrainCoreProBotDashboardParityResponse; error?: string; detail?: string; status?: number; url?: string }> {
  const url = `${baseUrl.replace(/\/$/, '')}/probot/dashboard-parity`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { error: `HTTP ${response.status}`, status: response.status, url };
    }
    const value = await response.json() as BrainCoreProBotDashboardParityResponse;
    return { value };
  } catch (error) {
    return { error: 'request_failed', detail: error instanceof Error ? error.message : String(error), url };
  }
}

function renderProBotFallbackMap(container: HTMLElement): HTMLElement {
  container.createEl('div', { cls: 'brain-console__warning', text: '⚠ Brain Core /probot/dashboard-parity unavailable. Showing static migration map.' });

  const tabs = [
    { name: 'Overview', status: 'available' },
    { name: 'Local Apps', status: 'available' },
    { name: 'Production Pipeline', status: 'partial' },
    { name: 'Video Orchestrator Studio', status: 'partial' },
    { name: 'Viral Flow', status: 'partial' },
    { name: 'Session History', status: 'available' },
    { name: 'System Updates', status: 'planned' },
    { name: 'Stripe', status: 'legacy/admin-only' },
  ];

  const grid = container.createDiv({ cls: 'brain-console__probot-map' });
  for (const tab of tabs) {
    const row = grid.createDiv({ cls: 'brain-console__probot-tab' });
    row.createEl('span', { cls: 'brain-console__probot-name', text: tab.name });
    const badge = row.createEl('span', { cls: 'brain-console__badge', text: tab.status });
    badge.addClass(`badge-${tab.status.replace('/', '-')}`);
  }

  container.createEl('div', { cls: 'brain-console__safety-note', text: 'Read-only · No secrets · No mutation controls' });

  return container;
}

function renderDiagnosticsPanel(shell: HTMLElement, state: BrainConsoleViewState): void {
  if (!state.endpointErrors || state.endpointErrors.length === 0) {
    return;
  }

  const panel = shell.createDiv({ cls: 'brain-console__diagnostics' });
  panel.createEl('div', { cls: 'brain-console__diagnostics-title', text: 'Diagnostics' });

  for (const error of state.endpointErrors) {
    const item = panel.createDiv({ cls: 'brain-console__diagnostics-item' });
    item.createEl('div', { cls: 'brain-console__diagnostics-endpoint', text: error.pathname });
    item.createEl('div', { cls: 'brain-console__diagnostics-error', text: error.error });
  }
}


function renderVideoThumbnailDesignPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoThumbnailDesignPlans;

  if (!data) {
    return renderEmptyState('Thumbnail design plan unavailable', 'Brain Core /video-orchestrator/thumbnail-design did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Plans', value: String(data.summary.planCount) },
    { label: 'Variants', value: String(data.summary.variantCount) },
    { label: 'Generated assets', value: String(data.summary.generatedAssetCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.plans.slice(0, 3).forEach((plan) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${plan.storyId}: ${plan.title}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${plan.variants.length} variants · ${plan.status}` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No image generation · No rendering · No writes'));
  return container;
}

function renderVideoArchiveLoggingPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoArchiveLoggingPlans;

  if (!data) {
    return renderEmptyState('Archive/audit logging plan unavailable', 'Brain Core /video-orchestrator/archive-logging-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Plans', value: String(data.summary.planCount) },
    { label: 'Checks', value: String(data.summary.loggingCheckCount) },
    { label: 'Persisted records', value: String(data.summary.persistedRecordCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.plans.slice(0, 3).forEach((plan) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${plan.storyId}: ${plan.title}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${plan.loggingChecks.length} checks · ${plan.status}` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No archive writes · No audit persistence · No log ingest'));
  return container;
}

function renderVideoDesignProviderBoundaryPlanCard(state: BrainConsoleViewState, _snapshot: DashboardSnapshot): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const data = state.videoDesignProviderBoundaryPlans;

  if (!data) {
    return renderEmptyState('Design provider boundary plan unavailable', 'Brain Core /video-orchestrator/design-provider-boundary-plan did not return a response.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: data.status },
    { label: 'Boundaries', value: String(data.summary.boundaryCount) },
    { label: 'Providers configured', value: String(data.summary.providerConfiguredCount) },
    { label: 'Provider calls', value: String(data.summary.providerCallCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  data.boundaries.slice(0, 3).forEach((boundary) => {
    list.createEl('div', { cls: 'brain-console__list-note', text: `${boundary.providerClass}: ${boundary.status}` });
    list.createEl('div', { cls: 'brain-console__list-sub', text: `${boundary.requiredGates.length} required gates · ${boundary.blockers.length} blockers` });
  });

  container.appendChild(renderSafetyLabel('Read-only · No provider calls · No credentials · No network · No writes'));
  return container;
}

function renderProBotSessionsParityCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const parity = state.probotSessionsParity;
  if (!parity) {
    return renderEmptyState('Sessions parity unavailable', 'Brain Core /probot/sessions-parity endpoint did not respond.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: parity.status },
    { label: 'Visible in Brain Console', value: parity.visibleInBrainConsole ? 'yes' : 'no' },
    { label: 'Working in Brain Console', value: parity.workingInBrainConsole ? 'yes' : 'no' },
    { label: 'Features', value: String(parity.featureCount) },
  ]);

  if (parity.features && parity.features.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    parity.features.forEach((feature) => {
      const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      row.createEl('strong', { text: `${feature.label}` });
      row.createEl('div', {
        cls: 'brain-console__list-sub',
        text: `${feature.migrationDecision} · ${feature.migrationStatus}`,
      });
    });
  }

  container.appendChild(renderSafetyLabel('Read-only · No secrets · No mutation controls'));
  return container;
}

function renderProBotLocalAppsParityCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const parity = state.probotLocalAppsParity;
  if (!parity) {
    return renderEmptyState('Local apps parity unavailable', 'Brain Core /probot/local-apps-parity endpoint did not respond.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: parity.status },
    { label: 'Visible in Brain Console', value: parity.visibleInBrainConsole ? 'yes' : 'no' },
    { label: 'Working in Brain Console', value: parity.workingInBrainConsole ? 'yes' : 'no' },
    { label: 'Features', value: String(parity.featureCount) },
  ]);

  if (parity.features && parity.features.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    parity.features.forEach((feature) => {
      const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      row.createEl('strong', { text: `${feature.label}` });
      row.createEl('div', {
        cls: 'brain-console__list-sub',
        text: `${feature.migrationDecision} · ${feature.migrationStatus}`,
      });
    });
  }

  container.appendChild(renderSafetyLabel('Read-only · No start/stop controls · No mutations'));
  return container;
}

function renderProBotSchedulerParityCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const parity = state.probotSchedulerParity;
  if (!parity) {
    return renderEmptyState('Scheduler parity unavailable', 'Brain Core /probot/scheduler-parity endpoint did not respond.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: parity.status },
    { label: 'Visible in Brain Console', value: parity.visibleInBrainConsole ? 'yes' : 'no' },
    { label: 'Working in Brain Console', value: parity.workingInBrainConsole ? 'yes' : 'no' },
    { label: 'Features', value: String(parity.featureCount) },
  ]);

  if (parity.features && parity.features.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    parity.features.forEach((feature) => {
      const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      row.createEl('strong', { text: `${feature.label}` });
      row.createEl('div', {
        cls: 'brain-console__list-sub',
        text: `${feature.migrationDecision} · ${feature.migrationStatus}`,
      });
    });
  }

  container.appendChild(renderSafetyLabel('Read-only · No execution controls · No mutations'));
  return container;
}

function renderProBotStudioParityCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const parity = state.probotStudioParity;
  if (!parity) {
    return renderEmptyState('Studio parity unavailable', 'Brain Core /probot/studio-parity endpoint did not respond.');
  }

  renderCompactStatGrid(container, [
    { label: 'Status', value: parity.status },
    { label: 'Visible in Brain Console', value: parity.visibleInBrainConsole ? 'yes' : 'no' },
    { label: 'Working in Brain Console', value: parity.workingInBrainConsole ? 'yes' : 'no' },
    { label: 'Features', value: String(parity.featureCount) },
  ]);

  if (parity.features && parity.features.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    parity.features.forEach((feature) => {
      const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      row.createEl('strong', { text: `${feature.label}` });
      row.createEl('div', {
        cls: 'brain-console__list-sub',
        text: `${feature.migrationDecision} · ${feature.migrationStatus}`,
      });
      if (feature.blockedReason) {
        row.createEl('div', {
          cls: 'brain-console__list-note',
          text: feature.blockedReason,
        });
      }
    });
  }

  container.appendChild(renderSafetyLabel('Read-only · Partial migration · Video Orchestrator ready'));
  return container;
}

function renderProBotExternalAdminParityCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const parity = state.probotExternalAdminParity;
  if (!parity) {
    return renderEmptyState('External admin parity unavailable', 'Brain Core /probot/external-admin-parity endpoint did not respond.');
  }

  // Add prominent header explaining legacy/admin-only nature
  const header = container.createDiv({ cls: 'brain-console__warning' });
  header.createEl('strong', { text: '⚠ All integrations are intentionally admin-only (no safe data available)' });

  renderCompactStatGrid(container, [
    { label: 'Status', value: parity.status },
    { label: 'Legacy only', value: parity.legacyOnly ? 'yes' : 'no' },
    { label: 'Visible in Brain Console', value: parity.visibleInBrainConsole ? 'yes' : 'no' },
    { label: 'Features', value: String(parity.featureCount) },
  ]);

  if (parity.features && parity.features.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    parity.features.forEach((feature) => {
      const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      row.createEl('strong', { text: `${feature.label}` });
      row.createEl('div', {
        cls: 'brain-console__list-sub',
        text: `${feature.migrationDecision} · ${feature.blockedReason}`,
      });
    });
  }

  const safetyNote = `Read-only · No credentials · No secrets · No OAuth · No Stripe data · All admin-only`;
  container.appendChild(renderSafetyLabel(safetyNote));
  return container;
}

function renderProBotDecommissionReadinessCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const readiness = state.probotDecommissionReadiness;
  if (!readiness) {
    return renderEmptyState('Decommission readiness unavailable', 'Brain Core /probot/decommission-readiness endpoint did not respond.');
  }

  // Add prominent "Not ready" header
  const header = container.createDiv({ cls: 'brain-console__warning' });
  header.createEl('strong', { text: readiness.ready ? '✓ Ready for decommission' : '✗ NOT READY FOR DECOMMISSION' });

  const totalCriteria = readiness.satisfiedCriteriaCount + readiness.unsatisfiedCriteriaCount;
  renderCompactStatGrid(container, [
    { label: 'Status', value: readiness.status },
    { label: 'Criteria satisfied', value: `${readiness.satisfiedCriteriaCount} / ${totalCriteria}` },
    { label: 'Requires approval', value: String(readiness.unsatisfiedCriteriaCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  if (readiness.criteria && readiness.criteria.length > 0) {
    const satisfied = readiness.criteria.filter(c => c.satisfied);
    const unsatisfied = readiness.criteria.filter(c => !c.satisfied);

    if (satisfied.length > 0) {
      const satisfiedDiv = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      satisfiedDiv.createEl('strong', { text: '✓ Satisfied' });
      satisfied.forEach((criteria) => {
        satisfiedDiv.createEl('div', {
          cls: 'brain-console__list-sub',
          text: `${criteria.label}: ${criteria.description}`,
        });
      });
    }

    if (unsatisfied.length > 0) {
      const unsatisfiedDiv = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      unsatisfiedDiv.createEl('strong', { text: '✗ Unsatisfied (requires approval)' });
      unsatisfied.forEach((criteria) => {
        unsatisfiedDiv.createEl('div', {
          cls: 'brain-console__list-sub',
          text: `${criteria.label}: ${criteria.description}`,
        });
      });
    }
  }

  const safetyNote = `Read-only · Decommission disabled · User approval required · No auto-decommission`;
  container.appendChild(renderSafetyLabel(safetyNote));
  return container;
}

function renderProBotExternalAdminSafeMetadataCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const metadata = state.probotExternalAdminSafeMetadata;
  if (!metadata) {
    return renderEmptyState('External admin safe metadata unavailable', 'Brain Core /probot/external-admin-safe-metadata endpoint did not respond.');
  }

  const integrations = metadata.integrations ?? [];
  const integrationCount = metadata.integrationCount ?? 0;
  const safeMetadataAvailableCount = metadata.safeMetadataAvailableCount ?? 0;
  const metadataOnlyCount = metadata.metadataOnlyCount ?? 0;
  const legacyOnlyCount = metadata.legacyOnlyCount ?? 0;

  renderCompactStatGrid(container, [
    { label: 'Status', value: metadata.status ?? 'unknown' },
    { label: 'Total integrations', value: String(integrationCount) },
    { label: 'Safe metadata available', value: String(safeMetadataAvailableCount) },
    { label: 'Metadata-only', value: String(metadataOnlyCount) },
    { label: 'Legacy-only', value: String(legacyOnlyCount) },
  ]);

  if (integrations.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    integrations.forEach((integration) => {
      const row = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      row.createEl('strong', { text: `${integration.label ?? 'Unknown'}` });
      const decision = integration.migrationDecision ?? 'unknown';
      const reason = (integration.blockedReason ?? 'no details').substring(0, 60);
      row.createEl('div', {
        cls: 'brain-console__list-sub',
        text: `${decision} · ${reason}...`,
      });
    });
  }

  container.appendChild(renderSafetyLabel('Read-only · Metadata only · No secrets · No financial data'));
  return container;
}

function renderProBotFeatureParityMatrixCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const matrix = state.probotFeatureParityMatrix;
  if (!matrix) {
    return renderEmptyState('Feature parity matrix unavailable', 'Brain Core /probot/feature-parity-matrix endpoint did not respond.');
  }

  const rows = matrix.rows ?? [];
  const tabCount = matrix.tabCount ?? 0;
  const coveredCount = matrix.coveredCount ?? 0;
  const partialCount = matrix.partialCount ?? 0;
  const legacyOnlyCount = matrix.legacyOnlyCount ?? 0;
  const decommissionReady = matrix.decommissionReady ?? false;

  renderCompactStatGrid(container, [
    { label: 'Total tabs', value: String(tabCount) },
    { label: 'Covered', value: String(coveredCount) },
    { label: 'Partial', value: String(partialCount) },
    { label: 'Legacy-only', value: String(legacyOnlyCount) },
    { label: 'Decommission ready', value: decommissionReady ? 'yes' : 'not yet' },
  ]);

  if (rows.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    rows.forEach((row) => {
      const item = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      item.createEl('strong', { text: `${row.probotTab ?? 'Unknown'}` });
      const status = row.parityStatus ?? 'unknown';
      const dataStatus = row.safeDataStatus ?? 'unknown';
      item.createEl('div', {
        cls: 'brain-console__list-sub',
        text: `${status} · ${dataStatus}`,
      });
    });
  }

  container.appendChild(renderSafetyLabel('Read-only · ProBot still operational · Decommission blocked'));
  return container;
}

function renderProBotPhaseOutChecklistCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const checklist = state.probotPhaseOutChecklist;
  if (!checklist) {
    return renderEmptyState('Phase-out checklist unavailable', 'Brain Core /probot/phase-out-checklist endpoint did not respond.');
  }

  const items = checklist.items ?? [];
  const itemCount = checklist.itemCount ?? items.length ?? 0;
  const satisfiedCount = checklist.satisfiedCount ?? 0;
  const requiresApprovalCount = checklist.requiresApprovalCount ?? 0;
  const ready = checklist.ready ?? false;

  // Add prominent "NOT READY" header
  const header = container.createDiv({ cls: 'brain-console__warning' });
  header.createEl('strong', { text: ready ? '✓ Ready for phase-out' : '✗ NOT READY FOR PHASE-OUT' });

  renderCompactStatGrid(container, [
    { label: 'Status', value: checklist.status ?? 'unknown' },
    { label: 'Items', value: String(itemCount) },
    { label: 'Satisfied', value: `${satisfiedCount} / ${itemCount}` },
    { label: 'Requires approval', value: String(requiresApprovalCount) },
  ]);

  const list = container.createDiv({ cls: 'brain-console__list' });
  if (items.length > 0) {
    const satisfied = items.filter(i => i?.satisfied ?? false);
    const unsatisfied = items.filter(i => !(i?.satisfied ?? false));

    if (unsatisfied.length > 0) {
      const unsatisfiedDiv = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      unsatisfiedDiv.createEl('strong', { text: '✗ Unsatisfied (blocking)' });
      unsatisfied.forEach((item) => {
        if (item?.requiresUserApproval ?? false) {
          unsatisfiedDiv.createEl('div', {
            cls: 'brain-console__list-sub',
            text: `${item?.label ?? 'Unknown'} [USER APPROVAL REQUIRED]`,
          });
        }
      });
    }
  }

  container.appendChild(renderSafetyLabel('Read-only · ProBot still operational · Decommission blocked'));
  return container;
}

function renderBrainCoreConnectionDiagnosticsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const diag = state.connectionDiagnostics;
  if (!diag) {
    return renderEmptyState('Diagnostics unavailable', 'Connection diagnostics not collected.');
  }

  const modeDiv = container.createDiv();
  modeDiv.createEl('strong', { text: 'Connection Status' });
  const modeText = diag.allFailed ? '⚠ Offline / Unreachable' : '● Connected';
  modeDiv.createEl('p', { text: modeText });

  renderCompactStatGrid(container, [
    { label: 'Configured URL', value: diag.configuredUrl ?? 'not set' },
    { label: 'Selected URL', value: diag.selectedUrl ?? 'none' },
    { label: 'Attempts', value: String(diag.attempts?.length ?? 0) },
    { label: 'Status', value: diag.allFailed ? 'All failed' : 'Connected' },
  ]);

  if (diag.attempts && diag.attempts.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__list' });
    diag.attempts.forEach((attempt) => {
      const item = list.createDiv({ cls: 'brain-console__list-item-highlight' });
      const status = attempt.ok ? '✓' : '✗';
      item.createEl('strong', { text: `${status} ${attempt.url}` });
      let detail = '';
      if (attempt.status) detail += `HTTP ${attempt.status}`;
      if (attempt.responseTimeMs) detail += ` · ${attempt.responseTimeMs}ms`;
      if (attempt.error && !attempt.ok) detail += ` · ${attempt.error}`;
      if (detail) {
        item.createEl('div', { cls: 'brain-console__list-sub', text: detail });
      }
    });
  }

  if (diag.recommendation) {
    container.createEl('p', {
      cls: 'brain-console__diagnostic-recommendation',
      text: `ℹ ${diag.recommendation}`,
    });
  }

  container.appendChild(renderSafetyLabel('Read-only · Connection diagnostics only'));
  return container;
}
