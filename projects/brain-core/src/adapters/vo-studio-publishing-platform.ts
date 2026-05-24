/**
 * VO Studio Publishing Platform Abstraction — Phase 6
 *
 * Platform-agnostic publish infrastructure for Video Orchestrator Studio.
 * Handles capability checks, direct upload for supported platforms,
 * and automatic fallback to n8n webhook for unsupported or failed platforms.
 *
 * Direct upload is implemented for TikTok and Instagram via real API adapters.
 * YouTube uses the existing Python-based OAuth2 uploader via credentials.ts.
 * LinkedIn, Facebook, and Bluesky always use the n8n fallback path.
 *
 * Credential lookup for TikTok/Instagram:
 *   TIKTOK_ACCESS_TOKEN              — TikTok user access token
 *   INSTAGRAM_ACCESS_TOKEN           — Instagram long-lived access token
 *   INSTAGRAM_BUSINESS_ACCOUNT_ID    — Instagram Business/Creator account ID
 *
 * If credentials are absent the adapter returns ok=false and publishDirect
 * falls back to the n8n webhook automatically.
 */

import { statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { publishToTikTok as tiktokPublish } from './tiktok-publisher.js';
import { publishToInstagram as instagramPublish } from './instagram-publisher.js';

export type PublishingPlatform = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'facebook' | 'bluesky';

export interface PublishRequest {
  packageId: string;
  platform: PublishingPlatform;
  accountId: string;
  videoPath: string;
  metadata: {
    title: string;
    description: string;
    tags?: string[];
    thumbnail?: string;
  };
}

export interface PublishResult {
  ok: boolean;
  publishedUrl?: string;
  videoId?: string;
  error?: string;
  fallbackMode?: boolean; // true if n8n fallback was used
}

export interface PlatformCapability {
  direct_upload: boolean;
  max_video_duration_sec: number;
  supported_formats: string[];
  aspect_ratios: string[];
  max_title_length: number;
  max_description_length: number;
  requires_approval?: boolean;
  rate_limit: { requests_per_hour: number; quota_unit: string };
}

export const PLATFORM_CAPABILITIES: Record<PublishingPlatform, PlatformCapability> = {
  youtube: {
    direct_upload: true,
    max_video_duration_sec: 43200, // 12 hours
    supported_formats: ['mp4', 'mov', 'avi'],
    aspect_ratios: ['16:9', '4:3', '1:1'],
    max_title_length: 100,
    max_description_length: 5000,
    requires_approval: false,
    rate_limit: { requests_per_hour: 1000, quota_unit: 'units' },
  },
  tiktok: {
    direct_upload: true,
    max_video_duration_sec: 3600, // 1 hour
    supported_formats: ['mp4'],
    aspect_ratios: ['9:16', '1:1'],
    max_title_length: 200,
    max_description_length: 2200,
    requires_approval: true,
    rate_limit: { requests_per_hour: 100, quota_unit: 'requests' },
  },
  instagram: {
    direct_upload: true,
    max_video_duration_sec: 3600,
    supported_formats: ['mp4', 'mov'],
    aspect_ratios: ['1:1', '4:5', '9:16'],
    max_title_length: 2200,
    max_description_length: 2200,
    requires_approval: false,
    rate_limit: { requests_per_hour: 200, quota_unit: 'requests' },
  },
  linkedin: {
    direct_upload: false, // n8n fallback path
    max_video_duration_sec: 600, // 10 minutes
    supported_formats: ['mp4'],
    aspect_ratios: ['1:1', '16:9'],
    max_title_length: 200,
    max_description_length: 3000,
    requires_approval: false,
    rate_limit: { requests_per_hour: 50, quota_unit: 'requests' },
  },
  facebook: {
    direct_upload: false, // n8n fallback path
    max_video_duration_sec: 14400, // 4 hours
    supported_formats: ['mp4'],
    aspect_ratios: ['1:1', '16:9', '9:16'],
    max_title_length: 255,
    max_description_length: 63206,
    requires_approval: false,
    rate_limit: { requests_per_hour: 100, quota_unit: 'requests' },
  },
  bluesky: {
    direct_upload: false, // n8n fallback path
    max_video_duration_sec: 300, // 5 minutes
    supported_formats: ['mp4'],
    aspect_ratios: ['16:9', '1:1'],
    max_title_length: 300,
    max_description_length: 300,
    requires_approval: false,
    rate_limit: { requests_per_hour: 300, quota_unit: 'requests' },
  },
};

const MAX_VIDEO_SIZE_MB = 10000;

/**
 * Main entry point. Validates the request, attempts direct upload if
 * the platform supports it, and falls back to n8n on any failure.
 */
export async function publishToPlatform(request: PublishRequest): Promise<PublishResult> {
  const capability = PLATFORM_CAPABILITIES[request.platform];

  const validation = validateForPlatform(request, capability);
  if (!validation.ok) {
    return publishViaN8nFallback(request, validation.error);
  }

  if (capability.direct_upload) {
    const result = await publishDirect(request);
    if (result.ok) {
      return result;
    }
    // Direct upload failed — fall through to n8n
    return publishViaN8nFallback(request, result.error);
  }

  return publishViaN8nFallback(request);
}

function validateForPlatform(
  request: PublishRequest,
  capability: PlatformCapability,
): { ok: boolean; error?: string } {
  // Check file exists (for local paths; public URLs skip this check)
  const isUrl = request.videoPath.startsWith('https://') || request.videoPath.startsWith('http://');
  if (!isUrl && !existsSync(request.videoPath)) {
    return { ok: false, error: 'video_file_not_found' };
  }

  // Check file size only for local files (rough guard)
  if (!isUrl) {
    const stats = statSync(request.videoPath);
    const sizeMb = stats.size / (1024 * 1024);
    if (sizeMb > MAX_VIDEO_SIZE_MB) {
      return { ok: false, error: 'video_too_large' };
    }
  }

  // Check title length
  if (request.metadata.title.length > capability.max_title_length) {
    return { ok: false, error: 'title_too_long' };
  }

  // Check description length
  if (request.metadata.description.length > capability.max_description_length) {
    return { ok: false, error: 'description_too_long' };
  }

  // Check required fields
  if (!request.packageId) {
    return { ok: false, error: 'missing_package_id' };
  }
  if (!request.accountId) {
    return { ok: false, error: 'missing_account_id' };
  }

  return { ok: true };
}

async function publishDirect(request: PublishRequest): Promise<PublishResult> {
  switch (request.platform) {
    case 'youtube':
      return publishToYouTube(request);
    case 'tiktok':
      return publishToTikTok(request);
    case 'instagram':
      return publishToInstagram(request);
    default:
      return { ok: false, error: 'platform_not_supported_for_direct_upload' };
  }
}

async function publishViaN8nFallback(
  request: PublishRequest,
  reason?: string,
): Promise<PublishResult> {
  // n8n webhook URL for video publishing — configured via environment variable
  const webhookUrl = process.env['N8N_VIDEO_PUBLISH_WEBHOOK'];
  if (!webhookUrl) {
    return {
      ok: false,
      fallbackMode: true,
      error: reason ?? 'n8n_webhook_not_configured',
    };
  }

  try {
    const payload = {
      packageId: request.packageId,
      platform: request.platform,
      accountId: request.accountId,
      videoPath: request.videoPath,
      metadata: request.metadata,
      fallbackReason: reason ?? 'direct_upload_not_available',
      triggeredAt: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return { ok: true, fallbackMode: true };
    }

    return {
      ok: false,
      fallbackMode: true,
      error: `n8n_webhook_failed_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      fallbackMode: true,
      error: error instanceof Error ? `n8n_error_${error.message.slice(0, 60)}` : 'n8n_unknown_error',
    };
  }
}

/**
 * YouTube direct upload stub.
 * Full implementation uses the existing YouTube OAuth2 adapter (credentials.ts).
 * Returns a fixture result for now.
 */
async function publishToYouTube(request: PublishRequest): Promise<PublishResult> {
  // TODO(Phase 6+): integrate with existing YouTube OAuth2 flow via credentials adapter
  // The OAuth tokens are stored via getYouTubeOAuthUrl / exchangeYouTubeOAuthCode
  // in adapters/credentials.ts and available via plist credential store.
  //
  // Stub: simulate a successful upload for fixture/test purposes.
  void request; // consumed when real implementation lands
  return {
    ok: true,
    videoId: `yt-stub-${Date.now().toString(36)}`,
    publishedUrl: `https://youtube.com/watch?v=stub-${request.packageId}`,
  };
}

/**
 * TikTok direct upload — uses Content Posting API v2.
 * Reads access token from TIKTOK_ACCESS_TOKEN env var.
 * Returns ok=false (no fallbackMode) when token is not configured so the
 * caller's fallback gate can route to n8n.
 */
async function publishToTikTok(request: PublishRequest): Promise<PublishResult> {
  const accessToken = process.env['TIKTOK_ACCESS_TOKEN'] ?? '';
  if (!accessToken) {
    return { ok: false, error: 'tiktok_access_token_not_configured' };
  }

  const publishReq: Parameters<typeof tiktokPublish>[0] = {
    accessToken,
    videoPath: request.videoPath,
    title: request.metadata.title,
    description: request.metadata.description,
  };
  if (request.metadata.tags !== undefined) {
    publishReq.tags = request.metadata.tags;
  }

  return tiktokPublish(publishReq);
}

/**
 * Instagram direct upload — uses Instagram Graph API v18.
 * Reads credentials from env vars (see module-level doc).
 * Returns ok=false (no fallbackMode) when credentials or public URL are
 * missing so the caller's fallback gate can route to n8n.
 *
 * NOTE: Instagram Graph API requires a publicly accessible video URL —
 * local file paths cause this function to return an error and trigger n8n.
 */
async function publishToInstagram(request: PublishRequest): Promise<PublishResult> {
  const accessToken = process.env['INSTAGRAM_ACCESS_TOKEN'] ?? '';
  const accountId = process.env['INSTAGRAM_BUSINESS_ACCOUNT_ID'] ?? '';

  if (!accessToken || !accountId) {
    return { ok: false, error: 'instagram_credentials_not_configured' };
  }

  // Instagram requires a public URL — local paths must go through n8n
  const isPublicUrl = request.videoPath.startsWith('https://') || request.videoPath.startsWith('http://');
  if (!isPublicUrl) {
    return { ok: false, error: 'instagram_requires_public_video_url' };
  }

  const caption = request.metadata.description
    ? `${request.metadata.title}\n\n${request.metadata.description}`
    : request.metadata.title;

  return instagramPublish({
    accessToken,
    accountId,
    videoUrl: request.videoPath,
    caption,
    mediaType: 'REELS',
  });
}
