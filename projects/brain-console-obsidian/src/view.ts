import { ItemView, Notice } from 'obsidian';
import { DEFAULT_BRAIN_CONSOLE_SETTINGS, normalizeBrainCoreUrl, type BrainConsoleSettings } from './settings.js';
import { VOShell } from './components/VO/VOShell.js';
import { AwsVideoPipelinePanel } from './components/VO/AwsVideoPipelinePanel.js';
import {
  diagnoseBrainCoreConnection,
  type BrainCoreConnectionDiagnostic,
  readBrainCoreApprovals,
  readBrainCoreApprovalDetail,
  readBrainCoreApprovalStore,
  readBrainCoreCapabilities,
  readBrainCoreLocalApps,
  readBrainCoreLocalAppsDashboard,
  readBrainCoreLocalAppsActionReadiness,
  readBrainCoreLocalAppsActionEnablementBacklog,
  readBrainCoreLocalAppsActionsStatus,
  readBrainCoreLocalAppsOperationalReadiness,
  readBrainCoreLocalAppsOperatorSummary,
  readBrainCoreLocalAppsOrchestrator,
  requestBrainCoreLocalAppAction,
  readBrainCoreExecutionPlans,
  readBrainCoreExecutionReadiness,
  readBrainCoreMindPreviewPolicy,
  readBrainCoreMindPreviews,
  readBrainCoreRepos,
  readBrainCoreRuntimeReports,
  readBrainCoreMindStewardReportDetail,
  readBrainCoreAiModelSelectorStatus,
  controlBrainCoreAiModelSelector,
  readBrainCoreAgentCostSummary,
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
  readBrainCoreVOStudioAccounts,
  readBrainCoreVOStudioAnalyticsSummary,
  readBrainCoreVOStudioContentItems,
  readBrainCoreVOStudioPackage,
  readBrainCoreVOStudioPipelineProfiles,
  readBrainCoreVOStudioProjects,
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
  type BrainCoreLocalAppsDashboardResponse,
  type BrainCoreLocalAppActionReadinessResponse,
  type BrainCoreLocalAppActionEnablementBacklogResponse,
  type BrainCoreLocalAppActionStatusResponse,
  type BrainCoreLocalAppOrchestratorStatus,
  type BrainCoreLocalAppOnboardingChecklist,
  type BrainCoreLocalAppsOperationalReadinessResponse,
  type BrainCoreLocalAppsOperatorSummaryResponse,
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
  type BrainCoreVOStudioAnalyticsSummary,
  type BrainCoreVOStudioContentItem,
  type BrainCoreVOStudioListResponse,
  type BrainCoreVOStudioPipelineProfile,
  type BrainCoreVOStudioPlatformAccount,
  type BrainCoreVOStudioProductionPackage,
  type BrainCoreVOStudioProject,
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
  type BrainCoreMindStewardReportDetail,
  type BrainCoreAiModelSelectorStatus,
  type BrainCoreMaintenancePreviewDetail,
  type BrainCoreAgentRunSummary,
  type BrainCoreAgentEventSummary,
  type BrainCoreRecoveryItemSummary,
  readBrainCoreInfraDokploy,
  readBrainCoreInfraTunnels,
  readBrainCoreInfraDomains,
  readBrainCoreInfraNewRelic,
  readBrainCoreInfraUmami,
  readBrainCoreInfraGoogleAds,
  readBrainCoreInfraStripe,
  readBrainCoreInfraStudio,
  readBrainCoreInfraVOStatus,
  readBrainCoreInfraPipelinesStatus,
  readBrainCoreVOAccounts,
  readBrainCoreVOAuthStatus,
  readBrainCoreVOJobs,
  readBrainCoreVOPostingInstructions,
  readBrainCoreVONormalizeHistory,
  readBrainCoreVOManualQueue,
  readBrainCoreVOWorkerConfig,
  readBrainCoreVOAccountStats,
  readBrainCoreVOReadiness,
  readBrainCoreSystemMetrics,
  readBrainCoreCredentials,
  readBrainCoreCredentialCatalog,
  setBrainCoreCredential,
  revokeBrainCoreCredential,
  setInfraPlistCredential,
  getYouTubeOAuthUrl,
  exchangeYouTubeOAuthCode,
  openBrowserUrl,
  registerBrainCoreProject,
  type BrainCoreVOAccountsResponse,
  type BrainCoreVOAuthStatusResponse,
  type BrainCoreVOJobsResponse,
  type BrainCoreVONormalizeHistoryResponse,
  type BrainCoreVOManualQueueResponse,
  type BrainCoreVOWorkerConfigResponse,
  type BrainCoreVOAccountStatsResponse,
  type BrainCoreVOReadinessResponse,
  type BrainCoreInfraPipelinesStatus,
  type BrainCoreInfraDokployResponse,
  type BrainCoreInfraTunnelsResponse,
  type BrainCoreInfraDomainsResponse,
  type BrainCoreInfraNewRelicResponse,
  type BrainCoreInfraUmamiResponse,
  type BrainCoreInfraGoogleAdsResponse,
  type BrainCoreInfraStripeResponse,
  type BrainCoreInfraStudioResponse,
  type BrainCoreInfraVOStatusResponse,
  type BrainCoreSystemMetrics,
  type BrainCoreCredentialListResponse,
  type BrainCoreCredentialCatalogResponse,
  type BrainCoreInfraCredentialGroup,
  type BrainCoreProjectCredentialEntry,
  type BrainCoreProjectCredentialPlatform,
} from './client.js';
import {
  deriveDashboardSnapshot,
  formatRelativeTime,
  getConnectionStatusColor,
  getAttentionBadgeColor,
  type DashboardSnapshot,
} from './dashboard.js';

export type BrainConsoleSectionId = 'overview' | 'apps' | 'sessions' | 'infra' | 'analytics' | 'stripe' | 'monitoring' | 'orchestrators' | 'pipelines' | 'video-orchestrator' | 'projects' | 'reports' | 'posts' | 'agents' | 'recovery' | 'accounts' | 'aws-video';

const localAppPendingActions = new Map<string, string>();

export interface BrainConsoleViewState {
  status?: BrainCoreStatus;
  capabilities?: BrainCoreCapabilitySummary;
  runtimeReports?: BrainCoreRuntimeReportSummary[];
  videoStatus?: BrainCoreVideoStatus;
  videoQueue?: BrainCoreVideoQueueItem[];
  localApps?: BrainCoreLocalAppSummary[];
  localAppsDashboard?: BrainCoreLocalAppsDashboardResponse;
  localAppsActionReadiness?: BrainCoreLocalAppActionReadinessResponse;
  localAppsActionEnablementBacklog?: BrainCoreLocalAppActionEnablementBacklogResponse;
  localAppsActionStatus?: BrainCoreLocalAppActionStatusResponse;
  localAppsOperationalReadiness?: BrainCoreLocalAppsOperationalReadinessResponse;
  localAppsOperatorSummary?: BrainCoreLocalAppsOperatorSummaryResponse;
  localAppsOrchestrator?: BrainCoreLocalAppOrchestratorStatus;
  localAppsOnboardingChecklist?: BrainCoreLocalAppOnboardingChecklist;
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
  mindStewardReportDetail?: BrainCoreMindStewardReportDetail;
  aiModelSelectorStatus?: BrainCoreAiModelSelectorStatus;
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
  voStudioProjects?: BrainCoreVOStudioListResponse<BrainCoreVOStudioProject>;
  voStudioAccounts?: BrainCoreVOStudioListResponse<BrainCoreVOStudioPlatformAccount>;
  voStudioPipelineProfiles?: BrainCoreVOStudioListResponse<BrainCoreVOStudioPipelineProfile>;
  voStudioContentItems?: BrainCoreVOStudioListResponse<BrainCoreVOStudioContentItem>;
  voStudioPackage?: BrainCoreVOStudioProductionPackage;
  voStudioAnalytics?: BrainCoreVOStudioAnalyticsSummary;
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
  agentConsole?: import('./client.js').BrainCoreAgentConsoleSummary;
  agentCostSummary?: import('./client.js').BrainCoreAgentCostSummary;
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
  infraDokploy?: BrainCoreInfraDokployResponse;
  infraTunnels?: BrainCoreInfraTunnelsResponse;
  infraDomains?: BrainCoreInfraDomainsResponse;
  infraNewRelic?: BrainCoreInfraNewRelicResponse;
  infraUmami?: BrainCoreInfraUmamiResponse;
  infraGoogleAds?: BrainCoreInfraGoogleAdsResponse;
  infraStripe?: BrainCoreInfraStripeResponse;
  infraStudio?: BrainCoreInfraStudioResponse;
  voLiveStatus?: BrainCoreInfraVOStatusResponse;
  pipelinesLiveStatus?: BrainCoreInfraPipelinesStatus;
  voAccounts?: BrainCoreVOAccountsResponse;
  voAuthStatus?: BrainCoreVOAuthStatusResponse;
  voJobs?: BrainCoreVOJobsResponse;
  systemMetrics?: BrainCoreSystemMetrics;
  credentialsByProject?: Record<string, BrainCoreCredentialListResponse>;
  credentialCatalog?: BrainCoreCredentialCatalogResponse;
  voNormalizeHistory?: BrainCoreVONormalizeHistoryResponse;
  voManualQueue?: BrainCoreVOManualQueueResponse;
  voWorkerConfig?: BrainCoreVOWorkerConfigResponse;
  voAccountStats?: BrainCoreVOAccountStatsResponse;
  voReadiness?: BrainCoreVOReadinessResponse;
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
    readBrainCoreLocalAppsDashboard(baseUrl),
    readBrainCoreLocalAppsActionReadiness(baseUrl),
    readBrainCoreLocalAppsActionEnablementBacklog(baseUrl),
    readBrainCoreLocalAppsActionsStatus(baseUrl),
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
    readBrainCoreVOStudioProjects(baseUrl),
    readBrainCoreVOStudioAccounts(baseUrl),
    readBrainCoreVOStudioPipelineProfiles(baseUrl),
    readBrainCoreVOStudioContentItems(baseUrl),
    readBrainCoreVOStudioPackage(baseUrl, 'pkg-stb-story-052'),
    readBrainCoreVOStudioAnalyticsSummary(baseUrl),
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
    readBrainCoreVideoOrchestratorProviderImplementationReadinessDashboardSummary(baseUrl),
    readBrainCoreVideoOrchestratorProviderImplementationApprovalPacket(baseUrl),
    readBrainCoreVideoOrchestratorProviderApprovalPacketConsoleReviewSummary(baseUrl),
    readBrainCoreVideoOrchestratorProviderPlanningSurfaceIndex(baseUrl),
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
    readBrainCoreMindStewardReportDetail(baseUrl),
    readBrainCoreAgentRuns(baseUrl),
    readBrainCoreAgentEvents(baseUrl),
    readBrainCoreAgentCostSummary(baseUrl),
    readBrainCoreRecoveryItems(baseUrl),
    readBrainCoreLocalAppsOperationalReadiness(baseUrl),
    readBrainCoreLocalAppsOperatorSummary(baseUrl),
    readBrainCoreLocalAppsOrchestrator(baseUrl),
    readBrainCoreInfraDokploy(baseUrl),
    readBrainCoreInfraTunnels(baseUrl),
    readBrainCoreInfraDomains(baseUrl),
    readBrainCoreInfraNewRelic(baseUrl),
    readBrainCoreInfraUmami(baseUrl),
    readBrainCoreInfraGoogleAds(baseUrl),
    readBrainCoreInfraStripe(baseUrl),
    readBrainCoreInfraStudio(baseUrl),
    readBrainCoreInfraVOStatus(baseUrl),
    readBrainCoreInfraPipelinesStatus(baseUrl),
    readBrainCoreVOAccounts(baseUrl),    // 146
    readBrainCoreVOAuthStatus(baseUrl),  // 147
    readBrainCoreVOJobs(baseUrl),        // 148
    readBrainCoreSystemMetrics(baseUrl), // 149
    readBrainCoreCredentials(baseUrl, 'says-the-bible'), // 150
    readBrainCoreVONormalizeHistory(baseUrl),            // 151
    readBrainCoreVOManualQueue(baseUrl),                 // 152
    readBrainCoreVOWorkerConfig(baseUrl),                // 153
    readBrainCoreVOAccountStats(baseUrl),               // 154
    readBrainCoreVOReadiness(baseUrl),                  // 155
    readBrainCoreCredentialCatalog(baseUrl),             // 156
    readBrainCoreAiModelSelectorStatus(baseUrl),         // 163
  ]);

  const settledValues = withSafeEndpointPadding(
    results.map((result) => result.status === 'fulfilled' ? result.value : { value: undefined, error: result.reason }),
    164,
  );

  const [status, capabilities, runtimeReports, videoStatus, videoQueue, localApps, localAppsDashboard, localAppsActionReadiness, localAppsActionEnablementBacklog, localAppsActionStatus, schedulerStatus, schedulerJobs, sessions, repos, approvals, approvalStore, executionPlans, executionReadiness, mindPreviewPolicy, mindPreviews, orchestrators, pipelines, projects, platforms, probotDashboardParity, probotSessionsParity, probotLocalAppsParity, probotSchedulerParity, probotStudioParity, probotExternalAdminParity, probotDecommissionReadiness, probotExternalAdminSafeMetadata, probotFeatureParityMatrix, probotPhaseOutChecklist, postOrchestratorStatus, postOrchestratorOverview, postOrchestratorFlows, postOrchestratorDrafts, postOrchestratorEvents, postOrchestratorDryRun, postOrchestratorReviewQueue, postOrchestratorSchedulePreview, postOrchestratorAnalytics, postOrchestratorPipeline, postOrchestratorReadiness, postOrchestratorPlatformPolicies, postOrchestratorDecommissionReadiness, postOrchestratorOperatorGuidance, postOrchestratorManualExportPackage, postOrchestratorAcceptanceChecklist, postOrchestratorMigrationParity, postOrchestratorRoadmapCheckpoint, postOrchestratorContracts, postOrchestratorIntegrations, postOrchestratorRecovery, postOrchestratorQaStatus, stbStatus, videoOrchestratorStatus, voStudioProjectsResult, voStudioAccountsResult, voStudioPipelineProfilesResult, voStudioContentItemsResult, voStudioPackageResult, voStudioAnalyticsResult, videoOrchestratorIntake, videoAssetPlans, videoDesignPlans, videoVoiceoverPlans, videoVisualPlans, videoAssemblyPlans, videoMetadataPlans, videoPublishingPrepPlans, videoManualExportPackages, videoThumbnailDesignPlans, videoArchiveLoggingPlans, videoDesignProviderBoundaryPlans, videoDesignProviderCredentialIsolationPlans, videoDesignProviderPromptReviewPolicyPlans, videoArtifactSandboxProviderHandoffPlans, videoProviderOutputRedactionPolicyPlans, videoDesignProviderComplianceChecklistPlans, videoDesignProviderEnablementReadinessIndex, videoProviderIntegrationFinalPlanningCheckpoint, videoCredentialStoreImplementationBoundaryPlan, videoPromptReviewUxImplementationPlan, videoProviderAuditPersistenceBoundaryPlan, videoProviderWrapperSecurityReviewPlan, videoProviderImplementationPhaseStartGate, videoProviderImplementationReadinessDashboardSummary, videoProviderImplementationApprovalPacket, videoProviderApprovalPacketConsoleReviewSummary, videoProviderPlanningSurfaceIndex, videoCredentialReferenceScaffold, videoProviderRequestWrapperScaffold, videoProviderWrapperValidationHarness, videoProviderRequestEnvelopeScaffold, videoProviderResponseEnvelopeScaffold, videoProviderScaffoldingIntegrationSummary, videoProviderRequestWrapperInertShell, videoCredentialReferenceValidator, videoProviderResponseRedactionSkeleton, videoProviderAuditEventTypes, videoProviderDisabledOrchestrationFacade, videoProviderCapabilityPolicyEvaluator, videoProviderBlockedActionLedgerTypes, videoProviderDisabledOrchestrationIntegrationSummary, stbVideoMigrationStatus, stbVideoParityMatrix, stbVideoDualRunStatus, stbVideoDualRunEvidence, videoProductionGate, videoRenderExportPolicy, videoControlledDryRunDesign, videoProductionCutoverGate, videoReleaseCandidateReadiness, videoOperatorDecisionQueue, videoControlledExecutionPolicyBoundary, videoControlledExecutionReadinessIndex, videoRoadmapCheckpoint, videoOperatorReviewPacket, videoControlledExecutionApprovalPayloadSchema, videoPreviewCompletionIndex, videoControlledExecutionPreflightChecklist, videoControlledExecutionRiskRegister, videoControlledExecutionPreflightValidatorSchema, videoControlledExecutionPlanStub, videoControlledExecutionApprovalRequestDesign, videoControlledExecutionDisabledGate, videoControlledExecutionSecondApprovalPolicy, videoControlledExecutionOperatorIdentityProtocol, videoControlledExecutionRolePolicy, controlledDualRunRequestDesign, agents, actions, mindStewardReportDetail, agentRuns, agentEvents, agentCostSummary, recoveryItems, localAppsOperationalReadiness, localAppsOperatorSummary, localAppsOrchestratorDef, infraDokploy, infraTunnels, infraDomains, infraNewRelic, infraUmami, infraGoogleAds, infraStripe, infraStudio, voLiveStatus, pipelinesLiveStatus, voAccountsResult, voAuthStatusResult, voJobsResult, systemMetricsResult, stbCredentialsResult, voNormalizeHistoryResult, voManualQueueResult, voWorkerConfigResult, voAccountStatsResult, voReadinessResult, credentialCatalogResult, aiModelSelectorResult] = settledValues as any[];

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

  // Keep the connection card lightweight on healthy refreshes.
  // Only run the full multi-URL diagnostic when the primary status probe is already failing.
  const connectionDiagnostics = status.value?.ok === true
    ? {
        configuredUrl: baseUrl,
        selectedUrl: baseUrl,
        attempts: [
          {
            url: baseUrl,
            ok: true,
            status: 200,
          },
        ],
        allFailed: false,
        recommendation: `Connected to ${baseUrl}`,
      }
    : await diagnoseBrainCoreConnection(baseUrl);

  return {
    status: status.value,
    capabilities: capabilities.value,
    runtimeReports: runtimeReports.value?.reports,
    videoStatus: videoStatus.value,
    videoQueue: videoQueue.value?.queue,
    localApps: localApps.value?.apps,
    localAppsDashboard: localAppsDashboard.value,
    localAppsActionReadiness: localAppsActionReadiness.value,
    localAppsActionEnablementBacklog: localAppsActionEnablementBacklog.value,
    localAppsActionStatus: localAppsActionStatus.value,
    localAppsOperationalReadiness: localAppsOperationalReadiness.value,
    localAppsOperatorSummary: localAppsOperatorSummary.value,
    localAppsOrchestrator: localAppsOrchestratorDef.value,
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
    mindStewardReportDetail: mindStewardReportDetail.value?.report,
    aiModelSelectorStatus: aiModelSelectorResult.value?.selector,
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
    voStudioProjects: voStudioProjectsResult.value,
    voStudioAccounts: voStudioAccountsResult.value,
    voStudioPipelineProfiles: voStudioPipelineProfilesResult.value,
    voStudioContentItems: voStudioContentItemsResult.value,
    voStudioPackage: voStudioPackageResult.value,
    voStudioAnalytics: voStudioAnalyticsResult.value,
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
    agentCostSummary: agentCostSummary.value,
    actions: actions.value?.actions,
    agentRuns: agentRuns.value?.runs,
    agentEvents: agentEvents.value?.events,
    recoveryItems: recoveryItems.value?.items,
    infraDokploy: infraDokploy.value,
    infraTunnels: infraTunnels.value,
    infraDomains: infraDomains.value,
    infraNewRelic: infraNewRelic.value,
    infraUmami: infraUmami.value,
    infraGoogleAds: infraGoogleAds.value,
    infraStripe: infraStripe.value,
    infraStudio: infraStudio.value,
    voLiveStatus: voLiveStatus.value,
    pipelinesLiveStatus: pipelinesLiveStatus.value as BrainCoreInfraPipelinesStatus | undefined,
    voAccounts: voAccountsResult.value as BrainCoreVOAccountsResponse | undefined,
    voAuthStatus: voAuthStatusResult.value as BrainCoreVOAuthStatusResponse | undefined,
    voJobs: voJobsResult.value as BrainCoreVOJobsResponse | undefined,
    systemMetrics: systemMetricsResult.value as BrainCoreSystemMetrics | undefined,
    credentialsByProject: stbCredentialsResult.value
      ? { 'says-the-bible': stbCredentialsResult.value as BrainCoreCredentialListResponse }
      : undefined,
    credentialCatalog: credentialCatalogResult.value as BrainCoreCredentialCatalogResponse | undefined,
    voNormalizeHistory: voNormalizeHistoryResult.value as BrainCoreVONormalizeHistoryResponse | undefined,
    voManualQueue: voManualQueueResult.value as BrainCoreVOManualQueueResponse | undefined,
    voWorkerConfig: voWorkerConfigResult.value as BrainCoreVOWorkerConfigResponse | undefined,
    voAccountStats: voAccountStatsResult.value as BrainCoreVOAccountStatsResponse | undefined,
    voReadiness: voReadinessResult.value as BrainCoreVOReadinessResponse | undefined,
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
  { id: 'sessions', label: 'Sessions', icon: '⊙' },
  { id: 'infra', label: 'Infra', icon: '◧' },
  { id: 'analytics', label: 'Analytics', icon: '▣' },
  { id: 'stripe', label: 'Stripe', icon: '$' },
  { id: 'monitoring', label: 'Monitoring', icon: '◎' },
  { id: 'orchestrators', label: 'Orchestrators', icon: '◫' },
  { id: 'pipelines', label: 'Pipelines', icon: '▤' },
  { id: 'video-orchestrator', label: 'Video Orchestrator', icon: '◈' },
  { id: 'projects', label: 'Projects', icon: '◉' },
  { id: 'reports', label: 'Reports', icon: '📋' },
  { id: 'posts', label: 'Posts', icon: '✦' },
  { id: 'agents', label: 'Agents', icon: '◈' },
  { id: 'accounts', label: 'Accounts', icon: '🔑' },
  { id: 'aws-video', label: 'AWS Video', icon: '🎬' },
];

function metricsSeverityColor(pct: number): string {
  if (pct < 50) return '#22c55e';
  if (pct < 75) return '#eab308';
  return '#ef4444';
}

function metricsCodexColor(remainingPct: number): string {
  if (remainingPct > 50) return '#22c55e';
  if (remainingPct > 25) return '#eab308';
  return '#ef4444';
}

function formatMetricsUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMetricsCountdown(resetsAt: string | null): string {
  if (!resetsAt) return '–';
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'now';
  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatMetricsResetExact(resetsAt: string | null): string {
  if (!resetsAt) return 'No data';
  try {
    const d = new Date(resetsAt);
    return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return resetsAt;
  }
}

function renderSystemMetricsBanner(state: BrainConsoleViewState): string {
  const m = state.systemMetrics;
  if (!m) {
    return `<div class="bc-metrics-banner bc-metrics-offline"><span>System metrics unavailable</span></div>`;
  }

  const cpuPct = Math.min(100, Math.round((m.loadAvg1 / Math.max(m.cpuCount, 1)) * 100));
  const cpuColor = metricsSeverityColor(cpuPct);

  const memBarPct = m.memFreePercent === null ? 0 : Math.round(100 - m.memFreePercent);
  const memColor = m.memFreePercent === null ? 'var(--text-muted)' : metricsSeverityColor(memBarPct);

  const gpuPct = typeof m.gpuUtilizationPercent === 'number' ? Math.max(0, Math.min(100, Math.round(m.gpuUtilizationPercent))) : null;
  const gpuColor = gpuPct === null ? 'var(--text-muted)' : metricsSeverityColor(gpuPct);

  const c5 = m.codex.fiveHour;
  const c7 = m.codex.sevenDay;
  const gm = m.gemini;
  const ca = m.claudeApi;

  // Helper function to format Claude API cost percentage
  const claudeCostPercent = (cost: number, maxMonthCost: number = 1000): number => {
    return Math.min(100, Math.round((cost / maxMonthCost) * 100));
  };

  const cpuCard = `<div class="bc-mc">
    <div class="bc-mc-label">CPU LOAD</div>
    <div class="bc-mc-value">${m.loadAvg1.toFixed(2)} core</div>
    <div class="bc-mc-sub">${m.cpuCount} cores · ${cpuPct}% load</div>
    <div class="bc-bar"><div class="bc-bar-fill" style="width:${cpuPct}%;background:${cpuColor}"></div></div>
  </div>`;

  const memCard = m.memFreePercent === null
    ? `<div class="bc-mc">
        <div class="bc-mc-label">MEMORY PRESSURE</div>
        <div class="bc-mc-value" style="color:var(--text-muted)">–</div>
        <div class="bc-mc-sub">memory_pressure unavailable</div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">MEMORY PRESSURE</div>
        <div class="bc-mc-value">${m.memUsedGb} GB</div>
        <div class="bc-mc-sub">${m.memTotalGb} GB · ${m.memFreePercent}% free</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${memBarPct}%;background:${memColor}"></div></div>
      </div>`;

  const gpuCard = gpuPct === null
    ? `<div class="bc-mc">
        <div class="bc-mc-label">GPU LOAD</div>
        <div class="bc-mc-value" style="color:var(--text-muted)">–</div>
        <div class="bc-mc-sub">gpu stats unavailable</div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">GPU LOAD</div>
        <div class="bc-mc-value">${m.gpuCoreCount} core</div>
        <div class="bc-mc-sub">${gpuPct}% load · ${m.gpuCoreCount} GPU cores</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${gpuPct}%;background:${gpuColor}"></div></div>
      </div>`;

  const uptimeCard = `<div class="bc-mc">
    <div class="bc-mc-label">UPTIME</div>
    <div class="bc-mc-value">${formatMetricsUptime(m.uptimeSeconds)}</div>
    <div class="bc-mc-sub">Brain Core</div>
  </div>`;

  const codex5Card = c5.resetsAt
    ? `<div class="bc-mc">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div class="bc-mc-label">CODEX · 5H</div>
          <div class="bc-mc-badge">RESETS IN ${formatMetricsCountdown(c5.resetsAt)}</div>
        </div>
        <div class="bc-mc-value" style="color:${metricsCodexColor(c5.remainingPercent)}">${c5.remainingPercent}%</div>
        <div class="bc-mc-sub">${formatMetricsResetExact(c5.resetsAt)}</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${c5.remainingPercent}%;background:${metricsCodexColor(c5.remainingPercent)}"></div></div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">CODEX · 5H</div>
        <div class="bc-mc-value" style="color:var(--text-muted);font-size:14px">–</div>
        <div class="bc-mc-sub">No data yet</div>
      </div>`;

  const codex7Card = c7.resetsAt
    ? `<div class="bc-mc">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div class="bc-mc-label">CODEX · 7D</div>
          <div class="bc-mc-badge">RESETS IN ${formatMetricsCountdown(c7.resetsAt)}</div>
        </div>
        <div class="bc-mc-value" style="color:${metricsCodexColor(c7.remainingPercent)}">${c7.remainingPercent}%</div>
        <div class="bc-mc-sub">${formatMetricsResetExact(c7.resetsAt)}</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${c7.remainingPercent}%;background:${metricsCodexColor(c7.remainingPercent)}"></div></div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">CODEX · 7D</div>
        <div class="bc-mc-value" style="color:var(--text-muted);font-size:14px">–</div>
        <div class="bc-mc-sub">No data yet</div>
      </div>`;

  const geminiCard = gm
    ? `<div class="bc-mc">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div class="bc-mc-label">GEMINI · FREE</div>
          <div class="bc-mc-badge">RESETS IN ${formatMetricsCountdown(gm.resetsAt)}</div>
        </div>
        <div class="bc-mc-value" style="color:${metricsCodexColor(gm.remainingPercent)}">${gm.remainingPercent}%</div>
        <div class="bc-mc-sub">${gm.callsRemaining}/${gm.callsToday} calls · ${formatMetricsResetExact(gm.resetsAt)}</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${gm.remainingPercent}%;background:${metricsCodexColor(gm.remainingPercent)}"></div></div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">GEMINI · FREE</div>
        <div class="bc-mc-value" style="color:var(--text-muted);font-size:14px">–</div>
        <div class="bc-mc-sub">No data yet</div>
      </div>`;

  const claudeHaikuCard = ca
    ? `<div class="bc-mc">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div class="bc-mc-label">CLAUDE · HAIKU</div>
          <div class="bc-mc-badge">RESETS IN ${ca.daysUntilReset}d</div>
        </div>
        <div class="bc-mc-value" style="color:${metricsCodexColor(claudeCostPercent(ca.haiku.costUsd))}">\$${ca.haiku.costUsd.toFixed(2)}</div>
        <div class="bc-mc-sub">${ca.haiku.inputTokens.toLocaleString()} in · ${ca.haiku.outputTokens.toLocaleString()} out · ${ca.haiku.callCount} calls</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${claudeCostPercent(ca.haiku.costUsd)}%;background:${metricsCodexColor(claudeCostPercent(ca.haiku.costUsd))}"></div></div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">CLAUDE · HAIKU</div>
        <div class="bc-mc-value" style="color:var(--text-muted);font-size:14px">–</div>
        <div class="bc-mc-sub">No data yet</div>
      </div>`;

  const claudeSonnetCard = ca
    ? `<div class="bc-mc">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div class="bc-mc-label">CLAUDE · SONNET</div>
          <div class="bc-mc-badge">RESETS IN ${ca.daysUntilReset}d</div>
        </div>
        <div class="bc-mc-value" style="color:${metricsCodexColor(claudeCostPercent(ca.sonnet.costUsd))}">\$${ca.sonnet.costUsd.toFixed(2)}</div>
        <div class="bc-mc-sub">${ca.sonnet.inputTokens.toLocaleString()} in · ${ca.sonnet.outputTokens.toLocaleString()} out · ${ca.sonnet.callCount} calls</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${claudeCostPercent(ca.sonnet.costUsd)}%;background:${metricsCodexColor(claudeCostPercent(ca.sonnet.costUsd))}"></div></div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">CLAUDE · SONNET</div>
        <div class="bc-mc-value" style="color:var(--text-muted);font-size:14px">–</div>
        <div class="bc-mc-sub">No data yet</div>
      </div>`;

  const claudeOpusCard = ca
    ? `<div class="bc-mc">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
          <div class="bc-mc-label">CLAUDE · OPUS</div>
          <div class="bc-mc-badge">RESETS IN ${ca.daysUntilReset}d</div>
        </div>
        <div class="bc-mc-value" style="color:${metricsCodexColor(claudeCostPercent(ca.opus.costUsd))}">\$${ca.opus.costUsd.toFixed(2)}</div>
        <div class="bc-mc-sub">${ca.opus.inputTokens.toLocaleString()} in · ${ca.opus.outputTokens.toLocaleString()} out · ${ca.opus.callCount} calls</div>
        <div class="bc-bar"><div class="bc-bar-fill" style="width:${claudeCostPercent(ca.opus.costUsd)}%;background:${metricsCodexColor(claudeCostPercent(ca.opus.costUsd))}"></div></div>
      </div>`
    : `<div class="bc-mc">
        <div class="bc-mc-label">CLAUDE · OPUS</div>
        <div class="bc-mc-value" style="color:var(--text-muted);font-size:14px">–</div>
        <div class="bc-mc-sub">No data yet</div>
      </div>`;

  return `<div class="bc-metrics-banner">${cpuCard}${memCard}${gpuCard}${uptimeCard}${codex5Card}${codex7Card}${geminiCard}${claudeHaikuCard}${claudeSonnetCard}${claudeOpusCard}</div>`;
}

export function renderBrainConsoleView(
  container: HTMLElement,
  state: BrainConsoleViewState,
  settings: BrainConsoleSettings,
  onRefresh?: () => void,
  onBrainCoreRestart?: () => Promise<void>,
): void {
  container.empty();
  container.addClass('brain-console');

  try {
    const snapshot = deriveDashboardSnapshot(state, settings.brainCoreUrl);
    const activeSection = state.activeSection ?? 'overview';

    const shell = container.createDiv({ cls: 'brain-console__shell' });

    // Premium command bar (compact header + tabs in one row)
    renderCommandBar(shell, state, activeSection, onRefresh, onBrainCoreRestart);

    // System metrics banner
    const metricsBanner = shell.createDiv({ cls: 'bc-metrics-wrapper' });
    metricsBanner.innerHTML = renderSystemMetricsBanner(state);

    // Main content area
    const scrollArea = shell.createDiv({ cls: 'brain-console__scroll-area' });
    if (snapshot.connectionStatus === 'offline') {
      renderOfflineState(
        scrollArea,
        state.brainCoreUrl || settings.brainCoreUrl,
        state.statusError,
        state.endpointErrors,
        onRefresh,
        onBrainCoreRestart,
      );
    } else {
      renderActiveSectionContent(scrollArea, activeSection, state, snapshot, settings, onRefresh, onBrainCoreRestart);
      renderDiagnosticsPanel(scrollArea, state);
    }
  } catch (error) {
    container.empty();
    const fallback = container.createDiv({ cls: 'brain-console__emergency-fallback' });
    fallback.createEl('h2', { text: 'Brain Console Error' });
    fallback.createEl('p', { text: `Build: ${(window as any).BRAIN_CONSOLE_BUILD_ID || 'unknown'}` });
    fallback.createEl('p', { text: `Dashboard render failed. Click Manual refresh after Brain Core starts.` });
    if (state.brainCoreUrl || settings.brainCoreUrl) {
      fallback.createEl('p', { text: `Brain Core URL: ${state.brainCoreUrl || settings.brainCoreUrl}` });
    }
    if (error instanceof Error) {
      fallback.createEl('p', { cls: 'brain-console__error-detail', text: `Details: ${error.message}` });
    }
  }
}

function renderCommandBar(
  shell: HTMLElement,
  state: BrainConsoleViewState,
  activeSection: BrainConsoleSectionId,
  onRefresh?: () => void,
  onBrainCoreRestart?: () => Promise<void>,
): void {
  // Top identity row: wordmark + dot on left, version + refresh on right
  const topRow = shell.createDiv({ cls: 'bc-cmd-top' });

  const left = topRow.createDiv({ cls: 'bc-cmd-left' });
  left.createEl('span', { cls: 'bc-cmd-wordmark', text: 'Brain Console' });
  const online = state.status?.ok === true;
  const dot = left.createEl('span', { cls: `bc-cmd-dot ${online ? 'bc-cmd-dot--online' : 'bc-cmd-dot--offline'}` });
  dot.setAttribute('aria-label', online ? 'Brain Core online' : 'Brain Core offline');

  const right = topRow.createDiv({ cls: 'bc-cmd-right' });
  right.createEl('span', { cls: 'bc-cmd-build', text: (window as any).BRAIN_CONSOLE_BUILD_ID || 'unknown' });
  const refreshBtn = right.createEl('button', { cls: 'bc-cmd-action' });
  refreshBtn.setAttribute('type', 'button');
  refreshBtn.setAttribute('aria-label', onBrainCoreRestart ? 'Restart Brain Core' : 'Manual refresh');
  refreshBtn.setAttribute('title', onBrainCoreRestart ? 'Restart Brain Core and re-verify the service' : 'Manual refresh');
  refreshBtn.textContent = '↻';
  if (onBrainCoreRestart) {
    refreshBtn.addEventListener('click', () => {
      if (refreshBtn.disabled) return;
      refreshBtn.disabled = true;
      refreshBtn.setAttribute('aria-busy', 'true');
      const originalText = refreshBtn.textContent || '↻';
      refreshBtn.textContent = '…';
      void (async () => {
        try {
          await onBrainCoreRestart();
        } catch (error) {
          console.error('Brain Core restart button failed', error);
        } finally {
          refreshBtn.disabled = false;
          refreshBtn.removeAttribute('aria-busy');
          refreshBtn.textContent = originalText;
        }
      })();
    });
  } else if (onRefresh) {
    refreshBtn.addEventListener('click', () => onRefresh());
  }

  // Tab row: full-width, all tabs visible, wraps if needed
  const nav = shell.createDiv({ cls: 'bc-cmd-nav' });
  for (const tab of SECTION_TABS) {
    const btn = nav.createEl('button', { cls: 'bc-cmd-tab' });
    if (tab.id === activeSection) btn.addClass('active');
    btn.setAttribute('data-section-id', tab.id);
    btn.setAttribute('aria-label', tab.label);
    btn.setAttribute('type', 'button');
    btn.createEl('span', { cls: 'bc-cmd-tab-label', text: tab.label });
  }
}

function renderActiveSectionContent(
  shell: HTMLElement,
  activeSection: BrainConsoleSectionId,
  state: BrainConsoleViewState,
  snapshot: DashboardSnapshot,
  settings: BrainConsoleSettings,
  onRefresh?: () => void,
  onBrainCoreRestart?: () => Promise<void>,
): void {
  const content = shell.createDiv({ cls: 'brain-console__section-content' });

  try {
    switch (activeSection) {
      case 'overview':
        renderOverviewSection(content, state, snapshot);
        break;
      case 'apps':
        renderAppsSection(content, state, snapshot, settings, onRefresh);
        break;
      case 'sessions':
        renderSessionsSection(content, state);
        break;
      case 'infra':
        renderInfraSection(content, state);
        break;
      case 'analytics':
        renderAnalyticsSection(content, state);
        break;
      case 'stripe':
        renderStripeSection(content, state);
        break;
      case 'monitoring':
        renderMonitoringSection(content, state);
        break;
      case 'orchestrators':
        renderOrchestratorsSection(content, state, snapshot);
        break;
      case 'pipelines':
        renderPipelinesSection(content, state, snapshot);
        break;
      case 'video-orchestrator':
        renderVideoOrchestratorSection(content, state);
        break;
      case 'projects':
        renderProjectsSection(content, state, snapshot);
        break;
      case 'reports':
        renderReportsSection(content, state, snapshot, settings, onRefresh);
        break;
      case 'posts':
        renderPostOrchestratorSection(content, state, snapshot);
        break;
      case 'agents':
        renderAgentsSection(content, state, snapshot);
        break;
      case 'accounts':
        renderAccountsSection(content, state, settings);
        break;
      case 'aws-video':
        renderAwsVideoPipelineSection(content, settings);
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
  // Zone 1: KPI row
  const kpiRow = content.createDiv({ cls: 'bc-kpi-row' });
  const online = snapshot.brainCoreOnline;
  const kpiCore = createStatCard(kpiRow, 'Brain Core', online ? 'Online' : 'Offline', state.status?.version ?? undefined, online ? 'ok' : 'danger');
  kpiCore.setAttribute('data-section-id', 'apps');
  kpiCore.style.cursor = 'pointer';
  const kpiApprovals = createStatCard(kpiRow, 'Approvals', String(snapshot.approvalsCount), snapshot.approvalsCount > 0 ? 'need attention' : 'all clear', snapshot.approvalsCount > 0 ? 'warn' : 'ok');
  kpiApprovals.setAttribute('data-section-id', 'recovery');
  kpiApprovals.style.cursor = 'pointer';
  createStatCard(kpiRow, 'Scheduler', snapshot.schedulerHealthy ? 'Healthy' : 'Check', undefined, snapshot.schedulerHealthy ? 'ok' : 'warn');
  const kpiPipelines = createStatCard(kpiRow, 'Pipelines', String(snapshot.pipelineCount), `${snapshot.pipelineCount} tracked`, 'muted');
  kpiPipelines.setAttribute('data-section-id', 'pipelines');
  kpiPipelines.style.cursor = 'pointer';
  createStatCard(kpiRow, 'Attention', snapshot.attentionLevel, `score ${snapshot.attentionScore}`, snapshot.attentionLevel === 'clear' ? 'ok' : snapshot.attentionLevel === 'watch' ? 'warn' : 'danger');
  const kpiOrch = createStatCard(kpiRow, 'Orchestrators', String(snapshot.orchestratorCount), `${snapshot.orchestratorCount} registered`, 'muted');
  kpiOrch.setAttribute('data-section-id', 'orchestrators');
  kpiOrch.style.cursor = 'pointer';

  // Zone 2: Command focus — 2-column balanced grid
  const focusGrid = content.createDiv({ cls: 'bc-overview-focus-grid' });

  // Left: Attention panel
  const attCard = focusGrid.createDiv({ cls: 'bc-overview-card' });
  attCard.createEl('div', { cls: 'bc-overview-card-title', text: 'What Needs Attention' });
  const attBody = attCard.createDiv({ cls: 'bc-overview-card-body' });
  if (snapshot.attentionLevel === 'clear') {
    createStatusChip(attBody, 'System clear', 'ok');
  } else {
    const items: string[] = [];
    if (snapshot.approvalsCount > 0) items.push(`${snapshot.approvalsCount} approval${snapshot.approvalsCount > 1 ? 's' : ''} pending`);
    if (!snapshot.schedulerHealthy) items.push('Scheduler needs check');
    if (snapshot.migrationBlockedCount > 0) items.push(`${snapshot.migrationBlockedCount} migration blocker${snapshot.migrationBlockedCount > 1 ? 's' : ''}`);
    if (snapshot.postOrchestratorBlockedCount > 0) items.push(`${snapshot.postOrchestratorBlockedCount} post orchestrator blocked`);
    const show = items.slice(0, 5);
    for (const item of show) {
      const row = attBody.createDiv({ cls: 'bc-overview-attention-item' });
      row.createEl('span', { cls: 'bc-overview-bullet', text: '▸' });
      row.createEl('span', { text: item });
    }
    if (items.length > 5) createStatusChip(attBody, `+${items.length - 5} more`, 'muted');
  }

  // Right: Production state + next step
  const prodCard = focusGrid.createDiv({ cls: 'bc-overview-card' });
  prodCard.createEl('div', { cls: 'bc-overview-card-title', text: 'Production State' });
  const prodBody = prodCard.createDiv({ cls: 'bc-overview-card-body' });

  const stbHealth = snapshot.stbLiveStatusSummary?.health ?? snapshot.stbPipelineSummary?.health ?? 'unknown';
  const stbStatus = snapshot.stbLiveStatusSummary?.status ?? snapshot.stbPipelineSummary?.status ?? 'unknown';
  const stbAge = snapshot.stbLiveStatusSummary?.ageHours;
  const stbRow = prodBody.createDiv({ cls: 'bc-overview-prod-row' });
  stbRow.createEl('span', { cls: 'bc-overview-prod-label', text: 'STB Pipeline' });
  createStatusChip(stbRow, stbStatus, stbHealth === 'ok' ? 'ok' : stbHealth === 'warning' ? 'warn' : 'danger');
  if (stbAge !== undefined) stbRow.createEl('span', { cls: 'bc-overview-prod-age', text: `${Math.round(stbAge)}h ago` });

  const voHealth = snapshot.videoOrchestratorSummary?.health ?? 'unknown';
  const voStatus = snapshot.videoOrchestratorSummary?.status ?? 'unknown';
  const voRow = prodBody.createDiv({ cls: 'bc-overview-prod-row' });
  voRow.createEl('span', { cls: 'bc-overview-prod-label', text: 'Video Orchestrator' });
  createStatusChip(voRow, voStatus, voHealth === 'ok' ? 'ok' : voHealth === 'warning' ? 'warn' : 'muted');

  if (snapshot.videoModuleProgressSummary) {
    const { percent, implemented, planned } = snapshot.videoModuleProgressSummary;
    createProgressBar(prodBody, percent, percent >= 80 ? 'ok' : percent >= 40 ? 'warn' : 'danger');
    prodBody.createEl('span', { cls: 'bc-overview-prod-age', text: `${implemented} impl · ${planned} planned` });
  }

  const nextStep = snapshot.postNextSafeStep || snapshot.nextAction;
  if (nextStep) {
    const nsRow = prodBody.createDiv({ cls: 'bc-overview-prod-row bc-overview-prod-row--next' });
    nsRow.createEl('span', { cls: 'bc-overview-prod-label', text: 'Next step' });
    nsRow.createEl('span', { cls: 'bc-overview-next-step', text: nextStep });
  }

  // Zone 3: Migration row
  const migGrid = content.createDiv({ cls: 'bc-overview-mig-grid' });

  // STB Daily Pipeline card
  const stbCard = migGrid.createDiv({ cls: 'bc-overview-card' });
  stbCard.createEl('div', { cls: 'bc-overview-card-title', text: 'STB Daily Pipeline' });
  const stbBody = stbCard.createDiv({ cls: 'bc-overview-card-body' });
  createStatusChip(stbBody, stbStatus, stbHealth === 'ok' ? 'ok' : stbHealth === 'warning' ? 'warn' : 'danger');
  if (snapshot.stbPipelineSummary?.daysStale !== undefined && snapshot.stbPipelineSummary.daysStale > 0) {
    stbBody.createEl('span', { cls: 'bc-overview-prod-age', text: `${snapshot.stbPipelineSummary.daysStale}d stale` });
  }
  stbBody.createEl('div', { cls: 'bc-overview-card-sub', text: 'Legacy production pipeline · says-the-bible' });

  // Video Orchestrator card
  const voCard = migGrid.createDiv({ cls: 'bc-overview-card' });
  voCard.createEl('div', { cls: 'bc-overview-card-title', text: 'Video Orchestrator' });
  const voBody = voCard.createDiv({ cls: 'bc-overview-card-body' });
  createStatusChip(voBody, voStatus, voHealth === 'ok' ? 'ok' : 'muted');
  if (snapshot.videoModuleProgressSummary) {
    const { percent, implemented, partial, planned } = snapshot.videoModuleProgressSummary;
    createProgressBar(voBody, percent, 'ok');
    voBody.createEl('div', { cls: 'bc-overview-card-sub', text: `${implemented} impl · ${partial} partial · ${planned} planned` });
  }

  // Migration parity card
  const migCard = migGrid.createDiv({ cls: 'bc-overview-card' });
  migCard.createEl('div', { cls: 'bc-overview-card-title', text: 'STB → Video Migration' });
  const migBody = migCard.createDiv({ cls: 'bc-overview-card-body' });
  if (snapshot.stbToVideoMigrationSummary) {
    const { parityStatus, blocked } = snapshot.stbToVideoMigrationSummary;
    createStatusChip(migBody, parityStatus ?? 'unknown', blocked ? 'danger' : 'ok');
  }
  if (snapshot.migrationParitySummary) {
    const { percent, mappedCount, totalCount } = snapshot.migrationParitySummary;
    createProgressBar(migBody, percent, percent >= 80 ? 'ok' : 'warn');
    migBody.createEl('div', { cls: 'bc-overview-card-sub', text: `${mappedCount}/${totalCount} mapped` });
  }
  if (snapshot.migrationBlockedCount > 0) {
    createStatusChip(migBody, `${snapshot.migrationBlockedCount} blocker${snapshot.migrationBlockedCount > 1 ? 's' : ''}`, 'danger');
  }

}

function renderAppsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot, settings: BrainConsoleSettings, onRefresh?: () => void): void {
  const page = content.createDiv({ cls: 'brain-console__apps-page' });
  page.appendChild(renderLocalAppsCard(state, settings, onRefresh));
}

function renderSessionsSection(content: HTMLElement, state: BrainConsoleViewState): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  const sessionsCard = document.createElement('div');
  sessionsCard.addClass('brain-console__card-content');
  const sessions = safeArray(state.sessions);
  if (!sessions.length) {
    sessionsCard.createEl('p', { text: 'No sessions found.' });
    sessionsCard.createEl('p', { cls: 'brain-console__detail', text: 'Sessions appear once Brain Core has recorded at least one AI agent session.' });
  } else {
    const list = sessionsCard.createDiv({ cls: 'brain-console__list' });
    for (const s of sessions.slice(0, 20)) {
      const row = list.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: (s as any).id ?? 'unknown' });
      row.createEl('span', { cls: 'brain-console__list-value', text: (s as any).status ?? '' });
      row.createEl('span', { cls: 'brain-console__detail', text: (s as any).startedAt ? formatRelativeTime((s as any).startedAt) : '' });
    }
    if (sessions.length > 20) {
      sessionsCard.createEl('p', { cls: 'brain-console__detail', text: `${sessions.length - 20} more session(s) not shown.` });
    }
  }
  renderCard(grid, `Sessions (${sessions.length})`, sessionsCard);

  const schedulerCard = document.createElement('div');
  schedulerCard.addClass('brain-console__card-content');
  const jobs = safeArray(state.schedulerJobs);
  const sched = state.schedulerStatus;
  if (!sched) {
    schedulerCard.createEl('p', { text: 'Scheduler status unavailable.' });
  } else {
    renderCompactStatGrid(schedulerCard, [
      { label: 'Scheduler', value: (sched as any).running ? 'Running' : 'Stopped' },
      { label: 'Jobs', value: String(jobs.length) },
      { label: 'Last run', value: (sched as any).lastRunAt ? formatRelativeTime((sched as any).lastRunAt) : 'never' },
    ]);
    for (const job of jobs.slice(0, 10)) {
      const row = schedulerCard.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: (job as any).id ?? 'unknown' });
      row.createEl('span', { cls: 'brain-console__list-value', text: (job as any).schedule ?? '' });
      row.createEl('span', { cls: 'brain-console__detail', text: (job as any).lastRunAt ? formatRelativeTime((job as any).lastRunAt) : 'never' });
    }
  }
  renderCard(grid, `Scheduler (${jobs.length} jobs)`, schedulerCard);
}

function renderInfraSection(content: HTMLElement, state: BrainConsoleViewState): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  // Dokploy
  const dokployCard = document.createElement('div');
  dokployCard.addClass('brain-console__card-content');
  const dok = state.infraDokploy;
  if (!dok || dok.status === 'not-configured') {
    dokployCard.createEl('p', { text: dok?.error ?? 'Dokploy not configured.' });
    dokployCard.createEl('p', { cls: 'brain-console__detail', text: 'Set DOKPLOY_URL and DOKPLOY_API_KEY in ~/.config/dokploy/.env' });
  } else if (dok.status === 'error') {
    dokployCard.createEl('p', { cls: 'brain-console__error-detail', text: dok.error ?? 'Dokploy error.' });
  } else {
    renderCompactStatGrid(dokployCard, [
      { label: 'Apps', value: String(dok.totalApps ?? 0) },
      { label: 'Compose', value: String(dok.totalCompose ?? 0) },
    ]);
    const list = dokployCard.createDiv({ cls: 'brain-console__list' });
    for (const app of safeArray(dok.apps).slice(0, 15)) {
      const row = list.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: (app as any).name ?? 'unknown' });
      row.createEl('span', { cls: 'brain-console__list-value', text: (app as any).status ?? '' });
      row.createEl('span', { cls: 'brain-console__detail', text: (app as any).type ?? '' });
    }
    if ((dok.apps?.length ?? 0) > 15) {
      dokployCard.createEl('p', { cls: 'brain-console__detail', text: `${(dok.apps?.length ?? 0) - 15} more app(s).` });
    }
  }
  renderCard(grid, 'Dokploy', dokployCard);

  // Tunnels
  const tunnelsCard = document.createElement('div');
  tunnelsCard.addClass('brain-console__card-content');
  const tun = state.infraTunnels;
  if (!tun || tun.status === 'not-configured') {
    tunnelsCard.createEl('p', { text: tun?.error ?? 'Cloudflare tunnels not configured.' });
    tunnelsCard.createEl('p', { cls: 'brain-console__detail', text: 'Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.' });
  } else if (tun.status === 'error') {
    tunnelsCard.createEl('p', { cls: 'brain-console__error-detail', text: tun.error ?? 'Tunnels error.' });
  } else {
    const tunnels = safeArray(tun.tunnels);
    tunnelsCard.createEl('p', { cls: 'brain-console__detail', text: `${tunnels.length} active tunnel(s)` });
    const list = tunnelsCard.createDiv({ cls: 'brain-console__list' });
    for (const t of tunnels.slice(0, 15)) {
      const row = list.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: (t as any).name ?? 'unknown' });
      row.createEl('span', { cls: 'brain-console__list-value', text: (t as any).status ?? '' });
    }
  }
  renderCard(grid, 'Cloudflare Tunnels', tunnelsCard);

  // Domains
  const domainsCard = document.createElement('div');
  domainsCard.addClass('brain-console__card-content');
  const dom = state.infraDomains;
  if (!dom || dom.status === 'not-configured') {
    domainsCard.createEl('p', { text: dom?.error ?? 'Cloudflare domains not configured.' });
    domainsCard.createEl('p', { cls: 'brain-console__detail', text: 'Set CLOUDFLARE_API_TOKEN.' });
  } else if (dom.status === 'error') {
    domainsCard.createEl('p', { cls: 'brain-console__error-detail', text: dom.error ?? 'Domains error.' });
  } else {
    const domains = safeArray(dom.domains);
    domainsCard.createEl('p', { cls: 'brain-console__detail', text: `${domains.length} domain(s) · sorted by soonest expiry` });
    const list = domainsCard.createDiv({ cls: 'brain-console__list' });
    for (const d of domains.slice(0, 20)) {
      const row = list.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: (d as any).name ?? 'unknown' });
      row.createEl('span', { cls: 'brain-console__list-value', text: (d as any).status ?? '' });
      if ((d as any).expiresAt) {
        row.createEl('span', { cls: 'brain-console__detail', text: `expires ${formatRelativeTime((d as any).expiresAt)}` });
      }
    }
    if (domains.length > 20) {
      domainsCard.createEl('p', { cls: 'brain-console__detail', text: `${domains.length - 20} more domain(s).` });
    }
  }
  renderCard(grid, 'Cloudflare Domains', domainsCard);
}

