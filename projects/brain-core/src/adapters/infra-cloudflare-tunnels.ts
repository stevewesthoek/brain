import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface InfraTunnelHostname {
  hostname: string;
  service: string;
  online: boolean | null;
}

export interface InfraTunnel {
  id: string;
  name: string;
  status: string;
  hostnames: InfraTunnelHostname[];
}

export interface InfraCloudflareTunnelsStatus {
  status: 'ok' | 'not-configured' | 'error';
  tunnels: InfraTunnel[];
  error?: string;
}

const CACHE_TTL_MS = 90_000;
let cachedTunnels: InfraCloudflareTunnelsStatus | null = null;
let cachedAt = 0;

function loadCredentials(): { token: string; accountId: string } | null {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (token && accountId) return { token, accountId };

  try {
    const credPath = path.join(os.homedir(), '.config', 'cloudflare-ai', 'credentials', 'prochat-provisioner.env');
    if (!fs.existsSync(credPath)) return null;
    const lines = fs.readFileSync(credPath, 'utf8').split('\n');
    const env: Record<string, string> = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && match[1] && match[2] !== undefined) env[match[1]] = match[2].trim();
    }
    const t = env.CLOUDFLARE_API_TOKEN;
    const a = env.CLOUDFLARE_ACCOUNT_ID;
    if (t && a) return { token: t, accountId: a };
  } catch { /* ignore */ }

  return null;
}

async function checkHostnameReachable(hostname: string): Promise<boolean | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const response = await fetch(`https://${hostname}`, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      });
      return response.ok || response.status >= 200;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

function buildTunnelConfigUrl(accountId: string, tunnelId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`;
}

export async function getInfraCloudflareTunnels(): Promise<InfraCloudflareTunnelsStatus> {
  const now = Date.now();
  if (cachedTunnels && now - cachedAt < CACHE_TTL_MS) return cachedTunnels;

  const creds = loadCredentials();
  if (!creds) {
    const result: InfraCloudflareTunnelsStatus = {
      status: 'not-configured',
      tunnels: [],
      error: 'Cloudflare credentials not configured. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or create ~/.config/cloudflare-ai/credentials/prochat-provisioner.env.',
    };
    cachedTunnels = result;
    cachedAt = now;
    return result;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let rawResponse: Response;
    try {
      rawResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/cfd_tunnel?is_deleted=false`,
        { headers: { Authorization: `Bearer ${creds.token}` }, signal: controller.signal },
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!rawResponse.ok) {
      const result: InfraCloudflareTunnelsStatus = { status: 'error', tunnels: [], error: `Cloudflare API returned ${rawResponse.status}` };
      cachedTunnels = result;
      cachedAt = now;
      return result;
    }

    const data = (await rawResponse.json()) as {
      result?: Array<{
        id?: string;
        name?: string;
        status?: string;
        connections?: Array<unknown>;
      }>;
    };

    const tunnels: InfraTunnel[] = [];
    for (const tunnel of data.result ?? []) {
      const tunnelId = tunnel.id ?? '';
      const tunnelName = tunnel.name ?? 'unknown';
      if (!tunnelId) continue;

      const configController = new AbortController();
      const configTimeout = setTimeout(() => configController.abort(), 10_000);
      let configRes: Response;
      try {
        configRes = await fetch(buildTunnelConfigUrl(creds.accountId, tunnelId), {
          headers: { Authorization: `Bearer ${creds.token}` },
          signal: configController.signal,
        });
      } finally {
        clearTimeout(configTimeout);
      }

      const hostnames: Array<{ hostname: string; service: string }> = [];
      if (configRes.ok) {
        const configJson = (await configRes.json()) as {
          result?: {
            config?: {
              ingress?: Array<{
                hostname?: string;
                service?: string;
              }>;
            };
          };
        };
        const ingressRules = configJson.result?.config?.ingress;
        for (const rule of ingressRules ?? []) {
          if (!rule.hostname?.trim() || !rule.service) continue;
          hostnames.push({ hostname: rule.hostname, service: rule.service });
        }
      }

      const hostnamesWithReachability = await Promise.all(
        hostnames.map(async (hostname) => ({
          ...hostname,
          online: await checkHostnameReachable(hostname.hostname),
        })),
      );

      tunnels.push({
        id: tunnelId,
        name: tunnelName,
        status: tunnel.status ?? 'unknown',
        hostnames: hostnamesWithReachability,
      });
    }

    const result: InfraCloudflareTunnelsStatus = { status: 'ok', tunnels };
    cachedTunnels = result;
    cachedAt = now;
    return result;
  } catch (err) {
    const result: InfraCloudflareTunnelsStatus = { status: 'error', tunnels: [], error: err instanceof Error ? err.message : String(err) };
    cachedTunnels = result;
    cachedAt = now;
    return result;
  }
}
