import type {
  BrainCoreVideoAssemblyTimelineItem,
  BrainCoreVideoAssemblyPlan,
  BrainCoreVideoAssemblyPlanListResponse,
  BrainCoreVideoAssemblyPlanDetailResponse,
} from '../types/api.js';

interface AssemblyPlanFixture {
  intakePlanId: string;
  voiceoverPlanId: string;
  visualsPlanId: string;
  assetPlanId: string;
  designPlanId: string;
  scriptPlanId: string;
  storySlug: string;
  title: string;
  estimatedDurationMinutes: number;
  timeline: BrainCoreVideoAssemblyTimelineItem[];
}

function generateAssemblyTimelineFromPlans(
  voiceoverPlanId: string,
  visualsPlanId: string,
  assetPlanId: string,
  designPlanId: string,
): BrainCoreVideoAssemblyTimelineItem[] {
  const timeline: BrainCoreVideoAssemblyTimelineItem[] = [];
  let currentSecond = 0;

  // Intro segment: combines title card visual + intro voiceover
  timeline.push({
    id: `asm-${voiceoverPlanId}-001-intro`,
    sequence: 1,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[4]}-001-intro`,
    visualSequenceItemId: `vis-${visualsPlanId}-001-intro`,
    assetRequirementId: `asset-${assetPlanId}-intro`,
    designSpecId: `design-spec-${designPlanId}-intro`,
    kind: 'intro',
    label: 'Title Card + Intro',
    status: 'planned',
    placeholder: 'Timeline segment placeholder for validation only.',
    timing: {
      startSecond: currentSecond,
      durationSeconds: 45,
      endSecond: currentSecond + 45,
    },
    sync: {
      requiresVoiceover: true,
      requiresVisual: true,
      requiresOverlay: false,
    },
    compositionRequirements: [
      'Sync point placeholder for validation only.',
      'Title card layout placeholder for validation only.',
    ],
    blockers: ['Video rendering not implemented', 'FFmpeg/export runner disabled'],
    safety: {
      readOnly: true,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 45;

  // Main body segment: scene visuals + body voiceover + b-roll
  timeline.push({
    id: `asm-${voiceoverPlanId}-002-main`,
    sequence: 2,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[4]}-002-body`,
    visualSequenceItemId: `vis-${visualsPlanId}-002-body`,
    assetRequirementId: `asset-${assetPlanId}-body`,
    designSpecId: `design-spec-${designPlanId}-body`,
    kind: 'main-segment',
    label: 'Main Story + B-Roll',
    status: 'planned',
    placeholder: 'Timeline segment placeholder for validation only.',
    timing: {
      startSecond: currentSecond,
      durationSeconds: 1200,
      endSecond: currentSecond + 1200,
    },
    sync: {
      requiresVoiceover: true,
      requiresVisual: true,
      requiresOverlay: false,
    },
    compositionRequirements: [
      'Sync point placeholder for validation only.',
      'Scene composition placeholder for validation only.',
      'B-roll timing placeholder for validation only.',
    ],
    blockers: ['Video rendering not implemented', 'FFmpeg/export runner disabled', 'B-roll composition disabled'],
    safety: {
      readOnly: true,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 1200;

  // Passage segment: passage card overlay + scripture voiceover
  timeline.push({
    id: `asm-${voiceoverPlanId}-003-passage`,
    sequence: 3,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[4]}-003-passage`,
    visualSequenceItemId: `vis-${visualsPlanId}-003-passage`,
    assetRequirementId: `asset-${assetPlanId}-passage`,
    designSpecId: `design-spec-${designPlanId}-passage`,
    kind: 'passage-card',
    label: 'Scripture Passage Card',
    status: 'planned',
    placeholder: 'Timeline segment placeholder for validation only.',
    timing: {
      startSecond: currentSecond,
      durationSeconds: 60,
      endSecond: currentSecond + 60,
    },
    sync: {
      requiresVoiceover: true,
      requiresVisual: true,
      requiresOverlay: true,
    },
    compositionRequirements: [
      'Sync point placeholder for validation only.',
      'Overlay placement placeholder for validation only.',
      'Text rendering placeholder for validation only.',
    ],
    blockers: ['Video rendering not implemented', 'FFmpeg/export runner disabled'],
    safety: {
      readOnly: true,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 60;

  // Application segment: text overlay + application voiceover
  timeline.push({
    id: `asm-${voiceoverPlanId}-004-application`,
    sequence: 4,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[4]}-004-application`,
    visualSequenceItemId: `vis-${visualsPlanId}-004-application`,
    assetRequirementId: `asset-${assetPlanId}-application`,
    designSpecId: `design-spec-${designPlanId}-application`,
    kind: 'overlay',
    label: 'Application / Reflection Overlay',
    status: 'planned',
    placeholder: 'Timeline segment placeholder for validation only.',
    timing: {
      startSecond: currentSecond,
      durationSeconds: 90,
      endSecond: currentSecond + 90,
    },
    sync: {
      requiresVoiceover: true,
      requiresVisual: true,
      requiresOverlay: true,
    },
    compositionRequirements: [
      'Sync point placeholder for validation only.',
      'Overlay placement placeholder for validation only.',
      'Composition requirement placeholder for validation only.',
    ],
    blockers: ['Video rendering not implemented', 'FFmpeg/export runner disabled'],
    safety: {
      readOnly: true,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 90;

  // Outro segment: closing visual + outro voiceover + credits
  timeline.push({
    id: `asm-${voiceoverPlanId}-005-outro`,
    sequence: 5,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[4]}-005-outro`,
    visualSequenceItemId: `vis-${visualsPlanId}-005-outro`,
    assetRequirementId: `asset-${assetPlanId}-outro`,
    designSpecId: `design-spec-${designPlanId}-outro`,
    kind: 'outro',
    label: 'Closing Credits',
    status: 'planned',
    placeholder: 'Timeline segment placeholder for validation only.',
    timing: {
      startSecond: currentSecond,
      durationSeconds: 30,
      endSecond: currentSecond + 30,
    },
    sync: {
      requiresVoiceover: true,
      requiresVisual: true,
      requiresOverlay: false,
    },
    compositionRequirements: [
      'Sync point placeholder for validation only.',
      'Credits layout placeholder for validation only.',
    ],
    blockers: ['Video rendering not implemented', 'FFmpeg/export runner disabled'],
    safety: {
      readOnly: true,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 30;

  return timeline;
}

const assemblyPlanFixtures: AssemblyPlanFixture[] = [
  {
    intakePlanId: 'plan-intake-fixture-052',
    scriptPlanId: 'script-plan-plan-intake-fixture-052',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-052',
    visualsPlanId: 'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-052',
    assetPlanId: 'asset-plan-plan-intake-fixture-052',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-052',
    storySlug: '052-2kings-widow-oil-30m',
    title: 'The Widow\'s Oil | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    timeline: generateAssemblyTimelineFromPlans(
      'voiceover-plan-script-plan-plan-intake-fixture-052',
      'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-052',
      'asset-plan-plan-intake-fixture-052',
      'design-plan-asset-plan-plan-intake-fixture-052',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-053',
    scriptPlanId: 'script-plan-plan-intake-fixture-053',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-053',
    visualsPlanId: 'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-053',
    assetPlanId: 'asset-plan-plan-intake-fixture-053',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-053',
    storySlug: '053-1samuel-david-goliath-30m',
    title: 'David and Goliath | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    timeline: generateAssemblyTimelineFromPlans(
      'voiceover-plan-script-plan-plan-intake-fixture-053',
      'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-053',
      'asset-plan-plan-intake-fixture-053',
      'design-plan-asset-plan-plan-intake-fixture-053',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-054',
    scriptPlanId: 'script-plan-plan-intake-fixture-054',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-054',
    visualsPlanId: 'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-054',
    assetPlanId: 'asset-plan-plan-intake-fixture-054',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-054',
    storySlug: '054-jonah-great-fish-30m',
    title: 'Jonah and the Great Fish | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    timeline: generateAssemblyTimelineFromPlans(
      'voiceover-plan-script-plan-plan-intake-fixture-054',
      'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-054',
      'asset-plan-plan-intake-fixture-054',
      'design-plan-asset-plan-plan-intake-fixture-054',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-055',
    scriptPlanId: 'script-plan-plan-intake-fixture-055',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-055',
    visualsPlanId: 'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-055',
    assetPlanId: 'asset-plan-plan-intake-fixture-055',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-055',
    storySlug: '055-prodigal-son-30m',
    title: 'The Prodigal Son | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    timeline: generateAssemblyTimelineFromPlans(
      'voiceover-plan-script-plan-plan-intake-fixture-055',
      'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-055',
      'asset-plan-plan-intake-fixture-055',
      'design-plan-asset-plan-plan-intake-fixture-055',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-056',
    scriptPlanId: 'script-plan-plan-intake-fixture-056',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-056',
    visualsPlanId: 'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-056',
    assetPlanId: 'asset-plan-plan-intake-fixture-056',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-056',
    storySlug: '056-luke-shepherd-lost-sheep-30m',
    title: 'The Lost Sheep | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    timeline: generateAssemblyTimelineFromPlans(
      'voiceover-plan-script-plan-plan-intake-fixture-056',
      'visuals-plan-voiceover-plan-script-plan-plan-intake-fixture-056',
      'asset-plan-plan-intake-fixture-056',
      'design-plan-asset-plan-plan-intake-fixture-056',
    ),
  },
];

function generateAssemblyPlan(fixture: AssemblyPlanFixture): BrainCoreVideoAssemblyPlan {
  const plannedCount = fixture.timeline.filter(item => item.status === 'planned').length;
  const blockedCount = fixture.timeline.filter(item => item.status === 'blocked').length;
  const totalDurationSeconds = fixture.timeline.reduce((sum, item) => sum + item.timing.durationSeconds, 0);
  const totalDurationMinutes = Math.round(totalDurationSeconds / 60);

  return {
    id: `assembly-plan-${fixture.voiceoverPlanId}`,
    intakePlanId: fixture.intakePlanId,
    voiceoverPlanId: fixture.voiceoverPlanId,
    visualsPlanId: fixture.visualsPlanId,
    assetPlanId: fixture.assetPlanId,
    designPlanId: fixture.designPlanId,
    projectId: 'says-the-bible-video',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: blockedCount > 0 ? 'blocked' : 'preview-ready',
    timeline: fixture.timeline,
    summary: {
      totalTimelineItems: fixture.timeline.length,
      plannedCount,
      blockedCount,
      estimatedDurationSeconds: totalDurationSeconds,
      estimatedDurationMinutes: totalDurationMinutes,
    },
    blockers: [
      'Video rendering not yet implemented',
      'FFmpeg/export runner disabled',
      'No generated media files enabled',
    ],
    nextSafeStep: 'Implement video rendering orchestrator to compose timeline into video file; otherwise manual editing/assembly required',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoAssemblyPlans(): BrainCoreVideoAssemblyPlanListResponse {
  const plans = assemblyPlanFixtures.map(generateAssemblyPlan);
  const previewReadyCount = plans.filter(p => p.status === 'preview-ready').length;
  const blockedCount = plans.filter(p => p.status === 'blocked').length;
  const totalTimelineItems = plans.reduce((sum, p) => sum + p.summary.totalTimelineItems, 0);
  const estimatedTotalDurationMinutes = plans.reduce((sum, p) => sum + p.summary.estimatedDurationMinutes, 0);

  return {
    id: 'video-orchestrator-assembly-plan',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plans,
    summary: {
      total: plans.length,
      previewReadyCount,
      blockedCount,
      totalTimelineItems,
      estimatedDurationMinutes: estimatedTotalDurationMinutes,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoAssemblyPlan(voiceoverPlanId: string): BrainCoreVideoAssemblyPlanDetailResponse | undefined {
  const fixture = assemblyPlanFixtures.find(f => f.voiceoverPlanId === voiceoverPlanId);
  if (!fixture) return undefined;

  const plan = generateAssemblyPlan(fixture);

  return {
    id: plan.id,
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plan,
    upstream: {
      voiceoverPlanId: fixture.voiceoverPlanId,
      visualsPlanId: fixture.visualsPlanId,
      assetPlanId: fixture.assetPlanId,
      designPlanId: fixture.designPlanId,
      intakePlanId: fixture.intakePlanId,
    },
    nextSafeStep: 'Video rendering orchestrator required to produce video file from assembly timeline; otherwise manual video editing and assembly required',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      rendersVideo: false,
      callsFfmpeg: false,
      generatesFiles: false,
      callsExternalAI: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}