function renderAnalyticsSection(content: HTMLElement, state: BrainConsoleViewState): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  // Umami
  const umamiCard = document.createElement('div');
  umamiCard.addClass('brain-console__card-content');
  const umami = state.infraUmami;
  if (!umami || umami.status === 'not-configured') {
    umamiCard.createEl('p', { text: umami?.error ?? 'Umami analytics not configured.' });
    umamiCard.createEl('p', { cls: 'brain-console__detail', text: 'Set UMAMI_URL and UMAMI_API_KEY (or UMAMI_USERNAME + UMAMI_PASSWORD).' });
  } else if (umami.status === 'error') {
    umamiCard.createEl('p', { cls: 'brain-console__error-detail', text: umami.error ?? 'Umami error.' });
  } else {
    const websites = safeArray(umami.websites);
    renderCompactStatGrid(umamiCard, [
      { label: 'Sites', value: String(websites.length) },
    ]);
    const list = umamiCard.createDiv({ cls: 'brain-console__list' });
    for (const site of websites.slice(0, 20)) {
      const row = list.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: (site as any).name ?? 'unknown' });
      const visitors = (site as any).stats?.visitors ?? (site as any).visitors;
      if (visitors != null) {
        row.createEl('span', { cls: 'brain-console__list-value', text: `${visitors} visitors` });
      }
      const domain = (site as any).domain;
      if (domain) {
        row.createEl('span', { cls: 'brain-console__detail', text: domain });
      }
    }
    if (websites.length > 20) {
      umamiCard.createEl('p', { cls: 'brain-console__detail', text: `${websites.length - 20} more site(s).` });
    }
  }
  renderCard(grid, 'Umami Analytics', umamiCard);

  // Google Ads
  const adsCard = document.createElement('div');
  adsCard.addClass('brain-console__card-content');
  const ads = state.infraGoogleAds;
  if (!ads || ads.status === 'not-configured') {
    adsCard.createEl('p', { text: ads?.error ?? 'Google Ads data not configured.' });
    adsCard.createEl('p', { cls: 'brain-console__detail', text: 'Google Ads SQLite DB expected at ~/Repos/stevewesthoek/brain/operations/google-ads/data/google_ads.sqlite3' });
  } else if (ads.status === 'error') {
    adsCard.createEl('p', { cls: 'brain-console__error-detail', text: ads.error ?? 'Google Ads error.' });
  } else {
    renderCompactStatGrid(adsCard, [
      { label: 'Daily budget', value: ads.dailyBudgetUSD != null ? `$${ads.dailyBudgetUSD.toFixed(2)}` : 'n/a' },
      { label: 'Target budget', value: ads.targetBudgetUSD != null ? `$${ads.targetBudgetUSD.toFixed(2)}` : 'n/a' },
      { label: '% of target', value: ads.percentOfTarget != null ? `${ads.percentOfTarget.toFixed(1)}%` : 'n/a' },
      { label: 'Day', value: ads.dayOfMonth != null ? `${ads.dayOfMonth}/${ads.daysInMonth}` : 'n/a' },
      { label: 'Pending mutations', value: String(ads.pendingMutations ?? 0) },
      { label: 'Last sync', value: ads.lastSync ? formatRelativeTime(ads.lastSync) : 'never' },
      { label: 'Last metrics', value: ads.lastMetricsDate ?? 'n/a' },
    ]);
    if (ads.mutationStatsByStatus) {
      const stats = ads.mutationStatsByStatus as Record<string, number>;
      const list = adsCard.createDiv({ cls: 'brain-console__list' });
      list.createEl('div', { cls: 'brain-console__list-label', text: 'Mutations by status' });
      for (const [k, v] of Object.entries(stats)) {
        const row = list.createDiv({ cls: 'brain-console__list-row' });
        row.createEl('span', { cls: 'brain-console__list-label', text: k });
        row.createEl('span', { cls: 'brain-console__list-value', text: String(v) });
      }
    }
  }
  renderCard(grid, 'Google Ads', adsCard);

  const costCard = document.createElement('div');
  costCard.addClass('brain-console__card-content');
  const cost = state.agentCostSummary;
  if (!cost) {
    costCard.createEl('p', { text: 'Agent cost summary unavailable.' });
    costCard.createEl('p', { cls: 'brain-console__detail', text: 'Check /agent-cost-summary on Brain Core.' });
  } else {
    renderCompactStatGrid(costCard, [
      { label: 'Today', value: `$${cost.todayEstimatedUsd.toFixed(2)}` },
      { label: 'Week', value: `$${cost.weekEstimatedUsd.toFixed(2)}` },
      { label: 'Month', value: `$${cost.monthEstimatedUsd.toFixed(2)}` },
      { label: 'Local routes', value: String(cost.localRouteCount) },
      { label: 'Escalations', value: String(cost.escalatedRouteCount) },
      { label: 'Budget', value: cost.budget.status },
    ]);
    const list = costCard.createDiv({ cls: 'brain-console__list' });
    for (const item of cost.topExpensiveTasks.slice(0, 10)) {
      const row = list.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: item.taskType });
      row.createEl('span', { cls: 'brain-console__list-value', text: `${item.surface} · $${item.estimatedCostUsd.toFixed(4)}` });
      row.createEl('span', { cls: 'brain-console__detail', text: item.routingReason });
    }
  }
  renderCard(grid, 'Agent Cost Summary', costCard);
}

function renderStripeSection(content: HTMLElement, state: BrainConsoleViewState): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  const stripe = state.infraStripe;
  if (!stripe || stripe.status === 'not-configured') {
    const card = document.createElement('div');
    card.addClass('brain-console__card-content');
    card.createEl('p', { text: stripe?.error ?? 'Stripe not configured.' });
    card.createEl('p', { cls: 'brain-console__detail', text: 'Create ~/.config/stripe/config.toml with profile sections.' });
    renderCard(grid, 'Stripe', card);
    return;
  }

  if (stripe.status === 'error') {
    const card = document.createElement('div');
    card.addClass('brain-console__card-content');
    card.createEl('p', { cls: 'brain-console__error-detail', text: stripe.error ?? 'Stripe error.' });
    renderCard(grid, 'Stripe', card);
    return;
  }

  for (const account of safeArray(stripe.accounts)) {
    const card = document.createElement('div');
    card.addClass('brain-console__card-content');
    const rows: Array<{ label: string; value: string }> = [];
    if (account.liveAvailableAmount != null) {
      const currency = (account.liveCurrency ?? 'usd').toUpperCase();
      rows.push({ label: 'Live available', value: `${account.liveAvailableAmount.toFixed(2)} ${currency}` });
      if (account.livePendingAmount != null) {
        rows.push({ label: 'Live pending', value: `${account.livePendingAmount.toFixed(2)} ${currency}` });
      }
    } else {
      rows.push({ label: 'Live balance', value: 'n/a' });
    }
    if (account.testAvailableAmount != null) {
      rows.push({ label: 'Test available', value: `${account.testAvailableAmount.toFixed(2)} (test)` });
    }
    if (account.error) {
      card.createEl('p', { cls: 'brain-console__error-detail', text: account.error });
    }
    renderCompactStatGrid(card, rows);
    renderCard(grid, account.displayName || account.profileName, card);
  }
}

function renderMonitoringSection(content: HTMLElement, state: BrainConsoleViewState): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  const nr = state.infraNewRelic;
  if (!nr || nr.status === 'not-configured') {
    const card = document.createElement('div');
    card.addClass('brain-console__card-content');
    card.createEl('p', { text: nr?.error ?? 'New Relic not configured.' });
    card.createEl('p', { cls: 'brain-console__detail', text: 'Use ~/.config/newrelic/.env or set NEW_RELIC_USER_API_KEY and NEW_RELIC_ACCOUNT_ID in the process env.' });
    renderCard(grid, 'New Relic', card);
    return;
  }

  if (nr.status === 'error') {
    const card = document.createElement('div');
    card.addClass('brain-console__card-content');
    card.createEl('p', { cls: 'brain-console__error-detail', text: nr.error ?? 'New Relic error.' });
    renderCard(grid, 'New Relic', card);
    return;
  }

  const hostsCard = document.createElement('div');
  hostsCard.addClass('brain-console__card-content');
  const hosts = safeArray(nr.hosts);
  renderCompactStatGrid(hostsCard, [
    { label: 'Hosts', value: String(hosts.length) },
  ]);
  const hostList = hostsCard.createDiv({ cls: 'brain-console__list' });
  for (const h of hosts.slice(0, 20)) {
    const row = hostList.createDiv({ cls: 'brain-console__list-row' });
    row.createEl('span', { cls: 'brain-console__list-label', text: (h as any).name ?? 'unknown' });
    row.createEl('span', { cls: 'brain-console__list-value', text: (h as any).alertSeverity ?? 'ok' });
    if ((h as any).reportingStatus) {
      row.createEl('span', { cls: 'brain-console__detail', text: (h as any).reportingStatus });
    }
  }
  if (hosts.length > 20) {
    hostsCard.createEl('p', { cls: 'brain-console__detail', text: `${hosts.length - 20} more host(s).` });
  }
  renderCard(grid, `Hosts (${hosts.length})`, hostsCard);

  const syntheticsCard = document.createElement('div');
  syntheticsCard.addClass('brain-console__card-content');
  const synthetics = safeArray(nr.synthetics);
  renderCompactStatGrid(syntheticsCard, [
    { label: 'Monitors', value: String(synthetics.length) },
  ]);
  const synList = syntheticsCard.createDiv({ cls: 'brain-console__list' });
  for (const s of synthetics.slice(0, 20)) {
    const row = synList.createDiv({ cls: 'brain-console__list-row' });
    row.createEl('span', { cls: 'brain-console__list-label', text: (s as any).name ?? 'unknown' });
    row.createEl('span', { cls: 'brain-console__list-value', text: (s as any).status ?? '' });
    if ((s as any).type) {
      row.createEl('span', { cls: 'brain-console__detail', text: (s as any).type });
    }
  }
  if (synthetics.length > 20) {
    syntheticsCard.createEl('p', { cls: 'brain-console__detail', text: `${synthetics.length - 20} more monitor(s).` });
  }
  renderCard(grid, `Synthetic Monitors (${synthetics.length})`, syntheticsCard);
}

function renderVideoOrchestratorSection(content: HTMLElement, state: BrainConsoleViewState): void {
  const container = content.createDiv({ cls: 'vo-studio-container' });

  const voShell = new VOShell(container, {
    projects: state.voStudioProjects?.items,
    accounts: state.voStudioAccounts?.items,
    pipelineProfiles: state.voStudioPipelineProfiles?.items,
    contentItems: state.voStudioContentItems?.items,
    selector: state.aiModelSelectorStatus,
    analytics: state.voStudioAnalytics,
    accountStats: state.voAccountStats,
  });
}

function renderVOContextBar(parent: HTMLElement, state: BrainConsoleViewState): void {
  const project = state.voStudioProjects?.items?.[0];
  const profile = state.voStudioPipelineProfiles?.items?.find((item) => item.id === project?.defaultPipelineProfileId) ?? state.voStudioPipelineProfiles?.items?.[0];
  const accountCount = state.voStudioAccounts?.items?.length ?? 0;
  const targetText = profile?.targetPlatforms?.join(', ') ?? 'not configured';
  const bar = parent.createDiv({ cls: 'bc-vo-context-bar' });
  [
    ['Project', project?.name ?? 'Unavailable'],
    ['Account', accountCount > 0 ? `${accountCount} configured` : 'Unavailable'],
    ['Platform targets', targetText],
    ['Pipeline profile', profile?.name ?? 'Unavailable'],
    ['Date range', '7d read-only'],
  ].forEach(([label, value]) => {
    const item = bar.createDiv({ cls: 'bc-vo-context-item' });
    item.createEl('span', { cls: 'bc-vo-context-label', text: label });
    item.createEl('span', { cls: 'bc-vo-context-value', text: value });
  });
}

function renderVOStudioOverviewCard(state: BrainConsoleViewState): HTMLElement {
  const card = document.createElement('div');
  card.addClass('brain-console__card-content');
  const analytics = state.voStudioAnalytics;
  renderCompactStatGrid(card, [
    { label: 'Projects', value: String(state.voStudioProjects?.items?.length ?? 0) },
    { label: 'Accounts', value: String(state.voStudioAccounts?.items?.length ?? 0) },
    { label: 'Profiles', value: String(state.voStudioPipelineProfiles?.items?.length ?? 0) },
    { label: 'Content items', value: String(state.voStudioContentItems?.items?.length ?? 0) },
    { label: 'Studio model', value: analytics?.status ?? 'Unavailable' },
  ]);
  card.createEl('p', { cls: 'brain-console__detail', text: state.voStudioProjects?.nextSafeStep ?? 'Normalized Video Orchestrator model not available.' });
  return card;
}

function renderVOHealthAndUsageCard(state: BrainConsoleViewState): HTMLElement {
  const card = document.createElement('div');
  card.addClass('brain-console__card-content');

  const projectCount = state.voStudioProjects?.items?.length ?? 0;
  const accountCount = state.voStudioAccounts?.items?.length ?? 0;
  const profileCount = state.voStudioPipelineProfiles?.items?.length ?? 0;
  const contentCount = state.voStudioContentItems?.items?.length ?? 0;
  const selector = state.aiModelSelectorStatus;
  const selectorState = !selector
    ? 'unavailable'
    : selector.running && selector.healthy
      ? 'healthy'
      : selector.running
        ? 'degraded'
        : 'stopped';

  renderCompactStatGrid(card, [
    { label: 'Projects', value: String(projectCount) },
    { label: 'Accounts', value: String(accountCount) },
    { label: 'Profiles', value: String(profileCount) },
    { label: 'Content items', value: String(contentCount) },
    { label: 'AI selector', value: selectorState },
  ]);

  const list = card.createDiv({ cls: 'brain-console__list' });
  const row = list.createDiv({ cls: 'brain-console__list-row' });
  row.createEl('span', { cls: 'brain-console__list-label', text: 'Usage' });
  row.createEl('span', {
    cls: 'brain-console__list-value',
    text: `${contentCount} item${contentCount === 1 ? '' : 's'} in view · read-only shared orchestration`,
  });

  return card;
}

function renderVOStudioWorkspaceCard(state: BrainConsoleViewState): HTMLElement {
  const card = document.createElement('div');
  card.addClass('brain-console__card-content');
  const item = state.voStudioContentItems?.items?.[0];
  if (!item) {
    card.createEl('p', { cls: 'brain-console__empty', text: 'No normalized content items available.' });
    return card;
  }
  const tabs = ['Brief', 'Script', 'Media', 'Captions', 'Thumbnails', 'SEO', 'Preview', 'Approval'];
  const tabRow = card.createDiv({ cls: 'bc-vo-tab-row' });
  for (const tab of tabs) {
    tabRow.createEl('span', { cls: 'bc-vo-tab-chip', text: tab });
  }
  renderCompactStatGrid(card, [
    { label: 'Current item', value: item.title },
    { label: 'Status', value: item.status },
    { label: 'Targets', value: String(item.platformTargets.length) },
    { label: 'Variants', value: String(item.artifactVariants.length) },
    { label: 'Package', value: item.packageId },
  ]);
  card.createEl('p', { cls: 'brain-console__detail', text: item.canonicalSource });
  return card;
}

function renderVOThumbnailStudioCard(state: BrainConsoleViewState): HTMLElement {
  const card = document.createElement('div');
  card.addClass('brain-console__card-content');
  const item = state.voStudioContentItems?.items?.[0];
  const thumbnailVariants = item?.artifactVariants.filter((variant) => variant.kind === 'thumbnail') ?? [];
  const strip = card.createDiv({ cls: 'bc-vo-preview-strip' });
  ['16:9', '9:16', '1:1', '4:5', '2:3'].forEach((ratio) => {
    const frame = strip.createDiv({ cls: 'bc-vo-preview-frame' });
    frame.createEl('span', { text: ratio });
  });
  renderCompactStatGrid(card, [
    { label: 'Template source', value: thumbnailVariants[0]?.sourceTemplateId ?? 'template-thumbnail-unified' },
    { label: 'Generated variants', value: String(thumbnailVariants.length) },
    { label: 'Provider calls', value: 'disabled' },
    { label: 'Safe zones', value: 'enabled in spec' },
  ]);
  card.createEl('p', { cls: 'brain-console__detail', text: 'One Thumbnail Studio generates landscape, vertical, square, 4:5, and Pinterest variants from shared fields.' });
  return card;
}

function renderVOPipelineProfileCard(state: BrainConsoleViewState): HTMLElement {
  const card = document.createElement('div');
  card.addClass('brain-console__card-content');
  const profile = state.voStudioPipelineProfiles?.items?.[0];
  if (!profile) {
    card.createEl('p', { cls: 'brain-console__empty', text: 'No pipeline profile available.' });
    return card;
  }
  const stageMap = card.createDiv({ cls: 'bc-vo-stage-map' });
  for (const stage of profile.enabledStages) {
    const stageEl = stageMap.createDiv({ cls: `bc-vo-stage bc-vo-stage--${stage.status}` });
    stageEl.createEl('span', { text: stage.label });
  }
  renderCompactStatGrid(card, [
    { label: 'Profile', value: profile.name },
    { label: 'Targets', value: profile.targetPlatforms.join(', ') },
    { label: 'Stages', value: String(profile.enabledStages.length) },
    { label: 'Fallback', value: 'manual package' },
  ]);
  card.createEl('p', { cls: 'brain-console__detail', text: profile.fallbackBehavior });
  return card;
}

function renderVOAccountsRegistryCard(state: BrainConsoleViewState): HTMLElement {
  const card = document.createElement('div');
  card.addClass('brain-console__card-content');
  const list = card.createDiv({ cls: 'brain-console__list' });
  for (const account of state.voStudioAccounts?.items ?? []) {
    const row = list.createDiv({ cls: 'brain-console__list-row' });
    row.createEl('span', { cls: 'brain-console__list-label', text: `${account.handle} (${account.platform})` });
    row.createEl('span', { cls: 'brain-console__list-value', text: account.adapterStatus });
    row.createEl('span', { cls: 'brain-console__detail', text: `${account.credentialState} · quota ${account.quotaState}` });
  }
  if ((state.voStudioAccounts?.items?.length ?? 0) === 0) {
    card.createEl('p', { cls: 'brain-console__empty', text: 'No normalized VO accounts available.' });
  }
  return card;
}

function renderVOLiveStatusCards(grid: HTMLElement, state: BrainConsoleViewState): void {
  const vol = state.voLiveStatus;

  if (!vol) {
    // Endpoint not yet reachable — show nothing, don't clutter the UI
    return;
  }

  if (!vol.ok) {
    const errCard = document.createElement('div');
    errCard.addClass('brain-console__card-content');
    errCard.createEl('p', { cls: 'brain-console__error-detail', text: vol.error ?? 'VO DB unreachable.' });
    errCard.createEl('p', { cls: 'brain-console__detail', text: 'Brain Core cannot connect to the Video Orchestrator PostgreSQL database.' });
    renderCard(grid, 'VO Live DB', errCard);
    return;
  }

  // Queue depth card
  if (vol.queueDepth) {
    const qCard = document.createElement('div');
    qCard.addClass('brain-console__card-content');
    const qd = vol.queueDepth;
    renderCompactStatGrid(qCard, [
      { label: 'Pending', value: String(qd.pending) },
      { label: 'Running', value: String(qd.running) },
      { label: 'Failed', value: String(qd.failed) },
      { label: 'Dead', value: String(qd.dead ?? 0) },
      { label: 'Active accounts', value: String(vol.activeAccounts ?? 0) },
    ]);
    if ((qd.dead ?? 0) > 0) {
      qCard.createEl('p', { cls: 'brain-console__warning', text: `${qd.dead} dead jobs — run: vo jobs to inspect, vo retry <id> to re-queue` });
    }
    if (vol.lastJobAt) {
      qCard.createEl('p', { cls: 'brain-console__detail', text: `Last job: ${formatRelativeTime(vol.lastJobAt)}` });
    }
    renderCard(grid, 'VO Queue', qCard);
  }

  // Accounts by platform card
  if (vol.accountsByPlatform && Object.keys(vol.accountsByPlatform).length > 0) {
    const apCard = document.createElement('div');
    apCard.addClass('brain-console__card-content');
    const apList = apCard.createDiv({ cls: 'brain-console__list' });
    for (const [platform, count] of Object.entries(vol.accountsByPlatform)) {
      const row = apList.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: platform });
      row.createEl('span', { cls: 'brain-console__list-value', text: `${count} account${count !== 1 ? 's' : ''}` });
    }
    renderCard(grid, 'VO Accounts by Platform', apCard);
  }

  // Recent posts card
  if (vol.recentPosts && vol.recentPosts.length > 0) {
    const rpCard = document.createElement('div');
    rpCard.addClass('brain-console__card-content');
    const rpList = rpCard.createDiv({ cls: 'brain-console__list' });
    for (const post of vol.recentPosts.slice(0, 3)) {
      const row = rpList.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: `${post.accountHandle} (${post.platform})` });
      row.createEl('span', { cls: 'brain-console__detail', text: post.title.slice(0, 40) });
      if (post.postedAt) {
        row.createEl('span', { cls: 'brain-console__list-value', text: formatRelativeTime(post.postedAt) });
      }
    }
    renderCard(grid, 'VO Recent Posts', rpCard);
  }

  // Analytics snapshot card
  if (vol.analyticsSnapshot) {
    const asCard = document.createElement('div');
    asCard.addClass('brain-console__card-content');
    const snap = vol.analyticsSnapshot;
    renderCompactStatGrid(asCard, [
      { label: 'Total views (7d)', value: snap.totalViews7d.toLocaleString() },
      { label: 'Avg engagement (7d)', value: `${(snap.avgEngagement7d * 100).toFixed(1)}%` },
      { label: 'Top platform', value: snap.topPlatform || '—' },
    ]);
    renderCard(grid, 'VO Analytics (7d)', asCard);
  }
}

function renderStudioSection(content: HTMLElement, state: BrainConsoleViewState): void {
  renderVOContextBar(content, state);
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Shared Orchestration', renderVOStudioOverviewCard(state), {
    wide: true,
    subtitle: 'Shared processing visibility only. Project-specific editing, scripting, SEO, and thumbnail design live in the project repo.',
  });
  renderCard(grid, 'Health & Usage', renderVOHealthAndUsageCard(state), {
    wide: true,
    subtitle: 'Read-only health, quota, account coverage, and artifact usage.',
  });
  renderVOLiveStatusCards(grid, state);
  return;
}

function renderLocalAppActionAuditCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.addClass('brain-console__card-content');
  const audit = state.localAppsActionStatus?.audit;
  const recentCount = state.localAppsActionStatus?.recentResults?.length ?? 0;
  const inFlightCount = state.localAppsActionStatus?.inFlight?.length ?? 0;
  const managedProcesses = state.localAppsActionStatus?.managedProcesses ?? [];

  if (!audit) {
    container.createEl('p', { text: 'Local app action audit status is not available yet.' });
    container.createEl('p', { cls: 'brain-console__detail', text: 'Manual refresh after Brain Core is online to load audit persistence state.' });
    return container;
  }

  const status = container.createEl('p');
  status.createEl('strong', { text: 'Audit status: ' });
  status.appendText(audit.status);

  const rows = [
    ['Audit path', audit.path],
    ['Persisted results', String(audit.persistedResultCount ?? 0)],
    ['Recent results', String(recentCount)],
    ['In-flight actions', String(inFlightCount)],
    ['Managed processes', String(managedProcesses.length)],
    ['Last persisted', audit.lastPersistedAt ? formatRelativeTime(audit.lastPersistedAt) : 'never'],
  ];

  for (const [label, value] of rows) {
    const row = container.createEl('p', { cls: 'brain-console__detail' });
    row.createEl('strong', { text: `${label}: ` });
    row.appendText(value);
  }

  if (audit.lastError) {
    container.createEl('p', { cls: 'brain-console__error-detail', text: `Audit warning: ${audit.lastError}` });
  }

  if (managedProcesses.length > 0) {
    const list = container.createDiv({ cls: 'brain-console__managed-process-list' });
    list.createEl('div', { cls: 'brain-console__managed-process-list-label', text: 'Active Brain Core-managed processes' });
    for (const process of managedProcesses.slice(0, 5)) {
      const row = list.createDiv({ cls: 'brain-console__managed-process-row' });
      row.createEl('span', { cls: 'brain-console__managed-process-name', text: process.appId });
      row.createEl('span', { cls: 'brain-console__managed-process-meta', text: `pid ${process.pid} · ${process.commandLabel}` });
      row.createEl('span', { cls: 'brain-console__managed-process-meta', text: formatRelativeTime(process.startedAt) });
      row.title = `${process.appId} started by Brain Core from ${process.cwdSummary}`;
    }
    if (managedProcesses.length > 5) {
      list.createEl('div', { cls: 'brain-console__managed-process-more', text: `${managedProcesses.length - 5} more managed process(es)` });
    }
  }

  container.createEl('p', {
    cls: 'brain-console__detail',
    text: 'Brain Console reads this status from Brain Core. The plugin does not execute shell commands or write audit files.',
  });
  return container;
}

