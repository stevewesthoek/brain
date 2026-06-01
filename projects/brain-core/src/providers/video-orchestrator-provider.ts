import { access, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

function getVideoOrchestratorRoot(): string {
  return process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT
    || '/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud';
}

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
  status: 'pending' | 'approved' | 'rejected' | 'changes_requested';
  theologicalReviewRequired: boolean;
  approvedAt?: string | null;
  approvedBy?: string | null;
  notes: string | null;
  updatedAt?: string;
}

export interface ScriptMetadata {
  jobId: string;
  channelId: string;
  topicId: string;
  status?: 'draft' | 'ready' | 'generating' | 'generated' | 'published' | 'approved' | 'changes_requested' | string;
  title: string;
  targetDurationSeconds?: number;
  wordCount: number;
  scriptKey?: string;
  scriptPath?: string;
  generatedBy?: string;
  generatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  approval: ScriptApproval;
}

export interface ScriptApprovalResponse {
  ok: true;
  jobId: string;
  channelId: string;
  topicId: string | null;
  scriptStatus: string;
  approval: ScriptApproval;
  approvalRequired: true;
  theologyReviewRequired: boolean;
  topicLoaded: boolean;
  contentProfileLoaded: boolean;
  generationTriggered: false;
  publishChanged: false;
}

export type ScriptApprovalErrorCode =
  | 'invalid_job_id'
  | 'script_missing'
  | 'invalid_body'
  | 'already_published_or_uploaded'
  | 'write_failed';

export interface ScriptApprovalError {
  ok: false;
  code: ScriptApprovalErrorCode;
  message: string;
  jobId?: string;
}

export type ScriptApprovalResult = ScriptApprovalResponse | ScriptApprovalError;

interface ContentProfile {
  channelId?: string;
  guardrails?: {
    requiresHumanApproval?: boolean;
  };
  scriptRequirements?: {
    approvalRequired?: boolean;
    theologicalReviewRequired?: boolean;
  };
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
    const path = join(getVideoOrchestratorRoot(), `channels/${channelId}/topic-backlog.json`);
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
    if (!isValidJobId(jobId)) {
      return null;
    }
    const path = getJobMetadataPath(jobId, 'script.json');
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
    const jobsPath = join(getVideoOrchestratorRoot(), 'jobs');
    const fs = await import('fs/promises');
    const jobDirs = await fs.readdir(jobsPath);

    const scripts: ScriptMetadata[] = [];
    for (const jobDir of jobDirs) {
      const metadata = await readScriptMetadata(jobDir);
      if (metadata && metadata.channelId === channelId) {
        scripts.push(metadata);
      }
    }

    return scripts.sort((a, b) => {
      const bTimestamp = new Date(b.createdAt ?? b.generatedAt ?? 0).getTime();
      const aTimestamp = new Date(a.createdAt ?? a.generatedAt ?? 0).getTime();
      return bTimestamp - aTimestamp;
    });
  } catch (error) {
    console.error(`Failed to read scripts for channel ${channelId}:`, error);
    return [];
  }
}

export function isValidJobId(jobId: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(jobId) && !jobId.includes('..');
}

function getJobMetadataPath(jobId: string, fileName: string): string {
  return join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata', fileName);
}

function getJobPublishingPath(jobId: string): string {
  return join(getVideoOrchestratorRoot(), 'jobs', jobId, 'publishing', 'publish.json');
}

async function readOptionalJson(path: string): Promise<unknown | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readScriptForApproval(jobId: string): Promise<{ script: ScriptMetadata; scriptPath: string } | ScriptApprovalError> {
  if (!isValidJobId(jobId)) {
    return {
      ok: false,
      code: 'invalid_job_id',
      message: 'jobId may contain only letters, numbers, dots, underscores, and hyphens.',
      jobId,
    };
  }

  const scriptPath = getJobMetadataPath(jobId, 'script.json');
  try {
    const content = await readFile(scriptPath, 'utf-8');
    return { script: JSON.parse(content) as ScriptMetadata, scriptPath };
  } catch {
    return {
      ok: false,
      code: 'script_missing',
      message: `Script metadata not found for job: ${jobId}`,
      jobId,
    };
  }
}

function isPublishedOrUploaded(script: ScriptMetadata, metadataPublish: unknown, publishingPublishExists: boolean): boolean {
  const scriptStatus = String(script.status ?? '').toLowerCase();
  if (scriptStatus === 'published' || scriptStatus === 'uploaded') {
    return true;
  }

  if (metadataPublish && typeof metadataPublish === 'object') {
    const publishRecord = metadataPublish as Record<string, unknown>;
    const publishStatus = String(publishRecord['publishStatus'] ?? '').toLowerCase();
    if (publishStatus === 'published' || publishStatus === 'uploaded') {
      return true;
    }

    const platforms = publishRecord['platforms'];
    if (platforms && typeof platforms === 'object') {
      for (const platform of Object.values(platforms as Record<string, unknown>)) {
        if (!platform || typeof platform !== 'object') continue;
        const platformRecord = platform as Record<string, unknown>;
        const platformStatus = String(platformRecord['status'] ?? '').toLowerCase();
        if (
          platformStatus === 'published'
          || platformStatus === 'uploaded'
          || platformRecord['alreadyPublished'] === true
        ) {
          return true;
        }
      }
    }
  }

  return publishingPublishExists;
}

