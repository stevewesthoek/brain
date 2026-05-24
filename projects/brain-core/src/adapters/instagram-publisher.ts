/**
 * Instagram Graph API Video Publisher
 *
 * Implements the Instagram Reels upload flow:
 *  1. POST /{ig-user-id}/media — create media container with video URL
 *  2. Poll container status until FINISHED
 *  3. POST /{ig-user-id}/media_publish — publish the container
 *
 * NOTE: Instagram Graph API requires a publicly accessible video URL for the
 * container creation step. Local file paths are not supported by this adapter.
 *
 * Uses only Node built-ins (https) — no external dependencies.
 */

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

export interface InstagramPublishRequest {
  accessToken: string;
  accountId: string; // Instagram Business Account ID
  videoUrl: string;  // Publicly accessible URL to the video file
  caption: string;
  mediaType?: 'REELS'; // defaults to REELS
}

export interface InstagramPublishResult {
  ok: boolean;
  mediaId?: string;
  publishedUrl?: string;
  error?: string;
}

export async function publishToInstagram(request: InstagramPublishRequest): Promise<InstagramPublishResult> {
  if (!request.accessToken) {
    return { ok: false, error: 'instagram_access_token_required' };
  }
  if (!request.accountId) {
    return { ok: false, error: 'instagram_account_id_required' };
  }
  if (!request.videoUrl) {
    return { ok: false, error: 'instagram_video_url_required' };
  }

  // Step 1: Create media container
  const containerResult = await createInstagramMediaContainer(request);
  if (!containerResult.ok || !containerResult.containerId) {
    return { ok: false, error: containerResult.error ?? 'instagram_container_creation_failed' };
  }

  // Step 2: Poll container status (max 10 attempts × 3s = 30s)
  const readyResult = await waitForContainerReady(request.accessToken, containerResult.containerId);
  if (!readyResult.ok) {
    return { ok: false, error: readyResult.error ?? 'instagram_container_not_ready' };
  }

  // Step 3: Publish the container
  const publishResult = await publishInstagramContainer(
    request.accessToken,
    request.accountId,
    containerResult.containerId,
  );
  if (!publishResult.ok || !publishResult.mediaId) {
    return { ok: false, error: publishResult.error ?? 'instagram_publish_failed' };
  }

  return {
    ok: true,
    mediaId: publishResult.mediaId,
    publishedUrl: `https://www.instagram.com/reel/${publishResult.mediaId}/`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ContainerResult {
  ok: boolean;
  containerId?: string;
  error?: string;
}

async function createInstagramMediaContainer(request: InstagramPublishRequest): Promise<ContainerResult> {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      media_type: request.mediaType ?? 'REELS',
      video_url: request.videoUrl,
      caption: request.caption,
      access_token: request.accessToken,
    });

    const body = params.toString();

    const options: https.RequestOptions = {
      hostname: 'graph.instagram.com',
      path: `/v18.0/${request.accountId}/media`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
            const msg = `instagram_container_error_${String(errObj['code'] ?? 'unknown')}: ${String(errObj['message'] ?? '')}`;
            resolve({ ok: false, error: msg.slice(0, 200) });
            return;
          }
          const containerId = String(result['id'] ?? '');
          if (!containerId) {
            resolve({ ok: false, error: 'instagram_container_missing_id' });
            return;
          }
          resolve({ ok: true, containerId });
        } catch {
          resolve({ ok: false, error: 'instagram_container_parse_error' });
        }
      });
    });

    req.on('error', (err: Error) => resolve({ ok: false, error: `instagram_container_request_error_${err.message.slice(0, 80)}` }));
    req.write(body);
    req.end();
  });
}

interface StatusResult {
  ok: boolean;
  status?: string;
  errorCode?: string;
  error?: string;
}

async function waitForContainerReady(
  accessToken: string,
  containerId: string,
  maxAttempts = 10,
  delayMs = 3000,
): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise<void>((res) => setTimeout(res, delayMs));
    }

    const status = await checkContainerStatus(accessToken, containerId);
    if (!status.ok) {
      // exactOptionalPropertyTypes: only include error if it's a string
      if (status.error !== undefined) return { ok: false, error: status.error };
      return { ok: false };
    }
    if (status.status === 'FINISHED') {
      return { ok: true };
    }
    if (status.status === 'ERROR') {
      return { ok: false, error: `instagram_container_processing_error: ${status.errorCode ?? 'unknown'}` };
    }
    // IN_PROGRESS or other transient state — continue polling
  }

  return { ok: false, error: 'instagram_container_timeout_not_ready' };
}

async function checkContainerStatus(accessToken: string, containerId: string): Promise<StatusResult> {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      fields: 'status_code,status,error_code',
      access_token: accessToken,
    });

    const options: https.RequestOptions = {
      hostname: 'graph.instagram.com',
      path: `/v18.0/${containerId}?${params.toString()}`,
      method: 'GET',
    };

    const req = _transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk: unknown) => { data += String(chunk); });
      res.on('end', () => {
        try {
          const result = JSON.parse(data) as Record<string, unknown>;
          const errObj = result['error'] as Record<string, unknown> | undefined;
          if (errObj) {
            resolve({ ok: false, error: `instagram_status_error: ${String(errObj['message'] ?? '')}`.slice(0, 200) });
            return;
          }
          const statusCode = String(result['status_code'] ?? result['status'] ?? 'UNKNOWN');
          if (statusCode === 'ERROR') {
            resolve({ ok: true, status: statusCode, errorCode: String(result['error_code'] ?? 'unknown') });
          } else {
            resolve({ ok: true, status: statusCode });
          }
        } catch {
          resolve({ ok: false, error: 'instagram_status_parse_error' });
        }
      });
    });

    req.on('error', (err: Error) => resolve({ ok: false, error: `instagram_status_request_error_${err.message.slice(0, 80)}` }));
    req.end();
  });
}

async function publishInstagramContainer(
  accessToken: string,
  accountId: string,
  containerId: string,
): Promise<{ ok: boolean; mediaId?: string; error?: string }> {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken,
    });

    const body = params.toString();

    const options: https.RequestOptions = {
      hostname: 'graph.instagram.com',
      path: `/v18.0/${accountId}/media_publish`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
            const msg = `instagram_publish_error_${String(errObj['code'] ?? 'unknown')}: ${String(errObj['message'] ?? '')}`;
            resolve({ ok: false, error: msg.slice(0, 200) });
            return;
          }
          const mediaId = String(result['id'] ?? '');
          if (!mediaId) {
            resolve({ ok: false, error: 'instagram_publish_missing_media_id' });
            return;
          }
          resolve({ ok: true, mediaId });
        } catch {
          resolve({ ok: false, error: 'instagram_publish_parse_error' });
        }
      });
    });

    req.on('error', (err: Error) => resolve({ ok: false, error: `instagram_publish_request_error_${err.message.slice(0, 80)}` }));
    req.write(body);
    req.end();
  });
}
