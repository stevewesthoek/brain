import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface InfraDokployApp {
  project: string;
  environment: string;
  name: string;
  status: string;
}

export interface InfraDokployCompose {
  project: string;
  environment: string;
  name: string;
  status: string;
}

export interface InfraDokployStatus {
  status: 'ok' | 'not-configured' | 'error';
  apps: InfraDokployApp[];
  compose: InfraDokployCompose[];
  totalApps: number;
  totalCompose: number;
  appsByStatus: Record<string, number>;
  composeByStatus: Record<string, number>;
  error?: string;
}

function loadCredentials(): { url: string; apiKey: string } | null {
  try {
    const envPath = path.join(os.homedir(), '.config', 'dokploy', '.env');
    if (!fs.existsSync(envPath)) return null;
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    const env: Record<string, string> = {};
    for (const line of lines) {
      const match = line.match(/^([A-Z_]+)=(.*)$/);
      if (match && match[1] && match[2] !== undefined) env[match[1]] = match[2].trim();
    }
    const url = env.DOKPLOY_URL;
    const apiKey = env.DOKPLOY_API_KEY;
    if (!url || !apiKey) return null;
    return { url, apiKey };
  } catch {
    return null;
  }
}

export async function getInfraDokployStatus(): Promise<InfraDokployStatus> {
  const creds = loadCredentials();
  if (!creds) {
    return {
      status: 'not-configured',
      apps: [],
      compose: [],
      totalApps: 0,
      totalCompose: 0,
      appsByStatus: {},
      composeByStatus: {},
      error: 'Dokploy credentials not configured. Create ~/.config/dokploy/.env with DOKPLOY_URL and DOKPLOY_API_KEY.',
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${creds.url}/api/project.all`, {
        headers: { 'x-api-key': creds.apiKey, 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!rawResponse.ok) {
      return {
        status: 'error',
        apps: [],
        compose: [],
        totalApps: 0,
        totalCompose: 0,
        appsByStatus: {},
        composeByStatus: {},
        error: `Dokploy API returned ${rawResponse.status}`,
      };
    }

    const projects = (await rawResponse.json()) as Array<{
      name?: string;
      environments?: Array<{
        name?: string;
        applications?: Array<{ name?: string; applicationStatus?: string }>;
        compose?: Array<{ name?: string; composeStatus?: string }>;
      }>;
    }>;

    const apps: InfraDokployApp[] = [];
    const compose: InfraDokployCompose[] = [];

    for (const project of projects) {
      for (const env of project.environments ?? []) {
        for (const app of env.applications ?? []) {
          apps.push({
            project: project.name ?? 'unknown',
            environment: env.name ?? 'default',
            name: app.name ?? 'unknown',
            status: app.applicationStatus ?? 'unknown',
          });
        }
        for (const svc of env.compose ?? []) {
          compose.push({
            project: project.name ?? 'unknown',
            environment: env.name ?? 'default',
            name: svc.name ?? 'unknown',
            status: svc.composeStatus ?? 'unknown',
          });
        }
      }
    }

    const appsByStatus = apps.reduce<Record<string, number>>((acc, a) => {
      acc[a.status] = (acc[a.status] ?? 0) + 1;
      return acc;
    }, {});
    const composeByStatus = compose.reduce<Record<string, number>>((acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    }, {});

    return { status: 'ok', apps, compose, totalApps: apps.length, totalCompose: compose.length, appsByStatus, composeByStatus };
  } catch (err) {
    return {
      status: 'error',
      apps: [],
      compose: [],
      totalApps: 0,
      totalCompose: 0,
      appsByStatus: {},
      composeByStatus: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
