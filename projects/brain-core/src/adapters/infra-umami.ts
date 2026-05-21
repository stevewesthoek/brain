export interface InfraUmamiWebsite {
  id: string;
  name: string;
  domain: string;
  active: number;
  pageviews: number;
  visitors: number;
  visits: number;
  bounceRate: number;
  error?: string;
}

export interface InfraUmamiStatus {
  status: 'ok' | 'not-configured' | 'error';
  websites: InfraUmamiWebsite[];
  error?: string;
}

async function umamiFetch(url: string, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const r = await fetch(url, { headers, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function getInfraUmamiStatus(): Promise<InfraUmamiStatus> {
  const baseUrl = (process.env.UMAMI_URL ?? '').replace(/\/$/, '');
  const apiKey = process.env.UMAMI_API_KEY ?? '';
  const username = process.env.UMAMI_USERNAME ?? '';
  const password = process.env.UMAMI_PASSWORD ?? '';

  if (!baseUrl) {
    return { status: 'not-configured', websites: [], error: 'Umami not configured. Set UMAMI_URL and UMAMI_API_KEY (or UMAMI_USERNAME + UMAMI_PASSWORD).' };
  }

  if (!apiKey && (!username || !password)) {
    return { status: 'not-configured', websites: [], error: 'Umami credentials not configured. Set UMAMI_API_KEY or UMAMI_USERNAME + UMAMI_PASSWORD.' };
  }

  let authHeaders: Record<string, string>;

  if (apiKey) {
    authHeaders = { 'x-umami-api-key': apiKey };
  } else {
    try {
      const loginController = new AbortController();
      const loginTimeout = setTimeout(() => loginController.abort(), 10_000);
      let loginResp: Response;
      try {
        loginResp = await fetch(`${baseUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
          signal: loginController.signal,
        });
      } finally {
        clearTimeout(loginTimeout);
      }
      const loginData = (await loginResp.json()) as { token?: string };
      if (!loginData.token) return { status: 'error', websites: [], error: 'Umami login failed — check credentials.' };
      authHeaders = { Authorization: `Bearer ${loginData.token}` };
    } catch (err) {
      return { status: 'error', websites: [], error: `Umami auth failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  try {
    const listResp = await umamiFetch(`${baseUrl}/api/websites?pageSize=100`, authHeaders);
    const list = Array.isArray(listResp)
      ? (listResp as Array<{ id: string; name: string; domain: string }>)
      : ((listResp as { data?: Array<{ id: string; name: string; domain: string }> }).data ?? []);

    const startAt = new Date().setHours(0, 0, 0, 0);
    const endAt = Date.now();

    const websites: InfraUmamiWebsite[] = await Promise.all(
      list.slice(0, 25).map(async (site): Promise<InfraUmamiWebsite> => {
        try {
          const [statsRaw, activeRaw] = await Promise.all([
            umamiFetch(`${baseUrl}/api/websites/${site.id}/stats?startAt=${startAt}&endAt=${endAt}`, authHeaders),
            umamiFetch(`${baseUrl}/api/websites/${site.id}/active`, authHeaders),
          ]);

          const s = statsRaw as Record<string, number | { value?: number } | unknown>;
          const sv = (k: string): number => {
            const v = s[k];
            if (typeof v === 'number') return v;
            if (v && typeof v === 'object' && 'value' in v) return (v as { value?: number }).value ?? 0;
            return 0;
          };

          const activeResp = activeRaw as { x?: number; visitors?: number } | number | Array<{ x?: number }>;
          const active = typeof activeResp === 'number'
            ? activeResp
            : Array.isArray(activeResp)
              ? (activeResp[0]?.x ?? 0)
              : (activeResp?.visitors ?? activeResp?.x ?? 0);

          const visits = sv('visits');
          const bounceRate = visits > 0 ? Math.round((sv('bounces') / visits) * 100) : 0;

          return { id: site.id, name: site.name, domain: site.domain, active, pageviews: sv('pageviews'), visitors: sv('visitors'), visits, bounceRate };
        } catch {
          return { id: site.id, name: site.name, domain: site.domain, active: 0, pageviews: 0, visitors: 0, visits: 0, bounceRate: 0, error: 'fetch failed' };
        }
      }),
    );

    websites.sort((a, b) => b.visitors - a.visitors);
    return { status: 'ok', websites };
  } catch (err) {
    return { status: 'error', websites: [], error: err instanceof Error ? err.message : String(err) };
  }
}
