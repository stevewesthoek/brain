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
import { existsSync, readFileSync, statSync } from 'node:fs';

function isValidYoutubeJpeg(path: string): boolean {
  try {
    const stat = statSync(path);
    if (stat.size < 4) return false;

    const bytes = readFileSync(path, null as any) as unknown as Buffer;
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      return false;
    }

    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }

      const marker = bytes[offset + 1]!;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }

      const segmentLength = bytes.readUInt16BE(offset + 2);
      if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return false;

      const isStartOfFrame = marker === 0xc0 || marker === 0xc1 || marker === 0xc2;
      if (isStartOfFrame) {
        if (segmentLength < 7) return false;
        const height = bytes.readUInt16BE(offset + 5);
        const width = bytes.readUInt16BE(offset + 7);
        return width === 1280 && height === 720;
      }

      offset += 2 + segmentLength;
    }

    return false;
  } catch {
    return false;
  }
}
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
  private readonly defaultPythonWorkerPath = decodeURIComponent(
    new URL('../../scripts/thumbnail/thumbnail_designer.py', import.meta.url).pathname,
  );

  private getPythonWorkerPath(): string {
    return process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH?.trim() || this.defaultPythonWorkerPath;
  }

  async queueThumbnail(req: ThumbnailQueueRequest): Promise<ThumbnailQueueResponse> {
    const workerPath = this.getPythonWorkerPath();

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
    return new Promise((resolve) => {
      const cliPath = this.getPythonWorkerPath();

      // Validate CLI exists
      if (!existsSync(cliPath)) {
        resolve({
          job_id: `thumb-${req.episode_id}-failed`,
          episode_id: req.episode_id,
          status: 'failed',
          error_message: `CLI entry point not found at ${cliPath}`,
        });
        return;
      }

      const pythonInput = JSON.stringify({
        episode_id: req.episode_id,
        title: req.title,
        background_image_url: req.background_image_url,
        template_definition: req.template_definition,
        color_scheme: req.color_scheme,
        platform: req.platform || 'youtube',
      });

      const child = spawn('python3', [cliPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000, // 60-second timeout
      });

      let stdout = '';
      let stderr = '';
      let completed = false;

      // Capture output
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle completion
      child.on('close', (code) => {
        if (completed) return;
        completed = true;

        if (code !== 0) {
          resolve({
            job_id: `thumb-${req.episode_id}-exit-${code}`,
            episode_id: req.episode_id,
            status: 'failed' as const,
            error_message: `Python process exited with code ${code}. stderr: ${stderr}`,
          });
          return;
        }

        try {
          const result = JSON.parse(stdout) as {
            status: string;
            job_id: string;
            episode_id: string;
            variants?: Array<{
              variant_id: string;
              url: string;
              confidence_score: number;
              template_applied: string;
              colors_applied: string;
              size_bytes: number;
              dimensions: string;
              format: string;
            }>;
            error_message?: string;
          };

          // Validate response structure
          if (!result.status || !result.job_id) {
            resolve({
              job_id: result.job_id || `thumb-${req.episode_id}-malformed`,
              episode_id: req.episode_id,
              status: 'failed' as const,
              error_message: 'Malformed worker response: missing status or job_id',
            });
            return;
          }

          // Validate status is a known value
          const validStatuses = ['pending', 'in_progress', 'completed', 'failed'];
          if (!validStatuses.includes(result.status)) {
            resolve({
              job_id: result.job_id,
              episode_id: req.episode_id,
              status: 'failed' as const,
              error_message: `Unknown worker status: ${result.status}`,
            });
            return;
          }

          // Verify artifact files exist if success
          if (result.status === 'completed' && result.variants) {
            const validVariants = result.variants.filter((variant) => isValidYoutubeJpeg(variant.url));

            if (validVariants.length < 2) {
              resolve({
                job_id: result.job_id,
                episode_id: req.episode_id,
                status: 'failed',
                error_message: `Expected at least 2 variants with real files, found ${validVariants.length}`,
              });
              return;
            }

            resolve({
              job_id: result.job_id,
              episode_id: req.episode_id,
              status: result.status,
              variants: validVariants,
            });
            return;
          }

          const response: ThumbnailQueueResponse = {
            job_id: result.job_id,
            episode_id: req.episode_id,
            status: result.status as 'pending' | 'in_progress' | 'completed' | 'failed',
          };
          if (result.variants !== undefined) {
            response.variants = result.variants;
          }
          if (result.error_message !== undefined) {
            response.error_message = result.error_message;
          }
          resolve(response);
        } catch (parseError) {
          resolve({
            job_id: `thumb-${req.episode_id}-parse-error`,
            episode_id: req.episode_id,
            status: 'failed',
            error_message: `Failed to parse worker output: ${parseError instanceof Error ? parseError.message : String(parseError)}. stdout: ${stdout}`,
          });
        }
      });

      // Handle process error
      child.on('error', (err) => {
        if (completed) return;
        completed = true;
        resolve({
          job_id: `thumb-${req.episode_id}-spawn-error`,
          episode_id: req.episode_id,
          status: 'failed',
          error_message: `Failed to spawn process: ${err.message}`,
        });
      });

      // Handle timeout
      const timeout = setTimeout(() => {
        if (completed) return;
        completed = true;
        child.kill();
        resolve({
          job_id: `thumb-${req.episode_id}-timeout`,
          episode_id: req.episode_id,
          status: 'failed',
          error_message: 'Worker process timeout (60s)',
        });
      }, 60000);

      child.on('close', () => clearTimeout(timeout));

      // Send input
      try {
        child.stdin?.write(pythonInput);
        child.stdin?.end();
      } catch (writeError) {
        if (completed) return;
        completed = true;
        resolve({
          job_id: `thumb-${req.episode_id}-write-error`,
          episode_id: req.episode_id,
          status: 'failed',
          error_message: `Failed to write to process stdin: ${writeError instanceof Error ? writeError.message : String(writeError)}`,
        });
      }
    });
  }
}

export const thumbnailQueue = new ThumbnailQueueHandler();
