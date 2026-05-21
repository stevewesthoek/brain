import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface InfraTunnelHostname {
  hostname: string;
  service: string;
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

export async function getInfraCloudflareTunnels(): Promise<InfraCloudflareTunnelsStatus> {
  const creds = loadCredentials();
  if (!creds) {
    return {
      status: 'not-configured',
      tunnels: [],
      error: 'Cloudflare credentials not configured. Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, or create ~/.config/cloudflare-ai/credentials/prochat-provisioner.env.',
    };
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
      return { status: 'error', tunnels: [], error: `Cloudflare API returned ${rawResponse.status}` };
    }

    const data = (await rawResponse.json()) as {
      result?: Array<{
        id?: string;
        name?: string;
        status?: string;
        connections?: Array<unknown>;
      }>;
    };

    const tunnels: InfraTunnel[] = (data.result ?? []).map((t) => ({
      id: t.id ?? '',
      name: t.name ?? 'unknown',
      status: t.status ?? 'unknown',
      hostnames: [],
    }));

    return { status: 'ok', tunnels };
  } catch (err) {
    return { status: 'error', tunnels: [], error: err instanceof Error ? err.message : String(err) };
  }
}
