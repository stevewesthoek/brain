import {
  getVideoJob,
  getVideoJobArtifacts,
  getVideoJobExecutionStatus,
  getVideoReview,
  getVideoJobTimeline,
  checkPublishAssetsAvailable,
  readPublishCheckStatus,
  type VideoReviewMedia,
  type VideoReviewResponse,
} from '../providers/video-orchestrator-provider.js';

export interface ControlPlaneSelectedJob {
  jobId: string;
  title: string;
  status: string;
  approvalStatus: string;
  mediaSource: string | null;
  generationMode: string | null;
  updatedAt: string | null;
}

export interface ControlPlaneExecutionView {
  status: string | null;
  awsStatus: string | null;
  localStatus: string | null;
  localStep: string | null;
  executionArn: string | null;
  startedAt: string | null;
  stoppedAt: string | null;
  checkedAt: string | null;
  unavailableReason: string | undefined;
}

export interface ControlPlaneArtifactsView {
  status: string | null;
  mediaSource: string | null;
  generationMode: string | null;
  scenePlanKey: string | null;
  narrationScriptKey: string | null;
  audioKey: string | null;
  sceneImageKeys: string[];
  videoKey: string | null;
  finalVideoKey: string | null;
  thumbnailKey: string | null;
  publishKey: string | null;
  youtubePackageKey: string | null;
  overlayPlanKey: string | null;
  motionPlanKey: string | null;
  downloadableVideoUrl: string | null;
  unavailableReason: string | undefined;
}

export interface ControlPlaneReviewView {
  status: string | null;
  reviewStatus: string | null;
  media: VideoReviewMedia | null;
  createdAt: string | null;
  updatedAt: string | null;
  reviewedAt: string | null;
  notes: string | null;
}

export interface ControlPlanePublishView {
  status: string | null;
  dryRunStatus: string | null;
  uploadStatus: string | null;
  quotaStatus: string | null;
  videoId: string | null;
  url: string | null;
  downloadableVideoUrl: string | null;
}

export interface ControlPlaneFinalizationView {
  status: 'not_required' | 'pending' | 'complete' | 'failed' | null;
  attempted: boolean;
  ok: boolean;
  repaired: string[];
  missingFields: string[];
  error: string | undefined;
  updatedAt: string | null;
}

export interface ControlPlaneMissingRequirement {
  field: string;
  label: string;
}

export interface VideoOrchestratorControlPlane {
  jobId: string;
  channelId: string;
  prompt: string | null;
  title: string | null;
  phase: string;
  canonicalPhase: string;
  phaseStatus: string;
  progress: number | null;
  selectedJob: ControlPlaneSelectedJob;
  execution: ControlPlaneExecutionView;
  artifacts: ControlPlaneArtifactsView;
  review: ControlPlaneReviewView;
  publish: ControlPlanePublishView;
  finalization: ControlPlaneFinalizationView;
  allowedActions: Record<string, { enabled: boolean; reason: string | undefined }>;
  missingRequirements: ControlPlaneMissingRequirement[];
  warnings: string[];
  errors: string[];
  updatedAt: string;
}

function deriveCanonicalPhase(job: Record<string, any> | null): string {
  if (!job) return 'unknown';
  const status = job?.status ?? 'unknown';
  const approval = job?.approval?.status ?? null;

  if (status === 'published' || status === 'uploaded') return 'published';
  if (status === 'ready_to_publish' || status === 'publish_ready') return 'ready_to_publish';
  if (status === 'publishing') return 'publishing';
  if (status === 'generating' || status === 'generation_in_progress') return 'generating';
  if (status === 'ready_to_generate' && approval === 'approved') return 'ready_to_generate';
  if (approval === 'pending') return 'awaiting_script_approval';
  if (status === 'draft' || !status) return 'draft';
  return status;
}

function isExecutionAvailable(job: Record<string, any> | null, execution: Record<string, any> | null): boolean {
  if (!execution) return false;
  const status = execution?.status;
  return typeof status === 'string' && status !== 'not_available';
}

function isArtifactsAvailable(artifacts: Record<string, any> | null): boolean {
  if (!artifacts) return false;
  // Artifacts are available if they have meaningful content beyond empty object
  const keys = Object.keys(artifacts).filter(k => !k.startsWith('ok'));
  return keys.length > 0;
}

