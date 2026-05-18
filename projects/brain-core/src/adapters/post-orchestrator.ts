import { requestAction } from './actions.js';
import type {
  BrainCorePostDryRunPlan,
  BrainCorePostDryRunPlanResponse,
  BrainCorePostDraftFixture,
  BrainCorePostDraftFixturesResponse,
  BrainCorePostDraftReviewApprovalRequest,
  BrainCorePostDraftReviewItem,
  BrainCorePostDraftReviewQueue,
  BrainCorePostDraftReviewQueueResponse,
  BrainCorePostSchedulePreviewApprovalRequest,
  BrainCorePostSchedulePreviewItem,
  BrainCorePostSchedulePreviewQueue,
  BrainCorePostSchedulePreviewQueueResponse,
  BrainCorePostEventFixture,
  BrainCorePostEventFixturesResponse,
  BrainCorePostEventType,
  BrainCorePostFlowFixturesResponse,
  BrainCorePostFlowFixture,
  BrainCorePostPlanStatus,
  BrainCorePostOrchestratorContractsResponse,
  BrainCorePostOrchestratorIntegrationsResponse,
  BrainCorePostOrchestratorRecoveryResponse,
  BrainCorePostOrchestratorStatusResponse,
  BrainCorePostPlatform,
  BrainCorePostAnalyticsFixture,
  BrainCorePostAnalyticsFixturesResponse,
  BrainCorePostPipelineSummary,
  BrainCorePostPipelineSummaryResponse,
  BrainCorePostPipelineStepId,
  BrainCorePostPipelineStepStatus,
  BrainCorePostPipelineStepSummary,
  BrainCorePostPlatformPolicy,
  BrainCorePostPlatformPoliciesResponse,
  BrainCorePostDecommissionGate,
  BrainCorePostDecommissionReadinessItem,
  BrainCorePostDecommissionReadinessResponse,
  BrainCorePostManualExportFormat,
  BrainCorePostManualExportItem,
  BrainCorePostManualExportPackage,
  BrainCorePostManualExportPackageResponse,
  BrainCorePostOrchestratorOverview,
  BrainCorePostOrchestratorOverviewResponse,
  BrainCorePostAcceptanceCheck,
  BrainCorePostAcceptanceCheckCategory,
  BrainCorePostAcceptanceCheckStatus,
  BrainCorePostAcceptanceChecklist,
  BrainCorePostAcceptanceChecklistResponse,
  BrainCorePostMigrationCapabilityArea,
  BrainCorePostMigrationCapabilityStatus,
  BrainCorePostMigrationParityCapability,
  BrainCorePostMigrationParityReport,
  BrainCorePostMigrationParityReportResponse,
  BrainCorePostOperatorGuidanceCategory,
  BrainCorePostOperatorGuidanceItem,
  BrainCorePostOperatorGuidanceResponse,
  BrainCorePostOperatorGuidanceSeverity,
  BrainCorePostOperatorGuidanceStep,
  BrainCorePostRoadmapCheckpoint,
  BrainCorePostRoadmapCheckpointPhase,
  BrainCorePostRoadmapCheckpointResponse,
  BrainCorePostReadinessBlocker,
  BrainCorePostReadinessScore,
  BrainCorePostReadinessScoreResponse,
  BrainCorePostReadinessSeverity,
  BrainCorePostQaStatus,
  BrainCorePostQaStatusResponse,
  BrainCorePostQaEndpointCoverageItem,
  BrainCorePostQaChecklistItem,
} from '../types/api.js';

const STATUS: BrainCorePostOrchestratorStatusResponse = {
  id: 'post-orchestrator',
  name: 'Post Orchestrator',
  status: 'partial',
  summary: 'Brain owns the canonical post orchestration surface in read-only P1.',
  phase: 'P1-read-only-status-scaffold',
  publishingEnabled: false,
  schedulingEnabled: false,
  executionEnabled: false,
  socialProofFlowLabel: 'Social Proof Asset Flow',
  growthOptimizationFlowLabel: 'Growth Optimization Flow',
  modules: [
    {
      id: 'event-ingestion',
      name: 'Event Ingestion',
      status: 'planned',
      summary: 'Canonical post event intake for Brain-owned orchestration.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['No live event ingestion path exposed in P1'],
      nextSafeStep: 'Define typed event fixture adapters before execution work.',
    },
    {
      id: 'post-draft-generation',
      name: 'Post Draft Generation',
      status: 'planned',
      summary: 'Draft synthesis and content shaping remain read-only in this phase.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['Draft generation is not wired to a write-enabled workflow'],
      nextSafeStep: 'Add read-only draft contract fixtures.',
    },
    {
      id: 'approval-review',
      name: 'Approval Review',
      status: 'partial',
      summary: 'Brain approval infrastructure exists, but post execution remains disabled.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['Approval review does not unlock publishing in P1'],
      nextSafeStep: 'Keep approvals read-only until a later phase.',
    },
    {
      id: 'scheduling-queue',
      name: 'Scheduling Queue',
      status: 'disabled',
      summary: 'Scheduling is visible but intentionally disabled.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['Scheduling is disabled for P1'],
      nextSafeStep: 'Delay queue execution until policy and validation are ready.',
    },
    {
      id: 'publishing-adapter',
      name: 'Publishing Adapter',
      status: 'disabled',
      summary: 'Publishing execution is not exposed from Brain in this slice.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['Publishing is disabled in P1'],
      nextSafeStep: 'Keep the adapter read-only until a future execution phase.',
    },
    {
      id: 'analytics-feedback',
      name: 'Analytics Feedback',
      status: 'planned',
      summary: 'Analytics interpretation is reserved for later feedback loops.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['No analytics feedback execution path in P1'],
      nextSafeStep: 'Add passive analytics summary contracts only.',
    },
    {
      id: 'x-post-flow',
      name: 'X Post Flow',
      status: 'planned',
      summary: 'X platform post flow remains a read-only planning surface.',
      owner: 'platform',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the X post flow as a planning-only module.',
    },
    {
      id: 'github-post-flow',
      name: 'GitHub Post Flow',
      status: 'planned',
      summary: 'GitHub post flow captures release and milestone sharing intent.',
      owner: 'platform',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the GitHub post flow as a planning-only module.',
    },
    {
      id: 'linkedin-post-flow',
      name: 'LinkedIn Post Flow',
      status: 'planned',
      summary: 'LinkedIn post flow captures professional content planning.',
      owner: 'platform',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the LinkedIn post flow as a planning-only module.',
    },
    {
      id: 'facebook-post-flow',
      name: 'Facebook Post Flow',
      status: 'planned',
      summary: 'Facebook post flow captures broad social distribution planning.',
      owner: 'platform',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the Facebook post flow as a planning-only module.',
    },
    {
      id: 'youtube-post-flow',
      name: 'YouTube Post Flow',
      status: 'planned',
      summary: 'YouTube post flow captures video distribution planning.',
      owner: 'platform',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the YouTube post flow as a planning-only module.',
    },
    {
      id: 'blog-post-flow',
      name: 'Blog Post Flow',
      status: 'planned',
      summary: 'Blog post flow captures article publication planning.',
      owner: 'platform',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the blog post flow as a planning-only module.',
    },
    {
      id: 'product-milestone-post-flow',
      name: 'Product Milestone Post Flow',
      status: 'planned',
      summary: 'Product milestone post flow captures launch and milestone announcements.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the milestone post flow as a planning-only module.',
    },
    {
      id: 'release-announcement-post-flow',
      name: 'Release Announcement Post Flow',
      status: 'planned',
      summary: 'Release announcement post flow captures release note communication.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep the release announcement post flow as a planning-only module.',
    },
    {
      id: 'social-proof-asset-flow',
      name: 'Social Proof Asset Flow',
      internalName: 'Proofly Asset Provider',
      legacySource: 'proofly',
      status: 'planned',
      summary: 'Legacy Proofly asset capability is represented as a neutral read-only flow.',
      owner: 'proofly',
      executionEnabled: false,
      blockers: ['Legacy asset system migration remains read-only'],
      nextSafeStep: 'Keep the social proof asset flow neutral and read-only.',
    },
    {
      id: 'growth-optimization-flow',
      name: 'Growth Optimization Flow',
      internalName: 'Xgrow Optimization Provider',
      legacySource: 'xgrow',
      status: 'planned',
      summary: 'Legacy Xgrow optimization capability is represented as a neutral read-only flow.',
      owner: 'xgrow',
      executionEnabled: false,
      blockers: ['Legacy growth system migration remains read-only'],
      nextSafeStep: 'Keep the growth optimization flow neutral and read-only.',
    },
    {
      id: 'recovery-audit',
      name: 'Recovery Audit',
      status: 'planned',
      summary: 'Recovery and blocker tracking remain visible and read-only.',
      owner: 'brain',
      executionEnabled: false,
      blockers: ['No post recovery automation exposed in P1'],
      nextSafeStep: 'Audit blockers after contracts are validated.',
    },
  ],
  nextSafeStep: 'Validate typed contracts and keep publishing disabled.',
  updatedAt: new Date().toISOString(),
};

const CONTRACTS: BrainCorePostOrchestratorContractsResponse = {
  contracts: [
    {
      id: 'PostEvent',
      name: 'Post Event',
      status: 'defined',
      version: 'p1',
      owner: 'brain',
      summary: 'Canonical event emitted into the Brain Post Orchestrator.',
      fields: ['id', 'source', 'eventType', 'occurredAt', 'payloadSummary', 'projectId', 'priority', 'suggestedPostTypes'],
      implementedInBrain: true,
      implementedInProvider: false,
      executionEnabled: false,
    },
    {
      id: 'PostDraft',
      name: 'Post Draft',
      status: 'defined',
      version: 'p1',
      owner: 'brain',
      summary: 'Read-only draft state synthesized before any approval.',
      fields: ['id', 'eventId', 'platform', 'format', 'copy', 'threadItems', 'assetRequests', 'optimizationRequests', 'status', 'approvalRequired', 'approvalId'],
      implementedInBrain: true,
      implementedInProvider: false,
      executionEnabled: false,
    },
    {
      id: 'ProoflyAssetRequest',
      name: 'Social Proof Asset Request',
      status: 'defined',
      version: 'p1',
      owner: 'proofly',
      summary: 'Typed request for social proof asset generation.',
      fields: ['id', 'projectId', 'assetType', 'templateId', 'data', 'brand', 'outputFormat'],
      implementedInBrain: true,
      implementedInProvider: false,
      executionEnabled: false,
    },
    {
      id: 'ProoflyAssetResult',
      name: 'Social Proof Asset Result',
      status: 'defined',
      version: 'p1',
      owner: 'proofly',
      summary: 'Typed response contract for social proof asset outputs.',
      fields: ['id', 'requestId', 'status', 'previewPath', 'assetPath', 'metadata'],
      implementedInBrain: true,
      implementedInProvider: false,
      executionEnabled: false,
    },
    {
      id: 'XgrowOptimizationRequest',
      name: 'Growth Optimization Request',
      status: 'defined',
      version: 'p1',
      owner: 'xgrow',
      summary: 'Typed request for growth hook, copy, and timing optimization.',
      fields: ['id', 'eventId', 'platform', 'draftId', 'signals', 'audience', 'constraints'],
      implementedInBrain: true,
      implementedInProvider: false,
      executionEnabled: false,
    },
    {
      id: 'XgrowOptimizationResult',
      name: 'Growth Optimization Result',
      status: 'defined',
      version: 'p1',
      owner: 'xgrow',
      summary: 'Typed response contract for growth optimization guidance.',
      fields: ['id', 'requestId', 'status', 'recommendedHook', 'recommendedCopy', 'timingRecommendation', 'viralityScore', 'riskNotes'],
      implementedInBrain: true,
      implementedInProvider: false,
      executionEnabled: false,
    },
    {
      id: 'PostScheduleItem',
      name: 'Post Schedule Item',
      status: 'defined',
      version: 'p1',
      owner: 'brain',
      summary: 'Canonical schedule record for future Brain-owned orchestration.',
      fields: ['id', 'draftId', 'scheduledAt', 'platform', 'approvalId', 'status'],
      implementedInBrain: true,
      implementedInProvider: false,
      executionEnabled: false,
    },
    {
      id: 'PostAnalyticsResult',
      name: 'Post Analytics Result',
      status: 'draft',
      version: 'p1',
      owner: 'brain',
      summary: 'Passive analytics feedback payload for later optimization loops.',
      fields: ['id', 'postId', 'impressions', 'clicks', 'engagementRate', 'notes'],
      implementedInBrain: false,
      implementedInProvider: false,
      executionEnabled: false,
    },
  ],
};

const INTEGRATIONS: BrainCorePostOrchestratorIntegrationsResponse = {
  integrations: [
    {
      id: 'proofly-social-proof-assets',
      provider: 'proofly',
      name: 'Social Proof Asset Flow',
      internalName: 'Proofly Social Proof Assets',
      legacySource: 'proofly',
      status: 'contract-defined',
      role: 'social proof asset flow',
      summary: 'Legacy Proofly supplies branded proof cards, templates, and preview/export assets.',
      contractIds: ['ProoflyAssetRequest', 'ProoflyAssetResult'],
      executionEnabled: false,
      publishingEnabled: false,
      schedulingEnabled: false,
      safety: {
        readsSecrets: false,
        usesCookies: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresApproval: false,
      },
      blockers: ['Legacy asset system migration remains read-only'],
      nextSafeStep: 'Keep the social proof asset flow neutral and read-only.',
    },
    {
      id: 'xgrow-growth-optimization',
      provider: 'xgrow',
      name: 'Growth Optimization Flow',
      internalName: 'Xgrow Growth Optimization',
      legacySource: 'xgrow',
      status: 'contract-defined',
      role: 'growth optimization flow',
      summary: 'Legacy Xgrow provides copy hooks, timing, virality, segmentation, and engagement guidance.',
      contractIds: ['XgrowOptimizationRequest', 'XgrowOptimizationResult'],
      executionEnabled: false,
      publishingEnabled: false,
      schedulingEnabled: false,
      safety: {
        readsSecrets: false,
        usesCookies: true,
        usesPlaywright: true,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresApproval: true,
      },
      blockers: ['Security review required before any Playwright posting exposure', 'No publish path is enabled in Brain P1'],
      nextSafeStep: 'Treat cookies and Playwright usage as risk metadata only.',
    },
    {
      id: 'brain-post-orchestrator-core',
      provider: 'brain',
      name: 'Brain Post Orchestrator Core',
      status: 'planned',
      role: 'canonical orchestration runtime',
      summary: 'Brain owns the read-only canonical post orchestration surface in P1.',
      contractIds: ['PostEvent', 'PostDraft', 'PostScheduleItem', 'PostAnalyticsResult'],
      executionEnabled: false,
      publishingEnabled: false,
      schedulingEnabled: false,
      safety: {
        readsSecrets: false,
        usesCookies: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresApproval: true,
      },
      blockers: ['Publishing is disabled', 'Scheduling is disabled'],
      nextSafeStep: 'Validate typed fixtures and keep the runtime read-only.',
    },
  ],
};

