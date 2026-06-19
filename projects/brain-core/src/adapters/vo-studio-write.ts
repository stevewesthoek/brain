import { requestAction } from './actions.js';
import { createVOApproval } from './vo-studio-approval-store.js';
import { generateVideoOrchestratorMetadata } from './video-orchestrator-metadata-generator.js';
import { readVOStudioContentItem, registerRuntimeContentItem, findRuntimeContentItem } from './video-orchestrator-studio-model.js';
import type { ContentItem } from '../types/vo-studio.js';

export interface CreateContentItemRequest {
  projectId: string;
  title: string;
  description: string;
  sourceAudioPath?: string;
  backgroundImagePath?: string;
  sourceVideoPath?: string;
}

export interface CreateContentItemResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    contentItem: ContentItem;
  };
  error?: string;
}

export function createContentItemRequest(
  request: CreateContentItemRequest,
): CreateContentItemResponse {
  const errors: string[] = [];
  const sourceVideoPath = request.sourceVideoPath?.trim() || '';
  const sourceAudioPath = request.sourceAudioPath?.trim() || '';
  const backgroundImagePath = request.backgroundImagePath?.trim() || '';

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.title?.trim()) {
    errors.push('title is required');
  }
  if (!sourceVideoPath && !sourceAudioPath) {
    errors.push('sourceVideoPath or sourceAudioPath is required');
  }
  if (!sourceVideoPath && !backgroundImagePath) {
    errors.push('backgroundImagePath is required for the legacy audio/image contract');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  // Phase 1W: create a VO-specific approval record before committing the write.
  // The write is NOT committed yet — it is stored as pending until the operator approves.
  const voApproval = createVOApproval('content', request.projectId, {
    title: request.title,
    description: request.description,
    sourceAudioPath,
    backgroundImagePath,
    sourceVideoPath: sourceVideoPath || null,
  });

  const contentItemId = generateContentItemId();
  const now = new Date().toISOString();

  const contentItem: ContentItem = {
    id: contentItemId,
    projectId: request.projectId,
    title: request.title,
    description: request.description || '',
    status: 'queued',
    sourceAudioPath,
    backgroundImagePath,
    sourceVideoPath: sourceVideoPath || null,
    durationSec: null,
    language: 'en',
    createdAt: now,
    updatedAt: now,
  };

  const result = requestAction('custom-content-item-create');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  registerRuntimeContentItem(contentItem);

  return {
    ok: true,
    approval: {
      id: voApproval.id,
      status: voApproval.status,
    },
    preview: {
      contentItem,
    },
  };
}

function generateContentItemId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `content-${timestamp}-${random}`;
}

export interface UpdateContentItemRequest {
  projectId: string;
  contentItemId: string;
  title?: string;
  description?: string;
  sourceVideoPath?: string | null;
}

export interface UpdateContentItemResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    contentItem: ContentItem;
  };
  error?: string;
}

export function updateContentItemRequest(
  request: UpdateContentItemRequest,
): UpdateContentItemResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.contentItemId?.trim()) {
    errors.push('contentItemId is required');
  }
  if (request.title !== undefined && !request.title?.trim()) {
    errors.push('title cannot be empty');
  }
  if (request.description !== undefined && typeof request.description !== 'string') {
    errors.push('description must be a string');
  }
  if (request.sourceVideoPath !== undefined && request.sourceVideoPath !== null && !request.sourceVideoPath.trim()) {
    errors.push('sourceVideoPath cannot be empty');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  // Phase 1W: create a VO-specific approval record before committing the write.
  const updatePayload: Record<string, unknown> = { contentItemId: request.contentItemId };
  if (request.title !== undefined) updatePayload.title = request.title;
  if (request.description !== undefined) updatePayload.description = request.description;
  if (request.sourceVideoPath !== undefined) {
    updatePayload.sourceVideoPath = request.sourceVideoPath?.trim() || null;
  }
  const voApproval = createVOApproval('content', request.projectId, updatePayload);

  const now = new Date().toISOString();
  const contentItem: ContentItem = {
    id: request.contentItemId,
    projectId: request.projectId,
    title: request.title || '',
    description: request.description ?? '',
    status: 'queued',
    sourceAudioPath: '',
    backgroundImagePath: '',
    sourceVideoPath: request.sourceVideoPath?.trim() || null,
    durationSec: null,
    language: 'en',
    createdAt: now,
    updatedAt: now,
  };

  const result = requestAction('custom-content-item-update');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    approval: {
      id: voApproval.id,
      status: voApproval.status,
    },
    preview: {
      contentItem,
    },
  };
}

export interface GenerateThumbnailRequest {
  projectId: string;
  contentItemId: string;
  templateId?: string;
  boldText?: string;
}

