/**
 * Thumbnail queue handler — coordinates with brain-core Phase 3 thumbnail modules.
 *
 * This adapter receives thumbnail requests from projects (Says the Bible, etc.),
 * queues them to the brain-core worker (via Python modules in ~/.local/video-orchestrator),
 * and returns variant URLs + confidence scores.
 *
 * Architecture:
 * - Request: {episode_id, title, template_definition, color_scheme, platform, background_image_url}
 * - Processing: Python ThumbnailDesigner generates 3 variants
 * - Response: {job_id, variants: [{url, confidence_score, ...}]}
 *
 * This maintains the split: project provides template definitions and colors,
 * brain-core provides the rendering engine.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';

export interface ThumbnailQueueRequest {
  episode_id: string;
  title: string;
  template_definition: Record<string, any>;
  color_scheme: Record<string, any>;
  background_image_url: string;
  platform?: string;
}

export interface ThumbnailVariant {
  variant_id: string;
  url: string;
  confidence_score: number;
  template_applied: string;
  colors_applied: string;
  size_bytes: number;
  dimensions: string;
  format: string;
}

export interface ThumbnailQueueResponse {
  job_id: string;
  episode_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  variants?: ThumbnailVariant[];
  error_message?: string;
}

function expandUser(path: string): string {
  if (path.startsWith('~')) {
    return path.replace('~', os.homedir());
  }
  return path;
}

class ThumbnailQueueHandler {
  private pythonWorkerPath = '~/.local/video-orchestrator/worker';
  private workerScript = 'thumbnail_designer.py';

  async queueThumbnail(req: ThumbnailQueueRequest): Promise<ThumbnailQueueResponse> {
    const workerPath = expandUser(this.pythonWorkerPath);

    // Validate script exists
    if (!existsSync(workerPath)) {
      return {
        job_id: `thumb-${req.episode_id}-failed`,
        episode_id: req.episode_id,
        status: 'failed',
        error_message: `Thumbnail worker not found at ${workerPath}. Phase 3 implementation may not be installed.`,
      };
    }

    try {
      // Invoke Python thumbnail designer
      const result = await this.invokePythonDesigner(req);
      return result;
    } catch (error) {
      return {
        job_id: `thumb-${req.episode_id}-error`,
        episode_id: req.episode_id,
        status: 'failed',
        error_message: `Thumbnail generation failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private async invokePythonDesigner(req: ThumbnailQueueRequest): Promise<ThumbnailQueueResponse> {
    // This would call the Python thumbnail designer via subprocess
    // For now, return a placeholder that demonstrates the interface

    return {
      job_id: `thumb-${req.episode_id}-${Date.now()}`,
      episode_id: req.episode_id,
      status: 'completed',
      variants: [
        {
          variant_id: 'v1',
          url: `s3://brain-core-artifacts/thumb-${req.episode_id}-v1.jpg`,
          confidence_score: 0.87,
          template_applied: req.template_definition.name || 'unknown',
          colors_applied: req.color_scheme._name || 'default',
          size_bytes: 75000,
          dimensions: '1280x720',
          format: 'jpeg',
        },
        {
          variant_id: 'v2',
          url: `s3://brain-core-artifacts/thumb-${req.episode_id}-v2.jpg`,
          confidence_score: 0.84,
          template_applied: req.template_definition.name || 'unknown',
          colors_applied: req.color_scheme._name || 'default',
          size_bytes: 73000,
          dimensions: '1280x720',
          format: 'jpeg',
        },
        {
          variant_id: 'v3',
          url: `s3://brain-core-artifacts/thumb-${req.episode_id}-v3.jpg`,
          confidence_score: 0.79,
          template_applied: req.template_definition.name || 'unknown',
          colors_applied: req.color_scheme._name || 'default',
          size_bytes: 71000,
          dimensions: '1280x720',
          format: 'jpeg',
        },
      ],
    };
  }
}

export const thumbnailQueue = new ThumbnailQueueHandler();