function computeAllowedActions(
  job: Record<string, any> | null,
  reviewData: Record<string, any> | null,
  reviewMedia: VideoReviewMedia | null,
  artifacts: Record<string, any> | null,
  publishAssetsAvailable: boolean,
  dryRunPassed: boolean,
): Record<string, { enabled: boolean; reason: string | undefined }> {
  const jobStatus = job?.status ?? 'unknown';
  const approvalStatus = job?.approval?.status ?? 'pending';
  const reviewStatus = reviewData?.reviewStatus ?? null;

  const mediaComplete = !!(
    reviewMedia?.videoKey &&
    reviewMedia?.thumbnailKey &&
    reviewMedia?.scenePlanKey &&
    reviewMedia?.narrationScriptKey &&
    reviewMedia?.audioKey
  );

  const videoAvailable = !!(artifacts?.videoKey || artifacts?.finalVideoKey);

  const readyToPublish = ['ready_to_publish'].includes(jobStatus);

  return {
    approve_script: {
      enabled: approvalStatus === 'pending',
      reason: approvalStatus !== 'pending' ? `Script already ${approvalStatus}` : undefined,
    },
    generate: {
      enabled:
        approvalStatus === 'approved' &&
        !['generating', 'ready_to_publish', 'published', 'uploaded'].includes(jobStatus),
      reason: approvalStatus !== 'approved' ? 'Awaiting script approval' : undefined,
    },
    approve_review: {
      enabled: mediaComplete && reviewStatus !== 'approved',
      reason:
        reviewStatus === 'approved'
          ? 'Review already approved'
          : !mediaComplete
            ? 'Media generation incomplete'
            : undefined,
    },
    dry_run: {
      enabled: reviewStatus === 'approved' && readyToPublish && publishAssetsAvailable,
      reason:
        reviewStatus !== 'approved'
          ? 'Awaiting review approval'
          : !readyToPublish
            ? 'Not ready to publish'
            : !publishAssetsAvailable
              ? 'Final video/thumbnail assets not available locally or in S3'
              : undefined,
    },
    publish_private: {
      enabled: reviewStatus === 'approved' && readyToPublish && publishAssetsAvailable && dryRunPassed,
      reason:
        reviewStatus !== 'approved'
          ? 'Awaiting review approval'
          : !readyToPublish
            ? 'Not ready to publish'
            : !publishAssetsAvailable
              ? 'Final video/thumbnail assets not available locally or in S3'
              : !dryRunPassed
                ? 'Dry-run must pass before private publish'
                : undefined,
    },
    download_video: {
      enabled: videoAvailable,
      reason: !videoAvailable ? 'Video not yet available' : undefined,
    },
  };
}

function computeMissingRequirements(reviewMedia: VideoReviewMedia | null): ControlPlaneMissingRequirement[] {
  if (!reviewMedia) {
    return [
      { field: 'scenePlanKey', label: 'Scene plan' },
      { field: 'narrationScriptKey', label: 'Narration script' },
      { field: 'audioKey', label: 'Narration audio' },
      { field: 'videoKey', label: 'Final MP4' },
      { field: 'thumbnailKey', label: 'Thumbnail' },
    ];
  }

  const requiredFields: Array<keyof VideoReviewMedia> = [
    'scenePlanKey',
    'narrationScriptKey',
    'audioKey',
    'videoKey',
    'thumbnailKey',
  ];

  const labels: Record<keyof VideoReviewMedia, string> = {
    scenePlanKey: 'Scene plan',
    narrationScriptKey: 'Narration script',
    audioKey: 'Narration audio',
    sceneImageKeys: 'Scene images',
    videoKey: 'Final MP4',
    thumbnailKey: 'Thumbnail',
    publishKey: 'Publish JSON',
    youtubePackageKey: 'YouTube package',
    overlayPlanKey: 'Overlay plan',
  };

  const missing: ControlPlaneMissingRequirement[] = [];
  for (const field of requiredFields) {
    if (!reviewMedia[field]) {
      missing.push({ field, label: labels[field] });
    }
  }

  return missing;
}

