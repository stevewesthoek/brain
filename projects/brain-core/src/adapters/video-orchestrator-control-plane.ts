import {
  getVideoJob,
  getVideoJobArtifacts,
  getVideoJobExecutionStatus,
  getVideoReview,
  getVideoJobTimeline,
} from '../providers/video-orchestrator-provider.js';

export interface ControlPlaneExecutionView {
  status: string | null;
  unavailableReason: string | undefined;
}

export interface ControlPlaneArtifactsView {
  status: string | null;
  unavailableReason: string | undefined;
}

export interface ControlPlaneReviewView {
  status: string | null;
  reviewStatus: string | null | undefined;
  media: Record<string, unknown> | null | undefined;
}

export interface ControlPlanePubhishView {
  status: string | null;
  publishStatus: string | null | undefined;
}

export interface ControlPlaneFinalizationView {
  status: 'pending' | 'complete' | 'failed' | null;
  reason: string | undefined;
}

export interface ControlPlaneAllowedAction {
  action: string;
  enabled: boolean;
  reason: string | undefined;
}

export interface ControlPlaneMissingRequirement {
  field: string;
  label: string;
}

export interface VideoOrchestratorControlPlane {
  jobId: string;
  prompt?: string | null;
  title?: string | null;
  canonicalPhase: string;
  phaseStatus: string;
  progress?: number | null;
  execution: ControlPlaneExecutionView;
  artifacts: ControlPlaneArtifactsView;
  review: ControlPlaneReviewView;
  publish: ControlPlanePubhishView;
  finalization: ControlPlaneFinalizationView;
  allowedActions: ControlPlaneAllowedAction[];
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
  artifacts: Record<string, any> | null,
  review: Record<string, any> | null,
  execution: Record<string, any> | null,
): ControlPlaneAllowedAction[] {
  const actions: ControlPlaneAllowedAction[] = [];
  const jobStatus = job?.status ?? 'unknown';
  const approvalStatus = job?.approval?.status ?? 'pending';
  const reviewStatus = review?.reviewStatus ?? null;

  // Approve script: enabled when approval is pending
  actions.push({
    action: 'approve_script',
    enabled: approvalStatus === 'pending',
    reason: approvalStatus !== 'pending' ? `Script already ${approvalStatus}` : undefined,
  });

  // Generate: enabled when approval is approved and job is not generating/done
  actions.push({
    action: 'generate',
    enabled:
      approvalStatus === 'approved' &&
      !['generating', 'ready_to_publish', 'published', 'uploaded'].includes(jobStatus),
    reason: approvalStatus !== 'approved' ? 'Awaiting script approval' : undefined,
  });

  // Approve review: enabled when review is pending and media is complete
  const mediaComplete =
    artifacts?.scenePlanKey &&
    artifacts?.narrationScriptKey &&
    artifacts?.audioKey &&
    artifacts?.videoKey &&
    artifacts?.thumbnailKey;
  actions.push({
    action: 'approve_review',
    enabled: reviewStatus !== 'approved' && mediaComplete === true,
    reason:
      reviewStatus === 'approved'
        ? 'Review already approved'
        : !mediaComplete
          ? 'Media generation incomplete'
          : undefined,
  });

  // Dry-run: enabled when review is approved
  actions.push({
    action: 'youtube_dry_run',
    enabled: reviewStatus === 'approved' && ['ready_to_publish'].includes(jobStatus),
    reason:
      reviewStatus !== 'approved'
        ? 'Awaiting review approval'
        : !['ready_to_publish'].includes(jobStatus)
          ? 'Not ready to publish'
          : undefined,
  });

  // Publish: enabled when review approved and dry-run passed
  actions.push({
    action: 'youtube_publish',
    enabled: reviewStatus === 'approved' && jobStatus === 'ready_to_publish',
    reason:
      reviewStatus !== 'approved'
        ? 'Awaiting review approval'
        : jobStatus !== 'ready_to_publish'
          ? 'Not ready to publish'
          : undefined,
  });

  return actions;
}

