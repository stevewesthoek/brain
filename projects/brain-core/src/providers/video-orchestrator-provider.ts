import { access, readFile, writeFile, mkdir, readdir, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import type { GenerationMode, MediaSource, ScenePlan } from './aws-video-generation-types.js';
import { DeterministicScenePlanningProvider } from './aws-video-scene-planner.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const EXPECTED_CANONICAL_JOBS_PATH = 'projects/video-orchestrator/cloud/jobs';

const execFileAsync = promisify(execFile);

const AWS_REGION = 'eu-north-1';
const S3_BUCKET = 'prochat-video-dev-909439522876-eu-north-1-an';
const S3_JOBS_PREFIX = 'jobs/';
const STATE_MACHINE_ARN = 'arn:aws:states:eu-north-1:909439522876:stateMachine:prochat-video-skeleton-dev';
const NARRATION_FIXTURE_KEY = 'jobs/test-001/audio/narration.mp3';
const VIDEO_FIXTURE_KEY = 'jobs/test-001/exports/sample-transcoded.mp4';
const STEP_FUNCTIONS_EXECUTION_NAME_MAX = 80;
const S3_DISCOVERY_LIMIT = 100;
const S3_METADATA_TIMEOUT_MS = 1_200;
const S3_HEAD_TIMEOUT_MS = 800;
const S3_PUBLISH_ASSET_TIMEOUT_MS = 10_000;
const RECENT_JOB_HYDRATION_CONCURRENCY = 3;
const GENERATION_MODE = 'fixture_assembly';
const MEDIA_SOURCE = 'fixture';
const FIXTURE_TITLE_PREFIX = '[PIPELINE PROOF] ';

export interface VideoGenerationProviderInput {
  jobId: string;
  prompt: string;
  script: ScriptMetadata;
  channelId: string;
  outputVideoKey: string;
}

export interface NarrationGenerationProviderInput {
  jobId: string;
  script: ScriptMetadata;
  channelId: string;
  outputNarrationKey: string;
}

export interface GenerationProviderOutput {
  providerName: string;
  outputS3Key: string;
  metadata: Record<string, unknown>;
}

export interface VideoGenerationProvider {
  name: string;
  generateVideo(input: VideoGenerationProviderInput): Promise<GenerationProviderOutput>;
}

export interface NarrationGenerationProvider {
  name: string;
  generateNarration(input: NarrationGenerationProviderInput): Promise<GenerationProviderOutput>;
}

function getAwsVideoGenerationMode(): GenerationMode {
  const mode = process.env.AWS_VIDEO_GENERATION_MODE;
  if (mode === 'ai') return 'ai';
  if (mode === 'hybrid') return 'hybrid';
  return 'fixture';
}

function fixtureTitle(title: string): string {
  if (process.env.AWS_VIDEO_DISABLE_FIXTURE_TITLE_PREFIX === '1') return title;
  return title.startsWith(FIXTURE_TITLE_PREFIX) ? title : `${FIXTURE_TITLE_PREFIX}${title}`;
}

export function getBrainRepoRoot(moduleDir: string = MODULE_DIR): string {
  const marker = `${join('projects', 'brain-core')}`;
  const markerIndex = moduleDir.lastIndexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`Cannot resolve Brain repo root from module path: ${moduleDir}`);
  }
  return moduleDir.slice(0, markerIndex).replace(/[\\/]$/, '');
}

export function getVideoOrchestratorCloudRoot(moduleDir: string = MODULE_DIR): string {
  return join(getBrainRepoRoot(moduleDir), 'projects', 'video-orchestrator', 'cloud');
}

export function getVideoOrchestratorJobsRoot(moduleDir: string = MODULE_DIR): string {
  return join(getVideoOrchestratorCloudRoot(moduleDir), 'jobs');
}

function getVideoOrchestratorRoot(): string {
  return getVideoOrchestratorCloudRoot();
}

