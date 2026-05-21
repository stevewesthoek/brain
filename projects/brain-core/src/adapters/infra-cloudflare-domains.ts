import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface InfraCloudfareDomain {
  name: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
}

export interface InfraCloudflareDomainsStatus {
  status: 'ok' | 'not-configured' | 'error';
  domains: InfraCloudfareDomain[];
  error?: string;
}

function loadCredentials(): { token: string } | null {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (token) return { token };

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
    if (t) return { token: t };
  } catch { /* ignore */ }

  return null;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getInfraCloudfareDomains(): Promise<InfraCloudflareDomainsStatus> {
  const creds = loadCredentials();
  if (!creds) {
    return {
      status: 'not-configured',
      domains: [],
      error: 'Cloudflare credentials not configured. Set CLOUDFLARE_API_TOKEN or create ~/.config/cloudflare-ai/credentials/prochat-provisioner.env.',
    };
  }

  try {
    const authHeaders = { Authorization: `Bearer ${creds.token}` };
    const zonesResp = await fetchJson<{ result?: Array<{ name: string; status: string; created_on: string }> }>(
      'https://api.cloudflare.com/client/v4/zones?per_page=100',
      authHeaders,
    );
    const zones = zonesResp.result ?? [];

    const domains: InfraCloudfareDomain[] = await Promise.all(
      zones.map(async (zone): Promise<InfraCloudfareDomain> => {
        let expiresAt: string | null = null;
        try {
          const rdapController = new AbortController();
          const rdapTimeout = setTimeout(() => rdapController.abort(), 5_000);
          try {
            const rdapResp = await fetch(`https://rdap.org/domain/${zone.name}`, { signal: rdapController.signal });
            if (rdapResp.ok) {
              const rdap = (await rdapResp.json()) as { events?: Array<{ eventAction: string; eventDate: string }> };
              expiresAt = rdap.events?.find((e) => e.eventAction === 'expiration')?.eventDate ?? null;
            }
          } finally {
            clearTimeout(rdapTimeout);
          }
        } catch { /* best-effort */ }

        const daysUntilExpiry = expiresAt
          ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
          : null;

        return { name: zone.name, status: zone.status, createdAt: zone.created_on, expiresAt, daysUntilExpiry };
      }),
    );

    domains.sort((a, b) => {
      if (a.daysUntilExpiry !== null && b.daysUntilExpiry !== null) return a.daysUntilExpiry - b.daysUntilExpiry;
      if (a.daysUntilExpiry !== null) return -1;
      if (b.daysUntilExpiry !== null) return 1;
      return a.name.localeCompare(b.name);
    });

    return { status: 'ok', domains };
  } catch (err) {
    return { status: 'error', domains: [], error: err instanceof Error ? err.message : String(err) };
  }
}
