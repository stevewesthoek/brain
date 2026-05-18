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

export function readPostOrchestratorStatus(): BrainCorePostOrchestratorStatusResponse {
  return STATUS;
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