export interface GenerateThumbnailResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    job: {
      id: string;
      type: string;
      contentItemId: string;
      status: string;
    };
  };
  error?: string;
}

export function generateThumbnailRequest(
  request: GenerateThumbnailRequest,
): GenerateThumbnailResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.contentItemId?.trim()) {
    errors.push('contentItemId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  // Phase 1W: create a VO-specific approval record before committing the write.
  const thumbPayload: Record<string, unknown> = { contentItemId: request.contentItemId };
  if (request.templateId !== undefined) thumbPayload.templateId = request.templateId;
  if (request.boldText !== undefined) thumbPayload.boldText = request.boldText;
  const voApproval = createVOApproval('thumbnail', request.projectId, thumbPayload);

  const jobId = `job-thumbnail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-thumbnail-generate');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    approval: {
      id: voApproval.id,
      status: voApproval.status,
    },
    preview: {
      job: {
        id: jobId,
        type: 'thumbnail',
        contentItemId: request.contentItemId,
        status: 'pending_approval',
      },
    },
  };
}

export interface ApproveThumbnailRequest {
  projectId: string;
  contentItemId: string;
  variantId: string;
}

export interface ApproveThumbnailResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    approval: {
      id: string;
      type: string;
      contentItemId: string;
      variantId: string;
      status: string;
    };
  };
  error?: string;
}

export function approveThumbnailRequest(
  request: ApproveThumbnailRequest,
): ApproveThumbnailResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.contentItemId?.trim()) {
    errors.push('contentItemId is required');
  }
  if (!request.variantId?.trim()) {
    errors.push('variantId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const approval = createVOApproval(
    'thumbnail',
    request.projectId.trim(),
    {
      contentItemId: request.contentItemId.trim(),
      variantId: request.variantId.trim(),
      requiredBefore: 'youtube_publish',
    },
  );

  return {
    ok: true,
    approval: {
      id: approval.id,
      status: approval.status,
    },
    preview: {
      approval: {
        id: approval.id,
        type: 'thumbnail',
        contentItemId: request.contentItemId.trim(),
        variantId: request.variantId.trim(),
        status: approval.status,
      },
    },
  };
}

export interface GenerateMetadataRequest {
  projectId: string;
  contentItemId: string;
  templateId?: string;
}

export interface GenerateMetadataResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    job: {
      id: string;
      type: string;
      contentItemId: string;
      status: string;
    };
    metadata?: {
      youtubeTitle: string;
      youtubeDescription: string;
      youtubeTags: string[];
      tiktokCaption: string;
      instagramCaption: string;
      hashtags: string[];
      platforms: Record<string, { title: string; description: string; tags: string[]; hashtags: string[] }>;
      source: 'ai' | 'fallback';
      provider?: string;
      model?: string;
    };
  };
  error?: string;
}

export async function generateMetadataRequest(
  request: GenerateMetadataRequest,
): Promise<GenerateMetadataResponse> {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.contentItemId?.trim()) {
    errors.push('contentItemId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const studioItem = readVOStudioContentItem(request.contentItemId.trim());
  const runtimeItem = findRuntimeContentItem(request.contentItemId.trim());
  const contentItemTitle = studioItem?.title ?? runtimeItem?.title;
  const contentItemProjectId = studioItem?.projectId ?? runtimeItem?.projectId;
  const contentItemId = studioItem?.id ?? runtimeItem?.id;
  if (!contentItemId || !contentItemTitle || !contentItemProjectId) {
    return {
      ok: false,
      error: `contentItemId not found: ${request.contentItemId.trim()}`,
    };
  }
  if (contentItemProjectId !== request.projectId.trim()) {
    return {
      ok: false,
      error: 'contentItemId does not belong to projectId',
    };
  }

  // Phase 1W: generate YouTube metadata from the canonical moving-video content item.
  const metaPayload: Record<string, unknown> = {
    contentItemId: contentItemId,
    targetPlatform: 'youtube',
  };
  if (request.templateId !== undefined) metaPayload.templateId = request.templateId;
  const result = requestAction('custom-metadata-generate');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const canonicalSource = studioItem?.canonicalSource ?? runtimeItem?.description ?? '';
  const metadata = await generateVideoOrchestratorMetadata({
    projectId: contentItemProjectId,
    contentItemId: contentItemId,
    title: contentItemTitle,
    description: canonicalSource,
    targetPlatforms: ['youtube'],
    ...(request.templateId !== undefined ? { templateId: request.templateId } : {}),
  });

  const voApproval = createVOApproval('metadata', request.projectId, {
    ...metaPayload,
    generatedMetadata: metadata,
  });

  const jobId = `job-metadata-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    ok: true,
    approval: {
      id: voApproval.id,
      status: voApproval.status,
    },
    preview: {
      job: {
        id: jobId,
        type: 'metadata',
        contentItemId: request.contentItemId,
        status: 'pending_approval',
      },
      metadata: {
        ...metadata,
      },
    },
  };
}

