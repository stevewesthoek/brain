/**
 * TikTok Video Publisher — Content Posting API v2
 *
 * Implements the 3-step TikTok upload flow:
 *  1. Init upload session → get upload_url + video_id
 *  2. PUT video bytes to upload_url
 *  3. POST publish confirm with metadata → video goes live
 *
 * Uses only Node built-ins (https, fs) — no external dependencies.
 */

import fs from 'node:fs';
import https from 'node:https';
import type { IncomingMessage } from 'node:http';

/** Minimal interface for the request handle — avoids optional-method type errors. */
interface ReqHandle {
  on(event: string, handler: (err: Error) => void): void;
  write(data: string | Buffer): boolean;
  end(): void;
}

/** Minimal interface for the response handle — avoids optional-method type errors. */
interface ResHandle {
  on(event: string, handler: (...args: unknown[]) => void): void;
  readonly statusCode?: number;
}

/**
 * Overridable transport layer — replace in tests to avoid real network calls.
 */
export const _transport = {
  request: (options: https.RequestOptions, callback: (res: ResHandle) => void): ReqHandle =>
    https.request(options, callback as (res: IncomingMessage) => void) as unknown as ReqHandle,
};

export interface TikTokPublishRequest {
  accessToken: string;
  videoPath: string;
  title: string;
  description: string;
  tags?: string[];
}

export interface TikTokPublishResult {
  ok: boolean;
  videoId?: string;
  publishedUrl?: string;
  error?: string;
}

export async function publishToTikTok(request: TikTokPublishRequest): Promise<TikTokPublishResult> {
  if (!request.accessToken) {
    return { ok: false, error: 'tiktok_access_token_required' };
  }
  if (!fs.existsSync(request.videoPath)) {
    return { ok: false, error: 'video_file_not_found' };
  }

  // Step 1: Initialize upload session
  const initResult = await initTikTokUpload(request.accessToken);
  if (!initResult.ok || !initResult.uploadUrl || !initResult.videoId) {
    return { ok: false, error: initResult.error ?? 'tiktok_upload_init_failed' };
  }

  // Step 2: Upload video bytes
  const uploadResult = await uploadVideoToTikTok(initResult.uploadUrl, request.videoPath);
  if (!uploadResult.ok) {
    return { ok: false, error: uploadResult.error ?? 'tiktok_upload_failed' };
  }

  // Step 3: Publish with metadata
  const caption = request.description
    ? `${request.title}\n\n${request.description}`
    : request.title;

  const publishResult = await finalizeTikTokPublish(request.accessToken, initResult.videoId, {
    caption,
    disable_comment: false,
    disable_duet: false,
    disable_stitch: false,
  });

  if (!publishResult.ok) {
    return { ok: false, error: publishResult.error ?? 'tiktok_publish_finalize_failed' };
  }

  return {
    ok: true,
    videoId: initResult.videoId,
    publishedUrl: `https://www.tiktok.com/@user/video/${initResult.videoId}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

interface InitResult {
  ok: boolean;
  uploadUrl?: string;
  videoId?: string;
  error?: string;
}

async function initTikTokUpload(accessToken: string): Promise<InitResult> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      source_info: {
        source: 'FILE_UPLOAD',
        chunk_size: 5242880, // 5 MB
      },
    });

    const options: https.RequestOptions = {
      hostname: 'open.tiktokapis.com',
      path: '/v2/post/publish/inbox/video/init/',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = _transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: unknown) => { data += String(chunk); });
      res.on('end', () => {
        try {
          const result = JSON.parse(data) as Record<string, unknown>;
          const errObj = result['error'] as Record<string, unknown> | undefined;
          if (errObj) {
            const code = String(errObj['code'] ?? '');
            if (code && code !== 'ok') {
              resolve({ ok: false, error: String(errObj['message'] ?? code) });
              return;
            }
          }
          const dataObj = result['data'] as Record<string, unknown> | undefined;
          if (!dataObj) {
            resolve({ ok: false, error: 'tiktok_init_response_missing_data' });
            return;
          }
          const uploadUrl = String(dataObj['upload_url'] ?? '');
          const videoId = String(dataObj['video_id'] ?? dataObj['publish_id'] ?? '');
          if (!uploadUrl || !videoId) {
            resolve({ ok: false, error: 'tiktok_init_missing_url_or_id' });
            return;
          }
          resolve({ ok: true, uploadUrl, videoId });
        } catch {
          resolve({ ok: false, error: 'tiktok_init_parse_error' });
        }
      });
    });

    req.on('error', (err: Error) => resolve({ ok: false, error: `tiktok_init_request_error_${err.message.slice(0, 80)}` }));
    req.write(body);
    req.end();
  });
}

async function uploadVideoToTikTok(uploadUrl: string, videoPath: string): Promise<{ ok: boolean; error?: string }> {
  // Cast required: strict TS overloads for readFileSync don't include 'binary' in this tsconfig,
  // but at runtime this returns a Buffer for the PUT upload.
  const videoBuffer = fs.readFileSync(videoPath, 'utf8' as Parameters<typeof fs.readFileSync>[1]) as unknown as Buffer;
  const parsedUrl = new URL(uploadUrl);

  return new Promise((resolve) => {
    const options: https.RequestOptions = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': videoBuffer.length,
        'Content-Range': `bytes 0-${videoBuffer.length - 1}/${videoBuffer.length}`,
      },
    };

    const req = _transport.request(options, (res) => {
      const sc = res.statusCode;
      if (sc !== undefined && sc >= 200 && sc < 300) {
        resolve({ ok: true });
        return;
      }
      let errBody = '';
      res.on('data', (chunk: unknown) => { errBody += String(chunk); });
      res.on('end', () => resolve({ ok: false, error: `tiktok_upload_http_${sc ?? 'unknown'}: ${errBody.slice(0, 120)}` }));
    });

    req.on('error', (err: Error) => resolve({ ok: false, error: `tiktok_upload_request_error_${err.message.slice(0, 80)}` }));
    req.write(videoBuffer);
    req.end();
  });
}

async function finalizeTikTokPublish(
  accessToken: string,
  videoId: string,
  metadata: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      video_id: videoId,
      post_info: {
        title: String(metadata['caption'] ?? ''),
        disable_comment: Boolean(metadata['disable_comment'] ?? false),
        disable_duet: Boolean(metadata['disable_duet'] ?? false),
        disable_stitch: Boolean(metadata['disable_stitch'] ?? false),
      },
    });

    const options: https.RequestOptions = {
      hostname: 'open.tiktokapis.com',
      path: '/v2/post/publish/video/init/',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = _transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: unknown) => { data += String(chunk); });
      res.on('end', () => {
        try {
          const result = JSON.parse(data) as Record<string, unknown>;
          const errObj = result['error'] as Record<string, unknown> | undefined;
          if (errObj) {
            const code = String(errObj['code'] ?? '');
            if (code && code !== 'ok') {
              resolve({ ok: false, error: String(errObj['message'] ?? code) });
              return;
            }
          }
          resolve({ ok: true });
        } catch {
          const sc = res.statusCode;
          if (sc !== undefined && sc >= 200 && sc < 300) {
            resolve({ ok: true });
          } else {
            resolve({ ok: false, error: 'tiktok_publish_parse_error' });
          }
        }
      });
    });

    req.on('error', (err: Error) => resolve({ ok: false, error: `tiktok_publish_request_error_${err.message.slice(0, 80)}` }));
    req.write(body);
    req.end();
  });
}
