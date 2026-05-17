import type { BrainCorePlatformSummary } from '../types/api.js';

const PLATFORMS: BrainCorePlatformSummary[] = [
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'social',
    status: 'operational',
    health: 'ok',
    projectIds: ['says-the-bible', 'video-content-production'],
    pipelineIds: ['video-upload-pipeline', 'stb-daily-pipeline'],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    category: 'social',
    status: 'operational',
    health: 'ok',
    projectIds: ['says-the-bible'],
    pipelineIds: ['stb-daily-pipeline'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    category: 'social',
    status: 'operational',
    health: 'ok',
    projectIds: ['says-the-bible', 'video-content-production'],
    pipelineIds: ['stb-daily-pipeline', 'video-upload-pipeline'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    category: 'social',
    status: 'operational',
    health: 'ok',
    projectIds: ['video-content-production'],
    pipelineIds: ['video-upload-pipeline'],
  },
  {
    id: 'instagram',
    name: 'Instagram',
    category: 'social',
    status: 'operational',
    health: 'ok',
    projectIds: ['video-content-production'],
    pipelineIds: ['video-upload-pipeline'],
  },
  {
    id: 'bluesky',
    name: 'Bluesky',
    category: 'social',
    status: 'operational',
    health: 'ok',
    projectIds: ['video-content-production'],
    pipelineIds: ['video-upload-pipeline'],
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    category: 'local',
    status: 'operational',
    health: 'ok',
    projectIds: ['brain-mind-integration'],
    pipelineIds: [],
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'development',
    status: 'operational',
    health: 'ok',
    projectIds: ['code-quality-system'],
    pipelineIds: ['code-analysis-pipeline'],
  },
  {
    id: 'local-runtime',
    name: 'Local Runtime',
    category: 'local',
    status: 'operational',
    health: 'ok',
    projectIds: ['brain-mind-integration', 'research-framework', 'code-quality-system'],
    pipelineIds: [],
  },
];

export function listPlatforms(): BrainCorePlatformSummary[] {
  return PLATFORMS;
}

export function getPlatform(id: string): BrainCorePlatformSummary | undefined {
  return PLATFORMS.find(p => p.id === id);
}