export interface ApproveMetadataRequest {
  projectId: string;
  contentItemId: string;
  variantId: string;
}

export interface ApproveMetadataResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    approval: {
      id: string;
      type: string;
      contentItemId: string;
      variantId: string;
      status: string;
    };
  };
  error?: string;
}

export function approveMetadataRequest(
  request: ApproveMetadataRequest,
): ApproveMetadataResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.contentItemId?.trim()) {
    errors.push('contentItemId is required');
  }
  if (!request.variantId?.trim()) {
    errors.push('variantId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const approval = createVOApproval(
    'metadata',
    request.projectId.trim(),
    {
      contentItemId: request.contentItemId.trim(),
      variantId: request.variantId.trim(),
      requiredBefore: 'youtube_publish',
      targetPlatform: 'youtube',
    },
  );

  return {
    ok: true,
    approval: {
      id: approval.id,
      status: approval.status,
    },
    preview: {
      approval: {
        id: approval.id,
        type: 'metadata',
        contentItemId: request.contentItemId.trim(),
        variantId: request.variantId.trim(),
        status: approval.status,
      },
    },
  };
}

export interface PostingTarget {
  platformId: string;
  accountId: string;
}

export interface QueuePackageRequest {
  projectId: string;
  contentItemId: string;
  pipelineProfileId: string;
  postingTargets: PostingTarget[];
}

export interface QueuePackageResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    package: {
      id: string;
      contentItemId: string;
      pipelineProfileId: string;
      status: string;
      postingTargets: Array<{
        platformId: string;
        accountId: string;
        status: string;
      }>;
    };
  };
  error?: string;
}

export function queuePackageRequest(
  request: QueuePackageRequest,
): QueuePackageResponse {
  const errors: string[] = [];

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.contentItemId?.trim()) {
    errors.push('contentItemId is required');
  }
  if (!request.pipelineProfileId?.trim()) {
    errors.push('pipelineProfileId is required');
  }
  if (!Array.isArray(request.postingTargets) || request.postingTargets.length === 0) {
    errors.push('postingTargets must be a non-empty array');
  }

  for (let i = 0; i < (request.postingTargets?.length ?? 0); i++) {
    const target = request.postingTargets[i];
    if (!target?.platformId?.trim()) {
      errors.push(`postingTargets[${i}].platformId is required`);
    }
    if (!target?.accountId?.trim()) {
      errors.push(`postingTargets[${i}].accountId is required`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  // Phase 1W: create a VO-specific approval record before committing the write.
  const voApproval = createVOApproval('package', request.projectId, {
    contentItemId: request.contentItemId,
    pipelineProfileId: request.pipelineProfileId,
    postingTargets: request.postingTargets,
  });

  const packageId = `pkg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-package-queue');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    approval: {
      id: voApproval.id,
      status: voApproval.status,
    },
    preview: {
      package: {
        id: packageId,
        contentItemId: request.contentItemId,
        pipelineProfileId: request.pipelineProfileId,
        status: 'queued',
        postingTargets: request.postingTargets.map((target) => ({
          platformId: target.platformId,
          accountId: target.accountId,
          status: 'pending',
        })),
      },
    },
  };
}

export interface EditPackageRequest {
  packageId: string;
  postingTargets?: PostingTarget[];
  stageOverrides?: Record<string, string>;
}

export interface EditPackageResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    package: {
      id: string;
      status: string;
      modifiedFields: string[];
    };
  };
  error?: string;
}

export function editPackageRequest(
  request: EditPackageRequest,
): EditPackageResponse {
  const errors: string[] = [];

  if (!request.packageId?.trim()) {
    errors.push('packageId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const modifiedFields: string[] = [];
  if (request.postingTargets) {
    modifiedFields.push('postingTargets');
  }
  if (request.stageOverrides) {
    modifiedFields.push('stageOverrides');
  }

  const result = requestAction('custom-package-edit');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      package: {
        id: request.packageId,
        status: 'modified',
        modifiedFields,
      },
    },
  };
}

export interface CancelPackageRequest {
  packageId: string;
  reason: string;
}

export interface CancelPackageResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    package: {
      id: string;
      status: string;
      cancelledAt: string;
      reason: string;
    };
  };
  error?: string;
}

export function cancelPackageRequest(
  request: CancelPackageRequest,
): CancelPackageResponse {
  const errors: string[] = [];

  if (!request.packageId?.trim()) {
    errors.push('packageId is required');
  }
  if (!request.reason?.trim()) {
    errors.push('reason is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-package-cancel');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      package: {
        id: request.packageId,
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        reason: request.reason,
      },
    },
  };
}

export interface RetryPackageRequest {
  packageId: string;
  stageId?: string;
}

export interface RetryPackageResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    package: {
      id: string;
      status: string;
      retryStage?: string;
      retryCount: number;
    };
  };
  error?: string;
}

export function retryPackageRequest(
  request: RetryPackageRequest,
): RetryPackageResponse {
  const errors: string[] = [];

  if (!request.packageId?.trim()) {
    errors.push('packageId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-package-retry');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const preview: {
    package: {
      id: string;
      status: string;
      retryStage?: string;
      retryCount: number;
    };
  } = {
    package: {
      id: request.packageId,
      status: 'retrying',
      retryCount: 1,
    },
  };

  if (request.stageId !== undefined) {
    preview.package.retryStage = request.stageId;
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview,
  };
}

export interface FinalApprovalRequest {
  packageId: string;
  notes?: string;
}

export interface FinalApprovalResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    approval: {
      id: string;
      type: string;
      packageId: string;
      status: string;
    };
  };
  error?: string;
}

export function finalApprovalRequest(
  request: FinalApprovalRequest,
): FinalApprovalResponse {
  const errors: string[] = [];

  if (!request.packageId?.trim()) {
    errors.push('packageId is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const approvalId = `approval-final-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-final-approval');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview: {
      approval: {
        id: approvalId,
        type: 'final_review',
        packageId: request.packageId,
        status: 'approved',
      },
    },
  };
}

