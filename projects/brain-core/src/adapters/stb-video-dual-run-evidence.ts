import type {
  BrainCoreStbVideoDualRunEvidenceItem,
  BrainCoreStbVideoDualRunEvidenceStage,
  BrainCoreStbVideoDualRunEvidenceReport,
  BrainCoreStbVideoDualRunEvidenceResponse,
} from '../types/api.js';

const PLANNING_STAGES: Array<{
  id: string;
  label: string;
  stage: BrainCoreStbVideoDualRunEvidenceStage['stage'];
}> = [
  { id: 'intake', label: 'Intake', stage: 'intake' },
  { id: 'research', label: 'Research', stage: 'research' },
  { id: 'script', label: 'Script', stage: 'script' },
  { id: 'asset-plan', label: 'Asset Planning', stage: 'asset-plan' },
  { id: 'design-plan', label: 'Design Planning', stage: 'design-plan' },
  { id: 'voiceover-plan', label: 'Voiceover Planning', stage: 'voiceover-plan' },
  { id: 'visuals-plan', label: 'Visuals Planning', stage: 'visuals-plan' },
  { id: 'assembly-plan', label: 'Assembly Planning', stage: 'assembly-plan' },
  { id: 'metadata-plan', label: 'Metadata Planning', stage: 'metadata-plan' },
  { id: 'publishing-prep', label: 'Publishing Prep', stage: 'publishing-prep' },
  { id: 'manual-export-package', label: 'Manual Export Package', stage: 'manual-export-package' },
];

function generateStbEvidenceItems(): BrainCoreStbVideoDualRunEvidenceItem[] {
  return [
    {
      id: 'stb-status-available',
      label: 'STB pipeline status available',
      source: 'stb-status',
      status: 'available',
      value: 'STB status adapter provides latest run evidence',
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'stb-latest-run',
      label: 'STB latest successful run exists',
      source: 'stb-status',
      status: 'available',
      value: 'Latest run metadata available from runtime',
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'stb-fixtures-available',
      label: 'STB fixtures/story data available',
      source: 'stb-parity',
      status: 'available',
      value: 'Story fixtures 052-056 reference available',
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
  ];
}

function generateVideoEvidenceItems(): BrainCoreStbVideoDualRunEvidenceItem[] {
  return [
    {
      id: 'video-planning-complete',
      label: 'Video planning chain complete (11 stages)',
      source: 'video-planning',
      status: 'available',
      value: 'All planning modules implemented: intake → manual-export-package',
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'video-fixtures-available',
      label: 'Video fixtures available (5 stories)',
      source: 'video-planning',
      status: 'available',
      value: 'Story fixtures 052-056 with planning data',
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'video-endpoints-ready',
      label: 'Video orchestrator endpoints available',
      source: 'video-planning',
      status: 'available',
      value: '11 read-only endpoints providing planning data',
      blockers: [],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
    {
      id: 'video-rendering-blocked',
      label: 'Video rendering implementation blocked',
      source: 'video-planning',
      status: 'blocked',
      value: 'Video rendering execution not implemented',
      blockers: ['No rendering execution layer', 'No artifact generation', 'No platform posting'],
      safety: {
        readOnly: true,
        executesStb: false,
        executesVideo: false,
        writesFiles: false,
        publishesContent: false,
        writesToMind: false,
      },
    },
  ];
}

function generateEvidenceStage(stageConfig: { id: string; label: string; stage: BrainCoreStbVideoDualRunEvidenceStage['stage'] }): BrainCoreStbVideoDualRunEvidenceStage {
  const stbEvidence = generateStbEvidenceItems();
  const videoEvidence = generateVideoEvidenceItems();

  const hasStbEvidence = stbEvidence.some(e => e.status === 'available');
  const hasVideoEvidence = videoEvidence.some(e => e.status === 'available' || e.status === 'blocked');
  const parityReady = false;

  return {
    id: `stage-${stageConfig.id}`,
    stage: stageConfig.stage,
    status: hasStbEvidence && hasVideoEvidence ? 'evidence-partial' : hasVideoEvidence ? 'evidence-partial' : 'missing',
    stbEvidence,
    videoEvidence,
    comparison: {
      hasStbEvidence,
      hasVideoEvidence,
      parityReady,
      notes: [
        'STB provides source pipeline evidence',
        'Video provides planning/readiness evidence',
        'Real dual-run output comparison not yet available',
        'Rendering layer not implemented',
      ],
    },
    blockers: [
      'No real dual-run execution',
      'No rendered video artifact',
      'No STB-vs-video output comparison',
      'No publishable artifact',
    ],
    nextSafeStep: 'Implement controlled dual-run request design or production gate checklist',
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

export function readStbVideoDualRunEvidence(): BrainCoreStbVideoDualRunEvidenceResponse {
  const stages = PLANNING_STAGES.map(generateEvidenceStage);

  const evidenceAvailableCount = stages.filter(s => s.status === 'evidence-available').length;
  const partialCount = stages.filter(s => s.status === 'evidence-partial').length;
  const blockedCount = stages.filter(s => s.status === 'blocked').length;
  const missingCount = stages.filter(s => s.status === 'missing').length;
  const parityReadyCount = stages.filter(s => s.comparison.parityReady).length;

  const overallStatus = blockedCount > 0 || missingCount > 0 ? 'blocked' : partialCount > 0 ? 'evidence-partial' : 'not-ready';

  const report: BrainCoreStbVideoDualRunEvidenceReport = {
    id: 'stb-video-dual-run-evidence',
    generatedAt: new Date().toISOString(),
    status: overallStatus,
    stages,
    summary: {
      totalStages: stages.length,
      evidenceAvailableCount,
      partialCount,
      blockedCount,
      missingCount,
      parityReadyCount,
    },
    blockers: [
      'No real dual-run execution implemented',
      'No video rendering/artifact generation',
      'No STB-vs-video output comparison',
      'No publishable artifact from dual-run',
      'STB remains source of truth and authority',
      'Video orchestrator is planning and validation layer only',
    ],
    nextSafeStep: 'Implement controlled dual-run request design or production gate checklist before attempting live dual-run',
    safety: {
      readOnly: true,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return {
    evidence: report,
  };
}
