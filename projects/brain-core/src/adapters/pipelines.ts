import type { BrainCorePipelineSummary } from '../types/api.js';

const PIPELINES: BrainCorePipelineSummary[] = [
  {
    id: 'stb-daily-pipeline',
    name: 'Says the Bible Daily',
    status: 'migrating',
    health: 'error',
    role: 'primary',
    description: 'Daily Bible content generation, publishing, and distribution',
    stages: ['generate', 'format', 'publish', 'distribute'],
    migration: {
      sourcePipelineId: 'stb-legacy-office-scheduler',
      targetPipelineId: 'stb-video-orchestrator',
      parityStatus: 'in-progress',
      decommissionBlocked: true,
    },
  },
  {
    id: 'video-upload-pipeline',
    name: 'Video Upload Pipeline',
    status: 'operational',
    health: 'warning',
    role: 'primary',
    description: 'Video processing, encoding, and platform uploads',
    stages: ['encode', 'process', 'validate', 'upload', 'notify'],
  },
  {
    id: 'stb-to-video-migration',
    name: 'STB → Video Migration',
    status: 'migrating',
    health: 'warning',
    role: 'future',
    description: 'Migration workstream: consolidate STB into video orchestrator',
    stages: ['assess', 'refactor', 'test', 'cutover', 'decomm'],
    migration: {
      sourcePipelineId: 'stb-daily-pipeline',
      targetPipelineId: 'video-upload-pipeline',
      parityStatus: 'blocked',
      decommissionBlocked: true,
    },
  },
  {
    id: 'research-aggregation-pipeline',
    name: 'Research Aggregation',
    status: 'operational',
    health: 'ok',
    role: 'supporting',
    description: 'Web research, data gathering, and synthesis',
    stages: ['fetch', 'parse', 'dedupe', 'aggregate', 'export'],
  },
  {
    id: 'code-analysis-pipeline',
    name: 'Code Analysis',
    status: 'operational',
    health: 'ok',
    role: 'supporting',
    description: 'Static analysis, review, and quality metrics',
    stages: ['lint', 'type-check', 'audit', 'report'],
  },
];

export function listPipelines(): BrainCorePipelineSummary[] {
  return PIPELINES;
}

export function getPipeline(id: string): BrainCorePipelineSummary | undefined {
  return PIPELINES.find(p => p.id === id);
}
