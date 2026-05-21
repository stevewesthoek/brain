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
  const apiKey = process.env.NEW_RELIC_USER_API_KEY;
  const accountId = process.env.NEW_RELIC_ACCOUNT_ID;

  if (!apiKey || !accountId) {
    return {
      status: 'not-configured',
      hosts: [],
      synthetics: [],
      error: 'New Relic credentials not configured. Set NEW_RELIC_USER_API_KEY and NEW_RELIC_ACCOUNT_ID environment variables.',
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