function resolveTheologyReviewRequired(script: ScriptMetadata, contentProfile: ContentProfile | null): boolean {
  return script.channelId === 'says-the-bible'
    || script.approval?.theologicalReviewRequired === true
    || contentProfile?.scriptRequirements?.theologicalReviewRequired === true;
}

function buildApprovalResponse(
  script: ScriptMetadata,
  topicLoaded: boolean,
  contentProfile: ContentProfile | null,
): ScriptApprovalResponse {
  const theologyReviewRequired = resolveTheologyReviewRequired(script, contentProfile);
  return {
    ok: true,
    jobId: script.jobId,
    channelId: script.channelId,
    topicId: script.topicId ?? null,
    scriptStatus: String(script.status ?? ''),
    approval: script.approval,
    approvalRequired: true,
    theologyReviewRequired,
    topicLoaded,
    contentProfileLoaded: contentProfile !== null,
    generationTriggered: false,
    publishChanged: false,
  };
}

async function loadApprovalContext(jobId: string, script: ScriptMetadata): Promise<{
  topicLoaded: boolean;
  contentProfile: ContentProfile | null;
  metadataPublish: unknown | null;
  publishingPublishExists: boolean;
}> {
  const [topic, contentProfile, metadataPublish, publishingPublishExists] = await Promise.all([
    readOptionalJson(getJobMetadataPath(jobId, 'topic.json')),
    readOptionalJson(join(getVideoOrchestratorRoot(), 'channels', script.channelId, 'content-profile.json')) as Promise<ContentProfile | null>,
    readOptionalJson(getJobMetadataPath(jobId, 'publish.json')),
    fileExists(getJobPublishingPath(jobId)),
  ]);

  return {
    topicLoaded: topic !== null,
    contentProfile,
    metadataPublish,
    publishingPublishExists,
  };
}

export async function approveScript(
  jobId: string,
  input: { approvedBy?: unknown; notes?: unknown },
): Promise<ScriptApprovalResult> {
  if (typeof input.approvedBy !== 'string' || input.approvedBy.trim().length === 0) {
    return { ok: false, code: 'invalid_body', message: 'approvedBy is required.', jobId };
  }

  const loaded = await readScriptForApproval(jobId);
  if ('ok' in loaded) return loaded;

  const { script, scriptPath } = loaded;
  const context = await loadApprovalContext(jobId, script);
  if (isPublishedOrUploaded(script, context.metadataPublish, context.publishingPublishExists)) {
    return {
      ok: false,
      code: 'already_published_or_uploaded',
      message: 'Script approval cannot be changed after publish/upload metadata exists.',
      jobId,
    };
  }

  const now = new Date().toISOString();
  script.status = 'approved';
  script.updatedAt = now;
  script.approval = {
    ...(script.approval ?? { required: true, status: 'pending', theologicalReviewRequired: false, notes: null }),
    required: true,
    status: 'approved',
    theologicalReviewRequired: resolveTheologyReviewRequired(script, context.contentProfile),
    approvedBy: input.approvedBy.trim(),
    approvedAt: now,
    notes: typeof input.notes === 'string' && input.notes.trim().length > 0 ? input.notes.trim() : null,
  };

  try {
    await writeFile(scriptPath, `${JSON.stringify(script, null, 2)}\n`, 'utf-8');
  } catch {
    return { ok: false, code: 'write_failed', message: 'Failed to write script approval metadata.', jobId };
  }

  return buildApprovalResponse(script, context.topicLoaded, context.contentProfile);
}

export async function requestScriptChanges(
  jobId: string,
  input: { requestedBy?: unknown; notes?: unknown },
): Promise<ScriptApprovalResult> {
  if (typeof input.requestedBy !== 'string' || input.requestedBy.trim().length === 0) {
    return { ok: false, code: 'invalid_body', message: 'requestedBy is required.', jobId };
  }
  if (typeof input.notes !== 'string' || input.notes.trim().length === 0) {
    return { ok: false, code: 'invalid_body', message: 'notes are required.', jobId };
  }

  const loaded = await readScriptForApproval(jobId);
  if ('ok' in loaded) return loaded;

  const { script, scriptPath } = loaded;
  const context = await loadApprovalContext(jobId, script);
  const now = new Date().toISOString();
  script.status = 'changes_requested';
  script.updatedAt = now;
  script.approval = {
    ...(script.approval ?? { required: true, status: 'pending', theologicalReviewRequired: false, notes: null }),
    required: true,
    status: 'changes_requested',
    theologicalReviewRequired: resolveTheologyReviewRequired(script, context.contentProfile),
    notes: input.notes.trim(),
    updatedAt: now,
  };

  try {
    await writeFile(scriptPath, `${JSON.stringify(script, null, 2)}\n`, 'utf-8');
  } catch {
    return { ok: false, code: 'write_failed', message: 'Failed to write script approval metadata.', jobId };
  }

  return buildApprovalResponse(script, context.topicLoaded, context.contentProfile);
}
