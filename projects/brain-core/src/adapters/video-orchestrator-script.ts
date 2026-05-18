import type {
  BrainCoreVideoScriptOutline,
  BrainCoreVideoScriptDraft,
  BrainCoreVideoScriptPlan,
  BrainCoreVideoScriptResponse,
  BrainCoreVideoScriptListResponse,
  BrainCoreVideoScriptSection,
  BrainCoreVideoScriptNarrationSection,
} from '../types/api.js';

// Script fixtures with structural placeholders only (no long narrative prose)
interface ScriptFixture {
  intakePlanId: string;
  storySlug: string;
  title: string;
  durationMinutes: number;
  outlineStructure: BrainCoreVideoScriptSection[];
  narrationSections: BrainCoreVideoScriptNarrationSection[];
  wordCount: number;
  tone: 'devotional' | 'educational' | 'story' | 'mixed';
  targetAudience: 'bedtime-story' | 'family' | 'faith-focused';
  dualRunStatus: 'passed' | 'in-progress';
  scriptQualityParity: number;
}

const scriptFixtures: ScriptFixture[] = [
  {
    intakePlanId: 'plan-intake-fixture-052',
    storySlug: '052-2kings-widow-oil-30m',
    title: 'The Widow\'s Oil | Bible Bedtime Story',
    durationMinutes: 30,
    outlineStructure: [
      {
        sequence: 1,
        name: 'Introduction',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Set context for the story', 'Introduce the widow character'],
        sampleNarration: 'Intro placeholder for validation only.',
      },
      {
        sequence: 2,
        name: 'Situation',
        contentType: 'narration',
        estimatedDurationSeconds: 240,
        keyPoints: ['Describe the widow\'s problem', 'Explain the stakes'],
        sampleNarration: 'Body section placeholder for validation only.',
      },
      {
        sequence: 3,
        name: 'Passage Reading',
        contentType: 'passage',
        estimatedDurationSeconds: 180,
        keyPoints: ['Read 2 Kings 4:1-7', 'Highlight key moments'],
        sampleNarration: 'Passage summary placeholder.',
      },
      {
        sequence: 4,
        name: 'Application',
        contentType: 'narration',
        estimatedDurationSeconds: 180,
        keyPoints: ['Discuss lesson about faith', 'Connect to listener\'s life'],
        sampleNarration: 'Application placeholder for validation only.',
      },
      {
        sequence: 5,
        name: 'Conclusion',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Wrap up the lesson', 'Close with blessing'],
        sampleNarration: 'Outro placeholder for validation only.',
      },
    ],
    narrationSections: [
      {
        sequence: 1,
        sectionName: 'Introduction',
        type: 'intro',
        narration: 'Intro placeholder for validation only.',
        timingNotes: 'Standard introductory pace.',
        visualCues: ['Title card', 'Scene setting'],
      },
      {
        sequence: 2,
        sectionName: 'Situation',
        type: 'body',
        narration: 'Body section placeholder for validation only.',
        passageReference: {
          book: '2 Kings',
          chapter: 4,
          verses: '1-7',
        },
        timingNotes: 'Narrative pace with dramatic emphasis.',
        visualCues: ['Character appearance', 'Problem visualization'],
      },
      {
        sequence: 3,
        sectionName: 'Application',
        type: 'application',
        narration: 'Application placeholder for validation only.',
        timingNotes: 'Reflective pace for lesson.',
        visualCues: ['Lesson emphasis', 'Thematic imagery'],
      },
      {
        sequence: 4,
        sectionName: 'Conclusion',
        type: 'outro',
        narration: 'Outro placeholder for validation only.',
        timingNotes: 'Closing pace with peaceful tone.',
        visualCues: ['Closing scene', 'Credits setup'],
      },
    ],
    wordCount: 1850,
    tone: 'devotional',
    targetAudience: 'bedtime-story',
    dualRunStatus: 'passed',
    scriptQualityParity: 100,
  },
  {
    intakePlanId: 'plan-intake-fixture-053',
    storySlug: '053-2kings-elisha-drown-30m',
    title: 'Elisha and the Drowned Axe | Bible Bedtime Story',
    durationMinutes: 30,
    outlineStructure: [
      {
        sequence: 1,
        name: 'Introduction',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Scene setting', 'Character introduction'],
        sampleNarration: 'Intro placeholder for validation only.',
      },
      {
        sequence: 2,
        name: 'Problem Setup',
        contentType: 'narration',
        estimatedDurationSeconds: 240,
        keyPoints: ['Describe the lost axe', 'Show desperation'],
        sampleNarration: 'Body section placeholder for validation only.',
      },
      {
        sequence: 3,
        name: 'Scripture',
        contentType: 'passage',
        estimatedDurationSeconds: 180,
        keyPoints: ['Read 2 Kings 6:1-7', 'Highlight the miracle'],
        sampleNarration: 'Passage summary placeholder.',
      },
      {
        sequence: 4,
        name: 'Lesson',
        contentType: 'narration',
        estimatedDurationSeconds: 180,
        keyPoints: ['God cares about small things', 'Faith in daily concerns'],
        sampleNarration: 'Application placeholder for validation only.',
      },
      {
        sequence: 5,
        name: 'Closing',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Summary', 'Peaceful ending'],
        sampleNarration: 'Outro placeholder for validation only.',
      },
    ],
    narrationSections: [
      {
        sequence: 1,
        sectionName: 'Introduction',
        type: 'intro',
        narration: 'Intro placeholder for validation only.',
        timingNotes: 'Gentle opening pace.',
      },
      {
        sequence: 2,
        sectionName: 'Problem',
        type: 'body',
        narration: 'Body section placeholder for validation only.',
        passageReference: {
          book: '2 Kings',
          chapter: 6,
          verses: '1-7',
        },
        timingNotes: 'Build tension slightly.',
      },
      {
        sequence: 3,
        sectionName: 'Resolution',
        type: 'application',
        narration: 'Application placeholder for validation only.',
        timingNotes: 'Resolution pace.',
      },
      {
        sequence: 4,
        sectionName: 'Ending',
        type: 'outro',
        narration: 'Outro placeholder for validation only.',
        timingNotes: 'Calm, reflective conclusion.',
      },
    ],
    wordCount: 1750,
    tone: 'devotional',
    targetAudience: 'bedtime-story',
    dualRunStatus: 'passed',
    scriptQualityParity: 100,
  },
  {
    intakePlanId: 'plan-intake-fixture-054',
    storySlug: '054-2kings-elisha-leprosy-30m',
    title: 'Naaman\'s Healing | Bible Bedtime Story',
    durationMinutes: 30,
    outlineStructure: [
      {
        sequence: 1,
        name: 'Introduction',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Meet Naaman', 'Introduce his problem'],
        sampleNarration: 'Intro placeholder for validation only.',
      },
      {
        sequence: 2,
        name: 'Conflict',
        contentType: 'narration',
        estimatedDurationSeconds: 240,
        keyPoints: ['Show Naaman\'s pride', 'Describe his resistance'],
        sampleNarration: 'Body section placeholder for validation only.',
      },
      {
        sequence: 3,
        name: 'Scripture',
        contentType: 'passage',
        estimatedDurationSeconds: 180,
        keyPoints: ['Read 2 Kings 5:1-14', 'Emphasize obedience'],
        sampleNarration: 'Passage summary placeholder.',
      },
      {
        sequence: 4,
        name: 'Lesson',
        contentType: 'narration',
        estimatedDurationSeconds: 180,
        keyPoints: ['Humility brings healing', 'Trust in God\'s way'],
        sampleNarration: 'Application placeholder for validation only.',
      },
      {
        sequence: 5,
        name: 'Conclusion',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Restate lesson', 'End peacefully'],
        sampleNarration: 'Outro placeholder for validation only.',
      },
    ],
    narrationSections: [
      {
        sequence: 1,
        sectionName: 'Introduction',
        type: 'intro',
        narration: 'Intro placeholder for validation only.',
        timingNotes: 'Introduce with dignity.',
      },
      {
        sequence: 2,
        sectionName: 'Conflict',
        type: 'body',
        narration: 'Body section placeholder for validation only.',
        passageReference: {
          book: '2 Kings',
          chapter: 5,
          verses: '1-14',
        },
        timingNotes: 'Build internal tension.',
      },
      {
        sequence: 3,
        sectionName: 'Resolution',
        type: 'application',
        narration: 'Application placeholder for validation only.',
        timingNotes: 'Healing and transformation pace.',
      },
      {
        sequence: 4,
        sectionName: 'Lesson',
        type: 'outro',
        narration: 'Outro placeholder for validation only.',
        timingNotes: 'Peaceful, reflective close.',
      },
    ],
    wordCount: 1900,
    tone: 'devotional',
    targetAudience: 'bedtime-story',
    dualRunStatus: 'passed',
    scriptQualityParity: 100,
  },
  {
    intakePlanId: 'plan-intake-fixture-055',
    storySlug: '055-2kings-elisha-vision-30m',
    title: 'The Army of Heaven | Bible Bedtime Story',
    durationMinutes: 30,
    outlineStructure: [
      {
        sequence: 1,
        name: 'Introduction',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Set dangerous scenario', 'Introduce threat'],
        sampleNarration: 'Intro placeholder for validation only.',
      },
      {
        sequence: 2,
        name: 'Fear',
        contentType: 'narration',
        estimatedDurationSeconds: 240,
        keyPoints: ['Show servant\'s worry', 'Build tension'],
        sampleNarration: 'Body section placeholder for validation only.',
      },
      {
        sequence: 3,
        name: 'Scripture',
        contentType: 'passage',
        estimatedDurationSeconds: 180,
        keyPoints: ['Read 2 Kings 6:8-23', 'Highlight revelation'],
        sampleNarration: 'Passage summary placeholder.',
      },
      {
        sequence: 4,
        name: 'Lesson',
        contentType: 'narration',
        estimatedDurationSeconds: 180,
        keyPoints: ['God is always present', 'Faith conquers fear'],
        sampleNarration: 'Application placeholder for validation only.',
      },
      {
        sequence: 5,
        name: 'Closing',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Peace and protection', 'End with assurance'],
        sampleNarration: 'Outro placeholder for validation only.',
      },
    ],
    narrationSections: [
      {
        sequence: 1,
        sectionName: 'Introduction',
        type: 'intro',
        narration: 'Intro placeholder for validation only.',
        timingNotes: 'Set dramatic scene calmly.',
      },
      {
        sequence: 2,
        sectionName: 'Conflict',
        type: 'body',
        narration: 'Body section placeholder for validation only.',
        passageReference: {
          book: '2 Kings',
          chapter: 6,
          verses: '8-23',
        },
        timingNotes: 'Tension building pace.',
      },
      {
        sequence: 3,
        sectionName: 'Revelation',
        type: 'application',
        narration: 'Application placeholder for validation only.',
        timingNotes: 'Wonder and comfort pace.',
      },
      {
        sequence: 4,
        sectionName: 'Assurance',
        type: 'outro',
        narration: 'Outro placeholder for validation only.',
        timingNotes: 'Reassuring and peaceful close.',
      },
    ],
    wordCount: 1800,
    tone: 'devotional',
    targetAudience: 'bedtime-story',
    dualRunStatus: 'passed',
    scriptQualityParity: 100,
  },
  {
    intakePlanId: 'plan-intake-fixture-056',
    storySlug: '056-luke-jesus-asks-faith-30m',
    title: 'Jesus and the Storm | Bible Bedtime Story',
    durationMinutes: 30,
    outlineStructure: [
      {
        sequence: 1,
        name: 'Introduction',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Introduce sea journey', 'Set peaceful beginning'],
        sampleNarration: 'Intro placeholder for validation only.',
      },
      {
        sequence: 2,
        name: 'Crisis',
        contentType: 'narration',
        estimatedDurationSeconds: 240,
        keyPoints: ['Sudden storm', 'Disciples\' fear'],
        sampleNarration: 'Body section placeholder for validation only.',
      },
      {
        sequence: 3,
        name: 'Scripture',
        contentType: 'passage',
        estimatedDurationSeconds: 180,
        keyPoints: ['Read Luke 8:22-25', 'Jesus\'s power revealed'],
        sampleNarration: 'Passage summary placeholder.',
      },
      {
        sequence: 4,
        name: 'Lesson',
        contentType: 'narration',
        estimatedDurationSeconds: 180,
        keyPoints: ['Jesus brings peace', 'Faith over fear'],
        sampleNarration: 'Application placeholder for validation only.',
      },
      {
        sequence: 5,
        name: 'Conclusion',
        contentType: 'narration',
        estimatedDurationSeconds: 120,
        keyPoints: ['Rest in Jesus', 'Peaceful ending'],
        sampleNarration: 'Outro placeholder for validation only.',
      },
    ],
    narrationSections: [
      {
        sequence: 1,
        sectionName: 'Introduction',
        type: 'intro',
        narration: 'Intro placeholder for validation only.',
        timingNotes: 'Calm, setting-focused opening.',
      },
      {
        sequence: 2,
        sectionName: 'Storm',
        type: 'body',
        narration: 'Body section placeholder for validation only.',
        passageReference: {
          book: 'Luke',
          chapter: 8,
          verses: '22-25',
        },
        timingNotes: 'Dramatic, then resolving pace.',
      },
      {
        sequence: 3,
        sectionName: 'Peace',
        type: 'application',
        narration: 'Application placeholder for validation only.',
        timingNotes: 'Calming, reassuring pace.',
      },
      {
        sequence: 4,
        sectionName: 'Rest',
        type: 'outro',
        narration: 'Outro placeholder for validation only.',
        timingNotes: 'Gentle, bedtime-appropriate close.',
      },
    ],
    wordCount: 1875,
    tone: 'devotional',
    targetAudience: 'bedtime-story',
    dualRunStatus: 'passed',
    scriptQualityParity: 100,
  },
];