function shortHash(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildStepFunctionsExecutionName(jobId: string, timestamp = Date.now()): string {
  const suffix = `${timestamp}-${shortHash(jobId)}`;
  const prefix = 'console-gen-';
  const safeJobId = jobId.replace(/[^A-Za-z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const availableJobLength = STEP_FUNCTIONS_EXECUTION_NAME_MAX - prefix.length - suffix.length - 1;
  const compactJobId = safeJobId.slice(0, Math.max(8, availableJobLength)).replace(/-$/g, '');
  return `${prefix}${compactJobId}-${suffix}`.slice(0, STEP_FUNCTIONS_EXECUTION_NAME_MAX);
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
  diagnostics?: VideoJobsDiagnostics;
}

export interface VideoJobsDiagnostics {
  repoRoot: string;
  jobsRoot: string;
  jobDirectoryExists: boolean;
  jobDirectoryReadable: boolean;
  localJobFolderCount: number;
  localDiscoveredJobCount: number;
  cwd: string;
  modulePath: string;
  expectedCanonicalPath: string;
  s3Bucket: string;
  s3Prefix: string;
  s3DiscoveryAttempted: boolean;
  s3DiscoveredJobCount: number;
  hydratedJobCount: number;
  skippedJobCount: number;
  skippedJobs: Array<{ jobId: string; reason: string }>;
  warnings: string[];
  error: string | null;
}

export interface RecentVideoJobsResult {
  ok: boolean;
  jobs: VideoJobSummary[];
  diagnostics: VideoJobsDiagnostics;
}

async function buildVideoJobsDiagnostics(moduleDir: string = MODULE_DIR): Promise<VideoJobsDiagnostics> {
  let repoRoot = '';
  let jobsRoot = '';
  const warnings: string[] = [];
  let error: string | null = null;

  try {
    repoRoot = getBrainRepoRoot(moduleDir);
    jobsRoot = getVideoOrchestratorJobsRoot(moduleDir);
  } catch (resolveError) {
    error = resolveError instanceof Error ? resolveError.message : String(resolveError);
  }

  let jobDirectoryExists = false;
  let jobDirectoryReadable = false;
  let localJobFolderCount = 0;

  if (jobsRoot) {
    try {
      const entries = await readdir(jobsRoot, { withFileTypes: true });
      jobDirectoryExists = true;
      jobDirectoryReadable = true;
      localJobFolderCount = entries.filter(entry => entry.isDirectory()).length;
    } catch (readError) {
      const nodeError = readError as NodeJS.ErrnoException;
      jobDirectoryExists = nodeError.code !== 'ENOENT';
      error = nodeError.code === 'ENOTDIR'
        ? `Resolved jobs root is not a directory: ${jobsRoot}`
        : `Resolved jobs root does not exist or is not readable: ${readError instanceof Error ? readError.message : String(readError)}`;
    }
  }

  return {
    repoRoot,
    jobsRoot,
    jobDirectoryExists,
    jobDirectoryReadable,
    localJobFolderCount,
    localDiscoveredJobCount: 0,
    cwd: process.cwd(),
    modulePath: moduleDir,
    expectedCanonicalPath: EXPECTED_CANONICAL_JOBS_PATH,
    s3Bucket: S3_BUCKET,
    s3Prefix: S3_JOBS_PREFIX,
    s3DiscoveryAttempted: false,
    s3DiscoveredJobCount: 0,
    hydratedJobCount: 0,
    skippedJobCount: 0,
    skippedJobs: [],
    warnings,
    error,
  };
}

export async function getVideoJobsDiagnostics(moduleDir: string = MODULE_DIR): Promise<VideoJobsDiagnostics> {
  return buildVideoJobsDiagnostics(moduleDir);
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

  const recentOperationalJobsResult = await getRecentVideoJobsResult(10);
  const recentOperationalJobs = recentOperationalJobsResult.jobs;

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
    ...(isDevelopmentMode() ? { diagnostics: recentOperationalJobsResult.diagnostics } : {}),
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

async function readS3JobMetadataJson(jobId: string, fileName: string): Promise<unknown | null> {
  if (!isValidJobId(jobId) || !/^[A-Za-z0-9._-]+\.json$/.test(fileName)) return null;
  try {
    const { stdout } = await execFileAsync('aws', [
      's3', 'cp',
      `s3://${S3_BUCKET}/jobs/${jobId}/metadata/${fileName}`,
      '-',
      '--region', AWS_REGION,
      '--no-cli-pager',
    ], { timeout: S3_METADATA_TIMEOUT_MS });
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

async function readJobMetadataJson(jobId: string, fileName: string): Promise<unknown | null> {
  const remote = await readS3JobMetadataJson(jobId, fileName);
  if (remote) return remote;
  return readOptionalJson(getJobMetadataPath(jobId, fileName));
}

async function s3ObjectExists(key: string, timeoutMs: number = S3_HEAD_TIMEOUT_MS): Promise<boolean> {
  try {
    await execFileAsync('aws', [
      's3api', 'head-object',
      '--bucket', S3_BUCKET,
      '--key', key,
      '--region', AWS_REGION,
      '--no-cli-pager',
    ], { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function inferGeneratedS3Artifacts(jobId: string, timeoutMs: number = S3_HEAD_TIMEOUT_MS): Promise<{ narration: string | null; finalVideo: string | null; thumbnail: string | null }> {
  const narrationKey = `jobs/${jobId}/audio/narration.mp3`;
  const finalVideoKey = `jobs/${jobId}/exports/generated-001-final.mp4`;
  const thumbnailKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;
  const [narrationExists, finalVideoExists, thumbnailExists] = await Promise.all([
    s3ObjectExists(narrationKey, timeoutMs),
    s3ObjectExists(finalVideoKey, timeoutMs),
    s3ObjectExists(thumbnailKey, timeoutMs),
  ]);
  return {
    narration: narrationExists ? narrationKey : null,
    finalVideo: finalVideoExists ? finalVideoKey : null,
    thumbnail: thumbnailExists ? thumbnailKey : null,
  };
}

export interface PublishableAssetsResolution {
  videoKey: string | null;
  thumbnailKey: string | null;
  narrationKey: string | null;
  source: {
    publishJson: boolean;
    assetsJson: boolean;
    statusJson: boolean;
    inferredS3: boolean;
  };
  selectedSource: {
    videoKey: string | null;
    thumbnailKey: string | null;
    narrationKey: string | null;
  };
  missing: string[];
  checked: {
    publishJson: boolean;
    assetsJson: boolean;
    statusJson: boolean;
    inferredS3: boolean;
  };
  expectedKeys: {
    videoKey: string;
    thumbnailKey: string;
    narrationKey: string;
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nestedPath(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  if (!value || typeof value !== 'object') return null;
  return stringValue((value as Record<string, unknown>).path);
}

async function firstExistingS3Key(candidates: Array<{ key: string | null; source: keyof PublishableAssetsResolution['source'] }>): Promise<{ key: string | null; source: keyof PublishableAssetsResolution['source'] | null }> {
  for (const candidate of candidates) {
    if (!candidate.key) continue;
    if (await s3ObjectExists(candidate.key, S3_PUBLISH_ASSET_TIMEOUT_MS)) {
      return candidate;
    }
  }
  return { key: null, source: null };
}

export async function resolvePublishableAssets(jobId: string): Promise<PublishableAssetsResolution> {
  const expectedKeys = {
    videoKey: `jobs/${jobId}/exports/generated-001-final.mp4`,
    thumbnailKey: `jobs/${jobId}/exports/thumbnail-001.jpg`,
    narrationKey: `jobs/${jobId}/audio/narration.mp3`,
  };

  const [publishJson, assetsJson, statusJson, inferred] = await Promise.all([
    readJobMetadataJson(jobId, 'publish.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'assets.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'status.json') as Promise<Record<string, unknown> | null>,
    inferGeneratedS3Artifacts(jobId, S3_PUBLISH_ASSET_TIMEOUT_MS),
  ]);

  const checked = {
    publishJson: publishJson !== null,
    assetsJson: assetsJson !== null,
    statusJson: statusJson !== null,
    inferredS3: Boolean(inferred.finalVideo || inferred.thumbnail || inferred.narration),
  };

  const video = await firstExistingS3Key([
    { key: stringValue(publishJson?.videoKey), source: 'publishJson' },
    { key: nestedPath(assetsJson, 'finalVideo'), source: 'assetsJson' },
    { key: stringValue(statusJson?.finalVideoKey), source: 'statusJson' },
    { key: inferred.finalVideo ?? expectedKeys.videoKey, source: 'inferredS3' },
  ]);
  const thumbnail = await firstExistingS3Key([
    { key: stringValue(publishJson?.thumbnailKey), source: 'publishJson' },
    { key: nestedPath(assetsJson, 'thumbnail'), source: 'assetsJson' },
    { key: stringValue(statusJson?.thumbnailKey), source: 'statusJson' },
    { key: inferred.thumbnail ?? expectedKeys.thumbnailKey, source: 'inferredS3' },
  ]);
  const narration = await firstExistingS3Key([
    { key: stringValue(publishJson?.narrationKey), source: 'publishJson' },
    { key: nestedPath(assetsJson, 'narration'), source: 'assetsJson' },
    { key: stringValue(statusJson?.narrationKey), source: 'statusJson' },
    { key: inferred.narration ?? expectedKeys.narrationKey, source: 'inferredS3' },
  ]);

  const selectedSources = [video.source, thumbnail.source, narration.source].filter((source): source is keyof PublishableAssetsResolution['source'] => source !== null);
  const missing = [
    video.key ? null : 'videoKey',
    thumbnail.key ? null : 'thumbnailKey',
  ].filter((item): item is string => item !== null);

  return {
    videoKey: video.key,
    thumbnailKey: thumbnail.key,
    narrationKey: narration.key,
    source: {
      publishJson: selectedSources.includes('publishJson'),
      assetsJson: selectedSources.includes('assetsJson'),
      statusJson: selectedSources.includes('statusJson'),
      inferredS3: selectedSources.includes('inferredS3'),
    },
    selectedSource: {
      videoKey: video.source,
      thumbnailKey: thumbnail.source,
      narrationKey: narration.source,
    },
    missing,
    checked,
    expectedKeys,
  };
}

export async function getScript(jobId: string): Promise<ScriptMetadata | null> {
  return readScriptMetadata(jobId);
}

export async function getScriptsByChannel(channelId: string): Promise<ScriptMetadata[]> {
  try {
    const jobsPath = getVideoOrchestratorJobsRoot();
    const jobDirs = await readdir(jobsPath);

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

function isDevelopmentMode(): boolean {
  return process.env.NODE_ENV !== 'production';
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
  const youtube = (pubData?.platforms as Record<string, unknown> | undefined)?.youtube as Record<string, unknown> | undefined;
  if (youtube?.status === 'uploaded' || youtube?.status === 'published' || typeof youtube?.videoId === 'string') return 'published';
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

  const [script, topic, status, publish, assets, inferredArtifacts] = await Promise.all([
    readJobMetadataJson(jobId, 'script.json') as Promise<ScriptMetadata | null>,
    readOptionalJson(getJobMetadataPath(jobId, 'topic.json')),
    readJobMetadataJson(jobId, 'status.json'),
    readJobMetadataJson(jobId, 'publish.json'),
    readJobMetadataJson(jobId, 'assets.json'),
    inferGeneratedS3Artifacts(jobId),
  ]);

  if (!script) return null;

  const hasInferredPublishAssets = Boolean(inferredArtifacts.finalVideo && inferredArtifacts.thumbnail);
  const normalizedStatus = hasInferredPublishAssets && (status as Record<string, unknown> | null)?.status !== 'failed'
    ? normalizeJobStatus(script, { ...(status as Record<string, unknown> | null ?? {}), status: 'complete', completedSteps: ['video_assembled', 'thumbnail_generated'] }, publish)
    : normalizeJobStatus(script, status, publish);
  const pubData = publish as Record<string, unknown> | null;
  const yt = (pubData?.platforms as Record<string, unknown> | undefined)?.youtube as Record<string, unknown> | undefined;
  const statusJson = status as Record<string, unknown> | null;
  const assetsData = assets as Record<string, unknown> | null;
  const narration = assetsData?.narration as Record<string, unknown> | undefined;
  const finalVideo = assetsData?.finalVideo as Record<string, unknown> | undefined;
  const thumbnail = assetsData?.thumbnail as Record<string, unknown> | undefined;
  const mediaSource = stringValue(statusJson?.mediaSource) ?? stringValue(assetsData?.mediaSource) ?? stringValue(pubData?.mediaSource);
  const generationMode = stringValue(statusJson?.generationMode) ?? stringValue(assetsData?.generationMode) ?? stringValue(pubData?.generationMode);

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
      status: (yt?.status as string) || (pubData?.publishStatus as string) || 'pending',
      videoId: (yt?.videoId as string) || null,
      url: (yt?.url as string) || null,
    },
    error: {
      step: (statusJson?.failedStep as string) || null,
      message: (statusJson?.lastError as string) || null,
    },
    artifacts: {
      script: (script.scriptKey as string) || null,
      narration: (narration?.path as string) || inferredArtifacts.narration,
      finalVideo: (finalVideo?.path as string) || (statusJson?.finalVideoKey as string) || inferredArtifacts.finalVideo,
      thumbnail: (thumbnail?.path as string) || (statusJson?.thumbnailKey as string) || inferredArtifacts.thumbnail,
    },
    mediaSource,
    generationMode,
    videoSourceKey: stringValue(statusJson?.videoSourceKey) ?? stringValue(assetsData?.videoSourceKey) ?? stringValue(pubData?.videoSourceKey),
    audioSourceKey: stringValue(statusJson?.audioSourceKey) ?? stringValue(assetsData?.audioSourceKey) ?? stringValue(pubData?.audioSourceKey),
  };
}

async function getJobSkipReason(jobId: string): Promise<string> {
  if (!isValidJobId(jobId)) return 'invalid job id';

  const scriptPath = getJobMetadataPath(jobId, 'script.json');
  try {
    const content = await readFile(scriptPath, 'utf-8');
    const parsed = JSON.parse(content) as Partial<ScriptMetadata>;
    if (!parsed || typeof parsed !== 'object') return 'script.json schema/parse problem';
    if (typeof parsed.jobId !== 'string') return 'script.json schema/parse problem: missing jobId';
    if (typeof parsed.channelId !== 'string') return 'script.json schema/parse problem: missing channelId';
    if (typeof parsed.title !== 'string') return 'script.json schema/parse problem: missing title';
    return 'S3 timeout or unreadable remote/local metadata';
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === 'ENOENT') return 'missing script.json';
    if (error instanceof SyntaxError) return 'script.json schema/parse problem';
    return `unreadable metadata: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function buildVideoJobSummaryWithDiagnostics(jobId: string): Promise<
  | { job: VideoJobSummary; skipped: null }
  | { job: null; skipped: { jobId: string; reason: string } }
> {
  if (!isValidJobId(jobId)) {
    return { job: null, skipped: { jobId, reason: 'invalid job id' } };
  }

  try {
    const job = await buildVideoJobSummary(jobId);
    if (job) return { job, skipped: null };
    return { job: null, skipped: { jobId, reason: await getJobSkipReason(jobId) } };
  } catch (error) {
    return {
      job: null,
      skipped: {
        jobId,
        reason: `hydration failed: ${error instanceof Error ? error.message : String(error)}`,
      },
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      if (item !== undefined) {
        results.push(await mapper(item));
      }
    }
  }));

  return results;
}

async function listS3JobIds(limit: number = S3_DISCOVERY_LIMIT): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('aws', [
      's3api', 'list-objects-v2',
      '--bucket', S3_BUCKET,
      '--prefix', S3_JOBS_PREFIX,
      '--delimiter', '/',
      '--max-keys', String(limit),
      '--region', AWS_REGION,
      '--output', 'json',
      '--no-cli-pager',
    ], { timeout: 15000 });

    const parsed = JSON.parse(stdout) as { CommonPrefixes?: Array<{ Prefix?: string }> };
    return (parsed.CommonPrefixes ?? [])
      .map(prefix => prefix.Prefix ?? '')
      .map(prefix => /^jobs\/([^/]+)\/$/.exec(prefix)?.[1] ?? '')
      .filter((jobId): jobId is string => Boolean(jobId) && isValidJobId(jobId))
      .slice(0, limit);
  } catch (error) {
    console.error('Failed to discover video jobs from S3:', error);
    return [];
  }
}

export async function getRecentVideoJobsResult(limit: number = 20): Promise<RecentVideoJobsResult> {
  const diagnostics = await buildVideoJobsDiagnostics();
  const localJobIds: string[] = [];

  if (diagnostics.jobDirectoryReadable) {
    try {
      const entries = await readdir(diagnostics.jobsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && isValidJobId(entry.name)) {
          localJobIds.push(entry.name);
        } else if (entry.isDirectory()) {
          diagnostics.skippedJobs.push({ jobId: entry.name, reason: 'invalid job id' });
        }
      }
    } catch (error) {
      diagnostics.jobDirectoryReadable = false;
      diagnostics.error = `Resolved jobs root became unreadable while listing jobs: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  let s3JobIds: string[] = [];
  if (!diagnostics.jobDirectoryReadable || localJobIds.length === 0) {
    diagnostics.s3DiscoveryAttempted = true;
    s3JobIds = await listS3JobIds(S3_DISCOVERY_LIMIT);
    diagnostics.s3DiscoveredJobCount = s3JobIds.length;
    if (localJobIds.length === 0 && diagnostics.jobDirectoryReadable) {
      diagnostics.warnings.push('Local jobs directory is readable but contained zero valid job folders; S3 discovery fallback was used.');
    }
  }

  diagnostics.localDiscoveredJobCount = localJobIds.length;
  const jobIds = Array.from(new Set([...localJobIds, ...s3JobIds])).slice(0, S3_DISCOVERY_LIMIT);
  const results = await mapWithConcurrency(
    jobIds,
    RECENT_JOB_HYDRATION_CONCURRENCY,
    buildVideoJobSummaryWithDiagnostics,
  );
  const jobs = results.flatMap(result => result.job ? [result.job] : []);
  diagnostics.skippedJobs.push(...results.flatMap(result => result.skipped ? [result.skipped] : []));
  diagnostics.hydratedJobCount = jobs.length;
  diagnostics.skippedJobCount = diagnostics.skippedJobs.length;

  const sortedJobs = jobs
    .sort((a, b) => {
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      return bTime - aTime;
    })
    .slice(0, limit);

  if (jobIds.length > 0 && sortedJobs.length === 0) {
    diagnostics.error = diagnostics.error ?? 'Discovered video job folders but no jobs hydrated successfully.';
    diagnostics.warnings.push('Local or S3 job IDs were discovered, but every job was skipped during metadata hydration.');
  } else if (diagnostics.skippedJobCount > 0) {
    diagnostics.warnings.push(`${diagnostics.skippedJobCount} discovered video job(s) were skipped during metadata hydration.`);
  }

  const ok = diagnostics.error === null || sortedJobs.length > 0;
  if (!ok) {
    console.error('Video orchestrator job discovery failed:', diagnostics);
  }

  return { ok, jobs: sortedJobs, diagnostics };
}

export async function getRecentVideoJobs(limit: number = 20): Promise<VideoJobSummary[]> {
  const result = await getRecentVideoJobsResult(limit);
  return result.jobs;
}

export async function getVideoJob(jobId: string): Promise<VideoJobSummary | null> {
  return buildVideoJobSummary(jobId);
}

export async function getVideoJobTimeline(jobId: string): Promise<VideoJobTimeline | null> {
  if (!isValidJobId(jobId)) return null;

  const [script, topic, status, assets] = await Promise.all([
    readOptionalJson(getJobMetadataPath(jobId, 'script.json')) as Promise<ScriptMetadata | null>,
    readOptionalJson(getJobMetadataPath(jobId, 'topic.json')),
    readJobMetadataJson(jobId, 'status.json'),
    readJobMetadataJson(jobId, 'assets.json'),
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
  const publish = await readJobMetadataJson(jobId, 'publish.json');
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

  const [assets, resolved] = await Promise.all([
    readJobMetadataJson(jobId, 'assets.json'),
    resolvePublishableAssets(jobId),
  ]);

  if (assets) {
    const result: Record<string, unknown> = {
      ...(assets as Record<string, unknown>),
      publishableAssets: resolved,
    };

    // Try to load and embed scene plan if scenePlanKey is present
    const scenePlanKey = (assets as Record<string, unknown>)?.scenePlanKey;
    if (typeof scenePlanKey === 'string') {
      try {
        const scenePlan = await readJobMetadataJson(jobId, 'scene-plan.json');
        if (scenePlan) result.scenePlan = scenePlan;
      } catch {
        // Silently fail if scene-plan.json doesn't exist
      }
    }

    return result;
  }

  // Fall back to inferring from status and script
  const [status, script] = await Promise.all([
    readJobMetadataJson(jobId, 'status.json'),
    readOptionalJson(getJobMetadataPath(jobId, 'script.json')) as Promise<ScriptMetadata | null>,
  ]);

  if (!script && !status) return null;

  const statusJson = status as Record<string, unknown> | null;
  const inferred = await inferGeneratedS3Artifacts(jobId);
  return {
    jobId,
    script: (script?.scriptKey as string) || null,
    finalVideo: resolved.videoKey || (statusJson?.finalVideoKey as string) || inferred.finalVideo,
    thumbnail: resolved.thumbnailKey || (statusJson?.thumbnailKey as string) || inferred.thumbnail,
    narration: resolved.narrationKey || inferred.narration,
    publishableAssets: resolved,
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

async function writeS3MetadataJson(jobId: string, fileName: string, value: Record<string, unknown>): Promise<void> {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const tempDir = await mkdtemp(join(tmpdir(), 'brain-core-publish-json-'));
  const tempPath = join(tempDir, fileName);
  try {
    await writeFile(tempPath, content, 'utf-8');
    await execFileAsync('aws', [
      's3', 'cp',
      tempPath,
      `s3://${S3_BUCKET}/jobs/${jobId}/metadata/${fileName}`,
      '--region', AWS_REGION,
      '--no-cli-pager',
    ], { timeout: 15000 });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function writeS3JobFile(s3Key: string, content: string): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'brain-core-job-file-'));
  const fileName = s3Key.split('/').pop() || 'file';
  const tempPath = join(tempDir, fileName);
  try {
    await writeFile(tempPath, content, 'utf-8');
    await execFileAsync('aws', [
      's3', 'cp',
      tempPath,
      `s3://${S3_BUCKET}/${s3Key}`,
      '--region', AWS_REGION,
      '--no-cli-pager',
    ], { timeout: 15000 });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function repairPublishJson(jobId: string, publishJson: Record<string, unknown> | null, resolved: PublishableAssetsResolution): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();
  const [script, statusJson, assetsJson] = await Promise.all([
    readJobMetadataJson(jobId, 'script.json') as Promise<ScriptMetadata | null>,
    readJobMetadataJson(jobId, 'status.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'assets.json') as Promise<Record<string, unknown> | null>,
  ]);
  const mediaSource = stringValue(publishJson?.mediaSource) ?? stringValue(statusJson?.mediaSource) ?? stringValue(assetsJson?.mediaSource);
  const generationMode = stringValue(publishJson?.generationMode) ?? stringValue(statusJson?.generationMode) ?? stringValue(assetsJson?.generationMode);
  const videoSourceKey = stringValue(publishJson?.videoSourceKey) ?? stringValue(statusJson?.videoSourceKey) ?? stringValue(assetsJson?.videoSourceKey);
  const audioSourceKey = stringValue(publishJson?.audioSourceKey) ?? stringValue(statusJson?.audioSourceKey) ?? stringValue(assetsJson?.audioSourceKey);
  const platforms = publishJson?.platforms && typeof publishJson.platforms === 'object'
    ? publishJson.platforms as Record<string, unknown>
    : {};
  const existingYoutube = platforms.youtube && typeof platforms.youtube === 'object'
    ? platforms.youtube as Record<string, unknown>
    : {};
  const repaired = {
    ...(publishJson ?? {}),
    jobId,
    publishStatus: stringValue(publishJson?.publishStatus) ?? 'pending',
    createdAt: stringValue(publishJson?.createdAt) ?? now,
    updatedAt: now,
    publishedAt: publishJson?.publishedAt ?? null,
    title: (mediaSource === 'fixture' || mediaSource === 'hybrid')
      ? fixtureTitle(stringValue(publishJson?.title) ?? script?.title ?? '')
      : stringValue(publishJson?.title) ?? script?.title ?? '',
    description: stringValue(publishJson?.description) ?? '',
    tags: stringArray(publishJson?.tags),
    videoKey: resolved.videoKey,
    thumbnailKey: resolved.thumbnailKey,
    mediaSource,
    generationMode,
    videoSourceKey,
    audioSourceKey,
    platforms: {
      ...platforms,
      youtube: {
        ...existingYoutube,
        status: stringValue(existingYoutube.status) ?? 'pending',
        videoId: existingYoutube.videoId ?? null,
        publishedAt: existingYoutube.publishedAt ?? null,
        url: existingYoutube.url ?? null,
        error: null,
      },
    },
  };

  const content = `${JSON.stringify(repaired, null, 2)}\n`;
  const metadataDir = join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata');
  const publishingDir = join(getVideoOrchestratorRoot(), 'jobs', jobId, 'publishing');
  await mkdir(metadataDir, { recursive: true });
  await mkdir(publishingDir, { recursive: true });
  await Promise.all([
    writeFile(join(metadataDir, 'publish.json'), content, 'utf-8'),
    writeFile(join(publishingDir, 'publish.json'), content, 'utf-8'),
    writeS3MetadataJson(jobId, 'publish.json', repaired),
  ]);

  return repaired;
}

export async function runControlledYouTubePublish(jobId: string, options: { dryRun: boolean; confirmation?: string }): Promise<ControlledYouTubePublishResult> {
  if (!isValidJobId(jobId)) return { ok: false, jobId, dryRun: options.dryRun, code: 'invalid_job_id', error: 'Invalid jobId' };

  let publishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;
  const resolved = await resolvePublishableAssets(jobId);
  if (resolved.missing.length > 0 || !resolved.videoKey || !resolved.thumbnailKey) {
    return {
      ok: false,
      jobId,
      dryRun: options.dryRun,
      code: 'publish_assets_missing',
      error: 'Publish assets are missing',
      details: {
        jobId,
        missing: resolved.missing,
        checked: resolved.checked,
        source: resolved.source,
        selectedSource: resolved.selectedSource,
        expectedKeys: {
          videoKey: resolved.expectedKeys.videoKey,
          thumbnailKey: resolved.expectedKeys.thumbnailKey,
        },
      },
    };
  }

  publishJson = await repairPublishJson(jobId, publishJson, resolved);

  const platforms = publishJson.platforms as Record<string, unknown> | undefined;
  const youtube = platforms?.youtube as Record<string, unknown> | undefined;
  const existingVideoId = typeof youtube?.videoId === 'string' ? youtube.videoId : null;
  const youtubeStatus = typeof youtube?.status === 'string' ? youtube.status : null;
  if (existingVideoId || youtubeStatus === 'uploaded' || youtubeStatus === 'published') {
    return { ok: false, jobId, dryRun: options.dryRun, code: 'already_uploaded', error: 'YouTube upload already exists for this job', videoId: existingVideoId, url: typeof youtube?.url === 'string' ? youtube.url : null };
  }

  // Real uploads are still gated by UI flow: selected ready-to-publish job, successful dry-run,
  // duplicate-upload check above, OAuth channel verification, and private-only upload script defaults.

  const scriptPath = join(getVideoOrchestratorRoot(), 'scripts', 'youtube-upload-local.sh');
  const args = [scriptPath, jobId];
  if (options.dryRun) args.push('--dry-run');

  try {
    const { stdout, stderr } = await execFileAsync('bash', args, { timeout: options.dryRun ? 120000 : 1800000 });
    const updatedPublishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;
    const updatedYoutube = ((updatedPublishJson?.platforms as Record<string, unknown> | undefined)?.youtube as Record<string, unknown> | undefined) ?? youtube;
    const result: ControlledYouTubePublishResult = {
      ok: true,
      jobId,
      dryRun: options.dryRun,
      videoId: typeof updatedYoutube?.videoId === 'string' ? updatedYoutube.videoId : null,
      url: typeof updatedYoutube?.url === 'string' ? updatedYoutube.url : null,
      stdout: stdout.slice(-4000),
      stderr: stderr.slice(-2000),
    };
    const publishStatus = typeof updatedPublishJson?.publishStatus === 'string'
      ? updatedPublishJson.publishStatus
      : typeof publishJson.publishStatus === 'string'
        ? publishJson.publishStatus
        : null;
    if (publishStatus) result.publishStatus = publishStatus;
    return result;
  } catch (error) {
    const outputError = error as Error & { stdout?: string; stderr?: string };
    const result: ControlledYouTubePublishResult = {
      ok: false,
      jobId,
      dryRun: options.dryRun,
      code: 'youtube_upload_script_failed',
      error: outputError.message.slice(-2000),
    };
    if (typeof outputError.stdout === 'string') result.stdout = outputError.stdout.slice(-4000);
    if (typeof outputError.stderr === 'string') result.stderr = outputError.stderr.slice(-4000);
    return result;
  }
}

export async function getVideoJobExecutionStatus(jobId: string): Promise<VideoJobExecutionStatus | null> {
  if (!isValidJobId(jobId)) return null;

  const status = await readJobMetadataJson(jobId, 'status.json') as Record<string, unknown> | null;
  if (!status) return null;

  const executionArn = typeof status.executionArn === 'string' ? status.executionArn : null;
  const base: VideoJobExecutionStatus = {
    jobId,
    executionArn,
    awsStatus: null,
    startDate: null,
    stopDate: null,
    error: null,
    cause: null,
    redriveStatus: null,
    localStatus: typeof status.status === 'string' ? status.status : null,
    localStep: typeof status.currentStep === 'string' ? status.currentStep : null,
    checkedAt: new Date().toISOString(),
  };

  if (!executionArn) return base;

  try {
    const { stdout } = await execFileAsync('aws', [
      'stepfunctions', 'describe-execution',
      '--execution-arn', executionArn,
      '--region', AWS_REGION,
      '--output', 'json',
      '--no-cli-pager',
    ], { timeout: 15000 });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    const awsStatus = typeof parsed.status === 'string' ? parsed.status as VideoJobExecutionStatus['awsStatus'] : 'UNKNOWN';
    const inferred = awsStatus === 'SUCCEEDED' ? await inferGeneratedS3Artifacts(jobId) : null;
    const hasPublishAssets = Boolean(inferred?.finalVideo && inferred?.thumbnail);
    return {
      ...base,
      awsStatus,
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : null,
      stopDate: typeof parsed.stopDate === 'string' ? parsed.stopDate : null,
      error: typeof parsed.error === 'string' ? parsed.error : null,
      cause: typeof parsed.cause === 'string' ? parsed.cause : null,
      redriveStatus: typeof parsed.redriveStatus === 'string' ? parsed.redriveStatus : null,
      localStatus: hasPublishAssets ? 'complete' : base.localStatus,
      localStep: hasPublishAssets ? 'ready_to_publish' : base.localStep,
    };
  } catch (error) {
    return {
      ...base,
      awsStatus: 'UNKNOWN',
      error: 'describe_execution_failed',
      cause: error instanceof Error ? error.message : String(error),
    };
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
    readJobMetadataJson(jobId, 'publish.json'),
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
  mediaSource?: string;
  generationMode?: string;
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
  mediaSource?: string | null;
  generationMode?: string | null;
  videoSourceKey?: string | null;
  audioSourceKey?: string | null;
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

export interface VideoJobExecutionStatus {
  jobId: string;
  executionArn: string | null;
  awsStatus: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'ABORTED' | 'UNKNOWN' | null;
  startDate: string | null;
  stopDate: string | null;
  error: string | null;
  cause: string | null;
  redriveStatus: string | null;
  localStatus: string | null;
  localStep: string | null;
  checkedAt: string;
}

export interface ControlledYouTubePublishResult {
  ok: boolean;
  jobId: string;
  dryRun: boolean;
  publishStatus?: string;
  videoId?: string | null;
  url?: string | null;
  stdout?: string;
  stderr?: string;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
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

  const generationMode = getAwsVideoGenerationMode();
  if (generationMode === 'ai') {
    return {
      ok: false,
      code: 'ai_generation_provider_not_configured',
      message: 'AI video generation provider is not configured. Use AWS_VIDEO_GENERATION_MODE=hybrid for prompt-derived scene planning with fixture media, or configure a real provider.',
      jobId,
    };
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

  // Determine generation metadata based on mode
  const startedAt = new Date().toISOString();
  const isHybridMode = generationMode === 'hybrid';
  const modeMetadata = isHybridMode
    ? {
        mediaSource: 'hybrid' as const,
        generationMode: 'hybrid_scene_plan_fixture_media' as const,
        videoSourceKey: VIDEO_FIXTURE_KEY,
        audioSourceKey: NARRATION_FIXTURE_KEY,
        providerName: 'hybrid-scene-planner',
        aiGenerated: false,
      }
    : {
        mediaSource: MEDIA_SOURCE,
        generationMode: GENERATION_MODE,
        videoSourceKey: VIDEO_FIXTURE_KEY,
        audioSourceKey: NARRATION_FIXTURE_KEY,
        providerName: 'fixture-assembly',
        aiGenerated: false,
      };

  // Step 1: Write initial status.json
  const statusPath = join(metadataDir, 'status.json');
  const initialStatus = {
    status: 'generating',
    currentStep: 'narration_started',
    startedAt,
    updatedAt: startedAt,
    executionArn: null as string | null,
    ...modeMetadata,
  };
  const writeFailedStatus = async (failedStep: string, message: string, extra: Record<string, unknown> = {}) => {
    const failedStatus = {
      ...initialStatus,
      ...extra,
      status: 'failed',
      currentStep: failedStep,
      failedStep,
      lastError: message,
      updatedAt: new Date().toISOString(),
    };
    try {
      await writeFile(statusPath, JSON.stringify(failedStatus, null, 2) + '\n', 'utf-8');
    } catch (err) {
      console.error(`Warning: Failed to write failed status for ${jobId}: ${err}`);
    }
  };
  const s3ObjectExists = async (key: string): Promise<boolean> => {
    try {
      await execFileAsync('aws', [
        's3api', 'head-object',
        '--bucket', S3_BUCKET,
        '--key', key,
        '--region', AWS_REGION,
        '--no-cli-pager',
      ], { timeout: 15000 });
      return true;
    } catch {
      return false;
    }
  };
  try {
    await writeFile(statusPath, JSON.stringify(initialStatus, null, 2) + '\n', 'utf-8');
    await writeS3MetadataJson(jobId, 'status.json', initialStatus);
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

  // Step 2.5 (Hybrid only): Generate scene plan and narration script from prompt
  let scenePlanKey: string | undefined;
  let narrationScriptKey: string | undefined;
  if (isHybridMode) {
    const scenePlanner = new DeterministicScenePlanningProvider();
    try {
      // Read script content from script.md
      let scriptContent = '';
      try {
        const scriptPath = script.scriptPath || `jobs/${jobId}/scripts/script.md`;
        const scriptFullPath = join(getVideoOrchestratorRoot(), scriptPath.replace('jobs/', 'jobs/'));
        scriptContent = await readFile(scriptFullPath, 'utf-8');
      } catch {
        // Fall back to minimal content if script.md is not readable
        scriptContent = script.title || '';
      }

      // Generate scene plan
      const scenePlan = scenePlanner.generateScenePlan(jobId, script, scriptContent);
      scenePlanKey = `jobs/${jobId}/metadata/scene-plan.json`;

      // Write scene plan locally and to S3
      await writeFile(join(metadataDir, 'scene-plan.json'), JSON.stringify(scenePlan, null, 2) + '\n', 'utf-8');
      await writeS3MetadataJson(jobId, 'scene-plan.json', scenePlan as unknown as Record<string, unknown>);

      // Generate narration script
      const narrationScript = scenePlanner.generateNarrationScript(scenePlan);
      narrationScriptKey = `jobs/${jobId}/audio/narration-script.txt`;

      // Write narration script locally and to S3
      await writeFile(join(audioDir, 'narration-script.txt'), narrationScript, 'utf-8');
      await writeS3JobFile(narrationScriptKey, narrationScript);
    } catch (err) {
      return {
        ok: false,
        code: 'scene_plan_generation_failed',
        message: `Failed to generate scene plan: ${err instanceof Error ? err.message : String(err)}`,
        jobId,
      };
    }
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

  // Step 4: Copy skeleton base video fixture until real base-video generation is implemented.
  // The deployed state machine is final assembly: it requires a base video clip plus narration.
  const videoKey = `jobs/${jobId}/video-generated/generated-001.mp4`;
  try {
    await execFileAsync('aws', [
      's3', 'cp',
      `s3://${S3_BUCKET}/${VIDEO_FIXTURE_KEY}`,
      `s3://${S3_BUCKET}/${videoKey}`,
      '--region', AWS_REGION,
      '--no-cli-pager',
    ]);
  } catch (err) {
    const message = `Failed to copy skeleton video fixture: ${err instanceof Error ? err.message : String(err)}`;
    await writeFailedStatus('video_fixture_copy_failed', message, {
      videoFixtureKey: VIDEO_FIXTURE_KEY,
      videoKey,
    });
    return {
      ok: false,
      code: 'video_fixture_failed',
      message,
      jobId,
    };
  }

  // Step 5: Preflight required S3 inputs before starting MediaConvert orchestration.
  const [videoExists, audioExists] = await Promise.all([
    s3ObjectExists(videoKey),
    s3ObjectExists(narrationKey),
  ]);
  if (!videoExists || !audioExists) {
    const missingInputs = [
      !videoExists ? `s3://${S3_BUCKET}/${videoKey}` : null,
      !audioExists ? `s3://${S3_BUCKET}/${narrationKey}` : null,
    ].filter(Boolean);
    const message = `Cannot start MediaConvert assembly; missing required S3 input(s): ${missingInputs.join(', ')}`;
    await writeFailedStatus('preflight_missing_s3_inputs', message, {
      missingInputs,
      videoKey,
      audioKey: narrationKey,
    });
    return {
      ok: false,
      code: 'missing_s3_inputs',
      message,
      jobId,
    };
  }

  const assetsJson: Record<string, unknown> = {
    jobId,
    mediaSource: modeMetadata.mediaSource,
    generationMode: modeMetadata.generationMode,
    videoSourceKey: VIDEO_FIXTURE_KEY,
    audioSourceKey: NARRATION_FIXTURE_KEY,
    aiGenerated: false,
    narration: {
      path: narrationKey,
      source: 'fixture',
      sourceKey: NARRATION_FIXTURE_KEY,
    },
    sourceVideo: {
      path: videoKey,
      source: 'fixture',
      sourceKey: VIDEO_FIXTURE_KEY,
    },
  };

  // Add hybrid-specific fields
  if (isHybridMode && scenePlanKey) {
    assetsJson.scenePlanKey = scenePlanKey;
    assetsJson.narrationScriptKey = narrationScriptKey;
    assetsJson.providers = {
      scenePlan: 'deterministic-local',
      narrationScript: 'deterministic-local',
      narrationAudio: 'fixture',
      video: 'fixture',
    };
    assetsJson.warnings = ['Final video/audio media still uses fixture assets; scene plan and narration script are prompt-derived.'];
  }

  try {
    await writeFile(join(metadataDir, 'assets.json'), `${JSON.stringify(assetsJson, null, 2)}\n`, 'utf-8');
    await writeS3MetadataJson(jobId, 'assets.json', assetsJson);
  } catch (err) {
    console.error(`Warning: Failed to write assets metadata for ${jobId}: ${err}`);
  }

  // Step 5: Start Step Functions execution
  const executionName = buildStepFunctionsExecutionName(jobId);
  const sfInput = JSON.stringify({
    jobId,
    videoKey,
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
  initialStatus.updatedAt = new Date().toISOString();
  try {
    await writeFile(statusPath, JSON.stringify(initialStatus, null, 2) + '\n', 'utf-8');
    await writeS3MetadataJson(jobId, 'status.json', initialStatus);
  } catch (err) {
    // Log but don't fail — status is non-critical at this point
    console.error(`Warning: Failed to update status.json with executionArn: ${err}`);
  }

  // Step 5: Write publish.json to both metadata/ and publishing/
  const publishReason = isHybridMode
    ? 'Hybrid pipeline proof — prompt-derived scene plan and narration script; video/audio media uses fixtures'
    : 'Pipeline proof fixture assembly — awaiting explicit publish approval';
  const publishDescription = isHybridMode
    ? 'Hybrid mode: scene plan and narration script are prompt-derived from the input prompt. Final audio and video media use fixtures.'
    : 'Pipeline proof upload. This video used fixture media, not prompt-generated AI video.';

  const publishJson = {
    jobId,
    publishStatus: 'pending',
    publishBlocked: true,
    reason: publishReason,
    createdAt: new Date().toISOString(),
    generatedBy: 'interactive-prompt',
    title: fixtureTitle(script.title),
    description: publishDescription,
    tags: isHybridMode ? ['hybrid-proof', 'fixture-media', 'scene-plan-generated'] : ['pipeline-proof', 'fixture-media'],
    ...modeMetadata,
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
    await writeS3MetadataJson(jobId, 'publish.json', publishJson);
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
    mediaSource: modeMetadata.mediaSource,
    generationMode: modeMetadata.generationMode,
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
