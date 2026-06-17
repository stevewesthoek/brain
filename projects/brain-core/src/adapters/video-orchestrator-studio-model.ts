import type {
  BrainCoreVOStudioAnalyticsSummary,
  BrainCoreVOStudioBrandProfile,
  BrainCoreVOStudioContentItem,
  BrainCoreVOStudioListResponse,
  BrainCoreVOStudioPipelineProfile,
  BrainCoreVOStudioPlatformAccount,
  BrainCoreVOStudioPlatformSpec,
  BrainCoreVOStudioProductionPackage,
  BrainCoreVOStudioProject,
} from '../types/api.js';

const generatedAt = (): string => new Date().toISOString();

const safety = {
  readOnly: true,
  writesFiles: false,
  publishesContent: false,
  schedulesPost: false,
  callsPlatformApi: false,
  writesToMind: false,
} as const;

const platformSpecs: BrainCoreVOStudioPlatformSpec[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    publishMode: 'limited-adapter',
    formats: [{ id: 'landscape-16x9', label: 'Landscape', aspectRatio: '16:9', width: 1920, height: 1080, safeZones: ['title-safe', 'thumbnail-lower-third'] }],
    capabilityNotes: ['First full adapter target; direct publish still approval-gated.'],
  },
  {
    id: 'youtube-shorts',
    label: 'YouTube Shorts',
    publishMode: 'manual-package',
    formats: [{ id: 'vertical-9x16', label: 'Vertical', aspectRatio: '9:16', width: 1080, height: 1920, safeZones: ['caption-safe', 'bottom-ui-safe'] }],
    capabilityNotes: ['Uses vertical derivative package until posting adapter is proven.'],
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    publishMode: 'manual-package',
    formats: [{ id: 'vertical-9x16', label: 'Vertical', aspectRatio: '9:16', width: 1080, height: 1920, safeZones: ['caption-safe', 'profile-ui-safe'] }],
    capabilityNotes: ['Manual package first; API upload requires credential/app review readiness.'],
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    publishMode: 'manual-package',
    formats: [{ id: 'pin-2x3', label: 'Pinterest Pin', aspectRatio: '2:3', width: 1000, height: 1500, safeZones: ['center-text-safe'] }],
    capabilityNotes: ['Thumbnail/template output target before direct publishing.'],
  },
  {
    id: 'facebook',
    label: 'Facebook',
    publishMode: 'manual-package',
    formats: [{ id: 'square-1x1', label: 'Square', aspectRatio: '1:1', width: 1080, height: 1080, safeZones: ['feed-center-safe'] }],
    capabilityNotes: ['Manual/social package target.'],
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    publishMode: 'manual-package',
    formats: [{ id: 'feed-4x5', label: 'Feed', aspectRatio: '4:5', width: 1080, height: 1350, safeZones: ['feed-center-safe'] }],
    capabilityNotes: ['Manual package target until company/page permissions are validated.'],
  },
];

const projects: BrainCoreVOStudioProject[] = [
  {
    id: 'says-the-bible',
    name: 'Says the Bible',
    status: 'ready-read-only',
    brandProfileId: 'brand-says-the-bible',
    defaultPipelineProfileId: 'profile-stb-package-parity',
    platformAccountIds: ['acct-stb-youtube', 'acct-stb-shorts', 'acct-stb-pinterest', 'acct-stb-facebook'],
    summary: 'First configured project for package parity and status visibility.',
  },
];

const brandProfiles: BrainCoreVOStudioBrandProfile[] = [
  {
    id: 'brand-says-the-bible',
    projectId: 'says-the-bible',
    name: 'Says the Bible',
    tone: 'biblical, direct, calm, high-clarity',
    colorTokens: ['deep-charcoal', 'warm-gold', 'off-white', 'signal-red'],
    typography: ['bold condensed title', 'readable scripture support'],
    thumbnailRules: ['one core promise or question', 'six-word overlay limit', 'platform safe-zone variants from one template'],
  },
];

