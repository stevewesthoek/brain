import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { BrainCoreInfraVOWorkerConfigResponse } from '../types/api.js';

const PLIST_PATH = path.join(
  process.env.HOME || '/Users/Office',
  'Library/LaunchAgents/com.office.video-orchestrator-worker.plist',
);

const YT_UPLOADER_PATH = path.join(
  process.env.HOME || '/Users/Office',
  '.local/video-orchestrator/scripts/youtube_uploader.py',
);

const VENV_PYTHON = path.join(
  process.env.HOME || '/Users/Office',
  '.local/video-orchestrator/.venv/bin/python3',
);

function readPlistEnv(): Record<string, string> {
  if (!existsSync(PLIST_PATH)) return {};
  try {
    const xml = readFileSync(PLIST_PATH, 'utf8');
    const env: Record<string, string> = {};
    // Parse EnvironmentVariables dict from plist XML
    const envMatch = /<key>EnvironmentVariables<\/key>\s*<dict>([\s\S]*?)<\/dict>/.exec(xml);
    if (!envMatch) return {};
    const block = envMatch[1] ?? '';
    const pairs = [...block.matchAll(/<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g)];
    for (const [, k, v] of pairs) {
      if (k) env[k] = v ?? '';
    }
    return env;
  } catch {
    return {};
  }
}

function getYoutubeOauthAccounts(): string[] {
  // Query keychain for yt-oauth account names only (no -g flag to avoid exposing passwords)
  try {
    const out = execFileSync('security', ['find-generic-password', '-s', 'video-orchestrator'], {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000,
    });
    const accounts: string[] = [];
    for (const line of out.split('\n')) {
      const m = /"acct"<blob>="(yt-oauth-[^"]+)"/.exec(line)
        ?? /acct.*"(yt-oauth-[^"]+)"/.exec(line);
      if (m?.[1]) accounts.push(m[1].replace('yt-oauth-', ''));
    }
    return accounts;
  } catch {
    return [];
  }
}

function checkN8nReachable(webhookUrl: string): { reachable: boolean | null; error: string | null } {
  if (!webhookUrl) return { reachable: null, error: 'VO_N8N_WEBHOOK_URL not configured' };
  try {
    // Use curl with a 3s timeout for a quick HEAD check (no POST)
    const statusCode = execFileSync(
      'curl',
      ['-s', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '3', '--head', webhookUrl],
      { encoding: 'utf8', timeout: 5000 },
    ).trim();
    const code = parseInt(statusCode, 10);
    // 403 = CF Access blocking (not configured) — treat as unreachable
    if (code === 403) return { reachable: false, error: `HTTP ${code} — Cloudflare Access blocked (service token not configured)` };
    if (code === 0 || isNaN(code)) return { reachable: false, error: `curl returned empty status code` };
    // 2xx, 3xx, 4xx (other than 403), 5xx all mean the host is reachable
    return { reachable: true, error: code >= 400 ? `HTTP ${code}` : null };
  } catch (e) {
    return {
      reachable: false,
      error: e instanceof Error ? e.message.slice(0, 120) : 'curl failed',
    };
  }
}

export function getInfraVOWorkerConfig(): BrainCoreInfraVOWorkerConfigResponse {
  try {
    const env = readPlistEnv();
    const n8nWebhookUrl = env['VO_N8N_WEBHOOK_URL'] ?? '';
    const cfId = env['CF_ACCESS_CLIENT_ID'] ?? '';
    const cfSecret = env['CF_ACCESS_CLIENT_SECRET'] ?? '';
    const cfAccessConfigured = Boolean(cfId && !cfId.startsWith('PLACEHOLDER') && cfSecret && !cfSecret.startsWith('PLACEHOLDER'));
    const n8nWebhookConfigured = Boolean(n8nWebhookUrl && !n8nWebhookUrl.startsWith('PLACEHOLDER'));

    const youtubeOauthAccounts = getYoutubeOauthAccounts();
    const youtubeOauthConfigured = youtubeOauthAccounts.length > 0;

    const { reachable: n8nReachable, error: n8nReachableError } = n8nWebhookConfigured
      ? checkN8nReachable(n8nWebhookUrl)
      : { reachable: null, error: 'webhook URL not configured' };

    const manualActionsRequired: string[] = [];
    if (!cfAccessConfigured) {
      manualActionsRequired.push(
        'Create Cloudflare Access service token for video-orchestrator-worker: Cloudflare Zero Trust → Access → Service Auth → Service Tokens → Create Token (name: video-orchestrator-worker). Then set CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET in ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist and reload the worker.',
      );
    }
    if (!youtubeOauthConfigured) {
      manualActionsRequired.push(
        'Authorize YouTube OAuth for @says-the-bible: run `youtube_uploader.py auth-url --account @says-the-bible`, visit the URL, then run `youtube_uploader.py auth-exchange --account @says-the-bible --code <CODE>`. Requires Google Cloud OAuth client credentials in keychain (service=video-orchestrator, account=yt-oauth-client-@says-the-bible).',
      );
    }
    if (!n8nWebhookConfigured) {
      manualActionsRequired.push('Set VO_N8N_WEBHOOK_URL in worker plist to n8n webhook base URL.');
    } else if (n8nReachable === false) {
      manualActionsRequired.push(
        `n8n webhook at ${n8nWebhookUrl} is unreachable (${n8nReachableError ?? 'unknown error'}). Verify CF Access service token is active and the n8n instance is running on Dokploy.`,
      );
    }

    return {
      ok: true,
      config: {
        n8nWebhookUrl,
        n8nWebhookConfigured,
        cfAccessConfigured,
        cfAccessClientIdPresent: Boolean(cfId && !cfId.startsWith('PLACEHOLDER')),
        cfAccessClientSecretPresent: Boolean(cfSecret && !cfSecret.startsWith('PLACEHOLDER')),
        n8nReachable,
        n8nReachableError,
        youtubeOauthConfigured,
        youtubeOauthAccounts,
      },
      manualActionsRequired,
    };
  } catch (err) {
    return {
      ok: false,
      config: null,
      manualActionsRequired: ['Worker config could not be read — check plist path'],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
