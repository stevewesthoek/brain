import type { BrainCoreProjectSummary } from '../types/api.js';

const PROJECTS: BrainCoreProjectSummary[] = [
  {
    id: 'says-the-bible',
    name: 'Says the Bible',
    category: 'content',
    status: 'migrating',
    health: 'error',
    orchestratorIds: ['stb-pipeline', 'video-orchestrator', 'bible-research'],
    pipelineIds: ['stb-daily-pipeline', 'stb-to-video-migration'],
    platformIds: ['youtube', 'pinterest', 'facebook'],
  },
  {
    id: 'brain-mind-integration',
    name: 'Brain + Mind Integration',
    category: 'infrastructure',
    status: 'operational',
    health: 'ok',
    orchestratorIds: ['brain-core', 'brain-console', 'save-to-mind'],
    pipelineIds: [],
    platformIds: ['obsidian', 'local-runtime'],
  },
  {
    id: 'video-content-production',
    name: 'Video Content Production',
    category: 'content',
    status: 'operational',
    health: 'warning',
    orchestratorIds: ['video-orchestrator', 'design-orchestrator'],
    pipelineIds: ['video-upload-pipeline'],
    platformIds: ['youtube', 'tiktok', 'instagram', 'facebook', 'bluesky'],
  },
  {
    id: 'research-framework',
    name: 'Research Framework',
    category: 'research',
    status: 'operational',
    health: 'ok',
    orchestratorIds: ['research-orchestrator', 'code-orchestrator'],
    pipelineIds: ['research-aggregation-pipeline'],
    platformIds: ['local-runtime'],
  },
  {
    id: 'code-quality-system',
    name: 'Code Quality System',
    category: 'infrastructure',
    status: 'operational',
    health: 'ok',
    orchestratorIds: ['code-orchestrator', 'mind-steward'],
    pipelineIds: ['code-analysis-pipeline'],
    platformIds: ['github', 'local-runtime'],
  },
];

export function listProjects(): BrainCoreProjectSummary[] {
  return PROJECTS;
}

export function getProject(id: string): BrainCoreProjectSummary | undefined {
  return PROJECTS.find(p => p.id === id);
}