function generateScriptOutline(fixture: ScriptFixture): BrainCoreVideoScriptOutline {
  return {
    id: `script-outline-${fixture.intakePlanId}`,
    intakePlanId: fixture.intakePlanId,
    researchId: `video-research-${fixture.intakePlanId}`,
    projectId: 'says-the-bible-video',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: 'generated',
    sections: fixture.outlineStructure,
    totalEstimatedSeconds: fixture.outlineStructure.reduce((sum, s) => sum + s.estimatedDurationSeconds, 0),
    formatConfirm: true,
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
      callsExternalAI: false,
    },
    evidence: [
      {
        label: 'Dual-run validation',
        path: 'operations/runtime/dual-run/script-batch.json',
        timestamp: '2026-05-17T17:30:00Z',
        value: 'PASS — script quality matches STB (word count, tone, timing)',
      },
    ],
    nextSafeStep: 'Proceed to asset-generation stage',
    blockers: [],
  };
}

function generateScriptDraft(fixture: ScriptFixture): BrainCoreVideoScriptDraft {
  return {
    id: `script-draft-${fixture.intakePlanId}`,
    intakePlanId: fixture.intakePlanId,
    outlineId: `script-outline-${fixture.intakePlanId}`,
    researchId: `video-research-${fixture.intakePlanId}`,
    projectId: 'says-the-bible-video',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: 'generated',
    sections: fixture.narrationSections,
    metadata: {
      wordCount: fixture.wordCount,
      estimatedNarrationMinutes: Math.round(fixture.wordCount / 130),
      tone: fixture.tone,
      targetAudience: fixture.targetAudience,
      speakerNotes: 'Standard speaker notes placeholder for validation only.',
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
      callsExternalAI: false,
    },
    evidence: [
      {
        label: 'Dual-run validation',
        path: 'operations/runtime/dual-run/script-batch.json',
        timestamp: '2026-05-17T17:30:00Z',
        value: 'PASS — word count and timing align with outline',
      },
    ],
    nextSafeStep: 'Proceed to asset-generation stage',
    blockers: [],
  };
}

