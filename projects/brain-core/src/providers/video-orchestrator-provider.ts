import { readFile } from 'fs/promises';
import { join } from 'path';

const BRAIN_VIDEO_ORCHESTRATOR_ROOT = process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT || 
  '/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud';

export interface TopicCandidate {
  topicId: string;
  title: string;
  score: number;
  status: 'candidate' | 'in-progress' | 'completed' | 'rejected';
  reasoning: string[];
  createdAt: string;
}

export interface ChannelStatus {
  channelId: string;
  displayName: string;
  configPath: string;
  contentProfilePath: string;
  youtubeSecret?: string;
  youtubeEnabled: boolean;
  publishingStatus: 'ready' | 'auth-pending' | 'config-ready';
  topicCandidates: TopicCandidate[];
  topCandidates: TopicCandidate[]; // Top 5
  totalTopics: number;
}

export interface ScriptApproval {
  required: boolean;
  status: 'pending' | 'approved' | 'rejected';
  theologicalReviewRequired: boolean;
  approvedAt: string | null;
  approvedBy: string | null;
  notes: string | null;
}

export interface ScriptMetadata {
  jobId: string;
  channelId: string;
  topicId: string;
  status: 'draft' | 'ready' | 'generating' | 'generated' | 'published';
  title: string;
  targetDurationSeconds: number;
  wordCount: number;
  scriptKey: string;
  generatedBy: string;
  createdAt: string;
  updatedAt: string;
  approval: ScriptApproval;
}

export interface VideoOrchestratorStatus {
  channels: ChannelStatus[];
  recentJobs: Array<{
    jobId: string;
    channelId: string;
    status: string;
    videoId?: string;
  }>;
  pipelineReady: boolean;
  generationStatus: 'ready' | 'in-progress' | 'stalled';
  publishingStatus: 'ready' | 'in-progress' | 'stalled';
}

async function readTopicBacklog(channelId: string): Promise<TopicCandidate[]> {
  try {
    const path = join(BRAIN_VIDEO_ORCHESTRATOR_ROOT, `channels/${channelId}/topic-backlog.json`);
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return data.topicBacklog || [];
  } catch (error) {
    console.error(`Failed to read topic backlog for ${channelId}:`, error);
    return [];
  }
}

function rankTopics(topics: TopicCandidate[]): TopicCandidate[] {
  return topics
    .sort((a, b) => {
      // Sort by: status (candidate first), then score descending
      const statusPriority = { candidate: 0, 'in-progress': 1, completed: 2, rejected: 3 };
      const statusDiff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99);
      if (statusDiff !== 0) return statusDiff;
      return b.score - a.score;
    })
    .slice(0, 5);
}

export async function getVideoOrchestratorStatus(): Promise<VideoOrchestratorStatus> {
  const channels: ChannelStatus[] = [];

  // Load Says the Bible
  const stbTopics = await readTopicBacklog('says-the-bible');
  channels.push({
    channelId: 'says-the-bible',
    displayName: 'Says the Bible',
    configPath: 'channels/says-the-bible/channel.json',
    contentProfilePath: 'channels/says-the-bible/content-profile.json',
    youtubeSecret: 'prochat/youtube/says-the-bible/oauth-token',
    youtubeEnabled: true,
    publishingStatus: 'ready',
    topicCandidates: stbTopics,
    topCandidates: rankTopics(stbTopics),
    totalTopics: stbTopics.length,
  });

  // Load ProChat
  const prochatTopics = await readTopicBacklog('prochat');
  channels.push({
    channelId: 'prochat',
    displayName: 'ProChat',
    configPath: 'channels/prochat/channel.json',
    contentProfilePath: 'channels/prochat/content-profile.json',
    youtubeSecret: 'prochat/youtube/prochat/oauth-token',
    youtubeEnabled: false,
    publishingStatus: 'auth-pending',
    topicCandidates: prochatTopics,
    topCandidates: rankTopics(prochatTopics),
    totalTopics: prochatTopics.length,
  });

  return {
    channels,
    recentJobs: [
      {
        jobId: 'prochat-os-040',
        channelId: 'says-the-bible',
        status: 'published',
        videoId: 'O8-HEhG8IlE',
      },
      {
        jobId: 'prochat-os-030',
        channelId: 'says-the-bible',
        status: 'published',
        videoId: 'R2rq58QmfV0',
      },
    ],
    pipelineReady: true,
    generationStatus: 'ready',
    publishingStatus: 'ready',
  };
}

export async function getChannelTopics(channelId: string): Promise<ChannelStatus | null> {
  const status = await getVideoOrchestratorStatus();
  return status.channels.find(ch => ch.channelId === channelId) || null;
}

async function readScriptMetadata(jobId: string): Promise<ScriptMetadata | null> {
  try {
    const path = join(BRAIN_VIDEO_ORCHESTRATOR_ROOT, `jobs/${jobId}/metadata/script.json`);
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read script metadata for ${jobId}:`, error);
    return null;
  }
}

export async function getScript(jobId: string): Promise<ScriptMetadata | null> {
  return readScriptMetadata(jobId);
}

export async function getScriptsByChannel(channelId: string): Promise<ScriptMetadata[]> {
  try {
    const jobsPath = join(BRAIN_VIDEO_ORCHESTRATOR_ROOT, 'jobs');
    const fs = await import('fs/promises');
    const jobDirs = await fs.readdir(jobsPath);

    const scripts: ScriptMetadata[] = [];
    for (const jobDir of jobDirs) {
      const metadata = await readScriptMetadata(jobDir);
      if (metadata && metadata.channelId === channelId) {
        scripts.push(metadata);
      }
    }

    return scripts.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error(`Failed to read scripts for channel ${channelId}:`, error);
    return [];
  }
}