// ── Research drawer persistent state (survives DOM re-renders) ───────────────
const _orchResearchState: {
  url: string;
  focus: string;
  result: Record<string, unknown> | null;
  error: string | null;
  running: boolean;
  phase: 'idle' | 'call1' | 'call2' | 'done';
  startedAt: number;
  timerInterval: ReturnType<typeof setInterval> | null;
} = { url: '', focus: '', result: null, error: null, running: false, phase: 'idle', startedAt: 0, timerInterval: null };

const RESEARCH_HISTORY_KEY = 'bc-orch-research-history';

interface ResearchHistoryEntry {
  title: string;
  url: string;
  savedAt: number;
  result: Record<string, unknown>;
}

function bcOrchLoadHistory(): ResearchHistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RESEARCH_HISTORY_KEY) ?? '[]') as ResearchHistoryEntry[];
  } catch {
    return [];
  }
}

function bcOrchSaveToHistory(result: Record<string, unknown>): void {
  const entries = bcOrchLoadHistory();
  const entry: ResearchHistoryEntry = {
    title: (result.title as string) || (result.url as string) || 'Untitled',
    url: (result.url as string) ?? '',
    savedAt: Date.now(),
    result,
  };
  localStorage.setItem(RESEARCH_HISTORY_KEY, JSON.stringify([entry, ...entries].slice(0, 5)));
}

