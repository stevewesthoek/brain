import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface CloudflareTunnelHostname {
  hostname: string;
  service: string;
  online: boolean | null;
}

export interface CloudflareTunnel {
  id: string;
  name: string;
  status: string;
  hostnames: CloudflareTunnelHostname[];
}

export interface CloudflareTunnelsData {
  tunnels: CloudflareTunnel[];
  error?: string;
}

// Cache for 90 seconds (tunnels change rarely)
let cachedTunnels: CloudflareTunnelsData | null = null;
let cacheTime: number = 0;

function loadCloudflareEnv(): { token: string; accountId: string } | null {
  // Try process.env first
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (token && accountId) {
    return { token, accountId };
  }

  // Fallback: read from ~/.config/cloudflare-ai/credentials/prochat-provisioner.env
  try {
    const credPath = path.join(os.homedir(), ".config", "cloudflare-ai", "credentials", "prochat-provisioner.env");
    if (!fs.existsSync(credPath)) return null;

    const content = fs.readFileSync(credPath, "utf-8");
    const lines = content.split("\n");
    const env: Record<string, string> = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && match[1] && match[2]) {
        env[match[1]] = match[2].trim();
      }
    }

    const token2 = env.CLOUDFLARE_API_TOKEN;
    const accountId2 = env.CLOUDFLARE_ACCOUNT_ID;
    if (token2 && accountId2) {
      return { token: token2, accountId: accountId2 };
    }
  } catch {
    // ignore
  }

  return null;
}

async function checkHostnameReachable(hostname: string): Promise<boolean | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`https://${hostname}`, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return true; // any HTTP response means reachable
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false; // connection failed or timeout
  }
}

export async function getCloudflareTunnels(): Promise<CloudflareTunnelsData> {
  // Check cache
  const now = Date.now();
  if (cachedTunnels && now - cacheTime < 90_000) {
    return cachedTunnels;
  }

  try {
    const creds = loadCloudflareEnv();
    if (!creds) {
      return {
        tunnels: [],
        error: "Cloudflare credentials not configured",
      };
    }

    const { token, accountId } = creds;
    const apiBase = "https://api.cloudflare.com/client/v4";

    // Fetch all tunnels
    const tunnelsRes = await fetch(`${apiBase}/accounts/${accountId}/cfd_tunnel?per_page=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!tunnelsRes.ok) {
      throw new Error(`Cloudflare tunnels list failed: ${tunnelsRes.status}`);
    }

    const tunnelsJson = (await tunnelsRes.json()) as Record<string, unknown>;
    const allTunnels = tunnelsJson.result as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(allTunnels)) {
      throw new Error("Invalid Cloudflare tunnels response");
    }

    // Filter to the three important tunnels
    const targetNames = ["CloudPanel AWS", "Dokploy", "Supabase"];
    const filtered = allTunnels.filter(
      (t) => targetNames.includes(typeof t.name === "string" ? t.name : ""),
    );

    // Sort by target order
    const sorted = targetNames
      .map((name) => filtered.find((t) => t.name === name))
      .filter(Boolean) as Array<Record<string, unknown>>;

    const tunnels: CloudflareTunnel[] = [];

    // Fetch configurations for each tunnel
    for (const tunnel of sorted) {
      const tunnelId = tunnel.id;
      const tunnelName = tunnel.name;
      const tunnelStatus = tunnel.status;

      if (typeof tunnelId !== "string" || typeof tunnelName !== "string") continue;

      // Fetch ingress rules for this tunnel
      const configRes = await fetch(
        `${apiBase}/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      const hostnames: CloudflareTunnelHostname[] = [];

      if (configRes.ok) {
        const configJson = (await configRes.json()) as Record<string, unknown>;
        const config = configJson.result as Record<string, unknown> | undefined;
        const ingress = config?.config as Record<string, unknown> | undefined;
        const ingressRules = ingress?.ingress as Array<Record<string, unknown>> | undefined;

        if (Array.isArray(ingressRules)) {
          for (const rule of ingressRules) {
            const hostname = rule.hostname;
            const service = rule.service;

            // Skip catch-all rule (empty hostname)
            if (typeof hostname !== "string" || !hostname.trim()) continue;
            if (typeof service !== "string") continue;

            hostnames.push({
              hostname,
              service,
              online: null, // will check async below
            });
          }
        }
      }

      // Check reachability of each hostname in parallel (5-second timeout per check)
      const reachabilityChecks = await Promise.all(
        hostnames.map(async (h) => ({
          hostname: h.hostname,
          service: h.service,
          online: await checkHostnameReachable(h.hostname),
        })),
      );

      tunnels.push({
        id: tunnelId,
        name: tunnelName,
        status: typeof tunnelStatus === "string" ? tunnelStatus : "unknown",
        hostnames: reachabilityChecks,
      });
    }

    const result: CloudflareTunnelsData = { tunnels };
    cachedTunnels = result;
    cacheTime = now;
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.warn("Cloudflare tunnels fetch error:", errorMsg);
    return {
      tunnels: [],
      error: `Failed to fetch tunnels: ${errorMsg}`,
    };
  }
}
