import type {
  BrainCoreVideoPublishingPrepChecklistItem,
  BrainCoreVideoPublishingPrepPlatform,
  BrainCoreVideoPublishingPrepPlan,
  BrainCoreVideoPublishingPrepPlanListResponse,
  BrainCoreVideoPublishingPrepPlanDetailResponse,
} from '../types/api.js';

interface PublishingPrepFixture {
  intakePlanId: string;
  metadataPlanId: string;
  assemblyPlanId: string;
  assetPlanId: string;
  storySlug: string;
  title: string;
  platforms: BrainCoreVideoPublishingPrepPlatform[];
}

function generatePublishingPrepChecklist(): BrainCoreVideoPublishingPrepChecklistItem[] {
  return [
    {
      id: 'checklist-metadata-title',
      label: 'Metadata: Title completeness',
      status: 'planned',
      category: 'metadata',
      placeholder: 'Publishing checklist placeholder for validation only.',
      blockers: [],
      safety: {
        readOnly: true,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'checklist-metadata-description',
      label: 'Metadata: Description completeness',
      status: 'planned',
      category: 'metadata',
      placeholder: 'Publishing checklist placeholder for validation only.',
      blockers: [],
      safety: {
        readOnly: true,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'checklist-asset-thumbnail',
      label: 'Assets: Thumbnail available',
      status: 'planned',
      category: 'asset',
      placeholder: 'Artifact dependency placeholder for validation only.',
      blockers: [],
      safety: {
        readOnly: true,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'checklist-assembly-timeline',
      label: 'Assembly: Timeline validated',
      status: 'planned',
      category: 'assembly',
      placeholder: 'Platform readiness placeholder for validation only.',
      blockers: [],
      safety: {
        readOnly: true,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'checklist-policy-compliance',
      label: 'Policy: Compliance review',
      status: 'planned',
      category: 'policy',
      placeholder: 'Compliance checklist placeholder for validation only.',
      blockers: [],
      safety: {
        readOnly: true,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
    {
      id: 'checklist-manual-review',
      label: 'Manual: Operator review',
      status: 'planned',
      category: 'manual-review',
      placeholder: 'Manual upload step placeholder for validation only.',
      blockers: [],
      safety: {
        readOnly: true,
        callsPlatformApi: false,
        schedulesPost: false,
        publishesContent: false,
        writesFiles: false,
        writesToMind: false,
      },
    },
  ];
}

function generatePublishingPrepPlatforms(
  metadataPlanId: string,
  assemblyPlanId: string,
  assetPlanId: string,
): BrainCoreVideoPublishingPrepPlatform[] {
  const sharedChecklist = generatePublishingPrepChecklist();
  const platforms: BrainCoreVideoPublishingPrepPlatform[] = [];

  // YouTube platform
  platforms.push({
    id: `youtube-prep-${metadataPlanId}`,
    platform: 'youtube',
    status: 'planned',
    checklist: sharedChecklist,
    requiredArtifactRefs: [
      `thumbnail-${assetPlanId}`,
      `title-card-${assetPlanId}`,
    ],
    requiredMetadataRefs: [
      `youtube-metadata-${metadataPlanId}`,
    ],
    blockers: [
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
      'Manual export package not implemented',
    ],
    nextSafeStep: 'Proceed to manual export package planning.',
    safety: {
      readOnly: true,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  // Facebook platform
  platforms.push({
    id: `facebook-prep-${metadataPlanId}`,
    platform: 'facebook',
    status: 'planned',
    checklist: sharedChecklist,
    requiredArtifactRefs: [
      `thumbnail-${assetPlanId}`,
    ],
    requiredMetadataRefs: [
      `facebook-metadata-${metadataPlanId}`,
    ],
    blockers: [
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
      'Manual export package not implemented',
    ],
    nextSafeStep: 'Proceed to manual export package planning.',
    safety: {
      readOnly: true,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  // Pinterest platform
  platforms.push({
    id: `pinterest-prep-${metadataPlanId}`,
    platform: 'pinterest',
    status: 'planned',
    checklist: sharedChecklist,
    requiredArtifactRefs: [
      `thumbnail-${assetPlanId}`,
      `pin-graphic-${assetPlanId}`,
    ],
    requiredMetadataRefs: [
      `pinterest-metadata-${metadataPlanId}`,
    ],
    blockers: [
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
      'Manual export package not implemented',
    ],
    nextSafeStep: 'Proceed to manual export package planning.',
    safety: {
      readOnly: true,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  // Generic/blog platform
  platforms.push({
    id: `generic-prep-${metadataPlanId}`,
    platform: 'generic',
    status: 'planned',
    checklist: sharedChecklist,
    requiredArtifactRefs: [
      `thumbnail-${assetPlanId}`,
    ],
    requiredMetadataRefs: [
      `generic-metadata-${metadataPlanId}`,
    ],
    blockers: [
      'Manual export package not implemented',
    ],
    nextSafeStep: 'Proceed to manual export package planning.',
    safety: {
      readOnly: true,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  });

  return platforms;
}

const publishingPrepFixtures: PublishingPrepFixture[] = [
  {
    intakePlanId: 'intake-052',
    metadataPlanId: 'metadata-plan-story-052-genesis-creation',
    assemblyPlanId: 'assembly-052',
    assetPlanId: 'asset-052',
    storySlug: 'story-052-genesis-creation',
    title: 'Video 052 - Genesis: Creation Story - Publishing Prep',
    platforms: generatePublishingPrepPlatforms('metadata-052', 'assembly-052', 'asset-052'),
  },
  {
    intakePlanId: 'intake-053',
    metadataPlanId: 'metadata-plan-story-053-noah-flood',
    assemblyPlanId: 'assembly-053',
    assetPlanId: 'asset-053',
    storySlug: 'story-053-noah-flood',
    title: 'Video 053 - Noah and the Flood - Publishing Prep',
    platforms: generatePublishingPrepPlatforms('metadata-053', 'assembly-053', 'asset-053'),
  },
  {
    intakePlanId: 'intake-054',
    metadataPlanId: 'metadata-plan-story-054-abraham-covenant',
    assemblyPlanId: 'assembly-054',
    assetPlanId: 'asset-054',
    storySlug: 'story-054-abraham-covenant',
    title: 'Video 054 - Abraham and the Covenant - Publishing Prep',
    platforms: generatePublishingPrepPlatforms('metadata-054', 'assembly-054', 'asset-054'),
  },
  {
    intakePlanId: 'intake-055',
    metadataPlanId: 'metadata-plan-story-055-moses-exodus',
    assemblyPlanId: 'assembly-055',
    assetPlanId: 'asset-055',
    storySlug: 'story-055-moses-exodus',
    title: 'Video 055 - Moses and the Exodus - Publishing Prep',
    platforms: generatePublishingPrepPlatforms('metadata-055', 'assembly-055', 'asset-055'),
  },
  {
    intakePlanId: 'intake-056',
    metadataPlanId: 'metadata-plan-story-056-david-psalms',
    assemblyPlanId: 'assembly-056',
    assetPlanId: 'asset-056',
    storySlug: 'story-056-david-psalms',
    title: 'Video 056 - David and the Psalms - Publishing Prep',
    platforms: generatePublishingPrepPlatforms('metadata-056', 'assembly-056', 'asset-056'),
  },
];

function generatePublishingPrepPlan(fixture: PublishingPrepFixture): BrainCoreVideoPublishingPrepPlan {
  const plannedCount = fixture.platforms.filter(p => p.status === 'planned').length;
  const blockedCount = fixture.platforms.filter(p => p.status === 'blocked').length;
  const checklistItemCount = fixture.platforms.reduce((sum, p) => sum + p.checklist.length, 0);
  const missingItemCount = fixture.platforms.reduce(
    (sum, p) => sum + p.checklist.filter(c => c.status === 'missing').length,
    0,
  );

  return {
    id: `publishing-prep-${fixture.storySlug}`,
    intakePlanId: fixture.intakePlanId,
    metadataPlanId: fixture.metadataPlanId,
    assemblyPlanId: fixture.assemblyPlanId,
    assetPlanId: fixture.assetPlanId,
    projectId: 'says-the-bible',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: blockedCount === 0 ? 'preview-ready' : 'blocked',
    platforms: fixture.platforms,
    summary: {
      totalPlatforms: fixture.platforms.length,
      plannedCount,
      blockedCount,
      checklistItemCount,
      missingItemCount,
    },
    blockers: [
      'Platform API integration disabled',
      'Scheduling disabled',
      'Publishing disabled',
      'Manual export package not implemented',
      'No file artifacts produced',
    ],
    nextSafeStep: 'Proceed to manual export package planning or dual-run evidence collection.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  };
}

export function readVideoPublishingPrepPlans(): BrainCoreVideoPublishingPrepPlanListResponse {
  const plans = publishingPrepFixtures.map(generatePublishingPrepPlan);
  const previewReadyCount = plans.filter(p => p.status === 'preview-ready').length;
  const blockedCount = plans.filter(p => p.status === 'blocked').length;
  const totalPlatforms = plans.reduce((sum, p) => sum + p.platforms.length, 0);
  const totalChecklistItems = plans.reduce((sum, p) => sum + p.summary.checklistItemCount, 0);

  return {
    id: 'video-orchestrator-publishing-prep',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plans,
    summary: {
      total: plans.length,
      previewReadyCount,
      blockedCount,
      totalPlatforms,
      totalChecklistItems,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  };
}

export function readVideoPublishingPrepPlan(id: string): BrainCoreVideoPublishingPrepPlanDetailResponse | null {
  const fixture = publishingPrepFixtures.find(f => f.intakePlanId === id);
  if (!fixture) return null;

  const plan = generatePublishingPrepPlan(fixture);

  return {
    id: plan.id,
    generatedAt: plan.generatedAt,
    version: '1.0',
    plan,
    upstream: {
      metadataPlanId: fixture.metadataPlanId,
      assemblyPlanId: fixture.assemblyPlanId,
      assetPlanId: fixture.assetPlanId,
      intakePlanId: fixture.intakePlanId,
    },
    nextSafeStep: 'Proceed to manual export package planning or dual-run evidence collection.',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      callsPlatformApi: false,
      schedulesPost: false,
      publishesContent: false,
      writesFiles: false,
      writesToMind: false,
    },
  };
}
