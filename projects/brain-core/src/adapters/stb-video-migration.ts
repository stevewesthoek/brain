export interface BrainCoreStbVideoMigrationStatus {
  id: 'stb-to-video-migration-status';
  sourcePipelineId: 'stb-daily-pipeline';
  targetPipelineId: 'video-upload-pipeline';
  status: 'mapping' | 'partial' | 'dual-run' | 'ready' | 'complete' | 'blocked';
  health: 'ok' | 'warning' | 'error' | 'unknown';
  parityPercent: number;
  decommissionBlocked: true;
  nextSafeTask: string;
  modules: Array<{
    stbConcept: string;
    videoModule: string;
    status: 'mapped' | 'partial' | 'planned' | 'blocked';
    validation: string;
  }>;
  summary: string;
  blockers: string[];
}

export function getStbVideoMigrationStatus(): BrainCoreStbVideoMigrationStatus {
  const modules: BrainCoreStbVideoMigrationStatus['modules'] = [
    {
      stbConcept: 'Research → scripture intake',
      videoModule: 'bible-research orchestrator + intake-stage',
      status: 'mapped',
      validation: 'Can compare passage selection logic',
    },
    {
      stbConcept: 'Outline/structure generation',
      videoModule: 'script-generation stage',
      status: 'mapped',
      validation: 'Can compare outline structure across 10 sample videos',
    },
    {
      stbConcept: 'Script generation',
      videoModule: 'script-generation stage',
      status: 'mapped',
      validation: 'Can compare script quality (word count, tone, timing)',
    },
    {
      stbConcept: 'Asset generation',
      videoModule: 'asset-generation stage',
      status: 'planned',
      validation: 'Need visual asset test suite',
    },
    {
      stbConcept: 'Thumbnail design',
      videoModule: 'design orchestrator',
      status: 'blocked',
      validation: 'Blocked: design orchestrator not yet built',
    },
    {
      stbConcept: 'Video assembly',
      videoModule: 'video-assembly stage',
      status: 'planned',
      validation: 'Need bitrate + quality comparison on test render',
    },
    {
      stbConcept: 'Metadata enrichment',
      videoModule: 'metadata-enrichment stage',
      status: 'planned',
      validation: 'Need SEO metadata validation checklist',
    },
    {
      stbConcept: 'YouTube publishing',
      videoModule: 'platform-publish-youtube stage',
      status: 'planned',
      validation: 'Need API response validation',
    },
    {
      stbConcept: 'Pinterest publishing',
      videoModule: 'platform-publish-pinterest stage',
      status: 'planned',
      validation: 'Need pin appearance + board management test',
    },
    {
      stbConcept: 'Facebook publishing',
      videoModule: 'platform-publish-facebook stage',
      status: 'planned',
      validation: 'Need post formatting + scheduling test',
    },
    {
      stbConcept: 'Approval/review workflow',
      videoModule: 'approval-gate stage',
      status: 'mapped',
      validation: 'Brain Console approval model ready',
    },
    {
      stbConcept: 'Archive/logging',
      videoModule: 'archive-logging stage',
      status: 'planned',
      validation: 'Need audit trail completeness check',
    },
  ];

  const mappedCount = modules.filter(m => m.status === 'mapped').length;
  const totalCount = modules.length;
  const parityPercent = Math.round((mappedCount / totalCount) * 100);

  return {
    id: 'stb-to-video-migration-status',
    sourcePipelineId: 'stb-daily-pipeline',
    targetPipelineId: 'video-upload-pipeline',
    status: 'mapping',
    health: 'warning',
    parityPercent,
    decommissionBlocked: true,
    nextSafeTask: 'Map and document STB module location and behavior (Stage 1)',
    modules,
    summary: `STB → Video migration: ${mappedCount}/${totalCount} modules mapped (${parityPercent}% parity). Stage 1 (mapping & docs) in progress. Decommission blocked until dual-run validation complete.`,
    blockers: [
      'Design orchestrator not built (blocks thumbnail design migration)',
      'No live video module implementation (design phase only)',
      'No test run capability (cannot validate parity)',
      'No dual-run infrastructure (cannot run STB + video in parallel)',
      'STB remains operational (cannot modify during migration)',
    ],
  };
}