const accounts: BrainCoreVOStudioPlatformAccount[] = [
  { id: 'acct-stb-youtube', projectId: 'says-the-bible', platform: 'youtube', handle: '@SaysTheBible', status: 'active', credentialState: 'connected', adapterStatus: 'ready-read-only', quotaState: 'ok', schedulerPolicy: 'weekday evening manual approval', enabledPipelineProfileIds: ['profile-stb-package-parity'], capabilities: ['manual-package', 'private-upload-preflight'] },
  { id: 'acct-stb-shorts', projectId: 'says-the-bible', platform: 'youtube-shorts', handle: '@SaysTheBible', status: 'manual-only', credentialState: 'connected', adapterStatus: 'manual-package', quotaState: 'limited', schedulerPolicy: 'manual approval only', enabledPipelineProfileIds: ['profile-stb-package-parity'], capabilities: ['manual-package'] },
  { id: 'acct-stb-pinterest', projectId: 'says-the-bible', platform: 'pinterest', handle: 'Says the Bible', status: 'manual-only', credentialState: 'manual', adapterStatus: 'manual-package', quotaState: 'unknown', schedulerPolicy: 'batch manual package', enabledPipelineProfileIds: ['profile-stb-package-parity'], capabilities: ['manual-package', 'thumbnail-variant'] },
  { id: 'acct-stb-facebook', projectId: 'says-the-bible', platform: 'facebook', handle: 'Says the Bible', status: 'manual-only', credentialState: 'manual', adapterStatus: 'manual-package', quotaState: 'unknown', schedulerPolicy: 'manual package only', enabledPipelineProfileIds: ['profile-stb-package-parity'], capabilities: ['manual-package', 'square-variant'] },
];

const pipelineProfiles: BrainCoreVOStudioPipelineProfile[] = [
  {
    id: 'profile-stb-package-parity',
    projectId: 'says-the-bible',
    name: 'STB Package Parity',
    status: 'partial',
    targetPlatforms: ['youtube', 'youtube-shorts', 'pinterest', 'facebook'],
    enabledStages: [
      { id: 'brief', label: 'Brief', status: 'enabled' },
      { id: 'script', label: 'Script', status: 'enabled' },
      { id: 'media', label: 'Media', status: 'manual-only' },
      { id: 'captions', label: 'Captions', status: 'approval-gated' },
      { id: 'thumbnails', label: 'Thumbnail Studio', status: 'approval-gated' },
      { id: 'seo', label: 'SEO Metadata', status: 'approval-gated' },
      { id: 'package', label: 'Manual Package', status: 'enabled' },
      { id: 'publish', label: 'Direct Publish', status: 'disabled' },
    ],
    approvalRules: ['operator approves thumbnail and metadata', 'direct publish disabled', 'manual package available for every target'],
    scheduleWindows: ['weekday evening', 'manual override requires approval'],
    fallbackBehavior: 'Always produce manual upload package before any adapter path.',
  },
];

const contentItems: BrainCoreVOStudioContentItem[] = [
  {
    id: 'content-stb-story-052',
    projectId: 'says-the-bible',
    sourceSlug: 'story-052-genesis-creation',
    title: 'Genesis: Creation Story',
    status: 'package-preview',
    canonicalSource: 'STB episode slug mapped to normalized ContentItem',
    pipelineProfileId: 'profile-stb-package-parity',
    packageId: 'pkg-stb-story-052',
    platformTargets: [
      { id: 'target-stb-052-youtube', platformAccountId: 'acct-stb-youtube', platform: 'youtube', mode: 'manual-package', status: 'approval-required', approvalRequired: true },
      { id: 'target-stb-052-shorts', platformAccountId: 'acct-stb-shorts', platform: 'youtube-shorts', mode: 'manual-package', status: 'draft', approvalRequired: true },
      { id: 'target-stb-052-pinterest', platformAccountId: 'acct-stb-pinterest', platform: 'pinterest', mode: 'manual-package', status: 'draft', approvalRequired: true },
      { id: 'target-stb-052-facebook', platformAccountId: 'acct-stb-facebook', platform: 'facebook', mode: 'manual-package', status: 'draft', approvalRequired: true },
    ],
    artifactVariants: [
      { id: 'artifact-stb-052-video-landscape', kind: 'video', platform: 'youtube', formatId: 'landscape-16x9', status: 'preview-ready', sourceTemplateId: 'template-stb-primary' },
      { id: 'artifact-stb-052-thumb-landscape', kind: 'thumbnail', platform: 'youtube', formatId: 'landscape-16x9', status: 'blocked', sourceTemplateId: 'template-thumbnail-unified' },
      { id: 'artifact-stb-052-thumb-pin', kind: 'thumbnail', platform: 'pinterest', formatId: 'pin-2x3', status: 'blocked', sourceTemplateId: 'template-thumbnail-unified' },
      { id: 'artifact-stb-052-metadata', kind: 'metadata', platform: 'youtube', formatId: 'landscape-16x9', status: 'preview-ready', sourceTemplateId: 'template-seo-platform' },
    ],
  },
];

const firstContentItem = contentItems[0];