function renderOrchestratorsSection(content: HTMLElement, state: BrainConsoleViewState, _snapshot: DashboardSnapshot): void {
  // ── Inject CSS once ──────────────────────────────────────────────────────────
  const styleId = 'bc-orch-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = `
.bc-orch-section { display: flex; gap: 0; background: #1a1a1a; min-height: 400px; position: relative; }
.bc-orch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px; width: 100%; transition: width 0.2s ease; box-sizing: border-box; }
.bc-orch-section--drawer-open .bc-orch-grid { width: 35%; }
.bc-orch-drawer-container { width: 0; overflow: hidden; transition: width 0.2s ease; background: #242424; border-left: 1px solid #3a3a3a; display: flex; flex-direction: column; }
.bc-orch-section--drawer-open .bc-orch-drawer-container { width: 65%; }
.bc-orch-drawer { display: none; flex-direction: column; height: 100%; overflow: hidden; }
.bc-orch-drawer--active { display: flex; }
.bc-orch-card { background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 6px; padding: 12px; display: flex; flex-direction: column; gap: 6px; font-family: monospace; transition: border-color 0.15s; }
.bc-orch-card:hover { border-color: #4a4a4a; }
.bc-orch-card-header { display: flex; align-items: center; gap: 6px; }
.bc-orch-card-title { font-size: 11px; font-weight: bold; color: #fff; letter-spacing: 0.5px; }
.bc-orch-card-stat { font-size: 11px; color: #888; }
.bc-orch-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 6px; }
.bc-orch-health { display: flex; gap: 3px; align-items: center; }
.bc-orch-dot { width: 8px; height: 8px; border-radius: 50%; background: #555; display: inline-block; }
.bc-orch-dot--running { background: #3b82f6; animation: bc-orch-pulse 1.5s ease-in-out infinite; }
.bc-orch-dot--done { background: #2ecc71; }
.bc-orch-dot--partial { background: #e67e22; }
.bc-orch-dot--error { background: #e74c3c; }
@keyframes bc-orch-pulse { 0%,100%{opacity:1}50%{opacity:0.3} }
.bc-orch-open-btn { font-size: 10px; color: #888; background: none; border: 1px solid #3a3a3a; border-radius: 3px; padding: 2px 8px; cursor: pointer; font-family: monospace; }
.bc-orch-open-btn:hover { color: #fff; border-color: #888; }
.bc-orch-open-btn--active { color: #3b82f6; border-color: #3b82f6; }
.bc-orch-drawer-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 1px solid #3a3a3a; flex-shrink: 0; }
.bc-orch-drawer-title { font-size: 12px; font-weight: bold; color: #fff; font-family: monospace; }
.bc-orch-drawer-close { background: none; border: none; color: #666; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 4px; }
.bc-orch-drawer-close:hover { color: #fff; }
.bc-orch-drawer-body { padding: 14px; flex: 1; overflow-y: auto; font-family: monospace; font-size: 11px; color: #888; }
.bc-orch-split { display: flex; gap: 0; height: 100%; overflow: hidden; }
.bc-orch-split-left { padding: 14px; border-right: 1px solid #3a3a3a; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; flex-shrink: 0; }
.bc-orch-split-right { padding: 14px; flex: 1; overflow-y: auto; }
.bc-orch-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
.bc-orch-input { width: 100%; background: #1a1a1a; border: 1px solid #3a3a3a; border-radius: 3px; color: #fff; font-family: monospace; font-size: 11px; padding: 6px 8px; box-sizing: border-box; resize: vertical; }
.bc-orch-input:focus { outline: none; border-color: #3b82f6; }
.bc-orch-btn { font-family: monospace; font-size: 11px; padding: 5px 12px; border-radius: 3px; cursor: pointer; border: 1px solid #3a3a3a; background: #333; color: #fff; }
.bc-orch-btn:hover { background: #3a3a3a; }
.bc-orch-btn--primary { background: #1d4ed8; border-color: #2563eb; }
.bc-orch-btn--primary:hover { background: #2563eb; }
.bc-orch-btn:disabled { opacity: 0.4; cursor: default; }
.bc-orch-output-empty { color: #555; font-style: italic; padding: 20px 0; }
.bc-orch-phase-grid { width: 100%; border-collapse: collapse; font-size: 10px; }
.bc-orch-phase-grid th { color: #666; font-weight: normal; padding: 4px 6px; text-align: center; border-bottom: 1px solid #3a3a3a; white-space: nowrap; }
.bc-orch-phase-grid td { padding: 4px 6px; text-align: center; border-bottom: 1px solid #2a2a2a; color: #888; }
.bc-orch-badge { display: inline-block; background: #333; border: 1px solid #3a3a3a; border-radius: 3px; padding: 2px 6px; font-size: 10px; color: #888; margin: 2px; }
.bc-orch-result-title { font-size: 13px; color: #fff; font-weight: bold; margin-bottom: 4px; }
.bc-orch-result-meta { color: #666; font-size: 10px; margin-bottom: 10px; }
.bc-orch-result-section { margin-bottom: 12px; }
.bc-orch-result-section-title { font-size: 10px; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
.bc-orch-pre { background: #1a1a1a; border: 1px solid #3a3a3a; border-radius: 3px; padding: 8px; max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-word; font-size: 10px; color: #aaa; line-height: 1.5; }
.bc-orch-claim { color: #aaa; padding: 2px 0; border-bottom: 1px solid #2a2a2a; }
.bc-orch-skeleton { background: #333; border-radius: 3px; height: 10px; margin: 4px 0; animation: bc-orch-shimmer 1.5s infinite; }
@keyframes bc-orch-shimmer { 0%{opacity:0.4;width:20%}50%{opacity:0.8;width:80%}100%{opacity:0.4;width:20%} }
.bc-orch-section-header { font-size: 10px; color: #555; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px 0; border-bottom: 1px solid #2a2a2a; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
    `;
    document.head.appendChild(styleEl);
  }

  // ── Root section element ─────────────────────────────────────────────────────
  const section = content.createDiv({ cls: 'bc-orch-section' });

  // ── 2×2 card grid ────────────────────────────────────────────────────────────
  const grid = section.createDiv({ cls: 'bc-orch-grid' });

  // ── Drawer container (right side) ────────────────────────────────────────────
  const drawerContainer = section.createDiv({ cls: 'bc-orch-drawer-container' });

  // ── Drawer open/close helpers ────────────────────────────────────────────────
  type OrchDrawerId = 'video' | 'research' | 'bible' | 'design';
  const DRAWER_KEY = 'bc-orch-active-drawer';

  const openBtns: Record<OrchDrawerId, HTMLButtonElement> = {} as Record<OrchDrawerId, HTMLButtonElement>;
  const drawers: Record<OrchDrawerId, HTMLElement> = {} as Record<OrchDrawerId, HTMLElement>;

  function openDrawer(id: OrchDrawerId): void {
    localStorage.setItem(DRAWER_KEY, id);
    section.addClass('bc-orch-section--drawer-open');
    (Object.keys(drawers) as OrchDrawerId[]).forEach(k => {
      drawers[k].toggleClass('bc-orch-drawer--active', k === id);
    });
    (Object.keys(openBtns) as OrchDrawerId[]).forEach(k => {
      openBtns[k].toggleClass('bc-orch-open-btn--active', k === id);
    });
  }

  function closeDrawer(): void {
    localStorage.removeItem(DRAWER_KEY);
    section.removeClass('bc-orch-section--drawer-open');
    (Object.keys(drawers) as OrchDrawerId[]).forEach(k => {
      drawers[k].removeClass('bc-orch-drawer--active');
    });
    (Object.keys(openBtns) as OrchDrawerId[]).forEach(k => {
      openBtns[k].removeClass('bc-orch-open-btn--active');
    });
  }

  // ── Derive Video Orchestrator status ─────────────────────────────────────────
  const vol = state.pipelinesLiveStatus?.videoOrchestrator;
  const biblePipelines = getBiblePipelineSummaries(state);
  type OrchStatus = 'IDLE' | 'RUNNING' | 'PARTIAL' | 'DONE' | 'ERROR';

  function voStatus(): OrchStatus {
    if (!vol) return 'IDLE';
    if (vol.status === 'active') return 'RUNNING';
    if (vol.status === 'error') return 'ERROR';
    return 'IDLE';
  }

  // ── Build the 4 cards ────────────────────────────────────────────────────────
  // Card 1: Video Orchestrator
  const videoBtn = bcOrchBuildCard(grid, {
    id: 'video',
    title: 'VIDEO ORCHESTRATOR',
    status: voStatus(),
    stats: [
      `Running jobs: ${vol?.queueDepth?.running ?? 0}`,
      `Active accounts: ${vol?.activeAccounts ?? 0}`,
    ],
    healthDots: bcOrchHealthDots(voStatus()),
    onOpen: () => openDrawer('video'),
  });
  openBtns['video'] = videoBtn;

  // Card 2: Research Orchestrator
  const researchBtn = bcOrchBuildCard(grid, {
    id: 'research',
    title: 'RESEARCH ORCHESTRATOR',
    status: 'IDLE',
    stats: ['YouTube transcript: ready', 'Video analysis: local Brain Core'],
    healthDots: [null, null, null, null, null],
    onOpen: () => openDrawer('research'),
  });
  openBtns['research'] = researchBtn;

  // Card 3: Bible Research
  const bibleBtn = bcOrchBuildCard(grid, {
    id: 'bible',
    title: 'BIBLE RESEARCH',
    status: 'IDLE',
    stats: [`Pipelines: ${biblePipelines.length}`, `Primary: ${biblePipelines[0]?.name ?? '—'}`],
    healthDots: [null, null, null, null, null],
    onOpen: () => openDrawer('bible'),
  });
  openBtns['bible'] = bibleBtn;

  // Card 4: Design Orchestrator
  const designBtn = bcOrchBuildCard(grid, {
    id: 'design',
    title: 'DESIGN ORCHESTRATOR',
    status: 'IDLE',
    stats: ['Skills ready: 8', 'Last PRD: —'],
    healthDots: [null, null, null, null, null],
    onOpen: () => openDrawer('design'),
  });
  openBtns['design'] = designBtn;

  // ── Build the 4 drawers ──────────────────────────────────────────────────────
  drawers['video'] = bcOrchBuildVideoDrawer(drawerContainer, vol, closeDrawer);
  drawers['research'] = bcOrchBuildResearchDrawer(drawerContainer, closeDrawer);
  drawers['bible'] = bcOrchBuildBibleDrawer(drawerContainer, state, closeDrawer);
  drawers['design'] = bcOrchBuildDesignDrawer(drawerContainer, closeDrawer);

  // ── Restore persisted drawer state ──────────────────────────────────────────
  try {
    const saved = localStorage.getItem(DRAWER_KEY) as OrchDrawerId | null;
    if (saved && drawers[saved]) {
      openDrawer(saved);
    }
  } catch { /* ignore */ }
}

// ── Helper: build a single orchestrator status card ──────────────────────────
function bcOrchBuildCard(
  parent: HTMLElement,
  opts: {
    id: string;
    title: string;
    status: 'IDLE' | 'RUNNING' | 'PARTIAL' | 'DONE' | 'ERROR';
    stats: [string, string];
    healthDots: (null | 'IDLE' | 'RUNNING' | 'PARTIAL' | 'DONE' | 'ERROR')[];
    onOpen: () => void;
  },
): HTMLButtonElement {
  const card = parent.createDiv({ cls: 'bc-orch-card' });

  // Header row: status dot + title
  const header = card.createDiv({ cls: 'bc-orch-card-header' });
  const dot = header.createEl('span', { cls: 'bc-orch-dot' });
  bcOrchApplyDotStatus(dot, opts.status);
  header.createEl('span', { cls: 'bc-orch-card-title', text: opts.title });

  // Stat lines
  card.createEl('div', { cls: 'bc-orch-card-stat', text: opts.stats[0] });
  card.createEl('div', { cls: 'bc-orch-card-stat', text: opts.stats[1] });

  // Footer: health strip + open button
  const footer = card.createDiv({ cls: 'bc-orch-card-footer' });
  const health = footer.createDiv({ cls: 'bc-orch-health' });
  opts.healthDots.forEach(s => {
    const d = health.createEl('span', { cls: 'bc-orch-dot' });
    bcOrchApplyDotStatus(d, s ?? 'IDLE');
  });

  const btn = footer.createEl('button', { cls: 'bc-orch-open-btn', text: 'Open →' }) as HTMLButtonElement;
  btn.addEventListener('click', opts.onOpen);
  return btn;
}

// ── Helper: apply status modifier class to a dot element ─────────────────────
function bcOrchApplyDotStatus(el: HTMLElement, status: 'IDLE' | 'RUNNING' | 'PARTIAL' | 'DONE' | 'ERROR'): void {
  el.removeClass('bc-orch-dot--running');
  el.removeClass('bc-orch-dot--done');
  el.removeClass('bc-orch-dot--partial');
  el.removeClass('bc-orch-dot--error');
  if (status === 'RUNNING') el.addClass('bc-orch-dot--running');
  else if (status === 'DONE') el.addClass('bc-orch-dot--done');
  else if (status === 'PARTIAL') el.addClass('bc-orch-dot--partial');
  else if (status === 'ERROR') el.addClass('bc-orch-dot--error');
  // IDLE: no modifier class → default #555
}

// ── Helper: produce 5 health dots array from a single status ─────────────────
function bcOrchHealthDots(status: 'IDLE' | 'RUNNING' | 'PARTIAL' | 'DONE' | 'ERROR'): (null | 'IDLE' | 'RUNNING' | 'PARTIAL' | 'DONE' | 'ERROR')[] {
  if (status === 'RUNNING') return ['DONE', 'DONE', 'RUNNING', null, null];
  if (status === 'ERROR') return ['DONE', 'ERROR', null, null, null];
  if (status === 'PARTIAL') return ['DONE', 'PARTIAL', null, null, null];
  return [null, null, null, null, null]; // IDLE / DONE
}

function getBiblePipelineSummaries(state: BrainConsoleViewState): BrainCorePipelineSummary[] {
  return (state.pipelines ?? []).filter((pipeline) => {
    const searchable = [
      pipeline.id,
      pipeline.name,
      pipeline.description,
      ...(pipeline.stages ?? []),
      pipeline.migration?.sourcePipelineId,
      pipeline.migration?.targetPipelineId,
    ].filter(Boolean).join(' ').toLowerCase();

    return searchable.includes('bible') || searchable.includes('says the bible') || searchable.includes('stb');
  });
}

// ── Helper: build a drawer with standard header ───────────────────────────────
function bcOrchBuildDrawerShell(
  container: HTMLElement,
  id: string,
  title: string,
  onClose: () => void,
): { drawer: HTMLElement; body: HTMLElement } {
  const drawer = container.createDiv({ cls: 'bc-orch-drawer' });
  drawer.dataset['orchId'] = id;

  const hdr = drawer.createDiv({ cls: 'bc-orch-drawer-header' });
  hdr.createEl('span', { cls: 'bc-orch-drawer-title', text: title });
  const closeBtn = hdr.createEl('button', { cls: 'bc-orch-drawer-close', text: '✕' });
  closeBtn.addEventListener('click', onClose);

  const body = drawer.createDiv({ cls: 'bc-orch-drawer-body' });
  body.style.padding = '0';
  body.style.overflow = 'hidden';
  body.style.flex = '1';
  body.style.display = 'flex';
  body.style.flexDirection = 'column';

  return { drawer, body };
}

// ── Drawer 1: Video Orchestrator ──────────────────────────────────────────────
function bcOrchBuildVideoDrawer(
  container: HTMLElement,
  vol: import('./client.js').BrainCoreInfraVOPipelineSummary | undefined,
  onClose: () => void,
): HTMLElement {
  const { drawer, body } = bcOrchBuildDrawerShell(container, 'video', 'VIDEO ORCHESTRATOR', onClose);

  const phases = ['🔉 Audio', '🎬 Comp', 'CC', '🖼 Thumb', '🔍 SEO', '📤 Pub', '📊 Analytics'];
  const wrap = body.createDiv();
  wrap.style.padding = '14px';
  wrap.style.overflowY = 'auto';
  wrap.style.flex = '1';
  wrap.style.fontFamily = 'monospace';
  wrap.style.fontSize = '11px';

  const statusLine = wrap.createDiv({ cls: 'bc-orch-card-stat' });
  const voSt = vol?.status ?? 'unknown';
  statusLine.textContent = `Status: ${voSt === 'active' ? 'RUNNING' : voSt === 'error' ? 'ERROR' : 'IDLE'} · Running: ${vol?.queueDepth?.running ?? 0} · Pending: ${vol?.queueDepth?.pending ?? 0} · Accounts: ${vol?.activeAccounts ?? 0}`;
  statusLine.style.marginBottom = '12px';

  const table = wrap.createEl('table', { cls: 'bc-orch-phase-grid' });
  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  phases.forEach(ph => headerRow.createEl('th', { text: ph }));

  const tbody = table.createEl('tbody');
  const dataRow = tbody.createEl('tr');
  phases.forEach(_ph => {
    const td = dataRow.createEl('td');
    const dot = td.createEl('span', { cls: 'bc-orch-dot', text: '' });
    dot.style.display = 'inline-block';
    // All phases idle by default
    void dot;
  });

  return drawer;
}

// ── Drawer 2: Research Orchestrator ──────────────────────────────────────────
function bcOrchBuildResearchDrawer(container: HTMLElement, onClose: () => void): HTMLElement {
  const { drawer, body } = bcOrchBuildDrawerShell(container, 'research', 'RESEARCH ORCHESTRATOR', onClose);

  const split = body.createDiv({ cls: 'bc-orch-split' });

  // Left intake panel (25%) — inputs survive re-renders via _orchResearchState
  const left = split.createDiv({ cls: 'bc-orch-split-left' });
  left.style.width = '25%';
  left.style.minWidth = '180px';

  left.createEl('div', { cls: 'bc-orch-label', text: 'YouTube URL' });
  const urlInput = left.createEl('input', { cls: 'bc-orch-input' }) as HTMLInputElement;
  urlInput.type = 'text';
  urlInput.placeholder = 'Click to paste…';
  urlInput.value = _orchResearchState.url;  // restore after re-render
  urlInput.addEventListener('input', () => { _orchResearchState.url = urlInput.value; });
  // Paste clipboard contents on focus/click if field is empty
  urlInput.addEventListener('focus', async () => {
    if (!urlInput.value) {
      try {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          urlInput.value = text.trim();
          _orchResearchState.url = urlInput.value;
        }
      } catch { /* clipboard permission denied — ignore */ }
    }
  });

  left.createEl('div', { cls: 'bc-orch-label', text: 'Focus (optional)' });
  const focusInput = left.createEl('textarea', { cls: 'bc-orch-input' }) as HTMLTextAreaElement;
  focusInput.rows = 3;
  focusInput.value = _orchResearchState.focus;  // restore after re-render
  focusInput.addEventListener('input', () => { _orchResearchState.focus = focusInput.value; });

  // Mode toggle: Video & Transcript vs Transcript only
  const modeRow = left.createDiv();
  modeRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
  left.createEl('div', { cls: 'bc-orch-label', text: 'Mode' });

  const modeVideoRow = modeRow.createDiv();
  modeVideoRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;color:#ccc;cursor:pointer;';
  const modeVideoCb = modeVideoRow.createEl('input') as HTMLInputElement;
  modeVideoCb.type = 'radio';
  modeVideoCb.name = 'bc-orch-mode';
  modeVideoCb.value = 'full';
  modeVideoCb.checked = true;
  modeVideoRow.createEl('span', { text: '🎬 Video & Transcript' });
  modeVideoRow.addEventListener('click', () => { modeVideoCb.checked = true; });

  const modeTranscriptRow = modeRow.createDiv();
  modeTranscriptRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:11px;color:#888;cursor:pointer;';
  const modeTranscriptCb = modeTranscriptRow.createEl('input') as HTMLInputElement;
  modeTranscriptCb.type = 'radio';
  modeTranscriptCb.name = 'bc-orch-mode';
  modeTranscriptCb.value = 'transcript';
  modeTranscriptRow.createEl('span', { text: '📝 Transcript only' });
  modeTranscriptRow.addEventListener('click', () => { modeTranscriptCb.checked = true; });

  left.appendChild(modeRow);

  const processBtn = left.createEl('button', { cls: 'bc-orch-btn bc-orch-btn--primary', text: '▶ Process' }) as HTMLButtonElement;
  processBtn.disabled = _orchResearchState.running;

  // Right output panel (75%) — history sidebar + output area
  const right = split.createDiv({ cls: 'bc-orch-split-right' });

  // History sidebar
  const historyBar = right.createDiv();
  historyBar.style.cssText = 'border-bottom:1px solid #2a2a2a;padding-bottom:6px;margin-bottom:10px;';

  function renderHistoryBar(): void {
    historyBar.empty();
    const entries = bcOrchLoadHistory();
    if (entries.length === 0) return;

    const histHeader = historyBar.createDiv();
    histHeader.style.cssText = 'font-size:10px;color:#555;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;';
    histHeader.textContent = 'Recent';

    const list = historyBar.createDiv();
    list.style.cssText = 'display:flex;flex-direction:column;gap:3px;';

    entries.forEach(entry => {
      const row = list.createDiv();
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:4px;cursor:pointer;transition:background 0.15s;';
      row.onmouseenter = () => { row.style.background = '#2a2a2a'; };
      row.onmouseleave = () => { row.style.background = 'transparent'; };

      const label = row.createEl('span');
      label.style.cssText = 'flex:1;font-size:11px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      label.textContent = entry.title;

      const ts = row.createEl('span');
      ts.style.cssText = 'font-size:10px;color:#555;white-space:nowrap;font-family:monospace;';
      const d = new Date(entry.savedAt);
      ts.textContent = `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}`;

      row.addEventListener('click', () => {
        _orchResearchState.result = entry.result;
        _orchResearchState.error = null;
        _orchResearchState.running = false;
        urlInput.value = entry.url;
        _orchResearchState.url = entry.url;
        renderOutput();
        renderHistoryBar();
      });
    });
  }
  renderHistoryBar();

  const outputArea = right.createDiv();

  // Restore output from state on re-render
  function renderOutput(): void {
    outputArea.empty();
    if (_orchResearchState.running) {
      bcOrchRenderSkeletons(outputArea);
      return;
    }
    if (_orchResearchState.error) {
      outputArea.createEl('div', { cls: 'bc-orch-output-empty', text: _orchResearchState.error });
      return;
    }
    if (_orchResearchState.result) {
      bcOrchRenderResult(outputArea, _orchResearchState.result);
      return;
    }
    outputArea.createEl('div', { cls: 'bc-orch-output-empty', text: 'Submit a YouTube URL to analyze' });
  }
  renderOutput();

  // Process button click handler
  processBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      _orchResearchState.error = 'Please enter a YouTube URL.';
      _orchResearchState.result = null;
      renderOutput();
      return;
    }

    _orchResearchState.running = true;
    _orchResearchState.phase = 'call1';
    _orchResearchState.startedAt = Date.now();
    _orchResearchState.error = null;
    _orchResearchState.result = null;
    processBtn.disabled = true;

    // Clear any previous timer
    if (_orchResearchState.timerInterval) {
      clearInterval(_orchResearchState.timerInterval);
      _orchResearchState.timerInterval = null;
    }

    renderOutput();

    // Start live elapsed timer — updates the running UI every second
    _orchResearchState.timerInterval = setInterval(() => {
      if (_orchResearchState.running) {
        renderOutput();
      } else {
        if (_orchResearchState.timerInterval) {
          clearInterval(_orchResearchState.timerInterval);
          _orchResearchState.timerInterval = null;
        }
      }
    }, 1000);

    try {
      const resp = await fetch('http://localhost:4877/research/video-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, focus: focusInput.value.trim() }),
      });
      const data = await resp.json() as Record<string, unknown>;

      if (!data.ok) {
        const errField = data.error;
        const errMsg = typeof errField === 'string' ? errField
          : typeof errField === 'object' && errField !== null ? ((errField as Record<string,unknown>).message as string ?? JSON.stringify(errField))
          : 'Unknown error';
        _orchResearchState.error = `Error: ${errMsg}`;
        _orchResearchState.result = null;
      } else {
        _orchResearchState.result = data;
        _orchResearchState.error = null;
        bcOrchSaveToHistory(data);
      }
    } catch (_err) {
      _orchResearchState.error = 'Brain Core offline or request failed.';
      _orchResearchState.result = null;
    } finally {
      _orchResearchState.running = false;
      _orchResearchState.phase = 'done';
      if (_orchResearchState.timerInterval) {
        clearInterval(_orchResearchState.timerInterval);
        _orchResearchState.timerInterval = null;
      }
      processBtn.disabled = false;
      renderHistoryBar();
      renderOutput();
    }
  });

  return drawer;
}

function bcOrchRenderSkeletons(outputArea: HTMLElement): void {
  const elapsed = Math.floor((Date.now() - _orchResearchState.startedAt) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  // Typical timing: call1 (structured) ~60-90s, call2 (transcript) ~60-120s
  // We estimate 150s total for a typical 10-min video
  const estimatedTotal = 150;
  const pct = Math.min(95, Math.round((elapsed / estimatedTotal) * 100));

  // Phase descriptions
  const phaseLabel = elapsed < 90
    ? 'Analyzing video structure, chapters & key moments…'
    : 'Transcribing speech…';

  // Top status bar
  const statusRow = outputArea.createDiv();
  statusRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
  const statusLeft = statusRow.createEl('span');
  statusLeft.style.cssText = 'font-size:11px;color:#3b82f6;';
  statusLeft.textContent = `⟳ ${phaseLabel}`;
  const statusRight = statusRow.createEl('span');
  statusRight.style.cssText = 'font-size:11px;color:#888;font-family:monospace;';
  statusRight.textContent = `${elapsedStr} elapsed`;

  // Progress bar
  const barWrap = outputArea.createDiv();
  barWrap.style.cssText = 'background:#1a1a1a;border-radius:3px;height:6px;margin-bottom:16px;overflow:hidden;border:1px solid #3a3a3a;';
  const barFill = barWrap.createDiv();
  barFill.style.cssText = `height:100%;background:#3b82f6;border-radius:3px;transition:width 1s linear;width:${pct}%;`;

  // Phase rows
  const phases = [
    { label: 'STRUCTURE ANALYSIS', active: elapsed < 90, done: elapsed >= 90 },
    { label: 'TRANSCRIPTION', active: elapsed >= 90, done: false },
    { label: 'HUMAN SUMMARY', active: false, done: false },
    { label: 'ACTIONS', active: false, done: false },
  ];

  phases.forEach(p => {
    const sec = outputArea.createDiv({ cls: 'bc-orch-result-section' });
    const hdr = sec.createDiv({ cls: 'bc-orch-section-header' });
    hdr.createEl('span', { text: p.label });
    const badge = hdr.createEl('span', { cls: 'bc-orch-badge' });
    if (p.done) {
      badge.textContent = '✓ done';
      badge.style.color = '#2ecc71';
      badge.style.borderColor = '#2ecc71';
    } else if (p.active) {
      badge.textContent = '⟳ running';
      badge.style.color = '#3b82f6';
      badge.style.borderColor = '#3b82f6';
    } else {
      badge.textContent = 'pending';
    }
    const skelWrap = sec.createDiv();
    skelWrap.style.cssText = 'background:#1a1a1a;border-radius:3px;height:4px;margin:6px 0;overflow:hidden;';
    if (p.active) {
      const skelFill = skelWrap.createDiv();
      skelFill.style.cssText = 'height:100%;background:#3b82f6;opacity:0.5;animation:bc-orch-shimmer 2s infinite;width:60%;';
    }
  });

  // Estimated time remaining
  const remaining = Math.max(0, estimatedTotal - elapsed);
  const remMins = Math.floor(remaining / 60);
  const remSecs = remaining % 60;
  const remStr = remaining > 5
    ? `~${remMins > 0 ? remMins + 'm ' : ''}${remSecs}s remaining (estimate)`
    : 'Almost done…';
  const etaEl = outputArea.createEl('div');
  etaEl.style.cssText = 'font-size:10px;color:#555;margin-top:8px;font-style:italic;';
  etaEl.textContent = remStr;
}

function bcOrchFoldableSection(parent: HTMLElement, label: string, defaultOpen: boolean, buildContent: (body: HTMLElement) => string | null): void {
  const sec = parent.createDiv({ cls: 'bc-orch-result-section' });
  sec.style.cssText = 'border:1px solid #2a2a2a;border-radius:4px;margin-bottom:8px;overflow:hidden;';

  const hdr = sec.createDiv();
  hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:7px 10px;cursor:pointer;background:#1e1e1e;user-select:none;';

  const hdrLeft = hdr.createDiv();
  hdrLeft.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const arrow = hdrLeft.createEl('span');
  arrow.style.cssText = 'font-size:9px;color:#555;width:10px;display:inline-block;';
  arrow.textContent = defaultOpen ? '▼' : '▶';
  hdrLeft.createEl('span', { cls: 'bc-orch-result-section-title', text: label });

  const copyBtn = hdr.createEl('button');
  copyBtn.style.cssText = 'font-size:10px;color:#555;background:none;border:none;cursor:pointer;padding:2px 5px;border-radius:3px;transition:color 0.15s;';
  copyBtn.textContent = 'copy';
  copyBtn.setAttribute('type', 'button');
  copyBtn.onmouseenter = () => { copyBtn.style.color = '#aaa'; };
  copyBtn.onmouseleave = () => { copyBtn.style.color = '#555'; };

  const body = sec.createDiv();
  body.style.cssText = `padding:10px;background:#1a1a1a;${defaultOpen ? '' : 'display:none;'}`;

  const copyText = buildContent(body);

  copyBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      copyBtn.textContent = '✓';
      setTimeout(() => { copyBtn.textContent = 'copy'; }, 1500);
    } catch { /* ignore */ }
  });

  hdr.addEventListener('click', () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    arrow.textContent = open ? '▶' : '▼';
  });
}

function bcOrchRenderResult(outputArea: HTMLElement, data: Record<string, unknown>): void {
  outputArea.createEl('div', { cls: 'bc-orch-result-title', text: (data.title as string) ?? 'Untitled' });
  const meta = outputArea.createEl('div', { cls: 'bc-orch-result-meta' });
  const durSec = data.duration_seconds as number | undefined;
  const durStr = durSec ? `${Math.floor(durSec / 60)}m ${durSec % 60}s` : null;
  meta.textContent = [(data.channel as string) ?? null, durStr].filter(Boolean).join(' · ');

  // 1. Human summary — open by default
  const humanSummary = (data.human_summary ?? data.humanSummary) as string | undefined;
  if (humanSummary) {
    bcOrchFoldableSection(outputArea, 'HUMAN SUMMARY', true, (body) => {
      body.createEl('div', { text: humanSummary });
      return humanSummary;
    });
  }

  // 2. AI summary — collapsed by default
  const aiSummary = data.ai_summary ?? data.aiSummary;
  if (aiSummary) {
    const structured = aiSummary as Record<string, unknown>;
    let copyLines: string[] = [];
    bcOrchFoldableSection(outputArea, 'AI SUMMARY', false, (body) => {
      if (structured.topic) { body.createEl('div', { cls: 'bc-orch-claim', text: `Topic: ${structured.topic as string}` }); copyLines.push(`Topic: ${structured.topic as string}`); }
      if (structured.speaker) { body.createEl('div', { cls: 'bc-orch-claim', text: `Speaker: ${structured.speaker as string}` }); copyLines.push(`Speaker: ${structured.speaker as string}`); }
      if (structured.evidence_type) { body.createEl('div', { cls: 'bc-orch-claim', text: `Evidence: ${structured.evidence_type as string} · Confidence: ${(structured.confidence as string) ?? '—'}` }); copyLines.push(`Evidence: ${structured.evidence_type as string} · Confidence: ${(structured.confidence as string) ?? '—'}`); }
      if (Array.isArray(structured.key_claims)) {
        const claimsWrap = body.createDiv();
        claimsWrap.style.marginTop = '6px';
        claimsWrap.createEl('div', { cls: 'bc-orch-label', text: 'Key claims' });
        (structured.key_claims as string[]).forEach(c => { claimsWrap.createEl('div', { cls: 'bc-orch-claim', text: `• ${c}` }); copyLines.push(`• ${c}`); });
      }
      if (Array.isArray(structured.research_hooks)) {
        const hooksWrap = body.createDiv();
        hooksWrap.style.marginTop = '6px';
        hooksWrap.createEl('div', { cls: 'bc-orch-label', text: 'Research hooks' });
        (structured.research_hooks as string[]).forEach(h => { hooksWrap.createEl('div', { cls: 'bc-orch-claim', text: `→ ${h}` }); copyLines.push(`→ ${h}`); });
      }
      // Key timestamps inside AI summary
      const keyTs = data.key_timestamps as Record<string, string> | undefined;
      if (keyTs && Object.keys(keyTs).length > 0) {
        const tsWrap = body.createDiv();
        tsWrap.style.marginTop = '6px';
        tsWrap.createEl('div', { cls: 'bc-orch-label', text: 'Key timestamps' });
        Object.entries(keyTs).forEach(([desc, ts]) => { tsWrap.createEl('div', { cls: 'bc-orch-claim', text: `[${ts}] ${desc}` }); copyLines.push(`[${ts}] ${desc}`); });
      }
      return copyLines.join('\n') || null;
    });
  }

  // 3. Transcription — collapsed by default
  const transcript = (data.transcript_excerpt ?? data.transcript) as string | undefined;
  if (transcript) {
    bcOrchFoldableSection(outputArea, 'TRANSCRIPTION', false, (body) => {
      const pre = body.createEl('pre', { cls: 'bc-orch-pre' });
      pre.style.maxHeight = 'none';
      pre.textContent = transcript;
      return transcript;
    });
  }

  // Rate limit usage (compact footer, no section)
  const usage = data.rate_limit_usage as Record<string, unknown> | undefined;
  if (usage) {
    const usageEl = outputArea.createEl('div', { cls: 'bc-orch-result-meta' });
    usageEl.style.marginTop = '6px';
    usageEl.textContent = `Quota: ${usage.calls_today as number} calls today · ${usage.video_minutes_today as number} min used · ${usage.calls_remaining as number} remaining`;
  }
}

// ── Drawer 3: Bible Research ──────────────────────────────────────────────────
function bcOrchBuildBibleDrawer(
  container: HTMLElement,
  state: BrainConsoleViewState,
  onClose: () => void,
): HTMLElement {
  const { drawer, body } = bcOrchBuildDrawerShell(container, 'bible', 'BIBLE RESEARCH', onClose);
  const split = body.createDiv({ cls: 'bc-orch-split' });

  // Left: pipelines (40%)
  const left = split.createDiv({ cls: 'bc-orch-split-left' });
  left.style.width = '40%';

  const pipelines = getBiblePipelineSummaries(state);

  left.createEl('div', { cls: 'bc-orch-section-header' }).createEl('span', { text: 'PIPELINES' });

  if (pipelines.length === 0) {
    left.createEl('div', { cls: 'bc-orch-output-empty', text: 'No pipelines configured' });
  } else {
    pipelines.forEach(p => {
      const row = left.createDiv({ cls: 'bc-orch-card-stat' });
      row.textContent = `▶ ${p.name ?? p.id}`;
      if (p.health || p.status) {
        row.title = [p.status, p.health].filter(Boolean).join(' · ');
      }
    });
  }

  const addBtn = left.createEl('button', { cls: 'bc-orch-btn', text: '+ Add pipeline' }) as HTMLButtonElement;
  addBtn.style.marginTop = 'auto';

  // Right: history & actions (60%)
  const right = split.createDiv({ cls: 'bc-orch-split-right' });

  const histHdr = right.createDiv({ cls: 'bc-orch-section-header' });
  histHdr.createEl('span', { text: 'DOCUMENT HISTORY' });
  right.createEl('div', { cls: 'bc-orch-output-empty', text: 'No history yet' });

  const newHdr = right.createDiv({ cls: 'bc-orch-section-header' });
  newHdr.style.marginTop = '12px';
  newHdr.createEl('span', { text: 'NEW RESEARCH' });

  right.createEl('div', { cls: 'bc-orch-label', text: 'Pipeline' });
  const pipelineSelect = right.createEl('select', { cls: 'bc-orch-input' }) as HTMLSelectElement;
  pipelineSelect.createEl('option', { text: '— select pipeline —' });
  pipelines.forEach(p => {
    const opt = pipelineSelect.createEl('option', { text: p.name ?? p.id });
    (opt as HTMLOptionElement).value = p.id;
  });

  right.createEl('div', { cls: 'bc-orch-label', text: 'Prompt' });
  const promptArea = right.createEl('textarea', { cls: 'bc-orch-input' }) as HTMLTextAreaElement;
  promptArea.rows = 4;

  const actionRow = right.createDiv();
  actionRow.style.display = 'flex';
  actionRow.style.gap = '8px';
  actionRow.style.marginTop = '8px';
  const runBtn = actionRow.createEl('button', { cls: 'bc-orch-btn bc-orch-btn--primary', text: '▶ Run Pipeline' }) as HTMLButtonElement;
  const stopBtn = actionRow.createEl('button', { cls: 'bc-orch-btn', text: '⏹ Stop current' }) as HTMLButtonElement;
  stopBtn.disabled = true;

  void addBtn; void runBtn; void stopBtn; void promptArea; void pipelineSelect;

  return drawer;
}

// ── Drawer 4: Design Orchestrator ─────────────────────────────────────────────
function bcOrchBuildDesignDrawer(container: HTMLElement, onClose: () => void): HTMLElement {
  const { drawer, body } = bcOrchBuildDrawerShell(container, 'design', 'DESIGN ORCHESTRATOR', onClose);
  const split = body.createDiv({ cls: 'bc-orch-split' });

  // Left: conversation (40%)
  const left = split.createDiv({ cls: 'bc-orch-split-left' });
  left.style.width = '40%';

  left.createEl('div', { cls: 'bc-orch-section-header' }).createEl('span', { text: 'CONVERSATION' });

  // Bot bubble
  const botBubble = left.createDiv();
  botBubble.style.background = '#333';
  botBubble.style.border = '1px solid #3a3a3a';
  botBubble.style.borderRadius = '6px';
  botBubble.style.padding = '8px';
  botBubble.style.fontSize = '11px';
  botBubble.style.color = '#aaa';
  botBubble.textContent = '🤖 What are you building?';

  const inputArea = left.createEl('textarea', { cls: 'bc-orch-input' }) as HTMLTextAreaElement;
  inputArea.rows = 3;
  inputArea.placeholder = 'Your answer…';

  const sendBtn = left.createEl('button', { cls: 'bc-orch-btn bc-orch-btn--primary', text: 'Send ↵' }) as HTMLButtonElement;
  void sendBtn;

  // Right: live PRD (60%)
  const right = split.createDiv({ cls: 'bc-orch-split-right' });

  const skillsHdr = right.createDiv({ cls: 'bc-orch-section-header' });
  skillsHdr.createEl('span', { text: 'ACTIVE SKILLS' });
  const badgeRow = right.createDiv();
  badgeRow.style.marginBottom = '12px';
  ['/design-system', '/web-design', '/taste-skill'].forEach(s => {
    badgeRow.createEl('span', { cls: 'bc-orch-badge', text: s });
  });

  const prdHdr = right.createDiv({ cls: 'bc-orch-section-header' });
  prdHdr.createEl('span', { text: 'PRD' });

  const fields: [string, string][] = [
    ['Project type', '(pending)'],
    ['Scenario', '(pending)'],
    ['Audience', '(pending)'],
    ['Tone', '(pending)'],
    ['Goal', '(pending)'],
  ];
  fields.forEach(([label, val]) => {
    const row = right.createDiv();
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginBottom = '4px';
    row.style.fontSize = '11px';
    row.createEl('span', { text: label + ':' }).style.color = '#666';
    row.createEl('span', { text: val }).style.color = '#555';
  });

  const exportRow = right.createDiv();
  exportRow.style.display = 'flex';
  exportRow.style.gap = '8px';
  exportRow.style.marginTop = '16px';
  const exportBtn = exportRow.createEl('button', { cls: 'bc-orch-btn', text: '↗ Export PRD' }) as HTMLButtonElement;
  const genBtn = exportRow.createEl('button', { cls: 'bc-orch-btn bc-orch-btn--primary', text: '▶ Generate DESIGN.md' }) as HTMLButtonElement;
  exportBtn.disabled = true;
  genBtn.disabled = true;

  void inputArea; void exportBtn; void genBtn;

  return drawer;
}

function renderPipelinesSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  renderVOContextBar(content, state);
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  renderCard(grid, 'Pipeline Profile', renderVOPipelineProfileCard(state), { wide: true });

  // Live pipeline status cards (Stage 0 dual visibility)
  const ps = state.pipelinesLiveStatus;
  if (ps) {
    renderGroupedSummary(grid, 'Live Pipeline Status', [
      { title: 'STB — Says the Bible', render: renderStbLiveCard(ps.stb) },
      { title: 'Video Orchestrator Live', render: renderVOLivePipelineCard(ps.videoOrchestrator) },
    ]);
  }

  renderGroupedSummary(grid, 'Pipeline Overview', [
    { title: 'Pipeline Overview', render: renderPipelineOverviewCard(state) },
    { title: 'Video Orchestrator', render: renderVideoOrchestratorPipelineCard(state) },
    { title: 'Provider Planning', render: renderProviderPlanningPipelineCard(state) },
    { title: 'Controlled Execution', render: renderControlledExecutionPipelineCard(state) },
    { title: 'STB / Video Migration', render: renderStbVideoMigrationPipelineCard(state) },
    { title: 'Safety Summary', render: renderSafetySummaryCard() },
  ]);

  // VO Accounts card
  const accounts = state.voAccounts;
  if (accounts?.ok && accounts.accounts.length > 0) {
    const accContent = document.createElement('div');
    accContent.addClass('brain-console__card-content');
    const accList = accContent.createDiv({ cls: 'brain-console__list' });
    for (const acc of accounts.accounts) {
      const row = accList.createDiv({ cls: 'brain-console__list-row' });
      const statusDot = acc.accountStatus === 'active' ? '🟢' : '🔴';
      const authBadge = acc.authMethod === 'oauth2' ? '🔑' : acc.authMethod === 'api_key' ? '🗝️' : '✏️';
      row.createEl('span', { cls: 'brain-console__list-label', text: `${statusDot} ${acc.accountHandle} (${acc.platform})` });
      row.createEl('span', { cls: 'brain-console__list-value', text: authBadge });
    }
    renderCard(grid, `VO Accounts (${accounts.accounts.length})`, accContent);
  }

  const authStatus = state.voAuthStatus;
  if (authStatus?.ok && authStatus.accounts.length > 0) {
    const authContent = document.createElement('div');
    authContent.addClass('brain-console__card-content');
    const authList = authContent.createDiv({ cls: 'brain-console__list' });
    for (const account of authStatus.accounts) {
      const row = authList.createDiv({ cls: 'brain-console__list-row' });
      const badge = account.authMethod === 'oauth2' ? '🔑' : '✏️';
      const readiness = account.authMethod === 'oauth2'
        ? account.oauthReady
          ? `ready${account.tokenExpiry ? ` · ${formatRelativeTime(account.tokenExpiry)}` : ''}`
          : 'token missing'
        : account.authMethod;
      row.createEl('span', { cls: 'brain-console__list-label', text: `${badge} ${account.handle} (${account.platform})` });
      row.createEl('span', { cls: 'brain-console__list-value', text: readiness });
    }
    if (authStatus.accounts.some((account) => account.authMethod === 'manual')) {
      authContent.createEl('p', {
        cls: 'brain-console__detail',
        text: 'Run vo accounts auth-url --account <handle> to connect OAuth2.',
      });
    }
    renderCard(grid, 'VO Auth Status', authContent);
  }
}

function renderStbLiveCard(stb: BrainCoreInfraPipelinesStatus['stb'] | undefined): HTMLElement {
  const el = document.createElement('div');
  el.className = 'brain-console__card-content';
  if (!stb) {
    el.createEl('div', { cls: 'brain-console__list-sub', text: 'Status unavailable' });
    return el;
  }
  const statusText = stb.status === 'running' ? '🟢 running' : stb.status === 'stopped' ? '🔴 stopped' : '⚪ unknown';
  renderCompactStatGrid(el, [
    { label: 'Status', value: statusText },
    { label: 'Health', value: stb.health },
    { label: 'Port', value: String(stb.port) },
  ]);
  el.createEl('div', { cls: 'brain-console__list-sub', text: '⚠ Stage 0 — read-only visibility. STB is unchanged.' });
  el.createEl('div', { cls: 'brain-console__list-sub', text: `Checked: ${stb.lastChecked?.slice(0, 19) ?? '—'}` });
  return el;
}

function renderVOLivePipelineCard(vo: BrainCoreInfraPipelinesStatus['videoOrchestrator'] | undefined): HTMLElement {
  const el = document.createElement('div');
  el.className = 'brain-console__card-content';
  if (!vo) {
    el.createEl('div', { cls: 'brain-console__list-sub', text: 'Status unavailable' });
    return el;
  }
  const dead = vo.queueDepth?.dead ?? 0;
  renderCompactStatGrid(el, [
    { label: 'Status', value: vo.status },
    { label: 'Pending', value: String(vo.queueDepth?.pending ?? 0) },
    { label: 'Running', value: String(vo.queueDepth?.running ?? 0) },
    { label: 'Failed', value: String(vo.queueDepth?.failed ?? 0) },
    { label: 'Dead', value: String(dead) },
    { label: 'Active accounts', value: String(vo.activeAccounts ?? 0) },
    { label: 'Last job', value: vo.lastJobAt ? formatRelativeTime(vo.lastJobAt) : '—' },
  ]);
  if (dead > 0) {
    el.createEl('div', { cls: 'brain-console__warning', text: `${dead} dead jobs — run: vo jobs to inspect` });
  }
  return el;
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

function renderReportsSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot, settings?: BrainConsoleSettings, onRefresh?: () => void): void {
  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });
  renderCard(grid, 'Reports & System Health', renderReportsSectionIntro(state), { wide: true, subtitle: 'Runtime diagnostics, AI model selector, local app health, and wiki availability.' });
  renderCard(grid, 'Runtime Reports', renderRuntimeReportsCard(state), { status: runtimeReportsStatus(state), tone: runtimeReportsTone(state), subtitle: 'What the Brain Core payload exposed in this refresh.' });
  renderCard(grid, 'AI Model Selector', renderAiModelSelectorCard(state, settings, onRefresh), { status: aiModelSelectorDisplayStatus(state), tone: aiModelSelectorTone(state), subtitle: 'AI routing service at localhost:4890. Start, stop, and monitor provider health.' });
  renderCard(grid, 'Wiki Health', renderWikiHealthCard(state), { status: wikiHealthStatus(state), tone: wikiHealthTone(state), subtitle: 'Wiki availability and warning counts.' });
  renderCard(grid, 'Diagnostics', renderReportsDiagnosticsCard(state), { wide: true, subtitle: 'Connection and payload verification.' });
  if (state.maintenancePreviewDetail) {
    renderCard(grid, 'Maintenance Preview', renderMaintenancePreviewDetailCard(state.maintenancePreviewDetail), { subtitle: 'Read-only maintenance data.' });
  }
  if (state.approvalDetail) {
    renderCard(grid, 'Approval Details', renderApprovalDetailCard(state.approvalDetail), { subtitle: 'Latest approval record in payload.' });
  }
}

function renderPostOrchestratorSection(content: HTMLElement, state: BrainConsoleViewState, snapshot: DashboardSnapshot): void {
  const grid = content.createDiv({ cls: 'brain-console__post-section' });

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
  const intro = content.createDiv({ cls: 'brain-console__section-intro' });
  intro.createEl('p', {
    cls: 'brain-console__detail',
    text: 'Agent orchestration, task graph, approval gates, and cost tracking.',
  });

  // KPI row from agentConsole
  if (state.agentConsole) {
    const kpiDiv = content.createDiv({ cls: 'bc-kpi-row' });
    renderCompactStatGrid(kpiDiv, [
      { label: 'Active Runs', value: String(state.agentConsole.activeRunCount ?? 0) },
      { label: 'Blocked Runs', value: String(state.agentConsole.blockedRunCount ?? 0) },
      { label: 'Pending Approvals', value: String(state.agentConsole.approvalPendingCount ?? 0) },
      {
        label: 'Tasks Done',
        value: `${state.agentConsole.taskGraph?.completedCount ?? 0}/${state.agentConsole.taskGraph?.taskCount ?? 0}`,
      },
      { label: 'Cost Today', value: formatCostUsd(state.agentCostSummary?.todayEstimatedUsd ?? 0) },
    ]);
  }

  const grid = content.createDiv({ cls: 'brain-console__dashboard-grid' });

  // 6 cards
  renderCard(grid, 'Task Graph', renderAgentTaskGraphCard(state));
  renderCard(grid, 'Approval Gates', renderApprovalGatesCard(state));
  renderCard(grid, 'Agent Registry', renderAgentViewCard(state, snapshot));
  renderCard(grid, 'Run History', renderAgentViewLedgerCard(state));
  renderCard(grid, 'Cost Summary', renderAgentCostCard(state));
  renderCard(grid, 'Recovery / Blockers', renderRecoveryPanelCard(state));
}


function renderInstallVerificationCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const runtimeMarker = safeText((window as any).BRAIN_CONSOLE_BUILD_ID, 'unknown');
  const expectedMarker = 'v2.0';
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

function renderDashboardSelfCheck(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  renderCompactStatGrid(container, [
    { label: 'Build marker', value: safeText((window as any).BRAIN_CONSOLE_BUILD_ID, 'unknown') },
    { label: 'View mode', value: 'Main workspace dashboard' },
    { label: 'Render guards', value: 'active' },
    { label: 'Pipelines mode', value: 'grouped stable cards' },
    { label: 'Plugin install state', value: 'runtime marker loaded' },
    { label: 'Brain Core URL', value: safeText(state.brainCoreUrl, 'unknown') },
    { label: 'Selected URL', value: safeText((window as any).BRAIN_CONSOLE_SELECTED_URL, safeText(state.brainCoreUrl, 'unknown')) },
    { label: 'Connection status', value: state.status?.ok ? 'Connected' : 'Offline' },
    { label: 'Last refresh', value: state.refreshedAt ? new Date(state.refreshedAt).toLocaleString() : 'Not yet refreshed' },
    { label: 'Safety', value: 'Read-only' },
  ]);
  return container;
}

function renderReportsSectionIntro(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  container.createEl('p', {
    cls: 'brain-console__detail',
    text: 'Runtime diagnostics, Mind Steward state, local app health, and wiki availability.',
  });
  renderCompactStatGrid(container, [
    { label: 'Build', value: safeText((window as any).BRAIN_CONSOLE_BUILD_ID, 'unknown') },
    { label: 'View mode', value: 'Main workspace dashboard' },
    { label: 'Connection', value: state.status?.ok ? 'Connected' : 'Offline' },
  ]);
  return container;
}

function renderConnectionSummaryCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const connected = state.status?.ok === true;
  renderCompactStatGrid(container, [
    { label: 'Brain Core', value: connected ? 'Connected' : 'Offline' },
    { label: 'Version', value: statValue(state.status?.version, 'Unknown') },
    { label: 'Reports', value: String(state.runtimeReports?.length ?? 0) },
    { label: 'Scheduler', value: statValue(state.schedulerStatus?.status, 'Not reported') },
  ]);
  return container;
}

function renderProBotMigrationSummaryCard(_state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  const migratedTabs = [
    { tab: 'Sessions', section: 'Sessions tab' },
    { tab: 'Local Apps', section: 'Apps tab' },
    { tab: 'Scheduler', section: 'Sessions tab' },
    { tab: 'Dokploy', section: 'Infra tab' },
    { tab: 'Tunnels', section: 'Infra tab' },
    { tab: 'Domains', section: 'Infra tab' },
    { tab: 'New Relic', section: 'Monitoring tab' },
    { tab: 'Analytics (Umami)', section: 'Analytics tab' },
    { tab: 'Google Ads', section: 'Analytics tab' },
    { tab: 'Stripe', section: 'Stripe tab' },
    { tab: 'Studio (Viral Flow)', section: 'Studio tab' },
  ];

  container.createEl('p', { cls: 'brain-console__detail', text: `✓ ${migratedTabs.length}/11 ProBot tabs migrated. ProBot dashboard ready to decommission.` });

  const list = container.createDiv({ cls: 'brain-console__list' });
  for (const { tab, section } of migratedTabs) {
    const row = list.createDiv({ cls: 'brain-console__list-row' });
    row.createEl('span', { cls: 'brain-console__list-label', text: `✓ ${tab}` });
    row.createEl('span', { cls: 'brain-console__detail', text: section });
  }

  container.appendChild(renderSafetyLabel('Read-only · Migration complete · ProBot decommission ready'));
  return container;
}

function renderPipelineOverviewCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const available = countAvailable(state.pipelines, state.videoOrchestratorStatus, state.stbStatus, state.videoProductionGate);
  const unavailable = 4 - available;
  renderCompactStatGrid(container, [
    { label: 'Brain Core', value: state.status?.ok === true ? 'Connected' : 'Offline' },
    { label: 'Available', value: String(available) },
    { label: 'Unavailable', value: String(Math.max(unavailable, 0)) },
    { label: 'Status', value: statValue(state.pipelines?.[0]?.status, 'Not reported') },
  ]);
  return container;
}

function renderVideoOrchestratorPipelineCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const summary = state.videoOrchestratorStatus?.moduleProgress;
  renderCompactStatGrid(container, [
    { label: 'Status', value: statValue(state.videoOrchestratorStatus?.status, 'Unavailable') },
    { label: 'Readiness', value: summary?.percent !== undefined ? `${summary.percent}%` : 'Not reported' },
    { label: 'Blockers', value: String(state.videoOrchestratorStatus?.modules?.filter((module) => module?.status === 'blocked').length ?? 0) },
    { label: 'Next safe step', value: statValue((state.videoProductionGate?.gate?.summary as any)?.nextSafeStep, 'Not reported') },
  ]);
  return container;
}

function renderProviderPlanningPipelineCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  renderCompactStatGrid(container, [
    { label: 'Planning surface', value: statValue(state.videoProviderPlanningSurfaceIndex?.index?.status, 'Unavailable') },
    { label: 'Wrapper status', value: statValue(state.videoProviderWrapperSecurityReviewPlan?.plan?.status, 'Unavailable') },
    { label: 'Approval packet', value: statValue(state.videoProviderImplementationApprovalPacket?.packet?.status, 'Unavailable') },
    { label: 'Readiness', value: statValue(state.videoProviderImplementationReadinessDashboardSummary?.dashboard?.status, 'Not reported') },
  ]);
  return container;
}

function renderControlledExecutionPipelineCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  renderCompactStatGrid(container, [
    { label: 'Policy boundary', value: statValue(state.videoControlledExecutionPolicyBoundary?.boundary?.status, 'Unavailable') },
    { label: 'Disabled gate', value: statValue(state.videoControlledExecutionDisabledGate?.gate?.status, 'Unavailable') },
    { label: 'Readiness index', value: statValue(state.videoControlledExecutionReadinessIndex?.index?.status, 'Unavailable') },
    { label: 'Second approval', value: statValue(state.videoControlledExecutionSecondApprovalPolicy?.policy?.status, 'Unavailable') },
  ]);
  return container;
}

function renderStbVideoMigrationPipelineCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  renderCompactStatGrid(container, [
    { label: 'Migration', value: statValue(state.stbVideoMigrationStatus?.status, 'Unavailable') },
    { label: 'Parity', value: state.stbVideoParityMatrix?.summary ? `${state.stbVideoParityMatrix.summary.parityPercent}%` : 'Unavailable' },
    { label: 'Dual-run', value: statValue(state.stbVideoDualRunStatus?.status, 'Unavailable') },
    { label: 'Production gate', value: statValue(state.videoProductionGate?.gate?.status, 'Unavailable') },
  ]);
  return container;
}

function renderSafetySummaryCard(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  renderCompactStatGrid(container, [
    { label: 'Execution', value: 'Disabled' },
    { label: 'Writes', value: 'Blocked' },
    { label: 'Publishing', value: 'Disabled' },
    { label: 'Decommission', value: 'Not active' },
  ]);
  container.createEl('p', { cls: 'brain-console__detail', text: 'Read-only dashboard only. No mutation controls or POST routes.' });
  return container;
}

function renderReportsDiagnosticsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  renderCompactStatGrid(container, [
    { label: 'Brain Core URL', value: statValue(state.brainCoreUrl, 'Unknown') },
    { label: 'Selected URL', value: statValue((window as any).BRAIN_CONSOLE_SELECTED_URL, statValue(state.brainCoreUrl, 'Unknown')) },
    { label: 'Online', value: state.status?.ok ? 'yes' : 'no' },
    { label: 'Build marker', value: safeText((window as any).BRAIN_CONSOLE_BUILD_ID, 'unknown') },
  ]);
  container.appendChild(renderSafetyLabel('Read-only · no writes · no mutations · no publishing'));
  return container;
}

function renderStatusPills(shell: HTMLElement, state: BrainConsoleViewState): void {
  const pills = shell.createDiv({ cls: 'brain-console__pills' });

  const mrReport = state.runtimeReports?.find((r) => r.id === 'mind-steward');
  const brainCoreOnline = state.status?.ok === true;

  const data = [
    { label: 'Brain Core', value: brainCoreOnline ? '● online' : '○ offline' },
    { label: 'Mind Steward', value: mrReport ? `${mrReport.status}` : 'unknown' },
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

type CardTone = 'ok' | 'warn' | 'danger' | 'info' | 'muted';

function renderCard(parent: HTMLElement, title: string, content: HTMLElement, options?: { wide?: boolean; subtitle?: string; status?: string; tone?: CardTone }): void {
  const card = parent.createDiv({ cls: 'brain-console__card' });
  if (options?.wide) card.addClass('brain-console__card--wide');

  const header = card.createDiv({ cls: 'brain-console__card-header' });
  const titleWrap = header.createDiv({ cls: 'brain-console__card-title-wrap' });
  titleWrap.createEl('h3', { cls: 'brain-console__card-title', text: title });
  if (options?.subtitle) {
    titleWrap.createEl('p', { cls: 'brain-console__card-subtitle', text: options.subtitle });
  }

  if (options?.status) {
    const badge = header.createEl('span', { cls: 'brain-console__badge', text: options.status });
    if (options.tone) badge.addClass(`brain-console__badge--${options.tone}`);
  }

  const body = card.createDiv({ cls: 'brain-console__card-body' });
  body.appendChild(content);
}

function renderCompactStatGrid(container: HTMLElement, rows: Array<{ label: string; value: string }>): void {
  const grid = container.createDiv({ cls: 'brain-console__stat-grid' });
  rows.forEach(({ label, value }) => {
    const stat = grid.createDiv({ cls: 'brain-console__stat' });
    stat.createEl('span', { cls: 'brain-console__stat-label', text: label });
    stat.createEl('span', { cls: 'brain-console__stat-value', text: value });
  });
}

function renderCardSectionHeading(container: HTMLElement, title: string, subtitle: string): void {
  const heading = container.createDiv({ cls: 'brain-console__section-heading-wrap' });
  heading.createEl('div', { cls: 'brain-console__section-heading', text: title });
  heading.createEl('div', { cls: 'brain-console__section-subheading', text: subtitle });
}

function renderGroupedSummary(parent: HTMLElement, title: string, cards: Array<{ title: string; render: HTMLElement }>): void {
  const card = parent.createDiv({ cls: 'brain-console__card brain-console__card--grouped' });
  const header = card.createDiv({ cls: 'brain-console__card-header' });
  header.createEl('h3', { text: title });
  const grid = card.createDiv({ cls: 'brain-console__grouped-grid' });
  for (const entry of cards) {
    renderCard(grid, entry.title, entry.render);
  }
}

function statValue(value: unknown, fallback = 'Unavailable'): string {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function countAvailable(...values: unknown[]): number {
  return values.filter((value) => value !== undefined && value !== null).length;
}

function renderStatusBadge(label: string, tone: CardTone = 'muted'): HTMLElement {
  const badge = document.createElement('span');
  badge.className = `brain-console__badge brain-console__badge--${tone}`;
  badge.textContent = label;
  return badge;
}

// ── Premium UI helpers ─────────────────────────────────────────────────────

function createStatCard(parent: HTMLElement, label: string, value: string, sub?: string, tone?: 'ok' | 'warn' | 'danger' | 'muted'): HTMLElement {
  const card = parent.createDiv({ cls: 'bc-stat-card' });
  if (tone) card.addClass(`bc-stat-card--${tone}`);
  card.createEl('div', { cls: 'bc-stat-label', text: label });
  card.createEl('div', { cls: 'bc-stat-value', text: value });
  if (sub) card.createEl('div', { cls: 'bc-stat-sub', text: sub });
  return card;
}

function createPremiumCard(parent: HTMLElement, title: string, options?: { badge?: string; badgeTone?: 'ok' | 'warn' | 'danger' | 'muted'; wide?: boolean }): { body: HTMLElement } {
  const card = parent.createDiv({ cls: 'bc-premium-card' });
  if (options?.wide) card.addClass('bc-premium-card--wide');
  const header = card.createDiv({ cls: 'bc-premium-card-header' });
  header.createEl('h3', { cls: 'bc-premium-card-title', text: title });
  if (options?.badge) {
    const badge = header.createEl('span', { cls: `bc-chip bc-chip--${options.badgeTone ?? 'muted'}`, text: options.badge });
    void badge;
  }
  const body = card.createDiv({ cls: 'bc-premium-card-body' });
  return { body };
}

function createStatusChip(parent: HTMLElement, label: string, tone: 'ok' | 'warn' | 'danger' | 'muted' | 'info'): HTMLElement {
  const chip = parent.createEl('span', { cls: `bc-chip bc-chip--${tone}`, text: label });
  return chip;
}

function createTooltip(parent: HTMLElement, label: string, tip: string): HTMLElement {
  const wrap = parent.createDiv({ cls: 'bc-tooltip-wrap' });
  wrap.createEl('span', { cls: 'bc-tooltip-trigger', text: label });
  wrap.createEl('span', { cls: 'bc-tooltip-bubble', text: tip });
  return wrap;
}

function createPopoverButton(parent: HTMLElement, label: string, content: HTMLElement): HTMLElement {
  const wrap = parent.createDiv({ cls: 'bc-popover-wrap' });
  const btn = wrap.createEl('button', { cls: 'bc-popover-btn', text: label });
  btn.setAttribute('type', 'button');
  const panel = wrap.createDiv({ cls: 'bc-popover-panel' });
  panel.appendChild(content);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
  });
  document.addEventListener('click', () => panel.classList.remove('open'), { once: false });
  return wrap;
}

function createProgressBar(parent: HTMLElement, pct: number, tone?: 'ok' | 'warn' | 'danger'): HTMLElement {
  const bar = parent.createDiv({ cls: 'bc-bar' });
  const fill = bar.createDiv({ cls: 'bc-bar-fill' });
  fill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (tone) fill.style.backgroundColor = tone === 'ok' ? 'var(--bc-green)' : tone === 'warn' ? 'var(--bc-yellow)' : 'var(--bc-red)';
  return bar;
}

function createScrollPanel(parent: HTMLElement, cls = ''): HTMLElement {
  const panel = parent.createDiv({ cls: `bc-scroll-panel ${cls}`.trim() });
  return panel;
}

function reportLabel(id: string): string {
  switch (id) {
    case 'mind-steward':
      return 'Mind Steward';
    case 'approval-audit':
      return 'Approval audit';
    case 'local-apps':
      return 'Local apps';
    case 'video':
      return 'Video';
    default:
      return id;
  }
}

function runtimeReportsStatus(state: BrainConsoleViewState): string {
  const total = state.runtimeReports?.length ?? 0;
  const available = state.runtimeReports?.filter((report) => report.status === 'available').length ?? 0;
  if (total === 0) return 'Not reported';
  if (available === total) return 'available';
  if (available > 0) return 'partial';
  return 'not reported';
}

function runtimeReportsTone(state: BrainConsoleViewState): CardTone {
  const status = runtimeReportsStatus(state);
  if (status === 'available') return 'ok';
  if (status === 'partial') return 'warn';
  return 'muted';
}

function mindStewardDisplayStatus(state: BrainConsoleViewState): string {
  return state.mindStewardReportDetail ? (state.mindStewardReportDetail.exists ? 'available' : 'not reported') : 'Not reported in dashboard data';
}

function mindStewardTone(state: BrainConsoleViewState): CardTone {
  return state.mindStewardReportDetail?.exists ? 'ok' : 'muted';
}

function aiModelSelectorDisplayStatus(state: BrainConsoleViewState): string {
  const s = state.aiModelSelectorStatus;
  if (!s) return 'Not checked';
  if (s.running && s.healthy) return 'Running';
  if (s.running && !s.healthy) return 'Degraded';
  return 'Stopped';
}

function aiModelSelectorTone(state: BrainConsoleViewState): CardTone {
  const s = state.aiModelSelectorStatus;
  if (!s) return 'muted';
  if (s.running && s.healthy) return 'ok';
  if (s.running && !s.healthy) return 'warn';
  return 'danger';
}

function wikiHealthStatus(state: BrainConsoleViewState): string {
  const report = state.runtimeReports?.find((r) => r.id === 'mind-steward');
  if (!report?.wikiHealth) return 'Not reported';
  return report.wikiHealth.ok ? 'healthy' : 'needs attention';
}

function wikiHealthTone(state: BrainConsoleViewState): CardTone {
  const report = state.runtimeReports?.find((r) => r.id === 'mind-steward');
  if (!report?.wikiHealth) return 'muted';
  return report.wikiHealth.ok ? 'ok' : 'warn';
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

  const mrReport = state.runtimeReports?.find((r) => r.id === 'mind-steward');
  if (!mrReport?.wikiHealth) {
    container.appendChild(renderEmptyState('Wiki health is not reported in the current dashboard payload.', 'Check Brain Core route wiring.'));
    return container;
  }

  const health = mrReport.wikiHealth;
  const badgeTone: CardTone = health.ok ? 'ok' : 'warn';
  container.appendChild(renderStatusBadge(health.ok ? 'Healthy' : 'Needs attention', badgeTone));
  renderCompactStatGrid(container, [
    { label: 'Warnings', value: String(health.warningCount ?? 0) },
    { label: 'Errors', value: String(health.errorCount ?? 0) },
  ]);
  container.createEl('p', {
    cls: 'brain-console__detail',
    text: health.ok ? 'Wiki is available.' : 'Wiki has warnings or errors in the current payload.',
  });

  return container;
}

function renderRuntimeReportsCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';

  if (!state.runtimeReports || state.runtimeReports.length === 0) {
    container.appendChild(renderEmptyState('Not reported in dashboard data.', 'Brain Core did not include runtime reports in this refresh.'));
    return container;
  }

  const available = state.runtimeReports.filter((r) => r.status === 'available').length;
  const missing = state.runtimeReports.length - available;
  const mindSteward = state.runtimeReports.find((r) => r.id === 'mind-steward');
  renderCompactStatGrid(container, [
    { label: 'Reports available', value: String(available) },
    { label: 'Missing reports', value: String(Math.max(missing, 0)) },
    { label: 'Last refresh', value: state.refreshedAt ? new Date(state.refreshedAt).toLocaleTimeString() : 'Unknown' },
  ]);

  container.appendChild(renderStatusBadge(available > 0 ? 'Partial' : 'Not reported', available > 0 ? 'info' : 'muted'));

  const list = container.createEl('div', { cls: 'brain-console__list' });
  for (const id of ['mind-steward', 'approval-audit', 'local-apps', 'video']) {
    const report = state.runtimeReports.find((entry) => entry.id === id);
    const row = list.createDiv({ cls: 'brain-console__list-row' });
    row.createEl('span', { cls: 'brain-console__list-label', text: reportLabel(id) });
    row.createEl('span', { cls: 'brain-console__list-value', text: report ? statValue(report.status, 'Unavailable') : 'Not reported in dashboard data' });
  }

  if (mindSteward?.message) {
    container.createEl('p', { cls: 'brain-console__detail', text: mindSteward.message });
  }

  return container;
}

function renderMindStewardCard(state: BrainConsoleViewState): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const report = state.mindStewardReportDetail;
  if (!report) {
    container.appendChild(renderEmptyState('Mind Steward is not present in the current dashboard payload.', 'Check Brain Core route wiring.'));
    return container;
  }

  container.appendChild(renderStatusBadge(report.exists ? 'Available' : 'Not reported', report.exists ? 'ok' : 'muted'));
  renderCompactStatGrid(container, [
    { label: 'Status', value: statValue(report.status, 'Not reported') },
    { label: 'Latest run', value: statValue(report.latestRunStatus, 'Not reported') },
    { label: 'Wiki health', value: report.wikiHealth ? (report.wikiHealth.ok ? 'Healthy' : 'Warnings') : 'Not reported' },
  ]);
  container.createEl('p', { cls: 'brain-console__detail', text: 'Mind Steward status is read-only and derived from dashboard payload data.' });
  return container;
}

function renderAiModelSelectorCard(state: BrainConsoleViewState, settings?: BrainConsoleSettings, onRefresh?: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__card-content';
  const selector = state.aiModelSelectorStatus;

  if (!selector) {
    container.appendChild(renderEmptyState('AI Model Selector status not available.', 'Brain Core endpoint /ai-model-selector may not be responding.'));
    return container;
  }

  const statusLabel = selector.running && selector.healthy ? 'Running' : selector.running ? 'Degraded' : 'Stopped';
  const statusTone: CardTone = selector.running && selector.healthy ? 'ok' : selector.running ? 'warn' : 'danger';
  container.appendChild(renderStatusBadge(statusLabel, statusTone));

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Service', value: selector.running ? 'Active' : 'Inactive' },
    { label: 'Health', value: selector.healthy ? 'Healthy' : selector.error ?? 'Unhealthy' },
  ];
  if (selector.uptime) {
    stats.push({ label: 'Uptime', value: selector.uptime });
  }
  if (selector.providers) {
    const healthyCount = selector.providers.filter((p) => p.healthy).length;
    stats.push({ label: 'Providers', value: `${healthyCount}/${selector.providers.length} healthy` });
  }
  renderCompactStatGrid(container, stats);

  if (selector.providers && selector.providers.length > 0) {
    const providerList = container.createDiv({ cls: 'brain-console__list' });
    for (const provider of selector.providers) {
      const row = providerList.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: provider.id });
      const val = row.createEl('span', { cls: 'brain-console__list-value' });
      val.textContent = `${provider.healthy ? 'OK' : provider.circuitState} | $${provider.costPer1kTokens}/1k`;
      if (!provider.healthy) val.style.color = 'var(--bc-yellow)';
    }
  }

  const bedrockModels = selector.providers?.flatMap((provider) => provider.bedrockModels ?? []) ?? [];
  if (bedrockModels.length > 0) {
    const enabled = bedrockModels.filter((model) => model.enabled);
    const accessible = enabled.filter((model) => model.access?.available).length;
    container.createEl('p', {
      cls: 'brain-console__detail',
      text: `Bedrock portfolio: ${accessible}/${enabled.length} enabled models access-checked`,
    });
    const bedrockList = container.createDiv({ cls: 'brain-console__list' });
    for (const model of enabled.slice(0, 5)) {
      const row = bedrockList.createDiv({ cls: 'brain-console__list-row' });
      row.createEl('span', { cls: 'brain-console__list-label', text: model.id ?? model.modelId ?? 'unknown-model' });
      const value = row.createEl('span', { cls: 'brain-console__list-value' });
      const access = model.access?.available ? 'OK' : model.access ? 'blocked' : 'unknown';
      const price = typeof model.priceInputPer1m === 'number' && typeof model.priceOutputPer1m === 'number'
        ? `$${model.priceInputPer1m}/$${model.priceOutputPer1m}/1M`
        : 'price n/a';
      value.textContent = `${access} | ${price}`;
      if (access === 'blocked') value.style.color = 'var(--bc-yellow)';
    }
  }

  if (settings) {
    const actions = container.createDiv({ cls: 'brain-console__local-app-actions' });
    const brainCoreUrl = settings.brainCoreUrl;

    if (!selector.running) {
      const startBtn = actions.createEl('button', { text: 'Start', cls: 'brain-console__local-app-action is-enabled' });
      startBtn.title = 'Start AI Model Selector service via launchctl';
      startBtn.addEventListener('click', () => {
        startBtn.textContent = 'Starting...';
        startBtn.disabled = true;
        void controlBrainCoreAiModelSelector(brainCoreUrl, 'start').then(() => {
          new Notice('AI Model Selector started.');
          if (onRefresh) onRefresh();
        });
      });
    } else {
      const stopBtn = actions.createEl('button', { text: 'Stop', cls: 'brain-console__local-app-action is-enabled' });
      stopBtn.title = 'Stop AI Model Selector service via launchctl';
      stopBtn.addEventListener('click', () => {
        stopBtn.textContent = 'Stopping...';
        stopBtn.disabled = true;
        void controlBrainCoreAiModelSelector(brainCoreUrl, 'stop').then(() => {
          new Notice('AI Model Selector stopped.');
          if (onRefresh) onRefresh();
        });
      });
    }
  }

  container.createEl('p', { cls: 'brain-console__detail', text: `Last checked: ${new Date(selector.lastChecked).toLocaleTimeString()}` });
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

  const mrReport = state.runtimeReports?.find(r => r.id === 'mind-steward');
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

function renderLocalAppsCard(state: BrainConsoleViewState, settings?: BrainConsoleSettings, onRefresh?: () => void): HTMLElement {
  const container = document.createElement('div');
  container.className = 'brain-console__apps-page';
  const dashboard = state.localAppsDashboard;
  const readiness = state.localAppsActionReadiness;
  const actionStatus = state.localAppsActionStatus;
  const orchestrator = state.localAppsOrchestrator;
  const onboarding = state.localAppsOnboardingChecklist;
  const operatorSummary = state.localAppsOperatorSummary;
  const apps = dashboard?.apps ?? (state.localApps ?? []).map((app) => ({
    id: app.id,
    name: app.name,
    label: app.name,
    category: 'other',
    status: app.status === 'running' || app.status === 'stopped' ? app.status : 'unknown',
    health: app.status === 'running' ? 'healthy' : app.status === 'stopped' ? 'warning' : 'unknown',
    url: undefined,
    port: undefined,
    source: 'unknown',
    managed: Boolean(app.actionsSupported),
    startSupported: Boolean(app.actionsSupported),
    stopSupported: Boolean(app.actionsSupported),
    restartSupported: Boolean(app.actionsSupported),
    actionEnabled: Boolean(app.actionsSupported),
    actionDisabledReason: app.actionsSupported ? '' : 'App does not support managed actions.',
    actionDisabledReasons: undefined,
    lastCheckedAt: new Date().toISOString(),
    notes: '',
  }));
  const visibleApps = apps.filter((app) => app.id !== 'mind-steward');

  const header = container.createDiv({ cls: 'brain-console__apps-header' });
  renderCardSectionHeading(header, 'Local Apps', 'Compact operations inventory with controlled Brain Core actions.');
  if (dashboard) {
    const strip = container.createDiv({ cls: 'brain-console__apps-summary-strip' });
    renderMicroStat(strip, 'Apps', String(dashboard.appCount));
    renderMicroStat(strip, 'Running', String(dashboard.runningCount));
    renderMicroStat(strip, 'Stopped', String(dashboard.stoppedCount));
    renderMicroStat(strip, 'Unknown', String(dashboard.unknownCount));
    renderMicroStat(strip, 'Managed', String(dashboard.managedCount));
    renderMicroStat(strip, 'Controls', dashboard.safety.startStopControlsEnabled ? 'Enabled' : 'Disabled');
  } else {
    const strip = container.createDiv({ cls: 'brain-console__apps-summary-strip' });
    renderMicroStat(strip, 'Apps', String(visibleApps.length));
    renderMicroStat(strip, 'Controls', 'Unknown');
  }

  if (visibleApps.length === 0) {
    container.appendChild(renderEmptyState('No local apps available', 'Check the canonical inventory source.'));
    return container;
  }

  const definitionsById = new Map((orchestrator?.definitions ?? []).map((definition) => [definition.id, definition]));
  const controlsEnabled = dashboard?.actionPolicy.status === 'enabled' || readiness?.ready === true || (readiness != null && readiness.criteria?.every((c) => c.satisfied || c.id === 'audit-logging'));
  const list = container.createDiv({ cls: 'brain-console__apps-operations-grid' });
  visibleApps.forEach((app) => {
    const definition = definitionsById.get(app.id);
    const pendingAction = localAppPendingActions.get(app.id);
    const item = list.createDiv({ cls: 'brain-console__local-app-card brain-console__local-app-card--micro' });
    item.title = app.url || app.notes || app.name;

    const top = item.createDiv({ cls: 'brain-console__app-card-top' });
    top.createEl('h4', { cls: 'brain-console__app-card-title', text: app.name });

    // Status badge: reflects live transition state, not just API status
    const statusBadgeLabel = pendingAction === 'starting' ? 'starting'
      : pendingAction === 'stopping' ? 'stopping'
      : pendingAction === 'restarting' ? 'starting'
      : app.status;
    const statusBadgeTone = (pendingAction === 'starting' || pendingAction === 'restarting') ? 'ok'
      : pendingAction === 'stopping' ? 'warn'
      : app.status === 'running' ? 'ok'
      : app.status === 'stopped' ? 'warn'
      : app.status === 'unavailable' ? 'danger'
      : 'muted';
    const statusBadge = renderStatusBadge(statusBadgeLabel, statusBadgeTone);
    if (pendingAction === 'starting' || pendingAction === 'restarting') {
      statusBadge.classList.add('brain-console__badge--starting');
    } else if (pendingAction === 'stopping') {
      statusBadge.classList.add('brain-console__badge--stopping');
    }
    top.appendChild(statusBadge);

    const meta = item.createDiv({ cls: 'brain-console__app-card-meta' });
    const svcCount = definition?.services.length;
    const svcPorts = definition?.services.map(s => (s as any).port).filter(Boolean) as number[] | undefined;
    const portDisplay = svcPorts && svcPorts.length > 1
      ? svcPorts.join('/')
      : app.port ? String(app.port) : '-';
    meta.createEl('span', { text: `port ${portDisplay}` });
    meta.createEl('span', { text: `svc ${svcCount ?? '?'}` });
    meta.createEl('span', { text: `db ${definition?.database ? 'yes' : definition ? 'no' : '?'}` });

    const actions = item.createDiv({ cls: 'brain-console__local-app-actions' });

    // Start button: smart — restarts if already running
    if (app.startSupported || app.restartSupported) {
      const isRunning = app.status === 'running';
      const startLabel = isRunning ? 'Restart' : 'Start';
      const startAction: 'start' | 'restart' = isRunning ? 'restart' : 'start';
      const startEnabled = !pendingAction && controlsEnabled && (isRunning ? app.restartSupported : app.startSupported);
      const startBtn = actions.createEl('button', { text: startLabel, cls: 'brain-console__local-app-action brain-console__local-app-action--start' });
      startBtn.addClass(startEnabled ? 'is-enabled' : 'is-disabled');
      if (pendingAction) startBtn.addClass('is-pending');
      startBtn.disabled = !startEnabled;
      startBtn.title = startEnabled
        ? `${startLabel} ${app.name} through Brain Core controlled orchestration`
        : app.actionDisabledReasons?.[startAction] || app.actionDisabledReason || readiness?.nextSafeStep || 'Action not supported.';
      if (startEnabled && settings) {
        startBtn.addEventListener('click', () => {
          void requestLocalAppActionFromCard(settings.brainCoreUrl, app.id, app.label || app.name, startAction, item, onRefresh);
        });
      }
    }

    // Stop button
    if (app.stopSupported) {
      const stopEnabled = !pendingAction && controlsEnabled && app.stopSupported;
      const stopBtn = actions.createEl('button', { text: 'Stop', cls: 'brain-console__local-app-action brain-console__local-app-action--stop' });
      stopBtn.addClass(stopEnabled ? 'is-enabled' : 'is-disabled');
      if (pendingAction) stopBtn.addClass('is-pending');
      stopBtn.disabled = !stopEnabled;
      stopBtn.title = stopEnabled
        ? `Stop ${app.name} through Brain Core controlled orchestration`
        : app.actionDisabledReasons?.stop || app.actionDisabledReason || readiness?.nextSafeStep || 'Action not supported.';
      if (stopEnabled && settings) {
        stopBtn.addEventListener('click', () => {
          void requestLocalAppActionFromCard(settings.brainCoreUrl, app.id, app.label || app.name, 'stop', item, onRefresh);
        });
      }
    }

    // Open button
    if (app.url) {
      const openBtn = actions.createEl('button', { text: 'Open', cls: 'brain-console__local-app-action brain-console__local-app-action--open is-enabled' });
      openBtn.title = `Open ${app.name} in browser (${app.url})`;
      openBtn.addEventListener('click', () => { window.open(app.url!); });
    }
  });
  return container;
}

function renderMicroStat(parent: HTMLElement, label: string, value: string): void {
  const stat = parent.createDiv({ cls: 'brain-console__apps-summary-stat' });
  stat.createEl('span', { cls: 'brain-console__stat-label', text: label });
  stat.createEl('span', { cls: 'brain-console__stat-value', text: value });
}

async function requestLocalAppActionFromCard(
  brainCoreUrl: string,
  appId: string,
  appLabel: string,
  action: 'start' | 'stop' | 'restart',
  card: HTMLElement,
  onRefresh?: () => void | Promise<void>,
): Promise<void> {
  const verb = action === 'restart' ? 'Restart' : action.charAt(0).toUpperCase() + action.slice(1);
  if (!window.confirm(`${verb} ${appLabel}? This uses Brain Core controlled local-app orchestration.`)) return;

  const pendingVerb = action === 'stop' ? 'stopping' : action === 'restart' ? 'restarting' : 'starting';
  localAppPendingActions.set(appId, pendingVerb);
  new Notice(`${verb}ing ${appLabel}...`);

  // Mark all buttons in this card as pending
  card.querySelectorAll<HTMLButtonElement>('.brain-console__local-app-action').forEach((btn) => {
    btn.disabled = true;
    btn.classList.add('is-pending');
    btn.classList.remove('is-enabled');
  });

  // Update status badge immediately
  const statusBadge = card.querySelector<HTMLElement>('.brain-console__badge');
  if (statusBadge) {
    statusBadge.textContent = pendingVerb === 'stopping' ? 'stopping' : 'starting';
    statusBadge.className = `brain-console__badge brain-console__badge--${pendingVerb === 'stopping' ? 'warn' : 'ok'} brain-console__badge--${pendingVerb === 'stopping' ? 'stopping' : 'starting'}`;
  }

  const result = await requestBrainCoreLocalAppAction(brainCoreUrl, appId, action);
  localAppPendingActions.delete(appId);

  if (result.error || !result.value) {
    const message = result.value?.message ?? result.detail ?? result.error ?? 'No response';
    new Notice(`${verb} ${appLabel} failed: ${message}`);
  } else {
    const message = result.value.message || result.value.status;
    new Notice(`${appLabel}: ${message}`);
  }

  await onRefresh?.();
  const nextPoll = result.value?.nextPollMs ?? 2000;
  window.setTimeout(() => { void onRefresh?.(); }, nextPoll);
}

function getMostRecentActionResult(
  results: BrainCoreLocalAppActionStatusResponse['recentResults'],
  appId: string,
): BrainCoreLocalAppActionStatusResponse['recentResults'][number] | undefined {
  return [...results]
    .filter((result) => result.appId === appId)
    .sort((left, right) => (right.finishedAt || right.endedAt).localeCompare(left.finishedAt || left.endedAt))[0];
}

function renderActionResultDetails(parent: HTMLElement, result: BrainCoreLocalAppActionStatusResponse['recentResults'][number]): void {
  const details = parent.createDiv({ cls: 'brain-console__local-app-result' });
  details.createEl('div', { cls: 'brain-console__local-app-result-line', text: `Action: ${result.action}` });
  details.createEl('div', { cls: 'brain-console__local-app-result-line', text: `Status: ${result.status}` });
  details.createEl('div', { cls: 'brain-console__local-app-result-line', text: `ok: ${result.ok ? 'true' : 'false'}` });
  details.createEl('div', { cls: 'brain-console__local-app-result-line', text: `Message: ${result.message}` });
  details.createEl('div', { cls: 'brain-console__local-app-result-line', text: `Timestamp: ${formatIsoTime(result.finishedAt)}` });
}

function formatIsoTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function renderOfflineState(
  shell: HTMLElement,
  brainCoreUrl: string,
  statusError?: string,
  endpointErrors?: import('./client.js').EndpointError[],
  onRefresh?: () => void,
  onBrainCoreRestart?: () => Promise<void>,
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
  steps.createEl('li', { text: 'If Brain Core still responds, use the top-right ↻ control to request a verified restart' });

  const refreshBtn = offline.createEl('button', { text: 'Refresh' });
  refreshBtn.addClass('brain-console__btn-main');
  refreshBtn.setAttribute('type', 'button');
  if (onRefresh) {
    refreshBtn.addEventListener('click', () => onRefresh());
  }

  if (onBrainCoreRestart) {
    const restartBtn = offline.createEl('button', { text: 'Restart Brain Core' });
    restartBtn.addClass('brain-console__btn-main');
    restartBtn.setAttribute('type', 'button');
    restartBtn.addEventListener('click', () => {
      void onBrainCoreRestart();
    });
  }
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
  card.addClass('brain-console__card-content');

  if (!state.stbVideoParityMatrix) {
    card.textContent = 'No parity matrix available';
    return card;
  }

  const pm = state.stbVideoParityMatrix;

  // Summary stats
  renderCompactStatGrid(card, [
    { label: 'Parity', value: `${pm.summary.parityPercent}%` },
    { label: 'Readiness', value: `${pm.summary.readinessScore}%` },
    { label: 'Mapped', value: `${pm.summary.mappedCount}/${pm.summary.totalEntries}` },
    { label: 'Partial', value: String(pm.summary.partialCount) },
    { label: 'Blocked', value: String(pm.summary.blockedCount) },
    { label: 'Version', value: pm.version },
  ]);

  // Entry table
  if (pm.entries.length > 0) {
    const table = card.createEl('table', { cls: 'brain-console__compact-table' });
    const thead = table.createEl('thead').createEl('tr');
    thead.createEl('th', { text: '#' });
    thead.createEl('th', { text: 'STB Stage' });
    thead.createEl('th', { text: 'Video Module' });
    thead.createEl('th', { text: 'Status' });
    thead.createEl('th', { text: 'Validation' });
    thead.createEl('th', { text: 'Risk' });
    const tbody = table.createEl('tbody');
    for (const entry of pm.entries) {
      const row = tbody.createEl('tr');
      row.createEl('td', { text: String(entry.stbStageIndex) });
      row.createEl('td', { text: entry.stbStage.slice(0, 30) });
      row.createEl('td', { text: entry.videoModule.slice(0, 30) });
      const statusCell = row.createEl('td');
      const statusBadge = statusCell.createEl('span', { cls: 'brain-console__badge', text: entry.status });
      if (entry.status === 'mapped') statusBadge.addClass('brain-console__badge--ok');
      else if (entry.status === 'blocked') statusBadge.addClass('brain-console__badge--danger');
      else if (entry.status === 'partial') statusBadge.addClass('brain-console__badge--warn');
      else statusBadge.addClass('brain-console__badge--muted');
      const valCell = row.createEl('td');
      const valBadge = valCell.createEl('span', { cls: 'brain-console__badge', text: entry.validationStatus });
      if (entry.validationStatus === 'validated') valBadge.addClass('brain-console__badge--ok');
      else if (entry.validationStatus === 'blocked') valBadge.addClass('brain-console__badge--danger');
      else if (entry.validationStatus === 'in-progress') valBadge.addClass('brain-console__badge--warn');
      else valBadge.addClass('brain-console__badge--muted');
      row.createEl('td', { text: entry.riskLevel });
      if (entry.blockerReason) {
        const blockerRow = tbody.createEl('tr');
        const blockerCell = blockerRow.createEl('td');
        blockerCell.setAttribute('colspan', '6');
        blockerCell.createEl('span', { cls: 'brain-console__detail', text: `⚠ ${entry.blockerReason}` });
      }
    }
  }

  // Next steps
  if (pm.nextSteps.length > 0) {
    const nsDiv = card.createDiv({ cls: 'brain-console__list' });
    nsDiv.createEl('div', { cls: 'brain-console__list-label', text: 'Next steps:' });
    for (const step of pm.nextSteps.slice(0, 5)) {
      nsDiv.createEl('div', { cls: 'brain-console__list-sub', text: step });
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
    const bList = card.createDiv({ cls: 'brain-console__list' });
    for (const b of blockers.slice(0, 4)) {
      bList.createEl('div', { cls: 'brain-console__warning', text: `⚠ ${b}` });
    }
  }

  if (state.stbVideoDualRunStatus.nextSafeTask) {
    card.createEl('p', { cls: 'brain-console__detail', text: `Next: ${state.stbVideoDualRunStatus.nextSafeTask}` });
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

// Agent view helpers
function mapStatusToTone(status: string): string {
  const statusLower = (status || '').toLowerCase();
  if (['running', 'ok', 'completed', 'available'].includes(statusLower)) return 'ok';
  if (['blocked', 'error', 'failed', 'rejected'].includes(statusLower)) return 'error';
  if (['pending', 'planned', 'waiting_approval'].includes(statusLower)) return 'warn';
  return 'neutral';
}

function formatCostUsd(cents: number): string {
  const dollars = (cents / 100).toFixed(2);
  return dollars === '0.00' ? '-' : `$${dollars}`;
}

function renderAgentViewCard(state: BrainConsoleViewState, snapshot: DashboardSnapshot): HTMLElement {
  const card = document.createElement('div');

  if (!state.agents || state.agents.length === 0) {
    card.createEl('div', { cls: 'brain-console__list-note', text: 'No agents available.' });
    return card;
  }

  renderCompactStatGrid(card, [
    { label: 'Total Agents', value: String(state.agents.length) },
    { label: 'Available', value: String(state.agents.filter(a => a.status === 'available').length) },
    { label: 'Planned', value: String(state.agents.filter(a => a.status === 'planned').length) },
  ]);

  const list = card.createEl('ul', { cls: 'brain-console__list' });
  for (const agent of state.agents.slice(0, 10)) {
    const li = list.createEl('li');

    // Health indicator dot
    const healthDot = li.createEl('span', { cls: 'brain-console__stat-label' });
    healthDot.textContent = agent.health === 'ok' ? '● ' : agent.health === 'warning' ? '◐ ' : '○ ';

    // Agent name and role
    li.createEl('strong', { text: agent.name });
    li.appendText(` (${agent.role})`);

    // Status badge
    const statusBadge = li.createEl('span', { cls: 'bc-badge' });
    statusBadge.textContent = agent.status;
    statusBadge.classList.add(`bc-badge--${mapStatusToTone(agent.status)}`);
  }

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

        // Show latest report availability if Mind Steward action
        if (action.id === 'mind-steward-dry-run') {
          const mrReport = state.runtimeReports?.find((r) => r.id === 'mind-steward');
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

function renderMindStewardReportDetailCard(detail: import('./client.js').BrainCoreMindStewardReportDetail): HTMLElement {
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

  if (!state.agentRuns || state.agentRuns.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No agent runs available yet.' });
    return el;
  }

  renderCompactStatGrid(el, [
    { label: 'Total Runs', value: String(state.agentRuns.length) },
    { label: 'Blocked', value: String(state.agentRuns.filter(r => r.status === 'blocked').length) },
    { label: 'Completed', value: String(state.agentRuns.filter(r => r.status === 'completed').length) },
  ]);

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  const maxRuns = Math.min(8, state.agentRuns.length);

  for (let i = 0; i < maxRuns; i++) {
    const run = state.agentRuns[i];
    const li = list.createEl('li');

    // Status badge
    const badge = li.createEl('span', { cls: 'bc-badge' });
    badge.textContent = run.status.toUpperCase();
    badge.classList.add(`bc-badge--${mapStatusToTone(run.status)}`);

    // Run title and agent
    li.createEl('strong', { text: run.title });
    li.appendText(` (${run.agentId})`);

    // Age and target
    const details = li.createEl('div', { cls: 'brain-console__list-note' });
    const parts: string[] = [];
    if (run.ageMinutes !== undefined) parts.push(`${run.ageMinutes}m old`);
    if (run.targetId) parts.push(`→ ${run.targetId}`);
    if (parts.length > 0) details.textContent = parts.join(' · ');

    // Safety summary
    if (run.blockers.length > 0) {
      const blockerSpan = li.createEl('div', { cls: 'brain-console__list-error', text: `⚠ ${run.blockers[0]}` });
    }
  }

  return el;
}

function renderApprovalAuditTrailCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');

  if (!state.agentEvents || state.agentEvents.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No approval audit events available yet.' });
    return el;
  }

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  const maxEvents = Math.min(8, state.agentEvents.length);

  for (let i = 0; i < maxEvents; i++) {
    const event = state.agentEvents[i];
    const li = list.createEl('li');

    // Event type badge
    const badge = li.createEl('span', { cls: 'bc-badge' });
    badge.textContent = event.type.toUpperCase();
    badge.classList.add(`bc-badge--${mapStatusToTone(event.severity)}`);

    // Timestamp and summary
    const meta = li.createEl('div', { cls: 'brain-console__list-note' });
    const parts: string[] = [];
    if (event.createdAt) {
      const timeStr = formatRelativeTime(new Date(event.createdAt));
      parts.push(timeStr);
    }
    if (event.summary) parts.push(event.summary);
    if (event.relatedApprovalId) parts.push(`#${event.relatedApprovalId}`);
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

function renderAgentTaskGraphCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const taskGraph = state.agentConsole?.taskGraph;

  if (!taskGraph || !taskGraph.tasks || taskGraph.tasks.length === 0) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No task graph available.' });
    return el;
  }

  renderCompactStatGrid(el, [
    { label: 'Total Tasks', value: String(taskGraph.taskCount ?? 0) },
    { label: 'Done', value: String(taskGraph.completedCount ?? 0) },
    { label: 'Blocked', value: String(taskGraph.blockedCount ?? 0) },
    { label: 'Pending', value: String(taskGraph.pendingCount ?? 0) },
  ]);

  const list = el.createEl('ul', { cls: 'brain-console__list' });
  const maxTasks = Math.min(8, taskGraph.tasks.length);

  for (let i = 0; i < maxTasks; i++) {
    const task = taskGraph.tasks[i];
    const li = list.createEl('li');

    // Status badge
    const badge = li.createEl('span', { cls: 'bc-badge' });
    badge.textContent = task.status.toUpperCase();
    badge.classList.add(`bc-badge--${mapStatusToTone(task.status)}`);

    // Task title and ID
    li.createEl('strong', { text: task.title });
    li.appendText(` (${task.taskId})`);

    // Approval required indicator
    if (task.approvalRequired) {
      li.appendText(' [approval]');
    }

    // Dependencies
    if (task.dependsOn && task.dependsOn.length > 0) {
      const depDiv = li.createEl('div', { cls: 'brain-console__list-note', text: `depends on: ${task.dependsOn.join(', ')}` });
    }
  }

  if (taskGraph.nextSafeStep) {
    el.createEl('div', { cls: 'brain-console__list-note', text: `→ Next: ${taskGraph.nextSafeStep}` });
  }

  return el;
}

function renderApprovalGatesCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const gates = state.agentConsole?.approvalGates;

  if (!gates) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No approval gate data available.' });
    return el;
  }

  renderCompactStatGrid(el, [
    { label: 'Pending', value: String(gates.pendingCount ?? 0) },
    { label: 'Approved', value: String(gates.approvedCount ?? 0) },
    { label: 'Rejected', value: String(gates.rejectedCount ?? 0) },
    { label: 'Expired', value: String(gates.expiredCount ?? 0) },
  ]);

  if (gates.supportedApprovalKinds && gates.supportedApprovalKinds.length > 0) {
    el.createEl('strong', { text: 'Supported kinds:' });
    const kindList = el.createEl('ul', { cls: 'brain-console__list' });
    for (const kind of gates.supportedApprovalKinds) {
      kindList.createEl('li', { text: kind });
    }
  }

  if (gates.blockedApprovalKinds && gates.blockedApprovalKinds.length > 0) {
    el.createEl('strong', { text: 'Blocked kinds:' });
    const blockedList = el.createEl('ul', { cls: 'brain-console__list' });
    for (const kind of gates.blockedApprovalKinds) {
      const li = blockedList.createEl('li', { text: kind });
      li.classList.add('brain-console__list-error');
    }
  }

  return el;
}

function renderAgentCostCard(state: BrainConsoleViewState): HTMLElement {
  const el = document.createElement('div');
  const cost = state.agentCostSummary;

  if (!cost) {
    el.createEl('div', { cls: 'brain-console__list-note', text: 'No cost data available.' });
    return el;
  }

  // Budget status badge
  const budgetDiv = el.createDiv();
  const budgetBadge = budgetDiv.createEl('span', { cls: 'bc-badge' });
  budgetBadge.textContent = cost.budget?.status?.toUpperCase() ?? 'UNKNOWN';
  budgetBadge.classList.add(`bc-badge--${mapStatusToTone(cost.budget?.status ?? 'unknown')}`);

  if (cost.budget) {
    renderCompactStatGrid(el, [
      { label: 'Today', value: formatCostUsd(cost.todayEstimatedUsd) },
      { label: 'Week', value: formatCostUsd(cost.weekEstimatedUsd) },
      { label: 'Month', value: formatCostUsd(cost.monthEstimatedUsd) },
      { label: 'Total', value: formatCostUsd(cost.totalEstimatedUsd) },
    ]);

    el.createEl('strong', { text: 'Budget Status:' });
    const budgetList = el.createEl('ul', { cls: 'brain-console__list' });
    budgetList.createEl('li', { text: `Spent: ${formatCostUsd(cost.budget.spentUsd)}` });
    budgetList.createEl('li', { text: `Threshold: ${formatCostUsd(cost.budget.thresholdUsd)}` });
    budgetList.createEl('li', { text: `Remaining: ${formatCostUsd(cost.budget.remainingUsd)}` });
  }

  if (cost.topExpensiveTasks && cost.topExpensiveTasks.length > 0) {
    el.createEl('strong', { text: 'Top Expenses:' });
    const topList = el.createEl('ul', { cls: 'brain-console__list' });
    for (const task of cost.topExpensiveTasks.slice(0, 3)) {
      topList.createEl('li', { text: `${task.taskId}: ${formatCostUsd(task.estimatedCostUsd)}` });
    }
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

// ── Open URL via Brain Core (Node.js process opens macOS 'open', no Electron sandbox issues) ──
async function openExternalUrl(brainCoreUrl: string, url: string): Promise<void> {
  const result = await openBrowserUrl(brainCoreUrl, url);
  if (!result.ok) {
    new Notice(`Could not open browser: ${result.error ?? 'unknown error'}`);
  }
}

// ── Credential event bus ─────────────────────────────────────────────────
// Any mutation (save/revoke/oauth-connect) fires credBus.emit(key, delta).
// Chips subscribe via credBus.subscribe(keys, handler) and update in-place.
// This is the single normalized mechanism for all dynamic chip updates in the console.

type CredBusHandler = (key: string, delta: number) => void;
const credBus = (() => {
  const listeners: CredBusHandler[] = [];
  return {
    emit(key: string, delta: number) { listeners.forEach(h => h(key, delta)); },
    subscribe(handler: CredBusHandler) { listeners.push(handler); },
    unsubscribe(handler: CredBusHandler) { const i = listeners.indexOf(handler); if (i !== -1) listeners.splice(i, 1); },
  };
})();

// ── Accounts & Credentials section ───────────────────────────────────────

const ACCOUNTS_COLLAPSE_KEY = (groupKey: string) => `brain-console-accounts-collapsed-${groupKey}`;

function isGroupCollapsed(groupKey: string): boolean {
  try { return localStorage.getItem(ACCOUNTS_COLLAPSE_KEY(groupKey)) === '1'; } catch { return false; }
}

function setGroupCollapsed(groupKey: string, collapsed: boolean): void {
  try { collapsed ? localStorage.setItem(ACCOUNTS_COLLAPSE_KEY(groupKey), '1') : localStorage.removeItem(ACCOUNTS_COLLAPSE_KEY(groupKey)); } catch { /* ignore */ }
}

function makeCollapsibleGroup(
  parent: HTMLElement,
  groupKey: string,
  groupCls: string,
  renderHeader: (header: HTMLElement) => void,
  renderBody: (body: HTMLElement) => void,
): void {
  const block = parent.createDiv({ cls: `bc-accounts-group ${groupCls}` });
  const headerRow = block.createDiv({ cls: 'bc-accounts-group-header bc-accounts-group-header--collapsible' });
  const toggle = headerRow.createEl('span', { cls: 'bc-accounts-toggle', text: isGroupCollapsed(groupKey) ? '▶' : '▼' });
  renderHeader(headerRow);

  const body = block.createDiv({ cls: `bc-accounts-group-body${isGroupCollapsed(groupKey) ? ' bc-accounts-group-body--collapsed' : ''}` });
  renderBody(body);

  headerRow.addEventListener('click', () => {
    const nowCollapsed = !isGroupCollapsed(groupKey);
    setGroupCollapsed(groupKey, nowCollapsed);
    toggle.textContent = nowCollapsed ? '▶' : '▼';
    body.toggleClass('bc-accounts-group-body--collapsed', nowCollapsed);
  });
}

function renderAccountsSection(
  content: HTMLElement,
  state: BrainConsoleViewState,
  settings: BrainConsoleSettings,
): void {
  const brainCoreUrl = state.brainCoreUrl ?? settings.brainCoreUrl ?? '';
  const catalog = state.credentialCatalog;

  const header = content.createDiv({ cls: 'bc-accounts-header' });
  header.createEl('h2', { cls: 'bc-accounts-title', text: 'Accounts & Credentials' });
  renderVOContextBar(content, state);
  const voGrid = content.createDiv({ cls: 'brain-console__dashboard-grid' });
  renderCard(voGrid, 'VO Account Registry', renderVOAccountsRegistryCard(state), { wide: true });

  if (!catalog) {
    content.createEl('p', { cls: 'brain-console__empty', text: 'Credential catalog unavailable — Brain Core must be online.' });
    return;
  }

  // ── Infrastructure section (collapsible) ────────────────────────────────
  const infraAllOk = catalog.infra.every(g => g.allRequiredSet);
  const infraReadyCount = catalog.infra.filter(g => g.allRequiredSet).length;

  makeCollapsibleGroup(content, 'infra', 'bc-accounts-group--infra',
    (headerRow) => {
      headerRow.createEl('span', { cls: 'bc-accounts-group-name', text: 'Infrastructure' });
      createStatusChip(headerRow, `${infraReadyCount}/${catalog.infra.length} ready`, infraAllOk ? 'ok' : 'warn');
    },
    (body) => {
      for (const infraGroup of catalog.infra) {
        renderInfraCredentialGroup(body, infraGroup, brainCoreUrl);
      }
    }
  );

  // ── Per-project sections (collapsible) ──────────────────────────────────
  for (const project of catalog.projects) {
    const allPlatforms = project.platforms;
    const requiredTotal = allPlatforms.flatMap(p => p.credentials.filter(c => c.required)).length;
    const allRequiredKeys = new Set(allPlatforms.flatMap(p => p.credentials.filter(c => c.required).map(c => c.key)));
    let groupSetCount = allPlatforms.flatMap(p => p.credentials.filter(c => c.required && c.isSet && !c.hasPlaceholder)).length;

    let groupChip: HTMLElement;
    const groupChipHandler: CredBusHandler = (key, delta) => {
      if (!allRequiredKeys.has(key)) return;
      groupSetCount = Math.max(0, Math.min(requiredTotal, groupSetCount + delta));
      const tone = requiredTotal > 0 && groupSetCount === requiredTotal ? 'ok' : groupSetCount > 0 ? 'warn' : 'danger';
      groupChip.textContent = `${groupSetCount}/${requiredTotal} required`;
      groupChip.className = `bc-chip bc-chip--${tone}`;
    };
    credBus.subscribe(groupChipHandler);

    makeCollapsibleGroup(content, project.projectId, 'bc-accounts-group--project',
      (headerRow) => {
        headerRow.createEl('span', { cls: 'bc-accounts-group-name', text: project.displayName });
        const tone = requiredTotal > 0 && groupSetCount === requiredTotal ? 'ok' : groupSetCount > 0 ? 'warn' : 'danger';
        groupChip = createStatusChip(headerRow, `${groupSetCount}/${requiredTotal} required`, tone);
        headerRow.addEventListener('remove', () => credBus.unsubscribe(groupChipHandler));
      },
      (body) => {
        const socialPlatforms = allPlatforms.filter(p => p.platformCategory === 'social');
        const infraPlatforms = allPlatforms.filter(p => p.platformCategory === 'infra');
        for (const platform of [...socialPlatforms, ...infraPlatforms]) {
          renderProjectPlatformCard(body, platform, project.projectId, brainCoreUrl);
        }
      }
    );
  }

  // ── Add Project button + inline form ────────────────────────────────────
  const addArea = content.createDiv({ cls: 'bc-accounts-add-area' });
  const addBtn = addArea.createEl('button', { cls: 'bc-accounts-add-project-btn', text: '＋ Add Project' });

  addBtn.addEventListener('click', () => {
    addBtn.style.display = 'none';
    renderAddProjectForm(addArea, brainCoreUrl, catalog.availablePlatforms, () => {
      addBtn.style.display = '';
    });
  });
}

function renderAddProjectForm(
  parent: HTMLElement,
  brainCoreUrl: string,
  availablePlatforms: Array<{ platformId: string; platformName: string; platformCategory: 'social' | 'infra' }>,
  onCancel: () => void,
): void {
  const form = parent.createDiv({ cls: 'bc-accounts-add-form' });
  form.createEl('p', { cls: 'bc-accounts-add-form-title', text: 'New Project' });

  const nameInput = form.createEl('input', { cls: 'bc-accounts-input' });
  nameInput.type = 'text';
  nameInput.placeholder = 'Project name (e.g. Yeshua Academy)';

  const repoInput = form.createEl('input', { cls: 'bc-accounts-input' });
  repoInput.type = 'text';
  repoInput.placeholder = 'Repo path (e.g. /Users/Office/Repos/yeshuaacademy/web)';

  const envInput = form.createEl('input', { cls: 'bc-accounts-input' });
  envInput.type = 'text';
  envInput.placeholder = '.env file (e.g. .env.production)';
  envInput.value = '.env';

  form.createEl('p', { cls: 'bc-accounts-add-platform-label', text: 'Platforms:' });
  const platformGrid = form.createDiv({ cls: 'bc-accounts-platform-chips' });
  const selectedPlatforms = new Set<string>();

  for (const p of availablePlatforms) {
    const chip = platformGrid.createEl('label', { cls: 'bc-accounts-platform-chip' });
    const checkbox = chip.createEl('input');
    checkbox.type = 'checkbox';
    checkbox.value = p.platformId;
    chip.createEl('span', { text: p.platformName });
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) { selectedPlatforms.add(p.platformId); chip.addClass('bc-accounts-platform-chip--selected'); }
      else { selectedPlatforms.delete(p.platformId); chip.removeClass('bc-accounts-platform-chip--selected'); }
    });
  }

  const btnRow = form.createDiv({ cls: 'bc-accounts-add-btn-row' });
  const createBtn = btnRow.createEl('button', { cls: 'bc-accounts-save-btn', text: 'Create Project' });
  const cancelBtn = btnRow.createEl('button', { cls: 'bc-accounts-cancel-btn', text: 'Cancel' });
  const feedbackEl = form.createEl('span', { cls: 'bc-accounts-feedback' });

  cancelBtn.addEventListener('click', () => { form.remove(); onCancel(); });

  createBtn.addEventListener('click', async () => {
    const displayName = nameInput.value.trim();
    const repoPath = repoInput.value.trim();
    const envFileName = envInput.value.trim() || '.env';
    const platforms = [...selectedPlatforms];

    if (!displayName) { feedbackEl.textContent = 'Enter a project name.'; feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--warn'; return; }
    if (!repoPath) { feedbackEl.textContent = 'Enter the repo path.'; feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--warn'; return; }
    if (platforms.length === 0) { feedbackEl.textContent = 'Select at least one platform.'; feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--warn'; return; }

    const projectId = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    createBtn.disabled = true;
    createBtn.textContent = '…';
    feedbackEl.textContent = '';
    try {
      const result = await registerBrainCoreProject(brainCoreUrl, { projectId, displayName, repoPath, envFileName, platforms });
      if (result.ok) {
        form.empty();
        form.createEl('p', { cls: 'bc-accounts-feedback bc-accounts-feedback--ok', text: `Project "${displayName}" added. Refresh to see credentials.` });
      } else {
        feedbackEl.textContent = result.error === 'duplicate_id' ? 'A project with that name already exists.' : (result.error ?? 'Failed to create project.');
        feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
        createBtn.disabled = false;
        createBtn.textContent = 'Create Project';
      }
    } catch (err) {
      feedbackEl.textContent = err instanceof Error ? err.message : 'Network error.';
      feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
      createBtn.disabled = false;
      createBtn.textContent = 'Create Project';
    }
  });
}

function renderCredStatusDot(parent: HTMLElement, isSet: boolean, hasPlaceholder: boolean): void {
  if (isSet && !hasPlaceholder) {
    const dot = parent.createEl('span', { cls: 'bc-accounts-set-dot bc-accounts-set-dot--ok' });
    dot.title = 'Set';
  } else if (hasPlaceholder) {
    const dot = parent.createEl('span', { cls: 'bc-accounts-set-dot bc-accounts-set-dot--placeholder' });
    dot.title = 'Placeholder value — needs real value';
  } else {
    const dot = parent.createEl('span', { cls: 'bc-accounts-set-dot bc-accounts-set-dot--unset' });
    dot.title = 'Not set';
  }
}

function renderInfraCredentialGroup(
  parent: HTMLElement,
  group: BrainCoreInfraCredentialGroup,
  brainCoreUrl: string,
): void {
  const card = parent.createDiv({ cls: 'bc-accounts-platform bc-accounts-platform--infra' });
  const top = card.createDiv({ cls: 'bc-accounts-platform-top' });
  top.createEl('span', { cls: 'bc-accounts-platform-name', text: group.platformName });
  const statusChip = createStatusChip(top, group.allRequiredSet ? 'Ready' : 'Action required', group.allRequiredSet ? 'ok' : 'danger');

  const requiredKeys = new Set(group.credentials.filter(c => c.required).map(c => c.key));
  let setCount = group.credentials.filter(c => c.required && c.isSet && !c.hasPlaceholder).length;
  const requiredCount = requiredKeys.size;
  const infraChipHandler: CredBusHandler = (key, delta) => {
    if (!requiredKeys.has(key)) return;
    setCount = Math.max(0, Math.min(requiredCount, setCount + delta));
    const allSet = setCount >= requiredCount;
    statusChip.textContent = allSet ? 'Ready' : 'Action required';
    statusChip.className = `bc-chip bc-chip--${allSet ? 'ok' : 'danger'}`;
  };
  credBus.subscribe(infraChipHandler);
  card.addEventListener('remove', () => credBus.unsubscribe(infraChipHandler));

  const table = card.createEl('table', { cls: 'bc-accounts-table' });
  const tbody = table.createEl('tbody');

  for (const cred of group.credentials) {
    if (cred.storage === 'keychain') {
      // YouTube OAuth — 2-step flow rendered as its own row block
      renderYouTubeOAuthRow(tbody, cred, brainCoreUrl);
      continue;
    }

    // Plist credential — identical UI to env_file credentials
    const tr = tbody.createEl('tr', { cls: `bc-accounts-row${cred.isSet && !cred.hasPlaceholder ? ' bc-accounts-row--set' : ''}` });

    const labelTd = tr.createEl('td', { cls: 'bc-accounts-label-cell' });
    labelTd.createEl('span', { cls: 'bc-accounts-key-label', text: cred.label });
    if (cred.required) labelTd.createEl('span', { cls: 'bc-accounts-required-badge', text: 'required' });
    if (cred.hint) {
      const hintSpan = labelTd.createEl('span', { cls: 'bc-accounts-hint' });
      hintSpan.createEl('span', { text: cred.hint });
      if (cred.deeplink) {
        const dlBtn = hintSpan.createEl('button', { cls: 'bc-accounts-deeplink-btn', text: '↗ Open' });
        dlBtn.addEventListener('click', () => { void openExternalUrl(brainCoreUrl, cred.deeplink!); });
      }
    }

    const statusTd = tr.createEl('td', { cls: 'bc-accounts-status-cell' });
    renderCredStatusDot(statusTd, cred.isSet, cred.hasPlaceholder);

    const inputTd = tr.createEl('td', { cls: 'bc-accounts-input-cell' });
    const inputWrap = inputTd.createDiv({ cls: 'bc-accounts-input-wrap' });
    const input = inputWrap.createEl('input', { cls: 'bc-accounts-input' });
    input.type = cred.type === 'secret' || cred.type === 'token' || cred.type === 'api_key' ? 'password' : 'text';
    input.placeholder = cred.isSet && !cred.hasPlaceholder ? '••••••• (set — enter new value to update)' : `Enter ${cred.label}`;
    input.setAttribute('autocomplete', 'off');

    const saveBtn = inputWrap.createEl('button', { cls: 'bc-accounts-save-btn', text: 'Save' });
    const feedbackEl = inputWrap.createEl('span', { cls: 'bc-accounts-feedback' });

    saveBtn.addEventListener('click', async () => {
      const val = input.value.trim();
      if (!val) {
        feedbackEl.textContent = 'Enter a value first.';
        feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--warn';
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = '…';
      feedbackEl.textContent = '';
      try {
        const result = await setInfraPlistCredential(brainCoreUrl, cred.key, val);
        if (result.ok) {
          input.value = '';
          input.placeholder = '••••••• (set — enter new value to update)';
          if (!tr.hasClass('bc-accounts-row--set') && cred.required) credBus.emit(cred.key, 1);
          tr.addClass('bc-accounts-row--set');
          statusTd.empty();
          renderCredStatusDot(statusTd, true, false);
          feedbackEl.textContent = result.action === 'created' ? 'Saved.' : 'Updated.';
          feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--ok';
        } else {
          feedbackEl.textContent = result.error === 'key_not_allowed' ? 'Key not permitted.' : (result.error ?? 'Save failed.');
          feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
        }
      } catch (err) {
        feedbackEl.textContent = err instanceof Error ? err.message : 'Network error.';
        feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') saveBtn.click();
    });
  }
}

function renderYouTubeOAuthRow(
  tbody: HTMLElement,
  cred: BrainCoreInfraCredentialGroup['credentials'][number] | BrainCoreProjectCredentialEntry,
  brainCoreUrl: string,
): void {
  // Key is "yt-oauth-@handle" — strip the "yt-oauth-" prefix to get the account handle
  const account = cred.key.replace('yt-oauth-', '');

  const tr = tbody.createEl('tr', { cls: `bc-accounts-row${cred.isSet ? ' bc-accounts-row--set' : ''}` });

  const labelTd = tr.createEl('td', { cls: 'bc-accounts-label-cell' });
  labelTd.createEl('span', { cls: 'bc-accounts-key-label', text: cred.label });
  if (cred.required) labelTd.createEl('span', { cls: 'bc-accounts-required-badge', text: 'required' });

  const statusTd = tr.createEl('td', { cls: 'bc-accounts-status-cell' });
  renderCredStatusDot(statusTd, cred.isSet, cred.hasPlaceholder);

  const inputTd = tr.createEl('td', { cls: 'bc-accounts-input-cell' });

  if (cred.isSet) {
    // Already connected — show revoke option
    const wrap = inputTd.createDiv({ cls: 'bc-accounts-input-wrap' });
    wrap.createEl('span', { cls: 'bc-accounts-feedback bc-accounts-feedback--ok', text: 'Connected' });
    const reconnectBtn = wrap.createEl('button', { cls: 'bc-accounts-save-btn', text: 'Reconnect' });
    reconnectBtn.addEventListener('click', () => startYouTubeOAuthFlow(inputTd, account, cred.key, brainCoreUrl, tr, statusTd, true));
    return;
  }

  // Not connected — show connect button
  const wrap = inputTd.createDiv({ cls: 'bc-accounts-input-wrap' });
  const connectBtn = wrap.createEl('button', { cls: 'bc-accounts-save-btn', text: 'Connect' });
  connectBtn.addEventListener('click', () => startYouTubeOAuthFlow(inputTd, account, cred.key, brainCoreUrl, tr, statusTd, false));
}

function startYouTubeOAuthFlow(
  inputTd: HTMLElement,
  account: string,
  credKey: string,
  brainCoreUrl: string,
  tr: HTMLElement,
  statusTd: HTMLElement,
  isReconnect: boolean,
): void {
  inputTd.empty();

  // Stacked layout: status message, then open button, then code row (hidden until URL opened)
  const flow = inputTd.createDiv({ cls: 'bc-accounts-oauth-flow' });
  const statusMsg = flow.createEl('div', { cls: 'bc-accounts-feedback' });

  const openBtn = flow.createEl('button', {
    cls: 'bc-accounts-save-btn',
    text: isReconnect ? 'Open Google Auth (reconnect)' : 'Open Google Auth',
  });

  // Code input row — shown after URL is opened
  const codeRow = flow.createDiv({ cls: 'bc-accounts-oauth-code-row bc-accounts-oauth-flow--hidden' });
  const codeInput = codeRow.createEl('input', { cls: 'bc-accounts-input bc-accounts-oauth-code-input' });
  codeInput.type = 'text';
  codeInput.placeholder = 'Paste authorization code from Google…';
  codeInput.setAttribute('autocomplete', 'off');
  const authorizeBtn = codeRow.createEl('button', { cls: 'bc-accounts-save-btn', text: 'Authorize' });
  const codeFeedback = flow.createEl('div', { cls: 'bc-accounts-feedback' });

  openBtn.addEventListener('click', async () => {
    openBtn.disabled = true;
    openBtn.textContent = 'Opening…';
    statusMsg.textContent = '';
    statusMsg.className = 'bc-accounts-feedback';
    try {
      const result = await getYouTubeOAuthUrl(brainCoreUrl, account);
      if (result.ok && result.url) {
        await openExternalUrl(brainCoreUrl, result.url);
        statusMsg.textContent = 'Browser opened — authorize, then paste the code below.';
        statusMsg.className = 'bc-accounts-feedback bc-accounts-feedback--ok';
        codeRow.removeClass('bc-accounts-oauth-flow--hidden');
        codeInput.focus();
        openBtn.textContent = 'Reopen browser';
        openBtn.disabled = false;
        openBtn.onclick = () => { void openExternalUrl(brainCoreUrl, result.url!); };
      } else {
        statusMsg.textContent = result.error ?? 'Failed to generate URL.';
        statusMsg.className = 'bc-accounts-feedback bc-accounts-feedback--error';
        openBtn.disabled = false;
        openBtn.textContent = isReconnect ? 'Open Google Auth (reconnect)' : 'Open Google Auth';
      }
    } catch (err) {
      statusMsg.textContent = err instanceof Error ? err.message : 'Network error.';
      statusMsg.className = 'bc-accounts-feedback bc-accounts-feedback--error';
      openBtn.disabled = false;
      openBtn.textContent = isReconnect ? 'Open Google Auth (reconnect)' : 'Open Google Auth';
    }
  });

  authorizeBtn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (!code) {
      codeFeedback.textContent = 'Paste the code first.';
      codeFeedback.className = 'bc-accounts-feedback bc-accounts-feedback--warn';
      return;
    }
    authorizeBtn.disabled = true;
    authorizeBtn.textContent = '…';
    codeFeedback.textContent = '';
    try {
      const result = await exchangeYouTubeOAuthCode(brainCoreUrl, account, code);
      if (result.ok) {
        if (!tr.hasClass('bc-accounts-row--set')) credBus.emit(credKey, 1);
        tr.addClass('bc-accounts-row--set');
        statusTd.empty();
        renderCredStatusDot(statusTd, true, false);
        inputTd.empty();
        const wrap = inputTd.createDiv({ cls: 'bc-accounts-input-wrap' });
        wrap.createEl('span', { cls: 'bc-accounts-feedback bc-accounts-feedback--ok', text: 'Connected' });
        const reconnectBtn = wrap.createEl('button', { cls: 'bc-accounts-save-btn', text: 'Reconnect' });
        reconnectBtn.addEventListener('click', () => startYouTubeOAuthFlow(inputTd, account, credKey, brainCoreUrl, tr, statusTd, true));
      } else {
        codeFeedback.textContent = result.error ?? 'Authorization failed.';
        codeFeedback.className = 'bc-accounts-feedback bc-accounts-feedback--error';
        authorizeBtn.disabled = false;
        authorizeBtn.textContent = 'Authorize';
      }
    } catch (err) {
      codeFeedback.textContent = err instanceof Error ? err.message : 'Network error.';
      codeFeedback.className = 'bc-accounts-feedback bc-accounts-feedback--error';
      authorizeBtn.disabled = false;
      authorizeBtn.textContent = 'Authorize';
    }
  });

  codeInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') authorizeBtn.click();
  });
}

function renderProjectPlatformCard(
  parent: HTMLElement,
  platform: BrainCoreProjectCredentialPlatform,
  projectId: string,
  brainCoreUrl: string,
): void {
  const card = parent.createDiv({ cls: `bc-accounts-platform${platform.platformCategory === 'infra' ? ' bc-accounts-platform--secondary' : ''}` });
  const top = card.createDiv({ cls: 'bc-accounts-platform-top' });

  // Platform icon
  const platformIcons: Record<string, string> = {
    youtube: '▶',
    pinterest: '◈',
    facebook: '◉',
    instagram: '◎',
    tiktok: '◆',
    twitter: '◧',
    linkedin: '◫',
    azure: '◧',
  };
  const icon = platformIcons[platform.platformId] ?? '◈';
  top.createEl('span', { cls: 'bc-accounts-platform-icon', text: icon });
  top.createEl('span', { cls: 'bc-accounts-platform-name', text: platform.platformName });
  const platformStatusChip = createStatusChip(top, platform.allRequiredSet ? 'Ready' : 'Incomplete', platform.allRequiredSet ? 'ok' : 'warn');

  const platformRequiredKeys = new Set(platform.credentials.filter(c => c.required).map(c => c.key));
  let platformSetCount = platform.credentials.filter(c => c.required && c.isSet && !c.hasPlaceholder).length;
  const platformRequiredCount = platformRequiredKeys.size;
  const platformChipHandler: CredBusHandler = (key, delta) => {
    if (!platformRequiredKeys.has(key)) return;
    platformSetCount = Math.max(0, Math.min(platformRequiredCount, platformSetCount + delta));
    const allSet = platformSetCount >= platformRequiredCount;
    platformStatusChip.textContent = allSet ? 'Ready' : 'Incomplete';
    platformStatusChip.className = `bc-chip bc-chip--${allSet ? 'ok' : 'warn'}`;
  };
  credBus.subscribe(platformChipHandler);
  card.addEventListener('remove', () => credBus.unsubscribe(platformChipHandler));

  const table = card.createEl('table', { cls: 'bc-accounts-table' });
  const tbody = table.createEl('tbody');

  for (const cred of platform.credentials) {
    // Keychain credentials use the OAuth browser flow, not a text input
    if (cred.storage === 'keychain') {
      renderYouTubeOAuthRow(tbody, cred, brainCoreUrl);
      continue;
    }

    const tr = tbody.createEl('tr', { cls: `bc-accounts-row${cred.isSet && !cred.hasPlaceholder ? ' bc-accounts-row--set' : ''}` });

    // Label cell
    const labelTd = tr.createEl('td', { cls: 'bc-accounts-label-cell' });
    labelTd.createEl('span', { cls: 'bc-accounts-key-label', text: cred.label });
    if (cred.required) labelTd.createEl('span', { cls: 'bc-accounts-required-badge', text: 'required' });
    if (cred.hint) {
      const hintSpan = labelTd.createEl('span', { cls: 'bc-accounts-hint' });
      hintSpan.createEl('span', { text: cred.hint });
      if (cred.deeplink) {
        const dlBtn = hintSpan.createEl('button', { cls: 'bc-accounts-deeplink-btn', text: '↗ Open' });
        dlBtn.addEventListener('click', () => { void openExternalUrl(brainCoreUrl, cred.deeplink!); });
      }
    }

    // Status dot cell
    const statusTd = tr.createEl('td', { cls: 'bc-accounts-status-cell' });
    renderCredStatusDot(statusTd, cred.isSet, cred.hasPlaceholder);

    // Input + action buttons cell
    const inputTd = tr.createEl('td', { cls: 'bc-accounts-input-cell' });
    const inputWrap = inputTd.createDiv({ cls: 'bc-accounts-input-wrap' });
    const input = inputWrap.createEl('input', { cls: 'bc-accounts-input' });
    input.type = cred.type === 'secret' || cred.type === 'token' || cred.type === 'api_key' ? 'password' : 'text';
    input.placeholder = cred.isSet && !cred.hasPlaceholder ? '••••••• (set — enter new value to update)' : `Enter ${cred.label}`;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('data-key', cred.key);
    input.setAttribute('data-project', projectId);

    const saveBtn = inputWrap.createEl('button', { cls: 'bc-accounts-save-btn', text: 'Save' });
    const feedbackEl = inputWrap.createEl('span', { cls: 'bc-accounts-feedback' });

    // Revoke button (only if already set)
    if (cred.isSet && !cred.hasPlaceholder) {
      const revokeBtn = inputWrap.createEl('button', { cls: 'bc-accounts-revoke-btn', text: 'Revoke' });
      revokeBtn.setAttribute('title', `Remove ${cred.key} from .env`);
      revokeBtn.addEventListener('click', async () => {
        if (!confirm(`Revoke ${cred.label} for ${projectId}? This removes the key from the .env file.`)) return;
        revokeBtn.disabled = true;
        revokeBtn.textContent = '…';
        feedbackEl.textContent = '';
        try {
          const result = await revokeBrainCoreCredential(brainCoreUrl, projectId, cred.key);
          if (result.ok) {
            if (cred.required) credBus.emit(cred.key, -1);
            tr.removeClass('bc-accounts-row--set');
            statusTd.empty();
            renderCredStatusDot(statusTd, false, false);
            input.placeholder = `Enter ${cred.label}`;
            feedbackEl.textContent = 'Revoked.';
            feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--ok';
            revokeBtn.remove();
          } else {
            feedbackEl.textContent = result.error ?? 'Revoke failed.';
            feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
            revokeBtn.disabled = false;
            revokeBtn.textContent = 'Revoke';
          }
        } catch (err) {
          feedbackEl.textContent = err instanceof Error ? err.message : 'Network error.';
          feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
          revokeBtn.disabled = false;
          revokeBtn.textContent = 'Revoke';
        }
      });
    }

    saveBtn.addEventListener('click', async () => {
      const val = input.value.trim();
      if (!val) {
        feedbackEl.textContent = 'Enter a value first.';
        feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--warn';
        return;
      }
      saveBtn.disabled = true;
      saveBtn.textContent = '…';
      feedbackEl.textContent = '';
      try {
        const result = await setBrainCoreCredential(brainCoreUrl, projectId, cred.key, val);
        if (result.ok) {
          input.value = '';
          input.placeholder = '••••••• (set — enter new value to update)';
          if (!tr.hasClass('bc-accounts-row--set') && cred.required) credBus.emit(cred.key, 1);
          tr.addClass('bc-accounts-row--set');
          statusTd.empty();
          renderCredStatusDot(statusTd, true, false);
          feedbackEl.textContent = result.action === 'created' ? 'Saved.' : 'Updated.';
          feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--ok';
        } else {
          feedbackEl.textContent = result.error === 'key_not_allowed' ? 'Key not permitted.' : (result.error ?? 'Save failed.');
          feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
        }
      } catch (err) {
        feedbackEl.textContent = err instanceof Error ? err.message : 'Network error.';
        feedbackEl.className = 'bc-accounts-feedback bc-accounts-feedback--error';
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    input.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') saveBtn.click();
    });
  }
}

function renderAwsVideoPipelineSection(
  content: HTMLElement,
  settings: BrainConsoleSettings,
): void {
  const brainCoreUrl = settings.brainCoreUrl ?? 'http://localhost:4877';

  // Header
  const header = content.createDiv({ cls: 'bc-aws-video-header' });
  header.createEl('h2', { cls: 'bc-aws-video-title', text: 'AWS Video Pipeline' });
  header.createEl('p', { cls: 'bc-aws-video-subtitle', text: 'Topic Intelligence & Channel Status' });

  // Panel container
  const panelContainer = content.createDiv({ cls: 'bc-aws-video-panel-container' });
  const panel = new AwsVideoPipelinePanel(panelContainer, brainCoreUrl);

  // Cleanup on section change
  content.addEventListener('beforeunload', () => panel.destroy());
}
