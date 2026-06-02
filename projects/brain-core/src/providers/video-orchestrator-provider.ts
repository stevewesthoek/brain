import { access, readFile, writeFile, mkdir } from 'fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'path';

function getVideoOrchestratorRoot(): string {
  return process.env.BRAIN_VIDEO_ORCHESTRATOR_ROOT
    || '/Users/Office/Repos/stevewesthoek/brain/projects/video-orchestrator/cloud';
}

const execFileAsync = promisify(execFile);

const AWS_REGION = 'eu-north-1';
const S3_BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an';
const STATE_MACHINE_ARN = 'arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev';
const NARRATION_FIXTURE_KEY = 'jobs/test-001/audio/narration.mp3';

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

  const recentOperationalJobs = await getRecentVideoJobs(10);

  return {
    channels,
    recentJobs: recentOperationalJobs.map(job => ({
      jobId: job.jobId,
      channelId: job.channelId,
      status: job.status,
      ...(job.publishing.videoId ? { videoId: job.publishing.videoId } : {}),
    })),
    pipelineReady: true,
    generationStatus: recentOperationalJobs.some(job => job.status === 'generating') ? 'in-progress' : 'ready',
    publishingStatus: recentOperationalJobs.some(job => job.status === 'publishing') ? 'in-progress' : 'ready',
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

function normalizeJobStatus(
  script: ScriptMetadata | null,
  statusJson: unknown,
  publish: unknown,
): NormalizedJobStatus {
  if (!script) return 'draft';

  const status = statusJson as Record<string, unknown> | null;
  const pubData = publish as Record<string, unknown> | null;

  // Check publish status first (terminal state)
  if (pubData?.publishStatus === 'uploaded') return 'published';
  if (pubData?.publishStatus === 'publishing') return 'publishing';

  // Check if generation completed
  const statusVal = status?.status as string | null;
  const completedSteps = status?.completedSteps as string[] | null;
  if (statusVal === 'complete' || completedSteps?.includes('thumbnail_generated')) return 'ready_to_publish';

  // Check for failed before active states
  if (status?.failedStep || status?.lastError || statusVal === 'failed') return 'failed';

  // Check if generating
  if (statusVal === 'generating') return 'generating';

  // Check approval status
  const approval = script.approval as unknown as Record<string, unknown> | undefined;
  if (approval?.status === 'approved') {
    // If approved but no generation, return approved
    if (!statusVal || statusVal === 'draft') return 'approved';
    if (statusVal === 'complete') return 'generated';
  }

  // Check for failed
  if (status?.failedStep) return 'failed';

  // Pending/awaiting approval
  if (approval?.status === 'pending') return 'awaiting_approval';

  return 'draft';
}

function statusToProgress(status: NormalizedJobStatus): number {
  const map: Record<NormalizedJobStatus, number> = {
    draft: 0,
    awaiting_approval: 20,
    approved: 30,
    generating: 50,
    generated: 70,
    ready_to_publish: 80,
    publishing: 90,
    published: 100,
    failed: 0,
  };
  return map[status] ?? 0;
}

async function buildVideoJobSummary(jobId: string): Promise<VideoJobSummary | null> {
  if (!isValidJobId(jobId)) return null;

  const [script, topic, status, publish, assets] = await Promise.all([
    readOptionalJson(getJobMetadataPath(jobId, 'script.json')) as Promise<ScriptMetadata | null>,
    readOptionalJson(getJobMetadataPath(jobId, 'topic.json')),
    readOptionalJson(getJobMetadataPath(jobId, 'status.json')),
    readOptionalJson(getJobMetadataPath(jobId, 'publish.json')),
    readOptionalJson(getJobMetadataPath(jobId, 'assets.json')),
  ]);

  if (!script) return null;

  const normalizedStatus = normalizeJobStatus(script, status, publish);
  const pubData = publish as Record<string, unknown> | null;
  const yt = (pubData?.platforms as Record<string, unknown> | undefined)?.youtube as Record<string, unknown> | undefined;
  const statusJson = status as Record<string, unknown> | null;
  const assetsData = assets as Record<string, unknown> | null;
  const narration = assetsData?.narration as Record<string, unknown> | undefined;
  const finalVideo = assetsData?.finalVideo as Record<string, unknown> | undefined;
  const thumbnail = assetsData?.thumbnail as Record<string, unknown> | undefined;

  return {
    jobId,
    channelId: script.channelId,
    title: script.title,
    status: normalizedStatus,
    currentStep: (statusJson?.currentStep as string) || null,
    progress: statusToProgress(normalizedStatus),
    createdAt: script.createdAt || null,
    updatedAt: script.updatedAt || (statusJson?.updatedAt as string) || null,
    approval: {
      status: (script.approval?.status as string) || 'pending',
      required: ((script.approval as unknown as Record<string, unknown>)?.required ?? true) !== false,
    },
    generation: {
      status: (statusJson?.status as string) || 'pending',
      executionArn: (statusJson?.executionArn as string) || null,
      startedAt: (statusJson?.startedAt as string) || null,
      completedAt: (statusJson?.completedAt as string) || null,
    },
    publishing: {
      status: (pubData?.publishStatus as string) || 'pending',
      videoId: (yt?.videoId as string) || null,
      url: (yt?.url as string) || null,
    },
    error: {
      step: (statusJson?.failedStep as string) || null,
      message: (statusJson?.lastError as string) || null,
    },
    artifacts: {
      script: (script.scriptKey as string) || null,
      narration: (narration?.path as string) || null,
      finalVideo: (finalVideo?.path as string) || (statusJson?.finalVideoKey as string) || null,
      thumbnail: (thumbnail?.path as string) || (statusJson?.thumbnailKey as string) || null,
    },
  };
}

export async function getRecentVideoJobs(limit: number = 20): Promise<VideoJobSummary[]> {
  try {
    const jobsPath = join(getVideoOrchestratorRoot(), 'jobs');
    const fs = await import('fs/promises');
    const jobDirs = await fs.readdir(jobsPath);

    const jobs: VideoJobSummary[] = [];
    for (const jobDir of jobDirs) {
      const job = await buildVideoJobSummary(jobDir);
      if (job) jobs.push(job);
    }

    return jobs
      .sort((a, b) => {
        const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
        const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
        return bTime - aTime;
      })
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to read recent video jobs:', error);
    return [];
  }
}

export async function getVideoJob(jobId: string): Promise<VideoJobSummary | null> {
  return buildVideoJobSummary(jobId);
}

export async function getVideoJobTimeline(jobId: string): Promise<VideoJobTimeline | null> {
  if (!isValidJobId(jobId)) return null;

  const [script, topic, status, assets] = await Promise.all([
    readOptionalJson(getJobMetadataPath(jobId, 'script.json')) as Promise<ScriptMetadata | null>,
    readOptionalJson(getJobMetadataPath(jobId, 'topic.json')),
    readOptionalJson(getJobMetadataPath(jobId, 'status.json')),
    readOptionalJson(getJobMetadataPath(jobId, 'assets.json')),
  ]);

  if (!script) return null;

  const events: VideoJobTimelineEvent[] = [];
  const statusJson = status as Record<string, unknown> | null;
  const assetsData = assets as Record<string, unknown> | null;
  const topicData = topic as Record<string, unknown> | null;
  const completedSteps = statusJson?.completedSteps as string[] | null;

  // draft_created
  if (topicData) {
    events.push({
      step: 'draft_created',
      status: 'complete',
      timestamp: (topicData.createdAt as string) || null,
      message: 'Draft created from prompt',
    });
  }

  // script_approved
  if (script.approval?.status === 'approved') {
    events.push({
      step: 'script_approved',
      status: 'complete',
      timestamp: (script.approval.approvedAt as string) || null,
      message: `Approved by ${script.approval.approvedBy || 'user'}`,
    });
  }

  // narration_created
  if (completedSteps?.includes('narration_generated') || assetsData?.narration) {
    events.push({
      step: 'narration_created',
      status: 'complete',
      timestamp: null,
      message: 'Narration audio generated',
    });
  }

  // video_generated
  if (completedSteps?.includes('video_assembled') || assetsData?.finalVideo) {
    events.push({
      step: 'video_generated',
      status: 'complete',
      timestamp: null,
      message: 'Video assembled',
    });
  }

  // thumbnail_generated
  if (completedSteps?.includes('thumbnail_generated') || assetsData?.thumbnail) {
    events.push({
      step: 'thumbnail_generated',
      status: 'complete',
      timestamp: null,
      message: 'Thumbnail generated',
    });
  }

  // ready_to_publish
  if (statusJson?.status === 'complete' && completedSteps?.includes('thumbnail_generated')) {
    events.push({
      step: 'ready_to_publish',
      status: 'complete',
      timestamp: (statusJson.completedAt as string) || null,
      message: 'Ready for publishing',
    });
  }

  // published (if YouTube has it)
  const publish = await readOptionalJson(getJobMetadataPath(jobId, 'publish.json'));
  const pubData = publish as Record<string, unknown> | null;
  if (pubData) {
    const yt = (pubData.platforms as Record<string, unknown> | undefined)?.youtube as Record<string, unknown> | undefined;
    if (pubData.publishStatus === 'uploaded' || yt?.status === 'uploaded') {
      events.push({
        step: 'published',
        status: 'complete',
        timestamp: (pubData.updatedAt as string) || null,
        message: 'Published to YouTube',
      });
    }
  }

  return { jobId, events };
}

export async function getVideoJobArtifacts(jobId: string): Promise<Record<string, unknown> | null> {
  if (!isValidJobId(jobId)) return null;

  const assets = await readOptionalJson(getJobMetadataPath(jobId, 'assets.json'));
  if (assets) return assets as Record<string, unknown>;

  // Fall back to inferring from status and script
  const [status, script] = await Promise.all([
    readOptionalJson(getJobMetadataPath(jobId, 'status.json')),
    readOptionalJson(getJobMetadataPath(jobId, 'script.json')) as Promise<ScriptMetadata | null>,
  ]);

  if (!script && !status) return null;

  const statusJson = status as Record<string, unknown> | null;
  return {
    jobId,
    script: (script?.scriptKey as string) || null,
    finalVideo: (statusJson?.finalVideoKey as string) || null,
    thumbnail: (statusJson?.thumbnailKey as string) || null,
    narration: null,
  };
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

export interface GenerationTriggerRequest {
  requestedBy?: unknown;
}

export interface GenerationTriggerResponse {
  ok: true;
  jobId: string;
  generationStatus: 'complete' | 'started';
  generationStarted: boolean;
  executionArn?: string;
  finalVideoKey?: string;
  thumbnailKey?: string;
  publishStatus: 'pending';
  publishBlocked: true;
}

export interface GenerationTriggerError {
  ok: false;
  code: string;
  message: string;
  jobId?: string;
}

export type GenerationTriggerResult = GenerationTriggerResponse | GenerationTriggerError;

export type NormalizedJobStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'generating'
  | 'generated'
  | 'ready_to_publish'
  | 'publishing'
  | 'published'
  | 'failed';

export interface VideoJobSummary {
  jobId: string;
  channelId: string;
  title: string;
  status: NormalizedJobStatus;
  currentStep: string | null;
  progress: number;
  createdAt: string | null;
  updatedAt: string | null;
  approval: { status: string; required: boolean };
  generation: { status: string; executionArn: string | null; startedAt: string | null; completedAt: string | null };
  publishing: { status: string; videoId: string | null; url: string | null };
  error: { step: string | null; message: string | null };
  artifacts: { script: string | null; narration: string | null; finalVideo: string | null; thumbnail: string | null };
}

export interface VideoJobTimelineEvent {
  step: string;
  status: 'complete' | 'in_progress' | 'pending' | 'failed';
  timestamp: string | null;
  message: string;
}

export interface VideoJobTimeline {
  jobId: string;
  events: VideoJobTimelineEvent[];
}

export async function generateApprovedScript(
  jobId: string,
  input: GenerationTriggerRequest,
): Promise<GenerationTriggerResult> {
  // Validate jobId
  if (!isValidJobId(jobId)) {
    return {
      ok: false,
      code: 'invalid_job_id',
      message: 'jobId may contain only letters, numbers, dots, underscores, and hyphens.',
      jobId,
    };
  }

  // Load script metadata
  const scriptPath = getJobMetadataPath(jobId, 'script.json');
  let script: ScriptMetadata;
  try {
    const content = await readFile(scriptPath, 'utf-8');
    script = JSON.parse(content) as ScriptMetadata;
  } catch {
    return {
      ok: false,
      code: 'script_missing',
      message: `Script metadata not found for job: ${jobId}`,
      jobId,
    };
  }

  // Load topic metadata
  const topicPath = getJobMetadataPath(jobId, 'topic.json');
  let topic: unknown;
  try {
    const content = await readFile(topicPath, 'utf-8');
    topic = JSON.parse(content);
  } catch {
    return {
      ok: false,
      code: 'topic_missing',
      message: `Topic metadata not found for job: ${jobId}`,
      jobId,
    };
  }

  // Load content profile for channel
  const contentProfilePath = join(
    getVideoOrchestratorRoot(),
    'channels',
    script.channelId,
    'content-profile.json',
  );
  let contentProfile: ContentProfile = {};
  try {
    const content = await readFile(contentProfilePath, 'utf-8');
    contentProfile = JSON.parse(content) as ContentProfile;
  } catch {
    contentProfile = {};
  }

  // Validate script is approved
  const approval = script.approval ?? { required: true, status: 'pending', theologicalReviewRequired: false, notes: null };
  if (approval.status !== 'approved') {
    return {
      ok: false,
      code: 'script_not_approved',
      message: `Script approval status is '${approval.status}', not 'approved'. Cannot generate.`,
      jobId,
    };
  }

  // For says-the-bible, verify theology review requirement
  if (script.channelId === 'says-the-bible') {
    const theologyRequired = resolveTheologyReviewRequired(script, contentProfile);
    if (theologyRequired && !approval.theologicalReviewRequired) {
      return {
        ok: false,
        code: 'theology_review_required',
        message: 'Theological review is required for this script but has not been completed.',
        jobId,
      };
    }
  }

  // All validations passed, generation can proceed
  // Create job directory structure
  const jobRoot = join(getVideoOrchestratorRoot(), 'jobs', jobId);
  const metadataDir = join(jobRoot, 'metadata');
  const audioDir = join(jobRoot, 'audio');
  const publishingDir = join(jobRoot, 'publishing');

  try {
    await mkdir(metadataDir, { recursive: true });
    await mkdir(audioDir, { recursive: true });
    await mkdir(publishingDir, { recursive: true });
  } catch (err) {
    return {
      ok: false,
      code: 'dir_creation_failed',
      message: `Failed to create job directories: ${err instanceof Error ? err.message : String(err)}`,
      jobId,
    };
  }

  // Step 1: Write initial status.json
  const statusPath = join(metadataDir, 'status.json');
  const initialStatus = {
    status: 'generating',
    currentStep: 'narration_started',
    startedAt: new Date().toISOString(),
    executionArn: null as string | null,
  };
  try {
    await writeFile(statusPath, JSON.stringify(initialStatus, null, 2) + '\n', 'utf-8');
  } catch (err) {
    return {
      ok: false,
      code: 'status_write_failed',
      message: `Failed to write status.json: ${err instanceof Error ? err.message : String(err)}`,
      jobId,
    };
  }

  // Step 2: Write/upload approvals.json for the deployed Step Functions contract.
  // The local Brain Console approval source of truth is metadata/script.json,
  // while the deployed AWS check-approval Lambda reads metadata/approvals.json from S3.
  // Keep both contracts bridged until the cloud workflow is updated to read script.json directly.
  const approvalsJson = {
    jobId,
    approvals: {
      script: {
        status: 'approved',
        approvedBy: approval.approvedBy || input.requestedBy || 'brain-console-web',
        approvedAt: approval.approvedAt || new Date().toISOString(),
        notes: approval.notes || null,
      },
    },
  };
  const approvalsPath = join(metadataDir, 'approvals.json');
  try {
    await writeFile(approvalsPath, JSON.stringify(approvalsJson, null, 2) + '\n', 'utf-8');
    await execFileAsync('aws', [
      's3', 'cp',
      approvalsPath,
      `s3://${S3_BUCKET}/jobs/${jobId}/metadata/approvals.json`,
      '--region', AWS_REGION,
      '--no-cli-pager',
    ]);
  } catch (err) {
    return {
      ok: false,
      code: 'approval_contract_upload_failed',
      message: `Failed to upload approvals.json for Step Functions approval check: ${err instanceof Error ? err.message : String(err)}`,
      jobId,
    };
  }

  // Step 3: Copy narration from S3 fixture
  const narrationKey = `jobs/${jobId}/audio/narration.mp3`;
  try {
    await execFileAsync('aws', [
      's3', 'cp',
      `s3://${S3_BUCKET}/${NARRATION_FIXTURE_KEY}`,
      `s3://${S3_BUCKET}/${narrationKey}`,
      '--region', AWS_REGION,
      '--no-cli-pager',
    ]);
  } catch (err) {
    return {
      ok: false,
      code: 'narration_failed',
      message: `Failed to copy narration from S3: ${err instanceof Error ? err.message : String(err)}`,
      jobId,
    };
  }

  // Step 4: Start Step Functions execution
  const executionName = `console-gen-${jobId}-${Date.now()}`;
  const sfInput = JSON.stringify({
    jobId,
    videoKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
    audioKey: narrationKey,
  });

  let executionArn: string;
  try {
    const { stdout } = await execFileAsync('aws', [
      'stepfunctions', 'start-execution',
      '--state-machine-arn', STATE_MACHINE_ARN,
      '--name', executionName,
      '--input', sfInput,
      '--region', AWS_REGION,
      '--query', 'executionArn',
      '--output', 'text',
      '--no-cli-pager',
    ]);
    executionArn = stdout.trim();
  } catch (err) {
    return {
      ok: false,
      code: 'workflow_start_failed',
      message: `Failed to start Step Functions execution: ${err instanceof Error ? err.message : String(err)}`,
      jobId,
    };
  }

  // Step 4: Update status.json with execution ARN
  initialStatus.executionArn = executionArn;
  initialStatus.currentStep = 'workflow_started';
  try {
    await writeFile(statusPath, JSON.stringify(initialStatus, null, 2) + '\n', 'utf-8');
  } catch (err) {
    // Log but don't fail — status is non-critical at this point
    console.error(`Warning: Failed to update status.json with executionArn: ${err}`);
  }

  // Step 5: Write publish.json to both metadata/ and publishing/
  const publishJson = {
    jobId,
    publishStatus: 'pending',
    publishBlocked: true,
    reason: 'Generated from approved draft — awaiting explicit publish approval',
    createdAt: new Date().toISOString(),
    generatedBy: 'interactive-prompt',
    platforms: {
      youtube: {
        status: 'pending',
      },
    },
  };

  const publishJsonContent = JSON.stringify(publishJson, null, 2) + '\n';

  try {
    const metadataPublishPath = join(metadataDir, 'publish.json');
    const publishingPublishPath = join(publishingDir, 'publish.json');
    await writeFile(metadataPublishPath, publishJsonContent, 'utf-8');
    await writeFile(publishingPublishPath, publishJsonContent, 'utf-8');
  } catch (err) {
    return {
      ok: false,
      code: 'publish_write_failed',
      message: `Failed to write publish.json: ${err instanceof Error ? err.message : String(err)}`,
      jobId,
    };
  }

  // Generation triggered successfully
  return {
    ok: true,
    jobId,
    generationStatus: 'started',
    generationStarted: true,
    executionArn,
    publishStatus: 'pending',
    publishBlocked: true,
  };
}

export interface CreateJobFromPromptRequest {
  channelId: string;
  prompt: string;
  requestedBy: string;
}

export interface CreateJobFromPromptResponse {
  ok: true;
  jobId: string;
  channelId: string;
  topicId: string;
  scriptStatus: 'draft';
  approvalStatus: 'pending';
  nextStep: 'approve_script';
  createdAt: string;
}

export interface CreateJobFromPromptError {
  ok: false;
  code: 'invalid_channel' | 'invalid_prompt' | 'invalid_request' | 'write_failed' | 'config_missing';
  message: string;
  details?: Record<string, unknown>;
}

export async function createJobFromPrompt(
  input: CreateJobFromPromptRequest,
): Promise<CreateJobFromPromptResponse | CreateJobFromPromptError> {
  // Validate input
  if (!input.channelId || typeof input.channelId !== 'string') {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'channelId is required and must be a string',
    };
  }

  if (!input.prompt || typeof input.prompt !== 'string') {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'prompt is required and must be a string',
    };
  }

  const promptLength = input.prompt.trim().length;
  if (promptLength < 10 || promptLength > 500) {
    return {
      ok: false,
      code: 'invalid_prompt',
      message: 'prompt must be between 10 and 500 characters',
      details: { promptLength },
    };
  }

  if (!input.requestedBy || typeof input.requestedBy !== 'string') {
    return {
      ok: false,
      code: 'invalid_request',
      message: 'requestedBy is required and must be a string',
    };
  }

  const root = getVideoOrchestratorRoot();

  // Validate channel exists and load config
  try {
    const channelDir = join(root, 'channels', input.channelId);
    await access(channelDir);

    // Load channel config
    const channelConfigPath = join(channelDir, 'channel.json');
    const contentProfilePath = join(channelDir, 'content-profile.json');

    const configData = await readFile(channelConfigPath, 'utf-8');
    const contentData = await readFile(contentProfilePath, 'utf-8');

    const config = JSON.parse(configData);
    const contentProfile = JSON.parse(contentData);

    // Verify channel allows public publishing is NOT allowed (security check)
    if (contentProfile.allowPublicPublishing === true) {
      return {
        ok: false,
        code: 'invalid_channel',
        message: 'Channel configuration does not support draft job creation',
      };
    }

    // Generate safe jobId using timestamp-based slug
    const now = new Date();
    const timestamp = now.getTime();
    const promtSlug = input.prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 30);
    const jobId = `${input.channelId}-prompt-${timestamp}-${promtSlug}`;

    // Create job folder structure
    const jobDir = join(root, 'jobs', jobId);
    const metadataDir = join(jobDir, 'metadata');
    const scriptsDir = join(jobDir, 'scripts');

    // Create directories
    await Promise.all([
      access(jobDir).catch(() => null), // Check if exists first
    ]);

    // Generate topicId from prompt
    const topicId = `${input.channelId}-prompt-${timestamp}`;

    // Create metadata files
    const now_iso = now.toISOString();

    const topicMetadata = {
      jobId,
      channelId: input.channelId,
      topicId,
      title: input.prompt.slice(0, 80),
      description: input.prompt,
      source: 'interactive-prompt',
      createdAt: now_iso,
    };

    const scriptMetadata: ScriptMetadata = {
      jobId,
      channelId: input.channelId,
      topicId,
      status: 'draft',
      title: input.prompt.slice(0, 80),
      targetDurationSeconds: contentProfile.targetDurationSeconds || 60,
      wordCount: 0, // Will be updated after script generation
      scriptKey: `jobs/${jobId}/scripts/script.md`,
      generatedBy: 'interactive-prompt',
      createdAt: now_iso,
      updatedAt: now_iso,
      approval: {
        required: contentProfile.scriptRequirements?.approvalRequired ?? true,
        status: 'pending',
        theologicalReviewRequired: contentProfile.scriptRequirements?.theologicalReviewRequired ?? false,
        notes: `Draft created from prompt by ${input.requestedBy}`,
      },
    };

    const scriptContent = `# ${input.prompt}\n\n## Prompt\n${input.prompt}\n\n## Status\nThis is a draft script created from an interactive prompt.\n\n`;

    // Write files using writeFile (creates dirs as needed via Node.js fs)
    const fs = await import('fs');
    const path = await import('path');

    // Create all directories synchronously first
    const createDirsSync = (dir: string) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    };

    createDirsSync(metadataDir);
    createDirsSync(scriptsDir);

    // Write files
    await Promise.all([
      writeFile(path.join(metadataDir, 'topic.json'), JSON.stringify(topicMetadata, null, 2)),
      writeFile(path.join(metadataDir, 'script.json'), JSON.stringify(scriptMetadata, null, 2)),
      writeFile(path.join(scriptsDir, 'script.md'), scriptContent),
    ]);

    return {
      ok: true,
      jobId,
      channelId: input.channelId,
      topicId,
      scriptStatus: 'draft',
      approvalStatus: 'pending',
      nextStep: 'approve_script',
      createdAt: now_iso,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    // Check if it's a channel not found error
    if (errorMsg.includes('ENOENT') || errorMsg.includes('not found')) {
      return {
        ok: false,
        code: 'invalid_channel',
        message: `Channel '${input.channelId}' not found or missing configuration`,
      };
    }

    if (errorMsg.includes('config') || errorMsg.includes('profile')) {
      return {
        ok: false,
        code: 'config_missing',
        message: `Channel configuration or content profile not found for '${input.channelId}'`,
      };
    }

    return {
      ok: false,
      code: 'write_failed',
      message: `Failed to create job: ${errorMsg}`,
    };
  }
}