const productionPackages: BrainCoreVOStudioProductionPackage[] = firstContentItem ? [
  {
    id: 'pkg-stb-story-052',
    contentItemId: 'content-stb-story-052',
    projectId: 'says-the-bible',
    status: 'blocked',
    packageType: 'manual-fallback',
    variants: firstContentItem.artifactVariants,
    postingTargets: firstContentItem.platformTargets,
    approvals: [
      { id: 'approval-thumbnail', label: 'Thumbnail variants', status: 'required' },
      { id: 'approval-metadata', label: 'SEO metadata', status: 'required' },
      { id: 'approval-package', label: 'Manual package release', status: 'not-requested' },
    ],
    auditEvents: [{ id: 'audit-normalized-model-created', event: 'Normalized VO studio model fixture created', at: '2026-05-24T00:00:00.000Z', actor: 'brain-core' }],
    blockers: ['Thumbnail generation remains provider-gated', 'Direct publishing disabled', 'Package parity not yet proven against STB output'],
    nextSafeStep: 'Use Says the Bible as the first fixture and prove package parity before enabling posting adapters.',
  },
]: [];

function response<T>(id: string, items: T[], summary: Record<string, number | string | boolean>, nextSafeStep: string): BrainCoreVOStudioListResponse<T> {
  return { id, generatedAt: generatedAt(), items, summary, safety, nextSafeStep };
}

export function readVOStudioProjects(): BrainCoreVOStudioListResponse<BrainCoreVOStudioProject> {
  return response('video-orchestrator-projects', projects, { total: projects.length, readyReadOnly: 1 }, 'Keep Says the Bible as the first configured project until package parity is proven.');
}

export function readVOStudioAccounts(): BrainCoreVOStudioListResponse<BrainCoreVOStudioPlatformAccount> {
  return response('video-orchestrator-accounts', accounts, { total: accounts.length, manualPackageAccounts: accounts.filter((account) => account.adapterStatus === 'manual-package').length }, 'Keep every account capable of manual package fallback.');
}

export function readVOStudioPipelineProfiles(): BrainCoreVOStudioListResponse<BrainCoreVOStudioPipelineProfile> {
  return response('video-orchestrator-pipeline-profiles', pipelineProfiles, { total: pipelineProfiles.length, directPublishEnabled: false }, 'Resolve profile config through project, account, platform, format, approval, and fallback policy.');
}

export function readVOStudioContentItems(): BrainCoreVOStudioListResponse<BrainCoreVOStudioContentItem> {
  return response('video-orchestrator-content-items', contentItems, { total: contentItems.length, packagePreview: contentItems.filter((item) => item.status === 'package-preview').length }, 'Keep one canonical source per content item and generate platform variants from templates.');
}

export function readVOStudioContentItem(id: string): BrainCoreVOStudioContentItem | undefined {
  return contentItems.find((item) => item.id === id);
}

export function readVOStudioPackage(id: string): BrainCoreVOStudioProductionPackage | undefined {
  return productionPackages.find((pkg) => pkg.id === id || pkg.contentItemId === id);
}

export function readVOStudioAnalyticsSummary(): BrainCoreVOStudioAnalyticsSummary {
  return {
    id: 'video-orchestrator-analytics-summary',
    status: 'partial',
    generatedAt: generatedAt(),
    kpis: [
      { label: 'Projects', value: String(projects.length), detail: 'configured in normalized studio model' },
      { label: 'Packages', value: String(productionPackages.length), detail: 'manual fallback packages tracked' },
      { label: 'Direct publishing', value: 'disabled', detail: 'requires account capability, approval, and idempotency gate' },
      { label: 'Thumbnail studio', value: 'unified', detail: 'one template system, multi-format variants' },
    ],
    byPlatform: platformSpecs.map((platform) => ({
      platform: platform.id,
      accountCount: accounts.filter((account) => account.platform === platform.id).length,
      publishedCount: 0,
      scheduledCount: 0,
      failedCount: 0,
    })),
  };
}

export function readVOStudioPlatformSpecs(): BrainCoreVOStudioListResponse<BrainCoreVOStudioPlatformSpec> {
  return response('video-orchestrator-platform-specs', platformSpecs, { total: platformSpecs.length }, 'Keep platform behavior as spec/config data instead of hardcoded UI branches.');
}

export function readVOStudioBrandProfiles(): BrainCoreVOStudioListResponse<BrainCoreVOStudioBrandProfile> {
  return response('video-orchestrator-brand-profiles', brandProfiles, { total: brandProfiles.length }, 'Use brand profiles as input to the unified thumbnail and metadata systems.');
}
