import type {
  BrainCoreVideoComparisonSchemaDesign,
  BrainCoreVideoComparisonSchemaDesignResponse,
  BrainCoreVideoComparisonSchemaField,
} from '../types/api.js';
import { readStbVideoDualRunEvidence } from './stb-video-dual-run-evidence.js';
import { readVideoControlledDryRunDesign } from './video-orchestrator-controlled-dry-run-design.js';
import { readVideoRollbackCleanupChecklist } from './video-orchestrator-rollback-cleanup-checklist.js';

const safety: BrainCoreVideoComparisonSchemaField['safety'] = {
  readOnly: true,
  readsGeneratedArtifacts: false,
  executesComparison: false,
  executesStb: false,
  executesVideo: false,
  writesFiles: false,
  createsApproval: false,
  publishesContent: false,
  writesToMind: false,
};

function field(input: Omit<BrainCoreVideoComparisonSchemaField, 'safety'>): BrainCoreVideoComparisonSchemaField {
  return { ...input, safety };
}

export function readVideoComparisonSchemaDesign(): BrainCoreVideoComparisonSchemaDesignResponse {
  const evidence = readStbVideoDualRunEvidence().evidence;
  const dryRun = readVideoControlledDryRunDesign().dryRun;
  const rollback = readVideoRollbackCleanupChecklist().checklist;

  const fields: BrainCoreVideoComparisonSchemaField[] = [
    field({
      id: 'comparison-field-title-metadata',
      label: 'Title and metadata parity',
      category: 'metadata',
      status: 'defined',
      comparisonMode: 'manual-review',
      severity: 'warning',
      evidence: ['Metadata plan fixtures exist; real generated metadata outputs do not exist.'],
      blockers: ['No real STB/video output pair exists for comparison.'],
    }),
    field({
      id: 'comparison-field-script-structure',
      label: 'Script structure parity',
      category: 'script',
      status: 'defined',
      comparisonMode: 'semantic',
      severity: 'warning',
      evidence: ['Script planning fixtures exist with structural placeholders only.'],
      blockers: ['No generated script content comparison is available.'],
    }),
    field({
      id: 'comparison-field-timing-duration',
      label: 'Timing and duration ranges',
      category: 'timing',
      status: 'defined',
      comparisonMode: 'range',
      severity: 'info',
      evidence: ['Assembly and voiceover planning expose estimated durations.'],
      blockers: ['No rendered media duration exists.'],
    }),
    field({
      id: 'comparison-field-visual-coverage',
      label: 'Visual sequence coverage',
      category: 'visuals',
      status: 'blocked',
      comparisonMode: 'manual-review',
      severity: 'blocking',
      evidence: ['Visuals plan exists but generated visual artifacts do not exist.'],
      blockers: ['No generated images or rendered video exist.', 'Image generation and rendering are disabled.'],
    }),
    field({
      id: 'comparison-field-audio-coverage',
      label: 'Voiceover/audio coverage',
      category: 'audio',
      status: 'blocked',
      comparisonMode: 'manual-review',
      severity: 'blocking',
      evidence: ['Voiceover plan exists but audio generation is disabled.'],
      blockers: ['No generated audio exists.', 'TTS/audio generation disabled.'],
    }),
    field({
      id: 'comparison-field-publishing-readiness',
      label: 'Publishing readiness parity',
      category: 'publishing',
      status: 'blocked',
      comparisonMode: 'manual-review',
      severity: 'blocking',
      evidence: ['Publishing-prep plans exist; platform API integration is disabled.'],
      blockers: ['No scheduling/publishing execution exists.', 'No platform API calls are allowed.'],
    }),
    field({
      id: 'comparison-field-safety-invariants',
      label: 'Safety invariants',
      category: 'safety',
      status: 'defined',
      comparisonMode: 'exact',
      severity: 'info',
      evidence: [
        `Dual-run evidence status: ${evidence.status}`,
        `Controlled dry-run canExecuteDryRun=${dryRun.canExecuteDryRun}`,
        `Rollback checklist canCleanup=${rollback.canCleanup}`,
      ],
      blockers: [],
    }),
  ];

  const definedCount = fields.filter(entry => entry.status === 'defined').length;
  const blockedCount = fields.filter(entry => entry.status === 'blocked').length;
  const missingCount = fields.filter(entry => entry.status === 'missing').length;
  const blockingSeverityCount = fields.filter(entry => entry.severity === 'blocking').length;
  const blockers = fields.flatMap(entry => entry.blockers).filter((blocker, index, all) => all.indexOf(blocker) === index);

  const schema: BrainCoreVideoComparisonSchemaDesign = {
    id: 'video-orchestrator-comparison-schema-design',
    generatedAt: new Date().toISOString(),
    status: 'blocked',
    canCompareOutputs: false,
    canReadGeneratedArtifacts: false,
    canWriteEvidence: false,
    executableActionRegistered: false,
    fields,
    summary: {
      totalFields: fields.length,
      definedCount,
      blockedCount,
      missingCount,
      blockingSeverityCount,
    },
    blockers,
    nextSafeStep: 'Define fixture-level comparison preview before any real output comparison or controlled dry-run execution.',
    safety: {
      readOnly: true,
      readsGeneratedArtifacts: false,
      executesComparison: false,
      executesStb: false,
      executesVideo: false,
      writesFiles: false,
      createsApproval: false,
      executableActionRegistered: false,
      publishesContent: false,
      decommissionsStb: false,
      writesToMind: false,
    },
  };

  return { schema };
}
