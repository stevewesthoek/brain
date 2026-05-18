import type {
  BrainCoreVideoVisualSequenceItem,
  BrainCoreVideoVisualsPlan,
  BrainCoreVideoVisualsPlanListResponse,
  BrainCoreVideoVisualsPlanDetailResponse,
} from '../types/api.js';
import { readVideoVoiceoverPlans } from './video-orchestrator-voiceover-plan.js';
import { readVideoDesignPlans } from './video-orchestrator-design-plan.js';
import { readVideoAssetPlans } from './video-orchestrator-asset-plan.js';
import { getVideoOrchestratorScript } from './video-orchestrator-script.js';
import { getVideoOrchestratorIntake } from './video-orchestrator-intake.js';

interface VisualsPlanFixture {
  intakePlanId: string;
  scriptPlanId: string;
  voiceoverPlanId: string;
  assetPlanId: string;
  designPlanId: string;
  storySlug: string;
  title: string;
  estimatedDurationMinutes: number;
  sequence: BrainCoreVideoVisualSequenceItem[];
}

function generateVisualsSequenceFromVoiceover(voiceoverPlanId: string, designPlanId: string, assetPlanId: string): BrainCoreVideoVisualSequenceItem[] {
  const sequence: BrainCoreVideoVisualSequenceItem[] = [];
  let currentSecond = 0;

  // Intro visual
  sequence.push({
    id: `vis-${voiceoverPlanId}-001-intro`,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[1]}-001-intro`,
    designSpecId: `design-spec-${designPlanId}-intro`,
    assetRequirementId: `asset-${assetPlanId}-intro`,
    sequence: 1,
    label: 'Title Card / Opening Visual',
    kind: 'title-card',
    status: 'planned',
    startSecond: currentSecond,
    durationSeconds: 45,
    transitionType: 'fade',
    aspectRatio: '16:9',
    platformTargets: ['youtube', 'instagram', 'tiktok', 'facebook'],
    placeholder: 'Title card visual placeholder for validation only.',
    requiredForStages: ['video-assembly', 'rendering'],
    designDependency: 'design-orchestrator',
    blockers: ['Visual generation not yet implemented', 'Video assembly not yet implemented'],
    safety: {
      readOnly: true,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 45;

  // Body scene visual
  sequence.push({
    id: `vis-${voiceoverPlanId}-002-body`,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[1]}-002-body`,
    designSpecId: `design-spec-${designPlanId}-body`,
    assetRequirementId: `asset-${assetPlanId}-body`,
    sequence: 2,
    label: 'Main Story Scene / B-Roll',
    kind: 'scene',
    status: 'planned',
    startSecond: currentSecond,
    durationSeconds: 1200,
    transitionType: 'cut',
    aspectRatio: '16:9',
    platformTargets: ['youtube'],
    placeholder: 'Scene visual placeholder for validation only.',
    requiredForStages: ['video-assembly', 'rendering'],
    designDependency: 'manual-design',
    blockers: ['Visual generation not yet implemented', 'Video assembly not yet implemented', 'B-roll composition not implemented'],
    safety: {
      readOnly: true,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 1200;

  // Passage card overlay
  sequence.push({
    id: `vis-${voiceoverPlanId}-003-passage`,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[1]}-003-passage`,
    designSpecId: `design-spec-${designPlanId}-passage`,
    assetRequirementId: `asset-${assetPlanId}-passage`,
    sequence: 3,
    label: 'Scripture Passage Card Overlay',
    kind: 'passage-card',
    status: 'planned',
    startSecond: currentSecond,
    durationSeconds: 60,
    transitionType: 'fade',
    aspectRatio: '16:9',
    platformTargets: ['youtube', 'instagram', 'tiktok'],
    placeholder: 'Passage card visual placeholder for validation only.',
    requiredForStages: ['video-assembly', 'rendering'],
    designDependency: 'design-orchestrator',
    blockers: ['Visual generation not yet implemented', 'Video assembly not yet implemented'],
    safety: {
      readOnly: true,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 60;

  // Application/reflection visual with overlay
  sequence.push({
    id: `vis-${voiceoverPlanId}-004-application`,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[1]}-004-application`,
    designSpecId: `design-spec-${designPlanId}-application`,
    assetRequirementId: `asset-${assetPlanId}-application`,
    sequence: 4,
    label: 'Application / Reflection Text Overlay',
    kind: 'text-card',
    status: 'planned',
    startSecond: currentSecond,
    durationSeconds: 90,
    transitionType: 'fade',
    aspectRatio: '16:9',
    platformTargets: ['youtube', 'instagram'],
    placeholder: 'Text composition placeholder for validation only.',
    requiredForStages: ['video-assembly', 'rendering'],
    designDependency: 'design-orchestrator',
    blockers: ['Visual generation not yet implemented', 'Video assembly not yet implemented'],
    safety: {
      readOnly: true,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  });
  currentSecond += 90;

  // Closing visual
  sequence.push({
    id: `vis-${voiceoverPlanId}-005-outro`,
    voiceoverSegmentId: `seg-${voiceoverPlanId.split('-')[1]}-005-outro`,
    designSpecId: `design-spec-${designPlanId}-outro`,
    assetRequirementId: `asset-${assetPlanId}-outro`,
    sequence: 5,
    label: 'Closing / Credits Visual',
    kind: 'title-card',
    status: 'planned',
    startSecond: currentSecond,
    durationSeconds: 30,
    transitionType: 'fade',
    aspectRatio: '16:9',
    platformTargets: ['youtube', 'instagram', 'tiktok', 'facebook'],
    placeholder: 'Closing visual placeholder for validation only.',
    requiredForStages: ['video-assembly', 'rendering'],
    designDependency: 'design-orchestrator',
    blockers: ['Visual generation not yet implemented', 'Video assembly not yet implemented'],
    safety: {
      readOnly: true,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  });

  return sequence;
}

const visualsPlanFixtures: VisualsPlanFixture[] = [
  {
    intakePlanId: 'plan-intake-fixture-052',
    scriptPlanId: 'script-plan-plan-intake-fixture-052',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-052',
    assetPlanId: 'asset-plan-plan-intake-fixture-052',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-052',
    storySlug: '052-2kings-widow-oil-30m',
    title: 'The Widow\'s Oil | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    sequence: generateVisualsSequenceFromVoiceover(
      'voiceover-plan-script-plan-plan-intake-fixture-052',
      'design-plan-asset-plan-plan-intake-fixture-052',
      'asset-plan-plan-intake-fixture-052',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-053',
    scriptPlanId: 'script-plan-plan-intake-fixture-053',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-053',
    assetPlanId: 'asset-plan-plan-intake-fixture-053',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-053',
    storySlug: '053-1samuel-david-goliath-30m',
    title: 'David and Goliath | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    sequence: generateVisualsSequenceFromVoiceover(
      'voiceover-plan-script-plan-plan-intake-fixture-053',
      'design-plan-asset-plan-plan-intake-fixture-053',
      'asset-plan-plan-intake-fixture-053',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-054',
    scriptPlanId: 'script-plan-plan-intake-fixture-054',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-054',
    assetPlanId: 'asset-plan-plan-intake-fixture-054',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-054',
    storySlug: '054-jonah-great-fish-30m',
    title: 'Jonah and the Great Fish | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    sequence: generateVisualsSequenceFromVoiceover(
      'voiceover-plan-script-plan-plan-intake-fixture-054',
      'design-plan-asset-plan-plan-intake-fixture-054',
      'asset-plan-plan-intake-fixture-054',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-055',
    scriptPlanId: 'script-plan-plan-intake-fixture-055',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-055',
    assetPlanId: 'asset-plan-plan-intake-fixture-055',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-055',
    storySlug: '055-prodigal-son-30m',
    title: 'The Prodigal Son | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    sequence: generateVisualsSequenceFromVoiceover(
      'voiceover-plan-script-plan-plan-intake-fixture-055',
      'design-plan-asset-plan-plan-intake-fixture-055',
      'asset-plan-plan-intake-fixture-055',
    ),
  },
  {
    intakePlanId: 'plan-intake-fixture-056',
    scriptPlanId: 'script-plan-plan-intake-fixture-056',
    voiceoverPlanId: 'voiceover-plan-script-plan-plan-intake-fixture-056',
    assetPlanId: 'asset-plan-plan-intake-fixture-056',
    designPlanId: 'design-plan-asset-plan-plan-intake-fixture-056',
    storySlug: '056-luke-shepherd-lost-sheep-30m',
    title: 'The Lost Sheep | Bible Bedtime Story',
    estimatedDurationMinutes: 30,
    sequence: generateVisualsSequenceFromVoiceover(
      'voiceover-plan-script-plan-plan-intake-fixture-056',
      'design-plan-asset-plan-plan-intake-fixture-056',
      'asset-plan-plan-intake-fixture-056',
    ),
  },
];

function generateVisualsPlan(fixture: VisualsPlanFixture): BrainCoreVideoVisualsPlan {
  const plannedCount = fixture.sequence.filter(item => item.status === 'planned').length;
  const blockedCount = fixture.sequence.filter(item => item.status === 'blocked').length;
  const totalDurationSeconds = fixture.sequence.reduce((sum, item) => sum + item.durationSeconds, 0);
  const totalDurationMinutes = Math.round(totalDurationSeconds / 60);
  const platformSet = new Set<string>();
  fixture.sequence.forEach(item => item.platformTargets.forEach(p => platformSet.add(p)));
  const kindSet = new Set<string>();
  fixture.sequence.forEach(item => kindSet.add(item.kind));

  return {
    id: `visuals-plan-${fixture.voiceoverPlanId}`,
    projectId: 'says-the-bible-video',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    voiceoverPlanId: fixture.voiceoverPlanId,
    designPlanId: fixture.designPlanId,
    assetPlanId: fixture.assetPlanId,
    scriptPlanId: fixture.scriptPlanId,
    intakePlanId: fixture.intakePlanId,
    status: blockedCount > 0 ? 'blocked' : 'preview-ready',
    sequence: fixture.sequence,
    summary: {
      totalSequenceItems: fixture.sequence.length,
      plannedCount,
      blockedCount,
      estimatedTotalDurationSeconds: totalDurationSeconds,
      estimatedTotalDurationMinutes: totalDurationMinutes,
      platformTargetCount: platformSet.size,
      uniqueKinds: Array.from(kindSet),
    },
    blockers: [
      'Visual generation not yet implemented',
      'Video assembly not yet implemented',
      'No file writing enabled',
    ],
    nextSafeStep: 'Implement video assembly orchestrator to sync visuals with voiceover and assets',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoVisualsPlans(): BrainCoreVideoVisualsPlanListResponse {
  const plans = visualsPlanFixtures.map(generateVisualsPlan);
  const previewReadyCount = plans.filter(p => p.status === 'preview-ready').length;
  const blockedCount = plans.filter(p => p.status === 'blocked').length;
  const totalSequenceItems = plans.reduce((sum, p) => sum + p.summary.totalSequenceItems, 0);
  const estimatedTotalDurationMinutes = plans.reduce((sum, p) => sum + p.summary.estimatedTotalDurationMinutes, 0);

  return {
    id: 'video-orchestrator-visuals-plan',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plans,
    summary: {
      total: plans.length,
      previewReadyCount,
      blockedCount,
      totalSequenceItems,
      estimatedTotalDurationMinutes,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}

export function readVideoVisualsPlan(voiceoverPlanId: string): BrainCoreVideoVisualsPlanDetailResponse | undefined {
  const fixture = visualsPlanFixtures.find(f => f.voiceoverPlanId === voiceoverPlanId);
  if (!fixture) return undefined;

  const plan = generateVisualsPlan(fixture);

  return {
    id: plan.id,
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plan,
    upstream: {
      voiceoverPlanId: fixture.voiceoverPlanId,
      designPlanId: fixture.designPlanId,
      assetPlanId: fixture.assetPlanId,
      scriptPlanId: fixture.scriptPlanId,
      intakePlanId: fixture.intakePlanId,
    },
    nextSafeStep: 'Video assembly orchestrator required to compose visual sequence with voiceover and assets; otherwise manual video editing required',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      generatesImage: false,
      generatesVideo: false,
      generatesPrompt: false,
      callsExternalAI: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
    },
  };
}
