import type {
  BrainCoreVideoDesignSpec,
  BrainCoreVideoDesignPlan,
  BrainCoreVideoDesignPlanListResponse,
  BrainCoreVideoDesignPlanDetailResponse,
} from '../types/api.js';

// Design plan fixtures based on asset plans (deterministic from intake + research + script + asset-plan)
interface DesignPlanFixture {
  intakePlanId: string;
  assetPlanId: string;
  storySlug: string;
  title: string;
  platforms: string[];
  specs: BrainCoreVideoDesignSpec[];
}

const designPlanFixtures: DesignPlanFixture[] = [
  {
    intakePlanId: 'plan-intake-fixture-052',
    assetPlanId: 'asset-plan-plan-intake-fixture-052',
    storySlug: '052-2kings-widow-oil-30m',
    title: 'The Widow\'s Oil | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    specs: [
      {
        id: 'spec-052-001-thumbnail-design',
        assetRequirementId: 'req-052-001-thumbnail',
        kind: 'thumbnail-design',
        label: 'YouTube/Platform Thumbnail Design',
        status: 'planned',
        placeholder: 'Thumbnail design placeholder for validation only.',
        designSystem: {
          format: 'static-card',
          aspectRatio: '16:9',
          platformTargets: ['youtube', 'pinterest', 'facebook'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-052-002-title-card-design',
        assetRequirementId: 'req-052-002-title-card',
        kind: 'title-card-design',
        label: 'Opening Title Card Design',
        status: 'planned',
        placeholder: 'Title card design placeholder for validation only.',
        designSystem: {
          format: 'overlay',
          aspectRatio: '16:9',
          platformTargets: ['video-assembly'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-052-003-passage-card-design',
        assetRequirementId: 'req-052-003-passage-card',
        kind: 'passage-card-design',
        label: 'Scripture Passage Card Design',
        status: 'planned',
        placeholder: 'Passage card design placeholder for validation only.',
        designSystem: {
          format: 'overlay',
          aspectRatio: '16:9',
          platformTargets: ['video-assembly'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-052-004-scene-style',
        assetRequirementId: 'req-052-004-scene-visual',
        kind: 'scene-style',
        label: 'Scene Background Style Guide',
        status: 'blocked',
        placeholder: 'Scene style placeholder for validation only.',
        designSystem: {
          format: 'style-guide',
          aspectRatio: '16:9',
          platformTargets: ['video-assembly'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Image generation not enabled', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-052-005-platform-layout',
        assetRequirementId: 'req-052-005-platform-derivative',
        kind: 'platform-layout',
        label: 'Pinterest Pin Layout',
        status: 'planned',
        placeholder: 'Platform layout placeholder for validation only.',
        designSystem: {
          format: 'layout',
          aspectRatio: '4:5',
          platformTargets: ['pinterest'],
        },
        dependency: 'manual-design',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
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
    assetPlanId: 'asset-plan-plan-intake-fixture-053',
    storySlug: '053-2kings-elisha-drown-30m',
    title: 'Elisha and the Drowned Axe | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    specs: [
      {
        id: 'spec-053-001-thumbnail-design',
        assetRequirementId: 'req-053-001-thumbnail',
        kind: 'thumbnail-design',
        label: 'YouTube/Platform Thumbnail Design',
        status: 'planned',
        placeholder: 'Thumbnail design placeholder for validation only.',
        designSystem: {
          format: 'static-card',
          aspectRatio: '16:9',
          platformTargets: ['youtube', 'pinterest', 'facebook'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-053-002-title-card-design',
        assetRequirementId: 'req-053-002-title-card',
        kind: 'title-card-design',
        label: 'Opening Title Card Design',
        status: 'planned',
        placeholder: 'Title card design placeholder for validation only.',
        designSystem: {
          format: 'overlay',
          aspectRatio: '16:9',
          platformTargets: ['video-assembly'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-053-003-scene-style',
        assetRequirementId: 'req-053-003-scene-visual',
        kind: 'scene-style',
        label: 'Scene Background Style Guide',
        status: 'blocked',
        placeholder: 'Scene style placeholder for validation only.',
        designSystem: {
          format: 'style-guide',
          aspectRatio: '16:9',
          platformTargets: ['video-assembly'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Image generation not enabled', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
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
    assetPlanId: 'asset-plan-plan-intake-fixture-054',
    storySlug: '054-2kings-elisha-leprosy-30m',
    title: 'Naaman\'s Healing | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    specs: [
      {
        id: 'spec-054-001-thumbnail-design',
        assetRequirementId: 'req-054-001-thumbnail',
        kind: 'thumbnail-design',
        label: 'YouTube/Platform Thumbnail Design',
        status: 'planned',
        placeholder: 'Thumbnail design placeholder for validation only.',
        designSystem: {
          format: 'static-card',
          aspectRatio: '16:9',
          platformTargets: ['youtube', 'pinterest', 'facebook'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-054-002-metadata-visual-layout',
        assetRequirementId: 'req-054-002-metadata-visual',
        kind: 'metadata-visual-layout',
        label: 'Open Graph Image Layout',
        status: 'planned',
        placeholder: 'Metadata visual layout placeholder for validation only.',
        designSystem: {
          format: 'layout',
          aspectRatio: '1:1',
          platformTargets: ['metadata-enrichment'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
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
    assetPlanId: 'asset-plan-plan-intake-fixture-055',
    storySlug: '055-2kings-elisha-vision-30m',
    title: 'The Army of Heaven | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    specs: [
      {
        id: 'spec-055-001-thumbnail-design',
        assetRequirementId: 'req-055-001-thumbnail',
        kind: 'thumbnail-design',
        label: 'YouTube/Platform Thumbnail Design',
        status: 'planned',
        placeholder: 'Thumbnail design placeholder for validation only.',
        designSystem: {
          format: 'static-card',
          aspectRatio: '16:9',
          platformTargets: ['youtube'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-055-002-title-card-design',
        assetRequirementId: 'req-055-002-title-card',
        kind: 'title-card-design',
        label: 'Opening Title Card Design',
        status: 'blocked',
        placeholder: 'Title card design placeholder for validation only.',
        designSystem: {
          format: 'overlay',
          aspectRatio: '16:9',
          platformTargets: ['video-assembly'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
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
    assetPlanId: 'asset-plan-plan-intake-fixture-056',
    storySlug: '056-luke-jesus-asks-faith-30m',
    title: 'Jesus and the Storm | Bible Bedtime Story',
    platforms: ['youtube', 'pinterest', 'facebook'],
    specs: [
      {
        id: 'spec-056-001-thumbnail-design',
        assetRequirementId: 'req-056-001-thumbnail',
        kind: 'thumbnail-design',
        label: 'YouTube/Platform Thumbnail Design',
        status: 'planned',
        placeholder: 'Thumbnail design placeholder for validation only.',
        designSystem: {
          format: 'static-card',
          aspectRatio: '16:9',
          platformTargets: ['youtube'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
      {
        id: 'spec-056-002-passage-card-design',
        assetRequirementId: 'req-056-003-passage-card',
        kind: 'passage-card-design',
        label: 'Scripture Passage Card Design',
        status: 'planned',
        placeholder: 'Passage card design placeholder for validation only.',
        designSystem: {
          format: 'overlay',
          aspectRatio: '16:9',
          platformTargets: ['video-assembly'],
        },
        dependency: 'design-orchestrator',
        blockers: ['Design orchestrator not yet implemented', 'Video assembly stage not implemented'],
        safety: {
          readOnly: true,
          generatesImage: false,
          generatesPrompt: false,
          callsExternalAI: false,
          writesFiles: false,
          publishesContent: false,
          writesToMind: false,
        },
      },
    ],
  },
];

function generateDesignPlan(fixture: DesignPlanFixture): BrainCoreVideoDesignPlan {
  const plannedCount = fixture.specs.filter(s => s.status === 'planned').length;
  const blockedCount = fixture.specs.filter(s => s.status === 'blocked').length;
  const platformLayoutCount = fixture.specs.filter(s => s.kind === 'platform-layout').length;

  return {
    id: `design-plan-${fixture.assetPlanId}`,
    assetPlanId: fixture.assetPlanId,
    intakePlanId: fixture.intakePlanId,
    projectId: 'says-the-bible-video',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: blockedCount > 0 ? 'blocked' : 'preview-ready',
    specs: fixture.specs,
    summary: {
      totalSpecs: fixture.specs.length,
      plannedCount,
      blockedCount,
      platformLayoutCount,
    },
    blockers: [
      'Design orchestrator not yet implemented',
      'Video assembly stage not implemented',
      'Image generation not enabled',
    ],
    nextSafeStep: 'Implement design orchestrator or design spec placeholder rendering',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoDesignPlans(): BrainCoreVideoDesignPlanListResponse {
  const plans = designPlanFixtures.map(generateDesignPlan);
  const previewReadyCount = plans.filter(p => p.status === 'preview-ready').length;
  const blockedCount = plans.filter(p => p.status === 'blocked').length;
  const totalSpecs = plans.reduce((sum, p) => sum + p.summary.totalSpecs, 0);

  return {
    id: 'video-orchestrator-design-plan',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plans,
    summary: {
      total: plans.length,
      previewReadyCount,
      blockedCount,
      totalSpecs,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoDesignPlan(assetPlanId: string): BrainCoreVideoDesignPlanDetailResponse | undefined {
  const fixture = designPlanFixtures.find(f => f.assetPlanId === assetPlanId);
  if (!fixture) return undefined;

  const plan = generateDesignPlan(fixture);

  return {
    id: plan.id,
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plan,
    upstream: {
      assetPlanId: fixture.assetPlanId,
      intakePlanId: fixture.intakePlanId,
    },
    nextSafeStep: 'Design orchestrator required to convert design specs into design system components; otherwise manual design spec provision needed',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}