const RECOVERY: BrainCorePostOrchestratorRecoveryResponse = {
  items: [
    {
      id: 'post-orchestrator-not-implemented',
      severity: 'warning',
      source: 'brain',
      title: 'Post Orchestrator is read-only scaffold only',
      summary: 'Canonical Brain orchestration exists as a status surface, not execution logic.',
      blocker: 'No execution path in P1',
      nextSafeStep: 'Keep the scaffold visible while contracts are validated.',
      canAutoFix: false,
      executionEnabled: false,
    },
    {
      id: 'social-proof-asset-flow-not-integrated',
      severity: 'warning',
      source: 'proofly',
      title: 'Social proof asset flow not integrated',
      summary: 'Legacy asset migration remains visible, but Brain does not execute against it in P1.',
      blocker: 'Legacy asset flow is contract-defined only',
      nextSafeStep: 'Preserve the social proof asset flow as read-only.',
      canAutoFix: false,
      executionEnabled: false,
    },
    {
      id: 'growth-optimization-flow-not-integrated',
      severity: 'warning',
      source: 'xgrow',
      title: 'Growth optimization flow not integrated',
      summary: 'Legacy growth migration remains visible, but Brain does not execute against it in P1.',
      blocker: 'Legacy growth flow is contract-defined only',
      nextSafeStep: 'Preserve the growth optimization flow as read-only.',
      canAutoFix: false,
      executionEnabled: false,
    },
    {
      id: 'publishing-disabled',
      severity: 'error',
      source: 'platform',
      title: 'Publishing disabled',
      summary: 'Publishing is intentionally disabled in Brain P1.',
      blocker: 'No post is scheduled or published from Brain in P1',
      nextSafeStep: 'Keep publishing disabled until a later execution phase.',
      canAutoFix: false,
      executionEnabled: false,
    },
    {
      id: 'growth-optimization-playwright-security-review-required',
      severity: 'error',
      source: 'xgrow',
      title: 'Growth optimization Playwright security review required',
      summary: 'Browser posting risk is metadata only and must be reviewed before exposure.',
      blocker: 'Playwright/cookie exposure needs security review',
      nextSafeStep: 'Require a security review before any posting path is exposed.',
      canAutoFix: false,
      executionEnabled: false,
    },
    {
      id: 'no-dual-run-validation-yet',
      severity: 'info',
      source: 'contract',
      title: 'No dual-run validation yet',
      summary: 'Brain and the legacy migration sources have not been validated in dual-run mode.',
      blocker: 'No dual-run evidence exists',
      nextSafeStep: 'Add fixture-backed validation before any future execution work.',
      canAutoFix: false,
      executionEnabled: false,
    },
  ],
};

const FLOW_FIXTURES: BrainCorePostFlowFixturesResponse = {
  flows: [
    {
      id: 'x-post-flow',
      name: 'X Post Flow',
      platform: 'x',
      status: 'stubbed',
      summary: 'Read-only X post planning flow for short announcements and thread variants.',
      eventTypes: ['github-commit', 'release-published', 'product-milestone', 'video-rendered'],
      outputFormats: ['single-post', 'thread'],
      usesSocialProofAssetFlow: true,
      usesGrowthOptimizationFlow: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Publishing is disabled', 'Flow is fixture-only in P2'],
      nextSafeStep: 'Keep the X flow as a stubbed planning surface.',
    },
    {
      id: 'github-post-flow',
      name: 'GitHub Post Flow',
      platform: 'github',
      status: 'planned',
      summary: 'Read-only GitHub release and repo-launch announcement flow.',
      eventTypes: ['release-published', 'pr-merged', 'repo-launch'],
      outputFormats: ['release-note', 'discussion-post'],
      usesSocialProofAssetFlow: false,
      usesGrowthOptimizationFlow: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Publishing is disabled', 'No live GitHub posting execution'],
      nextSafeStep: 'Keep GitHub as a fixture-backed planning flow.',
    },
    {
      id: 'linkedin-post-flow',
      name: 'LinkedIn Post Flow',
      platform: 'linkedin',
      status: 'stubbed',
      summary: 'Read-only professional announcement flow for milestones and case studies.',
      eventTypes: ['product-milestone', 'release-published', 'case-study'],
      outputFormats: ['single-post', 'carousel'],
      usesSocialProofAssetFlow: true,
      usesGrowthOptimizationFlow: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Publishing is disabled', 'Flow remains read-only'],
      nextSafeStep: 'Use LinkedIn fixtures only for preview and planning.',
    },
    {
      id: 'facebook-post-flow',
      name: 'Facebook Post Flow',
      platform: 'facebook',
      status: 'planned',
      summary: 'Read-only broad distribution planning flow for video and blog content.',
      eventTypes: ['video-rendered', 'blog-published', 'product-milestone'],
      outputFormats: ['single-post', 'short-video-caption'],
      usesSocialProofAssetFlow: false,
      usesGrowthOptimizationFlow: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep Facebook as a planning-only stub.',
    },
    {
      id: 'youtube-post-flow',
      name: 'YouTube Post Flow',
      platform: 'youtube',
      status: 'ready-read-only',
      summary: 'Read-only video description and caption planning flow.',
      eventTypes: ['video-rendered'],
      outputFormats: ['short-video-caption', 'description-summary'],
      usesSocialProofAssetFlow: false,
      usesGrowthOptimizationFlow: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep YouTube descriptions and captions read-only.',
    },
    {
      id: 'blog-post-flow',
      name: 'Blog Post Flow',
      platform: 'blog',
      status: 'planned',
      summary: 'Read-only blog summary and release note planning flow.',
      eventTypes: ['research-summary', 'product-update', 'release-published'],
      outputFormats: ['blog-summary'],
      usesSocialProofAssetFlow: false,
      usesGrowthOptimizationFlow: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Publishing is disabled'],
      nextSafeStep: 'Keep blog flows as preview-only fixtures.',
    },
    {
      id: 'social-proof-asset-flow',
      name: 'Social Proof Asset Flow',
      platform: 'internal',
      status: 'ready-read-only',
      summary: 'Internal asset flow for milestone cards and social-proof previews.',
      eventTypes: ['mrr-milestone', 'github-achievement', 'repo-launch', 'product-milestone'],
      outputFormats: ['proof-card', 'milestone-card'],
      usesSocialProofAssetFlow: true,
      usesGrowthOptimizationFlow: false,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Internal fixture flow only'],
      nextSafeStep: 'Keep the asset flow internal and read-only.',
    },
    {
      id: 'growth-optimization-flow',
      name: 'Growth Optimization Flow',
      platform: 'internal',
      status: 'stubbed',
      summary: 'Internal optimization flow for hook, timing, and hashtag guidance.',
      eventTypes: ['draft-created', 'post-review-requested'],
      outputFormats: ['hook-options', 'timing-recommendation', 'hashtag-set'],
      usesSocialProofAssetFlow: false,
      usesGrowthOptimizationFlow: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      blockers: ['Internal fixture flow only'],
      nextSafeStep: 'Keep the optimization flow internal and read-only.',
    },
  ],
};

const DRAFT_FIXTURES: BrainCorePostDraftFixturesResponse = {
  drafts: [
    {
      id: 'x-release-thread-fixture',
      flowId: 'x-post-flow',
      platform: 'x',
      sourceEventType: 'release-published',
      title: 'Release thread fixture',
      copyPreview: 'Fixture copy for a release thread. This is preview-only.',
      format: 'thread',
      status: 'fixture',
      approvalRequired: true,
      assetFlowRequired: false,
      optimizationFlowRequired: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      safety: {
        generatedFromFixture: true,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
      },
    },
    {
      id: 'github-release-note-fixture',
      flowId: 'github-post-flow',
      platform: 'github',
      sourceEventType: 'release-published',
      title: 'GitHub release note fixture',
      copyPreview: 'Fixture release note for a GitHub publication preview.',
      format: 'release-note',
      status: 'preview',
      approvalRequired: true,
      assetFlowRequired: false,
      optimizationFlowRequired: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      safety: {
        generatedFromFixture: true,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
      },
    },
    {
      id: 'linkedin-milestone-fixture',
      flowId: 'linkedin-post-flow',
      platform: 'linkedin',
      sourceEventType: 'product-milestone',
      title: 'LinkedIn milestone fixture',
      copyPreview: 'Fixture milestone announcement for a professional audience.',
      format: 'carousel',
      status: 'requires-approval',
      approvalRequired: true,
      assetFlowRequired: true,
      optimizationFlowRequired: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      safety: {
        generatedFromFixture: true,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
      },
    },
    {
      id: 'youtube-video-caption-fixture',
      flowId: 'youtube-post-flow',
      platform: 'youtube',
      sourceEventType: 'video-rendered',
      title: 'YouTube video caption fixture',
      copyPreview: 'Fixture caption for a video render preview.',
      format: 'short-video-caption',
      status: 'fixture',
      approvalRequired: true,
      assetFlowRequired: false,
      optimizationFlowRequired: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      safety: {
        generatedFromFixture: true,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
      },
    },
    {
      id: 'social-proof-card-fixture',
      flowId: 'social-proof-asset-flow',
      platform: 'internal',
      sourceEventType: 'github-achievement',
      title: 'Social proof card fixture',
      copyPreview: 'Fixture proof card copy for internal preview.',
      format: 'single-post',
      status: 'fixture',
      approvalRequired: true,
      assetFlowRequired: true,
      optimizationFlowRequired: false,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      safety: {
        generatedFromFixture: true,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
      },
    },
  ],
};

const EVENT_FIXTURES: BrainCorePostEventFixturesResponse = {
  events: [
    {
      id: 'github-release-event-fixture',
      source: 'github',
      eventType: 'release-published',
      occurredAt: '2026-05-18T09:00:00.000Z',
      projectId: 'brain',
      title: 'GitHub release event fixture',
      payloadSummary: 'Fixture release event from GitHub for preview-only planning.',
      priority: 'high',
      suggestedPlatforms: ['x', 'github', 'linkedin'],
      suggestedFlowIds: ['x-post-flow', 'github-post-flow', 'linkedin-post-flow'],
      safety: {
        fixtureOnly: true,
        readsExternalPlatform: false,
        writesExternalPlatform: false,
        writesToMind: false,
        containsSecrets: false,
      },
    },
    {
      id: 'product-milestone-event-fixture',
      source: 'product',
      eventType: 'product-milestone',
      occurredAt: '2026-05-18T09:05:00.000Z',
      projectId: 'brain',
      title: 'Product milestone event fixture',
      payloadSummary: 'Fixture milestone event for cross-platform announcement planning.',
      priority: 'normal',
      suggestedPlatforms: ['x', 'linkedin', 'facebook', 'internal'],
      suggestedFlowIds: ['x-post-flow', 'linkedin-post-flow', 'facebook-post-flow', 'social-proof-asset-flow', 'growth-optimization-flow'],
      safety: {
        fixtureOnly: true,
        readsExternalPlatform: false,
        writesExternalPlatform: false,
        writesToMind: false,
        containsSecrets: false,
      },
    },
    {
      id: 'video-rendered-event-fixture',
      source: 'video-orchestrator',
      eventType: 'video-rendered',
      occurredAt: '2026-05-18T09:10:00.000Z',
      projectId: 'brain',
      title: 'Video rendered event fixture',
      payloadSummary: 'Fixture video render event for caption and distribution planning.',
      priority: 'normal',
      suggestedPlatforms: ['youtube', 'facebook', 'x'],
      suggestedFlowIds: ['youtube-post-flow', 'facebook-post-flow', 'x-post-flow', 'growth-optimization-flow'],
      safety: {
        fixtureOnly: true,
        readsExternalPlatform: false,
        writesExternalPlatform: false,
        writesToMind: false,
        containsSecrets: false,
      },
    },
    {
      id: 'blog-published-event-fixture',
      source: 'blog',
      eventType: 'blog-published',
      occurredAt: '2026-05-18T09:15:00.000Z',
      projectId: 'brain',
      title: 'Blog published event fixture',
      payloadSummary: 'Fixture blog publication event for preview-only planning.',
      priority: 'normal',
      suggestedPlatforms: ['blog', 'linkedin', 'x'],
      suggestedFlowIds: ['blog-post-flow', 'linkedin-post-flow', 'x-post-flow', 'growth-optimization-flow'],
      safety: {
        fixtureOnly: true,
        readsExternalPlatform: false,
        writesExternalPlatform: false,
        writesToMind: false,
        containsSecrets: false,
      },
    },
    {
      id: 'manual-social-proof-event-fixture',
      source: 'manual',
      eventType: 'mrr-milestone',
      occurredAt: '2026-05-18T09:20:00.000Z',
      projectId: 'brain',
      title: 'Manual social proof event fixture',
      payloadSummary: 'Fixture internal milestone note for social proof preview planning.',
      priority: 'low',
      suggestedPlatforms: ['internal', 'x', 'linkedin'],
      suggestedFlowIds: ['social-proof-asset-flow', 'x-post-flow', 'linkedin-post-flow'],
      safety: {
        fixtureOnly: true,
        readsExternalPlatform: false,
        writesExternalPlatform: false,
        writesToMind: false,
        containsSecrets: false,
      },
    },
  ],
};

