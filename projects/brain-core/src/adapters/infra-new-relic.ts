import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface InfraNewRelicHost {
  name: string;
  reporting: boolean;
  alertSeverity: string | null;
}

export interface InfraNewRelicSynthetic {
  name: string;
  reporting: boolean;
  alertSeverity: string | null;
  monitorId?: string;
}

export interface InfraNewRelicStatus {
  status: 'ok' | 'not-configured' | 'error';
  hosts: InfraNewRelicHost[];
  synthetics: InfraNewRelicSynthetic[];
  error?: string;
}

export async function getInfraNewRelicStatus(): Promise<InfraNewRelicStatus> {
  const credentials = loadNewRelicCredentials();
  const apiKey = credentials.apiKey;
  const accountId = credentials.accountId;

  if (!apiKey || !accountId) {
    return {
      status: 'not-configured',
      hosts: [],
      synthetics: [],
      error: 'New Relic credentials not configured. Set NEW_RELIC_USER_API_KEY and NEW_RELIC_ACCOUNT_ID in the process env or ~/.config/newrelic/.env.',
    };
  }

  const query = `{
    actor {
      hosts: entitySearch(query: "accountId = ${accountId} AND type = 'HOST' AND domain = 'INFRA'") {
        results { entities { name reporting alertSeverity } }
      }
      synthetics: entitySearch(query: "accountId = ${accountId} AND domain = 'SYNTH' AND type = 'MONITOR'") {
        results { entities { name reporting alertSeverity ... on SyntheticMonitorEntityOutline { monitorId } } }
      }
    }
  }`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    let rawResponse: Response;
    try {
      rawResponse = await fetch('https://api.eu.newrelic.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'API-Key': apiKey },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!rawResponse.ok) {
      return { status: 'error', hosts: [], synthetics: [], error: `New Relic API returned ${rawResponse.status}` };
    }

    const data = (await rawResponse.json()) as {
      data?: {
        actor?: {
          hosts?: { results?: { entities?: Array<{ name?: string; reporting?: boolean; alertSeverity?: string }> } };
          synthetics?: { results?: { entities?: Array<{ name?: string; reporting?: boolean; alertSeverity?: string; monitorId?: string }> } };
        };
      };
    };

    const hosts: InfraNewRelicHost[] = (data.data?.actor?.hosts?.results?.entities ?? []).map((e) => ({
      name: e.name ?? 'unknown',
      reporting: e.reporting ?? false,
      alertSeverity: e.alertSeverity ?? null,
    }));

    const synthetics: InfraNewRelicSynthetic[] = (data.data?.actor?.synthetics?.results?.entities ?? []).map((e) => ({
      name: e.name ?? 'unknown',
      reporting: e.reporting ?? false,
      alertSeverity: e.alertSeverity ?? null,
      ...(e.monitorId !== undefined && { monitorId: e.monitorId }),
    }));

    return { status: 'ok', hosts, synthetics };
  } catch (err) {
    return { status: 'error', hosts: [], synthetics: [], error: err instanceof Error ? err.message : String(err) };
  }
}

function loadNewRelicCredentials(): { apiKey?: string; accountId?: string } {
  const envPath = path.join(os.homedir(), '.config', 'newrelic', '.env');
  const merged = parseEnvFile(envPath);
  const apiKey = process.env.NEW_RELIC_USER_API_KEY || merged.get('NEW_RELIC_USER_API_KEY');
  const accountId = process.env.NEW_RELIC_ACCOUNT_ID || merged.get('NEW_RELIC_ACCOUNT_ID');

  return {
    ...(apiKey ? { apiKey } : {}),
    ...(accountId ? { accountId } : {}),
  };
}

function parseEnvFile(filePath: string): Map<string, string> {
  const env = new Map<string, string>();
  if (!fs.existsSync(filePath)) {
    return env;
  }

  const contents = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const equalsIndex = line.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env.set(key, value);
  }

  return env;
}