function computeFinalizationState(
  artifacts: Record<string, any> | null,
  reviewMedia: VideoReviewMedia | null,
): ControlPlaneFinalizationView {
  const finInfo = artifacts?.finalization as Record<string, any> | null;

  if (finInfo) {
    const mediaComplete = !!(
      reviewMedia?.videoKey &&
      reviewMedia?.thumbnailKey &&
      reviewMedia?.scenePlanKey &&
      reviewMedia?.narrationScriptKey &&
      reviewMedia?.audioKey
    );

    return {
      status: mediaComplete ? 'complete' : finInfo.ok ? 'complete' : 'pending',
      attempted: finInfo.attempted ?? false,
      ok: finInfo.ok ?? false,
      repaired: Array.isArray(finInfo.repaired) ? finInfo.repaired : [],
      missingFields: Array.isArray(finInfo.missing) ? finInfo.missing : [],
      error: finInfo.error ?? undefined,
      updatedAt: null,
    };
  }

  return {
    status: null,
    attempted: false,
    ok: false,
    repaired: [],
    missingFields: [],
    error: undefined,
    updatedAt: null,
  };
}

export async function getVideoOrchestratorControlPlane(
  jobId: string,
  fastPath: boolean = false,
): Promise<VideoOrchestratorControlPlane | null> {
  // Fast path: skip finalization repair and expensive S3 operations for read-only control-plane queries
  // Only read local job metadata and execution status, no S3 inference or repairs
  const job = fastPath
    ? await getVideoJob(jobId, { skipS3Inference: true, skipAwsReconciliation: true })
    : await getVideoJob(jobId);

  const [execution, review] = await Promise.all([
    getVideoJobExecutionStatus(jobId, fastPath),
    getVideoReview(jobId, fastPath),
  ]);

  if (!job) {
    return null;
  }

  const jobData = job as Record<string, any>;
  const executionData = (execution as Record<string, any>) ?? null;

  // Fix reviewData extraction: review.ok means review.review contains the metadata
  const reviewData = review?.ok ? (review as VideoReviewResponse).review : null;

  // For fast path, skip finalization repairs and S3 operations
  // Use review.media as the source of truth (canonical state at time of approval)
  let artifactsData: Record<string, any> = {};
  if (!fastPath) {
    // Slow path: full artifact resolution with finalization repairs (S3 existence checks, etc.)
    const artifacts = await getVideoJobArtifacts(jobId);
    artifactsData = (artifacts as Record<string, any>) ?? {};
  } else {
    // Fast path: construct from job summary + review metadata only
    // No S3 operations, no repairs, just the authoritative review state
    const jobArtifacts = jobData?.artifacts ?? {};
    artifactsData = {
      scenePlanKey: `jobs/${jobId}/metadata/scene-plan.json`,
      narrationScriptKey: `jobs/${jobId}/audio/narration-script.txt`,
      audioKey: `jobs/${jobId}/audio/narration.mp3`,
      videoKey: jobArtifacts?.finalVideo ?? `jobs/${jobId}/exports/generated-001-final.mp4`,
      thumbnailKey: jobArtifacts?.thumbnail ?? `jobs/${jobId}/exports/thumbnail-001.jpg`,
      publishKey: `jobs/${jobId}/metadata/publish.json`,
      youtubePackageKey: `jobs/${jobId}/metadata/youtube-package.json`,
    };
  }

  // Use review.media as canonical source for fast path
  // In slow path, finalization may have repaired it
  const reviewMediaFromReview = reviewData?.media ?? null;
  const reviewMedia: VideoReviewMedia | null = reviewMediaFromReview ?? (
    artifactsData?.videoKey ? {
      scenePlanKey: (artifactsData.scenePlanKey as string | null) ?? null,
      narrationScriptKey: (artifactsData.narrationScriptKey as string | null) ?? null,
      audioKey: (artifactsData.audioKey as string | null) ?? null,
      sceneImageKeys: Array.isArray(artifactsData.sceneImageKeys) ? (artifactsData.sceneImageKeys as string[]) : [],
      videoKey: (artifactsData.videoKey as string | null) ?? null,
      thumbnailKey: (artifactsData.thumbnailKey as string | null) ?? null,
      publishKey: (artifactsData.publishKey as string | null) ?? null,
      youtubePackageKey: (artifactsData.youtubePackageKey as string | null) ?? null,
      overlayPlanKey: (artifactsData.overlayPlanKey as string | null) ?? null,
    } : null
  );

  const canonicalPhase = deriveCanonicalPhase(jobData);
  const executionAvailable = isExecutionAvailable(jobData, executionData);
  const artifactsAvailable = isArtifactsAvailable(artifactsData);

  const [publishAssetsAvailable, publishCheckStatus] = await Promise.all([
    checkPublishAssetsAvailable(jobId, fastPath),
    readPublishCheckStatus(jobId),
  ]);
  const dryRunPassed = publishCheckStatus?.dryRunPassed === true;

  const finalization = computeFinalizationState(artifactsData, reviewMedia);
  const allowedActions = computeAllowedActions(jobData, reviewData, reviewMedia, artifactsData, publishAssetsAvailable, dryRunPassed);
  const missingRequirements = computeMissingRequirements(reviewMedia);

  const warnings: string[] = [];
  const errors: string[] = [];

  // Check for internal terms in metadata
  if (jobData?.youtubePackage?.metadataQuality?.hasInternalTerms) {
    errors.push('YouTube metadata contains internal terms (AWS, Bedrock, Polly, FFmpeg, etc.)');
  }

  // Check for overlay plan issues
  if (jobData?.generationMode === 'hybrid_image_slideshow_video') {
    if (!artifactsData?.overlayPlanKey && !jobData?.overlayPlan) {
      errors.push('Hybrid image slideshow missing overlay plan');
    }
  }

  return {
    jobId,
    channelId: jobData?.channelId ?? '',
    prompt: jobData?.prompt ?? null,
    title: jobData?.title ?? null,
    phase: canonicalPhase,
    canonicalPhase,
    phaseStatus: jobData?.status ?? 'unknown',
    progress: jobData?.progress ?? null,
    selectedJob: {
      jobId,
      title: jobData?.title ?? '',
      status: jobData?.status ?? 'unknown',
      approvalStatus: jobData?.approval?.status ?? 'pending',
      mediaSource: jobData?.mediaSource ?? null,
      generationMode: jobData?.generationMode ?? null,
      updatedAt: jobData?.updatedAt ?? null,
    },
    execution: {
      status: executionData?.status ?? null,
      awsStatus: executionData?.awsStatus ?? null,
      localStatus: executionData?.localStatus ?? null,
      localStep: executionData?.localStep ?? null,
      executionArn: executionData?.executionArn ?? null,
      startedAt: executionData?.startDate ?? null,
      stoppedAt: executionData?.stopDate ?? null,
      checkedAt: executionData?.checkedAt ?? null,
      unavailableReason: executionAvailable ? undefined : 'Execution data not available',
    },
    artifacts: {
      status: artifactsAvailable ? 'available' : null,
      mediaSource: artifactsData?.mediaSource ?? null,
      generationMode: artifactsData?.generationMode ?? null,
      scenePlanKey: artifactsData?.scenePlanKey ?? null,
      narrationScriptKey: artifactsData?.narrationScriptKey ?? null,
      audioKey: artifactsData?.audioKey ?? null,
      sceneImageKeys: Array.isArray(artifactsData?.sceneImageKeys) ? artifactsData.sceneImageKeys : [],
      videoKey: artifactsData?.videoKey ?? null,
      finalVideoKey: artifactsData?.finalVideo ?? null,
      thumbnailKey: artifactsData?.thumbnail ?? null,
      publishKey: artifactsData?.publishKey ?? null,
      youtubePackageKey: artifactsData?.youtubePackageKey ?? null,
      overlayPlanKey: artifactsData?.overlayPlanKey ?? null,
      motionPlanKey: artifactsData?.motionPlan ? Object.keys(artifactsData.motionPlan).length > 0 ? 'motion-plan.json' : null : null,
      downloadableVideoUrl: null,
      unavailableReason: artifactsAvailable ? undefined : 'Artifacts not yet generated',
    },
    review: {
      status: reviewData?.reviewStatus ?? null,
      reviewStatus: reviewData?.reviewStatus ?? null,
      media: reviewMedia,
      createdAt: reviewData?.createdAt ?? null,
      updatedAt: reviewData?.updatedAt ?? null,
      reviewedAt: reviewData?.reviewedAt ?? null,
      notes: reviewData?.notes ?? null,
    },
    publish: {
      status: jobData?.publishing?.status ?? null,
      dryRunStatus: jobData?.publishing?.dryRunStatus ?? null,
      uploadStatus: jobData?.publishing?.uploadStatus ?? null,
      quotaStatus: jobData?.publishing?.quotaStatus ?? null,
      videoId: jobData?.publishing?.videoId ?? null,
      url: jobData?.publishing?.url ?? null,
      downloadableVideoUrl: null,
    },
    finalization,
    allowedActions,
    missingRequirements,
    warnings,
    errors,
    updatedAt: new Date().toISOString(),
  };
}