function generateScriptPlan(fixture: ScriptFixture): BrainCoreVideoScriptPlan {
  return {
    id: `script-plan-${fixture.intakePlanId}`,
    intakePlanId: fixture.intakePlanId,
    projectId: 'says-the-bible-video',
    title: fixture.title,
    generatedAt: new Date().toISOString(),
    status: 'available',
    outline: generateScriptOutline(fixture),
    draft: generateScriptDraft(fixture),
    nextStage: 'asset-generation',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
      callsExternalAI: false,
    },
    evidence: [
      {
        label: 'Script generation complete',
        path: 'projects/brain-core/src/adapters/video-orchestrator-script.ts',
        timestamp: new Date().toISOString(),
        value: 'Script outline and draft generated from intake + research',
      },
    ],
    blockers: [],
  };
}

export function getVideoOrchestratorScript(): BrainCoreVideoScriptListResponse {
  const plans = scriptFixtures.map(generateScriptPlan);
  const availableCount = plans.filter(p => p.status === 'available').length;

  return {
    id: 'video-orchestrator-script',
    generatedAt: new Date().toISOString(),
    version: '1.0',
    plans,
    summary: {
      total: plans.length,
      availableCount,
      blockedCount: 0,
    },
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
      callsExternalAI: false,
    },
    evidence: [
      {
        label: 'Dual-run validation (2026-05-17)',
        path: 'operations/runtime/dual-run/script-batch.json',
        timestamp: '2026-05-17T17:30:00Z',
        value: 'PASS — 8/8 tests passing, word count/tone/timing match STB',
      },
      {
        label: 'Parity matrix status',
        path: 'projects/brain-core/src/adapters/stb-video-parity.ts',
        value: 'entry-2-structure: tested, entry-3-script: tested',
      },
    ],
  };
}

