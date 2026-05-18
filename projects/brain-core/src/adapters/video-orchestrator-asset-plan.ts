import type {
  BrainCoreVideoAssetRequirement,
  BrainCoreVideoAssetPlan,
  BrainCoreVideoAssetPlanListResponse,
  BrainCoreVideoAssetPlanDetailResponse,
} from '../types/api.js';

// Asset planning fixtures based on script plans (deterministic from intake + research + script)
interface AssetPlanFixture {
  intakePlanId: string;
  scriptId: string;
  researchId: string;
  storySlug: string;
  title: string;
  platforms: string[];
  requirements: BrainCoreVideoAssetRequirement[];
}

const assetPlanFixtures: AssetPlanFixture[] = [
  {
    intakePlanId: 'plan-intake-fixture-052',
    scriptId: 'script-plan-plan-intake-fixture-052',
    researchId: 'video-research-plan-intake-fixture-052',
    storySlug: '052-2kings-widow-oil-30m',
    title: 'The Widow\'s Oil | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    requirements: [
      {
        id: 'req-052-001-thumbnail',
        kind: 'thumbnail',
        label: 'YouTube/Platform Thumbnail',
        status: 'planned',
        requiredForStages: ['platform-publish-youtube', 'platform-publish-pinterest', 'platform-publish-facebook'],
        placeholder: 'Thumbnail concept placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-052-002-title-card',
        kind: 'title-card',
        label: 'Opening Title Card',
        status: 'planned',
        requiredForStages: ['video-assembly'],
        placeholder: 'Title card placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-052-003-passage-card',
        kind: 'passage-card',
        label: 'Scripture Passage Card',
        status: 'planned',
        requiredForStages: ['video-assembly'],
        placeholder: 'Passage card placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-052-004-scene-visual',
        kind: 'scene-visual',
        label: 'Scene Background Visual',
        status: 'blocked',
        requiredForStages: ['video-assembly'],
        placeholder: 'Scene visual placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'No image generation enabled', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-052-005-platform-derivative',
        kind: 'platform-derivative',
        label: 'Pinterest Pin (1000x1500)',
        status: 'planned',
        requiredForStages: ['platform-publish-pinterest'],
        placeholder: 'Platform derivative placeholder for validation only.',
        designDependency: 'manual-design',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
    ],
  },
  {
    intakePlanId: 'plan-intake-fixture-053',
    scriptId: 'script-plan-plan-intake-fixture-053',
    researchId: 'video-research-plan-intake-fixture-053',
    storySlug: '053-2kings-elisha-drown-30m',
    title: 'Elisha and the Drowned Axe | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    requirements: [
      {
        id: 'req-053-001-thumbnail',
        kind: 'thumbnail',
        label: 'YouTube/Platform Thumbnail',
        status: 'planned',
        requiredForStages: ['platform-publish-youtube', 'platform-publish-pinterest', 'platform-publish-facebook'],
        placeholder: 'Thumbnail concept placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-053-002-title-card',
        kind: 'title-card',
        label: 'Opening Title Card',
        status: 'planned',
        requiredForStages: ['video-assembly'],
        placeholder: 'Title card placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-053-003-scene-visual',
        kind: 'scene-visual',
        label: 'Scene Background Visual',
        status: 'blocked',
        requiredForStages: ['video-assembly'],
        placeholder: 'Scene visual placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'No image generation enabled', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
    ],
  },
  {
    intakePlanId: 'plan-intake-fixture-054',
    scriptId: 'script-plan-plan-intake-fixture-054',
    researchId: 'video-research-plan-intake-fixture-054',
    storySlug: '054-2kings-elisha-leprosy-30m',
    title: 'Naaman\'s Healing | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    requirements: [
      {
        id: 'req-054-001-thumbnail',
        kind: 'thumbnail',
        label: 'YouTube/Platform Thumbnail',
        status: 'planned',
        requiredForStages: ['platform-publish-youtube', 'platform-publish-pinterest', 'platform-publish-facebook'],
        placeholder: 'Thumbnail concept placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-054-002-metadata-visual',
        kind: 'metadata-visual',
        label: 'Open Graph Image',
        status: 'planned',
        requiredForStages: ['metadata-enrichment'],
        placeholder: 'Platform derivative placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
    ],
  },
  {
    intakePlanId: 'plan-intake-fixture-055',
    scriptId: 'script-plan-plan-intake-fixture-055',
    researchId: 'video-research-plan-intake-fixture-055',
    storySlug: '055-2kings-elisha-vision-30m',
    title: 'The Army of Heaven | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    requirements: [
      {
        id: 'req-055-001-thumbnail',
        kind: 'thumbnail',
        label: 'YouTube/Platform Thumbnail',
        status: 'planned',
        requiredForStages: ['platform-publish-youtube'],
        placeholder: 'Thumbnail concept placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-055-002-title-card',
        kind: 'title-card',
        label: 'Opening Title Card',
        status: 'blocked',
        requiredForStages: ['video-assembly'],
        placeholder: 'Title card placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
    ],
  },
  {
    intakePlanId: 'plan-intake-fixture-056',
    scriptId: 'script-plan-plan-intake-fixture-056',
    researchId: 'video-research-plan-intake-fixture-056',
    storySlug: '056-luke-jesus-asks-faith-30m',
    title: 'Jesus and the Storm | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    requirements: [
      {
        id: 'req-056-001-thumbnail',
        kind: 'thumbnail',
        label: 'YouTube/Platform Thumbnail',
        status: 'planned',
        requiredForStages: ['platform-publish-youtube'],
        placeholder: 'Thumbnail concept placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-056-002-b-roll',
        kind: 'b-roll',
        label: 'Sea/Storm Background Loop',
        status: 'blocked',
        requiredForStages: ['video-assembly'],
        placeholder: 'Scene visual placeholder for validation only.',
        designDependency: 'none',
        blockers: ['No video generation enabled', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'req-056-003-passage-card',
        kind: 'passage-card',
        label: 'Scripture Passage Card',
        status: 'planned',
        requiredForStages: ['video-assembly'],
        placeholder: 'Passage card placeholder for validation only.',
        designDependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
    ],
  },
];

function generateAssetPlan(fixture: AssetPlanFixture): BrainCoreVideoAssetPlan {
  const plannedCount = fixture.requirements.filter(r => r.status === 'planned').length;
  const blockedCount = fixture.requirements.filter(r => r.status === 'blocked').length;

  return {
    id: `asset-plan-${fixture.intakePlanId}`,
    intakePlanId: fixture.intakePlanId,
    researchId: fixture.researchId,
    scriptId: fixture.scriptId,
    projectId: 'says-the-bible-video',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: blockedCount > 0 ? 'blocked' : 'preview-ready',
    requirements: fixture.requirements,
    summary: {
      totalRequirements: fixture.requirements.length,
      thumbnailCount: fixture.requirements.filter(r => r.kind === 'thumbnail').length,
      sceneVisualCount: fixture.requirements.filter(r => r.kind === 'scene-visual' || r.kind === 'b-roll').length,
      platformDerivativeCount: fixture.requirements.filter(r => r.kind === 'platform-derivative' || r.kind === 'metadata-visual').length,
      blockedCount,
    },
    blockers: [
      'Design orchestrator not yet implemented',
      'Video assembly stage not implemented',
      'Image generation not enabled',
    ],
    nextSafeStep: 'Implement design orchestrator or visual generation placeholder',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoAssetPlans(): BrainCoreVideoAssetPlanListResponse {
  const plans = assetPlanFixtures.map(generateAssetPlan);
  const previewReadyCount = plans.filter(p => p.status === 'preview-ready').length;
  const blockedCount = plans.filter(p => p.status === 'blocked').length;
  const totalRequirements = plans.reduce((sum, p) => sum + p.summary.totalRequirements, 0);

  return {
    id: 'video-orchestrator-asset-plan',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plans,
    summary: {
      total: plans.length,
      previewReadyCount,
      blockedCount,
      totalRequirements,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoAssetPlan(intakePlanId: string): BrainCoreVideoAssetPlanDetailResponse | undefined {
  const fixture = assetPlanFixtures.find(f => f.intakePlanId === intakePlanId);
  if (!fixture) return undefined;

  const plan = generateAssetPlan(fixture);

  return {
    id: plan.id,
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plan,
    upstream: {
      intakePlanId: fixture.intakePlanId,
      researchId: fixture.researchId,
      scriptId: fixture.scriptId,
    },
    nextSafeStep: 'Design orchestrator required to generate visual assets; otherwise manual asset provision needed',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}
