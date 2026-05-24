/**
 * TikTok OAuth2 Authorization Flow
 *
 * Implements the TikTok Login Kit v1 OAuth2 authorization code flow.
 * Uses only Node built-ins (https) — no external dependencies.
 *
 * Flow:
 *  1. Generate auth URL → user visits → TikTok redirects with ?code=
 *  2. Exchange code for access_token + refresh_token
 *
 * Env vars:
 *   TIKTOK_CLIENT_ID     — TikTok app key (client_key)
 *   TIKTOK_CLIENT_SECRET — TikTok app secret
 */

import https from 'node:https';
import type { IncomingMessage } from 'node:http';

// Read at call time so tests can override via process.env after module import
const TIKTOK_REDIRECT_URI = 'http://localhost:4877/api/video-orchestrator/auth/tiktok/callback';

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

export function getTikTokAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_key: process.env['TIKTOK_CLIENT_ID'] ?? '',
    redirect_uri: TIKTOK_REDIRECT_URI,
    scope: 'user.info.basic,video.upload,video.publish',
    response_type: 'code',
    state,
  });
  return `https://www.tiktok.com/v1/oauth/authorize?${params.toString()}`;
}

export interface TikTokTokenResult {
  ok: boolean;
  accessToken?: string;
  refreshToken?: string;
  openId?: string;
  expiresIn?: number;
  error?: string;
}

export async function exchangeTikTokCode(code: string): Promise<TikTokTokenResult> {
  const clientId = process.env['TIKTOK_CLIENT_ID'] ?? '';
  const clientSecret = process.env['TIKTOK_CLIENT_SECRET'] ?? '';
  if (!clientId || !clientSecret) {
    return { ok: false, error: 'tiktok_credentials_not_configured' };
  }
  if (!code) {
    return { ok: false, error: 'code_required' };
  }

  return new Promise((resolve) => {
    const body = JSON.stringify({
      client_key: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: TIKTOK_REDIRECT_URI,
    });

    const options: https.RequestOptions = {
      hostname: 'open.tiktokapis.com',
      path: '/v1/oauth/token/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
            resolve({ ok: false, error: String(errObj['message'] ?? errObj['code'] ?? 'tiktok_api_error') });
            return;
          }
          const dataObj = result['data'] as Record<string, unknown> | undefined;
          if (!dataObj) {
            resolve({ ok: false, error: 'tiktok_response_missing_data' });
            return;
          }
          const tokenResult: TikTokTokenResult = {
            ok: true,
            accessToken: String(dataObj['access_token'] ?? ''),
            refreshToken: String(dataObj['refresh_token'] ?? ''),
            openId: String(dataObj['open_id'] ?? ''),
          };
          const expiresIn = dataObj['expires_in'];
          if (typeof expiresIn === 'number') {
            tokenResult.expiresIn = expiresIn;
          }
          resolve(tokenResult);
        } catch {
          resolve({ ok: false, error: 'tiktok_response_parse_error' });
        }
      });
    });

    req.on('error', (err: Error) => resolve({ ok: false, error: `tiktok_request_error_${err.message.slice(0, 80)}` }));
    req.write(body);
    req.end();
  });
}