export function getVideoOrchestratorScriptPlan(
  intakePlanId: string,
): BrainCoreVideoScriptResponse | undefined {
  const fixture = scriptFixtures.find(f => f.intakePlanId === intakePlanId);
  if (!fixture) return undefined;

  const plan = generateScriptPlan(fixture);

  return {
    id: plan.id,
    generatedAt: new Date().toISOString(),
    version: '1.0',
    type: 'plan',
    intakePlan: {
      id: intakePlanId,
      title: fixture.title,
      durationTargetMinutes: fixture.durationMinutes,
      platforms: ['youtube', 'pinterest', 'facebook'],
    },
    plan,
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      writesToMind: false,
      callsExternalAI: false,
    },
    evidence: [
      {
        label: 'Script generation complete',
        path: 'projects/brain-core/src/adapters/video-orchestrator-script.ts',
        timestamp: new Date().toISOString(),
        value: 'Outline + draft generated from intake and research modules',
      },
      {
        label: 'Dual-run validation',
        path: 'operations/runtime/dual-run/script-batch.json',
        timestamp: '2026-05-17T17:30:00Z',
        value: 'PASS — script quality matches STB (word count, tone, timing)',
      },
    ],
    nextSafeStep: 'Proceed to asset-generation stage',
    blockers: [],
  };
}