function computeMissingRequirements(artifacts: Record<string, any> | null): ControlPlaneMissingRequirement[] {
  const missing: ControlPlaneMissingRequirement[] = [];

  if (!artifacts) {
    return [
      { field: 'scenePlanKey', label: 'Scene plan' },
      { field: 'narrationScriptKey', label: 'Narration script' },
      { field: 'audioKey', label: 'Narration audio' },
      { field: 'videoKey', label: 'Final MP4' },
      { field: 'thumbnailKey', label: 'Thumbnail' },
    ];
  }

  const requiredFields = [
    { key: 'scenePlanKey', label: 'Scene plan' },
    { key: 'narrationScriptKey', label: 'Narration script' },
    { key: 'audioKey', label: 'Narration audio' },
    { key: 'videoKey', label: 'Final MP4' },
    { key: 'thumbnailKey', label: 'Thumbnail' },
  ];

  for (const field of requiredFields) {
    if (!artifacts[field.key]) {
      missing.push({ field: field.key, label: field.label });
    }
  }

  return missing;
}

function computeFinalizationState(
  job: Record<string, any> | null,
  artifacts: Record<string, any> | null,
): ControlPlaneFinalizationView {
  if (!job) return { status: null, reason: undefined };

  const jobStatus = job?.status ?? 'unknown';

  // If all media is ready, finalization is complete
  if (
    artifacts?.scenePlanKey &&
    artifacts?.narrationScriptKey &&
    artifacts?.audioKey &&
    artifacts?.videoKey &&
    artifacts?.thumbnailKey
  ) {
    return { status: 'complete', reason: undefined };
  }

  // If job is generating, finalization is pending
  if (jobStatus === 'generating') {
    return { status: 'pending', reason: 'Generating media assets' };
  }

  // If job has failed or stalled, finalization failed
  if (jobStatus === 'failed' || jobStatus === 'error') {
    return { status: 'failed', reason: jobStatus };
  }

  return { status: null, reason: undefined };
}

export async function getVideoOrchestratorControlPlane(
  jobId: string,
): Promise<VideoOrchestratorControlPlane | null> {
  const [job, artifacts, execution, review] = await Promise.all([
    getVideoJob(jobId),
    getVideoJobArtifacts(jobId),
    getVideoJobExecutionStatus(jobId),
    getVideoReview(jobId),
  ]);

  if (!job) {
    return null;
  }

  const jobData = job as Record<string, any>;
  const artifactsData = (artifacts as Record<string, any>) ?? {};
  const executionData = (execution as Record<string, any>) ?? null;
  const reviewData = (review?.ok ? (review as Record<string, any>) : null) ?? null;

  const canonicalPhase = deriveCanonicalPhase(jobData);
  const executionAvailable = isExecutionAvailable(jobData, executionData);
  const artifactsAvailable = isArtifactsAvailable(artifactsData);

  const finalization = computeFinalizationState(jobData, artifactsData);
  const allowedActions = computeAllowedActions(jobData, artifactsData, reviewData, executionData);
  const missingRequirements = computeMissingRequirements(artifactsAvailable ? artifactsData : null);

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
    prompt: jobData?.prompt ?? null,
    title: jobData?.title ?? null,
    canonicalPhase,
    phaseStatus: jobData?.status ?? 'unknown',
    progress: jobData?.progress ?? null,
    execution: {
      status: executionData?.status ?? null,
      unavailableReason: executionAvailable ? undefined : 'Execution data not available',
    },
    artifacts: {
      status: artifactsAvailable ? 'available' : null,
      unavailableReason: artifactsAvailable ? undefined : 'Artifacts not yet generated',
    },
    review: {
      status: reviewData?.reviewStatus ?? null,
      reviewStatus: reviewData?.reviewStatus ?? null,
      media: reviewData?.media ?? null,
    },
    publish: {
      status: jobData?.publishing?.status ?? null,
      publishStatus: jobData?.publishing?.status ?? null,
    },
    finalization,
    allowedActions,
    missingRequirements,
    warnings,
    errors,
    updatedAt: new Date().toISOString(),
  };
}
