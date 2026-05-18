import type {
  BrainCoreVideoMetadataPlatformItem,
  BrainCoreVideoMetadataPlan,
  BrainCoreVideoMetadataPlanListResponse,
  BrainCoreVideoMetadataPlanDetailResponse,
} from '../types/api.js';

interface MetadataPlanFixture {
  intakePlanId: string;
  scriptPlanId: string;
  assetPlanId: string;
  assemblyPlanId: string;
  storySlug: string;
  title: string;
  platforms: BrainCoreVideoMetadataPlatformItem[];
}

function generateMetadataPlatforms(
  scriptPlanId: string,
  assetPlanId: string,
  assemblyPlanId: string,
): BrainCoreVideoMetadataPlatformItem[] {
  const platforms: BrainCoreVideoMetadataPlatformItem[] = [];

  // YouTube platform metadata
  platforms.push({
    id: `youtube-${scriptPlanId}`,
    platform: 'youtube',
    status: 'planned',
    titlePlaceholder: 'Title placeholder for validation only.',
    descriptionPlaceholder: 'Description placeholder for validation only.',
    tagPlaceholders: [
      'Tag placeholder for validation only.',
      'Category placeholder for validation only.',
    ],
    categoryPlaceholder: 'Category placeholder for validation only.',
    locale: 'en-US',
    requiredAssets: [
      `thumbnail-${assetPlanId}`,
      `title-card-${assetPlanId}`,
    ],
    complianceChecklist: [
      'Compliance note placeholder for validation only.',
      'Title length validation placeholder.',
      'Description format placeholder.',
    ],
    blockers: [
      'SEO generation not implemented',
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
    ],
    safety: {
      readOnly: true,
      generatesSeoCopy: false,
      callsExternalAI: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  // Facebook platform metadata
  platforms.push({
    id: `facebook-${scriptPlanId}`,
    platform: 'facebook',
    status: 'planned',
    titlePlaceholder: 'Title placeholder for validation only.',
    descriptionPlaceholder: 'Description placeholder for validation only.',
    tagPlaceholders: [
      'Tag placeholder for validation only.',
    ],
    categoryPlaceholder: 'Category placeholder for validation only.',
    locale: 'en-US',
    requiredAssets: [
      `thumbnail-${assetPlanId}`,
    ],
    complianceChecklist: [
      'Compliance note placeholder for validation only.',
      'Facebook format validation placeholder.',
    ],
    blockers: [
      'SEO generation not implemented',
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
    ],
    safety: {
      readOnly: true,
      generatesSeoCopy: false,
      callsExternalAI: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  // Pinterest platform metadata
  platforms.push({
    id: `pinterest-${scriptPlanId}`,
    platform: 'pinterest',
    status: 'planned',
    titlePlaceholder: 'Title placeholder for validation only.',
    descriptionPlaceholder: 'Description placeholder for validation only.',
    tagPlaceholders: [
      'Tag placeholder for validation only.',
    ],
    categoryPlaceholder: 'Category placeholder for validation only.',
    locale: 'en-US',
    requiredAssets: [
      `thumbnail-${assetPlanId}`,
      `pin-graphic-${assetPlanId}`,
    ],
    complianceChecklist: [
      'Compliance note placeholder for validation only.',
      'Pinterest sizing placeholder.',
    ],
    blockers: [
      'SEO generation not implemented',
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
    ],
    safety: {
      readOnly: true,
      generatesSeoCopy: false,
      callsExternalAI: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  // Generic/blog platform metadata
  platforms.push({
    id: `generic-${scriptPlanId}`,
    platform: 'generic',
    status: 'planned',
    titlePlaceholder: 'Title placeholder for validation only.',
    descriptionPlaceholder: 'Description placeholder for validation only.',
    tagPlaceholders: [
      'Tag placeholder for validation only.',
    ],
    locale: 'en-US',
    requiredAssets: [
      `thumbnail-${assetPlanId}`,
    ],
    complianceChecklist: [
      'Compliance note placeholder for validation only.',
    ],
    blockers: [
      'SEO generation not implemented',
      'Platform API integration disabled',
      'Publishing disabled',
    ],
    safety: {
      readOnly: true,
      generatesSeoCopy: false,
      callsExternalAI: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  return platforms;
}

const metadataPlanFixtures: MetadataPlanFixture[] = [
  {
    intakePlanId: 'intake-052',
    scriptPlanId: 'script-052',
    assetPlanId: 'asset-052',
    assemblyPlanId: 'assembly-052',
    storySlug: 'story-052-genesis-creation',
    title: 'Video 052 - Genesis: Creation Story - Metadata Plan',
    platforms: generateMetadataPlatforms('script-052', 'asset-052', 'assembly-052'),
  },
  {
    intakePlanId: 'intake-053',
    scriptPlanId: 'script-053',
    assetPlanId: 'asset-053',
    assemblyPlanId: 'assembly-053',
    storySlug: 'story-053-noah-flood',
    title: 'Video 053 - Noah and the Flood - Metadata Plan',
    platforms: generateMetadataPlatforms('script-053', 'asset-053', 'assembly-053'),
  },
  {
    intakePlanId: 'intake-054',
    scriptPlanId: 'script-054',
    assetPlanId: 'asset-054',
    assemblyPlanId: 'assembly-054',
    storySlug: 'story-054-abraham-covenant',
    title: 'Video 054 - Abraham and the Covenant - Metadata Plan',
    platforms: generateMetadataPlatforms('script-054', 'asset-054', 'assembly-054'),
  },
  {
    intakePlanId: 'intake-055',
    scriptPlanId: 'script-055',
    assetPlanId: 'asset-055',
    assemblyPlanId: 'assembly-055',
    storySlug: 'story-055-moses-exodus',
    title: 'Video 055 - Moses and the Exodus - Metadata Plan',
    platforms: generateMetadataPlatforms('script-055', 'asset-055', 'assembly-055'),
  },
  {
    intakePlanId: 'intake-056',
    scriptPlanId: 'script-056',
    assetPlanId: 'asset-056',
    assemblyPlanId: 'assembly-056',
    storySlug: 'story-056-david-psalms',
    title: 'Video 056 - David and the Psalms - Metadata Plan',
    platforms: generateMetadataPlatforms('script-056', 'asset-056', 'assembly-056'),
  },
];

function generateMetadataPlan(fixture: MetadataPlanFixture): BrainCoreVideoMetadataPlan {
  const plannedCount = fixture.platforms.filter(p => p.status === 'planned').length;
  const blockedCount = fixture.platforms.filter(p => p.status === 'blocked').length;
  const requiredAssetCount = fixture.platforms.reduce((sum, p) => sum + p.requiredAssets.length, 0);

  return {
    id: `metadata-plan-${fixture.storySlug}`,
    intakePlanId: fixture.intakePlanId,
    scriptPlanId: fixture.scriptPlanId,
    assetPlanId: fixture.assetPlanId,
    assemblyPlanId: fixture.assemblyPlanId,
    projectId: 'says-the-bible',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: blockedCount === 0 ? 'preview-ready' : 'blocked',
    platforms: fixture.platforms,
    summary: {
      totalPlatforms: fixture.platforms.length,
      plannedCount,
      blockedCount,
      requiredAssetCount,
    },
    blockers: [
      'SEO generation not implemented',
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
      'No file artifacts produced',
    ],
    nextSafeStep: 'Proceed to publishing-prep planning or manual export package design.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesSeoCopy: false,
      callsExternalAI: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  };
}

export function readVideoMetadataPlans(): BrainCoreVideoMetadataPlanListResponse {
  const plans = metadataPlanFixtures.map(generateMetadataPlan);
  const previewReadyCount = plans.filter(p => p.status === 'preview-ready').length;
  const blockedCount = plans.filter(p => p.status === 'blocked').length;
  const totalPlatformItems = plans.reduce((sum, p) => sum + p.platforms.length, 0);

  return {
    id: 'video-orchestrator-metadata-plan',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plans,
    summary: {
      total: plans.length,
      previewReadyCount,
      blockedCount,
      totalPlatformItems,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesSeoCopy: false,
      callsExternalAI: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  };
}

export function readVideoMetadataPlan(id: string): BrainCoreVideoMetadataPlanDetailResponse | null {
  const fixture = metadataPlanFixtures.find(f => f.intakePlanId === id);
  if (!fixture) return null;

  const plan = generateMetadataPlan(fixture);

  return {
    id: plan.id,
    generatedAt: plan.generatedAt,
    version: '1.0',
    plan,
    upstream: {
      scriptPlanId: fixture.scriptPlanId,
      assetPlanId: fixture.assetPlanId,
      assemblyPlanId: fixture.assemblyPlanId,
      intakePlanId: fixture.intakePlanId,
    },
    nextSafeStep: 'Proceed to publishing-prep planning or manual export package design.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesSeoCopy: false,
      callsExternalAI: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  };
}