const ANALYTICS_FIXTURES: BrainCorePostAnalyticsFixturesResponse = {
  analytics: [
    {
      id: 'x-release-thread-analytics-fixture',
      platform: 'x',
      flowId: 'x-post-flow',
      draftPlanId: 'dry-run-github-release-event-fixture-x-post-flow',
      title: 'X release thread analytics fixture',
      capturedAt: '2026-05-18T10:00:00.000Z',
      source: 'fixture',
      metrics: {
        impressions: 12400,
        clicks: 420,
        likes: 310,
        comments: 18,
        shares: 42,
        saves: 12,
        watchSeconds: 0,
        ctr: 0.0339,
        engagementRate: 0.028,
      },
      interpretation: 'Strong short-form reach with moderate click-through for a release thread preview.',
      feedbackForFlow: 'Keep the opening hook concise and highlight the release outcome sooner.',
      safety: {
        fixtureOnly: true,
        callsExternalAnalyticsApi: false,
        readsCookies: false,
        readsSecrets: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
    {
      id: 'linkedin-milestone-analytics-fixture',
      platform: 'linkedin',
      flowId: 'linkedin-post-flow',
      draftPlanId: 'dry-run-product-milestone-event-fixture-linkedin-post-flow',
      title: 'LinkedIn milestone analytics fixture',
      capturedAt: '2026-05-18T10:05:00.000Z',
      source: 'fixture',
      metrics: {
        impressions: 8300,
        clicks: 260,
        likes: 190,
        comments: 27,
        shares: 19,
        saves: 21,
        watchSeconds: 0,
        ctr: 0.0313,
        engagementRate: 0.031,
      },
      interpretation: 'Professional audience response is steady; the milestone framing performs well.',
      feedbackForFlow: 'Keep the milestone narrative and add a sharper business outcome line.',
      safety: {
        fixtureOnly: true,
        callsExternalAnalyticsApi: false,
        readsCookies: false,
        readsSecrets: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
    {
      id: 'youtube-video-caption-analytics-fixture',
      platform: 'youtube',
      flowId: 'youtube-post-flow',
      draftPlanId: 'dry-run-video-rendered-event-fixture-youtube-post-flow',
      title: 'YouTube video caption analytics fixture',
      capturedAt: '2026-05-18T10:10:00.000Z',
      source: 'fixture',
      metrics: {
        impressions: 15200,
        clicks: 580,
        likes: 280,
        comments: 12,
        shares: 34,
        saves: 5,
        watchSeconds: 7420,
        ctr: 0.0382,
        engagementRate: 0.023,
      },
      interpretation: 'Video surfaces drive the most watch-time when the caption is direct and specific.',
      feedbackForFlow: 'Preserve the short caption and link the description to the strongest visual proof.',
      safety: {
        fixtureOnly: true,
        callsExternalAnalyticsApi: false,
        readsCookies: false,
        readsSecrets: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
    {
      id: 'github-release-note-analytics-fixture',
      platform: 'github',
      flowId: 'github-post-flow',
      draftPlanId: 'dry-run-github-release-event-fixture-github-post-flow',
      title: 'GitHub release note analytics fixture',
      capturedAt: '2026-05-18T10:15:00.000Z',
      source: 'fixture',
      metrics: {
        impressions: 5400,
        clicks: 210,
        likes: 76,
        comments: 9,
        shares: 14,
        saves: 31,
        watchSeconds: 0,
        ctr: 0.0389,
        engagementRate: 0.021,
      },
      interpretation: 'Developer-facing release notes earn saves and clicks when the summary is precise.',
      feedbackForFlow: 'Keep the release note terse and highlight what changed first.',
      safety: {
        fixtureOnly: true,
        callsExternalAnalyticsApi: false,
        readsCookies: false,
        readsSecrets: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
    {
      id: 'social-proof-card-analytics-fixture',
      platform: 'internal',
      flowId: 'social-proof-asset-flow',
      draftPlanId: 'dry-run-manual-social-proof-event-fixture-social-proof-asset-flow',
      title: 'Social proof card analytics fixture',
      capturedAt: '2026-05-18T10:20:00.000Z',
      source: 'fixture',
      metrics: {
        impressions: 2400,
        clicks: 92,
        likes: 55,
        comments: 4,
        shares: 8,
        saves: 17,
        watchSeconds: 0,
        ctr: 0.0383,
        engagementRate: 0.036,
      },
      interpretation: 'Internal proof assets validate best when paired with a concrete milestone claim.',
      feedbackForFlow: 'Use stronger proof language and preserve the asset-first structure.',
      safety: {
        fixtureOnly: true,
        callsExternalAnalyticsApi: false,
        readsCookies: false,
        readsSecrets: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
  ],
};

const PLATFORM_POLICIES: BrainCorePostPlatformPoliciesResponse = {
  policies: [
    {
      id: 'platform-policy-x',
      platform: 'x',
      label: 'X',
      status: 'review-required',
      publishingMode: 'browser-automation-prohibited',
      riskLevel: 'high',
      summary: 'X remains blocked for browser automation and any live publishing path.',
      allowedInCurrentPhase: {
        fixturePreview: true,
        draftReview: true,
        schedulePreview: true,
        manualExport: false,
        apiPublishing: false,
        browserAutomation: false,
      },
      securityReview: {
        required: true,
        completed: false,
        reason: 'Browser automation and cookie-based posting are not enabled.',
        blockers: [
          'Browser automation is not enabled.',
          'No cookies are read.',
          'No Playwright posting is exposed.',
          'API-based publishing would require separate approval and security review.',
        ],
      },
      complianceNotes: [
        'Browser automation is prohibited until security review completes.',
        'API publishing remains disabled.',
      ],
      nextSafeStep: 'Keep X policy blocked until security and compliance review is complete.',
      safety: {
        readsCookies: false,
        readsSecrets: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
      },
    },
    {
      id: 'platform-policy-github',
      platform: 'github',
      label: 'GitHub',
      status: 'review-required',
      publishingMode: 'api-required',
      riskLevel: 'medium',
      summary: 'GitHub release and discussion publishing require future token and security review.',
      allowedInCurrentPhase: {
        fixturePreview: true,
        draftReview: true,
        schedulePreview: true,
        manualExport: true,
        apiPublishing: false,
        browserAutomation: false,
      },
      securityReview: {
        required: true,
        completed: false,
        reason: 'Release/discussion publishing is not wired to a live GitHub integration.',
        blockers: ['API publishing is disabled.'],
      },
      complianceNotes: ['Future token and write scopes require review.'],
      nextSafeStep: 'Keep GitHub policy in review-only preview mode.',
      safety: {
        readsCookies: false,
        readsSecrets: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
      },
    },
    {
      id: 'platform-policy-linkedin',
      platform: 'linkedin',
      label: 'LinkedIn',
      status: 'review-required',
      publishingMode: 'pending-security-review',
      riskLevel: 'high',
      summary: 'LinkedIn remains preview-only until an approved integration and security review exist.',
      allowedInCurrentPhase: {
        fixturePreview: true,
        draftReview: true,
        schedulePreview: true,
        manualExport: false,
        apiPublishing: false,
        browserAutomation: false,
      },
      securityReview: {
        required: true,
        completed: false,
        reason: 'No LinkedIn API publishing or browser automation is enabled.',
        blockers: ['No LinkedIn integration is enabled.'],
      },
      complianceNotes: ['Professional distribution remains read-only.'],
      nextSafeStep: 'Keep LinkedIn policy under review before any future integration work.',
      safety: {
        readsCookies: false,
        readsSecrets: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
      },
    },
    {
      id: 'platform-policy-facebook',
      platform: 'facebook',
      label: 'Facebook',
      status: 'review-required',
      publishingMode: 'pending-security-review',
      riskLevel: 'high',
      summary: 'Facebook remains preview-only until a supported publishing integration exists.',
      allowedInCurrentPhase: {
        fixturePreview: true,
        draftReview: true,
        schedulePreview: true,
        manualExport: false,
        apiPublishing: false,
        browserAutomation: false,
      },
      securityReview: {
        required: true,
        completed: false,
        reason: 'No Facebook publishing path is enabled.',
        blockers: ['Facebook publishing is disabled.'],
      },
      complianceNotes: ['Distribution planning only.'],
      nextSafeStep: 'Keep Facebook policy preview-only.',
      safety: {
        readsCookies: false,
        readsSecrets: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
      },
    },
    {
      id: 'platform-policy-youtube',
      platform: 'youtube',
      label: 'YouTube',
      status: 'review-required',
      publishingMode: 'pending-security-review',
      riskLevel: 'high',
      summary: 'YouTube remains preview-only until a supported publishing integration exists.',
      allowedInCurrentPhase: {
        fixturePreview: true,
        draftReview: true,
        schedulePreview: true,
        manualExport: false,
        apiPublishing: false,
        browserAutomation: false,
      },
      securityReview: {
        required: true,
        completed: false,
        reason: 'No YouTube publishing path is enabled.',
        blockers: ['YouTube publishing is disabled.'],
      },
      complianceNotes: ['Video caption and description planning only.'],
      nextSafeStep: 'Keep YouTube policy preview-only.',
      safety: {
        readsCookies: false,
        readsSecrets: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
      },
    },
    {
      id: 'platform-policy-blog',
      platform: 'blog',
      label: 'Blog',
      status: 'approved-for-manual-export',
      publishingMode: 'manual-export-only',
      riskLevel: 'low',
      summary: 'Blog output can remain manual-export oriented while Brain stays read-only.',
      allowedInCurrentPhase: {
        fixturePreview: true,
        draftReview: true,
        schedulePreview: true,
        manualExport: true,
        apiPublishing: false,
        browserAutomation: false,
      },
      securityReview: {
        required: false,
        completed: false,
        reason: 'Manual export only; no automated publishing integration exists.',
        blockers: [],
      },
      complianceNotes: ['Manual export is the conservative path for blog content.'],
      nextSafeStep: 'Keep blog policy on manual-export-only preview paths.',
      safety: {
        readsCookies: false,
        readsSecrets: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
      },
    },
    {
      id: 'platform-policy-internal',
      platform: 'internal',
      label: 'Internal',
      status: 'approved-for-preview',
      publishingMode: 'disabled',
      riskLevel: 'low',
      summary: 'Internal flows stay preview-only for social proof and growth optimization surfaces.',
      allowedInCurrentPhase: {
        fixturePreview: true,
        draftReview: true,
        schedulePreview: true,
        manualExport: false,
        apiPublishing: false,
        browserAutomation: false,
      },
      securityReview: {
        required: false,
        completed: false,
        reason: 'Internal flows do not publish externally.',
        blockers: [],
      },
      complianceNotes: ['Internal asset and optimization flows remain read-only.'],
      nextSafeStep: 'Keep internal policy restricted to preview and review surfaces.',
      safety: {
        readsCookies: false,
        readsSecrets: false,
        usesPlaywright: false,
        writesExternalPlatform: false,
        writesToMind: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
      },
    },
  ],
};

const DECOMMISSION_READINESS: BrainCorePostDecommissionReadinessResponse = {
  items: [
    {
      id: 'legacy-asset-system',
      target: 'legacy-asset-system',
      label: 'Legacy Asset System',
      status: 'blocked',
      summary: 'Legacy Proofly migration remains blocked until the asset flow is validated end-to-end.',
      gates: [
        {
          id: 'social-proof-asset-flow-contract-defined',
          label: 'Social proof asset flow contract defined',
          passed: true,
          required: true,
          summary: 'Read-only asset flow contract exists.',
          nextSafeStep: 'Keep the contract read-only.',
        },
        {
          id: 'asset-preview-fixtures-exist',
          label: 'Asset preview fixtures exist',
          passed: true,
          required: true,
          summary: 'Fixture asset previews are available.',
          nextSafeStep: 'Keep asset preview fixtures read-only.',
        },
        {
          id: 'dashboard-visibility-exists',
          label: 'Dashboard visibility exists',
          passed: true,
          required: true,
          summary: 'Brain Console exposes the asset flow in read-only UI.',
          nextSafeStep: 'Keep dashboard visibility read-only.',
        },
        {
          id: 'dual-run-validation-complete',
          label: 'Dual-run validation complete',
          passed: false,
          required: true,
          summary: 'No dual-run validation has been performed.',
          nextSafeStep: 'Validate a future execution phase separately.',
        },
        {
          id: 'user-approval',
          label: 'Explicit user approval',
          passed: false,
          required: true,
          summary: 'No explicit decommission approval has been requested.',
          nextSafeStep: 'Request explicit approval before any decommission work.',
        },
      ],
      blockerCount: 2,
      nextSafeStep: 'Keep the legacy asset system in read-only migration mode.',
      safety: {
        decommissionStarted: false,
        deletesFiles: false,
        modifiesLegacyRepo: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresExplicitUserApproval: true,
      },
    },
    {
      id: 'legacy-growth-system',
      target: 'legacy-growth-system',
      label: 'Legacy Growth System',
      status: 'blocked',
      summary: 'Legacy Xgrow migration remains blocked until policy review and dual-run validation complete.',
      gates: [
        {
          id: 'growth-optimization-flow-contract-defined',
          label: 'Growth optimization flow contract defined',
          passed: true,
          required: true,
          summary: 'Read-only growth optimization flow contract exists.',
          nextSafeStep: 'Keep the contract read-only.',
        },
        {
          id: 'optimization-fixtures-exist',
          label: 'Optimization fixtures exist',
          passed: true,
          required: true,
          summary: 'Fixture optimization previews are available.',
          nextSafeStep: 'Keep optimization fixtures read-only.',
        },
        {
          id: 'platform-policy-review-complete',
          label: 'Platform policy review complete',
          passed: false,
          required: true,
          summary: 'Platform policy review remains incomplete.',
          nextSafeStep: 'Complete platform policy review before decommission steps.',
        },
        {
          id: 'dual-run-validation-complete',
          label: 'Dual-run validation complete',
          passed: false,
          required: true,
          summary: 'No dual-run validation has been performed.',
          nextSafeStep: 'Validate a future execution phase separately.',
        },
        {
          id: 'user-approval',
          label: 'Explicit user approval',
          passed: false,
          required: true,
          summary: 'No explicit decommission approval has been requested.',
          nextSafeStep: 'Request explicit approval before any decommission work.',
        },
      ],
      blockerCount: 3,
      nextSafeStep: 'Keep the legacy growth system in read-only migration mode.',
      safety: {
        decommissionStarted: false,
        deletesFiles: false,
        modifiesLegacyRepo: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresExplicitUserApproval: true,
      },
    },
    {
      id: 'legacy-schedulers',
      target: 'legacy-schedulers',
      label: 'Legacy Schedulers',
      status: 'blocked',
      summary: 'Legacy schedulers remain disabled while schedule preview stays preview-only.',
      gates: [
        {
          id: 'schedule-preview-exists',
          label: 'Schedule preview exists',
          passed: true,
          required: true,
          summary: 'Schedule preview objects are available.',
          nextSafeStep: 'Keep schedule preview read-only.',
        },
        {
          id: 'real-scheduler-disabled',
          label: 'Real scheduler disabled',
          passed: true,
          required: true,
          summary: 'Real scheduler execution remains disabled.',
          nextSafeStep: 'Keep scheduler execution disabled.',
        },
        {
          id: 'approval-policy-defined',
          label: 'Approval policy defined',
          passed: false,
          required: true,
          summary: 'No decommission approval policy has been finalized.',
          nextSafeStep: 'Define approval policy before decommission work.',
        },
        {
          id: 'dual-run-validation-complete',
          label: 'Dual-run validation complete',
          passed: false,
          required: true,
          summary: 'No dual-run validation has been performed.',
          nextSafeStep: 'Validate scheduling in a separate phase.',
        },
        {
          id: 'user-approval',
          label: 'Explicit user approval',
          passed: false,
          required: true,
          summary: 'No explicit decommission approval has been requested.',
          nextSafeStep: 'Request explicit approval before any decommission work.',
        },
      ],
      blockerCount: 3,
      nextSafeStep: 'Keep schedulers disabled and preview-only.',
      safety: {
        decommissionStarted: false,
        deletesFiles: false,
        modifiesLegacyRepo: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresExplicitUserApproval: true,
      },
    },
    {
      id: 'legacy-publishing',
      target: 'legacy-publishing',
      label: 'Legacy Publishing',
      status: 'blocked',
      summary: 'Legacy publishing remains blocked until platform policy and API security reviews complete.',
      gates: [
        {
          id: 'publishing-disabled',
          label: 'Publishing disabled',
          passed: true,
          required: true,
          summary: 'Publishing is currently disabled.',
          nextSafeStep: 'Keep publishing disabled.',
        },
        {
          id: 'platform-policy-review-complete',
          label: 'Platform policy review complete',
          passed: false,
          required: true,
          summary: 'Platform policy review is incomplete.',
          nextSafeStep: 'Complete platform policy review before decommission steps.',
        },
        {
          id: 'api-security-review-complete',
          label: 'API security review complete',
          passed: false,
          required: true,
          summary: 'API security review has not been completed.',
          nextSafeStep: 'Complete API security review before any future publishing path.',
        },
        {
          id: 'user-approval',
          label: 'Explicit user approval',
          passed: false,
          required: true,
          summary: 'No explicit decommission approval has been requested.',
          nextSafeStep: 'Request explicit approval before any decommission work.',
        },
      ],
      blockerCount: 3,
      nextSafeStep: 'Keep publishing disabled and review platform policy.',
      safety: {
        decommissionStarted: false,
        deletesFiles: false,
        modifiesLegacyRepo: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresExplicitUserApproval: true,
      },
    },
    {
      id: 'legacy-analytics',
      target: 'legacy-analytics',
      label: 'Legacy Analytics',
      status: 'blocked',
      summary: 'Legacy analytics feedback stays fixture-only while external analytics calls remain disabled.',
      gates: [
        {
          id: 'analytics-fixtures-exist',
          label: 'Analytics fixtures exist',
          passed: true,
          required: true,
          summary: 'Fixture analytics are available.',
          nextSafeStep: 'Keep analytics fixtures read-only.',
        },
        {
          id: 'external-analytics-api-disabled',
          label: 'External analytics API disabled',
          passed: true,
          required: true,
          summary: 'External analytics APIs remain disabled.',
          nextSafeStep: 'Keep external analytics disabled.',
        },
        {
          id: 'feedback-loop-contract-defined',
          label: 'Feedback loop contract defined',
          passed: false,
          required: true,
          summary: 'Feedback loop contract is partial.',
          nextSafeStep: 'Define feedback loop contract in a later phase.',
        },
        {
          id: 'dual-run-validation-complete',
          label: 'Dual-run validation complete',
          passed: false,
          required: true,
          summary: 'No dual-run validation has been performed.',
          nextSafeStep: 'Validate analytics feedback in a separate phase.',
        },
        {
          id: 'user-approval',
          label: 'Explicit user approval',
          passed: false,
          required: true,
          summary: 'No explicit decommission approval has been requested.',
          nextSafeStep: 'Request explicit approval before any decommission work.',
        },
      ],
      blockerCount: 3,
      nextSafeStep: 'Keep analytics fixture-only and avoid external calls.',
      safety: {
        decommissionStarted: false,
        deletesFiles: false,
        modifiesLegacyRepo: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresExplicitUserApproval: true,
      },
    },
  ],
  overall: {
    status: 'blocked',
    readyCount: 0,
    blockedCount: 5,
    decommissionStarted: false,
    nextSafeStep: 'Keep legacy orchestration read-only and request explicit approval before any decommission work.',
  },
};

export function readPostOrchestratorStatus(): BrainCorePostOrchestratorStatusResponse {
  return STATUS;
}

export function readPostOrchestratorOverview(): BrainCorePostOrchestratorOverviewResponse {
  const status = readPostOrchestratorStatus();
  const flows = readPostOrchestratorFlowFixtures().flows;
  const events = readPostOrchestratorEventFixtures().events;
  const drafts = readPostOrchestratorDraftFixtures().drafts;
  const reviewQueue = readPostDraftReviewQueue('github-release-event-fixture').queue;
  const schedulePreviewQueue = readPostSchedulePreviewQueue('github-release-event-fixture').queue;
  const analytics = readPostAnalyticsFixtures().analytics;
  const policies = readPostPlatformPolicies().policies;
  const decommission = readPostDecommissionReadiness();
  const guidance = readPostOperatorGuidance();
  const acceptance = readPostAcceptanceChecklist();
  const migration = readPostMigrationParityReport();
  const roadmap = readPostRoadmapCheckpoint();
  const readiness = readPostReadinessScore('github-release-event-fixture').readiness;

  const blockers = [
    overviewBlocker('readiness', 'publishing-disabled', 'Publishing remains disabled', 'blocked', readiness.nextSafeStep),
    overviewBlocker('policy', 'security-review-required', 'Platform security review is incomplete', 'warning', policies.find((policy) => policy.status === 'blocked' || policy.riskLevel === 'blocked')?.nextSafeStep ?? 'Review platform policies.'),
    overviewBlocker('decommission', 'decommission-blocked', 'Decommission remains blocked', 'blocked', decommission.overall.nextSafeStep),
    overviewBlocker('roadmap', 'future-design-gated', 'Future publishing/scheduling design is gated by explicit user approval', 'blocked', roadmap.checkpoint.nextRecommendedPhase),
    overviewBlocker('acceptance', 'acceptance-future-gates-blocked', 'Future publishing and scheduling gates remain blocked', 'warning', acceptance.checklist.nextSafeStep),
  ];

  const counts = {
    flows: flows.length,
    eventFixtures: events.length,
    draftFixtures: drafts.length,
    reviewItems: reviewQueue.itemCount,
    schedulePreviewItems: schedulePreviewQueue.itemCount,
    analyticsFixtures: analytics.length,
    policyItems: policies.length,
    decommissionItems: decommission.items.length,
    guidanceItems: guidance.items.length,
    acceptanceChecks: acceptance.checklist.checks.length,
    migrationCapabilities: migration.report.capabilities.length,
    roadmapPhases: roadmap.checkpoint.phases.length,
  };

  return {
    overview: {
      id: 'post-orchestrator-overview',
      generatedAt: new Date().toISOString(),
      phase: 'preview-checkpoint',
      status: 'blocked',
      summary: 'Brain Core maintains a preview-only Post Orchestrator with no publishing, scheduling, execution, or decommission actions.',
      counts,
      keyStates: {
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        decommissionStarted: false,
        externalApiCallsEnabled: false,
        externalAiCallsEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
      },
      blockers,
      nextSafeStep: 'Review the grouped Post Orchestrator cards and keep future publishing/scheduling design gated by explicit user approval.',
      safety: {
        readOnly: true,
        previewOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        decommissionStarted: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
  };
}

export function readPostOrchestratorContracts(): BrainCorePostOrchestratorContractsResponse {
  return CONTRACTS;
}

export function readPostOrchestratorIntegrations(): BrainCorePostOrchestratorIntegrationsResponse {
  return INTEGRATIONS;
}

export function readPostOrchestratorRecovery(): BrainCorePostOrchestratorRecoveryResponse {
  return RECOVERY;
}

export function readPostOrchestratorFlowFixtures(): BrainCorePostFlowFixturesResponse {
  return FLOW_FIXTURES;
}

export function readPostOrchestratorDraftFixtures(): BrainCorePostDraftFixturesResponse {
  return DRAFT_FIXTURES;
}

export function readPostOrchestratorEventFixtures(): BrainCorePostEventFixturesResponse {
  return EVENT_FIXTURES;
}

export function readPostAnalyticsFixtures(): BrainCorePostAnalyticsFixturesResponse {
  return ANALYTICS_FIXTURES;
}

export function readPostPipelineSummary(eventId: string): BrainCorePostPipelineSummaryResponse {
  const event = EVENT_FIXTURES.events.find((item) => item.id === eventId);
  const dryRun = readPostOrchestratorDryRunPlan(eventId).plan;
  const reviewQueue = readPostDraftReviewQueue(eventId).queue;
  const schedulePreviewQueue = readPostSchedulePreviewQueue(eventId).queue;
  const analytics = readPostAnalyticsFixtures().analytics;
  const generatedAt = new Date().toISOString();

  if (!event) {
    return {
      pipeline: {
        id: `pipeline-${eventId}`,
        eventId,
        title: 'Unknown event fixture',
        status: 'blocked',
        generatedAt,
        steps: [
          buildPipelineStep('event', 'Event', 'missing', 0, 0, 0, 'Unknown event fixture.', 'Use a known event fixture.'),
          buildPipelineStep('dry-run', 'Dry-run', 'missing', 0, 0, 0, 'No dry-run plan is available.', 'Use a known event fixture.'),
          buildPipelineStep('review', 'Review', 'missing', 0, 0, 0, 'No review queue is available.', 'Use a known event fixture.'),
          buildPipelineStep('schedule-preview', 'Schedule Preview', 'missing', 0, 0, 0, 'No schedule preview queue is available.', 'Use a known event fixture.'),
          buildPipelineStep('analytics-feedback', 'Analytics Feedback', 'missing', 0, 0, 0, 'No analytics fixtures are available.', 'Use a known event fixture.'),
          buildPipelineStep('readiness', 'Readiness', 'blocked', 0, 0, 0, 'Readiness cannot be scored without a known event fixture.', 'Use a known event fixture.'),
        ],
        totals: {
          draftCount: 0,
          reviewItemCount: 0,
          schedulePreviewItemCount: 0,
          analyticsFixtureCount: 0,
          blockerCount: 1,
          approvalRequiredCount: 0,
        },
        nextSafeStep: 'Use a known event fixture.',
        blockers: ['Unknown event fixture'],
        safety: {
          endToEndPreviewOnly: true,
          publishingEnabled: false,
          schedulingEnabled: false,
          executionEnabled: false,
          writesExternalPlatform: false,
          writesToMind: false,
          callsExternalApi: false,
          callsExternalAI: false,
          usesCookies: false,
          usesPlaywright: false,
        },
      },
    };
  }

  const dryRunDraftCount = dryRun.drafts.length;
  const reviewItemCount = reviewQueue.items.length;
  const schedulePreviewItemCount = schedulePreviewQueue.items.length;
  const analyticsFixtureCount = analytics.length;
  const blockerCount = dryRun.blockers.length + reviewQueue.blockedCount + schedulePreviewQueue.blockedCount;
  const approvalRequiredCount =
    dryRun.drafts.filter((draft) => draft.approvalRequired).length +
    reviewQueue.items.filter((item) => item.approvalRequired).length +
    schedulePreviewQueue.items.filter((item) => item.approvalRequired).length;
  const blocked = blockerCount > 0 || dryRun.status === 'blocked' || reviewQueue.status === 'blocked' || schedulePreviewQueue.status === 'blocked';

  const steps = [
    buildPipelineStep(
      'event',
      'Event',
      'available',
      1,
      0,
      0,
      `Fixture event available: ${event.title}.`,
      'Move to dry-run planning.',
    ),
    buildPipelineStep(
      'dry-run',
      'Dry-run',
      dryRun.status === 'preview' ? 'preview' : 'blocked',
      dryRunDraftCount,
      dryRun.blockers.length,
      dryRunDraftCount,
      dryRun.status === 'preview'
        ? 'Preview-only drafts generated from fixture data.'
        : 'Dry-run is blocked by fixture gaps.',
      dryRun.nextSafeStep,
    ),
    buildPipelineStep(
      'review',
      'Review',
      reviewQueue.status === 'preview' ? 'preview' : 'blocked',
      reviewItemCount,
      reviewQueue.blockedCount,
      reviewQueue.items.filter((item) => item.approvalRequired).length,
      reviewQueue.status === 'preview'
        ? 'Review queue is ready for approval requests.'
        : 'Review queue is blocked by draft blockers.',
      reviewQueue.items.find((item) => item.canRequestApproval)?.nextSafeStep ?? 'Keep review approval requests read-only.',
    ),
    buildPipelineStep(
      'schedule-preview',
      'Schedule Preview',
      schedulePreviewQueue.status === 'preview' ? 'preview' : 'blocked',
      schedulePreviewItemCount,
      schedulePreviewQueue.blockedCount,
      schedulePreviewQueue.items.filter((item) => item.approvalRequired).length,
      schedulePreviewQueue.status === 'preview'
        ? 'Schedule preview items are ready for review.'
        : 'Schedule preview is blocked by review blockers.',
      schedulePreviewQueue.items.find((item) => item.canRequestApproval)?.nextSafeStep ?? 'Keep schedule preview approval requests read-only.',
    ),
    buildPipelineStep(
      'analytics-feedback',
      'Analytics Feedback',
      analyticsFixtureCount > 0 ? 'available' : 'missing',
      analyticsFixtureCount,
      0,
      0,
      analyticsFixtureCount > 0
        ? 'Fixture analytics are available for post-flow feedback.'
        : 'No analytics fixtures are defined yet.',
      analyticsFixtureCount > 0 ? 'Review analytics fixtures and keep external calls disabled.' : 'Add fixture analytics before extending feedback loops.',
    ),
    buildPipelineStep(
      'readiness',
      'Readiness',
      blocked ? 'blocked' : 'preview',
      1,
      blockerCount,
      approvalRequiredCount,
      'Readiness remains review-only while publishing and scheduling are disabled.',
      'Review pipeline summary and keep publishing disabled.',
    ),
  ];

  return {
    pipeline: {
      id: `pipeline-${eventId}`,
      eventId,
      title: event.title,
      status: blocked ? 'blocked' : 'preview',
      generatedAt,
      steps,
      totals: {
        draftCount: dryRunDraftCount,
        reviewItemCount,
        schedulePreviewItemCount,
        analyticsFixtureCount,
        blockerCount,
        approvalRequiredCount,
      },
      nextSafeStep: blocked
        ? 'Review the pipeline summary and keep publishing disabled.'
        : 'Continue review-only validation with publishing disabled.',
      blockers: [
        ...dryRun.blockers,
        ...reviewQueue.items.flatMap((item) => item.blockers),
        ...schedulePreviewQueue.items.flatMap((item) => item.blockers),
      ],
      safety: {
        endToEndPreviewOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        callsExternalApi: false,
        callsExternalAI: false,
        usesCookies: false,
        usesPlaywright: false,
      },
    },
  };
}

export function readPostReadinessScore(eventId: string): BrainCorePostReadinessScoreResponse {
  const pipeline = readPostPipelineSummary(eventId).pipeline;
  const generatedAt = new Date().toISOString();

  if (pipeline.title === 'Unknown event fixture') {
    return {
      readiness: {
        id: `readiness-${eventId}`,
        eventId,
        score: 0,
        grade: 'blocked',
        status: 'blocked',
        generatedAt,
        blockers: [
          {
            id: 'unknown-event',
            severity: 'error',
            source: 'event',
            title: 'Unknown event fixture',
            summary: 'The event fixture does not exist.',
            nextSafeStep: 'Use a known event fixture.',
            blocksPublishing: true,
            canAutoFix: false,
          },
        ],
        checks: [
          { id: 'event', label: 'Event fixture exists', passed: false, summary: 'Event fixture is missing.' },
          { id: 'dry-run', label: 'Dry-run draft plan exists', passed: false, summary: 'No dry-run plan exists.' },
          { id: 'review', label: 'Review queue exists', passed: false, summary: 'No review queue exists.' },
          { id: 'schedule-preview', label: 'Schedule preview exists', passed: false, summary: 'No schedule preview exists.' },
          { id: 'analytics', label: 'Analytics fixture exists', passed: false, summary: 'No analytics fixture exists.' },
          { id: 'publishing', label: 'Publishing disabled', passed: true, summary: 'Publishing is disabled.' },
          { id: 'external-writes', label: 'External writes disabled', passed: true, summary: 'External writes are disabled.' },
          { id: 'playwright', label: 'Playwright disabled', passed: true, summary: 'Playwright is disabled.' },
        ],
        nextSafeStep: 'Use a known event fixture.',
        safety: {
          readOnly: true,
          publishingEnabled: false,
          schedulingEnabled: false,
          executionEnabled: false,
          writesExternalPlatform: false,
          writesToMind: false,
          callsExternalApi: false,
          callsExternalAI: false,
          canAutoFix: false,
        },
      },
    };
  }

  const blockers: BrainCorePostReadinessBlocker[] = [
    {
      id: 'publishing-disabled',
      severity: 'error',
      source: 'publishing',
      title: 'Publishing disabled',
      summary: 'Publishing is disabled in this phase.',
      nextSafeStep: 'Keep publishing disabled.',
      blocksPublishing: true,
      canAutoFix: false,
    },
    {
      id: 'scheduling-disabled',
      severity: 'error',
      source: 'schedule-preview',
      title: 'Scheduling disabled',
      summary: 'Scheduling is disabled in this phase.',
      nextSafeStep: 'Keep scheduling disabled.',
      blocksPublishing: true,
      canAutoFix: false,
    },
    {
      id: 'platform-security-review-required',
      severity: 'warning',
      source: 'security',
      title: 'Platform security review required',
      summary: 'Platform posting remains review-only.',
      nextSafeStep: 'Review platform security before any future execution phase.',
      blocksPublishing: true,
      canAutoFix: false,
    },
    {
      id: 'no-real-provider-integration',
      severity: 'warning',
      source: 'contracts',
      title: 'No real provider integration',
      summary: 'Proofly and Xgrow remain migration references only.',
      nextSafeStep: 'Keep provider integrations read-only.',
      blocksPublishing: true,
      canAutoFix: false,
    },
    {
      id: 'no-dual-run-validation',
      severity: 'warning',
      source: 'analytics',
      title: 'No dual-run validation',
      summary: 'No dual-run evidence exists for a live publishing path.',
      nextSafeStep: 'Validate future execution in a separate phase.',
      blocksPublishing: true,
      canAutoFix: false,
    },
  ];

  const checks = [
    { id: 'event', label: 'Event fixture exists', passed: true, summary: 'Event fixture is available.' },
    { id: 'dry-run', label: 'Dry-run draft plan exists', passed: pipeline.totals.draftCount > 0, summary: 'Dry-run plan is available.' },
    { id: 'review', label: 'Review queue exists', passed: pipeline.totals.reviewItemCount > 0, summary: 'Review queue is available.' },
    { id: 'schedule-preview', label: 'Schedule preview exists', passed: pipeline.totals.schedulePreviewItemCount > 0, summary: 'Schedule preview queue is available.' },
    { id: 'analytics', label: 'Analytics fixture exists', passed: pipeline.totals.analyticsFixtureCount > 0, summary: 'Analytics fixtures are available.' },
    { id: 'publishing', label: 'Publishing disabled', passed: true, summary: 'Publishing is disabled.' },
    { id: 'external-writes', label: 'External writes disabled', passed: true, summary: 'External writes are disabled.' },
    { id: 'playwright', label: 'Playwright disabled', passed: true, summary: 'Playwright is disabled.' },
  ];

  const score = 50 - blockers.length * 5;

  return {
    readiness: {
      id: `readiness-${eventId}`,
      eventId,
      score,
      grade: 'blocked',
      status: 'blocked',
      generatedAt,
      blockers,
      checks,
      nextSafeStep: 'Review pipeline summary and keep publishing disabled.',
      safety: {
        readOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        callsExternalApi: false,
        callsExternalAI: false,
        canAutoFix: false,
      },
    },
  };
}

export function readPostPlatformPolicies(): BrainCorePostPlatformPoliciesResponse {
  return PLATFORM_POLICIES;
}

export function readPostDecommissionReadiness(): BrainCorePostDecommissionReadinessResponse {
  return DECOMMISSION_READINESS;
}

export function readPostOperatorGuidance(): BrainCorePostOperatorGuidanceResponse {
  const items: BrainCorePostOperatorGuidanceItem[] = [
    {
      id: 'review-draft-queue',
      title: 'Review Draft Queue',
      category: 'review',
      severity: 'info',
      summary: 'Use the draft review queue to inspect preview-only drafts before any future approval request.',
      source: 'review-queue',
      steps: [
        guidanceStep('open-dashboard', 'Open Post Orchestrator dashboard', 'Open the Brain Console Post Orchestrator section.', true, true, 'read'),
        guidanceStep('review-drafts', 'Review draft plan previews', 'Inspect draft previews and confirm they remain read-only.', true, true, 'review'),
        guidanceStep('request-review', 'Request review approval if needed', 'Request review approval only when a preview item is ready.', false, true, 'request-approval'),
      ],
      nextSafeStep: 'Request review approval only after verifying preview-only drafts.',
      blocksPublishing: false,
      safety: operatorGuidanceSafety(),
    },
    {
      id: 'review-schedule-preview',
      title: 'Review Schedule Preview',
      category: 'scheduling',
      severity: 'warning',
      summary: 'Schedule preview remains preview-only and must not create scheduler jobs.',
      source: 'schedule-preview',
      steps: [
        guidanceStep('inspect-schedule', 'Inspect schedule preview', 'Inspect candidate schedule windows and rationales.', true, true, 'review'),
        guidanceStep('confirm-no-job', 'Confirm no scheduler job is created', 'Verify that no real scheduler job is produced.', true, true, 'manual-check'),
        guidanceStep('request-schedule-review', 'Request schedule review approval if needed', 'Request schedule review approval only for preview items.', false, true, 'request-approval'),
      ],
      nextSafeStep: 'Keep schedule preview read-only and request approval only for previews.',
      blocksPublishing: false,
      safety: operatorGuidanceSafety(),
    },
    {
      id: 'platform-security-review',
      title: 'Platform Security Review',
      category: 'security',
      severity: 'blocked',
      summary: 'Platform policy registry keeps X and other platforms blocked for live posting paths.',
      source: 'platform-policy',
      relatedPlatform: 'x',
      steps: [
        guidanceStep('review-policies', 'Review platform policy registry', 'Inspect platform policy and security review metadata.', true, true, 'read'),
        guidanceStep('verify-safety', 'Verify cookies and Playwright remain disabled', 'Confirm no cookies or Playwright posting are enabled.', true, true, 'manual-check'),
        guidanceStep('decide-policy', 'Decide future API or manual-export policy', 'Make a future decision only after explicit review.', false, true, 'wait'),
      ],
      nextSafeStep: 'Keep platform policy review blocked until security review completes.',
      blocksPublishing: true,
      safety: operatorGuidanceSafety(),
    },
    {
      id: 'publishing-disabled',
      title: 'Publishing Disabled',
      category: 'publishing',
      severity: 'blocked',
      summary: 'Publishing remains disabled in Brain for this phase.',
      source: 'readiness',
      steps: [
        guidanceStep('keep-disabled', 'Keep publishing disabled', 'Do not enable publishing in this phase.', true, true, 'blocked'),
        guidanceStep('complete-security', 'Complete security review', 'Resolve security review blockers before later phases.', false, true, 'wait'),
        guidanceStep('explicit-approval', 'Require explicit user approval before publishing', 'Do not proceed without explicit user approval.', false, true, 'wait'),
      ],
      nextSafeStep: 'Keep publishing disabled until a future approved phase.',
      blocksPublishing: true,
      safety: operatorGuidanceSafety(),
    },
    {
      id: 'decommission-not-ready',
      title: 'Decommission Not Ready',
      category: 'decommission',
      severity: 'blocked',
      summary: 'Legacy standalone orchestration is not ready for decommission.',
      source: 'decommission',
      steps: [
        guidanceStep('inspect-matrix', 'Inspect decommission readiness matrix', 'Review each legacy decommission target and its gates.', true, true, 'read'),
        guidanceStep('dual-run', 'Complete dual-run validation', 'Validate future execution in a separate phase.', false, true, 'wait'),
        guidanceStep('explicit-approval', 'Obtain explicit user approval', 'Request explicit user approval before any decommission action.', false, true, 'request-approval'),
      ],
      nextSafeStep: 'Keep decommission blocked and request explicit user approval.',
      blocksPublishing: false,
      safety: operatorGuidanceSafety(),
    },
    {
      id: 'analytics-feedback-review',
      title: 'Analytics Feedback Review',
      category: 'analytics',
      severity: 'info',
      summary: 'Review fixture analytics only; no external analytics APIs should be called.',
      source: 'analytics',
      steps: [
        guidanceStep('review-analytics', 'Review fixture analytics', 'Inspect analytics fixtures and their interpretation notes.', true, true, 'read'),
        guidanceStep('identify-assumptions', 'Identify feedback assumptions', 'Call out any assumptions in the passive feedback loop.', false, true, 'manual-check'),
        guidanceStep('no-external-api', 'Do not call external analytics APIs', 'Keep all analytics feedback fixture-only.', true, true, 'blocked'),
      ],
      nextSafeStep: 'Keep analytics feedback fixture-only.',
      blocksPublishing: false,
      safety: operatorGuidanceSafety(),
    },
  ];

  return {
    items,
    summary: {
      itemCount: items.length,
      blockedCount: items.filter((item) => item.severity === 'blocked').length,
      warningCount: items.filter((item) => item.severity === 'warning').length,
      nextSafeStep: 'Review operator guidance and keep publishing, scheduling, and external writes disabled.',
    },
  };
}

export function readPostManualExportPackage(eventId: string): BrainCorePostManualExportPackageResponse {
  const dryRun = readPostOrchestratorDryRunPlan(eventId).plan;
  const event = dryRun.event;
  if (dryRun.status === 'blocked' && dryRun.drafts.length === 0 && event.id === eventId && event.title === 'Unknown event fixture') {
    return {
      package: {
        id: `manual-export-${eventId}`,
        eventId,
        title: 'Unknown event fixture',
        generatedAt: dryRun.generatedAt,
        status: 'blocked',
        itemCount: 0,
        items: [],
        nextSafeStep: 'Use a known event fixture before previewing manual export output.',
        safety: manualExportSafety(),
      },
    };
  }

  const items = dryRun.drafts.map((draft) => buildManualExportItem(draft));
  const blocked = items.some((item) => item.status === 'blocked') || dryRun.status === 'blocked';
  return {
    package: {
      id: `manual-export-${eventId}`,
      eventId,
      title: `${event.title} · Manual Export Preview`,
      generatedAt: dryRun.generatedAt,
      status: blocked ? 'blocked' : 'preview',
      itemCount: items.length,
      items,
      nextSafeStep: blocked
        ? 'Resolve preview blockers before considering manual export packaging.'
        : 'Review the manual export preview and keep export behavior outside Brain.',
      safety: manualExportSafety(),
    },
  };
}

export function readPostAcceptanceChecklist(): BrainCorePostAcceptanceChecklistResponse {
  const checks: BrainCorePostAcceptanceCheck[] = [
    acceptanceCheck('status-endpoint', 'api', 'Status endpoint exists', 'passed', true, 'GET /post-orchestrator/status exists.', ['GET /post-orchestrator/status'], 'Keep the status endpoint read-only.'),
    acceptanceCheck('flows-endpoint', 'api', 'Flows endpoint exists', 'passed', true, 'GET /post-orchestrator/flows exists.', ['GET /post-orchestrator/flows'], 'Keep the flow fixture endpoint read-only.'),
    acceptanceCheck('events-endpoint', 'api', 'Events endpoint exists', 'passed', true, 'GET /post-orchestrator/events exists.', ['GET /post-orchestrator/events'], 'Keep the event fixture endpoint read-only.'),
    acceptanceCheck('dry-run-endpoint', 'api', 'Dry-run endpoint exists', 'passed', true, 'GET /post-orchestrator/dry-run/:eventId exists.', ['GET /post-orchestrator/dry-run/:eventId'], 'Keep the dry-run planner preview-only.'),
    acceptanceCheck('review-queue-endpoint', 'api', 'Review queue endpoint exists', 'passed', true, 'GET /post-orchestrator/review-queue/:eventId exists.', ['GET /post-orchestrator/review-queue/:eventId'], 'Keep review requests approval-only.'),
    acceptanceCheck('schedule-preview-endpoint', 'api', 'Schedule preview endpoint exists', 'passed', true, 'GET /post-orchestrator/schedule-preview/:eventId exists.', ['GET /post-orchestrator/schedule-preview/:eventId'], 'Keep schedule preview approval-only.'),
    acceptanceCheck('analytics-endpoint', 'api', 'Analytics endpoint exists', 'passed', true, 'GET /post-orchestrator/analytics exists.', ['GET /post-orchestrator/analytics'], 'Keep analytics fixtures read-only.'),
    acceptanceCheck('pipeline-endpoint', 'api', 'Pipeline endpoint exists', 'passed', true, 'GET /post-orchestrator/pipeline/:eventId exists.', ['GET /post-orchestrator/pipeline/:eventId'], 'Keep pipeline summaries preview-only.'),
    acceptanceCheck('readiness-endpoint', 'api', 'Readiness endpoint exists', 'passed', true, 'GET /post-orchestrator/readiness/:eventId exists.', ['GET /post-orchestrator/readiness/:eventId'], 'Keep readiness blocked while publishing is disabled.'),
    acceptanceCheck('platform-policies-endpoint', 'api', 'Platform policies endpoint exists', 'passed', true, 'GET /post-orchestrator/platform-policies exists.', ['GET /post-orchestrator/platform-policies'], 'Keep platform policy metadata read-only.'),
    acceptanceCheck('decommission-readiness-endpoint', 'api', 'Decommission readiness endpoint exists', 'passed', true, 'GET /post-orchestrator/decommission-readiness exists.', ['GET /post-orchestrator/decommission-readiness'], 'Keep decommission readiness blocked.'),
    acceptanceCheck('operator-guidance-endpoint', 'api', 'Operator guidance endpoint exists', 'passed', true, 'GET /post-orchestrator/operator-guidance exists.', ['GET /post-orchestrator/operator-guidance'], 'Keep operator guidance read-only.'),
    acceptanceCheck('manual-export-endpoint', 'api', 'Manual export preview endpoint exists', 'passed', true, 'GET /post-orchestrator/manual-export/:eventId exists.', ['GET /post-orchestrator/manual-export/:eventId'], 'Keep manual export preview-only.'),
    acceptanceCheck('dashboard-section', 'dashboard', 'Post Orchestrator section exists conceptually', 'passed', true, 'Brain Console renders the Posts/Post Orchestrator section.', ['Brain Console Posts section'], 'Keep the dashboard read-only.'),
    acceptanceCheck('pipeline-readiness-cards', 'dashboard', 'Pipeline and readiness cards are represented', 'passed', true, 'Pipeline, readiness, operator guidance, and export cards render.', ['Brain Console Post cards'], 'Keep the cards read-only.'),
    acceptanceCheck('publishing-disabled', 'safety', 'Publishing is disabled', 'blocked', true, 'Publishing remains disabled in every preview path.', ['Publishing flags are false'], 'Keep publishing disabled.'),
    acceptanceCheck('scheduling-disabled', 'safety', 'Scheduling is disabled', 'blocked', true, 'Scheduling remains disabled in every preview path.', ['Scheduling flags are false'], 'Keep scheduling disabled.'),
    acceptanceCheck('execution-disabled', 'safety', 'Execution is disabled', 'passed', true, 'Execution remains disabled in every preview path.', ['Execution flags are false'], 'Keep execution disabled.'),
    acceptanceCheck('external-writes-disabled', 'safety', 'External writes are disabled', 'passed', true, 'No preview path writes to an external platform.', ['Safety flags are false'], 'Keep external writes disabled.'),
    acceptanceCheck('mind-writes-disabled', 'safety', 'Mind writes are disabled', 'passed', true, 'No preview path writes to Mind.', ['Safety flags are false'], 'Keep Mind writes disabled.'),
    acceptanceCheck('playwright-disabled', 'safety', 'Playwright and cookies are disabled', 'passed', true, 'No preview path uses cookies or Playwright.', ['Safety flags are false'], 'Keep Playwright disabled.'),
    acceptanceCheck('cookies-secrets-not-read', 'safety', 'Cookies and secrets are not read', 'passed', true, 'No preview path reads cookies or secrets.', ['Safety flags are false'], 'Keep secrets and cookies unread.'),
    acceptanceCheck('decommission-not-started', 'policy', 'Decommission has not started', 'passed', true, 'Decommission readiness is read-only.', ['Decommission readiness matrix'], 'Keep decommission blocked.'),
    acceptanceCheck('platform-policy-registry', 'policy', 'Platform policy registry exists', 'passed', true, 'Platform policy metadata is exposed for all post platforms.', ['Platform policies endpoint'], 'Keep policy metadata read-only.'),
    acceptanceCheck('legacy-sources-tracked', 'migration', 'Legacy sources are tracked internally', 'passed', true, 'Proofly/Xgrow remain internal migration references.', ['Internal legacy references'], 'Keep legacy labels internal only.'),
    acceptanceCheck('neutral-user-facing-labels', 'migration', 'User-facing labels are neutral', 'passed', true, 'User-facing UI uses flow/platform names.', ['Brain Console labels'], 'Keep user-facing names neutral.'),
    acceptanceCheck('real-publishing-policy', 'policy', 'Real publishing policy is not defined', 'blocked', true, 'No production publishing policy exists yet.', ['No publish execution path'], 'Require explicit user approval before future publishing design.'),
    acceptanceCheck('real-scheduler-policy', 'policy', 'Real scheduler write policy is not defined', 'blocked', true, 'No scheduler write policy exists yet.', ['No scheduler execution path'], 'Require explicit user approval before future scheduling design.'),
    acceptanceCheck('platform-security-review', 'policy', 'Platform API security review is not complete', 'blocked', true, 'Platform API security review remains incomplete.', ['Platform policy registry'], 'Complete platform security review before any future publishing design.'),
    acceptanceCheck('dual-run-parity', 'migration', 'Dual-run parity validation is not complete', 'blocked', true, 'Dual-run parity validation remains incomplete.', ['Migration parity report'], 'Complete dual-run parity validation before any future migration decision.'),
  ];

  const passedCount = checks.filter((check) => check.status === 'passed').length;
  const blockedCount = checks.filter((check) => check.status === 'blocked').length;
  const failedCount = checks.filter((check) => check.status === 'failed').length;
  const requiredCount = checks.filter((check) => check.required).length;
  return {
    checklist: {
      id: 'post-acceptance-checklist',
      title: 'Post Orchestrator Acceptance Checklist',
      generatedAt: new Date().toISOString(),
      status: blockedCount > 0 ? 'blocked' : 'preview-ready',
      passedCount,
      blockedCount,
      failedCount,
      requiredCount,
      checks,
      nextSafeStep: 'Review blocked future-gate checks and keep publishing, scheduling, and execution disabled.',
      safety: {
        readOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        decommissionStarted: false,
      },
    },
  };
}

export function readPostMigrationParityReport(): BrainCorePostMigrationParityReportResponse {
  const capabilities: BrainCorePostMigrationParityCapability[] = [
    migrationCapability('asset-generation', 'Asset Generation', 'preview-only', 'Social Proof Asset Flow fixture, manual export preview, and decommission readiness tracking exist.', ['No live asset rendering integration', 'No dual-run validation', 'No provider contract execution'], 72, 'Keep asset generation preview-only.'),
    migrationCapability('growth-optimization', 'Growth Optimization', 'preview-only', 'Growth Optimization Flow fixture, analytics fixtures, and operator guidance exist.', ['No live optimization integration', 'No real platform data', 'No dual-run validation'], 68, 'Keep growth optimization preview-only.'),
    migrationCapability('scheduler', 'Scheduler', 'blocked', 'Schedule preview queue and schedule review approval exist.', ['No scheduler job writes', 'No scheduler policy approval'], 42, 'Keep scheduler write paths disabled.'),
    migrationCapability('publishing', 'Publishing', 'blocked', 'Platform policies, readiness blockers, and manual export preview exist.', ['No API publishing', 'No platform security review complete', 'No explicit user approval'], 34, 'Keep publishing blocked.'),
    migrationCapability('analytics', 'Analytics', 'preview-only', 'Analytics feedback fixtures exist.', ['No external analytics API reads', 'No real post IDs'], 75, 'Keep analytics fixture-only.'),
    migrationCapability('approval', 'Approval', 'partial', 'Review approval requests and schedule review approvals exist.', ['No approval-to-publish path', 'No publish policy'], 61, 'Keep approvals approval-only.'),
    migrationCapability('dashboard', 'Dashboard', 'partial', 'Brain Console Post Orchestrator cards exist.', ['Visual polish', 'Operator UX review'], 64, 'Keep dashboard read-only.'),
    migrationCapability('policy', 'Policy', 'partial', 'Platform policies and decommission matrix exist.', ['User approval for next phase', 'Security review'], 58, 'Keep policy surfaces read-only.'),
    migrationCapability('manual-export', 'Manual Export', 'preview-only', 'Manual export preview package exists.', ['No real export/download/copy by design'], 78, 'Keep manual export preview-only.'),
  ];

  const overallParityScore = Math.round(capabilities.reduce((sum, capability) => sum + capability.parityScore, 0) / capabilities.length);
  const blockers = [
    'Real publishing is not designed yet.',
    'Real scheduling is not designed yet.',
    'Platform security review is incomplete.',
    'Dual-run parity validation is incomplete.',
  ];

  return {
    report: {
      id: 'post-migration-parity-report',
      generatedAt: new Date().toISOString(),
      status: 'blocked',
      overallParityScore,
      capabilities,
      blockers,
      nextSafeStep: 'Keep migration parity preview-only and require explicit user approval before any future scheduling or publishing design.',
      safety: {
        readOnly: true,
        modifiesLegacyRepo: false,
        decommissionStarted: false,
        deletesFiles: false,
        publishingEnabled: false,
        schedulingEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        requiresExplicitUserApprovalForDecommission: true,
      },
    },
  };
}

export function readPostRoadmapCheckpoint(): BrainCorePostRoadmapCheckpointResponse {
  const phases: BrainCorePostRoadmapCheckpointPhase[] = [
    roadmapPhase('P1', 'P1 Read-only scaffold', 'complete', 'Initial Post Orchestrator status, contracts, integrations, recovery, and read-only console scaffold exist.', ['Read-only API routes', 'Console sections']),
    roadmapPhase('P2', 'P2 Flow fixtures', 'complete', 'Platform flow fixtures exist for X, GitHub, LinkedIn, Facebook, YouTube, Blog, Social Proof Asset, and Growth Optimization flows.', ['Flow fixture endpoints']),
    roadmapPhase('P3', 'P3 Dry-run planner', 'complete', 'Event fixtures and dry-run preview plans exist.', ['Dry-run planner endpoint']),
    roadmapPhase('P4', 'P4 Review queue', 'complete', 'Review queue and approval request surface exist.', ['Review queue endpoint']),
    roadmapPhase('P5', 'P5 Schedule preview', 'complete', 'Schedule preview queue and approval request surface exist.', ['Schedule preview endpoint']),
    roadmapPhase('P6', 'P6 Analytics fixtures', 'complete', 'Analytics fixtures exist as passive feedback metadata.', ['Analytics endpoint']),
    roadmapPhase('P7', 'P7 Pipeline summary', 'complete', 'End-to-end pipeline summary exists.', ['Pipeline endpoint']),
    roadmapPhase('P8', 'P8 Readiness scoring', 'complete', 'Readiness scoring and blocker model exist.', ['Readiness endpoint']),
    roadmapPhase('P9', 'P9 Platform policy', 'complete', 'Platform policy / security review registry exists.', ['Platform policies endpoint']),
    roadmapPhase('P10', 'P10 Decommission readiness', 'complete', 'Decommission readiness matrix exists.', ['Decommission readiness endpoint']),
    roadmapPhase('P11', 'P11 Operator guidance', 'complete', 'Operator guidance and blocker recovery guidance exist.', ['Operator guidance endpoint']),
    roadmapPhase('P12', 'P12 Manual export preview', 'complete', 'Manual export preview package exists.', ['Manual export endpoint']),
    roadmapPhase('P13', 'P13 Acceptance checklist', 'complete', 'Operator acceptance checklist exists.', ['Acceptance checklist endpoint']),
    roadmapPhase('P14', 'P14 Migration parity report', 'complete', 'Migration parity report exists.', ['Migration parity endpoint']),
    roadmapPhase('P16', 'P16 Future real scheduling/publishing design', 'blocked', 'Future real scheduling/publishing design remains intentionally blocked until explicit user approval.', ['Roadmap checkpoint review']),
  ];

  const completedPhaseCount = phases.filter((phase) => phase.status === 'complete').length;
  const blockedPhaseCount = phases.filter((phase) => phase.status === 'blocked').length;

  return {
    checkpoint: {
      id: 'post-roadmap-checkpoint',
      generatedAt: new Date().toISOString(),
      currentPhase: 'P15 roadmap checkpoint',
      completedPhaseCount,
      blockedPhaseCount,
      phases,
      nextRecommendedPhase: 'Review the roadmap checkpoint and require explicit user approval before any future real scheduling/publishing design.',
      nextPhaseRequiresUserApproval: true,
      nextPhaseSummary: 'Future real scheduling/publishing design is intentionally blocked until the user explicitly approves that direction.',
      safety: {
        readOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        requiresExplicitUserApprovalBeforePublishingDesign: true,
      },
    },
  };
}

export function readPostQaStatus(): BrainCorePostQaStatusResponse {
  const endpoints: BrainCorePostQaEndpointCoverageItem[] = [
    { id: 'overview', endpoint: '/post-orchestrator/overview', purpose: 'Status overview and blockers', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'status', endpoint: '/post-orchestrator/status', purpose: 'Orchestrator status and phase', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'contracts', endpoint: '/post-orchestrator/contracts', purpose: 'Contract fixtures', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'integrations', endpoint: '/post-orchestrator/integrations', purpose: 'Platform integrations', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'recovery', endpoint: '/post-orchestrator/recovery', purpose: 'Recovery blockers', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'flows', endpoint: '/post-orchestrator/flows', purpose: 'Flow fixtures', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'drafts', endpoint: '/post-orchestrator/drafts', purpose: 'Draft fixtures', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'events', endpoint: '/post-orchestrator/events', purpose: 'Event fixtures', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'dryrun', endpoint: '/post-orchestrator/dry-run/:eventId', purpose: 'Dry-run plan preview', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'reviewqueue', endpoint: '/post-orchestrator/review-queue/:eventId', purpose: 'Draft review queue', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'schedulepreview', endpoint: '/post-orchestrator/schedule-preview/:eventId', purpose: 'Schedule preview queue', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'analytics', endpoint: '/post-orchestrator/analytics', purpose: 'Analytics fixtures', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'pipeline', endpoint: '/post-orchestrator/pipeline/:eventId', purpose: 'Pipeline summary', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'readiness', endpoint: '/post-orchestrator/readiness/:eventId', purpose: 'Readiness score', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'policies', endpoint: '/post-orchestrator/platform-policies', purpose: 'Platform policies', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'decommission', endpoint: '/post-orchestrator/decommission-readiness', purpose: 'Decommission readiness', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'guidance', endpoint: '/post-orchestrator/operator-guidance', purpose: 'Operator guidance', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'export', endpoint: '/post-orchestrator/manual-export/:eventId', purpose: 'Manual export preview', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'acceptance', endpoint: '/post-orchestrator/acceptance-checklist', purpose: 'Acceptance checklist', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'migration', endpoint: '/post-orchestrator/migration-parity', purpose: 'Migration parity report', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
    { id: 'roadmap', endpoint: '/post-orchestrator/roadmap-checkpoint', purpose: 'Roadmap checkpoint', expectedInDashboard: true, status: 'covered', safety: { readOnly: true, hasPost: false, writesExternalPlatform: false, writesToMind: false } },
  ];

  const checklist: BrainCorePostQaChecklistItem[] = [
    { id: 'overview-visible', label: 'Overview card visible', status: 'manual-check', summary: 'Post Orchestrator overview card renders in Status group' },
    { id: 'flowpreview-visible', label: 'Flow Preview group visible', status: 'manual-check', summary: 'Flow Preview section with 5 cards renders' },
    { id: 'review-visible', label: 'Review / Schedule group visible', status: 'manual-check', summary: 'Review / Schedule section with 3 cards renders' },
    { id: 'safety-visible', label: 'Safety / Policy group visible', status: 'manual-check', summary: 'Safety / Policy section with 5 cards renders' },
    { id: 'migration-visible', label: 'Migration / Checkpoint group visible', status: 'manual-check', summary: 'Migration / Checkpoint section with 7 cards renders' },
    { id: 'publishing-label', label: 'Publishing disabled label visible', status: 'manual-check', summary: 'Safety label "Publishing disabled" appears in all cards' },
    { id: 'scheduling-label', label: 'Scheduling disabled label visible', status: 'manual-check', summary: 'Safety label "Scheduling disabled" appears in all cards' },
    { id: 'no-publish-button', label: 'No publish/schedule/run buttons visible', status: 'manual-check', summary: 'Confirm forbidden action buttons are absent' },
    { id: 'no-proofly', label: 'No Proofly/Xgrow provider labels visible', status: 'manual-check', summary: 'No external provider labels exposed' },
    { id: 'next-safe-step', label: 'Next safe step visible', status: 'manual-check', summary: 'Each card shows actionable next safe step' },
  ];

  return {
    qaStatus: {
      id: 'post-orchestrator-qa-status',
      generatedAt: new Date().toISOString(),
      status: 'ready-for-manual-qa',
      endpointCount: endpoints.length,
      coveredCount: endpoints.filter((e) => e.status === 'covered').length,
      manualCheckCount: checklist.length,
      endpoints,
      checklist,
      nextSafeStep: 'Perform manual visual QA in Obsidian: restart fully, open Posts section, verify groups and safety labels, confirm no forbidden controls are visible.',
      safety: {
        readOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
  };
}

function buildPipelineStep(
  id: BrainCorePostPipelineStepId,
  label: string,
  status: BrainCorePostPipelineStepStatus,
  itemCount: number,
  blockedCount: number,
  approvalRequiredCount: number,
  summary: string,
  nextSafeStep: string,
): BrainCorePostPipelineStepSummary {
  return {
    id,
    label,
    status,
    itemCount,
    blockedCount,
    approvalRequiredCount,
    summary,
    nextSafeStep,
    safety: {
      readOnly: true,
      previewOnly: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      writesExternalPlatform: false,
      writesToMind: false,
    },
  };
}

export function readPostOrchestratorDryRunPlan(eventId: string): BrainCorePostDryRunPlanResponse {
  const event = EVENT_FIXTURES.events.find((item) => item.id === eventId);
  const now = new Date().toISOString();

  if (!event) {
    return {
      plan: {
        id: `dry-run-${eventId}`,
        event: {
          id: eventId,
          source: 'internal',
          eventType: 'manual-request',
          occurredAt: now,
          projectId: 'brain',
          title: 'Unknown event fixture',
          payloadSummary: 'No matching event fixture was found.',
          priority: 'low',
          suggestedPlatforms: [],
          suggestedFlowIds: [],
          safety: {
            fixtureOnly: true,
            readsExternalPlatform: false,
            writesExternalPlatform: false,
            writesToMind: false,
            containsSecrets: false,
          },
        },
        generatedAt: now,
        status: 'blocked',
        drafts: [],
        unsupportedFlowIds: [],
        blockers: ['Unknown event fixture'],
        nextSafeStep: 'Use one of the read-only event fixtures.',
        safety: {
          dryRunOnly: true,
          publishingEnabled: false,
          schedulingEnabled: false,
          executionEnabled: false,
          writesExternalPlatform: false,
          writesToMind: false,
          usesCookies: false,
          usesPlaywright: false,
        },
      },
    };
  }

  const drafts: BrainCorePostDryRunPlan['drafts'] = [];
  const unsupportedFlowIds: string[] = [];
  const blockers = new Set<string>();

  event.suggestedFlowIds.forEach((flowId) => {
    const flow = FLOW_FIXTURES.flows.find((item) => item.id === flowId);
    if (!flow) {
      unsupportedFlowIds.push(flowId);
      blockers.add(`Missing flow fixture: ${flowId}`);
      return;
    }

    drafts.push(createDraftPlan(event, flow.id, flow.platform, flow.name, flow.status));
  });

  const status: BrainCorePostDryRunPlan['status'] =
    blockers.size > 0 ? 'blocked' : 'preview';

  return {
    plan: {
      id: `dry-run-${event.id}`,
      event,
      generatedAt: now,
      status,
      drafts,
      unsupportedFlowIds,
      blockers: [...blockers],
      nextSafeStep: blockers.size > 0
        ? 'Add the missing flow fixtures before expanding dry-run coverage.'
        : 'Review the preview-only drafts and keep execution disabled.',
      safety: {
        dryRunOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
      },
    },
  };
}

export function readPostDraftReviewQueue(eventId: string): BrainCorePostDraftReviewQueueResponse {
  const dryRun = readPostOrchestratorDryRunPlan(eventId).plan;
  if (dryRun.status === 'blocked' || dryRun.event.id !== eventId) {
    return {
      queue: {
        id: `review-queue-${eventId}`,
        status: 'blocked',
        generatedAt: dryRun.generatedAt,
        eventId,
        itemCount: 0,
        approvalRequestedCount: 0,
        blockedCount: 0,
        items: [],
        safety: {
          reviewOnly: true,
          publishingEnabled: false,
          schedulingEnabled: false,
          executionEnabled: false,
          writesExternalPlatform: false,
          writesToMind: false,
        },
      },
    };
  }

  const items = dryRun.drafts.map((draftPlan) => buildReviewItem(draftPlan));
  return {
    queue: {
      id: `review-queue-${eventId}`,
      status: items.some((item) => item.status === 'blocked') ? 'blocked' : 'preview',
      generatedAt: dryRun.generatedAt,
      eventId,
      itemCount: items.length,
      approvalRequestedCount: items.filter((item) => item.status === 'approval-requested').length,
      blockedCount: items.filter((item) => item.status === 'blocked').length,
      items,
      safety: {
        reviewOnly: true,
        publishingEnabled: false,
        schedulingEnabled: false,
        executionEnabled: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
  };
}

export function requestPostDraftReviewApproval(reviewItemId: string): BrainCorePostDraftReviewApprovalRequest {
  const reviewItem = findReviewItemById(reviewItemId);
  if (!reviewItem) {
    return {
      id: `request-${reviewItemId}`,
      reviewItemId,
      status: 'invalid',
      executionDidRun: false,
      summary: 'Review item not found.',
      nextSafeStep: 'Use a generated review queue item.',
      safety: {
        reviewOnly: true,
        dryRunOnly: true,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
        callsExternalAI: false,
      },
    };
  }

  if (!reviewItem.canRequestApproval || reviewItem.status === 'blocked') {
    return {
      id: `request-${reviewItemId}`,
      reviewItemId,
      status: 'blocked',
      executionDidRun: false,
      summary: reviewItem.blockers[0] ?? 'Review item cannot request approval.',
      nextSafeStep: reviewItem.nextSafeStep,
      safety: reviewItem.safety,
    };
  }

  const requestKind = `post-draft-review-${reviewItemId}`;
  const request = requestAction(requestKind);
  if (!request.accepted || !request.approval) {
    return {
      id: `request-${reviewItemId}`,
      reviewItemId,
      status: 'blocked',
      executionDidRun: false,
      summary: request.message || 'Approval request was blocked.',
      nextSafeStep: 'Keep review approval request read-only.',
      safety: reviewItem.safety,
    };
  }

  return {
    id: `request-${reviewItemId}`,
    reviewItemId,
    approvalId: request.approval.id,
    status: 'requested',
    executionDidRun: false,
    summary: request.message,
    nextSafeStep: 'Approval requested. Review queue remains read-only.',
    safety: reviewItem.safety,
  };
}

export function readPostSchedulePreviewQueue(eventId: string): BrainCorePostSchedulePreviewQueueResponse {
  const reviewQueue = readPostDraftReviewQueue(eventId).queue;
  if (reviewQueue.status === 'blocked') {
    return {
      queue: {
        id: `schedule-preview-queue-${eventId}`,
        eventId,
        status: 'blocked',
        generatedAt: reviewQueue.generatedAt,
        itemCount: 0,
        approvalRequestedCount: 0,
        blockedCount: 0,
        items: [],
        safety: {
          previewOnly: true,
          schedulingEnabled: false,
          publishingEnabled: false,
          executionEnabled: false,
          writesScheduler: false,
          writesExternalPlatform: false,
          writesToMind: false,
        },
      },
    };
  }

  const items = reviewQueue.items.map((item) => buildSchedulePreviewItem(item));
  return {
    queue: {
      id: `schedule-preview-queue-${eventId}`,
      eventId,
      status: items.some((item) => item.status === 'blocked') ? 'blocked' : 'preview',
      generatedAt: reviewQueue.generatedAt,
      itemCount: items.length,
      approvalRequestedCount: items.filter((item) => item.status === 'approval-requested').length,
      blockedCount: items.filter((item) => item.status === 'blocked').length,
      items,
      safety: {
        previewOnly: true,
        schedulingEnabled: false,
        publishingEnabled: false,
        executionEnabled: false,
        writesScheduler: false,
        writesExternalPlatform: false,
        writesToMind: false,
      },
    },
  };
}

export function requestPostSchedulePreviewApproval(schedulePreviewItemId: string): BrainCorePostSchedulePreviewApprovalRequest {
  const scheduleItem = findSchedulePreviewItemById(schedulePreviewItemId);
  if (!scheduleItem) {
    return {
      id: `request-${schedulePreviewItemId}`,
      schedulePreviewItemId,
      status: 'invalid',
      executionDidRun: false,
      summary: 'Schedule preview item not found.',
      nextSafeStep: 'Use a generated schedule preview item.',
      safety: {
        previewOnly: true,
        writesScheduler: false,
        writesExternalPlatform: false,
        writesToMind: false,
        usesCookies: false,
        usesPlaywright: false,
        callsExternalAI: false,
      },
    };
  }

  if (!scheduleItem.canRequestApproval || scheduleItem.status === 'blocked') {
    return {
      id: `request-${schedulePreviewItemId}`,
      schedulePreviewItemId,
      status: 'blocked',
      executionDidRun: false,
      summary: scheduleItem.blockers[0] ?? 'Schedule preview item cannot request approval.',
      nextSafeStep: scheduleItem.nextSafeStep,
      safety: scheduleItem.safety,
    };
  }

  const requestKind = `post-schedule-preview-${schedulePreviewItemId}`;
  const request = requestAction(requestKind);
  if (!request.accepted || !request.approval) {
    return {
      id: `request-${schedulePreviewItemId}`,
      schedulePreviewItemId,
      status: 'blocked',
      executionDidRun: false,
      summary: request.message || 'Schedule preview approval request was blocked.',
      nextSafeStep: 'Keep schedule preview approval request read-only.',
      safety: scheduleItem.safety,
    };
  }

  return {
    id: `request-${schedulePreviewItemId}`,
    schedulePreviewItemId,
    approvalId: request.approval.id,
    status: 'requested',
    executionDidRun: false,
    summary: request.message,
    nextSafeStep: 'Schedule preview approval requested. No scheduler job was created.',
    safety: scheduleItem.safety,
  };
}

function createDraftPlan(
  event: BrainCorePostEventFixture,
  flowId: string,
  platform: BrainCorePostDraftFixture['platform'],
  flowName: string,
  flowStatus: BrainCorePostFlowFixture['status'],
): BrainCorePostDryRunPlan['drafts'][number] {
  const title = `${event.title} · ${flowName}`;
  const copyPreview = buildCopyPreview(event.eventType, platform, flowName);
  const format = selectDraftFormat(platform, event.eventType);
  const assetFlowRequired = flowId === 'social-proof-asset-flow' || platform === 'linkedin' || platform === 'x';
  const optimizationFlowRequired = flowId !== 'social-proof-asset-flow';
  const status: BrainCorePostPlanStatus =
    flowStatus === 'disabled'
      ? 'unsupported'
      : flowStatus === 'blocked'
        ? 'blocked'
        : 'planned-preview';

  return {
    id: `dry-run-${event.id}-${flowId}`,
    eventId: event.id,
    flowId,
    platform,
    title,
    format,
    copyPreview,
    assetFlowRequired,
    optimizationFlowRequired,
    approvalRequired: true,
    status,
    blockers: [],
    nextSafeStep: 'Review this preview-only draft and keep publishing disabled.',
    publishingEnabled: false,
    schedulingEnabled: false,
    executionEnabled: false,
    safety: {
      dryRunOnly: true,
      generatedFromFixture: true,
      publishingEnabled: false,
      schedulingEnabled: false,
      executionEnabled: false,
      writesExternalPlatform: false,
      writesToMind: false,
      usesCookies: false,
      usesPlaywright: false,
    },
  };
}

function selectDraftFormat(platform: BrainCorePostDraftFixture['platform'], eventType: BrainCorePostEventType): BrainCorePostDraftFixture['format'] {
  if (platform === 'github') return 'release-note';
  if (platform === 'youtube') return 'short-video-caption';
  if (platform === 'blog') return 'blog-summary';
  if (platform === 'facebook') return eventType === 'video-rendered' ? 'short-video-caption' : 'single-post';
  if (platform === 'internal') return eventType === 'mrr-milestone' ? 'single-post' : 'single-post';
  if (eventType === 'release-published') return 'thread';
  if (eventType === 'product-milestone') return 'carousel';
  return 'single-post';
}

function buildCopyPreview(eventType: BrainCorePostEventType, platform: BrainCorePostDraftFixture['platform'], flowName: string): string {
  switch (flowName) {
    case 'Social Proof Asset Flow':
      return `Preview-only asset request for ${eventType}. No publishing or external write will occur.`;
    case 'Growth Optimization Flow':
      return `Preview-only optimization request for ${platform}. Hook, timing, and tone remain advisory only.`;
    case 'X Post Flow':
      return `Short thread-style preview for ${eventType} on X.`;
    case 'GitHub Post Flow':
      return `Release note preview for ${eventType} on GitHub.`;
    case 'LinkedIn Post Flow':
      return `Professional milestone preview for ${eventType} on LinkedIn.`;
    case 'Facebook Post Flow':
      return `Broad distribution preview for ${eventType} on Facebook.`;
    case 'YouTube Post Flow':
      return `Caption and description preview for ${eventType} on YouTube.`;
    case 'Blog Post Flow':
      return `Blog summary preview for ${eventType}.`;
    default:
      return `Preview-only draft for ${eventType} on ${platform}.`;
  }
}

function buildReviewItem(draftPlan: BrainCorePostDryRunPlan['drafts'][number]): BrainCorePostDraftReviewItem {
  const risk = determineReviewRisk(draftPlan.flowId);
  const blocked = risk === 'high' || draftPlan.status === 'blocked' || draftPlan.status === 'unsupported';
  return {
    id: `review-${draftPlan.id}`,
    draftPlanId: draftPlan.id,
    eventId: draftPlan.eventId,
    flowId: draftPlan.flowId,
    platform: draftPlan.platform,
    title: draftPlan.title,
    format: draftPlan.format,
    copyPreview: draftPlan.copyPreview,
    status: blocked ? 'blocked' : 'review-ready',
    risk,
    approvalRequired: true,
    canRequestApproval: !blocked,
    canApproveForPublishing: false,
    publishingEnabled: false,
    schedulingEnabled: false,
    executionEnabled: false,
    blockers: blocked ? ['Review item is not requestable'] : [],
    nextSafeStep: blocked
      ? 'Resolve review blockers before requesting approval.'
      : 'Request review approval for this preview-only draft.',
    safety: {
      reviewOnly: true,
      dryRunOnly: true,
      writesExternalPlatform: false,
      writesToMind: false,
      usesCookies: false,
      usesPlaywright: false,
      callsExternalAI: false,
    },
  };
}

function determineReviewRisk(flowId: string): BrainCorePostDraftReviewItem['risk'] {
  if (flowId === 'social-proof-asset-flow' || flowId === 'growth-optimization-flow') return 'low';
  if (flowId === 'x-post-flow' || flowId === 'linkedin-post-flow' || flowId === 'github-post-flow' || flowId === 'facebook-post-flow' || flowId === 'youtube-post-flow') return 'medium';
  return 'high';
}

function findReviewItemById(reviewItemId: string): BrainCorePostDraftReviewItem | undefined {
  for (const event of EVENT_FIXTURES.events) {
    const queue = readPostDraftReviewQueue(event.id).queue;
    const item = queue.items.find((candidate) => candidate.id === reviewItemId);
    if (item) return item;
  }
  return undefined;
}

function buildSchedulePreviewItem(reviewItem: BrainCorePostDraftReviewItem): BrainCorePostSchedulePreviewItem {
  const platform = reviewItem.platform;
  const isInternal = platform === 'internal';
  const canRequestApproval = !isInternal && reviewItem.status !== 'blocked';
  const scheduledWindow = determineScheduleWindow(platform);
  const timezone = 'Europe/Amsterdam';
  const suggestedLocalTime = suggestedTimeForWindow(scheduledWindow);
  const rationale = determineScheduleRationale(platform, scheduledWindow);
  return {
    id: `schedule-${reviewItem.id}`,
    reviewItemId: reviewItem.id,
    draftPlanId: reviewItem.draftPlanId,
    eventId: reviewItem.eventId,
    flowId: reviewItem.flowId,
    platform,
    title: reviewItem.title,
    scheduledWindow,
    suggestedLocalTime,
    timezone,
    rationale,
    status: canRequestApproval ? 'preview-ready' : 'blocked',
    approvalRequired: true,
    canRequestApproval,
    canCreateSchedulerJob: false,
    canPublish: false,
    publishingEnabled: false,
    schedulingEnabled: false,
    executionEnabled: false,
    blockers: canRequestApproval ? [] : ['Schedule preview is not requestable for this flow.'],
    nextSafeStep: canRequestApproval
      ? 'Request schedule review before any future scheduler work.'
      : 'Resolve preview blockers before requesting schedule review.',
    safety: {
      previewOnly: true,
      writesScheduler: false,
      writesExternalPlatform: false,
      writesToMind: false,
      usesCookies: false,
      usesPlaywright: false,
      callsExternalAI: false,
    },
  };
}

function determineScheduleWindow(platform: BrainCorePostPlatform): BrainCorePostSchedulePreviewItem['scheduledWindow'] {
  if (platform === 'x') return 'morning';
  if (platform === 'linkedin') return 'morning';
  if (platform === 'github') return 'midday';
  if (platform === 'facebook') return 'evening';
  if (platform === 'youtube') return 'afternoon';
  if (platform === 'blog') return 'morning';
  return 'manual-review';
}

function suggestedTimeForWindow(window: BrainCorePostSchedulePreviewItem['scheduledWindow']): string {
  switch (window) {
    case 'morning':
      return '09:00';
    case 'midday':
      return '12:00';
    case 'afternoon':
      return '15:00';
    case 'evening':
      return '18:00';
    case 'manual-review':
      return 'manual';
  }
}

function determineScheduleRationale(platform: BrainCorePostPlatform, window: BrainCorePostSchedulePreviewItem['scheduledWindow']): string {
  if (platform === 'x') return 'Short-form flow preview; candidate time chosen for weekday visibility.';
  if (platform === 'linkedin') return 'Professional audience flow preview; morning review recommended.';
  if (platform === 'github') return 'Developer-facing release flow preview; midday review recommended.';
  if (platform === 'facebook') return 'Broader social preview; evening candidate selected for distribution review.';
  if (platform === 'youtube') return 'Video preview; afternoon candidate selected for later-day review.';
  if (platform === 'blog') return 'Blog preview; morning review recommended before any future publication planning.';
  return 'Asset preview should be reviewed manually before any platform post is considered.';
}

function findSchedulePreviewItemById(schedulePreviewItemId: string): BrainCorePostSchedulePreviewItem | undefined {
  for (const event of EVENT_FIXTURES.events) {
    const queue = readPostSchedulePreviewQueue(event.id).queue;
    const item = queue.items.find((candidate) => candidate.id === schedulePreviewItemId);
    if (item) return item;
  }
  return undefined;
}

function guidanceStep(
  id: string,
  label: string,
  summary: string,
  completed: boolean,
  required: boolean,
  actionType: BrainCorePostOperatorGuidanceStep['actionType'],
): BrainCorePostOperatorGuidanceStep {
  return {
    id,
    label,
    summary,
    completed,
    required,
    actionType,
    safety: {
      executesCode: false,
      writesFiles: false,
      writesExternalPlatform: false,
      writesToMind: false,
      requiresHumanReview: true,
    },
  };
}

function operatorGuidanceSafety(): BrainCorePostOperatorGuidanceItem['safety'] {
  return {
    readOnly: true,
    autoFixEnabled: false,
    publishingEnabled: false,
    schedulingEnabled: false,
    executionEnabled: false,
    writesExternalPlatform: false,
    writesToMind: false,
  };
}

function manualExportSafety(): BrainCorePostManualExportPackage['safety'] {
  return {
    previewOnly: true,
    writesFiles: false,
    downloadsFile: false,
    copiesToClipboard: false,
    writesExternalPlatform: false,
    writesToMind: false,
    publishingEnabled: false,
    schedulingEnabled: false,
    executionEnabled: false,
  };
}

function buildManualExportItem(draft: BrainCorePostDryRunPlan['drafts'][number]): BrainCorePostManualExportItem {
  const platform = draft.platform;
  const format: BrainCorePostManualExportFormat =
    platform === 'github'
      ? 'markdown'
      : platform === 'x' || platform === 'linkedin'
        ? 'plain-text'
        : platform === 'internal'
          ? 'checklist'
          : platform === 'youtube' || platform === 'facebook'
            ? 'plain-text'
            : 'json-preview';
  return {
    id: `manual-export-${draft.id}`,
    eventId: draft.eventId,
    draftPlanId: draft.id,
    platform,
    title: draft.title,
    format,
    contentPreview: draft.copyPreview,
    checklist: [
      'Review copy',
      'Verify platform policy',
      'Confirm no publishing from Brain',
      'Manually copy only if user chooses outside Brain',
      'Keep scheduling disabled',
    ],
    reviewNotes: [
      'Preview-only manual export package.',
      'Brain does not write files or copy to clipboard.',
    ],
    status: 'preview-ready',
    safety: manualExportItemSafety(),
  };
}

function manualExportItemSafety(): BrainCorePostManualExportItem['safety'] {
  return {
    previewOnly: true,
    writesFiles: false,
    downloadsFile: false,
    copiesToClipboard: false,
    writesExternalPlatform: false,
    writesToMind: false,
    publishingEnabled: false,
    schedulingEnabled: false,
    executionEnabled: false,
  };
}

function acceptanceCheck(
  id: string,
  category: BrainCorePostAcceptanceCheckCategory,
  label: string,
  status: BrainCorePostAcceptanceCheckStatus,
  required: boolean,
  summary: string,
  evidence: string[],
  nextSafeStep: string,
): BrainCorePostAcceptanceCheck {
  return {
    id,
    category,
    label,
    status,
    required,
    summary,
    evidence,
    nextSafeStep,
    safety: {
      readOnly: true,
      executesCode: false,
      writesFiles: false,
      writesExternalPlatform: false,
      writesToMind: false,
    },
  };
}

function migrationCapability(
  id: string,
  label: string,
  status: BrainCorePostMigrationCapabilityStatus,
  summary: string,
  remainingGaps: string[],
  parityScore: number,
  nextSafeStep: string,
): BrainCorePostMigrationParityCapability {
  return {
    id,
    area: id as BrainCorePostMigrationCapabilityArea,
    label,
    status,
    summary,
    currentBrainSupport: summary.split(', ').filter(Boolean),
    remainingGaps,
    parityScore,
    nextSafeStep,
    safety: {
      previewOnly: true,
      modifiesLegacyRepo: false,
      decommissionStarted: false,
      publishingEnabled: false,
      schedulingEnabled: false,
      writesExternalPlatform: false,
      writesToMind: false,
    },
  };
}

function roadmapPhase(
  id: string,
  label: string,
  status: BrainCorePostRoadmapCheckpointPhase['status'],
  summary: string,
  evidence: string[],
): BrainCorePostRoadmapCheckpointPhase {
  return {
    id,
    label,
    status,
    summary,
    evidence,
  };
}

function overviewBlocker(
  source: BrainCorePostOrchestratorOverview['blockers'][number]['source'],
  id: string,
  label: string,
  severity: BrainCorePostOrchestratorOverview['blockers'][number]['severity'],
  nextSafeStep: string,
): BrainCorePostOrchestratorOverview['blockers'][number] {
  return {
    id,
    label,
    severity,
    source,
    nextSafeStep,
  };
}
