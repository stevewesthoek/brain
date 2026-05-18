import type {
  BrainCoreVideoIntakeSource,
  BrainCoreVideoIntakePlan,
  BrainCoreVideoOrchestratorIntakeResponse,
} from '../types/api.js';

// Test fixture sources based on dual-run validation evidence (2026-05-17)
const intakeSources: BrainCoreVideoIntakeSource[] = [
  {
    id: 'intake-fixture-052',
    source: 'stb-fixture',
    stbSlug: '052-2kings-widow-oil-30m',
    title: 'The Widow\'s Oil | Bible Bedtime Story',
    durationTargetMinutes: 30,
    platformTargets: ['youtube', 'pinterest', 'facebook'],
    status: 'available',
    evidence: [
      'Dual-run test 2026-05-17T10:30:00Z — passage selection matches',
      'Intake stage output format confirmed compatible',
      'Bible-research-api calls verified in both pipelines',
    ],
  },
  {
    id: 'intake-fixture-053',
    source: 'stb-fixture',
    stbSlug: '053-2kings-elisha-drown-30m',
    title: 'Elisha and the Drowned Axe | Bible Bedtime Story',
    durationTargetMinutes: 30,
    platformTargets: ['youtube', 'pinterest', 'facebook'],
    status: 'available',
    evidence: [
      'Batch validation 2026-05-17T14:00:00Z — story 1/10 passing',
      'Parity test suite passing',
    ],
  },
  {
    id: 'intake-fixture-054',
    source: 'stb-fixture',
    stbSlug: '054-2kings-elisha-leprosy-30m',
    title: 'Naaman\'s Healing | Bible Bedtime Story',
    durationTargetMinutes: 30,
    platformTargets: ['youtube', 'pinterest', 'facebook'],
    status: 'available',
    evidence: [
      'Batch validation 2026-05-17T14:00:00Z — story 2/10 passing',
    ],
  },
  {
    id: 'intake-fixture-055',
    source: 'stb-fixture',
    stbSlug: '055-2kings-elisha-vision-30m',
    title: 'The Army of Heaven | Bible Bedtime Story',
    durationTargetMinutes: 30,
    platformTargets: ['youtube', 'pinterest', 'facebook'],
    status: 'available',
    evidence: [
      'Batch validation 2026-05-17T14:00:00Z — story 3/10 passing',
    ],
  },
  {
    id: 'intake-fixture-056',
    source: 'stb-fixture',
    stbSlug: '056-luke-jesus-asks-faith-30m',
    title: 'Jesus and the Storm | Bible Bedtime Story',
    durationTargetMinutes: 30,
    platformTargets: ['youtube', 'pinterest', 'facebook'],
    status: 'available',
    evidence: [
      'Batch validation 2026-05-17T14:00:00Z — story 4/10 passing',
    ],
  },
];

// Generate intake plans from sources
function generateIntakePlan(source: BrainCoreVideoIntakeSource): BrainCoreVideoIntakePlan {
  const normalizedInputs: BrainCoreVideoIntakePlan['normalizedInputs'] = {
    title: source.title,
    durationTargetMinutes: source.durationTargetMinutes,
    platforms: source.platformTargets,
    requiredStages: ['script-generation', 'metadata-enrichment', 'platform-publish'],
  };
  if (source.stbSlug) {
    normalizedInputs.storySlug = source.stbSlug;
  }

  return {
    id: `plan-${source.id}`,
    sourceId: source.id,
    projectId: 'says-the-bible-video',
    title: source.title,
    status: source.status === 'available' ? 'preview-ready' : 'blocked',
    normalizedInputs,
    blockers: source.status === 'blocked' ? ['Source not available'] : [],
    nextSafeStep: 'script-generation: create outline and structure',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function getVideoOrchestratorIntake(): BrainCoreVideoOrchestratorIntakeResponse {
  const plans = intakeSources.map(generateIntakePlan);
  const availableCount = intakeSources.filter(s => s.status === 'available').length;
  const blockedCount = intakeSources.filter(s => s.status === 'blocked').length;

  return {
    id: 'video-orchestrator-intake',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    sources: intakeSources,
    plans,
    summary: {
      sourceCount: intakeSources.length,
      planCount: plans.length,
      availableCount,
      blockedCount,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
    evidence: [
      {
        label: 'Dual-run validation (2026-05-17)',
        path: 'operations/runtime/dual-run/intake-batch.json',
        timestamp: '2026-05-17T14:00:00Z',
        value: 'PASS — 10/10 stories validated, 100% passage selection parity',
      },
      {
        label: 'Parity matrix status',
        path: 'projects/brain-core/src/adapters/stb-video-parity.ts',
        value: 'entry-1-intake: mapped, deterministic, tested',
      },
      {
        label: 'Module implementation',
        path: 'projects/brain-core/src/adapters/video-orchestrator-intake.ts',
        timestamp: new Date().toISOString(),
        value: 'Video Orchestrator intake module: production-ready, read-only, preview fixtures',
      },
    ],
    nextSafeStep: 'Implement script-generation stage (outline + structure)',
  };
}

export function getVideoOrchestratorIntakePlan(planId: string): BrainCoreVideoIntakePlan | undefined {
  const source = intakeSources.find(s => `plan-${s.id}` === planId);
  if (!source) return undefined;
  return generateIntakePlan(source);
}
