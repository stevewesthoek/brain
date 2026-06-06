import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface InfraNewRelicHost {
  name: string;
  reporting: boolean;
  alertSeverity: string | null;
  online: boolean | null;
  lastSeenAt: string | null;
}

export interface InfraNewRelicSynthetic {
  name: string;
  reporting: boolean;
  alertSeverity: string | null;
  monitorId?: string;
  online: boolean | null;
  lastCheckAt: string | null;
  lastResult: string | null;
  lastError: string | null;
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
      account(id: ${accountId}) {
        hostSamples: nrql(query: "SELECT latest(timestamp) FROM SystemSample FACET hostname SINCE 15 minutes ago LIMIT 100") {
          results
        }
        syntheticChecks: nrql(query: "SELECT latest(result), latest(error), latest(timestamp) FROM SyntheticCheck FACET monitorName SINCE 1 day ago LIMIT 100") {
          results
        }
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
          account?: {
            hostSamples?: { results?: Array<{ facet?: string; hostname?: string; 'latest.timestamp'?: number }> };
            syntheticChecks?: { results?: Array<{ facet?: string; monitorName?: string; 'latest.result'?: string; 'latest.error'?: string; 'latest.timestamp'?: number }> };
          };
        };
      };
    };

    const hostSamples = data.data?.actor?.account?.hostSamples?.results ?? [];
    const syntheticChecks = data.data?.actor?.account?.syntheticChecks?.results ?? [];
    const hostLastSeen = new Map(
      hostSamples
        .filter((sample): sample is { facet: string; 'latest.timestamp': number } => Boolean(sample.facet) && typeof sample['latest.timestamp'] === 'number')
        .map((sample) => [sample.facet, sample['latest.timestamp']]),
    );
    const syntheticLatest = new Map(
      syntheticChecks
        .filter((check): check is { facet: string; 'latest.result'?: string; 'latest.error'?: string; 'latest.timestamp'?: number } => Boolean(check.facet))
        .map((check) => [check.facet, check]),
    );

    const hosts: InfraNewRelicHost[] = (data.data?.actor?.hosts?.results?.entities ?? []).map((e) => {
      const lastSeen = e.name ? hostLastSeen.get(e.name) : undefined;
      const online = typeof lastSeen === 'number' ? true : e.reporting ?? false ? true : null;
      return {
        name: e.name ?? 'unknown',
        reporting: e.reporting ?? false,
        alertSeverity: e.alertSeverity ?? null,
        online,
        lastSeenAt: typeof lastSeen === 'number' ? new Date(lastSeen).toISOString() : null,
      };
    });

    const synthetics: InfraNewRelicSynthetic[] = (data.data?.actor?.synthetics?.results?.entities ?? []).map((e) => {
      const latest = e.name ? syntheticLatest.get(e.name) : undefined;
      const result = latest?.['latest.result'] ?? null;
      const online = result === 'SUCCESS' ? true : result === 'FAILED' ? false : null;
      return {
        name: e.name ?? 'unknown',
        reporting: e.reporting ?? false,
        alertSeverity: online === true ? null : e.alertSeverity ?? null,
        ...(e.monitorId !== undefined && { monitorId: e.monitorId }),
        online,
        lastCheckAt: latest?.['latest.timestamp'] ? new Date(latest['latest.timestamp']).toISOString() : null,
        lastResult: result,
        lastError: latest?.['latest.error'] ?? null,
      };
    });

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
