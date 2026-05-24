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