export interface PublishPackageRequest {
  packageId: string;
  jobId: string;
  postingTarget: PostingTarget;
  confirmation: string;
  scheduleAt?: string;
}

export interface PublishPackageResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    package: {
      id: string;
      jobId: string;
      status: string;
      postingTarget: PostingTarget;
      publishedAt?: string;
    };
  };
  error?: string;
}

export function publishPackageRequest(
  request: PublishPackageRequest,
): PublishPackageResponse {
  const errors: string[] = [];

  if (!request.packageId?.trim()) {
    errors.push('packageId is required');
  }
  if (!request.jobId?.trim()) {
    errors.push('jobId is required');
  }
  if (!request.postingTarget?.platformId?.trim()) {
    errors.push('postingTarget.platformId is required');
  } else if (request.postingTarget.platformId.trim() !== 'youtube') {
    errors.push('postingTarget.platformId must be youtube');
  }
  if (!request.postingTarget?.accountId?.trim()) {
    errors.push('postingTarget.accountId is required');
  }
  if (!request.confirmation?.trim()) {
    errors.push('confirmation is required');
  }
  if (request.scheduleAt !== undefined) {
    errors.push('scheduled publishing is not supported for the direct YouTube upload path');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-package-publish');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const preview: {
    package: {
      id: string;
      jobId: string;
      status: string;
      postingTarget: PostingTarget;
      publishedAt?: string;
    };
  } = {
    package: {
      id: request.packageId.trim(),
      jobId: request.jobId.trim(),
      status: 'publishing',
      postingTarget: {
        platformId: 'youtube',
        accountId: request.postingTarget.accountId.trim(),
      },
      publishedAt: new Date().toISOString(),
    },
  };

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview,
  };
}

export interface BatchPublishRequest {
  packageIds: string[];
  scheduleAt?: string;
}

export interface BatchPublishResponse {
  ok: boolean;
  approval?: {
    id: string;
    status: string;
  };
  preview?: {
    batch: {
      packageCount: number;
      status: string;
      scheduledAt?: string;
    };
  };
  error?: string;
}

export function batchPublishRequest(
  request: BatchPublishRequest,
): BatchPublishResponse {
  const errors: string[] = [];

  if (!Array.isArray(request.packageIds) || request.packageIds.length === 0) {
    errors.push('packageIds must be a non-empty array');
  }

  for (let i = 0; i < (request.packageIds?.length ?? 0); i++) {
    if (!request.packageIds[i]?.trim()) {
      errors.push(`packageIds[${i}] is required`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const result = requestAction('custom-batch-publish');

  if (!result.accepted) {
    return {
      ok: false,
      error: result.message,
    };
  }

  const preview: {
    batch: {
      packageCount: number;
      status: string;
      scheduledAt?: string;
    };
  } = {
    batch: {
      packageCount: request.packageIds.length,
      status: request.scheduleAt ? 'scheduled' : 'publishing',
    },
  };

  if (request.scheduleAt !== undefined) {
    preview.batch.scheduledAt = request.scheduleAt;
  }

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
    preview,
  };
}
