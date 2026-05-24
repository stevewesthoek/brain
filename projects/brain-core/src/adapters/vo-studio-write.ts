import { requestAction } from './actions.js';
import type { BrainCoreActionRequestResult } from '../types/api.js';
import type { ContentItem } from '../types/vo-studio.js';

export interface CreateContentItemRequest {
  projectId: string;
  title: string;
  description: string;
  sourceAudioPath: string;
  backgroundImagePath: string;
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

  if (!request.projectId?.trim()) {
    errors.push('projectId is required');
  }
  if (!request.title?.trim()) {
    errors.push('title is required');
  }
  if (!request.sourceAudioPath?.trim()) {
    errors.push('sourceAudioPath is required');
  }
  if (!request.backgroundImagePath?.trim()) {
    errors.push('backgroundImagePath is required');
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const contentItemId = generateContentItemId();
  const now = new Date().toISOString();

  const contentItem: ContentItem = {
    id: contentItemId,
    projectId: request.projectId,
    title: request.title,
    description: request.description || '',
    status: 'queued',
    sourceAudioPath: request.sourceAudioPath,
    backgroundImagePath: request.backgroundImagePath,
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

  return {
    ok: true,
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
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

  if (errors.length > 0) {
    return {
      ok: false,
      error: errors.join('; '),
    };
  }

  const now = new Date().toISOString();
  const contentItem: ContentItem = {
    id: request.contentItemId,
    projectId: request.projectId,
    title: request.title || '',
    description: request.description ?? '',
    status: 'queued',
    sourceAudioPath: '',
    backgroundImagePath: '',
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
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
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
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
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

  const approvalId = `approval-thumbnail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-thumbnail-approve');

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
        type: 'thumbnail',
        contentItemId: request.contentItemId,
        variantId: request.variantId,
        status: 'pending_approval',
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
  };
  error?: string;
}

export function generateMetadataRequest(
  request: GenerateMetadataRequest,
): GenerateMetadataResponse {
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

  const jobId = `job-metadata-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-metadata-generate');

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
      job: {
        id: jobId,
        type: 'metadata',
        contentItemId: request.contentItemId,
        status: 'pending_approval',
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

  const approvalId = `approval-metadata-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const result = requestAction('custom-metadata-approve');

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
        type: 'metadata',
        contentItemId: request.contentItemId,
        variantId: request.variantId,
        status: 'pending_approval',
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
    ...(result.approval && {
      approval: {
        id: result.approval.id,
        status: result.approval.status,
      },
    }),
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
      status: string;
      publishedAt?: string;
      scheduledAt?: string;
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
      status: string;
      publishedAt?: string;
      scheduledAt?: string;
    };
  } = {
    package: {
      id: request.packageId,
      status: request.scheduleAt ? 'scheduled' : 'publishing',
    },
  };

  if (request.scheduleAt !== undefined) {
    preview.package.scheduledAt = request.scheduleAt;
  } else {
    preview.package.publishedAt = new Date().toISOString();
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
