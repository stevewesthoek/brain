import { access, copyFile, readFile, writeFile, mkdir, readdir, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import type { GenerationMode, MediaSource, ScenePlan } from './aws-video-generation-types.js';
import { DeterministicScenePlanningProvider } from './aws-video-scene-planner.js';
import { PollyTTSProvider } from './aws-video-polly-provider.js';
import { DeterministicStoryboardProvider } from './aws-video-storyboard-provider.js';
import { LocalFfmpegSlideshowProvider } from './aws-video-slideshow-provider.js';
import { LocalFfmpegAnimatedClipProvider } from './aws-video-animated-clip-provider.js';
import { BedrockNovaReelVideoProvider, type BedrockNovaReelVideoProviderOutput } from './aws-video-nova-reel-provider.js';
import { containsInternalOverlayTerms, DeterministicOverlayProvider, type OverlayPlan } from './aws-video-overlay-provider.js';
import {
  AwsBedrockImageProvider,
  getConfiguredImageProvider,
  getDefaultImageModelId,
  ImageProviderError,
} from './aws-video-image-provider.js';
import type { AwsVideoImageProviderName } from './aws-video-storyboard-types.js';
import {
  inferGenerationModeForPublishGate,
  isGeneratedMediaGenerationMode,
  shouldRequireReviewGate,
  isReviewApproved,
  validateGeneratedMediaPublishAssets,
  type ReviewStatus,
} from './video-orchestrator-publish-gate.js';
import { buildYouTubePackage, type YouTubePackage } from './youtube-package-builder.js';

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
const S3_HEAD_TIMEOUT_MS = 3_000;
const S3_PUBLISH_ASSET_TIMEOUT_MS = 10_000;
const S3_VIDEO_DOWNLOAD_TIMEOUT_MS = 15_000;
const RECENT_JOB_HYDRATION_CONCURRENCY = 3;
const GENERATION_MODE = 'fixture_assembly';
const MEDIA_SOURCE = 'fixture';
const FIXTURE_TITLE_PREFIX = '[PIPELINE PROOF] ';

// Dedup window for createJobFromPrompt: suppress duplicate creates within 30s of the first
const CREATE_DEDUP_WINDOW_MS = 30_000;
interface RecentCreateRequest {
  jobId?: string;
  createdAt: number;
  result?: CreateJobFromPromptResponse;
  inFlightPromise?: Promise<CreateJobFromPromptResponse | CreateJobFromPromptError>;
  accepted?: boolean;
}
const _recentCreateRequests = new Map<string, RecentCreateRequest>();

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
  if (mode === 'hybrid_storyboard') return 'hybrid_storyboard';
  if (mode === 'hybrid_slideshow') return 'hybrid_slideshow';
  if (mode === 'hybrid_image_slideshow') return 'hybrid_image_slideshow';
  if (mode === 'hybrid_animated_video') return 'hybrid_animated_video';
  if (mode === 'hybrid_tts') return 'hybrid_tts';
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

async function readLocalJobMetadataJson(jobId: string, fileName: string): Promise<unknown | null> {
  return readOptionalJson(getJobMetadataPath(jobId, fileName));
}

async function readJobMetadataJson(jobId: string, fileName: string): Promise<unknown | null> {
  const remote = await readS3JobMetadataJson(jobId, fileName);
  if (remote) return remote;
  return readLocalJobMetadataJson(jobId, fileName);
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

async function generateThumbnailFromImage(sourceImagePath: string, destImagePath: string): Promise<void> {
  const destDir = dirname(destImagePath);
  await mkdir(destDir, { recursive: true });
  // Use ffmpeg to convert PNG/JPEG to JPEG thumbnail (no dependencies beyond ffmpeg)
  await execFileAsync('ffmpeg', [
    '-i', sourceImagePath,
    '-q:v', '3', // quality 3 (good quality for thumbnails)
    '-f', 'image2',
    '-update', '1', // allow writing a single image
    destImagePath,
  ], { timeout: 30000 });
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

export type ResolveDownloadableVideoResult =
  | {
    ok: true;
    jobId: string;
    videoKey: string;
    localPath?: string;
    bucket?: string;
    region?: string;
  }
  | {
    ok: false;
    code: string;
    error: string;
    details?: unknown;
  };

export function classifyYouTubeQuotaError(input: unknown): boolean {
  const text = [
    typeof input === 'string' ? input : null,
    input && typeof input === 'object' ? JSON.stringify(input) : null,
  ].filter((value): value is string => Boolean(value)).join('\n').toLowerCase();
  return [
    'quotaexceeded',
    'dailylimitexceeded',
    'ratelimitexceeded',
    'userratelimitexceeded',
    'exceeded your quota',
    'quota reason',
  ].some((needle) => text.includes(needle));
}

async function resolveVideoKeyForDownload(jobId: string): Promise<ResolveDownloadableVideoResult> {
  if (!isValidJobId(jobId)) {
    return { ok: false, code: 'invalid_job_id', error: 'Invalid jobId' };
  }

  const publishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;
  const assetsJson = await readJobMetadataJson(jobId, 'assets.json') as Record<string, unknown> | null;
  const generationMode = stringValue(publishJson?.generationMode) ?? stringValue(assetsJson?.generationMode);
  const publishVideoKey = stringValue(publishJson?.videoKey);
  if (isGeneratedMediaGenerationMode(generationMode) && publishVideoKey?.startsWith('jobs/test-001/')) {
    return {
      ok: false,
      code: 'generated_media_publish_assets_invalid',
      error: 'Generated-media jobs must not download fixture test-001 video assets.',
      details: { jobId, generationMode, videoKey: publishVideoKey },
    };
  }

  const finalized = await finalizeAwsVideoPublishPackage(jobId);
  if (!finalized.ok) {
    return {
      ok: false,
      code: finalized.code,
      error: finalized.error,
      details: {
        ...(finalized.details ?? {}),
        missing: finalized.missing,
        jobId,
        generationMode,
        packageComplete: false,
      },
    };
  }

  const publishVideoKeyResolved = publishVideoKey ?? finalized.media.videoKey ?? null;
  const fallbackVideoKey = `jobs/${jobId}/exports/generated-001-final.mp4`;
  const resolvedKey = publishVideoKeyResolved ?? fallbackVideoKey;

  if (isGeneratedMediaGenerationMode(generationMode) && resolvedKey.startsWith('jobs/test-001/')) {
    return {
      ok: false,
      code: 'generated_media_publish_assets_invalid',
      error: 'Generated-media jobs must not download fixture test-001 video assets.',
      details: { jobId, generationMode, videoKey: resolvedKey },
    };
  }

  const localPath = join(getVideoOrchestratorRoot(), resolvedKey);
  if (await fileExists(localPath)) {
    return { ok: true, jobId, videoKey: resolvedKey, localPath };
  }

  if (await s3ObjectExists(resolvedKey, S3_VIDEO_DOWNLOAD_TIMEOUT_MS)) {
    return { ok: true, jobId, videoKey: resolvedKey, bucket: S3_BUCKET, region: AWS_REGION };
  }

  return {
    ok: false,
    code: 'video_not_found',
    error: 'Final MP4 could not be found locally or on S3.',
    details: { jobId, videoKey: resolvedKey },
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

  // Check if generation completed (from status.json fields OR from publish.json/assets.json evidence)
  const statusVal = status?.status as string | null;
  const completedSteps = status?.completedSteps as string[] | null;
  const hasPublishableAssets = Boolean(
    (pubData?.videoKey && typeof pubData.videoKey === 'string') ||
    (pubData?.thumbnailKey && typeof pubData.thumbnailKey === 'string')
  );

  // Monotonic: if publishable assets exist, mark as ready_to_publish even if statusJson is stale
  if (hasPublishableAssets && statusVal !== 'failed') return 'ready_to_publish';
  if (statusVal === 'complete' || completedSteps?.includes('thumbnail_generated')) return 'ready_to_publish';

  // Check for failed before active states
  if (status?.failedStep || status?.lastError || statusVal === 'failed') return 'failed';

  // Check if generating (only if no asset evidence exists)
  if (statusVal === 'generating' && !hasPublishableAssets) return 'generating';

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

async function reconcileJobWithAwsExecution(jobId: string, statusJson: Record<string, unknown> | null): Promise<Record<string, unknown> | null> {
  // If status is already marked failed, don't need reconciliation
  if ((statusJson?.status === 'failed' && statusJson?.failedStep) || statusJson?.lastError) {
    return statusJson;
  }

  const executionArn = statusJson?.executionArn as string | null | undefined;
  if (!executionArn) return statusJson;

  try {
    const { stdout } = await execFileAsync('aws', [
      'stepfunctions', 'describe-execution',
      '--execution-arn', executionArn,
      '--region', AWS_REGION,
      '--output', 'json',
      '--no-cli-pager',
    ], { timeout: 15000 });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.status === 'FAILED') {
      const awsError = typeof parsed.error === 'string' ? parsed.error : 'StepFunctionsFailed';
      const awsCause = typeof parsed.cause === 'string' ? parsed.cause : 'Unknown AWS error';
      const reconciledStatus = {
        ...statusJson,
        status: 'failed',
        failedStep: awsError,
        lastError: awsCause,
      };
      // Write reconciled status to both local file and S3 for consistency
      try {
        await writeFile(getJobMetadataPath(jobId, 'status.json'), JSON.stringify(reconciledStatus, null, 2) + '\n', 'utf-8');
      } catch (err) {
        console.warn(`Could not write reconciled status locally for ${jobId}:`, err);
      }
      try {
        await writeS3JobFile(`jobs/${jobId}/metadata/status.json`, JSON.stringify(reconciledStatus, null, 2));
      } catch (err) {
        console.warn(`Could not write reconciled status to S3 for ${jobId}:`, err);
      }
      return reconciledStatus;
    }
  } catch (err) {
    console.warn(`Could not reconcile AWS execution for ${jobId}:`, err);
  }
  return statusJson;
}

async function buildVideoJobSummary(jobId: string, options?: { skipS3Inference?: boolean; skipAwsReconciliation?: boolean }): Promise<VideoJobSummary | null> {
  if (!isValidJobId(jobId)) return null;

  const shouldInferS3Artifacts = !options?.skipS3Inference;
  const shouldReconcileAwsExecution = !options?.skipAwsReconciliation;
  const readMetadata = options?.skipS3Inference ? readLocalJobMetadataJson : readJobMetadataJson;
  const readOps: Promise<unknown>[] = [
    readMetadata(jobId, 'script.json') as Promise<ScriptMetadata | null>,
    readOptionalJson(getJobMetadataPath(jobId, 'topic.json')),
    readMetadata(jobId, 'status.json'),
    readMetadata(jobId, 'publish.json'),
    readMetadata(jobId, 'assets.json'),
  ];
  if (shouldInferS3Artifacts) {
    readOps.push(inferGeneratedS3Artifacts(jobId));
  }

  const [script, topic, status, publish, assets, inferredArtifacts] = await Promise.all(readOps) as [ScriptMetadata | null, unknown, unknown, unknown, unknown, typeof shouldInferS3Artifacts extends true ? Record<string, string | null> : undefined];

  if (!script) return null;

  // Reconcile with AWS execution status only for detail views.
  // Recent-job/status list hydration must stay fast and avoid per-job AWS CLI calls.
  const statusJsonRaw = status as Record<string, unknown> | null;
  const statusJson = shouldReconcileAwsExecution
    ? await reconcileJobWithAwsExecution(jobId, statusJsonRaw)
    : statusJsonRaw;

  const inferredArts = shouldInferS3Artifacts && inferredArtifacts ? inferredArtifacts : { narration: null, finalVideo: null, thumbnail: null };
  const pubData = publish as Record<string, unknown> | null;
  const topicData = topic as Record<string, unknown> | null;
  const yt = (pubData?.platforms as Record<string, unknown> | undefined)?.youtube as Record<string, unknown> | undefined;
  const assetsData = assets as Record<string, unknown> | null;
  const narration = assetsData?.narration as Record<string, unknown> | undefined;
  const finalVideo = assetsData?.finalVideo as Record<string, unknown> | undefined;
  const thumbnail = assetsData?.thumbnail as Record<string, unknown> | undefined;
  const publishVideoKey = stringValue(pubData?.videoKey) ?? stringValue(assetsData?.videoKey) ?? stringValue(statusJson?.finalVideoKey) ?? stringValue(finalVideo?.path) ?? inferredArts.finalVideo;
  const publishThumbnailKey = stringValue(pubData?.thumbnailKey) ?? stringValue(assetsData?.thumbnailKey) ?? stringValue(statusJson?.thumbnailKey) ?? stringValue(thumbnail?.path) ?? inferredArts.thumbnail;
  const hasPublishAssets = Boolean(publishVideoKey && publishThumbnailKey);
  const normalizedStatus = hasPublishAssets && statusJson?.status !== 'failed'
    ? normalizeJobStatus(script, { ...statusJson ?? {}, status: 'complete', completedSteps: ['video_assembled', 'thumbnail_generated'] }, publish)
    : normalizeJobStatus(script, statusJson, publish);
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
      narration: (narration?.path as string) || inferredArts.narration,
      finalVideo: (finalVideo?.path as string) || (statusJson?.finalVideoKey as string) || inferredArts.finalVideo,
      thumbnail: (thumbnail?.path as string) || (statusJson?.thumbnailKey as string) || inferredArts.thumbnail,
    },
    mediaSource,
    generationMode,
    videoSourceKey: stringValue(statusJson?.videoSourceKey) ?? stringValue(assetsData?.videoSourceKey) ?? stringValue(pubData?.videoSourceKey),
    audioSourceKey: stringValue(statusJson?.audioSourceKey) ?? stringValue(assetsData?.audioSourceKey) ?? stringValue(pubData?.audioSourceKey),
    clientActionId: (topicData?.clientActionId as string) || null,
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

async function buildVideoJobSummaryWithDiagnostics(jobId: string, options?: { skipS3Inference?: boolean; skipAwsReconciliation?: boolean }): Promise<
  | { job: VideoJobSummary; skipped: null }
  | { job: null; skipped: { jobId: string; reason: string } }
> {
  if (!isValidJobId(jobId)) {
    return { job: null, skipped: { jobId, reason: 'invalid job id' } };
  }

  try {
    const job = await buildVideoJobSummary(jobId, options);
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
  mapper: (item: T, index?: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      const index = nextIndex;
      nextIndex += 1;
      if (item !== undefined) {
        results.push(await mapper(item, index));
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

export async function getRecentVideoJobsResult(limit: number = 100, q?: string): Promise<RecentVideoJobsResult> {
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
  const startTime = Date.now();
  const results = await mapWithConcurrency(
    jobIds,
    RECENT_JOB_HYDRATION_CONCURRENCY,
    (jobId) => buildVideoJobSummaryWithDiagnostics(jobId, { skipS3Inference: true, skipAwsReconciliation: true }),
  );
  const durationMs = Date.now() - startTime;
  const jobs = results.flatMap(result => result.job ? [result.job] : []);
  diagnostics.skippedJobs.push(...results.flatMap(result => result.skipped ? [result.skipped] : []));
  diagnostics.hydratedJobCount = jobs.length;
  diagnostics.skippedJobCount = diagnostics.skippedJobs.length;
  (diagnostics as unknown as Record<string, unknown>).durationMs = durationMs;
  (diagnostics as unknown as Record<string, unknown>).hydrationMode = 'fast';

  const sortedJobs = jobs
    .sort((a, b) => {
      const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      return bTime - aTime;
    });

  const filteredJobs = q
    ? sortedJobs.filter((job) => {
        const term = q.toLowerCase();
        return (job.jobId ?? '').toLowerCase().includes(term)
          || (job.title ?? '').toLowerCase().includes(term)
          || (job.channelId ?? '').toLowerCase().includes(term)
          || (job.status ?? '').toLowerCase().includes(term);
      })
    : sortedJobs;

  const resultJobs = filteredJobs.slice(0, limit);

  if (jobIds.length > 0 && sortedJobs.length === 0) {
    // Don't set error if we discovered jobs but hydration failed — allow partial data
    if (!diagnostics.error) {
      diagnostics.warnings.push('Local or S3 job IDs were discovered, but every job was skipped during metadata hydration.');
    }
  } else if (diagnostics.skippedJobCount > 0) {
    diagnostics.warnings.push(`${diagnostics.skippedJobCount} discovered video job(s) were skipped during metadata hydration.`);
  }

  // Always return ok: true if we discovered jobs, even if some failed hydration
  // Partial data is better than complete failure. Diagnostics show what was skipped.
  const ok = jobIds.length > 0 || diagnostics.error === null;
  if (!ok) {
    console.error('Video orchestrator job discovery failed:', diagnostics);
  }

  return { ok, jobs: resultJobs, diagnostics };
}

export async function getRecentVideoJobs(limit: number = 20): Promise<VideoJobSummary[]> {
  const result = await getRecentVideoJobsResult(limit);
  return result.jobs;
}

export async function getVideoJob(jobId: string, options?: { skipS3Inference?: boolean; skipAwsReconciliation?: boolean }): Promise<VideoJobSummary | null> {
  return buildVideoJobSummary(jobId, options);
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

  const finalized = await finalizeAwsVideoPublishPackage(jobId);
  const [assets, resolved] = await Promise.all([
    readJobMetadataJson(jobId, 'assets.json'),
    resolvePublishableAssets(jobId),
  ]);
  const motionPlan = await readJobMetadataJson(jobId, 'motion-plan.json');

  if (finalized.ok) {
    const assetsRecord = assets as Record<string, unknown> | null;
    const result: Record<string, unknown> = {
      ...(assetsRecord ?? {}),
      publishableAssets: resolved,
      finalization: {
        finalized: finalized.finalized,
        repaired: finalized.repaired,
        missing: finalized.missing,
      },
    };

    if (finalized.media.scenePlanKey) result.scenePlanKey = finalized.media.scenePlanKey;
    if (finalized.media.narrationScriptKey) result.narrationScriptKey = finalized.media.narrationScriptKey;
    if (finalized.media.audioKey) result.audioKey = finalized.media.audioKey;
    if (finalized.media.sceneImageKeys.length > 0) result.sceneImageKeys = finalized.media.sceneImageKeys;
    if (finalized.media.overlayPlanKey) result.overlayPlanKey = finalized.media.overlayPlanKey;
    if (finalized.media.videoKey) {
      result.finalVideo = finalized.media.videoKey;
      result.videoKey = finalized.media.videoKey;
    }
    if (finalized.media.thumbnailKey) {
      result.thumbnail = finalized.media.thumbnailKey;
      result.thumbnailKey = finalized.media.thumbnailKey;
    }
    if (stringValue(assetsRecord?.generationMode)) result.generationMode = stringValue(assetsRecord?.generationMode);
    if (stringValue(assetsRecord?.videoSourceKey)) result.videoSourceKey = stringValue(assetsRecord?.videoSourceKey);
    if (stringValue(assetsRecord?.audioSourceKey)) result.audioSourceKey = stringValue(assetsRecord?.audioSourceKey);
    if (finalized.publish) result.publish = finalized.publish;
    if (finalized.review) result.review = finalized.review;
    if (finalized.youtubePackage) result.youtubePackage = finalized.youtubePackage;
    if (finalized.thumbnail) result.thumbnailJson = finalized.thumbnail;
    if (finalized.review?.media) result.reviewMedia = finalized.review.media;
    if (motionPlan) result.motionPlan = motionPlan;
    return result;
  }

  if (assets) {
    const result: Record<string, unknown> = {
      ...(assets as Record<string, unknown>),
      publishableAssets: resolved,
    };
    if (motionPlan) result.motionPlan = motionPlan;

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

    const overlayPlanKey = (assets as Record<string, unknown>)?.overlayPlanKey;
    if (typeof overlayPlanKey === 'string') {
      try {
        const overlayPlan = await readJobMetadataJson(jobId, 'overlay-plan.json');
        if (overlayPlan) result.overlayPlan = overlayPlan;
      } catch {
        // Silently fail if overlay-plan.json doesn't exist
      }
    }

    // Load publish-check.json for dry-run proof persistence
    try {
      const publishCheck = await readJobMetadataJson(jobId, 'publish-check.json');
      if (publishCheck) result.publishCheck = publishCheck;
    } catch {
      // Silently fail if publish-check.json doesn't exist
    }

    return result;
  }

  // Fall back to inferring from status and script
  const [status, script, publishCheck] = await Promise.all([
    readJobMetadataJson(jobId, 'status.json'),
    readOptionalJson(getJobMetadataPath(jobId, 'script.json')) as Promise<ScriptMetadata | null>,
    readJobMetadataJson(jobId, 'publish-check.json').catch(() => null),
  ]);

  if (!script && !status) return null;

  const statusJson = status as Record<string, unknown> | null;
  const inferred = await inferGeneratedS3Artifacts(jobId);
  const result: Record<string, unknown> = {
    jobId,
    script: (script?.scriptKey as string) || null,
    finalVideo: resolved.videoKey || (statusJson?.finalVideoKey as string) || inferred.finalVideo,
    thumbnail: resolved.thumbnailKey || (statusJson?.thumbnailKey as string) || inferred.thumbnail,
    narration: resolved.narrationKey || inferred.narration,
    publishableAssets: resolved,
  };

  if (publishCheck) result.publishCheck = publishCheck;
  if (motionPlan) result.motionPlan = motionPlan;

  return result;
}

type ThumbnailPublishableAssetsResolution = Pick<PublishableAssetsResolution, 'thumbnailKey' | 'missing' | 'expectedKeys'>;

type ThumbnailPublishableAssetsResolver = (jobId: string) => Promise<ThumbnailPublishableAssetsResolution>;

let resolveThumbnailPublishableAssets: ThumbnailPublishableAssetsResolver = resolvePublishableAssets;

export function setVideoJobThumbnailPublishableAssetsResolverForTesting(
  resolver: ThumbnailPublishableAssetsResolver | null,
): void {
  resolveThumbnailPublishableAssets = resolver ?? resolvePublishableAssets;
}

type ThumbnailBytesLoader = (localThumbnailPath: string, thumbnailKey: string) => Promise<Buffer | null>;

async function loadVideoJobThumbnailBytes(localThumbnailPath: string, thumbnailKey: string): Promise<Buffer | null> {
  try {
    return await readFile(localThumbnailPath);
  } catch {
    // Local file does not exist; fall through to S3 proxy fetch.
  }

  const { stdout } = await execFileAsync('aws', [
    's3', 'cp',
    `s3://${S3_BUCKET}/${thumbnailKey}`,
    '-',
    '--region', AWS_REGION,
    '--no-cli-pager',
  ], { timeout: S3_PUBLISH_ASSET_TIMEOUT_MS, encoding: 'buffer' as any });
  return Buffer.isBuffer(stdout) && stdout.length > 0 ? stdout : null;
}

let loadThumbnailBytes: ThumbnailBytesLoader = loadVideoJobThumbnailBytes;

export function setVideoJobThumbnailBytesLoaderForTesting(loader: ThumbnailBytesLoader | null): void {
  loadThumbnailBytes = loader ?? loadVideoJobThumbnailBytes;
}

function isSafeRequestedThumbnailKey(jobId: string, requestedThumbnailKey: string | null | undefined): requestedThumbnailKey is string {
  return Boolean(
    requestedThumbnailKey
      && requestedThumbnailKey.startsWith(`jobs/${jobId}/`)
      && !requestedThumbnailKey.split('/').includes('..')
      && !requestedThumbnailKey.includes('\\')
      && !requestedThumbnailKey.includes('\0')
      && !/[\x00-\x1f\x7f]/.test(requestedThumbnailKey)
      && !/[\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/.test(requestedThumbnailKey)
      && !/[#?&=]/.test(requestedThumbnailKey)
      && !/%(?:2f|5c)/i.test(requestedThumbnailKey)
      && /\.(?:jpe?g|png|webp)$/i.test(requestedThumbnailKey)
  );
}

export function isSafeRequestedThumbnailKeyForTesting(
  jobId: string,
  requestedThumbnailKey: string | null | undefined,
): boolean {
  return isSafeRequestedThumbnailKey(jobId, requestedThumbnailKey);
}

export async function getVideoJobThumbnail(jobId: string, requestedThumbnailKey?: string | null): Promise<{ success: false; code: string; error: string; details?: unknown } | { success: true; data: Buffer; mimeType: string }> {
  if (!isValidJobId(jobId)) {
    return { success: false, code: 'invalid_job_id', error: 'Invalid jobId' };
  }

  const resolved = await resolveThumbnailPublishableAssets(jobId);
  const safeRequestedThumbnailKey = isSafeRequestedThumbnailKey(jobId, requestedThumbnailKey)
    ? requestedThumbnailKey
    : null;
  const thumbnailKey = safeRequestedThumbnailKey ?? resolved.thumbnailKey;
  if (!thumbnailKey) {
    return {
      success: false,
      code: 'thumbnail_not_ready',
      error: 'Thumbnail is not ready because the publish package is incomplete.',
      details: { jobId, missing: resolved.missing, expectedKeys: resolved.expectedKeys },
    };
  }

  const thumbnailMimeType = /\.png$/i.test(thumbnailKey)
    ? 'image/png'
    : /\.webp$/i.test(thumbnailKey)
      ? 'image/webp'
      : 'image/jpeg';
  const localThumbnailPath = join(getVideoOrchestratorRoot(), thumbnailKey);
  try {
    const data = await loadThumbnailBytes(localThumbnailPath, thumbnailKey);
    if (data) {
      return { success: true, data, mimeType: thumbnailMimeType };
    }
  } catch (error) {
    return {
      success: false,
      code: 'thumbnail_fetch_failed',
      error: error instanceof Error ? error.message : 'Thumbnail could not be loaded from local storage or S3.',
      details: { jobId, thumbnailKey, localPath: localThumbnailPath, bucket: S3_BUCKET, region: AWS_REGION },
    };
  }

  return {
    success: false,
    code: 'thumbnail_empty',
    error: 'Thumbnail loaded from S3 but no image bytes were returned.',
    details: { jobId, thumbnailKey },
  };
}

export async function resolveDownloadableVideo(jobId: string): Promise<ResolveDownloadableVideoResult> {
  return resolveVideoKeyForDownload(jobId);
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
  const [script, statusJson, assetsJson, youtubePackageJson] = await Promise.all([
    readJobMetadataJson(jobId, 'script.json') as Promise<ScriptMetadata | null>,
    readJobMetadataJson(jobId, 'status.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'assets.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'youtube-package.json') as Promise<Record<string, unknown> | null>,
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
    title: stringValue(youtubePackageJson?.title) ?? ((mediaSource === 'fixture' || mediaSource === 'hybrid' || generationMode === 'hybrid_tts_fixture_video')
      ? fixtureTitle(stringValue(publishJson?.title) ?? script?.title ?? '')
      : stringValue(publishJson?.title) ?? script?.title ?? ''),
    description: stringValue(youtubePackageJson?.description) ?? stringValue(publishJson?.description) ?? '',
    tags: stringArray(youtubePackageJson?.tags) ?? stringArray(publishJson?.tags),
    videoKey: resolved.videoKey,
    thumbnailKey: resolved.thumbnailKey,
    mediaSource,
    generationMode,
    videoSourceKey,
    audioSourceKey,
    youtubePackageKey: stringValue(publishJson?.youtubePackageKey) ?? `jobs/${jobId}/metadata/youtube-package.json`,
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

  // Read metadata in parallel to infer generation mode early
  const [publishJson_initial, statusJson_initial, assetsJson_initial] = await Promise.all([
    readJobMetadataJson(jobId, 'publish.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'status.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'assets.json') as Promise<Record<string, unknown> | null>,
  ]);

  if (!options.dryRun) {
    const requiredConfirmation = 'PUBLISH TO YOUTUBE';
    if (options.confirmation?.trim() !== requiredConfirmation) {
      return {
        ok: false,
        jobId,
        dryRun: false,
        code: 'publish_confirmation_required',
        error: `Live YouTube publish requires exact confirmation: ${requiredConfirmation}`,
      };
    }

    if (publishJson_initial?.dryRunPassed !== true) {
      return {
        ok: false,
        jobId,
        dryRun: false,
        code: 'publish_dry_run_required',
        error: 'A successful YouTube dry-run is required before live publish.',
      };
    }
  }

  // Infer generation mode early for early review gate
  const generationMode_early = inferGenerationModeForPublishGate({
    publishJson: publishJson_initial,
    statusJson: statusJson_initial,
    assetsJson: assetsJson_initial,
  });

  // For generated-media jobs: check review gate BEFORE expensive asset resolution
  if (shouldRequireReviewGate(generationMode_early)) {
    // Dry-run: lightweight check (read only), skip expensive finalization in getOrCreateReview
    const review = options.dryRun ? await readReviewJson(jobId) : await getOrCreateReview(jobId);
    if (!review || review.reviewStatus !== 'approved') {
      const reviewStatus = review?.reviewStatus ?? 'pending';
      return {
        ok: false,
        jobId,
        dryRun: options.dryRun,
        code: 'publish_review_required',
        error: 'Generated media must be reviewed before YouTube publish.',
        reviewStatus,
        details: {
          reviewKey: `jobs/${jobId}/metadata/review.json`,
        },
      };
    }
  }

  // Dry-run fast path: skip heavy finalization/resolution, validate only publish-critical keys
  if (options.dryRun) {
    const canonicalVideoKey = `jobs/${jobId}/exports/generated-001-final.mp4`;
    const canonicalThumbnailKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;
    const [videoExists, thumbExists] = await Promise.all([
      fileExists(join(getVideoOrchestratorRoot(), canonicalVideoKey)).then(ok => ok || checkS3ObjectExists(S3_BUCKET, canonicalVideoKey, AWS_REGION)),
      fileExists(join(getVideoOrchestratorRoot(), canonicalThumbnailKey)).then(ok => ok || checkS3ObjectExists(S3_BUCKET, canonicalThumbnailKey, AWS_REGION)),
    ]);
    const dryRunMissing: string[] = [];
    if (!videoExists) dryRunMissing.push(canonicalVideoKey);
    if (!thumbExists) dryRunMissing.push(canonicalThumbnailKey);
    if (dryRunMissing.length > 0) {
      return {
        ok: false,
        jobId,
        dryRun: true,
        code: 'publish_assets_missing',
        error: `Dry-run validation failed: missing ${dryRunMissing.join(', ')}`,
        details: { missing: dryRunMissing },
      };
    }
    // Publish metadata: read existing or use initial
    let publishJson = publishJson_initial ?? {};
    if (!publishJson.videoKey) publishJson = { ...publishJson, videoKey: canonicalVideoKey, thumbnailKey: canonicalThumbnailKey };
    const generationMode = typeof publishJson.generationMode === 'string' ? publishJson.generationMode : null;

    if (isGeneratedMediaGenerationMode(generationMode)) {
      const assetValidation = validateGeneratedMediaPublishAssets({
        generationMode,
        videoKey: canonicalVideoKey,
        thumbnailKey: canonicalThumbnailKey,
        jobId,
      });
      if (!assetValidation.valid) {
        return {
          ok: false,
          jobId,
          dryRun: true,
          code: 'generated_media_publish_assets_invalid',
          error: `Generated-media mode requires valid generated assets: ${assetValidation.reason}`,
          details: { generationMode, videoKey: canonicalVideoKey, thumbnailKey: canonicalThumbnailKey, reason: assetValidation.reason },
        };
      }
    }

    const platforms = publishJson.platforms as Record<string, unknown> | undefined;
    const youtube = platforms?.youtube as Record<string, unknown> | undefined;
    const existingVideoId = typeof youtube?.videoId === 'string' ? youtube.videoId : null;
    const youtubeStatus = typeof youtube?.status === 'string' ? youtube.status : null;
    if (existingVideoId || youtubeStatus === 'uploaded' || youtubeStatus === 'published') {
      return { ok: false, jobId, dryRun: true, code: 'already_uploaded', error: 'YouTube upload already exists for this job', videoId: existingVideoId, url: typeof youtube?.url === 'string' ? youtube.url : null };
    }

    // For approved-video-* jobs, publish.json may not yet exist in S3 (the upload script requires it).
    // Initialize it with a minimal pending record before calling the script.
    if (!publishJson.videoKey) {
      const initialPublish = {
        jobId,
        publishStatus: 'pending',
        videoKey: canonicalVideoKey,
        thumbnailKey: canonicalThumbnailKey,
        platforms: {},
        createdAt: new Date().toISOString(),
      };
      try {
        const metadataDir = join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata');
        await mkdir(metadataDir, { recursive: true });
        await writeFile(join(metadataDir, 'publish.json'), `${JSON.stringify(initialPublish, null, 2)}\n`, 'utf-8');
        await writeS3MetadataJson(jobId, 'publish.json', initialPublish as unknown as Record<string, unknown>);
      } catch (_) { /* non-fatal: script will fail cleanly if S3 write fails */ }
    }

    const scriptPath = join(getVideoOrchestratorRoot(), 'scripts', 'youtube-upload-local.sh');
    const args = [scriptPath, jobId, '--dry-run'];
    const dryRunStartedAt = new Date().toISOString();
    try {
      const publishCheckRunning: PublishCheckMetadata = {
        jobId,
        youtubeDryRun: { status: 'running', startedAt: dryRunStartedAt, checkedBy: 'brain-console', videoKey: canonicalVideoKey, thumbnailKey: canonicalThumbnailKey },
        dryRunPassed: false,
      };
      await writePublishCheckJson(jobId, publishCheckRunning);
    } catch (_) { /* non-fatal */ }

    try {
      const { stdout, stderr } = await execFileAsync('bash', args, { timeout: 30000 });
      const now = new Date().toISOString();
      const publishCheckPassed: PublishCheckMetadata = {
        jobId,
        youtubeDryRun: { status: 'passed', startedAt: dryRunStartedAt, checkedAt: now, checkedBy: 'brain-console', privacy: 'private', videoKey: canonicalVideoKey, thumbnailKey: canonicalThumbnailKey },
        dryRunPassed: true,
      };
      await writePublishCheckJson(jobId, publishCheckPassed);
      return { ok: true, jobId, dryRun: true, videoId: null, url: null, stdout: stdout.slice(-4000), stderr: stderr.slice(-2000) };
    } catch (scriptError: any) {
      const now = new Date().toISOString();
      const publishCheckFailed: PublishCheckMetadata = {
        jobId,
        youtubeDryRun: { status: 'failed', startedAt: dryRunStartedAt, checkedAt: now, checkedBy: 'brain-console', videoKey: canonicalVideoKey, thumbnailKey: canonicalThumbnailKey },
        dryRunPassed: false,
      };
      await writePublishCheckJson(jobId, publishCheckFailed).catch(() => {});
      return { ok: false, jobId, dryRun: true, code: 'dry_run_script_failed', error: scriptError.message ?? 'Dry-run script failed', details: { stderr: scriptError.stderr?.slice?.(-2000) ?? '' } };
    }
  }

  const finalized = await finalizeAwsVideoPublishPackage(jobId);
  if (!finalized.ok) {
    return {
      ok: false,
      jobId,
      dryRun: options.dryRun,
      code: finalized.code,
      error: finalized.error,
      details: {
        missing: finalized.missing,
        ...(finalized.details ?? {}),
      },
    };
  }

  // Now resolve assets (expensive operation)
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

  // Repair and get final generation mode
  let publishJson = await repairPublishJson(jobId, publishJson_initial, resolved);
  const generationMode = typeof publishJson.generationMode === 'string' ? publishJson.generationMode : null;

  // Validate generated-media mode assets: ensure video/thumbnail don't point to fixture
  if (isGeneratedMediaGenerationMode(generationMode)) {
    const assetValidation = validateGeneratedMediaPublishAssets({
      generationMode,
      videoKey: resolved.videoKey,
      thumbnailKey: resolved.thumbnailKey,
      jobId,
    });
    if (!assetValidation.valid) {
      return {
        ok: false,
        jobId,
        dryRun: options.dryRun,
        code: 'generated_media_publish_assets_invalid',
        error: `Generated-media mode requires valid generated assets: ${assetValidation.reason}`,
        details: {
          jobId,
          generationMode,
          videoKey: resolved.videoKey,
          thumbnailKey: resolved.thumbnailKey,
          reason: assetValidation.reason,
        },
      };
    }
  }

  // For non-generated-media jobs (or if generation mode couldn't be determined earlier),
  // check review gate now (this is a safety net, but for generated-media already checked above)
  if (shouldRequireReviewGate(generationMode) && generationMode !== generationMode_early) {
    const review = await getOrCreateReview(jobId);
    if (!review || review.reviewStatus !== 'approved') {
      const reviewStatus = review?.reviewStatus ?? 'pending';
      return {
        ok: false,
        jobId,
        dryRun: options.dryRun,
        code: 'publish_review_required',
        error: 'Generated media must be reviewed before YouTube publish.',
        reviewStatus,
        details: {
          reviewKey: `jobs/${jobId}/metadata/review.json`,
        },
      };
    }
  }

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

  // For dry-run: write "running" state before starting the long-running operation
  const dryRunStartedAt = new Date().toISOString();
  if (options.dryRun) {
    try {
      const publishCheckRunning: PublishCheckMetadata = {
        jobId,
        youtubeDryRun: {
          status: 'running',
          startedAt: dryRunStartedAt,
          checkedBy: 'brain-console',
          videoKey: resolved.videoKey,
          thumbnailKey: resolved.thumbnailKey,
        },
        dryRunPassed: false,
      };
      await writePublishCheckJson(jobId, publishCheckRunning);
    } catch (writeError) {
      console.warn(`[runControlledYouTubePublish] Warning: Failed to write publish-check.json with 'running' status for ${jobId}:`, writeError);
      // Don't fail the dry-run if we can't write state — proceed anyway
    }
  }

  try {
    const { stdout, stderr } = await execFileAsync('bash', args, { timeout: options.dryRun ? 30000 : 1800000 });
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

    // PERSISTENCE: On successful dry-run, write publish-check.json with passed status
    if (options.dryRun && result.ok) {
      const now = new Date().toISOString();

      // Write publish-check.json with dry-run proof
      const publishCheckPassed: PublishCheckMetadata = {
        jobId,
        youtubeDryRun: {
          status: 'passed',
          startedAt: dryRunStartedAt,
          checkedAt: now,
          checkedBy: 'brain-console',
          privacy: 'private',
          videoKey: resolved.videoKey,
          thumbnailKey: resolved.thumbnailKey,
        },
        dryRunPassed: true,
      };

      try {
        await writePublishCheckJson(jobId, publishCheckPassed);
      } catch (writeError) {
        // Log but don't fail the dry-run if write fails
        console.warn(`[runControlledYouTubePublish] Warning: Failed to persist publish-check.json for ${jobId}:`, writeError);
      }

      // Mirror dryRunPassed into publish.json if it exists
      if (updatedPublishJson) {
        try {
          const updatedPublish = {
            ...updatedPublishJson,
            dryRunPassed: true,
            dryRunCheckedAt: now,
            dryRunCheckedBy: 'brain-console',
          };

          const publishJsonPath = getJobMetadataPath(jobId, 'publish.json');
          await writeFile(publishJsonPath, `${JSON.stringify(updatedPublish, null, 2)}\n`, 'utf-8');

          // Write to S3
          await writeS3MetadataJson(jobId, 'publish.json', updatedPublish);
        } catch (publishUpdateError) {
          console.warn(`[runControlledYouTubePublish] Warning: Failed to update publish.json with dryRunPassed for ${jobId}:`, publishUpdateError);
        }
      }

      // Include dryRunPassed in response for frontend
      result.dryRunPassed = true;
      result.dryRunCheckedAt = now;
    }

    return result;
  } catch (error) {
    const outputError = error as Error & { stdout?: string; stderr?: string };
    const quotaExceeded = classifyYouTubeQuotaError(`${outputError.message}\n${outputError.stdout ?? ''}\n${outputError.stderr ?? ''}`);

    // On dry-run failure, write failed state to persist across refresh
    if (options.dryRun) {
      try {
        const now = new Date().toISOString();
        const publishCheckFailed: PublishCheckMetadata = {
          jobId,
          youtubeDryRun: {
            status: 'failed',
            startedAt: dryRunStartedAt,
            checkedAt: now,
            checkedBy: 'brain-console',
            error: outputError.message.slice(-500),
            code: 'youtube_upload_script_failed',
          },
          dryRunPassed: false,
        };
        await writePublishCheckJson(jobId, publishCheckFailed);
      } catch (writeError) {
        console.warn(`[runControlledYouTubePublish] Warning: Failed to write publish-check.json with 'failed' status for ${jobId}:`, writeError);
      }
    }

    if (!options.dryRun && quotaExceeded) {
      try {
        const now = new Date().toISOString();
        const publishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;
        const publishPlatforms = publishJson?.platforms && typeof publishJson.platforms === 'object'
          ? publishJson.platforms as Record<string, unknown>
          : {};
        const publishYoutube = publishPlatforms.youtube && typeof publishPlatforms.youtube === 'object'
          ? publishPlatforms.youtube as Record<string, unknown>
          : {};
        const youtubeUpload = publishJson?.youtubeUpload && typeof publishJson.youtubeUpload === 'object'
          ? publishJson.youtubeUpload as Record<string, unknown>
          : {};
        const updatedPublish = publishJson ? {
          ...publishJson,
          publishStatus: 'pending',
          updatedAt: now,
          youtubeUpload: {
            ...youtubeUpload,
            status: 'quota_exceeded',
            checkedAt: now,
            errorCode: 'youtube_quota_exceeded',
            message: 'YouTube upload quota reached. The video is ready; download the MP4 or try private publish again after quota resets.',
            videoKey: stringValue(publishJson.videoKey) ?? null,
            thumbnailKey: stringValue(publishJson.thumbnailKey) ?? null,
          },
          platforms: {
            ...publishPlatforms,
            youtube: {
              ...publishYoutube,
              status: 'quota_exceeded',
              error: 'youtube_quota_exceeded',
            },
          },
        } : null;
        if (updatedPublish) {
          await writeFile(getJobMetadataPath(jobId, 'publish.json'), `${JSON.stringify(updatedPublish, null, 2)}\n`, 'utf-8');
          await writeFile(getJobPublishingPath(jobId), `${JSON.stringify(updatedPublish, null, 2)}\n`, 'utf-8');
          await writeS3MetadataJson(jobId, 'publish.json', updatedPublish);
        }
      } catch (writeError) {
        console.warn(`[runControlledYouTubePublish] Warning: Failed to persist quota-exceeded publish metadata for ${jobId}:`, writeError);
      }
    }

    const result: ControlledYouTubePublishResult = {
      ok: false,
      jobId,
      dryRun: options.dryRun,
      code: quotaExceeded ? 'youtube_quota_exceeded' : 'youtube_upload_script_failed',
      error: outputError.message.slice(-2000),
    };
    if (typeof outputError.stdout === 'string') result.stdout = outputError.stdout.slice(-4000);
    if (typeof outputError.stderr === 'string') result.stderr = outputError.stderr.slice(-4000);
    return result;
  }
}

export async function getVideoJobExecutionStatus(jobId: string, skipAwsCheck: boolean = false): Promise<VideoJobExecutionStatus | null> {
  if (!isValidJobId(jobId)) return null;

  // Verify job exists by checking script.json, matching getVideoJob's requirement
  const script = await readOptionalJson(getJobMetadataPath(jobId, 'script.json')) as Record<string, unknown> | null;
  if (!script) return null;

  const status = await readJobMetadataJson(jobId, 'status.json') as Record<string, unknown> | null;
  const executionArn = typeof status?.executionArn === 'string' ? status.executionArn : null;
  const base: VideoJobExecutionStatus = {
    jobId,
    executionArn,
    awsStatus: null,
    startDate: null,
    stopDate: null,
    error: null,
    cause: null,
    redriveStatus: null,
    localStatus: typeof status?.status === 'string' ? status.status : 'pending',
    localStep: typeof status?.currentStep === 'string' ? status.currentStep : null,
    checkedAt: new Date().toISOString(),
  };

  if (!executionArn || skipAwsCheck) return base;

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
    const awsError = typeof parsed.error === 'string' ? parsed.error : null;
    const awsCause = typeof parsed.cause === 'string' ? parsed.cause : null;

    // If AWS execution failed, update local status to reflect that
    if (awsStatus === 'FAILED') {
      return {
        ...base,
        awsStatus,
        startDate: typeof parsed.startDate === 'string' ? parsed.startDate : null,
        stopDate: typeof parsed.stopDate === 'string' ? parsed.stopDate : null,
        error: awsError,
        cause: awsCause,
        redriveStatus: typeof parsed.redriveStatus === 'string' ? parsed.redriveStatus : null,
        localStatus: 'failed',
        localStep: awsError && awsCause ? `${awsError}: ${awsCause}` : 'aws_execution_failed',
      };
    }

    // If AWS execution succeeded, check for generated assets and repair canonical metadata.
    const inferred = awsStatus === 'SUCCEEDED' ? await inferGeneratedS3Artifacts(jobId) : null;
    const hasPublishAssets = Boolean(inferred?.finalVideo && inferred?.thumbnail);
    if (awsStatus === 'SUCCEEDED') {
      await finalizeAwsVideoPublishPackage(jobId);
    }
    return {
      ...base,
      awsStatus,
      startDate: typeof parsed.startDate === 'string' ? parsed.startDate : null,
      stopDate: typeof parsed.stopDate === 'string' ? parsed.stopDate : null,
      error: awsError,
      cause: awsCause,
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

function getJobReviewPath(jobId: string): string {
  return getJobMetadataPath(jobId, 'review.json');
}

async function readOptionalJson(path: string): Promise<unknown | null> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Delegated to imported helper video-orchestrator-publish-gate.ts
// function isGeneratedMediaGenerationMode(generationMode: string | null | undefined): boolean {
//   return generationMode === 'hybrid_storyboard_fixture_video'
//     || generationMode === 'hybrid_slideshow_video'
//     || generationMode === 'hybrid_image_slideshow_video';
// }

async function hydrateVideoReviewMedia(
  jobId: string,
  assetsJson?: Record<string, unknown> | null,
  publishJson?: Record<string, unknown> | null,
  thumbnailJson?: Record<string, unknown> | null,
  youtubePackageJson?: Record<string, unknown> | null,
): Promise<VideoReviewMedia> {
  // Load sources if not provided. Prefer the normal S3-first reader, but also
  // fall back to local metadata explicitly so review hydration still works
  // while local Brain Core has fresher artifacts than S3 or S3 checks are slow.
  const readMetadata = async (
    fileName: string,
    provided?: Record<string, unknown> | null,
  ): Promise<Record<string, unknown> | null> => {
    const remoteOrProvided = provided ?? await readJobMetadataJson(jobId, fileName) as Record<string, unknown> | null;
    const local = await readLocalJobMetadataJson(jobId, fileName) as Record<string, unknown> | null;

    // Local Brain Core is the source of truth during active dev runs. S3 can lag
    // or retain an early placeholder review/assets object, so merge local over
    // the provided/S3 value instead of treating any non-null S3 object as final.
    if (remoteOrProvided && local) return { ...remoteOrProvided, ...local };
    return local ?? remoteOrProvided;
  };
  const assets = await readMetadata('assets.json', assetsJson);
  const publish = await readMetadata('publish.json', publishJson);
  const thumbnail = await readMetadata('thumbnail.json', thumbnailJson);
  const youtubePackage = await readMetadata('youtube-package.json', youtubePackageJson);
  const resolved = await resolvePublishableAssets(jobId);

  const localObjectExists = async (key: string): Promise<boolean> => {
    const prefix = `jobs/${jobId}/`;
    if (!key.startsWith(prefix)) return false;
    return fileExists(join(getVideoOrchestratorRoot(), key));
  };
  const objectExists = async (key: string): Promise<boolean> => {
    return await localObjectExists(key) || await checkS3ObjectExists(S3_BUCKET, key, AWS_REGION);
  };

  // Canonical resolution: prefer explicit values, verify canonical paths exist before using
  let scenePlanKey = stringValue(publish?.scenePlanKey) ?? stringValue(assets?.scenePlanKey) ?? null;
  if (!scenePlanKey) {
    const canonical = `jobs/${jobId}/metadata/scene-plan.json`;
    if (await objectExists(canonical)) {
      scenePlanKey = canonical;
    }
  }

  let narrationScriptKey = stringValue(publish?.narrationScriptKey) ?? stringValue(assets?.narrationScriptKey) ?? null;
  if (!narrationScriptKey) {
    const canonical = `jobs/${jobId}/audio/narration-script.txt`;
    if (await objectExists(canonical)) {
      narrationScriptKey = canonical;
    }
  }

  let audioKey = stringValue(publish?.audioKey) ?? stringValue(assets?.audioKey) ?? stringValue((assets?.narration as Record<string, unknown> | undefined)?.path) ?? stringValue(assets?.narrationKey) ?? null;
  if (!audioKey) {
    const canonical = `jobs/${jobId}/audio/narration.mp3`;
    if (await objectExists(canonical)) {
      audioKey = canonical;
    }
  }

  // Scene images: prefer assetsJson, then storyboard manifest, then local/S3 canonical scene image.
  let sceneImageKeys = Array.isArray(assets?.sceneImageKeys)
    ? (assets.sceneImageKeys as unknown[]).filter((item): item is string => typeof item === 'string')
    : [];
  if (sceneImageKeys.length === 0) {
    const storyboard = await readMetadata('storyboard.json');
    const scenes = Array.isArray(storyboard?.scenes) ? storyboard.scenes as Record<string, unknown>[] : [];
    sceneImageKeys = scenes.map((scene) => stringValue(scene.imageKey)).filter((key): key is string => Boolean(key));
  }
  if (sceneImageKeys.length === 0) {
    const png = `jobs/${jobId}/images/scene-001.png`;
    const jpg = `jobs/${jobId}/images/scene-001.jpg`;
    if (await objectExists(png)) sceneImageKeys = [png];
    else if (await objectExists(jpg)) sceneImageKeys = [jpg];
  }

  // Video: prefer explicit, then resolved, then generated paths
  let videoKey = stringValue(publish?.videoKey) ?? resolved.videoKey ?? stringValue(assets?.videoKey) ?? stringValue(assets?.videoSourceKey) ?? null;
  if (!videoKey) {
    const canonical = `jobs/${jobId}/exports/generated-001-final.mp4`;
    if (await objectExists(canonical)) {
      videoKey = canonical;
    }
  }

  // Thumbnail: prefer explicit, then resolved paths
  let thumbnailKey = stringValue(thumbnail?.thumbnailKey) ?? stringValue(publish?.thumbnailKey) ?? resolved.thumbnailKey ?? null;
  if (!thumbnailKey) {
    const canonical = `jobs/${jobId}/exports/thumbnail-001.jpg`;
    if (await objectExists(canonical)) {
      thumbnailKey = canonical;
    }
  }

  // Publish JSON: only if it exists
  let publishKey = null;
  const canonicalPublishKey = `jobs/${jobId}/metadata/publish.json`;
  if (publish || await objectExists(canonicalPublishKey)) {
    publishKey = canonicalPublishKey;
  }

  // YouTube package: only if it exists
  let youtubePackageKey = null;
  const canonicalYoutubePackageKey = `jobs/${jobId}/metadata/youtube-package.json`;
  if (youtubePackage || await objectExists(canonicalYoutubePackageKey)) {
    youtubePackageKey = canonicalYoutubePackageKey;
  }

  let overlayPlanKey: string | null = stringValue(assets?.overlayPlanKey);
  if (!overlayPlanKey && stringValue(assets?.generationMode) === 'hybrid_image_slideshow_video') {
    const canonicalOverlayPlanKey = `jobs/${jobId}/metadata/overlay-plan.json`;
    if (await objectExists(canonicalOverlayPlanKey)) {
      overlayPlanKey = canonicalOverlayPlanKey;
    }
  }

  return {
    scenePlanKey,
    narrationScriptKey,
    audioKey,
    sceneImageKeys,
    videoKey,
    thumbnailKey,
    publishKey,
    youtubePackageKey,
    overlayPlanKey,
  };
}

async function checkS3ObjectExists(bucket: string, key: string, region: string): Promise<boolean> {
  try {
    await execFileAsync('aws', ['s3api', 'head-object', '--bucket', bucket, '--key', key, '--region', region], {
      timeout: S3_HEAD_TIMEOUT_MS,
    });
    return true;
  } catch {
    return false;
  }
}

async function writeReviewJson(jobId: string, review: VideoReviewMetadata): Promise<void> {
  const content = `${JSON.stringify(review, null, 2)}\n`;
  const metadataDir = join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata');
  await mkdir(metadataDir, { recursive: true });
  await Promise.all([
    writeFile(getJobReviewPath(jobId), content, 'utf-8'),
    writeS3MetadataJson(jobId, 'review.json', review as unknown as Record<string, unknown>),
  ]);
}

interface PublishCheckMetadata {
  jobId: string;
  youtubeDryRun: {
    status: 'running' | 'passed' | 'failed';
    startedAt?: string;
    checkedAt?: string;
    checkedBy?: string;
    videoKey?: string;
    thumbnailKey?: string;
    privacy?: string;
    error?: string;
    code?: string;
  };
  dryRunPassed: boolean;
}

async function writePublishCheckJson(jobId: string, publishCheck: PublishCheckMetadata): Promise<void> {
  const content = `${JSON.stringify(publishCheck, null, 2)}\n`;
  const metadataDir = join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata');
  await mkdir(metadataDir, { recursive: true });
  const publishCheckPath = join(metadataDir, 'publish-check.json');
  await Promise.all([
    writeFile(publishCheckPath, content, 'utf-8'),
    writeS3MetadataJson(jobId, 'publish-check.json', publishCheck as unknown as Record<string, unknown>),
  ]);
}

export async function checkPublishAssetsAvailable(jobId: string, localOnly: boolean = false): Promise<boolean> {
  const videoKey = `jobs/${jobId}/exports/generated-001-final.mp4`;
  const thumbnailKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;
  const root = getVideoOrchestratorRoot();
  const [videoLocal, thumbLocal] = await Promise.all([
    fileExists(join(root, videoKey)),
    fileExists(join(root, thumbnailKey)),
  ]);
  if (videoLocal && thumbLocal) return true;
  if (localOnly) return false;
  const [videoS3, thumbS3] = await Promise.all([
    videoLocal ? Promise.resolve(true) : checkS3ObjectExists(S3_BUCKET, videoKey, AWS_REGION),
    thumbLocal ? Promise.resolve(true) : checkS3ObjectExists(S3_BUCKET, thumbnailKey, AWS_REGION),
  ]);
  return videoS3 && thumbS3;
}

export async function readPublishCheckStatus(jobId: string): Promise<PublishCheckMetadata | null> {
  const raw = await readLocalJobMetadataJson(jobId, 'publish-check.json');
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record.dryRunPassed !== 'boolean') return null;
  return record as unknown as PublishCheckMetadata;
}

function parseReviewRecord(value: unknown, jobId: string): VideoReviewMetadata | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const media = record.media && typeof record.media === 'object' ? record.media as Record<string, unknown> : {};
  return {
    jobId,
    reviewStatus: record.reviewStatus === 'approved' || record.reviewStatus === 'changes_requested' ? record.reviewStatus : 'pending',
    createdAt: stringValue(record.createdAt) ?? new Date().toISOString(),
    updatedAt: stringValue(record.updatedAt) ?? new Date().toISOString(),
    reviewedAt: stringValue(record.reviewedAt),
    reviewedBy: stringValue(record.reviewedBy),
    notes: stringValue(record.notes),
    media: {
      scenePlanKey: stringValue(media.scenePlanKey),
      narrationScriptKey: stringValue(media.narrationScriptKey),
      audioKey: stringValue(media.audioKey),
      sceneImageKeys: Array.isArray(media.sceneImageKeys) ? media.sceneImageKeys.filter((item): item is string => typeof item === 'string') : [],
      videoKey: stringValue(media.videoKey),
      thumbnailKey: stringValue(media.thumbnailKey),
      publishKey: stringValue(media.publishKey),
      youtubePackageKey: stringValue(media.youtubePackageKey),
      overlayPlanKey: stringValue(media.overlayPlanKey),
    },
  };
}

export function mergeReviewMetadata(local: VideoReviewMetadata | null, remote: VideoReviewMetadata | null, jobId: string): VideoReviewMetadata | null {
  // If both exist, merge with approval state winning from whichever is approved
  if (local && remote) {
    const localApproved = ['approved', 'changes_requested'].includes(local.reviewStatus);
    const remoteApproved = ['approved', 'changes_requested'].includes(remote.reviewStatus);

    // If local is approved and remote is pending, use local (local state is fresher)
    if (localApproved && !remoteApproved) {
      return {
        ...local,
        updatedAt: new Date().toISOString(),
        media: {
          ...local.media,
          // Merge media from remote if it has better data
          ...Object.fromEntries(
            Object.entries(remote.media).filter(([_, v]) => v !== null && (local.media[_ as keyof VideoReviewMedia] === null || !local.media[_ as keyof VideoReviewMedia]))
          ) as Partial<VideoReviewMedia>,
        },
      };
    }
    // If remote is approved and local is pending, use remote (primary)
    if (remoteApproved && !localApproved) {
      return {
        ...remote,
        updatedAt: new Date().toISOString(),
      };
    }
    // If both approved, merge media from both
    if (localApproved && remoteApproved) {
      return {
        ...local,
        updatedAt: new Date().toISOString(),
        reviewStatus: local.reviewStatus,
        reviewedAt: local.reviewedAt || remote.reviewedAt,
        reviewedBy: local.reviewedBy || remote.reviewedBy,
        notes: local.notes || remote.notes,
        media: {
          scenePlanKey: local.media.scenePlanKey || remote.media.scenePlanKey,
          narrationScriptKey: local.media.narrationScriptKey || remote.media.narrationScriptKey,
          audioKey: local.media.audioKey || remote.media.audioKey,
          sceneImageKeys: (local.media.sceneImageKeys?.length ?? 0) >= (remote.media.sceneImageKeys?.length ?? 0) ? local.media.sceneImageKeys : remote.media.sceneImageKeys,
          videoKey: local.media.videoKey || remote.media.videoKey,
          thumbnailKey: local.media.thumbnailKey || remote.media.thumbnailKey,
          publishKey: local.media.publishKey || remote.media.publishKey,
          youtubePackageKey: local.media.youtubePackageKey || remote.media.youtubePackageKey,
          overlayPlanKey: local.media.overlayPlanKey || remote.media.overlayPlanKey,
        },
      };
    }
    // Both pending: prefer more complete media
    return {
      ...local,
      updatedAt: new Date().toISOString(),
      media: {
        scenePlanKey: local.media.scenePlanKey || remote.media.scenePlanKey,
        narrationScriptKey: local.media.narrationScriptKey || remote.media.narrationScriptKey,
        audioKey: local.media.audioKey || remote.media.audioKey,
        sceneImageKeys: (local.media.sceneImageKeys?.length ?? 0) >= (remote.media.sceneImageKeys?.length ?? 0) ? local.media.sceneImageKeys : remote.media.sceneImageKeys,
        videoKey: local.media.videoKey || remote.media.videoKey,
        thumbnailKey: local.media.thumbnailKey || remote.media.thumbnailKey,
        publishKey: local.media.publishKey || remote.media.publishKey,
        youtubePackageKey: local.media.youtubePackageKey || remote.media.youtubePackageKey,
        overlayPlanKey: local.media.overlayPlanKey || remote.media.overlayPlanKey,
      },
    };
  }
  // Return whichever exists
  return local ?? remote;
}

export interface FinalizeAwsVideoPublishPackageResult {
  ok: true;
  finalized: true;
  missing: string[];
  repaired: string[];
  media: VideoReviewMedia;
  review: VideoReviewMetadata | null;
  publish: Record<string, unknown> | null;
  youtubePackage: Record<string, unknown> | null;
  thumbnail: Record<string, unknown> | null;
  assets: Record<string, unknown> | null;
}

export interface FinalizeAwsVideoPublishPackageError {
  ok: false;
  code: 'publish_package_incomplete' | 'finalization_failed' | 'invalid_job_id';
  missing: string[];
  error: string;
  details?: Record<string, unknown>;
}

async function ensureCanonicalThumbnailMetadata(jobId: string, assetsJson: Record<string, unknown> | null): Promise<{ repaired: boolean; thumbnailJson: Record<string, unknown> | null }> {
  const canonicalKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;
  const localThumbnailPath = join(getVideoOrchestratorRoot(), canonicalKey);
  const localExists = await fileExists(localThumbnailPath);
  const s3Exists = localExists ? true : await checkS3ObjectExists(S3_BUCKET, canonicalKey, AWS_REGION);
  if (!localExists && !s3Exists) {
    const created = await createCanonicalThumbnail(jobId, assetsJson);
    if (created) {
      return { repaired: true, thumbnailJson: created as unknown as Record<string, unknown> };
    }
    return { repaired: false, thumbnailJson: null };
  }

  const existing = await readJobMetadataJson(jobId, 'thumbnail.json') as Record<string, unknown> | null;
  if (existing && stringValue(existing.thumbnailKey) === canonicalKey) {
    return { repaired: false, thumbnailJson: existing };
  }

  const repaired = existing ?? {
    jobId,
    thumbnailStatus: 'generated',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    provider: 'selected-scene-image',
    source: {
      kind: 'scene-image',
      key: Array.isArray(assetsJson?.sceneImageKeys) ? stringValue((assetsJson.sceneImageKeys as string[])[0]) : null,
    },
    thumbnailKey: canonicalKey,
    previewKey: canonicalKey,
    width: 1280,
    height: 720,
    mimeType: 'image/jpeg',
    titleOverlay: null,
    prompt: null,
    warnings: [],
  };
  await writeThumbnailMetadata(jobId, repaired as unknown as ThumbnailMetadata);
  return { repaired: true, thumbnailJson: repaired };
}

export async function finalizeAwsVideoPublishPackage(jobId: string): Promise<FinalizeAwsVideoPublishPackageResult | FinalizeAwsVideoPublishPackageError> {
  if (!isValidJobId(jobId)) {
    return {
      ok: false,
      code: 'invalid_job_id',
      error: 'Invalid jobId',
      missing: [],
    };
  }

  const [statusJson, assetsJson, publishJson, reviewJson, youtubePackageJson, thumbnailJson, scriptJson] = await Promise.all([
    readJobMetadataJson(jobId, 'status.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'assets.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'publish.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'review.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'youtube-package.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'thumbnail.json') as Promise<Record<string, unknown> | null>,
    readJobMetadataJson(jobId, 'script.json') as Promise<ScriptMetadata | null>,
  ]);

  const generationMode = stringValue(assetsJson?.generationMode) ?? stringValue(publishJson?.generationMode) ?? stringValue(statusJson?.generationMode) ?? null;
  const isHybridImageSlideshow = generationMode === 'hybrid_image_slideshow_video';
  const requiredKeys = [
    'jobs/' + jobId + '/metadata/scene-plan.json',
    'jobs/' + jobId + '/audio/narration-script.txt',
    'jobs/' + jobId + '/audio/narration.mp3',
    'jobs/' + jobId + '/metadata/assets.json',
    ...(isHybridImageSlideshow ? ['jobs/' + jobId + '/metadata/overlay-plan.json'] : []),
    'jobs/' + jobId + '/video-generated/generated-001.mp4',
    'jobs/' + jobId + '/exports/generated-001-final.mp4',
    'jobs/' + jobId + '/exports/thumbnail-001.jpg',
    'jobs/' + jobId + '/metadata/youtube-package.json',
    'jobs/' + jobId + '/metadata/publish.json',
    'jobs/' + jobId + '/metadata/review.json',
  ];

  const repairableMetadataKeys = new Set([
    `jobs/${jobId}/metadata/youtube-package.json`,
    `jobs/${jobId}/metadata/publish.json`,
    `jobs/${jobId}/metadata/review.json`,
  ]);
  const prerequisiteKeys = requiredKeys.filter((key) => !repairableMetadataKeys.has(key));
  const prerequisiteChecks = await Promise.all(prerequisiteKeys.map(async (key) => {
    const local = await fileExists(join(getVideoOrchestratorRoot(), key));
    if (local) return { key, exists: true };
    return { key, exists: await checkS3ObjectExists(S3_BUCKET, key, AWS_REGION) };
  }));
  const missingPrerequisites = prerequisiteChecks.filter((item) => !item.exists).map((item) => item.key);
  if (missingPrerequisites.length > 0) {
    return {
      ok: false,
      code: 'publish_package_incomplete',
      error: `Publish package incomplete; missing: ${missingPrerequisites.join(', ')}`,
      missing: missingPrerequisites,
      details: {
        repaired: [],
        stage: 'pre_repair_prerequisite_check',
      },
    };
  }

  const repaired: string[] = [];
  const canonicalVideoKey = `jobs/${jobId}/exports/generated-001-final.mp4`;
  const canonicalThumbnailKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;
  const canonicalYoutubePackageKey = `jobs/${jobId}/metadata/youtube-package.json`;
  const canonicalPublishKey = `jobs/${jobId}/metadata/publish.json`;
  const canonicalReviewKey = `jobs/${jobId}/metadata/review.json`;

  let thumbnailRepair = thumbnailJson;
  if (!thumbnailRepair || stringValue(thumbnailRepair.thumbnailKey) !== canonicalThumbnailKey) {
    const thumbnailResult = await ensureCanonicalThumbnailMetadata(jobId, assetsJson);
    if (thumbnailResult.thumbnailJson) {
      thumbnailRepair = thumbnailResult.thumbnailJson;
      repaired.push('thumbnail.json');
    }
  }

  let youtubePackageRepair = youtubePackageJson;
  if (!youtubePackageRepair) {
    const scenePlan = await readJobMetadataJson(jobId, 'scene-plan.json') as Record<string, unknown> | null;
    const topicTitle = stringValue((await readJobMetadataJson(jobId, 'topic.json') as Record<string, unknown> | null)?.title) ?? stringValue((scriptJson as ScriptMetadata | null)?.title) ?? 'Untitled';
    const built = buildYouTubePackage({
      jobId,
      topicTitle,
      topicDescription: stringValue((await readJobMetadataJson(jobId, 'topic.json') as Record<string, unknown> | null)?.description) ?? undefined,
      generationMode: generationMode ?? 'hybrid_image_slideshow_video',
      mediaSource: stringValue(assetsJson?.mediaSource) ?? 'hybrid',
      videoKey: stringValue(assetsJson?.videoSourceKey) ?? canonicalVideoKey,
      thumbnailKey: canonicalThumbnailKey,
      scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
      narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
      scenePlan: Array.isArray(scenePlan?.scenes) ? (scenePlan.scenes as ScenePlan['scenes']) : undefined,
    });
    youtubePackageRepair = built as unknown as Record<string, unknown>;
    await writeFile(getJobMetadataPath(jobId, 'youtube-package.json'), `${JSON.stringify(built, null, 2)}\n`, 'utf-8');
    await writeS3MetadataJson(jobId, 'youtube-package.json', built as unknown as Record<string, unknown>);
    repaired.push('youtube-package.json');
  }

  let publishRepair = publishJson;
  const needsPublishRepair = !publishRepair
    || stringValue(publishRepair.videoKey) !== canonicalVideoKey
    || stringValue(publishRepair.thumbnailKey) !== canonicalThumbnailKey
    || stringValue(publishRepair.youtubePackageKey) !== canonicalYoutubePackageKey;
  if (needsPublishRepair) {
    publishRepair = await repairPublishJson(jobId, publishRepair, {
      videoKey: canonicalVideoKey,
      thumbnailKey: canonicalThumbnailKey,
      narrationKey: stringValue(assetsJson?.audioKey) ?? stringValue(assetsJson?.audioSourceKey) ?? `jobs/${jobId}/audio/narration.mp3`,
      source: { publishJson: false, assetsJson: false, statusJson: false, inferredS3: false },
      selectedSource: { videoKey: 'inferredS3', thumbnailKey: 'inferredS3', narrationKey: 'inferredS3' },
      missing: [],
      checked: { publishJson: false, assetsJson: false, statusJson: false, inferredS3: false },
      expectedKeys: { videoKey: canonicalVideoKey, thumbnailKey: canonicalThumbnailKey, narrationKey: `jobs/${jobId}/audio/narration.mp3` },
    } as PublishableAssetsResolution);
    repaired.push('publish.json');
  }

  const assetPublishable = {
    videoKey: canonicalVideoKey,
    thumbnailKey: canonicalThumbnailKey,
    narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    missing: [],
    checked: {
      publishJson: true,
      assetsJson: true,
      statusJson: true,
      inferredS3: true,
    },
    source: {
      publishJson: true,
      assetsJson: true,
      statusJson: true,
      inferredS3: true,
    },
    selectedSource: {
      videoKey: 'inferredS3',
      thumbnailKey: 'inferredS3',
      narrationKey: 'inferredS3',
    },
    expectedKeys: {
      videoKey: canonicalVideoKey,
      thumbnailKey: canonicalThumbnailKey,
      narrationKey: `jobs/${jobId}/audio/narration.mp3`,
    },
  };
  const repairedAssets = {
    ...(assetsJson ?? {}),
    jobId,
    generationMode: generationMode ?? stringValue(assetsJson?.generationMode) ?? 'hybrid_image_slideshow_video',
    mediaSource: stringValue(assetsJson?.mediaSource) ?? 'hybrid',
    scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
    narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
    audioKey: `jobs/${jobId}/audio/narration.mp3`,
    videoSourceKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
    videoKey: canonicalVideoKey,
    finalVideo: canonicalVideoKey,
    thumbnailKey: canonicalThumbnailKey,
    overlayPlanKey: isHybridImageSlideshow ? `jobs/${jobId}/metadata/overlay-plan.json` : stringValue(assetsJson?.overlayPlanKey) ?? null,
    sceneImageKeys: Array.isArray(assetsJson?.sceneImageKeys)
      ? (assetsJson.sceneImageKeys as string[]).filter((item): item is string => typeof item === 'string')
      : [],
    publishableAssets: assetPublishable,
  };
  const needsAssetsRepair = JSON.stringify(assetsJson ?? {}) !== JSON.stringify(repairedAssets);
  if (needsAssetsRepair) {
    const content = `${JSON.stringify(repairedAssets, null, 2)}\n`;
    const metadataDir = join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata');
    await mkdir(metadataDir, { recursive: true });
    await Promise.all([
      writeFile(join(metadataDir, 'assets.json'), content, 'utf-8'),
      writeS3MetadataJson(jobId, 'assets.json', repairedAssets as Record<string, unknown>),
    ]);
    repaired.push('assets.json');
  }

  const canonicalMedia: VideoReviewMedia = {
    scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
    narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
    audioKey: `jobs/${jobId}/audio/narration.mp3`,
    sceneImageKeys: Array.isArray(assetsJson?.sceneImageKeys) ? (assetsJson.sceneImageKeys as string[]).filter((item): item is string => typeof item === 'string') : [],
    videoKey: canonicalVideoKey,
    thumbnailKey: canonicalThumbnailKey,
    publishKey: canonicalPublishKey,
    youtubePackageKey: canonicalYoutubePackageKey,
    overlayPlanKey: isHybridImageSlideshow ? `jobs/${jobId}/metadata/overlay-plan.json` : stringValue(assetsJson?.overlayPlanKey) ?? null,
  };

  let reviewRepair = reviewJson ? parseReviewRecord(reviewJson, jobId) : null;
  const approvedReview = reviewRepair?.reviewStatus === 'approved';
  const repairedReview: VideoReviewMetadata = {
    jobId,
    reviewStatus: approvedReview ? 'approved' : (reviewRepair?.reviewStatus ?? 'pending'),
    createdAt: reviewRepair?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedAt: reviewRepair?.reviewedAt ?? null,
    reviewedBy: reviewRepair?.reviewedBy ?? null,
    notes: reviewRepair?.notes ?? null,
    media: canonicalMedia,
  };

  // Write review if: (1) no review exists, or (2) media changed
  // Always preserve approval state: if previously approved, stay approved
  const mediaChanged = !reviewRepair || JSON.stringify(reviewRepair.media) !== JSON.stringify(canonicalMedia);
  if (mediaChanged) {
    await writeReviewJson(jobId, repairedReview);
    repaired.push('review.json');
    reviewRepair = repairedReview;
  }

  const finalExistenceChecks = await Promise.all(requiredKeys.map(async (key) => {
    const local = await fileExists(join(getVideoOrchestratorRoot(), key));
    if (local) return { key, exists: true };
    return { key, exists: await checkS3ObjectExists(S3_BUCKET, key, AWS_REGION) };
  }));
  const finalMissing = finalExistenceChecks.filter((item) => !item.exists).map((item) => item.key);
  if (finalMissing.length > 0) {
    return {
      ok: false,
      code: 'publish_package_incomplete',
      error: `Publish package incomplete; missing: ${finalMissing.join(', ')}`,
      missing: finalMissing,
      details: {
        repaired,
      },
    };
  }

  return {
    ok: true,
    finalized: true,
    missing: [],
    repaired,
    media: canonicalMedia,
    review: reviewRepair,
    publish: publishRepair,
    youtubePackage: youtubePackageRepair,
    thumbnail: thumbnailRepair,
    assets: assetsJson,
  };
}

async function readReviewJson(jobId: string): Promise<VideoReviewMetadata | null> {
  // Fast path: read local immediately. If approved with media, use it and skip slow S3 check.
  const localValue = await readLocalJobMetadataJson(jobId, 'review.json');
  const localReview = parseReviewRecord(localValue, jobId);

  // If local review is approved with complete media, return it immediately (don't block on S3)
  const mediaComplete = localReview && localReview.media &&
    localReview.media.videoKey && localReview.media.thumbnailKey &&
    localReview.media.sceneImageKeys && localReview.media.sceneImageKeys.length > 0;

  if (localReview?.reviewStatus === 'approved' && mediaComplete) {
    return localReview;
  }

  // Slow path: read S3 only if local is missing or pending
  // Use timeout to prevent indefinite blocking
  let remoteReview: VideoReviewMetadata | null = null;
  try {
    const remoteValue = await Promise.race([
      readS3JobMetadataJson(jobId, 'review.json'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('S3 read timeout')), 3000))
    ]);
    remoteReview = parseReviewRecord(remoteValue, jobId);
  } catch (err) {
    console.warn(`[video-review] S3 read timeout for ${jobId}, using local only`);
  }

  // Merge: never downgrade from approved to pending
  return mergeReviewMetadata(localReview, remoteReview, jobId);
}

async function getOrCreateReview(jobId: string): Promise<VideoReviewMetadata | null> {
  const finalized = await finalizeAwsVideoPublishPackage(jobId);
  if (finalized.ok && finalized.review) {
    return finalized.review;
  }

  // Read existing review FIRST (fast) to know if we need to hydrate
  const existing = await readReviewJson(jobId);

  // If existing review is approved with complete media, return immediately without hydration
  if (existing?.reviewStatus === 'approved' &&
      existing.media?.videoKey && existing.media?.thumbnailKey &&
      existing.media?.sceneImageKeys?.length) {
    return existing;
  }

  // Slow hydration path: only do expensive operations if review is missing/pending
  const publishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;
  const assetsJson = await readJobMetadataJson(jobId, 'assets.json') as Record<string, unknown> | null;
  let resolved = await resolvePublishableAssets(jobId);

  // Try to create canonical thumbnail if this is generated media with scene images
  if (assetsJson) {
    try {
      const sceneImageKeys = Array.isArray(assetsJson.sceneImageKeys)
        ? assetsJson.sceneImageKeys.filter((k): k is string => typeof k === 'string')
        : [];

      if (sceneImageKeys.length > 0) {
        // Attempt to generate the thumbnail regardless of whether key is set
        const thumbnailMeta = await createCanonicalThumbnail(jobId, assetsJson);
        if (thumbnailMeta) {
          // Update resolved to use the newly created thumbnail
          resolved.thumbnailKey = thumbnailMeta.thumbnailKey;
          await writeThumbnailMetadata(jobId, thumbnailMeta);
        }
      }
    } catch (err) {
      console.warn(`[getOrCreateReview] Failed to create canonical thumbnail for ${jobId}:`, err);
      // Continue without thumbnail - not a blocker
    }
  }

  const thumbnailJson = await readJobMetadataJson(jobId, 'thumbnail.json') as Record<string, unknown> | null;
  const youtubePackageJson = await readJobMetadataJson(jobId, 'youtube-package.json') as Record<string, unknown> | null;

  // Hydrate fresh media from canonical sources
  const hydratedMedia = await hydrateVideoReviewMedia(jobId, assetsJson, publishJson, thumbnailJson, youtubePackageJson);

  if (existing) {
    // Preserve approval state and metadata, but use freshly hydrated media
    const updated: VideoReviewMetadata = {
      ...existing,
      updatedAt: new Date().toISOString(),
      media: hydratedMedia,
    };
    const mediaChanged = JSON.stringify(updated.media) !== JSON.stringify(existing.media);

    if (!mediaChanged) return existing;

    // Persist updated review: media repairs allowed, but never downgrade approval
    try {
      await writeReviewJson(jobId, updated);
      if (existing.reviewStatus === 'approved') {
        console.log(`[video-review] preserved approved jobId=${jobId}`);
      }
    } catch (err) {
      console.warn(`[getOrCreateReview] Failed to persist review for ${jobId}:`, err);
    }
    return updated;
  }

  // No existing review - check if we have enough media to create one
  if (!hydratedMedia.videoKey && !hydratedMedia.thumbnailKey && !publishJson) return null;

  const created: VideoReviewMetadata = {
    jobId,
    reviewStatus: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
    notes: null,
    media: hydratedMedia,
  };
  try {
    await writeReviewJson(jobId, created);
  } catch (err) {
    console.warn(`[getOrCreateReview] Failed to persist review for ${jobId}:`, err);
  }
  return created;
}

// Delegated to imported helper video-orchestrator-publish-gate.ts
// function requiresReviewApproval(generationMode: string | null | undefined): boolean {
//   return isGeneratedMediaGenerationMode(generationMode);
// }

async function requireApprovedReviewForPublish(jobId: string, generationMode: string | null | undefined): Promise<VideoReviewMetadata | null> {
  if (!shouldRequireReviewGate(generationMode)) return null;
  const review = await getOrCreateReview(jobId);
  if (!review || review.reviewStatus !== 'approved') return review ?? null;
  return review;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

interface ThumbnailMetadata {
  jobId: string;
  thumbnailStatus: 'generated' | 'pending' | 'failed';
  createdAt: string;
  updatedAt: string;
  provider: 'aws-bedrock-nova-canvas' | 'selected-scene-image' | 'ffmpeg-frame';
  source: {
    kind: 'scene-image' | 'generated-image' | 'video-frame';
    key: string | null;
  };
  thumbnailKey: string;
  previewKey: string | null;
  width: number;
  height: number;
  mimeType: string;
  titleOverlay: string | null;
  prompt: string | null;
  warnings: string[];
}

interface MotionPlanMetadata {
  jobId: string;
  provider: 'local-ffmpeg-motion';
  mode: 'ken-burns';
  sceneCount: number;
  generatedClipKeys: string[];
  generatedFrameKeys: string[];
  warnings: string[];
  fallbackUsed: boolean;
  fallbackReason: string | null;
}

async function requireExecutable(name: string, code: string): Promise<string> {
  try {
    const resolved = (await execFileAsync('bash', ['-lc', `command -v ${name}`], { timeout: 10_000 })).stdout.trim();
    if (!resolved) throw new Error('not found');
    return resolved;
  } catch {
    throw new Error(code);
  }
}

export async function createMotionClipFromSceneImage(input: {
  ffmpegPath: string;
  imagePath: string;
  outputClipPath: string;
  durationSeconds: number;
  width: number;
  height: number;
  sceneIndex: number;
}): Promise<void> {
  const safeDuration = Math.max(2, Math.round(input.durationSeconds));
  const frames = Math.max(60, safeDuration * 30);
  const zoomTarget = 1.10 + (input.sceneIndex % 4) * 0.01;
  const centerX = '(iw-iw/zoom)/2';
  const centerY = '(ih-ih/zoom)/2';
  const filter = `zoompan=z='1.0+(${zoomTarget - 1.0})*on/${frames}':x='${centerX}':y='${centerY}':d=${frames}:s=${input.width}x${input.height}:fps=30,format=yuv420p`;

  await execFileAsync(input.ffmpegPath, [
    '-y',
    '-loop', '1',
    '-i', input.imagePath,
    '-t', String(safeDuration),
    '-vf', filter,
    '-an',
    input.outputClipPath,
  ], { timeout: 120_000 });
}

export async function buildDeterministicMotionLayer(input: {
  jobId: string;
  jobRoot: string;
  metadataDir: string;
  scenePlan: ScenePlan;
  sceneImageKeys: string[];
  imageGenerationSettings?: { width?: number; height?: number } | null;
}): Promise<{
  motionPlan: MotionPlanMetadata;
  motionClipKeys: string[];
  motionFrameKeys: string[];
  warnings: string[];
  fallbackUsed: boolean;
  fallbackReason: string | null;
}> {
  const warnings: string[] = [];
  const motionClipKeys: string[] = [];
  const motionFrameKeys: string[] = [];
  let fallbackUsed = false;
  let fallbackReason: string | null = null;
  const ffmpegPath = await requireExecutable('ffmpeg', 'motion_generation_not_available');
  const motionDir = join(input.jobRoot, 'motion');
  const framesDir = join(input.jobRoot, 'frames');
  await mkdir(motionDir, { recursive: true });
  await mkdir(framesDir, { recursive: true });

  const width = Number(input.imageGenerationSettings?.width ?? 1280);
  const height = Number(input.imageGenerationSettings?.height ?? 720);

  try {
    for (const [index, scene] of input.scenePlan.scenes.entries()) {
      const sceneNumber = index + 1;
      const sourceKey = input.sceneImageKeys[index] ?? `jobs/${input.jobId}/images/scene-${String(sceneNumber).padStart(3, '0')}.png`;
      const sourcePath = join(input.jobRoot, sourceKey.replace(/^jobs\/[^/]+\//, ''));
      const clipKey = `jobs/${input.jobId}/motion/scene-${String(sceneNumber).padStart(3, '0')}.mp4`;
      const clipPath = join(input.jobRoot, 'motion', `scene-${String(sceneNumber).padStart(3, '0')}.mp4`);
      if (!await fileExists(sourcePath)) {
        throw new Error(`missing source scene image: ${sourceKey}`);
      }
      await createMotionClipFromSceneImage({
        ffmpegPath,
        imagePath: sourcePath,
        outputClipPath: clipPath,
        durationSeconds: scene.durationSeconds,
        width,
        height,
        sceneIndex: index,
      });
      motionClipKeys.push(clipKey);
      motionFrameKeys.push(`jobs/${input.jobId}/frames/frame-${String(sceneNumber).padStart(3, '0')}.png`);
    }
  } catch (error) {
    fallbackUsed = true;
    fallbackReason = error instanceof Error ? error.message : String(error);
    warnings.push(`Motion generation fell back to slideshow assembly: ${fallbackReason}`);
    motionClipKeys.length = 0;
    motionFrameKeys.length = 0;
  }

  const motionPlan: MotionPlanMetadata = {
    jobId: input.jobId,
    provider: 'local-ffmpeg-motion',
    mode: 'ken-burns',
    sceneCount: input.scenePlan.scenes.length,
    generatedClipKeys: motionClipKeys,
    generatedFrameKeys: motionFrameKeys,
    warnings,
    fallbackUsed,
    fallbackReason,
  };

  await writeFile(join(input.metadataDir, 'motion-plan.json'), `${JSON.stringify(motionPlan, null, 2)}\n`, 'utf-8');
  await writeS3MetadataJson(input.jobId, 'motion-plan.json', motionPlan as unknown as Record<string, unknown>);
  return { motionPlan, motionClipKeys, motionFrameKeys, warnings, fallbackUsed, fallbackReason };
}

async function createCanonicalThumbnail(jobId: string, assetsJson: Record<string, unknown> | null): Promise<ThumbnailMetadata | null> {
  if (!assetsJson || typeof assetsJson !== 'object') {
    return null;
  }

  const now = new Date().toISOString();
  const thumbnailKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;
  const sceneImageKeys = Array.isArray(assetsJson.sceneImageKeys)
    ? assetsJson.sceneImageKeys.filter((k): k is string => typeof k === 'string')
    : [];

  // Try to use the first generated scene image
  if (sceneImageKeys.length === 0) {
    return null;
  }

  const firstSceneKey = sceneImageKeys[0];
  if (!firstSceneKey) {
    return null;
  }

  try {
    const jobRoot = getVideoOrchestratorRoot();
    const localScenePath = join(jobRoot, firstSceneKey);
    const localThumbPath = join(jobRoot, thumbnailKey);

    // Check if local scene image exists
    if (await fileExists(localScenePath)) {
      await generateThumbnailFromImage(localScenePath, localThumbPath);
      // Also try to sync to S3
      try {
        await execFileAsync('aws', [
          's3', 'cp', localThumbPath,
          `s3://${S3_BUCKET}/${thumbnailKey}`,
          '--region', AWS_REGION,
          '--no-cli-pager',
        ], { timeout: 15000 });
      } catch (s3Err) {
        console.warn(`[createCanonicalThumbnail] Failed to sync thumbnail to S3 for ${jobId}:`, s3Err);
      }

      return {
        jobId,
        thumbnailStatus: 'generated',
        createdAt: now,
        updatedAt: now,
        provider: 'aws-bedrock-nova-canvas',
        source: {
          kind: 'scene-image',
          key: firstSceneKey,
        },
        thumbnailKey,
        previewKey: thumbnailKey,
        width: 1280,
        height: 720,
        mimeType: 'image/jpeg',
        titleOverlay: null,
        prompt: null,
        warnings: [],
      };
    }
  } catch (err) {
    console.warn(`[createCanonicalThumbnail] Failed to generate thumbnail from scene image for ${jobId}:`, err);
  }

  return null;
}

async function writeThumbnailMetadata(jobId: string, metadata: ThumbnailMetadata): Promise<void> {
  const content = `${JSON.stringify(metadata, null, 2)}\n`;
  const metadataDir = join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata');
  await mkdir(metadataDir, { recursive: true });
  const thumbnailJsonPath = join(metadataDir, 'thumbnail.json');
  await writeFile(thumbnailJsonPath, content, 'utf-8');
  // Also sync to S3
  try {
    await writeS3MetadataJson(jobId, 'thumbnail.json', metadata as unknown as Record<string, unknown>);
  } catch (err) {
    console.warn(`[writeThumbnailMetadata] Failed to write thumbnail.json to S3 for ${jobId}:`, err);
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
  if (isPublishedOrUploaded(script, null, false)) {
    return {
      ok: false,
      code: 'already_published_or_uploaded',
      message: 'Script approval cannot be changed after publish/upload metadata exists.',
      jobId,
    };
  }

  const now = new Date().toISOString();
  const theologyReviewRequired = resolveTheologyReviewRequired(script, null);
  script.status = 'approved';
  script.updatedAt = now;
  script.approval = {
    ...(script.approval ?? { required: true, status: 'pending', theologicalReviewRequired: false, notes: null }),
    required: true,
    status: 'approved',
    theologicalReviewRequired: theologyReviewRequired,
    approvedBy: input.approvedBy.trim(),
    approvedAt: now,
    notes: typeof input.notes === 'string' && input.notes.trim().length > 0 ? input.notes.trim() : null,
  };

  try {
    await writeFile(scriptPath, `${JSON.stringify(script, null, 2)}\n`, 'utf-8');
  } catch {
    return { ok: false, code: 'write_failed', message: 'Failed to write script approval metadata.', jobId };
  }

  // Keep script approval on the fast local write path. Optional topic/profile
  // hydration can be slow and must not block the operator from advancing.
  return buildApprovalResponse(script, false, null);
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

export async function getVideoReview(jobId: string, skipFinalization: boolean = false): Promise<VideoReviewResponse | VideoReviewError> {
  if (!isValidJobId(jobId)) {
    return { ok: false, code: 'invalid_job_id', error: 'Invalid jobId', jobId };
  }

  // Fast path: for read-only control-plane queries, just read existing review.json from local storage
  // No S3 operations, no hydration, no finalization repairs
  if (skipFinalization) {
    const existing = await readReviewJson(jobId);
    if (existing) {
      return { ok: true, review: existing };
    }
    return { ok: false, code: 'review_not_found', error: 'Review metadata not found for job.', jobId };
  }

  // Slow path: full review resolution with finalization repairs
  // For generated-media jobs at ready_to_publish: always finalize to ensure review media is complete
  // This repairs stale review.json and aligns canonical artifacts with the review contract
  const statusJson = await readJobMetadataJson(jobId, 'status.json') as Record<string, unknown> | null;
  const assetsJson = await readJobMetadataJson(jobId, 'assets.json') as Record<string, unknown> | null;
  const publishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;

  const generationMode = stringValue(assetsJson?.generationMode) ?? stringValue(publishJson?.generationMode) ?? stringValue(statusJson?.generationMode);
  const localStatus = statusJson?.status as string | undefined;

  let finalized = null;
  if (isGeneratedMediaGenerationMode(generationMode) && (localStatus === 'complete' || localStatus === 'ready_to_publish')) {
    // Always finalize for generated-media jobs at terminal generation states
    finalized = await finalizeAwsVideoPublishPackage(jobId);
  }

  // Use finalized review if available, otherwise create fresh from canonical sources
  let review = finalized?.ok && finalized.review ? finalized.review : await getOrCreateReview(jobId);

  if (!review) {
    return { ok: false, code: 'review_not_found', error: 'Review metadata not found for job.', jobId };
  }

  if (finalized) {
    return {
      ok: true,
      review: {
        ...review,
        finalization: {
          attempted: true,
          ok: finalized.ok,
          missing: finalized.missing,
          repaired: finalized.ok ? finalized.repaired : [],
        },
      },
    };
  }

  return { ok: true, review };
}

export function getMissingReviewMediaFields(media: VideoReviewMedia): string[] {
  const missing: string[] = [];
  if (!media.scenePlanKey) missing.push('scenePlanKey');
  if (!media.narrationScriptKey) missing.push('narrationScriptKey');
  if (!media.audioKey) missing.push('audioKey');
  if (media.sceneImageKeys.length === 0) missing.push('sceneImageKeys');
  if (!media.videoKey) missing.push('videoKey');
  if (!media.thumbnailKey) missing.push('thumbnailKey');
  if (!media.publishKey) missing.push('publishKey');
  if (!media.youtubePackageKey) missing.push('youtubePackageKey');
  return missing;
}

async function getReviewOverlayBlockers(jobId: string, media: VideoReviewMedia): Promise<string[]> {
  const assetsJson = await readJobMetadataJson(jobId, 'assets.json') as Record<string, unknown> | null;
  if (stringValue(assetsJson?.generationMode) !== 'hybrid_image_slideshow_video') return [];

  const overlayPlanKey = media.overlayPlanKey ?? stringValue(assetsJson?.overlayPlanKey);
  if (!overlayPlanKey) return ['overlayPlanKey'];

  const overlayPlan = await readJobMetadataJson(jobId, 'overlay-plan.json');
  if (!overlayPlan) return ['overlay-plan.json'];
  const scrubbedOverlayPlan = {
    ...(overlayPlan as Record<string, unknown>),
    warnings: [],
  };
  if (containsInternalOverlayTerms(scrubbedOverlayPlan)) return ['overlay internal terms'];
  return [];
}

function getEssentialReviewMediaMissing(media: VideoReviewMedia): string[] {
  const missing: string[] = [];
  if (!media.scenePlanKey) missing.push('scenePlanKey');
  if (!media.narrationScriptKey) missing.push('narrationScriptKey');
  if (!media.audioKey) missing.push('audioKey');
  if (!media.videoKey) missing.push('videoKey');
  if (!media.thumbnailKey) missing.push('thumbnailKey');
  return missing;
}

export async function approveVideoReview(
  jobId: string,
  input: { reviewedBy?: unknown; notes?: unknown },
): Promise<VideoReviewResponse | VideoReviewError> {
  if (!isValidJobId(jobId)) {
    return { ok: false, code: 'invalid_job_id', error: 'Invalid jobId', jobId };
  }
  if (typeof input.reviewedBy !== 'string' || input.reviewedBy.trim().length === 0) {
    return { ok: false, code: 'invalid_body', error: 'reviewedBy is required.', jobId };
  }

  // Read existing review media first — if essential fields are already present, approval should succeed
  const existingReview = await readReviewJson(jobId);
  const existingMedia = existingReview?.media ?? null;
  const existingEssentialComplete = existingMedia && getEssentialReviewMediaMissing(existingMedia).length === 0;

  // Attempt finalization opportunistically to repair/enrich metadata
  const finalized = await finalizeAwsVideoPublishPackage(jobId);

  let mediaToApprove: VideoReviewMedia;
  if (finalized.ok) {
    mediaToApprove = finalized.media;
  } else if (existingEssentialComplete) {
    return {
      ok: false,
      code: 'review_media_incomplete',
      error: finalized.error,
      jobId,
      details: {
        missing: finalized.missing,
        ...(finalized.details ?? {}),
        reason: 'Existing review media contains keys, but finalization could not verify the actual package assets.',
      },
    };
  } else {
    return {
      ok: false,
      code: 'review_media_incomplete',
      error: finalized.error,
      jobId,
      details: { missing: finalized.missing, ...(finalized.details ?? {}) },
    };
  }

  // Only check essential media fields (aligned with control-plane approve_review.enabled logic)
  const essentialMissing = getEssentialReviewMediaMissing(mediaToApprove);
  if (essentialMissing.length > 0) {
    return {
      ok: false,
      code: 'review_media_incomplete',
      error: `Cannot approve review: missing essential media fields: ${essentialMissing.join(', ')}`,
      jobId,
      details: { missing: essentialMissing },
    } as unknown as VideoReviewError;
  }

  const overlayBlockers = await getReviewOverlayBlockers(jobId, mediaToApprove);
  if (overlayBlockers.length > 0) {
    console.warn(`[approveVideoReview] Motion layer warnings for ${jobId}: ${overlayBlockers.join(', ')} (non-blocking)`);
  }

  const current = existingReview ?? await getOrCreateReview(jobId);
  if (!current) {
    return { ok: false, code: 'review_not_found', error: 'Review metadata not found for job.', jobId };
  }

  const now = new Date().toISOString();
  const approved: VideoReviewMetadata = {
    jobId,
    reviewStatus: 'approved',
    createdAt: current.createdAt,
    updatedAt: now,
    reviewedAt: now,
    reviewedBy: input.reviewedBy.trim(),
    notes: typeof input.notes === 'string' && input.notes.trim().length > 0 ? input.notes.trim() : current.notes,
    media: mediaToApprove,
  };

  try {
    const writeStart = Date.now();
    await writeReviewJson(jobId, approved);
    const publishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;
    if (publishJson) {
      const reviewedPublishJson = {
        ...publishJson,
        publishBlocked: false,
        reviewStatus: 'approved',
        packageComplete: true,
        videoKey: mediaToApprove.videoKey,
        thumbnailKey: mediaToApprove.thumbnailKey,
        audioKey: mediaToApprove.audioKey,
        updatedAt: now,
      };
      await writeFile(join(getVideoOrchestratorRoot(), 'jobs', jobId, 'metadata', 'publish.json'), JSON.stringify(reviewedPublishJson, null, 2) + '\n', 'utf-8');
      await writeFile(join(getVideoOrchestratorRoot(), 'jobs', jobId, 'publishing', 'publish.json'), JSON.stringify(reviewedPublishJson, null, 2) + '\n', 'utf-8').catch(() => undefined);
      await writeS3MetadataJson(jobId, 'publish.json', reviewedPublishJson);
    }
    const statusPath = getJobMetadataPath(jobId, 'status.json');
    const statusJson = await readOptionalJson(statusPath) as Record<string, unknown> | null;
    const readyStatusJson = {
      ...(statusJson ?? {}),
      status: 'ready_to_publish',
      currentStep: 'ready_to_publish',
      updatedAt: now,
      reviewStatus: 'approved',
      packageComplete: true,
      finalVideoKey: mediaToApprove.videoKey,
      thumbnailKey: mediaToApprove.thumbnailKey,
    };
    await writeFile(statusPath, JSON.stringify(readyStatusJson, null, 2) + '\n', 'utf-8');
    await writeS3MetadataJson(jobId, 'status.json', readyStatusJson);
    const writeDurationMs = Date.now() - writeStart;
    console.log(`[video-review] approve persisted jobId=${jobId} durationMs=${writeDurationMs}`);
  } catch {
    return { ok: false, code: 'review_write_failed', error: 'Failed to write review metadata.', jobId };
  }

  return { ok: true, review: approved };
}

export async function requestVideoReviewChanges(
  jobId: string,
  input: { reviewedBy?: unknown; notes?: unknown },
): Promise<VideoReviewResponse | VideoReviewError> {
  if (!isValidJobId(jobId)) {
    return { ok: false, code: 'invalid_job_id', error: 'Invalid jobId', jobId };
  }
  if (typeof input.reviewedBy !== 'string' || input.reviewedBy.trim().length === 0) {
    return { ok: false, code: 'invalid_body', error: 'reviewedBy is required.', jobId };
  }

  const finalized = await finalizeAwsVideoPublishPackage(jobId);
  if (!finalized.ok) {
    return {
      ok: false,
      code: 'review_media_incomplete',
      error: finalized.error,
      jobId,
      details: { missing: finalized.missing, ...(finalized.details ?? {}) },
    };
  }

  const existingReview = await readReviewJson(jobId);
  let mediaToUse: VideoReviewMedia;

  // Fast path: if existing review media is already complete, use it directly
  if (existingReview && getMissingReviewMediaFields(existingReview.media).length === 0) {
    mediaToUse = finalized.media;
  } else {
    // Slow path: hydrate fresh media from canonical sources (only if not already complete)
    const publishJson = await readJobMetadataJson(jobId, 'publish.json') as Record<string, unknown> | null;
    const assetsJson = await readJobMetadataJson(jobId, 'assets.json') as Record<string, unknown> | null;
    const thumbnailJson = await readJobMetadataJson(jobId, 'thumbnail.json') as Record<string, unknown> | null;
    const youtubePackageJson = await readJobMetadataJson(jobId, 'youtube-package.json') as Record<string, unknown> | null;

    mediaToUse = await hydrateVideoReviewMedia(jobId, assetsJson, publishJson, thumbnailJson, youtubePackageJson);
  }

  const current = existingReview ?? await getOrCreateReview(jobId);
  if (!current) {
    return { ok: false, code: 'review_not_found', error: 'Review metadata not found for job.', jobId };
  }

  const now = new Date().toISOString();
  const requested: VideoReviewMetadata = {
    jobId,
    reviewStatus: 'changes_requested',
    createdAt: current.createdAt,
    updatedAt: now,
    reviewedAt: now,
    reviewedBy: input.reviewedBy.trim(),
    notes: typeof input.notes === 'string' && input.notes.trim().length > 0 ? input.notes.trim() : current.notes ?? 'Changes requested',
    media: mediaToUse,
  };
  try {
    await writeReviewJson(jobId, requested);
  } catch {
    return { ok: false, code: 'review_write_failed', error: 'Failed to write review metadata.', jobId };
  }
  return { ok: true, review: requested };
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
  clientActionId?: string | null;
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
  reviewStatus?: string;
  videoId?: string | null;
  url?: string | null;
  stdout?: string;
  stderr?: string;
  error?: string;
  code?: string;
  details?: Record<string, unknown>;
  dryRunPassed?: boolean;
  dryRunCheckedAt?: string;
}

// Re-export ReviewStatus from video-orchestrator-publish-gate.ts
export type { ReviewStatus } from './video-orchestrator-publish-gate.js';

export interface VideoReviewMedia {
  scenePlanKey: string | null;
  narrationScriptKey: string | null;
  audioKey: string | null;
  sceneImageKeys: string[];
  videoKey: string | null;
  thumbnailKey: string | null;
  publishKey: string | null;
  youtubePackageKey: string | null;
  overlayPlanKey: string | null;
}

export interface VideoReviewMetadata {
  jobId: string;
  reviewStatus: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  notes: string | null;
  media: VideoReviewMedia;
  finalization?: {
    attempted: boolean;
    ok: boolean;
    missing: string[];
    repaired: string[];
  };
}

export interface VideoReviewResponse {
  ok: true;
  review: VideoReviewMetadata;
  finalization?: {
    attempted: boolean;
    ok: boolean;
    missing: string[];
    repaired: string[];
  };
}

export interface VideoReviewError {
  ok: false;
  code: 'invalid_job_id' | 'review_not_found' | 'review_write_failed' | 'invalid_body' | 'review_media_incomplete';
  error: string;
  jobId?: string;
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

  // Initialize variables for youtube-package generation
  let scenePlanContent: ScenePlan | null = null;

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
  const isHybridTTSMode = generationMode === 'hybrid_tts';
  const isHybridStoryboardMode = generationMode === 'hybrid_storyboard';
  const isHybridSlideshowMode = generationMode === 'hybrid_slideshow';
  const isHybridImageSlideshowMode = generationMode === 'hybrid_image_slideshow';
  const isHybridAnimatedVideoMode = generationMode === 'hybrid_animated_video';
  const usesTtsNarration = isHybridTTSMode || isHybridStoryboardMode || isHybridSlideshowMode || isHybridImageSlideshowMode || isHybridAnimatedVideoMode;
  const modeMetadata = isHybridAnimatedVideoMode
    ? {
        mediaSource: 'hybrid' as const,
        generationMode: 'hybrid_animated_video' as const,
        videoSourceKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
        audioSourceKey: `jobs/${jobId}/audio/narration.mp3`,
        providerName: 'aws-bedrock-nova-reel',
        aiGenerated: true,
        partialAiGenerated: false,
        ttsGenerated: true,
        storyboardGenerated: false,
        imageGenerated: false,
        slideshowGenerated: false,
      }
    : isHybridImageSlideshowMode
    ? {
        mediaSource: 'hybrid' as const,
        generationMode: 'hybrid_image_slideshow_video' as const,
        videoSourceKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
        audioSourceKey: `jobs/${jobId}/audio/narration.mp3`,
        providerName: 'hybrid-image-slideshow-ffmpeg',
        aiGenerated: false,
        partialAiGenerated: true,
        ttsGenerated: true,
        storyboardGenerated: true,
        imageGenerated: true,
        slideshowGenerated: true,
      }
    : isHybridSlideshowMode
    ? {
        mediaSource: 'hybrid' as const,
        generationMode: 'hybrid_slideshow_video' as const,
        videoSourceKey: `jobs/${jobId}/video-generated/generated-001.mp4`,
        audioSourceKey: `jobs/${jobId}/audio/narration.mp3`,
        providerName: 'hybrid-slideshow-ffmpeg',
        aiGenerated: false,
        ttsGenerated: true,
        storyboardGenerated: true,
        slideshowGenerated: true,
      }
    : isHybridStoryboardMode
    ? {
        mediaSource: 'hybrid' as const,
        generationMode: 'hybrid_storyboard_fixture_video' as const,
        videoSourceKey: VIDEO_FIXTURE_KEY,
        audioSourceKey: `jobs/${jobId}/audio/narration.mp3`,
        providerName: 'hybrid-storyboard-fixture',
        aiGenerated: false,
        ttsGenerated: true,
        storyboardGenerated: true,
      }
    : isHybridTTSMode
      ? {
          mediaSource: 'hybrid' as const,
          generationMode: 'hybrid_tts_fixture_video' as const,
          videoSourceKey: VIDEO_FIXTURE_KEY,
          audioSourceKey: `jobs/${jobId}/audio/narration.mp3`,
          providerName: 'hybrid-tts-fixture',
          aiGenerated: false,
          ttsGenerated: true,
        }
      : isHybridMode
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
      // Also write to S3 to ensure status is persisted (not just local)
      await writeS3MetadataJson(jobId, 'status.json', failedStatus);
    } catch (err) {
      console.error(`Warning: Failed to write failed status for ${jobId}: ${err}`);
    }
  };
  const updateProgressStatus = async (currentStep: string, extra: Record<string, unknown> = {}) => {
    const progressStatus = {
      ...initialStatus,
      ...extra,
      currentStep,
      updatedAt: new Date().toISOString(),
    };
    try {
      await writeFile(statusPath, JSON.stringify(progressStatus, null, 2) + '\n', 'utf-8');
      await writeS3MetadataJson(jobId, 'status.json', progressStatus);
    } catch (err) {
      console.error(`Warning: Failed to update progress status to ${currentStep} for ${jobId}: ${err}`);
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
        approvedBy: approval.approvedBy || input.requestedBy || 'brain-console',
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

  // Step 2.5 (Hybrid, Hybrid TTS, and Hybrid Storyboard): Generate scene plan and narration script from prompt
  let scenePlanKey: string | undefined;
  let narrationScriptKey: string | undefined;
  const usesPromptDerivedPlanning = isHybridMode || isHybridTTSMode || isHybridStoryboardMode || isHybridSlideshowMode || isHybridImageSlideshowMode || isHybridAnimatedVideoMode;
  if (usesPromptDerivedPlanning) {
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

  // Step 3: Generate or copy narration
  // For TTS-backed hybrid modes: synthesize narration from script using TTS
  // For other modes: copy fixture narration
  const narrationKey = `jobs/${jobId}/audio/narration.mp3`;
  const ttsVoiceId = process.env.AWS_VIDEO_TTS_VOICE_ID || 'Matthew';
  let audioProvider: string | undefined;
  let voiceId: string | undefined;

  if (usesTtsNarration) {
    // Update status: TTS synthesis starting
    await updateProgressStatus('tts_started', { audioProvider: 'aws-polly' });

    // Read narration script and synthesize audio
    try {
      // Verify narration script was created in step 2.5
      const narrationScriptPath = join(audioDir, 'narration-script.txt');
      let narrationText: string;
      try {
        narrationText = await readFile(narrationScriptPath, 'utf-8');
      } catch (err) {
        const message = `Narration script missing before TTS synthesis: ${err instanceof Error ? err.message : String(err)}`;
        await writeFailedStatus('narration_script_missing', message, {
          narrationScriptKey,
          expectedPath: narrationScriptPath,
        });
        return {
          ok: false,
          code: 'narration_script_missing',
          message,
          jobId,
        };
      }

      // Extract clean narration text (remove "Scene N" headers)
      const cleanedNarration = narrationText
        .split('\n')
        .filter(line => !line.match(/^Scene \d+/) && !line.match(/^Visual:/) && line.trim().length > 0)
        .join(' ')
        .replace(/Narration:\s*/g, '')
        .trim();

      if (!cleanedNarration || cleanedNarration.length === 0) {
        const message = 'Failed to extract narration text from narration script';
        await writeFailedStatus('narration_text_empty', message, {
          narrationScriptKey,
          rawText: narrationText.slice(0, 200),
        });
        return {
          ok: false,
          code: 'narration_text_empty',
          message,
          jobId,
        };
      }

      // Synthesize using Polly TTS
      const ttsProvider = new PollyTTSProvider();
      let ttsResult;
      try {
        ttsResult = await ttsProvider.synthesizeNarration({
          jobId,
          text: cleanedNarration,
          voiceId: ttsVoiceId,
          bucket: S3_BUCKET,
          region: AWS_REGION,
          outputKey: narrationKey,
        });
      } catch (ttsErr) {
        const message = `Failed to synthesize narration audio with AWS Polly: ${ttsErr instanceof Error ? ttsErr.message : String(ttsErr)}`;
        await writeFailedStatus('tts_synthesis_failed', message, {
          audioProvider: 'aws-polly',
          voiceId: ttsVoiceId,
          narrationScriptKey,
          expectedAudioKey: narrationKey,
          textLength: cleanedNarration.length,
        });
        return {
          ok: false,
          code: 'tts_synthesis_failed',
          message,
          jobId,
        };
      }

      audioProvider = ttsResult.provider;
      voiceId = ttsResult.voiceId;

      // Update status: TTS synthesis complete, verifying audio
      await updateProgressStatus('tts_complete', {
        audioProvider: ttsResult.provider,
        voiceId: ttsResult.voiceId,
      });

      // Verify TTS audio object exists in S3
      const audioExistsInS3 = await s3ObjectExists(narrationKey);
      if (!audioExistsInS3) {
        const message = `TTS audio object not found in S3 after synthesis: ${narrationKey}`;
        await writeFailedStatus('tts_audio_missing_after_synthesis', message, {
          audioProvider: 'aws-polly',
          voiceId: ttsVoiceId,
          expectedAudioKey: narrationKey,
        });
        return {
          ok: false,
          code: 'tts_audio_missing_after_synthesis',
          message,
          jobId,
        };
      }

      try {
        await execFileAsync('aws', [
          's3', 'cp',
          `s3://${S3_BUCKET}/${narrationKey}`,
          join(audioDir, 'narration.mp3'),
          '--region', AWS_REGION,
          '--no-cli-pager',
        ], { timeout: 30_000 });
      } catch (err) {
        const message = `Failed to download TTS audio for local slideshow assembly: ${err instanceof Error ? err.message : String(err)}`;
        await writeFailedStatus('tts_audio_local_copy_failed', message, {
          audioProvider: 'aws-polly',
          voiceId: ttsVoiceId,
          audioKey: narrationKey,
        });
        return {
          ok: false,
          code: 'tts_audio_local_copy_failed',
          message,
          jobId,
        };
      }
    } catch (err) {
      const message = `Unexpected error during TTS synthesis: ${err instanceof Error ? err.message : String(err)}`;
      await writeFailedStatus('tts_unexpected_error', message, {
        error: err instanceof Error ? err.stack : String(err),
      });
      return {
        ok: false,
        code: 'tts_unexpected_error',
        message,
        jobId,
      };
    }
  } else {
    // Copy fixture narration for non-TTS modes
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
  }

  // Step 3.5 (Hybrid Storyboard / Hybrid Slideshow): Generate storyboard images
  let storyboardKey: string | undefined;
  let imageGenerationKey: string | undefined;
  let sceneImageKeys: string[] = [];
  let slideshowImageKeys: string[] = [];
  let imageProvider: string | undefined;
  let imageModelId: string | undefined;
  let imageRegion: string | undefined;
  let overlayPlanKey: string | undefined;
  let overlayPlanContent: OverlayPlan | null = null;
  let overlayFrameKeys: string[] = [];
  let overlayFramePaths: string[] = [];
  let motionPlanKey: string | undefined;
  let motionClipKeys: string[] = [];
  let motionFrameKeys: string[] = [];
  let motionFallbackUsed = false;
  let motionFallbackReason: string | null = null;
  let animatedClipKeys: string[] = [];
  let novaReelResult: BedrockNovaReelVideoProviderOutput | null = null;
  let animatedVideoFallbackUsed = false;
  let animatedVideoFallbackReason: string | null = null;
  let imageGenerationSettings: {
    width: number;
    height: number;
    cfgScale: number;
    quality: string;
    seed: number;
  } | undefined;
  let imageGenerationRecords: Array<{
    index: number;
    originalVisualPrompt: string;
    finalImagePrompt?: string;
    promptHash?: string;
    imageProvider?: string;
    imageModelId?: string;
    imageRegion?: string;
    imageKey: string;
    width?: number;
    height?: number;
    seed?: number;
    generatedAt?: string;
  }> = [];

  const useLocalAnimatedFallback = process.env.AWS_VIDEO_ANIMATED_FALLBACK === 'local-ffmpeg';
  if ((isHybridStoryboardMode || isHybridSlideshowMode || isHybridImageSlideshowMode || (isHybridAnimatedVideoMode && useLocalAnimatedFallback)) && scenePlanKey && narrationScriptKey) {
    const configuredImageProvider: AwsVideoImageProviderName | null = isHybridImageSlideshowMode
      ? getConfiguredImageProvider()
      : 'deterministic-placeholder';
    if (isHybridImageSlideshowMode && !configuredImageProvider) {
      const message = 'hybrid_image_slideshow requires AWS_VIDEO_IMAGE_PROVIDER=aws-bedrock-nova-canvas or aws-bedrock-titan-image. Use AWS_VIDEO_IMAGE_PROVIDER=deterministic-placeholder only for explicit development proof mode.';
      await writeFailedStatus('image_provider_not_configured', message, {
        acceptedProviders: ['deterministic-placeholder', 'aws-bedrock-nova-canvas', 'aws-bedrock-titan-image'],
        requiredEnv: ['AWS_VIDEO_IMAGE_PROVIDER', 'AWS_VIDEO_IMAGE_MODEL_ID', 'AWS_VIDEO_IMAGE_REGION'],
      });
      return {
        ok: false,
        code: 'image_provider_not_configured',
        message,
        jobId,
      };
    }

    await updateProgressStatus('storyboard_started', {
      imageProvider: configuredImageProvider,
      ...(configuredImageProvider ? { imageModelId: getDefaultImageModelId(configuredImageProvider) } : {}),
    });

    try {
      // Read the scene plan
      const scenePlanPath = join(metadataDir, 'scene-plan.json');
      try {
        const planData = await readFile(scenePlanPath, 'utf-8');
        scenePlanContent = JSON.parse(planData) as ScenePlan;
      } catch (err) {
        const message = `Failed to read scene plan for storyboard generation: ${err instanceof Error ? err.message : String(err)}`;
        await writeFailedStatus('storyboard_scene_plan_missing', message, {
          scenePlanKey,
          expectedPath: scenePlanPath,
        });
        return {
          ok: false,
          code: 'storyboard_scene_plan_missing',
          message,
          jobId,
        };
      }

      // Create images directory
      const imagesDir = join(jobRoot, 'images');
      await mkdir(imagesDir, { recursive: true });

      const storyboardProvider = new DeterministicStoryboardProvider();
      const bedrockImageProvider = configuredImageProvider && configuredImageProvider !== 'deterministic-placeholder'
        ? new AwsBedrockImageProvider(configuredImageProvider)
        : null;
      imageModelId = bedrockImageProvider?.modelId ?? getDefaultImageModelId(configuredImageProvider ?? 'deterministic-placeholder');
      imageRegion = bedrockImageProvider?.bedrockRegion ?? AWS_REGION;
      imageGenerationSettings = {
        width: bedrockImageProvider?.width ?? parseInt(process.env.AWS_VIDEO_IMAGE_WIDTH || '1280', 10),
        height: bedrockImageProvider?.height ?? parseInt(process.env.AWS_VIDEO_IMAGE_HEIGHT || '720', 10),
        cfgScale: bedrockImageProvider?.cfgScale ?? parseFloat(process.env.AWS_VIDEO_IMAGE_CFG_SCALE || '6.5'),
        quality: bedrockImageProvider?.quality ?? (process.env.AWS_VIDEO_IMAGE_QUALITY || 'standard'),
        seed: bedrockImageProvider?.seed ?? parseInt(process.env.AWS_VIDEO_IMAGE_SEED || '42', 10),
      };
      const effectiveImageProvider = configuredImageProvider ?? storyboardProvider.name;
      const storyboard: Record<string, unknown> = {
        jobId,
        provider: effectiveImageProvider,
        ...(imageModelId ? { imageModelId } : {}),
        ...(imageRegion ? { imageRegion } : {}),
        createdAt: new Date().toISOString(),
        scenes: [],
      };

      const imageKeysArray: string[] = [];

      for (const scene of scenePlanContent.scenes) {
        const sceneIndex = scene.index + 1;
        const baseFileName = `scene-${String(sceneIndex).padStart(3, '0')}`;
        const svgPath = join(imagesDir, `${baseFileName}.svg`);
        const pngPath = join(imagesDir, `${baseFileName}.png`);
        const svgS3Key = `jobs/${jobId}/images/${baseFileName}.svg`;
        const pngS3Key = `jobs/${jobId}/images/${baseFileName}.png`;

        try {
          if (bedrockImageProvider) {
            const imageResult = await bedrockImageProvider.generateSceneImage({
              jobId,
              sceneIndex,
              visualPrompt: scene.visualPrompt,
              narrationText: scene.narrationText,
              ...(scene.onScreenText ? { onScreenText: scene.onScreenText } : {}),
              width: 1280,
              height: 720,
              outputKey: pngS3Key,
              bucket: S3_BUCKET,
              region: AWS_REGION,
            });
            await execFileAsync('aws', [
              's3', 'cp',
              `s3://${S3_BUCKET}/${pngS3Key}`,
              pngPath,
              '--region', AWS_REGION,
              '--no-cli-pager',
            ]);
            imageGenerationRecords.push({
              index: sceneIndex,
              originalVisualPrompt: scene.visualPrompt,
              ...(imageResult.finalImagePrompt ? { finalImagePrompt: imageResult.finalImagePrompt } : {}),
              ...(imageResult.promptHash ? { promptHash: imageResult.promptHash } : {}),
              ...(imageResult.providerName ? { imageProvider: imageResult.providerName } : {}),
              ...(imageResult.modelId ? { imageModelId: imageResult.modelId } : {}),
              ...(imageResult.region ? { imageRegion: imageResult.region } : {}),
              imageKey: imageResult.imageKey,
              ...(typeof imageResult.width === 'number' ? { width: imageResult.width } : {}),
              ...(typeof imageResult.height === 'number' ? { height: imageResult.height } : {}),
              ...(typeof imageResult.seed === 'number' ? { seed: imageResult.seed } : {}),
              ...(imageResult.generatedAt ? { generatedAt: imageResult.generatedAt } : {}),
            });
          } else {
            const generatedSvgPath = await storyboardProvider.generateStoryboardImage(
              {
                jobId,
                index: sceneIndex,
                visualPrompt: scene.visualPrompt,
                narrationText: scene.narrationText,
                onScreenText: scene.onScreenText,
                durationSeconds: scene.durationSeconds,
              },
              imagesDir,
            );

            if (generatedSvgPath !== svgPath) {
              await writeFile(svgPath, await readFile(generatedSvgPath, 'utf-8'), 'utf-8');
            }
            const generatedPngPath = await storyboardProvider.generateStoryboardPng(
              {
                jobId,
                index: sceneIndex,
                visualPrompt: scene.visualPrompt,
                narrationText: scene.narrationText,
                onScreenText: scene.onScreenText,
                durationSeconds: scene.durationSeconds,
              },
              imagesDir,
            );
            if (generatedPngPath !== pngPath) {
              await writeFile(pngPath, await readFile(generatedPngPath));
            }

            await execFileAsync('aws', [
              's3', 'cp',
              svgPath,
              `s3://${S3_BUCKET}/${svgS3Key}`,
              '--region', AWS_REGION,
              '--no-cli-pager',
              '--content-type', 'image/svg+xml',
            ]);
            await execFileAsync('aws', [
              's3', 'cp',
              pngPath,
              `s3://${S3_BUCKET}/${pngS3Key}`,
              '--region', AWS_REGION,
              '--no-cli-pager',
              '--content-type', 'image/png',
            ]);
          }

          const sceneAuditRecord = imageGenerationRecords.find(entry => entry.index === sceneIndex);
          imageKeysArray.push(isHybridImageSlideshowMode ? pngS3Key : svgS3Key);
          slideshowImageKeys.push(pngS3Key);

          // Add to storyboard data
          const sceneAuditPayload = isHybridImageSlideshowMode && sceneAuditRecord ? {
            ...(sceneAuditRecord.finalImagePrompt ? { finalImagePrompt: sceneAuditRecord.finalImagePrompt } : {}),
            ...(sceneAuditRecord.promptHash ? { promptHash: sceneAuditRecord.promptHash } : {}),
            ...(sceneAuditRecord.imageProvider ? { imageProvider: sceneAuditRecord.imageProvider } : {}),
            ...(sceneAuditRecord.imageModelId ? { imageModelId: sceneAuditRecord.imageModelId } : {}),
            ...(sceneAuditRecord.imageRegion ? { imageRegion: sceneAuditRecord.imageRegion } : {}),
            ...(typeof sceneAuditRecord.width === 'number' ? { width: sceneAuditRecord.width } : {}),
            ...(typeof sceneAuditRecord.height === 'number' ? { height: sceneAuditRecord.height } : {}),
            ...(typeof sceneAuditRecord.seed === 'number' ? { seed: sceneAuditRecord.seed } : {}),
            ...(sceneAuditRecord.generatedAt ? { generatedAt: sceneAuditRecord.generatedAt } : {}),
          } : {};
          (storyboard.scenes as unknown[]).push({
            index: sceneIndex,
            originalVisualPrompt: scene.visualPrompt,
            visualPrompt: scene.visualPrompt,
            imageKey: isHybridImageSlideshowMode ? pngS3Key : svgS3Key,
            ...sceneAuditPayload,
            durationSeconds: scene.durationSeconds,
            narrationText: scene.narrationText,
            onScreenText: scene.onScreenText,
          });
        } catch (err) {
          const isImageProviderError = err instanceof ImageProviderError;
          const failedStep = isImageProviderError ? err.code : 'storyboard_image_generation_failed';
          const message = `Failed to generate scene image for scene ${sceneIndex}: ${err instanceof Error ? err.message : String(err)}`;
          await writeFailedStatus(failedStep, message, {
            sceneIndex,
            imageProvider: configuredImageProvider,
            imageModelId,
            visualPrompt: scene.visualPrompt,
            error: err instanceof Error ? err.message : String(err),
            ...(isImageProviderError ? err.details : {}),
          });
          return {
            ok: false,
            code: failedStep,
            message,
            jobId,
          };
        }
      }

      // Write storyboard manifest locally and to S3
      storyboardKey = `jobs/${jobId}/metadata/storyboard.json`;
      await writeFile(join(metadataDir, 'storyboard.json'), JSON.stringify(storyboard, null, 2) + '\n', 'utf-8');
      await writeS3MetadataJson(jobId, 'storyboard.json', storyboard as unknown as Record<string, unknown>);

      if (isHybridImageSlideshowMode) {
        const motionLayer = await buildDeterministicMotionLayer({
          jobId,
          jobRoot,
          metadataDir,
          scenePlan: scenePlanContent,
          sceneImageKeys,
          imageGenerationSettings,
        });
        motionPlanKey = `jobs/${jobId}/metadata/motion-plan.json`;
        motionClipKeys = motionLayer.motionClipKeys;
        motionFrameKeys = motionLayer.motionFrameKeys;
        motionFallbackUsed = motionLayer.fallbackUsed;
        motionFallbackReason = motionLayer.fallbackReason;

        imageGenerationKey = `jobs/${jobId}/metadata/image-generation.json`;
        const imageGenerationSummary = {
          jobId,
          provider: effectiveImageProvider,
          modelId: imageModelId,
          region: imageRegion,
          sceneCount: imageGenerationRecords.length,
          generatedImageKeys: imageGenerationRecords.map(record => record.imageKey),
          promptHashes: imageGenerationRecords.map(record => record.promptHash).filter((value): value is string => Boolean(value)),
          warnings: [
            effectiveImageProvider === 'deterministic-placeholder'
              ? 'Development proof mode: deterministic placeholder image generation is enabled.'
              : 'Scene images are model-generated via Nova Canvas and assembled into a slideshow, not motion video.',
          ],
          settings: {
            width: imageGenerationSettings?.width ?? 1280,
            height: imageGenerationSettings?.height ?? 720,
            cfgScale: imageGenerationSettings?.cfgScale ?? 6.5,
            quality: imageGenerationSettings?.quality ?? 'standard',
            seed: imageGenerationSettings?.seed ?? 42,
          },
          createdAt: new Date().toISOString(),
        };
        await writeFile(join(metadataDir, 'image-generation.json'), JSON.stringify(imageGenerationSummary, null, 2) + '\n', 'utf-8');
        await writeS3MetadataJson(jobId, 'image-generation.json', imageGenerationSummary as unknown as Record<string, unknown>);
      }

      sceneImageKeys = imageKeysArray;
      imageProvider = storyboardProvider.name;
      if (configuredImageProvider) imageProvider = configuredImageProvider;

      if (isHybridAnimatedVideoMode && process.env.AWS_VIDEO_ANIMATED_FALLBACK === 'local-ffmpeg' && sceneImageKeys.length > 0 && scenePlanContent) {
        const animatedDir = join(jobRoot, 'animated');
        await mkdir(animatedDir, { recursive: true });
        const animatedClipProvider = new LocalFfmpegAnimatedClipProvider();
        const clipWidth = imageGenerationSettings?.width ?? 1280;
        const clipHeight = imageGenerationSettings?.height ?? 720;
        for (const [index, scene] of scenePlanContent.scenes.entries()) {
          const sceneNumber = index + 1;
          const sourceKey = sceneImageKeys[index] ?? `jobs/${jobId}/images/scene-${String(sceneNumber).padStart(3, '0')}.png`;
          const sourcePath = join(jobRoot, sourceKey.replace(/^jobs\/[^/]+\//, ''));
          const clipKey = `jobs/${jobId}/animated/scene-${String(sceneNumber).padStart(3, '0')}.mp4`;
          const outputClipPath = join(animatedDir, `scene-${String(sceneNumber).padStart(3, '0')}.mp4`);
          await animatedClipProvider.generateClip({
            jobId,
            imagePath: sourcePath,
            outputClipPath,
            durationSeconds: scene.durationSeconds,
            sceneIndex: index,
            width: clipWidth,
            height: clipHeight,
          });
          animatedClipKeys.push(clipKey);
        }
      }

      // Update status: Storyboard complete
      await updateProgressStatus('storyboard_complete', {
        imageProvider,
        ...(imageModelId ? { imageModelId } : {}),
        storyboardKey,
        ...(imageGenerationKey ? { imageGenerationKey } : {}),
        sceneImageCount: sceneImageKeys.length,
      });
    } catch (err) {
      const message = `Unexpected error during storyboard generation: ${err instanceof Error ? err.message : String(err)}`;
      await writeFailedStatus('storyboard_unexpected_error', message, {
        error: err instanceof Error ? err.stack : String(err),
      });
      return {
        ok: false,
        code: 'storyboard_unexpected_error',
        message,
        jobId,
      };
    }
  }

  // Step 4: Assemble the final video.
  const videoKey = `jobs/${jobId}/video-generated/generated-001.mp4`;
  const finalVideoKey = `jobs/${jobId}/exports/generated-001-final.mp4`;
  const thumbnailKey = `jobs/${jobId}/exports/thumbnail-001.jpg`;
  if (isHybridSlideshowMode || isHybridImageSlideshowMode || isHybridAnimatedVideoMode) {
    await updateProgressStatus('slideshow_started', { videoKey });
    try {
      const outputVideoPath = join(jobRoot, 'video-generated', 'generated-001.mp4');
      await mkdir(join(jobRoot, 'video-generated'), { recursive: true });
      if (isHybridAnimatedVideoMode) {
        await updateProgressStatus('nova_reel_started', { videoKey, provider: 'aws-bedrock-nova-reel' });
        try {
          const novaReelProvider = new BedrockNovaReelVideoProvider();
          novaReelResult = await novaReelProvider.generateVideo({
            jobId,
            scenePlan: JSON.parse(await readFile(join(metadataDir, 'scene-plan.json'), 'utf-8')) as ScenePlan,
            outputVideoPath,
            bucket: S3_BUCKET,
            region: AWS_REGION,
            outputPrefix: `jobs/${jobId}/video-generated/nova-reel`,
            onProgress: async (progress) => {
              await updateProgressStatus('nova_reel_waiting', {
                provider: 'aws-bedrock-nova-reel',
                invocationArn: progress.invocationArn,
                bedrockStatus: progress.status,
                elapsedSeconds: progress.elapsedSeconds,
                videoKey,
              });
            },
          });
          await updateProgressStatus('nova_reel_complete', {
            videoKey,
            provider: novaReelResult.provider,
            modelId: novaReelResult.modelId,
            invocationArn: novaReelResult.invocationArn,
            sourceVideoKey: novaReelResult.sourceVideoKey,
          });
        } catch (err) {
          animatedVideoFallbackUsed = process.env.AWS_VIDEO_ANIMATED_FALLBACK === 'local-ffmpeg';
          animatedVideoFallbackReason = err instanceof Error ? err.message : String(err);
          if (!animatedVideoFallbackUsed) {
            throw err;
          }
          await updateProgressStatus('nova_reel_fallback_started', {
            videoKey,
            provider: 'local-ffmpeg-animated-placeholder',
            reason: animatedVideoFallbackReason,
          });
        }
      }
      if (isHybridAnimatedVideoMode && !novaReelResult) {
        const message = animatedVideoFallbackReason
          ? `Nova Reel video generation failed and slideshow fallback is disabled: ${animatedVideoFallbackReason}`
          : 'Nova Reel video generation did not produce a result and slideshow fallback is disabled.';
        await writeFailedStatus('nova_reel_required', message, {
          provider: 'aws-bedrock-nova-reel',
          fallbackAllowed: false,
          hint: 'Fix Nova Reel configuration/permissions/model access instead of falling back to slideshow.',
        });
        return {
          ok: false,
          code: 'nova_reel_required',
          message,
          jobId,
        };
      }

      const slideshowProvider = new LocalFfmpegSlideshowProvider();
      const scenePlanPath = join(metadataDir, 'scene-plan.json');
      const scenePlanData = JSON.parse(await readFile(scenePlanPath, 'utf-8')) as ScenePlan;
      let slideshowScenes = scenePlanData.scenes.map((scene, index) => ({
        index: index + 1,
        imagePath: join(jobRoot, 'images', `scene-${String(index + 1).padStart(3, '0')}.png`),
        imageKey: slideshowImageKeys[index] ?? `jobs/${jobId}/images/scene-${String(index + 1).padStart(3, '0')}.png`,
        durationSeconds: scene.durationSeconds,
      }));

      if (isHybridImageSlideshowMode) {
        await updateProgressStatus('overlay_started', { videoKey });
        const framesDir = join(jobRoot, 'frames');
        await mkdir(framesDir, { recursive: true });
        const existingYoutubePackage = await readJobMetadataJson(jobId, 'youtube-package.json') as Record<string, unknown> | null;
        const overlayProvider = new DeterministicOverlayProvider();
        const overlayResult = await overlayProvider.renderOverlayFrames({
          jobId,
          framesDir,
          scenePlan: scenePlanData,
          scenes: slideshowScenes,
          title: stringValue(existingYoutubePackage?.title) ?? script.title,
        });
        overlayPlanKey = overlayResult.overlayPlanKey;
        overlayPlanContent = overlayResult.plan;
        overlayFrameKeys = overlayResult.frameKeys;
        overlayFramePaths = overlayResult.framePaths;
        await writeFile(join(metadataDir, 'overlay-plan.json'), `${JSON.stringify(overlayPlanContent, null, 2)}\n`, 'utf-8');
        await writeS3MetadataJson(jobId, 'overlay-plan.json', overlayPlanContent as unknown as Record<string, unknown>);
        for (let index = 0; index < overlayFramePaths.length; index += 1) {
          const framePath = overlayFramePaths[index];
          const frameKey = overlayFrameKeys[index];
          if (!framePath || !frameKey) continue;
          await execFileAsync('aws', [
            's3', 'cp',
            framePath,
            `s3://${S3_BUCKET}/${frameKey}`,
            '--region', AWS_REGION,
            '--no-cli-pager',
            '--content-type', 'image/png',
          ]);
        }
        slideshowScenes = slideshowScenes.map((scene, index) => ({
          ...scene,
          imagePath: overlayFramePaths[index] ?? scene.imagePath,
          imageKey: overlayFrameKeys[index] ?? scene.imageKey,
        }));
        await updateProgressStatus('overlay_complete', {
          overlayProvider: overlayResult.provider,
          overlayPlanKey,
          overlayFrameCount: overlayFrameKeys.length,
        });
      }

      if (motionClipKeys.length > 0) {
        slideshowScenes = slideshowScenes.map((scene, index) => ({
          ...scene,
          imagePath: join(jobRoot, 'motion', `scene-${String(index + 1).padStart(3, '0')}.mp4`),
          imageKey: motionClipKeys[index] ?? scene.imageKey,
        }));
      }

      if (isHybridAnimatedVideoMode && animatedClipKeys.length > 0) {
        slideshowScenes = slideshowScenes.map((scene, index) => ({
          ...scene,
          imagePath: join(jobRoot, 'animated', `scene-${String(index + 1).padStart(3, '0')}.mp4`),
          imageKey: animatedClipKeys[index] ?? scene.imageKey,
        }));
      }

      const slideshowAssembly = novaReelResult
        ? { provider: novaReelResult.provider, outputVideoPath: novaReelResult.videoPath, sceneCount: scenePlanData.scenes.length }
        : await slideshowProvider.assembleSlideshow({
          jobId,
          narrationPath: join(audioDir, 'narration.mp3'),
          outputVideoPath,
          scenes: slideshowScenes.map((scene) => ({
            index: scene.index,
            mediaPath: scene.imagePath,
            imagePath: scene.imagePath,
            durationSeconds: scene.durationSeconds,
          })),
        });
      await execFileAsync('aws', [
        's3', 'cp',
        outputVideoPath,
        `s3://${S3_BUCKET}/${videoKey}`,
        '--region', AWS_REGION,
        '--no-cli-pager',
      ]);

      const finalVideoPath = join(jobRoot, 'exports', 'generated-001-final.mp4');
      const thumbnailPath = join(jobRoot, 'exports', 'thumbnail-001.jpg');
      await mkdir(join(jobRoot, 'exports'), { recursive: true });
      if (novaReelResult) {
        await updateProgressStatus('audio_mux_started', {
          provider: 'ffmpeg',
          videoKey,
          audioKey: narrationKey,
          finalVideoKey,
        });
        await execFileAsync('ffmpeg', [
          '-y',
          '-i', outputVideoPath,
          '-i', join(audioDir, 'narration.mp3'),
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          finalVideoPath,
        ], { timeout: 120_000 });
      } else {
        await copyFile(outputVideoPath, finalVideoPath);
      }
      await execFileAsync('aws', [
        's3', 'cp',
        finalVideoPath,
        `s3://${S3_BUCKET}/${finalVideoKey}`,
        '--region', AWS_REGION,
        '--no-cli-pager',
        '--content-type', 'video/mp4',
      ]);

      const thumbnailSourcePath = slideshowScenes[0]?.imagePath ?? join(jobRoot, 'images', 'scene-001.png');
      if (thumbnailSourcePath && await fileExists(thumbnailSourcePath)) {
        await generateThumbnailFromImage(thumbnailSourcePath, thumbnailPath);
        await execFileAsync('aws', [
          's3', 'cp',
          thumbnailPath,
          `s3://${S3_BUCKET}/${thumbnailKey}`,
          '--region', AWS_REGION,
          '--no-cli-pager',
          '--content-type', 'image/jpeg',
        ]);
      }

      await updateProgressStatus('slideshow_complete', {
        videoProvider: slideshowAssembly.provider,
        videoKey,
        finalVideoKey,
        sceneImageCount: sceneImageKeys.length,
        ...(motionPlanKey ? { motionPlanKey } : {}),
        ...(motionClipKeys.length > 0 ? { motionClipCount: motionClipKeys.length } : {}),
      });
    } catch (err) {
      const isAnimatedFailure = isHybridAnimatedVideoMode;
      const message = isAnimatedFailure
        ? `Failed to generate Nova Reel video: ${err instanceof Error ? err.message : String(err)}`
        : `Failed to assemble slideshow video: ${err instanceof Error ? err.message : String(err)}`;
      await writeFailedStatus(isAnimatedFailure ? 'nova_reel_failed' : 'slideshow_failed', message, {
        videoKey,
        videoProvider: isAnimatedFailure ? 'aws-bedrock-nova-reel' : 'local-ffmpeg-slideshow',
      });
      const code = isAnimatedFailure
        ? 'nova_reel_failed'
        : err instanceof Error && err.message.includes('slideshow_assembly_not_available')
          ? 'slideshow_assembly_not_available'
          : 'slideshow_assembly_failed';
      return {
        ok: false,
        code,
        message,
        jobId,
      };
    }
  } else {
    await updateProgressStatus('video_fixture_copy_started', { videoKey });

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
    videoSourceKey: modeMetadata.videoSourceKey,
    audioSourceKey: modeMetadata.audioSourceKey,
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
  if (isHybridImageSlideshowMode && narrationScriptKey && storyboardKey) {
    assetsJson.scenePlanKey = scenePlanKey;
    assetsJson.narrationScriptKey = narrationScriptKey;
    assetsJson.imageGenerationKey = imageGenerationKey;
    assetsJson.audioKey = narrationKey;
    assetsJson.audioSourceKey = narrationKey;
    assetsJson.audioProvider = audioProvider;
    assetsJson.voiceId = voiceId;
    assetsJson.storyboardKey = storyboardKey;
    assetsJson.sceneImageKeys = sceneImageKeys;
    assetsJson.imageProvider = imageProvider;
    if (imageModelId) assetsJson.imageModelId = imageModelId;
    assetsJson.videoProvider = 'local-ffmpeg-slideshow';
    assetsJson.videoKey = finalVideoKey;
    assetsJson.thumbnailKey = thumbnailKey;
    assetsJson.finalVideo = { path: finalVideoKey, source: 'slideshow-export', provider: 'local-ffmpeg-slideshow' };
    assetsJson.motionGenerated = motionClipKeys.length > 0 && !motionFallbackUsed;
    assetsJson.motionProvider = 'local-ffmpeg-motion';
    assetsJson.motionPlanKey = motionPlanKey;
    assetsJson.motionClipKeys = motionClipKeys;
    assetsJson.motionFrameKeys = motionFrameKeys;
    assetsJson.motionFallbackUsed = motionFallbackUsed;
    assetsJson.motionFallbackReason = motionFallbackReason;
    assetsJson.aiGenerated = false;
    assetsJson.partialAiGenerated = imageProvider !== 'deterministic-placeholder';
    assetsJson.ttsGenerated = true;
    assetsJson.storyboardGenerated = true;
    assetsJson.imageGenerated = true;
    assetsJson.slideshowGenerated = true;
    assetsJson.overlayGenerated = overlayFrameKeys.length > 0;
    assetsJson.overlayProvider = overlayFrameKeys.length > 0 ? 'deterministic-overlay' : undefined;
    assetsJson.overlayPlanKey = overlayPlanKey;
    assetsJson.overlayFrameKeys = overlayFrameKeys;
    assetsJson.narration = {
      path: narrationKey,
      source: 'tts',
      provider: audioProvider,
      voiceId,
    };
    assetsJson.sourceVideo = {
      path: videoKey,
      source: 'slideshow',
      provider: 'local-ffmpeg-slideshow',
    };
    assetsJson.providers = {
      scenePlan: 'deterministic-local',
      narrationScript: 'deterministic-local',
      narrationAudio: 'aws-polly',
      sceneImages: imageProvider,
      overlays: overlayFrameKeys.length > 0 ? 'deterministic-overlay' : undefined,
      video: 'local-ffmpeg-slideshow',
    };
    assetsJson.imageGeneration = {
      key: imageGenerationKey,
      provider: imageProvider,
      modelId: imageModelId,
      region: imageRegion,
      sceneCount: imageGenerationRecords.length,
      generatedImageKeys: imageGenerationRecords.map(record => record.imageKey),
      promptHashes: imageGenerationRecords.map(record => record.promptHash).filter((value): value is string => Boolean(value)),
      settings: {
        width: imageGenerationSettings?.width ?? 1280,
        height: imageGenerationSettings?.height ?? 720,
        cfgScale: imageGenerationSettings?.cfgScale ?? 6.5,
        quality: imageGenerationSettings?.quality ?? 'standard',
        seed: imageGenerationSettings?.seed ?? 42,
      },
      warnings: [
        imageProvider === 'deterministic-placeholder'
          ? 'Development proof mode: deterministic placeholders are enabled.'
          : 'Scene images are model-generated via Nova Canvas and assembled into a slideshow, not motion video.',
      ],
    };
    assetsJson.warnings = [
      imageProvider === 'deterministic-placeholder'
        ? 'Development proof mode: scene images use deterministic placeholders; final video is slideshow assembly, not motion-video generation.'
        : 'Scene images are generated by an image model; final video is slideshow assembly, not motion-video generation.',
      ...(overlayPlanContent?.warnings ?? []),
    ];
  } else if (isHybridAnimatedVideoMode && narrationScriptKey && storyboardKey) {
    assetsJson.scenePlanKey = scenePlanKey;
    assetsJson.narrationScriptKey = narrationScriptKey;
    assetsJson.audioKey = narrationKey;
    assetsJson.audioSourceKey = narrationKey;
    assetsJson.audioProvider = audioProvider;
    assetsJson.voiceId = voiceId;
    assetsJson.storyboardKey = storyboardKey;
    assetsJson.sceneImageKeys = sceneImageKeys;
    assetsJson.imageProvider = imageProvider;
    assetsJson.videoProvider = novaReelResult?.provider ?? 'local-ffmpeg-animated-placeholder';
    assetsJson.videoKey = finalVideoKey;
    assetsJson.thumbnailKey = thumbnailKey;
    assetsJson.finalVideo = { path: finalVideoKey, source: novaReelResult ? 'bedrock-nova-reel' : 'animated-fallback-export', provider: novaReelResult?.provider ?? 'local-ffmpeg-animated-placeholder' };
    assetsJson.animatedClipKeys = animatedClipKeys;
    assetsJson.novaReel = novaReelResult ? {
      modelId: novaReelResult.modelId,
      invocationArn: novaReelResult.invocationArn,
      s3OutputUri: novaReelResult.s3OutputUri,
      sourceVideoKey: novaReelResult.sourceVideoKey,
      durationSeconds: novaReelResult.durationSeconds,
      fps: novaReelResult.fps,
      dimension: novaReelResult.dimension,
      seed: novaReelResult.seed,
    } : null;
    assetsJson.animatedVideoFallbackUsed = animatedVideoFallbackUsed;
    assetsJson.animatedVideoFallbackReason = animatedVideoFallbackReason;
    assetsJson.aiGenerated = Boolean(novaReelResult);
    assetsJson.partialAiGenerated = true;
    assetsJson.ttsGenerated = true;
    assetsJson.storyboardGenerated = true;
    assetsJson.imageGenerated = true;
    assetsJson.slideshowGenerated = !novaReelResult;
    assetsJson.narration = {
      path: narrationKey,
      source: 'tts',
      provider: audioProvider,
      voiceId,
    };
    assetsJson.sourceVideo = {
      path: novaReelResult?.sourceVideoKey ?? videoKey,
      source: novaReelResult ? 'bedrock-nova-reel' : 'animated-clips-fallback',
      provider: novaReelResult?.provider ?? 'local-ffmpeg-animated-placeholder',
    };
    assetsJson.providers = {
      scenePlan: 'deterministic-local',
      narrationScript: 'deterministic-local',
      narrationAudio: 'aws-polly',
      sceneImages: imageProvider,
      video: novaReelResult?.provider ?? 'local-ffmpeg-animated-placeholder',
    };
    assetsJson.warnings = novaReelResult
      ? ['Animated video mode: primary video generated by Amazon Bedrock Nova Reel.']
      : ['Animated video mode: Nova Reel failed and explicit local-ffmpeg fallback was used.'];
  } else if (isHybridSlideshowMode && narrationScriptKey && storyboardKey) {
    assetsJson.scenePlanKey = scenePlanKey;
    assetsJson.narrationScriptKey = narrationScriptKey;
    assetsJson.audioKey = narrationKey;
    assetsJson.audioSourceKey = narrationKey;
    assetsJson.audioProvider = audioProvider;
    assetsJson.voiceId = voiceId;
    assetsJson.storyboardKey = storyboardKey;
    assetsJson.sceneImageKeys = sceneImageKeys;
    assetsJson.imageProvider = imageProvider;
    assetsJson.videoProvider = 'local-ffmpeg-slideshow';
    assetsJson.videoKey = finalVideoKey;
    assetsJson.thumbnailKey = thumbnailKey;
    assetsJson.finalVideo = { path: finalVideoKey, source: 'slideshow-export', provider: 'local-ffmpeg-slideshow' };
    assetsJson.motionGenerated = false;
    assetsJson.motionProvider = 'local-ffmpeg-motion';
    assetsJson.motionPlanKey = motionPlanKey ?? null;
    assetsJson.motionClipKeys = motionClipKeys;
    assetsJson.motionFrameKeys = motionFrameKeys;
    assetsJson.motionFallbackUsed = motionFallbackUsed;
    assetsJson.motionFallbackReason = motionFallbackReason;
    assetsJson.ttsGenerated = true;
    assetsJson.storyboardGenerated = true;
    assetsJson.slideshowGenerated = true;
    assetsJson.narration = {
      path: narrationKey,
      source: 'tts',
      provider: audioProvider,
      voiceId,
    };
    assetsJson.sourceVideo = {
      path: videoKey,
      source: 'slideshow',
      provider: 'local-ffmpeg-slideshow',
    };
    assetsJson.providers = {
      scenePlan: 'deterministic-local',
      narrationScript: 'deterministic-local',
      narrationAudio: 'aws-polly',
      sceneImages: imageProvider,
      video: 'local-ffmpeg-slideshow',
    };
    assetsJson.warnings = ['Slideshow mode: final video is assembled from deterministic storyboard images and generated narration audio, not AI motion video.'];
  } else if (isHybridStoryboardMode && narrationScriptKey && storyboardKey) {
    assetsJson.scenePlanKey = scenePlanKey;
    assetsJson.narrationScriptKey = narrationScriptKey;
    assetsJson.audioKey = narrationKey;
    assetsJson.audioSourceKey = narrationKey;
    assetsJson.audioProvider = audioProvider;
    assetsJson.voiceId = voiceId;
    assetsJson.storyboardKey = storyboardKey;
    assetsJson.sceneImageKeys = sceneImageKeys;
    assetsJson.imageProvider = imageProvider;
    assetsJson.ttsGenerated = true;
    assetsJson.storyboardGenerated = true;
    assetsJson.narration = {
      path: narrationKey,
      source: 'tts',
      provider: audioProvider,
      voiceId,
    };
    assetsJson.providers = {
      scenePlan: 'deterministic-local',
      narrationScript: 'deterministic-local',
      narrationAudio: 'aws-polly',
      sceneImages: imageProvider,
      video: 'fixture',
    };
    assetsJson.warnings = ['Scene images are generated, but final video still uses fixture video.'];
  } else if (isHybridTTSMode && narrationScriptKey) {
    assetsJson.scenePlanKey = scenePlanKey;
    assetsJson.narrationScriptKey = narrationScriptKey;
    assetsJson.audioKey = narrationKey;
    assetsJson.audioSourceKey = narrationKey;
    assetsJson.audioProvider = audioProvider;
    assetsJson.voiceId = voiceId;
    assetsJson.ttsGenerated = true;
    assetsJson.narration = {
      path: narrationKey,
      source: 'tts',
      provider: audioProvider,
      voiceId,
    };
    assetsJson.providers = {
      scenePlan: 'deterministic-local',
      narrationScript: 'deterministic-local',
      narrationAudio: 'aws-polly',
      video: 'fixture',
    };
    assetsJson.warnings = ['Video media still uses fixture assets; narration audio is generated from the prompt-derived script.'];
  } else if (isHybridMode && scenePlanKey) {
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

  // Write youtube-package.json (canonical metadata for YouTube upload)
  try {
    const youtubePackage = buildYouTubePackage({
      jobId,
      topicTitle: typeof topic === 'object' && topic !== null && 'title' in topic ? String((topic as Record<string, unknown>).title) : 'Untitled',
      topicDescription: typeof topic === 'object' && topic !== null && 'description' in topic ? String((topic as Record<string, unknown>).description) : undefined,
      generationMode: modeMetadata.generationMode,
      mediaSource: modeMetadata.mediaSource,
      videoKey: modeMetadata.videoSourceKey ?? null,
      thumbnailKey: null,
      scenePlanKey: scenePlanKey ?? null,
      narrationScriptKey: narrationScriptKey ?? null,
      scenePlan: scenePlanContent ? (Array.isArray(scenePlanContent.scenes) ? scenePlanContent.scenes : undefined) : undefined,
    });
    await writeFile(
      join(metadataDir, 'youtube-package.json'),
      `${JSON.stringify(youtubePackage, null, 2)}\n`,
      'utf-8',
    );
    await writeS3MetadataJson(jobId, 'youtube-package.json', youtubePackage as unknown as Record<string, unknown>);
  } catch (err) {
    console.error(`Warning: Failed to write youtube-package.json for ${jobId}: ${err}`);
  }

  // Step 5: Start Step Functions execution
  await updateProgressStatus('workflow_starting', {
    audioKey: narrationKey,
    videoKey
  });

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

  // Step 4: Preserve generated-media readiness while recording the legacy execution ARN.
  initialStatus.executionArn = executionArn;
  if (isHybridAnimatedVideoMode || isHybridImageSlideshowMode || isHybridSlideshowMode) {
    Object.assign(initialStatus, {
      status: 'ready_to_review',
      currentStep: 'review_ready',
      finalVideoKey,
      thumbnailKey,
      videoProvider: isHybridAnimatedVideoMode ? 'aws-bedrock-nova-reel' : initialStatus.providerName,
      packageComplete: true,
    });
  } else {
    initialStatus.currentStep = 'workflow_started';
  }
  initialStatus.updatedAt = new Date().toISOString();
  try {
    await writeFile(statusPath, JSON.stringify(initialStatus, null, 2) + '\n', 'utf-8');
    await writeS3MetadataJson(jobId, 'status.json', initialStatus);
  } catch (err) {
    // Log but don't fail — status is non-critical at this point
    console.error(`Warning: Failed to update status.json with executionArn: ${err}`);
  }

  // Step 5: Write publish.json to both metadata/ and publishing/
  const publishReason = isHybridAnimatedVideoMode
    ? 'Amazon Bedrock Nova Reel generated video — prompt-derived scene plan, TTS audio, and Nova Reel motion video'
    : isHybridImageSlideshowMode
    ? 'Hybrid Image Slideshow pipeline proof — prompt-derived scene plan, TTS audio, generated scene images, and ffmpeg slideshow video'
    : isHybridSlideshowMode
    ? 'Hybrid Slideshow pipeline proof — prompt-derived scene plan, narration script, TTS audio, deterministic scene images, and ffmpeg slideshow video'
    : isHybridStoryboardMode
    ? 'Hybrid Storyboard pipeline proof — prompt-derived scene plan, narration script, TTS audio, and scene images; video media uses fixtures'
    : isHybridTTSMode
      ? 'Hybrid TTS pipeline proof — prompt-derived scene plan, narration script, and TTS audio; video media uses fixtures'
      : isHybridMode
        ? 'Hybrid pipeline proof — prompt-derived scene plan and narration script; video/audio media uses fixtures'
        : 'Pipeline proof fixture assembly — awaiting explicit publish approval';
  const publishDescription = isHybridAnimatedVideoMode
    ? 'Amazon Bedrock Nova Reel mode: scene plan and narration script are prompt-derived from the input prompt. Narration audio is generated via AWS Polly TTS. Final motion video is generated by Amazon Bedrock Nova Reel and packaged for YouTube review and publish.'
    : isHybridImageSlideshowMode
    ? 'Hybrid Image Slideshow mode: scene plan and narration script are prompt-derived from the input prompt. Narration audio is generated via AWS Polly TTS. Scene images are generated by the configured image provider. Final video is assembled locally as a slideshow, not generated motion video.'
    : isHybridSlideshowMode
    ? 'Hybrid Slideshow mode: scene plan, narration script, and deterministic scene images are prompt-derived from the input prompt. Narration audio is generated via AWS Polly TTS. Final video is assembled locally from those images and narration.'
    : isHybridStoryboardMode
    ? 'Hybrid Storyboard mode: scene plan, narration script, and scene images are prompt-derived from the input prompt. Narration audio is generated via AWS Polly TTS. Final video media uses fixtures.'
    : isHybridTTSMode
      ? 'Hybrid TTS mode: scene plan and narration script are prompt-derived from the input prompt. Narration audio is generated via AWS Polly TTS. Final video media uses fixtures.'
      : isHybridMode
        ? 'Hybrid mode: scene plan and narration script are prompt-derived from the input prompt. Final audio and video media use fixtures.'
        : 'Pipeline proof upload. This video used fixture media, not prompt-generated AI video.';

  const publishTags = isHybridAnimatedVideoMode
    ? ['nova-reel-generated-video', 'aws-bedrock', 'tts-narration', 'scene-plan-generated', 'youtube-ready']
    : isHybridImageSlideshowMode
    ? ['hybrid-image-slideshow-proof', 'image-provider-generated', 'tts-narration', 'ffmpeg-slideshow', 'scene-plan-generated']
    : isHybridSlideshowMode
    ? ['hybrid-slideshow-proof', 'deterministic-scene-images', 'tts-narration', 'ffmpeg-slideshow', 'scene-plan-generated']
    : isHybridStoryboardMode
    ? ['hybrid-storyboard-proof', 'scene-images-generated', 'tts-narration', 'fixture-video', 'scene-plan-generated']
    : isHybridTTSMode
      ? ['hybrid-tts-proof', 'tts-narration', 'fixture-video', 'scene-plan-generated']
      : isHybridMode
        ? ['hybrid-proof', 'fixture-media', 'scene-plan-generated']
        : ['pipeline-proof', 'fixture-media'];

  const publishJson = {
    jobId,
    publishStatus: 'pending',
    publishBlocked: true,
    reason: publishReason,
    createdAt: new Date().toISOString(),
    generatedBy: 'interactive-prompt',
    title: fixtureTitle(script.title),
    description: publishDescription,
    tags: publishTags,
    youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
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

    // Finalize the publish package: repairs canonical media contract and review.json
    // This ensures all required artifacts are accounted for and review media is complete
    const finalized = await finalizeAwsVideoPublishPackage(jobId);
    if (!finalized.ok) {
      console.warn(`[generateApprovedScript] Finalization warnings for ${jobId}: ${finalized.error}`);
      // Non-fatal: finalization warnings don't block generation trigger
    } else {
      await updateProgressStatus('review_ready', {
        status: 'ready_to_review',
        finalVideoKey: finalized.media.videoKey,
        thumbnailKey: finalized.media.thumbnailKey,
        publishKey: finalized.media.publishKey,
        youtubePackageKey: finalized.media.youtubePackageKey,
        reviewStatus: finalized.review?.reviewStatus ?? 'pending',
        packageComplete: true,
      });
    }
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
  clientActionId?: string;
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
  duplicateSuppressed?: true;
  accepted?: true;
  inFlight?: true;
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

  // Check for duplicate create within 30s window (idempotency)
  // Prefer clientActionId if provided, fallback to channelId:normalizedPrompt
  const dedupeKey = input.clientActionId
    ? `${input.channelId}:${input.clientActionId}`
    : `${input.channelId}:${input.prompt.trim().toLowerCase()}`;

  const cached = _recentCreateRequests.get(dedupeKey);
  if (cached && (Date.now() - cached.createdAt) < CREATE_DEDUP_WINDOW_MS) {
    // If request is still in-flight, return accepted response
    if (cached.inFlightPromise) {
      return {
        ok: true,
        jobId: cached.jobId ?? 'pending',
        channelId: input.channelId,
        topicId: 'pending',
        scriptStatus: 'draft',
        approvalStatus: 'pending',
        nextStep: 'approve_script',
        createdAt: new Date().toISOString(),
        accepted: true,
        inFlight: true,
      };
    }
    // If result is cached, return it with suppressed flag
    if (cached.result) {
      return { ...cached.result, duplicateSuppressed: true };
    }
  }

  const root = getVideoOrchestratorRoot();

  // Create a promise for this request and store it immediately for dedup
  const requestPromise: Promise<CreateJobFromPromptResponse | CreateJobFromPromptError> = (async () => {
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
      ...(input.clientActionId ? { clientActionId: input.clientActionId } : {}),
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

    const successResult: CreateJobFromPromptResponse = {
      ok: true,
      jobId,
      channelId: input.channelId,
      topicId,
      scriptStatus: 'draft',
      approvalStatus: 'pending',
      nextStep: 'approve_script',
      createdAt: now_iso,
    };

      // Store for dedup window
      _recentCreateRequests.set(dedupeKey, {
        jobId,
        createdAt: Date.now(),
        result: successResult,
      });

      return successResult;
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
  })();

  // Store the in-flight promise immediately for dedup protection
  _recentCreateRequests.set(dedupeKey, {
    createdAt: Date.now(),
    inFlightPromise: requestPromise,
  });

  // Wait for the promise and update the map with the final result
  const result = await requestPromise;
  if (result.ok) {
    _recentCreateRequests.set(dedupeKey, {
      createdAt: Date.now(),
      result,
      jobId: result.jobId,
    });
  }

  return result;
}




export interface ApprovedContentProductionDispatchInput {
  approvalId: string;
  projectId: string;
  title: string;
  description?: string;
  sourceVideoPath: string;
}

export interface ApprovedContentProductionDispatchResult {
  ok: boolean;
  jobId?: string;
  executionArn?: string;
  duplicate?: boolean;
  error?: string;
}

export interface ApprovedContentProductionDispatchDependencies {
  jobsRoot?: string;
  persistMetadata?: (jobId: string, fileName: string, value: Record<string, unknown>) => Promise<void>;
  startExecution?: (input: {
    jobId: string;
    sourceVideoKey: string;
    mediaSource: 'uploaded-video';
    generationMode: 'approved-source-video';
  }) => Promise<string>;
}

let approvedContentDispatchTestDependencies: ApprovedContentProductionDispatchDependencies | null = null;

export function setApprovedContentProductionDispatchDependenciesForTests(
  dependencies: ApprovedContentProductionDispatchDependencies | null,
): void {
  approvedContentDispatchTestDependencies = dependencies;
}

/**
 * Task 1W-I.1: create one canonical production job from an approved real-video
 * content record and start the configured Step Functions execution.
 */
export async function dispatchApprovedMovingVideoContent(
  input: ApprovedContentProductionDispatchInput,
  dependencies: ApprovedContentProductionDispatchDependencies = {},
): Promise<ApprovedContentProductionDispatchResult> {
  dependencies = { ...(approvedContentDispatchTestDependencies ?? {}), ...dependencies };
  const source = input.sourceVideoPath.trim();
  const normalized = source.toLowerCase();

  if (!source.startsWith(`s3://${S3_BUCKET}/`)) {
    return { ok: false, error: 'sourceVideoPath must be an S3 object in the configured production bucket' };
  }
  if (normalized.includes('test-001') || normalized.includes('fixture') || normalized.includes('slideshow')) {
    return { ok: false, error: 'fixture, test-001, and slideshow sources are not eligible for production dispatch' };
  }
  if (!input.approvalId || !input.projectId || !input.title.trim()) {
    return { ok: false, error: 'approvalId, projectId, and title are required' };
  }

  const sourceVideoKey = source.slice(`s3://${S3_BUCKET}/`.length);
  if (!sourceVideoKey || sourceVideoKey.endsWith('/')) {
    return { ok: false, error: 'sourceVideoPath must identify one S3 video object' };
  }

  const safeApprovalId = input.approvalId.toLowerCase().replace(/[^a-z0-9._-]/g, '-').slice(0, 80);
  const jobId = `approved-video-${safeApprovalId}`;
  const jobsRoot = dependencies.jobsRoot ?? getVideoOrchestratorJobsRoot();
  const metadataDir = join(jobsRoot, jobId, 'metadata');
  const statusPath = join(metadataDir, 'status.json');
  const persistMetadata = dependencies.persistMetadata ?? writeS3MetadataJson;

  let existingStatus: Record<string, unknown> | null = null;
  try {
    existingStatus = JSON.parse(await readFile(statusPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    existingStatus = null;
  }
  if (existingStatus) {
    const executionArn = typeof existingStatus.executionArn === 'string' ? existingStatus.executionArn : null;
    return {
      ok: true,
      jobId,
      ...(executionArn ? { executionArn } : {}),
      duplicate: true,
    };
  }

  const now = new Date().toISOString();
  const topic: Record<string, unknown> = {
    jobId,
    projectId: input.projectId,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    source: 'approved-moving-video-content',
    approvalId: input.approvalId,
    createdAt: now,
  };
  const script: Record<string, unknown> = {
    jobId,
    channelId: input.projectId,
    topicId: `approved-content-${safeApprovalId}`,
    status: 'approved',
    title: input.title.trim(),
    generatedBy: 'approved-moving-video-content',
    createdAt: now,
    updatedAt: now,
    approval: {
      required: true,
      status: 'approved',
      approvedBy: 'vo-content-approval',
      approvedAt: now,
      notes: `Bound to approval ${input.approvalId}`,
      theologicalReviewRequired: false,
    },
  };
  const assets: Record<string, unknown> = {
    jobId,
    mediaSource: 'uploaded-video',
    generationMode: 'approved-source-video',
    videoSourceKey: sourceVideoKey,
    videoKey: sourceVideoKey,
    sourceVideo: { path: sourceVideoKey, source: 'approved-upload', provider: 's3' },
    aiGenerated: false,
    slideshowGenerated: false,
    fixtureUsed: false,
    approvalId: input.approvalId,
  };
  const status: Record<string, unknown> = {
    jobId,
    status: 'dispatching',
    currentStep: 'workflow_starting',
    mediaSource: 'uploaded-video',
    generationMode: 'approved-source-video',
    videoSourceKey: sourceVideoKey,
    approvalId: input.approvalId,
    createdAt: now,
    updatedAt: now,
  };

  await mkdir(metadataDir, { recursive: true });
  await Promise.all([
    writeFile(join(metadataDir, 'topic.json'), `${JSON.stringify(topic, null, 2)}\n`, 'utf-8'),
    writeFile(join(metadataDir, 'script.json'), `${JSON.stringify(script, null, 2)}\n`, 'utf-8'),
    writeFile(join(metadataDir, 'assets.json'), `${JSON.stringify(assets, null, 2)}\n`, 'utf-8'),
    writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, 'utf-8'),
    persistMetadata(jobId, 'topic.json', topic),
    persistMetadata(jobId, 'script.json', script),
    persistMetadata(jobId, 'assets.json', assets),
    persistMetadata(jobId, 'status.json', status),
  ]);

  let executionArn: string;
  try {
    executionArn = dependencies.startExecution
      ? await dependencies.startExecution({
          jobId,
          sourceVideoKey,
          mediaSource: 'uploaded-video',
          generationMode: 'approved-source-video',
        })
      : (await execFileAsync('aws', [
          'stepfunctions', 'start-execution',
          '--state-machine-arn', STATE_MACHINE_ARN,
          '--name', buildStepFunctionsExecutionName(jobId),
          '--input', JSON.stringify({
            jobId,
            videoKey: sourceVideoKey,
            sourceVideoKey,
            mediaSource: 'uploaded-video',
            generationMode: 'approved-source-video',
          }),
          '--region', AWS_REGION,
          '--query', 'executionArn',
          '--output', 'text',
          '--no-cli-pager',
        ])).stdout.trim();
  } catch (error) {
    const failedStatus: Record<string, unknown> = {
      ...status,
      status: 'failed',
      currentStep: 'workflow_start_failed',
      error: error instanceof Error ? error.message : String(error),
      updatedAt: new Date().toISOString(),
    };
    await writeFile(statusPath, `${JSON.stringify(failedStatus, null, 2)}\n`, 'utf-8');
    await persistMetadata(jobId, 'status.json', failedStatus);
    return { ok: false, jobId, error: 'Failed to start configured Step Functions execution' };
  }

  const startedStatus: Record<string, unknown> = {
    ...status,
    status: 'processing',
    currentStep: 'workflow_started',
    executionArn,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(statusPath, `${JSON.stringify(startedStatus, null, 2)}\n`, 'utf-8');
  await persistMetadata(jobId, 'status.json', startedStatus);

  return { ok: true, jobId, executionArn };
}
